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

const CLOSING_STEPS = [
  "点検",
  "請求データ作成",
  "ロック",
  "提出待ち",
  "提出済み",
] as const;

export default function Page() {
  const executionAllowed = false;

  return (
    <section data-operational-data="unavailable" aria-label="月次締め・返戻管理">
      <OperatorPage
        railLabel="月次締めの補助情報"
        rail={
          <>
            <RailCard title="対象月の概要" tone="warning">
              <StatusPill tone="warning">対象月・集計API未接続</StatusPill>
              <p className="rail-muted">
                対象月、請求件数、予定額は未取得です。「—」は0件・0円を意味しません。
              </p>
            </RailCard>
            <RailCard title="オペレーターへの確認事項" tone="info">
              <ul className="rail-action-list">
                <li>対象月と締め対象範囲を確認</li>
                <li>未提出・返戻・再請求の実件数を確認</li>
                <li>電子レセプト正常性と提出結果を確認</li>
              </ul>
            </RailCard>
            <RailCard title="実行可否" tone="danger">
              <PermissionState
                allowed={executionAllowed}
                actionLabel="月次締め・請求データロック"
                reason="モード検知・締めAPI・権限判定が未接続です"
              />
              <ReadOnlyIndicator reason="接続・承認・実測が揃うまで締め処理は実行できません" />
            </RailCard>
          </>
        }
      >
        <ScreenHeader
          title="月次締め・返戻管理"
          description="点検、請求データ作成、ロック、提出、返戻・再請求を段階表示します。"
          meta={<StatusPill tone="warning">締めAPI未接続</StatusPill>}
          actions={
            <PrototypeAction
              kind="primary"
              reason="対象月・権限・モード・締めAPIが未接続です"
            >
              締め処理を開始
            </PrototypeAction>
          }
        />
        <PrototypeBanner>
          月次バッチ、金額、提出、返戻の運用データは表示していません。請求データ作成・ロック・送信は実行されません。
        </PrototypeBanner>
        <MetricGrid>
          <MetricCard label="締めの進捗" value="—" detail="進捗API未接続" tone="neutral" icon="?" />
          <MetricCard label="未提出" value="—" unit="件" detail="0件を意味しません" tone="neutral" icon="?" />
          <MetricCard label="返戻・再請求" value="—" unit="件" detail="0件を意味しません" tone="neutral" icon="?" />
          <MetricCard label="ロック状態" value="未検知" detail="ロックAPI未接続" tone="warning" icon="鍵" />
        </MetricGrid>

        <Panel title="締め処理の進捗" description="工程順のみを示す静的リファレンスです。">
          <ol className="closing-stepper">
            {CLOSING_STEPS.map((label, index) => (
              <li key={label} data-step={index + 1} data-state="unknown">
                <strong>{label}</strong>
                <small>状態未取得</small>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="請求データ（提出状況）" description="バッチAPI接続後に表示します。">
          <div className="table-scroll" tabIndex={0} aria-label="請求データ提出状況表">
            <table className="operator-table">
              <caption className="visually-hidden">未接続の請求データ提出状況</caption>
              <thead>
                <tr>
                  <th scope="col">バッチNo.</th>
                  <th scope="col">区分</th>
                  <th scope="col">対象期間</th>
                  <th scope="col">件数</th>
                  <th scope="col">予定額</th>
                  <th scope="col">状態</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} className="operator-empty-copy">
                    バッチAPI未接続のため表示できません。未提出なし・提出済みを意味しません。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="返戻・再請求（要対応一覧）" description="返戻API接続後に表示します。">
          <div className="table-scroll" tabIndex={0} aria-label="返戻・再請求一覧表">
            <table className="operator-table">
              <caption className="visually-hidden">未接続の返戻・再請求一覧</caption>
              <thead>
                <tr>
                  <th scope="col">返戻日</th>
                  <th scope="col">区分</th>
                  <th scope="col">請求バッチ</th>
                  <th scope="col">件数</th>
                  <th scope="col">返戻理由</th>
                  <th scope="col">状態</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} className="operator-empty-copy">
                    返戻API未接続のため表示できません。返戻0件・対応完了を意味しません。
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
