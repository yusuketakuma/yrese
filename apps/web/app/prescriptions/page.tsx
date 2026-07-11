import { PrescriptionWorkspace } from "./prescription-workspace";

/**
 * 処方入力画面(SCR-006 基盤)。
 * 実装済み: 横断患者文脈との接続(患者未選択時は入力開始不可 — H-01/H-02)、
 * 臨床アラート未接続の明示(未接続を安全確認済みに見せない — H-08)。
 * 処方箋受付(紙・2次元シンボル・電子処方箋)と処方・調剤入力は API 契約の実配線後に実装。
 */
export default function Page() {
  return (
    <>
      <h2>処方入力</h2>
      <PrescriptionWorkspace />
    </>
  );
}
