# ubiquitous_language — ユビキタス言語辞書

```yaml
ssot_id: DOM-003
title: ユビキタス言語辞書
domain: domain
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-11
effective_from: null
effective_to: null
source_refs: 構築プロンプト v0.2.0 §12, §17
depends_on: [DOM-001, MOD-004]
impacts: [MOD-004(shared identifiers), UIX-001(UI wording boundary)]
related_work_packages: [WP-1101, WP-9002-W5F]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5F metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions: 本文【要確認】参照
blockers: []
```

## 原則

- コード識別子(型名・関数名・イベント名)は本辞書の「英語識別子」列を正とする。
- UI表示文言は本辞書と分離し UIX-001 の管理下に置く(現場用語⇔公式用語の対応は UI 側で吸収)。
- 公式用語との対応が未確認のものは【要確認】とし、独自解釈で確定しない。
- 実装済み識別子(MOD-004)と衝突する変更は SSOT_UPDATE_REQUIRED を先行する。

## 辞書(コンテキスト別・主要52語)

### 受付・処方(C1/C4)

| 用語 | 読み | 英語識別子 | 定義 | 公式用語対応 |
|---|---|---|---|---|
| 受付 | うけつけ | Reception | 来局患者の受付業務(C1)。実装済み(API-006 / WP-3009) | —(内部用語) |
| 受付エントリ | うけつけえんとり | ReceptionEntry | 受付キューの1件。ルート集約(ReceptionId — DOM-002 §1) | —(内部用語) |
| 受付状態 | うけつけじょうたい | ReceptionStatus | RECEPTION_STATUSES(shared-kernel 正本): WAITING=待機中 / IN_PROGRESS=対応中 / COMPLETED=完了 / CANCELLED=取消済み(UI表示ラベルは apps/web と一致) | —(内部状態) |
| 処方箋 | しょほうせん | Prescription | 医師が交付する処方の原本。紙・電子の別を由来として管理 | 処方箋(医師法・薬剤師法) |
| 院外処方箋2次元シンボル | いんがいしょほうせん… | Prescription2DSymbol | JAHIS規約 Ver.1.11 準拠のQR。UI表示は「処方箋QRコード」可 | JAHIS院外処方箋2次元シンボル記録条件規約 |
| 処方箋引換番号 | …ひきかえばんごう | PrescriptionAccessCode | 電子処方箋の引換番号(境界設計のみMVP) | 電子処方箋管理サービス用語 |
| 仮受付 | かりうけつけ | RECEIVED_PROVISIONAL | 原本照合・薬剤師確認前の処方ライフサイクル状態(状態名は DOM-004 §1 の識別子を正とする) | —(内部状態) |
| 仮取込 | かりとりこみ | IMPORTED_PROVISIONAL | QR等からの機械取込。確定前(状態名は DOM-004 §1 の識別子を正とする) | —(内部状態) |
| 原本照合 | げんぽんしょうごう | SourceDocumentVerification | QR/取込内容と紙面・正式データの照合 | —(内部用語) |
| RP(処方区分) | あーるぴー | Rp | 処方内の剤単位。入力・算定の基本単位 | 剤(調剤報酬点数表) |
| 用法 | ようほう | DosageInstruction | 服用方法。用法コード対応は CodeMappingRegistry 経由 | 用法コード |
| 用量 | ようりょう | Dose | 1回量・1日量 | — |
| 調剤数量 | ちょうざいすうりょう | DispensedQuantity | 投与日数・回数・総量 | 調剤数量(記録条件仕様) |
| リフィル処方箋 | りふぃる… | RefillPrescription | 反復利用可能処方箋(MVPは基本パターンのみ【要確認】) | リフィル処方箋(R6改定〜) |

### 患者・保険・公費(C2/C3)

