# Refactor evidence index

Updated on 2026-07-17. This file is the durable index for the active repository-improvement goal. It points to authoritative records instead of duplicating their full command output.

## Evidence authority

| Evidence class | Authoritative record | Current status |
|---|---|---|
| Repository structure and commands | `CODE_MAP.md` | CURRENT |
| Frontend/backend/API/persistence alignment | `FULLSTACK_ALIGNMENT.md` | PARTIAL; explicit blockers retained |
| Automated validation | `VERIFICATION.md` | PASS with documented environment limits |
| Browser and local-demo journeys | `FINAL_DEMO.md` | DEMO_REQUIRED |
| Resume point, blockers and rollback | `STATE.md` | CURRENT |
| High-risk changes | `HIGH_RISK_CHANGES.md` | Human gates remain authoritative |

## Landed evidence groups

| Work package | Implementation evidence | Ledger evidence | Result |
|---|---|---|---|
| WP-4230 | worktree exact2 | `Plans.md`; `State.md`; `ops/refactor/STATE.md` | `VALIDATED / COMMIT_PENDING`: all 12 branded ID factories reject runtime non-string values before property access/coercion with the existing label-only RangeError while preserving public types and primitive-string grammar. PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION gates passed 5/5 in fresh contexts. shared-kernel60, workspace1758 + local PostgreSQL14 expected skips(API767/Web454), workspace test/typecheck/build and standard non-secret gates PASS; live secrets fail closed on existing workspace scope, tracked HEAD+exact2 clean overlay PASS. Rollback reverts implementation plus ledger-only commit and reruns focused/standard gates; no DB/schema/data rollback. No real-DB/remote/prod/UI/browser/push claim; `.omo/` excluded. COMMIT gate pending. |
| WP-4228 | `8d784d6` | `Plans.md`; `State.md`; `ops/refactor/STATE.md` | `FINALIZED / INDEPENDENT_PASS`: InMemory/PostgreSQL reception list commands use one frozen provider-neutral tenant/pharmacy/CalendarDate snapshot before scan/query. PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION gates passed 5/5 after date-authority, isolation, and invalid-matrix P2 remediation; COMMIT gate and post-commit independent review each passed 5/5 in fresh contexts. reception175, API767 + local PostgreSQL14 expected skips, Web454, workspace test/typecheck/build and standard non-secret gates PASS; live secrets fail closed on existing workspace scope, tracked HEAD+exact3 clean overlay PASS. implementation `8d784d6` exact7 local commit. Rollback reverts `8d784d6` plus the ledger-only commit and reruns focused/standard gates; no DB/schema/data rollback, but raw list-command/mixed-scope risk reopens. No list row-set/real-DB/remote/prod/UI/browser/push claim; WP-4050/WP-4151c unchanged and `.omo/` excluded. |
| WP-4227 | `fa9ef5e` | `Plans.md`; `State.md`; `ops/refactor/STATE.md` | `FINALIZED / INDEPENDENT_PASS`: InMemory/PostgreSQL patient lookup/search commands are detached once before scan/query/await with shared own-data primitive scope/query/cursor guards; reception scope helper extraction is behavior-equivalent. PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION/COMMIT gates passed 5/5 after remediation of a P2 non-round-trippable upper-bound next cursor; post-commit review passed 5/5 after rollback-record P2 remediation. patient56 + reception166 = focused222, API758 + local PostgreSQL14 expected skips, Web454, workspace test/typecheck/build and standard non-secret gates PASS; live secrets fail closed on existing workspace scope, tracked HEAD+exact7 clean overlay PASS. implementation `fa9ef5e` exact11 local commit. Rollback reverts `fa9ef5e` plus the follow-up ledger-only commit and reruns focused/standard gates; no DB/schema/data rollback, but raw command authority and cursor risk reopen. No real-DB/remote/prod/UI/browser/push claim, WP-4050/WP-4151c unchanged and `.omo/` excluded. |
| WP-4226 | `3fc3c4e` | `Plans.md`; `State.md`; `ops/refactor/STATE.md` | `FINALIZED / INDEPENDENT_PASS`: INSERT RETURNING and scoped idempotency SELECT require a provider-neutral own-data max1 row snapshot before projection; list is excluded because no authoritative finite bound exists. PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION and post-commit independent gates each passed 5/5 after dense `[undefined]` P1 remediation. reception166/API728 + local PostgreSQL14 expected skips, Web454/contracts97/audit183/patient23/server293, workspace test/typecheck/build and standard non-secret gates PASS; live secrets fail closed on existing `.codegraph`, tracked HEAD+exact2 overlay PASS. exact6 local commit; no real-DB/remote/prod/UI/browser/push claim, WP-4050/WP-4151c unchanged and `.omo/` excluded. |
| WP-4225 | `32ea898` | `Plans.md`; `State.md`; `ops/refactor/STATE.md` | Provider-neutral staged own-data reader and canonical scope/key validation align InMemory/PostgreSQL reception create authority; plan/implementation/bug-refactor/validation and post-commit independent five-review gates PASS; reception155/API717 + local PostgreSQL14 expected skips, typecheck/test/build, lint/OpenAPI/purity/boundaries/SSOT/deps/SBOM/scripts/diff PASS; live secrets fail closed on existing `.codegraph`, tracked HEAD+exact7 overlay PASS; local-only/push not authorized, no UI/DB/remote/prod claim, WP-4050/WP-4151c unchanged |
| WP-4163 | `71fee96` | `Plans.md`; `State.md`; `FINAL_DEMO.md`; `VERIFICATION.md`; UI risk ledger | Hydration-unavailable native form no longer serializes the patient query into URL/body; independent privacy/security PASS, hydrated pointer browser PASS, complete JS-disabled native browser submission unavailable in tooling |
| WP-4149 | `7ba1003` | `Plans.md`; `State.md`; `FINAL_DEMO.md`; `VERIFICATION.md` | Independent browser PASS_WITH_NOTE: selected/global/registration identity matched, native double-click admitted one POST, queue reflected WAITING, clear disabled registration and removed result; transient pending/race unproved |
| WP-4150 | `87b5c41` | `Plans.md`; `State.md`; `FINAL_DEMO.md`; `VERIFICATION.md` | Independent agent-browser PASS: 375px table scroll 0/192 kept both actions fully visible, Tab focus and pointer selection passed, 768/1280 page overflow and console/page errors were zero; Enter remains an automation-input limitation |
| WP-4147 | `3d731e3`; CI alignment `c688d4b` | `Plans.md`; `State.md`; `VERIFICATION.md` | Independent exact2/frozen-install/supply-chain review PASS; only esbuild/sharp build scripts allowed, dependency audit high=0/critical=0 and SBOM=231; later remote proof is recorded under WP-4161/WP-4164 |
| WP-4146 | `8dec253`; fixture follow-up `f1b3ffa` | `Plans.md`; `State.md`; `VERIFICATION.md` | Independent final PASS after permanent padded-key, primitive-section and legal workspace-alias fixtures; checker/runtime/package/lock/CI/SSOT unchanged |
| WP-4161 | `c688d4b`; remote proof `1d2a2da` | `Plans.md`; `State.md`; `VERIFICATION.md`; GitHub Actions run `29499861743` | CI pnpm setup matches repository pin 11.13.1; remote job `87625797181` passed every step with API 286/286 and PostgreSQL integration zero skips; FINALIZED / REMOTE_CI_PASS |
| WP-4164 | `01e8260`; waiter proof `1d2a2da` | `Plans.md`; `State.md`; `VERIFICATION.md`; GitHub Actions run `29499861743` | Canonical NUL-free audit lock key and exact `pg_locks` waiter observation passed remotely: repositories 7/7, audit integration 5/5, migration integration 2/2, API 286/286; WP-4050 atomicity remains separately human-gated |
| WP-4152 | `ac83520`; independent update `1d67fb6` | `FINAL_DEMO.md`; `VERIFICATION.md`; current production Web evidence below | Fresh production Web build/start/static `/sync-status`/shutdown independently `PASS_WITH_NOTE`; dev-format rejection root-captured; API/auth/clinical/restart remain unverified |
| WP-4151b | `ff0e99e` | `FINAL_DEMO.md`; `VERIFICATION.md`; current browser evidence below | Known-non-commit reception-create exact-500 produced no false success/queue reload, retained patient context and recovered via native retry; independent `PASS_WITH_FINDINGS`, browser absolute values root-captured; keys differed, so ambiguous-outcome safety remains WP-4151c human-gated |
| WP-4151a | `e95328c` | `FINAL_DEMO.md`; `VERIFICATION.md`; current browser evidence below | Reception queue exact-500 retained the verified row, suppressed raw payload and recovered through native `表示`; independent `PASS_WITH_NOTE`, registration POST remains unproven |
| WP-4151 follow-up | `31a60f7` | `FINAL_DEMO.md`; `VERIFICATION.md`; current browser evidence below | Exact-500 audit refresh retained verified data, suppressed raw payload and recovered on retry; independent `PASS_WITH_NOTE`, native input remains unproven |
| WP-0054p | `9840ed5` | `docs/research/mhlw_security_gl7_exact_artifact_manifest_20260716.md` | 10/10 official artifacts independently re-retrieved with exact final URL/MIME/bytes/SHA-256 match; promotion remains 0 pending license/applicability/control human review |
| WP-0054i | `046a4c3` | `docs/research/rececon_v0_7_gate0_decision_packet_20260716.md`; `docs/research/rececon_v0_7_independent_verification_20260716.md` | Independent `PASS_WITH_FINDINGS`; VF-02 verified closed, VF-01 itemized coverage open; current Gate 0 decision remains `NO_GO` |
| WP-0054h | `387cabd` | `docs/research/rececon_v0_7_offline_security_migration_operations_matrix_20260716.md` | 36 operations, 7 data classes, 10 restore/migration/support and 16 fallback mappings; R4 implementation/production authority remains 0 |
| WP-0054g | `f3bc288` | `docs/research/rececon_v0_7_ux_performance_kpi_evidence_20260716.md` | A16/B12/C12 journey steps, 7 state axes, 9 live sources and 34 KPI definitions; implementation/SLO/publication authority remains 0 |
| WP-0054f | `20779f7` | `docs/research/rececon_v0_7_domain_api_module_architecture_20260716.md` | 22/22 domains, 5 API classes and 40/40 release mappings; ARC-008/DOM-005 amendment order explicit; implementation authority remains 0 |
| WP-0054e | `9975a81` | `docs/research/rececon_v0_7_priority_release_dag_20260716.md` | 40 bounded WPs and 83 edges; cycle=0, endpoint errors=0, gate ancestry bypass=0; implementation authority remains 0 |
| WP-0054d | `08cf334` | `docs/research/rececon_v0_7_compliance_matrix_20260716.md` | 18 controls cover 12/12 requested areas; current/future retention split recorded; implementation authority and evidence promotion remain 0 |
| WP-0054c | `70c3813` | `docs/research/rececon_v0_7_external_source_fingerprints_20260716.md` | 38/38 external pages live-fetched and hashed; authority/license/watch boundaries retained; evidence promotion remains 0 |
| WP-0054b | `77f548f` | `docs/research/rececon_v0_7_current_state_coverage_20260716.md` | 22/22 domains classified across eight evidence dimensions; no domain overclaimed as implemented |
| WP-0054a | `7c790fd` | `docs/research/rececon_v0_7_normative_delta_registry_20260716.md` | v0.7 38/38 current-authority classification complete; predecessor raw sources missing; `PARTIAL_SOURCE_BLOCKED` |
| WP-0054 | `ce9fcde` | `Plans.md` v0.7 section | 38 sections mapped to Gate 0, D01–D22, cross-cutting work and stop gates; runtime remains blocked |
| WP-0053 | `050df59` | `Plans.md` FHIR Native v0.5 section | Phase 0 through Phase 5 work split landed; approval gates remain closed |

