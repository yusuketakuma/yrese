import { PatientSearch } from "./patient-search";

/**
 * 患者検索・患者選択画面(SCR患者検索、API-001 v0.2.0)。
 * 患者選択後の詳細・受付フローは後続WP(処方入力・受付導線)で接続する。
 */
export default function PatientsPage() {
  return (
    <>
      <h2>患者検索</h2>
      <PatientSearch />
    </>
  );
}
