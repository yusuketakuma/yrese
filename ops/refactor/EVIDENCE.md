# Refactor evidence index

Updated on 2026-07-16. This file is the durable index for the active repository-improvement goal. It points to authoritative records instead of duplicating their full command output.

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
| WP-0053 | `050df59` | `Plans.md` FHIR Native v0.5 section | Phase 0 through Phase 5 work split landed; approval gates remain closed |
| WP-4149 | `7ba1003` | `30bca4a` | Reception registration accepts only the selected Patient Context |
| WP-4150 | `87b5c41` | `f28921a` | Patient selection action remains reachable at narrow widths |

All commits above are pushed to `origin/agent/reconcile-wp9002-w7c-20260712`. Commit presence does not satisfy independent verification, human approval or final-demo gates by itself.

## Current browser evidence

- Environment: development API and Web servers, in-memory repositories, explicit development-only tenant stub, synthetic fixtures only.
- Patient/reception: patient search, selection, reception registration, queue reflection and context clear passed. The registration form has no freeform Patient ID input.
- Responsive: 375, 768 and 1280 CSS-pixel viewports had no page-level overflow. At 375, the patient-selection action remained inside the viewport before and after horizontal table scrolling.
- Audit success path: after a synthetic reception was created, `/admin` displayed `reception.created` and `audit.viewed`; the displayed hash chain was verified as normal.
- Browser console/page-error capture was empty for the completed patient/reception and responsive journeys.
- Production Web sequence: `next start` correctly rejected a preceding dev-format `.next`; `next build` then produced 12 static pages and `next start` became ready in 237 ms. `/sync-status` rendered its explicit disconnected/not-synced placeholder and the server shut down normally.

## Evidence not obtained

- Audit refresh failure retention is covered by the 50-test `audit-log-view.test.tsx` component suite, but not by browser evidence. Both network-abort interception and an immediate synthetic `fetch` rejection caused the browser automation session itself to stop responding before post-failure DOM capture. Those attempts are tool failures, not application pass or fail evidence.
- The reduced-motion browser setting did not report an active media query in the automation session, so no reduced-motion conformance claim is made. Forced-colors, 200% zoom focus flow and detailed network/hydration capture remain unverified.
- PostgreSQL integration, production API startup, real authentication, role/tenant denial and a production clinical journey remain unverified. The production Web static-route startup above is only partial evidence. See `FINAL_DEMO.md`.

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
- `DEMO_REQUIRED`, `VERIFY_REQUIRED`, human gates and expected PostgreSQL skips remain open until direct evidence closes them.
