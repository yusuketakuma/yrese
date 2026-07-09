# ssot_index — SSOT文書索引

```yaml
ssot_id: IDX-001
title: SSOT文書索引
domain: plan
status: APPROVED
owner: fable5
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
```

本索引は `docs/**` 配下の全SSOT文書の正式な一覧である。台帳にない文書の参照・実装根拠化を禁止する。

**Phase 0 ゲート: 2026-07-09 人間レビュー承認済み。** 全文書 status APPROVED(以後の改版は PRC-007 の更新フローに従う)。

総文書数: 97(本索引を除く)


## docs/adapters/ (2件)

| ssot_id | 文書 | status |
|---|---|---|
| ADP-002 | [external_system_boundary.md](adapters/external_system_boundary.md) | APPROVED |
| ADP-001 | [official_adapter_inventory.md](adapters/official_adapter_inventory.md) | APPROVED |

## docs/agents/ (17件)

| ssot_id | 文書 | status |
|---|---|---|
| AGT-013 | [agent_assignment_matrix.md](agents/agent_assignment_matrix.md) | APPROVED |
| AGT-015 | [agent_handoff_protocol.md](agents/agent_handoff_protocol.md) | APPROVED |
| AGT-014 | [agent_review_pairing_policy.md](agents/agent_review_pairing_policy.md) | APPROVED |
| AGT-012 | [agent_routing_policy.md](agents/agent_routing_policy.md) | APPROVED |
| AGT-005 | [agmsg_cross_lane_protocol.md](agents/agmsg_cross_lane_protocol.md) | APPROVED |
| AGT-002 | [claude_side_charter.md](agents/claude_side_charter.md) | APPROVED |
| AGT-017 | [codex_capability_verification.md](agents/codex_capability_verification.md) | APPROVED |
| AGT-010 | [codex_data_handling_policy.md](agents/codex_data_handling_policy.md) | APPROVED |
| AGT-003 | [codex_side_ultra_mode_charter.md](agents/codex_side_ultra_mode_charter.md) | APPROVED |
| AGT-007 | [cross_lane_review_policy.md](agents/cross_lane_review_policy.md) | APPROVED |
| AGT-001 | [dual_lane_operating_model.md](agents/dual_lane_operating_model.md) | APPROVED |
| AGT-006 | [dual_lane_raci_matrix.md](agents/dual_lane_raci_matrix.md) | APPROVED |
| AGT-011 | [execution_mode_policy.md](agents/execution_mode_policy.md) | APPROVED |
| AGT-009 | [file_ownership_and_lock_policy.md](agents/file_ownership_and_lock_policy.md) | APPROVED |
| AGT-008 | [lane_conflict_resolution_policy.md](agents/lane_conflict_resolution_policy.md) | APPROVED |
| AGT-016 | [llm_capability_registry.md](agents/llm_capability_registry.md) | APPROVED |
| AGT-004 | [sol_ultra_mode_execution_policy.md](agents/sol_ultra_mode_execution_policy.md) | APPROVED |

## docs/architecture/ (2件)

| ssot_id | 文書 | status |
|---|---|---|
| ARC-001 | [offline_mode_matrix.md](architecture/offline_mode_matrix.md) | APPROVED |
| ARC-002 | [recovery_sync_design.md](architecture/recovery_sync_design.md) | APPROVED |

## docs/calculation/ (2件)

| ssot_id | 文書 | status |
|---|---|---|
| CAL-001 | [calculation_coverage_matrix.md](calculation/calculation_coverage_matrix.md) | APPROVED |
| CAL-002 | [tensuhyo_reading_notes.md](calculation/tensuhyo_reading_notes.md) | APPROVED |

## docs/claim/ (2件)

| ssot_id | 文書 | status |
|---|---|---|
| CLM-001 | [claim_scope_matrix.md](claim/claim_scope_matrix.md) | APPROVED |
| CLM-002 | [record_spec_reading_notes.md](claim/record_spec_reading_notes.md) | APPROVED |

## docs/masters/ (2件)

| ssot_id | 文書 | status |
|---|---|---|
| MST-002 | [code_mapping_registry_design.md](masters/code_mapping_registry_design.md) | APPROVED |
| MST-001 | [master_update_pipeline.md](masters/master_update_pipeline.md) | APPROVED |

