import { PrescriptionReceptionBoundary } from "./prescription-reception-boundary";
import { PrescriptionWorkspace } from "./prescription-workspace";

/**
 * 処方入力画面(SCR-006 connected draft slice)。
 * 受付から遷移した場合は既存受付APIで受付・患者関係を再検証し、サーバー保存版を
 * 取得してから編集を開始する。薬剤師確認、臨床判定、算定、処方確定はそれぞれの
 * 承認済み契約が接続されるまで明示的に未接続とする。
 */
export default function Page() {
  return (
    <PrescriptionReceptionBoundary>
      <PrescriptionWorkspace />
    </PrescriptionReceptionBoundary>
  );
}
