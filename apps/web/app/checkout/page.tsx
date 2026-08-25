import { PatientContextRail } from "../components/patient-context-rail";
import {
  KeyValueList,
  MetricCard,
  MetricGrid,
  OperatorPage,
  Panel,
  PrototypeAction,
  PrototypeBanner,
  RailCard,
  ScreenHeader,
  StatusPill,
} from "../components/operator-ui";

const BILLING_ROWS = [
  ["調剤技術料", "147点", "¥1,470", "¥441"],
  ["薬学管理料", "100点", "¥1,000", "¥300"],
  ["薬剤料", "320点", "¥3,200", "¥960"],
  ["加算", "45点", "¥450", "¥135"],
] as const;

export default function Page() {
  return (
    <OperatorPage
      rail={
        <>
          <PatientContextRail />
          <RailCard title="処方・調剤概要">
            <StatusPill tone="warning">未接続</StatusPill>
            <p className="rail-muted">処方番号・薬剤数・調剤方法は調剤API接続後に表示します。</p>
          </RailCard>
          <RailCard title="リマインダー・注意事項" tone="warning">
            <ul className="rail-action-list">
              <li>未収・返金・売掛の履歴は会計API接続後に確認</li>
              <li>領収証・明細書は確定前プレビューを必須化</li>
              <li>支払確定は権限・患者文脈・金額再確認後に実行</li>
            </ul>
          </RailCard>
        </>
      }
    >
      <ScreenHeader
        title="会計・一部負担金"
        description="算定結果、患者負担、公費、支払方法、帳票発行を一画面で確認する構成です。"
        meta={<StatusPill tone="warning">算定・会計API未接続</StatusPill>}
      />
      <PrototypeBanner>
        金額・点数・履歴は画面構成確認用の合成例です。患者請求・入金・返金・帳票発行は実行されません。
      </PrototypeBanner>
      <MetricGrid>
        <MetricCard label="患者負担額（今回）" value="¥1,230" detail="合成例・3割負担" tone="accent" icon="¥" />
        <MetricCard label="公費適用額" value="¥370" detail="合成例" tone="success" icon="公" />
        <MetricCard label="未収金（今回）" value="¥0" detail="合成例" tone="warning" icon="!" />
        <MetricCard label="返金・調整" value="¥0" detail="合成例" tone="info" icon="↻" />
      </MetricGrid>

      <div className="operator-two-column">
        <Panel title="請求明細（10割換算）" description="合成データ。計算根拠は未接続です。">
          <div className="table-scroll">
            <table className="operator-table">
              <thead>
                <tr><th>項目</th><th>点数</th><th>金額（10割）</th><th>患者負担（3割）</th></tr>
              </thead>
              <tbody>
                {BILLING_ROWS.map((row) => (
                  <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>
                ))}
                <tr className="operator-table-total"><th>患者負担額（今回）</th><td>489点</td><td>¥4,890</td><td>¥1,230</td></tr>
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="operator-stack">
          <Panel title="領収証・明細書・薬袋">
            <div className="document-action-grid">
              <PrototypeAction>領収証を発行</PrototypeAction>
              <PrototypeAction>調剤明細書を発行</PrototypeAction>
              <PrototypeAction>薬袋を印刷</PrototypeAction>
            </div>
          </Panel>
          <Panel title="お支払い" description="支払方法の選択も合成UIです。">
            <div className="payment-method-grid" aria-label="支払方法（未接続）">
              {["現金", "クレジット", "QR決済", "売掛"].map((method) => (
                <button key={method} type="button" disabled>{method}</button>
              ))}
            </div>
            <KeyValueList
              items={[
                { label: "受領金額", value: "¥1,230（合成例）" },
                { label: "お釣り", value: "¥0（合成例）" },
              ]}
            />
            <div className="panel-footer-actions">
              <PrototypeAction kind="primary">会計を確定する</PrototypeAction>
              <PrototypeAction>一時保存</PrototypeAction>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="会計履歴（直近10件）" description="履歴API未接続のため合成例です。">
        <div className="table-scroll">
          <table className="operator-table">
            <thead><tr><th>日時</th><th>取引種別</th><th>金額</th><th>支払方法</th><th>状態</th><th>備考</th></tr></thead>
            <tbody>
              <tr><td>2025/07/31 09:45</td><td>今回会計</td><td>¥1,230</td><td>現金</td><td><StatusPill tone="warning">未収</StatusPill></td><td>合成例</td></tr>
              <tr><td>2025/07/10 10:12</td><td>前回会計</td><td>¥1,120</td><td>現金</td><td><StatusPill tone="success">入金済</StatusPill></td><td>合成例</td></tr>
              <tr><td>2025/06/28 11:05</td><td>返金</td><td>¥-220</td><td>現金</td><td><StatusPill tone="success">返金済</StatusPill></td><td>数量調整（合成例）</td></tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </OperatorPage>
  );
}