## docs/modules/ (14件)

| ssot_id | 文書 | status |
|---|---|---|
| MOD-008 | [audit_event_registry.md](modules/audit_event_registry.md) | APPROVED |
| MOD-002 | [common_module_boundary.md](modules/common_module_boundary.md) | APPROVED |
| MOD-001 | [common_module_inventory.md](modules/common_module_inventory.md) | APPROVED |
| MOD-011 | [date_time_policy.md](modules/date_time_policy.md) | APPROVED |
| MOD-003 | [dependency_direction_policy.md](modules/dependency_direction_policy.md) | APPROVED |
| MOD-006 | [error_code_registry.md](modules/error_code_registry.md) | APPROVED |
| MOD-009 | [event_envelope_schema.md](modules/event_envelope_schema.md) | APPROVED |
| MOD-013 | [fixture_policy.md](modules/fixture_policy.md) | APPROVED |
| MOD-014 | [generated_code_policy.md](modules/generated_code_policy.md) | APPROVED |
| MOD-010 | [money_point_policy.md](modules/money_point_policy.md) | APPROVED |
| MOD-007 | [permission_scope_registry.md](modules/permission_scope_registry.md) | APPROVED |
| MOD-004 | [shared_type_registry.md](modules/shared_type_registry.md) | APPROVED |
| MOD-005 | [status_registry.md](modules/status_registry.md) | APPROVED |
| MOD-012 | [validation_schema_policy.md](modules/validation_schema_policy.md) | APPROVED |

## docs/operations/ (14件)

| ssot_id | 文書 | status |
|---|---|---|
| OPS-010 | [data_governance_policy.md](operations/data_governance_policy.md) | APPROVED |
| OPS-011 | [data_portability_exit_plan.md](operations/data_portability_exit_plan.md) | APPROVED |
| OPS-007 | [device_compatibility_matrix.md](operations/device_compatibility_matrix.md) | APPROVED |
| OPS-008 | [endpoint_management_policy.md](operations/endpoint_management_policy.md) | APPROVED |
| OPS-014 | [finops_plan.md](operations/finops_plan.md) | APPROVED |
| OPS-012 | [go_no_go_checklist.md](operations/go_no_go_checklist.md) | APPROVED |
| OPS-001 | [implementation_migration_plan.md](operations/implementation_migration_plan.md) | APPROVED |
| OPS-002 | [legacy_rececon_migration_matrix.md](operations/legacy_rececon_migration_matrix.md) | APPROVED |
| OPS-009 | [observability_plan.md](operations/observability_plan.md) | APPROVED |
| OPS-003 | [parallel_run_and_cutover_plan.md](operations/parallel_run_and_cutover_plan.md) | APPROVED |
| OPS-006 | [performance_capacity_plan.md](operations/performance_capacity_plan.md) | APPROVED |
| OPS-013 | [service_operations_risk_register.md](operations/service_operations_risk_register.md) | APPROVED |
| OPS-005 | [sla_slo_policy.md](operations/sla_slo_policy.md) | APPROVED |
| OPS-004 | [support_operations_model.md](operations/support_operations_model.md) | APPROVED |

## docs/plan/ (2件)

| ssot_id | 文書 | status |
|---|---|---|
| PLAN-PHASE0-GATE-001 | [phase0_gate_report.md](plan/phase0_gate_report.md) | APPROVED |
| PLAN-PHASE0-001 | [phase0_plan.md](plan/phase0_plan.md) | APPROVED |

## docs/process/ (7件)

| ssot_id | 文書 | status |
|---|---|---|
| PRC-006 | [blocker_triage_policy.md](process/blocker_triage_policy.md) | APPROVED |
| PRC-004 | [branching_and_pr_policy.md](process/branching_and_pr_policy.md) | APPROVED |
| PRC-003 | [definition_of_ready.md](process/definition_of_ready.md) | APPROVED |
| PRC-001 | [implementation_workflow.md](process/implementation_workflow.md) | APPROVED |
| PRC-005 | [review_gate_matrix.md](process/review_gate_matrix.md) | APPROVED |
| PRC-007 | [ssot_governance.md](process/ssot_governance.md) | APPROVED |
| PRC-002 | [work_package_template.md](process/work_package_template.md) | APPROVED |

