# receipt_issuance_policy — 領収証発行ポリシー

```yaml
ssot_id: RCP-001
title: 領収証発行ポリシー
domain: receipt
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
source_refs: [構築プロンプト v0.1.8 §0.0.4.1, §0.0.4.3, §0.0.4.5]
depends_on: [ACC-001(accounting_domain_model — WP-0033), RCP-002, RCP-003, RCP-005]
impacts: [WP-2202(領収証バックエンド), WP-3101(会計・領収証画面)]
open_questions:
  - 領収証の法定記載事項(療担規則・記載要領の該当規定)【要確認: 一次資料精読 → evidence_id 発行】
  - 医療費控除対応の記載範囲【要確認】
blockers:
  - 実装は本SSOT + ACC-001 の APPROVED まで禁止(v0.1.8 §0.0.4.16)
```

## 1. 基本原則 — 領収証と調剤明細書の概念分離

本プロダクトでは以下を**別概念**として扱う(v0.1.8 §0.0.4.5)。

| 文書 | 対応する事実 | 発行条件 |
|---|---|---|
| **領収証(ReceiptDocument)** | 患者から**費用の支払を受けた事実**(入金・収納) | 入金事実の成立 |
| **調剤明細書(StatementDocument)** | 療養の給付に係る費用の**算定基礎となった項目**の提示 | 算定結果の確定(RCP-004 参照) |

### 絶対原則(全 receipt 系SSOT共通)

1. **領収証は、実際に入金・収納された金額に対してのみ発行する。**
2. **未入金額を領収済みとして領収証に表示してはならない**(v0.1.8 §0.0.4.4 禁止事項)。
3. 領収証発行は算定結果(Calculation)・請求(Claim)・会計台帳(Accounting)と分離し、Accounting の Payment 事実を根拠とする。
4. 金額は整数円(bigint)。floating point 禁止(@yrese/money 使用、ローカル再実装禁止)。

## 2. 発行タイミング

- 領収証は Payment が `RECEIVED` または `CAPTURED`(ACC-001 の Payment 状態)に達した入金事実に対応して発行する。
- 算定確定のみ(入金なし)では領収証を発行しない(この段階で発行できるのは調剤明細書・請求書系文書のみ)。
- 発行前状態は `DRAFT`、発行で `ISSUED`(ReceiptDocument 状態は v0.1.8 §0.0.4.3 の6状態のみ: DRAFT / ISSUED / REISSUED / CANCELLED / VOIDED_WITH_REASON / REPLACED)。

## 3. 一部入金時の領収証

- 一部入金(PartialPayment)に対する領収証は、**当該入金額のみ**を領収金額として記載する。
- 未収残額の領収証面への表示要否は【要確認: 公式通知・実務レビュー】(v0.1.8 §0.0.4.4)。決定まで、残額は領収証面ではなく会計画面・別紙で明示する設計を第一候補とする。
- 残額を隠すことは禁止(患者画面・会計画面・日計から常に可視)。

## 4. 交付履歴・患者交付済みフラグ

- 全ての領収証に交付履歴(交付日時・交付方法・交付者・受領者区分〈本人/代理人〉)を記録する。
- `患者交付済みフラグ` を ReceiptDocument に持たせ、未交付/交付済みを会計画面で可視化する。
- 代理人交付時は RCP-006(プライバシー)の確認手順を経る。

## 5. LOCAL_ONLY / RECOVERY_SYNC

- LOCAL_ONLY 時の入金・領収証発行は許可するが、ローカル領収番号(RCP-002)・同期状態・再検証状態を必ず持つ(v0.1.8 §0.0.4.4)。
- 領収証データは同期イベント(@yrese/events EventEnvelope)として Outbox に積み、RECOVERY_SYNC で重複検出・整合検証する。
- LOCAL_ONLY で発行した領収証を「同期済み」のように表示してはならない。

## 6. 監査

- 発行・再発行・取消・差替は全て AccountingAuditEvent として記録(SEC-007 / ACC-011 参照)。
- 監査証跡なしの発行系操作を禁止する。

## 7. 変更履歴

- 0.2.0 (2026-07-09): opus4.8 レビュー通過(本書への個別指摘なし)に伴う承認化。APPROVED 化。
- 0.1.0 (2026-07-09): 初版(v0.1.8 差分対応、WP-0034)。
