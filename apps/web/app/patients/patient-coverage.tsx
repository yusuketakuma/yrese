"use client";

import { useEffect, useRef, useState } from "react";

import {
  coverageListResponseSchema,
  coverageRecordRequestSchema,
  type CoverageListResponse,
  type CoverageRecordRequest,
  type InsuranceCard,
  type PublicExpense,
} from "@yrese/contracts";
import {
  AUTH_PERMISSION_DENIED_ERROR_CODE,
  COVERAGE_PRIORITY_CONFLICT_ERROR_CODE,
  COVERAGE_PATIENT_NOT_FOUND_ERROR_CODE,
  COVERAGE_PERIOD_OVERLAP_ERROR_CODE,
  COVERAGE_IDEMPOTENCY_CONFLICT_ERROR_CODE,
  COVERAGE_INVALID_REQUEST_ERROR_CODE,
  COVERAGE_SUPERSEDE_CONFLICT_ERROR_CODE,
  permissionScope,
} from "@yrese/shared-kernel";

import { devTenantHeaders } from '../dev-tenant';
import { resolveWebApiUrl } from '../api-transport';
import { todayAsIsoDate } from '../_reception/reception-time';
import { registeredErrorCodeOrUndefined } from '../components/error-code';
import type { PatientContextData } from '../components/patient/patient-context';
import { EmptyState } from '../components/empty-state';
import { ErrorNotice, type ErrorNoticeProps } from '../components/error-notice';
import { LoadingState } from '../components/loading-state';
import { Panel, TableScroll } from '../components/operator/operator-ui';

/**
 * 保険・公費パネル(SCR-007 / WP-7203 / API-020)。
 *
 * この画面が扱うのは「原本を確認してオペレータが記録した入力値」のみ。
 * 負担割合・公費優先度から算定額を自動計算することはない(CAL-R-024 は
 * 引き続き blocked)。訂正は supersede(新行で旧行を置換)のみで、
 * UPDATE/DELETE 相当の操作経路は存在しない。
 */

const COVERAGE_READ_SCOPES = [
  permissionScope("patient", "read"),
  permissionScope("insurance", "read"),
  permissionScope("public-expense", "read"),
] as const;

const COVERAGE_WRITE_SCOPES = [
  ...COVERAGE_READ_SCOPES,
  permissionScope("insurance", "write"),
  permissionScope("public-expense", "write"),
] as const;

const genericNotice = Object.freeze({
  message: "保険・公費情報の処理に失敗しました。",
  nextAction:
    "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
} satisfies ErrorNoticeProps);

function expectedCoverageErrorCodes(status: number): ReadonlySet<string> {
  if (status === 400) return new Set([COVERAGE_INVALID_REQUEST_ERROR_CODE]);
  if (status === 403) return new Set([AUTH_PERMISSION_DENIED_ERROR_CODE]);
  if (status === 404) return new Set([COVERAGE_PATIENT_NOT_FOUND_ERROR_CODE]);
  if (status === 409) {
    return new Set([
      COVERAGE_PERIOD_OVERLAP_ERROR_CODE,
      COVERAGE_PRIORITY_CONFLICT_ERROR_CODE,
      COVERAGE_SUPERSEDE_CONFLICT_ERROR_CODE,
      COVERAGE_IDEMPOTENCY_CONFLICT_ERROR_CODE,
    ]);
  }
  return new Set();
}

async function extractCoverageErrorCode(
  res: Response,
): Promise<string | undefined> {
  try {
    const body: unknown = await res.json();
    if (typeof body !== "object" || body === null) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(body, "errorCode");
    if (descriptor === undefined || !("value" in descriptor)) return undefined;
    const registered = registeredErrorCodeOrUndefined(descriptor.value);
    if (registered === undefined) return undefined;
    return expectedCoverageErrorCodes(res.status).has(registered)
      ? registered
      : undefined;
  } catch {
    return undefined;
  }
}

