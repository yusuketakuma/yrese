# dependency_direction_policy — 依存方向ポリシー

```yaml
ssot_id: MOD-003
title: 依存方向ポリシー
domain: modules
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - 構築プロンプト v0.1.7 §0.0.3.5
depends_on:
  - scripts/check-boundaries.mjs(0213ac0、CI組込済み)
open_questions:
  - packages/domain / packages/claim 新設時の詳細ルール追記(Phase 1)
  - UI import boundary(server-only module の client 混入検査)の追加時期
blockers: []
```

## 1. ルール(v0.1.7 §0.0.3.5 全文)

- `apps/web` は `packages/ui`、`packages/api-client`、`packages/contracts`、`packages/shared-*` に依存してよい
- `apps/api` は `packages/domain`、`packages/calculation`、`packages/claim`、`packages/masters`、`packages/contracts`、`packages/shared-*` に依存してよい
- `packages/ui` は backend 実装・DB・AWS SDK・server-only module に依存してはならない
- `packages/domain` は React・Next.js・ブラウザAPI・UI文言に依存してはならない
- `packages/calculation` は DB・外部API・現在時刻・AWS SDK・UI に直接依存してはならない(実装済み: 純粋関数、d26424d)
- `packages/contracts` と `packages/shared-*` は `apps/**` に依存してはならない
- `packages/shared-*` 同士の循環依存は禁止する
- 違反は `COMMON_MODULE_DEPENDENCY_VIOLATION` として停止する

本リポジトリでの `shared-*` 相当は MOD-001 の実装済み7パッケージ全体を指す(shared-kernel / money / date-time / trace / events / contracts / calculation)。

## 2. 現在の依存グラフ(正)

```text
apps/web ─→ shared-kernel        apps/api ─→ shared-kernel, contracts
trace ─→ shared-kernel           events ─→ shared-kernel
calculation ─→ shared-kernel, money, date-time, trace
shared-kernel / money / date-time / contracts ─→ (workspace依存なし)
```

## 3. 機械的強制(実装済み)

`scripts/check-boundaries.mjs`(Node ESM・依存ゼロ、0213ac0)が CI(`pnpm check:boundaries`)で以下を検査する:

1. **import boundary**: `packages/**` のソースが `apps/` パスまたは `@yrese/api` / `@yrese/web` を import → violation。`apps/**` が他の `apps/**` を import → violation
2. **循環検出**: 各 package.json の `workspace:*` 依存から DAG を構築し、循環で fail
3. **重複 const 検査**: `SYSTEM_MODES` / `PROVISIONAL_STATUSES` / `BLOCKER_TYPES` と同名の `as const` 配列が shared-kernel 以外に定義 → violation

違反注入テストで検出動作を実証済み(WP-4003 レビュー記録参照)。検査対象 const 名の追加(例: `PERMISSION_RESOURCES`、`ERROR_DOMAINS`)は本SSOTの改版を経て scripts を更新する。

## 4. 逸脱時の処理

- CI fail = マージ不可。迂回(検査の無効化・除外リスト追加)は fable5 承認+本SSOT改版なしに禁止
- 設計上やむを得ない依存の追加(例: calculation → contracts)は、本SSOT改版 → opus4.8 レビュー → check-boundaries.mjs 更新の順で行う
