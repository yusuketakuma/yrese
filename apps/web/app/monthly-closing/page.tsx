import { allowsClaimFinalization } from "@yrese/shared-kernel";

import { PermissionState, ReadOnlyIndicator } from "../components/audit-metadata";
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

const BATCH_ROWS = [
  ["B2608001", "医科", "8/1〜8/7", "124件", "¥3,215,480", "点検済み"],
  ["B2608002", "医科", "8/8〜8/14", "118件", "¥3,112,650", "点検済み"],
  ["B2608003", "調剤", "8/1〜8/10", "256件", "¥5,642,930", "点検済み"],
  ["B2608004", "調剤", "8/11〜8/20", "198件", "¥3,782,870", "提出待ち"],
] as const;

export default function Page() {
  const currentMode = "NORMAL" as const;
  const modeAllowed = allowsClaimFinalization(currentMode);

  return (
    <OperatorPage
      rail={
        <>
          <RailCard title="対象月の概要">
            <p className="rail-muted">2026年8月診療分（合成例）</p>
            <dl className="key-value-list"><div><dt>対象期間</dt><dd>2026/8/1〜2026/8/31</dd></div><div><dt>請求件数</dt><dd>872件（合成例）</dd></div></dl>
          </RailCard>
          <RailCard title="オペレーターへのお願い" tone="warning">
            <ul className="rail-action-list"><li>未提出バッチの内容を確認</li><li>返戻7件の再請求可否を確認</li><li>電子レセプト正常性チェックは未接続</li></ul>
          </RailCard>
          <RailCard title="実行可否">
            <PermissionState allowed={modeAllowed} actionLabel="月次締め・請求データロック（モードゲート）" reason="NORMALモードでのみ実行できます" />
            {!modeAllowed ? <ReadOnlyIndicator reason="現在のシステムモードでは締めを実行できません" /> : null}
          </RailCard>
        </>
      }
    >
      <ScreenHeader
        title="月次締め・返戻管理"
        description="点検、請求データ作成、ロック、提出、返戻・再請求を段階表示します。"
        meta={<StatusPill tone="warning">締めAPI未接続</StatusPill>}
        actions={<PrototypeAction kind="primary">締め処理を開始</PrototypeAction>}
      />
      <PrototypeBanner>
        月次バッチ、金額、ロック、提出、返戻は合成例です。請求データ作成・ロック・送信は実行されません。
      </PrototypeBanner>
      <MetricGrid>
        <MetricCard label="締めの進捗" value="65%" detail="合成例" tone="accent" icon="進" />
        <MetricCard label="未提出（提出待ち）" value="2" unit="件" detail="合成例" tone="info" icon="提" />
        <MetricCard label="返戻・再請求" value="7" unit="件" detail="合成例" tone="warning" icon="!" />
        <MetricCard label="ロック状態" value="未実行" detail="ロックAPI未接続" tone="danger" icon="鍵" />
      </MetricGrid>

      <Panel title="締め処理の進捗">
        <ol className="closing-stepper">
          {[
            ["点検", "UI例"], ["請求データ作成", "未接続"], ["ロック", "未実行"], ["提出待ち", "未接続"], ["提出済み", "未接続"],
          ].map(([label, status], index) => (
            <li key={label} data-step={index + 1} data-state={index === 0 ? "current" : "future"}><strong>{label}</strong><small>{status}</small></li>
          ))}
        </ol>
      </Panel>

      <Panel title="請求データ（提出状況）" description="合成データ。">
        <div className="table-scroll"><table className="operator-table"><thead><tr><th>バッチNo.</th><th>区分</th><th>対象期間</th><th>件数</th><th>予定額</th><th>状態</th><th>操作</th></tr></thead><tbody>
          {BATCH_ROWS.map((row) => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td>{row[4]}</td><td><StatusPill tone={row[5] === "点検済み" ? "success" : "warning"}>{row[5]}</StatusPill></td><td><PrototypeAction>詳細を見る</PrototypeAction></td></tr>)}
        </tbody></table></div>
      </Panel>

      <Panel title="返戻・再請求（要対応一覧）" description="返戻理由マスター・再請求処理は未接続です。">
        <div className="table-scroll"><table className="operator-table"><thead><tr><th>返戻日</th><th>区分</th><th>請求バッチ</th><th>件数</th><th>返戻理由（概要）</th><th>状態</th><th>操作</th></tr></thead><tbody>
          <tr><td>8/22</td><td>調剤</td><td>B2608002</td><td>2件</td><td>摘要欄の記載漏れ（合成例）</td><td><StatusPill tone="warning">要再請求</StatusPill></td><td><PrototypeAction>詳細を見る</PrototypeAction></td></tr>
          <tr><td>8/20</td><td>医科</td><td>B2608001</td><td>1件</td><td>負担割合の誤り（合成例）</td><td><StatusPill tone="danger">再請求準備中</StatusPill></td><td><PrototypeAction>対応する</PrototypeAction></td></tr>
        </tbody></table></div>
      </Panel>
    </OperatorPage>
  );
}
