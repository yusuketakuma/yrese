# yrese・PH-OS 調剤レセコン総合機能計画 v0.7 normative delta registry

```yaml
proposal_id: RESEARCH-WP-0054A-001
title: v0.7 normative delta registry
status: DRAFT
owner: codex_root
created_at: 2026-07-16
updated_at: 2026-07-16
source_refs:
  - Plans.md WP-0054 (commit ce9fcde)
  - docs/spec/construction_prompt_v0.2.0.md (SPEC-002; authoritative product specification)
  - docs/process/ssot_governance.md (PRC-007 v0.3.1)
  - docs/architecture/fhir_native_phos_aws_platform_direction.md (ARC-008 v0.1.2)
related_work_packages:
  - WP-0054a
implementation_authority: none
```

> [!IMPORTANT]
> 本書は`docs/research/`配下の非SSOT調査成果物である。v0.7、v0.5、v0.6、v0.6.1、v0.3、v0.2.1をAPPROVEDにせず、実装根拠にも使用しない。APPROVED SSOTとの競合は常にfail-closedで扱い、PRC-007の10段フローと必要なhuman authorityを通過するまでruntime、DB、API、外部接続、production behaviorを変更しない。

## 1. 目的・読者・判定単位

- 読者: product/architecture authority、薬剤師、請求実務、FHIR/JP Core、security/privacy、data-integrity reviewer。
- 目的: ユーザー提供v0.7の全38節を、現行APPROVED SSOTに対して1節1行で分類し、改版対象、維持対象、重複、未決、source不足を明示する。
- 読後のaction: WP-0054bでpath-level実装coverageを作り、WP-0054c/dで一次sourceと法令適用性を補い、WP-0054iでGate 0 human decisionを行う。
- 中心命題: v0.7は有力なproduct directionだが、現在の正式仕様やAPPROVED SSOTを会話・Plansだけで上書きできない。

### 判定値

| value | meaning |
|---|---|
| `ALIGNED` | 現行APPROVED SSOTの不変条件と整合する。実装済みという意味ではない |
| `EXTENDS` | 現行authorityを拡張するため新規/改版SSOTとhuman reviewが必要 |
| `CONFLICTS` | 現行APPROVED SSOTの本文・MVP境界・authorityと衝突し、PRC-007改版まで実装禁止 |
| `DUPLICATE_RISK` | 同名/同概念の新規SSOTやmoduleを作ると二重正本になる |
| `RESEARCH_ONLY` | vendor claim、将来構想、参考資料でありnormative behaviorにしない |
| `OBSOLETE_ROUTING` | AGT-018により失効したmodel/lane/team routing。履歴以外へ再利用しない |
| `HUMAN_DECISION_REQUIRED` | 法令、請求、薬学、患者安全、scope、security/privacy等のhuman authorityが必要 |
| `SOURCE_MISSING` | 参照された原文/版がrepository artifactとして存在せず、差分を推測できない |

## 2. 入力sourceの可用性

| source | repository evidence | classification | consequence |
|---|---|---|---|
| v0.7 comprehensive plan | `Plans.md` WP-0054に節/要件を正規化したtask inventoryあり。原文byte-preserving artifactとhashはなし | `PARTIAL_SOURCE` | 本書はWP-0054の38節を分類できるが、原文同一性は証明しない |
| v0.5 FHIR/JP Core Native | `Plans.md` WP-0053にtask分割あり。`docs/spec/fhir_jp_core_native_interoperability_v0.5.md`は未作成 | `SOURCE_MISSING` | WP-0053a完了までv0.5とのexact deltaを確定しない |
| v0.6 network resilience / Bedrock | repository内にversioned source artifactなし | `SOURCE_MISSING` | offline/AI要件の由来・版・差分を確定しない |
| v0.6.1 Bedrock points | repository内にversioned source artifactなし | `SOURCE_MISSING` | AI use caseのmandatory/high-value分類をAPPROVED扱いしない |
| v0.3 prescription ingress/FHIR/JAHIS/NSIPS | repository内にversioned source artifactなし。関連APPROVED ADP/JAHIS/DOM SSOTは存在 | `SOURCE_MISSING` | 関連SSOTから現状は読めるが、v0.3原文との差分を証明しない |
| construction prompt v0.2.1 | repositoryの正式仕様は`docs/spec/construction_prompt_v0.2.0.md`のみ。v0.2.1 artifactなし | `SOURCE_MISSING` | v0.2.1を正式仕様として扱わず、SPEC-002 v0.2.0をauthorityにする |

