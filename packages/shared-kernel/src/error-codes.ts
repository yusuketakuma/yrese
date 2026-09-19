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
    code: "AUTH-0004",
    domain: "AUTH",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description:
      "authentication failed or credential is missing/invalid (reason detail is not disclosed)",
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
    code: "INS-0001",
    domain: "INSURANCE",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "invalid coverage request",
  },
  {
    code: "INS-0002",
    domain: "INSURANCE",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "patient not found for coverage",
  },
  {
    code: "INS-0003",
    domain: "INSURANCE",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "insurance card period overlap",
  },
  {
    code: "INS-0004",
    domain: "INSURANCE",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "public expense priority conflict",
  },
  {
    code: "INS-0005",
    domain: "INSURANCE",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "coverage supersede target invalid",
  },
  {
    code: "INS-0006",
    domain: "INSURANCE",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "coverage idempotency conflict",
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
  {
    code: "RCV-0007",
    domain: "RECEPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "reception queue bound exceeded",
  },
  {
    code: "MST-0001",
    domain: "MASTER",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "invalid master query",
  },
  {
    code: "MST-0002",
    domain: "MASTER",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "master version lookup reserved",
  },
  {
    code: "RX-0001",
    domain: "PRESCRIPTION",
    severity: "BLOCKER",
    affectsClaimability: true,
    requiresHumanReview: true,
    description:
      "prescription draft contains UNRESOLVED_TEXT medication rows and cannot proceed to pharmacist confirmation",
  },
  {
    code: "RX-0002",
    domain: "PRESCRIPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description:
      "prescription lifecycle transition is not allowed for the current status",
  },
  {
    code: "RX-0003",
    domain: "PRESCRIPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description:
      "required source prescription metadata is incomplete for confirmation or finalization",
  },
  {
    code: "RX-0004",
    domain: "PRESCRIPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description:
      "reception is not IN_PROGRESS for pharmacist confirmation",
  },
  {
    code: "RX-0005",
    domain: "PRESCRIPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "invalid prescription lifecycle command request",
  },
  {
    code: "RX-0006",
    domain: "PRESCRIPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description:
      "prescription does not exist in the tenant or pharmacy scope",
  },
  {
    code: "RX-0007",
    domain: "PRESCRIPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description:
      "prescription amendment requires a resolved inquiry with result CHANGED on the same prescription",
  },
  {
    code: "RX-0008",
    domain: "PRESCRIPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "invalid prescription inquiry command request",
  },
  {
    code: "RX-0009",
    domain: "PRESCRIPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description:
      "prescription inquiry does not exist in the tenant or pharmacy scope",
  },
  {
    code: "RX-0010",
    domain: "PRESCRIPTION",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description:
      "idempotency-key replay with a different payload is rejected",
  },
  {
    code: "DSP-0001",
    domain: "DISPENSING",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description:
      "dispensing record cannot be created while a prescription inquiry remains unresolved",
  },
  {
    code: "DSP-0002",
    domain: "DISPENSING",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description:
      "dispensing lifecycle transition is not allowed for the current status",
  },
  {
    code: "DSP-0003",
    domain: "DISPENSING",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description:
      "dispensing record or finalized prescription version does not exist in the tenant or pharmacy scope",
  },
  {
    code: "DSP-0004",
    domain: "DISPENSING",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description:
      "generic substitution is not permitted or the generic name code does not match between the prescribed and dispensed items",
  },
  {
    code: "DSP-0005",
    domain: "DISPENSING",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "invalid dispensing record command request",
  },
  {
    code: "DSP-0006",
    domain: "DISPENSING",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description: "dispensing error code reserved",
  },
  {
    code: "DSP-0007",
    domain: "DISPENSING",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description:
      "a dispensing record already exists for the prescription version",
  },
  {
    code: "DSP-0008",
    domain: "DISPENSING",
    severity: "ERROR",
    affectsClaimability: false,
    requiresHumanReview: false,
    description:
      "idempotency-key replay with a different payload is rejected",
  },
] as const satisfies readonly ErrorCodeDef[];

export const AUTH_PERMISSION_DENIED_ERROR_CODE = KERNEL_ERROR_CODES[0].code;
export const AUTH_UNAUTHENTICATED_ERROR_CODE = "AUTH-0004";
export const PATIENT_SEARCH_INVALID_QUERY_ERROR_CODE = KERNEL_ERROR_CODES[2].code;
export const RECEPTION_INVALID_REQUEST_ERROR_CODE = KERNEL_ERROR_CODES[3].code;
export const RECEPTION_PATIENT_NOT_FOUND_ERROR_CODE = KERNEL_ERROR_CODES[4].code;
export const RECEPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE = KERNEL_ERROR_CODES[5].code;
export const AUDIT_LOG_INVALID_QUERY_ERROR_CODE = KERNEL_ERROR_CODES[6].code;
export const PATIENT_NOT_FOUND_ERROR_CODE = KERNEL_ERROR_CODES[7].code;
export const RECEPTION_INVALID_TRANSITION_ERROR_CODE = KERNEL_ERROR_CODES[8].code;
export const RECEPTION_VERSION_CONFLICT_ERROR_CODE = KERNEL_ERROR_CODES[9].code;
export const RECEPTION_NOT_FOUND_ERROR_CODE = KERNEL_ERROR_CODES[10].code;
export const COVERAGE_INVALID_REQUEST_ERROR_CODE = KERNEL_ERROR_CODES[11].code;
export const COVERAGE_PATIENT_NOT_FOUND_ERROR_CODE = KERNEL_ERROR_CODES[12].code;
export const COVERAGE_PERIOD_OVERLAP_ERROR_CODE = KERNEL_ERROR_CODES[13].code;
export const COVERAGE_PRIORITY_CONFLICT_ERROR_CODE = KERNEL_ERROR_CODES[14].code;
export const COVERAGE_SUPERSEDE_CONFLICT_ERROR_CODE = KERNEL_ERROR_CODES[15].code;
export const COVERAGE_IDEMPOTENCY_CONFLICT_ERROR_CODE =
  KERNEL_ERROR_CODES[16].code;
