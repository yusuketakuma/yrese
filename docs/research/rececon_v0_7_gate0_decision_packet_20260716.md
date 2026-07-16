# yrese / PH-OS v0.7 Gate 0 decision packet

```yaml
document_kind: human_decision_packet
status: DRAFT_NO_GO
work_package: WP-0054i
created_at: 2026-07-16
risk_class: R4
gate: 0
current_decision: NO_GO
implementation_authority: 0
gate1_reissue_authority: 0
production_authority: 0
evidence_promotion: 0
independent_verification: NOT_EXECUTED
supersedes: none
```

## 1. Executive decision

**現在のGate 0判定は`NO_GO`である。Gate 1 Work Packageを再発行してはならない。**

理由:

1. v0.5/v0.6/v0.6.1/v0.3/v0.2.1/v0.7 rawのversioned predecessor artifactが不足し、exact normative deltaを再現できない。
2. official evidence 38 sourceをfingerprintしたが、exact linked artifact/rights/effective/applicabilityのpromotionは0件である。
3. compliance control 18件は全件にexact artifactまたはhuman sign-off blockerがあり、法令・請求・患者安全の実装authorityは0である。
4. 22 domainのruntime completionは0件であり、PARTIAL 8、DOC_ONLY 5、BLOCKED 3、OUT_OF_SCOPE 5、MISSING 1である。
5. FHIR clinical authority、Edge/local authority、LOCAL_ONLY会計、migration scope等に未解消のAPPROVED/Draft conflictがある。
6. Gate 0成果物はCodex single laneで作成され、independent verificationと各human authorityのdecision/dissent/expiryが未記録である。
7. real-device UX/performance、restore/DR、cutover rollback、official connection、PH-OS sync、AI fallbackは計画のみで実証されていない。

`NO_GO`は計画失敗ではない。Gate 0が意図どおりfail-closedに機能している状態である。

## 2. Packet scope and authority

本packetはWP-0054a〜hの成果物を人間が`APPROVE / APPROVE_WITH_CONDITIONS / AMEND / REJECT`できる形へ統合する。APPROVED SSOTを改版せず、法令/薬学/請求/セキュリティ判断を行わず、Gate 1を自己承認しない。

人間承認後も、production data/write、migration apply、external send、certificate/secret、deploy、failover/restore、publishはactionごとの別承認を要する。

## 3. Evidence manifest

| WP | Artifact | Lines / SHA-256 | Landed content | Status |
|---|---|---|---|---|
| WP-0054a | `rececon_v0_7_normative_delta_registry_20260716.md` | 164 / `00321a992edbd05d963e3fc057c4ed0d48a3f5cc3cddbe55302a1483f1ffc660` | `7c790fd` | PARTIAL_SOURCE_BLOCKED |
| WP-0054b | `rececon_v0_7_current_state_coverage_20260716.md` | 159 / `eeef1bc4abcb741a55d4b8e465ec6e811b58a0703ced29e1dd7850831acb0eca` | `77f548f` | LOCAL_READY / INDEPENDENT_VERIFY_REQUIRED |
| WP-0054c | `rececon_v0_7_external_source_fingerprints_20260716.md` | 162 / `cec54753732f03a9eda7e6d71d438c78809f2aaac18e65f88237fe9fab0bf0b8` | `70c3813` | 38 live fingerprints / promotion 0 |
| WP-0054d | `rececon_v0_7_compliance_matrix_20260716.md` | 211 / `99f7421eee3dad5698fc61ac7d8af9e8e027a12e64b7ed9f9d095cae079cc630` | `08cf334` | 18/18 HUMAN_OR_ARTIFACT_BLOCKED |
| WP-0054e | `rececon_v0_7_priority_release_dag_20260716.md` | 317 / `dfd4266a5d704dcabacfe8ca7c4252cf33ba1000db2bf4fdfbca5e71dcf195ce` | `9975a81` | 40 WP / 83 edge / cycle 0 |
| WP-0054f | `rececon_v0_7_domain_api_module_architecture_20260716.md` | 284 / `fb511a0a8e1eb10fd6f001b2a08dfde1cf583ec93aca47833979411cc999ebb9` | `20779f7` | 22 domain / 5 API class / amendment blocked |
| WP-0054g | `rececon_v0_7_ux_performance_kpi_evidence_20260716.md` | 411 / `67e0baeedcfb510a37841fd99c7a819f1f7bf4168f79a40b95e5adfe5d0ce605` | `f3bc288` | A16/B12/C12 / 34 KPI / human blocked |
| WP-0054h | `rececon_v0_7_offline_security_migration_operations_matrix_20260716.md` | 343 / `7bf01354fe660234a4806a97ad1ae4ad19e16aea555218801fee3257a169043c` | `387cabd` | O36/C7/RST10/M10/S10/X16/D10 / R4 blocked |