function coverageErrorNotice(
  status: number,
  errorCode: string | undefined,
): ErrorNoticeProps {
  if (status === 403) {
    return {
      message: "権限がありません。",
      nextAction:
        "管理者に権限(insurance / public-expense の read・write)の付与状況を確認してください。",
      ...(errorCode !== undefined ? { errorCode } : {}),
    };
  }
  if (status === 404) {
    return {
      message: "対象の患者が見つかりません。",
      nextAction: "患者を選択し直してください。",
      ...(errorCode !== undefined ? { errorCode } : {}),
    };
  }
  if (status === 409) {
    const message =
      errorCode === COVERAGE_PERIOD_OVERLAP_ERROR_CODE
        ? "同じ期間に重複する保険証が既に登録されています。"
        : errorCode === COVERAGE_PRIORITY_CONFLICT_ERROR_CODE
          ? "同じ期間に同じ優先順位の公費が既に登録されています。"
          : errorCode === COVERAGE_SUPERSEDE_CONFLICT_ERROR_CODE
            ? "訂正対象の行が見つからないか、既に訂正済みです。"
            : "同じ操作キーで異なる内容が既に送信されています。";
    return {
      message,
      nextAction:
        "登録済みの内容を確認してください。誤りの訂正は既存行の「訂正」から行います。",
      ...(errorCode !== undefined ? { errorCode } : {}),
    };
  }
  if (status === 400) {
    return {
      message: "入力内容が不正です。",
      nextAction: "入力項目・基準日を確認して再度実行してください。",
      ...(errorCode !== undefined ? { errorCode } : {}),
    };
  }
  return {
    message: `処理に失敗しました(HTTP ${status})。`,
    nextAction:
      "再試行してください。解消しない場合はシステム管理者へ連絡してください。",
    ...(errorCode !== undefined ? { errorCode } : {}),
  };
}

export async function fetchCoverage(
  targetPatientId: string,
  asOf: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<CoverageListResponse> {
  const url = resolveWebApiUrl(
    `/patients/${encodeURIComponent(targetPatientId)}/coverage?asOf=${encodeURIComponent(asOf)}`,
  );
  const res = await fetchImpl(url, {
    headers: devTenantHeaders(COVERAGE_READ_SCOPES),
    cache: "no-store",
    ...(signal === undefined ? {} : { signal }),
  });
  if (!res.ok) {
    const errorCode = await extractCoverageErrorCode(res);
    throw new CoverageRequestError(
      coverageErrorNotice(res.status, errorCode),
      res.status,
    );
  }
  return coverageListResponseSchema.parse(await res.json());
}

export async function recordCoverage(
  targetPatientId: string,
  request: CoverageRecordRequest,
  idempotencyKey: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<{ readonly status: number; readonly body: unknown }> {
  const url = resolveWebApiUrl(
    `/patients/${encodeURIComponent(targetPatientId)}/coverage`,
  );
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      ...devTenantHeaders(COVERAGE_WRITE_SCOPES),
    },
    body: JSON.stringify(request),
    ...(signal === undefined ? {} : { signal }),
  });
  if (!res.ok) {
    const errorCode = await extractCoverageErrorCode(res);
    throw new CoverageRequestError(
      coverageErrorNotice(res.status, errorCode),
      res.status,
    );
  }
  return { status: res.status, body: await res.json() };
}

export class CoverageRequestError extends Error {
  constructor(
    readonly notice: ErrorNoticeProps,
    readonly status?: number,
  ) {
    super(notice.message);
    this.name = "CoverageRequestError";
  }
}

/**
 * サーバーが確定的に拒否した応答(記録なし)は「結果確定」として冪等キーを
 * 退役できる。応答なし・ネットワーク失敗・5xx・応答形式違反は結果不明であり、
 * キーを保持して再試行がサーバー側の同一記録へ収束するようにする
 * (reception-registration の keyStore 規約と同じ)。
 */
