import { describe, expect, it } from 'vitest';

import type { PatientSearchResult } from '@yrese/contracts';
import { patientId, pharmacyId, tenantId, userId } from '@yrese/shared-kernel';

import { InMemoryAuditRepository, type AuditRepository } from './audit-repository.js';
import {
  ComposedReceptionCreateCommand,
  InMemoryReceptionOutbox,
  ReceptionAuditAppendError,
  ReceptionOutboxAppendError,
  composeDefaultReceptionCreateCommand,
  type ReceptionCreateCommandInput,
  type ReceptionCreateExecuteResult,
} from './reception-command.js';
import {
  InMemoryReceptionRepository,
  type ReceptionCreateProvenance,
} from './reception-repository.js';

/**
 * WP-4050 受入(in-memory unit of work):
 * 「成功した受付は、正確に1件の durable な reception.created 監査イベントと
 * 1件の outbox intent なしには存在できない」。注入した監査/outbox 失敗は
 * 受付ごと巻き戻り(count 0)、同一キー再送は 1/1/1 へ収束する。
 *
 * このテストは HTTP 層が行う二相呼び出し(execute → 検証 → evidence/classify)を
 * 信頼できる呼び出し側として再現する。
 */

const scope = {
  tenantId: tenantId('tenant-cmd-001'),
  pharmacyId: pharmacyId('pharmacy-cmd-001'),
};

const commandPatient = {
  patientId: patientId('patient-cmd-001'),
  name: '合成コマンド患者',
  kana: 'ゴウセイコマンドカンジャ',
  birthDate: '1980-01-01',
  sex: 'female',
  patientNumber: 'CMD-001',
  eligibilityStatus: 'VERIFIED',
} as const satisfies PatientSearchResult;

const otherPatient = {
  ...commandPatient,
  patientId: patientId('patient-cmd-002'),
  patientNumber: 'CMD-002',
} as const satisfies PatientSearchResult;

const actorId = userId('user-cmd-001');
const acceptedAtIso = '2026-07-30T00:30:00.000Z';
const businessDate = '2026-07-30';
const auditWallClockIso = '2026-07-30T00:30:01.000Z';

function commandInput(
  overrides: Partial<ReceptionCreateCommandInput> = {},
): ReceptionCreateCommandInput {
  return {
    ...scope,
    patient: commandPatient,
    idempotencyKey: 'cmd-key-001',
    acceptedAt: new Date(acceptedAtIso),
    actorId,
    auditWallClock: () => auditWallClockIso,
    ...overrides,
  };
}

interface Fixture {
  readonly receptionRepository: InMemoryReceptionRepository;
  readonly auditRepository: AuditRepository;
  readonly command: ComposedReceptionCreateCommand;
}

function buildFixture(auditRepository?: AuditRepository): Fixture {
  const receptionRepository = new InMemoryReceptionRepository();
  const audit = auditRepository ?? new InMemoryAuditRepository();
  const command = composeDefaultReceptionCreateCommand({
    receptionRepository,
    auditRepository: audit,
    outbox: new InMemoryReceptionOutbox(),
  });
  return { receptionRepository, auditRepository: audit, command };
}

function expectProvenance(
  result: ReceptionCreateExecuteResult,
): ReceptionCreateProvenance {
  return result.provenance;
}

/** HTTP 層の created フロー(execute → evidence 確定)を再現する。 */
async function runCreatedFlow(
  fixture: Fixture,
  input: ReceptionCreateCommandInput,
): Promise<{ provenance: ReceptionCreateProvenance; auditEvent: unknown }> {
  const result = await fixture.command.execute(input);
  if (result.kind !== 'created') {
    throw new Error(`expected created, got ${result.kind}`);
  }
  const auditEvent = await fixture.command.ensureCreatedEvidence({
    result,
    provenance: result.provenance,
    actorId: input.actorId,
    wallClock: auditWallClockIso,
  });
  return { provenance: result.provenance, auditEvent };
}

