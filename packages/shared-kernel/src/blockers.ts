/**
 * BLOCKER 種別。
 *
 * 根拠: 構築プロンプト v0.2.0 §0.13(ブロッカー処理)、§9.1、§0.0.2.4、§0.0.3.12、§19。
 * 仕様不明・根拠不明・レビュー未完了の場合、実装・処理を進めず BLOCKED とする。
 */

export const BLOCKER_TYPES = [
  // 実装統率(§0.13)
  "BLOCKED_NOT_READY",
  "BLOCKED_REGULATORY_REVIEW",
  "BLOCKED_LEGAL_REVIEW",
  "BLOCKED_MEDICAL_SAFETY_REVIEW",
  "BLOCKED_OFFICIAL_ADAPTER_SPEC",
  "BLOCKED_CODE_MAPPING_REVIEW",
  "BLOCKED_UNSUPPORTED_CLAIM",
  "BLOCKED_PMH_REVIEW",
  "BLOCKED_NSIPS_LICENSE",
  "BLOCKED_SECURITY_REVIEW",
  "BLOCKED_PERFORMANCE_SLO",
  "BLOCKED_EDGE_SYNC_DESIGN",
  "BLOCKED_UX_SAFETY",
  "CODEX_CAPABILITY_UNVERIFIED",
  "AGMSG_PROTOCOL_UNVERIFIED",
  // 法令・品質(§5、§10)
  "BLOCKED_PMDA_SAMD_REVIEW",
  "BLOCKED_QUALITY_REGULATORY_REVIEW",
  // 移行(§9.1)
  "BLOCKED_MIGRATION_MAPPING_UNKNOWN",
  "BLOCKED_CUTOVER_ROLLBACK_UNDEFINED",
  "BLOCKED_LEGACY_RETENTION_UNKNOWN",
  // 実装所有・契約(§0.0.2.4)
  "IMPLEMENTATION_OWNERSHIP_BLOCKED",
  "API_CONTRACT_BLOCKED",
  // 共通モジュール(§0.0.3.12)
  "COMMON_MODULE_BLOCKED",
  "COMMON_MODULE_DUPLICATION_BLOCKED",
  "COMMON_MODULE_DEPENDENCY_VIOLATION",
  "GENERATED_CODE_DRIFT_BLOCKED",
  // 実行モード(§0.0.1)
  "CLAUDE_ULTRACODE_UNAVAILABLE",
  "CODEX_ULTRA_MODE_UNAVAILABLE",
  // マスター(§21)
  "PENDING_MASTER_VALIDATION",
  // コードマッピング(§22)
  "CODE_MAPPING_REVIEW_REQUIRED",
  // SSOT(§0.1.6.17)
  "SSOT_UPDATE_REQUIRED",
] as const;

export type BlockerType = (typeof BLOCKER_TYPES)[number];

export function isBlockerType(value: string): value is BlockerType {
  return (BLOCKER_TYPES as readonly string[]).includes(value);
}

/** ブロッカー報告(agmsg blockers ルーム投稿と同型。v0.2.0 §0.13) */
export interface BlockerReport {
  readonly blockerType: BlockerType;
  readonly workPackageId: string;
  readonly blockingQuestion: string;
  readonly affectedFiles: readonly string[];
  readonly risk: string;
  readonly recommendedNextStep: string;
}