The table records implementation/evidence commit identities; branch and remote status are recorded per work package in `Plans.md` and `State.md`. This WP-4148 reconciliation is local-only until an explicit push instruction. Commit presence does not satisfy independent verification, human approval or final-demo gates by itself.

## Current browser evidence

- Environment: development API and Web servers, in-memory repositories, explicit development-only tenant stub, synthetic fixtures only.
- Patient/reception: patient search, selection, reception registration, queue reflection and context clear passed. The registration form has no freeform Patient ID input.
- Independent WP-4149 rerun: native double-click admitted exactly one create POST and one authoritative queue GET; WAITING identity matched the selected patient, and context clear disabled registration and cleared the success result while retaining committed queue history. Transient pending rendering and an in-flight patient switch were too fast to capture and remain browser-unproved.
- Hydration privacy fallback: an initial stale `.next` run exposed a native GET fallback that placed the synthetic query in the URL. WP-4163 now fixes the SSR form to POST `/patients` and removes the input name, with static regression and independent privacy review. Fresh hydrated pointer search kept `/patients` query-free; the browser tool could not disable JavaScript, so complete native no-JS submission remains unproved.
- Responsive: 375, 768 and 1280 CSS-pixel viewports had no page-level overflow. At 375, the patient-selection action remained inside the viewport before and after horizontal table scrolling.
- Independent responsive rerun: at 375px the table scroller measured 343px client width, 535px content width and 192px maximum horizontal scroll; both actions were fully visible at scroll 0 and 192. Tab reached the first action with a 3px focus ring, pointer selection preserved kana/name/birth identity, and 768/1280 page overflow plus console/page errors remained zero. Enter via the browser CLI did not change state and is excluded from the keyboard-activation claim.
- Audit success path: after a synthetic reception was created, `/admin` displayed `reception.created` and `audit.viewed`; the displayed hash chain was verified as normal.
- Audit refresh failure/recovery: controlled 200(two verified rows) → exact HTTP 500(raw sentinel) → 200(one replacement row) kept the verified table/normal chain and showed stale/fixed-error/retry after failure, suppressed the raw sentinel, then replaced data and cleared the error on retry. Focused component tests passed 50/50. Browser ref/semantic click and Enter did not dispatch in that automation session, so a page-context DOM click exercised the application retry handler; this is not native-input evidence.
- Reception queue refresh failure/recovery: controlled 200(retained row) → exact HTTP 500(raw sentinel) → 200(replacement row), both refreshes via native `表示`. Failure retained row/date/last-updated, showed fixed error/stale qualifier/next action, suppressed raw and future replacement; recovery replaced the row and cleared error/stale state. Request count was 1→2→3, console/page errors empty, and focused tests passed 70/70.
- Reception registration known-non-commit failure/recovery: one selected synthetic patient, native submit → exact HTTP 500 from a mock that did not commit → native retry → 201/WAITING. Pending submit was disabled; failure emitted no success or queue reload, retained context/target, showed fixed next action, suppressed raw sentinel/errorCode/stack and re-enabled submit. Success cleared the error, reloaded the authoritative queue once and displayed the matching row. POST count was 2; queue GET count was 2(initial+success); both bodies matched the patient and carried nonblank/control-character-free 36-character opaque keys. The keys differed, so ambiguous committed-outcome idempotency is not proven and is blocked as WP-4151c. Existing PatientHeader `data-patient-id` remains in DOM by current test contract and is a separate privacy-review item. Combined focused tests passed 139/139; console/page errors were empty.
- Browser console/page-error capture was empty for the completed patient/reception and responsive journeys.
- Production Web sequence: root evidence showed `next start` rejecting a preceding dev-format `.next`, followed by 12-page build, ready in 237 ms, explicit disconnected/not-synced `/sync-status`, and normal shutdown. Independent rerun rebuilt 12 pages in 6.10s, became ready in 270ms on 127.0.0.1:31852, served `/sync-status` HTTP200 in 31.983ms, rendered the exact backend-disconnected/not-synced copy with browser console/page errors 0, and released the port after shutdown. The independent run did not repeat the dev-format rejection. `通常稼働` is based on a fixed NORMAL placeholder and is not evidence that health detection is connected.

