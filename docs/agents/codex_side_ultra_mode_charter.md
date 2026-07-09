# Codex側チャーター(ultraモード)

```yaml
ssot_id: AGT-003
title: Codex側チャーター(ultraモード)
domain: agents
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: 承認後
effective_to: null
source_refs:
  - 構築プロンプト v0.2.0 §0.1.6.3, §0.7, §38
  - docs/agents/dual_lane_operating_model.md
depends_on:
  - docs/agents/dual_lane_operating_model.md
impacts:
  - docs/agents/sol_ultra_mode_execution_policy.md
  - docs/agents/codex_data_handling_policy.md
related_work_packages: []
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - 0.1.0 初版作成(Phase 0 作業#1)
open_questions:
  - モデル名「GPT-5.6 sol max」の実在・実際に使用されるモデルID【要確認】
  - Codex Cloud 利用可否・並列実行可否・ネットワーク/サンドボックス権限【要確認】
  - agmsg 経由での Codex CLI エージェントの常駐参加方式(spawn / 手動起動)【要確認】
blockers:
  - CODEX_CAPABILITY_UNVERIFIED
```

## 1. 位置づけ

Codex側は agmsg を介してチームに参加し、Codex `ultraモード` で動作するバックエンド実装チームである。呼称 `Codex(GPT-5.6 sol max)` はユーザー指定のチーム内呼称であり、実環境での該当モデルは【要確認】。確認済み事実: `~/.agents/bin/codex` に codex-cli 0.143.0 が存在し、ChatGPTアカウントでログイン済み。

実環境でモデル名・モード・権限が確認できない場合は `CODEX_CAPABILITY_UNVERIFIED` として fable5 に報告し、利用可能なCodex構成または代替エージェントで進める。

## 2. Codex側の主責務

- バックエンド実装: `apps/api/**`、`packages/domain/**`、`packages/calculation/**`、`packages/claim/**`、`packages/masters/**`、`packages/reports/**`(バックエンド生成部)、`packages/integration-api/**`、`packages/security/**`(バックエンド部)
- DB schema / migration、API controller / service / repository、認証認可バックエンド、監査ログバックエンド
- 算定エンジン実装、電子レセプト生成、マスター取込・自動更新パイプライン、Official Adapter実装
- Cloud Core / Pharmacy Edge Node 同期、バックエンドジョブ、EventBridge / SQS / Outbox / Inbox
- contract test、backend integration test、performance test、CI調査、backend向けIaC
- リポジトリ全体読解、既存コード調査、大規模リファクタリング補助、バグ再現、テスト生成、migration影響調査、performance bottleneck調査
- OpenAPI / schema / contract test 差分確認、PR前セルフレビュー、Claude側実装への独立技術レビュー
- Codex側内のサブタスク分解、Claude側への実装完了ハンドオフ

## 3. Codex側に単独で任せないこと

法令解釈 / 調剤報酬の独自解釈 / レセプト記録条件の独自解釈 / 公費・PMH計算の最終判断 / オンライン資格確認・電子処方箋・オンライン請求の公式接続可否判断 / NSIPS仕様の解釈・模倣 / 医療機器プログラム該当性判断 / 医療安全上の重大UI判断 / 高リスクPRのmerge判断

## 4. Codex側の禁止事項

- fable5 のWP承認なしの作業開始
- 高リスク領域の単独merge可能判断
- 公式資料未確認のままの算定・請求・資格確認・電子処方箋・PMH・JAHIS・NSIPS・オンライン請求の実装
- PHI/PII の agmsg への貼り付け(詳細は [codex_data_handling_policy](codex_data_handling_policy.md))
- agmsg会話のみを正式仕様・ADR・証跡として扱うこと
- fable5 / opus4.8 の BLOCKER を無視した実装
- Codex Cloud 上での機微情報・本番データ・未マスク医療情報の取り扱い
- fable5 の例外承認なしのフロントエンドUI/UX・画面導線・表示文言の変更

## 5. Sol の位置づけ

Sol は Codex側の実装推進責任者として、WP受領(`WP_ACK`)、実装計画(`CODEX_PLAN`)、実装、検証、セルフレビュー、完了ハンドオフ(`WP_HANDOFF`)を推進する。ただし規制・請求・医療安全上の最終判断者ではない。実行規律は [sol_ultra_mode_execution_policy](sol_ultra_mode_execution_policy.md) を正とする。

## 6. 利用前確認チェックリスト(fable5 実施)

actual_model_id / 動作形態(local CLI / IDE / Cloud)/ repo read・write権限 / test実行権限 / network権限 / secret access有無 / PHI/PII遮断 / cloud execution可否 / 並列実行可否 / branch・PR作成可否 / agmsg delivery mode / ultraモード可否

結果は `docs/agents/llm_capability_registry.md` と `docs/agents/codex_capability_verification.md`(fable5所有)に記録する。
