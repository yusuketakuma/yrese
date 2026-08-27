"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  PrescriptionDraftResponse,
  ReceptionQueueEntry,
  ReceptionQueueResponse,
} from "@yrese/contracts";
import { patientId } from "@yrese/shared-kernel";

import { DomainStatusBadge } from "../components/domain-status-badge";
import { EmptyState } from "../components/empty-state";
import { ErrorNotice, type ErrorNoticeProps } from "../components/error-notice";
import { LoadingState } from "../components/loading-state";
import {
  useOptionalPatientContext,
  type PatientContextData,
} from "../components/patient-context";
import { PatientHeader, computeAgeYears } from "../components/patient-header";
import { SeverityList } from "../components/severity-list";
import {
  InlineNotice,
  KeyValueList,
  OperatorPage,
  Panel,
  RailCard,
  ScreenHeader,
  StatusPill,
} from "../components/operator-ui";
import {
  ReceptionError,
  fetchReceptionQueue,
  formatAcceptedTime,
} from "../reception-dashboard";
import { ReceptionPrescriptionHandoffAction } from "../reception-prescription-handoff";
import { loadPrescriptionDraft } from "./prescription-draft-persistence";
import {
  type PrescriptionLaunchContext,
  validateReceptionLaunchEntry,
} from "./prescription-launch-context";

/** 画面見出し。/prescriptions の凍結見出しとは別 route であり、名称を共有しない。 */
const SCREEN_TITLE = "受付スコープ処方入力";

/**
 * 下書きの取得結果。
 * 204(未保存)と取得失敗を同じ表示へ畳まない — 「空欄」を「処方なし」と読ませないため。
 */
export type DraftOutcome =
  | { readonly kind: "unsaved" }
  | { readonly kind: "saved"; readonly draft: PrescriptionDraftResponse }
  | { readonly kind: "unavailable" };

type ReceptionContextLoadState =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly requestKey: string;
      readonly entry: ReceptionQueueEntry;
      readonly draft: DraftOutcome;
    }
  | {
      readonly status: "error";
      readonly requestKey: string;
      readonly notice: ErrorNoticeProps;
    };

const GENERIC_RECEPTION_CONTEXT_ERROR = Object.freeze({
  message: "受付コンテキストを確認できませんでした。",
  nextAction:
    "受付ダッシュボードから該当の受付を選び直してください。解消しない場合は同期状態を確認してください。",
} satisfies ErrorNoticeProps);

/**
 * 「キューに存在しない(取消・別業務日・他薬局スコープ)」と「患者が一致しない」を
 * 同一文言で返す。受付の存在有無を URL の打ち替えから推測させないため(存在非開示)。
 */
const UNKNOWN_RECEPTION_ERROR = Object.freeze({
  message:
    "指定された受付を、現在の薬局・業務日・選択患者では確認できませんでした。",
  nextAction:
    "受付ダッシュボードから該当の受付を選び直してください。URLの受付IDを手入力しないでください。患者が異なる可能性があるため、カナ・生年月日も再確認してください。",
} satisfies ErrorNoticeProps);

function noticeFromError(error: unknown): ErrorNoticeProps {
  return error instanceof ReceptionError
    ? error.toNotice()
    : GENERIC_RECEPTION_CONTEXT_ERROR;
}

function toDraftOutcome(
  result: PromiseSettledResult<PrescriptionDraftResponse | null>,
): DraftOutcome {
  if (result.status === "rejected") return { kind: "unavailable" };
  return result.value === null
    ? { kind: "unsaved" }
    : { kind: "saved", draft: result.value };
}

export type LaunchOutcome =
  | {
      readonly status: "ready";
      readonly entry: ReceptionQueueEntry;
      readonly draft: DraftOutcome;
    }
  | { readonly status: "error"; readonly notice: ErrorNoticeProps };

/**
 * 受付キュー照合と下書き取得の結果から次の表示状態を決める(純関数)。
 * 受付キューの失敗は画面全体を停止させ、下書きの失敗は下書き表示だけを劣化させる。
 */
export function resolveLaunchOutcome(
  queueResult: PromiseSettledResult<ReceptionQueueResponse>,
  draftResult: PromiseSettledResult<PrescriptionDraftResponse | null>,
  launch: PrescriptionLaunchContext,
  selectedPatientId: string,
): LaunchOutcome {
  if (queueResult.status === "rejected") {
    return { status: "error", notice: noticeFromError(queueResult.reason) };
  }
  const validation = validateReceptionLaunchEntry(
    queueResult.value.entries,
    launch,
    selectedPatientId,
  );
  if (validation.status !== "ready") {
    return { status: "error", notice: UNKNOWN_RECEPTION_ERROR };
  }
  return {
    status: "ready",
    entry: validation.entry,
    draft: toDraftOutcome(draftResult),
  };
}

/**
 * 全状態で共通の補助情報。停止中の能力は「何が」「どのゲートで」止まっているかを名指しする。
 * 内部トークンは必ず日本語の説明文と併記する。
 */
