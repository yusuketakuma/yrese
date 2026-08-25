import {
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

const MASTER_NAMES = [
  "医薬品マスター",
  "薬価マスター",
  "一般名マスター",
  "効能・効果マスター",
  "薬価基準収載マスター",
  "後発医薬品マスター",
] as const;

export default function Page() {
  return (
    <section data-operational-data="unavailable" aria-label="マスター管理">
      <OperatorPage
        railLabel="マスター管理の補助情報"
        rail={
          <>
            <RailCard title="システムヘルス" tone="warning">
              <StatusPill tone="warning">更新パイプライン未接続</StatusPill>
              <p className="rail-muted">
                最終取得・ハッシュ・署名・差分検証は実行していません。
              </p>
            </RailCard>
            <RailCard title="マスター同期状態" tone="warning">
              <StatusPill tone="warning">未検証</StatusPill>
              <p className="rail-muted">未接続を「最新」または「正常」と表示しません。</p>
            </RailCard>
            <RailCard title="運用メモ">
              <ul className="rail-action-list">
                <li>公式提供元・版・取得日・ハッシュを記録</li>
                <li>適用日と経過措置を別管理</li>
                <li>失敗時は旧版を暗黙継続せず要確認</li>
              </ul>
            </RailCard>
          </>
        }
      >
        <ScreenHeader
          title="マスター管理"
          description="医薬品・薬価・一般名・コメント・保険者・公費マスターの版と適用日を管理します。"
          meta={<StatusPill tone="warning">master_update_pipeline未承認</StatusPill>}
          actions={
            <>
              <PrototypeAction kind="primary" reason="更新パイプライン未接続">
                更新を確認
              </PrototypeAction>
              <PrototypeAction reason="インポート履歴API未接続">
                インポート履歴
              </PrototypeAction>
              <PrototypeAction reason="差分検証API未接続">差分を見る</PrototypeAction>
            </>
          }
        />
        <PrototypeBanner>
          公式マスターの版・件数・適用日・履歴は未取得です。取得、検証、適用、Edge配布は実行されません。
        </PrototypeBanner>
        <MetricGrid>
          <MetricCard label="薬価マスター版" value="—" detail="版情報未取得" tone="neutral" icon="マ" />
          <MetricCard label="医薬品マスター件数" value="—" unit="件" detail="0件を意味しません" tone="neutral" icon="薬" />
          <MetricCard label="要更新件数" value="—" unit="件" detail="差分判定未接続" tone="neutral" icon="?" />
          <MetricCard label="期限切れ件数" value="—" unit="件" detail="有効日判定未接続" tone="neutral" icon="?" />
        </MetricGrid>

        <Panel title="マスター一覧" description="マスター名だけを静的表示し、版・適用状態は推測しません。">
          <div className="operator-tabs" role="tablist" aria-label="マスター種別（未接続）">
            {["医薬品", "薬価", "コメント", "保険者", "公費"].map((tab, index) => (
              <button key={tab} type="button" role="tab" aria-selected={index === 0} disabled>
                {tab}
              </button>
            ))}
          </div>
          <div className="table-scroll" tabIndex={0} aria-label="マスター一覧表">
            <table className="operator-table">
              <caption className="visually-hidden">未接続のマスター一覧</caption>
              <thead>
                <tr>
                  <th scope="col">マスター名</th>
                  <th scope="col">バージョン</th>
                  <th scope="col">適用情報</th>
                  <th scope="col">更新状態</th>
                  <th scope="col">提供元</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {MASTER_NAMES.map((name) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>—</td>
                    <td>—</td>
                    <td><StatusPill tone="neutral">未取得</StatusPill></td>
                    <td>—</td>
                    <td><PrototypeAction reason={`${name}の版情報API未接続`}>詳細</PrototypeAction></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="operator-two-column">
          <Panel title="インポート履歴">
            <p className="operator-empty-copy">
              履歴API未接続のため表示できません。履歴なし・更新不要を意味しません。
            </p>
          </Panel>
          <Panel title="注意が必要なマスター" tone="warning">
            <StatusPill tone="warning">判定不能</StatusPill>
            <p className="operator-empty-copy">
              公式版、適用日、差分、有効期限を取得できないため、注意対象を判定できません。
            </p>
          </Panel>
        </div>
      </OperatorPage>
    </section>
  );
}
