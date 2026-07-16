# yrese / PH-OS v0.7 compliance matrix candidate (2026-07-16)

```yaml
proposal_id: WP-0054d-20260716
title: yrese / PH-OS v0.7 legal, regulatory, and clinical compliance matrix candidate
status: DRAFT
implementation_authority: none
normative_target: docs/regulatory/legal_compliance_matrix.md (REG-003)
created_at: 2026-07-16
retrieved_at: 2026-07-16T07:57:00Z
jurisdiction: Japan
evidence_ids: []
blockers:
  - BLOCKED_REGULATORY_REVIEW
  - BLOCKED_LEGAL_REVIEW
  - BLOCKED_MEDICAL_SAFETY_REVIEW
  - BLOCKED_SECURITY_REVIEW
  - BLOCKED_OFFICIAL_ADAPTER_SPEC
```

## 1. Result and authority boundary

This artifact converts the WP-0054d scope into a reviewable candidate matrix. It does
not amend APPROVED SSOT, issue an `evidence_id`, interpret law conclusively, or
authorize implementation. REG-001, REG-003, REG-004, REG-006, and REG-007 remain the
authorities until a pharmacist, claims practitioner, legal reviewer, security/privacy
authority, and the applicable external-system authority approve an SSOT amendment.

The matrix covers all requested areas:

1. dispensing and mandatory records;
2. retention and electronic preservation;
3. calculation and claim submission;
4. online eligibility, PMH, and electronic prescription;
5. online medication guidance and delivery;
6. medical safety and SaMD boundary;
7. privacy, consent, security, and service-provider responsibility;
8. FHIR / JP Core clinical conformance and AI-assisted processing.

Every row is fail-closed. A live landing page is discovery evidence only. A linked PDF,
package, restricted specification, master, or legal revision requires its own retrieval,
hash, applicability review, and human sign-off before it can become implementation
evidence.

## 2. Source snapshot

`sha256` below is over the decoded response body retrieved on 2026-07-16. `BROWSER_ONLY`
means the official page was verified in a browser but automated artifact retrieval was
not successful; no hash is claimed. These are source candidates, not REG-001 evidence
promotion.

| source_id | source / current fact checked | retrieval result | sha256 / authority note |
|---|---|---|---|
| CPL-SRC-001 | e-Gov Laws API v2, Pharmacists Act, law ID `335AC0000000146`; current API text and revision metadata | `200 application/json 15224B` | `7e5c41c727c86612a03e6f01e0a579c79c31cfc35746355e5c6c6926c81d0851`; current text is not the future revision |
| CPL-SRC-002 | e-Gov Laws API v2, Ordinance for Enforcement of the Pharmacists Act, law ID `336M50000100005`; Article 16 fields | `200 application/json 11481B` | `c5ffb26d48d79cf025807dadd2f96c41f51d51887710cd7d3016837fc765410a` |
| CPL-SRC-003 | PPC medical/care privacy guidance; April 2026 revision is listed | `200 text/html 360476B` | `1bee83980ee721983b78d957e3b119eec208db77b65eae165d6653986dc0aab9`; linked PDF requires separate hash |
| CPL-SRC-004 | MHLW online medication guidance landing and related notices | `200 text/html 11764B` | `d38e350cfcf2c30c9c644824df74308b50fd308ba33059ca34304a5774b05aa4`; notice PDFs require separate hash |
| CPL-SRC-005 | MHLW notice on delivery of dispensed medicine, 2022-03-31 | `200 text/html 3472B` | `234b05904b728e3ea1d1be75ca1977a0243a34185ae83561cda7d57ebf64d363` |
| CPL-SRC-006 | MHLW Medical Information System Security Management Guideline 7.0 landing, June 2026 | `200 text/html 11801B` | `5d78477d650aaa16d64c7ddc0c48b712f7dbf2009e00a0bbed87e9902f6dfcfb`; each volume/Q&A requires separate hash |
| CPL-SRC-007 | MHLW FY2026 medical institution/pharmacy cybersecurity checklist | `200 application/pdf 614686B` | `a1250114cd1dfb33049f27d86f6c883b61881207e5a47ce8adf11d2dd2ebea8a` |
| CPL-SRC-008 | METI service-provider security guideline 2.0, March 2025 revision | browser-confirmed official page/PDF; curl returned `403` | `BROWSER_ONLY`; do not reuse the 403 body hash |
| CPL-SRC-009 | PMDA/MHLW SaMD applicability guideline, 2023-03-31 partial revision | `200 application/pdf 1030571B` | `cf80a0630f093a216af39eaee96c5bf86ffdd4cbdca6d4ac204da60a7d0a23b7`; product-specific determination still needs human/authority review |
| CPL-SRC-010 | SSK electronic receipt creation landing | `200 text/html 19151B` | `65510c67fb97c1c157a8d6a87772b3f03667f8c1d4e604b825ffba55df737196`; record-condition PDF/master files require separate hash |
| CPL-SRC-011 | MHLW electronic prescription system-vendor landing | `200 text/html 11264B` | `595df0efd1efc2b57143e4a88f8fb2e85dc18679f82cf7eeb17b0e321ba07250`; ONS-restricted artifacts remain unavailable |
| CPL-SRC-012 | Digital Agency PMH landing | `200 text/html 19208B` | `9d73e1798fa5003d25b55dd7a183963dcbf27b50eec20421e253da47b3bad563`; API/master/municipality applicability requires separate evidence |

