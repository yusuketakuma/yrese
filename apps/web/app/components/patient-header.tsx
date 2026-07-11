import type { EligibilityStatus } from "@yrese/contracts";
import type { PatientId } from "@yrese/shared-kernel";

import {
  ELIGIBILITY_PRESENTATION,
  ELIGIBILITY_STATUS_LABELS,
} from "../status/visual-status-registry";

/**
 * 患者ヘッダー(患者取り違え防止表示)。
 *
 * 医療UI原則(v0.2.0 §7): 患者文脈のある全業務画面で、氏名・カナ・生年月日・年齢・
 * 性別・資格確認状態を常時固定表示する。資格確認状態は色だけに依存せず
 * テキストラベルで明示する。PHIを扱うため、この構造体をログ・計測へ渡してはならない。
 *
 * データ取得は API Contract SSOT 承認後に接続する(props はその契約の表示投影)。
 */

export type EligibilityDisplayStatus = EligibilityStatus;

/**
 * 資格確認状態の表示文言(WP-3008 / WP-4041)。
 * 正本は Visual Status Registry(ELIGIBILITY_STATUS_LABELS)。資格状態を表示する画面は
 * すべて本定義を再利用し、独自文言を定義しない(安全含意の弱い言い換えを防ぐ)。
 * 状態型は @yrese/contracts の正本を使う。
 */
export const ELIGIBILITY_LABELS: Record<EligibilityDisplayStatus, string> =
  ELIGIBILITY_STATUS_LABELS;

/**
 * 生年月日(YYYY-MM-DD)と基準日から満年齢を計算する(監査 R-PATCTX)。
 * PatientHeader の age は呼び出し側責務(本コンポーネント冒頭コメント)。
 * 基準日は JST の暦日で判定する(業務日付のタイムゾーン規律 — WP-4053 と整合。
 * 実行環境のタイムゾーンに依存させない)。
 */
export function computeAgeYears(birthDate: string, asOf: Date): number {
  // asOf を JST の暦日(YYYY-MM-DD)へ正規化する
  const asOfJst = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asOf);

  const birth = birthDate.split("-");
  const now = asOfJst.split("-");
  const birthYear = Number(birth[0]);
  const birthMonth = Number(birth[1]);
  const birthDay = Number(birth[2]);
  const nowYear = Number(now[0]);
  const nowMonth = Number(now[1]);
  const nowDay = Number(now[2]);

  let age = nowYear - birthYear;
  if (nowMonth < birthMonth || (nowMonth === birthMonth && nowDay < birthDay)) {
    age -= 1;
  }
  return age;
}

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

const SEX_LABELS: Record<PatientHeaderProps["sex"], string> = {
  male: "男",
  female: "女",
  unknown: "不明",
};

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
        <span className="patient-eligibility-shape" aria-hidden="true">
          {ELIGIBILITY_PRESENTATION[props.eligibility].shape}
        </span>
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
