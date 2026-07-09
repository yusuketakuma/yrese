# 構築プロンプト ベースライン

```yaml
ssot_id: SPEC-001
title: 構築プロンプト ベースライン
domain: spec
status: APPROVED
owner: fable5
reviewers:
  - human_review_if_required
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-09
effective_from: 2026-07-09
effective_to:
source_refs:
  - docs/spec/construction_prompt_v0.2.0.md
depends_on: []
impacts:
  - docs/spec/construction_prompt_v0.2.0.md
  - docs/plan/phase0_plan.md
  - Plans.md
related_work_packages:
  - WP-0040
  - WP-0049
related_tests:
  - rg-version-consolidation
  - git-diff-check
related_prs: []
evidence_ids: []
change_log:
  - 2026-07-09: 構築プロンプト仕様を0.2.0のみに統一し、過去版本文・版一覧・優先順位規定を削除。
open_questions: []
blockers: []
```

## 正本

構築プロンプト仕様の正本は [construction_prompt_v0.2.0.md](/Users/yusuke/workspace/yrese/docs/spec/construction_prompt_v0.2.0.md) のみとする。

このファイルは既存参照を壊さないためのベースライン入口であり、独立した仕様本文、過去版の版一覧、版間の優先順位規定は持たない。
構築プロンプトに含まれる要求、停止条件、運用規律、SSOT作成方針、Claude/Codex二系統運用、共通モジュール方針、会計・領収証・JAHIS・Integration Hub・Open Rececon Platform・FHIR/JP Core・24/365稼働方針は、すべて0.2.0正本へ集約する。

## 運用ルール

- 仕様確認時は必ず0.2.0正本を参照する。
- 新たな構築プロンプト差分が出た場合も、版を増やさず0.2.0正本へ統合する。
- 過去版名や過去版優先順位を実装根拠にしてはならない。
- Work Package、PR、agmsg、レビュー結果では `ssot_refs` に0.2.0正本を記載する。
- 正本と実装・Plans.md・Phase 0 SSOTに差分が出た場合は、`SSOT_UPDATE_REQUIRED` としてfable5へ戻す。