Manifest hashはpacket作成時のtracked contentを対象とする。artifact変更時は本manifestとdecisionを無効化し、再hash・再reviewする。

## 4. Gate 0 exit readiness

| Gate 0 WP | Required exit | Current evidence | Current result | Missing authority/action |
|---|---|---|---|---|
| G0-01 source recovery/delta | predecessor source gap zero or explicit human acceptance | 38/38 v0.7 section classification | FAIL | raw source recovery、rights、precedence decision |
| G0-02 official artifact/evidence | exact version/hash/applicability/license promotion | 38 landing/source fingerprints | FAIL | linked artifact retrieval、license、human promotion |
| G0-03 compliance amendment | effective interval/control/test/watch/sign-off | 18 control candidates | FAIL | legal/pharmacist/claims/privacy/security sign-off |
| G0-04 priority/release DAG | cycle/bypass 0 + product acceptance | 40 WP/83 edge、cycle/bypass 0 | PARTIAL | independent audit、product release-order decision |
| G0-05 architecture boundary | authority/API/module conflicts resolved | 22 domains/5 API classes/40 mappings | PARTIAL | FHIR/data/security/product decision + PRC-007 batch |
| G0-06 UX/performance/KPI | protocol + human workflow acceptance | 3 journeys/34 KPI/measurement contract | PARTIAL | pharmacist/claims/accessibility/ops baseline |
| G0-07 resilience/operations | unique operation mode + approved RTO/RPO/restore/cutover | 36 operations and integrated matrices | PARTIAL | authority conflicts、DR objectives、R4 drill/human review |
| G0-08 approval/reissue | G0-01..07 independently verified + explicit decisions | this packet | NOT_ELIGIBLE | all prior FAIL/PARTIAL closure + named signatures |

Gate 0 exit count: `PASS=0 / PARTIAL=4 / FAIL=3 / NOT_ELIGIBLE=1`。

## 5. Current 22-domain coverage

| Classification | Count | Domains | Gate implication |
|---|---:|---|---|
| IMPLEMENTED | 0 | — | comprehensive platform claim禁止 |
| PARTIAL | 8 | D01 Patient, D02 Reception, D04 Prescription Lifecycle, D06 Safety UI foundation, D07 Calculation foundation, D08 Claim guards, D17 Master docs, D21 Security/ops partial | existing slicesをpreserveし、contract/authority gapを先に閉じる |
| DOC_ONLY | 5 | D05 Dispensing, D09 Accounting, D10 Documents, D12 Device/Edge, D20 Migration | documentをruntime evidenceにしない |
| BLOCKED | 3 | D03 Ingress, D13 Official systems, D18 FHIR ecosystem | official/FHIR/license/human gate前に実装しない |
| OUT_OF_SCOPE | 5 | D11 Inventory, D14 PH-OS Home, D15 Patient engagement, D16 Multistore, D19 Analytics | current PRD-002改版なしにMVPへ昇格しない |
| MISSING | 1 | D22 Bedrock AI | source/AI SSOT/data policy/fallback前にclinical data送信禁止 |

## 6. Functions added by v0.7 plan

「追加」はcurrent runtime実装を意味せず、現行APPROVED scope/coverageに対する計画差分を意味する。