Official URLs:

- <https://laws.e-gov.go.jp/api/2/law_data/335AC0000000146>
- <https://laws.e-gov.go.jp/api/2/law_data/336M50000100005>
- <https://www.ppc.go.jp/personalinfo/legal/iryoukaigo_guidance/>
- <https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iyakuhin/yakkyoku_yakuzai/onlinefukuyaku.html>
- <https://www.mhlw.go.jp/web/t_doc?dataId=00tc6659&dataType=1&pageNo=1>
- <https://www.mhlw.go.jp/stf/shingi/0000516275_00006.html>
- <https://www.mhlw.go.jp/content/10808000/001716185.pdf>
- <https://www.meti.go.jp/policy/mono_info_service/healthcare/teikyoujigyousyagl.html>
- <https://www.pmda.go.jp/files/000240233.pdf>
- <https://www.ssk.or.jp/seikyushiharai/iryokikan/iryokikan_02.html>
- <https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/denshishohousen_systemvendor.html>
- <https://www.digital.go.jp/policies/health/public-medical-hub>

## 3. Time-sensitive legal correction

The current e-Gov API response on 2026-07-16 contains a three-year retention period in
Pharmacists Act Articles 27 and 28. A future revision shown by e-Gov changes both to five
years, but the exact enforcement date and transitional treatment were not established
from the current API response. Therefore:

- current records must not be labeled five-year-only without effective-date logic;
- future readiness must not overwrite the currently effective three-year rule;
- `retention_rule_version`, triggering event, effective interval, and transition rule must
  be data, not constants;
- legal counsel and a pharmacist must approve the cutover and treatment of pre-effective
  records after the promulgated enforcement date is confirmed;
- REG-003's current `通説3年` wording should eventually be replaced with versioned,
  primary-source-backed rules, not a timeless numeric statement.

The current Ordinance for Enforcement Article 16 response also provides the candidate
mandatory content for the dispensing record. Exact field mapping, the exception when a
prescription becomes fully dispensed, and future delegated-dispensing amendments require
pharmacist/legal confirmation before schema or UI enforcement.

## 4. Requirement-to-control matrix

Status legend:

- `SOURCE_READY`: official source location/current edition found, exact requirement review pending.
- `TIME_SPLIT_REQUIRED`: current and future rules differ.
- `RESTRICTED_SOURCE_REQUIRED`: ONS, contract, license, or municipality material is missing.
- `HUMAN_DECISION_REQUIRED`: source exists but product applicability is a human authority decision.
- All statuses remain implementation-blocking until REG-001/003/004 promotion is complete.