| 用語 | 読み | 英語識別子 | 定義 | 公式用語対応 |
|---|---|---|---|---|
| 患者 | かんじゃ | Patient | 調剤対象者。カナ必須(取り違え防止) | — |
| 保険情報 | ほけんじょうほう | InsuranceCard | 保険者番号・記号番号・負担割合・有効期間の履歴 | 被保険者証情報 |
| 負担割合 | ふたんわりあい | CopayRate | 患者一部負担の割合 | 一部負担金割合 |
| 公費負担医療 | こうひふたんいりょう | PublicExpense | 法別番号・負担者番号・受給者番号による医療費助成 | 公費負担医療 |
| 資格確認スナップショット | しかくかくにん… | EligibilitySnapshot | オンライン資格確認等の結果の不変記録 | オンライン資格確認(結果) |
| 資格再確認待ち | しかくさいかくにん… | PENDING_REVERIFY | 請求前に資格再確認が必要な状態(実装済みstatus) | —(内部状態) |
| マイナ保険証 | まいなほけんしょう | MynaInsuranceCard | マイナンバーカードの保険証利用 | マイナ保険証 |
| PMH医療費助成 | ぴーえむえいち… | PmhSubsidy | Public Medical Hub 経由の医療費助成情報(境界のみMVP) | PMH(デジタル庁) |

### 調剤(C5)

| 用語 | 読み | 英語識別子 | 定義 | 公式用語対応 |
|---|---|---|---|---|
| 調剤 | ちょうざい | Dispensing | 処方に基づく薬剤の調製・交付 | 調剤(薬剤師法) |
| 疑義照会 | ぎぎしょうかい | PrescriptionInquiry | 処方医への照会。記録必須・処方訂正は新版経由 | 疑義照会(薬剤師法24条【要確認】) |
| 後発品変更 | こうはつひんへんこう | GenericSubstitution | 先発→後発医薬品への変更調剤 | 後発医薬品への変更調剤 |
| 一般名処方 | いっぱんめいしょほう | GenericNamePrescription | 一般名による処方 | 一般名処方 |
| 残薬調整 | ざんやくちょうせい | LeftoverAdjustment | 残薬に応じた日数・数量調整 | 残薬調整 |
| 一包化 | いっぽうか | UnitDosePackaging | 服用時点ごとの一包化調剤 | 一包化(外来服薬支援料2関連【要確認】) |
| 薬剤師確認 | やくざいしかくにん | PharmacistConfirmation | 薬剤師による確定前確認。scope=*:confirm | —(内部用語・薬剤師責任の明示) |

### 算定・会計(C6/C8)

| 用語 | 読み | 英語識別子 | 定義 | 公式用語対応 |
|---|---|---|---|---|
| 調剤報酬 | ちょうざいほうしゅう | PharmacyFee | 調剤報酬点数表に基づく報酬 | 調剤報酬点数表(告示69号別表第三) |
| 点数 | てんすう | Points | 算定単位(実装済み: bigint) | 点数 |
| 調剤基本料 | ちょうざいきほんりょう | BasicDispensingFee | 区分00 | 同左 |
| 薬剤調製料 | やくざいちょうせいりょう | DrugPreparationFee | 区分01 | 同左 |
| 調剤管理料 | ちょうざいかんりりょう | DispensingManagementFee | 区分04【要確認: 区分番号】 | 同左 |
| 服薬管理指導料 | ふくやくかんりしどうりょう | MedicationGuidanceFee | 薬学管理料の主要項目 | 同左 |
| 薬剤料 | やくざいりょう | DrugCost | 薬価×数量から算出(15円以下1点等の規定 — CAL-002) | 使用薬剤料 |
| 加算 | かさん | FeeAddition | 各種加算。全て evidence_id 必須 | 加算 |
| 一部負担金 | いちぶふたんきん | PatientCopay | 患者負担額(実装済み: Yen) | 一部負担金 |
| 仮算定 | かりさんてい | ProvisionalCalculation | LOCAL_ONLY 等での暫定算定(PROVISIONAL_CALCULATION) | —(内部状態) |
| 算定トレース | さんてい… | CalculationTrace | 算定過程の完全な記録(実装済み・改変不可) | —(内部用語) |
| 会計 | かいけい | Billing | 一部負担金の収納・領収 | — |
| 未収 | みしゅう | UnpaidBalance | 未収金 | — |

