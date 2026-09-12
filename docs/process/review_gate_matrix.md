# review_gate_matrix — レビューゲートマトリクス

```yaml
ssot_id: PRC-005
title: レビューゲートマトリクス
domain: process
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - human_review_if_required
version: 0.3.0
created_at: 2026-07-09
updated_at: 2026-09-08
approved_at: 2026-09-08
approved_by: "direct_user_approval (2026-09-08; Codex cleanup operating revision); native independent review FINDINGS_NONE; frozen_diff_sha256 59b1e57cc7bd18570828c7ac7baf63acd6b8b7be0e1449f5387369c61b37a855"
effective_from: 2026-09-08
effective_to: null
source_refs:
  - human_instruction Codex environment cleanup approval (2026-09-08)
  - docs/spec/construction_prompt_v0.2.0.md §0.12, §0.1.3.5
  - docs/agents/codex_single_lane_operating_model.md
depends_on:
  - AGT-018 codex_single_lane_operating_model
  - PRC-003 definition_of_ready
impacts:
  - all Work Package reviews
  - release and Go/No-Go gates
related_work_packages:
  - WP-9001
related_tests:
  - pnpm check:ssot-index
related_prs: []
evidence_ids: []
change_log:
  - "0.3.0 2026-09-08 APPROVED — user-requested risk-scoped independent review; R3/R4 and human gates unchanged; prior approval provenance remains in Git history; direct user approval and frozen independent review FINDINGS_NONE recorded"
  - 0.2.0 2026-07-10 direct user instruction (WP-9001) とrequired reviews PASSによりindependent verifierとdomain/human gateへ改定
  - 0.1.0 2026-07-09 初版
open_questions: []
blockers: []
```

## 1. レビュー手順

1. Codex rootが関連SSOT、code、test、dependency、dirty stateと影響範囲を確認する。
2. rootがscope、evidence、edge case、test、rollback、risk、specialist/human gateを確認し、必要な事前gateを満たす。
3. rootが唯一のeditorとして実装し、機械checkを実行する。
4. §2または明示gateにより必要な独立reviewerが、実行環境で強制されたread-only権限でdiff、acceptance criteria、test結果を確認する。変更・再委譲は禁止する。
5. rootがfindingの採否、修正、統合、再検証を行い、必要な独立再検証を依頼する。
6. rootがDoD、verification、human gate、exact staged diffを確認して完了/landing判定する。

機械checkはrepoで実在するtypecheck、test、lint、boundaries、SSOT index、secrets、deps、SBOM、build、focused runtime checkから対象に応じて選ぶ。存在しないcheckを実行済み扱いにしない。

## 2. Risk別review組み合わせ

| Risk | Maker | checker | 追加条件 |
|---|---|---|---|
| R0-R1(低) | Codex root | 必要な反証・見落とし確認に限定して任意 | focused validation、unrelated change確認。明示gateは省略不可 |
| R2(中) | Codex root | risk/impactに応じたindependent reviewer | contract/data/security/UI境界への影響、検証不足、material uncertaintyがあれば該当専門観点の独立レビューを行う。明示gateは省略不可 |
| R3(高) | APPROVED SSOT/evidence下のsole maintainer | independent verifier + required domain specialists | golden/regression/audit、human gate該当性、maker≠checkerを必須化 |
| R4(重大) | 実装禁止 | pre-plan reviewer + required specialists | BLOCKER化し、human authorityによるscope/evidence/approval後に再計画 |

R3+または明示gateで必要な独立reviewはrootの自己検証で代替しない。R0-R2も名称だけで低riskとせず、PRC-003の高risk領域と照合する。specialistが実装に関与した場合、そのspecialistを唯一のcheckerにしてはならない。

## 3. Review観点チェックリスト

- WPの目的・acceptance criteriaに合い、余計な変更がない。
- `owner_role` / `reviewer_roles` / allowed/forbidden filesと実際のdiffが一致する。
- 算定、請求、帳票、法令logicにevidence_idがある。
- 法令、医療安全、請求安全、privacy、data integrityへの影響が評価されている。
- PHI/PII、production data、secretがprompt、agent packet、log、test、commit/PR recordに漏れていない。
- offline modeで誤認を生まず、error/unknown stateがsafe sideに倒れる。
- rollback可能で、testがfailure/edge/concurrency/stale stateを固定する。
- UIが医療systemとして安全で、UX改善が請求正確性・患者安全を損なわない。
- common module再定義がなく、dependency boundaryをcheckしている。
- auth bypass、IDOR、injection、unsafe shell、broad CORSなどsecurity迂回経路がない。
- generated artifact、OpenAPI、consumer、docsが同期している。

## 4. Gate種別

| Gate | Timing | 判定role |
|---|---|---|
| Map gate | WP scope確定前 | Codex root |
| Pre-plan gate | READY / 実装開始前 | Codex root、risk/明示gateに必要なindependent reviewer・specialist/human authority |
| Review gate | 対象candidate確定後、§2/明示gateに応じて | independent reviewer + required specialists |
| Landing gate | stage/commit/push前 | Codex root。verificationとexact staged diffを確認 |
| Phase gate | Phase完了時 | Codex root + 明示されたhuman authority |
| Go/No-Go | production移行前 | human authority (`go_no_go_checklist`) |

human gateは法令、調剤報酬、薬学、患者安全、production data/infrastructure、external action、security/privacy制約緩和、risk acceptanceを含む。role-based reviewでhuman authorityを代替しない。
