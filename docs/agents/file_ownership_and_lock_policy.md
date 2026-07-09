# ファイル所有・ロックポリシー

```yaml
ssot_id: AGT-009
title: ファイル所有・ロックポリシー
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
  - 構築プロンプト v0.1.7 §0.0.2.1, §0.1.6.12, §0.9, §0.10, §0.0.3.6
depends_on:
  - docs/agents/dual_lane_operating_model.md
impacts:
  - docs/agents/agent_handoff_protocol.md
related_work_packages: []
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - 0.1.0 初版作成(Phase 0 作業#1)
open_questions:
  - ロック台帳の実装方式(本書 §4 案: docs/agents/locks/ 配下のロックファイル)は Phase 1 のリポジトリ scaffold 時に確定【要確認】
blockers: []
```

## 1. 所有マップ(正)

### ClaudeCode側所有(frontend)

- `apps/web/**`
- `packages/ui/**`
- `packages/frontend/**`
- `packages/client/**`
- フロントエンドE2Eテストコード

### Codex側所有(backend)

- `apps/api/**`
- `packages/domain/**`
- `packages/calculation/**`
- `packages/claim/**`
- `packages/masters/**`
- `packages/reports/**`(バックエンド生成部)
- `packages/integration-api/**`
- `packages/security/**`(バックエンド/共通セキュリティ部)
- DB schema / migration / IaC(backend向け `infra/**`)

### 共有・契約領域(WPごとに fable5 が owner 明示+ロック必須)

- `openapi.yaml`
- `docs/api/**`
- `docs/ssot/**`(および `docs/**` の各SSOT)
- `packages/shared/**`・`packages/shared-*/**`・`packages/contracts/**`
- generated client / generated schema
- contract fixtures / E2E fixtures
- `infra/**` のうちフロントエンド配信・WAF・認証連携部分

### 共通モジュールの原則owner(v0.1.7 §0.0.3.6)

| モジュール | owner | レビュー |
|---|---|---|
| UI component / UI text / UI interaction | ClaudeCode側 sonnet5 | fable5 |
| API contract / DTO / schema / generated client | Codex側Sol(生成・更新) | ClaudeCode側が利用側レビュー |
| domain-neutral type / status / error code / permission scope | Codex側Sol | fable5 + opus4.8 |
| money / point / Decimal / date-time helper | Codex側Sol | opus4.8(高リスク) |
| calculation_trace / legal_trace / evidence_id 型 | Codex側Sol | fable5 + opus4.8 |
| audit event / sync event envelope | Codex側Sol | opus4.8 |
| frontend form adapter / UI validation display | ClaudeCode側 sonnet5 | Codex側 contract整合性レビュー |
| fixtures / test-utils | fable5 がWPごとに指定 | fable5 |

## 2. 必須ルール

- WPごとに owner_lane / owner_agent を決め、変更対象ファイル(allowed_files)と変更禁止ファイル(forbidden_files)を事前宣言する
- 同じファイルを複数レーン・複数モデルが同時編集してはならない
- 高リスクファイルは fable5 が編集ロックを宣言する
- 同一ファイルを複数レーンで変更する必要がある場合は、先に統合作業者を決める
- 大規模リファクタリングはCodex側が実装してよいが、fable5 承認なしに実行しない
- generated files は生成元ファイルと同じWPで扱う(手編集禁止)
- schema / OpenAPI / migration / calculation / claim / official adapter はファイル競合を重大リスクとして扱う

## 3. ブランチ命名

```text
claude/<wp-id>-<short-name>
codex-sol/<wp-id>-<short-name>
codex-exp/<wp-id>-<short-name>
review/<wp-id>-<short-name>
phase/<phase>-<wp-id>-<short-title>
feature/<wp-id>-<short-title>
fix/<wp-id>-<short-title>
```

## 4. ロック手順(運用案)

1. fable5 がWP発行時、共有・契約領域のファイルを触る場合は WP本文の `shared_file_lock` 欄にロック対象を列挙する
2. ロック台帳: `docs/agents/locks/<ファイルパスをスラッグ化>.lock.md` に WP-ID / owner / 取得日時 / 期限 を記録する(実装方式は Phase 1 で確定【要確認】)
3. ロック中ファイルへの他WPからの変更は禁止。必要が生じたら agmsg `blockers` へ報告し fable5 が順序を裁定する
4. WP完了(DONE)または CANCELLED 時にロックを解除する
5. ロックの長期保持(複数WPスパン)は fable5 の明示承認を要する

## 5. 違反時の処理

- 同時編集・所有外編集を検知した場合、該当WPを `IMPLEMENTATION_OWNERSHIP_BLOCKED` とし、[lane_conflict_resolution_policy](lane_conflict_resolution_policy.md) §4 の競合処理へ回す
- 競合の自動解決(自動マージ結果の無検証採用)を本番ロジックへ反映してはならない
