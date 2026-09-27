"use client";

import { ConfirmationDialog } from "../components/confirmation-dialog";
import { DEV_STUB_ACTOR_ID } from "../dev-tenant";

import type { PrescriptionDraftSnapshot } from "./prescription-draft";
import {
  type PrescriptionDraftChangeKind,
  serverDraftDivergenceCopy,
  summarizePrescriptionDraftChanges,
} from "./prescription-workspace-state";

export function PrescriptionDraftChangeSummary({
  kind,
  draft,
  baseline,
  serverVersion,
}: {
  readonly kind: PrescriptionDraftChangeKind;
  readonly draft: PrescriptionDraftSnapshot;
  readonly baseline: PrescriptionDraftSnapshot;
  readonly serverVersion: number;
}) {
  const labels = summarizePrescriptionDraftChanges(draft, baseline);
  const copy = serverDraftDivergenceCopy(serverVersion);
  return (
    <div role="group" aria-label="処方下書きの変更項目">
      <p>
        {kind === "save-conflict"
          ? `このタブの未保存入力と、${copy.conflictBaseline}の間で変更された項目です。競合相手の最新内容はまだ取得していません。`
          : `復元したタブ内入力と、${copy.restoredBaseline}の間で変更された項目です。`}
        変更値は表示しません。
      </p>
      <ul>
        {labels.length === 0 ? (
          <li>変更項目を特定できません</li>
        ) : (
          labels.map((label) => <li key={label}>{label}</li>)
        )}
      </ul>
    </div>
  );
}

export function PrescriptionLifecycleDialog(props: {
  readonly target: "confirm" | "finalize";
  readonly patientLabel: string;
  readonly onConfirm?: () => void;
  readonly onCancel?: () => void;
}) {
  const isConfirm = props.target === "confirm";
  return (
    <ConfirmationDialog
      open
      title={isConfirm ? "薬剤師確認を記録しますか" : "処方を確定しますか"}
      patientLabel={props.patientLabel}
      message={
        isConfirm
          ? "薬剤師として、表示された処方内容・原本情報・コード解決状態を確認したうえで確認済みとして記録します。この操作は監査証跡に残り、取り消せません。確認後は下書きを編集できなくなります。"
          : "確定するとこの処方は不変の版(v1)として固定され、以後いかなる編集もできません。確定内容は監査証跡に残り、取り消せません。"
      }
      confirmLabel={isConfirm ? "確認済みとして記録" : "確定する"}
      {...(props.onConfirm !== undefined
        ? { onConfirm: props.onConfirm }
        : {})}
      {...(props.onCancel !== undefined
        ? { onCancel: props.onCancel }
        : {})}
    >
      <p className="rail-muted">
        {process.env.NODE_ENV === "development"
          ? `実行 actor: ${DEV_STUB_ACTOR_ID}（開発スタブ）`
          : "実行 actor: 認証コンテキストの操作者として記録"}
      </p>
    </ConfirmationDialog>
  );
}

