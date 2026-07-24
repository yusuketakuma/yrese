# Refactor evidence index

Updated on 2026-07-18. This file is the durable index for the active repository-improvement goal. It points to authoritative records instead of duplicating their full command output.

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
| WP-4232 | `3ffdb14`; ledger `151c059` | `Plans.md`; `State.md`; `ops/refactor/STATE.md`; draft PR #1 CI `29587027626` | `FINALIZED / INDEPENDENT_PASS / REMOTE_CI_PASS`: fixed-JST(+09:00) acceptedAt authority across InMemory/PostgreSQL/API/Web and Web accepted-time presentation. All six material gates passed 5/5 fresh. Local focused API497/Web136, workspace1818 + 14 expected PostgreSQL skips and standard gates PASS; tracked overlay secrets PASS. Safe feature push fast-forwarded remote to `151c059`; local/remote parity, main unchanged, deployments 0. PR CI at exact head passed PostgreSQL-backed test, secrets, build and every workflow step. Browser artifact/production/deploy non-claims preserved; `.omo/` excluded. Rollback reverts `151c059` then `3ffdb14`; no DB/schema/data rollback, historical authority risk reopens. |
| WP-4233 | `1f181c5`; ledger/remote-evidence head `020965f`; PR CI `29601464612` | `Plans.md`; `State.md`; `ops/refactor/STATE.md` | `FINALIZED / INDEPENDENT_PASS / REMOTE_CI_PASS`: full structural snapshot and list-specific undefined prepass precede projection while bounded helper behavior, SQL, and valid dense-row order/cardinality remain stable; malformed row sets now fail closed. All six material gates and post-commit review passed 5/5 after remediation. Focused248, API807/Web485/workspace1829 plus local PostgreSQL14 expected skips and standard gates PASS; tracked overlay secrets PASS. GitHub-hosted exact-head CI ran PostgreSQL zero-skip and all steps SUCCESS; local/origin/PR `020965f`, main unchanged, deployments 0. This does not prove malformed provider-row generation, production, browser/deploy, cap/pagination, DoS/resource hardening, or the later ledger-only commit itself. `.omo/` excluded; unbounded DB/network/heap and added O(n) cost remain. |
| WP-4165 | implementation `1febf57`; ledger `e02859e`; remote-evidence head `020965f`; PR CI `29601464612` | `Plans.md`; `State.md`; `ops/refactor/STATE.md` | `FINALIZED / INDEPENDENT_PASS / REMOTE_CI_PASS`: exact-head GitHub-hosted CI resolved all three reviewed 40-character action pins and passed install/cache, PostgreSQL zero-skip, and every workflow step with contents-read permission and checkout credentials nonpersistent. Local/origin/PR `020965f`, main unchanged, deployments 0. This is workflow regression proof at that head, not future upstream provenance, production/deploy, or broad release-readiness proof. Reconciliation rollback is ledger-only; security implementation must not be singly reverted to mutable tags. `.omo/` excluded. |
| WP-4231 | `369f9c8` | `Plans.md`; `State.md`; `ops/refactor/STATE.md` | `FINALIZED / INDEPENDENT_PASS`: reception URL business-date validation delegates to canonical CalendarDate, fixing Date.UTC year 0001..0099 rejection while preserving first-value/non-echo and all UI/lifecycle behavior. PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION/COMMIT gates and post-commit independent review each passed 5/5 in fresh contexts, findings 0. dashboard112/date-time13/Web461/workspace1765 + local PostgreSQL14 expected skips(API767), frozen lock220, workspace test/typecheck/build and standard non-secret gates PASS; Next15.5 generated 12/12 static pages. Live secrets fail closed on existing workspace scope, tracked HEAD+exact5 clean overlay PASS. implementation `369f9c8` exact9 local commit. Rollback reverts `369f9c8` plus ledger-only commit and reruns focused/standard gates; no DB/schema/data rollback, but low-year rejection and parser drift reopen. No browser/real-DB/remote/prod/push claim; `.omo/` excluded. |
| WP-4230 | `dde98cd` | `Plans.md`; `State.md`; `ops/refactor/STATE.md` | `FINALIZED / INDEPENDENT_PASS`: all 12 branded ID factories reject runtime non-string values before property access/coercion with the existing label-only RangeError while preserving public types and primitive-string grammar. PLAN/IMPLEMENTATION/BUG_REFACTOR/VALIDATION/COMMIT gates and post-commit independent review each passed 5/5 in fresh contexts, findings 0. shared-kernel60, workspace1758 + local PostgreSQL14 expected skips(API767/Web454), workspace test/typecheck/build and standard non-secret gates PASS; live secrets fail closed on existing workspace scope, tracked HEAD+exact2 clean overlay PASS. implementation `dde98cd` exact6 local commit. Rollback reverts `dde98cd` plus ledger-only commit and reruns focused/standard gates; no DB/schema/data rollback, but the non-primitive branded-ID risk reopens. No real-DB/remote/prod/UI/browser/push claim; `.omo/` excluded. |
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
| WP-4152 | `ac83520`; independent update `1d67fb6`; runtime target `87aa747`; docs evidence `38ef35b`; closure target `09e058e`; CI `29611193923` | `FINAL_DEMO.md`; `VERIFICATION.md`; current production Web evidence below | `FINALIZED / INDEPENDENT_PASS / REMOTE_CI_PASS / EXTERNAL_STATE_CONDITIONAL`: current-head fresh build plus two same-artifact production Web lifecycles passed `/sync-status` HTTP/browser/accessibility-tree snapshot/reload/error0/shutdown/port-release and directly exercised one Web process restart. First closure parity/main/deployments/CI/PUSH_GATE passed. This finalization declaration remains ineffective as FINALIZATION_PENDING until the exact finalization target passes its own review/parity/CI/external gates. Historical dev-format rejection was not repeated. API startup/restart, auth/tenant, clinical/DB/deploy/release/SLO and broad accessibility conformance remain unverified. |
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
- Production Web sequence: root evidence showed `next start` rejecting a preceding dev-format `.next`, followed by 12-page build, ready in 237 ms, explicit disconnected/not-synced `/sync-status`, and normal shutdown. Independent rerun rebuilt 12 pages in 6.10s, became ready in 270ms on 127.0.0.1:31852, served `/sync-status` HTTP200 in 31.983ms, rendered the exact backend-disconnected/not-synced copy with browser console/page errors 0, and released the port after shutdown. Current target `87aa747` closure built 12 static pages in real19.98s and kept BUILD_ID `GMvkAu8EW7gWyinpQPEln` plus `page.js` SHA-256 `f7857371587f18336d3b8aee94706458f9af99007b126185663a20373a1d197d`, `page.js.nft.json` SHA-256 `368f078dfd4a79009e683b16510e6457e0e6de8bc9d4d1e261a4ca20e66bd8cf`, and `page_client-reference-manifest.js` SHA-256 `13746cc9cb7308455b7d3c3f48409166d1c374d4cf531155b9df3019586d3723` unchanged across two no-rebuild starts under `apps/web/.next/server/app/sync-status/`. Run1 listener PID35732 was confirmed by port ownership and `ps`, ready1796ms/HTTP200 80.717ms/23,036 bytes; run2 listener PID40972 passed the same ownership check, ready2.9s/HTTP200 297.738ms/23,036 bytes. Both exposed an accessibility-tree snapshot and exact disconnect/not-synced copy, reloaded with console/page errors 0, then received TERM only at the captured PID, exited within the bounded wait, and left port31852 without a listener. This directly exercises one production Web same-artifact restart. Exact6 validation passed diff check, SSOT index 173, script regression harness and the tracked HEAD+exact6 overlay secret scan; the live secret scan failed closed on the pre-existing user-owned `.codegraph` symlink, and port31852 had no listener. The current run did not repeat dev-format rejection. `通常稼働` is a fixed NORMAL placeholder, timings are observations only, and neither is connected-health/SLO evidence; broad accessibility conformance is not claimed.

## Evidence not obtained

- Native pointer/keyboard activation of the audit retry remains unverified because the browser CLI reported success without issuing the request; page-context DOM click proved the application state transition only. This stays inside the broader keyboard/focus/accessibility demo gap.
- Reception registration ambiguous-outcome retry remains unverified. The known-non-commit 500 path proves no-false-success and post-success queue reload, but does not prove create idempotency because retry generated a different key. Human-approved key lifecycle semantics are required before runtime changes.
- The reduced-motion browser setting did not report an active media query in the automation session, so no reduced-motion conformance claim is made. Forced-colors, 200% zoom focus flow and detailed network/hydration capture remain unverified.
- Local PostgreSQL execution remains unavailable, but GitHub Actions run `29499861743` provides direct zero-skip evidence for the disposable PostgreSQL repository/audit/migration integration scope. Production database operation, production API startup, real authentication, role/tenant denial and a production clinical journey remain unverified. The production Web static-route startup above is only partial evidence. See `FINAL_DEMO.md`.

## FHIR package pre-lock evidence

Retrieved on 2026-07-16 and independently re-retrieved on 2026-07-18 for WP-0053b research only. This is not an approved package lock.

| Item | Direct evidence |
|---|---|
| JP Core artifact | `https://jpfhir.jp/fhir/core/1.2.0/package.tgz` |
| Artifact fingerprint | SHA-256 `6094c8b9ebd975cb738c66cc999774c06a0aacf4480c068a8465e597117e52a3`; 2,391,515 bytes; server `Last-Modified` 2025-11-28; ETag `247ddb-644a0ac73f2c0` |
| Package identity | archive `package/package.json`: `jpfhir.jp.core#1.2.0`, FHIR `4.0.1`, canonical `http://jpfhir.jp/fhir/core` |
| Declared dependencies | `hl7.fhir.r4.core#4.0.1`, `hl7.terminology.r4#7.0.0`, `hl7.fhir.uv.extensions.r4#5.2.0`, `jpfhir-terminology.r4#1.4.0` |
| License metadata | archive `package.json` declares `CC0-1.0`; no standalone license/copying/notice file was present in the archive |
| Official pages | `https://jpfhir.jp/fhir/core/1.2.0/download.html`, `guide-general.html`, and `qa.min.html` |

The 2026-07-18 independent retrieval used exact-origin HTTPS with no redirects and bounded downloads into a repository-external temporary directory. Raw bytes matched the recorded SHA-256, size, ETag and Last-Modified before parsing. A no-extraction inspection found 403 archive entries, 17,549,408 bytes across regular files, no unsafe/duplicate/link/device member, exactly one regular `package/package.json`, and no case-insensitive `LICENSE`, `LICENCE`, `COPYING` or `NOTICE` basename. Package identity, FHIR version, canonical, all four dependencies, `CC0-1.0` package field and publisher `file://` path matched. The rendered guide/QA still names `jpfhir-terminology#1.4.0`; QA still reports errors 0 / warnings 0 together with 13 suppressed issues, an unpublished publication state and unavailable version history. Temporary files were removed. Exact4 validation passed diff check, SSOT index 173, the script regression harness and tracked HEAD+exact4 overlay secret scan; the live secret scan failed closed on the pre-existing user-owned `.codegraph` symlink, and no archive remained in the repository. WP-4154 remains the authority for terminology artifact identity/fingerprint and WP-4158 for rights provenance; neither follow-up supplies legal clearance by itself. WP-4153 finalization is `EXTERNAL_STATE_CONDITIONAL`: until its exact target passes review, push/parity, exact-head CI and PUSH_GATE5/5, the completion declaration is ineffective as FINALIZATION_PENDING.

Terminology dependency follow-up:

Checkpoint-time scope: this WP-4154 subsection, including its downstream independently-unverified and `FINALIZATION_PENDING` clauses, records the WP-4154 review checkpoint only. Current status is controlled by the WP headings and the WP-4157 terminal record.

| Item | Direct evidence |
|---|---|
| Official terminology artifact | `https://jpfhir.jp/fhir/core/terminology/jpfhir-terminology.r4-1.4.0.tgz` |
| Artifact fingerprint | SHA-256 `cfeb76457774d5a4bf1eb907cb60d083b0dedf04cb92405effa6b4aeaf68d21f`; 7,444,937 bytes; server `Last-Modified` 2025-08-20; ETag `7199c9-63cc7561bc850` |
| Package identity | archive `package/package.json`: `jpfhir-terminology#1.4.0`, FHIR `4.0.1`, canonical `http://jpfhir.jp/fhir/jpfhir-terminology` |
| Declared dependency | `hl7.fhir.r4.core#4.0.1` |
| IG identity | `ImplementationGuide-jpfhir-terminology.json`: `resourceType=ImplementationGuide`, id/packageId `jpfhir-terminology`, URL `http://jpfhir.jp/fhir/jpfhir-terminology/ImplementationGuide/jpfhir-terminology`, version `1.4.0`, name `JPFHIRTerminologyPackage`, title `JPFHIR Terminology Package URL-version1.4.0(for CLINS and JP-Core1.2.x)`, active, dated 2025-06-15, FHIR `4.0.1`, no `dependsOn` field |
| License evidence | package metadata contains no license field and the archive contains no standalone license/licence/copying/notice file; legal clearance remains unresolved |

The 2026-07-18 independent retrieval used the exact HTTPS origin with no redirect and bounded transport into a repository-external temporary directory. Raw bytes matched SHA-256 `cfeb76457774d5a4bf1eb907cb60d083b0dedf04cb92405effa6b4aeaf68d21f`, 7,444,937 bytes, ETag `7199c9-63cc7561bc850`, and Last-Modified `Wed, 20 Aug 2025 07:58:21 GMT` before parsing. A no-extraction inspection found 206 entries, 76,637,163 bytes across regular files, a 23,756,698-byte largest member, no unsafe, duplicate, link, device, or other nonregular member, exactly one regular package metadata file and one regular terminology ImplementationGuide, and no case-insensitive license-like basename. Duplicate-key-rejecting JSON parsing with exact type and value checks reproduced package identity `jpfhir-terminology#1.4.0`, FHIR 4.0.1, package canonical `http://jpfhir.jp/fhir/jpfhir-terminology`, the distinct IG URL recorded above, the sole `hl7.fhir.r4.core#4.0.1` package dependency, active status, date 2025-06-15, and the exact title; the package license field and IG `dependsOn` are absent. The JP Core archive key `jpfhir-terminology.r4`, rendered identity `jpfhir-terminology`, and actual package identity remain separately recorded without normalization. Temporary material was moved to Trash and no archive remained in the repository. Diff check, SSOT index 173, script regression, exact4 path/index, and archive-residue checks passed. The first overlay attempt ran the scanner from the repository cwd and continued after failure to print a false `PASS`; it is explicitly INVALID and is not evidence. The sole authoritative overlay result is the corrected fail-fast run from the tracked HEAD+exact4 overlay cwd, which exited 0. The live secret scan exited 1 fail-closed on the pre-existing user-owned `.codegraph` symlink and is not green. WP-4155 through WP-4160 are landed but independently unverified; WP-4158 remains the rights-provenance authority and legal clearance remains unestablished. This identity evidence does not establish lock approval, conformance, runtime/toolchain adoption, or WP-0053b readiness. WP-4154 finalization remains ineffective as `FINALIZATION_PENDING` until its exact target passes review, push/parity, exact-head CI, and PUSH_GATE5/5.

Declared HL7 dependency artifacts were retrieved through the HL7-documented secondary FHIR package registry on 2026-07-16:

Checkpoint-time scope: this WP-4155 subsection, including its downstream independently-unverified and `FINALIZATION_PENDING` clauses, records the WP-4155 review checkpoint only. Current status is controlled by the WP headings and the WP-4157 terminal record.

| Package | SHA-256 / size | Package metadata | HTTP validators |
|---|---|---|---|
| `hl7.fhir.r4.core#4.0.1` | `b090bf929e1f665cf2c91583720849695bc38d2892a7c5037c56cb00817fb091` / 4,531,911 bytes | FHIR `4.0.1`, canonical `http://hl7.org/fhir`, license `CC0-1.0` | `Last-Modified` 2026-02-14; ETag `6990a86a-4526c7` |
| `hl7.terminology.r4#7.0.0` | `7f93189014349fa2640c970fadd1a266af217188b42e421ae5b7978e5fdcef63` / 4,763,018 bytes | FHIR `4.0.1`, canonical `http://terminology.hl7.org`, license `CC0-1.0`; depends on core 4.0.1 and extensions 5.2.0 | `Last-Modified` 2026-02-14; ETag `6990aece-48ad8a` |
| `hl7.fhir.uv.extensions.r4#5.2.0` | `b406e75575f05676559d0759770c5939d023ee72fb2ef38e0b3259328487720a` / 1,302,452 bytes | FHIR `4.0.1`, canonical `http://hl7.org/fhir/extensions`, license `CC0-1.0`; depends on core 4.0.1 | `Last-Modified` 2026-02-14; ETag `6990ace9-13dfb4` |

Registry request form: `https://packages2.fhir.org/packages/{package}/{version}`, which redirects to the corresponding versioned `.tgz`. Artifacts were inspected in a temporary directory and deleted after verification.

The 2026-07-18 independent retrieval first verified that `https://hl7.org/fhir/packages.html` identifies `packages2.fhir.org` as a secondary package registry; the official page displays its URL as HTTP, while this verification deliberately required HTTPS. Each request endpoint returned exactly one same-origin 302 to its pinned direct artifact, and each direct artifact returned HTTP 200, `Content-Type: application/octet-stream`, and zero redirects. The full direct baselines are core `https://packages2.fhir.org/web/hl7.fhir.r4.core-4.0.1.tgz` / SHA-256 `b090bf929e1f665cf2c91583720849695bc38d2892a7c5037c56cb00817fb091` / 4,531,911 bytes / ETag `"6990a86a-4526c7"` / Last-Modified `Sat, 14 Feb 2026 16:52:58 GMT`; terminology `https://packages2.fhir.org/web/hl7.terminology.r4-7.0.0.tgz` / SHA-256 `7f93189014349fa2640c970fadd1a266af217188b42e421ae5b7978e5fdcef63` / 4,763,018 bytes / ETag `"6990aece-48ad8a"` / Last-Modified `Sat, 14 Feb 2026 17:20:14 GMT`; and extensions `https://packages2.fhir.org/web/hl7.fhir.uv.extensions.r4-5.2.0.tgz` / SHA-256 `b406e75575f05676559d0759770c5939d023ee72fb2ef38e0b3259328487720a` / 1,302,452 bytes / ETag `"6990ace9-13dfb4"` / Last-Modified `Sat, 14 Feb 2026 17:12:09 GMT`. No-extraction inspection found core 4,742 entries / 37,636,928 regular bytes / 3,384,166 largest member, terminology 4,111 / 65,006,938 / 7,575,699, and extensions 1,401 / 18,373,069 / 677,785; no unsafe, duplicate, link, device, or other nonregular member and no case-insensitive license-like basename were found. Duplicate-key-rejecting JSON parsing with exact type/value checks reproduced package metadata separately from transport: core has canonical `http://hl7.org/fhir`, package `url` `http://hl7.org/fhir/R4`, type `fhir.core`, no dependencies field; terminology has canonical `http://terminology.hl7.org`, package `url` `http://terminology.hl7.org/7.0.0`, type `IG`, and exact dependencies core 4.0.1 plus extensions 5.2.0; extensions has canonical `http://hl7.org/fhir/extensions`, package `url` `http://hl7.org/fhir/extensions/5.2.0`, type `IG`, and exact dependency core 4.0.1. All three package identities/FHIR 4.0.1/version/type/license `CC0-1.0` fields matched; `IG` is the literal package metadata value and is not inferred from the transport URL. Temporary material was moved to Trash and no archive remained in the repository. Final exact4 validation passed `git diff --check`, SSOT index 173, script regression, exact-path/index, and archive-residue checks. The sole authoritative secret result is the fail-fast `set -e` scan from a tracked HEAD+exact4 overlay cwd, which exited 0. The live `pnpm check:secrets` exited 1 fail-closed because the pre-existing user-owned `.codegraph` symlink prevents protected-scope validation; it is not green. This package metadata does not establish legal clearance, lock approval, conformance, runtime/toolchain adoption, or WP-0053b readiness; WP-4156 through WP-4160 remain independently unverified, and WP-4158 remains the rights-provenance authority. WP-4155 finalization remains ineffective as `FINALIZATION_PENDING` until its exact target passes review, push/parity, exact-head CI, and PUSH_GATE5/5.

Tooling-only dependency follow-up:

| Item | Direct evidence |
|---|---|
| Artifact | `hl7.fhir.uv.tools.r4#0.8.0` from the secondary FHIR package registry |
| Fingerprint | SHA-256 `95c0a27f2eb9181c32661b23accaccb4e6db3c504cc4579b6cc7e055161ae322`; 148,918 bytes; `Last-Modified` 2026-02-14; ETag `6990ade7-245b6` |
| Package metadata | FHIR `4.0.1`, canonical `http://hl7.org/fhir/tools`, license `CC0-1.0` |
| Package dependencies | core `4.0.1`, terminology `6.5.0`, extensions `5.3.0-ballot-tc1` |
| JP Core declaration | `ImplementationGuide-jpfhir.jp.core.json` carries `ig-internal-dependency = hl7.fhir.uv.tools.r4#0.8.0`; the tools package defines this as required to validate the IG's resources but not required by IG implementers |
| Reference inventory | 112 JP Core package files refer to tools canonicals; six unique tools StructureDefinition URLs were found, of which five resolve in the 0.8.0 artifact and `resource-information` does not |

The 2026-07-18 independent retrieval first used the HL7 official package-registry authority already recorded above, then required HTTPS for `https://packages2.fhir.org/packages/hl7.fhir.uv.tools.r4/0.8.0`. The request returned exactly one same-origin 302 to `https://packages2.fhir.org/web/hl7.fhir.uv.tools.r4-0.8.0.tgz`; the direct artifact returned HTTP 200, `Content-Type: application/octet-stream`, and zero redirects. Bounded transport reproduced SHA-256 `95c0a27f2eb9181c32661b23accaccb4e6db3c504cc4579b6cc7e055161ae322`, 148,918 bytes, ETag `"6990ade7-245b6"`, and Last-Modified `Sat, 14 Feb 2026 17:16:23 GMT`. No-extraction inspection found 175 entries / 1,514,386 regular bytes / 196,902 largest member, no unsafe, duplicate, link, device, or other nonregular member, no case-insensitive license-like basename, and exactly one regular `package/package.json`. Duplicate-key-rejecting JSON parsing with exact type/value checks reproduced `hl7.fhir.uv.tools.r4#0.8.0`, FHIR `4.0.1`, canonical `http://hl7.org/fhir/tools`, package URL `http://hl7.org/fhir/tools/0.8.0`, type `IG`, license `CC0-1.0`, and exact dependencies core `4.0.1`, terminology `6.5.0`, extensions `5.3.0-ballot-tc1`. A separately bounded fresh JP Core 1.2.0 retrieval reproduced its declared core `4.0.1` / terminology `7.0.0` / extensions `5.2.0` contrast. It found the tools prefix in 112 package files, with exactly six canonicals: `ig-internal-dependency`, `ig-page-name`, `ig-parameter`, `implementationguide-dependency-comment`, `resource-information`, and `snapshot-base-version`; all except `resource-information` resolve in the tools artifact. The exact `ig-internal-dependency` definition describes a package required to validate IG resources themselves but not required by IG implementers. This proves only a conformance/build-lock candidate, not a clinical runtime dependency, lock approval, clean validator/Publisher resolution, legal clearance, runtime/toolchain adoption, or WP-0053b readiness. WP-4157 remains the compatibility authority, WP-4158 rights, WP-4159 reachability, and WP-4160 profile obligations. Temporary material was moved to Trash; no artifact remains in the repository. Final exact4 validation passed `git diff --check`, SSOT index 173, script regression, exact-path/index, archive-residue checks, and the fail-fast tracked HEAD+exact4 overlay-cwd secret scan. The live `pnpm check:secrets` exited 1 fail-closed because the pre-existing user-owned `.codegraph` symlink prevents protected-scope validation; it is not green. WP-4156 finalization remains ineffective as `FINALIZATION_PENDING` until its exact target passes review, push/parity, exact-head CI, and PUSH_GATE5/5.

Toolchain pre-lock matrix captured on 2026-07-16:

Primary sources: JP Core tag/workflow `https://github.com/jami-fhir-jp-wg/jp-core-v1x/tree/1.2.0`, published QA `https://jpfhir.jp/fhir/core/1.2.0/qa.html`, release APIs for `https://github.com/HL7/fhir-ig-publisher`, `https://github.com/hapifhir/org.hl7.fhir.core` and `https://github.com/FHIR/sushi`, plus the official `fsh-sushi` npm distribution metadata.

| Lane / component | Direct evidence | Pre-lock result |
|---|---|---|
| JP Core 1.2.0 source | Official tag `1.2.0` resolves to commit `c06f02059c2a8aed6a33d624c9eee6fe0669ef06` | Source identity is reproducible |
| Historical IG Publisher | The tagged JP Core `main.yaml` requests `publisher.jar` release `2.0.17`; the published QA also reports v2.0.17. Release asset: 208,967,243 bytes, SHA-256 `878c78531058961fdf101a462af6657bfb79692a91c29623afac108963ae233d` | QA classifies v2.0.17 as a development version and reported v2.0.26 as the latest official release at generation time; do not treat the historical build as the production lock without specialist review |
| Historical SUSHI / Node | The tagged workflow runs `actions/setup-node@v4` with `check-latest: true` and `npm install -g fsh-sushi`, with no Node or SUSHI version | Exact historical SUSHI/Node reproduction is impossible from the workflow alone |
| Current IG Publisher candidate | Official latest release `2.2.11`, 230,671,837 bytes, SHA-256 `a981af86bca3f3a22ee15b9d4ee3c97d63219b7a14e49d0a525e10bbfc71a911` | Candidate only; source/runtime prerequisites and compatibility with JP Core 1.2.0 and the proposed yrese IG are unverified |
| Current validator candidate | Official latest `validator_cli.jar` release `6.9.12`, 187,081,756 bytes, SHA-256 `0e53ab1d1a6f1e35f505255c0b8ce10a35fcf27e6e96b503640f784cd07e5ad6` | Candidate only; source/runtime prerequisites, package resolution, profile and terminology negative fixtures remain unverified |
| Current SUSHI candidate | Official `fsh-sushi#3.20.0`, Apache-2.0, npm SRI `sha512-fW5H+XANg75WoU2eikmDx62Cf8ow6whxy+3RX7SoRES4HxnCeQ6MMq3BlS5VLrKM010l6Tj8fmuJ0nwPETtC+Q==` | SUSHI recommends Node 22 and supports 18/20; yrese local/CI Node 24 is outside the documented support matrix |
| yrese execution environment | Local Node `24.16.0`, pnpm `11.13.1`; the current `java -version` invocation exits nonzero; CI pins Node 24 and does not set up Java | No usable local Java invocation or clean validator, publisher or SUSHI compatibility claim is demonstrated in the current lane |

Required clean compatibility lanes before any toolchain lock:

1. Characterize the tagged JP Core 1.2.0 source with its observed Publisher 2.0.17 path, while recording the unrecoverable floating SUSHI/Node inputs instead of claiming exact reproduction.
2. Validate the locked JP Core/package closure and positive/negative synthetic instances using a digest-pinned validator candidate under Java 17 with an isolated FHIR cache.
3. Build a minimal yrese/PH-OS R4 IG with digest-pinned IG Publisher and SUSHI candidates under Java 17 / Node 22, then compare CapabilityStatement, profile, terminology and QA output deterministically across clean runs.
4. Test both offline/package-cache-only behavior and terminology-server behavior separately; network success must not hide an incomplete lock.
5. Require FHIR/JP Core, supply-chain and legal/license review before selecting versions or changing CI. A moving `latest` URL, an unpinned global npm install or an ambient user FHIR cache is not acceptable lock evidence.

The 2026-07-18 independent metadata verification resolved the JP Core annotated tag `1.2.0` to commit `c06f02059c2a8aed6a33d624c9eee6fe0669ef06`; its historical Publisher2.0.17 release asset is id `291251052`, `publisher.jar`, 208,967,243 bytes, SHA-256 `878c78531058961fdf101a462af6657bfb79692a91c29623afac108963ae233d`. GitHub release metadata recorded candidate Publisher2.2.11 asset id `478216867` `publisher.jar` 230,671,837 bytes / SHA-256 `a981af86bca3f3a22ee15b9d4ee3c97d63219b7a14e49d0a525e10bbfc71a911` and validator6.9.12 asset id `478124375` `validator_cli.jar` 187,081,756 bytes / SHA-256 `0e53ab1d1a6f1e35f505255c0b8ce10a35fcf27e6e96b503640f784cd07e5ad6`. Source POM/container Java-target observations are prior, non-authoritative notes excluded from this verifier and from current acceptance; a later clean spike must reproduce runtime prerequisites before selecting either tool. npm metadata reproduced SUSHI3.20.0 Apache-2.0 and its SRI above; the README pinned to SUSHI tag `v3.20.0` commit `1e3717e6ae668918b4f90bfe3b6c55de6aeeff7f` recommends Node22, supports18/20, and says above22 is not officially supported. This lane runs Node24.16.0/pnpm11.13.1; `java -version` exits nonzero, which proves only that no usable Java invocation was demonstrated, not that Java is absent. This verification did not download/install FHIR binaries, reuse FHIR caches, select versions, create a lock, prove a validator/Publisher/SUSHI run, legal clearance, runtime/toolchain adoption, or WP-0053b readiness.

### WP-4157 canonical metadata reproduction and trust boundary

This section is the single authority for WP-4157 metadata reproduction. `Plans.md`, `State.md`, and `ops/refactor/STATE.md` project only status, ownership, non-claims, and a pointer here; they do not restate an executable retrieval design.

The JP Core tag object `8b9780cbdb9086e6f41b35aa8935038bd884243e` peels to the expected commit, but GitHub reports `verification.verified=false` and `verification.reason=unsigned`. GitHub API digests, a raw SHA match from the same GitHub distribution channel, and npm SRI establish identity/integrity relative to those channel objects only. They do not establish publisher signature, attestation, provenance authenticity, absence of repository/release-process compromise, compatibility, FHIR conformance, license grant, adoption approval, or patient-safety suitability. Before WP-0053b selects or locks a version, a future supply-chain review must locate and verify available signatures/attestations or obtain explicit human supply-chain risk acceptance.

