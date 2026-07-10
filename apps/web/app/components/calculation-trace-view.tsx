import type {
  CalculationInputsSummaryWire,
  CalculationTraceStepWire,
  CalculationTraceWire,
  EvidenceRefWire,
} from "@yrese/contracts";

import { SeverityList, type SeverityItem } from "./severity-list";

/**
 * calculation_trace ビューア基盤(SCR-012 / WP-3011a / QUA-007 L2 初UI)。
 *
 * 契約 API-007 の読取表現(@yrese/contracts calculationTraceSchema)を **表示のみ** で提示する。
 * 「なぜこの点数か」を evidenceRef 付きで再構成する L2「過程の証明」の初 UI。
 *
 * fail-closed 表示規律(API-007 §5-§7):
 * - 請求影響ステップ(affectsClaim=true)に evidenceRef が無い場合、正当な確定根拠として表示しない。
 * - rounding があって evidenceId を欠く場合は異常として明示する。
 * - 未知の sourceType / stepStatus は「不明」にフォールバックし、既定で「適用済み・正当」に見せない。
 * - trace 本文以外の PHI(患者氏名等)を合成しない。evidence の外部リンク化・URL 表示はしない。
 */

type SourceType = EvidenceRefWire["sourceType"];
type StepStatus = NonNullable<CalculationTraceStepWire["stepStatus"]>;

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  law: "法令",
  notification: "告示・通知",
  official_spec: "公式仕様",
  master: "マスター",
  guideline: "ガイドライン",
  jahis: "JAHIS",
  internal_ssot: "内部SSOT",
};

const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  applied: "適用",
  suggested: "候補",
  excluded: "除外",
  blocked: "停止",
};

/** allow-list ラベル解決。未知値は「不明」に落とし、正当ラベルへ既定フォールバックしない(§7)。 */
function labelFor<T extends string>(labels: Record<T, string>, value: string, kind: string): string {
  const known = (labels as Record<string, string | undefined>)[value];
  return known ?? `不明な${kind}(${value})`;
}

function hasEvidenceGap(step: CalculationTraceStepWire): boolean {
  return step.affectsClaim && step.evidenceRefs.length === 0;
}

function hasRoundingGap(step: CalculationTraceStepWire): boolean {
  return step.rounding !== undefined && step.rounding.evidenceId.trim().length === 0;
}

function EvidenceRefItem({ evidenceRef }: { readonly evidenceRef: EvidenceRefWire }) {
  return (
    <li className="calc-trace-evidence" data-evidence-id={evidenceRef.evidenceId}>
      <span className="calc-trace-evidence-id">{evidenceRef.evidenceId}</span>
      <span className="calc-trace-evidence-source">
        [{labelFor(SOURCE_TYPE_LABELS, evidenceRef.sourceType, "根拠種別")}]
      </span>
      {/* evidence の title は plain text。外部リンク化・URL 表示はしない(§5) */}
      <span className="calc-trace-evidence-title">{evidenceRef.title}</span>
      {evidenceRef.version !== undefined ? (
        <span className="calc-trace-evidence-version">版: {evidenceRef.version}</span>
      ) : null}
    </li>
  );
}

function InputsSummaryView({ summary }: { readonly summary: CalculationInputsSummaryWire }) {
  return (
    <dl className="calc-trace-inputs">
      <dt>ID 参照</dt>
      <dd>
        <ul role="list">
          {summary.ids.map((ref, index) => (
            <li key={`${ref.kind}-${index}`} data-id-kind={ref.kind}>
              {ref.kind}: {ref.id}
            </li>
          ))}
        </ul>
      </dd>
      <dt>診療系日付</dt>
      <dd>
        <ul role="list">
          {summary.dates.map((ref, index) => (
            <li key={`${ref.kind}-${index}`} data-date-kind={ref.kind}>
              {ref.kind}: {ref.value}
            </li>
          ))}
        </ul>
      </dd>
      <dt>マスター版</dt>
      <dd>
        <ul role="list">
          {summary.masterVersions.map((ref, index) => (
            <li key={`${ref.masterName}-${index}`}>
              {ref.masterName}: {ref.version}
            </li>
          ))}
        </ul>
      </dd>
      {summary.ruleVersions !== undefined && summary.ruleVersions.length > 0 ? (
        <>
          <dt>ルール版</dt>
          <dd>
            <ul role="list">
              {summary.ruleVersions.map((ref, index) => (
                <li key={`${ref.ruleName}-${index}`}>
                  {ref.ruleName}: {ref.version}
                </li>
              ))}
            </ul>
          </dd>
        </>
      ) : null}
    </dl>
  );
}

