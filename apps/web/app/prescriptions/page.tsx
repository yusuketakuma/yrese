import { PrescriptionReceptionBoundary } from "./prescription-reception-boundary";
import { PrescriptionWorkspace } from "./prescription-workspace";

/**
 * 処方入力画面(SCR-006 UI slice)。
 * 受付から遷移した場合は、既存受付APIで受付・患者関係を再検証してから入力を表示する。
 * 永続保存・薬剤師確認・臨床判定・算定は承認済み契約が接続されるまで未接続とする。
 */
export default function Page() {
  return (
    <PrescriptionReceptionBoundary>
      <PrescriptionWorkspace />
    </PrescriptionReceptionBoundary>
  );
}
