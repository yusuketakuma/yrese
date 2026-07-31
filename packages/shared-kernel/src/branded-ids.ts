/**
 * Branded ID 型。
 *
 * tenant_id / pharmacy_id などの識別子を string の相互代入から守る。
 * 値の実体は string のまま(runtime-neutral / 依存ゼロ)。
 *
 * 根拠: 構築プロンプト v0.2.0 §0.0.3.3(共通化すべき概念 — branded ID types)
 */

declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type TenantId = Brand<string, "TenantId">;
export type PharmacyId = Brand<string, "PharmacyId">;
export type UserId = Brand<string, "UserId">;
export type PatientId = Brand<string, "PatientId">;
export type ReceptionId = Brand<string, "ReceptionId">;
export type PrescriptionId = Brand<string, "PrescriptionId">;
export type DispensingId = Brand<string, "DispensingId">;
export type ClaimId = Brand<string, "ClaimId">;
export type EventId = Brand<string, "EventId">;
export type DeviceId = Brand<string, "DeviceId">;
export type EvidenceId = Brand<string, "EvidenceId">;
export type WorkPackageId = Brand<string, "WorkPackageId">;

/**
 * 複合キーの区切り文字。ID 値に含めてはならない。
 *
 * `#` を含む ID を許すと、区切り文字で連結した複合キーで prefix 曖昧性が生じ、
 * 異なる識別子の組が同一キーへ衝突する。たとえば `TENANT#{t}#PHARMACY#{p}` 形式では
 * `t="A#PHARMACY#B", p="C"` と `t="A", p="B#PHARMACY#C"` が同一文字列を生む。
 * 連結キーの prefix でスコープを与える認可(IAM の `dynamodb:LeadingKeys` 等)は
 * この曖昧性の下でテナント境界を保証できないため、生成時点で fail-closed に拒否する。
 */
const KEY_DELIMITER = "#";

/** ID として不正な値(空文字・空白のみ・制御文字・キー区切り文字)を拒否する */
function assertValidId(value: string, label: string): void {
  if (typeof value !== "string" || value.length === 0 || value.trim().length === 0) {
    throw new RangeError(`${label} must be a non-empty string`);
  }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(value)) {
    throw new RangeError(`${label} must not contain control characters`);
  }
  if (value.includes(KEY_DELIMITER)) {
    throw new RangeError(`${label} must not contain ${KEY_DELIMITER}`);
  }
}

function makeIdFactory<T extends string>(label: string) {
  return (value: string): Brand<string, T> => {
    assertValidId(value, label);
    return value as Brand<string, T>;
  };
}

export const tenantId = makeIdFactory<"TenantId">("TenantId");
export const pharmacyId = makeIdFactory<"PharmacyId">("PharmacyId");
export const userId = makeIdFactory<"UserId">("UserId");
export const patientId = makeIdFactory<"PatientId">("PatientId");
export const receptionId = makeIdFactory<"ReceptionId">("ReceptionId");
export const prescriptionId = makeIdFactory<"PrescriptionId">("PrescriptionId");
export const dispensingId = makeIdFactory<"DispensingId">("DispensingId");
export const claimId = makeIdFactory<"ClaimId">("ClaimId");
export const eventId = makeIdFactory<"EventId">("EventId");
export const deviceId = makeIdFactory<"DeviceId">("DeviceId");
export const evidenceId = makeIdFactory<"EvidenceId">("EvidenceId");
export const workPackageId = makeIdFactory<"WorkPackageId">("WorkPackageId");
