import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import {
  dispensingId,
  type DispensingId,
} from "@yrese/shared-kernel";
import {
  dispensingRecordViewSchema,
  prescriptionDraftContentSchema,
  type DispensingItemInput,
  type DispensingRecordView,
} from "@yrese/contracts";

import type {
  DispensingConfirmInput,
  DispensingConfirmResult,
  DispensingCreateInput,
  DispensingCreateResult,
  DispensingService,
} from "../dispensing-service.js";
import { appendAuditEventWithinTransaction } from "./audit-repository.js";
import type { PostgresActorQualificationRepository } from "./actor-qualification-repository.js";
import { masterReadRepositoryForClient } from "./master-repository.js";
import { runInPooledTransaction } from "./pool.js";
import { snapshotDatabaseInstant } from "../instant.js";

/**
 * WP-7404: dispensing_records / dispensing_items の PostgreSQL 実装。
 * in-memory 実装と同一の guard 順序・結果 union(packet §4)。
 * 全 read/write は tx client 上で行い、tx 保持中の pool 再借用を避ける
 * (WP-7304 M-1 教訓)。
 */

const dispensingDatabaseInvariantErrorMessage =
  "dispensing database invariant violated";

interface DispensingRecordRow {
  readonly dispensing_id: string;
  readonly prescription_id: string;
  readonly prescription_version: number;
  readonly dispensing_date: string;
  readonly status: string | null;
  readonly idempotency_key: string;
  readonly confirm_idempotency_key: string | null;
  readonly confirmed_by: string | null;
  readonly confirmed_at: string | null;
  readonly created_by: string;
  readonly created_at: string;
  readonly create_request: unknown;
}

interface DispensingItemRow {
  readonly rp_item_id: string;
  readonly prescribed_medication_item_id: string | null;
  readonly dispensed_medication_item_id: string | null;
  readonly dispensed_text: string | null;
  readonly quantity: string;
  readonly remaining_stock_adjustment: string | null;
  readonly note: string | null;
  readonly dispensed_by: string;
}

interface PrescriptionVersionContentRow {
  readonly content: unknown;
}

export interface PostgresDispensingServiceDeps {
  /** 未注入なら confirm は常に unqualified(fail-closed、SEC-010)。 */
  readonly qualificationRepository?: PostgresActorQualificationRepository;
  readonly nextOutboxEventId?: () => string;
  readonly nextDispensingId?: () => DispensingId;
}

export class PostgresDispensingService implements DispensingService {
  constructor(
    private readonly pool: Pool,
    private readonly deps: PostgresDispensingServiceDeps = {},
  ) {}

  private async selectRecord(
    client: PoolClient,
    input: {
      tenantId: string;
      pharmacyId: string;
      dispensingId: string;
    },
    forUpdate: boolean,
  ): Promise<DispensingRecordRow | undefined> {
    const rows = await client.query<DispensingRecordRow>(
      `SELECT dispensing_id, prescription_id, prescription_version,
              dispensing_date::text AS dispensing_date, status,
              idempotency_key, confirm_idempotency_key,
              confirmed_by, confirmed_at, created_by, created_at,
              create_request
         FROM dispensing_records
        WHERE tenant_id = $1 AND pharmacy_id = $2 AND dispensing_id = $3
        ${forUpdate ? "FOR UPDATE" : ""}`,
      [input.tenantId, input.pharmacyId, input.dispensingId],
    );
    return rows.rows[0];
  }

  private async selectItems(
    client: PoolClient,
    input: { tenantId: string; pharmacyId: string; dispensingId: string },
  ): Promise<readonly DispensingItemRow[]> {
    const rows = await client.query<DispensingItemRow>(
      `SELECT rp_item_id, prescribed_medication_item_id,
              dispensed_medication_item_id, dispensed_text, quantity,
              remaining_stock_adjustment, note, dispensed_by
         FROM dispensing_items
        WHERE tenant_id = $1 AND pharmacy_id = $2 AND dispensing_id = $3
        ORDER BY rp_item_id`,
      [input.tenantId, input.pharmacyId, input.dispensingId],
    );
    return rows.rows;
  }