async function counts(fixture: Fixture): Promise<{
  receptions: number;
  auditEvents: number;
  outboxIntents: number;
}> {
  const receptions = await fixture.receptionRepository.list({
    ...scope,
    date: businessDate,
  });
  const auditEvents = await fixture.auditRepository.list(scope);
  return {
    receptions: receptions.length,
    auditEvents: auditEvents.length,
    outboxIntents: fixture.command.outbox.list(scope).length,
  };
}

describe('ComposedReceptionCreateCommand (WP-4050 unit of work)', () => {
  it('creates reception, audit event, and outbox intent as one converged unit', async () => {
    const fixture = buildFixture();

    const { provenance, auditEvent } = await runCreatedFlow(fixture, commandInput());

    const recorded = auditEvent as {
      auditEventType: string;
      targetRef: { kind: string; id: string };
      wallClock: string;
    };
    expect(recorded.auditEventType).toBe('reception.created');
    expect(recorded.targetRef).toEqual({ kind: 'reception', id: provenance.receptionId });
    expect(recorded.wallClock).toBe(auditWallClockIso);

    await expect(counts(fixture)).resolves.toEqual({
      receptions: 1,
      auditEvents: 1,
      outboxIntents: 1,
    });
    const storedIntent = fixture.command.outbox.list(scope)[0];
    expect(storedIntent?.aggregateId).toBe(provenance.receptionId);
    expect(storedIntent?.patientId).toBe(commandPatient.patientId);
    expect(storedIntent?.deliveredAt).toBeNull();
  });

  it('rolls back the reception when the audit append fails (no partial durable effect)', async () => {
    const failingAudit: AuditRepository = {
      record: async () => {
        throw new Error('injected audit sink failure');
      },
      list: async () => [],
    };
    const fixture = buildFixture(failingAudit);

    const result = await fixture.command.execute(commandInput());
    if (result.kind !== 'created') {
      throw new Error('unreachable');
    }
    // 監査失敗は raw のまま reject し(hostile 失敗値を検査しない規律)、
    // 呼び出し側(HTTP 層)が rollbackCreatedEvidence で巻き戻す。
    await expect(
      fixture.command.ensureCreatedEvidence({
        result,
        provenance: result.provenance,
        actorId,
        wallClock: auditWallClockIso,
      }),
    ).rejects.toThrow('injected audit sink failure');
    await fixture.command.rollbackCreatedEvidence(result.provenance);

    const receptions = await fixture.receptionRepository.list({
      ...scope,
      date: businessDate,
    });
    expect(receptions).toHaveLength(0);
    expect(fixture.command.outbox.list(scope)).toHaveLength(0);
  });

  it('rolls back the reception when the outbox append fails (no partial durable effect)', async () => {
    const fixture = buildFixture();
    const outbox = fixture.command.outbox;
    const originalAppend = outbox.append.bind(outbox);
    let failNext = true;
    outbox.append = (intent) => {
      if (failNext) {
        failNext = false;
        throw new Error('injected outbox sink failure');
      }
      originalAppend(intent);
    };

    const result = await fixture.command.execute(commandInput());
    if (result.kind !== 'created') {
      throw new Error('unreachable');
    }
    await expect(
      fixture.command.ensureCreatedEvidence({
        result,
        provenance: result.provenance,
        actorId,
        wallClock: auditWallClockIso,
      }),
    ).rejects.toBeInstanceOf(ReceptionOutboxAppendError);

    await expect(counts(fixture)).resolves.toEqual({
      receptions: 0,
      auditEvents: 0,
      outboxIntents: 0,
    });
  });

  it('converges after a rolled-back failure: the same key then succeeds as created', async () => {
    let failOnce = true;
    const delegate = new InMemoryAuditRepository();
    const flakyAudit: AuditRepository = {
      record: async (recordScope, input) => {
        if (failOnce) {
          failOnce = false;
          throw new Error('injected transient audit failure');
        }
        return delegate.record(recordScope, input);
      },
      list: async (listScope) => delegate.list(listScope),
    };
    const fixture = buildFixture(flakyAudit);

    const first = await fixture.command.execute(commandInput());
    if (first.kind !== 'created') {
      throw new Error('unreachable');
    }
    await expect(
      fixture.command.ensureCreatedEvidence({
        result: first,
        provenance: first.provenance,
        actorId,
        wallClock: auditWallClockIso,
      }),
    ).rejects.toThrow('injected transient audit failure');
    await fixture.command.rollbackCreatedEvidence(first.provenance);

    const retried = await runCreatedFlow(fixture, commandInput());

    expect(retried.provenance.receptionId).not.toBe('');
    await expect(counts(fixture)).resolves.toEqual({
      receptions: 1,
      auditEvents: 1,
      outboxIntents: 1,
    });
  });

  it('classifies a same-key same-patient retry as existing_complete without duplicating effects', async () => {
    const fixture = buildFixture();
    const first = await runCreatedFlow(fixture, commandInput());

    const second = await fixture.command.execute(commandInput());
    expect(second.kind).toBe('existing');
    const classification = await fixture.command.classifyExisting(
      expectProvenance(second),
    );

    expect(classification).toBe('existing_complete');
    expect(expectProvenance(second).receptionId).toBe(first.provenance.receptionId);
    await expect(counts(fixture)).resolves.toEqual({
      receptions: 1,
      auditEvents: 1,
      outboxIntents: 1,
    });
  });

  it('returns idempotency_conflict for the same key with a different patient, with no writes', async () => {
    const fixture = buildFixture();
    await runCreatedFlow(fixture, commandInput());

    const conflict = await fixture.command.execute(
      commandInput({ patient: otherPatient }),
    );

    expect(conflict.kind).toBe('idempotency_conflict');
    await expect(counts(fixture)).resolves.toEqual({
      receptions: 1,
      auditEvents: 1,
      outboxIntents: 1,
    });
  });

  it('surfaces a pre-boundary reception as legacy_orphan without inventing audit evidence', async () => {
    const fixture = buildFixture();
    // 境界導入前の受付を模す: リポジトリ直接 create(監査・outbox なし)。
    const legacy = await fixture.receptionRepository.create({
      ...scope,
      patient: commandPatient,
      idempotencyKey: 'cmd-key-legacy',
      acceptedAt: new Date(acceptedAtIso),
    });
    expect(legacy.kind).toBe('created');

    const retry = await fixture.command.execute(
      commandInput({ idempotencyKey: 'cmd-key-legacy' }),
    );
    expect(retry.kind).toBe('existing');
    const classification = await fixture.command.classifyExisting(
      expectProvenance(retry),
    );

    expect(classification).toBe('legacy_orphan');
    // 元の actor / 時刻を捏造した修復をしない: 監査・outbox は増えない。
    await expect(counts(fixture)).resolves.toEqual({
      receptions: 1,
      auditEvents: 0,
      outboxIntents: 0,
    });
  });

  it('execute passes exactly the repository input through and never touches the result', async () => {
    const auditRepository = new InMemoryAuditRepository();
    let receivedInput: unknown;
    const hostileResult = new Proxy(
      { kind: 'created' },
      {
        get: (target, property) => {
          if (property === 'then') {
            // await が thenable 判定で then を読むのは許容する。
            return undefined;
          }
          throw new Error(`command must not read result property ${String(property)}`);
        },
        getOwnPropertyDescriptor: () => {
          throw new Error('command must not inspect result descriptors');
        },
      },
    );
    const command = new ComposedReceptionCreateCommand({
      receptionRepository: {
        list: async () => [],
        create: async (input) => {
          receivedInput = input;
          return hostileResult as never;
        },
      },
      auditRepository,
    });

    const result = await command.execute(commandInput());

    // 素通し: 同一参照が返り、プロパティは一切読まれていない(hostile trap 未発火)。
    expect(result).toBe(hostileResult);
    // リポジトリ入力は従来の5フィールドだけ(actorId / auditWallClock を渡さない)。
    expect(Object.keys(receivedInput as Record<string, unknown>).sort()).toEqual([
      'acceptedAt',
      'idempotencyKey',
      'patient',
      'pharmacyId',
      'tenantId',
    ]);
    await expect(auditRepository.list(scope)).resolves.toHaveLength(0);
    expect(command.outbox.list(scope)).toHaveLength(0);
  });
});
