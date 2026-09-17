"use client";

import { useRef, useState } from "react";

import {
  patientCreateRequestSchema,
  patientCreateResponseSchema,
  type PatientCreateRequest,
  type PatientCreateResponse,
  type PatientVersionedSummary,
} from "@yrese/contracts";
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  PATIENT_IDEMPOTENCY_CONFLICT_ERROR_CODE,
  PATIENT_NUMBER_CONFLICT_ERROR_CODE,
  PATIENT_WRITE_INVALID_REQUEST_ERROR_CODE,
  permissionScope,
} from "@yrese/shared-kernel";

import { devTenantHeaders } from "../dev-tenant";

import { registeredErrorCodeOrUndefined } from "../components/error-code";
import { ErrorNotice, type ErrorNoticeProps } from "../components/error-notice";
import { Panel, TableScroll } from "../components/operator-ui";
import { SeverityList } from "../components/severity-list";
import { SEX_LABELS } from "../status/visual-status-registry";
import { resolveWebApiUrl } from "../api-transport";

/**
 * 患者新規登録フォーム(SCR-002-C / WP-7202 / API-001 0.3.x)。
 *
 * - 冪等性は API-013 の Idempotency-Key。「同一登録意図」に 1 key を割り当て、
 *   入力変更で新しい key、失敗後の同一内容再送では key を再利用する。
 * - レスポンスの POSSIBLE_DUPLICATE warning は非ブロッキングのまま可視化する
 *   (取り違え防止 — UIX-001 / SAF-001)。候補の自動選択・自動 merge は禁止。
 * - 応答は zod schema で検証し、登録成功時は患者文脈へそのまま選択する。
 */

const patientCreateScopes = [
  permissionScope("patient", "write"),
  permissionScope("patient", "read"),
] as const;

class RegistrationError extends Error {
  constructor(readonly notice: ErrorNoticeProps) {
    super(notice.message);
  }
}

function expectedCreateErrorCode(status: number): readonly string[] {
  if (status === 400) return [PATIENT_WRITE_INVALID_REQUEST_ERROR_CODE];
  if (status === 403) return [AUTH_PERMISSION_DENIED_ERROR_CODE];
  if (status === 409) {
    return [
      PATIENT_NUMBER_CONFLICT_ERROR_CODE,
      PATIENT_IDEMPOTENCY_CONFLICT_ERROR_CODE,
    ];
  }
  return [];
}

async function readRegisteredErrorCode(res: Response): Promise<string | undefined> {
  try {
    const body: unknown = await res.json();
    if (typeof body !== "object" || body === null) {
      return undefined;
    }
    const descriptor = Object.getOwnPropertyDescriptor(body, "errorCode");
    if (descriptor === undefined || !("value" in descriptor)) {
      return undefined;
    }
    const code = registeredErrorCodeOrUndefined(descriptor.value);
    return code !== undefined && expectedCreateErrorCode(res.status).includes(code)
      ? code
      : undefined;
  } catch {
    return undefined;
  }
}

/** POST /patients(API-001)。成功応答と 409 の code 付き失敗を契約で判別する。 */
export async function createPatient(
  input: PatientCreateRequest,
  idempotencyKey: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<PatientCreateResponse> {
  const res = await fetchImpl(resolveWebApiUrl("/patients"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      ...devTenantHeaders(patientCreateScopes),
    },
    body: JSON.stringify(input),
    cache: "no-store",
    ...(signal !== undefined ? { signal } : {}),
  });
  if (res.status === 200 || res.status === 201) {
    return patientCreateResponseSchema.parse(await res.json());
  }
  const errorCode = await readRegisteredErrorCode(res);
  if (res.status === 403) {
    throw new RegistrationError({
      message: "権限がありません。",
      nextAction:
        "管理者に権限(patient:write / patient:read)の付与状況を確認してください。",
      ...(errorCode !== undefined ? { errorCode } : {}),
    });
  }
  if (res.status === 409 && errorCode === PATIENT_NUMBER_CONFLICT_ERROR_CODE) {
    throw new RegistrationError({
      message: "その患者番号は既に使用されています。",
      nextAction: "患者番号を変更するか、既存患者を検索して確認してください。",
      errorCode,
    });
  }
  if (res.status === 400) {
    throw new RegistrationError({
      message: "登録内容が不正です。",
      nextAction: "氏名・カナ・生年月日・性別・患者番号の入力を確認してください。",
      ...(errorCode !== undefined ? { errorCode } : {}),
    });
  }
  throw new RegistrationError({
    message: `患者登録に失敗しました(HTTP ${res.status})。`,
    nextAction:
      "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
    ...(errorCode !== undefined ? { errorCode } : {}),
  });
}