## Evidence not obtained

- Native pointer/keyboard activation of the audit retry remains unverified because the browser CLI reported success without issuing the request; page-context DOM click proved the application state transition only. This stays inside the broader keyboard/focus/accessibility demo gap.
- Reception registration ambiguous-outcome retry remains unverified. The known-non-commit 500 path proves no-false-success and post-success queue reload, but does not prove create idempotency because retry generated a different key. Human-approved key lifecycle semantics are required before runtime changes.
- The reduced-motion browser setting did not report an active media query in the automation session, so no reduced-motion conformance claim is made. Forced-colors, 200% zoom focus flow and detailed network/hydration capture remain unverified.
- Local PostgreSQL execution remains unavailable, but GitHub Actions run `29499861743` provides direct zero-skip evidence for the disposable PostgreSQL repository/audit/migration integration scope. Production database operation, production API startup, real authentication, role/tenant denial and a production clinical journey remain unverified. The production Web static-route startup above is only partial evidence. See `FINAL_DEMO.md`.

## FHIR package pre-lock evidence

Retrieved on 2026-07-16 for WP-0053b research only. This is not an approved package lock.

| Item | Direct evidence |
|---|---|
| JP Core artifact | `https://jpfhir.jp/fhir/core/1.2.0/package.tgz` |
| Artifact fingerprint | SHA-256 `6094c8b9ebd975cb738c66cc999774c06a0aacf4480c068a8465e597117e52a3`; 2,391,515 bytes; server `Last-Modified` 2025-11-28; ETag `247ddb-644a0ac73f2c0` |
| Package identity | archive `package/package.json`: `jpfhir.jp.core#1.2.0`, FHIR `4.0.1`, canonical `http://jpfhir.jp/fhir/core` |
| Declared dependencies | `hl7.fhir.r4.core#4.0.1`, `hl7.terminology.r4#7.0.0`, `hl7.fhir.uv.extensions.r4#5.2.0`, `jpfhir-terminology.r4#1.4.0` |
| License metadata | archive `package.json` declares `CC0-1.0`; no standalone license/copying/notice file was present in the archive |
| Official pages | `https://jpfhir.jp/fhir/core/1.2.0/download.html`, `guide-general.html`, and `qa.min.html` |

