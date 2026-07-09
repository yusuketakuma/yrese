/**
 * システムモード。
 *
 * 根拠: 構築プロンプト v0.1.7 §13(システムモード)。
 * モードごとの許可・禁止操作は docs/plan/phase0_plan.md §9.3 の初期表に従い、
 * 確定版は offline_mode_matrix SSOT(APPROVED後)を根拠とする。
 */

export const SYSTEM_MODES = [
  "NORMAL",
  "EXTERNAL_DEGRADED",
  "CLOUD_DEGRADED",
  "LOCAL_ONLY",
  "RECOVERY_SYNC",
] as const;

export type SystemMode = (typeof SYSTEM_MODES)[number];

export function isSystemMode(value: string): value is SystemMode {
  return (SYSTEM_MODES as readonly string[]).includes(value);
}

/** 外部公的システム(オン資・電子処方箋・オンライン請求・PMH)を新規に成功扱いできるモードか */
export function canConfirmExternal(mode: SystemMode): boolean {
  return mode === "NORMAL" || mode === "CLOUD_DEGRADED";
}

/** 確定算定を許可してよいモードか(LOCAL_ONLY は仮算定のみ) */
export function allowsFinalCalculation(mode: SystemMode): boolean {
  return mode !== "LOCAL_ONLY";
}

/** 請求前点検・月次締め・レセプト確定を許可してよいモードか */
export function allowsClaimFinalization(mode: SystemMode): boolean {
  return mode === "NORMAL";
}
