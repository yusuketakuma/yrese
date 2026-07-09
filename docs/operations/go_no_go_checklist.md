# go_no_go_checklist — 本番移行 Go/No-Go 判定チェックリスト

```yaml
ssot_id: OPS-012
title: 本番移行 Go/No-Go 判定チェックリスト
domain: operations
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs: 構築プロンプト v0.2.0 §9.7 / docs/plan/phase0_plan.md §8
depends_on:
  - OPS-003 (parallel_run_and_cutover_plan)
  - REG-004 (regulatory_blockers)
  - SAF-001 (medical_safety_risk_register)
open_questions:
  - 判定会議体の構成(薬局側/当社側の出席者・決裁者)【要確認 — 経営レビュー】
  - 並行稼働差分の許容範囲定量値(OPS-003 と同期)【要確認】
```

## 1. 判定原則

- 判定は fable5 が判定案を作成し、人間(決裁者【要確認】)が最終決定する
- 1項目でも No の場合は Go としない(条件付き Go は許可しない — 条件は解消してから再判定)
- 判定結果・根拠・出席者は監査ログ+議事録として保存する

## 2. チェックリスト(v0.2.0 §9.7)

### A. ブロッカー・レビュー

| # | 項目 | 判定基準 |
|---|---|---|
| A1 | 未解決 BLOCKER なし | REG-004 台帳+Plans.md の [!] が対象スコープでゼロ |
| A2 | 高リスクレビュー完了 | R3+ 全WPに opus4.8 レビュー記録 |
| A3 | 薬剤師レビュー完了 | 医療安全・業務導線・警告表示(SAF-001/UIX系) |
| A4 | 請求実務者レビュー完了 | 算定照合・レセプト照合・返戻運用 |
| A5 | セキュリティレビュー完了 | SEC-001〜007 の APPROVED+isolation test 通過 |
| A6 | 医療安全レビュー完了 | SAF-001 の residual risk 受容判定 |

### B. 接続試験(公式)

| # | 項目 | 判定基準 |
|---|---|---|
| B1 | オンライン資格確認接続確認 | 公式手順の接続試験通過【ONS 資料待ち】 |
| B2 | 電子処方箋接続確認 | 対象時のみ(非MVP時は N/A 判定を明記) |
| B3 | PMH 事前検証 | 対象時のみ(同上) |
| B4 | 電子レセプト記録条件検証 | 記録条件仕様(R8.6版)全件バリデーション通過 |
| B5 | 受付・事務点検ASP確認 | 試行送信の受付結果確認 |
| B6 | オンライン請求用端末への受け渡し確認 | 公式手順での受け渡しリハーサル |
| B7 | JAHIS 2Dシンボル読取互換確認 | Ver.1.11 サンプルセット読取通過 |
| B8 | Partner Systems contract test | 対象接続先の contract test 通過 |

### C. 移行・並行稼働

| # | 項目 | 判定基準 |
|---|---|---|
| C1 | 移行照合完了 | 件数・金額照合が許容差分内(OPS-001) |
| C2 | 並行稼働差分許容範囲内 | 全差分分類済み+新系起因ゼロまたは修正済み(OPS-003) |
| C3 | ロールバック手順確認 | 戻しリハーサル実施記録 |
| C4 | LOCAL_ONLY 訓練 | 薬局スタッフの切替・業務継続・復帰訓練完了 |
| C5 | RECOVERY_SYNC 訓練 | 再検証・競合解決・承認フローの訓練完了 |

### D. 運用準備

| # | 項目 | 判定基準 |
|---|---|---|
| D1 | サポート体制準備完了 | OPS-004 の体制・Runbook・連絡網 |
| D2 | SLO 監視稼働 | OPS-009 ダッシュボード+アラート疎通 |
| D3 | バックアップ・リストア確認 | リストア訓練の実施記録 |
| D4 | デバイス検証完了 | OPS-007 対象デバイスの実機確認 |
| D5 | 教育・オンボーディング完了 | ロール別訓練(training mode・合成データ) |

## 3. 判定後

- Go: カットオーバー実行(OPS-003 §2)
- No-Go: 未達項目の是正計画+再判定日を設定し、State.md/Plans.md に記録
