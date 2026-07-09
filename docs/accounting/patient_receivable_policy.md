# patient_receivable_policy — 患者未収債権ポリシー

```yaml
ssot_id: ACC-002
title: 患者未収債権ポリシー
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
depends_on: [ACC-001, ACC-006, CAL-004]
open_questions:
  - 長期未収の督促・時効・貸倒(WRITTEN_OFF)の実務・法務基準(人間レビュー)
  - 未収残高の患者向け通知方法(実務レビュー)
```

## 1. 発生

- PatientReceivable は Charge(患者負担分)から生成する。金額根拠は calculation_trace を必ず参照する。
- **copay evidence 未発行の現時点では、確定金額の PatientReceivable を生成できない**(ACC-001 §4)。仮算定(PROVISIONAL_CALCULATION)からは仮債権を作らず、「未確定」として会計台帳外で扱う(誤請求防止)。

## 2. 原則

- 未収は隠さない: 患者画面・会計画面・日計・患者検索後の会計導線で未収残高を常時表示する(v0.1.8 §0.0.4.4 禁止事項)。
- 請求済み・入金済み・未収の区別を曖昧にしない。
- 減免・調整は Adjustment として理由・根拠(公費・自治体制度等は evidence 参照)付きで記録する。
- 貸倒処理は `WRITTEN_OFF_REVIEW_REQUIRED` とし、人間承認なしに確定しない。

## 3. 状態

状態機械の正本は ACC-006(ar_status_registry)。本書は運用規則のみ定める:

- `CALCULATED_UNPAID` → 入金割当(ACC-003)により `PARTIALLY_PAID` / `PAID` へ。
- `OVERPAID` は返金(ACC-005)必須の要対応状態として会計担当のワークリストに表示する。
- `BLOCKED_ACCOUNTING_REVIEW` は不整合検出時(同期競合・二重計上疑い等)の停止状態。解除は人間レビュー。

## 4. 追跡可能性

- 患者単位・処方単位・会計(受付)単位で入金履歴・残額を追跡可能にする。
- 未収一覧は薬局単位・期間・患者で集計できる(日計 ACC-007 と整合)。

## 5. 変更履歴

- 0.1.0 (2026-07-09): 初版。
