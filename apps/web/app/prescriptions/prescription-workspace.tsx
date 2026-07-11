"use client";

import Link from "next/link";

import { EmptyState } from "../components/empty-state";
import { useOptionalPatientContext } from "../components/patient-context";
import { SeverityList } from "../components/severity-list";

/**
 * 処方ワークスペース(SCR-006 基盤 / R-PATCTX 配線)。
 *
 * 実装済み: 横断患者文脈との接続 — 患者未選択なら業務を開始させず検索へ誘導し、
 * 選択済みなら固定バー(PatientContextBar)の患者を業務対象として明示する(H-01/H-02)。
 *
 * 患者安全上の要点(H-08): 臨床アラート判定エンジンは未接続である。未接続を
 * 「アラートなし(=安全確認済み)」に見せてはならないため、明示的な警告として表示する。
 * 処方・調剤入力は処方データモデル/API 契約の実配線後に実装する。
 */
export function PrescriptionWorkspace() {
  const ctx = useOptionalPatientContext();
  const patient = ctx?.patient ?? null;

  if (patient === null) {
    return (
      <section aria-label="処方入力(患者未選択)">
        <EmptyState message="業務対象の患者が選択されていません" />
        <p>
          <Link href="/patients">患者検索</Link>
          で患者を選択すると、処方入力を開始できます(患者取り違え防止のため、患者未選択での
          入力開始はできません)。
        </p>
        <p className="placeholder-note">
          処方・調剤入力機能は未実装です(処方データモデル/API 契約の実配線後に実装)。
        </p>
      </section>
    );
  }

  return <SelectedPatientWorkspaceView />;
}

/**
 * 患者選択済みの処方ワークスペース表示部(純粋・テスト可能)。
 * 患者の同一性表示は全画面共通の PatientContextBar が担う(二重表示しない)。
 */
export function SelectedPatientWorkspaceView() {
  return (
    <section aria-label="処方入力" data-patient-selected="true">
      <SeverityList
        items={[
          {
            severity: "WARNING",
            message:
              "臨床アラート判定(相互作用・禁忌・重複・用量)は未接続です。アラートが表示されないことは安全確認済みを意味しません。必要な確認は従来手順で実施してください。",
          },
        ]}
      />
      <EmptyState message="処方データは未接続です(処方データモデル/API 契約の実配線後に入力機能を提供)" />
    </section>
  );
}
