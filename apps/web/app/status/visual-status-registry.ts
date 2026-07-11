/**
 * Visual Status Registry — 視覚的状態言語の単一正本(Executable SSOT)。
 *
 * 根拠: docs/uiux/medical_ui_ux_principles.md(UIX-001 P-17/P-20)、
 * docs/ui-ux-refresh/08-target-design-direction.md(§4 Visual Status Matrix)。
 *
 * 目的(監査 A-01/A-02 の恒久対策):
 * - ドメイン状態キー(shared-kernel の enum)→ 表示(label/tone/shape/ARIA)を一元決定する。
 * - 画面側に任意の色・severity・アイコン・独自ラベルを選ばせない(§11.4-6)。
 * - 色だけ・形だけに意味を担わせない。label(日本語・必須)が意味の主担、shape/tone は冗長な補助。
 *
 * 所有権境界: 表示文言(可視ラベル)は UI 層(apps/web)所有であり shared-kernel には置かない
 * (packages/shared-kernel/src/error-codes.ts の定め)。本 Registry はその UI 層の正本。
 *
 * 網羅性: 各ドメインは `Record<Enum, StatusPresentation>` 型で定義するため、対応する
 * shared-kernel enum に値を追加すると本ファイルは型エラーになる(未定義状態を型で検出)。
 */

import type {
  ClinicalAlertAckStatus,
  ClinicalAlertType,
  EligibilityStatus,
  ErrorSeverity,
  PrescriptionChangeType,
  ProvisionalStatus,
  ReceptionStatus,
  RecordLifecycleStatus,
  SessionStatus,
  SyncStatus,
  SystemMode,
} from "@yrese/shared-kernel";

/** 状態トーン(補助背景色の選択のみ。意味は label が担う)。`attention` を新設(監査 A-03)。 */
export type StatusTone = "ok" | "pending" | "blocked" | "attention" | "neutral";

/**
 * 形状記号(色に依存しない冗長エンコード用の補助シンボル)。
 * 基本的な幾何記号のみを用い、絵文字・装飾記号は使わない(§11.6)。
 * shape は補助であり単独で意味を伝えない。必ず label を伴って表示する。
 */
export type StatusShape =
  | "●"
  | "○"
  | "▲"
  | "△"
  | "■"
  | "◆"
  | "◇"
  | "↻"
  | "✕"
  | "・"
  | "↑"
  | "↓"
  | "→";

export type StatusAriaRole = "status" | "alert";
export type StatusAriaLive = "polite" | "assertive" | "off";

export interface StatusPresentation {
  /** 日本語可視ラベル(必須・意味の主担)。 */
  readonly label: string;
  /** 補助背景トーン。 */
  readonly tone: StatusTone;
  /** 補助形状記号(色非依存の冗長エンコード)。 */
  readonly shape: StatusShape;
  /** 支援技術向けロール。重大なもののみ alert。 */
  readonly ariaRole: StatusAriaRole;
  /** live region の強さ。CRITICAL/BLOCKER のみ assertive、その他は polite(§11.4-18)。 */
  readonly ariaLive: StatusAriaLive;
}

/**
 * A. メッセージ/臨床重要度(shared-kernel ErrorSeverity)。
 * 表示順は重要度降順(SEVERITY_ORDER)。CRITICAL は患者安全事象に温存(UIX-001 §5)。
 */
export const SEVERITY_PRESENTATION: Record<ErrorSeverity, StatusPresentation> = {
  CRITICAL: { label: "重大", tone: "blocked", shape: "◆", ariaRole: "alert", ariaLive: "assertive" },
  BLOCKER: { label: "停止", tone: "blocked", shape: "■", ariaRole: "alert", ariaLive: "assertive" },
  ERROR: { label: "エラー", tone: "attention", shape: "▲", ariaRole: "alert", ariaLive: "polite" },
  WARNING: { label: "警告", tone: "pending", shape: "△", ariaRole: "status", ariaLive: "polite" },
  INFO: { label: "情報", tone: "neutral", shape: "・", ariaRole: "status", ariaLive: "polite" },
};

