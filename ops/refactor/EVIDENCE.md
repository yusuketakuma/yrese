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
- JP Core 1.2.0's published output proves the Publisher version but not its SUSHI/Node inputs. Current Publisher, validator and SUSHI releases are therefore compatibility candidates, not an implied upgrade or lock. The present yrese Node 24 environment and nonzero `java -version` result do not demonstrate a usable Java invocation or the required matrix.
- The fingerprinted terminology package is not legally cleared by artifact availability, resource copyright text or the current-version IP review. Version-specific, use-specific legal decisions remain a hard gate before runtime use or redistribution.

## Evidence rules

- Never use production credentials, PHI or real patient data in local evidence.
- A test proves only the path and invariant it asserts; component tests do not substitute for browser, database or production-like evidence.
- Environment/tool failures remain explicit and do not become green evidence.
- `DEMO_REQUIRED`, `VERIFY_REQUIRED` and human gates remain open until direct evidence closes their exact scope. Local expected PostgreSQL skips remain an environment note and must not override the direct zero-skip CI proof or be generalized into production readiness.
