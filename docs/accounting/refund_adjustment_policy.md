# refund_adjustment_policy — 返金・調整ポリシー

```yaml
ssot_id: ACC-005
title: 返金・調整・差額精算ポリシー
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
depends_on: [ACC-001, ACC-006, RCP-003(領収証再発行・取消)]
open_questions:
  - 資格確認結果の遡及変更(保険者変更)時の差額精算の実務手順(請求実務レビュー)
  - 現金以外(キャッシュレス)返金の扱い(ACC-009 の接続確定後)
```

## 1. 発生類型

| 類型 | 記録 | 例 |
|---|---|---|
| 過入金返金 | Refund(元 Payment 参照) | OVERPAID 解消 |
| 再計算差額(患者有利) | recalculation_diff + Refund | 資格確認遡及・算定訂正 |
| 再計算差額(患者不利) | recalculation_diff + 追加 Charge/Receivable | 同上 |
| 会計取消 | Cancellation + Reversal 一式 | 誤会計 |
| 減免・調整 | Adjustment(根拠必須) | 公費適用漏れの訂正 |

## 2. 原則

- すべて append-only(ACC-001 §2)。元レコード参照を必須とし、金額の増減が台帳から再構成できること。
- 再計算差額は、新旧 calculation_trace の両方を参照する(差額の根拠が説明可能)。
- 返金・取消・調整は権限 scope を分離し(permission_scope_registry 改版で追加)、破壊的操作として二段階確認(UIX-001)+監査記録(ACC-011)を必須とする。
- 返金時、発行済み領収証の扱いは RCP-003(取消/差替/再発行表示)に従う。

## 3. 変更履歴

- 0.1.0 (2026-07-09): 初版。