Source availability result: `available_exact=0`, `available_normalized=2`, `missing_versioned=5`。したがってWP-0054aはv0.7→current SSOT分類を完了できるが、前提仕様間のrequirement-by-requirement deltaは未完了である。

## 3. v0.7 §1〜38 normative delta matrix

| requirement_id | v0.7 section | current authority/evidence | classification | decision / PRC-007 action |
|---|---|---|---|---|
| V07-01 | §1 結論・5層platform | SPEC-002、ARC-008、PRD-006/007、DOM-001 | `EXTENDS` | 5層はproduct/architecture再編。正式仕様とbounded contextを改版するまで構想扱い |
| V07-02 | §2 根本思想 | ARC-008、PRD-001/002/007、DOM-005、API-002/003/004、ARC-001/002、UIX/SEC群 | `ALIGNED+CONFLICTS` | FHIR格納正本/API-first/local-first/UX/human-AI原則は方向整合。旧PRD-007/DOM-005本文、MVP scope、AI source不足は改版対象 |
| V07-03 | §3 vendor公開機能の示唆 | PRD-004、PRD-005、`docs/ui-ux-refresh/03-external-benchmark.md` | `RESEARCH_ONLY+DUPLICATE_RISK` | edition/option/retrieval date付きbenchmark evidenceに限定。vendor機能を法令・内部設計・同等性根拠にしない |
| V07-04 | §4 22 domain map | DOM-001、PRD-001/002、MOD-001 | `EXTENDS` | product-wide coverage indexを新設可。ただしdomain authorityや正式仕様を置換しない |
| V07-05 | §5 Patient Identity/Consent | API-001、DOM-002/006、SEC-005/006、OPS-010 | `EXTENDS+HUMAN_DECISION_REQUIRED` | merge/split/representative/consent-purposeは新規authority。氏名+生年月日自動統合禁止を維持 |
| V07-06 | §6 Reception/Queue/Appointment | API-006、DOM-004、UIX-006 | `EXTENDS+CONFLICTS` | v0.7の15状態を既存reception 4状態へ直接追加しない。workflow/notification/pickupをstate-axis別に再設計 |
| V07-07 | §7 Prescription Ingress | ADP-001、JHS-001..007、DOM-006、ARC-003/004 | `EXTENDS+SOURCE_MISSING` | trust/source/hash/OCR/duplicateを追加。v0.3原文、JAHIS/NSIPS許諾、official interface evidenceなしに実装しない |
| V07-08 | §8 Prescription Lifecycle | DOM-002/004/006、SAF-001/002、PRD-001/002 | `EXTENDS+HUMAN_DECISION_REQUIRED` | RP/用法/分割/refill/選定療養/疑義照会の範囲はcoverage/evidence/human reviewで確定。破壊的上書き禁止 |
| V07-09 | §9 Dispensing Workflow | DOM-002/004、OPS-007、PRD-002 N9 | `EXTENDS+CONFLICTS` | workflow/actor/audit/reworkは新規。device双方向full integrationは現MVP対象外で、scope改版までGate 3以降 |
| V07-10 | §10 Clinical Safety | SAF-001/002、MOD-005、`packages/shared-kernel/src/clinical-alert.ts` | `EXTENDS+HUMAN_DECISION_REQUIRED` | deterministic knowledge/evidence/severity/overrideをSSOT化。AI確定禁止、warningとclaim blocker分離を維持 |
| V07-11 | §11 Calculation Engine | CAL-001..011、CLM-001、ACC-001 | `ALIGNED+EXTENDS` | pure/deterministic/evidence/traceは整合。公費/PMH/選定療養/回数制限等はcoverageとofficial golden evidenceまでBLOCKED |
| V07-12 | §12 Claim Lifecycle | CLM-001、ARC-006、REG-003/004、OPS-012 | `EXTENDS+HUMAN_DECISION_REQUIRED` | return/resubmit/remittance/cross-month/immutable snapshotを改版。確定済み請求の自動上書き禁止 |
| V07-13 | §13 Accounting/POS/Facility | ACC-001..011、RCP-001..006、PRD-002 N9、ACC-010 | `ALIGNED+EXTENDS+CONFLICTS` | append-only/未収/receipt分離は整合。POS full連携はnon-MVP、施設請求はdata modelのみMVPで発行/売掛/消込がBLOCKED。human scope decisionが必要 |
| V07-14 | §14 Documents/Legal Records | RCP-001..006、DB-005、OPS-010/011、SEC-005 | `EXTENDS+HUMAN_DECISION_REQUIRED` | document catalog、真正性/見読性/保存性、e-delivery、retention effective-dateを法務review付きで追加 |
| V07-15 | §15 Inventory/Procurement/Traceability | PRD-002 N9/N10、OPS-007 | `CONFLICTS+EXTENDS` | inventory core/lot/recall/procurementはcurrent non-MVP。release scope改版とPMDA/GS1 rights evidenceまでruntime禁止 |
| V07-16 | §16 Device/Edge | OPS-007/008、SEC-003、ARC-001/002、ADP-001 | `ALIGNED+EXTENDS` | capability/health/simulator/local retryを既存matrixへ統合。vendor logicとclinical payloadをCoreへ漏らさない |
| V07-17 | §17 Eligibility/PMH/e-Prescription | ADP-001、PRD-001/002 N1-N3、REG-001/004 | `CONFLICTS+HUMAN_DECISION_REQUIRED` | official adapter/fail-pendingは整合。full e-prescription/PMHは現MVP対象外で、official spec/connection/human scope approvalが必要 |
| V07-18 | §18 Home Care/PH-OS | ARC-008、API-004、PRD-002 N4/N10 | `EXTENDS+CONFLICTS` | authority/sync directionはv0.5 planと整合候補。在宅complex billingはnon-MVP。PH-OS repository/current SSOTを別途live確認 |
| V07-19 | §19 Patient Engagement/Online/Delivery | PRD-002 N11、API-002/004、SEC-005、OPS-010 | `EXTENDS+CONFLICTS+HUMAN_DECISION_REQUIRED` | consent/identity/minimum-PHI/legal deliveryを先に確定。patient app/PHR/e-notebook full連携はscope改版まで非MVP |
| V07-20 | §20 Multi-store/HQ/Remote Input | PRD-002 N10、SEC-006、OPS-010 | `CONFLICTS+HUMAN_DECISION_REQUIRED` | current non-MVP。tenant/store/consent/remote input segregationとM&A migrationのhuman scope decisionが必要 |
| V07-21 | §21 Master/Terminology/Regulatory Change | MST-001/002、REG-006、DOM-006、MOD-006 | `ALIGNED+EXTENDS` | signed/versioned/effective/rollback pipelineは整合。JP Core/claim/e-prescription/recall watchを同一version registryへ接続 |
| V07-22 | §22 FHIR/API/Partner Ecosystem | ARC-008、PRD-007、DOM-005/006、API-002/003/004/008、WP-0053 | `CONFLICTS+EXTENDS` | ARC-008を暫定優先しPRD-007/DOM-005/API-004のPENDING_REVISIONを解消。SMART/Bulk/CDS等は個別version/security gate |
| V07-23 | §23 Analytics/Quality/Management | QUA-008/009、QUA-005、OPS-009 | `EXTENDS+HUMAN_DECISION_REQUIRED` | KPI denominator/exclusion/late data/privacyを定義。ranking/AI evaluation/publicationは法務・統計・privacy reviewまで禁止 |
| V07-24 | §24 Migration/Portability/Cutover | OPS-001/002/003/011、DB-001 | `ALIGNED+EXTENDS+HUMAN_DECISION_REQUIRED` | dry-run/delta/reconciliation/export/rollbackは整合。production migrationと旧system権利は別human gate |
| V07-25 | §25 Security/Ops/Support/Reliability | SEC-001..008、OPS-004..014、ARC-001/002 | `ALIGNED+EXTENDS` | v7.0/FY2026 checklist、restore/DR/Edge/support control evidenceを既存SSOTへ改版。準拠宣言だけでGateを通さない |
| V07-26 | §26 Amazon Bedrock AI | repositoryにv0.6/v0.6.1 source artifact/AI SSOTなし | `SOURCE_MISSING+EXTENDS+HUMAN_DECISION_REQUIRED` | model/region/retention/PHI/human-review/fallback authorityを新設するまでclinical data送信禁止 |
| V07-27 | §27 Cross-cutting UX | UIX-001..007、PLAN-UIUX-001、SAF-001 | `ALIGNED+EXTENDS` | Guided/Expertを同一state上へ置く方向は整合。candidate SLOは実機baseline/human approval前にrelease promiseへしない |
| V07-28 | §28 P0-P3 Priority | PRD-001/002、PRC-003/005、Plans current backlog | `CONFLICTS+HUMAN_DECISION_REQUIRED` | v0.7 priorityはcurrent MVP/non-MVPを自動上書きしない。patient safety/legal/dependencyで再採点しhuman product approval |
| V07-29 | §29 Release Gate 0-5 | PRC-003/005、OPS-012、PLAN-PHASE0-GATE-001 | `EXTENDS+DUPLICATE_RISK` | existing gate/checklistを改版し、別のrelease authorityを新設しない。Gate 0前runtime禁止 |
| V07-30 | §30 Dependencies | ARC-008、DOM-001、MOD-002、Plans WP-0054 DAG | `ALIGNED+EXTENDS` | FHIR/master/calculation/prescription/Edge依存をmachine-checkable DAGへする。依存はauthorizationではない |
| V07-31 | §31 Team Allocation | AGT-018、PRC-001/002/005/007 | `OBSOLETE_ROUTING+CONFLICTS` | fable5/Claude/Opus/Sonnet/Haiku laneをcurrent assignment/approvalに使用しない。Codex root sole editor + independent/domain/human reviewへ正規化 |
| V07-32 | §32 Common Modules | MOD-001..014、existing `packages/*` | `DUPLICATE_RISK+EXTENDS` | existing shared-kernel/money/date-time/trace/events/contracts/audit/calculationをauthorityとして再利用。`shared-types`等を重複作成しない |
| V07-33 | §33 New SSOT Documents | IDX-001、PRC-007、existing domain docs、Plans WP-0054m | `DUPLICATE_RISK+EXTENDS` | 22 requested namesをNEW/AMEND/RENAMEへ分類済み。既存APPROVED本文はPRC-007 controlled amendmentのみ |
| V07-34 | §34 Acceptance KPI Candidates | UIX-003/004/005、OPS-005、QUA-005/008/009 | `EXTENDS+HUMAN_DECISION_REQUIRED` | candidate値を未測定SLO/acceptanceへ昇格しない。分母/環境/measurement/human approvalを先に確定 |
| V07-35 | §35 Stop Conditions | PRC-003/005/006、SAF/SEC/REG、AGT-018 | `ALIGNED+OBSOLETE_ROUTING` | clinical/FHIR/billing/offline/AI/security stopは維持。Claude/Opus review条件はcurrent role/human gateへ置換 |
| V07-36 | §36 Execution Instructions | PRC-001/002/005/007、AGT-018、Plans WP-0054a-i | `ALIGNED+OBSOLETE_ROUTING` | 12-step intentをcurrent Codex-only workflowへ正規化。model/lane割当をWork Packageへ転記しない |
| V07-37 | §37 References | REG-006/007、PRD-004、Plans evidence baseline | `RESEARCH_ONLY+EXTENDS` | official/vendor URLをversion/date/hash/license/applicability付きsource registryへ登録してから根拠化 |
| V07-38 | §38 Final Message | PRD-006/007/008/009、ARC-008 | `ALIGNED+RESEARCH_ONLY` | product thesisとして維持可能だが、conformance/availability/qualityを未検証のままmarketing claimにしない |

