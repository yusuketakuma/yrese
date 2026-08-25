"use client";

import Link from "next/link";

import { useOptionalPatientContext } from "./patient-context";
import { ELIGIBILITY_LABELS, computeAgeYears } from "./patient-header";
import { KeyValueList, RailCard, StatusPill } from "./operator-ui";

const SEX_LABELS = {
  male: "男",
  female: "女",
  unknown: "不明",
} as const;

export function PatientContextRail() {
  const context = useOptionalPatientContext();
  const patient = context?.patient ?? null;

  if (patient === null) {
    return (
      <>
        <RailCard title="選択中の患者" tone="warning">
          <p className="rail-empty-title">患者が選択されていません</p>
          <p className="rail-muted">
            患者固有の業務を開始する前に、検索結果から対象患者を明示的に選択してください。
          </p>
          <Link className="rail-link-button" href="/patients">
            患者検索を開く
          </Link>
        </RailCard>
        <RailCard title="患者安全">
          <StatusPill tone="warning">患者文脈なし</StatusPill>
          <p className="rail-muted">
            患者未選択では処方・会計・請求の確定操作を開始できません。
          </p>
        </RailCard>
      </>
    );
  }

  const age = computeAgeYears(patient.birthDate, new Date());
  return (
    <>
      <RailCard
        title="選択中の患者"
        action={
          <button className="rail-text-button" type="button" onClick={() => context?.clearPatient()}>
            選択解除
          </button>
        }
      >
        <div className="rail-patient-heading">
          <span className="rail-avatar" aria-hidden="true">
            人
          </span>
          <div>
            <p className="rail-patient-name">{patient.name}</p>
            <p className="rail-muted">{patient.kana}</p>
          </div>
        </div>
        <KeyValueList
          items={[
            { label: "患者ID", value: patient.patientId },
            {
              label: "生年月日",
              value: `${patient.birthDate}（${age}歳・${SEX_LABELS[patient.sex]}）`,
            },
          ]}
        />
      </RailCard>
      <RailCard title="保険・資格情報">
        <div className="rail-status-row">
          <span>資格状態</span>
          <StatusPill
            tone={patient.eligibilityStatus === "VERIFIED" ? "success" : "warning"}
          >
            {ELIGIBILITY_LABELS[patient.eligibilityStatus]}
          </StatusPill>
        </div>
        <p className="rail-muted">
          保険者番号・記号番号・公費情報はこのUIスライスでは未接続です。
        </p>
      </RailCard>
      <RailCard title="アレルギー・副作用歴" tone="warning">
        <StatusPill tone="warning">未接続</StatusPill>
        <p className="rail-muted">
          アレルギー・副作用歴が表示されないことは、該当なしを意味しません。
        </p>
      </RailCard>
    </>
  );
}
