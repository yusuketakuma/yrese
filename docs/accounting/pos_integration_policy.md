# pos_integration_policy — POS・セルフレジ・キャッシュレス連携ポリシー

```yaml
ssot_id: ACC-009
title: POS・セルフレジ・キャッシュレス連携ポリシー(境界設計)
domain: accounting
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-12
approved_at: 2026-07-09
approved_by: opus4.8レビュー(APPROVE_WITH_CHANGES)全指摘反映後、fable5承認(人間の包括承認範囲内)
effective_from: null
effective_to: null
source_refs: 構築プロンプト v0.2.0 §0.0.4.1, §0.0.4.6
depends_on: [ACC-001, ACC-008, docs/integration/**(WP-0036), ADP-002]
impacts: [ACC-006 payment states, ACC-008 payment methods, future WP-0036 Integration Hub and Partner API, future POS adapter and WP-3101 UI]
related_work_packages: [WP-0033, WP-0036, WP-0037, WP-2203, WP-3101, WP-9002-W24]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文§4の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-12 WP-9002-W24 metadata-only completion: body/status/version/approval/effective/POS-integration semantics unchanged"
open_questions:
  - 接続対象POS/セルフレジ/決済端末の製品調査(WP-0037 派生機能調査)
  - OTC・物販との同時会計の境界(レセコン側は保険調剤会計のみか、合算表示か — 実務レビュー)
blockers:
  - BLOCKED_NOT_READY(WP-0036 Integration Hub/Partner API、WP-0037 vendor調査、人間product/accounting/security承認前はPOS・決済端末direct integrationを実装しない)
```

## 1. MVP境界(v0.2.0 §0.0.4.6)

- **外部POS・セルフレジ・キャッシュレス決済との直接接続は MVP 必須にしない**。
- ただし以下を MVP で設計しておく: API境界、イベント(POSSettlement)、データモデル(ACC-001)、将来接続用 Partner Adapter の登録枠(Integration Hub / adapter_registry)。

## 2. 連携原則

- POS/決済連携は Partner Systems 連携であり、Integration Hub(WP-0036)の Partner API 経由。直接DB参照禁止。
- POSSettlement は入金事実の**外部ソース**: 受信時に Payment(RECEIVED/CAPTURED)へ変換し、Idempotency-Key で二重計上を防止する。
- 決済取消・決済失敗・端末障害は明示状態(FAILED/CANCELLED/REVERSED — ACC-006)で扱い、**失敗を成功に見せない**。
- 決済端末障害時は現金等の代替手順(OPS-007 device matrix)へ誘導し、会計を止めない。

## 3. セルフレジ

- セルフレジは「患者自身による支払受付」であり、薬剤師確認・服薬指導の完了状態と分離する(支払完了≠交付可否の自動判定)。交付可否は業務フロー側のガードに従う。

## 4. 変更履歴

- 0.2.0 (2026-07-09): opus4.8 レビュー通過(本書への個別指摘なし)に伴う承認化。APPROVED 化。
- 0.1.0 (2026-07-09): 初版。
