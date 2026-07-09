# generated_code_policy — 生成コードポリシー

```yaml
ssot_id: MOD-014
title: 生成コードポリシー
domain: modules
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - 構築プロンプト v0.1.7 §0.0.3.4(generated codeの手編集禁止), §0.0.3.11(drift check), §0.1.6.12(generated filesは生成元と同一WP)
depends_on:
  - packages/contracts(7fa369c — 現状は手書きzodが正、生成パイプラインは未導入)
  - docs/modules/validation_schema_policy.md(MOD-012)
open_questions:
  - OpenAPI 生成方式の選定(zod→OpenAPI 生成 or OpenAPI→型生成のどちらを正にするか)— Phase 1 で確定(現方針候補: zod スキーマを正とし OpenAPI/クライアントを生成)
  - generated code drift check の CI 実装方式(再生成→git diff 検査)
blockers: []
```

## 1. 現状

生成コードは**まだ存在しない**。API 契約は `@yrese/contracts` の手書き zod スキーマが正本であり(MOD-012)、OpenAPI yaml・generated client の生成パイプラインは Phase 1 で導入する(WP-1007 の TODO 記録)。本SSOTは導入時の規約を先に確定するものである。

## 2. 規約(導入時に適用)

1. **生成コードの手編集禁止**(v0.1.7 §0.0.3.4)。手編集が必要になった時点で、それは生成元(スキーマ/テンプレート)の欠陥であり、生成元を修正して再生成する
2. **生成元と生成物は同一 WP で扱う**(§0.1.6.12)。生成物だけを更新する WP・コミットを禁止する
3. 生成物には「GENERATED — DO NOT EDIT」ヘッダと生成元・生成コマンド・生成ツール版を記録する
4. **drift check を CI に置く**: CI 上で再生成し `git diff --exit-code` で差分ゼロを検証。差分検出は `GENERATED_CODE_DRIFT_BLOCKED` としてマージ不可
5. 生成物はリポジトリにコミットする(ビルド時生成に依存しない — レビュー可能性と再現性のため)
6. OpenAPI 由来の型を手書きで複製することを禁止(v0.1.7 §0.0.3.12 — 消費側は generated type を import する)
7. 生成ツールの更新(バージョンアップ)は C3 相当の変更として change_control_policy(QUA-003)に従う

## 3. 所有

- API contract / DTO / schema / generated client の owner は Codex側Sol(生成・更新)、ClaudeCode側が利用側レビュー(AGT-009)
- frontend は generated client 経由でのみ API を呼ぶ(契約外フィールドの仮定禁止 — MOD-012)
- 生成パイプラインのスクリプト自体は shared(tooling)として WP ごとにロック管理

## 4. 導入手順(Phase 1)

1. 生成方式の選定(open_questions)→ 本SSOT改版(PROPOSED→APPROVED)
2. 生成パイプライン実装 WP(drift check CI 同時導入)
3. 既存 health 契約で試行 → 以降の新規契約は生成必須
