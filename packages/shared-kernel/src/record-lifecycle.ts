/**
 * 記録ライフサイクル状態(調剤録・薬歴等の法定記録の状態)。
 *
 * 根拠: docs/uiux/medical_ui_ux_principles.md(UIX-001 P-06 確定前後の識別 / P-07 訂正履歴 /
 * P-12 確定者・日時)、docs/ui-ux-refresh/12-component-contracts.md(RecordStateBadge)、
 * 電子保存三基準(真正性・見読性・保存性 / e-文書法・厚労省GL)。
 *
 * 安全含意:
 * - 「確認前(下書き)」を「確定」と誤認させない(H-05)。
 * - ローカル保存済み(未同期)をサーバ保存済みと同一に見せない(H-03。sync-status と直交)。
 * - 確定後の変更は必ず「訂正(amended)」として履歴に残し、原本を上書きしない(真正性)。
 *
 * このライフサイクルは「1件の記録の状態」であり、同期状態(sync-status)・
 * システムモード(system-mode)・請求可否(status)とは別軸である(§11.3 直交)。
 */

export const RECORD_LIFECYCLE_STATUSES = [
  /** 未保存(入力中・どこにも保存されていない)。離脱で消失しうる。 */
  "UNSAVED",
  /** 下書き(サーバ保存済みだが確定前)。確定と誤認させない。 */
  "DRAFT",
  /** ローカルにのみ自動保存(サーバ未反映)。サーバ保存済みと同一表現にしない(H-03)。 */
  "AUTO_SAVED_LOCALLY",
  /** サーバ保存済み(未確定)。 */
  "SERVER_SAVED",
  /** 確認待ち(第三者/薬剤師の確認を要する)。 */
  "PENDING_REVIEW",
  /** 代理入力(入力者と責任者が異なる)。承認前提。 */
  "PROXY_ENTERED",
  /** 承認待ち(代理入力等を承認する段階)。 */
  "APPROVAL_PENDING",
  /** 承認済み(確定手前の承認完了)。 */
  "APPROVED",
  /** 確定(法定記録として確定。以後の変更は訂正扱い)。 */
  "FINALIZED",
  /** 訂正済み(確定後に訂正。訂正履歴・訂正者・日時を保持。原本は残す)。 */
  "AMENDED",
  /** 版が更新され過去版化(最新版に置換された旧版)。 */
  "SUPERSEDED",
] as const;

export type RecordLifecycleStatus = (typeof RECORD_LIFECYCLE_STATUSES)[number];

export function isRecordLifecycleStatus(value: string): value is RecordLifecycleStatus {
  return (RECORD_LIFECYCLE_STATUSES as readonly string[]).includes(value);
}

/**
 * 「確定済み(法定記録として確定)」とみなせる状態か。
 * 確定・訂正済み・過去版は確定系(原本性あり)。下書き系は含めない。
 */
export function isFinalizedRecord(status: RecordLifecycleStatus): boolean {
  return status === "FINALIZED" || status === "AMENDED" || status === "SUPERSEDED";
}

/**
 * サーバに永続化されておらず消失リスクがある状態か(離脱警告・自動保存導線の判断に使う)。
 * UNSAVED は未保存、AUTO_SAVED_LOCALLY はローカルのみでサーバ未反映のため対象。
 */
export function isAtRiskOfLoss(status: RecordLifecycleStatus): boolean {
  return status === "UNSAVED" || status === "AUTO_SAVED_LOCALLY";
}