| Assertion | Stable read-only endpoint | Required typed result |
|---|---|---|
| JP Core tag ref | `https://api.github.com/repos/jami-fhir-jp-wg/jp-core-v1x/git/ref/tags/1.2.0` | object type `tag`, SHA `8b9780cbdb9086e6f41b35aa8935038bd884243e` |
| JP Core tag object | `https://api.github.com/repos/jami-fhir-jp-wg/jp-core-v1x/git/tags/8b9780cbdb9086e6f41b35aa8935038bd884243e` | object type `commit`, SHA `c06f02059c2a8aed6a33d624c9eee6fe0669ef06`, `verified=false`, reason `unsigned` |
| Historical Publisher | `https://api.github.com/repos/HL7/fhir-ig-publisher/releases/tags/2.0.17` | tag `2.0.17`, `draft=false`, `prerelease=false`; exactly one asset named `publisher.jar`, with `state=uploaded`, id `291251052`, size `208967243`, digest `sha256:878c78531058961fdf101a462af6657bfb79692a91c29623afac108963ae233d`. Other differently named assets such as detached signatures do not violate target-name cardinality. |
| Candidate Publisher | `https://api.github.com/repos/HL7/fhir-ig-publisher/releases/tags/2.2.11` | tag `2.2.11`, `draft=false`, `prerelease=false`; exactly one asset named `publisher.jar`, with `state=uploaded`, id `478216867`, size `230671837`, digest `sha256:a981af86bca3f3a22ee15b9d4ee3c97d63219b7a14e49d0a525e10bbfc71a911`. Other differently named assets do not violate target-name cardinality. |
| Candidate validator | `https://api.github.com/repos/hapifhir/org.hl7.fhir.core/releases/tags/6.9.12` | tag `6.9.12`, `draft=false`, `prerelease=false`; exactly one asset named `validator_cli.jar`, with `state=uploaded`, id `478124375`, size `187081756`, digest `sha256:0e53ab1d1a6f1e35f505255c0b8ce10a35fcf27e6e96b503640f784cd07e5ad6`. Other differently named assets do not violate target-name cardinality. |
| SUSHI package | `https://registry.npmjs.org/fsh-sushi/3.20.0` | name `fsh-sushi`, version `3.20.0`, license `Apache-2.0`, `dist.integrity=sha512-fW5H+XANg75WoU2eikmDx62Cf8ow6whxy+3RX7SoRES4HxnCeQ6MMq3BlS5VLrKM010l6Tj8fmuJ0nwPETtC+Q==` |
| SUSHI tag ref / README | `https://api.github.com/repos/FHIR/sushi/git/ref/tags/v3.20.0` and `https://raw.githubusercontent.com/FHIR/sushi/1e3717e6ae668918b4f90bfe3b6c55de6aeeff7f/README.md` | tag resolves directly to pinned commit; README contains the Node22 recommendation, 18/20 support, and >22 unsupported statement |

#### Current bounded metadata verifier

Run this block from the repository root. It performs metadata-only HTTPS reads and deterministic local fixtures; it executes neither Node, Java nor any FHIR artifact.

<!-- WP4157_METADATA_VERIFIER_BEGIN -->
```bash
python3 -I - <<'PY'
import contextlib, copy, json, os, signal, ssl, sys, time, urllib.error, urllib.request

MAX_JSON = 2 * 1024 * 1024
MAX_TEXT = 512 * 1024
MAX_ASSETS = 100
DEADLINE = time.monotonic() + 120

def fixed_excepthook(_kind, _value, _traceback):
    print("WP4157_METADATA_FAIL", file=sys.stderr)

sys.excepthook = fixed_excepthook

if not __debug__:
    raise RuntimeError("optimized mode is unsupported")

class AggregateTimeout(BaseException):
    pass

class RequestTimeout(Exception):
    pass

def alarm_handler(_signum, _frame):
    if time.monotonic() >= DEADLINE:
        raise AggregateTimeout("aggregate wall clock")
    raise RequestTimeout("request wall clock")

signal.signal(signal.SIGALRM, alarm_handler)
signal.setitimer(signal.ITIMER_REAL, 120)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def strict_pairs(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise ValueError(f"duplicate key: {key}")
        out[key] = value
    return out

def strict_json(raw):
    return json.loads(raw, object_pairs_hook=strict_pairs)

for env_key in ("SSL_CERT_FILE", "SSL_CERT_DIR", "SSLKEYLOGFILE"):
    os.environ.pop(env_key, None)
TLS_CONTEXT = ssl.create_default_context()
OPENER = urllib.request.build_opener(
    urllib.request.ProxyHandler({}),
    urllib.request.HTTPSHandler(context=TLS_CONTEXT),
    NoRedirect(),
)

def remaining(cap):
    value = min(cap, DEADLINE - time.monotonic())
    if value <= 0:
        raise AggregateTimeout("aggregate wall clock")
    return value

@contextlib.contextmanager
def hard_timeout(cap):
    signal.setitimer(signal.ITIMER_REAL, remaining(cap))
    try:
        yield
    finally:
        left = DEADLINE - time.monotonic()
        signal.setitimer(signal.ITIMER_REAL, left if left > 0 else 0)

def bounded_body(response, url, limit):
    if response.status != 200 or response.geturl() != url:
        raise ValueError("response identity")
    raw = response.read(limit + 1)
    if len(raw) > limit:
        raise ValueError("response too large")
    return raw

def fetch(url, limit, as_json=True):
    headers = {"Accept": "application/json" if as_json else "text/plain", "User-Agent": "yrese-wp4157"}
    request = urllib.request.Request(url, headers=headers)
    with hard_timeout(20):
        with OPENER.open(request, timeout=remaining(20)) as response:
            raw = bounded_body(response, url, limit)
    return strict_json(raw) if as_json else raw.decode("utf-8", "strict")

def exact(value, expected):
    assert type(value) is type(expected) and value == expected

def release(doc, tag, asset_id, name, size, digest):
    exact(doc["tag_name"], tag); exact(doc["draft"], False); exact(doc["prerelease"], False)
    assets = doc["assets"]; assert type(assets) is list and len(assets) <= MAX_ASSETS
    assert all(type(asset) is dict for asset in assets)
    name_matches = [asset for asset in assets if asset.get("name") == name]
    id_matches = [asset for asset in assets if asset.get("id") == asset_id]
    assert len(name_matches) == 1 and len(id_matches) == 1 and name_matches[0] is id_matches[0]
    asset = name_matches[0]
    exact(asset["id"], asset_id); exact(asset["name"], name); exact(asset["size"], size)
    exact(asset["state"], "uploaded"); exact(asset["digest"], digest)

tag_ref = fetch("https://api.github.com/repos/jami-fhir-jp-wg/jp-core-v1x/git/ref/tags/1.2.0", MAX_JSON)
exact(tag_ref["object"]["type"], "tag"); exact(tag_ref["object"]["sha"], "8b9780cbdb9086e6f41b35aa8935038bd884243e")
tag = fetch("https://api.github.com/repos/jami-fhir-jp-wg/jp-core-v1x/git/tags/8b9780cbdb9086e6f41b35aa8935038bd884243e", MAX_JSON)
exact(tag["object"]["type"], "commit"); exact(tag["object"]["sha"], "c06f02059c2a8aed6a33d624c9eee6fe0669ef06")
exact(tag["verification"]["verified"], False); exact(tag["verification"]["reason"], "unsigned")

historical = fetch("https://api.github.com/repos/HL7/fhir-ig-publisher/releases/tags/2.0.17", MAX_JSON)
release(historical, "2.0.17", 291251052, "publisher.jar", 208967243, "sha256:878c78531058961fdf101a462af6657bfb79692a91c29623afac108963ae233d")
publisher = fetch("https://api.github.com/repos/HL7/fhir-ig-publisher/releases/tags/2.2.11", MAX_JSON)
release(publisher, "2.2.11", 478216867, "publisher.jar", 230671837, "sha256:a981af86bca3f3a22ee15b9d4ee3c97d63219b7a14e49d0a525e10bbfc71a911")
validator = fetch("https://api.github.com/repos/hapifhir/org.hl7.fhir.core/releases/tags/6.9.12", MAX_JSON)
release(validator, "6.9.12", 478124375, "validator_cli.jar", 187081756, "sha256:0e53ab1d1a6f1e35f505255c0b8ce10a35fcf27e6e96b503640f784cd07e5ad6")

npm = fetch("https://registry.npmjs.org/fsh-sushi/3.20.0", MAX_JSON)
exact(npm["name"], "fsh-sushi"); exact(npm["version"], "3.20.0"); exact(npm["license"], "Apache-2.0")
exact(npm["dist"]["integrity"], "sha512-fW5H+XANg75WoU2eikmDx62Cf8ow6whxy+3RX7SoRES4HxnCeQ6MMq3BlS5VLrKM010l6Tj8fmuJ0nwPETtC+Q==")
sushi_ref = fetch("https://api.github.com/repos/FHIR/sushi/git/ref/tags/v3.20.0", MAX_JSON)
exact(sushi_ref["object"]["type"], "commit"); exact(sushi_ref["object"]["sha"], "1e3717e6ae668918b4f90bfe3b6c55de6aeeff7f")
readme = fetch("https://raw.githubusercontent.com/FHIR/sushi/1e3717e6ae668918b4f90bfe3b6c55de6aeeff7f/README.md", MAX_TEXT, False)
for text in ("install Node.js 22", "supports_ Node.js 18 and 20", "versions > 22 and < 18 may work", "not officially supported"):
    assert text in readme
negative_count = 0
def must_fail(call):
    global negative_count
    try: call()
    except Exception: negative_count += 1
    else: raise AssertionError("negative fixture passed")

must_fail(lambda: strict_json(b'{"x":1,"x":2}'))
must_fail(lambda: strict_json(b'{'))
class FakeResponse:
    def __init__(self, body, final_url="https://example.invalid/metadata"):
        self.status = 200; self.body = body; self.final_url = final_url
    def geturl(self): return self.final_url
    def read(self, count): return self.body[:count]
must_fail(lambda: bounded_body(FakeResponse(b"x" * 4), "https://example.invalid/metadata", 3))
exact(bounded_body(FakeResponse(b"x" * 3), "https://example.invalid/metadata", 3), b"x" * 3)
must_fail(lambda: bounded_body(FakeResponse(b"{}", "https://redirect.invalid/metadata"), "https://example.invalid/metadata", 3))
class SlowResponse(FakeResponse):
    def read(self, count):
        time.sleep(0.1)
        return super().read(count)
def slow_fixture():
    with hard_timeout(0.01):
        bounded_body(SlowResponse(b"{}"), "https://example.invalid/metadata", 3)
must_fail(slow_fixture)
broken_ref = copy.deepcopy(tag_ref); broken_ref["object"]["type"] = None
must_fail(lambda: (exact(broken_ref["object"]["type"], "tag"), exact(broken_ref["object"]["sha"], "8b9780cbdb9086e6f41b35aa8935038bd884243e")))
broken_tag = copy.deepcopy(tag); broken_tag["verification"]["verified"] = True
must_fail(lambda: (exact(broken_tag["verification"]["verified"], False), exact(broken_tag["verification"]["reason"], "unsigned")))
publisher_target = next(asset for asset in publisher["assets"] if type(asset) is dict and asset.get("name") == "publisher.jar")
publisher_target_index = publisher["assets"].index(publisher_target)
for mutate in (
    lambda d: d.update(draft=True), lambda d: d.update(prerelease=True),
    lambda d: d["assets"].clear(), lambda d: d["assets"].append(copy.deepcopy(d["assets"][publisher_target_index])),
    lambda d: d["assets"][publisher_target_index].update(id=None), lambda d: d["assets"][publisher_target_index].update(size="230671837"),
    lambda d: d["assets"][publisher_target_index].update(state="new"), lambda d: d["assets"][publisher_target_index].update(digest=None),
    lambda d: d["assets"].append("not-an-object"),
    lambda d: d["assets"].append({"id": 478216867, "name": "different-name.asc"}),
):
    broken = copy.deepcopy(publisher); mutate(broken)
    must_fail(lambda broken=broken: release(broken, "2.2.11", 478216867, "publisher.jar", 230671837, "sha256:a981af86bca3f3a22ee15b9d4ee3c97d63219b7a14e49d0a525e10bbfc71a911"))
broken_npm = copy.deepcopy(npm); broken_npm["dist"]["integrity"] = None
must_fail(lambda: exact(broken_npm["dist"]["integrity"], "sha512-fW5H+XANg75WoU2eikmDx62Cf8ow6whxy+3RX7SoRES4HxnCeQ6MMq3BlS5VLrKM010l6Tj8fmuJ0nwPETtC+Q=="))
broken_npm_name = copy.deepcopy(npm); broken_npm_name["name"] = None
must_fail(lambda: exact(broken_npm_name["name"], "fsh-sushi"))
must_fail(lambda: exact("install Node.js 22" in "missing support text", True))
print(f"WP4157_METADATA_PASS negatives={negative_count}")
PY
```
<!-- WP4157_METADATA_VERIFIER_END -->

The success line is `WP4157_METADATA_PASS negatives=20`. Node 24 and the nonzero `java -version` / no-usable-Java-invocation observations remain recorded outside this verifier; they are not re-executed by the gate and do not prove Java absence. Only a fresh run against the reviewed candidate is gate evidence; prior output is historical.

Future binary retrieval is excluded from WP-4157. The observations below are minimum non-executable guardrails, not a complete downloader design: request bytes through `GET /repos/{owner}/{repo}/releases/assets/{asset_id}` with `Accept: application/octet-stream`, after strict metadata validation of the same asset snapshot; permit exactly one HTTPS redirect to `release-assets.githubusercontent.com` with no userinfo and default port; authenticate only the `api.github.com` request, then construct a fresh redirect request from an explicit safe-header allowlist that excludes `Authorization`, cookies, proxy credentials, original signed headers, and every credential-bearing header; never log or persist its signed query/headers; enforce the per-artifact 256MiB, connect15s, total120s bounds; and compare final raw size/SHA to that snapshot. The future WP-6004/locked-package spike owns retry/backoff, aggregate byte/disk budget, concurrency, owned-temp cleanup on every exit, cache isolation, and pre/post-download identity revalidation, with negative tests for credential/header forwarding, changed metadata, unexpected scheme/host/port, redirect count, oversize, interruption, partial files, and cache contamination.

The clean compatibility plan is **3 execution lanes + 2 mandatory cross-lane gates**: (1) historical characterization, (2) isolated-cache locked validator, (3) Java17/Node22 minimal IG build; cross-lane gate A separates offline/cache-only from terminology-network behavior, and gate B requires FHIR/JP Core, supply-chain, and legal/license review. Only lane 1 metadata characterization is in WP-4157.

#### Rejected fresh7 validation/landing draft (non-executable summary)

Fresh7 attempted a WP-specific private-ref state machine and is rejected. Its review evidence is preserved by exact candidate OID `6eb663cdf4c480d722925f887f74588a50e1d43b`, parent `1e63e85257c6ea2def16934b55f564394c685e9e`, tree `1967725ad03916f27f5582e7cffbbb65bf4f2ea2`, the fresh7 verdict summary below, and Git history/diff. The executable draft has been removed so a search cannot mistake it for current procedure. Known defects were unconditional validation-ref deletion, `/var` versus `/private/var` cleanup false-green, partial state validation, mutable failed-CI evidence, incomplete taxonomy/interruption probes, CI run-set TOCTOU, and private-ref-only terminal projection.
#### Fresh20 PLAN authority: scoped WP-4157 metadata closure

WP-4157 has one outcome: reproduce the pinned metadata table and preserve every compatibility/conformance/lock/license/adoption non-claim. Scope is exact4 only; no artifact, cache, dependency, package, runtime, code, DB, UI, SSOT or CI/toolchain mutation and no PHI. Generic orchestration is outside this WP.

##### Focused metadata verifier

S1 replaces the rejected historical verifier with one self-contained Python 3 verifier embedded in this section. It accepts no arguments, downloads no artifact, uses no authentication, subprocess, shell, curl or `gh`, and contacts only the hard-coded public HTTPS metadata/README endpoints already listed in the canonical table. A `urllib` opener disables proxies and redirects; POSIX wall-clock timers bound each request, including DNS/open/body read, to 20 seconds and the whole verifier to 120 seconds. Each JSON response is capped at 2 MiB, README at 512 KiB and release assets at 100. JSON parsing rejects duplicate keys and validates exact types, singleton/cardinality, tag/asset identity, digest/SRI and support text. Failure emits only a fixed error ID; success emits one fixed summary. Deterministic fixtures cover malformed/duplicate JSON, boundary/oversize, redirect, slow body/deadline, wrong type/value/cardinality/digest/support text. Previously recorded Node 24 and nonzero `java -version` observations remain non-authoritative, demonstrate no usable Java invocation, do not prove Java absence, and are not re-executed by this verifier.

##### Exact candidate and validation

Before and after every validation command, root compares `git status --short`, the exact4 blob OIDs/modes, staged path set and all non-exact4 tracked working-tree/index status; any non-exact4 mutation or index drift stops. A disposable external `GIT_INDEX_FILE`, seeded from the slice parent and populated with exact4 only, provides the reviewed candidate tree without changing the real index. Immediately before commit, root exact-stages only exact4, rechecks that the staged tree equals the reviewed tree, and after commit requires the exact parent plus the NUL-delimited sorted output of `git -c diff.renames=false diff-tree -r --no-commit-id --name-only -z HEAD^ HEAD` to equal exactly the four paths. S1 parent is current `1e63e85257c6ea2def16934b55f564394c685e9e`; S2 parent is the pushed, CI-successful S1 head.

Downstream equality uses full baseline `e81d7ec58f2a4376ce5b43854fd995e8da94b917`. Boundaries are complete Plans list items whose headings begin with exactly one of `[x]`, `[~]`, `[ ]` or `[!]`, from that `- [status] WP-ID` heading to the next such heading/EOF, and complete State sections from `### WP-ID` to the next `###`/EOF. Required singleton blocks and normative concatenation order are Plans WP-4158, WP-4159, WP-4160, WP-0053a, WP-0053b, WP-6004; then State WP-4158, WP-4159, WP-4160. Per file, canonical concatenation `ID + NUL + block` in that stated order has SHA-256 `1c5f51a361214102dacf70445bba633502c9e4601ff99a420765d544affd7b1e` for Plans and `daecab54bc67e3eb050ec5416769253347cdb4a29f1eefa2b252c29770783271` for State.

Tracked residue validation rejects newly added tracked paths with case-insensitive FHIR/cache/package directory components or archive suffixes `.jar`, `.war`, `.zip`, `.tgz`, `.tar*`, `.gz`, `.bz2`, `.xz`, `.zst`, `.7z`, `.rar`. It does not scan evidence URLs as residue and makes no archive-magic or untracked/ignored-content claim.

Both S1 and S2 run `git diff --check`, the exact4/non-exact4 isolation checks, normative downstream hashes, the focused verifier, `pnpm check:ssot-index`, `pnpm test:scripts`, candidate-scope secret scan and tracked-path residue scan. S2 also checks its concise landing record. Live `pnpm check:secrets` remains explicitly non-green if protected `.codegraph` prevents traversal.

##### Two ordinary repository slices

S1 is the substantive exact4 verifier/evidence/status change plus relabeling the old State heading as historical. After its required reviews, exact-stage commit, ordinary feature-branch push and exact-head CI success, S2 adds a concise exact4 landing record containing S1 commit/tree, validations, review results, CI identity, risks, rollback note and next action. S2 does not claim its own future push/CI result; those are reported by root from Git/GitHub after completion. No S3 or custom landing-state implementation is introduced.

The user-required PLAN, IMPLEMENTATION, BUG_REFACTOR, VALIDATION, COMMIT and PUSH review gates each use exactly five fresh read-only contexts. Their candidate-bound ledgers are execution evidence for this goal, not a new repository feature or portable orchestration framework. BUG_REFACTOR records the inspected bug/security/performance surface even when no refactor is accepted.

##### Ordinary landing evidence and rollback boundary

For each slice, root verifies the expected remote/PR head, performs one explicit ordinary non-force feature-branch push, and stops on divergence or push failure. CI must be workflow id `309812329`, path `.github/workflows/ci.yml`, event `pull_request`, PR1, the exact pushed head, `run_attempt=1`, `completed/success`; a missing, duplicate, rerun, wrong-head or failed result does not pass. PUSH_GATE then checks local/origin/PR parity, origin/main still `27d61445350e40f2741583a07eb20936d9916992`, deployments count zero and no tracked changes. These Git commits, the PR, CI run and tracked S2 record are the durable/reconstructible landing evidence.

After S2 PUSH_GATE 5/5, root posts or updates no repository data beyond the already-authorized branch/PR workflow; the final user report supplies S2 commit, CI and parity facts. If rollback is later explicitly requested, first fresh-map downstream dependencies, then revert only the WP-4157 exact4 commits in reverse chronological order with new reviewed commits and rerun then-current validation/CI. Historical `1e63e85`, `42fa277`, `ffa1fd0` are excluded absent separate approval. No rollback implementation or future schema is part of WP-4157.

Unsigned provenance human acceptance and legal/license, FHIR baseline/lock/conformance, patient safety, architecture/product and WP-0053a/b gates remain unwaived.

Fresh7 review result is 0/5 PASS. Reviewer1 found missing real interruption/reconciliation evidence, non-durable post-push records and L0 scope drift. Reviewer2 found the weak state decoder, stale-evidence deletion, failed-generation promotion, incomplete taxonomy probes, unchecked execution snapshot and unbounded Java invocation. Reviewer3 independently confirmed stale-ref deletion, weak canonical state validation, failed-generation reuse and probe undercoverage. Reviewer4 found live cleanup residue, prose-only review CAS, packed-ref blindness, CI TOCTOU and protected-path gaps. Reviewer5 found the same cleanup failure, missing durable gate projection, no failed-generation rollover and missing terminal run-set uniqueness. The three exact stale registrations created by the rejected verifier were reconciled with exact `git worktree remove --force --force` targets on 2026-07-18; unrelated WP-4147/WP-9001/WP-9002 registrations were preserved.

Fresh8 review result is also 0/5 PASS. All reviewers identified the self-blocking lifecycle of preserved ref `6eb663c…`; additional findings required a literal taxonomy oracle, filesystem manifest schema, aggregate verifier timeout, removal of offline materialization, immutable first-attempt CI semantics, finite C1/C2 projection, concrete resume states, retained-ref versus transient-residue separation and explicit unsigned-provenance human acceptance. Fresh9 addressed those items but did not pass.

Fresh9 review result is 0/5 PASS. The repeated P1 class was missing durable storage for pre-push baseline/reviewer/terminal evidence, ambiguous per-generation C1/C2 refs and failed-generation rollback, and an unsafe `node_modules` symlink excluded from the manifest. Fresh10 addressed those items but did not pass.

Fresh10 review result is 0/5 PASS. Its remaining P1 findings were commit/journal non-atomicity, missing PUSH_INTENT and terminal failure phases, incomplete strict schema/partial review recovery, overbroad sandbox reads, ambiguous filesystem additions/run2, non-durable immediate C2 State projection and prefix-based generation inventory. Fresh11 addressed those items but did not pass.

Fresh11 review result is 0/5 PASS. Its common P1 findings were absence of a PLAN review ledger/artifact binding, incomplete phase×field oracle, digest-only State projection, ambient tool identity, reviewer context replay, failed-lineage classification and unbounded corrective generations/retries. Fresh12 addressed those mechanics but did not pass.

Fresh12 review result is 0/5 PASS and is durably recorded at review-ledger blob `34cbd9877f0dac74be5a5cb02d922c4593243967`, candidate tree `a6db72d195890e63921c5c22dc3edbd2cb7698f9`. Reviewer1's decisive proximity finding was that the generic landing framework had overtaken the LOW metadata WP. Other findings concerned incomplete gate bindings, projection durability, scanner/sandbox/tool trust, C1/C2 semantics and lineage. Fresh13 removes that framework from WP-4157 and returns to the scoped metadata outcome.

Fresh13 review result is 0/5 PASS and is recorded at ledger blob `fdeddaf7cb9d11d78d9c093ced5115bf57179c40`, candidate tree `cfb817b99f581d46aef8f227d70119781c7a0766`. All reviewers accepted the scope reduction. Remaining findings were numeric verifier bounds, temp-index identity, finite downstream/residue literals, the omitted BUG_REFACTOR gate, slice-specific remote bases/CI selection, mutable terminal-comment binding and corrective lineage rollback. The historical Fresh14 candidate addressed only those scoped gaps.

Fresh14 review result is 0/5 PASS and is recorded at ledger blob `d8e34a31b23ddae5eed0d47969263a422d21a264`, candidate tree `151bfd4e81b353d070ae42733c5df8190b0b9779`. Its remaining findings were S2 self-reference, missing generation-specific durable envelope and corrective re-gating, incomplete real-index/process-group/ambient-environment oracles, and terminal-comment identity/deletion/global-uniqueness checks. The historical Fresh15 candidate addressed only those bounded landing-evidence gaps.

Fresh15 review result is 0/5 PASS and is recorded at ledger blob `b586355ecb3a1f7d153618c934cbe950c57f0c93`, candidate tree `00147649207f816f161041afeceb205e44c0ab58`. Its common blockers were an impossible all-fields-at-COMMIT envelope, missing candidate commit parent/tree binding, stale fresh14 projections and the comment-create crash window. Additional bounded findings were exact environment keys, finite corrective/comment pagination and rollback evidence. The historical Fresh16 candidate addressed those items.

Fresh16 review result is 1/5 PASS and is recorded at ledger blob `94e3549b162afc779d16db1ee77fc25b7b069160`, candidate tree `1c27ebbc90df668edb9c10e0e2cd93d6fcfe4d15`. Scope/proximity passed. Remaining blockers were executable/transport identity, exact JSON types/canonicalization, durable CI deadline/polling, intent-before-POST stop semantics, rollback lifecycle and overclaimed descendant cleanup. The historical Fresh17 candidate addressed those bounded items.

Fresh17 review result is 1/5 PASS and is recorded at ledger blob `83419165b2ca6bae1f75151cf9e2e40963907c4a`, candidate tree `0b0b05af4aa8910eb5d72e9e1f22dff57bc3f09e`. Scope/proximity passed. Remaining blockers were recursive diff-tree flags, push-before-deadline crash ordering, curl config and initial binary trust, normative downstream order, rollback schema/invariants and all-exit PGID cleanup. The historical Fresh18 candidate addressed those items.

Fresh18 review result is 1/5 PASS and is recorded at ledger blob `3b3435c5b10ab6dff3237d497b94869052ffcd55`, candidate tree `e9bb1849b9ad4363521c947524aafa303f83ff48`. Security/supply-chain passed. Three reviewers independently found that the private landing/comment/rollback machinery again dominated the LOW metadata outcome; one also found the URL residue scan self-failing. Fresh19 removes that machinery and retains ordinary repository/PR/CI evidence only.

Fresh19 review result is 0/5 PASS and is recorded at ledger blob `13c15874af85b144f479bdabfd09372feabeb134`, candidate tree `e1c2726327d09f64189f3993da66b89eff9ea7e5`. All five reviewers found the same two stale Plans clauses that still required a marker comment and overbroad lineage rollback; they found no other blocker. Fresh20 aligns those projections with the ordinary repository evidence authority above.

Fresh20 PLAN review is 5/5 PASS at ledger blob `ebfa45368fefd0f7011d14635a4107a6d7482181`, candidate tree `86bfaec3a82e1c433e09c066539301e6d31b7add`. The first S1 implementation candidate output `WP4157_METADATA_PASS negatives=22 java_exit=nonzero` but failed IMPLEMENTATION_GATE 0/5 at ledger `adf4319bc500662304e1e8cb9f9fd8105daa4c94` because socket inactivity timeout did not enforce the promised wall clock and subprocess observations were not fully bounded. The second candidate output `WP4157_METADATA_PASS negatives=21` but failed 0/5 at ledger `be099281bd9068237c76d73ad3edda66424646c7` due stale Node/Java prose and an aggregate timeout that fixtures could catch. The third candidate separated aggregate/request expiry and passed technical review, but failed 2/5 at ledger `2ae68594f2e2caa83906463569d8414b9fb33392` because two phrases overclaimed Java absence. The fourth candidate fixed those but failed 2/5 at ledger `592d8931676ae5155b8e2c46b3ae452fa99f0e76` because the historical State checkpoint still said local Java was absent. The fifth candidate removed that overclaim but its live no-auth run was unavailable during GitHub rate exhaustion; root's subsequent adversarial inspection found that ambient Python optimized mode could disable `assert` checks. The sixth candidate rejected optimized mode; follow-up inspection found that normal interpreter startup could still import ambient user-site customization. The seventh candidate used isolated interpreter mode; the eighth also removes OpenSSL CA override and TLS key-log environment variables before creating an explicit default TLS context. Its candidate tree `27e834f188f326de50e1653d79887f2a6214545e` produced unauthenticated `WP4157_METADATA_PASS negatives=20` under hostile ambient variables and passed IMPLEMENTATION_GATE 5/5 at ledger `480dc3148b36bb4c22692be5ebc0290aba7173b4`. The first BUG_REFACTOR review failed 1/5 at ledger `c695d0e8c9f041c403dd58ccaec07c58267abd1c` because one State live-integration line still pointed back to IMPLEMENTATION; no reviewer found another in-scope bug or required refactor. After that line was corrected, fresh BUG_REFACTOR review passed 5/5 at ledger `6d769bcb13050770680e35b04347fd12acbf2cdc`.

#### S1 terminal landing record for S2

S1 commit `7180b9cb63370f4d93ca4be6f3e0f8b22d74eeeb` has tree `8f56b8c0aa2172daddfcd8ebef007e2c33eadbe6` and parent `1e63e85257c6ea2def16934b55f564394c685e9e`. PLAN ledger `ebfa45368fefd0f7011d14635a4107a6d7482181`, IMPLEMENTATION `480dc3148b36bb4c22692be5ebc0290aba7173b4`, BUG_REFACTOR `6d769bcb13050770680e35b04347fd12acbf2cdc`, VALIDATION `9753bd715c995a685ea961d18aaad66975df7622`, COMMIT `9f12eadf2a42525050b2bea88af4d5b3fe1ad682`, and PUSH `a70527ab87d4c964940daf65c821c5d18e1e9b26` each passed 5/5. Validation bundle `adfba57961a2d8e6721be0e2bb353066e67dd68f` records the hostile-ambient unauthenticated `WP4157_METADATA_PASS negatives=20`, exact4/hash/residue/secret-scan checks, full workspace typecheck/build and 1,829 passing tests with 14 disclosed local PostgreSQL skips, plus the local repository gates explicitly listed in that bundle. The exact-head CI described below separately passed OpenAPI drift and calculation purity in addition to those recorded local checks.

The ordinary push produced exact-head PR workflow run `29641365969`: workflow id `309812329`, `.github/workflows/ci.yml`, `pull_request`, run attempt 1, `completed/success`, with every job step successful. Local, origin branch and PR head equal the S1 commit; origin/main remains `27d61445350e40f2741583a07eb20936d9916992`, deployments are zero and the tracked tree is clean. The single Node action-runtime deprecation warning is a nonblocking maintenance note. Aggregate 120-second expiry is established by reviewed control flow rather than a shortened direct fixture. Unsigned provenance, compatibility, FHIR conformance, legal/license, patient safety, architecture/product and WP-0053a/b human gates remain nonclaims/unwaived. Future rollback still requires an explicit request and fresh dependency mapping before reverting only S2 then S1; historical commits remain excluded. This record does not claim S2's own future commit, push, CI or parity.

S2 PLAN_GATE passed 5/5 at ledger `c449766f7c3a5716c1ecc421a056ee2c817f67fe`, candidate tree `beb7aaed1898f18b32f543ee594b7f2c763b3197`. Reviewers found the landing-only exact4 scope, S1 facts, validation/CI plan, nonclaims, rollback and no-self-reference boundary complete. Their only nonblocking wording suggestion, clarifying that `14` is a count of skipped PostgreSQL integration tests rather than a PostgreSQL version, is incorporated in the current projections. The first S2 IMPLEMENTATION review failed 4/5 at ledger `4e8fa90e0b26a95a782d7f6ea44788eafd7523e3` because one State live-integration sentence did not distinguish the clean S1 checkpoint from the current exact4-dirty S2 worktree. After that distinction was made explicit, fresh IMPLEMENTATION review passed 5/5 at ledger `deb36643326ef2def418757c004d2c7f6a2464ea`. The first BUG_REFACTOR review failed 4/5 at ledger `492967c9034d7d40c909e04dd149c1b755fd482e` on a claimed S1 PUSH slot-4 misbinding. Direct object inspection showed that ledger `a70527ab…` correctly points to PUSH artifact `5b9c862a…`; five fresh contexts each re-opened all PUSH artifacts and passed BUG_REFACTOR 5/5 at ledger `07ee101f3db6080e98440225bbd3c9e3d5bfbe0d`. The first VALIDATION review failed 4/5 at ledger `52dd0bf321add9a91dd29d319bceb87a1a68b2f2` because its bundle omitted OpenAPI drift and calculation-purity checks. After both checks passed and a replacement bundle was issued, fresh review failed 2/5 at ledger `efa30a62ca07a67101b7f14842b0915984a178d7` because the S1 bundle description still overclaimed all repository gates; the current wording distinguishes the local bundle from exact-head CI evidence.