  async create(input: DispensingCreateInput): Promise<DispensingCreateResult> {
    // 並行 create の一意違反は tx abort → retry で committed winner を
    // replay(idempotent)または already_recorded/idempotency_conflict として
    // 再評価する。2 回目の一意違反は fail-visible(error)にする。
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await this.createAttempt(input);
      if (result.kind !== "retry") return result;
    }
    throw new Error(dispensingDatabaseInvariantErrorMessage);
  }

  private async createAttempt(
    input: DispensingCreateInput,
  ): Promise<DispensingCreateResult | { readonly kind: "retry" }> {
    return runInPooledTransaction(this.pool, async (client) => {
      const requestJson = JSON.stringify({
        prescriptionId: input.prescriptionId,
        prescriptionVersion: input.prescriptionVersion,
        dispensingDate: input.dispensingDate,
        items: input.items,
      });
      // 冪等 replay: 同一 key で payload 等価 → stored view、別 payload → 409。
      const byKey = await client.query<DispensingRecordRow>(
        `SELECT dispensing_id, prescription_id, prescription_version,
                dispensing_date::text AS dispensing_date, status,
                idempotency_key, confirm_idempotency_key,
                confirmed_by, confirmed_at, created_by, created_at,
                create_request
           FROM dispensing_records
          WHERE tenant_id = $1 AND pharmacy_id = $2 AND idempotency_key = $3`,
        [input.tenantId, input.pharmacyId, input.idempotencyKey],
      );
      const replayRow = byKey.rows[0];
      if (replayRow !== undefined) {
        // JSONB の等値比較は DB 側で行う(キー順・空白の正規化差で
        // JS 文字列比較すると誤って conflict になる)。
        const equality = await client.query<{ readonly equal: boolean }>(
          `SELECT create_request = $4::jsonb AS equal
             FROM dispensing_records
            WHERE tenant_id = $1 AND pharmacy_id = $2 AND idempotency_key = $3`,
          [
            input.tenantId,
            input.pharmacyId,
            input.idempotencyKey,
            requestJson,
          ],
        );
        if (equality.rows[0]?.equal === true) {
          const view = await this.viewFor(client, input.tenantId, input.pharmacyId, replayRow);
          await client.query("COMMIT");
          return { kind: "created", record: view, replayed: true };
        }
        await client.query("ROLLBACK");
        return { kind: "idempotency_conflict" };
      }

      // guard 3: 確定版の存在(version 行は finalize tx でのみ作られる)。
      const versionRows = await client.query<PrescriptionVersionContentRow>(
        `SELECT content
           FROM prescription_versions
          WHERE tenant_id = $1 AND pharmacy_id = $2
            AND prescription_id = $3 AND version = $4`,
        [
          input.tenantId,
          input.pharmacyId,
          input.prescriptionId,
          input.prescriptionVersion,
        ],
      );
      const versionRow = versionRows.rows[0];
      if (versionRow === undefined) {
        await client.query("ROLLBACK");
        return { kind: "not_found" };
      }

      // inquiry 記録との TOCTOU を防ぐ: createInquiry は prescription_drafts
      // 行を FOR UPDATE で直列化しているため、同じ行 lock を取得してから
      // inquiry guard を評価する(並行 inquiry の commit を待機)。
      const draftLock = await client.query<{
        readonly prescription_id: string;
      }>(
        `SELECT prescription_id
           FROM prescription_drafts
          WHERE tenant_id = $1 AND pharmacy_id = $2 AND prescription_id = $3
          FOR UPDATE`,
        [input.tenantId, input.pharmacyId, input.prescriptionId],
      );
      if (draftLock.rows[0] === undefined) {
        await client.query("ROLLBACK");
        return { kind: "not_found" };
      }

      // guard 4: 未解決 inquiry(answer IS NULL)が 1 件でもあれば拒否。
      const openInquiry = await client.query<{ readonly inquiry_id: string }>(
        `SELECT inquiry_id
           FROM prescription_inquiries
          WHERE tenant_id = $1 AND pharmacy_id = $2
            AND prescription_id = $3 AND answer IS NULL
          LIMIT 1`,
        [input.tenantId, input.pharmacyId, input.prescriptionId],
      );
      if (openInquiry.rows[0] !== undefined) {
        await client.query("ROLLBACK");
        return { kind: "inquiry_unresolved" };
      }

      // guard 5: 1 版 1 記録(UNIQUE index が backstop)。
      // draft lock 取得後は先行する並行 create の commit が見えるため、
      // winner の key/payload を再比較して replay / conflict / duplicate を
      // 区別する(pre-lock snapshot の byKey miss だけで duplicate 化しない)。
      const existing = await client.query<DispensingRecordRow>(
        `SELECT dispensing_id, prescription_id, prescription_version,
                dispensing_date::text AS dispensing_date, status,
                idempotency_key, confirm_idempotency_key,
                confirmed_by, confirmed_at, created_by, created_at,
                create_request
           FROM dispensing_records
          WHERE tenant_id = $1 AND pharmacy_id = $2
            AND prescription_id = $3 AND prescription_version = $4`,
        [
          input.tenantId,
          input.pharmacyId,
          input.prescriptionId,
          input.prescriptionVersion,
        ],
      );
      const existingRow = existing.rows[0];
      if (existingRow !== undefined) {
        if (existingRow.idempotency_key === input.idempotencyKey) {
          const equality = await client.query<{ readonly equal: boolean }>(
            `SELECT create_request = $4::jsonb AS equal
               FROM dispensing_records
              WHERE tenant_id = $1 AND pharmacy_id = $2
                AND dispensing_id = $3`,
            [
              input.tenantId,
              input.pharmacyId,
              existingRow.dispensing_id,
              requestJson,
            ],
          );
          if (equality.rows[0]?.equal === true) {
            const view = await this.viewFor(
              client,
              input.tenantId,
              input.pharmacyId,
              existingRow,
            );
            await client.query("COMMIT");
            return { kind: "created", record: view, replayed: true };
          }
          await client.query("ROLLBACK");
          return { kind: "idempotency_conflict" };
        }
        await client.query("ROLLBACK");
        return { kind: "already_recorded" };
      }

      // guard 6: items は全 rpItem ちょうど 1 回。永続 content は schema で
      // 再検証する(格納値の破損を fail-closed で検出)。
      const sourceContent = prescriptionDraftContentSchema.parse(
        versionRow.content,
      );
      const sourceItems = new Map(
        sourceContent.rpGroups.flatMap((group) =>
          group.items.map((item) => [item.rpItemId, item] as const),
        ),
      );
      const seen = new Set<string>();
      let itemsValid = true;
      for (const item of input.items) {
        if (!sourceItems.has(item.rpItemId) || seen.has(item.rpItemId)) {
          itemsValid = false;
          break;
        }
        seen.add(item.rpItemId);
      }
      if (!itemsValid || seen.size !== sourceItems.size) {
        await client.query("ROLLBACK");
        return { kind: "invalid_items" };
      }

      // guard 7: 後発品変更整合(変更可否 + genericNameCode 一致)。
      // free text 調剤は unresolved 行では許容するが、resolved 行への
      // free text は品目変更(代替)として変更可否を要求する(fail-open
      // にしない)。master read は tx client 束縛 adapter(pool 再借用を避ける)。
      const masters = masterReadRepositoryForClient(client);
      const scope = { tenantId: input.tenantId, pharmacyId: input.pharmacyId };
      for (const item of input.items) {
        const sourceItem = sourceItems.get(item.rpItemId);
        if (sourceItem === undefined) {
          await client.query("ROLLBACK");
          return { kind: "invalid_items" };
        }
        const prescribedId =
          sourceItem.medication.kind === "resolved"
            ? sourceItem.medication.medicationItemId
            : null;
        const dispensedId = item.dispensedMedicationItemId;
        if (dispensedId === null) {
          if (
            prescribedId !== null &&
            sourceItem.genericSubstitutionPermitted !== true
          ) {
            await client.query("ROLLBACK");
            return { kind: "generic_mismatch" };
          }
          continue;
        }
        if (dispensedId === prescribedId) continue;
        if (sourceItem.genericSubstitutionPermitted !== true) {
          await client.query("ROLLBACK");
          return { kind: "generic_mismatch" };
        }
        const dispensedLookup = await masters.findMedicationItemById(
          scope,
          dispensedId,
        );
        // 処方品目が unresolved、または調剤品目が master 未存在 →
        // 一般名比較不能で fail-closed。
        if (dispensedLookup === undefined || prescribedId === null) {
          await client.query("ROLLBACK");
          return { kind: "generic_mismatch" };
        }
        const prescribedLookup = await masters.findMedicationItemById(
          scope,
          prescribedId,
        );
        // 確定版が参照する master 品目が append-only storage に無いのは
        // 不変条件違反 — fail-closed 500(API-021 §3)。
        if (prescribedLookup === undefined) {
          throw new Error(
            "dispensing source invariant violated: prescribed master item missing",
          );
        }
        if (
          prescribedLookup.genericNameCode === null ||
          dispensedLookup.genericNameCode === null ||
          prescribedLookup.genericNameCode !== dispensedLookup.genericNameCode
        ) {
          await client.query("ROLLBACK");
          return { kind: "generic_mismatch" };
        }
      }

      const dispensingIdValue =
        this.deps.nextDispensingId?.() ??
        dispensingId(`dispensing-${randomUUID()}`);
      const now = input.wallClock;
      try {
        await client.query(
          `INSERT INTO dispensing_records (
             tenant_id, pharmacy_id, dispensing_id,
             prescription_id, prescription_version, dispensing_date,
             status, idempotency_key, confirm_idempotency_key,
             confirmed_by, confirmed_at, created_by, created_at,
             updated_by, updated_at,
             create_request
           ) VALUES ($1, $2, $3, $4, $5, $6::date,
                     NULL, $7, NULL, NULL, NULL, $8, $9, $8, $9, $10::jsonb)`,
          [
            input.tenantId,
            input.pharmacyId,
            dispensingIdValue,
            input.prescriptionId,
            input.prescriptionVersion,
            input.dispensingDate,
            input.idempotencyKey,
            input.actorId,
            now,
            requestJson,
          ],
        );
      } catch (error) {
        // 並行 create の一意違反(version 二重・key 重複)は domain 結果へ
        // 写像する。tx は既に abort されているため rollback 後に呼び出し側で
        // 再評価する(committed winner を replay/duplicate 判定で拾う)。
        await client.query("ROLLBACK");
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: unknown }).code === "23505"
        ) {
          return { kind: "retry" };
        }
        throw error;
      }
      for (const item of input.items) {
        const sourceItem = sourceItems.get(item.rpItemId);
        const prescribedId =
          sourceItem !== undefined &&
          sourceItem.medication.kind === "resolved"
            ? sourceItem.medication.medicationItemId
            : null;
        await client.query(
          `INSERT INTO dispensing_items (
             tenant_id, pharmacy_id, dispensing_id, rp_item_id,
             prescribed_medication_item_id, dispensed_medication_item_id,
             dispensed_text, quantity, remaining_stock_adjustment, note,
             dispensed_by
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            input.tenantId,
            input.pharmacyId,
            dispensingIdValue,
            item.rpItemId,
            prescribedId,
            item.dispensedMedicationItemId,
            item.dispensedText,
            item.quantity,
            item.remainingStockAdjustment,
            item.note,
            input.actorId,
          ],
        );
      }
      await appendAuditEventWithinTransaction(
        client,
        { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
        {
          actorId: input.actorId,
          auditEventType: "dispensing.recorded",
          targetRef: {
            kind: "dispensing_record",
            id: `${input.prescriptionId}/${dispensingIdValue}`,
          },
          outcome: "success",
          wallClock: input.wallClock,
        },
      );
      const view = dispensingRecordViewSchema.parse({
        dispensingId: dispensingIdValue,
        prescriptionId: input.prescriptionId,
        prescriptionVersion: input.prescriptionVersion,
        dispensingDate: input.dispensingDate,
        // item 順は rpItemId で正規化(replay の ORDER BY rp_item_id と一致)。
        items: input.items.map((item) => {
          const sourceItem = sourceItems.get(item.rpItemId);
          const prescribedId =
            sourceItem !== undefined &&
            sourceItem.medication.kind === "resolved"
              ? sourceItem.medication.medicationItemId
              : null;
          return {
            rpItemId: item.rpItemId,
            prescribedMedicationItemId: prescribedId,
            dispensedMedicationItemId: item.dispensedMedicationItemId,
            dispensedText: item.dispensedText,
            quantity: item.quantity,
            remainingStockAdjustment: item.remainingStockAdjustment,
            note: item.note,
            dispensedBy: input.actorId,
          };
        }).sort((a, b) =>
          a.rpItemId < b.rpItemId ? -1 : a.rpItemId > b.rpItemId ? 1 : 0,
        ),
        status: null,
        confirmedBy: null,
        confirmedAt: null,
        createdBy: input.actorId,
        createdAt: now,
      });
      await client.query("COMMIT");
      return { kind: "created", record: view, replayed: false };
    });
  }

  private async viewFor(
    client: PoolClient,
    tenantId: string,
    pharmacyId: string,
    row: DispensingRecordRow,
  ): Promise<DispensingRecordView> {
    const items = await this.selectItems(client, {
      tenantId,
      pharmacyId,
      dispensingId: row.dispensing_id,
    });
    return dispensingRecordViewSchema.parse({
      dispensingId: row.dispensing_id,
      prescriptionId: row.prescription_id,
      prescriptionVersion: row.prescription_version,
      dispensingDate: row.dispensing_date,
      items: items.map((item) => ({
        rpItemId: item.rp_item_id,
        prescribedMedicationItemId: item.prescribed_medication_item_id,
        dispensedMedicationItemId: item.dispensed_medication_item_id,
        dispensedText: item.dispensed_text,
        quantity: item.quantity,
        remainingStockAdjustment: item.remaining_stock_adjustment,
        note: item.note,
        dispensedBy: item.dispensed_by,
      })),
      status: row.status,
      confirmedBy: row.confirmed_by,
      confirmedAt:
        row.confirmed_at === null
          ? null
          : snapshotDatabaseInstant(
              row.confirmed_at,
              dispensingDatabaseInvariantErrorMessage,
            ),
      createdBy: row.created_by,
      createdAt: snapshotDatabaseInstant(
        row.created_at,
        dispensingDatabaseInvariantErrorMessage,
      ),
    });
  }

  async confirm(
    input: DispensingConfirmInput,
  ): Promise<DispensingConfirmResult> {
    return runInPooledTransaction(this.pool, async (client) => {
      // SEC-010: 資格判定を存在判定より先に評価(WP-7403 順序)。
      const qualified =
        (await this.deps.qualificationRepository
          ?.hasActiveQualificationWithinTransaction(client, {
            tenantId: input.tenantId,
            pharmacyId: input.pharmacyId,
            actorId: input.actorId,
            kind: "PHARMACIST_LICENSE",
          })) === true;
      if (!qualified) {
        await appendAuditEventWithinTransaction(
          client,
          { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
          {
            actorId: input.actorId,
            auditEventType: "dispensing.confirm.denied",
            targetRef: { kind: "dispensing_record", id: input.dispensingId },
            outcome: "denied",
            wallClock: input.wallClock,
          },
        );
        await client.query("COMMIT");
        return { kind: "unqualified" };
      }

      const row = await this.selectRecord(
        client,
        {
          tenantId: input.tenantId,
          pharmacyId: input.pharmacyId,
          dispensingId: input.dispensingId,
        },
        true,
      );
      if (row === undefined) {
        await client.query("ROLLBACK");
        return { kind: "not_found" };
      }
      if (row.status !== null) {
        if (row.confirm_idempotency_key === input.idempotencyKey) {
          const view = await this.viewFor(
            client,
            input.tenantId,
            input.pharmacyId,
            row,
          );
          await client.query("COMMIT");
          return { kind: "confirmed", record: view, replayed: true };
        }
        // 確認済みへの別 key 再送は冪等衝突ではなく lifecycle 遷移不可
        // (DSP-0002、WP-7402/7403 の規則と同一)。
        await client.query("ROLLBACK");
        return { kind: "invalid_transition" };
      }

      try {
        await client.query(
          `UPDATE dispensing_records
             SET status = 'DISPENSING_RECORDED',
                 confirm_idempotency_key = $4,
                 confirmed_by = $5,
                 confirmed_at = $6,
                 updated_by = $5,
                 updated_at = $6
           WHERE tenant_id = $1 AND pharmacy_id = $2 AND dispensing_id = $3`,
          [
            input.tenantId,
            input.pharmacyId,
            input.dispensingId,
            input.idempotencyKey,
            input.actorId,
            input.wallClock,
          ],
        );
      } catch (error) {
        await client.query("ROLLBACK");
        // confirm_idempotency_key の scope 一意違反 → 別 record で使用済み。
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: unknown }).code === "23505"
        ) {
          return { kind: "idempotency_conflict" };
        }
        throw error;
      }
      const auditEvent = await appendAuditEventWithinTransaction(
        client,
        { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
        {
          actorId: input.actorId,
          auditEventType: "dispensing.confirmed",
          targetRef: {
            kind: "dispensing_record",
            id: `${row.prescription_id}/${input.dispensingId}`,
          },
          outcome: "success",
          wallClock: input.wallClock,
        },
      );
      // MOD-009 §6: outbox intent は監査と同一 tx。payload は識別子+版のみ。
      await client.query(
        `INSERT INTO outbox_events (
           tenant_id, pharmacy_id, outbox_event_id, event_type,
           aggregate_type, aggregate_id, audit_event_id, payload, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
        [
          input.tenantId,
          input.pharmacyId,
          this.deps.nextOutboxEventId?.() ?? randomUUID(),
          "dispense.confirmed",
          "dispensing",
          input.dispensingId,
          auditEvent.eventId,
          JSON.stringify({
            prescriptionId: row.prescription_id,
            version: row.prescription_version,
          }),
          input.wallClock,
        ],
      );
      const updated = await this.selectRecord(
        client,
        {
          tenantId: input.tenantId,
          pharmacyId: input.pharmacyId,
          dispensingId: input.dispensingId,
        },
        false,
      );
      if (updated === undefined) {
        throw new Error(dispensingDatabaseInvariantErrorMessage);
      }
      const view = await this.viewFor(
        client,
        input.tenantId,
        input.pharmacyId,
        updated,
      );
      await client.query("COMMIT");
      return { kind: "confirmed", record: view, replayed: false };
    });
  }
}

export type { DispensingItemInput };
