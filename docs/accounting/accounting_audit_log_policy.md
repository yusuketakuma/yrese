# accounting_audit_log_policy — 会計監査ログポリシー

```yaml
ssot_id: ACC-011
title: 会計監査ログポリシー
domain: accounting
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.1.8 §0.0.4.3, §0.0.4.16
depends_on: [SEC-007(audit_log_design), MOD-008(audit_event_registry), ACC-001]
open_questions:
  - 会計監査ログの保存期間(REG-003 の法定保存期間と同期【要確認】)
```

## 1. 位置づけ

- AccountingAuditEvent は SEC-007 の監査ログ設計(EventEnvelope 基底・ハッシュチェーン・追記専用・削除権限分離)に従う会計ドメインのイベント種別群である。
- イベント種別の台帳は MOD-008(audit_event_registry)へ本書 APPROVED 後に追加する(ローカル定義禁止)。

## 2. 必須記録操作(初期セット)

| イベント種別候補 | 対象 |
|---|---|
| accounting.charge_created | Charge 生成(calculation_trace 参照付き) |
| accounting.payment_received / cancelled / refunded | 入金・取消・返金 |
| accounting.allocation_created / reversed | 割当・割当取消 |
| accounting.adjustment_created | 調整(理由必須) |
| accounting.receivable_status_changed | 未収状態遷移 |
| receipt.issued / reissued / cancelled / voided / replaced | 領収証操作(理由・出力者・ハッシュ) |
| statement.issued / declined | 明細書交付・交付不要申出 |
| closing.session_opened / closed / discrepancy_recorded | レジ開設・締め・現金過不足 |
| facility.invoice_issued / payment_received | 施設請求・入金 |

## 3. 規則

- 金額を含むイベントは金額(整数円)・通貨前提(JPY)・関連レコードIDを持つ。**患者氏名等のPHIは載せず、ID参照のみ**(SEC-007)。
- 監査ログの欠落は操作失敗として扱う(監査書き込み成功を操作完了条件とする — UIX-005 ST 系と整合)。
- LOCAL_ONLY 中もローカル監査ログへ記録し、RECOVERY_SYNC で完全性検証(ARC-002 R1)。

## 4. 変更履歴

- 0.1.0 (2026-07-09): 初版。