| Group | Added/planned capability | Disposition |
|---|---|---|
| Clinical Core | authoritative FHIR R4/JP Core persistence/history/search/REST/transaction/IG/terminology | P0 boundary + PRC-007 amendment required |
| Patient/Reception | merge/split/representative/consent、online/appointment/delivery queue | P0/P1 slices; identity/privacy/workflow review |
| Prescription/Dispensing/Safety | complex lifecycle、full dispensing state、device verification、deterministic safety rules | Dispensing promoted P0; source/medical gate |
| Japanese transaction | full calculation、claim return/resubmit、append-only accounting、facility/POS | P0/P1; official evidence and claims authority |
| Inventory/Device | reservation/ledger/procurement/lot/recall/interstore/device adapters | Gate 3/5; current out-of-scope amendment |
| Home/Patient | PH-OS authoritative server、offline visit、facility、follow-up、online/delivery | Gate 4; cross-repo/home/privacy authority |
| Multistore/Open | HQ/remote input/SMART/sandbox/SDK/Bulk/CDS | Gate 5; tenant/partner/security authority |
| Reliability | Edge bundle、LOCAL_ONLY/RECOVERY、restore/DR/support/cutover | P0 foundation and Gate 3 proof |
| UX/KPI | Guided/Expert shared state、fixed contexts、3 journeys、34 KPIs | protocol first; baseline/human decision required |
| AI | Bedrock draft assist + non-AI fallback | Gate 4; source/data/model/legal/medical decision |

## 7. Duplicate / integration decisions

| ID | Duplicate/conflict risk | Decision candidate | Human decision required |
|---|---|---|---|
| DI-01 | FHIR SSOT vs facade-only DOM-005 | ARC-008 directionへ同一PRC-007 batchで改版 | FHIR/data/product |
| DI-02 | custom Patient/Reception clinical API | expand/validate/consumer cutover/sunset; dual authority禁止 | API/security/privacy/medical |
| DI-03 | 5 product layers vs 3 planes | orthogonal viewsとして維持 | architecture/product |
| DI-04 | Japanese transaction data in FHIR | non-FHIR ledger/domain + stable FHIR refs | pharmacist/claims/FHIR/data |
| DI-05 | AuditEvent/Provenance vs audit event store | single append path + FHIR payload/tamper metadata候補 | security/FHIR/data/legal |
| DI-06 | Guided vs Expert | same command/state/audit、presentationのみ差 | UX/medical/product |
| DI-07 | KPI documents | existing QUA policiesをcompose/amend、second authority禁止 | quality/data/legal/statistics |
| DI-08 | requested SSOT names vs existing docs | NEW/AMEND/RENAME disposition、silent replacement禁止 | spec/domain owners |
| DI-09 | requested common packages vs current authorities | current shared-kernel/money/date/trace/events/contracts/audit/calculationを再利用、`shared-types` reject | architecture/data |
| DI-10 | Edge/Cloud/FHIR authority | resource/aggregate/use-caseごとsingle writer、multi-master禁止 | FHIR/data/reliability |
| DI-11 | LOCAL_ONLY payment/accounting terms | charge/final ledger/collection/provisional receiptを分離 | accounting/claims/legal |
| DI-12 | migration v0.7 vs OPS-002 exclusions | domain別retain/promote/defer/reject decision | legal/customer/data/product |

## 8. Priority decision proposal

### P0 — Gateを成立させる前提

- exact source/evidence/legal controls、FHIR authority、Patient identity、master/terminology。
- prescription ingress/lifecycle、dispensing safety completion、calculation、claim、accounting、documents。
- security/tenant/audit、Edge/LOCAL_ONLY/RECOVERY、migration/rollback、restore/DR。
- Guided/Expert shared command、fixed patient/store/month、pending/final semantics。

Dispensing Workflowはv0.7原文のP1からP0へ再評価する。理由はproduction patient journeyのsegregation、verification、rework、handoverなしに安全なMVPが成立しないためである。

### P1 — commercial production readiness

- return/resubmission、receivables/POS、inventory core、device adapters、support/monitoring/SLO、parallel run。
- ただしP0へ依存し、priorityはGate bypass権限ではない。

### P2 — home care / patient experience

- PH-OS、facility billing/operations、follow-up、online guidance、delivery、mandatory Bedrock use cases。
- Gate 3 production core後。AIなしの同等業務経路をexit条件とする。

### P3 — chain / open platform differentiation

- multistore/HQ/remote/M&A、SMART/sandbox/SDK、Subscription/Bulk/CDS、advanced analytics/forecast/public quality。
- privacy/security/statistics/partner offboardingとcore無停止rollbackを必須にする。

## 9. Release Gate proposal

