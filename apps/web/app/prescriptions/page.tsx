import { PrescriptionReceptionBoundary } from "./prescription-reception-boundary";
import { PrescriptionWorkspace } from "./prescription-workspace";

/**
 * 処方入力画面(SCR-006 UI slice)。
 * 受付から遷移した場合は、既存受付APIで受付・患者関係を再検証してから入力を表示する。
 * version付き下書きの読込・保存は接続済み。薬剤師確認・臨床判定・算定・確定処方は
 * 承認済み契約が接続されるまで明示的に利用不可とする。
 */
export default function Page() {
  return (
    <PrescriptionReceptionBoundary>
      <PrescriptionWorkspace />
    </PrescriptionReceptionBoundary>
  );
}