### 4.1 Dispensing, records, calculation, and claims

| control_id | candidate requirement / applicability | effective date / jurisdiction | proposed control | evidence and test contract | required human sign-off / status / watch |
|---|---|---|---|---|---|
| CPL-001 | A pharmacy retains dispensed prescriptions and dispensing records for the legally effective period; yrese document/record store and migration/export are in scope | Japan; three-year current API text as of 2026-07-16; five-year future revision date and transition unresolved | versioned retention policy keyed by record type, trigger date, effective interval, and legal revision; deletion blocked while any applicable rule remains active | exact e-Gov revision JSON + amendment/commencement instrument; date-boundary, migration, legal-hold, export, and deletion-denial tests | legal + pharmacist + data-integrity; `TIME_SPLIT_REQUIRED`; watch e-Gov amendment commencement weekly until fixed, then monthly |
| CPL-002 | Dispensing records contain the applicable Pharmacists Act enforcement fields and preserve author/date/instruction context | Japan; current Ordinance Article 16 response, future delegated-dispensing impact unresolved | explicit schema/profile and immutable version history; no UI-only field; missing mandatory data blocks finalization | exact ordinance revision; field/cardinality tests, complete-dispensing exception test, author/identity test, historical-version read test | pharmacist + legal + medical safety; `SOURCE_READY`; watch e-Gov monthly and on law amendment |
| CPL-003 | Electronic preservation must retain authenticity, readability, availability, provenance, reissuance, and destruction evidence to the level required for each record class | Japan; current external-preservation notices and Security GL edition; exact e-document applicability unresolved | hash/tamper evidence, immutable history, reproducible rendering, retention tier, legal hold, export, restore, and authorized destruction workflow | exact e-document/external-preservation artifacts; tamper, render, restore, migration, reissue, retention, and destruction-evidence tests | legal + pharmacist + security + data-integrity; `HUMAN_DECISION_REQUIRED`; quarterly legal/security watch |
| CPL-004 | Calculation uses the rule/master/effective date applicable to the service/dispensing/claim context; no unsupported fee is claimable | Japan; FY2026 revision reported effective 2026-06-01 but exact notification artifacts remain unpromoted | pure deterministic calculation with `evidence_id`, `rule_version`, `master_version`, `effective_from/to`, calculation trace, and unsupported-claim blocker | exact notice/table hashes; official examples, golden/property/date-boundary/regression tests | pharmacist + claims practitioner + legal; `SOURCE_READY`; weekly revision/Q&A watch during revision periods |
| CPL-005 | Electronic receipt output and pre-claim checks conform to the applicable record-condition specification and immutable claim snapshot | Japan; claim month and specification edition; exact linked PDF/master hashes pending | claim snapshot/lock, versioned generator, format validator, immutable source references, return/resubmission lineage; no direct online submission automation | exact record-condition PDF/master evidence; golden-file, structural validation, snapshot immutability, correction diff, return/resubmission tests | claims practitioner + legal + data-integrity; `SOURCE_READY`; monthly and release-event watch |

### 4.2 Official public-system adapters