WP-4157 S2 then passed corrected VALIDATION_GATE 5/5 at ledger `590e498b64ae46ebda39060feae98c1f9188024f`, COMMIT_GATE 5/5 at `9dd2dcd8a4a5ce103f0188814462352745d05200`, and PUSH_GATE 5/5 at `90af6d4fcb5467f329ff730b91860394a3149d81`. Terminal S2 commit `9a3e715f49532ea2b57bda8ec715b0f6c06435c0` has tree `e16d91a26a0f346a0537a2588364283b05b5b19d` and parent S1 `7180b9cb63370f4d93ca4be6f3e0f8b22d74eeeb`. PR #1 exact-head run `29643783105`, workflow `309812329`, attempt1 completed successfully with every step successful. Local/origin/PR heads are equal, origin/main remains `27d61445350e40f2741583a07eb20936d9916992`, deployments are zero and tracked/index state was clean. The Node20 action-runtime deprecation warning remains a nonblocking maintenance item. These terminal facts do not waive unsigned provenance, FHIR/conformance, legal/license, patient-safety, architecture/product or WP-0053a/b human gates.

#### WP-4158 closure plan authority

WP-4158 closes only a version-bound evidence gap. S0 records WP-4157's already-proven terminal state and this plan; S1 independently reproduces immutable source/notice/artifact identity, deterministic resource-rights taxonomy with a membership-manifest digest, and WP-4159's candidate-direct 50-row/25-canonical subset; S2 records S1's landing facts. These are separate exact4 commits and rollback boundaries. No slice changes package/lock/runtime/code/API/DB/UI/SSOT/CI/toolchain, persistently retains or stores an artifact in the repository, extracts an artifact, selects a Profile or terminology, or grants legal/FHIR/clinical/claim approval. S1 alone may download pinned bytes ephemerally to a repository-external private temp for no-extraction inspection and must clean them on normal/error/catchable INT/TERM/HUP; SIGKILL/kernel-loss cleanup is not claimed.

Later retries demonstrated that a tracked generic gate runner and pseudo-DSL were unnecessary S0 machinery. The final PLAN remediation added distinct per-probe cleanup terminal oracles. Fresh PLAN reviewers `wp4158_plan_oracle_r1..r5` then passed candidate tree `dfe2742acceec22b95c37459c2164735ecbb8cd6` 5/5: exact4, real-index cleanliness, direct validation, proximity/slices, the then-current 94+2+5 test matrix, six live lines, isolated cleanup, AC9, nonclaims and human gates were independently confirmed. At that checkpoint S0 became READY; the later fresh implementation generation separately passed the updated projection tree. Subsequent BUG_REFACTOR review found that the five cleanup probes exercised only the final-path phase, so the current authority expands cleanup to pending/final x normal/error/INT/TERM/HUP = ten isolated probes without changing the historical PLAN verdict.

The first S0 IMPLEMENTATION review generation (`wp4158_impl_r1..r3`) was 0/3 PASS on two stale current projections only: State still said PLAN retry and the WP-4157 handoff still requested PLAN review. Both were synchronized before the replacement generation. Reviewers otherwise confirmed tree `0dbd18fa30d13d1cf2e2fdc57927adaae637c8d9` was exact4, direct gates passed, no future verifier/evidence was present and no nonclaim/human gate changed.

Fresh IMPLEMENTATION reviewers `wp4158_impl2_r1..r5` passed tree `d9cef2a9b2f2be1b78984dbbd283cf5961abfc03` 5/5. They independently reproduced exact4/index/direct gates and confirmed the actual S0 diff matches the approved plan: WP-4157 terminal projection plus WP-4158 closure authority only, with no verifier, future live/landing evidence, artifact, runtime/package/SSOT change, PHI, publication or human-gate waiver. At that implementation checkpoint, BUG_REFACTOR review was the required next action; it is now superseded by the recorded fifth-generation 5/5 result below.

The first BUG_REFACTOR generation (`wp4158_bug_r1..r3`) was 2/3 PASS. It found two stale historical/current phrases and a cleanup false-green where empty-directory removal did not prove recursive cleanup after bytes existed. Historical phrases are now time-bounded. The second generation (`wp4158_bug2_r1..r3`) was 0/3 PASS at tree `de640c446dc7eac1ad190b99f03170f4a1b6cc38`: all signals occurred after pending-to-final rename, two old checkpoint projections still read as current, and an all-exits cleanup phrase contradicted the explicit SIGKILL/kernel-loss nonclaim. Current authority therefore requires ten phase-specific probes, inherited-pipe readiness, a nested non-empty synthetic partial-download sentinel before readiness, recursive cleanup of both exact lifecycle paths, sibling-canary preservation, and claims only normal/error/catchable INT/TERM/HUP cleanup. At that second-generation checkpoint, fresh exactly-five BUG_REFACTOR review was required; that action is historical and superseded below.

The third BUG_REFACTOR generation (`wp4158_bug3_r1..r3`) was 0/3 PASS at tree `952cb8932a11cb55c2b121da1b1674da20226d81`. It found the stale five-probe projection in this authority, the unspecified parent readiness write-FD close, and two State checkpoint status claims lacking an explicit time boundary. That checkpoint's candidate synchronized exact10, closed the parent write copy immediately after spawn, and time-bounded those historical claims; its then-required fresh review is historical and superseded below.

The fourth BUG_REFACTOR generation (`wp4158_bug4_r1..r3`) was 1/3 PASS at tree `75be9c7066ad7c9a02f64d2eb0d937199bb91ea0`. It found that USR1/USR2 simulated outcomes did not prove actual normal-return/error cleanup, that one query-fragment negative contradicted the single-boundary rule, and that two older EVIDENCE subsections still lacked checkpoint-time scope. That checkpoint's candidate used actual return/exception paths, split query and fragment for 95 negatives, and time-bounded both subsections; its then-required fresh review is historical and superseded below.

The fifth BUG_REFACTOR generation passed candidate tree `93be844836a59d295a5f0f7e7fb03a8b9a844e09` 5/5 with fresh reviewers `wp4158_bug5_r1,r2,r3c,r4,r5`. The unresponsive `r3` and interrupted replacement `r3b` were excluded from the count. Reviewers independently confirmed exact4/index/direct gates, 95 unique single-boundary negatives, ten pending/final cleanup probes with actual return/exception and signal-only INT/TERM/HUP, pipe/PGID/deadline/residue oracles, historical status boundaries, scope, nonclaims and human gates. S0 proceeds to VALIDATION.

S0 local validation passed frozen install, workspace typecheck, 1,829 tests with 14 expected local PostgreSQL integration skips because `TEST_DATABASE_URL` is absent, the script regression harness, workspace build, OpenAPI drift, dependency audit high=0/critical=0, SBOM 231, boundaries, calculation purity, SSOT index 173 and diff check. Next.js 15.5.20 generated 12/12 static pages. The lint command exited zero but no workspace package exposed a lint task, so it provides no lint coverage. The live secret scan was not run in order to preserve the explicit unread boundary for user-owned `.codegraph`; the tracked candidate overlay direct scan is the authoritative secret gate. These local results do not prove PostgreSQL zero-skip, browser/runtime/production behavior or any legal/FHIR/clinical/claim decision. The fresh VALIDATION review required at this checkpoint completed in the fifth generation 5/5 below.

The first VALIDATION generation (`wp4158_val_r1..r3`) passed candidate tree `08e3d38ccf627e0903b71f836e4dfb0df3fb6c96` 2/3. All reviewers accepted the validation facts, counts, disclosed skips/no-lint/live-secret boundaries and nonclaims. One reviewer blocked only stale next-action projections in Plans, State and two historical BUG lines in ops/refactor/STATE. That candidate made VALIDATION review the sole next action and marked those BUG retry lines as historical; its then-required fresh review is superseded by fifth-generation 5/5.

The second VALIDATION generation (`wp4158_val2_r1..r5`) passed candidate tree `ef554473070fe5012388e9175e2d8b2a6a9281a2` 4/5. All reviewers accepted the validation facts and boundaries; one reviewer blocked only the four unqualified historical BUG next-action clauses above. They were checkpoint-qualified; the then-required fresh VALIDATION review is superseded by fifth-generation 5/5.

The third VALIDATION generation (`wp4158_val3_r1..r3`) passed candidate tree `716bbfab2ba83a67f45be34a7d69053c4078d1c1` 2/3. All reviewers accepted the validation facts and boundaries; one reviewer blocked only four unqualified historical implementation/BUG next-action clauses in Plans. They were checkpoint-qualified; the then-required fresh VALIDATION review is superseded by fifth-generation 5/5.

The fourth VALIDATION generation (`wp4158_val4_r1..r3`) passed candidate tree `d6cd4cfe38b86e32fdbf3395c2f6f6ee5c7fb810` 1/3. All reviewers accepted the validation facts and boundaries; reviewers blocked only three historical WP-4158 next-action clauses in State and one old resume next-action in ops/refactor/STATE. They were checkpoint-qualified; the then-required fresh VALIDATION review is superseded by fifth-generation 5/5.

The fifth VALIDATION generation (`wp4158_val5_r1..r5`) passed candidate tree `bec05c8cdb8292e55f66747f45a7b9c7111917de` 5/5. Reviewers independently confirmed the exact4/tree/index binding, full validation transcript and counts, disclosed lint/live-secret/DB/browser/runtime gaps, chronological/current projection uniqueness, scope, nonclaims and human gates. S0 proceeds to COMMIT review.

The first COMMIT review generation (`wp4158_commit_r1,r2`) stopped at 0/2 PASS on candidate tree `74142ce8b71c8e3940d2d1ff951f46854af70648`; no further slots were started. Both reviewers accepted candidate integrity and validation, but blocked stale VALIDATION pending clauses plus a circular packet that required COMMIT review before staging while AC9C itself required staged exact4, and required an unknowable pre-commit `EXPECTED_COMMIT`. The current authority makes `EXPECTED_COMMIT` AC9L/P-only and orders root exact-stage, AC9C fixation, fresh-five review, then commit.

The second COMMIT review generation (`wp4158_commit2_r1,r2`) stopped at 1/2 PASS on staged tree `f362d2676c5300813d119e16820e7f8911cba8cf`; no further slots were started. AC9C integrity passed both reviews. One reviewer found only the EVIDENCE summary below still required a pre-commit commit/parent/subject. It was separated into AC9C base/tree/message and post-commit AC9L/P commit/parent/subject; the restage required at that checkpoint is historical.

The third COMMIT review generation (`wp4158_commit3_r1,r2`) stopped at 1/2 PASS on staged tree `dc3b1142b3f53ac04a1795277a7349dc35a03531`; no further slots were started. AC9C integrity passed both reviews. One reviewer found only that projections repeated an already-completed stage/restage action. That checkpoint action is superseded by the terminal S0 fifth-generation COMMIT/PUSH result.

The fourth COMMIT review generation used staged tree `70e8edb7e895c803cd568534d498e8067135efd9`: reviewers 1, 2b and 3 passed, reviewer 4 failed, and reviewer 5 was not started. The original unresponsive reviewer 2 was interrupted and is not counted. Reviewer 4 found that the general oracle still read as requiring `EXPECTED_COMMIT` for AC9C, conflicting with the following pre-commit boundary. The authority explicitly separates AC9C base/tree/message inputs from the post-commit AC9L/P commit input. That checkpoint action is superseded by the terminal S0 fifth-generation COMMIT/PUSH result.

#### WP-4158 three-slice validation authority

S0 is a plan/projection slice and does not carry or execute a future verifier. Root directly records the exact base, disposable-index candidate tree, exact4 path set, real-index cleanliness, `git diff --check`, SSOT-index, script-harness and tracked-overlay secret-scan results. Reviewers reproduce those facts with their own read-only commands. No tracked generic shell runner, alternate-index handoff protocol or persistent validation artifact is part of S0.

S1 alone adds one inline Python verifier between globally unique markers. Before any live request, its extracted source must pass syntax checking and an offline self-test that invokes the same parsing, classification, manifest, archive-safety, transport-policy and cleanup functions used by live mode. Plans defines the exact named negative/positive matrix and six live output lines. The implementation gate reviews the actual source and fixtures; the validation gate executes them from the reviewed candidate tree. S2 changes only the landing projection and must extract a byte-identical verifier, repeat self-test/live validation and preserve every S1 provenance/nonclaim field.

All candidate-tree checks use a repository-external disposable index created and removed in one root-owned process. The real index is checked independently with ambient `GIT_INDEX_FILE` absent. The tracked-overlay secret scan materializes the reviewed candidate tree in a repository-external private temporary directory, runs `node scripts/check-secrets.mjs` directly with lifecycle variables removed, and proves residue zero. These are direct gate transcripts, not a reusable tracked command artifact. Catchable interruption cleanup is verified by the owning process; SIGKILL/kernel-loss cleanup is not claimed.

S1 acceptance is fail-closed. Source pins are repo `https://github.com/jami-fhir-jp-wg/jp-core-v1x`, tag-ref API ending `/git/ref/tags/1.2.0`, annotated tag `8b9780cbdb9086e6f41b35aa8935038bd884243e`, peeled commit `c06f02059c2a8aed6a33d624c9eee6fe0669ef06`, root tree `1b2b378b78b6741e59b326d5232de82ff02caedc`, recursive `truncated=false`, 662 entries and zero nested case-insensitive `LICENSE|LICENCE|NOTICE|COPYING` basename. A lightweight response is a type drift for this annotated baseline. Notice `https://jpfhir.jp/fhir/core/1.2.0/guide-precautions.html` is 12,931 bytes, SHA-256 `5c1830cf7733493f96042ceb8ec10cfc28ad66626c25849a510a24cb51d6ffbf`, and must retain the version/package, terminology-license, implementer-resolution, SHALL and no-guarantee anchors listed in Plans. The terminology artifact pins precede parsing: exact URL, SHA-256, size, 206 entries and singleton package+IG identity. It must reproduce 203=106 CodeSystem+97 ValueSet.

All manifests use exact UTF-8/NUL fields, reject embedded NUL/LF, bytewise sort, LF separator and final LF. Plans enumerates six provenance manifests: rights identity set, rights classification set, profile set, raw direct-occurrence multiset, unique direct-row set, and canonical set; the 14-field handoff is a separate set using the same framing. Rights identity/classification digests are `4aa81de1...` / `2de1ce46...`; category tokens and classifier rules remain exactly as specified there.

WP-4159 cross-check is **candidate direct binding resolution**, never actual reachability. The pinned filter yields 32 profiles `104d1610...`; raw 51-occurrence multiset `966164ba...`; one duplicate JP_Practitioner row with multiplicity2 and single-record framed digest `c2364f4bca5646ef17dc8e8ad634bacfdf6bfadd3ca748e5966a4de68be7b2da`; unique50 `c04fe684...`; canonical25 `464b0a94...`. The known duplicate is accepted; any multiplicity/key/member drift or duplicate terminology resource fails. No selected/transitive/workflow/semantic/legal claim follows.

The verifier's exact endpoints are the four pinned GitHub APIs plus notice/core/terminology URLs; allowed origins are `https://api.github.com:443` and `https://jpfhir.jp:443`, and the redirect allowlist is empty. It uses an explicit empty proxy handler, no auth/cookie/custom header or ambient proxy/netrc/SSL override, 15-second per-request and 120-second aggregate wall limits, 16MiB aggregate download, 4MiB API/notice/core and 8MiB terminology body caps, and required Content-Length with exact notice/artifact sizes. Repository-external temp is mode0700/files0600 and removed on normal/error/catchable INT/TERM/HUP; SIGKILL/kernel loss is excluded. Core archive caps are 512 entries/32MiB regular/8MiB largest; terminology 256/96MiB/32MiB. It rejects absolute/traversal/backslash/NUL paths, duplicate/casefold collision, link/device/nonregular members and repository residue.

S1 materializes one tracked inline Python verifier in the exact EVIDENCE host between exact-line markers. Its offline matrix has two named positives and 95 globally unique, single-boundary negatives with an exact case-to-failure-family mapping, including separate unexpected-query and unexpected-fragment cases plus resource/profile root-object and field shape. Ten deadline-bounded, phase-specific subprocess probes exercise pending and final lifecycle states separately. Anonymous readiness/release pipes let the parent verify the ready phase before closing release for actual normal return/operation exception; only INT/TERM/HUP probes are signal-driven while held ready. Each process closes its unused and owned FD copies as fixed in Plans. Plans also fixes the no-bytecode extractor/syntax check, self-test token and all six ordered live lines; implementation reviewers inspect the actual source rather than relying on a generic DSL.

The legal handoff is deterministic but makes no decision: the 25 candidate-direct canonicals crossed with eight exact use lanes yield 200 unique rows. The 14-field schema, all `UNRESOLVED` defaults, null human authority/date, exact row grammar and digest `1999669b561192d12e3567a096588a7a69dbb8a6c84e85ad3701acb21e2ae02d` are normative in Plans. Live verification emits `WP4158_HANDOFF_PASS`; self-test rejects missing/duplicate/lane/field drift and any premature decision. Human legal authority is still required to replace an unresolved row.

Plans owns the slice matrix. Each slice has its own pre-implementation `PLAN_READY` artifact; S1 PLAN inspects landed S0 authority and does not execute the future verifier, while S2 PLAN binds landed S1 verifier SHA and landing-only scope. Direct command transcripts preserve exact candidate/path/index, repository-gate and tracked-overlay-secret results. S1/S2 add the exact self-test token and six live lines; AC9C/L/P separates commit, local prepush and terminal remote facts. No gate requires future evidence. Five fresh reviewers per material gate and all human gates remain.

AC9 is executable without relying on an earlier WP. The pre-commit AC9C packet supplies 40-hex base/tree plus exact message and binds base, exact4, staged tree, message and clean unstaged state; it does not supply or infer a future commit. After commit creation, AC9L/P add the actual 40-hex commit and bind its parent, tree, subject and clean state. PUSH classifies the unique remote ref before and after its one allowed ordinary non-force mutation. Remote=base permits one push; ambiguous/nonzero output is followed only by read-only classification. Remote still at base permits a fresh-five retry; remote at commit enters an already-pushed recovery with fresh five, AC9L and AC9P but no second push; any other ref stops. A post-push material content finding or attempt-1 CI failure requires a new reviewed repair commit based on the pushed commit and all six gates, never reuse or rewrite. Context/API artifact loss alone uses the no-second-push recovery. AC9P then applies the bounded polling, parity, main, deployments, exact workflow/run/jobs/steps and clean-state oracle in Plans. Each generation has exactly five reviewers; it never grows to ten.

S0 landed as commit `68470672bd0f5efff6cc06f42cfb374dc59dc0f7`, parent `9a3e715f49532ea2b57bda8ec715b0f6c06435c0`, tree `f955580a95c1866087ec456a11693488a16d0ae2`. The one ordinary push reached local/origin/PR parity while origin/main remained `27d61445350e40f2741583a07eb20936d9916992` and deployments remained zero. Exact-head workflow `309812329` run `29658334162`, attempt 1, completed successfully with its one job and all 22 steps successful. The same five PUSH_GATE contexts accepted AC9L and AC9P 5/5. These terminal facts authorize S1 evidence work only; they do not decide any terminology right or human gate.

