import { createHash, randomUUID } from "node:crypto";

import {
  PRESCRIPTION_DRAFT_MAX_VERSION,
  prescriptionDraftContentSchema,
  prescriptionDraftResponseSchema,
  prescriptionDraftSaveResponseSchema,
  type PrescriptionDraftContent,
  type PrescriptionDraftResponse,
  type PrescriptionDraftSaveResponse,
  type ReceptionQueueEntry,
} from "@yrese/contracts";
import {
  prescriptionId,
  type PatientId,
  type PharmacyId,
  type PrescriptionId,
  type ReceptionId,
  type TenantId,
  type UserId,
} from "@yrese/shared-kernel";

import type { AuditRepository } from "./audit-repository.js";
import type { ReceptionRepository } from "./reception-repository.js";

export interface PrescriptionDraftLookupInput {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly actorId: UserId;
  readonly receptionId: ReceptionId;
  readonly businessDate: string;
  readonly wallClock: string;
}

export interface PrescriptionDraftSaveInput extends PrescriptionDraftLookupInput {
  readonly patientId: PatientId;
  readonly expectedVersion: number;
  readonly draft: PrescriptionDraftContent;
  readonly wallClock: string;
}

export type PrescriptionDraftLookupResult =
  | { readonly kind: "found"; readonly draft: PrescriptionDraftResponse }
  | { readonly kind: "empty" }
  | { readonly kind: "not_found" };

export type PrescriptionDraftSaveResult =
  | { readonly kind: "saved"; readonly draft: PrescriptionDraftSaveResponse }
  | { readonly kind: "not_found" }
  | { readonly kind: "conflict"; readonly currentVersion: number };

export interface PrescriptionDraftService {
  get(input: PrescriptionDraftLookupInput): Promise<PrescriptionDraftLookupResult>;
  save(input: PrescriptionDraftSaveInput): Promise<PrescriptionDraftSaveResult>;
}

const FLAG_ORDER = new Map(
  [
    "PACKAGING",
    "HOME_CARE",
    "NARCOTIC",
    "PSYCHOTROPIC",
    "LEFTOVER_ADJUSTMENT",
  ].map((flag, index) => [flag, index] as const),
);

