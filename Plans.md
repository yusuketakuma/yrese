# Plans.md — 調剤用レセプトコンピューター MVP タスク計画

構築プロンプト v0.1.7 / `docs/plan/phase0_plan.md` に基づく実行計画。
運用ルール: 活動単位ごとにコミット&プッシュ。活動ログは `State.md` に記録。
高リスク領域(R3+)は根拠(evidence_id)未確認のまま実装しない — 「根拠不足を正しく検知して止まるコード」を優先する。

## ステータス凡例

- `[ ]` TODO / `[~]` IN_PROGRESS / `[x]` DONE / `[!]` BLOCKED

## Phase 0: 調査・計画(ドキュメント)

- [x] WP-0001 Phase 0 計画書作成(docs/plan/phase0_plan.md)— 人間承認済み(「次に進む」)
- [x] WP-0002 実行モード・能力検証(codex CLI / agmsg / ultracode)
- [x] WP-0003 二系統運用・エージェント統率SSOT(docs/agents/ 15文書、status PROPOSED)— 8d47d70
- [ ] WP-0004 llm_capability_registry / codex_capability_verification 作成
- [ ] WP-0005 規制・法令SSOT(source_registry / version_watchlist / legal_compliance_matrix / regulatory_blockers / SaMD該当性 / human_review_checklist)
- [ ] WP-0006 医療安全+スコープSSOT(medical_safety_risk_register / safety_case / mvp_scope / non_mvp_scope / risk_register / calculation_coverage_matrix / claim_scope_matrix)
- [ ] WP-0007 外部境界・マスターSSOT(official_adapter_inventory / external_system_boundary / offline_mode_matrix / recovery_sync_design / master_update_pipeline / code_mapping_registry_design)
- [ ] WP-0008 UI/UX・体験品質SSOT(medical_ui_ux_principles ほか7文書)
- [ ] WP-0009 セキュリティSSOT(security_guideline_mapping ほか7文書)
- [ ] WP-0010 運用・移行・SLO・デバイス・ガバナンスSSOT(14文書)
- [ ] WP-0011 実装統率・品質SSOT(implementation_workflow / work_package_template / DoR / branching_and_pr_policy / review_gate_matrix / blocker_triage / ssot_governance / quality_plan / validation_plan / change_control / test_strategy)
- [ ] WP-0012 共通モジュールSSOT(common_module_inventory ほか14文書)
- [ ] WP-0013 ssot_index 整備・Phase 0 ゲート報告

Phase 0 文書は実装と並行して整備する(ユーザー指示により実装開始が承認済み)。
ただし R3+ 実装の根拠となるSSOTは該当実装より先に APPROVED にする。

## Phase 2: 実装(承認済み範囲から着手)

### 基盤(shared / R0-R1)

- [x] WP-1001 monorepo scaffold(pnpm workspaces / strict TS base)— c81d6ca
- [x] WP-1002 packages/shared-kernel: branded ID型(TenantId/PharmacyId/PatientId/PrescriptionId/ClaimId/EventId等)、システムモード(NORMAL〜RECOVERY_SYNC)、PENDING系status、BLOCKER種別、error/warning code registry型、permission scope型 + unit tests
- [x] WP-1003 packages/money: bigint ScaledDecimal / Yen / Points、丸めは明示パラメータのみ(政策値はevidence_id確認まで配線禁止)(codex実装・claudeレビュー、533f89a)
- [~] WP-1004 packages/date-time: 処方日・調剤日・受付日・請求月の明示型、現在時刻への暗黙依存禁止(codexへWP_ASSIGN済み)
- [ ] WP-1005 packages/trace: calculation_trace / legal_trace / evidence_id 型 + tests
- [ ] WP-1006 packages/events: sync event envelope(Outbox/Inbox、idempotency key、correlation/causation)型 + tests
- [ ] WP-1007 packages/contracts: API契約の器(OpenAPI生成方針、Zod schema 置き場、generated_code_policy 準拠)

### バックエンド(Codex側所有 / apps/api)

- [x] WP-2001 apps/api scaffold(Fastify 5 + zod healthcheck、codex実装・claudeレビュー、58411c0)
- [ ] WP-2002 認証認可・テナント分離の骨格(RBAC scope、tenant_id/pharmacy_id 強制)
- [ ] WP-2003 監査ログ骨格(audit event envelope、PHI非出力)
- [ ] WP-2004 患者・保険・公費ドメインCRUD(SSOT承認後)
- [!] WP-2101 算定エンジン(公式点数根拠 evidence_id 未確認 → BLOCKED_REGULATORY_REVIEW。純粋関数の骨格・trace配線のみ先行可)
- [!] WP-2102 電子レセプト生成(記録条件仕様未確認 → BLOCKED_REGULATORY_REVIEW)
- [!] WP-2103 Official Adapter 実装(ONS資料未確認 → BLOCKED_REGULATORY_REVIEW)

### フロントエンド(Claude側所有 / apps/web)

- [x] WP-3001 apps/web scaffold(Next.js 15 shell + SystemModeBadge、12a5ac2)
- [ ] WP-3002 患者ヘッダー・システムモード表示コンポーネント(packages/ui)
- [ ] WP-3003 患者検索・受付ダッシュボードUI(API契約確定後)

### 横断

- [ ] WP-4001 CI(typecheck / lint / test / 依存方向チェック / 重複enum scan)
- [ ] WP-4002 codex側への backend WP 委任フロー稼働(agmsg or codex exec)

## 直近の実行順序

1. WP-1001 scaffold → 2. WP-1002 shared-kernel → 3. WP-1003 money → 4. WP-1004 date-time → 5. WP-1005 trace → 6. WP-0003 フォーク成果コミット → 7. WP-1006/1007 → 8. apps scaffold(WP-2001/3001)→ 9. Phase 0 残ドキュメント並行整備