<!-- WP4158_VERIFIER_BEGIN -->
```python
from __future__ import annotations

import argparse
import ast
import copy
import ctypes
import errno
import hashlib
import io
import json
import os
import pathlib
import select
import shutil
import signal
import ssl
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request


class VerificationError(Exception):
    pass


class ProbeSignal(BaseException):
    def __init__(self, signum):
        self.signum = signum


MISSING = object()


TAG = "8b9780cbdb9086e6f41b35aa8935038bd884243e"
COMMIT = "c06f02059c2a8aed6a33d624c9eee6fe0669ef06"
TREE = "1b2b378b78b6741e59b326d5232de82ff02caedc"
NOTICE_SHA = "5c1830cf7733493f96042ceb8ec10cfc28ad66626c25849a510a24cb51d6ffbf"
CORE_SHA = "6094c8b9ebd975cb738c66cc999774c06a0aacf4480c068a8465e597117e52a3"
TERM_SHA = "cfeb76457774d5a4bf1eb907cb60d083b0dedf04cb92405effa6b4aeaf68d21f"
IDENTITY_SHA = "4aa81de1eed952fc129702b7eb372c2202296217a5815b9ca749b9e197c1d9e9"
CLASS_SHA = "2de1ce4600213c7f5f8d41d87735980243dcdf10e8d1177a45b2c0776736aaab"
PROFILE_SHA = "104d16109bcc858cd71aadeb03be9b59c649860004ea4fa2aaf9c0ae86415413"
RAW_SHA = "966164ba9c5fd1b40fd066941466170e7426e9170e1424618dae4a0685e3624a"
UNIQUE_SHA = "c04fe6844af7b0cb8c2a7ba017a482cc0c6a96aacdfa9df2e086fcf974fdb858"
CANON_SHA = "464b0a941bbf7940bc41664f7f87ee9cf0d1e195e3dbf841f6013fca7fb96395"
DUP_SHA = "c2364f4bca5646ef17dc8e8ad634bacfdf6bfadd3ca748e5966a4de68be7b2da"
HANDOFF_SHA = "1999669b561192d12e3567a096588a7a69dbb8a6c84e85ad3701acb21e2ae02d"
REF_URL = "https://api.github.com/repos/jami-fhir-jp-wg/jp-core-v1x/git/ref/tags/1.2.0"
TAG_URL = f"https://api.github.com/repos/jami-fhir-jp-wg/jp-core-v1x/git/tags/{TAG}"
COMMIT_URL = f"https://api.github.com/repos/jami-fhir-jp-wg/jp-core-v1x/git/commits/{COMMIT}"
TREE_URL = f"https://api.github.com/repos/jami-fhir-jp-wg/jp-core-v1x/git/trees/{TREE}?recursive=1"
NOTICE_URL = "https://jpfhir.jp/fhir/core/1.2.0/guide-precautions.html"
CORE_URL = "https://jpfhir.jp/fhir/core/1.2.0/package.tgz"
TERM_URL = "https://jpfhir.jp/fhir/core/terminology/jpfhir-terminology.r4-1.4.0.tgz"
ENDPOINTS = {REF_URL, TAG_URL, COMMIT_URL, TREE_URL, NOTICE_URL, CORE_URL, TERM_URL}
TYPES = {"Patient", "Coverage", "Medication", "Practitioner", "PractitionerRole", "Organization", "Location", "AllergyIntolerance", "Consent", "DocumentReference", "MedicationRequest", "MedicationDispense", "Condition", "Observation", "Provenance", "AuditEvent", "DetectedIssue", "Task", "Communication"}
LANES = ("private-ci-validation-cache", "runtime-terminology-service", "ui-display", "export", "public-ig-test-bundle", "partner-sandbox", "sdk", "bulk-data")
HANDOFF_FIELDS = ("canonical", "lane", "terminologyVersion", "rightsholder", "authoritativeTermsUrl", "evidenceDate", "permittedUse", "attributionObligation", "redistributionObligation", "derivativeObligation", "updateObligation", "decision", "humanAuthority", "decisionDate")
GIT_AMBIENT_KEYS = (
    "GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_CEILING_DIRECTORIES", "GIT_DISCOVERY_ACROSS_FILESYSTEM",
    "GIT_EXEC_PATH", "GIT_PREFIX", "GIT_CONFIG", "GIT_CONFIG_COUNT",
    "GIT_CONFIG_PARAMETERS", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM",
)


def require(condition: bool, token: str) -> None:
    if not condition:
        raise VerificationError(token)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def framed(rows, *, multiset=False) -> bytes:
    encoded = []
    for row in rows:
        fields = row if isinstance(row, (tuple, list)) else (row,)
        values = []
        for field in fields:
            require(isinstance(field, str), "MANIFEST_FIELD_INVALID")
            require("\x00" not in field and "\n" not in field, "MANIFEST_FIELD_INVALID")
            values.append(field.encode("utf-8"))
        encoded.append(b"\0".join(values))
    if not multiset:
        require(len(encoded) == len(set(encoded)), "MANIFEST_DUPLICATE")
    encoded.sort()
    return b"" if not encoded else b"\n".join(encoded) + b"\n"


def pairs_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "JSON_DUPLICATE_KEY")
        result[key] = value
    return result


def parse_json(data: bytes):
    try:
        return json.loads(data.decode("utf-8-sig"), object_pairs_hook=pairs_object)
    except VerificationError:
        raise
    except Exception as exc:
        raise VerificationError("JSON_INVALID") from exc


def endpoint(url: str) -> None:
    parsed = urllib.parse.urlsplit(url)
    require(parsed.scheme == "https", "TRANSPORT_POLICY")
    require(parsed.username is None and parsed.password is None, "TRANSPORT_POLICY")
    require(parsed.hostname in {"api.github.com", "jpfhir.jp"}, "TRANSPORT_POLICY")
    require((parsed.port or 443) == 443, "TRANSPORT_POLICY")
    require(url in ENDPOINTS, "TRANSPORT_POLICY")


def validate_effective_url(requested, effective):
    require(requested == effective, "TRANSPORT_POLICY")


def validate_deadlines(now, request_deadline, aggregate_deadline):
    require(now < request_deadline and now < aggregate_deadline, "TRANSPORT_LIMIT")


def path_identity_chain(path, token):
    try:
        current = pathlib.Path(path).resolve(strict=True)
        chain = []
        while True:
            info = current.stat()
            current_identity = (info.st_dev, info.st_ino)
            chain.append(current_identity)
            parent = current.parent
            parent_info = parent.stat()
            if (parent_info.st_dev, parent_info.st_ino) == current_identity:
                return tuple(chain)
            current = parent
    except (OSError, RuntimeError) as exc:
        raise VerificationError(token) from exc


def paths_overlap(first, second, token):
    first_chain = path_identity_chain(first, token)
    second_chain = path_identity_chain(second, token)
    return first_chain[0] in second_chain or second_chain[0] in first_chain


def validate_temp_location(root, protected_paths, dir_mode, file_mode=0o600):
    for protected in protected_paths:
        require(not paths_overlap(root, protected, "TRANSPORT_POLICY"), "TRANSPORT_POLICY")
    require(dir_mode == 0o700 and file_mode == 0o600, "TRANSPORT_POLICY")


def validate_ambient(environment) -> None:
    forbidden = ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "NETRC", "SSL_CERT_FILE", "SSL_CERT_DIR", "SSLKEYLOGFILE", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE", "AUTHORIZATION", "COOKIE")
    require(not any(environment.get(key) for key in forbidden), "TRANSPORT_POLICY")
    require(not any(key in environment for key in GIT_AMBIENT_KEYS), "TRANSPORT_POLICY")
    require(not any(key.startswith("GIT_CONFIG_") for key in environment), "TRANSPORT_POLICY")


def trusted_git_executable():
    try:
        discovered = shutil.which("git", path=os.defpath)
        require(discovered is not None, "TRANSPORT_POLICY")
        executable = pathlib.Path(discovered)
        require(executable.is_absolute(), "TRANSPORT_POLICY")
        executable = executable.resolve(strict=True)
        info = executable.stat()
        require(stat.S_ISREG(info.st_mode) and os.access(executable, os.X_OK), "TRANSPORT_POLICY")
        return executable
    except VerificationError:
        raise
    except (OSError, RuntimeError) as exc:
        raise VerificationError("TRANSPORT_POLICY") from exc


def bounded_git_roots(cwd, deadline):
    cwd = pathlib.Path(cwd).resolve(strict=True)
    executable = trusted_git_executable()
    remaining = deadline - time.monotonic()
    require(remaining > 0, "TRANSPORT_LIMIT")
    environment = {
        "LC_ALL": "C",
        "LANG": "C",
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_TERMINAL_PROMPT": "0",
    }
    timeout = min(15, remaining)
    try:
        result = subprocess.run(
            [str(executable), "rev-parse", "--show-toplevel", "--git-dir", "--git-common-dir"],
            cwd=str(cwd),
            env=environment,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
            check=False,
            close_fds=True,
        )
    except subprocess.TimeoutExpired as exc:
        raise VerificationError("TRANSPORT_LIMIT") from exc
    except OSError as exc:
        raise VerificationError("TRANSPORT_POLICY") from exc
    require(time.monotonic() < deadline, "TRANSPORT_LIMIT")
    require(result.returncode == 0 and result.stderr == b"", "TRANSPORT_POLICY")
    output = result.stdout
    require(output.endswith(b"\n") and b"\r" not in output and b"\x00" not in output, "TRANSPORT_POLICY")
    encoded = output[:-1].split(b"\n")
    require(len(encoded) == 3 and all(encoded), "TRANSPORT_POLICY")
    try:
        return tuple(value.decode("utf-8") for value in encoded)
    except UnicodeDecodeError as exc:
        raise VerificationError("TRANSPORT_POLICY") from exc


def discover_git_roots(owner_root, cwd, deadline):
    owner_root = pathlib.Path(owner_root).resolve(strict=True)
    cwd = pathlib.Path(cwd).resolve(strict=True)
    mode = stat.S_IMODE(owner_root.stat().st_mode)
    validate_temp_location(owner_root, (cwd,), mode)
    worktree_raw, gitdir_raw, common_raw = bounded_git_roots(cwd, deadline)
    worktree = pathlib.Path(worktree_raw).resolve(strict=True)
    gitdir_path = pathlib.Path(gitdir_raw)
    common_path = pathlib.Path(common_raw)
    gitdir = (cwd / gitdir_path).resolve(strict=True) if not gitdir_path.is_absolute() else gitdir_path.resolve(strict=True)
    common = (cwd / common_path).resolve(strict=True) if not common_path.is_absolute() else common_path.resolve(strict=True)
    validate_temp_location(owner_root, (cwd, worktree, gitdir, common), mode)
    return worktree, gitdir, common


class SignalState:
    def __init__(self):
        self.cleanup_active = False
        self.deferred_signal = None
        self.deferred_timeout = False

    def record(self, signum):
        if signum == signal.SIGALRM:
            self.deferred_timeout = True
        else:
            self.deferred_signal = self.deferred_signal or signum


def run_signal_transition(signals, state, operation, *, deadline=None, before_deactivate=None, restore=None):
    previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, signals)
    result = None
    failure = None
    try:
        result = operation()
    except BaseException:
        failure = sys.exc_info()
    try:
        pending = signal.sigpending() & set(signals)
        for signum in pending:
            signal.sigwait({signum})
            state.record(signum)
    except BaseException:
        if failure is None: failure = sys.exc_info()
        else: failure[1].add_note("secondary pending-signal drain failure")
    try:
        signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
    except BaseException:
        if failure is None: failure = sys.exc_info()
        else: failure[1].add_note("secondary signal-mask restoration failure")
    if restore is not None:
        try:
            restore()
        except BaseException:
            if failure is None: failure = sys.exc_info()
            else: failure[1].add_note("secondary signal-state restoration failure")
    state.cleanup_active = False
    if failure is None:
        try:
            if state.deferred_timeout or (deadline is not None and time.monotonic() >= deadline):
                raise VerificationError("TRANSPORT_LIMIT")
            if state.deferred_signal is not None:
                raise InterruptedError(state.deferred_signal)
            if before_deactivate is not None:
                before_deactivate()
        except BaseException:
            failure = sys.exc_info()
    if failure is not None:
        raise failure[1].with_traceback(failure[2])
    return result


def validate_response(declared, data, limit, exact_size, aggregate_before=0):
    require(isinstance(declared, str) and declared.isascii() and declared.isdigit(), "TRANSPORT_LIMIT")
    length = int(declared)
    require(length <= limit and len(data) == length and len(data) <= limit, "TRANSPORT_LIMIT")
    if exact_size is not None: require(length == exact_size, "TRANSPORT_LIMIT")
    require(aggregate_before + len(data) <= 16 * 1024 * 1024, "TRANSPORT_LIMIT")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise VerificationError("TRANSPORT_POLICY")


class Transport:
    def __init__(self, alarm_handler=None):
        self.started = time.monotonic()
        self.deadline = self.started + 120
        self.total = 0
        self.alarm_handler = alarm_handler or self._alarm
        self.active = False
        self.old_alarm_handler = None
        self.old_alarm_timer = None
        self.opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({}), NoRedirect(),
            urllib.request.HTTPSHandler(context=ssl.create_default_context()),
        )

    def start(self):
        require(not self.active, "TRANSPORT_POLICY")
        previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, set())
        try: signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGALRM})
        except BaseException:
            failure = sys.exc_info()
            try: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
            except BaseException: failure[1].add_note("secondary initial alarm-mask restoration failure")
            raise failure[1].with_traceback(failure[2])
        try:
            self.old_alarm_handler = signal.getsignal(signal.SIGALRM)
            self.old_alarm_timer = signal.getitimer(signal.ITIMER_REAL)
            signal.signal(signal.SIGALRM, self.alarm_handler)
            signal.setitimer(signal.ITIMER_REAL, 120)
            self.active = True
            signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
        except BaseException:
            failure = sys.exc_info()
            try: signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGALRM})
            except BaseException: failure[1].add_note("secondary alarm-block rollback failure")
            if self.old_alarm_timer is not None:
                try: signal.setitimer(signal.ITIMER_REAL, *self.old_alarm_timer)
                except BaseException: failure[1].add_note("secondary alarm-timer rollback failure")
            if self.old_alarm_handler is not None:
                try: signal.signal(signal.SIGALRM, self.old_alarm_handler)
                except BaseException: failure[1].add_note("secondary alarm-handler rollback failure")
            self.active = False
            try: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
            except BaseException: failure[1].add_note("secondary alarm-mask rollback failure")
            raise failure[1].with_traceback(failure[2])

    def _alarm(self, _signum, _frame):
        raise VerificationError("TRANSPORT_LIMIT")

    def close(self):
        if not self.active: return
        previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, set())
        failure = None
        try: signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGALRM})
        except BaseException: failure = sys.exc_info()
        try:
            try: signal.setitimer(signal.ITIMER_REAL, *self.old_alarm_timer)
            except BaseException:
                if failure is None: failure = sys.exc_info()
                else: failure[1].add_note("secondary alarm-timer restoration failure")
            try: signal.signal(signal.SIGALRM, self.old_alarm_handler)
            except BaseException:
                if failure is None: failure = sys.exc_info()
                else: failure[1].add_note("secondary alarm-handler restoration failure")
            self.active = False
        finally:
            try: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
            except BaseException:
                if failure is None: failure = sys.exc_info()
                else: failure[1].add_note("secondary alarm-mask restoration failure")
        if failure is not None: raise failure[1].with_traceback(failure[2])

    def get(self, url: str, limit: int, exact_size=None) -> bytes:
        require(self.active, "TRANSPORT_POLICY")
        endpoint(url)
        remaining = self.deadline - time.monotonic()
        require(remaining > 0, "TRANSPORT_LIMIT")
        request_deadline = time.monotonic() + min(15, remaining)
        signal.setitimer(signal.ITIMER_REAL, min(15, remaining))
        request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "yrese-wp4158/1"})
        try:
            with self.opener.open(request, timeout=15) as response:
                validate_effective_url(url, response.geturl())
                length = response.headers.get("Content-Length")
                require(length is not None and length.isascii() and length.isdigit(), "TRANSPORT_LIMIT")
                declared = int(length)
                require(declared <= limit, "TRANSPORT_LIMIT")
                if exact_size is not None:
                    require(declared == exact_size, "TRANSPORT_LIMIT")
                chunks, received = [], 0
                while True:
                    validate_deadlines(time.monotonic(), request_deadline, self.deadline)
                    chunk = response.read(min(64 * 1024, limit + 1 - received))
                    if not chunk: break
                    chunks.append(chunk); received += len(chunk)
                    require(received <= limit and self.total + received <= 16 * 1024 * 1024, "TRANSPORT_LIMIT")
                data = b"".join(chunks)
        except VerificationError:
            raise
        except Exception as exc:
            raise VerificationError("TRANSPORT_LIMIT") from exc
        finally:
            remaining = self.deadline - time.monotonic()
            signal.setitimer(signal.ITIMER_REAL, max(0, remaining))
        validate_response(length, data, limit, exact_size, self.total)
        self.total += len(data)
        require(self.total <= 16 * 1024 * 1024 and time.monotonic() - self.started < 120, "TRANSPORT_LIMIT")
        return data


def validate_archive_members(members, expected_count: int, entry_cap: int, total_cap: int, largest_cap: int, allow_package_dir=False):
    require(len(members) == expected_count and len(members) <= entry_cap, "ARCHIVE_UNSAFE")
    seen, folded, total, largest = set(), set(), 0, 0
    for member in members:
        name = member.name
        require(isinstance(name, str) and name and "\x00" not in name and "\\" not in name, "ARCHIVE_UNSAFE")
        path = pathlib.PurePosixPath(name)
        require(not path.is_absolute() and ".." not in path.parts, "ARCHIVE_UNSAFE")
        require(name not in seen and name.casefold() not in folded, "ARCHIVE_UNSAFE")
        seen.add(name); folded.add(name.casefold())
        if member.isfile():
            require(member.size >= 0, "ARCHIVE_UNSAFE")
            total += member.size; largest = max(largest, member.size)
        else:
            require(allow_package_dir and name == "package" and member.isdir(), "ARCHIVE_UNSAFE")
    require(total <= total_cap and largest <= largest_cap, "ARCHIVE_UNSAFE")


def archive(data: bytes, expected_count: int, entry_cap: int, total_cap: int, largest_cap: int, allow_package_dir=False):
    try:
        handle = tarfile.open(fileobj=io.BytesIO(data), mode="r:gz")
    except Exception as exc:
        raise VerificationError("ARTIFACT_MISMATCH") from exc
    members = handle.getmembers()
    validate_archive_members(members, expected_count, entry_cap, total_cap, largest_cap, allow_package_dir)
    return handle, members


def member_bytes(handle, members, name: str) -> bytes:
    matches = [m for m in members if m.name == name and m.isfile()]
    require(len(matches) == 1, "ARTIFACT_MISMATCH")
    stream = handle.extractfile(matches[0])
    require(stream is not None, "ARTIFACT_MISMATCH")
    return stream.read()


def verify_blob(data, expected_size, expected_sha):
    require(len(data) == expected_size and digest(data) == expected_sha, "ARTIFACT_MISMATCH")


def validate_term_metadata(package, ig):
    require(package.get("name") == "jpfhir-terminology" and package.get("version") == "1.4.0", "ARTIFACT_MISMATCH")
    require(package.get("fhirVersions") == ["4.0.1"] and package.get("canonical") == "http://jpfhir.jp/fhir/jpfhir-terminology", "ARTIFACT_MISMATCH")
    require(package.get("dependencies") == {"hl7.fhir.r4.core": "4.0.1"} and "license" not in package, "ARTIFACT_MISMATCH")
    require((ig.get("resourceType"), ig.get("id"), ig.get("packageId"), ig.get("version"), ig.get("fhirVersion"), ig.get("url")) == ("ImplementationGuide", "jpfhir-terminology", "jpfhir-terminology", "1.4.0", ["4.0.1"], "http://jpfhir.jp/fhir/jpfhir-terminology/ImplementationGuide/jpfhir-terminology"), "ARTIFACT_MISMATCH")


def validate_core_metadata(package):
    require(package.get("name") == "jpfhir.jp.core" and package.get("version") == "1.2.0", "ARTIFACT_MISMATCH")


def classify(value) -> str:
    if value is MISSING or value == "":
        return "absent"
    require(isinstance(value, str), "RIGHTS_TYPE_INVALID")
    folded = value.casefold()
    hits = [token for token, needle in (("all-rights-reserved", "all rights reserved"), ("cc-by-nd", "cc by-nd"), ("cc0", "cc0"), ("loinc", "loinc")) if needle in folded]
    require(len(hits) <= 1, "RIGHTS_OVERLAP")
    return hits[0] if hits else "other-explicit"


def validate_rights(resources, *, resource_count=203, identity_sha=IDENTITY_SHA, class_sha=CLASS_SHA, expected_counts=None, codesystem_count=106, valueset_count=97):
    require(isinstance(resources, list) and len(resources) == resource_count, "RESOURCE_SHAPE")
    identities, classified, urls = [], [], {}
    counts = {key: 0 for key in ("all-rights-reserved", "cc-by-nd", "cc0", "loinc", "other-explicit", "absent")}
    for resource in resources:
        require(isinstance(resource, dict), "RESOURCE_SHAPE")
        rt, url, rid = resource.get("resourceType"), resource.get("url"), resource.get("id")
        version = resource.get("version", "")
        require(rt in {"CodeSystem", "ValueSet"} and all(isinstance(x, str) and x for x in (url, rid)), "RESOURCE_SHAPE")
        require(isinstance(version, str), "RESOURCE_SHAPE")
        identity = (rt, url, version, rid); identities.append(identity)
        category = classify(resource["copyright"] if "copyright" in resource else MISSING); counts[category] += 1
        classified.append(identity + (category,))
        if rt == "ValueSet":
            require(url not in urls, "DIRECT_RESOLUTION_ERROR"); urls[url] = resource
    require(len(set(identities)) == resource_count and digest(framed(identities)) == identity_sha, "RIGHTS_MANIFEST_MISMATCH")
    target_counts = expected_counts or {"all-rights-reserved": 17, "cc-by-nd": 4, "cc0": 2, "loinc": 3, "other-explicit": 120, "absent": 57}
    require(counts == target_counts, "RIGHTS_MANIFEST_MISMATCH")
    require(digest(framed(classified)) == class_sha, "RIGHTS_MANIFEST_MISMATCH")
    require(sum(r[0] == "CodeSystem" for r in identities) == codesystem_count and len(urls) == valueset_count, "RESOURCE_SHAPE")
    return resources, urls


def terminology(data: bytes):
    verify_blob(data, 7444937, TERM_SHA)
    handle, members = archive(data, 206, 256, 96 * 1024 * 1024, 32 * 1024 * 1024, True)
    with handle:
        package = parse_json(member_bytes(handle, members, "package/package.json"))
        ig = parse_json(member_bytes(handle, members, "package/ImplementationGuide-jpfhir-terminology.json"))
        validate_term_metadata(package, ig)
        resources = []
        for member in members:
            if not member.isfile() or not member.name.startswith("package/") or not member.name.endswith(".json") or member.name in {"package/package.json", "package/ImplementationGuide-jpfhir-terminology.json"}:
                continue
            value = parse_json(member_bytes(handle, members, member.name))
            if isinstance(value, dict) and value.get("resourceType") in {"CodeSystem", "ValueSet"}:
                resources.append(value)
    validated = validate_rights(resources)
    validate_value_set_index(list(validated[1].items()))
    return validated


def validate_direct_profiles(profiles, value_sets, *, profile_count=32, profile_sha=PROFILE_SHA, raw_count=51, raw_sha=RAW_SHA, unique_count=50, unique_sha=UNIQUE_SHA, duplicate_sha=DUP_SHA, canonical_count=25, canonical_sha=CANON_SHA):
    require(isinstance(profiles, list) and all(isinstance(profile, dict) for profile in profiles), "PROFILE_SHAPE_INVALID")
    profile_rows, raw = [], []
    for profile in profiles:
        url, version, status_value, type_value = (profile.get(k) for k in ("url", "version", "status", "type"))
        require(all(isinstance(x, str) and x for x in (url, version, status_value, type_value)), "PROFILE_SHAPE_INVALID")
        profile_rows.append((url, version, status_value, type_value))
        snapshot = profile.get("snapshot"); require(isinstance(snapshot, dict) and isinstance(snapshot.get("element"), list), "PROFILE_SHAPE_INVALID")
        for element in snapshot["element"]:
            require(isinstance(element, dict) and isinstance(element.get("path"), str) and element["path"], "PROFILE_SHAPE_INVALID")
            if "binding" not in element:
                continue
            binding = element["binding"]; require(isinstance(binding, dict), "PROFILE_SHAPE_INVALID")
            if "valueSet" not in binding:
                continue
            canonical, strength = binding["valueSet"], binding.get("strength")
            require(isinstance(canonical, str) and canonical and isinstance(strength, str) and strength, "PROFILE_SHAPE_INVALID")
            if "|" in canonical:
                require(canonical.split("|", 1)[0] not in value_sets, "DIRECT_RESOLUTION_ERROR")
                continue
            if canonical in value_sets:
                raw.append((url, version, status_value, type_value, element["path"], strength, canonical))
    require(len(profiles) == profile_count and digest(framed(profile_rows)) == profile_sha, "PROFILE_UNIVERSE_MISMATCH")
    require(len(raw) == raw_count and digest(framed(raw, multiset=True)) == raw_sha, "DIRECT_ROW_MISMATCH")
    unique = set(raw); require(len(unique) == unique_count and digest(framed(unique)) == unique_sha, "DIRECT_ROW_MISMATCH")
    duplicates = [row for row in unique if raw.count(row) == 2]
    require(len(duplicates) == 1 and digest(framed(duplicates)) == duplicate_sha, "DIRECT_ROW_MISMATCH")
    canonicals = {row[-1] for row in unique}
    require(len(canonicals) == canonical_count and digest(framed(canonicals)) == canonical_sha, "DIRECT_URL_MISMATCH")
    return canonicals


def validate_value_set_index(entries, *, required=(), package_name="jpfhir-terminology"):
    require(package_name == "jpfhir-terminology", "DIRECT_RESOLUTION_ERROR")
    urls = [entry[0] for entry in entries]
    require(len(urls) == len(set(urls)), "DIRECT_RESOLUTION_ERROR")
    require(set(required).issubset(urls), "DIRECT_RESOLUTION_ERROR")


def core_direct(data: bytes, value_sets):
    verify_blob(data, 2391515, CORE_SHA)
    handle, members = archive(data, 403, 512, 32 * 1024 * 1024, 8 * 1024 * 1024)
    with handle:
        package = parse_json(member_bytes(handle, members, "package/package.json"))
        validate_core_metadata(package)
        profiles = []
        for member in members:
            if not member.isfile() or not member.name.startswith("package/") or not member.name.endswith(".json"):
                continue
            resource = parse_json(member_bytes(handle, members, member.name))
            if not isinstance(resource, dict):
                continue
            if resource.get("resourceType") == "StructureDefinition" and resource.get("kind") == "resource" and resource.get("derivation") == "constraint" and resource.get("type") in TYPES:
                profiles.append(resource)
    return validate_direct_profiles(profiles, value_sets)


def validate_handoff_rows(rows, canonicals, *, expected_count=200, expected_sha=HANDOFF_SHA):
    require(isinstance(rows, list) and len(rows) == expected_count, "HANDOFF_SCHEMA_MISMATCH")
    require(all(isinstance(row, tuple) and len(row) == len(HANDOFF_FIELDS) for row in rows), "HANDOFF_SCHEMA_MISMATCH")
    require(len(set(rows)) == len(rows), "HANDOFF_SCHEMA_MISMATCH")
    expected_pairs = {(canonical, lane) for canonical in canonicals for lane in LANES}
    require({(row[0], row[1]) for row in rows} == expected_pairs, "HANDOFF_SCHEMA_MISMATCH")
    for row in rows:
        require(row[2] == "1.4.0" and all(value == "UNRESOLVED" for value in row[3:12]) and row[12:] == ("", ""), "HANDOFF_NOT_UNRESOLVED")
    require(digest(framed(rows)) == expected_sha, "HANDOFF_SCHEMA_MISMATCH")


def handoff(canonicals):
    rows = []
    for canonical in canonicals:
        for lane in LANES:
            row = {field: "UNRESOLVED" for field in HANDOFF_FIELDS}
            row.update(canonical=canonical, lane=lane, terminologyVersion="1.4.0", humanAuthority="", decisionDate="")
            rows.append(tuple(row[field] for field in HANDOFF_FIELDS))
    validate_handoff_rows(rows, canonicals)
    return rows


def validate_source_bundle(ref, tag, commit, tree, notice, *, notice_sha=NOTICE_SHA, notice_size=12931, anchors=None):
    require(ref.get("object", {}).get("type") == "tag", "TAG_TYPE_DRIFT")
    require(ref.get("object", {}).get("sha") == TAG, "SOURCE_IDENTITY_MISMATCH")
    require(tag.get("object", {}).get("type") == "commit" and tag.get("object", {}).get("sha") == COMMIT, "SOURCE_IDENTITY_MISMATCH")
    require(commit.get("tree", {}).get("sha") == TREE, "SOURCE_IDENTITY_MISMATCH")
    require(tree.get("sha") == TREE, "SOURCE_IDENTITY_MISMATCH")
    require(tree.get("truncated") is False, "TREE_TRUNCATED")
    entries = tree.get("tree"); require(isinstance(entries, list) and len(entries) == 662, "TREE_PATH_INVALID")
    paths = [entry.get("path") for entry in entries]
    require(all(isinstance(path, str) and path for path in paths) and len(paths) == len(set(paths)), "TREE_PATH_INVALID")
    require(not any(pathlib.PurePosixPath(path).name.casefold() in {"license", "licence", "notice", "copying"} for path in paths), "TREE_PATH_INVALID")
    require(len(notice) == notice_size and digest(notice) == notice_sha, "NOTICE_MISMATCH")
    text = notice.decode("utf-8")
    required_anchors = anchors or ("jpfhir.jp.core#1.2.0", "用語ライセンス", "利用する側で用語に関するライセンス問題を解決を行なう必要がある", "SHALL", "用語の利用を保証するものではない")
    for anchor in required_anchors:
        require(anchor in text, "NOTICE_MISMATCH")


def source_checks(transport: Transport):
    ref = parse_json(transport.get(REF_URL, 4 * 1024 * 1024))
    tag = parse_json(transport.get(TAG_URL, 4 * 1024 * 1024))
    commit = parse_json(transport.get(COMMIT_URL, 4 * 1024 * 1024))
    tree = parse_json(transport.get(TREE_URL, 4 * 1024 * 1024))
    notice = transport.get(NOTICE_URL, 4 * 1024 * 1024, 12931)
    validate_source_bundle(ref, tag, commit, tree, notice)


NEGATIVE_FAMILIES = {
    "SOURCE_IDENTITY_MISMATCH": "tag_ref_sha tag_target tree_body_identity",
    "TAG_TYPE_DRIFT": "tag_type",
    "TREE_TRUNCATED": "tree_truncated",
    "TREE_PATH_INVALID": "tree_count tree_duplicate_path tree_license_basename",
    "NOTICE_MISMATCH": "notice_digest notice_anchor",
    "ARTIFACT_MISMATCH": "core_digest core_size terminology_digest terminology_size package_singleton package_identity ig_singleton ig_identity",
    "ARCHIVE_UNSAFE": "core_entry_bound core_total_bound core_largest_bound terminology_entry_bound terminology_total_bound terminology_largest_bound absolute_path traversal_path backslash_path nul_path archive_duplicate_member casefold_collision nonregular_member",
    "JSON_DUPLICATE_KEY": "duplicate_json_key",
    "RESOURCE_SHAPE": "resource_count resource_object_type resource_type resource_url_type resource_id_type resource_version_type",
    "RIGHTS_TYPE_INVALID": "copyright_nonstring",
    "RIGHTS_OVERLAP": "category_overlap",
    "RIGHTS_MANIFEST_MISMATCH": "unicode_confusable whitespace_drift punctuation_drift near_miss member_swap duplicate_identity",
    "PROFILE_UNIVERSE_MISMATCH": "profile_manifest",
    "PROFILE_SHAPE_INVALID": "profile_object_type profile_url_type profile_version_type profile_status_type profile_type_type snapshot_type element_type element_path_type binding_type valueset_type strength_type",
    "DIRECT_ROW_MISMATCH": "row_manifest duplicate_multiplicity duplicate_key direct_duplicate_member",
    "DIRECT_URL_MISMATCH": "url_manifest",
    "DIRECT_RESOLUTION_ERROR": "missing_valueset duplicate_valueset version_alias wrong_package",
    "HANDOFF_SCHEMA_MISMATCH": "missing_row duplicate_row lane_drift field_missing",
    "HANDOFF_NOT_UNRESOLVED": "premature_decision",
    "TRANSPORT_POLICY": "redirect downgrade other_origin wrong_path unexpected_query unexpected_fragment userinfo ambient_proxy ambient_credential ambient_netrc ambient_cookie ambient_ssl_override temp_inside_worktree temp_inside_gitdir temp_inside_commondir temp_dir_mode temp_file_mode",
    "TRANSPORT_LIMIT": "content_length_missing content_length_mismatch body_bound request_timeout aggregate_timeout aggregate_bytes",
}


def expect_failure(token, operation):
    try: operation()
    except VerificationError as exc: require(str(exc) == token, "SELFTEST_MATRIX_INVALID")
    else: raise VerificationError("SELFTEST_MATRIX_INVALID")


def source_negative(name):
    anchors = ("version", "license", "resolve", "SHALL", "guarantee")
    notice = " ".join(anchors).encode()
    bundle = {
        "ref": {"object": {"type": "tag", "sha": TAG}},
        "tag": {"object": {"type": "commit", "sha": COMMIT}},
        "commit": {"tree": {"sha": TREE}},
        "tree": {"sha": TREE, "truncated": False, "tree": [{"path": f"src/p{i}"} for i in range(662)]},
        "notice": notice,
    }
    validate_source_bundle(bundle["ref"], bundle["tag"], bundle["commit"], bundle["tree"], bundle["notice"], notice_sha=digest(notice), notice_size=len(notice), anchors=anchors)
    before = repr(bundle)
    if name == "tag_ref_sha": bundle["ref"]["object"]["sha"] = "0" * 40
    elif name == "tag_target": bundle["tag"]["object"]["sha"] = "0" * 40
    elif name == "tree_body_identity": bundle["tree"]["sha"] = "0" * 40
    elif name == "tag_type": bundle["ref"]["object"]["type"] = "commit"
    elif name == "tree_truncated": bundle["tree"]["truncated"] = True
    elif name == "tree_count": bundle["tree"]["tree"].pop()
    elif name == "tree_duplicate_path": bundle["tree"]["tree"][-1]["path"] = bundle["tree"]["tree"][0]["path"]
    elif name == "tree_license_basename": bundle["tree"]["tree"][-1]["path"] = "nested/LICENSE"
    elif name == "notice_digest": bundle["notice"] = bundle["notice"].replace(b" ", b"!", 1)
    elif name == "notice_anchor": bundle["notice"] = bundle["notice"].replace(b"SHALL", b"shall")
    expected_sha = digest(bundle["notice"]) if name == "notice_anchor" else digest(notice)
    require(repr(bundle) != before, "SELFTEST_NOT_SINGLE_BOUNDARY")
    validate_source_bundle(bundle["ref"], bundle["tag"], bundle["commit"], bundle["tree"], bundle["notice"], notice_sha=expected_sha, notice_size=len(notice), anchors=anchors)


def archive_negative(name):
    members = [tarfile.TarInfo("package/a")]
    members[0].size = 1
    expected_count, entry_cap, total_cap, largest_cap = 1, 2, 2, 2
    validate_archive_members(copy.deepcopy(members), expected_count, entry_cap, total_cap, largest_cap)
    before = repr(([(m.name, m.type, m.size) for m in members], expected_count, entry_cap, total_cap, largest_cap))
    if name in {"core_entry_bound", "terminology_entry_bound"}: entry_cap = 0
    elif name in {"core_total_bound", "terminology_total_bound"}: total_cap = 0
    elif name in {"core_largest_bound", "terminology_largest_bound"}: largest_cap = 0
    elif name == "absolute_path": members[0].name = "/absolute"
    elif name == "traversal_path": members[0].name = "package/../escape"
    elif name == "backslash_path": members[0].name = "package\\escape"
    elif name == "nul_path": members[0].name = "package/a\x00b"
    elif name == "archive_duplicate_member": members.append(copy.copy(members[0])); expected_count = 2
    elif name == "casefold_collision": members.append(tarfile.TarInfo("PACKAGE/A")); members[-1].size = 1; expected_count = 2
    elif name == "nonregular_member": members[0].type = tarfile.SYMTYPE
    require(repr(([(m.name, m.type, m.size) for m in members], expected_count, entry_cap, total_cap, largest_cap)) != before, "SELFTEST_NOT_SINGLE_BOUNDARY")
    validate_archive_members(members, expected_count, entry_cap, total_cap, largest_cap)


def rights_fixture():
    resources = [
        {"resourceType": "CodeSystem", "url": "https://example/cs", "version": "1", "id": "cs", "copyright": "CC0"},
        {"resourceType": "CodeSystem", "url": "https://example/other", "version": "1", "id": "cs"},
    ]
    identities = [(r["resourceType"], r["url"], r["version"], r["id"]) for r in resources]
    classified = [identity + (classify(resource["copyright"] if "copyright" in resource else MISSING),) for identity, resource in zip(identities, resources)]
    counts = {key: 0 for key in ("all-rights-reserved", "cc-by-nd", "cc0", "loinc", "other-explicit", "absent")}
    for resource in resources: counts[classify(resource["copyright"] if "copyright" in resource else MISSING)] += 1
    return resources, dict(resource_count=2, identity_sha=digest(framed(identities)), class_sha=digest(framed(classified)), expected_counts=counts, codesystem_count=2, valueset_count=0)


def rights_negative(name):
    resources, expected = rights_fixture()
    validate_rights(copy.deepcopy(resources), **expected)
    before = repr(resources)
    if name == "resource_count": resources.pop()
    elif name == "resource_object_type": resources[0] = []
    elif name == "resource_type": resources[0]["resourceType"] = "ConceptMap"
    elif name == "resource_url_type": resources[0]["url"] = 1
    elif name == "resource_id_type": resources[0]["id"] = 1
    elif name == "resource_version_type": resources[0]["version"] = 1
    elif name == "copyright_nonstring": resources[0]["copyright"] = None
    elif name == "category_overlap": resources[0]["copyright"] = "CC0 LOINC"
    elif name == "duplicate_identity": resources[1]["url"] = resources[0]["url"]
    elif name == "member_swap": resources[0].pop("copyright"); resources[1]["copyright"] = "CC0"
    elif name == "unicode_confusable": resources[0]["copyright"] = "CC０"
    elif name == "whitespace_drift": resources[0]["copyright"] = "C C0"
    elif name == "punctuation_drift": resources[0]["copyright"] = "CC-0"
    elif name == "near_miss": resources[0]["copyright"] = "CCO"
    require(repr(resources) != before, "SELFTEST_NOT_SINGLE_BOUNDARY")
    validate_rights(resources, **expected)


def direct_fixture():
    profile = {"url": "https://example/profile", "version": "1", "status": "active", "type": "Patient", "snapshot": {"element": [
        {"path": "Patient.code", "binding": {"strength": "required", "valueSet": "https://example/vs"}},
        {"path": "Patient.code", "binding": {"strength": "required", "valueSet": "https://example/vs"}},
        {"path": "Patient.other", "binding": {"strength": "extensible", "valueSet": "https://example/vs"}},
    ]}}
    prow = (profile["url"], profile["version"], profile["status"], profile["type"])
    row = prow + ("Patient.code", "required", "https://example/vs")
    other = prow + ("Patient.other", "extensible", "https://example/vs")
    expected = dict(profile_count=1, profile_sha=digest(framed([prow])), raw_count=3, raw_sha=digest(framed([row, row, other], multiset=True)), unique_count=2, unique_sha=digest(framed([row, other])), duplicate_sha=digest(framed([row])), canonical_count=1, canonical_sha=digest(framed(["https://example/vs"])))
    return [profile], {"https://example/vs": {}}, expected


def direct_negative(name):
    profiles, value_sets, expected = direct_fixture(); profile = profiles[0]; element = profile["snapshot"]["element"][0]
    validate_direct_profiles(copy.deepcopy(profiles), copy.deepcopy(value_sets), **expected)
    before = repr((profiles, value_sets))
    if name == "profile_manifest": profile["url"] += "/drift"
    elif name == "profile_object_type": profiles[0] = []
    elif name == "profile_url_type": profile["url"] = 1
    elif name == "profile_version_type": profile["version"] = 1
    elif name == "profile_status_type": profile["status"] = 1
    elif name == "profile_type_type": profile["type"] = 1
    elif name == "snapshot_type": profile["snapshot"] = []
    elif name == "element_type": profile["snapshot"]["element"][0] = []
    elif name == "element_path_type": element["path"] = 1
    elif name == "binding_type": element["binding"] = []
    elif name == "valueset_type": element["binding"]["valueSet"] = 1
    elif name == "strength_type": element["binding"]["strength"] = 1
    elif name == "row_manifest": element["path"] += ".drift"
    elif name == "duplicate_key": profile["snapshot"]["element"][2] = copy.deepcopy(element)
    elif name == "direct_duplicate_member": profile["snapshot"]["element"].append(copy.deepcopy(profile["snapshot"]["element"][2]))
    elif name == "duplicate_multiplicity": profile["snapshot"]["element"].pop(1)
    elif name == "url_manifest":
        for item in profile["snapshot"]["element"]: item["binding"]["valueSet"] = "https://example/other"
        value_sets["https://example/other"] = {}
        changed = (profile["url"], profile["version"], profile["status"], profile["type"], "Patient.code", "required", "https://example/other")
        changed_other = (profile["url"], profile["version"], profile["status"], profile["type"], "Patient.other", "extensible", "https://example/other")
        expected.update(raw_sha=digest(framed([changed, changed, changed_other], multiset=True)), unique_sha=digest(framed([changed, changed_other])), duplicate_sha=digest(framed([changed])))
    elif name == "missing_valueset":
        entries = []; require(repr(entries) != repr(list(value_sets.items())), "SELFTEST_NOT_SINGLE_BOUNDARY"); return validate_value_set_index(entries, required=("https://example/vs",))
    elif name == "duplicate_valueset":
        entries = [("https://example/vs", {}), ("https://example/vs", {})]; require(repr(entries) != repr(list(value_sets.items())), "SELFTEST_NOT_SINGLE_BOUNDARY"); return validate_value_set_index(entries)
    elif name == "version_alias": element["binding"]["valueSet"] += "|1"
    elif name == "wrong_package":
        require("wrong" != "jpfhir-terminology", "SELFTEST_NOT_SINGLE_BOUNDARY"); return validate_value_set_index([("https://example/vs", {})], package_name="wrong")
    require(repr((profiles, value_sets)) != before, "SELFTEST_NOT_SINGLE_BOUNDARY")
    validate_direct_profiles(profiles, value_sets, **expected)


def handoff_negative(name):
    canonicals = {"https://example/vs"}
    rows = []
    for lane in LANES:
        row = ["https://example/vs", lane, "1.4.0"] + ["UNRESOLVED"] * 9 + ["", ""]
        rows.append(tuple(row))
    expected_sha = digest(framed(rows))
    validate_handoff_rows(copy.deepcopy(rows), canonicals, expected_count=8, expected_sha=expected_sha)
    before = repr(rows)
    if name == "missing_row": rows.pop()
    elif name == "duplicate_row": rows[-1] = rows[0]
    elif name == "lane_drift": rows[-1] = (rows[-1][0], "wrong-lane") + rows[-1][2:]
    elif name == "field_missing": rows[-1] = rows[-1][:-1]
    elif name == "premature_decision": rows[-1] = rows[-1][:11] + ("APPROVED",) + rows[-1][12:]
    require(repr(rows) != before, "SELFTEST_NOT_SINGLE_BOUNDARY")
    validate_handoff_rows(rows, canonicals, expected_count=8, expected_sha=expected_sha)


def transport_negative(name):
    endpoint(REF_URL); validate_effective_url(REF_URL, REF_URL); validate_ambient({})
    validate_response("1", b"x", 2, None); validate_deadlines(0, 1, 1)
    with tempfile.TemporaryDirectory(prefix="wp4158-transport-negative-") as parent:
        parent_path = pathlib.Path(parent)
        safe = parent_path / "safe"; safe.mkdir(mode=0o700)
        protected = parent_path / "protected"; protected.mkdir(mode=0o700)
        child = protected / "child"; child.mkdir(mode=0o700)
        validate_temp_location(safe, (protected,), 0o700, 0o600)
        if name == "redirect": validate_effective_url(REF_URL, REF_URL + "/moved")
        elif name == "wrong_path": endpoint(REF_URL + "/moved")
        elif name == "downgrade": endpoint(REF_URL.replace("https://", "http://"))
        elif name == "other_origin": endpoint(REF_URL.replace("api.github.com", "example.com"))
        elif name == "unexpected_query": endpoint(REF_URL + "?x=1")
        elif name == "unexpected_fragment": endpoint(REF_URL + "#x")
        elif name == "userinfo": endpoint(REF_URL.replace("https://", "https://user@"))
        elif name.startswith("ambient_"):
            key = {"ambient_proxy": "HTTPS_PROXY", "ambient_credential": "AUTHORIZATION", "ambient_netrc": "NETRC", "ambient_cookie": "COOKIE", "ambient_ssl_override": "SSLKEYLOGFILE"}[name]
            validate_ambient({key: "hostile"})
        elif name in {"temp_inside_worktree", "temp_inside_gitdir", "temp_inside_commondir"}:
            validate_temp_location(child, (protected,), 0o700)
        elif name == "temp_dir_mode": validate_temp_location(safe, (protected,), 0o755)
        elif name == "temp_file_mode": validate_temp_location(safe, (protected,), 0o700, 0o644)
        elif name == "content_length_missing": validate_response(None, b"x", 2, None)
        elif name == "content_length_mismatch": validate_response("2", b"x", 2, None)
        elif name == "body_bound": validate_response("2", b"xx", 1, None)
        elif name == "request_timeout": validate_deadlines(2, 1, 3)
        elif name == "aggregate_timeout": validate_deadlines(4, 5, 3)
        elif name == "aggregate_bytes": validate_response("1", b"x", 2, None, 16 * 1024 * 1024)


def negative_probe(name, token):
    source_names = set("tag_ref_sha tag_target tree_body_identity tag_type tree_truncated tree_count tree_duplicate_path tree_license_basename notice_digest notice_anchor".split())
    archive_names = set("core_entry_bound core_total_bound core_largest_bound terminology_entry_bound terminology_total_bound terminology_largest_bound absolute_path traversal_path backslash_path nul_path archive_duplicate_member casefold_collision nonregular_member".split())
    rights_names = set("resource_count resource_object_type resource_type resource_url_type resource_id_type resource_version_type copyright_nonstring category_overlap unicode_confusable whitespace_drift punctuation_drift near_miss member_swap duplicate_identity".split())
    direct_names = set("profile_manifest profile_object_type profile_url_type profile_version_type profile_status_type profile_type_type snapshot_type element_type element_path_type binding_type valueset_type strength_type row_manifest duplicate_multiplicity duplicate_key direct_duplicate_member url_manifest missing_valueset duplicate_valueset version_alias wrong_package".split())
    handoff_names = set("missing_row duplicate_row lane_drift field_missing premature_decision".split())
    transport_names = set(NEGATIVE_FAMILIES["TRANSPORT_POLICY"].split() + NEGATIVE_FAMILIES["TRANSPORT_LIMIT"].split())
    if name in source_names: operation = lambda: source_negative(name)
    elif name in archive_names: operation = lambda: archive_negative(name)
    elif name == "duplicate_json_key": operation = json_duplicate_negative
    elif name in rights_names: operation = lambda: rights_negative(name)
    elif name in direct_names: operation = lambda: direct_negative(name)
    elif name in handoff_names: operation = lambda: handoff_negative(name)
    elif name in transport_names: operation = lambda: transport_negative(name)
    elif name in {"core_digest", "terminology_digest"}: operation = lambda: blob_negative("digest")
    elif name in {"core_size", "terminology_size"}: operation = lambda: blob_negative("size")
    elif name in {"package_identity", "ig_identity"}: operation = lambda: metadata_negative(name)
    elif name == "wrong_package": operation = lambda: validate_core_metadata({"name": "wrong"})
    elif name in {"package_singleton", "ig_singleton"}: operation = lambda: singleton_negative(name)
    else: raise VerificationError("SELFTEST_MATRIX_INVALID")
    expect_failure(token, operation)


def singleton_negative(name):
    target = "package/package.json" if name == "package_singleton" else "package/ImplementationGuide-jpfhir-terminology.json"
    baseline = io.BytesIO()
    with tarfile.open(fileobj=baseline, mode="w") as writer:
        member = tarfile.TarInfo(target); member.size = 2; writer.addfile(member, io.BytesIO(b"{}"))
    baseline.seek(0)
    with tarfile.open(fileobj=baseline, mode="r:") as reader:
        require(member_bytes(reader, reader.getmembers(), target) == b"{}", "SELFTEST_MATRIX_INVALID")
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w") as writer:
        for payload in (b"{}", b"{}"):
            member = tarfile.TarInfo(target); member.size = len(payload); writer.addfile(member, io.BytesIO(payload))
    buffer.seek(0)
    with tarfile.open(fileobj=buffer, mode="r:") as reader:
        member_bytes(reader, reader.getmembers(), target)


def json_duplicate_negative():
    require(parse_json(b'{"a":1}') == {"a": 1}, "SELFTEST_MATRIX_INVALID")
    parse_json(b'{"a":1,"a":2}')


def blob_negative(kind):
    baseline = b"good"; verify_blob(baseline, len(baseline), digest(baseline))
    if kind == "digest": verify_blob(b"bad!", len(baseline), digest(baseline))
    else: verify_blob(baseline, len(baseline) + 1, digest(baseline))


def metadata_negative(name):
    package = {"name": "jpfhir-terminology", "version": "1.4.0", "fhirVersions": ["4.0.1"], "canonical": "http://jpfhir.jp/fhir/jpfhir-terminology", "dependencies": {"hl7.fhir.r4.core": "4.0.1"}}
    ig = {"resourceType": "ImplementationGuide", "id": "jpfhir-terminology", "packageId": "jpfhir-terminology", "version": "1.4.0", "fhirVersion": ["4.0.1"], "url": "http://jpfhir.jp/fhir/jpfhir-terminology/ImplementationGuide/jpfhir-terminology"}
    validate_term_metadata(copy.deepcopy(package), copy.deepcopy(ig))
    if name == "package_identity": package["name"] = "wrong"
    else: ig["id"] = "wrong"
    validate_term_metadata(package, ig)


def create_private_root(prefix, post_create=None):
    temp_parent = pathlib.Path(tempfile.gettempdir()).resolve()
    for _ in range(32):
        candidate = temp_parent / f"{prefix}{os.urandom(16).hex()}"
        if os.path.lexists(candidate):
            continue
        try:
            os.mkdir(candidate, mode=0o700)
            os.chmod(candidate, 0o700)
            if post_create is not None: post_create(candidate)
            return candidate
        except BaseException:
            created = None
            try: created = candidate.lstat()
            except FileNotFoundError: pass
            if created is not None and stat.S_ISDIR(created.st_mode) and not stat.S_ISLNK(created.st_mode) and created.st_uid == os.getuid() and stat.S_IMODE(created.st_mode) & 0o077 == 0:
                os.rmdir(candidate)
            raise
    raise VerificationError("TEMP_ROOT_ALLOCATION_FAILED")


def entry_at(root_fd, name):
    try: return os.stat(name, dir_fd=root_fd, follow_symlinks=False)
    except FileNotFoundError: return None


def identity(info):
    return (info.st_dev, info.st_ino)


def identity_fds(target_identity, excluded=()):
    descriptor_root = pathlib.Path("/dev/fd" if pathlib.Path("/dev/fd").is_dir() else "/proc/self/fd")
    matches = []
    for entry in descriptor_root.iterdir():
        if not entry.name.isdigit(): continue
        candidate_fd = int(entry.name)
        if candidate_fd < 3 or candidate_fd in excluded: continue
        try: candidate_identity = identity(os.fstat(candidate_fd))
        except OSError: continue
        if candidate_identity == target_identity: matches.append(candidate_fd)
    return tuple(matches)


def close_unassigned_identity(target_identity, excluded=()):
    closed = 0
    for candidate_fd in identity_fds(target_identity, excluded):
        try: os.close(candidate_fd); closed += 1
        except OSError: pass
    return closed


def open_owned_path(path):
    root_info = path.lstat()
    target_identity = identity(root_info)
    existing_fds = identity_fds(target_identity)
    fd = None
    try:
        fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        require(stat.S_ISDIR(root_info.st_mode) and identity(os.fstat(fd)) == target_identity, "TRANSPORT_POLICY")
        return fd, target_identity
    except BaseException:
        if fd is not None:
            try: os.close(fd)
            except OSError: pass
        else: close_unassigned_identity(target_identity, excluded=existing_fds)
        raise


def begin_owned_dir(parent_fd, name):
    require(entry_at(parent_fd, name) is None, "CLEANUP_TARGET_EXISTS")
    fd = None
    try:
        os.mkdir(name, mode=0o700, dir_fd=parent_fd)
        os.chmod(name, 0o700, dir_fd=parent_fd, follow_symlinks=False)
        info = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == 0o700, "CLEANUP_OWNERSHIP_CHANGED")
        fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent_fd)
        require(identity(os.fstat(fd)) == identity(info), "CLEANUP_OWNERSHIP_CHANGED")
        return fd, identity(info)
    except BaseException:
        failure = sys.exc_info()
        if fd is not None:
            try: os.close(fd)
            except OSError: failure[1].add_note("secondary owned-directory fd close failure")
        current = entry_at(parent_fd, name)
        if fd is None and current is not None: close_unassigned_identity(identity(current), excluded=(parent_fd,))
        if current is not None and stat.S_ISDIR(current.st_mode) and current.st_uid == os.getuid() and stat.S_IMODE(current.st_mode) & 0o077 == 0:
            try: os.rmdir(name, dir_fd=parent_fd)
            except OSError: failure[1].add_note("secondary owned-directory rollback failure")
        raise failure[1].with_traceback(failure[2])


def require_owned_dir(parent_fd, name, owned_fd, owned_identity):
    current = entry_at(parent_fd, name)
    require(current is not None and stat.S_ISDIR(current.st_mode) and identity(current) == owned_identity, "CLEANUP_OWNERSHIP_CHANGED")
    require(identity(os.fstat(owned_fd)) == owned_identity, "CLEANUP_OWNERSHIP_CHANGED")


def remove_owned_file(parent_fd, name, expected_identity):
    current = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
    require(stat.S_ISREG(current.st_mode) and identity(current) == expected_identity, "CLEANUP_OWNERSHIP_CHANGED")
    os.unlink(name, dir_fd=parent_fd)


def begin_owned_file(parent_fd, name):
    fd = None
    try:
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=parent_fd)
        fd_info = os.fstat(fd)
        current = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
        require(stat.S_ISREG(current.st_mode) and identity(current) == identity(fd_info) and stat.S_IMODE(current.st_mode) == 0o600, "CLEANUP_OWNERSHIP_CHANGED")
        return fd, identity(fd_info)
    except BaseException:
        if fd is not None:
            try:
                fd_info = os.fstat(fd)
                current = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
                if stat.S_ISREG(current.st_mode) and identity(current) == identity(fd_info): os.unlink(name, dir_fd=parent_fd)
            except (FileNotFoundError, OSError): pass
            try: os.close(fd)
            except OSError: pass
        else:
            try:
                current = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
                closed = close_unassigned_identity(identity(current), excluded=(parent_fd,))
                if closed and stat.S_ISREG(current.st_mode): os.unlink(name, dir_fd=parent_fd)
            except (FileNotFoundError, OSError): pass
        raise


def remove_owned_dir(parent_fd, name, owned_fd, owned_identity):
    require_owned_dir(parent_fd, name, owned_fd, owned_identity)
    os.rmdir(name, dir_fd=parent_fd)


def finalize_owned_dir(parent_fd, source, target, owned_fd, owned_identity):
    require_owned_dir(parent_fd, source, owned_fd, owned_identity)
    require(entry_at(parent_fd, target) is None, "CLEANUP_TARGET_EXISTS")
    try:
        rename_noreplace(parent_fd, source, target)
    except BaseException:
        failure = sys.exc_info()
        source_info = entry_at(parent_fd, source)
        target_info = entry_at(parent_fd, target)
        if source_info is None and target_info is not None and identity(target_info) == owned_identity:
            try: rename_noreplace(parent_fd, target, source)
            except BaseException: failure[1].add_note("secondary owned-directory rename rollback failure")
        raise failure[1].with_traceback(failure[2])
    require_owned_dir(parent_fd, target, owned_fd, owned_identity)
    return target


def remove_probe_owned(pending, final):
    shutil.rmtree(pending, ignore_errors=True)
    shutil.rmtree(final, ignore_errors=True)


def rename_noreplace(root_fd, source, target):
    libc = ctypes.CDLL(None, use_errno=True)
    source_bytes, target_bytes = source.encode(), target.encode()
    if sys.platform == "darwin":
        operation = getattr(libc, "renameatx_np", None)
        require(operation is not None, "CLEANUP_NOREPLACE_UNAVAILABLE")
        result = operation(root_fd, source_bytes, root_fd, target_bytes, 0x00000004)
    else:
        operation = getattr(libc, "renameat2", None)
        require(operation is not None, "CLEANUP_NOREPLACE_UNAVAILABLE")
        result = operation(root_fd, source_bytes, root_fd, target_bytes, 0x00000001)
    if result != 0:
        error = ctypes.get_errno()
        if error in (errno.EEXIST, errno.ENOTDIR, errno.ENOTEMPTY): raise VerificationError("CLEANUP_TARGET_EXISTS")
        raise VerificationError("CLEANUP_RENAME_FAILED")


def validate_cleanup_child_args(args):
    root = pathlib.Path(args.root or "")
    require(root.is_absolute() and args.root_fd is not None and args.root_fd >= 3, "CLEANUP_PATH_INVALID")
    root_lstat = root.lstat()
    cwd = pathlib.Path.cwd().resolve()
    resolved_root = root.resolve(strict=True)
    require(stat.S_ISDIR(root_lstat.st_mode) and not stat.S_ISLNK(root_lstat.st_mode), "CLEANUP_PATH_INVALID")
    require(root_lstat.st_uid == os.getuid() and stat.S_IMODE(root_lstat.st_mode) == 0o700, "CLEANUP_PATH_INVALID")
    require(not paths_overlap(resolved_root, cwd, "CLEANUP_PATH_INVALID"), "CLEANUP_PATH_INVALID")
    root_fd_stat = os.fstat(args.root_fd)
    require(stat.S_ISDIR(root_fd_stat.st_mode) and identity(root_fd_stat) == identity(root_lstat), "CLEANUP_PATH_INVALID")
    canary_lstat = entry_at(args.root_fd, "canary")
    require(canary_lstat is not None, "CLEANUP_PATH_INVALID")
    require(stat.S_ISREG(canary_lstat.st_mode) and not stat.S_ISLNK(canary_lstat.st_mode), "CLEANUP_PATH_INVALID")
    canary_fd = os.open("canary", os.O_RDONLY | os.O_NOFOLLOW, dir_fd=args.root_fd)
    try:
        canary_bytes = os.read(canary_fd, len(b"canary") + 1)
        canary_eof = os.read(canary_fd, 1)
    finally: os.close(canary_fd)
    require(canary_lstat.st_uid == os.getuid() and stat.S_IMODE(canary_lstat.st_mode) == 0o600 and canary_lstat.st_size == len(b"canary") and canary_bytes == b"canary" and canary_eof == b"", "CLEANUP_PATH_INVALID")
    require(entry_at(args.root_fd, "pending") is None and entry_at(args.root_fd, "final") is None, "CLEANUP_PATH_INVALID")
    inherited = (args.ready_fd, args.release_fd, args.cleanup_ready_fd, args.cleanup_go_fd, args.signal_ack_fd)
    require(all(value is not None and value >= 3 for value in inherited), "CLEANUP_PATH_INVALID")
    require(len({args.root_fd, *inherited}) == 6, "CLEANUP_PATH_INVALID")
    require(all(stat.S_ISFIFO(os.fstat(value).st_mode) for value in inherited), "CLEANUP_PATH_INVALID")
    return args.root_fd


def cleanup_child(args):
    root_fd = validate_cleanup_child_args(args)
    phase = args.phase
    owned_name = None
    owned_identity = None
    phase_fd = None
    partial_fd = None
    partial_identity = None
    file_identity = None
    cleanup_active = False
    operation_complete = False
    deferred_signal = None
    catchable = {signal.SIGINT, signal.SIGTERM, signal.SIGHUP}
    def clean(*_):
        if owned_name is None: return
        require_owned_dir(root_fd, owned_name, phase_fd, owned_identity)
        require_owned_dir(phase_fd, "partial", partial_fd, partial_identity)
        remove_owned_file(partial_fd, "download.part", file_identity)
        remove_owned_dir(phase_fd, "partial", partial_fd, partial_identity)
        remove_owned_dir(root_fd, owned_name, phase_fd, owned_identity)
    def interrupted(signum, _frame):
        nonlocal cleanup_active, deferred_signal
        try: os.write(args.signal_ack_fd, b"S")
        except OSError: pass
        deferred_signal = deferred_signal or signum
        if not cleanup_active:
            cleanup_active = True
            if sys.exc_info()[0] is not None or operation_complete: return
            raise ProbeSignal(signum)
        return
    for sig in catchable:
        signal.signal(sig, interrupted)
    reason_name, exit_code = "NORMAL_RETURN", 0
    try:
        previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, catchable)
        try:
            owned_name = "pending"
            phase_fd, owned_identity = begin_owned_dir(root_fd, owned_name)
            partial_fd, partial_identity = begin_owned_dir(phase_fd, "partial")
            fd, file_identity = begin_owned_file(partial_fd, "download.part")
            with os.fdopen(fd, "wb") as stream:
                stream.write(b"wp4158-partial"); stream.flush(); os.fsync(stream.fileno())
            os.fsync(partial_fd); os.fsync(phase_fd)
            if phase == "final":
                owned_name = finalize_owned_dir(root_fd, "pending", "final", phase_fd, owned_identity)
            os.fsync(root_fd)
        finally: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
        os.write(args.ready_fd, b"P" if phase == "pending" else b"F"); os.close(args.ready_fd)
        while os.read(args.release_fd, 1): pass
        os.close(args.release_fd)
        if args.reason == "operation_error": raise RuntimeError("synthetic operation failure")
        operation_complete = True
    except RuntimeError:
        reason_name, exit_code = "OPERATION_EXCEPTION", 70
    except ProbeSignal as exc:
        reason_name = {signal.SIGINT: "SIGINT", signal.SIGTERM: "SIGTERM", signal.SIGHUP: "SIGHUP"}[exc.signum]
        exit_code = 128 + exc.signum
    finally:
        for fd_name in ("ready_fd", "release_fd"):
            fd_value = getattr(args, fd_name)
            try: os.close(fd_value)
            except OSError: pass
        cleanup_active = True
        os.write(args.cleanup_ready_fd, b"C"); os.close(args.cleanup_ready_fd); args.cleanup_ready_fd = -1
        while os.read(args.cleanup_go_fd, 1): pass
        os.close(args.cleanup_go_fd); args.cleanup_go_fd = -1
        previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, catchable)
        try: clean()
        finally: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
        cleanup_active = False
        os.close(args.signal_ack_fd); args.signal_ack_fd = -1
        for owned_fd in (partial_fd, phase_fd):
            if owned_fd is not None:
                try: os.close(owned_fd)
                except OSError: pass
    if deferred_signal is not None and reason_name == "NORMAL_RETURN":
        reason_name = {signal.SIGINT: "SIGINT", signal.SIGTERM: "SIGTERM", signal.SIGHUP: "SIGHUP"}[deferred_signal]
        exit_code = 128 + deferred_signal
    probe_reason = {"NORMAL_RETURN": "normal", "OPERATION_EXCEPTION": "operation_error", "SIGINT": "sigint", "SIGTERM": "sigterm", "SIGHUP": "sighup"}[reason_name]
    print(f"WP4158_CLEANUP_EXIT probe=cleanup_{phase}_{probe_reason} phase={phase} reason={reason_name}")
    return exit_code


def reap_probe_child(child, verified_pgid, token):
    if child is None or child.poll() is not None:
        return
    try:
        if verified_pgid is not None:
            os.killpg(verified_pgid, signal.SIGTERM)
        else:
            child.terminate()
    except ProcessLookupError:
        pass
    try:
        child.wait(0.5)
    except subprocess.TimeoutExpired:
        try:
            if verified_pgid is not None:
                os.killpg(verified_pgid, signal.SIGKILL)
            else:
                child.kill()
        except ProcessLookupError:
            pass
        try:
            child.wait(1.5)
        except subprocess.TimeoutExpired as exc:
            raise VerificationError(token) from exc
    require(child.poll() is not None, token)


def cleanup_probe(phase, reason):
    with tempfile.TemporaryDirectory(prefix="wp4158-cleanup-") as parent:
        total_deadline = time.monotonic() + 10
        os.chmod(parent, 0o700); root = pathlib.Path(parent)
        pending, final, canary = root / "pending", root / "final", root / "canary"
        canary.write_bytes(b"canary"); os.chmod(canary, 0o600)
        ready_r, ready_w = os.pipe(); release_r, release_w = os.pipe()
        cleanup_ready_r, cleanup_ready_w = os.pipe(); cleanup_go_r, cleanup_go_w = os.pipe()
        signal_ack_r, signal_ack_w = os.pipe()
        root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        command = [sys.executable, "-I", __file__, "--cleanup-child", "--phase", phase, "--reason", reason, "--root", str(root), "--root-fd", str(root_fd), "--ready-fd", str(ready_w), "--release-fd", str(release_r), "--cleanup-ready-fd", str(cleanup_ready_w), "--cleanup-go-fd", str(cleanup_go_r), "--signal-ack-fd", str(signal_ack_w)]
        child = None
        verified_pgid = None
        try:
            child = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, pass_fds=(root_fd, ready_w, release_r, cleanup_ready_w, cleanup_go_r, signal_ack_w), start_new_session=True, text=False)
            os.close(root_fd); root_fd = -1
            os.close(ready_w); ready_w = -1
            os.close(release_r); release_r = -1
            os.close(cleanup_ready_w); cleanup_ready_w = -1
            os.close(cleanup_go_r); cleanup_go_r = -1
            os.close(signal_ack_w); signal_ack_w = -1
            require(os.getpgid(child.pid) == child.pid and child.pid != os.getpgrp(), "CLEANUP_PROBE_FAILED")
            verified_pgid = child.pid
            startup_deadline = min(total_deadline, time.monotonic() + 2)
            ready, ready_eof = b"", False
            expected_ready = b"P" if phase == "pending" else b"F"
            while not ready_eof:
                remaining = startup_deadline - time.monotonic()
                if remaining <= 0: break
                readable, _, _ = select.select([ready_r], [], [], min(0.01, remaining))
                if readable == [ready_r]:
                    chunk = os.read(ready_r, 2)
                    if chunk == b"": ready_eof = True
                    else:
                        ready += chunk
                        require(len(ready) <= 1 and expected_ready.startswith(ready), "CLEANUP_PROBE_FAILED")
            readiness_completed = time.monotonic()
            require(ready == expected_ready and ready_eof and readiness_completed <= startup_deadline and readiness_completed < total_deadline, "CLEANUP_PROBE_FAILED")
            target = pending if phase == "pending" else final
            other = final if phase == "pending" else pending
            nested, part = target / "partial", target / "partial/download.part"
            require(target.is_dir() and not other.exists() and nested.is_dir() and part.read_bytes() == b"wp4158-partial" and canary.read_bytes() == b"canary", "CLEANUP_PROBE_FAILED")
            require(stat.S_IMODE(target.stat().st_mode) == 0o700 and stat.S_IMODE(nested.stat().st_mode) == 0o700 and stat.S_IMODE(part.stat().st_mode) == 0o600, "CLEANUP_PROBE_FAILED")
            require(target.stat().st_uid == os.getuid() == nested.stat().st_uid == part.stat().st_uid, "CLEANUP_PROBE_FAILED")
            if reason in {"normal", "operation_error"}:
                os.close(release_w); release_w = -1
            else:
                os.killpg(child.pid, {"sigint": signal.SIGINT, "sigterm": signal.SIGTERM, "sighup": signal.SIGHUP}[reason])
                ack_remaining = total_deadline - time.monotonic()
                require(ack_remaining > 0, "CLEANUP_PROBE_FAILED")
                ack_readable, _, _ = select.select([signal_ack_r], [], [], min(2, ack_remaining))
                require(ack_readable == [signal_ack_r] and os.read(signal_ack_r, 2) == b"S", "CLEANUP_PROBE_FAILED")
            cleanup_deadline = min(total_deadline, time.monotonic() + 2)
            cleanup_ready, cleanup_eof = b"", False
            while not cleanup_eof:
                cleanup_remaining = cleanup_deadline - time.monotonic()
                if cleanup_remaining <= 0: break
                cleanup_readable, _, _ = select.select([cleanup_ready_r], [], [], min(0.01, cleanup_remaining))
                if cleanup_readable == [cleanup_ready_r]:
                    chunk = os.read(cleanup_ready_r, 2)
                    if chunk == b"": cleanup_eof = True
                    else:
                        cleanup_ready += chunk
                        require(len(cleanup_ready) <= 1 and b"C".startswith(cleanup_ready), "CLEANUP_PROBE_FAILED")
            cleanup_completed = time.monotonic()
            require(cleanup_ready == b"C" and cleanup_eof and cleanup_completed <= cleanup_deadline and cleanup_completed < total_deadline, "CLEANUP_PROBE_FAILED")
            os.close(cleanup_go_w); cleanup_go_w = -1
            exit_remaining = total_deadline - time.monotonic()
            require(exit_remaining > 0, "CLEANUP_PROBE_FAILED")
            stdout, stderr = child.communicate(timeout=exit_remaining)
            child_completed = time.monotonic()
            require(child_completed < total_deadline, "CLEANUP_PROBE_FAILED")
            expected_code = {"normal": 0, "operation_error": 70, "sigint": 130, "sigterm": 143, "sighup": 129}[reason]
            require(child.returncode == expected_code and stderr == b"", "CLEANUP_PROBE_FAILED")
            expected_reason = {"normal": "NORMAL_RETURN", "operation_error": "OPERATION_EXCEPTION", "sigint": "SIGINT", "sigterm": "SIGTERM", "sighup": "SIGHUP"}[reason]
            expected = f"WP4158_CLEANUP_EXIT probe=cleanup_{phase}_{reason} phase={phase} reason={expected_reason}\n".encode()
            require(stdout == expected, "CLEANUP_PROBE_FAILED")
            require(not pending.exists() and not final.exists() and canary.read_bytes() == b"canary", "CLEANUP_PROBE_FAILED")
            require(time.monotonic() < total_deadline, "CLEANUP_PROBE_FAILED")
        finally:
            for fd in (root_fd, ready_r, ready_w, release_r, release_w, cleanup_ready_r, cleanup_ready_w, cleanup_go_r, cleanup_go_w, signal_ack_r, signal_ack_w):
                if fd >= 0:
                    try: os.close(fd)
                    except OSError: pass
            reap_probe_child(child, verified_pgid, "CLEANUP_PROBE_FAILED")
            if child is not None:
                require(child.poll() is not None, "CLEANUP_PROBE_FAILED")
            remove_probe_owned(pending, final)
            require(canary.read_bytes() == b"canary", "CLEANUP_PROBE_FAILED")
    require(time.monotonic() < total_deadline, "CLEANUP_PROBE_FAILED")


def exact_pid_reap_guard():
    with tempfile.TemporaryDirectory(prefix="wp4158-exact-pid-reap-") as root_text:
        root = pathlib.Path(root_text)
        os.chmod(root, 0o700)
        root_identity = identity(root.lstat())
        canary = root / "canary"
        canary.write_bytes(b"canary")
        os.chmod(canary, 0o600)
        canary_identity = identity(canary.lstat())
        child_source = (
            "import os,signal,sys,time;"
            "signal.signal(signal.SIGTERM,signal.SIG_IGN);"
            "os.open(sys.argv[1],os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);"
            "os.write(1,b'R');"
            "time.sleep(10)"
        )
        child = subprocess.Popen(
            [str(pathlib.Path(sys.executable).resolve(strict=True)), "-I", "-c", child_source, str(root)],
            cwd=str(pathlib.Path.cwd().resolve()),
            env={"LC_ALL": "C", "LANG": "C"},
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            close_fds=True,
            start_new_session=True,
        )
        started = time.monotonic()
        try:
            readable, _, _ = select.select([child.stdout], [], [], 1)
            require(readable == [child.stdout] and os.read(child.stdout.fileno(), 2) == b"R", "CLEANUP_EXACT_PID_REAP_GUARD_FAILED")
            reap_probe_child(child, None, "CLEANUP_EXACT_PID_REAP_GUARD_FAILED")
            require(child.returncode == -signal.SIGKILL, "CLEANUP_EXACT_PID_REAP_GUARD_FAILED")
            remaining_stdout, stderr = child.communicate(timeout=0.5)
            require(remaining_stdout == b"" and stderr == b"", "CLEANUP_EXACT_PID_REAP_GUARD_FAILED")
            require(time.monotonic() - started < 2, "CLEANUP_EXACT_PID_REAP_GUARD_FAILED")
            require(root.is_dir() and identity(root.lstat()) == root_identity, "CLEANUP_EXACT_PID_REAP_GUARD_FAILED")
            require(canary.read_bytes() == b"canary" and identity(canary.lstat()) == canary_identity, "CLEANUP_EXACT_PID_REAP_GUARD_FAILED")
        finally:
            if child.poll() is None:
                child.kill()
                try:
                    child.wait(1)
                except subprocess.TimeoutExpired as exc:
                    raise VerificationError("CLEANUP_EXACT_PID_REAP_GUARD_FAILED") from exc
    require(not root.exists(), "CLEANUP_EXACT_PID_REAP_GUARD_FAILED")


def cleanup_path_guard_probe():
    def rejected(root, phase="pending", cwd=None):
        ready_r, ready_w = os.pipe(); release_r, release_w = os.pipe()
        cleanup_ready_r, cleanup_ready_w = os.pipe(); cleanup_go_r, cleanup_go_w = os.pipe(); signal_ack_r, signal_ack_w = os.pipe()
        root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        command = [sys.executable, "-I", __file__, "--cleanup-child", "--phase", phase, "--reason", "normal", "--root", str(root), "--root-fd", str(root_fd), "--ready-fd", str(ready_w), "--release-fd", str(release_r), "--cleanup-ready-fd", str(cleanup_ready_w), "--cleanup-go-fd", str(cleanup_go_r), "--signal-ack-fd", str(signal_ack_w)]
        try:
            return subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, pass_fds=(root_fd, ready_w, release_r, cleanup_ready_w, cleanup_go_r, signal_ack_w), timeout=2, cwd=cwd)
        finally:
            for fd in (root_fd, ready_r, ready_w, release_r, release_w, cleanup_ready_r, cleanup_ready_w, cleanup_go_r, cleanup_go_w, signal_ack_r, signal_ack_w):
                try: os.close(fd)
                except OSError: pass

    with tempfile.TemporaryDirectory(prefix="wp4158-cleanup-guard-") as parent:
        os.chmod(parent, 0o700); root = pathlib.Path(parent)
        pending, final, canary = root / "pending", root / "final", root / "canary"
        canary.write_bytes(b"canary"); os.chmod(canary, 0o600)
        pending.mkdir(mode=0o700); sentinel = pending / "preexisting"; sentinel.write_bytes(b"must-survive"); os.chmod(sentinel, 0o600)
        child = rejected(root)
        require(child.returncode == 1 and child.stdout == b"" and child.stderr == b"CLEANUP_PATH_INVALID\n", "CLEANUP_PATH_GUARD_FAILED")
        require(sentinel.read_bytes() == b"must-survive" and canary.read_bytes() == b"canary" and not final.exists(), "CLEANUP_PATH_GUARD_FAILED")

    with tempfile.TemporaryDirectory(prefix="wp4158-cleanup-guard-") as parent:
        os.chmod(parent, 0o700); root = pathlib.Path(parent)
        canary = root / "canary"; canary.write_bytes(b"canary"); os.chmod(canary, 0o600)
        dangling = root / "final"; dangling.symlink_to(root / "missing")
        child = rejected(root, "final")
        require(child.returncode == 1 and child.stdout == b"" and child.stderr == b"CLEANUP_PATH_INVALID\n" and dangling.is_symlink(), "CLEANUP_PATH_GUARD_FAILED")

    with tempfile.TemporaryDirectory(prefix="wp4158-cleanup-guard-") as parent:
        os.chmod(parent, 0o700); root = pathlib.Path(parent)
        canary = root / "canary"; canary.write_bytes(b"canary-suffix"); os.chmod(canary, 0o600)
        child = rejected(root)
        require(child.returncode == 1 and child.stdout == b"" and child.stderr == b"CLEANUP_PATH_INVALID\n" and canary.read_bytes() == b"canary-suffix", "CLEANUP_PATH_GUARD_FAILED")

    with tempfile.TemporaryDirectory(prefix="wp4158-cleanup-guard-") as parent:
        os.chmod(parent, 0o700); root = pathlib.Path(parent)
        canary = root / "canary"; canary.write_bytes(b"canary"); os.chmod(canary, 0o600)
        nested_cwd = root / "nested/cwd"; nested_cwd.mkdir(parents=True, mode=0o700)
        child = rejected(root, cwd=nested_cwd)
        require(child.returncode == 1 and child.stdout == b"" and child.stderr == b"CLEANUP_PATH_INVALID\n" and canary.read_bytes() == b"canary", "CLEANUP_PATH_GUARD_FAILED")

    with tempfile.TemporaryDirectory(prefix="wp4158-cleanup-guard-") as parent:
        os.chmod(parent, 0o700); root = pathlib.Path(parent)
        canary = root / "canary"; canary.write_bytes(b"canary"); os.chmod(canary, 0o600)
        root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.mkdir("pending", 0o700, dir_fd=root_fd); os.mkdir("final", 0o700, dir_fd=root_fd)
            pending_before = identity(entry_at(root_fd, "pending")); final_before = identity(entry_at(root_fd, "final"))
            try: rename_noreplace(root_fd, "pending", "final")
            except VerificationError as exc: require(str(exc) == "CLEANUP_TARGET_EXISTS", "CLEANUP_PATH_GUARD_FAILED")
            else: raise VerificationError("CLEANUP_PATH_GUARD_FAILED")
            require(identity(entry_at(root_fd, "pending")) == pending_before and identity(entry_at(root_fd, "final")) == final_before, "CLEANUP_PATH_GUARD_FAILED")
        finally: os.close(root_fd)


def live_context_cleanup_guard():
    catchable = {signal.SIGINT, signal.SIGTERM, signal.SIGHUP}
    context_signals = catchable | {signal.SIGALRM}
    for delivered in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP, signal.SIGALRM):
        deferred = None
        cleanup_active = True
        old_handlers = {sig: signal.getsignal(sig) for sig in context_signals}
        def defer(signum, _frame):
            nonlocal deferred
            if cleanup_active:
                deferred = deferred or signum
                return
            raise ProbeSignal(signum)
        for sig in context_signals: signal.signal(sig, defer)
        owner_root = create_private_root("wp4158-live-cleanup-guard-"); (owner_root / "nested").mkdir(mode=0o700)
        original_rmtree = shutil.rmtree
        injected = False
        def injecting_rmtree(path, *args, **kwargs):
            nonlocal injected
            if pathlib.Path(path) == owner_root and not injected:
                injected = True
                os.kill(os.getpid(), delivered)
            return original_rmtree(path, *args, **kwargs)
        shutil.rmtree = injecting_rmtree
        previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, context_signals)
        try: shutil.rmtree(owner_root)
        finally:
            shutil.rmtree = original_rmtree
            signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
        cleanup_active = False
        for sig, handler in old_handlers.items(): signal.signal(sig, handler)
        require(injected and deferred == delivered and not owner_root.exists(), "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    deferred_alarm = False
    cleanup_active = True
    old_alarm_handler = signal.getsignal(signal.SIGALRM)
    def defer_alarm(signum, _frame):
        nonlocal deferred_alarm
        require(signum == signal.SIGALRM, "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
        if cleanup_active:
            deferred_alarm = True
            return
        raise ProbeSignal(signum)
    signal.signal(signal.SIGALRM, defer_alarm)
    owner_root = create_private_root("wp4158-live-owned-cleanup-guard-")
    pending, final = owner_root / "pending", owner_root / "final"
    pending.mkdir(mode=0o700); (pending / "partial").write_bytes(b"synthetic")
    original_rmtree = shutil.rmtree
    injected = False
    def injecting_owned_rmtree(path, *args, **kwargs):
        nonlocal injected
        if pathlib.Path(path) == pending and not injected:
            injected = True
            os.kill(os.getpid(), signal.SIGALRM)
        return original_rmtree(path, *args, **kwargs)
    shutil.rmtree = injecting_owned_rmtree
    previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGALRM})
    try: remove_probe_owned(pending, final)
    finally:
        shutil.rmtree = original_rmtree
        signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
    cleanup_active = False
    signal.signal(signal.SIGALRM, old_alarm_handler)
    require(injected and deferred_alarm and not pending.exists() and not final.exists(), "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    shutil.rmtree(owner_root)
    for delivered in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        deferred = None
        cleanup_active = True
        old_handlers = {sig: signal.getsignal(sig) for sig in catchable}
        def defer_allocation(signum, _frame):
            nonlocal deferred
            if cleanup_active:
                deferred = deferred or signum
                return
            raise ProbeSignal(signum)
        for sig in catchable: signal.signal(sig, defer_allocation)
        allocated_root = None
        def inject_allocation(path):
            nonlocal allocated_root
            allocated_root = path
            os.kill(os.getpid(), delivered)
        previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, catchable)
        owner_root = None
        try: owner_root = create_private_root("wp4158-live-allocation-guard-", inject_allocation)
        finally: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
        previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, catchable)
        try: shutil.rmtree(owner_root)
        finally: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
        cleanup_active = False
        for sig, handler in old_handlers.items(): signal.signal(sig, handler)
        require(deferred == delivered and allocated_root is not None and not allocated_root.exists(), "LIVE_ALLOCATION_CLEANUP_GUARD_FAILED")
    deferred_timeout = False
    transition_operation_complete = False
    cleanup_active = True
    post_timeout_operation = False
    allocation_timeout_error = None
    old_alarm_handler = signal.getsignal(signal.SIGALRM)
    def defer_allocation_timeout(signum, _frame):
        nonlocal deferred_timeout
        require(signum == signal.SIGALRM, "LIVE_ALLOCATION_CLEANUP_GUARD_FAILED")
        if cleanup_active:
            deferred_timeout = True
            return
        raise ProbeSignal(signum)
    signal.signal(signal.SIGALRM, defer_allocation_timeout)
    allocated_root = None
    def inject_allocation_timeout(path):
        nonlocal allocated_root
        allocated_root = path
        os.kill(os.getpid(), signal.SIGALRM)
    previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGALRM})
    owner_root = None
    try: owner_root = create_private_root("wp4158-live-allocation-timeout-guard-", inject_allocation_timeout)
    finally: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
    try:
        if deferred_timeout: raise VerificationError("TRANSPORT_LIMIT")
        post_timeout_operation = True
    except VerificationError as exc: allocation_timeout_error = str(exc)
    finally:
        previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGALRM})
        try: shutil.rmtree(owner_root)
        finally: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
        cleanup_active = False
        signal.signal(signal.SIGALRM, old_alarm_handler)
    require(allocation_timeout_error == "TRANSPORT_LIMIT" and deferred_timeout and not post_timeout_operation, "LIVE_ALLOCATION_CLEANUP_GUARD_FAILED")
    require(allocated_root is not None and not allocated_root.exists(), "LIVE_ALLOCATION_CLEANUP_GUARD_FAILED")
    cleanup_active = False
    deferred_timeout = False
    transition_primary = None
    old_alarm_handler = signal.getsignal(signal.SIGALRM)
    transition_root = create_private_root("wp4158-live-finally-transition-guard-")
    def transition_stop(signum, _frame):
        nonlocal cleanup_active, deferred_timeout
        require(signum == signal.SIGALRM, "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
        if not cleanup_active:
            cleanup_active = True
            deferred_timeout = True
            if sys.exc_info()[0] is not None or transition_operation_complete: return
            raise VerificationError("TRANSPORT_LIMIT")
        deferred_timeout = True
    signal.signal(signal.SIGALRM, transition_stop)
    try:
        try: raise RuntimeError("synthetic primary operation failure")
        finally:
            os.kill(os.getpid(), signal.SIGALRM)
            had_error = sys.exc_info()[0] is not None
            previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGALRM})
            try: shutil.rmtree(transition_root)
            finally: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
            require(had_error, "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    except RuntimeError as exc: transition_primary = str(exc)
    finally:
        cleanup_active = False
        signal.signal(signal.SIGALRM, old_alarm_handler)
    require(transition_primary == "synthetic primary operation failure" and deferred_timeout and not transition_root.exists(), "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    for delivered in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP, signal.SIGALRM):
        for primary in (False, True):
            cleanup_active = False
            transition_operation_complete = not primary
            transition_primary = None
            transition_deferred = None
            transition_timeout = False
            old_handler = signal.getsignal(delivered)
            transition_root = create_private_root("wp4158-live-finally-all-signals-")
            def transition_all(signum, _frame):
                nonlocal cleanup_active, transition_deferred, transition_timeout
                if signum == signal.SIGALRM: transition_timeout = True
                else: transition_deferred = transition_deferred or signum
                if not cleanup_active:
                    cleanup_active = True
                    if sys.exc_info()[0] is not None or transition_operation_complete: return
                    raise ProbeSignal(signum)
            signal.signal(delivered, transition_all)
            try:
                try:
                    if primary: raise RuntimeError("synthetic transition primary")
                finally:
                    os.kill(os.getpid(), delivered)
                    previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, {delivered})
                    try: shutil.rmtree(transition_root)
                    finally: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
            except RuntimeError as exc: transition_primary = str(exc)
            finally:
                cleanup_active = False
                signal.signal(delivered, old_handler)
            require(not transition_root.exists(), "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
            require((transition_timeout if delivered == signal.SIGALRM else transition_deferred == delivered), "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
            require(transition_primary == ("synthetic transition primary" if primary else None), "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    write_root = create_private_root("wp4158-live-write-failure-")
    write_root_fd = os.open(write_root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    write_root_identity = identity(os.fstat(write_root_fd))
    write_owned_fd, write_owned_identity = begin_owned_dir(write_root_fd, "pending")
    write_files = {}
    write_error = None
    write_fd = None
    previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, context_signals)
    try:
        write_fd, write_identity = begin_owned_file(write_owned_fd, "partial.tgz")
        write_files["partial.tgz"] = write_identity
    finally: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
    try:
        with os.fdopen(write_fd, "wb") as stream:
            stream.write(b"partial")
            stream.flush()
            raise OSError("synthetic write failure")
    except OSError as exc: write_error = str(exc)
    finally:
        previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, context_signals)
        try:
            for name, file_identity in write_files.items(): remove_owned_file(write_owned_fd, name, file_identity)
            remove_owned_dir(write_root_fd, "pending", write_owned_fd, write_owned_identity)
            os.close(write_owned_fd)
            require(identity(write_root.lstat()) == write_root_identity, "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
            os.rmdir(write_root)
        finally:
            os.close(write_root_fd)
            signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
    require(write_error == "synthetic write failure" and not write_root.exists(), "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    directory_root = create_private_root("wp4158-owned-dir-transaction-")
    directory_root_fd = os.open(directory_root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    original_mkdir = os.mkdir
    directory_error = None
    def fail_after_owned_mkdir(path, mode=0o777, *, dir_fd=None):
        original_mkdir(path, mode=mode, dir_fd=dir_fd)
        raise MemoryError("synthetic owned mkdir-return failure")
    os.mkdir = fail_after_owned_mkdir
    try: begin_owned_dir(directory_root_fd, "pending")
    except MemoryError as exc: directory_error = str(exc)
    finally: os.mkdir = original_mkdir
    require(directory_error == "synthetic owned mkdir-return failure" and entry_at(directory_root_fd, "pending") is None, "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    owned_fd, owned_identity = begin_owned_dir(directory_root_fd, "pending")
    original_rename_noreplace = rename_noreplace
    rename_error = None
    def fail_after_owned_rename(parent_fd, source, target):
        original_rename_noreplace(parent_fd, source, target)
        raise MemoryError("synthetic owned rename-return failure")
    globals()["rename_noreplace"] = fail_after_owned_rename
    try: finalize_owned_dir(directory_root_fd, "pending", "final", owned_fd, owned_identity)
    except MemoryError as exc: rename_error = str(exc)
    finally: globals()["rename_noreplace"] = original_rename_noreplace
    require(rename_error == "synthetic owned rename-return failure", "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    require_owned_dir(directory_root_fd, "pending", owned_fd, owned_identity)
    require(entry_at(directory_root_fd, "final") is None, "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    remove_owned_dir(directory_root_fd, "pending", owned_fd, owned_identity)
    os.close(owned_fd); os.close(directory_root_fd); os.rmdir(directory_root)
    require(not directory_root.exists(), "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    umask_root = create_private_root("wp4158-owned-dir-umask-")
    umask_root_fd = os.open(umask_root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    old_umask = os.umask(0o777)
    try: umask_fd, umask_identity = begin_owned_dir(umask_root_fd, "pending")
    finally: os.umask(old_umask)
    require(stat.S_IMODE(entry_at(umask_root_fd, "pending").st_mode) == 0o700, "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    remove_owned_dir(umask_root_fd, "pending", umask_fd, umask_identity)
    os.close(umask_fd)
    original_mkdir = os.mkdir
    restrictive_owned_error = None
    def fail_after_restrictive_owned_mkdir(path, mode=0o777, *, dir_fd=None):
        original_mkdir(path, mode=mode, dir_fd=dir_fd)
        raise MemoryError("synthetic restrictive owned mkdir-return failure")
    old_umask = os.umask(0o777)
    os.mkdir = fail_after_restrictive_owned_mkdir
    try: begin_owned_dir(umask_root_fd, "pending")
    except MemoryError as exc: restrictive_owned_error = str(exc)
    finally:
        os.mkdir = original_mkdir
        os.umask(old_umask)
    require(restrictive_owned_error == "synthetic restrictive owned mkdir-return failure" and entry_at(umask_root_fd, "pending") is None, "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    os.close(umask_root_fd); os.rmdir(umask_root)
    open_root = create_private_root("wp4158-owned-open-return-")
    open_root_fd = os.open(open_root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    original_open = os.open
    leaked_identity = None
    directory_open_error = None
    def fail_after_directory_open(path, flags, mode=0o777, *, dir_fd=None):
        nonlocal leaked_identity
        result = original_open(path, flags, mode, dir_fd=dir_fd)
        if path == "pending" and dir_fd == open_root_fd:
            leaked_identity = identity(os.fstat(result))
            raise MemoryError("synthetic owned directory open-return failure")
        return result
    os.open = fail_after_directory_open
    try: begin_owned_dir(open_root_fd, "pending")
    except MemoryError as exc: directory_open_error = str(exc)
    finally: os.open = original_open
    require(directory_open_error == "synthetic owned directory open-return failure" and leaked_identity is not None, "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    require(entry_at(open_root_fd, "pending") is None and identity_fds(leaked_identity) == (), "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    file_parent_fd, file_parent_identity = begin_owned_dir(open_root_fd, "pending")
    leaked_identity = None
    file_open_error = None
    def fail_after_file_open(path, flags, mode=0o777, *, dir_fd=None):
        nonlocal leaked_identity
        result = original_open(path, flags, mode, dir_fd=dir_fd)
        if path == "partial.tgz" and dir_fd == file_parent_fd:
            leaked_identity = identity(os.fstat(result))
            raise MemoryError("synthetic owned file open-return failure")
        return result
    os.open = fail_after_file_open
    try: begin_owned_file(file_parent_fd, "partial.tgz")
    except MemoryError as exc: file_open_error = str(exc)
    finally: os.open = original_open
    require(file_open_error == "synthetic owned file open-return failure" and leaked_identity is not None, "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    require(entry_at(file_parent_fd, "partial.tgz") is None and identity_fds(leaked_identity) == (), "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    remove_owned_dir(open_root_fd, "pending", file_parent_fd, file_parent_identity)
    os.close(file_parent_fd); os.close(open_root_fd); os.rmdir(open_root)
    owner_open_root = create_private_root("wp4158-owner-open-return-")
    leaked_identity = None
    owner_open_error = None
    def fail_after_owner_open(path, flags, mode=0o777, *, dir_fd=None):
        nonlocal leaked_identity
        result = original_open(path, flags, mode, dir_fd=dir_fd)
        if pathlib.Path(path) == owner_open_root:
            leaked_identity = identity(os.fstat(result))
            raise MemoryError("synthetic owner open-return failure")
        return result
    os.open = fail_after_owner_open
    try: open_owned_path(owner_open_root)
    except MemoryError as exc: owner_open_error = str(exc)
    finally: os.open = original_open
    require(owner_open_error == "synthetic owner open-return failure" and leaked_identity is not None and identity_fds(leaked_identity) == (), "LIVE_CONTEXT_CLEANUP_GUARD_FAILED")
    os.rmdir(owner_open_root)
    attempted_root = None
    preserved_error = None
    def fail_after_create(path):
        nonlocal attempted_root
        attempted_root = path
        raise MemoryError("synthetic post-mkdir failure")
    try:
        create_private_root("wp4158-live-allocation-error-", fail_after_create)
    except MemoryError as exc: preserved_error = str(exc)
    require(preserved_error == "synthetic post-mkdir failure" and attempted_root is not None and not attempted_root.exists(), "LIVE_ALLOCATION_CLEANUP_GUARD_FAILED")
    call_boundary_root = None
    call_boundary_error = None
    original_mkdir = os.mkdir
    def fail_before_mkdir_return(path, mode=0o777, *, dir_fd=None):
        nonlocal call_boundary_root
        original_mkdir(path, mode=mode, dir_fd=dir_fd)
        call_boundary_root = pathlib.Path(path)
        raise MemoryError("synthetic mkdir-return failure")
    os.mkdir = fail_before_mkdir_return
    try:
        create_private_root("wp4158-live-mkdir-return-error-")
    except MemoryError as exc: call_boundary_error = str(exc)
    finally: os.mkdir = original_mkdir
    require(call_boundary_error == "synthetic mkdir-return failure" and call_boundary_root is not None and not call_boundary_root.exists(), "LIVE_ALLOCATION_CLEANUP_GUARD_FAILED")
    restrictive_root = None
    restrictive_error = None
    original_mkdir = os.mkdir
    def fail_restrictive_mkdir_return(path, mode=0o777, *, dir_fd=None):
        nonlocal restrictive_root
        original_mkdir(path, mode=mode, dir_fd=dir_fd)
        restrictive_root = pathlib.Path(path)
        raise MemoryError("synthetic restrictive-mkdir-return failure")
    old_umask = os.umask(0o777)
    os.mkdir = fail_restrictive_mkdir_return
    try:
        create_private_root("wp4158-live-restrictive-mkdir-error-")
    except MemoryError as exc: restrictive_error = str(exc)
    finally:
        os.mkdir = original_mkdir
        os.umask(old_umask)
    require(restrictive_error == "synthetic restrictive-mkdir-return failure" and restrictive_root is not None and not restrictive_root.exists(), "LIVE_ALLOCATION_CLEANUP_GUARD_FAILED")
    collision_prefix = f"wp4158-live-collision-{os.urandom(8).hex()}-"
    collision_bytes, success_bytes = b"\x00" * 16, b"\x01" * 16
    temp_parent = pathlib.Path(tempfile.gettempdir()).resolve()
    preexisting = temp_parent / f"{collision_prefix}{collision_bytes.hex()}"
    preexisting.mkdir(mode=0o700); collision_sentinel = preexisting / "sentinel"; collision_sentinel.write_bytes(b"must-survive")
    original_urandom = os.urandom
    choices = [collision_bytes, success_bytes]
    def collision_then_success(size):
        return choices.pop(0) if choices else original_urandom(size)
    os.urandom = collision_then_success
    allocated = None
    try: allocated = create_private_root(collision_prefix)
    finally: os.urandom = original_urandom
    require(collision_sentinel.read_bytes() == b"must-survive" and allocated.name == f"{collision_prefix}{success_bytes.hex()}", "LIVE_ALLOCATION_CLEANUP_GUARD_FAILED")
    shutil.rmtree(allocated); shutil.rmtree(preexisting)
    file_exists_root = None
    file_exists_error = None
    original_mkdir = os.mkdir
    def fail_file_exists_before_return(path, mode=0o777, *, dir_fd=None):
        nonlocal file_exists_root
        original_mkdir(path, mode=mode, dir_fd=dir_fd)
        file_exists_root = pathlib.Path(path)
        raise FileExistsError("synthetic post-mkdir FileExistsError")
    os.mkdir = fail_file_exists_before_return
    try:
        create_private_root("wp4158-live-file-exists-error-")
    except FileExistsError as exc: file_exists_error = str(exc)
    finally: os.mkdir = original_mkdir
    require(file_exists_error == "synthetic post-mkdir FileExistsError" and file_exists_root is not None and not file_exists_root.exists(), "LIVE_ALLOCATION_CLEANUP_GUARD_FAILED")


def signal_transition_guard():
    context_signals = {signal.SIGINT, signal.SIGTERM, signal.SIGHUP, signal.SIGALRM}
    system_handlers = {sig: signal.getsignal(sig) for sig in context_signals}
    original_timer = signal.getitimer(signal.ITIMER_REAL)
    original_mask = signal.pthread_sigmask(signal.SIG_BLOCK, set())
    try:
        signal.setitimer(signal.ITIMER_REAL, 0)
        for site in ("allocation", "success_tail", "outer_finalizer"):
            for delivered in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP, signal.SIGALRM):
                state = SignalState()
                state.cleanup_active = True
                post_transition_calls = 0
                transition_error = None
                restored_delivery = None
                owner_root = create_private_root(f"wp4158-{site}-guard-")
                owner_fd, owner_identity = open_owned_path(owner_root)
                def restored_handler(signum, _frame):
                    nonlocal restored_delivery
                    restored_delivery = signum
                    raise ProbeSignal(signum)
                restored_handlers = {sig: restored_handler for sig in context_signals}
                for sig, handler in restored_handlers.items(): signal.signal(sig, handler)
                def transition_stop(signum, _frame):
                    if state.cleanup_active:
                        state.record(signum)
                        return
                    state.cleanup_active = True
                    state.record(signum)
                    if signum == signal.SIGALRM: raise VerificationError("TRANSPORT_LIMIT")
                    raise InterruptedError(signum)
                for sig in context_signals: signal.signal(sig, transition_stop)
                def operation():
                    nonlocal owner_fd
                    if site != "allocation":
                        os.close(owner_fd); owner_fd = None
                        os.rmdir(owner_root)
                def inject_after_decision():
                    os.kill(os.getpid(), delivered)
                def restore_handlers():
                    for sig, handler in restored_handlers.items(): signal.signal(sig, handler)
                try:
                    run_signal_transition(
                        context_signals,
                        state,
                        operation,
                        before_deactivate=inject_after_decision,
                        restore=restore_handlers if site != "allocation" else None,
                    )
                    post_transition_calls += 1
                except VerificationError as exc:
                    transition_error = ("timeout", str(exc))
                except InterruptedError as exc:
                    transition_error = ("signal", exc.args[0])
                except ProbeSignal as exc:
                    transition_error = ("restored", exc.signum)
                finally:
                    signal.pthread_sigmask(signal.SIG_BLOCK, context_signals)
                    if owner_fd is not None: os.close(owner_fd)
                    if owner_root.exists(): os.rmdir(owner_root)
                    for sig, handler in system_handlers.items(): signal.signal(sig, handler)
                    signal.pthread_sigmask(signal.SIG_SETMASK, original_mask)
                expected = (
                    ("timeout", "TRANSPORT_LIMIT") if delivered == signal.SIGALRM else ("signal", delivered)
                ) if site == "allocation" else ("restored", delivered)
                require(transition_error == expected and post_transition_calls == 0, "LIVE_SIGNAL_TRANSITION_GUARD_FAILED")
                require((restored_delivery == delivered) == (site != "allocation"), "LIVE_SIGNAL_TRANSITION_GUARD_FAILED")
                require(not owner_root.exists() and identity_fds(owner_identity) == (), "LIVE_SIGNAL_TRANSITION_GUARD_FAILED")
                require(signal.pthread_sigmask(signal.SIG_BLOCK, set()) == original_mask, "LIVE_SIGNAL_TRANSITION_GUARD_FAILED")
                require(all(signal.getsignal(sig) is system_handlers[sig] for sig in context_signals), "LIVE_SIGNAL_TRANSITION_GUARD_FAILED")
                require(signal.getitimer(signal.ITIMER_REAL) == (0.0, 0.0), "LIVE_SIGNAL_TRANSITION_GUARD_FAILED")
    finally:
        signal.pthread_sigmask(signal.SIG_BLOCK, context_signals)
        for sig, handler in system_handlers.items(): signal.signal(sig, handler)
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.pthread_sigmask(signal.SIG_SETMASK, original_mask)
        signal.setitimer(signal.ITIMER_REAL, *original_timer)


def transition_primary_child(args):
    signal_names = {
        "SIGINT": signal.SIGINT,
        "SIGTERM": signal.SIGTERM,
        "SIGHUP": signal.SIGHUP,
        "SIGALRM": signal.SIGALRM,
    }
    context_signals = set(signal_names.values())
    delivered = signal_names.get(args.signal_name)
    require(delivered is not None and args.signal_phase in {"pre_snapshot", "post_snapshot"}, "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    expected_handlers = {
        signal.SIGINT: signal.default_int_handler,
        signal.SIGTERM: signal.SIG_DFL,
        signal.SIGHUP: signal.SIG_DFL,
        signal.SIGALRM: signal.SIG_DFL,
    }
    signal.pthread_sigmask(signal.SIG_SETMASK, context_signals)
    for signum, handler in expected_handlers.items():
        signal.signal(signum, handler)
    require(not (signal.sigpending() & context_signals), "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    signal.setitimer(signal.ITIMER_REAL, 0)
    signal.pthread_sigmask(signal.SIG_SETMASK, set())
    original_mask = signal.pthread_sigmask(signal.SIG_BLOCK, set())
    original_timer = signal.getitimer(signal.ITIMER_REAL)
    original_handlers = {signum: signal.getsignal(signum) for signum in context_signals}
    require(original_mask == set() and original_timer == (0.0, 0.0), "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    require(all(original_handlers[signum] is handler for signum, handler in expected_handlers.items()), "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")

    root = pathlib.Path(args.root or "")
    require(root.is_absolute(), "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    root_lstat = root.lstat()
    require(stat.S_ISDIR(root_lstat.st_mode) and not stat.S_ISLNK(root_lstat.st_mode), "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    require(root_lstat.st_uid == os.getuid() and stat.S_IMODE(root_lstat.st_mode) == 0o700, "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    require(not paths_overlap(root, pathlib.Path.cwd().resolve(), "LIVE_SIGNAL_PRIMARY_CHILD_FAILED"), "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    root_identity = identity(root_lstat)
    require(identity(os.fstat(root_fd)) == root_identity, "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    canary_info = entry_at(root_fd, "canary")
    require(canary_info is not None and stat.S_ISREG(canary_info.st_mode) and stat.S_IMODE(canary_info.st_mode) == 0o600, "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    canary_fd = os.open("canary", os.O_RDONLY | os.O_NOFOLLOW, dir_fd=root_fd)
    try:
        require(os.read(canary_fd, 7) == b"canary" and os.read(canary_fd, 1) == b"", "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    finally:
        os.close(canary_fd)
    require(entry_at(root_fd, "owned") is None, "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")

    owned_fd = None
    owned_identity = None
    state = SignalState()
    state.cleanup_active = True
    primary_error = RuntimeError("synthetic transition primary")
    raised_traceback = None
    caught_primary = None
    handler_deliveries = 0
    snapshot_injections = 0
    try:
        owned_fd, owned_identity = begin_owned_dir(root_fd, "owned")
        def transition_stop(signum, _frame):
            nonlocal handler_deliveries
            handler_deliveries += 1
            if state.cleanup_active:
                state.record(signum)
                return
            raise VerificationError("LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
        for signum in context_signals:
            signal.signal(signum, transition_stop)
        def primary_operation():
            nonlocal raised_traceback
            if args.signal_phase == "pre_snapshot":
                os.kill(os.getpid(), delivered)
            try:
                raise primary_error
            except RuntimeError as exc:
                raised_traceback = exc.__traceback__
                raise
        def restore_handlers():
            for signum, handler in original_handlers.items():
                signal.signal(signum, handler)
        original_sigpending = signal.sigpending
        if args.signal_phase == "post_snapshot":
            def inject_after_snapshot():
                nonlocal snapshot_injections
                snapshot = original_sigpending()
                if snapshot_injections == 0:
                    snapshot_injections += 1
                    os.kill(os.getpid(), delivered)
                return snapshot
            signal.sigpending = inject_after_snapshot
        try:
            try:
                run_signal_transition(context_signals, state, primary_operation, restore=restore_handlers)
            except RuntimeError as exc:
                current_traceback = exc.__traceback__
                traceback_retained = False
                while current_traceback is not None:
                    if current_traceback is raised_traceback:
                        traceback_retained = True
                        break
                    current_traceback = current_traceback.tb_next
                caught_primary = (
                    exc is primary_error,
                    type(exc) is RuntimeError,
                    str(exc),
                    tuple(getattr(exc, "__notes__", ())),
                    traceback_retained,
                )
        finally:
            signal.sigpending = original_sigpending
        require(caught_primary == (True, True, "synthetic transition primary", (), True), "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
        require(snapshot_injections == (1 if args.signal_phase == "post_snapshot" else 0), "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
        require(handler_deliveries == (1 if args.signal_phase == "post_snapshot" else 0), "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
        require(not state.cleanup_active and not (signal.sigpending() & context_signals), "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
        if delivered == signal.SIGALRM:
            require(state.deferred_signal is None and state.deferred_timeout, "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
        else:
            require(state.deferred_signal == delivered and not state.deferred_timeout, "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
        require(signal.pthread_sigmask(signal.SIG_BLOCK, set()) == original_mask, "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
        require(signal.getitimer(signal.ITIMER_REAL) == original_timer, "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
        require(all(signal.getsignal(signum) is original_handlers[signum] for signum in context_signals), "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    finally:
        signal.pthread_sigmask(signal.SIG_BLOCK, context_signals)
        for signum, handler in original_handlers.items():
            signal.signal(signum, handler)
        signal.setitimer(signal.ITIMER_REAL, 0)
        try:
            if owned_fd is not None and owned_identity is not None:
                require_owned_dir(root_fd, "owned", owned_fd, owned_identity)
                remove_owned_dir(root_fd, "owned", owned_fd, owned_identity)
        finally:
            if owned_fd is not None:
                os.close(owned_fd)
            os.close(root_fd)
            signal.setitimer(signal.ITIMER_REAL, *original_timer)
            signal.pthread_sigmask(signal.SIG_SETMASK, original_mask)
    require(owned_identity is not None and identity_fds(owned_identity) == (), "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    require(identity_fds(root_identity) == (), "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    require(root.is_dir() and not (root / "owned").exists() and (root / "canary").read_bytes() == b"canary", "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    require(signal.pthread_sigmask(signal.SIG_BLOCK, set()) == original_mask, "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    require(signal.getitimer(signal.ITIMER_REAL) == original_timer, "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    require(all(signal.getsignal(signum) is original_handlers[signum] for signum in context_signals), "LIVE_SIGNAL_PRIMARY_CHILD_FAILED")
    print(f"WP4158_SIGNAL_PRIMARY_PASS phase={args.signal_phase} signal={args.signal_name} residue=0")
    return 0


def default_signal_primary_guard():
    aggregate_deadline = time.monotonic() + 10
    executable = pathlib.Path(sys.executable).resolve(strict=True)
    script = pathlib.Path(__file__).resolve(strict=True)
    cwd = pathlib.Path.cwd().resolve()
    for signal_phase in ("pre_snapshot", "post_snapshot"):
        for signal_name in ("SIGINT", "SIGTERM", "SIGHUP", "SIGALRM"):
            root_path = None
            with tempfile.TemporaryDirectory(prefix="wp4158-transition-primary-") as root_text:
                root_path = pathlib.Path(root_text)
                os.chmod(root_path, 0o700)
                root_identity = identity(root_path.lstat())
                canary = root_path / "canary"
                canary.write_bytes(b"canary")
                os.chmod(canary, 0o600)
                canary_identity = identity(canary.lstat())
                remaining = aggregate_deadline - time.monotonic()
                require(remaining > 0, "LIVE_SIGNAL_PRIMARY_GUARD_FAILED")
                command = [
                    str(executable), "-I", str(script),
                    "--transition-primary-child", "--signal-phase", signal_phase,
                    "--signal-name", signal_name, "--root", str(root_path),
                ]
                child = subprocess.Popen(
                    command,
                    cwd=str(cwd),
                    env={"LC_ALL": "C", "LANG": "C"},
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    close_fds=True,
                    start_new_session=True,
                )
                verified_pgid = None
                try:
                    require(os.getpgid(child.pid) == child.pid and child.pid != os.getpgrp(), "LIVE_SIGNAL_PRIMARY_GUARD_FAILED")
                    verified_pgid = child.pid
                    stdout, stderr = child.communicate(timeout=min(2, remaining))
                except subprocess.TimeoutExpired as exc:
                    reap_probe_child(child, verified_pgid, "LIVE_SIGNAL_PRIMARY_GUARD_FAILED")
                    raise VerificationError("LIVE_SIGNAL_PRIMARY_GUARD_FAILED") from exc
                finally:
                    reap_probe_child(child, verified_pgid, "LIVE_SIGNAL_PRIMARY_GUARD_FAILED")
                expected = f"WP4158_SIGNAL_PRIMARY_PASS phase={signal_phase} signal={signal_name} residue=0\n".encode()
                require(child.returncode == 0 and stdout == expected and stderr == b"", "LIVE_SIGNAL_PRIMARY_GUARD_FAILED")
                require(root_path.is_dir() and identity(root_path.lstat()) == root_identity, "LIVE_SIGNAL_PRIMARY_GUARD_FAILED")
                require(not (root_path / "owned").exists(), "LIVE_SIGNAL_PRIMARY_GUARD_FAILED")
                require(canary.read_bytes() == b"canary" and identity(canary.lstat()) == canary_identity, "LIVE_SIGNAL_PRIMARY_GUARD_FAILED")
                require(time.monotonic() < aggregate_deadline, "LIVE_SIGNAL_PRIMARY_GUARD_FAILED")
            require(root_path is not None and not root_path.exists(), "LIVE_SIGNAL_PRIMARY_GUARD_FAILED")


def validate_live_transition_ast(tree):
    live_nodes = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "live"]
    require(len(live_nodes) == 1, "LIVE_TRANSITION_BINDING_FAILED")
    live_node = live_nodes[0]
    transition_calls = [
        node for node in ast.walk(live_node)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "run_signal_transition"
    ]
    require(len(transition_calls) == 3, "LIVE_TRANSITION_BINDING_FAILED")
    transition_calls.sort(key=lambda node: (node.lineno, node.col_offset))
    callbacks = []
    for call in transition_calls:
        require(len(call.args) >= 3 and isinstance(call.args[2], ast.Name), "LIVE_TRANSITION_BINDING_FAILED")
        callbacks.append(call.args[2].id)
    require(callbacks == ["allocate_owner", "close_transport", "close_transport"], "LIVE_TRANSITION_BINDING_FAILED")
    require(not any(
        isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in {"allocate_owner", "close_transport"}
        for node in ast.walk(live_node)
    ), "LIVE_TRANSITION_BINDING_FAILED")
    require(not any(keyword.arg == "restore" for keyword in transition_calls[0].keywords), "LIVE_TRANSITION_BINDING_FAILED")
    for call in transition_calls[1:]:
        restore_keywords = [keyword for keyword in call.keywords if keyword.arg == "restore"]
        require(len(restore_keywords) == 1 and isinstance(restore_keywords[0].value, ast.Name) and restore_keywords[0].value.id == "restore_handlers", "LIVE_TRANSITION_BINDING_FAILED")
    deadline_keywords = [keyword for keyword in transition_calls[1].keywords if keyword.arg == "deadline"]
    require(len(deadline_keywords) == 1 and isinstance(deadline_keywords[0].value, ast.Name) and deadline_keywords[0].value.id == "deadline", "LIVE_TRANSITION_BINDING_FAILED")
    require(not any(keyword.arg == "deadline" for keyword in transition_calls[2].keywords), "LIVE_TRANSITION_BINDING_FAILED")
    create_calls = [
        node for node in ast.walk(live_node)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "create_private_root"
    ]
    require(len(create_calls) == 1, "LIVE_TRANSITION_BINDING_FAILED")
    allocate_nodes = [node for node in ast.walk(live_node) if isinstance(node, ast.FunctionDef) and node.name == "allocate_owner"]
    require(len(allocate_nodes) == 1 and create_calls[0] in tuple(ast.walk(allocate_nodes[0])), "LIVE_TRANSITION_BINDING_FAILED")
    for node in ast.walk(live_node):
        if not isinstance(node, (ast.Assign, ast.AnnAssign)):
            continue
        targets = node.targets if isinstance(node, ast.Assign) else (node.target,)
        for target in targets:
            if isinstance(target, ast.Attribute) and target.attr == "cleanup_active":
                require(not isinstance(node.value, ast.Constant) or node.value.value is not False, "LIVE_TRANSITION_BINDING_FAILED")
    return transition_calls


def live_transition_binding_guard():
    source_bytes = pathlib.Path(__file__).read_bytes()
    require(source_bytes.endswith(b"\n"), "LIVE_TRANSITION_BINDING_FAILED")
    tree = ast.parse(source_bytes, filename=__file__)
    calls = validate_live_transition_ast(tree)
    for target in (calls[0], calls[-1]):
        mutant = copy.deepcopy(tree)
        mutant_calls = [
            node for node in ast.walk(mutant)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "run_signal_transition"
        ]
        index = calls.index(target)
        mutant_calls[index].func.id = "bypass_signal_transition"
        try: validate_live_transition_ast(mutant)
        except VerificationError as exc: require(str(exc) == "LIVE_TRANSITION_BINDING_FAILED", "LIVE_TRANSITION_BINDING_FAILED")
        else: raise VerificationError("LIVE_TRANSITION_BINDING_FAILED")


def git_boundary_guard():
    for key in GIT_AMBIENT_KEYS + ("GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0"):
        for value in ("", "hostile"):
            try: validate_ambient({key: value})
            except VerificationError as exc: require(str(exc) == "TRANSPORT_POLICY", "GIT_BOUNDARY_GUARD_FAILED")
            else: raise VerificationError("GIT_BOUNDARY_GUARD_FAILED")

    original_run = subprocess.run
    original_monotonic = time.monotonic
    calls = []
    with tempfile.TemporaryDirectory(prefix="wp4158-git-guard-") as parent:
        parent_path = pathlib.Path(parent)
        fake_bin = parent_path / "bin"; fake_bin.mkdir(mode=0o700)
        fake_sentinel = parent_path / "fake-git-ran"
        fake_git = fake_bin / "git"
        fake_git.write_text(f"#!/bin/sh\nprintf ran > '{fake_sentinel}'\nexit 99\n")
        os.chmod(fake_git, 0o700)
        cwd = pathlib.Path.cwd().resolve()
        def synthetic_run(argv, **kwargs):
            calls.append((tuple(argv), kwargs))
            require(pathlib.Path(argv[0]).resolve() != fake_git.resolve(), "GIT_BOUNDARY_GUARD_FAILED")
            require(kwargs["cwd"] == str(cwd) and kwargs["stdin"] is subprocess.DEVNULL, "GIT_BOUNDARY_GUARD_FAILED")
            require(kwargs["env"] == {"LC_ALL": "C", "LANG": "C", "GIT_CONFIG_NOSYSTEM": "1", "GIT_TERMINAL_PROMPT": "0"}, "GIT_BOUNDARY_GUARD_FAILED")
            require(0 < kwargs["timeout"] <= 15 and kwargs["stdout"] is subprocess.PIPE and kwargs["stderr"] is subprocess.PIPE, "GIT_BOUNDARY_GUARD_FAILED")
            return subprocess.CompletedProcess(argv, 0, f"{cwd}\n.git\n.git\n".encode(), b"")
        original_path = os.environ.get("PATH")
        os.environ["PATH"] = str(fake_bin)
        subprocess.run = synthetic_run
        try:
            roots = bounded_git_roots(cwd, time.monotonic() + 30)
        finally:
            subprocess.run = original_run
            if original_path is None: os.environ.pop("PATH", None)
            else: os.environ["PATH"] = original_path
        require(roots == (str(cwd), ".git", ".git") and len(calls) == 1 and not fake_sentinel.exists(), "GIT_BOUNDARY_GUARD_FAILED")

        workspace = parent_path / "workspace"; workspace.mkdir(mode=0o700)
        nested_cwd = workspace / "repo"; nested_cwd.mkdir(mode=0o700)
        local_tmp = nested_cwd / "tmp"; local_tmp.mkdir(mode=0o700)
        owner_root = local_tmp / "owner"; owner_root.mkdir(mode=0o700)
        canary = nested_cwd / "canary"; canary.write_bytes(b"must-survive"); os.chmod(canary, 0o600)
        calls.clear()
        subprocess.run = synthetic_run
        try:
            try: discover_git_roots(owner_root, nested_cwd, time.monotonic() + 30)
            except VerificationError as exc: require(str(exc) == "TRANSPORT_POLICY", "GIT_BOUNDARY_GUARD_FAILED")
            else: raise VerificationError("GIT_BOUNDARY_GUARD_FAILED")
        finally:
            subprocess.run = original_run
        require(calls == [] and canary.read_bytes() == b"must-survive", "GIT_BOUNDARY_GUARD_FAILED")
        require(not (owner_root / "core.tgz").exists() and not (owner_root / "term.tgz").exists(), "GIT_BOUNDARY_GUARD_FAILED")

        alias_cwd = None
        cwd_parts = list(cwd.parts)
        for index in range(1, len(cwd_parts)):
            alternate = cwd_parts.copy()
            alternate[index] = alternate[index].swapcase()
            candidate = pathlib.Path(alternate[0]).joinpath(*alternate[1:])
            try:
                if candidate != cwd and os.path.samefile(candidate, cwd):
                    alias_cwd = candidate
                    break
            except OSError:
                continue
        if alias_cwd is not None:
            case_parent = cwd / f".wp4158-case-alias-{os.urandom(8).hex()}"
            owner_actual = case_parent / "owner"
            case_canary = case_parent / "canary"
            case_parent.mkdir(mode=0o700)
            owner_actual.mkdir(mode=0o700)
            case_canary.write_bytes(b"must-survive"); os.chmod(case_canary, 0o600)
            owner_alias = alias_cwd / case_parent.name / "owner"
            calls.clear()
            subprocess.run = synthetic_run
            try:
                try:
                    try: discover_git_roots(owner_alias, cwd, time.monotonic() + 30)
                    except VerificationError as exc: require(str(exc) == "TRANSPORT_POLICY", "GIT_BOUNDARY_GUARD_FAILED")
                    else: raise VerificationError("GIT_BOUNDARY_GUARD_FAILED")
                    require(calls == [] and case_canary.read_bytes() == b"must-survive", "GIT_BOUNDARY_GUARD_FAILED")
                    require(not (owner_actual / "core.tgz").exists() and not (owner_actual / "term.tgz").exists(), "GIT_BOUNDARY_GUARD_FAILED")
                finally:
                    if case_canary.exists(): case_canary.unlink()
                    if owner_actual.exists(): owner_actual.rmdir()
                    if case_parent.exists(): case_parent.rmdir()
            finally:
                subprocess.run = original_run
            require(not case_parent.exists(), "GIT_BOUNDARY_GUARD_FAILED")

        calls.clear()
        subprocess.run = synthetic_run
        time.monotonic = lambda: 10.0
        try:
            try: bounded_git_roots(cwd, 10.0)
            except VerificationError as exc: require(str(exc) == "TRANSPORT_LIMIT", "GIT_BOUNDARY_GUARD_FAILED")
            else: raise VerificationError("GIT_BOUNDARY_GUARD_FAILED")
        finally:
            time.monotonic = original_monotonic
            subprocess.run = original_run
        require(calls == [], "GIT_BOUNDARY_GUARD_FAILED")

        def timed_out_run(*args, **kwargs):
            raise subprocess.TimeoutExpired(args[0], kwargs["timeout"])
        subprocess.run = timed_out_run
        try:
            try: bounded_git_roots(cwd, time.monotonic() + 30)
            except VerificationError as exc: require(str(exc) == "TRANSPORT_LIMIT", "GIT_BOUNDARY_GUARD_FAILED")
            else: raise VerificationError("GIT_BOUNDARY_GUARD_FAILED")
        finally: subprocess.run = original_run

        monotonic_values = iter((1.0, 3.0))
        time.monotonic = lambda: next(monotonic_values)
        subprocess.run = synthetic_run
        try:
            try: bounded_git_roots(cwd, 2.0)
            except VerificationError as exc: require(str(exc) == "TRANSPORT_LIMIT", "GIT_BOUNDARY_GUARD_FAILED")
            else: raise VerificationError("GIT_BOUNDARY_GUARD_FAILED")
        finally:
            time.monotonic = original_monotonic
            subprocess.run = original_run

        malformed = (
            subprocess.CompletedProcess([], 1, b"", b""),
            subprocess.CompletedProcess([], 0, b"", b""),
            subprocess.CompletedProcess([], 0, b"one\ntwo\n", b""),
            subprocess.CompletedProcess([], 0, b"one\ntwo\nthree\nfour\n", b""),
            subprocess.CompletedProcess([], 0, b"one\n\ntwo\n", b""),
            subprocess.CompletedProcess([], 0, b"one\ntwo\x00\nthree\n", b""),
            subprocess.CompletedProcess([], 0, b"\xff\ntwo\nthree\n", b""),
            subprocess.CompletedProcess([], 0, b"one\ntwo\nthree\n", b"warning"),
        )
        for result in malformed:
            subprocess.run = lambda *_args, _result=result, **_kwargs: _result
            try:
                try: bounded_git_roots(cwd, time.monotonic() + 30)
                except VerificationError as exc: require(str(exc) == "TRANSPORT_POLICY", "GIT_BOUNDARY_GUARD_FAILED")
                else: raise VerificationError("GIT_BOUNDARY_GUARD_FAILED")
            finally: subprocess.run = original_run
    require(subprocess.run is original_run and time.monotonic is original_monotonic, "GIT_BOUNDARY_GUARD_FAILED")


def transport_constructor_guard():
    original_context = ssl.create_default_context
    original_opener = urllib.request.build_opener
    original_pthread_sigmask = signal.pthread_sigmask
    original_handler = signal.getsignal(signal.SIGALRM)
    original_timer = signal.getitimer(signal.ITIMER_REAL)
    marker = lambda _signum, _frame: None
    try:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, marker)
        for target in ("context", "opener"):
            error = None
            def fail_constructor(*_args, **_kwargs): raise MemoryError(f"synthetic {target} failure")
            if target == "context": ssl.create_default_context = fail_constructor
            else: urllib.request.build_opener = fail_constructor
            try: Transport(marker)
            except MemoryError as exc: error = str(exc)
            finally:
                ssl.create_default_context = original_context
                urllib.request.build_opener = original_opener
            require(error == f"synthetic {target} failure", "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
            require(signal.getsignal(signal.SIGALRM) is marker and signal.getitimer(signal.ITIMER_REAL) == (0.0, 0.0), "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        transport = Transport(marker); transport.start(); transport.close()
        require(signal.getsignal(signal.SIGALRM) is marker and signal.getitimer(signal.ITIMER_REAL) == (0.0, 0.0), "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        original_setitimer = signal.setitimer
        original_signal = signal.signal
        original_mask = signal.pthread_sigmask(signal.SIG_BLOCK, set())
        def raising_alarm(_signum, _frame): raise VerificationError("TRANSPORT_LIMIT")
        transport = Transport(raising_alarm); transport.start()
        double_start_error = None
        def forbidden_signal_call(*_args, **_kwargs): raise MemoryError("double start touched signal state")
        signal.setitimer = forbidden_signal_call
        signal.signal = forbidden_signal_call
        signal.pthread_sigmask = forbidden_signal_call
        try: transport.start()
        except VerificationError as exc: double_start_error = str(exc)
        finally:
            signal.setitimer = original_setitimer
            signal.signal = original_signal
            signal.pthread_sigmask = original_pthread_sigmask
        require(double_start_error == "TRANSPORT_POLICY" and transport.active, "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        transport.close()
        require(signal.getsignal(signal.SIGALRM) is marker and signal.getitimer(signal.ITIMER_REAL) == (0.0, 0.0), "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        require(signal.pthread_sigmask(signal.SIG_BLOCK, set()) == original_mask, "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        for lifecycle in ("pre_start", "post_close"):
            transport = Transport(raising_alarm)
            if lifecycle == "post_close": transport.start(); transport.close()
            lifecycle_error = None
            transport.opener.open = forbidden_signal_call
            signal.setitimer = forbidden_signal_call
            signal.signal = forbidden_signal_call
            signal.pthread_sigmask = forbidden_signal_call
            try: transport.get(REF_URL, 1)
            except VerificationError as exc: lifecycle_error = str(exc)
            finally:
                signal.setitimer = original_setitimer
                signal.signal = original_signal
                signal.pthread_sigmask = original_pthread_sigmask
            require(lifecycle_error == "TRANSPORT_POLICY" and not transport.active, "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
            require(signal.getsignal(signal.SIGALRM) is marker and signal.getitimer(signal.ITIMER_REAL) == (0.0, 0.0), "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
            require(signal.pthread_sigmask(signal.SIG_BLOCK, set()) == original_mask, "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        def arm_with_pending(which, seconds, interval=0):
            result = original_setitimer(which, seconds, interval)
            if which == signal.ITIMER_REAL and seconds == 120: os.kill(os.getpid(), signal.SIGALRM)
            return result
        transport = Transport(raising_alarm)
        signal.setitimer = arm_with_pending
        activation_error = None
        try: transport.start()
        except VerificationError as exc: activation_error = str(exc)
        finally: signal.setitimer = original_setitimer
        require(activation_error == "TRANSPORT_LIMIT" and not transport.active, "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        require(signal.getsignal(signal.SIGALRM) is marker and signal.getitimer(signal.ITIMER_REAL) == (0.0, 0.0), "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        require(signal.pthread_sigmask(signal.SIG_BLOCK, set()) == original_mask, "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        for target in ("timer", "handler"):
            transport = Transport(raising_alarm)
            activation_error = None
            activation_notes = []
            def pending_with_timer_fault(which, seconds, interval=0):
                result = original_setitimer(which, seconds, interval)
                if which == signal.ITIMER_REAL and seconds == 120: os.kill(os.getpid(), signal.SIGALRM)
                if target == "timer" and which == signal.ITIMER_REAL and seconds == 0: raise MemoryError("synthetic start rollback timer-return failure")
                return result
            def pending_with_handler_fault(signum, handler):
                result = original_signal(signum, handler)
                if target == "handler" and signum == signal.SIGALRM and handler is marker: raise MemoryError("synthetic start rollback handler-return failure")
                return result
            signal.setitimer = pending_with_timer_fault
            signal.signal = pending_with_handler_fault
            try: transport.start()
            except VerificationError as exc:
                activation_error = str(exc)
                activation_notes = list(getattr(exc, "__notes__", ()))
            finally:
                signal.setitimer = original_setitimer
                signal.signal = original_signal
            require(activation_error == "TRANSPORT_LIMIT" and activation_notes == [f"secondary alarm-{target} rollback failure"] and not transport.active, "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
            require(signal.getsignal(signal.SIGALRM) is marker and signal.getitimer(signal.ITIMER_REAL) == (0.0, 0.0), "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
            require(signal.pthread_sigmask(signal.SIG_BLOCK, set()) == original_mask, "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        transport = Transport(raising_alarm)
        initial_mask_error = None
        injected_mask = False
        mask_failure_label = "start"
        def fail_after_initial_mask(how, mask):
            nonlocal injected_mask
            result = original_pthread_sigmask(how, mask)
            if how == signal.SIG_BLOCK and mask == {signal.SIGALRM} and not injected_mask:
                injected_mask = True
                raise MemoryError(f"synthetic {mask_failure_label} mask-return failure")
            return result
        signal.pthread_sigmask = fail_after_initial_mask
        try: transport.start()
        except MemoryError as exc: initial_mask_error = str(exc)
        finally: signal.pthread_sigmask = original_pthread_sigmask
        require(initial_mask_error == "synthetic start mask-return failure" and injected_mask and not transport.active, "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        require(signal.getsignal(signal.SIGALRM) is marker and signal.getitimer(signal.ITIMER_REAL) == (0.0, 0.0), "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        require(signal.pthread_sigmask(signal.SIG_BLOCK, set()) == original_mask, "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        def active_alarm(_signum, _frame): raise VerificationError("TRANSPORT_LIMIT")
        for target in ("timer", "handler"):
            transport = Transport(active_alarm); transport.start()
            close_error = None
            if target == "timer":
                def fail_after_timer(which, seconds, interval=0):
                    result = original_setitimer(which, seconds, interval)
                    if which == signal.ITIMER_REAL and seconds == 0: raise MemoryError("synthetic close timer-return failure")
                    return result
                signal.setitimer = fail_after_timer
            else:
                def fail_after_handler(signum, handler):
                    result = original_signal(signum, handler)
                    if signum == signal.SIGALRM and handler is marker: raise MemoryError("synthetic close handler-return failure")
                    return result
                signal.signal = fail_after_handler
            try: transport.close()
            except MemoryError as exc: close_error = str(exc)
            finally:
                signal.setitimer = original_setitimer
                signal.signal = original_signal
            require(close_error == f"synthetic close {target}-return failure" and not transport.active, "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
            require(signal.getsignal(signal.SIGALRM) is marker and signal.getitimer(signal.ITIMER_REAL) == (0.0, 0.0), "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
            require(signal.pthread_sigmask(signal.SIG_BLOCK, set()) == original_mask, "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        transport = Transport(active_alarm); transport.start()
        close_mask_error = None
        injected_mask = False
        mask_failure_label = "close"
        signal.pthread_sigmask = fail_after_initial_mask
        try: transport.close()
        except MemoryError as exc: close_mask_error = str(exc)
        finally: signal.pthread_sigmask = original_pthread_sigmask
        require(close_mask_error == "synthetic close mask-return failure" and injected_mask and not transport.active, "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        require(signal.getsignal(signal.SIGALRM) is marker and signal.getitimer(signal.ITIMER_REAL) == (0.0, 0.0), "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
        require(signal.pthread_sigmask(signal.SIG_BLOCK, set()) == original_mask, "TRANSPORT_CONSTRUCTOR_GUARD_FAILED")
    finally:
        ssl.create_default_context = original_context
        urllib.request.build_opener = original_opener
        signal.pthread_sigmask = original_pthread_sigmask
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, original_handler)
        signal.setitimer(signal.ITIMER_REAL, *original_timer)


def self_test():
    rights, rights_expected = rights_fixture(); rights[0]["copyright"] = "cc0"; validate_rights(rights, **rights_expected)
    profiles, value_sets, direct_expected = direct_fixture(); before_order = repr(profiles[0]["snapshot"]["element"]); profiles[0]["snapshot"]["element"].reverse(); require(repr(profiles[0]["snapshot"]["element"]) != before_order, "SELFTEST_POSITIVE_FAILED"); validate_direct_profiles(profiles, value_sets, **direct_expected)
    for token, cases in NEGATIVE_FAMILIES.items():
        for name in cases.split():
            negative_probe(name, token)
    cleanup_path_guard_probe()
    exact_pid_reap_guard()
    live_context_cleanup_guard()
    signal_transition_guard()
    default_signal_primary_guard()
    live_transition_binding_guard()
    git_boundary_guard()
    transport_constructor_guard()
    for phase in ("pending", "final"):
        for reason in ("normal", "operation_error", "sigint", "sigterm", "sighup"):
            cleanup_probe(phase, reason)
    print("WP4158_SELFTEST_PASS positives=2 negatives=95 cleanup=10 residue=0")


def live():
    catchable = {signal.SIGINT, signal.SIGTERM, signal.SIGHUP}
    tail_signals = catchable | {signal.SIGALRM}
    original_handlers = {sig: signal.getsignal(sig) for sig in tail_signals}
    state = SignalState()
    operation_complete = False
    def stop(signum, _frame):
        if state.cleanup_active:
            state.record(signum)
            return
        state.cleanup_active = True
        state.record(signum)
        if sys.exc_info()[0] is not None or operation_complete: return
        if signum == signal.SIGALRM: raise VerificationError("TRANSPORT_LIMIT")
        raise InterruptedError(signum)
    for sig in catchable: signal.signal(sig, stop)
    transport = None
    def restore_handlers():
        for sig, handler in original_handlers.items(): signal.signal(sig, handler)
    def close_transport():
        nonlocal transport
        if transport is None: return
        current = transport
        try:
            current.close()
        finally:
            if not current.active: transport = None
            signal.signal(signal.SIGALRM, stop)
    try:
        validate_ambient(os.environ)
        transport = Transport(stop); transport.start(); source_checks(transport)
        owner_path = None
        owner_root = None
        owner_fd = None
        owner_identity = None
        owned_name = None
        owned_fd = None
        owned_identity = None
        owned_files = {}
        try:
            state.cleanup_active = True
            def register_owner(path):
                nonlocal owner_path, owner_root, owner_fd, owner_identity
                owner_path = path
                owner_root = path.resolve()
                owner_fd, owner_identity = open_owned_path(path)
            def allocate_owner():
                create_private_root("wp4158-live-", register_owner)
            run_signal_transition(tail_signals, state, allocate_owner)
            os.chmod(owner_root, 0o700); cwd = pathlib.Path.cwd().resolve()
            discover_git_roots(owner_root, cwd, transport.deadline)
            require(owner_root.stat().st_uid == os.getuid() and identity(owner_root.stat()) == owner_identity, "TRANSPORT_POLICY")
            lifecycle_signals = tail_signals
            previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, lifecycle_signals)
            try:
                owned_name = "pending"
                owned_fd, owned_identity = begin_owned_dir(owner_fd, owned_name)
            finally: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
            blobs = {}
            for key, url, limit, size in (("core", CORE_URL, 4 * 1024 * 1024, 2391515), ("term", TERM_URL, 8 * 1024 * 1024, 7444937)):
                data = transport.get(url, limit, size); name = f"{key}.tgz"
                fd = None
                file_signals = tail_signals
                try:
                    previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, file_signals)
                    try:
                        fd, file_identity = begin_owned_file(owned_fd, name)
                        owned_files[name] = file_identity
                    finally: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
                except BaseException:
                    if fd is not None:
                        try: os.close(fd)
                        except OSError: pass
                    raise
                with os.fdopen(fd, "wb") as stream: stream.write(data); stream.flush(); os.fsync(stream.fileno())
                file_info = os.stat(name, dir_fd=owned_fd, follow_symlinks=False)
                require(stat.S_ISREG(file_info.st_mode) and identity(file_info) == file_identity and stat.S_IMODE(file_info.st_mode) == 0o600, "TRANSPORT_POLICY")
                blobs[key] = data
            previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, lifecycle_signals)
            try: owned_name = finalize_owned_dir(owner_fd, "pending", "final", owned_fd, owned_identity)
            finally: signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
            resources, value_sets = terminology(blobs["term"])
            canonicals = core_direct(blobs["core"], value_sets); rows = handoff(canonicals)
            operation_complete = True
        finally:
            state.cleanup_active = True
            cleanup_signals = tail_signals
            previous_mask = signal.pthread_sigmask(signal.SIG_BLOCK, cleanup_signals)
            alarm_handler = signal.getsignal(signal.SIGALRM)
            signal.setitimer(signal.ITIMER_REAL, 0)
            signal.signal(signal.SIGALRM, stop)
            try:
                if owned_name is not None and owned_fd is not None:
                    require_owned_dir(owner_fd, owned_name, owned_fd, owned_identity)
                    for name, file_identity in owned_files.items(): remove_owned_file(owned_fd, name, file_identity)
                    remove_owned_dir(owner_fd, owned_name, owned_fd, owned_identity)
                    os.close(owned_fd); owned_fd = None
                if owner_path is not None and owner_fd is not None:
                    current_root = owner_path.lstat()
                    require(identity(current_root) == owner_identity and identity(os.fstat(owner_fd)) == owner_identity, "TRANSPORT_POLICY")
                    os.rmdir(owner_path)
            finally:
                if owned_fd is not None:
                    try: os.close(owned_fd)
                    except OSError: pass
                if owner_fd is not None:
                    try: os.close(owner_fd)
                    except OSError: pass
                signal.pthread_sigmask(signal.SIG_SETMASK, previous_mask)
                signal.signal(signal.SIGALRM, alarm_handler)
            if owner_root is not None: require(not owner_root.exists(), "TRANSPORT_POLICY")
        deadline = transport.deadline if transport is not None else None
        run_signal_transition(tail_signals, state, close_transport, deadline=deadline, restore=restore_handlers)
        print(f"WP4158_SOURCE_PASS tag={TAG} commit={COMMIT} tree={TREE} entries=662 notice={NOTICE_SHA}")
        print(f"WP4158_ARTIFACT_PASS core={CORE_SHA} terminology={TERM_SHA} resources=203")
        print(f"WP4158_RIGHTS_PASS codesystems=106 valuesets=97 present=146 absent=57 identity={IDENTITY_SHA} classification={CLASS_SHA}")
        print(f"WP4158_DIRECT_PASS profiles=32 raw=51 unique=50 canonicals=25 duplicate=2 profile_sha={PROFILE_SHA}")
        print(f"WP4158_HANDOFF_PASS rows={len(rows)} unresolved=200 digest={HANDOFF_SHA}")
        print("WP4158_LIVE_PASS responses=7 redirects=0 residue=0")
    finally:
        primary = sys.exc_info()
        state.cleanup_active = True
        try:
            run_signal_transition(tail_signals, state, close_transport, restore=restore_handlers)
        except BaseException as exc:
            if primary[1] is None: raise
            primary[1].add_note(f"secondary final signal restoration failure: {type(exc).__name__}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--cleanup-child", action="store_true")
    parser.add_argument("--transition-primary-child", action="store_true")
    parser.add_argument("--signal-name", choices=("SIGINT", "SIGTERM", "SIGHUP", "SIGALRM"))
    parser.add_argument("--signal-phase", choices=("pre_snapshot", "post_snapshot"))
    parser.add_argument("--phase", choices=("pending", "final"))
    parser.add_argument("--reason", choices=("normal", "operation_error", "sigint", "sigterm", "sighup"))
    parser.add_argument("--root"); parser.add_argument("--root-fd", type=int)
    parser.add_argument("--ready-fd", type=int); parser.add_argument("--release-fd", type=int)
    parser.add_argument("--cleanup-ready-fd", type=int); parser.add_argument("--cleanup-go-fd", type=int); parser.add_argument("--signal-ack-fd", type=int)
    args = parser.parse_args()
    require(sum((args.self_test, args.live, args.cleanup_child, args.transition_primary_child)) == 1, "MODE_INVALID")
    if args.transition_primary_child:
        return transition_primary_child(args)
    if args.cleanup_child:
        return cleanup_child(args)
    self_test() if args.self_test else live()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except VerificationError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
```
<!-- WP4158_VERIFIER_END -->