Machine classification target: `38/38` section rows, `unclassified=0`。

## 4. Immediate conflict / amendment queue

| priority | conflict | affected authority | required action | gate |
|---|---|---|---|---|
| P0 | FHIR=格納正本 vs FHIR=Facade/投影 | ARC-008 vs PRD-007/DOM-005 | PENDING_REVISION本文をARC-008とv0.5/v0.7方向へPRC-007改版。resource集合/ownershipは別registryで確定 | architecture + FHIR + data + human product review |
| P0 | current custom Patient/Reception API vs clinical FHIR API | API-001/API-006/API-008、current apps | WP-0053j expand/validate/consumer-cutover/sunset。即削除・dual authority禁止 | API/security/privacy/medical/data review |
| P0 | v0.7 P0/P1 scope vs current MVP/non-MVP | PRD-001/002 | domainごとにretain/promote/defer/rejectを決定し、APPROVED scope改版前は現行MVPを優先 | pharmacist/claims/legal/product human authority |
| P0 | v0.7 state models vs current state axes | DOM-004、API-006、MOD-005 | reception/dispensing/clinical/sync/payment stateを別軸で設計し、enum追加前にtransition authorityを改版 | medical/data/API review |
| P0 | AI mandatory use cases with no versioned source/AI SSOT | missing v0.6/v0.6.1 | source archive、Bedrock model/region/retention/PHI policy、human review、fallbackを確定 | security/privacy/legal/medical human authority |
| P1 | requested SSOT/module names overlap existing authorities | IDX-001、MOD/OPS/UIX/QUA/ACC documents | WP-0054m dispositionに従いAMEND/composeし、同義SSOT/moduleを新設しない | spec/data-integrity review |
| P1 | full official/partner/device features vs evidence/license | ADP/JHS/REG/OPS、PRD-002 | official source fingerprint、license、sandbox/conformance、failure stateを確定 | legal/regulatory/security/human approval |