| Gate | Scope | Mandatory exit | Current status |
|---|---|---|---|
| 0 | source/evidence/compliance/boundary/UX/resilience/human decision | G0-01..08全PASS、explicit signatures | NO_GO |
| 1 | FHIR/identity/security/master/Edge/UI foundation | G1-01..07、no PHI production/live official connection | NOT_REISSUED |
| 2 | single-store regulatory MVP | G2-01..10、golden/conformance 100%、critical 0 | BLOCKED_GATE0 |
| 3 | production-ready commercial MVP | dispensing/inventory/device/support/restore/parallel/Go-No-Go | BLOCKED_GATE0 |
| 4 | home care/patient/AI | PH-OS authority、facility/patient、non-AI fallback | BLOCKED_GATE0 |
| 5 | chain/open platform | tenant/partner/privacy/conformance/exit | BLOCKED_GATE0 |

No gate may bypass failed restore、cross-tenant leak、critical safety/claim defect、unsupported claim、fabricated external success、missing human decision。

## 10. SSOT creation/amendment order

### Batch A — source and product scope

1. archive/version/hash predecessor sources without changing authority;
2. exact official artifact/evidence registry promotion decisions;
3. PRD-001/002 scope retain/promote/defer/reject decisions;
4. legal/compliance/effective-date/time-split amendments.

### Batch B — clinical/transaction architecture

1. ARC-008 final clinical authority;
2. DOM-005 facade-only replacement and PENDING_REVISION resolution;
3. bounded context/resource ownership/identity/reference;
4. API class and public/partner/control/adapter contracts;
5. module/DB/event/security/offline alignment.

### Batch C — domain authorities

1. identity/reception/prescription/dispensing/safety;
2. calculation/claim/accounting/document;
3. inventory/device/official adapter/home/patient/multistore/master/FHIR;
4. migration/security/AI.

### Batch D — acceptance and operations

1. UX/workflow/accessibility;
2. performance/SLO/DR/restore;
3. KPI/support/publication;
4. release gate and existing Go/No-Go checklist amendment.

Existing APPROVED docs are amended/composed under PRC-007. Requested filenames do not authorize duplicate SSOT creation。

## 11. Codex Work Package decision

現行AGT-018に従い、Claude/Opus/Sonnet/Haiku/model laneへ割り当てない。Codex rootが調整し、各approved exact scopeでsole maintainerを1名に限定する。review/verifier/domain specialistはread-onlyで、human authorityを代替しない。

### Gate 0 closure WPs

| WP | Exact outcome | May start now? |
|---|---|---|
| G0-01 | missing raw source retrieval/hash/rights/precedence | read-only retrieval yes; authority change no |
| G0-02 | linked official artifact + license + promotion packet | retrieval yes; promotion requires human |
| G0-03 | compliance amendment candidates | draft yes; approval/implementation no |
| G0-04 | independent DAG/product order review | independent topology unavailable in current lane; human review required |
| G0-05 | architecture PRC-007 batch | draft amendment packet yes; merge/effect no |
| G0-06 | synthetic prototype/test protocol | design/prototype only after exact approved scope; no workflow claim |
| G0-07 | BIA/RTO/RPO/DR/support/cutover decisions | tabletop draft yes; production action no |
| G0-08 | decision/signatures/Gate 1 reissue | not eligible until G0-01..07 pass |

### Gate 1 reissue template — currently invalid

Gate 1 WP must include exact paths、approved SSOT/version/hash、source/evidence IDs、risk、owner/sole maintainer、independent verifier、domain/human approvals、entry/exit/rollback/demo、PHI/security/offline/performance impact、forbidden actions、expiry。Generic「Gate 1 approved」は無効である。

## 12. Human review matrix

| Review authority | Required decisions | Cannot delegate to Codex | Current status |
|---|---|---|---|
| Pharmacist/medical safety | identity/prescription/dispensing/safety/home/UX/AI intended use | final clinical/patient-safety acceptance | MISSING |
| Claims practitioner | calculation/claim/record spec/public expense/PMH/accounting/return | reimbursement correctness/scope | MISSING |
| Legal/regulatory | retention/e-document/official rights/online/delivery/AI/publication | legal interpretation/risk acceptance | MISSING |
| FHIR/JP Core | baseline/profile/Must Support/ownership/canonical/API/conformance | conformance/semantic completeness | MISSING |
| Privacy | consent/purpose/Edge/support/multistore/AI/KPI/export | PHI processing/publication acceptance | MISSING |
| Production security | tenant/auth/key/Edge/device/support/backup/incident | production risk and exception acceptance | MISSING |
| Data integrity/DB | single authority/history/ledger/migration/restore/replay | data-loss/corruption acceptance | MISSING |
| Accessibility/UX | WCAG/JIS scope/keyboard/screen reader/context/error prevention | human usability/accessibility acceptance | MISSING |
| Operations/product | priorities/RTO/RPO/capacity/SLO/support/release/cost | business objective and Go/No-Go | MISSING |
| Statistics/quality | KPI cohort/missingness/late data/small cells/gaming | public/internal KPI validity | MISSING |
| Customer pharmacy authority | workflow、parallel run、cutover、rollback、support consent | site-specific operational acceptance | MISSING |