The first S1 IMPLEMENTATION review generation stopped at 0/2 PASS on candidate tree `2cf57a692341bd5b814bd8d1c02b89f6a1ae00d4`; slots 3-5 were not started. Both reviewers accepted exact4 binding, markers, AST and happy-path live structure, but found all 95 negatives were table-only expected-token raises, cleanup readiness and operation-error paths were synthetic/unbounded, and transport lacked planned signal/ambient/resolved-git-root guards.

The second S1 IMPLEMENTATION generation stopped at 0/2 PASS on tree `c6659d0944dd532dfb29c992101ea1f2f0efc856`; slots 3-5 were not started. Reviewers confirmed all 95 mapped tokens came from production validators and cleanup mechanics improved, but blocked a no-op duplicate-order positive, missing mutation inequality/named direct boundaries, nonshared live cleanup, spawn/PGID recovery, during-read aggregate enforcement, `SSLKEYLOGFILE`, and production request-deadline wiring.

The third IMPLEMENTATION generation passed tree `ab4617383d01669d9682716d2b95d2d2f665b27a` 1/2. All prior blockers were fixed; one reviewer found only that `notice_digest` appended a byte, changing size and digest so size failed first. The fourth source replaced one existing space with `!`, preserving size and all anchors while changing only bytes versus the passing SHA expectation.