function isSettledCoverageFailure(error: unknown): boolean {
  return (
    error instanceof CoverageRequestError &&
    error.status !== undefined &&
    error.status < 500
  );
}

const RELATIONSHIP_LABELS: Readonly<Record<InsuranceCard["relationship"], string>> = {
  self: "本人",
  family: "家族",
};

type CoverageViewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; notice: ErrorNoticeProps }
  | { kind: "loaded"; data: CoverageListResponse };

type FormMode =
  | { kind: "insurance-card" }
  | { kind: "public-expense" }
  | {
      kind: "supersede";
      targetKind: "insurance-card" | "public-expense";
      targetId: string;
    };

/** 保険・公費の読取・記録の応答待ち上限(reception 系と同じ既存上限)。 */
const COVERAGE_REQUEST_TIMEOUT_MS = 30_000;

export type CoverageSubmitState =
  | { readonly kind: "idle" }
  | { readonly kind: "submitting" }
  | { readonly kind: "error"; readonly notice: ErrorNoticeProps };

/**
 * PatientCoveragePanel の非 React 状態機械。
 * createSearchRunner と同じく fetch 差込み・emit 経由にして、reload の
 * stale 応答抑止・冪等キー寿命・二重送信防止を component なしで検証する。
 */
export function createCoverageController(options: {
  readonly patientId: string;
  readonly emitView: (view: CoverageViewState) => void;
  readonly emitSubmit: (state: CoverageSubmitState) => void;
  readonly getAsOf: () => string;
  readonly onRecorded?: () => void;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
  readonly makeIdempotencyKey?: () => string;
}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? COVERAGE_REQUEST_TIMEOUT_MS;
  const makeIdempotencyKey =
    options.makeIdempotencyKey ?? (() => `web-coverage-${crypto.randomUUID()}`);

  // 連続 reload の stale 応答が新しい基準日の表示を上書きしないよう、
  // 世代番号 + AbortController で直近の要求だけを有効化する。
  let generation = 0;
  let loadAbort: AbortController | null = null;
  // emit(setState 相当)は同 tick 内の再呼出を即座に反映しないため、
  // 同期再入防止は通常変数で行う。
  let submitting = false;
  // 未解決の登録意図を表す冪等キー。内容が変われば別の意図(別キー)であり、
  // 結果確定(成功/4xx)まで同じ内容の再試行は同じキーを再利用する
  // (reception-registration の keyStore 規約と同じ)。
  let submission: { content: string; key: string } | null = null;

  const reload = (nextAsOf: string) => {
    loadAbort?.abort();
    const controller = new AbortController();
    loadAbort = controller;
    generation += 1;
    const current = generation;
    options.emitView({ kind: "loading" });
    void fetchCoverage(
      options.patientId,
      nextAsOf,
      fetchImpl,
      AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]),
    )
      .then((data) => {
        if (current === generation) {
          options.emitView({ kind: "loaded", data });
        }
      })
      .catch((error: unknown) => {
        if (current !== generation) return;
        options.emitView({
          kind: "error",
          notice:
            error instanceof CoverageRequestError ? error.notice : genericNotice,
        });
      });
  };

  const submit = (request: CoverageRecordRequest) => {
    if (submitting) return;
    submitting = true;
    const content = JSON.stringify(request);
    if (submission?.content !== content) {
      submission = { content, key: makeIdempotencyKey() };
    }
    const { key } = submission;
    options.emitSubmit({ kind: "submitting" });
    void recordCoverage(
      options.patientId,
      request,
      key,
      fetchImpl,
      AbortSignal.timeout(timeoutMs),
    )
      .then(() => {
        submission = null;
        submitting = false;
        options.emitSubmit({ kind: "idle" });
        options.onRecorded?.();
        reload(options.getAsOf());
      })
      .catch((error: unknown) => {
        if (isSettledCoverageFailure(error)) {
          submission = null;
        }
        submitting = false;
        options.emitSubmit({
          kind: "error",
          notice:
            error instanceof CoverageRequestError ? error.notice : genericNotice,
        });
      });
  };

  const dispose = () => {
    loadAbort?.abort();
    generation += 1;
  };

  return { reload, submit, dispose };
}

