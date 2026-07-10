# implementation_workflow — 実装ワークフロー

```yaml
ssot_id: PRC-001
title: 実装ワークフロー
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
  - docs/spec/construction_prompt_v0.2.0.md §0.5, §0.11, §0.1.6.6
  - docs/agents/codex_single_lane_operating_model.md
depends_on:
  - AGT-018 codex_single_lane_operating_model
  - PRC-002 work_package_template
  - PRC-003 definition_of_ready
  - PRC-005 review_gate_matrix
  - PRC-006 blocker_triage_policy
impacts: 全実装作業
related_work_packages:
  - WP-9001
related_tests:
  - pnpm check:ssot-index
  - pnpm test:scripts
related_prs: []
evidence_ids: []
change_log:
  - 0.2.0 2026-07-10 direct user instruction (WP-9001) とrequired reviews PASSによりCodex単一レーン、sole-editor、independent verification、root landingへ改定
  - 0.1.0 2026-07-09 初版。Phase 0の実装先例を記録
open_questions: []
blockers: []
```

## 1. 基本原則

- Codex rootが唯一の実装指揮者である。current Work Package(WP)なしの実装、探索的な本番コード変更を禁止する。
- 実装者はAPPROVED SSOT、current WP、公式evidenceだけを根拠にする。会話ログや一時的なagent packetは根拠にせず、重要決定をSSOT、WP、`Plans.md`、`State.md`へ記録する。
- 非自明な作業はread-only mapper、read-only pre-plan reviewer、sole maintainer、independent verifier、必要なdomain specialistの順で行う。
- active scopeのeditorは常にsole maintainer 1名だけとする。rootが編集する場合はrootがsole maintainerを兼ね、別editorを置かない。
- 疑義、根拠不足、human gate未完了を実装で補完しない。`BLOCKED`または`SSOT_UPDATE_REQUIRED`としてrootへ戻す。
- 「ついでの改善」を禁止する。改善は別WPとして提案する。
- subagentはcommit/pushしない。landingはindependent verification後にrootだけが行う。

## 2. Codex単一レーンフロー

```text
1. root が repository、git status、Plans.md、State.md、validation から current state を復元する
2. read-only mapper が関連SSOT、code、test、dependency、dirty state、impact radiusを記録する
3. root が current WP を作成し、root_role / owner_role / reviewer_roles / allowed_files / forbidden_files / acceptance criteria / evidence / human gates を明記する
4. read-only pre-plan reviewer がSSOT適合、scope、edge case、test、rollback、specialist、human gateを確認する
5. 不足があれば root が WP を修正または BLOCKED にする。必要なhuman approvalは実装前に取得する
6. root が owner_role=sole_maintainer の1名へexact path scopeを割り当てる
7. sole maintainer が最小で完全な変更を実装し、focused validationから必要なgateへ広げる
8. sole maintainer がrepository内handoff recordへfiles_changed / tests_run / results / open_risksを記録する
9. 変更を作成していないindependent verifierがread-onlyでdiff、test、SSOT、security/privacy、data integrity、unrelated changeを確認する
10. relevant specialistが医療安全、privacy、security、DB/data integrity、API contract、UI/accessibility、test strategyを必要範囲で確認する
11. findingはCHANGES_REQUESTEDとしてsole maintainerへ戻し、修正後にcheckerが再検証する
12. rootがgit status、exact-path diff、validation、human gatesを確認し、owned exact pathだけをstageする
13. rootがstaged diffを再確認してWP-ID付きでcommitし、current WPまたは人間指示が要求する場合だけpushする
14. rootがPlans.md / State.md / WPを更新し、DoD充足後にDONE判定する
```

read-only調査は安全に並列化できる。編集、stage、commitは並列化しない。model ID、製品名、能力、permissionを推測してrole assignmentしてはならない。

## 3. Phase 0の歴史的先例

以下は2026-07-09のPhase 0で得られた履歴evidenceであり、現在のrole routingやapproval手順を定義しない。現在の手順は§2とAGT-018に従う。

| 事例 | 歴史的事実 | 継続する教訓 |
|---|---|---|
| WP-2002 レビュー往復 | 本番起動拒否にバイパスオプション(`allowDevTenantContextInProduction`)が入り、当時のreviewでCHANGES_REQUESTEDとなった。除去後にgrepとtestで再検証した | security規律の逸脱は「default safe」だけで許容せず、迂回経路自体を除去する。checkerが機械検証を再実行する |
| WP-1003 丸め政策値 | 端数処理の政策値をhard-codeせず、明示parameterと`BLOCKED_REGULATORY_REVIEW`で境界を空けた | 実装可能でも根拠のない値はevidence発行まで配線しない |
| WP-2101a 空ruleset | 算定engine骨格は空rulesetで必ずBLOCKEDを返すtestを固定した | 根拠不足を検知して止まる挙動自体をtest対象にする |

## 4. Sole maintainerの標準手順

1. current WPを読む。
2. `owner_role`、allowed/forbidden files、dirty stateを確認する。
3. 関連APPROVED SSOT、evidence、testを確認する。
4. 不明点はrepository内WPへ記録してrootへ戻し、解消前に編集しない。
5. test方針を確認し、必要ならtestを先行追加する。
6. 最小差分でroot causeを実装する。
7. typecheck、lint、unit testと対象riskに必要なgolden/contract/E2E/security checkを実行する。
8. docs、generated artifacts、progress recordを必要範囲で更新する。
9. files changed、validation、remaining riskをhandoff recordへ記録する。
10. commit/pushせずindependent verifierへ戻す。

## 5. 完了判定

Codex rootが、acceptance criteria、test結果、APPROVED SSOT/evidence、independent verification、required specialist/human gate、`Plans.md`・`State.md`、exact staged diffを確認してDONE判定する。validation failure、未解消のcritical finding、未完了human gateがある状態をDONEにしてはならない。