The fourth generation reviewed tree `efbb1219450563e7a2a37029622635d7eed67724`: reviewers 1, 2 and 4 passed, reviewer 3 failed, and reviewer 5 was not started. Its only blocker was explicit JSON null copyright being collapsed with missing by `.get()`. A unique sentinel now distinguishes field absence; only missing/exact empty is absent, while explicit null reaches `RIGHTS_TYPE_INVALID`, including the named negative.

The fifth generation reviewed tree `08d361bc02e1279af0d404669688dfe7a61ddc51`: reviewers 1, 2 and 4 passed, reviewer 3 failed, and reviewer 5 was not started. Taxonomy passed; its only blocker was waiting just one 10ms interval for readiness EOF after the phase byte. The sixth source accumulated the byte and EOF but its review passed tree `f4b1926f9ce79c4477e32a66557c27248edb80d8` only 1/2: separate clock reads could produce a negative select timeout at the boundary, and final acceptance checked only the total deadline.

The seventh source SHA-256 was `690304eb1fda92238dbdb49167df4c3596167c12570a443cacf3d1b7a0565f00` across 883 LF lines. Candidate tree `b534406011e666b3c6ea61db9217d381519db04b` passed reviewers 1 and 2, failed reviewers 3 and 4, and did not start reviewer 5. Its `communicate(timeout=max(0.01, remaining))` could grant up to 10ms beyond the total deadline, and it did not assert the total deadline immediately after completion.

