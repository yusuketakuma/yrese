# definition_of_ready — Definition of Ready

```yaml
ssot_id: PRC-003
title: Definition of Ready
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
  - docs/spec/construction_prompt_v0.2.0.md §0.4
  - docs/agents/codex_single_lane_operating_model.md
depends_on:
  - AGT-018 codex_single_lane_operating_model
impacts: 全WP
related_work_packages:
  - WP-9001
related_tests:
  - pnpm check:ssot-index
related_prs: []
evidence_ids: []
change_log:
  - 0.2.0 2026-07-10 direct user instruction (WP-9001) とrequired reviews PASSによりmapper/pre-plan/sole-maintainer/independent-verifier gateへ改定
  - 0.1.0 2026-07-09 初版
open_questions: []
blockers: []
```

実装開始前に、すべてのcurrent Work Packageで以下を満たすこと。1項目でも欠ける場合は`BLOCKED_NOT_READY`とし、実装を開始しない。

## チェックリスト

| # | 項目 | 判定基準 |
|---|---|---|
| 1 | 目的が1文で説明できる | WP title + purpose |
| 2 | 対象domain/layerが明確 | target_domain / implementation_layer |
| 3 | 変更可能・禁止fileが明確 | allowed_files / forbidden_files。unrelated dirty changeも記録 |
| 4 | 公式資料または仕様根拠がある | ssot_refsがAPPROVED。SSOT不要なら低riskに限定して理由を明記 |
| 5 | evidence_idがある、または不要理由が明記 | 算定・請求・帳票・法令対応logicは必須。未発行なら着手不可 |
| 6 | acceptance criteriaがtest可能 | test_planと1対1に対応 |
| 7 | rollback方法がある | git revert単位。migrationはexpand-migrate-contract |
| 8 | PHI/PII影響が評価済み | SEC-004 PIA参照。fixtureはsynthetic/de-identifiedのみ |
| 9 | risk levelが判定済み | R0-R4と高risk領域一覧を照合 |
| 10 | relevant specialist / human gateが定義済み | R3+、法令、請求、薬学、患者安全、production actionは事前review/approval record必須 |
| 11 | UI/UX影響がある場合UIX-001へ適合 | 画面はUIX-007台帳に存在。台帳外画面は禁止 |
| 12 | offline影響がある場合LOCAL_ONLY / RECOVERY_SYNCを定義 | ARC-001 / ARC-002参照 |
| 13 | 外部公的system影響がある場合Official Adapter境界を定義 | ADP-001 / ADP-002参照 |
| 14 | common module再利用を確認済み | 既存packagesで実現できる概念の再実装は`COMMON_MODULE_DUPLICATION_BLOCKED` |
| 15 | maker/checkerが分離されている | `owner_role: sole_maintainer`、別contextの`reviewer_roles: [independent_verifier, ...]` |
| 16 | mapperがimpact radiusを確認済み | 関連SSOT/code/test/dependency/dirty stateをmapper_findingsへ記録 |
| 17 | pre-plan reviewが完了 | scope、edge case、test、rollback、specialist、human gateをread-only reviewerが確認 |
| 18 | landing authorityが明確 | rootだけがverification後にexact-stageし、landing_requiredに従う |
| 19 | ambiguityが解消済み | A3はrequired human/spec authorityの解消record、必要なSSOT改版、再計画・pre-plan reviewが完了。A4はREADY不可 |

## 運用

- Codex rootがcurrent WPを作成し、mapperとpre-plan reviewerのevidenceを確認してREADY判定する。
- mapperとpre-plan reviewerはread-onlyであり、READY前にファイルを編集しない。
- sole maintainerは着手直前にSSOT status、evidence、allowed files、dirty state、human gateを再確認する。DRAFT / PROPOSED / STALE / PENDING_REVISIONの旧結論を単独根拠にしない。
- independent verifierが事前にmakerの変更作成へ関与してはならない。
- DoRを形式的に埋めるだけで、根拠不足、安全risk、scope conflictを無視してはならない。
- A3はCodex rootが`blocking_question`、affected SSOT、required specialist、最終判断を持つhuman authorityをWPへ記録し、human/spec clarification後にmapとpre-plan reviewをやり直す。WPや`Plans.md`だけでAPPROVED SSOTを上書きして解消してはならない。
- A4は`BLOCKED_NOT_READY`として実装、stage、landingを停止する。human clarification、必要なSSOT改版・承認、再計画、pre-plan reviewが完了するまで解除しない。

## Phase 0に関する履歴注記

2026-07-09のPhase 0 gate以前には、PROPOSED文書に依存する実装をR0-R2の骨格・型・guardへ限定する暫定運用があった。これは歴史的事実であり、現在のSSOT statusは各frontmatterと`docs/ssot_index.md`を確認する。過去の一括gateを根拠に、現在PROPOSED / STALE / BLOCKEDの文書へ依存してはならない。