export function normalizePrescriptionDraftContent(
  value: unknown,
): PrescriptionDraftContent {
  // 信頼境界のparseはここで1回だけ。以降はparse済み値の並べ替えとコピーであり、
  // 再parseは値を変えない(trimは冪等、refinementは再構築後も成立)ため行わない。
  const parsed = prescriptionDraftContentSchema.parse(value);
  return {
    ...parsed,
    flags: [...parsed.flags].sort(
      (left, right) =>
        (FLAG_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (FLAG_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER),
    ),
    rows: parsed.rows.map((row) => ({ ...row })),
  };
}

function hashNormalizedPrescriptionDraftContent(
  value: PrescriptionDraftContent,
): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function normalizePrescriptionDraftContentWithHash(value: unknown): {
  readonly normalized: PrescriptionDraftContent;
  readonly contentHash: string;
} {
  const normalized = normalizePrescriptionDraftContent(value);
  return {
    normalized,
    contentHash: hashNormalizedPrescriptionDraftContent(normalized),
  };
}

export function prescriptionDraftContentHash(
  value: PrescriptionDraftContent,
): string {
  return hashNormalizedPrescriptionDraftContent(
    normalizePrescriptionDraftContent(value),
  );
}

function scopeKey(input: PrescriptionDraftLookupInput): string {
  return JSON.stringify([
    "yrese.prescription-draft.v1",
    input.tenantId,
    input.pharmacyId,
    input.receptionId,
  ]);
}

async function receptionMatches(
  repository: ReceptionRepository,
  input: PrescriptionDraftLookupInput,
  requireEditable: boolean,
): Promise<ReceptionQueueEntry | undefined> {
  const entries = await repository.list({
    tenantId: input.tenantId,
    pharmacyId: input.pharmacyId,
    date: input.businessDate,
  });
  return entries.find(
    (entry) =>
      entry.receptionId === input.receptionId &&
      (!requireEditable ||
        entry.receptionStatus === "WAITING" ||
        entry.receptionStatus === "IN_PROGRESS"),
  );
}

interface InMemoryPrescriptionDraftRecord {
  readonly response: PrescriptionDraftResponse;
  readonly contentHash: string;
}

export class InMemoryPrescriptionDraftService
  implements PrescriptionDraftService
{
  private readonly records = new Map<string, InMemoryPrescriptionDraftRecord>();
  private readonly locks = new Map<string, Promise<void>>();

  constructor(
    private readonly receptionRepository: ReceptionRepository,
    private readonly auditRepository: AuditRepository,
    private readonly nextPrescriptionId: () => PrescriptionId = () =>
      prescriptionId(`prescription-${randomUUID()}`),
  ) {}

  private async withKeyLock<T>(
    key: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const predecessor = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = predecessor.then(() => gate);
    this.locks.set(key, tail);
    await predecessor;
    try {
      return await action();
    } finally {
      release();
      if (this.locks.get(key) === tail) this.locks.delete(key);
    }
  }

  async get(
    input: PrescriptionDraftLookupInput,
  ): Promise<PrescriptionDraftLookupResult> {
    const reception = await receptionMatches(
      this.receptionRepository,
      input,
      false,
    );
    if (reception === undefined) {
      return { kind: "not_found" };
    }
    const record = this.records.get(scopeKey(input));
    if (record === undefined) return { kind: "empty" };
    const draft = prescriptionDraftResponseSchema.parse(record.response);
    if (draft.patientId !== reception.patient.patientId) {
      throw new Error("In-memory prescription draft reception mismatch");
    }
    await this.auditRepository.record(
      { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
      {
        actorId: input.actorId,
        auditEventType: "prescription.draft.viewed",
        targetRef: { kind: "prescription", id: draft.prescriptionId },
        outcome: "success",
        wallClock: input.wallClock,
      },
    );
    return { kind: "found", draft };
  }

  async save(
    input: PrescriptionDraftSaveInput,
  ): Promise<PrescriptionDraftSaveResult> {
    const key = scopeKey(input);
    return this.withKeyLock(key, async () => {
      const reception = await receptionMatches(
        this.receptionRepository,
        input,
        true,
      );
      if (
        reception === undefined ||
        reception.patient.patientId !== input.patientId
      ) {
        return { kind: "not_found" };
      }

      const { normalized, contentHash } =
        normalizePrescriptionDraftContentWithHash(input.draft);
      const existing = this.records.get(key);

      if (existing === undefined) {
        if (input.expectedVersion !== 0) {
          return { kind: "conflict", currentVersion: 0 };
        }
        const id = this.nextPrescriptionId();
        await this.auditRepository.record(
          { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
          {
            actorId: input.actorId,
            auditEventType: "prescription.created",
            targetRef: { kind: "prescription", id },
            outcome: "success",
            wallClock: input.wallClock,
          },
        );
        const response = prescriptionDraftResponseSchema.parse({
          prescriptionId: id,
          receptionId: input.receptionId,
          patientId: input.patientId,
          businessDate: input.businessDate,
          version: 1,
          draft: normalized,
          createdAt: input.wallClock,
          updatedAt: input.wallClock,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        });
        this.records.set(key, { response, contentHash });
        return {
          kind: "saved",
          draft: prescriptionDraftSaveResponseSchema.parse({
            ...response,
            saveDisposition: "created",
          }),
        };
      }

      if (input.expectedVersion !== existing.response.version) {
        return {
          kind: "conflict",
          currentVersion: existing.response.version,
        };
      }

      if (existing.contentHash === contentHash) {
        return {
          kind: "saved",
          draft: prescriptionDraftSaveResponseSchema.parse({
            ...existing.response,
            saveDisposition: "unchanged",
          }),
        };
      }

      if (existing.response.version >= PRESCRIPTION_DRAFT_MAX_VERSION) {
        throw new Error("Prescription draft version limit reached");
      }

      await this.auditRepository.record(
        { tenantId: input.tenantId, pharmacyId: input.pharmacyId },
        {
          actorId: input.actorId,
          auditEventType: "prescription.updated",
          targetRef: {
            kind: "prescription",
            id: existing.response.prescriptionId,
          },
          outcome: "success",
          wallClock: input.wallClock,
        },
      );
      const response = prescriptionDraftResponseSchema.parse({
        ...existing.response,
        version: existing.response.version + 1,
        draft: normalized,
        updatedAt: new Date(
          Math.max(
            Date.parse(existing.response.updatedAt),
            Date.parse(input.wallClock),
          ),
        ).toISOString(),
        updatedBy: input.actorId,
      });
      this.records.set(key, { response, contentHash });
      return {
        kind: "saved",
        draft: prescriptionDraftSaveResponseSchema.parse({
          ...response,
          saveDisposition: "updated",
        }),
      };
    });
  }
}
