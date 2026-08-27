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
import { ReceptionIntegrityBoard } from "./reception-integrity-board";

/**
 * 請求前点検(SCR-019)。
 *
 * 点検ルール・点数・算定根拠・請求可否判定はこの画面に実装しない。
 * 記録条件仕様が RB-001 BLOCKED_REGULATORY_REVIEW で停止しており、点検ルールは
 * その記録条件から導出されるため同時に停止する。算定根拠は RB-008、請求コード決定は
 * RB-009 BLOCKED_CODE_MAPPING_REVIEW。UIX-001 §12.3 の operation registry に
 * SCR-019 (claim:read) の行が無く、未登録 operation は有効化しない。
 *
 * 患者横断・バッチ画面であり、患者文脈レール・患者識別情報を持ち込まない。
 * 唯一の接続領域は ReceptionIntegrityBoard(件数のみを返す集計API)である。
 */
export default function Page() {
  return (
    <section
      data-screen-scope="batch"
      data-operational-data="unavailable"
      aria-label="請求前点検"
    >
      <OperatorPage
        railLabel="請求前点検の補助情報"
        rail={
          <>
            <RailCard title="画面スコープ" tone="info">
              <StatusPill tone="info">患者横断・バッチ単位</StatusPill>
              <p className="rail-muted">
                この画面は単一患者の会計画面ではありません。選択患者バーと患者固有右レールは表示しません。
              </p>
            </RailCard>
            <RailCard title="停止しているゲート" tone="warning">
              <StatusPill tone="warning">点検ルール未提供</StatusPill>
              <p className="rail-muted">
                記録条件仕様は RB-001（規制レビュー未了）、算定根拠は RB-008、請求コード決定は RB-009（コード対応レビュー未了）で停止しています。UIX-001 §12.3 の operation registry にも SCR-019（claim:read）の行がありません。
              </p>
            </RailCard>
            <RailCard title="件数の読み方" tone="info">
              <p className="rail-muted">
                下段に出る件数は保存済み受付の実測値です。点検結果ではありません。件数が0でも点検済み・請求可能を意味しません。「—」は0件を意味しません。
              </p>
            </RailCard>
            <RailCard title="根拠・トレース" tone="warning">
              <StatusPill tone="warning">evidence_id未接続</StatusPill>
              <p className="rail-muted">
                画面内の根拠名はレイアウト例です。公式仕様・法令・算定根拠へのリンクとは扱いません。
              </p>
            </RailCard>
            <RailCard title="点検の原則" tone="info">
              <p className="rail-muted">
                エラーは修正、警告・要確認は根拠と対象患者を開いて確認してから請求候補へ進めます。
              </p>
            </RailCard>
          </>
        }
      >
        <ScreenHeader
          title="請求前点検"
          description="資格・算定・公費・コメント・添付書類の点検は未提供です。この画面では保存済みの受付・資格確認件数だけを患者横断で確認できます。"
          // 停止ゲートの詳細は直下の PrototypeBanner が正本。pill は状態だけを示す。
          meta={<StatusPill tone="danger">点検ルール停止中</StatusPill>}
        />
        <PrototypeBanner tone="danger">
          {/* 行折り返しで JSX が空白を挿入しないよう、境界文言は 1 つの文字列として渡す。 */}
          {"請求前点検ルールは提供できません。電子レセプトの記録条件仕様は RB-001 BLOCKED_REGULATORY_REVIEW（版確認と evidence_id 発行、electronic_receipt_design の APPROVED が未了）、算定根拠は RB-008、請求コード決定は RB-009 BLOCKED_CODE_MAPPING_REVIEW で停止しています。以下に表示するのは受付と資格確認状態の保存済み実件数のみで、点検結果でも請求可否の判定でもありません。「—」は0件を意味しません。"}
        </PrototypeBanner>
        <MetricGrid>
          <MetricCard label="点検対象件数" value="—" unit="件" detail="点検API未接続（RB-001 停止中）" tone="accent" icon="点" />
          <MetricCard label="エラー" value="—" unit="件" detail="0件を意味しません" tone="neutral" icon="?" />
          <MetricCard label="警告・要確認" value="—" unit="件" detail="0件を意味しません" tone="neutral" icon="?" />
          <MetricCard label="点検完了" value="—" unit="件" detail="完了状態API未接続（RB-001 停止中）" tone="neutral" icon="?" />
        </MetricGrid>

        <Panel
          title="受付・資格確認の保存済み実件数"
          description="保存済みの受付と資格確認状態の実件数です。点検結果でも請求可否の判定でもありません。"
          className="live-surface-panel"
        >
          <ReceptionIntegrityBoard />
        </Panel>

        <Panel title="フィルターと点検項目" description="検索・絞り込みAPI接続後に操作できます。">
          <div className="filter-grid">
            <label>点検区分<select disabled><option>すべて</option></select></label>
            <label>重大度<select disabled><option>すべて</option></select></label>
            <label>状態<select disabled><option>すべて</option></select></label>
            <label>受付日<input type="date" disabled title="点検API未接続" /></label>
          </div>
          <div className="check-chip-row">
            {["資格確認", "算定根拠", "公費", "コメント", "添付書類"].map((item) => (
              <label key={item}><input type="checkbox" defaultChecked disabled /> {item}</label>
            ))}
          </div>
        </Panel>

        <Panel
          title="点検結果一覧"
          description="点検結果API接続後に対象患者と根拠を表示します。"
          actions={<PrototypeAction reason="点検結果API未接続">CSV出力</PrototypeAction>}
        >
          <TableScroll label="請求前点検の結果表">
            <table className="operator-table operator-table-dense">
              <caption className="operator-table-caption">
                実患者データ・実件数・実エラーではありません。点検結果は未取得です。
              </caption>
              <thead>
                <tr>
                  <th scope="col">受付番号</th>
                  <th scope="col">患者</th>
                  <th scope="col">点検区分</th>
                  <th scope="col">内容</th>
                  <th scope="col">重大度</th>
                  <th scope="col">推奨対応</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} className="operator-empty-copy">
                    点検結果APIが未接続のため、表示できるデータはありません。
                  </td>
                </tr>
              </tbody>
            </table>
          </TableScroll>
          <div className="sticky-action-bar">
            <KeyValueList
              items={[
                { label: "選択中", value: "—（選択機能未接続）" },
                { label: "合計点数", value: "—（算定未接続）" },
              ]}
            />
            <div>
              <PrototypeAction reason="点検状態更新API未接続">保留</PrototypeAction>
              <PrototypeAction reason="患者別修正画面未接続">修正へ</PrototypeAction>
              <PrototypeAction kind="primary" reason="規制レビューと請求候補追加APIが未接続">
                請求候補へ追加
              </PrototypeAction>
            </div>
          </div>
        </Panel>
      </OperatorPage>
    </section>
  );
}