| control_id | candidate requirement / applicability | effective date / jurisdiction | proposed control | evidence and test contract | required human sign-off / status / watch |
|---|---|---|---|---|---|
| CPL-006 | Online eligibility is accessed only through the official supported boundary; unavailable/stale results are not shown as newly confirmed | Japan; participating pharmacy and supported terminal/ONS configuration | Official Adapter, immutable eligibility snapshot, method/time/source, `LOCAL_ONLY_UNVERIFIED`/`PENDING_REVERIFY`, claim-time recheck | ONS external-interface specification and connection evidence; timeout/stale/diff/retry/claim-block tests | claims practitioner + pharmacy operations + security + official connection authority; `RESTRICTED_SOURCE_REQUIRED`; monthly ONS watch |
| CPL-007 | PMH assistance is applied only for supported municipality/program/version and valid eligibility interval; paper coexistence remains explicit | Japan; municipality/program/effective-date specific | Official Adapter, versioned program/master registry, paper/PMH source distinction, priority and allocation trace, `PENDING_PMH_REVERIFY` on uncertainty | PMH API/master/terms/municipality evidence; supported/unsupported municipality, expiry, priority, offline, and recheck tests | claims practitioner + legal + participating municipality/program authority; `RESTRICTED_SOURCE_REQUIRED`; monthly and municipality-release watch |
| CPL-008 | Electronic prescription retrieval, duplicate-check result, refill handling, signature, dispensing-result submission, and preservation follow official specifications; failure is never success | Japan; participating pharmacy, supported edition/certificate/connection-test state | Official Adapter, signed/verified message boundary, idempotent outbox, immutable source, retry/dead letter, explicit pending states; no unofficial AWS direct connection | public technical guide plus ONS record-condition/IF artifacts and connection/self-check evidence; replay, signature, partial failure, idempotency, refill, paper-coexistence tests | pharmacist + legal + security + official connection authority; `RESTRICTED_SOURCE_REQUIRED`; monthly ONS/MHLW watch |
| CPL-009 | Online claim submission remains limited to the official connection, certificate, and operating procedure; yrese does not invent an API or automate unsupported screens | Japan; payer/claim route and certificate environment | export/handoff package with integrity manifest and AuditEvent; submission/result entered only from official artifacts or approved adapter | official connection/operation procedure and test evidence; handoff hash, wrong-month, duplicate, result-import, and failure-state tests | claims practitioner + security + official connection authority; `RESTRICTED_SOURCE_REQUIRED`; monthly SSK/ONS watch |

### 4.3 Online medication guidance, delivery, and patient interaction

| control_id | candidate requirement / applicability | effective date / jurisdiction | proposed control | evidence and test contract | required human sign-off / status / watch |
|---|---|---|---|---|---|
| CPL-010 | Online medication guidance is performed using mutual audio/video recognition, on each occasion under the pharmacist's judgment and responsibility, with privacy and necessary patient information available | Japan; current MHLW implementation guidance and applicable prescription route | explicit pharmacist decision, identity/patient/pharmacy context, modality capability check, privacy confirmation, fallback-to-face-to-face, Encounter/Communication/Provenance/AuditEvent | exact notice/Q&A hashes; identity, unavailable-media, privacy, first/changed prescription, fallback, interruption, and audit tests | pharmacist + legal + privacy + medical safety; `SOURCE_READY`; quarterly and notice-event watch |
| CPL-011 | Prescription information received for online guidance is not treated as an unrestricted substitute for the original; original receipt/association and status are tracked as required | Japan; paper/electronic prescription route and current notice | source/trust/original-pending states, immutable received content, matching review, expiry and duplicate controls; no automatic promotion from image/email/PHR | exact prescription-handling notice; original-arrival, mismatch, duplicate, cancellation, and audit tests | pharmacist + legal + privacy; `SOURCE_READY`; notice-event watch |
| CPL-012 | Delivery preserves medicine quality, reaches the intended patient/representative, minimizes disclosed PHI, and distinguishes dispatch from confirmed handover | Japan; medicine, route, carrier, patient/representative and current delivery notice | approved delivery method/risk attributes, minimum-data adapter, sealed handoff, identity/representative evidence, exception/recall/incorrect-delivery workflow | exact delivery notice and carrier contract; temperature/quality exception, lost package, wrong recipient, representative, failed notification, and return tests | pharmacist + legal + privacy + operations; `HUMAN_DECISION_REQUIRED`; quarterly and notice/carrier-change watch |

### 4.4 Medical safety, privacy, and security

