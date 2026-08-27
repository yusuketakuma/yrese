import {
  MetricCard,
  OperatorPage,
  Panel,
  PrototypeAction,
  PrototypeBanner,
  RailCard,
  ScreenHeader,
  StatusPill,
  TableScroll,
} from "../components/operator-ui";
import { CloudHealthCard } from "./cloud-health-card";
import { ModeOverviewTable } from "./mode-overview";
import { OutboxBoard } from "./outbox-board";

/**
 * 同期状態・外部連携(SCR-025)。
 *
 * 患者横断・バッチ画面であり、患者文脈を持ち込まない
 * (components/patient-context-route-policy.ts の allowlist 外)。
 *
 * 実データとして表示するのは 2 つだけである。
 * - `GET /health` のクラウド稼働確認(到達できたことのみ。同期の正常性ではない)
 * - `GET /operations/outbox-summary` の outbox 配送件数(件数・時刻・種別のみ)
 *
 * それ以外の外部連携はいずれも停止したゲートを名指しして未接続として示す。
 * 未処理件数の「—」は0件を意味しない。
 */

const INTEGRATIONS = [
  {
    name: "オンライン資格確認",
    nextAction: "RB-002（規制レビュー未了・BLOCKED_REGULATORY_REVIEW）の承認を待ちます",
    detail: "接続契約と端末境界が未確定で、資格確認を実行する経路がありません。",
  },
  {
    name: "電子処方箋",
    nextAction: "RB-003（規制レビュー未了・BLOCKED_REGULATORY_REVIEW）の承認を待ちます",
    detail: "ONS仕様の版確認と接続試験が未了で、受信・登録の経路がありません。",
  },
  {
    name: "オンライン請求",
    nextAction: "RB-004（規制レビュー未了・BLOCKED_REGULATORY_REVIEW）の承認を待ちます",
    detail: "公式な受渡し方式が未確定で、請求データの送信経路がありません。",
  },
  {
    name: "マスター配信",
    nextAction: "MST-001（マスター取込 blocker）の解除を待ちます",
    detail: "取込・検証・適用・Edge配布のパイプラインが未承認で、版を取得していません。",
  },
  {
    name: "ローカル同期",
    nextAction: "R-OFFLINE 永続層の実装を待ちます",
    detail: "薬局内Edgeの永続層が未実装で、同期対象を保持していません。",
  },
] as const;

const MODE_BOUNDARY =
  "システムモード未検知。モード検知APIが存在しないため、NORMAL・障害・オフラインのいずれも推測しません。外部連携はすべて未接続で、緑色の正常表示や連携成功を推測しません。この画面で実測を表示するのはクラウドAPIの稼働確認と outbox の配送件数だけで、いずれも同期・外部連携・モードの正常性を意味しません。未処理件数の「—」は0件を意味しません。";

