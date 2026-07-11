/**
 * 認証セッション状態。
 *
 * 根拠: docs/ui-ux-refresh/11-remaining-risks.md(R-AUTH / H-10 セッション切れで入力消失)、
 * 医療情報システム安全管理GL(識別・認証、将来の二要素)。
 *
 * 安全含意: セッション失効の直前に警告し、入力中の記録(record-lifecycle の UNSAVED/DRAFT)を
 * 消失させない(H-10)。失効時は再認証後に作業へ復帰できる導線を前提とする。
 *
 * 注記: 実際の認証基盤(OIDC/Cognito 等)との接続は API/セキュリティ契約に従う。
 * 本 enum は UI 状態の骨格であり、認証プロトコルそのものを定義しない。
 */

export const SESSION_STATUSES = [
  /** 有効。 */
  "ACTIVE",
  /** まもなく失効(事前警告の対象。入力保全と延長導線を提示)。 */
  "EXPIRING_SOON",
  /** 失効(再認証要。未保存記録の保全を前提に復帰導線を提示)。 */
  "EXPIRED",
  /** ロック(連続失敗等でロック。管理者/時間経過で解除)。 */
  "LOCKED",
] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

export function isSessionStatus(value: string): value is SessionStatus {
  return (SESSION_STATUSES as readonly string[]).includes(value);
}

/** 再認証を要する状態か(EXPIRED / LOCKED)。 */
export function requiresReauth(status: SessionStatus): boolean {
  return status === "EXPIRED" || status === "LOCKED";
}
