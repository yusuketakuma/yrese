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

export default function Page() {
  return (
    <section data-prototype-financial-data="excluded" aria-label="会計・一部負担金">
      <OperatorPage
        railLabel="選択患者の会計補助情報"
        rail={
          <>
            <PatientContextRail />
            <RailCard title="処方・調剤概要">
              <StatusPill tone="warning">未接続</StatusPill>
              <p className="rail-muted">
                処方番号・薬剤数・調剤方法は調剤API接続後に表示します。空欄は処方なしを意味しません。
              </p>
            </RailCard>
            <RailCard title="確定前の必須確認" tone="warning">
              <ul className="rail-action-list">
                <li>患者、資格、公費、負担割合の再確認</li>
                <li>算定根拠と丸め結果の再確認</li>
                <li>金額、支払方法、帳票プレビューの再確認</li>
              </ul>
            </RailCard>
          </>
        }
      >
        <ScreenHeader
          title="会計・一部負担金"
          description="算定結果、患者負担、公費、支払方法、帳票発行を患者単位で確認します。"
          meta={<StatusPill tone="warning">算定・会計API未接続</StatusPill>}
        />
        <PrototypeBanner tone="warning">
          選択患者へ固定の合成金額・合成入金履歴を誤帰属させないため、金額と履歴は表示していません。空欄や「—」は0円・支払完了・請求不要を意味しません。
        </PrototypeBanner>
        <MetricGrid>
          <MetricCard
            label="患者負担額（今回）"
            value="—"
            detail="算定API未接続。0円ではありません"
            tone="accent"
            icon="¥"
          />
          <MetricCard
            label="公費適用額"
            value="—"
            detail="公費判定未接続。適用なしを意味しません"
            tone="info"
            icon="公"
          />
          <MetricCard
            label="未収金（今回）"
            value="—"
            detail="会計API未接続。0円ではありません"
            tone="neutral"
            icon="?"
          />
          <MetricCard
            label="返金・調整"
            value="—"
            detail="履歴API未接続。対象なしを意味しません"
            tone="info"
            icon="↻"
          />
        </MetricGrid>

        <div className="operator-two-column">
          <Panel
            title="請求明細（10割換算）"
            description="算定結果と計算根拠の接続後に表示します。"
          >
            <div className="table-scroll" tabIndex={0} aria-label="請求明細表">
              <table className="operator-table">
                <caption className="visually-hidden">未接続の請求明細</caption>
                <thead>
                  <tr>
                    <th scope="col">項目</th>
                    <th scope="col">点数</th>
                    <th scope="col">金額（10割）</th>
                    <th scope="col">患者負担</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={4} className="operator-empty-copy">
                      算定API未接続のため明細は表示できません。明細がないことや0点を意味しません。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="operator-stack">
            <Panel title="領収証・明細書・薬袋">
              <div className="document-action-grid">
                <PrototypeAction reason="会計確定と帳票発行APIが未接続です">
                  領収証を発行
                </PrototypeAction>
                <PrototypeAction reason="会計確定と帳票発行APIが未接続です">
                  調剤明細書を発行
                </PrototypeAction>
                <PrototypeAction reason="調剤内容と印刷APIが未接続です">
                  薬袋を印刷
                </PrototypeAction>
              </div>
            </Panel>
            <Panel title="お支払い" description="金額確定後に支払方法を選択します。">
              <div
                className="payment-method-grid"
                aria-label="支払方法（会計API未接続のため選択不可）"
              >
                {["現金", "クレジット", "QR決済", "売掛"].map((method) => (
                  <button key={method} type="button" disabled title="会計API未接続">
                    {method}
                  </button>
                ))}
              </div>
              <KeyValueList
                items={[
                  { label: "受領金額", value: "—（未算定）" },
                  { label: "お釣り", value: "—（未算定）" },
                ]}
              />
              <div className="panel-footer-actions">
                <PrototypeAction kind="primary" reason="金額・権限・会計APIが未接続です">
                  会計を確定する
                </PrototypeAction>
                <PrototypeAction reason="会計一時保存APIが未接続です">
                  一時保存
                </PrototypeAction>
              </div>
            </Panel>
          </div>
        </div>

        <Panel title="会計履歴" description="選択患者の履歴API接続後に表示します。">
          <div className="table-scroll" tabIndex={0} aria-label="会計履歴表">
            <table className="operator-table">
              <caption className="visually-hidden">未接続の会計履歴</caption>
              <thead>
                <tr>
                  <th scope="col">日時</th>
                  <th scope="col">取引種別</th>
                  <th scope="col">金額</th>
                  <th scope="col">支払方法</th>
                  <th scope="col">状態</th>
                  <th scope="col">備考</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} className="operator-empty-copy">
                    会計履歴API未接続のため表示できません。履歴なし・未収なし・返金なしを意味しません。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      </OperatorPage>
    </section>
  );
}
