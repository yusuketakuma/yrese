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
  TableScroll,
} from "../components/operator-ui";
import { CheckoutReceptionContext } from "./checkout-context";

/** 支払方法。会計確定APIが未登録のため、いずれも実行不能な宣言としてのみ描画する。 */
const PAYMENT_METHODS = ["現金", "クレジット", "QR決済", "売掛"] as const;

const PAYMENT_METHOD_REASON =
  "算定が停止しており、会計確定APIも未登録のため選択できません";

export default function Page() {
  return (
    <section data-prototype-financial-data="excluded" aria-label="会計・一部負担金">
      <OperatorPage
        railLabel="会計補助情報"
        rail={
          <>
            <PatientContextRail />
            <RailCard title="この画面で出せる事実" tone="info">
              <StatusPill tone="info">受付API・処方下書きAPI</StatusPill>
              <p className="rail-muted">
                表示しているのは受付キューの実応答と、保存済み処方下書きの行数・版だけです。
                行数はサーバー保存済みであることを示すだけで、算定結果ではありません。
              </p>
            </RailCard>
            <RailCard title="算定・請求が停止しているゲート" tone="warning">
              <ul className="rail-action-list">
                <li>UIX-001 §12.3 / SCR-016 / SCR-018</li>
                <li>RB-008</li>
                <li>MST-001</li>
              </ul>
              <p className="rail-muted">
                境界の詳細は上部の「機能境界」を参照してください。
                アラートや金額が表示されないことは、安全確認済み・0円・請求不要を意味しません。
              </p>
            </RailCard>
            <RailCard title="確定前の必須確認" tone="warning">
              <ul className="rail-action-list">
                <li>患者、資格、公費、負担割合の再確認</li>
                <li>算定根拠と丸め結果の再確認</li>
                <li>金額、支払方法、帳票プレビューの再確認</li>
              </ul>
              <p className="rail-muted">
                これらは算定・帳票が承認された後の手順であり、現時点では実行できません。
              </p>
            </RailCard>
          </>
        }
      >
        <ScreenHeader
          title="会計・一部負担金"
          description="選択患者の受付と処方下書きの保存状態のみを実データで確認します。算定結果・患者負担・帳票は停止中です。"
          meta={<StatusPill tone="warning">算定・会計API未接続</StatusPill>}
        />
        <PrototypeBanner tone="warning">
          点数・患者負担・公費適用額・請求額は算出できません。算定・会計操作 SCR-016 は UIX-001
          §12.3 の operation registry で未登録です。算定エンジンは RB-008
          BLOCKED_REGULATORY_REVIEW（令和8年度調剤報酬点数表の版確認、calculation_rules の
          APPROVED、golden test 期待値の SSOT 化が未了）で停止し、薬価マスターは MST-001 の取込
          blocker（配布元仕様の evidence_id 未発行）で未取得です。領収証・明細書・薬袋の発行（SCR-018）は
          API operation が未登録です。「—」は0円・支払完了・請求不要を意味しません。
        </PrototypeBanner>

        <CheckoutReceptionContext />

        <MetricGrid>
          <MetricCard
            label="患者負担額（今回）"
            value="—"
            detail="RB-008 で算定停止中。0円ではありません"
            tone="neutral"
            icon="¥"
          />
          <MetricCard
            label="公費適用額"
            value="—"
            detail="RB-008 の算定停止に連動。公費適用なしを意味しません"
            tone="neutral"
            icon="公"
          />
          <MetricCard
            label="未収金（今回）"
            value="—"
            detail="会計確定が UIX-001 §12.3 で未登録。未収なしを意味しません"
            tone="neutral"
            icon="?"
          />
          <MetricCard
            label="返金・調整"
            value="—"
            detail="会計履歴・返金が UIX-001 §12.3 で未登録。対象なしを意味しません"
            tone="neutral"
            icon="↻"
          />
        </MetricGrid>

        <div className="operator-two-column">
          <Panel
            title="請求明細（10割換算）"
            description="RB-008 と MST-001 が解消し、算定結果が承認されるまで表示しません。"
          >
            <TableScroll label="請求明細表">
              <table className="operator-table">
                <caption className="operator-table-caption">
                  算定停止中の請求明細。行が無いことは明細なし・0点を意味しません。
                </caption>
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
                      RB-008 で算定エンジンが停止し、MST-001 で薬価が未取得のため明細を導出できません。明細がないことや0点であることを意味しません。
                    </td>
                  </tr>
                </tbody>
              </table>
            </TableScroll>
          </Panel>

          <div className="operator-stack">
            <Panel
              title="領収証・明細書・薬袋"
              description="SCR-018 の API operation が未登録のため発行できません。"
            >
              <div className="document-action-grid">
                <PrototypeAction reason="SCR-018 の帳票発行 operation が未登録のため実行できません">
                  領収証を発行
                </PrototypeAction>
                <PrototypeAction reason="SCR-018 の帳票発行 operation が未登録のため実行できません">
                  調剤明細書を発行
                </PrototypeAction>
                <PrototypeAction reason="SCR-018 の薬袋印刷 operation が未登録のため実行できません">
                  薬袋を印刷
                </PrototypeAction>
              </div>
            </Panel>
            <Panel
              title="お支払い"
              description="金額が確定していないため、支払方法の選択も会計確定も開始できません。"
            >
              <div
                className="document-action-grid"
                role="group"
                aria-label="支払方法（算定停止中のため選択不可）"
              >
                {PAYMENT_METHODS.map((method) => (
                  <PrototypeAction key={method} reason={PAYMENT_METHOD_REASON}>
                    {method}
                  </PrototypeAction>
                ))}
              </div>
              <KeyValueList
                items={[
                  { label: "受領金額", value: "—（未算定）" },
                  { label: "お釣り", value: "—（未算定）" },
                ]}
              />
              <div className="panel-footer-actions">
                <PrototypeAction
                  kind="primary"
                  reason="RB-008 で算定が停止し、会計確定 operation も未登録のため実行できません"
                >
                  会計を確定する
                </PrototypeAction>
                <PrototypeAction reason="会計の一時保存 operation が未登録のため実行できません">
                  一時保存
                </PrototypeAction>
              </div>
            </Panel>
          </div>
        </div>

        <Panel
          title="会計履歴"
          description="会計履歴の API operation が UIX-001 §12.3 に未登録のため表示しません。"
        >
          <TableScroll label="会計履歴表">
            <table className="operator-table">
              <caption className="operator-table-caption">
                未登録の会計履歴。行が無いことは履歴なし・未収なし・返金なしを意味しません。
              </caption>
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
                    会計履歴の API operation が未登録のため表示できません。履歴なし・未収なし・返金なしを意味しません。
                  </td>
                </tr>
              </tbody>
            </table>
          </TableScroll>
        </Panel>
      </OperatorPage>
    </section>
  );
}
