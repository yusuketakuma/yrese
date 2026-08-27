import { ReadOnlyIndicator } from "../components/audit-metadata";
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
  TableScroll,
} from "../components/operator-ui";
import {
  ClaimFinalizationModeMatrix,
  ClosingExecutionAuthority,
  ClosingReceptionSummary,
} from "./closing-authority";

/**
 * SCR-020 月次締め・返戻管理。
 *
 * 締め・請求データロック・オンライン請求送信は実行できない(未登録の不可逆 operation)。
 * 実データとして表示するのはセッション権限(/whoami)と保存済み受付の件数
 * (/operations/reception-summary)だけで、締め進捗・請求バッチ・返戻は未接続のまま
 * 「未取得」と明示する。ゲート名は closing-authority.tsx の CLOSING_BLOCKING_GATES が正本。
 */

const CLOSING_STEPS = [
  "点検",
  "請求データ作成",
  "ロック",
  "提出待ち",
  "提出済み",
] as const;

export default function Page() {
  return (
    <section data-operational-data="unavailable" aria-label="月次締め・返戻管理">
      <OperatorPage
        railLabel="月次締めの補助情報"
        rail={
          <>
            <RailCard title="実行可否" tone="danger">
              <StatusPill tone="danger">確定・ロック・送信は実行不可</StatusPill>
              <p className="rail-muted">
                セッション権限の実測とゲートの内訳は、本文の「実行権限とゲート」で確認してください。権限が付与されていても実行可にはなりません。
              </p>
              <ReadOnlyIndicator reason="UIX-001 §12.3 未登録の不可逆 operation・RB-001・RB-004 のため閲覧のみ" />
            </RailCard>
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
              <p className="rail-muted">
                いずれも本画面では取得していません。表示されないことは「該当なし」を意味しません。
              </p>
            </RailCard>
          </>
        }
      >
        <ScreenHeader
          title="月次締め・返戻管理"
          description="締め工程の順序、実行権限とゲート、保存済み受付の件数を表示します。締め・ロック・送信は実行しません。"
          meta={<StatusPill tone="warning">締めAPI未接続</StatusPill>}
          actions={
            <PrototypeAction
              kind="primary"
              reason="UIX-001 §12.3 に未登録の不可逆 operation で、RB-001・RB-004 も停止中のため実行できません"
            >
              締め処理を開始
            </PrototypeAction>
          }
        />
        <PrototypeBanner>
          月次締め・請求データロックは実行できません。claim:finalize の API operation は UIX-001 §12.3 の operation authorization matrix に未登録で、電子レセプト生成は RB-001、オンライン請求送信は RB-004（公式接続方式・電子証明書・接続試験・運用規約の確認が未了）で停止しています。確定・ロック・送信は AGENTS.md の人間承認ゲート対象であり、システム側で自己承認しません。システムモードは検知APIが存在しないため未検知で、NORMAL を前提にしません。「—」は0件・提出済み・対応完了を意味しません。
        </PrototypeBanner>
        <MetricGrid>
          <MetricCard
            label="締めの進捗"
            value="—"
            detail="締め進捗の operation が UIX-001 §12.3 に未登録のため未取得"
            tone="neutral"
            icon="?"
          />
          <MetricCard
            label="未提出"
            value="—"
            unit="件"
            detail="RB-001 で電子レセプト生成が停止中。0件を意味しません"
            tone="neutral"
            icon="?"
          />
          <MetricCard
            label="返戻・再請求"
            value="—"
            unit="件"
            detail="返戻取込の承認済み契約が無く未接続。0件を意味しません"
            tone="neutral"
            icon="?"
          />
          <MetricCard
            label="ロック状態"
            value="未検知"
            detail="ARC-007 が不可逆性を規定。ロック operation は未登録で実行・検知いずれも未接続"
            tone="warning"
            icon="鍵"
          />
        </MetricGrid>

        <Panel
          title="実行権限とゲート"
          description="セッションの scope は /whoami の実データです。権限判定とゲート判定を分けて表示します。"
          className="live-surface-panel"
          tone="danger"
        >
          <ClosingExecutionAuthority />
        </Panel>

        <Panel
          title="システムモード別の確定可否"
          description="shared-kernel のモードガード（allowsClaimFinalization）による静的な可否です。現在のモードは検知していません。"
        >
          <ClaimFinalizationModeMatrix />
        </Panel>

        <Panel
          title="指定業務日の受付件数"
          description="保存済みの受付データを業務日単位で集計した実データです。患者識別情報は取得しません。"
          className="live-surface-panel"
        >
          <ClosingReceptionSummary />
        </Panel>

        <Panel
          title="締め処理の進捗"
          description="工程順のみを示す静的リファレンスです。各工程の到達状況は取得していません。"
        >
          <ol className="closing-stepper">
            {CLOSING_STEPS.map((label, index) => (
              <li key={label} data-step={index + 1} data-state="unknown">
                <strong>{label}</strong>
                <small>状態未取得</small>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel
          title="請求データ（提出状況）"
          description="RB-001（記録条件仕様 evidence_id 未発行）と RB-004（オンライン請求送信の規制レビュー中）のため未接続です。"
        >
          <TableScroll label="請求データ提出状況表">
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
                    RB-001・RB-004 で停止中のため表示できません。未提出なし・提出済みを意味しません。
                  </td>
                </tr>
              </tbody>
            </table>
          </TableScroll>
        </Panel>

        <Panel
          title="返戻・再請求（要対応一覧）"
          description="返戻取込の承認済み契約が無いため未接続です。UIX-001 §12.4 が external-register の実装を止めています。"
        >
          <TableScroll label="返戻・再請求一覧表">
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
                    返戻取込が未接続のため表示できません。返戻0件・対応完了を意味しません。
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
