import { PatientContextRail } from "../components/patient-context-rail";
import {
  OperatorPage,
  RailCard,
  ScreenHeader,
  StatusPill,
} from "../components/operator-ui";
import { PatientSearch } from "./patient-search";

export default function PatientsPage() {
  return (
    <OperatorPage
      rail={
        <>
          <PatientContextRail />
          <RailCard title="患者情報の表示範囲" tone="info">
            <p className="rail-muted">
              検索結果はAPI契約に含まれる表示投影だけを使用し、契約外の保険・薬歴情報を推測しません。
            </p>
          </RailCard>
          <RailCard title="次の操作">
            <ul className="rail-action-list">
              <li>対象患者を選択して全画面の患者文脈を固定</li>
              <li>患者取り違え防止のためカナ・生年月日を併記</li>
              <li>処方入力・会計へは選択後に移動</li>
            </ul>
          </RailCard>
        </>
      }
    >
      <ScreenHeader
        title="患者検索・患者管理"
        description="氏名・カナ・患者番号から検索し、業務対象の患者を明示的に選択します。"
        meta={<StatusPill tone="info">既存患者検索API配線・稼働未確認</StatusPill>}
      />
      <PatientSearch />
    </OperatorPage>
  );
}
