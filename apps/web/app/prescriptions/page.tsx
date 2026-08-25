import { PrescriptionWorkspace } from "./prescription-workspace";

/**
 * 処方入力画面(SCR-006 UI slice)。
 * 患者未選択時は開始不可とし、選択後も保存・臨床判定・算定は未接続として明示する。
 */
export default function Page() {
  return <PrescriptionWorkspace />;
}