Terminology dependency follow-up:

| Item | Direct evidence |
|---|---|
| Official terminology artifact | `https://jpfhir.jp/fhir/core/terminology/jpfhir-terminology.r4-1.4.0.tgz` |
| Artifact fingerprint | SHA-256 `cfeb76457774d5a4bf1eb907cb60d083b0dedf04cb92405effa6b4aeaf68d21f`; 7,444,937 bytes; server `Last-Modified` 2025-08-20; ETag `7199c9-63cc7561bc850` |
| Package identity | archive `package/package.json`: `jpfhir-terminology#1.4.0`, FHIR `4.0.1`, canonical `http://jpfhir.jp/fhir/jpfhir-terminology` |
| Declared dependency | `hl7.fhir.r4.core#4.0.1` |
| IG identity | `ImplementationGuide-jpfhir-terminology.json`: active, dated 2025-06-15, packageId `jpfhir-terminology`, title identifies the artifact as the JP Core 1.2.x compatible edition |
| License evidence | package metadata contains no license field and the archive contains no standalone license/licence/copying/notice file; legal clearance remains unresolved |

Declared HL7 dependency artifacts were retrieved through the HL7-documented secondary FHIR package registry on 2026-07-16:

| Package | SHA-256 / size | Package metadata | HTTP validators |
|---|---|---|---|
| `hl7.fhir.r4.core#4.0.1` | `b090bf929e1f665cf2c91583720849695bc38d2892a7c5037c56cb00817fb091` / 4,531,911 bytes | FHIR `4.0.1`, canonical `http://hl7.org/fhir`, license `CC0-1.0` | `Last-Modified` 2026-02-14; ETag `6990a86a-4526c7` |
| `hl7.terminology.r4#7.0.0` | `7f93189014349fa2640c970fadd1a266af217188b42e421ae5b7978e5fdcef63` / 4,763,018 bytes | FHIR `4.0.1`, canonical `http://terminology.hl7.org`, license `CC0-1.0`; depends on core 4.0.1 and extensions 5.2.0 | `Last-Modified` 2026-02-14; ETag `6990aece-48ad8a` |
| `hl7.fhir.uv.extensions.r4#5.2.0` | `b406e75575f05676559d0759770c5939d023ee72fb2ef38e0b3259328487720a` / 1,302,452 bytes | FHIR `4.0.1`, canonical `http://hl7.org/fhir/extensions`, license `CC0-1.0`; depends on core 4.0.1 | `Last-Modified` 2026-02-14; ETag `6990ace9-13dfb4` |

