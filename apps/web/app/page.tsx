import { OperatorFocusBoard } from "./components/operator-focus-board";
import { PatientContextRail } from "./components/patient-context-rail";
import {
  IntakeCard,
  OperatorPage,
  Panel,
  RailCard,
  ScreenHeader,
  StatusPill,
} from "./components/operator-ui";
import { ReceptionDashboard } from "./reception-dashboard";
import { ReceptionPrescriptionLaunch } from "./reception-prescription-launch";

export default function ReceptionPage() {
  return (
    <OperatorPage
      rail={
        <>
          <PatientContextRail />
          <RailCard title="安全チェックのお願い" tone="info">
            <p className="rail-muted">
              受付後は、患者・保険資格・処方内容・用法用量を薬剤師が確認してください。
            </p>
            <StatusPill tone="warning">確認手順は従来運用を継続</StatusPill>
          </RailCard>
          <RailCard title="システムからの提案">
            <ul className="rail-action-list">
              <li>資格確認が必要な受付を優先表示</li>
              <li>重複受付候補は確定前に人が確認</li>
              <li>期限切れマスターは同期状態で確認</li>
            </ul>
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
        <div className="intake-grid">
          <IntakeCard
            icon="QR"
            title="処方せんQR"
            description="JAHIS 2次元シンボルを仮取込し、薬剤師確認後に確定します。"
            actionLabel="カメラを起動"
          />
          <IntakeCard
            icon="電"
            title="電子処方箋"
            description="電子処方箋の取得境界。ONS仕様・接続試験前は実行しません。"
            actionLabel="電子処方箋を取得"
            tone="info"
          />
          <IntakeCard
            icon="文"
            title="ファイル取込"
            description="PDF・画像からの取込候補。原本画像と抽出結果を分離して確認します。"
            actionLabel="ファイルを選択"
            tone="accent"
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
