import {
  PROVISIONAL_STATUSES,
  allowsClaimFinalization,
  allowsFinalCalculation,
  canConfirmExternal,
  type SystemMode,
} from "@yrese/shared-kernel";

import { MODE_LABELS } from "../system-mode-badge";

/**
 * SCR-026 LOCAL_ONLY / 障害時モードの操作可否表示基盤(WP-3010a / ARC-001 §5)。
 *
 * 判定の唯一の正本は shared-kernel のモードガード関数(canConfirmExternal /
 * allowsFinalCalculation / allowsClaimFinalization)。UI 側で許可/禁止を独自判定しない
 * (PLAN-UIUX-001 §57 / COMMON_MODULE_DUPLICATION_BLOCKED)。
 *
 * fail-closed: モード遷移時に「できること / できないこと / 復旧後に必要なこと」を明示し、
 * PENDING_*(仮状態)を隠さない(ARC-001 §5 / v0.2.0 §7,§8)。
 *
 * 本コンポーネントは shared-kernel ガード関数が支配する主要操作のみを対象とする。
 * ARC-001 §2/§4 の全操作(28行)/ 絶対禁止16項目の網羅表示は、機械可読な単一正本
 * (ARC-001 由来のデータ化)が前提のため別 WP。仮状態「件数」と実モード供給は
 * データ経路(API 契約)未定のため本コンポーネントでは扱わない(捏造しない)。
 */

interface Capability {
  readonly label: string;
  readonly notProhibited: boolean;
  /** notProhibited=false のときの理由(ARC-001 のモード定義に根拠)。 */
  readonly deniedReason: string;
  /** true はモードガード上で未禁止なだけで、業務上の実行許可ではない。 */
  readonly requiredChecks: string;
}

function modeCapabilities(mode: SystemMode): readonly Capability[] {
  return [
    {
      label: "外部公的システムの新規確認(オンライン資格確認・電子処方箋・PMH)",
      notProhibited: canConfirmExternal(mode),
      deniedReason:
        "このモードでは、新規の外部確認を成功扱いにできません。各業務の再確認・復旧手順に従ってください。",
      requiredChecks:
        "権限、個別システムの接続状態、公式手順、最終確認日時、再確認要否を確認してください。",
    },
    {
      label: "確定算定",
      notProhibited: allowsFinalCalculation(mode),
      deniedReason: "このモードでは仮算定のみ可能です。確定算定はできません。",
      requiredChecks:
        "権限、資格確認、evidence、マスター版、仮状態、業務固有の算定条件を確認してください。",
    },
    {
      label: "請求前点検・月次締め・レセプト確定",
      notProhibited: allowsClaimFinalization(mode),
      deniedReason: "請求関連の確定操作は通常稼働(NORMAL)でのみ可能です。",
      requiredChecks:
        "権限、isClaimable、資格再確認、根拠、請求前点検、業務固有の確定条件を確認してください。",
    },
  ];
}

export function ModeCapabilityView({ mode }: { readonly mode: SystemMode }) {
  const capabilities = modeCapabilities(mode);
  const notProhibited = capabilities.filter((capability) => capability.notProhibited);
  const denied = capabilities.filter((capability) => !capability.notProhibited);
  const restricted = denied.length > 0;

  return (
    <section className="mode-capability" aria-label="モード別操作可否" data-mode={mode}>
      <header className="mode-capability-header">
        <p className="mode-capability-mode" role="status" aria-live="polite">
          現在のモード: {MODE_LABELS[mode]}
        </p>
        <p className="mode-capability-scope-note">
          本画面は主要操作(外部公的システムの新規確認・確定算定・請求確定系)について、
          3つの共通モードガードによる禁止・未禁止だけを表示します。
          LOCAL_ONLY の絶対禁止16項目や全操作マトリクスの網羅表示は本画面の対象外です。
          個々の操作可否は必ず各業務画面と正本(ARC-001)で確認してください。
          制限モードでは、未禁止の操作でも結果に仮状態が付与されることがあります(下記凡例)。
        </p>
      </header>

      <div className="mode-capability-not-prohibited">
        <h3>モードガード上は未禁止の主要操作(実行可否は未確定)</h3>
        <p>
          ここに表示されても「できること」が確定した意味ではありません。追加条件をすべて確認してください。
        </p>
        {notProhibited.length === 0 ? (
          <p>このモードガード上で未禁止の主要操作はありません。</p>
        ) : (
          <ul role="list">
            {notProhibited.map((capability) => (
              <li key={capability.label} data-mode-guard="not-prohibited">
                <span className="mode-capability-not-prohibited-label">{capability.label}</span>
                <span className="mode-capability-required-checks">
                  追加確認: {capability.requiredChecks}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {restricted ? (
        <div className="mode-capability-denied" role="alert">
          <h3>できないこと(主要操作・理由付き)</h3>
          <ul role="list">
            {denied.map((capability) => (
              <li key={capability.label} data-mode-guard="prohibited">
                <span className="mode-capability-denied-label">{capability.label}</span>
                <span className="mode-capability-denied-reason">理由: {capability.deniedReason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {restricted ? (
        <div className="mode-capability-recovery">
          <h3>復旧後に必要なこと</h3>
          <p>
            外部確認・クラウドが回復したら、下記の仮状態が付与された項目を再検証・同期し、
            必要に応じて差額精算を行ってください。仮状態のまま請求データにしてはいけません。
          </p>
        </div>
      ) : null}

      {restricted ? (
        <div className="mode-capability-provisional">
          <h3>仮状態ステータス</h3>
          {mode === "LOCAL_ONLY" ? (
            <p>LOCAL_ONLY で生成した計算・帳票・受付には、以下のいずれかを必ず付与します。</p>
          ) : (
            <p>
              以下は共通の仮状態候補です。実際に付与される状態は、処理と各業務の正本を確認してください。
            </p>
          )}
          <ul role="list">
            {PROVISIONAL_STATUSES.map((status) => (
              <li key={status} data-status={status}>
                {status}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