### 請求(C7)

| 用語 | 読み | 英語識別子 | 定義 | 公式用語対応 |
|---|---|---|---|---|
| レセプト | れせぷと | Claim | 診療(調剤)報酬明細書 | 調剤報酬明細書 |
| 電子レセプト | でんしれせぷと | ElectronicClaim | 記録条件仕様準拠のCSV(RECEIPTY.CYO — CLM-002) | レセプト電算処理システム |
| 記録条件仕様 | きろくじょうけんしよう | RecordSpecification | 電子レセプトの公式仕様(R8.6版確認済み) | 同左(支払基金) |
| 請求月 | せいきゅうげつ | ClaimMonth | 請求の単位月(実装済み型) | 診療(調剤)年月 |
| 請求前点検 | せいきゅうまえてんけん | PreClaimCheck | レセプト提出前の点検 | 受付・事務点検ASP相当【要確認】 |
| 月次締め | げつじしめ | MonthlyClosing | 請求月の確定処理。NORMAL モード限定 | — |
| 請求データロック | …ろっく | ClaimLock | 締め後の変更禁止状態 | — |
| 返戻 | へんれい | ClaimReturn | 審査支払機関からの差し戻し | 返戻 |
| 再請求 | さいせいきゅう | ClaimResubmission | 返戻後の修正再提出 | 再請求 |
| 増減点 | ぞうげんてん | PointAdjustment | 審査による点数の増減 | 増減点連絡書 |
| 保険請求金額 | ほけんせいきゅうきんがく | InsurerBillAmount | 保険者への請求額 | — |
| 公費請求額 | こうひせいきゅうがく | PublicExpenseBillAmount | 公費負担者への請求額 | — |

### マスター・基盤(C10〜C14)

| 用語 | 読み | 英語識別子 | 定義 | 公式用語対応 |
|---|---|---|---|---|
| 医薬品マスター | いやくひん… | DrugMaster | 診療報酬情報提供サービス配布(MST-001) | 医薬品マスター |
| 薬価 | やっか | DrugPrice | 薬価基準収載価格 | 薬価基準 |
| 有効日 | ゆうこうび | EffectiveDate | マスター・ルールの適用開始日 | 適用日 |
| 経過措置 | けいかそち | TransitionalMeasure | 廃止品目等の猶予規定 | 経過措置 |
| 当時有効版 | とうじゆうこうばん | AsOfVersion | 処方日・調剤日・請求月時点で有効な版 | —(内部用語) |
| 調剤録 | ちょうざいろく | DispensingRegister | 法定保存帳簿(保存期間【要確認】) | 調剤録(薬剤師法28条【要確認】) |
| 薬袋 | やくたい | MedicineBag | 薬剤交付用袋(法定表示事項あり) | 薬袋(薬機法【要確認】) |
| 監査ログ | かんさろぐ | AuditLog | 追記専用の操作証跡(SEC-007) | 監査証跡(安全管理GL) |
| ローカル単独稼働 | …たんどくかどう | LOCAL_ONLY | 外部確認不可のモード(実装済み) | —(内部状態) |
| 復旧同期 | ふっきゅうどうき | RECOVERY_SYNC | 障害復旧後の再検証・同期(実装済み) | —(内部状態) |

## 【要確認】

- 区分番号・法令条番号を伴う対応(調剤管理料の区分、薬剤師法の条番号等)は一次資料で確認後に確定
- 現場用語(「QRコード」「マイナ」等)⇔本辞書の対応表は UIX-001 側で整備(薬剤師レビュー)
- 電子処方箋関連用語は ONS 資料入手後に拡充

## 変更履歴

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(受付/受付エントリ/受付状態の用語追加、仮受付・仮取込の識別子を DOM-004 §1 の状態名 RECEIVED_PROVISIONAL / IMPORTED_PROVISIONAL に統一)。
- 0.1.0 (2026-07-09): 初版起草(WP-1101)。
