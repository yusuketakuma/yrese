# receipt_reissue_cancel_policy — 領収証再発行・取消・差替ポリシー

```yaml
ssot_id: RCP-003
title: 領収証再発行・取消・差替ポリシー
domain: receipt
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: [構築プロンプト v0.1.8 §0.0.4.3(ReceiptDocument状態), §0.0.4.5]
depends_on: [RCP-001, RCP-002, ACC-011(accounting_audit_log — WP-0033)]
impacts: [WP-2202, WP-3101]
open_questions:
  - 再発行時の「再発行」表示の様式要件【要確認: 実務・税務慣行レビュー】
  - 再発行手数料の扱い(徴収する場合の会計処理)【要確認: 経営判断】
blockers: []
```

## 1. 状態遷移

ReceiptDocument の状態は v0.1.8 §0.0.4.3 の6状態のみを使う。

```text
DRAFT → ISSUED
ISSUED → REISSUED(原本は保持、再発行文書を新規作成)
ISSUED → CANCELLED(入金自体の取消に連動)
ISSUED → VOIDED_WITH_REASON(発行ミス等 — 理由必須)
ISSUED → REPLACED(差替 — 後継文書IDを必須記録)
```

禁止遷移:

- 発行済み文書の**内容の上書き変更**(いかなる状態でも不可 — 訂正は必ず VOIDED_WITH_REASON + 新規発行、または REPLACED)
- 理由なしの VOIDED / CANCELLED
- CANCELLED / VOIDED 文書の状態復帰(誤操作時も新規発行で対応)

## 2. 再発行(REISSUED)

- 再発行文書には**「再発行」の表示を必須**とする(原本との誤認・二重利用防止)。
- 再発行文書は原本の receipt_document_id への参照と再発行回数を持つ。
- 再発行時の保存項目: 再発行者・再発行日時・reissue_reason・hash(RCP-005 の出力時点保存項目一式)。
- 原本の交付履歴は保持したまま、再発行の交付履歴を追加する。

## 3. 取消(CANCELLED)・無効化(VOIDED_WITH_REASON)

- **CANCELLED**: 入金の取消・返金(Payment REVERSED / REFUNDED)に連動する取消。会計台帳の reversal と必ず対応付ける(領収証だけの取消は不可)。
- **VOIDED_WITH_REASON**: 入金事実は有効だが文書として無効化する場合(記載ミス等)。cancel_reason 必須、通常は REPLACED / 新規発行が後続する。
- 取消・無効化された文書は削除せず、状態表示付きで保存する(見読性・保存性)。

## 4. 差替(REPLACED)

- 差替は「旧文書 VOIDED_WITH_REASON → 新文書 ISSUED」の複合操作として扱い、旧文書に後継文書IDを記録する。
- 差替チェーンは監査画面から追跡可能にする。

## 5. 監査証跡

- 再発行・取消・差替の全操作は AccountingAuditEvent(操作者・日時・理由・対象文書・関連 Payment)として記録する。
- 入金取消・返金・再発行時の監査証跡は v0.1.8 §0.0.4.4 の必須要件。
- 監査証跡の欠落した再発行・取消操作は実装上不可能にする(API 層で強制)。

## 6. 変更履歴

- 0.1.0 (2026-07-09): 初版(WP-0034)。
