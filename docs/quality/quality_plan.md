# quality_plan — 品質保証計画

```yaml
ssot_id: QUA-001
title: 品質保証計画
domain: quality
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - spec_guardian
  - data_integrity_auditor
  - test_architect
  - security_critic
  - privacy_compliance_reviewer
  - medical_safety_reviewer
  - claims_evidence_specialist
  - human_review_if_required
version: 0.1.2
created_at: 2026-07-09
updated_at: 2026-07-11
approved_at: 2026-07-11
approved_by: direct_user_instruction (WP-9001 AGT-018 cutover); independent_verifier APPROVED; spec_guardian APPROVED; data_integrity_auditor APPROVED; test_architect APPROVED; security_critic APPROVED; privacy_compliance_reviewer APPROVED; medical_safety_reviewer APPROVED; claims_evidence_specialist APPROVED
effective_from: 2026-07-11
effective_to: null
source_refs:
  - 構築プロンプト v0.2.0 §10
  - AGT-018 codex_single_lane_operating_model
  - PRC-007 ssot_governance
depends_on:
  - REG-005 samd_applicability_assessment
  - TST-001 test_strategy
  - QUA-003 change_control_policy
impacts: [QUA-002, QUA-003, QUA-004, QUA-005, QUA-006, TST-001, release gates]
related_work_packages: [WP-0011, WP-4047, WP-9005]
related_tests:
  - pnpm -r typecheck
  - pnpm -r test
  - pnpm -r build
  - pnpm check:secrets
  - pnpm check:deps
  - pnpm check:sbom
  - pnpm check:boundaries
related_prs: []
evidence_ids: []
blockers:
  - BLOCKED_QUALITY_REGULATORY_REVIEW(規格該当性が未判定の間、品質体系の最終形を確定しない)
open_questions:
  - ISO 14971 / IEC 62366-1 / ISO 13485 / JIS X 8341-3 相当の適用要否(SaMD判定と連動)
change_log:
  - 0.1.2 (2026-07-11): WP-9005 AGT-018 compatibility amendmentを8-role review後にfinalize。旧model/dual-lane routingと未作成扱いを現行governance・既存SSOTへ同期し、quality/medical/claims/human gatesは不変更。0.1.1までのhuman approvalはhistorical provenanceとして保持し、本版の承認には流用しない。
  - 0.1.1 (2026-07-09): WP-4047 実装状態 drift 整備。CI の secret scan / dependency scan / SBOM を WP-4009/a90df35・WP-4012/b0ecf84+702c2f5 の実態へ同期(品質ゲート要件は不変更)。
```

## 1. 必須方針(v0.2.0 §10 全項目)

- 要件→設計→実装→テスト→リリースの traceability を持つ(WP・ssot_refs・evidence_id・テストの連鎖で担保)。
- 高リスク変更は change control board 相当のレビューを通す(QUA-003)。
- 法令・調剤報酬・マスター・外部IF・JAHIS・PMH・電子処方箋・オン資の変更を version_watchlist(REG-002)で監視する。
- リリース前に必ず実施: regression test / 算定 golden test / レセプト golden test / UI workflow test / 体験品質テスト / security scan / rollback rehearsal。
- リリース後監視は QUA-006 post_release_monitoring に従い、異常時は即時ロールバック可能にする。
- **本番データでテストしない**(訓練環境含む。fixtures は合成データのみ — MOD 系 fixture_policy と連動)。
- 本番障害・請求事故・医療安全インシデントは incident として扱う。
- 欠陥 severity: **請求事故につながる欠陥は high 以上、患者安全につながる欠陥は critical**。

## 2. 規格該当性(判定は REG-005 と連動)

| 規格 | 対象 | 現状 |
|---|---|---|
| ISO 14971 相当(リスクマネジメント) | SaMD 該当時必須、非該当でも SAF-001 を準用 | 【未判定】BLOCKED_QUALITY_REGULATORY_REVIEW |
| IEC 62366-1 / JIS T 62366-1 相当(ユーザビリティ) | SaMD 該当時 | 【未判定】同上 |
| ISO 13485 / JIS Q 13485 相当(QMS) | SaMD 該当時 | 【未判定】同上 |
| JIS X 8341-3 / WCAG(アクセシビリティ) | 全UI(適用レベルは UIX-004 open_question) | 方針採用済み・レベル未確定 |

該当性が不明な間は推測で体系を簡略化せず、SAF-001(リスク台帳)・SAF-002(safety case)・本計画の運用で ISO 14971 相当の実質を先行させる。

## 3. 品質ゲートの現状実装

| ゲート | 実装状態 |
|---|---|
| 型・テスト・境界検査 CI | 稼働中(typecheck / test / check:boundaries / build) |
| 実装者とレビュー者の分離 | 稼働中(sole maintainer 1名→変更を作成していないindependent verifier + relevant specialists、AGT-018/PRC-007) |
| 根拠なき算定の遮断 | 稼働中(trace の evidenceRef 必須強制、算定骨格の空ruleset→BLOCKED) |
| 請求データ生成の遮断 | 稼働中(isClaimable) |
| golden test | 未着手(evidence_id 発行後、期待値はSSOT由来のみ — TST-001) |
| secret scan / dependency scan / SBOM | 一部稼働中 — `pnpm check:secrets`(WP-4009/a90df35)、`pnpm check:deps` + `pnpm check:sbom`(WP-4012/b0ecf84+702c2f5)をCIで実行。SAST/DAST等の追加 security scan は未着手 |

## 4. 欠陥管理・インシデント(骨格)

- 欠陥は WP と同様に台帳管理し、severity(critical / high / medium / low)と患者安全・請求影響を必須記載する。
- critical(患者安全)・high(請求事故)は修正完了まで該当機能のリリースを禁止する。
- 詳細規律は QUA-004 defect_management_policy / QUA-005 incident_management_policy / QUA-006 post_release_monitoring を参照する。
