# calculation_engine_architecture — 算定エンジン全体アーキテクチャ

```yaml
ssot_id: CAL-005
title: 算定エンジン全体アーキテクチャ(9段パイプライン・目標型・BLOCKED境界)
domain: calculation
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: opus4.8レビュー(APPROVE_WITH_CHANGES)全指摘反映後、fable5承認
source_refs:
  - ユーザー提供レセコン調査(2026-07-09)§4〜§11
  - CAL-004 v0.2.1(第1弾実装セマンティクス)
  - CAL-003(evidence_register)
  - MOD-010(money_point_policy)
  - SSK 電子レセプト作成手引きページ(REG-007 参照)
depends_on: [CAL-004, CAL-006, CAL-007, CAL-008, MST-001, MOD-005]
impacts: [packages/calculation, packages/claim(将来), WP-2103以降]
open_questions:
  - マスター解決モジュールの実装時期(MST-001 パイプライン実装との順序)
  - レセプト中間モデル(CLM系)との型境界(WP-0031 で確定)
blockers:
  - 乗率・減算・クランプ・負担金・要件自動判定は evidence 未発行につき該当段 BLOCKED(本文明記)
```

## 1. 位置づけ — CAL-004 との関係

- **CAL-004 v0.2.1 は「第1弾実装(WP-2101b)の限定セマンティクス」**であり、独立・固定点数・加算のみの5ルールと POINTS_ONLY_COPAY_BLOCKED 境界を定める。**現時点の実装拘束は CAL-004 が優先**する。
- 本書(CAL-005)はその**上位アーキテクチャ(目標像)**であり、段階的実装のロードマップを定める。本書と CAL-004 が矛盾する場合は、実装を先に変えず、改版手続き(PRC-007)で解消する。
- 各社レセコンの内部算定エンジン仕様は非公開である。本エンジンは**ベンダー実装の模倣ではなく**、調剤報酬点数表・記録条件仕様・標準仕様・基本マスター・電子レセプト作成手引きに準拠した**根拠追跡型ルールエンジン**として設計する。

## 2. 大原則

1. **決定論的ルールエンジン + バージョン管理**。同一入力(処方・日付・マスター版・ルール版・モード・外部確認状態)なら同一出力。
2. **LLM/AIに算定判断をさせない**。AI は補助・候補提示・説明文生成に限定し、保険請求額の確定・点数の決定・請求可否判定には一切関与させない。
3. pure function(DB・外部API・現在時刻へ直接依存しない — v0.1.7 §18)。
4. evidence_id / calculation_trace 必須。floating point 禁止(MOD-010)。
5. 算定エンジンは単なる計算関数ではなく**薬局業務全体の安全制御装置**である。「根拠不足を正しく検知して止まる」ことを成功と定義する。

## 3. 9段パイプライン

```text
1 入力検証 → 2 マスター解決 → 3 処方グルーピング → 4 算定候補抽出
→ 5 算定条件評価 → 6 金額・点数計算 → 7 負担金計算 → 8 請求可否判定 → 9 出力
```

