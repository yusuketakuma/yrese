# refund_adjustment_policy — 返金・調整ポリシー

```yaml
ssot_id: ACC-005
title: 返金・調整・差額精算ポリシー
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
source_refs: 構築プロンプト v0.1.8 §0.0.4.3
depends_on: [ACC-001, ACC-006, RCP-003(領収証再発行・取消), MOD-007(permission_scope_registry — 返金・取消 scope の改版待ち)]
open_questions:
  - 資格確認結果の遡及変更(保険者変更)時の差額精算の実務手順(請求実務レビュー)
  - 現金以外(キャッシュレス)返金の扱い(ACC-009 の接続確定後)
  - 返金・取消の専用 permission scope(refund:write / refund:approve 等)— MOD-007 改版で確定(実装WPの前提依存として track)
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

### 2.1 不変条件(opus4.8 指摘反映 — 実装WPの必須テスト)

- **Reversal 多重適用ガード**: 同一台帳レコードへの Reversal は**最大1回**。Reversal レコード自体への Reversal は禁止する。訂正の訂正が必要な場合は、新たな Adjustment として元レコード参照付きで記録する(二重逆仕訳によるマイナス残高の捏造を防ぐ)。
- **返金上限**: 同一 Payment に対する **Refund 累計額 ≤ 当該 Payment の受領純額(受領額 − 既 Reversal 額)** を実行時不変条件とする。受領超過の返金は型・API 層で拒否する(返金詐取防止の最重要インバリアント)。上限超過の試行は BLOCKED_ACCOUNTING_REVIEW + 監査記録。

## 3. 変更履歴

- 0.2.0 (2026-07-09): Reversal 多重適用ガード(最大1回・Reversal の Reversal 禁止)、返金上限不変条件(Refund累計≤受領純額)、MOD-007 scope 依存の track。APPROVED 化。
- 0.1.0 (2026-07-09): 初版。
