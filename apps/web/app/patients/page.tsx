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
          <RailCard title="表示範囲と未接続の理由" tone="warning">
            <p className="rail-muted">
              検索結果はAPI契約に含まれる表示投影だけを使用し、契約外の保険・薬歴情報を推測しません。
            </p>
            <p className="rail-muted">
              保険・公費の適用内容 (SCR-007)
              は未実装で、insurance:read / public-expense:read の API operation が
              UIX-001 §12.3 の operation authorization matrix に未登録です。
            </p>
            <p className="rail-muted">
              オンライン資格確認結果 (SCR-008) は RB-002 BLOCKED_REGULATORY_REVIEW
              (オン資外部IF仕様書の入手と境界SSOTのAPPROVEDが未了) で接続できません。
            </p>
            <p className="rail-muted">
              ここに表示している資格状態は保存済みスナップショットの記録であり、外部照会の結果ではありません。
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