/** 重要度降順の表示順(UIX-001 §5)。 */
export const SEVERITY_ORDER: readonly ErrorSeverity[] = [
  "BLOCKER",
  "CRITICAL",
  "ERROR",
  "WARNING",
  "INFO",
];

/** F. システムモード(shared-kernel SystemMode)。文言は既存 MODE_LABELS と一致。 */
export const SYSTEM_MODE_PRESENTATION: Record<SystemMode, StatusPresentation> = {
  NORMAL: { label: "通常稼働", tone: "ok", shape: "●", ariaRole: "status", ariaLive: "polite" },
  EXTERNAL_DEGRADED: {
    label: "外部システム障害",
    tone: "pending",
    shape: "▲",
    ariaRole: "status",
    ariaLive: "polite",
  },
  CLOUD_DEGRADED: {
    label: "クラウド障害",
    tone: "pending",
    shape: "▲",
    ariaRole: "status",
    ariaLive: "polite",
  },
  LOCAL_ONLY: {
    label: "ローカル単独稼働(外部確認不可)",
    tone: "blocked",
    shape: "■",
    ariaRole: "status",
    ariaLive: "polite",
  },
  RECOVERY_SYNC: {
    label: "復旧同期中(要再検証)",
    tone: "pending",
    shape: "↻",
    ariaRole: "status",
    ariaLive: "polite",
  },
};

/** 資格確認状態(shared-kernel EligibilityStatus)。文言は既存 ELIGIBILITY_LABELS と一致。 */
export const ELIGIBILITY_PRESENTATION: Record<EligibilityStatus, StatusPresentation> = {
  VERIFIED: { label: "資格確認済み", tone: "ok", shape: "●", ariaRole: "status", ariaLive: "polite" },
  PENDING_REVERIFY: {
    label: "資格再確認待ち(請求前に再確認必須)",
    tone: "pending",
    shape: "↻",
    ariaRole: "status",
    ariaLive: "polite",
  },
  LOCAL_ONLY_UNVERIFIED: {
    label: "ローカル参照のみ(オンライン未確認)",
    tone: "blocked",
    shape: "■",
    ariaRole: "status",
    ariaLive: "polite",
  },
  NOT_CHECKED: {
    label: "資格未確認",
    tone: "attention",
    shape: "△",
    ariaRole: "status",
    ariaLive: "polite",
  },
};

/** E. 受付ワークフロー(shared-kernel ReceptionStatus)。文言は既存 RECEPTION_STATUS_LABELS と一致。 */
export const RECEPTION_PRESENTATION: Record<ReceptionStatus, StatusPresentation> = {
  WAITING: { label: "待機中", tone: "neutral", shape: "○", ariaRole: "status", ariaLive: "polite" },
  IN_PROGRESS: {
    label: "対応中",
    tone: "pending",
    shape: "↻",
    ariaRole: "status",
    ariaLive: "polite",
  },
  COMPLETED: { label: "完了", tone: "ok", shape: "●", ariaRole: "status", ariaLive: "polite" },
  CANCELLED: {
    label: "取消済み",
    tone: "neutral",
    shape: "✕",
    ariaRole: "status",
    ariaLive: "polite",
  },
};

/**
 * D. 仮状態(shared-kernel ProvisionalStatus)。
 * ローカル保存済み/未確認をサーバ確定と同じ成功表現にしない(§11.4-10、H-03)。
 * ここで初めて仮状態に日本語ラベルを与える(従来 raw enum 表示だった ModeCapabilityView を改善)。
 */
