# ar_status_registry — 会計状態レジストリ

```yaml
ssot_id: ACC-006
title: 会計状態レジストリ(PatientReceivable / Payment / ReceiptDocument)
domain: accounting
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.1.8 §0.0.4.3
depends_on: [ACC-001, MOD-005(status_registry)]
impacts: [packages/shared-kernel(将来の enum 追加), WP-2201, WP-3101]
open_questions:
  - WRITTEN_OFF の確定手続(法務・経営レビュー)
```

## 1. shared-kernel との整合(重複定義禁止)

- 本書が会計状態の**仕様上の正本**。実装への enum 追加は「本書 APPROVED → MOD-005 改版 → 実装WP(shared-kernel へ一元追加)」の手順で行う。
- apps/**・packages/** でのローカル定義は COMMON_MODULE_DUPLICATION_BLOCKED。
- 既存の PROVISIONAL_STATUSES(文書・算定レベル)とは直交する別レイヤー(会計レコードレベル)であり、値の流用・再定義をしない。

## 2. PatientReceivable 状態(10)

| 状態 | 定義 |
|---|---|
| NOT_BILLED | 請求前(Charge 未確定) |
| CALCULATED_UNPAID | 請求確定・未入金 |
| PARTIALLY_PAID | 一部入金済み |
| PAID | 全額入金済み |
| OVERPAID | 過入金(返金要) |
| REFUND_REQUIRED | 返金確定待ち |
| ADJUSTMENT_REQUIRED | 調整要(再計算差額等) |
| CANCELLED | 取消済み |
| WRITTEN_OFF_REVIEW_REQUIRED | 貸倒検討(人間承認まで確定しない) |
| BLOCKED_ACCOUNTING_REVIEW | 不整合検出・停止(同期競合・二重計上疑い) |

主遷移: NOT_BILLED→CALCULATED_UNPAID→(PARTIALLY_PAID)→PAID。
禁止遷移: PAID/CANCELLED からの直接金額変更(Reversal/Adjustment 経由のみ)、BLOCKED_ACCOUNTING_REVIEW の人間レビューなし解除。

## 3. Payment 状態(10)

| 状態 | 定義 |
|---|---|
| INITIATED | 決済開始(キャッシュレス等) |
| AUTHORIZED | 与信確保 |
| CAPTURED | 売上確定 |
| RECEIVED | 受領(現金は直接この状態から) |
| ALLOCATED | 全額割当済み |
| PARTIALLY_ALLOCATED | 一部割当済み |
| CANCELLED | 取消 |
| REFUNDED | 返金済み |
| FAILED | 失敗 |
| REVERSED | 逆仕訳済み |

禁止遷移: FAILED/CANCELLED からの ALLOCATED(失敗決済の割当禁止)、REFUNDED の再割当。

## 4. ReceiptDocument 状態(6)

| 状態 | 定義 |
|---|---|
| DRAFT | 下書き(未交付) |
| ISSUED | 発行済み |
| REISSUED | 再発行済み(再発行表示必須 — RCP-003) |
| CANCELLED | 取消 |
| VOIDED_WITH_REASON | 理由付き無効化 |
| REPLACED | 差替済み(後継文書参照必須) |

禁止遷移: ISSUED の無履歴変更(取消・差替・再発行のみ)、理由なしの VOIDED。

## 5. 変更履歴

- 0.1.0 (2026-07-09): 初版。
