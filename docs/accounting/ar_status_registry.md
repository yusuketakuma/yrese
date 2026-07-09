# ar_status_registry — 会計状態レジストリ

```yaml
ssot_id: ACC-006
title: 会計状態レジストリ(PatientReceivable / Payment / ReceiptDocument)
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
source_refs: 構築プロンプト v0.2.0 §0.0.4.3
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

**PAID からの訂正遷移(opus4.8 指摘反映)**: 資格確認の遡及変更・算定訂正により入金後に差額が生じた場合、
PAID→REFUND_REQUIRED(患者有利差額)/ PAID→ADJUSTMENT_REQUIRED(要調整)へ遷移できる(ACC-005 の recalculation_diff と相互参照)。
医療会計で頻出する「入金後訂正」の正規経路であり、この遷移も append-only の状態遷移イベントとして記録する(ACC-001 §2.1)。

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

割当可能起点(opus4.8 指摘反映): **RECEIVED(現金)と CAPTURED(キャッシュレス売上確定)の両方から ALLOCATED / PARTIALLY_ALLOCATED へ遷移可能**とする(ACC-004 §4 の RECEIVED 起点記述はキャッシュレス時 CAPTURED に読み替える)。

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
再発行の反復: REISSUED→REISSUED の自己ループを許容する(2回目以降の再発行。回数・理由・交付履歴を毎回記録 — RCP-003)。

**注記(opus4.8 指摘反映)**: StatementDocument(調剤明細書)は状態機械を**持たない**。出力時点の calculation_trace から再生成可能な成果物として扱い、無効化・差替は交付履歴への void 記録で表現する(ACC-001 §3 / RCP-004 と整合、fable5決定)。

## 5. 変更履歴

- 0.2.0 (2026-07-09): PAID→REFUND_REQUIRED/ADJUSTMENT_REQUIRED の入金後訂正遷移、CAPTURED→ALLOCATED 明記、REISSUED 自己ループ、StatementDocument 状態機械なし注記。APPROVED 化。
- 0.1.0 (2026-07-09): 初版。
