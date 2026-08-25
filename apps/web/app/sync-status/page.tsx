import { ModeCapabilityView } from "../components/mode-capability-view";
import {
  MetricCard,
  MetricGrid,
  OperatorPage,
  Panel,
  PrototypeAction,
  RailCard,
  ScreenHeader,
  StatusPill,
} from "../components/operator-ui";
import { SystemHealthBanner } from "../components/sync-indicator";
import { ModeOverviewTable } from "./mode-overview";

const INTEGRATIONS = [
  ["オンライン資格確認", "未接続", "—", "接続契約・端末境界の確認"],
  ["電子処方箋", "未接続", "—", "ONS仕様・接続試験待ち"],
  ["オンライン請求", "未接続", "—", "公式受渡し方式の確認"],
  ["マスター配信", "未接続", "—", "更新パイプライン承認待ち"],
  ["ローカル同期", "未接続", "—", "R-OFFLINE永続層未実装"],
] as const;

export default function Page() {
  const currentMode = "NORMAL" as const;
  return (
    <OperatorPage
      rail={
        <>
          <RailCard title="現在のシステムモード" tone="warning">
            <StatusPill tone="warning">NORMAL固定（暫定）</StatusPill>
            <p className="rail-muted">モード検知バックエンドは未接続です。固定表示を実状態と解釈しないでください。</p>
          </RailCard>
          <RailCard title="障害時の対応ガイド" tone="info">
            <ol className="rail-steps"><li>現在モードと警告を確認</li><li>影響サービスと未処理件数を確認</li><li>再試行または正式な障害手順へ</li></ol>
          </RailCard>
          <RailCard title="重要なお知らせ・アラート" tone="danger">
            <ul className="rail-action-list"><li>外部サービス連携は全て未接続</li><li>未処理件数「—」はゼロを意味しない</li></ul>
          </RailCard>
        </>
      }
    >
      <ScreenHeader
        title="同期状態・外部連携"
        description="クラウド、薬局内Edge、外部公的サービス、ジョブキューの状態を分離して表示します。"
        meta={<StatusPill tone="warning">検知バックエンド未接続</StatusPill>}
        actions={<PrototypeAction>手動で最新に更新</PrototypeAction>}
      />
      <SystemHealthBanner mode={currentMode} reason="モード検知バックエンド未接続のため NORMAL 固定表示（暫定）" />
      <MetricGrid>
        <MetricCard label="クラウド（yrese）" value="未検知" detail="ヘルスAPI未接続" tone="warning" icon="雲" />
        <MetricCard label="オンプレミス / Edge" value="未検知" detail="Edge状態API未接続" tone="warning" icon="端" />
        <MetricCard label="外部サービス連携" value="未接続" detail="成功扱いにしません" tone="danger" icon="外" />
        <MetricCard label="未処理ジョブ（合計）" value="—" unit="件" detail="キューAPI未接続" tone="info" icon="時" />
      </MetricGrid>

      <Panel title="同期・連携ステータスボード" description="各サービスの未接続を明示します。">
        <div className="table-scroll"><table className="operator-table"><thead><tr><th>連携 / 同期項目</th><th>現在の状態</th><th>未処理件数</th><th>次のアクション</th><th>詳細</th></tr></thead><tbody>
          {INTEGRATIONS.map((row) => <tr key={row[0]}><td>{row[0]}</td><td><StatusPill tone="warning">{row[1]}</StatusPill></td><td>{row[2]}</td><td>{row[3]}</td><td><PrototypeAction>詳細ログ</PrototypeAction></td></tr>)}
        </tbody></table></div>
      </Panel>

      <div className="operator-two-column">
        <Panel title="現在モードの操作可否"><ModeCapabilityView mode={currentMode} /></Panel>
        <Panel title="モード別可否早見表（非常時リファレンス）"><ModeOverviewTable currentMode={currentMode} /></Panel>
      </div>

      <Panel title="最近の同期イベント（ジョブキュー）">
        <p className="operator-empty-copy">同期イベントAPI未接続。履歴がないことは、実行済み・成功済みを意味しません。</p>
      </Panel>
    </OperatorPage>
  );
}
