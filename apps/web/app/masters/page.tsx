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

const MASTER_ROWS = [
  ["医薬品マスター", "UI-SAMPLE-2024.07-1", "適用日 2024/07/01", "未接続"],
  ["薬価マスター", "UI-SAMPLE-2024.07-1", "適用日 2024/07/01", "未接続"],
  ["一般名マスター", "UI-SAMPLE-2024.06-2", "適用日 2024/06/25", "未接続"],
  ["効能・効果マスター", "UI-SAMPLE-2024.06-1", "適用日 2024/06/20", "未接続"],
  ["薬価基準収載マスター", "UI-SAMPLE-2024.07-1", "適用日 2024/07/01", "未接続"],
  ["後発医薬品マスター", "UI-SAMPLE-2024.06-3", "適用日 2024/06/28", "要確認"],
] as const;

export default function Page() {
  return (
    <OperatorPage
      rail={
        <>
          <RailCard title="システムヘルス" tone="warning">
            <StatusPill tone="warning">更新パイプライン未接続</StatusPill>
            <p className="rail-muted">最終取得・ハッシュ・署名・差分検証はまだ実行していません。</p>
          </RailCard>
          <RailCard title="マスター同期状態" tone="warning">
            <StatusPill tone="warning">未検証</StatusPill>
            <p className="rail-muted">未接続を「最新」または「正常」と表示しません。</p>
          </RailCard>
          <RailCard title="運用メモ">
            <ul className="rail-action-list"><li>公式提供元・版・取得日・ハッシュを記録</li><li>適用日と経過措置を別管理</li><li>失敗時は旧版を暗黙継続せず要確認</li></ul>
          </RailCard>
        </>
      }
    >
      <ScreenHeader
        title="マスター管理"
        description="医薬品・薬価・一般名・コメント・保険者・公費マスターの版と適用日を管理します。"
        meta={<StatusPill tone="warning">master_update_pipeline未承認</StatusPill>}
        actions={<><PrototypeAction kind="primary">更新を確認</PrototypeAction><PrototypeAction>インポート履歴</PrototypeAction><PrototypeAction>差分を見る</PrototypeAction></>}
      />
      <PrototypeBanner tone="danger">
        表示版・件数・履歴はUI合成例です。公式マスターの取得、検証、適用、Edge配布は実行されません。
      </PrototypeBanner>
      <MetricGrid>
        <MetricCard label="薬価マスター（適用候補）" value="未接続" detail="版情報を推測しません" tone="accent" icon="マ" />
        <MetricCard label="医薬品マスター件数" value="—" unit="件" detail="取得API未接続" tone="info" icon="薬" />
        <MetricCard label="要更新件数" value="—" unit="件" detail="差分検証未接続" tone="warning" icon="!" />
        <MetricCard label="期限切れ件数" value="—" unit="件" detail="有効日判定未接続" tone="danger" icon="時" />
      </MetricGrid>

      <Panel title="マスター一覧" description="合成版情報。状態は未接続を明示します。">
        <div className="operator-tabs" role="tablist" aria-label="マスター種別（未接続）">
          {["医薬品", "薬価", "コメント", "保険者", "公費"].map((tab, index) => <button key={tab} type="button" role="tab" aria-selected={index === 0} disabled>{tab}</button>)}
        </div>
        <div className="table-scroll"><table className="operator-table"><thead><tr><th>マスター名</th><th>バージョン</th><th>適用情報</th><th>更新状態</th><th>提供元</th><th>操作</th></tr></thead><tbody>
          {MASTER_ROWS.map((row) => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td><StatusPill tone={row[3] === "要確認" ? "warning" : "neutral"}>{row[3]}</StatusPill></td><td>公式提供元（接続前）</td><td><PrototypeAction>詳細</PrototypeAction></td></tr>)}
        </tbody></table></div>
      </Panel>

      <div className="operator-two-column">
        <Panel title="インポート履歴（直近5件）">
          <p className="operator-empty-copy">取得・検証・適用履歴はまだありません。</p>
        </Panel>
        <Panel title="注意が必要なマスター" tone="warning">
          <div className="warning-list">
            <article><StatusPill tone="warning">要確認</StatusPill><div><strong>後発医薬品マスター</strong><p>公式版・適用日・差分の検証が必要です。</p></div><PrototypeAction>更新を確認</PrototypeAction></article>
            <article><StatusPill tone="warning">未接続</StatusPill><div><strong>一般名マスター</strong><p>更新パイプライン接続前です。</p></div><PrototypeAction>更新を確認</PrototypeAction></article>
          </div>
        </Panel>
      </div>
    </OperatorPage>
  );
}