Registry request form: `https://packages2.fhir.org/packages/{package}/{version}`, which redirects to the corresponding versioned `.tgz`. Artifacts were inspected in a temporary directory and deleted after verification.

Tooling-only dependency follow-up:

| Item | Direct evidence |
|---|---|
| Artifact | `hl7.fhir.uv.tools.r4#0.8.0` from the secondary FHIR package registry |
| Fingerprint | SHA-256 `95c0a27f2eb9181c32661b23accaccb4e6db3c504cc4579b6cc7e055161ae322`; 148,918 bytes; `Last-Modified` 2026-02-14; ETag `6990ade7-245b6` |
| Package metadata | FHIR `4.0.1`, canonical `http://hl7.org/fhir/tools`, license `CC0-1.0` |
| Package dependencies | core `4.0.1`, terminology `6.5.0`, extensions `5.3.0-ballot-tc1` |
| JP Core declaration | `ImplementationGuide-jpfhir.jp.core.json` carries `ig-internal-dependency = hl7.fhir.uv.tools.r4#0.8.0`; the tools package defines this as required to validate the IG's resources but not required by IG implementers |
| Reference inventory | 112 JP Core package files refer to tools canonicals; six unique tools StructureDefinition URLs were found, of which five resolve in the 0.8.0 artifact and `resource-information` does not |

Toolchain pre-lock matrix captured on 2026-07-16:

Primary sources: JP Core tag/workflow `https://github.com/jami-fhir-jp-wg/jp-core-v1x/tree/1.2.0`, published QA `https://jpfhir.jp/fhir/core/1.2.0/qa.html`, release APIs for `https://github.com/HL7/fhir-ig-publisher`, `https://github.com/hapifhir/org.hl7.fhir.core` and `https://github.com/FHIR/sushi`, plus the official `fsh-sushi` npm distribution metadata.

| Lane / component | Direct evidence | Pre-lock result |
|---|---|---|
| JP Core 1.2.0 source | Official tag `1.2.0` resolves to commit `c06f02059c2a8aed6a33d624c9eee6fe0669ef06` | Source identity is reproducible |
| Historical IG Publisher | The tagged JP Core `main.yaml` requests `publisher.jar` release `2.0.17`; the published QA also reports v2.0.17. Release asset: 208,967,243 bytes, SHA-256 `878c78531058961fdf101a462af6657bfb79692a91c29623afac108963ae233d` | QA classifies v2.0.17 as a development version and reported v2.0.26 as the latest official release at generation time; do not treat the historical build as the production lock without specialist review |
| Historical SUSHI / Node | The tagged workflow runs `actions/setup-node@v4` with `check-latest: true` and `npm install -g fsh-sushi`, with no Node or SUSHI version | Exact historical SUSHI/Node reproduction is impossible from the workflow alone |
| Current IG Publisher candidate | Official latest release `2.2.11`, 230,671,837 bytes, SHA-256 `a981af86bca3f3a22ee15b9d4ee3c97d63219b7a14e49d0a525e10bbfc71a911`; source and container build target Java 17 | Candidate only; compatibility with JP Core 1.2.0 and the proposed yrese IG is untested |
| Current validator candidate | Official latest `validator_cli.jar` release `6.9.12`, 187,081,756 bytes, SHA-256 `0e53ab1d1a6f1e35f505255c0b8ce10a35fcf27e6e96b503640f784cd07e5ad6`; source compiles for Java 17 | Candidate only; package resolution, profile and terminology negative fixtures remain unrun |
| Current SUSHI candidate | Official `fsh-sushi#3.20.0`, Apache-2.0, npm SRI `sha512-fW5H+XANg75WoU2eikmDx62Cf8ow6whxy+3RX7SoRES4HxnCeQ6MMq3BlS5VLrKM010l6Tj8fmuJ0nwPETtC+Q==` | SUSHI recommends Node 22 and supports 18/20; yrese local/CI Node 24 is outside the documented support matrix |
| yrese execution environment | Local Node `24.16.0`, pnpm `11.13.1`, no Java runtime; CI pins Node 24 and does not set up Java | No clean validator, publisher or SUSHI compatibility claim is possible in the current lane |

