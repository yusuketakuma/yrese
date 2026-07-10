# go_no_go_checklist — 本番移行 Go/No-Go 判定チェックリスト

```yaml
ssot_id: OPS-012
title: 本番移行 Go/No-Go 判定チェックリスト
domain: operations
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - security_critic
  - medical_safety_reviewer
  - privacy_compliance_reviewer
  - human_review_required
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-10
approved_at: 2026-07-10
approved_by: direct_user_instruction (WP-9001); independent_verifier APPROVED; spec_guardian APPROVED; medical_safety_reviewer APPROVED; privacy_compliance_reviewer APPROVED; security_critic APPROVED
effective_from: 2026-07-10
effective_to: null
source_refs:
  - docs/spec/construction_prompt_v0.2.0.md §9.7
  - docs/plan/phase0_plan.md §8
  - docs/agents/codex_single_lane_operating_model.md
  - docs/process/review_gate_matrix.md
depends_on:
  - OPS-003 (parallel_run_and_cutover_plan)
  - REG-004 (regulatory_blockers)
  - SAF-001 (medical_safety_risk_register)
  - AGT-018 (codex_single_lane_operating_model)
impacts:
  - production cutover decision
  - Plans.md
  - State.md
related_work_packages:
  - WP-9001
related_tests:
  - pnpm check:ssot-index
related_prs: []
evidence_ids: []
change_log:
  - 0.2.0 2026-07-10 WP-9001とrequired reviews PASSによりCodex rootの判定案作成、independent/domain review、human-only最終決定へ改定
  - 0.1.0 2026-07-09 初版。Phase 0 human reviewで承認
open_questions:
  - 判定会議体の構成(薬局側/当社側の出席者・決裁者)【要確認 — 経営レビュー】
  - 並行稼働差分の許容範囲定量値(OPS-003 と同期)【要確認】
blockers: []
```

## 1. 判定原則

- Codex rootはread-only evidence、independent verifier、required Codex specialists、各human gateの記録を集約し、Go/No-Go判定案と未達一覧を作成する。Codex root、maintainer、verifier、specialistは最終Goを決定または自己承認しない
- 最終Go/No-Goは、明示された人間決裁者だけが決定する。決裁者、出席者、各human authority、判断日時、根拠を監査ログ+議事録へ記録する
- 1項目でも No の場合は Go としない(条件付き Go は許可しない — 条件は解消してから再判定)
- 判定結果・根拠・出席者は監査ログ+議事録として保存する

## 2. チェックリスト(v0.2.0 §9.7)

### A. ブロッカー・レビュー

| # | 項目 | 判定基準 |
|---|---|---|
| A1 | 未解決 BLOCKER なし | REG-004 台帳+Plans.md の [!] が対象スコープでゼロ |
| A2 | 高リスクreview記録完了 | R3+ 全WPについてmakerとは別contextのindependent verifier、riskに応じたCodex specialists、該当するhuman approvalの記録があり、未解消HIGH/CRITICAL findingがない |
| A3 | 人間薬剤師レビュー完了 | **人間の薬剤師**が医療安全・業務導線・警告表示(SAF-001/UIX系)を確認。`medical_safety_reviewer`は補助であり代替不可 |
| A4 | 人間請求実務者レビュー完了 | **人間の請求実務者**が算定照合・レセプト照合・返戻運用を確認。Codex claim reviewerは補助であり代替不可 |
| A5 | 人間production security承認完了 | `security_critic`のreview、SEC-001〜008のAPPROVED status、isolation/security test PASSに加え、**人間のproduction security authority**が本番構成・権限・残riskを承認 |
| A6 | 人間医療安全risk受容完了 | `medical_safety_reviewer`のreviewに加え、**人間の医療安全authority**がSAF-001のresidual riskを受容。A3の薬剤師業務reviewとは別記録 |

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

- Go: 人間決裁者の明示記録後にのみカットオーバー実行候補とする。実際のdeploy、migration適用、production write、external actionは各操作直前の明示human approvalを別途必要とする
- No-Go: 未達項目の是正計画+再判定日を設定し、State.md/Plans.md に記録