export function PrescriptionLaunchGateRail() {
  return (
    <>
      <RailCard title="この画面が確認できる範囲" tone="warning">
        <SeverityList
          items={[
            {
              severity: "WARNING",
              message:
                "確認できるのは、受付が認証済みtenant・薬局の受付キューに存在し、選択患者と一致することだけです。処方内容の妥当性・安全性・確定は確認していません。",
            },
          ]}
        />
      </RailCard>
      <RailCard title="臨床判断支援" tone="warning">
        <StatusPill tone="warning">未接続</StatusPill>
        <p className="rail-muted">
          相互作用・禁忌・重複投薬・用量の判定は、RB-007（SaMD該当性の人間レビュー未完了）により実装していません。アラートが表示されないことは安全確認済みを意味しません。
        </p>
      </RailCard>
      <RailCard title="検査値・アレルギー歴" tone="warning">
        <StatusPill tone="warning">未接続</StatusPill>
        <p className="rail-muted">
          検査値が表示されないことは正常を意味しません。アレルギー歴が表示されないことは該当なしを意味しません。
        </p>
      </RailCard>
      <RailCard title="算定・薬剤師確認" tone="warning">
        <p className="rail-muted">
          点数・算定条件の算定エンジンは、RB-008（調剤報酬点数表の版確認と算定ルールの承認が未了）により未接続です。薬剤師確認（SCR-014）は未実装で、下書き保存は薬剤師確認・処方確定を意味しません。
        </p>
      </RailCard>
    </>
  );
}

function DraftStatusPanel({ draft }: { readonly draft: DraftOutcome }) {
  if (draft.kind === "unavailable") {
    return (
      <Panel
        title="処方下書きの保存状態"
        description="保存状態を確認できるまで、未保存と保存済みを区別できません。"
      >
        <ErrorNotice
          severity="WARNING"
          message="処方下書きの保存状態を取得できませんでした。"
          nextAction="この受付を処方入力へ引き継いだうえで、ワークスペースで再読込してください。解消しない場合は同期状態を確認してください。"
        />
      </Panel>
    );
  }

  if (draft.kind === "unsaved") {
    return (
      <Panel
        className="live-surface-panel"
        title="処方下書きの保存状態"
        description="処方下書きAPIへ接続済みです。"
      >
        <EmptyState message="この受付の処方draftはまだ保存されていません。空欄は処方なしを意味しません。" />
      </Panel>
    );
  }

  return (
    <Panel
      className="live-surface-panel"
      title="処方下書きの保存状態"
      description="サーバー保存済みの下書きがあります。保存済みは薬剤師確認・処方確定を意味しません。"
    >
      <KeyValueList
        items={[
          { label: "サーバー保存版", value: `v${draft.draft.version}` },
          { label: "最終更新", value: draft.draft.updatedAt },
          { label: "保存済み行数", value: `${draft.draft.draft.rows.length}行` },
        ]}
      />
    </Panel>
  );
}

export function PrescriptionLaunchRoute({
  launch,
}: {
  readonly launch: PrescriptionLaunchContext;
}) {
  const patientContext = useOptionalPatientContext();
  const selectedPatient = patientContext?.patient ?? null;
  const [state, setState] = useState<ReceptionContextLoadState>({
    status: "loading",
  });

  const selectedPatientId = selectedPatient?.patientId;
  const requestKey = JSON.stringify([
    launch.receptionId,
    launch.businessDate,
    selectedPatientId ?? null,
  ]);

  useEffect(() => {
    if (selectedPatientId === undefined) {
      setState({ status: "loading" });
      return;
    }

    const controller = new AbortController();
    let current = true;
    setState({ status: "loading" });

    // 受付キュー照合と下書き保存状態は独立に扱う(片方の失敗が他方を汚染しない)。
    void Promise.allSettled([
      fetchReceptionQueue(launch.businessDate, fetch, controller.signal),
      loadPrescriptionDraft(
        {
          receptionId: launch.receptionId,
          patientId: selectedPatientId,
          businessDate: launch.businessDate,
        },
        fetch,
        controller.signal,
      ),
    ]).then(([queueResult, draftResult]) => {
      if (!current || controller.signal.aborted) return;
      const outcome = resolveLaunchOutcome(
        queueResult,
        draftResult,
        launch,
        selectedPatientId,
      );
      setState(
        outcome.status === "ready"
          ? {
              status: "ready",
              requestKey,
              entry: outcome.entry,
              draft: outcome.draft,
            }
          : { status: "error", requestKey, notice: outcome.notice },
      );
    });

    return () => {
      current = false;
      controller.abort();
    };
  }, [launch, requestKey, selectedPatientId]);

  if (selectedPatient === null) {
    return (
      <OperatorPage
        rail={<PrescriptionLaunchGateRail />}
        railLabel="処方入力の前提と安全情報"
      >
        <ScreenHeader
          title={SCREEN_TITLE}
          eyebrow="SCR-004 受付スコープ"
          description="受付IDで指定した受付から処方入力を開始します。患者を選択するまで入力は開始しません。"
          meta={<StatusPill tone="warning">患者未選択・開始不可</StatusPill>}
        />
        <section aria-label="処方入力開始条件">
          <Panel
            title="患者が選択されていません"
            description="URLの受付IDだけでは患者を特定しません。"
          >
            <ErrorNotice
              severity="WARNING"
              message="受付に対応する患者が選択されていません。"
              nextAction="患者検索で対象患者を選択し、カナ・生年月日を確認してから同じ受付を開いてください。"
            />
            <p>
              <Link className="operator-button" href="/patients">
                患者検索を開く
              </Link>
            </p>
          </Panel>
        </section>
      </OperatorPage>
    );
  }

  if (state.status === "loading" || state.requestKey !== requestKey) {
    return (
      <OperatorPage
        rail={<PrescriptionLaunchGateRail />}
        railLabel="処方入力の前提と安全情報"
      >
        <ScreenHeader
          title={SCREEN_TITLE}
          eyebrow="SCR-004 受付スコープ"
          description="受付キューと選択患者の対応を照合しています。"
          meta={<StatusPill tone="info">受付コンテキスト確認中</StatusPill>}
        />
        <section aria-label="受付コンテキスト確認中" aria-busy="true">
          <LoadingState label="受付・患者・業務日の対応を確認しています…" />
        </section>
      </OperatorPage>
    );
  }

  if (state.status === "error") {
    return (
      <OperatorPage
        rail={<PrescriptionLaunchGateRail />}
        railLabel="処方入力の前提と安全情報"
      >
        <ScreenHeader
          title={SCREEN_TITLE}
          eyebrow="SCR-004 受付スコープ"
          description="受付との対応を確認できるまで処方入力を開始しません。"
          meta={<StatusPill tone="danger">受付照合失敗・開始不可</StatusPill>}
        />
        <section aria-label="受付コンテキスト確認エラー">
          <Panel title="この受付から処方入力を開始できません">
            <ErrorNotice severity="ERROR" {...state.notice} />
            <p>
              <Link className="operator-button" href="/">
                受付ダッシュボードへ戻る
              </Link>
            </p>
          </Panel>
        </section>
      </OperatorPage>
    );
  }

  return (
    <PrescriptionLaunchVerifiedView
      launch={launch}
      entry={state.entry}
      draft={state.draft}
      patient={selectedPatient}
    />
  );
}

