# payment_allocation_policy — 入金割当ポリシー

```yaml
ssot_id: ACC-003
title: 入金割当ポリシー
domain: accounting
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: opus4.8レビュー(APPROVE_WITH_CHANGES)全指摘反映後、fable5承認(人間の包括承認範囲内)
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

## 5. チャネル跨ぎ二重収納の検出(opus4.8 指摘反映)

Idempotency-Key の一致は「同一操作の再送」しか捕捉できない。**異なる key で同一の実世界入金が二重登録されるケース**(オフライン手入力+オンライン入力の重複、端末跨ぎの二重入力等)に対し、以下の検出契機を設ける。

- **自動フラグ条件**: 同一患者 × 同額 × 近接時間窓(候補: 24時間、実装時に調整可)× 同一債権(または同一受付)への複数 Payment を検出したら、当該債権を `BLOCKED_ACCOUNTING_REVIEW`(二重計上疑い)へ自動遷移させ、人間レビューへ回す。
- 自動での取消・マージは行わない(誤検知時の会計事実改変を防ぐ — CONFLICT_REQUIRES_HUMAN_REVIEW と同思想)。
- 検出イベントは AccountingAuditEvent に記録する(ACC-011)。

## 6. 変更履歴

- 0.2.0 (2026-07-09): チャネル跨ぎ二重収納の検出条件を §5 に新設(患者×同額×時間窓×同一債権→BLOCKED_ACCOUNTING_REVIEW 自動フラグ)。APPROVED 化。
- 0.1.0 (2026-07-09): 初版。