/** 同一登録意図の再送に備えて Idempotency-Key を保持する。入力編集・登録成功で新規発行。 */
function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

const emptyDraft = {
  name: "",
  kana: "",
  birthDate: "",
  sex: "",
  patientNumber: "",
};

export function PatientRegistrationForm({
  onRegistered,
}: {
  readonly onRegistered: (patient: PatientVersionedSummary) => void;
}) {
  const [draft, setDraft] = useState(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<ErrorNoticeProps | null>(null);
  const [warnings, setWarnings] = useState<
    PatientCreateResponse["warnings"] | undefined
  >(undefined);
  const keyRef = useRef<string | null>(null);

  const edit = (patch: Partial<typeof draft>) => {
    keyRef.current = null;
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const submit = async () => {
    const candidate = {
      name: draft.name,
      kana: draft.kana,
      birthDate: draft.birthDate,
      sex: draft.sex,
      ...(draft.patientNumber.trim() !== ""
        ? { patientNumber: draft.patientNumber.trim() }
        : {}),
    };
    const parsed = patientCreateRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrorNotice({
        message: "登録内容が不正です。",
        nextAction:
          "氏名・カナ・生年月日(YYYY-MM-DDの実在暦日)・性別を確認してください。",
      });
      return;
    }
    if (keyRef.current === null) {
      keyRef.current = newIdempotencyKey();
    }
    const key = keyRef.current;
    setSubmitting(true);
    setErrorNotice(null);
    try {
      const response = await createPatient(parsed.data, key);
      setWarnings(response.warnings);
      setDraft(emptyDraft);
      keyRef.current = null;
      onRegistered(response.patient);
    } catch (error) {
      setErrorNotice(
        error instanceof RegistrationError
          ? error.notice
          : {
              message: "患者登録に失敗しました。",
              nextAction:
                "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
            },
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel
      title="新規患者登録"
      description="検索で見つからない患者を登録します。登録後はその患者が業務対象として選択されます。"
    >
      {errorNotice !== null && <ErrorNotice {...errorNotice} />}
      {warnings !== undefined && warnings.length > 0 && (
        <>
          <SeverityList
            items={[
              {
                severity: "WARNING",
                message:
                  "同姓同名または同生年月日の患者が既に登録されています。登録した患者が別人であることを氏名・生年月日・患者番号で必ず確認してください。",
              },
            ]}
          />
          <TableScroll label="登録時の類似患者候補。横方向にスクロールできます">
            <table className="patient-duplicate-candidates">
              <thead>
                <tr>
                  <th scope="col">患者番号</th>
                  <th scope="col">氏名(カナ)</th>
                  <th scope="col">生年月日</th>
                  <th scope="col">性別</th>
                </tr>
              </thead>
              <tbody>
                {warnings.flatMap((w) =>
                  w.candidates.map((c) => (
                    <tr key={c.patientId}>
                      <td>{c.patientNumber}</td>
                      <td>
                        <span className="patient-kana">{c.kana}</span>
                        <span className="patient-name">{c.name}</span>
                      </td>
                      <td>{c.birthDate}</td>
                      <td>{SEX_LABELS[c.sex]}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </TableScroll>
        </>
      )}
      <form
        className="patient-registration-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="patient-reg-name">氏名(漢字)</label>
        <input
          id="patient-reg-name"
          value={draft.name}
          onChange={(e) => edit({ name: e.target.value })}
          maxLength={128}
          autoComplete="off"
          required
        />
        <label htmlFor="patient-reg-kana">氏名(カナ)</label>
        <input
          id="patient-reg-kana"
          value={draft.kana}
          onChange={(e) => edit({ kana: e.target.value })}
          maxLength={128}
          autoComplete="off"
          required
        />
        <label htmlFor="patient-reg-birthdate">生年月日</label>
        <input
          id="patient-reg-birthdate"
          type="date"
          value={draft.birthDate}
          onChange={(e) => edit({ birthDate: e.target.value })}
          required
        />
        <label htmlFor="patient-reg-sex">性別</label>
        <select
          id="patient-reg-sex"
          value={draft.sex}
          onChange={(e) => edit({ sex: e.target.value })}
          required
        >
          <option value="" disabled>
            選択してください
          </option>
          <option value="male">{SEX_LABELS.male}</option>
          <option value="female">{SEX_LABELS.female}</option>
          <option value="unknown">{SEX_LABELS.unknown}</option>
        </select>
        <label htmlFor="patient-reg-number">患者番号(省略時は自動採番)</label>
        <input
          id="patient-reg-number"
          value={draft.patientNumber}
          onChange={(e) => edit({ patientNumber: e.target.value })}
          maxLength={64}
          autoComplete="off"
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "登録中…" : "この患者を登録"}
        </button>
      </form>
    </Panel>
  );
}