Required clean compatibility lanes before any toolchain lock:

1. Characterize the tagged JP Core 1.2.0 source with its observed Publisher 2.0.17 path, while recording the unrecoverable floating SUSHI/Node inputs instead of claiming exact reproduction.
2. Validate the locked JP Core/package closure and positive/negative synthetic instances using a digest-pinned validator candidate under Java 17 with an isolated FHIR cache.
3. Build a minimal yrese/PH-OS R4 IG with digest-pinned IG Publisher and SUSHI candidates under Java 17 / Node 22, then compare CapabilityStatement, profile, terminology and QA output deterministically across clean runs.
4. Test both offline/package-cache-only behavior and terminology-server behavior separately; network success must not hide an incomplete lock.
5. Require FHIR/JP Core, supply-chain and legal/license review before selecting versions or changing CI. A moving `latest` URL, an unpinned global npm install or an ambient user FHIR cache is not acceptable lock evidence.

Terminology rights provenance follow-up captured on 2026-07-16:

| Item | Direct evidence | Review consequence |
|---|---|---|
| JP Core usage notice | JP Core 1.2.0 `guide-precautions.html` says some bound terminologies require permission and that the implementer SHALL resolve terminology licensing; the guide does not guarantee use of FHIR Base or external terminologies | JP Core publication or package availability is not a blanket license grant |
| JP Core source repository | GitHub repository metadata reports no detected license, and the official `1.2.0` tag tree contains no conventional LICENSE/LICENCE/NOTICE/COPYING file | No repository-wide license grant was located; absence must not be converted into permission or prohibition without legal review |
| Terminology 1.4.0 package | The artifact has no package-level license metadata or standalone license file. Its 203 terminology resources comprise 106 CodeSystem and 97 ValueSet resources | Rights must be evaluated at resource/terminology level and against the intended use |
| Resource copyright inventory | 146/203 resources carry a `copyright` string and 57 do not. Mutually exclusive text classification: 17 `All Rights Reserved`, 4 `CC BY-ND`, 2 `CC0`, 3 LOINC-license references, 120 other explicit attribution/copyright text, 57 absent | A copyright string is not by itself a complete grant; missing text is not evidence of public-domain status |
| Current published IP review | The live terminology IP review exposes multiple rightsholders and an unattributed code system, but it belongs to a newer terminology publication rather than the fingerprinted 1.4.0 artifact | Use it only as a risk signal; do not substitute it for a version-specific 1.4.0 rights decision |

Required legal review matrix before package/runtime/publication use:

1. Identify every terminology actually reachable from the selected yrese/PH-OS profiles and synthetic fixtures; do not seek clearance for unused package content by assumption.
2. For each reachable CodeSystem/ValueSet, record rightsholder, authoritative terms, version, permitted validation/runtime/display/cache/derivative/redistribution uses, attribution and update obligations.
3. Review separately: private CI validation cache, runtime terminology service, UI display/export, public IG/test bundles, Partner Sandbox, SDK and Bulk Data output. Permission in one lane does not imply permission in another.
4. Treat absent, attribution-only, `All Rights Reserved`, CC BY-ND and mixed-source statements as unresolved until legal authority records a decision and evidence URL/date.
5. Preserve the option to replace a terminology, avoid the element, use `CodeableConcept.text`, or define an approved local code where JP Core guidance and clinical semantics permit; clinical/claim semantics require their own human review.

Phase 1 candidate Profile and direct ValueSet reachability follow-up captured on 2026-07-16:

- Source: the fingerprinted JP Core 1.2.0 and `jpfhir-terminology#1.4.0` archives plus the already fingerprinted `hl7.fhir.r4.core#4.0.1` and `hl7.terminology.r4#7.0.0` dependencies. All artifacts were re-retrieved into a temporary directory and deleted after the inventory.
- Method: select package `StructureDefinition` resources where `kind=resource` and `derivation=constraint`, group by the 19 yrese Phase 1 authoritative/conditional Resource types, and inspect unique snapshot `(profile, element path, binding strength, valueSet)` rows. Snapshot bindings include inherited base bindings; the totals below are candidate reachability evidence, not differential-only additions or selected implementation contracts.

