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
import { MasterAuthorityCard } from "./master-authority";

/**
 * SCR-023 マスター管理。
 *
 * 版・件数・適用日・差分・ハッシュ検証は「未配線」ではなく「取得不能」である。
 * MST-001 は設計としては APPROVED だが、取込実装は配布元仕様の evidence_id 発行後に
 * WP を発行する blocker を持ち、配布形式・署名/ハッシュ提供の有無と令和8年度改定
 * マスターの適用日・経過措置が未確定のまま残っている。コードマッピングは RB-009、
 * 点数化は RB-008 で停止する。
 *
 * したがって本画面が表示できる実データは「現在のセッションに API が返した scope」
 * だけであり、それは MasterAuthorityCard が担う。DB マイグレーション状態
 * (schema_migrations) は DB-002 配下であり、薬価マスター版と誤読されるため
 * この画面には置かない(/admin が持つ)。
 */

const MASTER_NAMES = [
  "医薬品マスター",
  "薬価マスター",
  "一般名マスター",
  "効能・効果マスター",
  "薬価基準収載マスター",
  "後発医薬品マスター",
] as const;

/** MST-001 が取込対象として挙げる区分。名称のみで、取得状態は持たない。 */
const MASTER_CATEGORIES = ["医薬品", "薬価", "コメント", "保険者", "公費"] as const;

/** 能力境界。JSX の行連結で語間へ空白が混ざらないよう文字列として保持する。 */
const CAPABILITY_BOUNDARY =
  "公式マスター（医薬品・薬価・一般名・コメント・保険者・公費）の版・件数・適用日・差分・履歴は取得していません。" +
  "取込実装は MST-001 の blocker「マスター取込実装は配布元仕様の evidence_id 発行後に WP 発行（RB-003 相当）」で停止し、" +
  "配布形式・署名/ハッシュ提供の有無と令和8年度改定マスターの適用日・経過措置は未確定です。" +
  "コードマッピングは RB-009 BLOCKED_CODE_MAPPING_REVIEW、点数化は RB-008 で停止しています。" +
  "取得・検証・適用・Edge配布は一切実行されません。「—」は0件・最新・正常を意味しません。";

const GATE_ITEMS = [
  "MST-001（マスター更新パイプライン）: 取込実装は配布元仕様の evidence_id 発行後に WP 発行（RB-003 相当）",
  "RB-009 BLOCKED_CODE_MAPPING_REVIEW: コードマッピングは CodeMappingRegistry 承認とマスター取得が前提",
  "RB-008: 点数・薬価の値そのもの",
  "UIX-001 §12.3 に SCR-023 の操作registry行が無く、MOD-007 §3 は本番適用権限の割当（admin か finalize か）を未確定にしている",
] as const;

const UNAVAILABLE_READING =
  "「—」は0件・最新・正常を意味しません。表示されないことは該当なしを意味しません。未接続を成功・正常として表示しません。";

const IMPORT_HISTORY_COPY =
  "取込を一度も実行していないため、履歴は存在しません。履歴API未接続であり、履歴なし・更新不要を意味しません。";

const ATTENTION_COPY =
  "公式版、適用日、差分、有効期限を取得できないため、注意対象を判定できません。警告が表示されないことは、注意対象が無いことを意味しません。";

export default function Page() {
  return (
    <section data-operational-data="unavailable" aria-label="マスター管理">
      <OperatorPage
        railLabel="マスター管理の補助情報"
        rail={
          <>
            <RailCard title="停止しているゲート" tone="warning">
              <StatusPill tone="warning">更新パイプライン未接続</StatusPill>
              <ul className="rail-action-list">
                {GATE_ITEMS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </RailCard>
            <RailCard title="未取得の読み方" tone="warning">
              <StatusPill tone="warning">未検証</StatusPill>
              <p className="rail-muted">{UNAVAILABLE_READING}</p>
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
          description="医薬品・薬価・一般名・コメント・保険者・公費マスターの版と適用日を管理する画面です。現時点で取得できるのはセッション権限だけです。"
          meta={<StatusPill tone="warning">master_update_pipeline未承認</StatusPill>}
          actions={
            <>
              <PrototypeAction
                kind="primary"
                reason="MST-001の取込実装は配布元仕様のevidence_id発行後にWP発行のため未着手"
              >
                取込を実行
              </PrototypeAction>
              <PrototypeAction reason="署名・ハッシュ提供の有無が未確定で検証手順を確定できません">
                取得内容を検証
              </PrototypeAction>
              <PrototypeAction reason="本番適用の権限割当がMOD-007 §3で未確定です">
                本番適用
              </PrototypeAction>
            </>
          }
        />
        <PrototypeBanner>{CAPABILITY_BOUNDARY}</PrototypeBanner>
        <MetricGrid>
          <MetricCard
            label="薬価マスター版"
            value="—"
            detail="版情報未取得"
            tone="neutral"
            icon="マ"
          />
          <MetricCard
            label="収載件数"
            value="—"
            unit="件"
            detail="取込未実施のため件数を導出できません"
            tone="neutral"
            icon="薬"
          />
          <MetricCard
            label="要更新件数"
            value="—"
            unit="件"
            detail="差分判定は取得済みマスターが前提です"
            tone="neutral"
            icon="差"
          />
          <MetricCard
            label="適用日・経過措置"
            value="—"
            detail="令和8年度改定マスターの適用日は未確定【要確認】"
            tone="neutral"
            icon="日"
          />
        </MetricGrid>

        <MasterAuthorityCard />

        <Panel
          title="マスター一覧"
          description="マスター名だけを静的表示し、版・適用状態は推測しません。"
          actions={
            <>
              <PrototypeAction reason="取得済みマスターが無いため差分を計算できません">
                差分を表示
              </PrototypeAction>
              <PrototypeAction reason="取込履歴APIはMST-001の取込blockerにより未実装です">
                取込履歴を表示
              </PrototypeAction>
            </>
          }
        >
          <p className="operator-empty-copy">
            MST-001 が取込対象として挙げる区分（いずれも未取得）:
          </p>
          <div className="check-chip-row">
            {MASTER_CATEGORIES.map((category) => (
              <StatusPill key={category}>{category}</StatusPill>
            ))}
          </div>
          <TableScroll label="マスター一覧表">
            <table className="operator-table">
              <caption className="visually-hidden">
                未接続のマスター一覧。版・適用情報・提供元は全て未取得です。
              </caption>
              <thead>
                <tr>
                  <th scope="col">マスター名</th>
                  <th scope="col">バージョン</th>
                  <th scope="col">適用情報</th>
                  <th scope="col">更新状態</th>
                  <th scope="col">提供元</th>
                </tr>
              </thead>
              <tbody>
                {MASTER_NAMES.map((name) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>
                      <StatusPill tone="neutral">未取得</StatusPill>
                    </td>
                    <td>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Panel>

        <div className="operator-two-column">
          <Panel title="インポート履歴">
            <p className="operator-empty-copy">{IMPORT_HISTORY_COPY}</p>
          </Panel>
          <Panel title="注意が必要なマスター" tone="warning">
            <StatusPill tone="warning">判定不能</StatusPill>
            <p className="operator-empty-copy">{ATTENTION_COPY}</p>
          </Panel>
        </div>
      </OperatorPage>
    </section>
  );
}