function StepView({ step }: { readonly step: CalculationTraceStepWire }) {
  const evidenceGap = hasEvidenceGap(step);
  const roundingGap = hasRoundingGap(step);
  const anomalous = evidenceGap || roundingGap;
  const statusLabel =
    step.stepStatus === undefined ? "—" : labelFor(STEP_STATUS_LABELS, step.stepStatus, "ステップ状態");
  const showRounding = step.rounding !== undefined && step.rounding.evidenceId.trim().length > 0;
  const intermediateEntries =
    step.intermediateValues === undefined ? [] : Object.entries(step.intermediateValues);

  return (
    <li
      className="calc-trace-step"
      data-step-id={step.stepId}
      data-affects-claim={step.affectsClaim}
      data-anomalous={anomalous}
    >
      <p className="calc-trace-step-head">
        <span className="calc-trace-step-status" data-step-status={step.stepStatus ?? ""}>
          [{statusLabel}]
        </span>
        <span className="calc-trace-step-id">{step.stepId}</span>
      </p>
      <p className="calc-trace-step-description">{step.description}</p>
      <p className="calc-trace-step-output">{step.output}</p>
      {step.feeItemCode !== undefined ? (
        <p className="calc-trace-step-fee-item">算定項目コード: {step.feeItemCode}</p>
      ) : null}
      <p className="calc-trace-step-affects-claim">
        {step.affectsClaim ? "請求に影響します" : "請求には影響しません"}
      </p>

      {anomalous ? (
        <div className="calc-trace-step-anomaly" role="alert" data-anomaly="true">
          {evidenceGap ? (
            <p>異常: 請求に影響するステップに根拠(evidenceRef)がありません。正当な確定根拠として表示しません。</p>
          ) : null}
          {roundingGap ? <p>異常: 丸め処理に根拠(evidenceId)がありません。</p> : null}
        </div>
      ) : null}

      {step.inputRefs.length > 0 ? (
        <p className="calc-trace-step-input-refs">入力参照: {step.inputRefs.join(", ")}</p>
      ) : null}
      {step.formula !== undefined ? (
        <p className="calc-trace-step-formula">計算式: {step.formula}</p>
      ) : null}
      {intermediateEntries.length > 0 ? (
        <dl className="calc-trace-step-intermediate">
          {intermediateEntries.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/* 有効な根拠は異常種別に関わらず提示する(請求影響かつ根拠空の場合のみ非提示 = §7) */}
      {step.evidenceRefs.length > 0 ? (
        <ul className="calc-trace-step-evidence" role="list">
          {step.evidenceRefs.map((evidenceRef, refIndex) => (
            <EvidenceRefItem key={`${evidenceRef.evidenceId}-${refIndex}`} evidenceRef={evidenceRef} />
          ))}
        </ul>
      ) : null}

      {showRounding ? (
        <p className="calc-trace-step-rounding">
          丸め: {step.rounding?.method}(根拠: {step.rounding?.evidenceId})
        </p>
      ) : null}
      {step.resultPoints !== undefined ? (
        <p className="calc-trace-step-result-points">点数: {step.resultPoints}</p>
      ) : null}
      {step.resultYen !== undefined ? (
        <p className="calc-trace-step-result-yen">金額: {step.resultYen}円</p>
      ) : null}
    </li>
  );
}

export function CalculationTraceView({ trace }: { readonly trace: CalculationTraceWire }) {
  const warningItems: readonly SeverityItem[] = trace.warnings.map((message) => ({
    severity: "WARNING",
    message,
  }));
  const unconfirmed = trace.blockers.length > 0;

  return (
    <section className="calculation-trace" aria-label="算定根拠(calculation_trace)">
      <header className="calc-trace-header">
        <p className="calc-trace-version" data-master-version={trace.masterVersion}>
          マスター版: {trace.masterVersion}
        </p>
        <p className="calc-trace-rule-version" data-rule-version={trace.calculationRuleVersion}>
          算定ルール版: {trace.calculationRuleVersion}
        </p>
      </header>

      {unconfirmed ? (
        <div className="calc-trace-blockers" role="alert" data-unconfirmed="true">
          <p className="calc-trace-blockers-title">算定は未確定です(停止理由あり)</p>
          <ul role="list">
            {trace.blockers.map((blocker, index) => (
              <li key={`${blocker}-${index}`} data-blocker={blocker}>
                {blocker}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {warningItems.length > 0 ? <SeverityList items={warningItems} /> : null}

      <InputsSummaryView summary={trace.inputsSummary} />

      {trace.steps.length === 0 ? (
        <p className="calc-trace-empty">導出ステップはありません。</p>
      ) : (
        <ol className="calc-trace-steps">
          {trace.steps.map((step, index) => (
            <StepView key={`${step.stepId}-${index}`} step={step} />
          ))}
        </ol>
      )}

      <footer className="calc-trace-evidence-ids">
        <p>根拠 evidence_id 一覧:</p>
        <ul role="list">
          {trace.evidenceIds.map((evidenceId, index) => (
            <li key={`${evidenceId}-${index}`}>{evidenceId}</li>
          ))}
        </ul>
      </footer>
    </section>
  );
}