## 5. Preserved invariants

1. 法令、公式仕様、患者安全、security/privacy、APPROVED SSOTがDraft/Plansより優先する。
2. 臨床FHIR正本と日本固有算定/請求/会計/監査正本を混同しない。
3. 同一Resource/aggregateのmulti-master、dual-write、last-write-winsを導入しない。
4. JAHIS/NSIPS/official/device formatをClinical Coreへ持ち込まない。
5. 未確認、pending、local-only、送信失敗、AI draftをsuccess/finalへ昇格しない。
6. evidence_idなしに算定・請求・帳票ruleを実装しない。
7. production data、PHI、credential、external send、migration apply、deployを本WPで扱わない。
8. AGT-018のCodex-only routingを維持し、historical model名をcurrent authorityにしない。

## 6. Open questions / blockers

### Source blockers

- `BLOCKED_SOURCE_V05`: v0.5 byte-preserving Draft artifactが未作成(WP-0053a)。
- `BLOCKED_SOURCE_V06`: v0.6 network/Bedrock仕様のversioned repository artifactがない。
- `BLOCKED_SOURCE_V061`: v0.6.1 Bedrock use-case仕様のversioned repository artifactがない。
- `BLOCKED_SOURCE_V03`: v0.3 prescription ingress/FHIR/JAHIS/NSIPS仕様のversioned repository artifactがない。
- `BLOCKED_SOURCE_V021`: construction prompt v0.2.1 artifactがなく、正式仕様はSPEC-002 v0.2.0のみ。
- `BLOCKED_SOURCE_V07_RAW`: v0.7原文のbyte-preserving repository artifact/hashがない。WP-0054 normalized planは代替にならない。

