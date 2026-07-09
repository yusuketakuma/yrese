/**
 * 保留・仮状態ステータス。
 *
 * 根拠: 構築プロンプト v0.2.0 §14(LOCAL_ONLY での必須付与ステータス)、§0.0.3.3。
 * LOCAL_ONLY で生成された計算・帳票・受付には、これらのいずれかを必ず付与する。
 * 外部確認未完了の処理を「成功扱い」に見せることは禁止(§15)。
 */

export const PROVISIONAL_STATUSES = [
  "PROVISIONAL_CALCULATION",
  "PENDING_REVERIFY",
  "PENDING_EXTERNAL_SYNC",
  "PENDING_PMH_REVERIFY",
  "LOCAL_ONLY_UNVERIFIED",
  "MANUAL_REVIEW_REQUIRED",
] as const;

export type ProvisionalStatus = (typeof PROVISIONAL_STATUSES)[number];

export function isProvisionalStatus(value: string): value is ProvisionalStatus {
  return (PROVISIONAL_STATUSES as readonly string[]).includes(value);
}

/**
 * 受付キュー専用ステータス。
 *
 * MOD-005(status_registry) / API-006(reception_queue_contract)で承認された
 * キュー管理状態のみ。処方箋ライフサイクル状態や請求可否判定とは混同しない。
 */
export const RECEPTION_STATUSES = ["WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type ReceptionStatus = (typeof RECEPTION_STATUSES)[number];

export function isReceptionStatus(value: string): value is ReceptionStatus {
  return (RECEPTION_STATUSES as readonly string[]).includes(value);
}

/**
 * 復旧後同期での競合状態。自動補正は禁止(v0.2.0 §16)。
 */
export const CONFLICT_REQUIRES_HUMAN_REVIEW = "CONFLICT_REQUIRES_HUMAN_REVIEW" as const;

/**
 * MVP対象外の算定・請求を含む処方に付与するステータス(v0.2.0 §18)。
 * これらが付与されたデータから保険請求データを生成してはならない。
 */
export const UNSUPPORTED_CLAIM_STATUSES = [
  "BLOCKED_UNSUPPORTED_CLAIM",
  "MANUAL_REVIEW_REQUIRED",
  "FUTURE_SCOPE_NOT_CLAIMABLE",
] as const;

export type UnsupportedClaimStatus = (typeof UNSUPPORTED_CLAIM_STATUSES)[number];

/**
 * 請求可否判定の fail-closed allow-list。
 *
 * 未知ステータスは請求不可として扱う。ここへ追加できるのは「付与されていても請求可」と
 * MOD-005(status_registry)のSSOT改版で明示承認されたステータスだけ。
 */
export const CLAIMABLE_SAFE_STATUSES = [] as const;

/** 請求データ生成を許可してよいか(未知ステータスを含め、allow-list外が1つでもあれば不可) */
export function isClaimable(statuses: readonly string[]): boolean {
  return statuses.every((s) => (CLAIMABLE_SAFE_STATUSES as readonly string[]).includes(s));
}