The eighth source SHA-256 was `c7e37a24ba51340325049400e00ea8efcb85cbc29c725d265846307d5d34323c` across 888 LF lines. Candidate tree `3e2de4cd12498ba3b410c1e0c313168f81fa28f0` passed reviewer 1 and failed reviewer 2, so reviewer 3 was interrupted and reviewers 4 and 5 were not started. Although it checked the deadline after child completion and owned-path removal, it did not check after the parent `finally` and `TemporaryDirectory` context exit, so final parent cleanup could exceed ten seconds without failing.

The ninth source SHA-256 is `dcd5969f4fd225983730d9a54d8fe760e95e975364f56760a440c8d1ea21cdc4` across 889 LF lines. It additionally requires strict total-deadline compliance after the private temporary parent context has completed cleanup. Fresh reviewers 1 through 5 passed candidate tree `f00be4f442776dc991806442271f9c89b37f023e` 5/5, independently confirming exact4/source/index binding, executable positive2/negative95/cleanup10 oracles, startup and total deadlines through context cleanup, transport/provenance controls, security/privacy boundaries and nonclaims. That checkpoint advanced to BUG_REFACTOR review.

The first BUG_REFACTOR generation stopped when reviewer 2 failed candidate tree `f890e90533f76cdb41e2d7d7529629427d7de2b5`; reviewer 1 was interrupted and reviewers 3 through 5 were not started. The cleanup child accepted unvalidated CLI paths and its unconditional `finally` removal could recursively delete a pre-existing pending or final path after creation failed.

