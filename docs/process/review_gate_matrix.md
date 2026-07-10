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
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-10
approved_at: 2026-07-10
approved_by: direct_user_instruction (WP-9001); independent_verifier APPROVED; spec_guardian APPROVED; medical_safety_reviewer APPROVED; privacy_compliance_reviewer APPROVED; security_critic APPROVED
effective_from: 2026-07-10
effective_to: null
source_refs:
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
  - 0.2.0 2026-07-10 direct user instruction (WP-9001) とrequired reviews PASSによりindependent verifierとdomain/human gateへ改定
  - 0.1.0 2026-07-09 初版
open_questions: []
blockers: []
```

## 1. レビュー手順

1. mapperが関連SSOT、code、test、dependency、dirty stateをread-onlyで確認する。
2. pre-plan reviewerが実装前にscope、evidence、edge case、test、rollback、specialist、human gateをread-onlyで確認する。
3. sole maintainerがactive scopeの唯一のeditorとして実装し、機械checkを実行する。
4. 変更を作成していないindependent verifierがdiff、acceptance criteria、test結果をread-onlyで確認する。
5. risk/impactに応じたdomain specialistが追加reviewする。
6. findingはsole maintainerへ戻し、修正後にindependent verifierが再確認する。
7. Codex rootがDoD、verification、human gate、exact staged diffを確認して完了/landing判定する。

機械checkはrepoで実在するtypecheck、test、lint、boundaries、SSOT index、secrets、deps、SBOM、build、focused runtime checkから対象に応じて選ぶ。存在しないcheckを実行済み扱いにしない。

## 2. Risk別review組み合わせ

| Risk | Maker | 必須checker | 追加条件 |
|---|---|---|---|
| R0-R1(低) | sole maintainer | independent verifier | focused validation、unrelated change確認 |
| R2(中) | sole maintainer | independent verifier + relevant technical specialist | contract/data/security/UI影響に応じてspecialist追加 |
| R3(高) | APPROVED SSOT/evidence下のsole maintainer | independent verifier + required domain specialists | golden/regression/audit、human gate該当性、maker≠checkerを必須化 |
| R4(重大) | 実装禁止 | pre-plan reviewer + required specialists | BLOCKER化し、human authorityによるscope/evidence/approval後に再計画 |

rootがsole maintainerを兼ねる場合も、別contextのindependent verifierを省略しない。specialistが実装に関与した場合、そのspecialistを唯一のcheckerにしてはならない。

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
| Map gate | WP scope確定前 | read-only mapper |
| Pre-plan gate | READY / 実装開始前 | read-only pre-plan reviewer、必要なspecialist/human authority |
| Handoff gate | sole maintainerのhandoff後 | independent verifier + relevant specialists |
| Landing gate | stage/commit/push前 | Codex root。verificationとexact staged diffを確認 |
| Phase gate | Phase完了時 | Codex root + 明示されたhuman authority |
| Go/No-Go | production移行前 | human authority (`go_no_go_checklist`) |

human gateは法令、調剤報酬、薬学、患者安全、production data/infrastructure、external action、security/privacy制約緩和、risk acceptanceを含む。role-based reviewでhuman authorityを代替しない。
