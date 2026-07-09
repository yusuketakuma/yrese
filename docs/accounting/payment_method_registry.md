# payment_method_registry — 支払方法レジストリ

```yaml
ssot_id: ACC-008
title: 支払方法レジストリ
domain: accounting
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: opus4.8レビュー(APPROVE_WITH_CHANGES)全指摘反映後、fable5承認(人間の包括承認範囲内)
source_refs: 構築プロンプト v0.2.0 §0.0.4.3, §0.0.4.6
depends_on: [ACC-001, ACC-009]
open_questions:
  - キャッシュレス各方式(クレジット/電子マネー/QR)の決済事業者・端末要件(ACC-009 の接続確定後)
```

## 1. レジストリ構造

支払方法は台帳管理し、コードをローカル定義しない:

| フィールド | 説明 |
|---|---|
| method_code | 一意コード(例: CASH) |
| display_name | 表示名 |
| kind | cash / credit / e_money / qr / bank_transfer / other |
| requires_external_settlement | 外部決済(POS/決済端末)要否 |
| refundable_via | 返金経路(現金 / 元決済経路) |
| enabled | 薬局単位の有効化 |

## 2. 初期セット(MVP)

- `CASH`(現金): **MVP必須**。CashDrawerSession(ACC-007)と連動。
- `CREDIT` / `E_MONEY` / `QR`: レジストリ定義のみ(決済実行は ACC-009 の境界確定まで、手動消込=外部で決済した事実の記録として扱う)。

## 3. 規則

- Payment には method_code を必須とする(日計の支払方法別集計の基礎)。
- 外部決済の成否を本システムが捏造しない: POSSettlement の結果連携(ACC-009)がない限り「決済完了」を自動表示しない。
- 混合支払(現金+キャッシュレス)は複数 Payment として記録する。

## 4. 変更履歴

- 0.2.0 (2026-07-09): opus4.8 レビュー通過(本書への個別指摘なし)に伴う承認化。APPROVED 化。
- 0.1.0 (2026-07-09): 初版。
