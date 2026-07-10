# branching_and_pr_policy — ブランチ・PR運用ポリシー

```yaml
ssot_id: PRC-004
title: ブランチ・PR運用ポリシー
domain: process
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
  - docs/spec/construction_prompt_v0.2.0.md §0.10, §40, §0.1.6.12
  - docs/agents/codex_single_lane_operating_model.md
depends_on:
  - AGT-018 codex_single_lane_operating_model
  - PRC-005 review_gate_matrix
impacts:
  - all branches and landing records
  - State.md
related_work_packages:
  - WP-9001
related_tests:
  - git diff --check
related_prs: []
evidence_ids: []
change_log:
  - 0.2.0 2026-07-10 direct user instruction (WP-9001) とrequired reviews PASSによりroot exact-stage landingとrole-based PR記録へ改定
  - 0.1.0 2026-07-09 初版。Phase 0のmain直接landing運用を記録
open_questions:
  - branch protectionで必須にするCI checkの確定
blockers: []
```

## 1. 現行landing運用

current Work Packageがmain直接landingを許可する場合も、次を必須とする。

- 活動単位(WPまたはSSOT batch)ごとに1commitとし、commit message先頭に`WP-XXXX:`を付ける。
- mapper、pre-plan reviewer、sole maintainer、independent verifier、specialistはcommit/pushしない。
- sole maintainerのhandoff後、変更を作成していないindependent verifierがdiffとvalidationをread-onlyで確認する。
- Codex rootだけが`git status --short`と`git diff -- <exact paths>`を確認し、owned exact pathだけを明示stageする。
- rootはstaged diff、unrelated dirty change非混入、required validation、specialist/human gateを再確認してからcommitする。
- pushはcurrent WPまたは現在の人間指示が要求する場合だけrootが行う。
- landing後、commit、validation、remaining riskを`State.md`とWP/PR recordへ記録する。

この運用はsole-editorとindependent verifierのmaker/checker分離により、PR review相当の統制を維持する。自己reviewだけでlandingしてはならない。

## 2. ブランチ+PR運用への移行条件

以下のいずれかに該当したら、Codex rootがcurrent WPへ移行方針を記録し、必要なhuman/infrastructure approval後にbranch+PR運用へ移る。

1. 複数の人間developerまたは複数worktreeの並行実装が常態化した。
2. 高risk領域(R3+)の本実装をbranch protection付きで隔離する必要がある。
3. staging / production環境とrequired deployment checksが存在する。
4. protected branch、required review、release automationが設定された。

branch naming:

```text
phase/<phase>-<wp-id>-<short-title>
feature/<wp-id>-<short-title>
fix/<wp-id>-<short-title>
review/<wp-id>-<short-title>
codex/<wp-id>-<short-title>
```

branchを使う場合もactive scopeのeditorはsole maintainer 1名に限定する。branch分離は並行編集競合やmaker/checker未分離を正当化しない。

## 3. PR / commit record必須項目

目的 / 変更範囲 / work_package_id / root_role / owner_role / reviewer_roles / specialist_roles / 影響domain / ssot_refs・versions / evidence_idまたは不要理由 / 医療安全影響 / 体験品質影響 / validation結果 / rollback方法 / migration有無 / PHI・PII影響 / security impact / UI・UX・accessibility影響 / offline mode影響 / Edge Node影響 / performance・SLO影響 / independent verification結果 / human gates / DoR・DoD / screenshot(UI変更時) / remaining risk。

model ID、marketing name、未確認のruntime capabilityをownershipやreview evidenceとして記載しない。

## 4. Landing前チェック

- 1つのPR/commitに無関係なWPまたは複数の高risk領域を混在させない。
- PHI/PII、production data、secretがdiff、fixture、log、commit/PR recordに含まれていない。
- migrationはrollback / expand-migrate-contract方針とhuman apply gateを持つ。
- high riskはrelevant specialist reviewとrequired human approvalなしにmerge/commitしない。
- independent verifierのfindingが解消し、再検証済みである。
- rootがexact staged pathsとstaged diffを確認している。
- destructive git、force-push、history rewriteは明示human approvalなしに行わない。

## 5. Phase 0の歴史的事実

2026-07-09のPhase 0では、mainへの活動単位commit/pushが暫定運用として使われた。本節はそのlanding形態のみを歴史記録として保持する。現在のrole、review、stage authorityは§1とAGT-018が定める。