export const PROVISIONAL_PRESENTATION: Record<ProvisionalStatus, StatusPresentation> = {
  PROVISIONAL_CALCULATION: {
    label: "仮算定(未確定)",
    tone: "pending",
    shape: "↻",
    ariaRole: "status",
    ariaLive: "polite",
  },
  PENDING_REVERIFY: {
    label: "再確認待ち",
    tone: "pending",
    shape: "↻",
    ariaRole: "status",
    ariaLive: "polite",
  },
  PENDING_EXTERNAL_SYNC: {
    label: "外部同期待ち",
    tone: "pending",
    shape: "↻",
    ariaRole: "status",
    ariaLive: "polite",
  },
  PENDING_PMH_REVERIFY: {
    label: "医療費助成 再確認待ち",
    tone: "pending",
    shape: "↻",
    ariaRole: "status",
    ariaLive: "polite",
  },
  LOCAL_ONLY_UNVERIFIED: {
    label: "ローカルのみ(未確認)",
    tone: "blocked",
    shape: "■",
    ariaRole: "status",
    ariaLive: "polite",
  },
  MANUAL_REVIEW_REQUIRED: {
    label: "手動確認要",
    tone: "attention",
    shape: "△",
    ariaRole: "status",
    ariaLive: "polite",
  },
};

/**
 * C. 記録ライフサイクル(shared-kernel RecordLifecycleStatus)。
 * 確定前(下書き)を確定と誤認させない(H-05)。ローカル自動保存をサーバ保存と同一表現にしない
 * (H-03。sync 軸と直交)。確定後変更は「訂正」として履歴を残す(真正性)。
 */
export const RECORD_LIFECYCLE_PRESENTATION: Record<RecordLifecycleStatus, StatusPresentation> = {
  UNSAVED: { label: "未保存(消失注意)", tone: "attention", shape: "△", ariaRole: "status", ariaLive: "polite" },
  DRAFT: { label: "下書き(未確定)", tone: "pending", shape: "○", ariaRole: "status", ariaLive: "polite" },
  AUTO_SAVED_LOCALLY: {
    label: "ローカル自動保存(未同期)",
    tone: "blocked",
    shape: "■",
    ariaRole: "status",
    ariaLive: "polite",
  },
  SERVER_SAVED: { label: "サーバ保存(未確定)", tone: "pending", shape: "◇", ariaRole: "status", ariaLive: "polite" },
  PENDING_REVIEW: { label: "確認待ち", tone: "pending", shape: "↻", ariaRole: "status", ariaLive: "polite" },
  PROXY_ENTERED: { label: "代理入力(要承認)", tone: "attention", shape: "▲", ariaRole: "status", ariaLive: "polite" },
  APPROVAL_PENDING: { label: "承認待ち", tone: "pending", shape: "↻", ariaRole: "status", ariaLive: "polite" },
  APPROVED: { label: "承認済み", tone: "ok", shape: "◇", ariaRole: "status", ariaLive: "polite" },
  FINALIZED: { label: "確定", tone: "ok", shape: "●", ariaRole: "status", ariaLive: "polite" },
  AMENDED: { label: "訂正済み(履歴あり)", tone: "attention", shape: "◆", ariaRole: "status", ariaLive: "polite" },
  SUPERSEDED: { label: "旧版(置換済み)", tone: "neutral", shape: "・", ariaRole: "status", ariaLive: "polite" },
};

/**
 * G. 同期状態(shared-kernel SyncStatus)。ローカル保存(QUEUED)をサーバ保存(SYNCED)と
 * 同一の成功表現にしない(H-03)。競合(CONFLICT)・失敗(SYNC_FAILED)は AT へ通知(alert)。
 */
export const SYNC_PRESENTATION: Record<SyncStatus, StatusPresentation> = {
  SYNCED: { label: "同期済み", tone: "ok", shape: "●", ariaRole: "status", ariaLive: "polite" },
  QUEUED: { label: "同期待ち(ローカル保存)", tone: "pending", shape: "○", ariaRole: "status", ariaLive: "polite" },
  SYNCING: { label: "同期中", tone: "pending", shape: "↻", ariaRole: "status", ariaLive: "polite" },
  STALE: { label: "情報が古い可能性", tone: "attention", shape: "△", ariaRole: "status", ariaLive: "polite" },
  RETRYING: { label: "再試行中", tone: "pending", shape: "↻", ariaRole: "status", ariaLive: "polite" },
  SYNC_FAILED: { label: "同期失敗(要対応)", tone: "blocked", shape: "✕", ariaRole: "alert", ariaLive: "polite" },
  CONFLICT: { label: "競合(要解決)", tone: "blocked", shape: "■", ariaRole: "alert", ariaLive: "polite" },
};