export function PatientCoveragePanel({
  patient,
}: {
  readonly patient: PatientContextData;
}) {
  const [asOf, setAsOf] = useState(todayAsIsoDate());
  const [view, setView] = useState<CoverageViewState>({ kind: "idle" });
  const [formMode, setFormMode] = useState<FormMode>({ kind: "insurance-card" });
  const [submitState, setSubmitState] = useState<CoverageSubmitState>({ kind: "idle" });

  const asOfRef = useRef(asOf);
  asOfRef.current = asOf;
  const controllerRef = useRef<ReturnType<typeof createCoverageController> | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createCoverageController({
      patientId: patient.patientId,
      emitView: setView,
      emitSubmit: setSubmitState,
      getAsOf: () => asOfRef.current,
      onRecorded: () => setFormMode({ kind: "insurance-card" }),
    });
  }
  useEffect(() => () => controllerRef.current?.dispose(), []);

  const { reload, submit } = controllerRef.current;

  const cards: readonly InsuranceCard[] =
    view.kind === "loaded" ? view.data.insuranceCards : [];
  const expenses: readonly PublicExpense[] =
    view.kind === "loaded" ? view.data.publicExpenses : [];

  return (
    <Panel
      title="保険・公費(SCR-007)"
      description="原本を確認して記録した入力値の履歴です。負担割合・公費優先度は記録値であり、算定額の自動計算には使用されません。訂正は対象行の「訂正」から新しい行で置き換えます(過去行の更新・削除はできません)。"
    >
      <form
        className="coverage-view-form"
        onSubmit={(e) => {
          e.preventDefault();
          reload(asOf);
        }}
      >
        <label htmlFor="coverage-as-of">基準日(asOf・必須)</label>
        <div className="patient-search-row">
          <input
            id="coverage-as-of"
            type="date"
            required
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
          />
          <button type="submit" disabled={view.kind === "loading"}>
            {view.kind === "loading" ? "読込中…" : "基準日時点の資格を表示"}
          </button>
        </div>
      </form>

      {view.kind === "idle" && (
        <EmptyState message="基準日を指定して「表示」を実行するまで資格情報は表示しません。表示されるのは記録済みの入力値のみです。" />
      )}
      {view.kind === "loading" && <LoadingState label="資格情報を読込中…" />}
      {view.kind === "error" && <ErrorNotice {...view.notice} />}
      {view.kind === "loaded" && (
        <>
          <p role="status">
            {view.data.asOf} 時点: 保険証 {cards.length}件 / 公費 {expenses.length}件
          </p>
          {cards.length === 0 && expenses.length === 0 && (
            <EmptyState message="基準日時点で有効な記録は0件です。この0件は取得できた結果であり、未接続を意味しません。" />
          )}
          {cards.length > 0 && (
            <TableScroll label="保険証一覧。横方向にスクロールできます">
              <table className="coverage-cards">
                <thead>
                  <tr>
                    <th scope="col">保険者番号</th>
                    <th scope="col">記号</th>
                    <th scope="col">番号</th>
                    <th scope="col">続柄</th>
                    <th scope="col">負担割合(記録値)</th>
                    <th scope="col">有効期間</th>
                    <th scope="col">状態</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((card) => (
                    <tr key={card.insuranceCardId}>
                      <td>{card.insurerNumber}</td>
                      <td>{card.insuredSymbol}</td>
                      <td>{card.insuredNumber}</td>
                      <td>{RELATIONSHIP_LABELS[card.relationship]}</td>
                      {/* 記録値を変換せず表示(0.3→0.3)。算定には不使用。 */}
                      <td>{card.copayRatio}</td>
                      <td>
                        {card.validFrom} 〜 {card.validTo ?? "(終了日なし)"}
                      </td>
                      <td>
                        {card.supersededBy !== null ? "訂正済み" : "有効"}
                      </td>
                      <td>
                        {card.supersededBy === null && (
                          <button
                            type="button"
                            className="operator-button"
                            onClick={() =>
                              setFormMode({
                                kind: "supersede",
                                targetKind: "insurance-card",
                                targetId: card.insuranceCardId,
                              })
                            }
                          >
                            訂正
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
          {expenses.length > 0 && (
            <TableScroll label="公費一覧。横方向にスクロールできます">
              <table className="coverage-expenses">
                <thead>
                  <tr>
                    <th scope="col">支払者番号</th>
                    <th scope="col">受給者番号</th>
                    <th scope="col">優先順位</th>
                    <th scope="col">有効期間</th>
                    <th scope="col">状態</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.publicExpenseId}>
                      <td>{expense.payerNumber}</td>
                      <td>{expense.recipientNumber}</td>
                      <td>{expense.priority}</td>
                      <td>
                        {expense.validFrom} 〜{" "}
                        {expense.validTo ?? "(終了日なし)"}
                      </td>
                      <td>
                        {expense.supersededBy !== null ? "訂正済み" : "有効"}
                      </td>
                      <td>
                        {expense.supersededBy === null && (
                          <button
                            type="button"
                            className="operator-button"
                            onClick={() =>
                              setFormMode({
                                kind: "supersede",
                                targetKind: "public-expense",
                                targetId: expense.publicExpenseId,
                              })
                            }
                          >
                            訂正
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </>
      )}

      <CoverageRecordForm
        mode={formMode}
        submitting={submitState.kind === "submitting"}
        onModeChange={setFormMode}
        onSubmit={submit}
      />
      {submitState.kind === "error" && <ErrorNotice {...submitState.notice} />}
    </Panel>
  );
}

function CoverageRecordForm({
  mode,
  submitting,
  onModeChange,
  onSubmit,
}: {
  readonly mode: FormMode;
  readonly submitting: boolean;
  readonly onModeChange: (mode: FormMode) => void;
  readonly onSubmit: (request: CoverageRecordRequest) => void;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [validationNotice, setValidationNotice] = useState<ErrorNoticeProps | null>(null);

  const field = (name: string) => fields[name] ?? "";
  const setField = (name: string, value: string) =>
    setFields((prev) => ({ ...prev, [name]: value }));

  const isSupersede = mode.kind === "supersede";
  const effectiveKind =
    mode.kind === "supersede" ? mode.targetKind : mode.kind;

  const buildRequest = (): CoverageRecordRequest | undefined => {
    const base =
      effectiveKind === "insurance-card"
        ? {
            insurerNumber: field("insurerNumber"),
            insuredSymbol: field("insuredSymbol"),
            insuredNumber: field("insuredNumber"),
            relationship: field("relationship") || "self",
            copayRatio: Number(field("copayRatio")),
            validFrom: field("validFrom"),
            ...(field("validTo") !== "" ? { validTo: field("validTo") } : {}),
          }
        : {
            payerNumber: field("payerNumber"),
            recipientNumber: field("recipientNumber"),
            priority: Number(field("priority")),
            validFrom: field("validFrom"),
            ...(field("validTo") !== "" ? { validTo: field("validTo") } : {}),
          };
    const candidate =
      mode.kind === "supersede"
        ? { kind: "supersede", targetKind: mode.targetKind, targetId: mode.targetId, ...base }
        : { kind: mode.kind, ...base };
    const parsed = coverageRecordRequestSchema.safeParse(candidate);
    return parsed.success ? parsed.data : undefined;
  };

  return (
    <form
      className="coverage-record-form"
      onSubmit={(e) => {
        e.preventDefault();
        const request = buildRequest();
        if (request === undefined) {
          setValidationNotice({
            message: "資格情報の入力内容が不正です。",
            nextAction:
              "必須項目と日付(YYYY-MM-DD)・数値欄の入力を確認してください。",
          });
          return;
        }
        setValidationNotice(null);
        onSubmit(request);
      }}
    >
      {validationNotice !== null && <ErrorNotice {...validationNotice} />}
      <fieldset>
        <legend>
          {isSupersede ? "資格情報の訂正(新しい行で置き換え)" : "資格情報の登録"}
        </legend>
        {!isSupersede && (
          <div className="coverage-kind-row" role="group" aria-label="登録種別">
            <label>
              <input
                type="radio"
                name="coverage-kind"
                checked={mode.kind === "insurance-card"}
                onChange={() => onModeChange({ kind: "insurance-card" })}
              />
              保険証
            </label>
            <label>
              <input
                type="radio"
                name="coverage-kind"
                checked={mode.kind === "public-expense"}
                onChange={() => onModeChange({ kind: "public-expense" })}
              />
              公費
            </label>
          </div>
        )}
        {isSupersede && (
          <p className="operator-empty-copy">
            訂正対象:{" "}
            {mode.targetKind === "insurance-card" ? "保険証" : "公費"}(
            {mode.targetId})。元の行は「訂正済み」として履歴に残ります。
            <button
              type="button"
              className="operator-text-action"
              onClick={() => onModeChange({ kind: "insurance-card" })}
            >
              訂正を中止
            </button>
          </p>
        )}

        {effectiveKind === "insurance-card" ? (
          <div className="coverage-fields">
            <label>
              保険者番号
              <input
                required
                maxLength={8}
                value={field("insurerNumber")}
                onChange={(e) => setField("insurerNumber", e.target.value)}
              />
            </label>
            <label>
              被保険者記号
              <input
                required
                value={field("insuredSymbol")}
                onChange={(e) => setField("insuredSymbol", e.target.value)}
              />
            </label>
            <label>
              被保険者番号
              <input
                required
                value={field("insuredNumber")}
                onChange={(e) => setField("insuredNumber", e.target.value)}
              />
            </label>
            <label>
              続柄
              <select
                value={field("relationship") || "self"}
                onChange={(e) => setField("relationship", e.target.value)}
              >
                <option value="self">本人</option>
                <option value="family">家族</option>
              </select>
            </label>
            <label>
              負担割合(原本の記載どおり・算定には不使用)
              <select
                required
                value={field("copayRatio")}
                onChange={(e) => setField("copayRatio", e.target.value)}
              >
                <option value="">選択してください</option>
                <option value="0.1">1割</option>
                <option value="0.2">2割</option>
                <option value="0.3">3割</option>
              </select>
            </label>
          </div>
        ) : (
          <div className="coverage-fields">
            <label>
              公費負担者番号
              <input
                required
                value={field("payerNumber")}
                onChange={(e) => setField("payerNumber", e.target.value)}
              />
            </label>
            <label>
              受給者番号
              <input
                required
                value={field("recipientNumber")}
                onChange={(e) => setField("recipientNumber", e.target.value)}
              />
            </label>
            <label>
              優先順位(原本の記載どおり)
              <input
                required
                type="number"
                min={1}
                step={1}
                value={field("priority")}
                onChange={(e) => setField("priority", e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="coverage-fields">
          <label>
            有効開始日
            <input
              required
              type="date"
              value={field("validFrom")}
              onChange={(e) => setField("validFrom", e.target.value)}
            />
          </label>
          <label>
            有効終了日(任意・未設定は無期限)
            <input
              type="date"
              value={field("validTo")}
              onChange={(e) => setField("validTo", e.target.value)}
            />
          </label>
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? "登録中…" : isSupersede ? "訂正を登録" : "登録"}
        </button>
      </fieldset>
    </form>
  );
}
