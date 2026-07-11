/**
 * 同期状態(1件の記録・キュー項目のサーバ同期状態)。
 *
 * 根拠: docs/ui-ux-refresh/12-component-contracts.md(SyncIndicator/OfflineBanner)、
 * 07-use-error-risk-register.md(H-03 ローカル保存をサーバ保存と誤認)、
 * 構築プロンプト v0.2.0 §16(復旧後同期・競合は自動補正禁止・人間承認)。
 *
 * 直交性: これは「1件の同期状態」であり、システム全体の稼働状態(system-mode)とは別軸。
 * LOCAL_ONLY(system-mode)で作成された記録は QUEUED になりうる、というように組み合わさる。
 *
 * 安全含意: ローカル保存済み(QUEUED/未同期)にサーバ保存済み(SYNCED)と同じ成功表現(✓)を
 * 使わない(H-03)。競合(CONFLICT)は自動補正せず人間の解決を促す。
 */

export const SYNC_STATUSES = [
  /** サーバと同期済み(確定的にサーバ保存済み)。 */
  "SYNCED",
  /** 同期キュー投入済み(ローカル保存・サーバ未反映)。成功表現にしない。 */
  "QUEUED",
  /** 同期処理中。 */
  "SYNCING",
  /** 取得データが古い可能性(最終同期からの経過・接続不安定)。 */
  "STALE",
  /** 同期失敗・再試行待ち。 */
  "RETRYING",
  /** 同期失敗(自動再試行の上限到達等。手動対応要)。 */
  "SYNC_FAILED",
  /** 競合(サーバ側と差分)。自動補正禁止・人間による解決要。 */
  "CONFLICT",
] as const;

export type SyncStatus = (typeof SYNC_STATUSES)[number];

export function isSyncStatus(value: string): value is SyncStatus {
  return (SYNC_STATUSES as readonly string[]).includes(value);
}

/** サーバに確定的に保存されたとみなせる状態か(SYNCED のみ)。 */
export function isDurablySynced(status: SyncStatus): boolean {
  return status === "SYNCED";
}

/** 人間の対応(再試行判断・競合解決)を要する状態か。 */
export function requiresHumanAttention(status: SyncStatus): boolean {
  return status === "SYNC_FAILED" || status === "CONFLICT";
}