/**
 * 処方変化(shared-kernel PrescriptionChangeType)。事実としての差分であり臨床警告ではない
 * (§11.7 で臨床警告と視覚分離)。増減は矢印記号で色に依存させない(H-06/H-07)。
 */
export const PRESCRIPTION_CHANGE_PRESENTATION: Record<PrescriptionChangeType, StatusPresentation> = {
  UNCHANGED: { label: "変更なし", tone: "neutral", shape: "・", ariaRole: "status", ariaLive: "polite" },
  NEW: { label: "新規", tone: "attention", shape: "◇", ariaRole: "status", ariaLive: "polite" },
  RESUMED: { label: "再開", tone: "attention", shape: "↻", ariaRole: "status", ariaLive: "polite" },
  DOSE_INCREASED: { label: "増量", tone: "attention", shape: "↑", ariaRole: "status", ariaLive: "polite" },
  DOSE_DECREASED: { label: "減量", tone: "attention", shape: "↓", ariaRole: "status", ariaLive: "polite" },
  CHANGED: { label: "変更", tone: "attention", shape: "→", ariaRole: "status", ariaLive: "polite" },
  DISCONTINUED: { label: "中止", tone: "attention", shape: "✕", ariaRole: "status", ariaLive: "polite" },
};

/** 認証セッション状態(shared-kernel SessionStatus)。失効・ロックは AT へ通知(alert)。 */
export const SESSION_PRESENTATION: Record<SessionStatus, StatusPresentation> = {
  ACTIVE: { label: "ログイン中", tone: "ok", shape: "●", ariaRole: "status", ariaLive: "polite" },
  EXPIRING_SOON: { label: "まもなく失効", tone: "attention", shape: "△", ariaRole: "status", ariaLive: "polite" },
  EXPIRED: { label: "セッション失効(再認証要)", tone: "blocked", shape: "✕", ariaRole: "alert", ariaLive: "polite" },
  LOCKED: { label: "ロック中", tone: "blocked", shape: "■", ariaRole: "alert", ariaLive: "polite" },
};

/**
 * 臨床アラートの確認状態(shared-kernel ClinicalAlertAckStatus)。
 * 未確認(UNACKNOWLEDGED)を解決済みに見せない。override は理由記録+監査前提。
 */
export const CLINICAL_ALERT_ACK_PRESENTATION: Record<ClinicalAlertAckStatus, StatusPresentation> = {
  UNACKNOWLEDGED: { label: "未確認", tone: "attention", shape: "△", ariaRole: "alert", ariaLive: "polite" },
  ACKNOWLEDGED: { label: "確認済み", tone: "ok", shape: "●", ariaRole: "status", ariaLive: "polite" },
  OVERRIDDEN: { label: "理由記録のうえ実施", tone: "pending", shape: "◇", ariaRole: "status", ariaLive: "polite" },
  RESOLVED: { label: "解消", tone: "ok", shape: "●", ariaRole: "status", ariaLive: "polite" },
};

/**
 * 臨床アラート「種別」の識別(label + 形状)。
 * トーン・ARIA は種別ではなく重大度(SEVERITY_PRESENTATION)が決める(重大度と種別は直交)。
 * ClinicalAlert コンポーネントは種別 identity と severity presentation を合成して表示する。
 */
export interface AlertTypeIdentity {
  readonly label: string;
  readonly shape: StatusShape;
}

export const CLINICAL_ALERT_TYPE_IDENTITY: Record<ClinicalAlertType, AlertTypeIdentity> = {
  ALLERGY: { label: "アレルギー", shape: "◆" },
  CONTRAINDICATION: { label: "禁忌", shape: "■" },
  DRUG_INTERACTION: { label: "相互作用", shape: "▲" },
  DUPLICATE_THERAPY: { label: "重複投薬", shape: "○" },
  HIGH_RISK_DRUG: { label: "ハイリスク薬", shape: "◇" },
  DOSAGE_LIMIT: { label: "用量逸脱", shape: "△" },
};

