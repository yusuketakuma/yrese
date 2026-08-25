import { PatientContextRail } from "../components/patient-context-rail";
import {
  MetricCard,
  MetricGrid,
  OperatorPage,
  Panel,
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
        meta={<StatusPill tone="success">既存患者検索API配線</StatusPill>}
      />
      <MetricGrid>
        <MetricCard label="検索結果" value="—" unit="名" detail="検索実行後に一覧表示" tone="accent" icon="患" />
        <MetricCard label="選択中の患者" value="—" unit="名" detail="右側の患者文脈を参照" tone="info" icon="選" />
        <MetricCard label="資格未確認" value="—" unit="名" detail="集計API未接続" tone="warning" icon="!" />
        <MetricCard label="要フォロー" value="—" unit="名" detail="フォロー機能未接続" tone="danger" icon="旗" />
      </MetricGrid>
      <Panel
        title="患者一覧"
        description="検索結果は取得時点の鮮度を表示し、古い応答や重複患者IDを安全側で拒否します。"
        className="live-surface-panel"
      >
        <PatientSearch />
      </Panel>
    </OperatorPage>
  );
}
