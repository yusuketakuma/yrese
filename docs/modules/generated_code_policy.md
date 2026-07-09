# generated_code_policy — 生成コードポリシー

```yaml
ssot_id: MOD-014
title: 生成コードポリシー
domain: modules
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs:
  - 構築プロンプト v0.2.0 §0.0.3.4(generated codeの手編集禁止), §0.0.3.11(drift check), §0.1.6.12(generated filesは生成元と同一WP)
depends_on:
  - packages/contracts(@yrese/contracts zod schema 正本)
  - docs/modules/validation_schema_policy.md(MOD-012)
open_questions: []
blockers: []
```

## 1. 現状

OpenAPI yaml は `@yrese/contracts` の手書き zod スキーマを正本として生成する。生成物は `docs/api/openapi.yaml` にコミットし、`pnpm check:openapi` で再生成ドリフトを CI 検査する。

generated client はまだ存在しない。導入時は本SSOTの同一規律(生成元と生成物を同一WPで扱う、手編集禁止、drift check)を適用する。

## 2. 規約(導入時に適用)

1. **生成コードの手編集禁止**(v0.2.0 §0.0.3.4)。手編集が必要になった時点で、それは生成元(スキーマ/テンプレート)の欠陥であり、生成元を修正して再生成する
2. **生成元と生成物は同一 WP で扱う**(§0.1.6.12)。生成物だけを更新する WP・コミットを禁止する
3. 生成物には「GENERATED — DO NOT EDIT」ヘッダと生成元・生成コマンド・生成ツール版を記録する
4. **drift check を CI に置く**: CI 上で再生成し `git diff --exit-code` で差分ゼロを検証。差分検出は `GENERATED_CODE_DRIFT_BLOCKED` としてマージ不可
5. 生成物はリポジトリにコミットする(ビルド時生成に依存しない — レビュー可能性と再現性のため)
6. OpenAPI 由来の型を手書きで複製することを禁止(v0.2.0 §0.0.3.12 — 消費側は generated type を import する)
7. 生成ツールの更新(バージョンアップ)は C3 相当の変更として change_control_policy(QUA-003)に従う

## 3. 所有

- API contract / DTO / schema / generated client の owner は Codex側Sol(生成・更新)、ClaudeCode側が利用側レビュー(AGT-009)
- frontend は generated client 経由でのみ API を呼ぶ(契約外フィールドの仮定禁止 — MOD-012)
- 生成パイプラインのスクリプト自体は shared(tooling)として WP ごとにロック管理

## 4. 導入手順(Phase 1)

1. OpenAPI: zod schema 正本 → `zod-openapi` → `docs/api/openapi.yaml` として生成(WP-4019)
2. CI: `pnpm check:openapi` で再生成結果とコミット済み生成物を比較し、差分があれば `GENERATED_CODE_DRIFT_BLOCKED`
3. generated client: Phase 1以降に別WPで導入。OpenAPI由来型を手書き複製しない

## 5. 変更履歴

- 0.1.1 (2026-07-09): WP-4019 で OpenAPI 生成方式を zod schema 正本 + `zod-openapi` + `docs/api/openapi.yaml` コミット + CI drift check に確定。generated client は未導入として分離。
- 0.1.0 (2026-07-09): 初版。
