import { OperatorFocusBoard } from "./components/operator-focus-board";
import { PatientContextRail } from "./components/patient-context-rail";
import {
  OperatorPage,
  Panel,
  PrototypeAction,
  PrototypeBanner,
  RailCard,
  ScreenHeader,
  StatusPill,
} from "./components/operator-ui";
import { ReceptionDashboard } from "./reception-dashboard";
import { ReceptionPrescriptionLaunch } from "./reception-prescription-launch";

/**
 * 取込導線カード(SCR-001)。
 *
 * この画面の3導線はいずれも個別の APPROVED ゲート待ちなので、停止理由
 * (ゲート名+日本語説明)を導線ごとに明示的に渡す。title から機械的に組み立てると
 * どのゲートで止まっているかを操作者に見せられない。
 * 表示形は共有 .intake-card / StatusPill / PrototypeAction をそのまま使う。
 * この画面が唯一の取込導線カードなので、共有 component 化はしない。
 */
function IntakeGateCard({
  icon,
  title,
  description,
  actionLabel,
  gate,
  tone,
}: {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly gate: string;
  readonly tone: "accent" | "info";
}) {
  return (
    <article className="intake-card" data-tone={tone}>
      <div className="intake-card-heading">
        <span className="intake-icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h4>{title}</h4>
          <p>{description}</p>
        </div>
      </div>
      <div className="intake-card-footer">
        <StatusPill tone="warning">未接続</StatusPill>
        <PrototypeAction reason={gate}>{actionLabel}</PrototypeAction>
      </div>
    </article>
  );
}

export default function ReceptionPage() {
  return (
    <OperatorPage
      rail={
        <>
          <PatientContextRail />
          <RailCard title="この画面が表示していること">
            <ul className="rail-action-list">
              <li>
                指定した業務日1日分の受付キュー(GET /reception/queue)だけを表示します。
                他の業務日・他薬局の受付は含みません。
              </li>
              <li>
                上部の4指標は同じ受付キューからの集計です。取消済みは稼働件数に数えません。
              </li>
              <li>
                資格状態は受付時点で保存されたスナップショットの表示であり、
                オンライン資格確認への再照会結果ではありません。
              </li>
            </ul>
          </RailCard>
          <RailCard title="この画面が表示していないこと" tone="warning">
            <ul className="rail-action-list">
              <li>
                臨床アラート判定は未接続です。アラートが表示されないことは安全確認済みを意味しません。
              </li>
              <li>
                併用禁忌・アレルギー歴・検査値は未接続です。表示されないことは該当なしを意味しません。
              </li>
              <li>
                点数・薬価・負担金はこの画面では扱いません。会計・請求の数値はここから導出できません。
              </li>
            </ul>
            <p className="rail-muted">
              未接続の項目を成功・正常として表示しません。判断は従来の確認手順に従ってください。
            </p>
          </RailCard>
        </>
      }
    >
      <ScreenHeader
        title="受付ダッシュボード"
        description="患者を選択し、受付キューから次の処理へ進むための業務起点です。"
        meta={<StatusPill tone="info">既存受付API配線・稼働未確認</StatusPill>}
      />

      <OperatorFocusBoard />

      <Panel
        title="受付（処方せんの取り込み）"
        description="外部取込は契約・接続承認後に有効化します。現在は安全に未接続です。"
      >
        <PrototypeBanner>
          取込導線で現在利用できるのは、紙処方箋を窓口で受け付けて下の「受付登録」から登録する経路だけです。
          2次元シンボル読取・電子処方箋取得・ファイル取込は、それぞれ下記のゲートで停止しています。
        </PrototypeBanner>
        <div className="intake-grid">
          <IntakeGateCard
            icon="QR"
            title="処方せんQR"
            description="JAHIS 2次元シンボルを仮取込し、薬剤師確認後に確定します。"
            actionLabel="カメラを起動"
            tone="accent"
            gate="SCR-005 BLOCKED_JAHIS_SPEC_ACQUISITION — JAHIS Ver.1.11 仕様本文の正規入手と evidence_id 発行が未了のため実行できません"
          />
          <IntakeGateCard
            icon="電"
            title="電子処方箋"
            description="電子処方箋の取得境界。ONS仕様・接続試験前は実行しません。"
            actionLabel="電子処方箋を取得"
            tone="info"
            gate="SCR-006 / RB-003 BLOCKED_REGULATORY_REVIEW — 技術解説書2.04版以降の確認と境界SSOTのAPPROVEDが未了のため実行できません"
          />
          <IntakeGateCard
            icon="文"
            title="ファイル取込"
            description="PDF・画像からの取込候補。原本画像と抽出結果を分離して確認します。"
            actionLabel="ファイルを選択"
            tone="accent"
            gate="UIX-001 §12.3 operation registry 未登録 — 原本画像の取込・保存・抽出を定めるAPPROVED SSOTが未作成のため実行できません"
          />
        </div>
      </Panel>

      <Panel
        title="受付キュー"
        description="この領域は既存の受付API・冪等登録・患者文脈へ接続されています。"
        className="live-surface-panel"
      >
        <div id="reception-live-queue">
          <ReceptionDashboard />
        </div>
      </Panel>

      <Panel
        title="選択患者の処方入力を開始"
        description="受付IDを手入力せず、認証済みの受付キューから患者一致を確認して処方入力へ引き継ぎます。"
        className="live-surface-panel"
      >
        <ReceptionPrescriptionLaunch />
      </Panel>
    </OperatorPage>
  );
}