| Candidate state | Resource types | Result |
|---|---|---|
| One JP Core Profile | Patient, Coverage, Medication, Practitioner, PractitionerRole, Organization, Location, AllergyIntolerance, Consent, DocumentReference | 10 types / 10 Profiles |
| Multiple JP Core Profiles | MedicationRequest 2; MedicationDispense 3; Condition 2; Observation 15 | 4 types / 22 Profiles; selection remains unresolved |
| No JP Core constraint Profile in the package | Provenance, AuditEvent, DetectedIssue, Task, Communication | 5 types; FHIR Base or a reviewed derived Profile decision is still required |
| Non-active candidate | Observation includes `JP_Observation_Electrocardiogram` with status `draft` | It must not be promoted to the production baseline by inventory alone |

Priority gap-inventory details:

| Resource | Candidate Profile evidence | Direct JP terminology 1.4.0 bindings in candidate snapshots |
|---|---|---|
| Patient | `JP_Patient`, active, based on FHIR Patient | none; 13 snapshot binding rows resolve to 11 FHIR core ValueSets |
| Coverage | `JP_Coverage`, active, based on FHIR Coverage | none; 9 snapshot binding rows resolve to 9 FHIR core ValueSets |
| MedicationRequest | `JP_MedicationRequest` and `JP_MedicationRequest_Injection`, both active and directly based on FHIR MedicationRequest | five unique URLs across the two candidates: medication code, general/injection category, practitioner role and substitution-not-allowed reason; clinical selection is unresolved |
| MedicationDispense | `JP_MedicationDispenseBase` based on FHIR MedicationDispense, plus active general and injection Profiles derived from that base | one unique URL (`JP_MedicationCode_VS`) appears on the general candidate; whether base/general/injection Profiles are declared is unresolved |

All 32 candidate Profiles produce 417 unique profile-path binding rows and 128 unique ValueSet canonical URLs. Exact package resolution was complete for this direct layer:

| Resolution package | Binding rows | Unique ValueSet URLs |
|---|---:|---:|
| JP Core 1.2.0 local | 22 | 15 |
| JP terminology 1.4.0 | 50 | 25 |
| FHIR R4 core 4.0.1 | 329 | 80 |
| Present in both FHIR R4 core 4.0.1 and HL7 terminology 7.0.0 | 16 | 8 |
| Unresolved at direct ValueSet layer | 0 | 0 |

Interpretation and stops:

1. These are all candidate snapshots, so overlapping general/base/injection and Observation Profiles intentionally inflate the row totals. They do not prove which Profile belongs in `meta.profile` or which terminology is reachable in a selected yrese workflow.
2. Direct ValueSet resolution does not prove transitive CodeSystem/content closure, terminology-server behavior, semantic fitness, Must Support producer/consumer behavior, or legal permission. WP-4158's use-lane legal matrix remains mandatory.
3. Profile absence does not authorize an ad hoc derived Profile. FHIR/JP Core and clinical review must decide whether FHIR Base is sufficient or a governed yrese Profile is necessary.
4. Before WP-0053e implementation, compare Patient/Coverage/MedicationRequest/MedicationDispense cardinality, Must Support and direct bindings against intended pharmacy workflows, and submit general/injection/base choices to human review.

Priority Profile structural decision follow-up captured on 2026-07-16:

- Official guidance: `https://jpfhir.jp/fhir/core/1.2.0/guide-mustSupportCardinality.html` says JP Core generally delegates Must Support assignment to derived projects. It also warns that minimum cardinality 1 proves element presence, not necessarily a clinically meaningful value, and that constraints may add requirements beyond cardinality.
- Method: re-verify the JP Core archive fingerprint, then count the seven priority candidate Profiles' differential element, explicit cardinality, direct ValueSet binding, targetProfile-bearing type and differential invariant rows. Repeated paths in slices are counted separately. These are machine rows, not a count of independent business fields or a conformance verdict.

| Candidate Profile | Differential rows | Cardinality rows | Direct bindings | Reference target rows | Differential invariants | Must Support in snapshot |
|---|---:|---:|---:|---:|---:|---:|
| `JP_Patient` | 53 | 5 | 0 | 5 | 0 | 0 |
| `JP_Coverage` | 40 | 9 | 0 | 6 | 0 | 0 |
| `JP_MedicationRequest` | 65 | 16 | 4 | 10 | 1 | 0 |
| `JP_MedicationRequest_Injection` | 62 | 13 | 3 | 11 | 1 | 0 |
| `JP_MedicationDispenseBase` | 38 | 11 | 0 | 8 | 0 | 0 |
| `JP_MedicationDispense` | 8 | 4 | 1 | 1 | 0 | 0 |
| `JP_MedicationDispense_Injection` | 4 | 0 | 0 | 2 | 0 | 0 |

Material structural differences requiring review:

