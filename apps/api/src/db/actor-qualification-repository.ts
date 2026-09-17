import type { Pool, PoolClient } from "pg";

import type {
  ActorQualificationLookup,
  ActorQualificationRepository,
} from "../actor-qualification-repository.js";

/**
 * SEC-010 §2 の PostgreSQL 実装。actor_qualifications は append-only で、
 * (actor, kind) の最新 record の status が ACTIVE のときだけ true。
 * 管理経路(登録/取消 route)は本 WP に含めないため read 側のみ。
 */
export class PostgresActorQualificationRepository
  implements ActorQualificationRepository
{
  constructor(private readonly pool: Pool) {}

  async hasActiveQualification(
    input: ActorQualificationLookup,
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      return await this.hasActiveQualificationWithinTransaction(
        client,
        input,
      );
    } finally {
      client.release();
    }
  }

  /**
   * confirm/finalize command の tx 内から呼ぶ read 側ガード。最新 record を
   * 取り、ACTIVE 以外は fail-closed で false。recorded_seq(000021、単調
   * 増加 IDENTITY)が created_at 同値時の tiebreak — 挿入順と必ず一致する。
   */
  async hasActiveQualificationWithinTransaction(
    client: PoolClient,
    input: ActorQualificationLookup,
  ): Promise<boolean> {
    const result = await client.query<{ readonly status: string }>(
      `SELECT status
         FROM actor_qualifications
        WHERE tenant_id = $1
          AND pharmacy_id = $2
          AND actor_id = $3
          AND qualification_kind = $4
        ORDER BY created_at DESC, recorded_seq DESC
        LIMIT 1`,
      [
        input.tenantId,
        input.pharmacyId,
        input.actorId,
        input.kind,
      ],
    );
    return result.rows[0]?.status === "ACTIVE";
  }
}