## docs/product/ (3件)

| ssot_id | 文書 | status |
|---|---|---|
| PRD-001 | [mvp_scope.md](product/mvp_scope.md) | APPROVED |
| PRD-002 | [non_mvp_scope.md](product/non_mvp_scope.md) | APPROVED |
| PRD-003 | [risk_register.md](product/risk_register.md) | APPROVED |

## docs/quality/ (6件)

| ssot_id | 文書 | status |
|---|---|---|
| QUA-003 | [change_control_policy.md](quality/change_control_policy.md) | APPROVED |
| QUA-004 | [defect_management_policy.md](quality/defect_management_policy.md) | APPROVED |
| QUA-005 | [incident_management_policy.md](quality/incident_management_policy.md) | APPROVED |
| QUA-006 | [post_release_monitoring.md](quality/post_release_monitoring.md) | APPROVED |
| QUA-001 | [quality_plan.md](quality/quality_plan.md) | APPROVED |
| QUA-002 | [validation_plan.md](quality/validation_plan.md) | APPROVED |

## docs/regulatory/ (7件)

| ssot_id | 文書 | status |
|---|---|---|
| REG-007 | [evidence_verification_log.md](regulatory/evidence_verification_log.md) | APPROVED |
| REG-006 | [human_review_checklist.md](regulatory/human_review_checklist.md) | APPROVED |
| REG-003 | [legal_compliance_matrix.md](regulatory/legal_compliance_matrix.md) | APPROVED |
| REG-004 | [regulatory_blockers.md](regulatory/regulatory_blockers.md) | APPROVED |
| REG-005 | [samd_applicability_assessment.md](regulatory/samd_applicability_assessment.md) | APPROVED |
| REG-001 | [source_registry.md](regulatory/source_registry.md) | APPROVED |
| REG-002 | [version_watchlist.md](regulatory/version_watchlist.md) | APPROVED |

## docs/safety/ (2件)

| ssot_id | 文書 | status |
|---|---|---|
| SAF-001 | [medical_safety_risk_register.md](safety/medical_safety_risk_register.md) | APPROVED |
| SAF-002 | [safety_case.md](safety/safety_case.md) | APPROVED |

## docs/security/ (7件)

| ssot_id | 文書 | status |
|---|---|---|
| SEC-007 | [audit_log_design.md](security/audit_log_design.md) | APPROVED |
| SEC-005 | [edge_node_security_design.md](security/edge_node_security_design.md) | APPROVED |
| SEC-004 | [privacy_impact_assessment.md](security/privacy_impact_assessment.md) | APPROVED |
| SEC-002 | [provider_security_guideline_mapping.md](security/provider_security_guideline_mapping.md) | APPROVED |
| SEC-001 | [security_guideline_mapping.md](security/security_guideline_mapping.md) | APPROVED |
| SEC-006 | [tenant_isolation_design.md](security/tenant_isolation_design.md) | APPROVED |
| SEC-003 | [threat_model.md](security/threat_model.md) | APPROVED |

## docs/testing/ (1件)

| ssot_id | 文書 | status |
|---|---|---|
| TST-001 | [test_strategy.md](testing/test_strategy.md) | APPROVED |

## docs/uiux/ (7件)

| ssot_id | 文書 | status |
|---|---|---|
| UIX-002 | [experience_quality_baseline.md](uiux/experience_quality_baseline.md) | APPROVED |
| UIX-001 | [medical_ui_ux_principles.md](uiux/medical_ui_ux_principles.md) | APPROVED |
| UIX-003 | [performance_budget.md](uiux/performance_budget.md) | APPROVED |
| UIX-007 | [screen_inventory_draft.md](uiux/screen_inventory_draft.md) | APPROVED |
| UIX-005 | [stability_slo_policy.md](uiux/stability_slo_policy.md) | APPROVED |
| UIX-004 | [usability_acceptance_criteria.md](uiux/usability_acceptance_criteria.md) | APPROVED |
| UIX-006 | [workflow_map.md](uiux/workflow_map.md) | APPROVED |
