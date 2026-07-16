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

Pre-lock discrepancies and stops:

- The official terminology artifact resolves the canonical package identity to `jpfhir-terminology#1.4.0`; `.r4` belongs to the distributed archive filename, not its package `name`. The JP Core archive dependency key `jpfhir-terminology.r4` therefore does not match the downloaded dependency package identity or the rendered dependency table. This upstream metadata mismatch must be reviewed rather than silently normalized.
- The terminology artifact source and fingerprint are now known, but its archive provides neither package-level license metadata nor a standalone license file. Resource-level third-party terminology rights may differ, so this evidence does not provide legal clearance.
- The archive `url` field contains a publisher build-machine `file://` path rather than the public canonical.
- The QA report shows zero errors/warnings but also reports suppressed issues, an unpublished publication status and missing version-history metadata. A green QA summary alone is insufficient approval evidence.
- The download URL is not content-addressed. Future retrieval must compare hash, byte length, HTTP validators and package metadata before accepting the same semantic version.
- FHIR/JP Core specialist and legal/license review remain required before any lock or runtime/toolchain implementation. All dependencies declared by the JP Core archive now have artifact fingerprints, but `hl7.fhir.uv.tools.r4#0.8.0` appears only in rendered/QA tooling metadata and still requires classification as build-only or lock-required.

## Evidence rules

- Never use production credentials, PHI or real patient data in local evidence.
- A test proves only the path and invariant it asserts; component tests do not substitute for browser, database or production-like evidence.
- Environment/tool failures remain explicit and do not become green evidence.
- `DEMO_REQUIRED`, `VERIFY_REQUIRED`, human gates and expected PostgreSQL skips remain open until direct evidence closes them.
