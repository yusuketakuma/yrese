# facility_billing_policy — 施設請求ポリシー

```yaml
ssot_id: ACC-010
title: 施設請求・売掛ポリシー(データモデル分離)
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
source_refs: 構築プロンプト v0.1.8 §0.0.4.7
depends_on: [ACC-001, ACC-002]
open_questions:
  - 施設請求の MVP 実装可否(v0.1.8 の指示どおり fable5 が派生機能調査 WP-0037 後に判断)
  - 施設請求書の様式・締め日・支払サイトの実務要件(実務レビュー)
  - 訪問調剤・居宅療養管理指導との関係(介護保険連携は非MVP: PRD-002)
```

## 1. 原則: 個人会計と施設請求の分離

- データモデル上、「個人患者会計」(PatientReceivable)と「施設・法人単位請求」(FacilityInvoice / FacilityPayment)を**最初から分離**する(v0.1.8 §0.0.4.7)。
- FacilityInvoice は複数患者の患者負担分を施設単位で月次集約する文書であり、**患者別内訳**(どの患者のどの会計か)を必ず保持する。
- 施設請求へ集約された患者未収は、個人窓口未収と二重請求にならないよう請求経路フラグで排他する。

## 2. MVP境界

- MVP: データモデル分離(本書)+ 請求経路フラグのみ。
- 施設請求書発行・売掛管理・施設別入金消込・本部債権管理: **実装可否は WP-0037(派生機能調査)後に fable5 が判断**。ベンチマーク(PRD-004)では P-CUBE n 等が「会計・施設請求」を基本機能としており、MVP近傍の有力候補。

## 3. 売掛(施設)

- FacilityPayment の入金割当は ACC-003 と同一原則(append-only・履歴必須・Idempotency)。
- 施設単位の未収集計は日計(ACC-007)と区分して表示する。

## 4. 変更履歴

- 0.2.0 (2026-07-09): opus4.8 レビュー通過(本書への個別指摘なし)に伴う承認化。APPROVED 化。
- 0.1.0 (2026-07-09): 初版。