各reviewは`decision`, `scope`, `evidence hashes`, `conditions`, `dissent`, `approver role/name`, `date`, `expiry`, `re-review trigger`を記録する。

## 13. Human decision register

| ID | Decision | Options | Fail-closed default |
|---|---|---|---|
| HD-01 | predecessor source precedence/completeness | accept exact source / accept explicit gap / reject packet | reject Gate 0 |
| HD-02 | official evidence promotions | promote named artifact / defer / reject | no implementation evidence |
| HD-03 | retention current/future time split | approved intervals/migration / defer | no destructive retention automation |
| HD-04 | FHIR clinical persistence authority | approve ARC-008 batch / amend / reject | current conflict、no Gate 1 |
| HD-05 | Resource/use-case write ownership | approve registry / amend / reject | no sync writer |
| HD-06 | AuditEvent/Provenance/audit store | single append design / alternative / defer | no duplicate write authority |
| HD-07 | LOCAL_ONLY accounting boundary | approve provisional collection model / prohibit / amend | no final accounting claim |
| HD-08 | current non-MVP promotion | selected domains promote/defer/reject | remain out of scope |
| HD-09 | migration domain depth | migrate/reference/export-only/reject per domain | no production migration |
| HD-10 | WCAG/JIS/device/browser baseline | approve matrix / amend / defer | no accessibility/release claim |
| HD-11 | performance/SLO/RTO/RPO | approve measured values / require baseline / reject | candidates only |
| HD-12 | DR strategy/data residency | backup/pilot/warm/active decision / defer | no production readiness |
| HD-13 | official adapter connection slices | authorize named slice / simulator only / reject | no live connection |
| HD-14 | Bedrock use case/data/model/region/retention | approve named use case / non-AI only / reject | no clinical data to AI |
| HD-15 | KPI internal/public use | internal only / approved publication subset / reject | no publication/ranking |
| HD-16 | priority/release order | accept / amend / reject | current APPROVED MVP remains |
| HD-17 | SSOT/module disposition | accept NEW/AMEND/RENAME/reject map | no duplicate creation |
| HD-18 | Gate 0 final decision | approve / conditional / amend / reject | NO_GO |

`APPROVE_WITH_CONDITIONS`は条件にowner、deadline、verification、blocking/non-blockingを持たせる。blocking conditionが1件でも未解消ならGate 1を再発行しない。

## 14. Decision record template

```yaml
decision_id: HD-XX
decision: APPROVE | APPROVE_WITH_CONDITIONS | AMEND | REJECT
scope:
evidence_artifact_hashes: []
conditions: []
dissent: []
approver_role:
approver_name:
decided_at:
expires_at:
re_review_triggers: []
signature_or_record_ref:
```

空欄、model名だけ、過去の別scope承認、Codex自己承認、口頭推測は有効なdecision recordではない。

## 15. BLOCKER register