| control_id | candidate requirement / applicability | effective date / jurisdiction | proposed control | evidence and test contract | required human sign-off / status / watch |
|---|---|---|---|---|---|
| CPL-013 | Clinical alerts and AI/CDS output must not silently make pharmacist decisions; SaMD applicability is assessed per feature and intended use before implementation | Japan; product feature/intended use/version specific; current guideline candidate is 2023-03-31 partial revision | feature inventory, intended-use statement, risk class, deterministic/source boundary, Draft/Suggestion state, human review, override reason, no automatic prescription/claim/external send | exact SaMD guideline/cases and consultation record; intended-use, failure, false-positive/negative, override, provenance, and no-auto-finalization tests | pharmacist + legal/regulatory + medical safety; `HUMAN_DECISION_REQUIRED`; PMDA/MHLW release-event watch |
| CPL-014 | Patient, prescription, dispensing, and care data are sensitive personal information; purpose, consent/exception, sharing, outsourcing, access, disclosure/correction, and retention conflict are explicit | Japan; private pharmacy/service-provider role and April 2026 medical/care guidance candidate | data inventory/classification, purpose-of-use registry, Consent version/revocation, least privilege, recipient/processor registry, disclosure export, correction provenance, legal-hold conflict workflow | exact PPC/MHLW guidance PDF/Q&A and legal text; purpose, revoked consent, representative, cross-store, partner, support, export, correction, deletion-denial, and audit tests | legal/privacy + pharmacist + security; `SOURCE_READY`; quarterly and law/guidance-event watch |
| CPL-015 | Pharmacy-side systems meet MHLW Security GL 7.0 and FY2026 checklist controls, including accountable governance, inventory, remote maintenance, disclosure documents, patching, authentication, media control, BCP, and operational rules | Japan; pharmacy/operator and each deployed environment | control catalog with pharmacy/provider responsibility, device/network/remote-maintenance inventory, MFA roadmap, backup/restore, incident/BCP, MDS/SDS exchange, evidence expiry | exact GL volumes/Q&A/checklist hashes; control evidence tests, access review, restore/BCP exercise, remote support, patch/SBOM/secret/dependency scans | pharmacy operator + security + privacy + management; `SOURCE_READY`; monthly until FY2026 checklist closure, then quarterly |
| CPL-016 | yrese/PH-OS as service provider meets METI provider GL 2.0 and supplies responsibility/SLA/security disclosure evidence without transferring non-delegable pharmacy duties | Japan; service provider, cloud/Edge/support subcontractors | provider control catalog, shared-responsibility matrix, SLA, MDS/SDS, subcontractor/data-location registry, incident notification, exit/portability, privileged-support audit | exact GL/FAQ/appendix hashes; responsibility, subcontractor, region, support approval, incident notification, exit/export/deletion tests | security + privacy + legal + management; `SOURCE_READY_BUT_ARTIFACT_HASH_BLOCKED`; quarterly METI watch |

### 4.5 Clinical interoperability and AI processing

| control_id | candidate requirement / applicability | effective date / jurisdiction | proposed control | evidence and test contract | required human sign-off / status / watch |
|---|---|---|---|---|---|
| CPL-017 | Clinical records use the locked FHIR R4 / JP Core package and declared profiles; conformance is not represented as legal or clinical correctness | Japan deployment contract; current planned stable baseline JP Core 1.2.0 / FHIR R4 4.0.1, Phase 0 recheck required | package lock, `meta.profile`, validator, terminology/version registry, CapabilityStatement/IG consistency, Provenance/AuditEvent, authority ownership | exact package hashes; profile/terminology/CapabilityStatement/search/transaction/history/concurrency tests | FHIR specialist + pharmacist + data-integrity; `SOURCE_READY`; monthly JP Core watch, release-event HL7 watch |
| CPL-018 | Bedrock/AI processing of clinical data requires an approved purpose, minimum data, model/region/retention configuration, human review, provenance, and a non-AI fallback | Japan privacy/security obligations plus selected AWS service/config contract; feature/model/region specific | AI use-case registry, data-class gate, de-identification/minimization, no-training/retention configuration evidence, prompt/output audit without PHI leakage, Draft state, circuit breaker/fallback | exact AWS service/config evidence and privacy assessment; denied-PHI, region/model drift, timeout, malformed output, hallucination, human rejection, provenance, and fallback tests | pharmacist + privacy + security + legal + management; `RESTRICTED_CONFIGURATION_REQUIRED`; per release/config/model change watch |

