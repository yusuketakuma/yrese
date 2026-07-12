# partial_payment_policy — 一部入金ポリシー

```yaml
ssot_id: ACC-004
title: 一部入金ポリシー(MVP対象)
domain: accounting
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-12
approved_at: 2026-07-09
approved_by: opus4.8レビュー(APPROVE_WITH_CHANGES)全指摘反映後、fable5承認(人間の包括承認範囲内)
effective_from: null
effective_to: null
source_refs: 構築プロンプト v0.2.0 §0.0.4.4
depends_on: [ACC-001, ACC-002, ACC-003, docs/receipt/receipt_issuance_policy.md]
impacts: [ACC-002 receivable, ACC-003 allocation, ACC-005 refund and adjustment, ACC-006 states, ACC-007 daily closing, RCP-001 partial receipt, RCP-002 local numbering, future WP-2201/2202/3101]
related_work_packages: [WP-0033, WP-0034, WP-2201, WP-2202, WP-3101, WP-9002-W23]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文§5の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-12 WP-9002-W23 metadata-only completion: body/status/version/approval/effective/partial-payment semantics unchanged"
open_questions:
  - 未収残額を領収証または別紙に表示するか否か(【要確認: 公式通知・実務レビュー】確認まで領収証本体には受領額のみ記載)
  - 割当順序デフォルト(ACC-003 と同一論点)
blockers:
  - BLOCKED_REGULATORY_REVIEW(copay evidence未発行中は確定Charge/PatientReceivableがないため一部入金runtimeを開始しない; ACC-001 §4を狭く継承)
```

## 1. MVP対象宣言

一部入金は v0.2.0 により **MVP対象**。未収金額より少ない入金を正式にサポートする。

## 2. 必須要件(v0.2.0 §0.0.4.4 の10項)

1. 未収金額より少ない入金を許可する。
2. 入金額を複数の未収に割当可能にする(ACC-003)。
3. 割当順序のデフォルトを SSOT で定義する(ACC-003 §2)。
4. 受付日順・調剤日順・請求発生日順・ユーザー選択の優先順位を明確化する(ACC-003 §2)。
5. 入金割当後の残未収を即時表示する。
6. 入金履歴を患者単位・処方単位・会計単位で追跡可能にする。
7. **一部入金額に対する領収証を発行できる**(領収証は受領事実に対応 — RCP-001。記載金額=実際に受領した金額)。
8. 未収残額の領収証/別紙表示要否は公式通知・実務レビューに基づき決定する(open_questions)。
9. 入金取消・返金・再発行時に監査証跡を残す(ACC-011)。
10. LOCAL_ONLY 時の一部入金は、ローカル領収番号(RCP-002)・同期状態・再検証状態を持つ。

## 3. 禁止事項(同 §0.0.4.4 の4項)

- 未入金額を領収済みとして領収証に表示すること。
- 一部入金で請求済み・入金済み・未収の区別を曖昧にすること。
- 入金割当を後から無履歴で変更すること(Reversal+再割当のみ可)。
- 一部入金の残額を患者画面・会計画面・日計から隠すこと。

## 4. 状態遷移

- 一部入金の受領 → PatientReceivable は `PARTIALLY_PAID`(ACC-006)。全額充当で `PAID`。
- Payment は `RECEIVED` → 割当により `PARTIALLY_ALLOCATED` / `ALLOCATED`。

## 5. 変更履歴

- 0.2.0 (2026-07-09): opus4.8 レビュー通過(本書への個別指摘なし)に伴う承認化。APPROVED 化。
- 0.1.0 (2026-07-09): 初版。
