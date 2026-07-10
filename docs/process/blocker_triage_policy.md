# blocker_triage_policy — ブロッカー処理ポリシー

```yaml
ssot_id: PRC-006
title: ブロッカー処理ポリシー
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
  - docs/spec/construction_prompt_v0.2.0.md §0.13, §42
  - docs/agents/codex_single_lane_operating_model.md
depends_on:
  - AGT-018 codex_single_lane_operating_model
  - REG-004 regulatory_blockers
impacts: 全WP・全実装
related_work_packages:
  - WP-9001
related_tests:
  - pnpm check:ssot-index
related_prs: []
evidence_ids: []
change_log:
  - 0.2.0 2026-07-10 direct user instruction (WP-9001) とrequired reviews PASSによりrepository-based blocker recordとrole-based triageへ改定
  - 0.1.0 2026-07-09 初版
open_questions: []
blockers: []
```

## 1. 報告形式

BLOCKERはcurrent Work Packageと`State.md`へ、次の形式で記録する。一時的な会話やagent packetだけで報告済みにしてはならない。

```text
work_package_id:
status: BLOCKED
reported_by_role:
root_role: codex_root
owner_role:
reviewer_roles:
required_specialist_roles:
required_human_authority:
blocker_type:                 # @yrese/shared-kernel BLOCKER_TYPES の登録値
blocking_question:
affected_files:
affected_ssot_refs:
evidence_ids:
missing_evidence:
risk:
medical_safety_impact:
claim_safety_impact:
privacy_security_impact:
prohibited_scope_until_resolved:
recommended_next_step:
resolution_evidence:
```

P0/P1は関連scopeの編集・landingを即時停止し、Codex rootへ返す。PHI/PII、secret、production dataをBLOCKER record、prompt、agent packetへ含めない。

## 2. BLOCKER種別

種別のcode正本は`@yrese/shared-kernel`の`BLOCKER_TYPES` (`packages/shared-kernel/src/blockers.ts`)とし、本書・REG-004と同期する。新種別はSSOT更新、independent verification、required specialist/human gate、shared-kernel反映の順で追加し、実装側で独自文字列を作らない。

主要category:

- 実装準備: `BLOCKED_NOT_READY`
- 規制・医療安全: `BLOCKED_REGULATORY_REVIEW`、`BLOCKED_PMDA_SAMD_REVIEW`等。詳細はREG-004
- 実装所有・contract: `IMPLEMENTATION_OWNERSHIP_BLOCKED`、`API_CONTRACT_BLOCKED`
- common module / generated code: `COMMON_MODULE_*`、`GENERATED_CODE_DRIFT_BLOCKED`
- SSOT / evidence: `SSOT_UPDATE_REQUIRED`および該当domainの根拠不足BLOCKER
- migration、external system、runtime capability、security/privacy、data integrityはregistryにある最も具体的な種別を使う

未知種別をfallback文字列で通さず、registry追加が承認されるまでfail-closedで停止する。

## 3. Codex rootによるtriage

Codex rootはmapper evidenceとpre-plan reviewを確認し、次のいずれかをcurrent WPと`State.md`へ記録する。

1. read-only追加調査。公式sourceを優先し、取得日時・版・適用日を記録する
2. scope変更またはWP分割
3. relevant domain specialist review
4. human review依頼(REG-006 `human_review_checklist`へ登録)
5. human作業依頼(例: ONS登録、点数の目視double-check)
6. future scopeへ移動し、`non_mvp_scope`を更新
7. 実装禁止の確定
8. 代替案採用。必要なSSOT改版とevidenceを先行する

rootは法令、調剤報酬、薬学、患者安全、production操作の最終判断を自己承認しない。該当する場合はhuman authorityへエスカレーションする。

## 4. 優先度

| 優先 | 条件 | 対応 |
|---|---|---|
| P0 | 患者安全、請求事故、PHI/secret漏えい、tenant escapeに直結 | 関連作業・landingを即時停止し、human authorityとrequired specialistへ報告 |
| P1 | high-risk WPの進行を停止 | 当該scopeを停止し、rootが優先triage |
| P2 | 通常WPの進行を停止 | 次WP着手前にtriage |
| P3 | 将来作業の前提となるhuman/external作業 | `Plans.md`へ期限・owner・解除条件を記録 |

priorityは納期都合でfail-closed条件を弱める根拠にしない。

## 5. 解除

- 解除条件はREG-004または該当APPROVED SSOTに行単位で明記する。
- sole maintainerはBLOCKERを迂回するcodeを書かない。
- independent verifierがresolution evidence、regression test、禁止scopeの解除範囲をread-onlyで確認する。
- relevant specialistとrequired human authorityのreview/approvalが必要な場合、そのrecordなしに解除しない。
- Codex rootだけが解除を判定し、evidence_id、review record、validation、残riskをcurrent WPと`State.md`へ記録する。
- 解除後もrootのexact-stage landingを経る。解除は未関係のscope拡大を許可しない。

根拠不足を検知してBLOCKEDを返す挙動は正しいfail-closed実装であり、無理に成功pathへ変えてはならない。