### Human decisions

1. v0.7 P0/P1のうち、current PRD-002 N1-N11からMVPへ昇格する機能はどれか。
2. PRD-007/DOM-005/API-004 PENDING_REVISIONをどのatomic batchで解消するか。
3. Patient/reception/dispensing/claim/accounting各state registryのauthorityと移行順序は何か。
4. PH-OS repository/SSOTを誰がauthorityとしてreviewし、cross-repo ownershipをどう固定するか。
5. Bedrockへ送信可能なdata class、model、region、retention mode、fallback、human reviewは何か。

## 7. Acceptance audit and exact next action

| WP-0054a acceptance item | evidence | status |
|---|---|---|
| v0.7全38節を分類 | §3 `V07-01..38` | PASS |
| 現行APPROVED SSOTとの差分・矛盾・維持 | §3–5 | PASS |
| 廃止routing | V07-31/35/36 | PASS |
| PRC-007改版対象 | §4 | PASS |
| source/version/status | §2 | PASS with missing sources explicit |
| v0.5/v0.6/v0.6.1/v0.3/v0.2.1 requirement-by-requirement delta | versioned raw artifacts absent | BLOCKED_SOURCE |
| DraftをAPPROVED扱いしない | header/important notice | PASS |

Overall: `PARTIAL_SOURCE_BLOCKED`。本書のmissing sourceを推測で埋めず、WP-0054aをDONEへ変更しない。

Exact next action:

1. WP-0054bで22 domainのcode/contract/test/runtime coverageをpath-level evidence付きで作成する。
2. 並行して、ユーザーまたは正式artifact sourceからv0.5/v0.6/v0.6.1/v0.3/v0.2.1/v0.7原文をrepository外の安全な入力として取得し、hashを記録する。
3. source入手後、sole maintainerがbyte-preserving DRAFTを保存し、本matrixを再計算する。
4. independent verifier、spec guardian、architecture/product reviewerがcold-readし、human decisionsをGate 0 packetへ送る。

Rollback: 本書は非SSOT・docs-onlyであり、commit revertで完全に戻せる。APPROVED SSOT、index、runtime、DB、API、external behaviorへ副作用を持たない。