/**
 * 直交状態軸(§11.3)。同じキー文字列でもドメインが違えば意味・文言が異なる
 * (例: eligibility.PENDING_REVERIFY と provisional.PENDING_REVERIFY はラベルが異なる)。
 * discriminated union により「ドメインとキーの不正な組合せ」を型で表現しにくくする。
 */
export type StatusQuery =
  | { readonly domain: "severity"; readonly key: ErrorSeverity }
  | { readonly domain: "system-mode"; readonly key: SystemMode }
  | { readonly domain: "eligibility"; readonly key: EligibilityStatus }
  | { readonly domain: "reception"; readonly key: ReceptionStatus }
  | { readonly domain: "provisional"; readonly key: ProvisionalStatus }
  | { readonly domain: "record-lifecycle"; readonly key: RecordLifecycleStatus }
  | { readonly domain: "sync"; readonly key: SyncStatus }
  | { readonly domain: "prescription-change"; readonly key: PrescriptionChangeType }
  | { readonly domain: "session"; readonly key: SessionStatus }
  | { readonly domain: "clinical-ack"; readonly key: ClinicalAlertAckStatus };

export type StatusDomain = StatusQuery["domain"];

/** ドメイン+キー → 表示。画面側はこの関数(または各 *_PRESENTATION)だけを使う。 */
export function resolveStatus(query: StatusQuery): StatusPresentation {
  switch (query.domain) {
    case "severity":
      return SEVERITY_PRESENTATION[query.key];
    case "system-mode":
      return SYSTEM_MODE_PRESENTATION[query.key];
    case "eligibility":
      return ELIGIBILITY_PRESENTATION[query.key];
    case "reception":
      return RECEPTION_PRESENTATION[query.key];
    case "provisional":
      return PROVISIONAL_PRESENTATION[query.key];
    case "record-lifecycle":
      return RECORD_LIFECYCLE_PRESENTATION[query.key];
    case "sync":
      return SYNC_PRESENTATION[query.key];
    case "prescription-change":
      return PRESCRIPTION_CHANGE_PRESENTATION[query.key];
    case "session":
      return SESSION_PRESENTATION[query.key];
    case "clinical-ack":
      return CLINICAL_ALERT_ACK_PRESENTATION[query.key];
  }
}

/** 表示定義から可視ラベルのみを射影する(既存ラベルマップの単一正本化に使う)。 */
function projectLabels<K extends string>(
  presentation: Record<K, StatusPresentation>,
): Record<K, string> {
  const labels = {} as Record<K, string>;
  for (const key of Object.keys(presentation) as K[]) {
    labels[key] = presentation[key].label;
  }
  return labels;
}

/** 既存コンポーネントが再利用する派生ラベルマップ(Registry が唯一の正本)。 */
export const SEVERITY_LABELS: Record<ErrorSeverity, string> = projectLabels(SEVERITY_PRESENTATION);
export const SYSTEM_MODE_LABELS: Record<SystemMode, string> = projectLabels(SYSTEM_MODE_PRESENTATION);
export const ELIGIBILITY_STATUS_LABELS: Record<EligibilityStatus, string> =
  projectLabels(ELIGIBILITY_PRESENTATION);
export const RECEPTION_STATUS_LABELS: Record<ReceptionStatus, string> =
  projectLabels(RECEPTION_PRESENTATION);
export const PROVISIONAL_STATUS_LABELS: Record<ProvisionalStatus, string> =
  projectLabels(PROVISIONAL_PRESENTATION);
export const RECORD_LIFECYCLE_LABELS: Record<RecordLifecycleStatus, string> =
  projectLabels(RECORD_LIFECYCLE_PRESENTATION);
export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = projectLabels(SYNC_PRESENTATION);
export const PRESCRIPTION_CHANGE_LABELS: Record<PrescriptionChangeType, string> =
  projectLabels(PRESCRIPTION_CHANGE_PRESENTATION);
export const SESSION_STATUS_LABELS: Record<SessionStatus, string> =
  projectLabels(SESSION_PRESENTATION);
export const CLINICAL_ALERT_ACK_LABELS: Record<ClinicalAlertAckStatus, string> =
  projectLabels(CLINICAL_ALERT_ACK_PRESENTATION);
