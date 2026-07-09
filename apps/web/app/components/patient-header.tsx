import type { PatientId } from "@yrese/shared-kernel";

/**
 * 患者ヘッダー(患者取り違え防止表示)。
 *
 * 医療UI原則(v0.2.0 §7): 患者文脈のある全業務画面で、氏名・カナ・生年月日・年齢・
 * 性別・資格確認状態を常時固定表示する。資格確認状態は色だけに依存せず
 * テキストラベルで明示する。PHIを扱うため、この構造体をログ・計測へ渡してはならない。
 *
 * データ取得は API Contract SSOT 承認後に接続する(props はその契約の表示投影)。
 */

export type EligibilityDisplayStatus =
  | "VERIFIED"
  | "PENDING_REVERIFY"
  | "LOCAL_ONLY_UNVERIFIED"
  | "NOT_CHECKED";

const ELIGIBILITY_LABELS: Record<EligibilityDisplayStatus, string> = {
  VERIFIED: "資格確認済み",
  PENDING_REVERIFY: "資格再確認待ち(請求前に再確認必須)",
  LOCAL_ONLY_UNVERIFIED: "ローカル参照のみ(オンライン未確認)",
  NOT_CHECKED: "資格未確認",
};

export interface PatientHeaderProps {
  readonly patientId: PatientId;
  /** 漢字氏名 */
  readonly name: string;
  /** カナ氏名(取り違え防止のため必須) */
  readonly kana: string;
  /** YYYY-MM-DD */
  readonly birthDate: string;
  /** 表示時点の年齢(計算はバックエンド/呼び出し側の責務) */
  readonly age: number;
  readonly sex: "male" | "female" | "unknown";
  readonly eligibility: EligibilityDisplayStatus;
  /** 最終資格確認日時(ISO文字列)。未確認時は undefined */
  readonly eligibilityCheckedAt?: string;
}

const SEX_LABELS = { male: "男", female: "女", unknown: "不明" } as const;

export function PatientHeader(props: PatientHeaderProps) {
  const verified = props.eligibility === "VERIFIED";
  return (
    <section
      className="patient-header"
      aria-label="患者情報"
      data-patient-id={props.patientId}
    >
      <div className="patient-header-identity">
        <span className="patient-kana">{props.kana}</span>
        <span className="patient-name">{props.name}</span>
        <span className="patient-birth">
          {props.birthDate}({props.age}歳・{SEX_LABELS[props.sex]})
        </span>
      </div>
      <div
        className="patient-eligibility"
        data-status={props.eligibility}
        role="status"
      >
        {ELIGIBILITY_LABELS[props.eligibility]}
        {!verified && props.eligibilityCheckedAt && (
          <span className="patient-eligibility-checked-at">
            (最終確認: {props.eligibilityCheckedAt})
          </span>
        )}
      </div>
    </section>
  );
}
