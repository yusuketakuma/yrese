/**
 * エラー/警告コードの型基盤。
 *
 * 根拠: 構築プロンプト v0.2.0 §0.0.3.3(error code / warning code は共通モジュールで管理)。
 * 具体的なコード値の追加は error_code_registry.md SSOT(APPROVED)を根拠とする。
 * ローカル(apps/**)での重複定義は COMMON_MODULE_DUPLICATION_BLOCKED。
 */

export const ERROR_SEVERITIES = ["INFO", "WARNING", "ERROR", "BLOCKER", "CRITICAL"] as const;
export type ErrorSeverity = (typeof ERROR_SEVERITIES)[number];

export const ERROR_DOMAINS = [
  "RECEPTION",
  "PATIENT",
  "INSURANCE",
  "PUBLIC_EXPENSE",
  "PRESCRIPTION",
  "DISPENSING",
  "CALCULATION",
  "CLAIM",
  "REPORT",
  "MASTER",
  "SYNC",
  "EXTERNAL_ADAPTER",
  "AUTH",
  "AUDIT",
  "SYSTEM",
] as const;
export type ErrorDomain = (typeof ERROR_DOMAINS)[number];

/**
 * エラーコード定義。
 * 医療UIの原則(v0.2.0 §7)に従い、「何が危険か」「何を確認するか」「請求できるか」を
 * 表現できる構造を持つ。表示文言そのものは UI 側(frontend)所有であり、ここには置かない。
 */
export interface ErrorCodeDef {
  /** 例: "CALC-0001"。形式は `${DOMAIN短縮}-${4桁}` */
  readonly code: string;
  readonly domain: ErrorDomain;
  readonly severity: ErrorSeverity;
  /** 請求可否に影響するか */
  readonly affectsClaimability: boolean;
  /** 人間(薬剤師・事務)の確認を要するか */
  readonly requiresHumanReview: boolean;
  /** 開発者向け説明(患者情報・PHIを含めてはならない) */
  readonly description: string;
}

const CODE_PATTERN = /^[A-Z]{2,10}-\d{4}$/;

export function isValidErrorCode(code: string): boolean {
  return typeof code === "string" && CODE_PATTERN.test(code);
}

/** レジストリ(重複コードを拒否する) */
export class ErrorCodeRegistry {
  private readonly defs = new Map<string, ErrorCodeDef>();

  register(def: ErrorCodeDef): void {
    if (!isValidErrorCode(def.code)) {
      throw new RangeError(`invalid error code format: ${def.code}`);
    }
    if (this.defs.has(def.code)) {
      throw new RangeError(`duplicate error code: ${def.code}`);
    }
    this.defs.set(def.code, def);
  }

  get(code: string): ErrorCodeDef | undefined {
    return this.defs.get(code);
  }

  all(): readonly ErrorCodeDef[] {
    return [...this.defs.values()];
  }
}

export const KERNEL_ERROR_CODES = [
  {
    code: "AUTH-0003",
    domain: "AUTH",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "permission denied (deny-by-default)",
  },
  {
    code: "PAT-0001",
    domain: "PATIENT",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "invalid patient search query",
  },
  {
    code: "RCV-0001",
    domain: "RECEPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "invalid reception request",
  },
  {
    code: "RCV-0002",
    domain: "RECEPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "patient not found for reception",
  },
  {
    code: "RCV-0003",
    domain: "RECEPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "reception idempotency conflict",
  },
  {
    code: "AUD-0001",
    domain: "AUDIT",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "invalid audit log query",
  },
  {
    code: "PAT-0002",
    domain: "PATIENT",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "patient not found",
  },
  {
    code: "RCV-0004",
    domain: "RECEPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "reception status transition not allowed",
  },
  {
    code: "RCV-0005",
    domain: "RECEPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "reception version conflict",
  },
  {
    code: "RCV-0006",
    domain: "RECEPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "reception not found",
  },
  {
    code: "INS-0007",
    domain: "INSURANCE",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "invalid eligibility snapshot request",
  },
  {
    code: "INS-0008",
    domain: "INSURANCE",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "reception not found for eligibility snapshot",
  },
  {
    code: "INS-0009",
    domain: "INSURANCE",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "eligibility snapshot conflict",
  },
  {
    code: "INS-0010",
    domain: "INSURANCE",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "eligibility transition not allowed",
  },
  {
    code: "PAT-0003",
    domain: "PATIENT",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "patient number conflict",
  },
  {
    code: "PAT-0004",
    domain: "PATIENT",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "patient version conflict",
  },
  {
    code: "PAT-0005",
    domain: "PATIENT",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "immutable patient field change",
  },
  {
    code: "PAT-0006",
    domain: "PATIENT",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "patient idempotency conflict",
  },
  {
    code: "PAT-0007",
    domain: "PATIENT",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "invalid patient write request",
  },
] as const satisfies readonly ErrorCodeDef[];

export const AUTH_PERMISSION_DENIED_ERROR_CODE = KERNEL_ERROR_CODES[0].code;
export const PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE = KERNEL_ERROR_CODES[1].code;
export const RECEPTION_INVALID_REQUEST_ERROR_CODE = KERNEL_ERROR_CODES[2].code;
export const RECEPTION_PATIENT_NOT_FOUND_ERROR_CODE = KERNEL_ERROR_CODES[3].code;
export const RECEPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE = KERNEL_ERROR_CODES[4].code;
export const AUDIT_LOG_INVALID_QUERY_ERROR_CODE = KERNEL_ERROR_CODES[5].code;
export const PATIENT_NOT_FOUND_ERROR_CODE = KERNEL_ERROR_CODES[6].code;
export const RECEPTION_INVALID_TRANSITION_ERROR_CODE = KERNEL_ERROR_CODES[7].code;
export const RECEPTION_VERSION_CONFLICT_ERROR_CODE = KERNEL_ERROR_CODES[8].code;
export const RECEPTION_NOT_FOUND_ERROR_CODE = KERNEL_ERROR_CODES[9].code;
export const INSURANCE_ELIGIBILITY_INVALID_REQUEST_ERROR_CODE =
  KERNEL_ERROR_CODES[10].code;
export const INSURANCE_ELIGIBILITY_RECEPTION_NOT_FOUND_ERROR_CODE =
  KERNEL_ERROR_CODES[11].code;
export const INSURANCE_ELIGIBILITY_SNAPSHOT_CONFLICT_ERROR_CODE =
  KERNEL_ERROR_CODES[12].code;
export const INSURANCE_ELIGIBILITY_TRANSITION_ERROR_CODE =
  KERNEL_ERROR_CODES[13].code;
export const PATIENT_NUMBER_CONFLICT_ERROR_CODE = KERNEL_ERROR_CODES[14].code;
export const PATIENT_VERSION_CONFLICT_ERROR_CODE = KERNEL_ERROR_CODES[15].code;
export const PATIENT_IMMUTABLE_FIELD_ERROR_CODE = KERNEL_ERROR_CODES[16].code;
export const PATIENT_IDEMPOTENCY_CONFLICT_ERROR_CODE = KERNEL_ERROR_CODES[17].code;
export const PATIENT_WRITE_INVALID_REQUEST_ERROR_CODE = KERNEL_ERROR_CODES[18].code;

export function createKernelErrorCodeRegistry(): ErrorCodeRegistry {
  const registry = new ErrorCodeRegistry();
  for (const def of KERNEL_ERROR_CODES) {
    registry.register(def);
  }
  return registry;
}