## 5. Coverage and blocker audit

| requested area | controls | result |
|---|---|---|
| dispensing | CPL-001, CPL-002 | covered; current/future retention split discovered |
| retention / electronic records | CPL-001, CPL-003 | covered; exact e-document applicability blocked |
| calculation / claims | CPL-004, CPL-005, CPL-009 | covered; exact notice/spec artifacts blocked |
| online eligibility | CPL-006 | covered; ONS specification blocked |
| PMH | CPL-007 | covered; municipality/API/master evidence blocked |
| electronic prescription | CPL-008 | covered; ONS specification and connection evidence blocked |
| online medication guidance / delivery | CPL-010, CPL-011, CPL-012 | covered; notice-level human applicability review required |
| medical safety / SaMD | CPL-013 | covered; product-specific human determination blocked |
| privacy / consent | CPL-014 | covered; exact April 2026 PDF/Q&A promotion pending |
| security / provider responsibility | CPL-015, CPL-016 | covered; volume-level hashes/control mapping pending |
| FHIR / JP Core clinical conformance | CPL-017 | covered; package lock and human clinical review pending |
| AI | CPL-018 | covered; account/model/region/config and PHI approval blocked |

Matrix counts:

- controls: 18;
- requested areas covered: 12 / 12;
- implementation-authorized controls: 0;
- `evidence_id` issued: 0;
- exact-artifact or human-review blockers: 18 / 18.

## 6. Proposed SSOT amendment order

1. Legal/pharmacist review CPL-001/002 and establish the retention timeline, amendment
   commencement, transitional rules, and exact dispensing-record fields.
2. Retrieve/hash/read the exact claim, e-document, GL 7.0, FY2026 checklist, provider GL
   2.0, privacy guidance, and SaMD artifacts; promote only approved rows in REG-001/007.
3. Obtain ONS and PMH restricted artifacts through human-authorized channels; do not put
   restricted text in public/repository artifacts when terms prohibit it.
4. Amend REG-003 row-by-row with `requirement_id`, effective interval, jurisdiction,
   applicability predicate, official `evidence_id`, control owner, test IDs, sign-off, and
   watch owner.
5. Amend REG-004 blockers only after the corresponding evidence and human decision are
   complete. A landing-page confirmation alone cannot release a blocker.
6. Update SEC-001/002, database retention, claim, adapter, privacy, medical-safety, and
   FHIR SSOTs through PRC-007 change control; run regression and independent verification.

## 7. Human decision packet

| decision | authority | required input | blocked downstream work |
|---|---|---|---|
| current three-year to future five-year retention cutover and transition | legal + pharmacist | current/future e-Gov revisions, commencement instrument, transition provisions | record schema, retention, archive, migration, deletion |
| dispensing record field/cardinality mapping | pharmacist + legal | exact current/future ordinance text and workflow examples | dispensing finalization and legal record rendering |
| calculation/claim scope and evidence promotion | pharmacist + claims practitioner | exact FY2026 notices, record conditions, official examples | calculation/claim/accounting MVP |
| public-system connection authority | management + official authority + security | ONS/PMH agreements, specifications, certificates, connection tests | eligibility/e-prescription/PMH/online claim adapters |
| online guidance and delivery operating model | pharmacist + legal + privacy + operations | exact notices, carrier/process design, incident handling | online guidance/delivery release |
| SaMD applicability per clinical feature | legal/regulatory + pharmacist + medical safety | intended-use inventory, guideline/cases, consultation result if needed | self-generated clinical alert/CDS features |
| privacy/security/provider responsibility acceptance | legal/privacy + security + management + pharmacy operator | April 2026 guidance, GL 7.0, FY2026 checklist, provider GL 2.0, contracts | production PHI, cloud, support, partner integration, AI |

Exact next action after this Draft lands: WP-0054e may use only the blockers and dependency
edges from this matrix for prioritization. Gate 1 implementation remains prohibited until
the relevant REG/SEC/clinical SSOT amendments and human sign-offs are complete.
