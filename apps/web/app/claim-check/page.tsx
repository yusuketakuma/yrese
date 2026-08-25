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

const CHECK_ROWS = [
  ["000098", "合成患者A", "算定根拠", "調剤基本料の算定要件を確認してください", "エラー"],
  ["000097", "合成患者B", "公費", "公費負担者番号の有効期間を確認してください", "エラー"],
  ["000096", "合成患者C", "資格確認", "資格結果が取得できません", "要確認"],
  ["000095", "合成患者D", "コメント", "患者コメントが未入力です", "警告"],
  ["000094", "合成患者E", "添付書類", "特定疾患受給者証の添付確認が必要です", "要確認"],
] as const;

function toneForStatus(status: string) {
  if (status === "エラー") return "danger" as const;
  if (status === "警告") return "warning" as const;
  return "info" as const;
}

export default function Page() {
  return (
    <OperatorPage
      rail={
        <>
          <PatientContextRail />
          <RailCard title="根拠・トレース" tone="warning">
            <StatusPill tone="warning">evidence_id未接続</StatusPill>
            <p className="rail-muted">
              画面内の根拠名はレイアウト例です。公式仕様・法令・算定根拠へのリンクとは扱いません。
            </p>
          </RailCard>
          <RailCard title="請求前点検のポイント" tone="info">
            <p className="rail-muted">エラーは必ず修正し、警告は理由を確認してから請求候補へ追加します。</p>
          </RailCard>
        </>
      }
    >
      <ScreenHeader
        title="請求前点検"
        description="資格・算定・公費・コメント・添付書類を、請求候補へ追加する前に確認します。"
        meta={<StatusPill tone="danger">BLOCKED_REGULATORY_REVIEW</StatusPill>}
      />
      <PrototypeBanner tone="danger">
        点検ルール、算定根拠、記録条件仕様、請求候補追加APIは未接続です。表示結果は合成例です。
      </PrototypeBanner>
      <MetricGrid>
        <MetricCard label="点検対象件数" value="42" unit="件" detail="合成例" tone="accent" icon="点" />
        <MetricCard label="エラー" value="8" unit="件" detail="合成例" tone="danger" icon="!" />
        <MetricCard label="警告" value="17" unit="件" detail="合成例" tone="warning" icon="△" />
        <MetricCard label="点検完了" value="17" unit="件" detail="合成例" tone="success" icon="✓" />
      </MetricGrid>

      <Panel title="フィルターと点検項目">
        <div className="filter-grid">
          <label>点検区分<select disabled><option>すべて</option></select></label>
          <label>重大度<select disabled><option>すべて</option></select></label>
          <label>状態<select disabled><option>すべて</option></select></label>
          <label>受付日<input type="date" value="2025-05-20" readOnly /></label>
        </div>
        <div className="check-chip-row">
          {["資格確認", "算定根拠", "公費", "コメント", "添付書類"].map((item) => (
            <label key={item}><input type="checkbox" defaultChecked disabled /> {item}</label>
          ))}
        </div>
      </Panel>

      <Panel
        title="点検結果一覧"
        description="合成データ。修正・請求候補追加は実行されません。"
        actions={<PrototypeAction>CSV出力</PrototypeAction>}
      >
        <div className="table-scroll">
          <table className="operator-table operator-table-dense">
            <thead><tr><th>受付番号</th><th>患者</th><th>点検区分</th><th>内容</th><th>重大度</th><th>推奨対応</th><th>操作</th></tr></thead>
            <tbody>
              {CHECK_ROWS.map((row) => (
                <tr key={row[0]}>
                  <td>{row[0]}</td><td>{row[1]}</td><td><StatusPill tone="accent">{row[2]}</StatusPill></td>
                  <td>{row[3]}</td><td><StatusPill tone={toneForStatus(row[4])}>{row[4]}</StatusPill></td>
                  <td>根拠を確認し、必要に応じて修正（合成例）</td><td><PrototypeAction>修正へ</PrototypeAction></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sticky-action-bar">
          <KeyValueList items={[{ label: "選択中", value: "0件" }, { label: "合計点数", value: "0点（0円）" }]} />
          <div><PrototypeAction>保留</PrototypeAction><PrototypeAction>修正へ</PrototypeAction><PrototypeAction kind="primary">請求候補へ追加</PrototypeAction></div>
        </div>
      </Panel>
    </OperatorPage>
  );
}