The second BUG_REFACTOR source SHA-256 was `047c65ea76548ca8dd171dd4e183e804d0478fe28388b1a856d4ae678d4383cc` across 947 LF lines. The child validated the repo-external private parent, fixed sibling basenames, UID/modes/canary, initial absence and inherited FIFO descriptors; create/rename ownership changes were signal-masked and cleanup removed only the phase path recorded as created by that child. A subprocess guard proved a pre-existing pending sentinel and canary survived with exact `CLEANUP_PATH_INVALID`; it was an uncounted security preflight, so the aggregate remained positive2/negative95/cleanup10. The following second-generation review found the remaining namespace blockers.

The second BUG_REFACTOR candidate tree `318e29d68d83180dc6784edc0809d3446e2a5f11` failed reviewer 1, so reviewer 2 was interrupted and reviewers 3 through 5 were not started. `Path.exists()` missed dangling symlinks, validation remained separate from replacing rename/removal, ownership tracked only names rather than inode identities, and a repository-ancestor root was not rejected.

The third BUG_REFACTOR source SHA-256 was `b4f5a3d5bdbcc44ea56911e22d954ee5824c691eaabb9e5108f67d7372a3cd02` across 1042 LF lines. Cleanup child path arguments were removed: the parent passed a no-follow private directory-FD capability, and the child used fixed dir-fd-relative names, lstat-style absence checks, cross-platform no-replace rename, held directory FDs and inode/device identities for exact unlink/rmdir. Guards covered a pre-existing directory, dangling symlink, repository-ancestor root, inserted rename target and owned-path replacement while preserving all pre-existing bytes. The aggregate remained positive2/negative95/cleanup10; the following review identified the overclaimed replacement threat and ancestor false-green.

The third BUG_REFACTOR candidate tree `a5d432e501f1961ce12e20fd1e7d784cac4c9e73` failed reviewer 1, so reviewer 2 was interrupted and reviewers 3 through 5 were not started. It incorrectly treated a concurrent same-UID namespace replacement as defended even though portable POSIX/macOS deletion cannot condition unlink/rmdir on an inode identity, and its real repository-parent guard could still fail on the missing-canary condition if containment were removed.

The fourth BUG_REFACTOR source SHA-256 was `99df167bbf45371705f072aa83c94b610a98bfccad8fc89a8d2abc5e29bcbdd9` across 1021 LF lines. Concurrent namespace replacement by a separate same-UID process inside the private root was explicitly excluded and not claimed; the misleading replacement probe was removed. The ancestor regression supplied a private 0700 root, valid UID/canary/FIFO/absence conditions and a nested synthetic working directory, isolating mutual containment as the only rejection boundary. Pre-existing directory, dangling entry and no-replace insertion guards remained, and the aggregate remained positive2/negative95/cleanup10; the following review found cleanup-signal timing and canary-length blockers.

The fourth BUG_REFACTOR candidate tree `d608936ca9af205e1b808489bdc7139e720ff702` passed reviewer 1 and failed reviewer 2, so reviewers 3 through 5 were not started. A catchable signal delivered as a Python callback during deletion could still interrupt cleanup and leave residue because exact10 signalled only during the operation wait; canary validation also accepted a longer file with the correct prefix.

The fifth BUG_REFACTOR source SHA-256 was `4ecd542cf729fe8605c28c8579dd68b0acacfd117c3edcfe18100d63eb8ef7ec` across 1074 LF lines. Cleanup-ready/go and signal-ack pipes moved all six INT/TERM/HUP probes into the active deletion phase; the handler deferred the acknowledged signal until exact owned cleanup completed and then emitted the original terminal reason/code. Live cleanup used the same defer-until-removed boundary. Canary validation required exact size, bytes and EOF, with a suffix regression guard. The following review found that the live boundary ended before owner-root context cleanup.

The fifth BUG_REFACTOR candidate tree `2478c07bcbb8cd5373a325c6b64a4b572622032e` failed reviewer 1 and passed reviewer 2, so reviewers 3 through 5 were not started. Child cleanup signal timing and canary exactness were fixed, but live cleanup disabled deferral after pending/final removal and before the private owner context removed its root, allowing a catchable signal to leave the root behind.

The sixth BUG_REFACTOR source SHA-256 was `d001acc19955f51ee4069261f2dd5696e0d1278237b10af699918ba581e81945` across 1120 LF lines. Live explicitly owned its temporary context and kept signal deferral/masking active through pending/final removal, owner cleanup and root-nonexistence assertion before re-raising a deferred signal. An uncounted live-context guard injected each INT/TERM/HUP during owner-root rmtree and required both deferral and root nonexistence. The following review found the preceding allocation/registration gap.

The sixth BUG_REFACTOR candidate tree `d4b9d5cc5f7e02dcea50456b6f619bb4c4acf4d2` passed reviewer 1 and failed reviewer 2, so reviewers 3 through 5 were not started. A signal could still arrive after `TemporaryDirectory` created its root and before the cleanup-protected `try`, bypassing explicit owner cleanup.

The seventh BUG_REFACTOR source SHA-256 was `d0c9275ce52629c2c05ec1953482cef5bc401c3971c74840258246d1e98fe318` across 1154 LF lines. Live activated cleanup deferral and blocked catchable signals before owner allocation, constructed and registered the owner inside the cleanup-protected outer try, and aborted operation on an allocation-deferred signal only after the same finally removed the owner and proved root nonexistence. Guards injected each INT/TERM/HUP immediately after `mkdtemp` returned in addition to the existing rmtree injections. The following review identified the composite-constructor non-signal gap.

The seventh BUG_REFACTOR candidate tree `2de575daf8f84f056254f61ae00e73318c4565d5` failed reviewer 1, so reviewer 2 was interrupted and reviewers 3 through 5 were not started. `TemporaryDirectory` could create a root and then raise a non-signal exception before returning its owner object, leaving both owner and path unavailable to the outer cleanup.

The eighth BUG_REFACTOR source SHA-256 was `63bee1c7c7625cafab7ae4f29a87c96716c266f722b667a0b3993d2f80448303` across 1162 LF lines. Live no longer used the composite `TemporaryDirectory` constructor: while signals were blocked it captured the direct `mkdtemp` path, and the outer finally owned explicit recursive removal by that path. A guard raised a synthetic `MemoryError` immediately after a captured path and required the original error text plus root nonexistence. The following review identified the stdlib allocator's pre-return gap.

The eighth BUG_REFACTOR candidate tree `d130dbb0bb0c9ea2dff8edc2cc8f8e5c808f42e2` failed reviewer 1, so reviewer 2 was interrupted and reviewers 3 through 5 were not started. The standard `mkdtemp` can create its directory and then fail while forming/returning its absolute path, before the caller assignment captures that path.

The ninth BUG_REFACTOR source SHA-256 was `2de02ba8c59f1e8eb6ea5c7cfa81d7aadc7e2b1d6ea6562b8a6680c92aebb263` across 1174 LF lines. A 32-attempt bounded exclusive allocator held each random candidate path before mkdir, created it 0700, and on every post-create `BaseException` removed that exact path before rethrowing. The allocation guard injected a synthetic `MemoryError` immediately after mkdir and before return, requiring original-error preservation and root nonexistence. The following review found that the mkdir call itself remained outside that cleanup region.

The ninth BUG_REFACTOR candidate tree `098df9e0d8ef051b48256476822e801a95ea8e7c` failed reviewer 2, so reviewer 1 was interrupted and reviewers 3 through 5 were not started. A SIGALRM/Python callback exception after the real mkdir succeeded but before the call returned still occurred before the separate cleanup try and left the root behind.

The tenth BUG_REFACTOR source SHA-256 was `79702b828eaff8d924f702a5d56511653156b5252929b47542542cdaaba1e1d9` across 1191 LF lines. The mkdir call itself was inside the single `BaseException` cleanup region; on error the known candidate was lstat-checked and only a same-UID exact-0700 directory was removed before the original exception was rethrown. A guard wrapped the real mkdir, raised `MemoryError` before the call returned, and required the same error plus root nonexistence. The following review identified restrictive-umask residue.

The tenth BUG_REFACTOR candidate tree `9dbdbdf6fc5c4d9b8f99bc52998f93d7faea260a` failed reviewer 1, so reviewer 2 was interrupted and reviewers 3 through 5 were not started. Under a restrictive umask the root created by the same mkdir could be mode 000, causing the exact-0700 exception-cleanup condition to skip it.

The eleventh BUG_REFACTOR source SHA-256 was `5a90f3569d7a7ab754f0998fab968011eec5abc78628ebbeaaa3730624af02b4` across 1209 LF lines. Successful allocation normalized the mode to 0700; exception cleanup accepted only a same-UID non-symlink directory with zero group/world permission bits. A restrictive-umask call-boundary guard ran the real mkdir, raised before return, required original-error preservation and root nonexistence, and restored the prior umask in `finally`. The following review found the FileExistsError origin conflation.

The eleventh BUG_REFACTOR candidate tree `7d68892439875a75600b6266fe57791e77baa17f` failed reviewer 2; reviewer 1's context ended in a security-filter error and is noncount, and reviewers 3 through 5 were not started. A post-mkdir callback `FileExistsError` was incorrectly treated as a pre-existing collision and continued without cleanup.

The twelfth BUG_REFACTOR source SHA-256 was `d3324089531c514aa1ab0a4536813eac95f112133826ba6617ccb11cc4d7b798` across 1238 LF lines. No-follow pre-existing collision detection occurred before mkdir; after creation began every `BaseException`, including `FileExistsError`, entered exact cleanup and was rethrown. Guards proved a pre-existing sentinel survived while allocation retried the second candidate, and a synthetic post-mkdir `FileExistsError` preserved its type/message with root nonexistence. The following review found the unmasked Transport SIGALRM cleanup gap.

The twelfth BUG_REFACTOR candidate tree `ea22472704809c9071aa33c93298a74ec4931dd2` failed reviewer 2, so reviewer 1 was interrupted and reviewers 3 through 5 were not started. Collision/FileExists handling passed, but Transport's active SIGALRM remained unmasked during live cleanup and could interrupt rmtree with `TRANSPORT_LIMIT`, leaving residue. One generic cleanup failure in the initial direct repetition was not reproduced by 120 unchanged-source normal repetitions, 50 diagnostic repetitions or reviewer 2's fresh 30 repetitions; reviewer 2 did not treat that isolated event as a blocker, and this disclosure remains recorded.

The thirteenth BUG_REFACTOR source SHA-256 was `f03932c87e5cc52bde4d55f920d906b250865ef71d6b1fd0cbf6efacf69f28c5` across 1281 LF lines. Live cleanup also blocked SIGALRM, canceled the active timer, temporarily routed it through the deferring handler, removed owned paths/root, and only then emitted `TRANSPORT_LIMIT` when the signal was pending or the aggregate deadline was due. Guards injected SIGALRM during both pending/final removal and owner-root rmtree and required deferral plus zero residue. The following review identified the remaining handler-transition and cleanup-readiness gaps.

The thirteenth BUG_REFACTOR candidate tree `1c0fb60a5997178a9c20c23904c555cb0587f664` passed reviewer 1 and failed reviewer 2, so reviewers 3 through 5 were not started. Transport's throwing handler could still run before owner assignment or at cleanup-finally entry before the temporary defer transition, and cleanup readiness performed an unbounded EOF read after the first readable `C` byte.

The fourteenth BUG_REFACTOR source SHA-256 was `89e3e650f99e7fa2d6602c429600cf91a60859e153b34831aac16d38e263ee1e` across 1297 LF lines. Transport used the common handler for its full active lifetime, owner path registration occurred inside the masked allocator callback, and cleanup-ready `C` plus EOF used a bounded loop. Candidate tree `4e6cfc15f0a12c38768f95b624dcacb4d3b093ff` failed reviewer 1, so reviewer 2 was interrupted and reviewers 3 through 5 were not started. TLS context/opener construction after alarm handler/timer activation could raise before `Transport` assignment and leak the replacement signal state.

The fifteenth BUG_REFACTOR source SHA-256 was `53f597aa61d4620eef022c8967d7d1657ffae614c7e56fc927e35ab268792208` across 1344 LF lines. TLS context/opener construction preceded signal mutation and their fault guards passed. Candidate tree `b25839ccee740f31e1dd4119b8270283bc8edc42` failed reviewer 1, so reviewer 2 was interrupted and reviewers 3 through 5 were not started. A pending SIGALRM delivered while the constructor restored its mask could raise after activation rollback's protected region but before object return, leaving the replacement handler/timer without an object the caller could close.

The sixteenth BUG_REFACTOR source SHA-256 was `9a697d822c6b04afa7832d479259c7e8e09698c0ed9c95179a431cfa7d96633a` across 1368 LF lines. Construction was signal-free and live owned the object before its activation transaction; queued-alarm rollback passed. Candidate tree `9493eb1db9547950f78205a5f060323586d9bed3` failed reviewer 1, so reviewer 2 was interrupted and reviewers 3 through 5 were not started. If close-time timer restoration completed its real effect and then raised, handler restoration and active-state clearing were skipped.

The seventeenth BUG_REFACTOR source SHA-256 was `dd6f270f7a86088784d521265289a3a4bb03939ef9e5aa8f81527a9935c489f5` across 1403 LF lines. Close independently restored its signal state and its after-real-return guards passed. Candidate tree `ba897dd04fe164423a7b1f949d22d68c16aa8ec5` failed reviewer 1; reviewer 2 encountered a security-filter error and was noncount, and reviewers 3 through 5 were not started. A secondary timer error during start rollback replaced the primary activation error and skipped later handler, active-state and mask restoration.

The eighteenth BUG_REFACTOR source SHA-256 was `37576051776f58fadd386086d1ec4c58afb0a8302dbabb007ccb0d7a74eb9d0b` across 1435 LF lines. Start rollback and its queued-alarm fault guards passed. Candidate tree `8f07e4434e4c483d790db43696d8a7c05cb24f3d` passed reviewer 1 and failed reviewer 2, so reviewers 3 through 5 were not started. Close's initial SIGALRM block remained outside its restoration transaction and an after-real-return exception left the mask, handler, timer and active state unrestored.

The nineteenth BUG_REFACTOR source SHA-256 was `55f8008a8bc1f5344c686716cd6b3ea375155b5274543d395f766502dac12d7c` across 1476 LF lines. Initial mask restoration passed. Candidate tree `1381bcc5bf92f076861837226da2df01ded0b767` passed reviewer 1 and failed reviewer 2, so reviewers 3 through 5 were not started. A second start while active overwrote the original handler/timer snapshot with the Transport's own state, so one close left the replacement state installed. The first repetition's disclosed generic cleanup failure remained non-actionable after the recorded 370 unchanged-source passes and reviewer 1's additional fresh 20/20.

The twentieth BUG_REFACTOR source SHA-256 was `05726c48652ad40fb99e380167fa3c1fbd70259485158b2574c96a1cf0d1abfe` across 1493 LF lines. Double-start rejection passed. Candidate tree `22abfa911e344af6e15943c65944d6947a2e1be0` passed reviewer 1 and failed reviewer 2, so reviewers 3 through 5 were not started. Get accepted an inactive pre-start or post-close object, armed an aggregate timer, and then inactive close was a no-op that left the timer installed.

The twenty-first BUG_REFACTOR source SHA-256 was `433b3baf25037a095007652af8cd5c8b3f4878fdc162ee83a3269a4295968fec` across 1511 LF lines. Get lifecycle guards passed. Candidate tree `7678f329857aa9f1177e73e20fbea47a8fcce62d` passed reviewers 1 and 2 and failed reviewer 3, so reviewer 4 was interrupted and reviewer 5 was not started. The authoritative Plans heading and exact-next-action still displayed implementation review/gate in present tense despite the active BUG_REFACTOR gate.

The twenty-second BUG_REFACTOR verifier source remained byte-identical at SHA-256 `433b3baf25037a095007652af8cd5c8b3f4878fdc162ee83a3269a4295968fec` across 1511 LF lines. Projection synchronization passed. Candidate tree `670bb3a65ff5990b450a7561050199d5a1e7717e` failed reviewers 1 and 2, so reviewers 3 through 5 were not started. A timeout deferred during owner allocation did not stop post-allocation Git subprocess work, and the tree response's top-level SHA was not bound to the pinned tree identity.

The twenty-third BUG_REFACTOR source SHA-256 was `b1027623c8c04bb5bf726c109f53c0e97db544e067a939b5eaa5e12e4d724003` across 1547 LF lines. Timeout and tree identity fixes passed. Candidate tree `ce3d92259d2695c6775edb605766e4c2484d2642` passed reviewers 1, 2 and 4 and failed reviewer 3, so reviewer 5 was not started. Plans contained conflicting signal timing, and exact-ten signal probes entered cleanup via release EOF before sending the signal, leaving operation-wait interruption unproved.

The twenty-fourth BUG_REFACTOR source SHA-256 was `9972b48b3c0f24d4e9bf945d3ea4ac719ef8e03bafa02d9871c2cf9f5282ae4f` across 1548 LF lines. Signal-origin exact-ten behavior passed. Candidate tree `a21b45a051cd58cb8b5d697035c75b1003716a1e` failed reviewers 1 and 2, so reviewers 3 through 5 were not started. Live retained an operation-to-finally SIGALRM race, and unlike the probe's dir-FD/identity/no-replace lifecycle it still used path-only rename and recursive ignore-errors removal.

The twenty-fifth BUG_REFACTOR source SHA-256 was `2ee2d5060be1e3d56bf88478a8be6434d2a8c826aa966e3d7f062de19c5e2dff` across 1620 LF lines. Shared FD primitives passed. Candidate tree `cc71dc0069ebcaaa11ff67a729e19cfac5340dfd` failed reviewer 1, so reviewer 2 was interrupted and reviewers 3 through 5 were not started. Child/live still had success/catchable-signal finally-entry races, and live did not register a created file identity until after write completion, so a partial write failure could leave untracked residue.

The twenty-sixth BUG_REFACTOR source SHA-256 was `f5532e88a4301994fb1e0a33db839045dfb9ab4ac3e48e5582895e7d524fad09` across 1721 LF lines. Finally and file-registration fixes passed. Candidate tree `f71505449668cdb265f6a434032076f0f6e317ce` failed reviewers 1 and 2, so reviewers 3 through 5 were not started. The outer transport-close/handler-restore tail could swallow deferred signals, begin-owned-directory lacked complete post-create rollback, and live create/rename projection changes were not signal transactions.

The twenty-seventh BUG_REFACTOR source SHA-256 was `adcef7cde3aa5136f5d496873a4596a224d77168cd29f982bade06542c145387` across 1794 LF lines. Candidate tree `73a105fcbe6abdaa4e6d94c1c3a771397c9e13f7` failed reviewers 1 and 2, so reviewers 3 through 5 were not started. A restrictive umask could leave the owned directory mode 000 outside both the exact-0700 validation and rollback condition. Directory, file, and live-root opens could also leak an unassigned descriptor when an injected wrapper raised after the real open returned but before Python assignment.

The twenty-eighth BUG_REFACTOR source SHA-256 was `943b91e6bf1c1b99083307f3c5ace00e7a3367266730229ad77ba0d286429522` across 1911 LF lines. Directory creation normalized the exact dir-FD-relative entry to mode 0700. Identity-matching descriptor enumeration recovered only newly unassigned descriptors, and live root registration used the same transactional helper. Dedicated guards covered restrictive-umask success and rollback plus directory, file, and root post-open-return failures, requiring exact entry and descriptor residue zero. Twenty unchanged-source self-test repetitions passed exactly. Candidate tree `970c5519a1cf7f93cd37b235f7d21b6b8282cbbe` failed reviewers 1 through 3, so reviewers 4 and 5 were not started. A signal could arrive after deferred-state checks but before cleanup deactivation and permit unbounded ambient Git work. Git locality overrides could also bypass the cwd/temp boundary, and the State heading omitted the completed IMPLEMENTATION gate.

The twenty-ninth BUG_REFACTOR candidate tree `ef1fc1e6389a44a25e69c8c14526a24d8058e071` stopped after reviewers 1 and 2 failed and reviewer 3 passed; reviewers 4 and 5 were not started. The recorded `a71ff93680c8692b8c2753933497d1ed8cf2483d7e8bbb43360927be971c065f` omitted the canonical emitted terminal LF; the actual emitted SHA-256 was `7a42c9a5a23943f72c2c7e49808d65d6cfa2fd527e884415110b326d93eff071` across 2165 LF lines. A mutant moving the live allocation call outside the mask still passed because the guard modeled a separate transition. The success tail and outer finalizer retained the same unmask-before-deactivate race. On the case-insensitive macOS volume, a case-variant workspace alias also bypassed string-based temp containment.

The thirtieth BUG_REFACTOR source SHA-256 was `7ac2e9837f3bf0ffd7866c19f5e979ed0c5889b87faafab1e3015d1df3718a01` across 2354 LF lines. The verifier required its own canonical final LF. One shared primitive owned signal blocking, protected operation, pending/deferred decision, cleanup deactivation, state restoration, and unmasking for live allocation, the success tail, the outer finalizer, and the runtime guard. An AST binding oracle plus controlled allocation and tail bypass mutants prevented call-site false-green. Existing path containment used strict device/inode same-file and bidirectional ancestor-chain checks; the actual macOS case-variant workspace-local temp oracle required zero Git calls, unchanged canary bytes, no artifacts, and zero root residue. The remaining legacy signal-set reference used the shared tail set. Twenty canonical-source self-test repetitions passed exactly. Candidate tree `c095e836707deafb20b9e883e693bf35ccddea22` failed reviewer 1 and passed reviewers 2 and 3, so reviewers 4 and 5 were not started. When a protected operation queued a signal and then raised its primary exception, the drain was skipped; restoring actual default handlers before unmask terminated the process for SIGTERM, SIGHUP, and SIGALRM. The custom `ProbeSignal` primary guard did not exercise that fatal path.

The thirty-first BUG_REFACTOR source SHA-256 is `9661c715c218aa8c7ebcf4fdabb42125455fa6d2f30a9d08619b435a669d2e87` across 2544 LF lines. The transition now captures operation success or failure and then performs exactly one common pending-signal drain while the mask and transition handler remain active. A queued signal updates deferred state, but the exact operation exception identity, type, message, traceback and empty notes remain primary; only then does the transition deactivate, restore actual handlers, and unmask. Four independent fresh `python -I` children exercise Python's SIGINT default handler and `SIG_DFL` for SIGTERM, SIGHUP, and SIGALRM. Each requires the primary exception, exact deferred state, an empty pending set, and zero child-owned directory/FD, mask, handler, timer, canary, and parent-root residue. The former failure-drain omission mutant is rejected with `LIVE_SIGNAL_PRIMARY_GUARD_FAILED`; missing-terminal-LF plus allocation and tail bypass mutants remain rejected with `LIVE_TRANSITION_BINDING_FAILED`. Twenty canonical-source self-test repetitions passed exactly. The sanitized live verifier ultimately passed its exact six-line oracle and zero residue; one unchanged-source attempt first returned `TRANSPORT_LIMIT`, and a subsequent verifier exit-zero run exposed only an incorrect external harness expectation of 225 rather than the authoritative 200 handoff rows before the corrected exact oracle passed. Fresh exactly-five BUG_REFACTOR review is pending.

Terminology rights provenance follow-up captured on 2026-07-16:

| Item | Direct evidence | Review consequence |
|---|---|---|
| JP Core usage notice | JP Core 1.2.0 `guide-precautions.html` says some bound terminologies require permission and that the implementer SHALL resolve terminology licensing; the guide does not guarantee use of FHIR Base or external terminologies | JP Core publication or package availability is not a blanket license grant |
| JP Core pinned source tree | The official `1.2.0` tag tree contains no case-insensitive conventional LICENSE/LICENCE/NOTICE/COPYING basename; mutable GitHub detected-license metadata is outside the immutable S1 proof | This narrow tree fact is not a repository-wide permission or prohibition; legal review remains required |
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
- JP Core 1.2.0's published output proves the Publisher version but not its SUSHI/Node inputs. Current Publisher, validator and SUSHI releases are therefore compatibility candidates, not an implied upgrade or lock. The present yrese Node 24 environment and nonzero `java -version` result do not demonstrate a usable Java invocation or the required matrix.
- The fingerprinted terminology package is not legally cleared by artifact availability, resource copyright text or the current-version IP review. Version-specific, use-specific legal decisions remain a hard gate before runtime use or redistribution.

## Evidence rules

- Never use production credentials, PHI or real patient data in local evidence.
- A test proves only the path and invariant it asserts; component tests do not substitute for browser, database or production-like evidence.
- Environment/tool failures remain explicit and do not become green evidence.
- `DEMO_REQUIRED`, `VERIFY_REQUIRED` and human gates remain open until direct evidence closes their exact scope. Local expected PostgreSQL skips remain an environment note and must not override the direct zero-skip CI proof or be generalized into production readiness.
