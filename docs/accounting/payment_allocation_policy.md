# payment_allocation_policy — 入金割当ポリシー

```yaml
ssot_id: ACC-003
title: 入金割当ポリシー
domain: accounting
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.1.8 §0.0.4.3, §0.0.4.4
depends_on: [ACC-001, ACC-002, ACC-006]
open_questions:
  - 割当順序デフォルトの確定(【要確認: 請求実務レビュー】候補: 請求発生日昇順)
```

## 1. 割当モデル

- Payment(入金事実)と PatientReceivable(未収)は **PaymentAllocation** で多対多に結ぶ。
- 1入金を複数未収へ割当可能。1未収へ複数入金の割当も可能(一部入金 ACC-004)。
- 割当合計は入金額を超えてはならない。超過入金は `OVERPAID` として返金導線(ACC-005)へ。

## 2. 割当順序

- デフォルト順序は SSOT で定義する(v0.1.8 §0.0.4.4)。**候補優先順**: ①ユーザー明示選択 ②請求発生日昇順 ③受付日昇順 ④調剤日昇順 —【要確認: 請求実務レビューで確定。確定まで実装はユーザー明示選択+請求発生日昇順のみ】
- 適用した順序ルールを PaymentAllocation に記録する(後から説明できること)。

## 3. 履歴・監査

- 割当は append-only。**割当の事後変更は、旧割当の Reversal + 新割当の追加**としてのみ行う(無履歴変更禁止)。
- 割当・割当取消は AccountingAuditEvent(ACC-011)に記録する。
- 割当後の残未収額を即時表示する(UI要件、WP-3101)。

## 4. 冪等性

- 入金登録・割当は Idempotency-Key を必須とし、LOCAL_ONLY→RECOVERY_SYNC の再送で二重割当しない(ARC-002 / @yrese/events)。

## 5. 変更履歴

- 0.1.0 (2026-07-09): 初版。