export const INSURANCE_ELIGIBILITY_INVALID_REQUEST_ERROR_CODE =
  KERNEL_ERROR_CODES[17].code;
export const INSURANCE_ELIGIBILITY_RECEPTION_NOT_FOUND_ERROR_CODE =
  KERNEL_ERROR_CODES[18].code;
export const INSURANCE_ELIGIBILITY_SNAPSHOT_CONFLICT_ERROR_CODE =
  KERNEL_ERROR_CODES[19].code;
export const INSURANCE_ELIGIBILITY_TRANSITION_ERROR_CODE =
  KERNEL_ERROR_CODES[20].code;
export const PATIENT_NUMBER_CONFLICT_ERROR_CODE = KERNEL_ERROR_CODES[21].code;
export const PATIENT_VERSION_CONFLICT_ERROR_CODE = KERNEL_ERROR_CODES[22].code;
export const PATIENT_IMMUTABLE_FIELD_ERROR_CODE = KERNEL_ERROR_CODES[23].code;
export const PATIENT_IDEMPOTENCY_CONFLICT_ERROR_CODE = KERNEL_ERROR_CODES[24].code;
export const PATIENT_WRITE_INVALID_REQUEST_ERROR_CODE = KERNEL_ERROR_CODES[25].code;
export const RECEPTION_QUEUE_BOUND_EXCEEDED_ERROR_CODE =
  KERNEL_ERROR_CODES[26].code;
export const MASTER_INVALID_QUERY_ERROR_CODE = KERNEL_ERROR_CODES[27].code;
export const MASTER_VERSION_NOT_FOUND_ERROR_CODE = KERNEL_ERROR_CODES[28].code;
export const PRESCRIPTION_CODE_MAPPING_REVIEW_REQUIRED_ERROR_CODE =
  KERNEL_ERROR_CODES[29].code;
export const PRESCRIPTION_INVALID_TRANSITION_ERROR_CODE =
  KERNEL_ERROR_CODES[30].code;
export const PRESCRIPTION_METADATA_INCOMPLETE_ERROR_CODE =
  KERNEL_ERROR_CODES[31].code;
export const PRESCRIPTION_RECEPTION_NOT_IN_PROGRESS_ERROR_CODE =
  KERNEL_ERROR_CODES[32].code;
export const PRESCRIPTION_LIFECYCLE_INVALID_REQUEST_ERROR_CODE =
  KERNEL_ERROR_CODES[33].code;
export const PRESCRIPTION_NOT_FOUND_ERROR_CODE = KERNEL_ERROR_CODES[34].code;
export const PRESCRIPTION_INQUIRY_UNRESOLVED_ERROR_CODE =
  KERNEL_ERROR_CODES[35].code;
export const PRESCRIPTION_INQUIRY_INVALID_REQUEST_ERROR_CODE =
  KERNEL_ERROR_CODES[36].code;
export const PRESCRIPTION_INQUIRY_NOT_FOUND_ERROR_CODE =
  KERNEL_ERROR_CODES[37].code;
export const PRESCRIPTION_IDEMPOTENCY_CONFLICT_ERROR_CODE =
  KERNEL_ERROR_CODES[38].code;
export const DISPENSING_INQUIRY_UNRESOLVED_ERROR_CODE =
  KERNEL_ERROR_CODES[39].code;
export const DISPENSING_INVALID_TRANSITION_ERROR_CODE =
  KERNEL_ERROR_CODES[40].code;
export const DISPENSING_NOT_FOUND_ERROR_CODE = KERNEL_ERROR_CODES[41].code;
export const DISPENSING_GENERIC_MISMATCH_ERROR_CODE =
  KERNEL_ERROR_CODES[42].code;
export const DISPENSING_INVALID_REQUEST_ERROR_CODE =
  KERNEL_ERROR_CODES[43].code;
export const DISPENSING_RESERVED_ERROR_CODE = KERNEL_ERROR_CODES[44].code;
export const DISPENSING_ALREADY_RECORDED_ERROR_CODE =
  KERNEL_ERROR_CODES[45].code;
export const DISPENSING_IDEMPOTENCY_CONFLICT_ERROR_CODE =
  KERNEL_ERROR_CODES[46].code;

export function createKernelErrorCodeRegistry(): ErrorCodeRegistry {
  const registry = new ErrorCodeRegistry();
  for (const def of KERNEL_ERROR_CODES) {
    registry.register(def);
  }
  return registry;
}
