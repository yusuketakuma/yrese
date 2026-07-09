# accounting_domain_model — 会計ドメインモデル

```yaml
ssot_id: ACC-001
title: 会計ドメインモデル(append-only ledger)
domain: accounting
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.1.8 §0.0.4.1, §0.0.4.3
depends_on: [MOD-010(money_point_policy), CAL-004, ARC-001, ARC-002, SEC-007]
impacts: [ACC-002..011, docs/receipt/**, WP-2201, WP-3101]
open_questions:
  - 会計台帳の法定保存期間(REG-003 と同期【要確認】)
  - 仕訳データ出力形式(会計システム連携要件の調査後)
blockers:
  - 一部負担金(copay)の evidence 未発行(BLOCKED_REGULATORY_REVIEW)— 算定由来 Charge の確定金額生成は copay 解禁まで不可
```

## 1. 5領域の分離(v0.1.8 §0.0.4.1 — 最上位原則)

| 領域 | 責務 | 正本SSOT |
|---|---|---|
| Calculation | 調剤報酬点数・患者負担額・保険/公費請求額の算出 | CAL-004/005 |
| Claim | レセプト請求・保険者請求・公費請求 | CLM-001/002 |
| Accounting | 患者請求、未収、入金、返金、差額精算、日計 | 本書 ACC-* |
| Receipt | 領収証、調剤明細書、再発行、取消、交付履歴 | docs/receipt/ RCP-* |
| POS/Payment | 現金、クレジット、電子マネー、QR決済、セルフレジ、POS連携 | ACC-008/009 |

**原則**: 算定結果は「請求すべき金額の根拠」であり、入金は「実際に受領した金額の事実」である。
両者を混同してはならない。領収証は原則として実際に入金・収納された金額に対して発行する(RCP-001)。
未収分を受領済みのように表示してはならない。

## 2. append-only ledger 原則

- 会計台帳は **追記専用(append-only)**。既存レコードの上書き・削除で会計事実を改変してはならない。
- 修正は必ず新規レコードとして記録する: `Reversal`(取消)/ `Adjustment`(調整)/ `Refund`(返金)/ `recalculation_diff`(再計算差額)。
- 金額は**整数円**とし、実装は @yrese/money の `Yen`(bigint)を唯一の表現とする。floating point 禁止(MOD-010)。
- 全レコードに tenant_id / pharmacy_id / 作成者 / 作成日時 / correlation_id を必須とする。

## 3. ドメイン概念(v0.1.8 §0.0.4.3 の全21概念)

| 概念 | 定義 | 備考 |
|---|---|---|
| Charge | 患者・保険者・公費・PMH への請求発生事実(算定結果由来) | calculation_trace 参照必須 |
| PatientReceivable | 患者未収債権 | 状態は ACC-006 |
| InsuranceReceivable | 保険者請求債権 | Claim 領域と接続 |
| PublicExpenseReceivable | 公費請求債権 | 同上 |
| PMHReceivable | PMH医療費助成債権 | PMH確認状態に従属 |
| Payment | 入金事実 | 状態は ACC-006 |
| PaymentAllocation | 入金の未収への割当 | ACC-003 |
| PartialPayment | 一部入金 | ACC-004 |
| Refund | 返金 | ACC-005 |
| Adjustment | 調整(算定訂正・減免等) | 理由必須 |
| Cancellation | 会計取消 | 理由必須 |
| Reversal | 逆仕訳(誤記録の打ち消し) | 元レコード参照必須 |
| ReceiptDocument | 領収証文書 | RCP-001、状態は ACC-006 |
| StatementDocument | 調剤明細書文書 | RCP-004 |
| DailyCashClosing | 日計・レジ締め | ACC-007 |
| CashDrawerSession | レジ現金セッション | ACC-007 |
| PaymentMethod | 支払方法 | ACC-008 |
| POSSettlement | POS決済結果 | ACC-009(境界のみMVP) |
| FacilityInvoice | 施設請求書 | ACC-010 |
| FacilityPayment | 施設入金 | ACC-010 |
| AccountingAuditEvent | 会計監査イベント | ACC-011 |

## 4. Calculation との接続境界

- Charge は算定結果(CalculationResult)から生成する。**現時点では copay(一部負担金)が BLOCKED_REGULATORY_REVIEW のため、患者請求 Charge の金額確定は不可**。POINTS_ONLY_COPAY_BLOCKED 結果から Charge を生成してはならない(claimable: false)。
- copay evidence 発行・CALCULATED 解禁後に、Charge 生成パスを実装WP(WP-2201)で解禁する。
- Charge には calculation_trace / evidence_ids / マスター版 / ルール版を保存し、「金額の根拠を説明できる」(v0.1.7 §7)を満たす。

## 5. LOCAL_ONLY / RECOVERY_SYNC での会計

- LOCAL_ONLY 中の会計記録はローカル台帳へ追記し、`LOCAL_ONLY_UNVERIFIED` 相当の同期状態を持つ(ARC-001)。
- 同期は @yrese/events EventEnvelope(idempotency key 必須)で行い、**二重計上を冪等性で防止**する(ARC-002)。
- 復旧後の不一致は自動補正せず CONFLICT_REQUIRES_HUMAN_REVIEW。
- LOCAL_ONLY 中の領収証はローカル領収番号体系を用いる(RCP-002/ACC-004)。

## 6. 変更履歴

- 0.1.0 (2026-07-09): 初版(v0.1.8 受理に伴う新規作成)。