| Blocker | Affects | Closure evidence |
|---|---|---|
| BLOCKED_SOURCE_V05/V06/V061/V03/V021/V07_RAW | G0-01/all deltas | source/hash/right or explicit human accepted gap |
| BLOCKED_EXACT_OFFICIAL_ARTIFACT | G0-02/03、calculation/claim/adapters | exact artifact/license/applicability/promotion |
| BLOCKED_HUMAN_COMPLIANCE | G0-03 | named legal/pharmacist/claims/privacy/security decisions |
| BLOCKED_AUTHORITY_CONFLICT | G0-05/07 | PRC-007 atomic amendment decision |
| BLOCKED_SCOPE_CONFLICT | P0-P3/current PRD | retain/promote/defer/reject records |
| BLOCKED_INDEPENDENT_VERIFICATION | G0-04..08 | non-author verification or explicit governance resolution |
| BLOCKED_REAL_DEVICE_BASELINE | G0-06 | approved device/browser/network/volume measurements |
| BLOCKED_ACCESSIBILITY_WORKFLOW | G0-06 | synthetic manual/AT/pharmacist/claims test evidence |
| BLOCKED_DR_OBJECTIVES_RESTORE | G0-07 | approved BIA/RTO/RPO + restore/DR evidence |
| BLOCKED_MIGRATION_ROLLBACK | G0-07 | source-specific dry run/reconciliation/rollback rehearsal |
| BLOCKED_OFFICIAL_CONNECTION | Gate 2 | terms/ONS/cert/test/self-check/human authorization |
| BLOCKED_PHOS_AUTHORITY | Gate 4 | repository/profile/resource/offline/sync ownership approval |
| BLOCKED_AI_GOVERNANCE | Gate 4 | source/model/region/data/retention/human/fallback approval |
| BLOCKED_PUBLIC_KPI | Gate 5 | legal/privacy/statistics/contract/匿名化 evidence |

## 16. Go / No-Go algorithm

```text
if any G0-01..07 != PASS: NO_GO
if any required human decision missing/rejected/expired: NO_GO
if independent verification missing: NO_GO
if source/evidence/authority conflict unresolved: NO_GO
if implementation_authority != explicit human-approved reissue: NO_GO
else: G0-08 may issue exact Gate 1 WPs
```

Current evaluation:

```text
G0-01 FAIL
G0-02 FAIL
G0-03 FAIL
G0-04 PARTIAL
G0-05 PARTIAL
G0-06 PARTIAL
G0-07 PARTIAL
independent verification NOT_EXECUTED
human decisions 0/18 complete
result NO_GO
```

## 17. Required initial output coverage

| Requested output | Packet section | Status |
|---|---|---|
| 現行仕様のCoverage Matrix | §5 | COMPLETE_AS_EVIDENCE, NOT_READINESS |
| 今回追加する機能 | §6 | COMPLETE_AS_PLAN |
| 重複・統合すべき仕様 | §7 | COMPLETE_AS_DECISION_INPUT |
| P0/P1/P2/P3 | §8 | COMPLETE_AS_PROPOSAL |
| Release Gate | §4, §9 | COMPLETE_AS_PROPOSAL / CURRENT_NO_GO |
| SSOT作成順 | §10 | COMPLETE_AS_CONTROLLED_ORDER |
| Claude/Codex Work Package | §11 | NORMALIZED_TO_AGT-018_CODEX_ONLY |
| 人間レビュー項目 | §12〜14 | COMPLETE, ALL MISSING |
| BLOCKER | §15 | COMPLETE, OPEN |

## 18. Traceability and acceptance audit

| Item | Expected | Actual |
|---|---:|---:|
| WP-0054a-h artifacts | 8 | 8 |
| v0.7 sections classified | 38 | 38 |
| domains classified | 22 | 22 |
| external fingerprints | 38 | 38 |
| compliance controls | 18 | 18 |
| release WPs | 40 | 40 |
| DAG edges / cycles / bypass | 83 / 0 / 0 | 83 / 0 / 0 |
| architecture domain/API/WP maps | 22 / 5 / 40 | 22 / 5 / 40 |
| UX journey steps / KPI | 16+12+12 / 34 | 16+12+12 / 34 |
| resilience operation/data/restore/migration/support/fallback/drill | 36/7/10/10/10/16/10 | 36/7/10/10/10/16/10 |
| human decisions complete | 18 | 0 |
| independent verification | required | NOT_EXECUTED |
| Gate 1 reissue | required after approval | 0 |

## 19. Exact next action

1. Recover/hash/rights-classify missing predecessor raw artifacts; if unavailable, obtain explicit product/legal acceptance of each exact gap.
2. Retrieve and promote only the named official artifacts needed for P0 decisions.
3. Route HD-01〜18 to named human authorities and record decision/dissent/expiry.
4. Prepare the PRC-007 atomic amendment batch but do not make it effective until approved.
5. Obtain independent verification of a〜i artifacts and rerun all counts/hashes.
6. Re-evaluate G0-01〜07. Only if all are PASS may G0-08 issue exact Gate 1 WPs.

Until then, current APPROVED SSOT/runtime remain authoritative and all Gate 1〜5 execution stays `BLOCKED_GATE0`。
