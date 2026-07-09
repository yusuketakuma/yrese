# 二系統運用モデル(Claude側 / Codex側)

```yaml
ssot_id: AGT-001
title: 二系統運用モデル(Claude側 / Codex側)
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
  - 構築プロンプト v0.1.7 §0.0.2, §0.1.6.1〜§0.1.6.3, §0.1.6.18
  - docs/plan/phase0_plan.md §12
depends_on: []
impacts:
  - docs/agents/claude_side_charter.md
  - docs/agents/codex_side_ultra_mode_charter.md
  - docs/agents/dual_lane_raci_matrix.md
  - docs/agents/execution_mode_policy.md
related_work_packages: []
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - 0.1.0 初版作成(Phase 0 作業#1)
open_questions:
  - Codex側モデル名「GPT-5.6 sol max」は実環境で【要確認】(codex-cli 0.143.0 の存在とChatGPTログインは確認済み。実際に使用されるモデルIDは未確認)
blockers:
  - CODEX_CAPABILITY_UNVERIFIED(モデルID・権限詳細)
```

## 1. 目的

実装体制を Claude側 と Codex側 の二系統に分け、fable5 統率下で役割分担する。この分離は権限分断ではなく、**実装所有の分離**である。仕様決定権は分割しない。

## 2. 二系統の定義

### Claude側

- 構成: fable5(統率・最終判断)、opus4.8(高リスク設計・レビュー)、sonnet5(フロントエンド主力実装)、haiku4.5(検査・整合性確認)
- 実行モード: Claude Code `/ultracode`(必須。詳細は [execution_mode_policy](execution_mode_policy.md))
- 主責務: 仕様、法令適合性、医療安全、請求安全、UI/UX方針、全体統率、レビューゲート、**フロントエンド実装**

### Codex側

- 構成: Codex(呼称: GPT-5.6 sol max【要確認】)。Sol を実装推進責任者とする
- 実行モード: Codex `ultraモード`(必須。本プロジェクト内の運用モード名であり公式機能名ではない)
- 主責務: **バックエンド実装**、コードベース読解、テスト生成、CI調査、性能改善、独立技術レビュー

## 3. 実装所有の分離(概要)

| レイヤー | 所有 | 代表パス |
|---|---|---|
| frontend | Claude側(sonnet5) | `apps/web/**`, `packages/ui/**`, `packages/frontend/**`, `packages/client/**` |
| backend | Codex側(Sol) | `apps/api/**`, `packages/domain/**`, `packages/calculation/**`, `packages/claim/**`, `packages/masters/**`, `packages/integration-api/**`, DB schema / migration / IaC |
| shared | fable5 がWPごとにowner指定 | `openapi.yaml`, `docs/api/**`, `docs/ssot/**`, `packages/shared/**`, generated client, fixtures |
| ssot | fable5(高リスクはopus4.8レビュー) | `docs/**` の各SSOT |
| review | 実装者と別のエージェント | — |

詳細は [file_ownership_and_lock_policy](file_ownership_and_lock_policy.md) を正とする。

## 4. 統率構造

- fable5 はClaude側に属するが、**プロジェクト全体の統率者**であり、Codex側へのWP割当・承認・ブロッカー処理・レビューゲート管理も行う。
- Codex側は fable5 の統率を上書きしてはならない。
- Codex側Sol は Codex側の実装推進責任者だが、規制・請求・医療安全の最終判断者ではない。
- Claude側が握る最終決定権: MVP範囲 / 法令適合性 / 医療安全 / 算定・請求の仕様境界 / Official Adapter境界 / UI/UX基本方針 / LOCAL_ONLY・RECOVERY_SYNC安全方針 / 高リスクPRのmerge可否 / 人間レビュー必須論点

## 5. 二系統協働の基本フロー(Contract-first)

1. fable5 が仕様決定 → 該当SSOT作成・更新(APPROVED まで実装禁止)
2. API関連は API Contract SSOT + OpenAPI 確定
3. Codex側 `CODEX_BACKEND_PLAN` → Claude側 `CLAUDE_FRONTEND_PLAN`
4. Codex側 backend 実装 + contract test → `BACKEND_CONTRACT_READY`
5. Claude側 frontend 実装(承認済み OpenAPI / generated client / mock / fixture のみ使用)→ `FRONTEND_INTEGRATION_READY`
6. 統合テスト・E2E・エラー状態・オフライン状態確認
7. fable5 が SSOT / PR / テスト / レビューの整合性を確認し完了判定

禁止: フロントエンドの契約外フィールド仮定、バックエンドのSSOT外API項目追加、agmsgのみでの契約変更合意(`CONTRACT_CHANGE_REQUEST` として fable5 へ)。

## 6. 実装分界の例外

fable5 の明示承認(WPに `exception_type` / `reason` / `allowed_files` / `reviewer` 明記)がある場合のみ:

- Codex側によるフロントエンド独立技術レビュー / E2E fixture生成 / generated client差分確認
- Claude側による API利用側の型不整合報告 / OpenAPI改善提案
- opus4.8 による高リスクバックエンドのペアレビュー・限定的ペア実装(`FABLE_CROSS_LANE_APPROVAL` 必須)
- haiku4.5 による全体スキャン

## 7. 停止条件(二系統運用固有)

以下は `IMPLEMENTATION_OWNERSHIP_BLOCKED` または `API_CONTRACT_BLOCKED` として停止する。

- WPに `implementation_layer` / `owner_side` がない
- frontend作業が ClaudeCode `/ultracode` 以外、backend作業が Codex `ultraモード` 以外に割当てられている
- API契約未承認のまま実装に入っている
- frontend/backend/shared のファイル所有が未定義
- `openapi.yaml` 変更とフロントエンド実装がSSOTなしに同時進行
- フロントエンドが未定義APIレスポンスを仮定 / バックエンドが未定義UI状態・エラーコードを返す
- Codex側が規制・請求・医療安全仕様を独自判断して埋め込む / Claude側がUI都合で算定等の意味を変更

## 8. 実環境検証状況(2026-07-09 時点)

| 項目 | 状態 |
|---|---|
| Claude側 `/ultracode` | 本環境のマルチエージェントオーケストレーションとして利用可能(検証済み) |
| codex CLI | `~/.agents/bin/codex` に codex-cli 0.143.0 存在、ChatGPTログイン済み(検証済み) |
| agmsg | `~/.agents/skills/agmsg/scripts/`(whoami.sh / join.sh)存在、チーム `phos` 存在(検証済み) |
| Codex側モデルID | 【要確認】「GPT-5.6 sol max」該当モデルの実在・権限・サンドボックス設定は未検証 |
