/**
 * エラー/警告コードの型基盤。
 *
 * 根拠: 構築プロンプト v0.1.7 §0.0.3.3(error code / warning code は共通モジュールで管理)。
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
 * 医療UIの原則(v0.1.7 §7)に従い、「何が危険か」「何を確認するか」「請求できるか」を
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
  return CODE_PATTERN.test(code);
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
