import type {
  PharmacyId,
  TenantId,
  UserId,
} from "@yrese/shared-kernel";

/**
 * SEC-010 §2: actor の薬剤師資格 evidence 参照。confirm scope の実効条件は
 * 「scope claim + 実行時点の ACTIVE evidence」であり、本 repository はその
 * read 側ガードだけを提供する。登録・取消の管理経路は後続 WP(migration
 * 000020 の actor_qualifications は append-only)。
 */

export const ACTOR_QUALIFICATION_KINDS = ["PHARMACIST_LICENSE"] as const;
export type ActorQualificationKind = (typeof ACTOR_QUALIFICATION_KINDS)[number];

export interface ActorQualificationLookup {
  readonly tenantId: TenantId;
  readonly pharmacyId: PharmacyId;
  readonly actorId: UserId;
  readonly kind: ActorQualificationKind;
}

export interface ActorQualificationRepository {
  /**
   * 当該 actor の最新 evidence record が ACTIVE か。evidence 未存在・
   * 最新 record が REVOKED なら false(fail-closed)。
   */
  hasActiveQualification(
    input: ActorQualificationLookup,
  ): Promise<boolean>;
}

interface InMemoryQualificationRecord {
  readonly status: "ACTIVE" | "REVOKED";
}

function qualificationKey(
  input: ActorQualificationLookup,
): string {
  return JSON.stringify([
    input.tenantId,
    input.pharmacyId,
    input.actorId,
    input.kind,
  ]);
}

/**
 * dev/test 用の in-memory evidence。grant/revoke は record 追加のみで
 * append-only を保つ(取消は REVOKED record の後続追加として表す)。
 */
export class InMemoryActorQualificationRepository
  implements ActorQualificationRepository
{
  private readonly records = new Map<
    string,
    InMemoryQualificationRecord[]
  >();

  grant(input: ActorQualificationLookup): void {
    const key = qualificationKey(input);
    const scoped = this.records.get(key) ?? [];
    scoped.push({ status: "ACTIVE" });
    this.records.set(key, scoped);
  }

  revoke(input: ActorQualificationLookup): void {
    const key = qualificationKey(input);
    const scoped = this.records.get(key) ?? [];
    scoped.push({ status: "REVOKED" });
    this.records.set(key, scoped);
  }

  async hasActiveQualification(
    input: ActorQualificationLookup,
  ): Promise<boolean> {
    const scoped = this.records.get(qualificationKey(input)) ?? [];
    const latest = scoped[scoped.length - 1];
    return latest?.status === "ACTIVE";
  }
}
