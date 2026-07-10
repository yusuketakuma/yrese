# 構築プロンプト ベースライン

```yaml
ssot_id: SPEC-001
title: 構築プロンプト ベースライン
domain: spec
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - human_review_if_required
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-10
approved_at: 2026-07-10
approved_by: direct_user_instruction (WP-9001); independent_verifier APPROVED; spec_guardian APPROVED; medical_safety_reviewer APPROVED; privacy_compliance_reviewer APPROVED; security_critic APPROVED
effective_from: 2026-07-10
effective_to: null
source_refs:
  - docs/spec/construction_prompt_v0.2.0.md
  - user_instruction_2026-07-10_codex_single_lane
depends_on:
  - docs/agents/codex_single_lane_operating_model.md
impacts:
  - docs/spec/construction_prompt_v0.2.0.md
  - docs/plan/phase0_plan.md
  - Plans.md
related_work_packages:
  - WP-0040
  - WP-0049
  - WP-9001
related_tests:
  - rg-version-consolidation
  - git-diff-check
related_prs: []
evidence_ids: []
change_log:
  - 2026-07-09: 構築プロンプト仕様を0.2.0のみに統一し、過去版本文・版一覧・優先順位規定を削除。
  - 2026-07-10: ユーザー直接指示(WP-9001)とrequired reviews PASSにより、運用参照先をAGT-018とCodex rootへ切り替える改版をAPPROVED化。
open_questions: []
blockers: []
```

## 正本

構築プロンプト仕様の正本は [construction_prompt_v0.2.0.md](construction_prompt_v0.2.0.md) のみとする。

このファイルは既存参照を壊さないためのベースライン入口であり、独立した仕様本文、過去版の版一覧、版間の優先順位規定は持たない。
構築プロンプトに含まれる製品、domain、evidence、停止条件、SSOT作成、共通モジュール、会計・領収証、JAHIS、Integration Hub、Open Rececon Platform、FHIR/JP Core、24/365稼働の要求は、すべて0.2.0正本へ集約する。

エージェント運用は [codex_single_lane_operating_model.md](../agents/codex_single_lane_operating_model.md) (AGT-018) を正本とし、Codex rootがmapper、pre-plan reviewer、sole maintainer、independent verifier、domain specialistを単一レーンで統率する。

## 運用ルール

- 仕様確認時は必ず0.2.0正本を参照する。
- エージェント運用、所有権、maker/checker、human gate、landingはAGT-018を参照し、Codex rootがcurrent Work Packageへ適用する。
- 新たな構築プロンプト差分が出た場合も、版を増やさず0.2.0正本へ統合する。
- 過去版名や過去版優先順位を実装根拠にしてはならない。
- Work Package、PR、repository内のレビュー結果では `ssot_refs` に0.2.0正本を記載し、運用判断にはAGT-018も記載する。
- 正本と実装、`Plans.md`、Phase 0 SSOTに差分が出た場合は、`SSOT_UPDATE_REQUIRED` としてCodex rootへ戻す。法令、医療安全、請求安全、承認済み範囲を確定できない場合はhuman gateで停止する。
