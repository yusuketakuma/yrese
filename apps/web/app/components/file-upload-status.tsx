/**
 * ファイルアップロード状態表示(S3 等への添付導線)。
 *
 * 安全含意: 完了(COMPLETED)前に「保存済み」と誤認させない。処理中・検証中・失敗を区別し、
 * 失敗は再試行可否を明示する。ローカル選択(SELECTED)をサーバ保存と混同させない。
 *
 * アップロード状態は UI/転送の関心事であり、ドメイン SSOT には置かない(status.ts の
 * ビジネス状態とは別軸)。PHI・ファイル内容をログ・計測へ渡さない。
 */
export const FILE_UPLOAD_STATUSES = [
  "SELECTED",
  "VALIDATING",
  "UPLOADING",
  "PROCESSING",
  "COMPLETED",
  "REJECTED",
  "RETRYABLE_ERROR",
  "CANCELLED",
] as const;

export type FileUploadStatus = (typeof FILE_UPLOAD_STATUSES)[number];

interface UploadPresentation {
  readonly label: string;
  readonly tone: "ok" | "pending" | "blocked" | "attention" | "neutral";
  readonly shape: string;
  /** サーバ保存が確定した状態か(COMPLETED のみ true)。 */
  readonly durable: boolean;
}

const UPLOAD_PRESENTATION: Record<FileUploadStatus, UploadPresentation> = {
  SELECTED: { label: "選択済み(未送信)", tone: "neutral", shape: "○", durable: false },
  VALIDATING: { label: "検証中", tone: "pending", shape: "↻", durable: false },
  UPLOADING: { label: "アップロード中", tone: "pending", shape: "↻", durable: false },
  PROCESSING: { label: "処理中", tone: "pending", shape: "↻", durable: false },
  COMPLETED: { label: "完了(保存済み)", tone: "ok", shape: "●", durable: true },
  REJECTED: { label: "拒否(受付不可)", tone: "blocked", shape: "✕", durable: false },
  RETRYABLE_ERROR: { label: "失敗(再試行可)", tone: "attention", shape: "△", durable: false },
  CANCELLED: { label: "キャンセル", tone: "neutral", shape: "✕", durable: false },
};

export interface FileUploadStatusIndicatorProps {
  readonly status: FileUploadStatus;
  /** ファイル名(表示用)。 */
  readonly fileName?: string;
  /** 補足メッセージ(拒否理由・再試行案内など)。 */
  readonly message?: string;
}

export function FileUploadStatusIndicator(props: FileUploadStatusIndicatorProps) {
  const presentation = UPLOAD_PRESENTATION[props.status];
  const failed = props.status === "REJECTED" || props.status === "RETRYABLE_ERROR";
  return (
    <span
      className="file-upload-status"
      data-upload-status={props.status}
      data-tone={presentation.tone}
      data-durable={presentation.durable ? "true" : "false"}
      role={failed ? "alert" : "status"}
      aria-live="polite"
    >
      <span className="file-upload-shape" aria-hidden="true">
        {presentation.shape}
      </span>
      {props.fileName && <span className="file-upload-name">{props.fileName}</span>}
      <span className="file-upload-label">{presentation.label}</span>
      {props.message && <span className="file-upload-message">{props.message}</span>}
    </span>
  );
}