| 段 | 責務 | 実装状態 / BLOCKED境界 |
|---|---|---|
| 1 入力検証 | 患者・保険・公費・処方・調剤・マスター版・ルール版・モードの構造検証 | 実装済み(型+実行時 assert)。入力経路(手入力/QR/OCR/電子処方箋/前回Do)は上流で `CanonicalPrescription` に正規化してから渡す。QR/OCR 読取結果を処方箋原本扱いしない(原本照合は上流責務) |
| 2 マスター解決 | 医薬品・薬価・調剤行為・コメント・公費・PMH のコード解決(CodeMappingRegistry 経由) | **未実装**。マスター取込パイプライン(MST-001)実装まで、マスター依存項目(薬剤料等)は BLOCKED。曖昧一致は CODE_MAPPING_REVIEW_REQUIRED |
| 3 処方グルーピング | RP・剤・用法・日数・数量・剤形・合算可否の解決(PrescriptionGroupResolver) | **未実装・BLOCKED**。「剤」判定は WP-0026(prescription_grouping_policy)承認+留意事項通知(CAL-003 P-06)evidence 発行が前提 |
| 4 算定候補抽出 | 技術料・薬剤料・材料料・管理料・加算の候補列挙 | 部分実装(呼び出し側が applicable rules を明示指定する形 — CAL-004 §5)。候補と確定の分離ステータスは CAL-007 |
| 5 算定条件評価 | 施設基準・患者属性・処方属性・調剤属性・月内回数・併算定不可(評価順序14段は CAL-006) | 部分実装(適用日ガード・重複・上限・排他グループのみ)。**要件自動判定は evidence(留意事項通知・施設基準)未発行につき BLOCKED**。施設基準は FacilityBasisSnapshot(WP-0027)を請求月単位で固定 |
| 6 金額・点数計算 | 薬剤料(15円以下1点・10円ごと1点)・材料料(価格/10円)・各種点数・選定療養・消費税 | 固定点数加算の合算のみ解禁(CAL-004)。**乗率(100分の80/90)・減算・下限クランプは集計セマンティクス未定義につき BLOCKED**。薬剤料は WP-0025(drug_fee_policy)承認後。選定療養は別建て(WP-0028): 保険請求分/患者一部負担/選定療養額/消費税/帳票表示/レセプト影響/患者説明履歴を分離 |
| 7 負担金計算 | 保険・公費・PMH・限度額・患者一部負担 | **全面 BLOCKED**。点→円換算・負担割合・端数処理の evidence 未発行(CAL-004 §4)。公費按分・PMH は制度 evidence も未発行 |
| 8 請求可否判定 | 外部確認状態・薬歴記録・薬剤師確認・レセプト記録条件の総合判定 | 部分実装(claimable:false 型強制・isClaimable)。薬学管理料×薬歴未記載の請求前点検 BLOCKER 連携は CAL-007。レセプト記録条件検証は WP-2102(BLOCKED)側 |
| 9 出力 | calculation_trace・レセプト中間モデル・帳票モデル・warnings・blockers | trace は実装済み。レセプト中間モデル(ReceiptIntermediateModel)は WP-0031、帳票モデルは帳票SSOT承認後 |

## 4. 目標入出力型(実装済み型と整合)

現行実装(`CalculationRequest` / `CalculationResult`)からの拡張目標。**branded types・CalendarDate 系・SystemMode は実装済みのものを唯一の正とし、再定義しない。**

```ts
// 目標形(擬似コード — 実装は各SSOT承認後のWPで段階拡張)
type CalculationInput = {
  tenantId: TenantId; pharmacyId: PharmacyId;
  patient: PatientSnapshotRef;                  // 現行: { patientId } — スナップショット化は DOM-002 準拠で拡張
  insurance: InsuranceSnapshotRef;              // 現行どおり opaque ref(保険ドメインSSOT承認まで)
  publicExpenses: PublicExpenseRef[];
  pmh: PMHVerificationRef | null;               // 【BLOCKED】PMH evidence 未発行
  prescription: CanonicalPrescriptionRef;       // 正規化済み処方(グルーピングは段3)
  dispensing: DispensingResultRef;
  dates: { prescriptionDate; receptionDate; dispensingDate; claimMonth };  // 実装済み型
  facilityBasis: FacilityBasisSnapshotRef;      // 【未実装】WP-0027
  versions: { masterVersion; calculationRuleVersion; receiptSpecVersion };  // receiptSpecVersion は WP-0031 で追加
  mode: SystemMode;                             // 【未実装】LOCAL_ONLY 時は仮算定のみ(WP-0029)
  externalVerificationStatus: ExternalVerificationSnapshotRef;  // 【未実装】オン資/PMH/電子処方箋の確認状態
  priorCalculationHistoryRef: PriorCalculationHistoryRef;      // 【BLOCKED: 設計・evidence未】当月既算定履歴スナップショット参照 — frequency_limit(CAL-006 §2)判定用。純関数維持のため履歴は明示入力とする(opus4.8 指摘反映)
};

type CalculationOutput = CalculationResult      // 現行 3-status union を CAL-007 の候補/確定ステータスで拡張
  & { feeItems; totals; receiptIntermediateModel: ReceiptIntermediateModel | null; reportModel };
```