/**
 * 照合済み状態の表示。受付キュー・下書きAPIの応答だけを描画し、値を補完しない。
 */
export function PrescriptionLaunchVerifiedView({
  launch,
  entry,
  draft,
  patient,
  asOf,
}: {
  readonly launch: PrescriptionLaunchContext;
  readonly entry: ReceptionQueueEntry;
  readonly draft: DraftOutcome;
  readonly patient: PatientContextData;
  readonly asOf?: Date;
}) {
  return (
    <OperatorPage
      rail={<PrescriptionLaunchGateRail />}
      railLabel="処方入力の前提と安全情報"
    >
      <ScreenHeader
        title={SCREEN_TITLE}
        eyebrow="SCR-004 受付スコープ"
        description="受付キューに存在し、選択患者と一致する受付です。処方内容はまだ検証していません。"
        meta={<StatusPill tone="info">受付キュー照合済み・処方内容未検証</StatusPill>}
      />
      <section
        className="operator-stack"
        aria-label="照合済み受付コンテキスト"
        data-prescription-launch="verified"
        data-reception-id={entry.receptionId}
      >
        <PatientHeader
          patientId={patientId(patient.patientId)}
          name={patient.name}
          kana={patient.kana}
          birthDate={patient.birthDate}
          age={computeAgeYears(patient.birthDate, asOf ?? new Date())}
          sex={patient.sex}
          eligibility={patient.eligibilityStatus}
          {...(patient.eligibilityCheckedAt === undefined
            ? {}
            : { eligibilityCheckedAt: patient.eligibilityCheckedAt })}
        />

        <Panel
          className="live-surface-panel"
          title="受付コンテキスト"
          description="受付キューAPIの応答をそのまま表示しています。"
        >
          <KeyValueList
            items={[
              { label: "受付ID", value: entry.receptionId },
              { label: "業務日", value: launch.businessDate },
              {
                label: "受付時刻",
                value: formatAcceptedTime(entry.acceptedAt),
              },
              {
                label: "受付状態",
                value: (
                  <DomainStatusBadge
                    query={{ domain: "reception", key: entry.receptionStatus }}
                  />
                ),
              },
              { label: "処方箋区分", value: "紙" },
            ]}
          />
          <InlineNotice
            title="受付コンテキストを確認しました"
            tone="info"
            announce="polite"
          >
            <p>
              この確認は、認証済みtenant・薬局の受付キューに受付が存在し、選択患者と一致することだけを示します。処方内容の妥当性、安全性、保存完了は示しません。
            </p>
          </InlineNotice>
        </Panel>

        <DraftStatusPanel draft={draft} />

        <Panel
          title="処方入力へ引き継ぐ"
          description="引き継ぎ後も、算定（RB-008）・臨床判断支援（RB-007）・薬剤師確認（SCR-014）は実行できません。"
        >
          <ReceptionPrescriptionHandoffAction
            entry={entry}
            businessDate={launch.businessDate}
          />
        </Panel>
      </section>
    </OperatorPage>
  );
}
