import type { ReactNode } from "react";

import { Panel } from "../components/operator-ui";

interface WorkflowStep {
  readonly number: number;
  readonly label: string;
  readonly status: string;
  readonly state: "complete" | "current" | "future";
}

const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  {
    number: 1,
    label: "受付・患者確認",
    status: "完了",
    state: "complete",
  },
  {
    number: 2,
    label: "下書き入力・保存",
    status: "接続済み",
    state: "current",
  },
  {
    number: 3,
    label: "臨床確認",
    status: "未接続",
    state: "future",
  },
  {
    number: 4,
    label: "薬剤師確認",
    status: "未接続",
    state: "future",
  },
  {
    number: 5,
    label: "確定・算定",
    status: "未接続",
    state: "future",
  },
] as const;

function CurrentStepAttributes({
  state,
  children,
}: {
  readonly state: WorkflowStep["state"];
  readonly children: ReactNode;
}) {
  return state === "current" ? (
    <span aria-current="step">{children}</span>
  ) : (
    <>{children}</>
  );
}

/**
 * Operator-facing capability map. It separates a persisted draft from later clinical,
 * professional-confirmation, and calculation stages so save success cannot be read as finality.
 */
export function PrescriptionWorkflowProgress() {
  return (
    <Panel
      title="処方業務の現在地"
      description="接続済み工程と、従来手順を継続する未接続工程を分けて表示します。"
    >
      <ol className="closing-stepper" aria-label="処方業務の接続状況">
        {WORKFLOW_STEPS.map((step) => (
          <li
            key={step.number}
            data-step={step.number}
            data-state={step.state}
          >
            <CurrentStepAttributes state={step.state}>
              <strong>{step.label}</strong>
            </CurrentStepAttributes>
            <small>{step.status}</small>
          </li>
        ))}
      </ol>
      <p className="placeholder-note">
        下書き保存は処方内容の安全確認、薬剤師による確認、確定処方、算定完了を意味しません。
      </p>
    </Panel>
  );
}