拡張の規律: 新フィールド追加は**本SSOTと該当SSOTの改版 → opus4.8 レビュー → 実装WP**の順。実装先行は SSOT_UPDATE_REQUIRED。

## 5. モジュール構成(目標)

```text
packages/calculation/
  core(calculate / context / result)            … 実装済み(単一ファイル。分割は次の実装WPで)
  rules(rule-registry / rule-evaluator / fee-item-rules)  … CAL-006 承認後
  grouping(prescription-group-resolver)          … WP-0026 承認後(WP-2103)
  drug-fee / materials                           … WP-0025 承認後(WP-2104)
  burden(patient-burden / public-expense / pmh)  … copay evidence 発行後
  selected-medical-care                          … WP-0028 承認後(WP-2106)
  trace                                          … @yrese/trace が正本(CAL-008)
  validation(input-validator / claimability-validator)  … CAL-007 承認後
```

依存方向は MOD-003 に従う(DB・外部API・UI への依存禁止)。

## 6. 段階的実装ロードマップ

1. **現在地**: 段1+段4〜6の固定点数サブセット+段8の型強制(WP-2101b、16テスト)
2. 候補/確定分離ステータス(CAL-007 → WP-2105)
3. 処方グルーピング骨格(WP-0026 → WP-2103)、薬剤料(WP-0025 → WP-2104)。**注意: 使用薬剤料の EVD-CAL 採番は点数規定の値のみであり、端数処理(五捨五超入等)の evidence は未発行。「採番済み=実装可」ではなく、薬剤料実装は WP-0025(drug_fee_policy)承認+端数処理 evidence 発行まで BLOCKED**
4. 乗率・減算・クランプのセマンティクス定義(CAL-004 改版+留意事項通知 evidence)
5. 負担金(copay evidence 発行後)、選定療養(WP-2106)、レセプト中間モデル接続(WP-0031)

## 7. 層別ステータス用語集(誤判定防止)

ステータス語彙は層別に併存する。層をまたぐ流用・混同を禁止し、**`status !== 'BLOCKED'` 型の否定形成功判定は全層で禁止**する(判定は常にホワイトリスト比較 — CAL-004 §4)。

| 層 | ステータス | 正本 |
|---|---|---|
| item level(算定項目) | AUTO_CALCULATED / SUGGESTED_REQUIRES_CONFIRMATION / REQUIRES_PHARMACIST_CONFIRMATION / REQUIRES_RECORD / BLOCKED_UNSUPPORTED_CLAIM(evidence 不在/失効は BLOCKED_REGULATORY_REVIEW blocker で表現) | CAL-007 |
| result level(算定結果) | BLOCKED / POINTS_ONLY_COPAY_BLOCKED / CALCULATED | CAL-004 §4 / packages/calculation |
| trace step level | applied / suggested / excluded / blocked | CAL-008 §4 |
| document level(文書・外部確認) | PROVISIONAL_STATUSES 6種(PENDING_REVERIFY 等) | MOD-005 / shared-kernel |

## 8. 変更履歴

- 0.2.0 (2026-07-09): opus4.8 レビュー(APPROVE_WITH_CHANGES)反映 — priorCalculationHistoryRef 予約スロット追加 / §6 薬剤料の「採番済み」表現を是正(端数 evidence 未発行につき BLOCKED)/ 層別ステータス用語集を追加。承認。
- 0.1.0 (2026-07-09): 初版(ユーザー提供レセコン調査 §4〜§11 を SSOT 化)。