1. `JP_Patient` requires at least one `Patient.identifier` and an identifier value; its three listed extension slices remain optional. This does not choose the yrese patient identifier namespace or authorize name/date-of-birth matching.
2. `JP_Coverage` defines optional insurance identifier and extension slices whose `system`/`value` children become required when the relevant identifier slice is present. It does not make either insurance identifier slice globally mandatory.
3. General `JP_MedicationRequest` requires at least two identifiers, including required `rpNumber` and `orderInRp` slices, while the injection candidate requires at least one identifier and a required `rpNumber` slice. Both require `authoredOn` at the differential layer and carry `jp-inv-local-prescriptionid`; their direct bindings differ by general versus injection category and medication representation.
4. `JP_MedicationDispenseBase` requires identifier, `rpNumber`, quantity, subject and `whenHandedOver`. The general derived Profile raises identifier cardinality to two, requires `orderInRp`, binds medication directly to `JP_MedicationCode_VS`, and targets general `JP_MedicationRequest`. The injection derived Profile adds no cardinality row but changes medication and authorizing-prescription targets to the injection graph.
5. All seven snapshots have zero `mustSupport=true` elements. Per JP Core guidance this is not proof that yrese producers, consumers or servers may ignore every optional element; the derived yrese/PH-OS IG must define use-case-specific obligations and missing-data behavior.

Human decision packet required before registry or IG implementation:

1. Which yrese use cases produce and consume general versus injection MedicationRequest and MedicationDispense, and is either injection graph outside the MVP boundary?
2. For MedicationDispense, which Profiles belong in `meta.profile`: base plus a derived Profile, only the derived Profile, or another reviewed declaration pattern?
3. How do yrese patient, prescription, RP, order-in-RP and resource-instance identifiers map to the JP Core slices without creating a second clinical identity authority?
4. Which elements are Must Support for each producer, search/read consumer and create/update server; what are the preserve-and-return, missing-data and DataAbsentReason rules?
5. Are the `preferred` and `example` bindings clinically adequate for pharmacy workflows, and which reachable terminologies are permitted in each WP-4158 use lane?
6. How are JP Patient, Coverage, Organization, Encounter and Medication references resolved across yrese authority, PH-OS read-only replicas and external references without multi-master writes?

Stop conditions: do not infer the answers from cardinality, examples or Profile titles; do not add Must Support, identifier namespaces, `meta.profile`, terminology locks or runtime validators before FHIR/clinical/terminology/legal and ownership review. Narrative mandatory-element guidance must be separately reconciled with machine constraints and conformance fixtures rather than silently treated as an executable constraint.

Pre-lock discrepancies and stops:

- The official terminology artifact resolves the canonical package identity to `jpfhir-terminology#1.4.0`; `.r4` belongs to the distributed archive filename, not its package `name`. The JP Core archive dependency key `jpfhir-terminology.r4` therefore does not match the downloaded dependency package identity or the rendered dependency table. This upstream metadata mismatch must be reviewed rather than silently normalized.
- The terminology artifact source and fingerprint are now known, but its archive provides neither package-level license metadata nor a standalone license file. Resource-level third-party terminology rights may differ, so this evidence does not provide legal clearance.
- The archive `url` field contains a publisher build-machine `file://` path rather than the public canonical.
- The QA report shows zero errors/warnings but also reports suppressed issues, an unpublished publication status and missing version-history metadata. A green QA summary alone is insufficient approval evidence.
- The download URL is not content-addressed. Future retrieval must compare hash, byte length, HTTP validators and package metadata before accepting the same semantic version.
- FHIR/JP Core specialist and legal/license review remain required before any lock or runtime/toolchain implementation. `hl7.fhir.uv.tools.r4#0.8.0` is an explicit internal validation dependency and is therefore a conformance/build-lock candidate, not a clinical runtime dependency. Its transitive terminology/extensions versions conflict with JP Core's declared versions, and one referenced tools canonical is absent from the artifact; clean validator/IG Publisher resolution must be proven before locking it.
- JP Core 1.2.0's published output proves the Publisher version but not its SUSHI/Node inputs. Current Publisher, validator and SUSHI releases are therefore compatibility candidates, not an implied upgrade or lock. The present yrese Node 24 / no-Java environment cannot execute the required matrix.
- The fingerprinted terminology package is not legally cleared by artifact availability, resource copyright text or the current-version IP review. Version-specific, use-specific legal decisions remain a hard gate before runtime use or redistribution.

## Evidence rules

- Never use production credentials, PHI or real patient data in local evidence.
- A test proves only the path and invariant it asserts; component tests do not substitute for browser, database or production-like evidence.
- Environment/tool failures remain explicit and do not become green evidence.
- `DEMO_REQUIRED`, `VERIFY_REQUIRED` and human gates remain open until direct evidence closes their exact scope. Local expected PostgreSQL skips remain an environment note and must not override the direct zero-skip CI proof or be generalized into production readiness.