export default function Page() {
  return (
    <section data-screen-scope="batch" aria-label="同期状態・外部連携">
      <OperatorPage
        railLabel="同期状態の補助情報"
        rail={
          <>
            <RailCard title="現在のシステムモード" tone="warning">
              <StatusPill tone="warning">未検知</StatusPill>
              <p className="rail-muted">
                モード検知バックエンドは未接続です。NORMAL・障害・オフラインのいずれも推測しません。
              </p>
            </RailCard>
            <RailCard title="画面スコープ" tone="info">
              <StatusPill tone="info">患者横断・バッチ単位</StatusPill>
              <p className="rail-muted">
                この画面は患者単位の業務画面ではありません。選択患者バーと患者固有の右レールは表示しません。
              </p>
            </RailCard>
            <RailCard title="障害時の対応ガイド" tone="info">
              <ol className="rail-steps">
                <li>現在モードと警告を確認</li>
                <li>影響サービスと未処理件数を確認</li>
                <li>再試行または正式な障害手順へ</li>
              </ol>
            </RailCard>
            <RailCard title="件数の読み方" tone="danger">
              <ul className="rail-action-list">
                <li>外部サービス連携は全て未接続です</li>
                <li>未処理件数「—」はゼロを意味しません</li>
                <li>outbox の件数は配送意図の実測で、相手側の受領確認ではありません</li>
              </ul>
            </RailCard>
          </>
        }
      >
        <ScreenHeader
          title="同期状態・外部連携"
          description="クラウド、薬局内Edge、外部公的サービス、配送キューの状態を分離して表示します。実測できる区画と未接続の区画を混ぜません。"
          meta={<StatusPill tone="warning">モード検知未接続・outbox のみ実測</StatusPill>}
          actions={
            <PrototypeAction reason="モード検知・Edge状態・外部連携の取得経路が未接続のため、画面全体の一括更新はできません（outbox 配送状況のみ個別に再取得できます）">
              手動で最新に更新
            </PrototypeAction>
          }
        />
        {/* 行折り返しで JSX が空白を挿入しないよう、境界文言は 1 つの文字列として渡す。 */}
        <PrototypeBanner tone="warning">{MODE_BOUNDARY}</PrototypeBanner>

        <OutboxBoard
          leadingMetrics={
            <>
              <CloudHealthCard />
              <MetricCard
                label="オンプレミス / Edge"
                value="未検知"
                detail="Edge状態APIが未実装です。稼働・停止のいずれも推測しません。"
                tone="warning"
                icon="端"
              />
              <MetricCard
                label="外部サービス連携"
                value="未接続"
                detail="RB-002 / RB-003 / RB-004 の規制レビューと MST-001 で停止中。成功扱いにしません。"
                tone="warning"
                icon="外"
              />
            </>
          }
        />

        <section
          className="operator-stack"
          data-operational-data="unavailable"
          aria-label="未接続の外部連携とモード判定"
        >
          <Panel
            title="同期・連携ステータスボード"
            description="各サービスがどのゲートで止まっているかを明示します。未処理件数の「—」は0件を意味しません。"
          >
            <TableScroll label="外部連携・同期項目ごとの状態。横方向にスクロールできます">
              {/* shell-smoke.test.tsx が thead の5列構成を正規表現で検証する。
                  table への属性追加・列の増減・caption 追加は契約違反。 */}
              <table className="operator-table"><thead><tr>
                <th scope="col">連携 / 同期項目</th>
                <th scope="col">現在の状態</th>
                <th scope="col">未処理件数</th>
                <th scope="col">次のアクション</th>
                <th scope="col">詳細</th>
              </tr></thead>
                <tbody>
                  {INTEGRATIONS.map((integration) => (
                    <tr key={integration.name}>
                      <th scope="row">{integration.name}</th>
                      <td>
                        <StatusPill tone="warning">未接続</StatusPill>
                      </td>
                      <td>—</td>
                      <td>{integration.nextAction}</td>
                      <td>{integration.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </Panel>

          <div className="operator-two-column">
            <Panel title="現在モードの操作可否">
              <StatusPill tone="danger">判定不可・実行不可</StatusPill>
              <p className="operator-empty-copy">
                モード検知、権限、接続状態の確認が揃うまで、外部確認・確定算定・月次締めを許可しません。
              </p>
            </Panel>
            <Panel title="モード別可否早見表（静的リファレンス）">
              <p className="operator-empty-copy">
                表の「可」は shared-kernel のモードガード上の参考であり、現在の実行許可ではありません。現在モードは未検知のため、現在行を示しません。
              </p>
              <ModeOverviewTable />
            </Panel>
          </div>

          <Panel title="最近の同期イベント（ジョブキュー）">
            <p className="operator-empty-copy">
              ジョブキューの履歴APIは未実装です。履歴が表示されないことは、実行済み・成功済みを意味しません。outbox に記録された配送意図の件数だけは上の「outbox 配送状況」で実測できます。
            </p>
          </Panel>
        </section>
      </OperatorPage>
    </section>
  );
}
