# Plans.md — Active execution board

> **AUTHORITATIVE ACTIVE BOARD (2026-07-30):** `DEVELOPMENT_POLICY.md`
> に従う。CURRENTは1件、READYは最大2件である。frozen legacy(完了済み・凍結
> 履歴)は direct user instruction 2026-07-31 により
> `Plans.legacy-archive-20260731.md` へ全量退避済みで、checkboxや旧statusに
> かかわらずclaim、assignment、current-task判断、completion判断へ使用しない。

## 0. Document Contract

- `Plans.md` は唯一のactive queueである。実装順、claimability、依存、受入条件、
  human gateはこのactive sectionだけを正とする。
- `DEVELOPMENT_POLICY.md` はwork-selection charter、APPROVED SSOTは製品・医療・
  法令・security/privacy/data-integrity authorityであり、本書は上書きしない。
- `State.md` はinterruption、blocker、human gate、uncommitted ownershipの
  pointer-only snapshotであり、通常の進捗台帳ではない。
- CURRENTはexactly one、READYはmaximum two。human-gated、completed-local、
  deferred、archivedはREADYへ数えない。
- completed evidenceはGit/CIへ委ねる。frozen legacyは全項目を
  `FROZEN / GIT_HISTORY_ONLY / NONCLAIMABLE`として一括分類し、
  `Plans.legacy-archive-20260731.md`(non-HEAD provenance の保全先)へ退避済み。
  active parser、task selection、completion判定から除外する。
- このstatic auditのsole editorはCodex root。書込み前に本書のSHA-256、
  `git status --short`、外部変更を再確認し、`Plans.md`だけを変更する。

## 1. Current Planning Snapshot

| Field | Current evidence |
|---|---|
| Branch | `main` |
| Scanned HEAD | `9d8dbc0c3f5201c762dbb39fd9b15fc3ddc4b875` |
| Upstream divergence | `origin/main...HEAD = 0 behind / 1 ahead` |
| Working tree included | yes; 35 tracked dirty paths + 1 untracked path at scan start |
| Last scan date | 2026-07-30 JST |
| Active Goal | static repository audit and `Plans.md` normalization; no implementation |
| Current critical path | WP-4250 bounded authority review/final human approval, then policy-consistent milestone execution |
| Main blocker | WP-4250 exact11 domain-review corrections and final human approval; WP-4050 remains a separate R3 human gate |
| Runtime verification | not run; static evidence only by explicit Goal boundary |
| Next scan cursor | diff-first from `9d8dbc0`; reset on new High/Medium finding or reprioritization |

The working tree is authoritative for current implementation evidence. The
uncommitted exact11, WP-4254, and WP-4255 changes are not treated as landed.
WP-4253 is separately committed at the scanned HEAD and is not unlanded work.

## 2. Product and Architecture Guardrails

- 6–12 week North Star: synthetic patient search/selection → paper reception →
  manual prescription draft → pharmacist confirmation → immutable audit evidence.
- Current reachable runtime is limited to health/whoami, patient search/get,
  paper reception queue/create, and audit read. Prescription/dispensing,
  calculation consumer, billing, schedule, visit, report, notification, and
  PH-OS synchronization are not connected.
- Current persistent authorities are PostgreSQL `patients`,
  `reception_entries`, and `audit_events`.
- Patient and MedicationRequest must have one writer. No dual write, hidden
  multi-master, automatic fallback, or conformance claim is permitted.
- Tenant/pharmacy/actor/scope must come from authenticated trusted context.
  Production authentication, qualification, runtime-role, and RLS proof remain
  release gates; development headers are not production authority.
- Reception/audit/outbox atomicity, clinical version history, immutable audit,
  evidence-backed calculation, and PHI-free logs/URLs fail closed.

## 3. Active Queue

### WIP — exactly one

### WP-4250 — Bounded Patient + MedicationRequest authority decision

- **Status:** **FINALIZED / APPROVED**(2026-08-01)/ LANDING_PENDING
  — exact11の11文書は `direct human authority 2026-08-01 (全て承認)` により
  PROPOSED→APPROVEDへ同一batchで昇格済み(PRC-007 §4 step 8 / §97)。
  **承認範囲はSSOT改版のみ**であり、実装着手・schema/data migration・
  production action・conformance主張・cutoverを含まない。登録済みblockerは
  全て据え置きで、それぞれが引き続き該当行為を止める。
  旧status(参考): WIP / PROPOSED / CORRECTIONS_APPLIED_REVISION_14 /
  ROUND_5_COMPLETE / FINAL_HUMAN_APPROVAL_REQUIRED

#### Finalization 実施記録(2026-08-01)

PRC-007 §4の10段フローのうち、step 1〜7は本WPのround 1〜5で完了済み。
step 8(APPROVED化)とstep 9(exact-path stage / commit / push)を本日実施した。
§97の要求どおり、**11文書のAPPROVED化とindex同期を同一finalization batchで
行い、中間状態をlandingしていない**。

| 項目 | 内容 |
|---|---|
| 昇格対象 | ARC-008 / API-003 / API-001 / API-004 / API-008 / DOM-002 / DOM-005 / DOM-006 / DB-005 / PRD-007 / IDX-001 の11文書 |
| 変更したfield | `status` PROPOSED→APPROVED、`approved_at` null→2026-08-01、`approved_by` null→承認記録、`effective_from` null→2026-08-01 |
| blocker | `FINAL_HUMAN_APPROVAL_REQUIRED` のみ全10文書から除去(承認により充足)。**他のblockerは1件も削除していない**(ARC-008 15件 / DB-005 16件 / API-008 14件 / DOM-006 9件 / DOM-005 7件 / DOM-002・PRD-007 各4件 / API-003 3件 / API-001 2件 / API-004・IDX-001 0件) |
| version | 内容不変の10文書は据え置き。IDX-001のみ本文(status行10件)が変わるため 0.4.46→0.4.47 |
| index | status行10件をPROPOSED→APPROVED(集計 APPROVED 131→141、PROPOSED 22→12、SUPERSEDED 17不変)。documentカウント173・section件数・23-field移行inventoryは不変 |
| `amends` / `PENDING_REVISION` | **解除しない**。本batchはbounded scopeであり、DOM-005/API-004/PRD-007の完全改版ではない。ARC-008の`amends`はDB-001〜004・ARC-005・ARC-007も対象に含み、これらはpacket外である。PRC-007 §7.4の解除条件を満たさないため予約を維持する |
| 検証 | `check:ssot-index` PASS(173)、`git diff --check` PASS、全11文書のfrontmatterをYAML parseして status/approval/effective/blocker/change_log先頭entryを機械確認(ALL 11 OK) |

**finalization中に発見した欠陥(記録)**: ARC-008 frontmatterの
`BLOCKED_WRITER_FENCE_TOKEN_ISSUANCE` 行が、値をbacktickで開始していたため
**YAMLとして parse 不能**だった(backtickはYAMLのreserved indicator)。HEAD時点では
存在せず、本WPのPROPOSED改版(Revision 9)で混入したものである。値を引用符で囲んで
修正した(意味変更なし)。**重大なのは、この欠陥を `check:ssot-index` も round-5 の
独立review三レーンも検出できなかった点である** — 現行のmachine validationは
frontmatterのYAML妥当性を検証していない。round 3で reviewer が提案した
「approval-facing recordをSSOTから機械的に導出し、その整合を `check:ssot-index` へ
入れる」という systemic な対策と同じ領域であり、別WPとして起票する。
  (round-3で到達したiteration limitのescalationは、2026-07-31のuser direction
  「fableが決めた内容に従う」により設計方向の委任として解消。round 5は
  data-integrity / security-privacy / independent verifier の3レーン全てが
  delivered となり、verifier は Revision 14 packet に対して **本文 PASS
  (HIGHなし)** を返した。**maker/checker分離は充足**。残るのは
  **final human SSOT approval** であり、これは委任されておらず解消していない)
- **Claimability:** review and correction only. Implementation, migration,
  landing, production action, and conformance claims are nonclaimable.
- **Risk / authority:** R4. User wording `推奨承認` is recorded as explicit equivalent authorization for drafting/review only. The exact11 PRC-007 batch is now PROPOSED; no final SSOT approval, implementation, migration, production action, or conformance claim is inferred.
- **Policy alignment:** Milestone 2 decision exit; directly unlocks the smallest architecture proof.
- **Outcome:** exact11 is a bounded PROPOSED draft. Independent API/FHIR,
  data-integrity, security/privacy, and product/medical review found unresolved
  producer, authority, lifecycle, cutover, reception-compatibility, identity,
  audit/outbox, performance, and evidence boundaries. Revision 7 (2026-07-31)
  applied a correction for every HIGH and MEDIUM finding, choosing the
  fail-closed option wherever the finding permitted one. The batch remains
  PROPOSED and is still not decision-ready: the corrections themselves require
  independent re-review, and each new blocker below must be cleared by its own
  approved amendment.

| Decision surface | Read-only evidence | Decision-ready conclusion / remaining gate |
|---|---|---|
| Canonical authority | exact11 PROPOSED draft aligns ARC-008/DOM-005/API-003/DOM-006 on bounded authority | Review Patient + oral/topical MedicationRequest only; keep all non-selected resources/internal domains authoritative and retain ARC-008 `amends` until finalization |
| Profiles / mapping | FHIR R4 4.0.1, `jpfhir.jp.core#1.2.0`, two canonical URLs, digest/length/last-modified are captured as identity; DOM-006 authority-boundary records are not mapping allow-list entries | Field mappings, signature/checksum, terminology, Must Support beyond derived IG, real validator and CapabilityStatement remain BLOCKED; no authenticity/conformance claim |
| Lifecycle / correction | Patient merge/unmerge and MedicationRequest correction/original-order ownership are not approved; API-008 is PROPOSED | Adopt the fail-closed lifecycle default below; a later approved workflow is required before expanding it |
| Create / update / retry | API-008/DB-005 PROPOSED text now aligns create/update conditional idempotency, persisted monotonic rotation fencing, request-byte replay, update concurrency, and native DynamoDB limits | Every clinical write strong-reads the tenant+pharmacy rotation control **and the per-resourceType authority control item**, and includes exact ConditionChecks on both in the same TWI; every enabled Patient PUT requires both If-Match and Idempotency-Key; each configured active+retained version gets a conditional immutable alias; stale/reanimated writers cannot commit; distinct targets are ≤100, operation-after item aggregate ≤4 MiB, each item ≤400 KB, with no chunking or S3 fallback; never auto-retry writes. **Patient create is disabled and post-cutover Patient identity is immutable**, so neither path can produce a duplicate patientNumber — but that combination also leaves no way to register or correct a patient after cutover, which is why it gates cutover rather than merely describing post-cutover behaviour. **Lookup-key retirement is unsupported**, so the retained set only grows and a compromised key has no withdrawal path — `BLOCKED_LOOKUP_KEY_RETIREMENT` therefore gates write enablement rather than recording an accepted risk. The authority ConditionCheck does not by itself establish fresh-writer exclusion; that is `BLOCKED_WRITER_FENCE_TOKEN_ISSUANCE`. Replay returns stored octets verbatim, not re-derived through a serializer |
| FHIR search paging | upper-watermark-only claim, collapsed identifier forms, vague update deltas, nonstandard medication token naming, and implicit date/set algebra were rejected | Build distinct BEFORE/AFTER canonical partition sets before TWI enumeration; retained partitions get one NEW-version true and removed partitions one false, with duplicate/multi-valued tokens deduped; preserve identifier forms, standard `code`, OR/AND algebra and precision-derived `_lastUpdated` half-open intervals before deterministic as-of manifests; search remains `BLOCKED_FHIR_SEARCH_SNAPSHOT_IMPLEMENTATION` until retention, corruption, and concurrent-writer tests exist |
| FHIR instance history | prior draft advertised history-instance without bounded page semantics | Strong-read current/version watermark, immutable descending version pages, scope/resource/count-bound signed cursor, absolute unversioned same-instance `entry.fullUrl`, full FHIR history metadata, strict parameter rejection, and mutation-stable tests are required |
| Wire / URI boundary | request-derived URI resolution, static Allow, and wildcard parameter handling were unsafe/incomplete | All URI/canonical fields are inert and pinned-local-only; Accept evaluates supported parameters on wildcard ranges with RFC specificity/q; 405 Allow and CapabilityStatement use one request-time atomic config generation's LIVE ENABLED methods and never advertise blocked interactions |
| Cutover / audit | PostgreSQL Patient is the live authority (with **zero current write paths** — the repository is read-only, so drain/fence gates must be measured against write grants, not observed writers); no MedicationRequest runtime/store/writer/data currently exists; ARC-008 requires one authority; Provenance is a projection and internal audit remains authoritative | Patient uses read-only shadow parity plus human cutover, whose **idempotent** transaction creates FHIR VERSION 1 as immutable `SYSTEM_CUTOVER` creation baseline without PostgreSQL history backfill — per-patient TWIs are guarded by a conditional immutable **PATIENTLINK** (keyed by `hmacPatientId`, never the raw patientId) so a re-run can never mint a second logicalId, CURRENT carries `internalPatientId` as the projection/reception linkage, and the final advance is gated on set equality proven by a membership **and** cardinality check, not a count match alone; re-cutover after rollback must re-enter `SHADOWING` to regenerate parity and is additionally held by `BLOCKED_RECUTOVER_DIVERGENCE_RESOLUTION` because rollback-window divergence has no reconciliation path; MedicationRequest starts with one FHIR ingestion writer and no migration/backfill; never dual-write or automatically fall back |

#### Independent domain review — required corrections

All findings below are absorbed into WP-4250 rather than registered as parallel
implementation tasks. The exact11 documents remain PROPOSED and must be
corrected and independently re-reviewed as one atomic set.

| Severity | Required correction | Static evidence |
|---|---|---|
| HIGH | Select one external authoritative write producer: either the separate intake command boundary or `/fhir/R4`; define actor/client class, audience, scope, qualification, purpose-of-use, payload/result, and idempotency for it | ARC-008/API-003/API-008 producer descriptions diverge; production identity and role-to-scope remain unimplemented/unapproved |
| HIGH | Bind every clinical TWI to the exact tenant+pharmacy+resource authority state and epoch; define PostgreSQL writer drain/fence and prohibit any cross-store atomicity claim | API-008/DB-005 currently bind rotation state, not the resource-authority handoff |
| HIGH | Resolve Patient cutover versus the live reception foreign key/join and define MedicationRequest versus internal Prescription authority, cardinality, mutable fields, status, correction lineage, and projection | live reception still reads PostgreSQL Patient; exact11 does not close Prescription/MedicationRequest ownership |
| HIGH | Either disable Patient create initially or define same-TWI `(tenantId, pharmacyId, patientNumber)` uniqueness plus possible-match/manual resolution, merge/unmerge lineage, and lifecycle behavior | DOM-002 uniqueness is absent from API-008/DB-005 create TWI; Patient create is enabled while merge/unmerge is prohibited |
| HIGH | Fence lookup-key retirement before drain, then prove stable version-addressable residual zero; otherwise declare retirement unsupported | current zero-proof can race a stale writer and has no complete version manifest/index |
| HIGH | Define replay as byte-exact or semantic-exact and persist the required response representation, serializer/version, status, headers, and `Prefer` semantics; define ambiguous-result reconciliation without blind retry | API-008 requires exact replay while DB-005 lacks a complete stored response contract |
| HIGH | Bound search snapshot creation by scanned items, matches, segments, bytes, wall time, and per-scope quota; define overload, cancellation, cleanup, and retry behavior | `_count <= 100` bounds page size but not first-page materialization work |
| HIGH | Make PHI-bearing patient search body-based and production-disable the GET query form; require `no-store` on every FHIR response and exact tenant+pharmacy DB enforcement | API-001 still puts patient identifiers in URLs; API-008 only calls out `/metadata`; DB-005 IAM scope stops at tenant |
| HIGH | Define durable PHI read/search/deny audit semantics and write intent→fact convergence with stable event ID/fingerprint, idempotent delivery, retry/DLQ, reconciliation, and failure behavior | registry coverage and outbox cardinality do not prove durable audit facts or exactly-once convergence |
| MEDIUM | Fix parser and error boundaries: pre-capture byte/depth/member limits, duplicate-member/UTF-8 policy, 400/413/415/422 mapping, 401 with `WWW-Authenticate`, distinct 403, `Retry-After`, bounded attempts, and cursor restart | API-008 captures raw bytes before a defined resource cap and merges 401/403 semantics |
| MEDIUM | Bound API-001 Patient projection search by fetched candidates, decrypted bytes, memory, wall time, and per-scope concurrency; define a measured cap, fail-closed overload result, and a non-PHI coarse-index alternative before production use | DB-005 currently fetches and decrypts the whole pharmacy candidate set in memory and leaves its scale limit/open optimization unresolved |
| MEDIUM | Require server-generated opaque non-PHI logical IDs and reconcile their permitted key/URL use with the stated PHI prohibition; constrain tombstone text to unsupported/future legacy handling while delete remains disabled | API-008/DB-005 currently contain internal logical-ID and delete/tombstone contradictions |
| MEDIUM | Establish a fixed-package/profile evidence chain in the source registry and correct formal specification references before treating package or canonical identity as verified | exact11 records candidate hashes, while SRC-FHIR-002/003 and direct construction-prompt references do not establish the claimed provenance |

#### Revision 7 disposition (2026-07-31) — corrections applied, re-review pending

Every finding above received a correction in the exact11 working tree. No
correction is claimed as approved; each is a PROPOSED edit awaiting independent
re-review. Where a finding offered a fail-closed alternative, that alternative
was taken rather than designing new capability.

| Finding | Disposition | Where |
|---|---|---|
| HIGH producer | `/fhir/R4/*` selected as the sole external authoritative write producer; separate intake command boundary demoted to unselected; producer actor/client class, audience, scope, qualification, purpose-of-use, payload/result, idempotency fixed in a table; all write interactions stay phase-disabled until those prerequisites exist | ARC-008 §3.1; API-003 §1; DOM-005 §2; API-004 §1 |
| HIGH authority fence | New persisted per-resourceType authority control item (`authorityState`/`authorityEpoch`/`writerFenceToken`) with a mandatory same-TWI ConditionCheck counted into the action/size budget; PostgreSQL drain → fence → epoch advance → new writer ordering; cross-store atomicity claims prohibited | API-008 §9.1; DB-005 §5.1, §11 |
| HIGH cutover / ownership | live `reception_entries_patient_fk` and `INNER JOIN patients` recorded as a cutover blocker with four required design answers; Prescription (DOM-002 C4) restored to the internal-authority list it had been omitted from, and its unresolved relationship to MedicationRequest tabulated | DOM-002 §0, §2, §4; DB-005 §11; ARC-008 §3; DOM-005 §4; DOM-006 §1.1 |
| HIGH Patient create | Fail-closed option taken: Patient create is initially disabled (405, unadvertised). Four prerequisites recorded for ever enabling it, including the same-TWI patientNumber uniqueness guard keyed on an HMAC rather than the raw number | API-008 §2.1; DB-005 §5 create template; DOM-002 §10 |
| HIGH key retirement | Fail-closed option taken: retirement declared unsupported, retained set monotonically increasing, rotation refused rather than retiring past the approved bound. Rationale recorded: no version-addressable residual manifest exists, so residual-zero is unprovable | API-008 §4.2.1; DB-005 §5.2 |
| HIGH replay | Replay defined as wire byte-exact, achieved by re-deriving the body from the referenced immutable VERSION through a pinned deterministic serializer and verifying `responseBodyDigest` — chosen so it does not conflict with the existing prohibition on storing raw payloads. Full persisted response field set tabulated. `Prefer` rejected outright because it would change the representation without entering fingerprint v1 | API-008 §4.1.1, §4.3; DB-005 §5.2 |
| HIGH search bounds | Seven materialization bounds (scanned deltas, candidates, manifest entries, segments, bytes, wall time, per-scope concurrency) with 429/503 + `Retry-After`, no partial results, cleanup of unpublished segments, and cancellation on disconnect | API-008 §5.3; DB-005 §4.1 |
| HIGH PHI exposure | GET patient-search marked PRODUCTION_DISABLED with body-based form as the production path (existing wire shape unchanged for synthetic environments); `Cache-Control: no-store` required on every FHIR response with no PHI-based branching; `dynamodb:LeadingKeys` scoped to tenant **and** pharmacy, with the fallback options constrained to preserve that granularity | API-001 §2, §5; API-008 §8; DB-005 §7 |
| HIGH audit durability | Stable `eventId` identity reused across attempts, at-least-once delivery converging via the existing dedupe item, append-only outbox/DLQ with no TTL, reconciliation defined as the intent/dedupe set difference, and a rule that PHI responses are not returned before the audit intent is durably committed | API-008 §9.2; DB-005 §6.4 |
| MEDIUM parser/errors | Pre-capture byte cap evaluated *before* fingerprint byte capture (closing the ordering defect), UTF-8 and duplicate-member rejection, incremental JSON structure caps, 401 `security` + `WWW-Authenticate` split from 403 `AUTH-0003`, 413/`too-costly` and `Retry-After` rows added, cursor restart semantics | API-008 §6, §7.1, §8 |
| MEDIUM projection bounds | Five measured caps on candidate fetch/decrypt/working set/wall time/concurrency, fail-closed 503 with no truncated results, non-PHI coarse-index alternative required before production | API-001 §4, §5; DB-005 §3.4 |
| MEDIUM logical ID / tombstone | Server-generated opaque non-PHI logical IDs, with the PHI-in-keys prohibition reconciled by making non-PHI-ness the precondition for key/URL use; tombstone text constrained to future legacy handling while delete stays disabled | API-008 §3.2; DB-005 §3.1 |
| MEDIUM provenance | Package hash and canonical URLs marked `UNREGISTERED_PROVENANCE`; recorded that SRC-FHIR-002/003 are HTML pages with no hash and therefore establish neither the package artifact nor the canonical URLs. Registering the artifact requires editing `docs/regulatory/source_registry.md`, which is **outside the exact11 path allow-list**, so it is raised as a separate `SSOT_UPDATE_REQUIRED` rather than performed | DOM-006 §1.1; PRD-007 §4 |

New blockers introduced by this correction pass, each requiring its own approved
amendment: `BLOCKED_WRITE_PRODUCER_PREREQUISITES`,
`BLOCKED_RECEPTION_PATIENT_COMPATIBILITY`,
`BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP`,
`BLOCKED_PATIENT_CREATE_UNIQUENESS`, `BLOCKED_LOOKUP_KEY_RETIREMENT`,
`BLOCKED_PATIENT_SEARCH_URL_PHI`, `BLOCKED_PATIENT_SEARCH_SCALE_BOUND`,
`BLOCKED_PACKAGE_PROVENANCE`.

**Self-consistency sweep after the correction pass.** A read-only sweep of the
corrected tree found four places where Revision 7 left text asserting the
opposite of a rule it had just introduced. All four were corrected in the same
pass and are recorded here rather than left for the reviewer, because they are
objective contradictions rather than judgement calls:

1. API-008 §8 permission table still granted `patient:write` for
   `post-cutover create/update`, contradicting §2.1. Split into an `update` row
   plus an explicit row stating create is 405 and that holding the scope does
   not enable it.
2. API-008 §4.2 still said key material is retained "until no replayable record
   remains", implying retirement is reachable. Corrected to state retirement is
   unsupported and the retained set only grows.
3. DB-005 §5.2 carried the same implication; corrected identically.
4. API-008 §12 stop condition said "non-monotonic rotation / unsafe retirement",
   implying a safe retirement exists. Corrected to prohibit retirement of any
   kind. DB-005 §5.2's heading was also widened, since that subsection now
   contains the create/update transaction templates as well.

#### Revision 7 independent re-review result (round 1) — REQUEST_CHANGES ×3

Three fresh-context read-only reviewers ran against the frozen packet
(`483411c7…`). All three returned REQUEST_CHANGES. The Codex second opinion was
still unavailable. Aggregate: 11 HIGH, 13 MEDIUM, 9 LOW including overlaps.
Reviewers independently confirmed that no exact-path violation occurred, that
the four code/migration facts Revision 7 cites are accurate, that no dangling
cross-reference exists, and one reviewer reproduced the frozen packet hash
itself. The failures are in the corrections' substance, not their provenance.

**HIGH — Revision 7 left its own new rule contradicted (same class as the
self-consistency sweep, which was therefore incomplete).**

| # | Finding | Location |
|---|---|---|
| R1-H1 | `DB-005 §4.1` still lists Patient post-cutover as `read/vread/history/search/create/update`. This is the access-pattern section a storage implementer reads first, and it is the one place out of six still asserting create is enabled | `dynamodb_single_table_design.md:323` |
| R1-H2 | `DB-005 §12` prohibits "retiring without fleet/replay-window proof", which by contraposition permits retirement with proof, contradicting the unconditional prohibition in the same section | `dynamodb_single_table_design.md:1012` |
| R1-H3 | `API-008 §11` demands `POST /fhir/R4/Patient` return 405 **in every phase**, but pre-cutover the route is phase-disabled and must be 404. Returning 405 discloses the route's existence to unauthenticated callers — a fail-closed regression introduced by Revision 7 itself | `fhir_rest_facade_contract.md:963` |

**HIGH — design defects in the corrections themselves.**

| # | Finding | Location |
|---|---|---|
| R1-H4 | `authorityState` was declared monotonically forward-only, but no value represents the post-rollback state. After a rollback the state stays `FHIR_PRIMARY`, so a **freshly started** FHIR writer passes both the precondition and the ConditionCheck. The epoch fence stops stale writers only | `dynamodb_single_table_design.md:457`, `fhir_rest_facade_contract.md:819` |
| R1-H5 | No enforceable fence primitive exists on the PostgreSQL side. "Stop the writer" is application self-restraint; an instance that never receives the stop signal keeps its write grant. "In-flight = 0" is a property of the observation instant and cannot exclude a transaction starting immediately after. No post-cutover divergence detector is defined | `dynamodb_single_table_design.md:914-928` |
| R1-H6 | **The retirement rationale is factually wrong.** Alias records are keyed `PK = …#FHIRIDEMPOTENCY#{resourceType}` / `SK = KEY#{hmac}` — one partition per (tenant, pharmacy, resourceType), not scattered per resource instance. A single-PK Query enumerates them. The fail-closed conclusion may stand, but not on this reasoning | `dynamodb_single_table_design.md:530` vs `:434` |
| R1-H7 | Disabling Patient create does not close the hazard: **Patient PUT remains enabled and its TWI has no patientNumber guard**, and no immutability is declared for `identifier`/`patientNumber`. A PUT can still produce two Patients sharing a patientNumber, with merge/unmerge unsupported | `fhir_rest_facade_contract.md:85`, `dynamodb_single_table_design.md:587-599` |
| R1-H8 | The outbox `deliveredAt` Update carries no ConditionExpression. Setting it once — even wrongly — removes that `eventId` from the unconverged set permanently, making an audit gap silent. This is the only convergence detector | `dynamodb_single_table_design.md:755-758` |
| R1-H9 | A replay digest mismatch is a permanent 500, and §4.3 forbids re-executing the write, so the client's only escape is a different key — which creates a **duplicate clinical resource**. Compounding this, `resourceJson`'s DynamoDB attribute type is unspecified; stored as `M`, numeric normalisation drops FHIR decimal trailing zeros and breaks byte equality. No serializer retention obligation and no collation rule are stated | `fhir_rest_facade_contract.md:275-295`, `dynamodb_single_table_design.md:155` |
| R1-H10 | `GSI2PK = TENANT#{tenantId}#RECEPTION#{receptionId}` has no pharmacy segment, so the pharmacy-granularity `LeadingKeys` correction does not cover every access path. DB-005 `:242` claims all GSI PKs carry the tenant+pharmacy prefix, which is false for GSI2 | `dynamodb_single_table_design.md:294` vs `:242` |
| R1-H11 | The pharmacy-prefix correction depends on canonical `#`-free IDs and on `GLOBAL` being reserved, but `branded-ids.ts` enforces neither. A pharmacy literally named `GLOBAL` would place its PHI inside the tenant-wide partition that the newly separated tenant-wide session policy is allowed to reach — a privilege-escalation path that did not exist before this correction | `packages/shared-kernel/src/branded-ids.ts:28-43` |

**HIGH — audit reconstructability.** The outbox intent item's field list is
closed and carries no audit payload, so a DLQ-stranded intent leaves only
"eventId X never converged": what was disclosed, to whom, about which patient
cannot be reconstructed even though the PHI was already returned. Separately,
the durable-commit-before-response rule is conditioned on "responses **containing
PHI**", which by construction excludes deny responses — so a failed cross-scope
probe can be answered without its audit intent, and because no intent was
committed the reconciliation difference never shows it either.

**MEDIUM (selected).** Retained lookup versions grow monotonically while each
version costs one alias action, so the 100-action budget is eaten over time and
patients with many indexed tokens become permanently un-writable, with no escape
because retirement is unsupported — the same mechanism also makes a compromised
HMAC key impossible to withdraw. `maxConcurrentSnapshotsPerScope` has no
decrement or crash-recovery rule, so repeated crashes pin the counter and the
scope returns 429 forever. Reconciliation scans an unbounded, monotonically
growing partition — the one new path Revision 7 did *not* bound. "Confirm no
active cursor references the snapshot" is unimplementable because cursors are
client-held signed tokens with no server-side record. The patientNumber HMAC
guard has no key-derivation, version, or rotation discipline, so a key rotation
silently breaks the uniqueness invariant it exists to enforce. Method/route
resolution is not ordered after authentication, so an unauthenticated caller can
read the LIVE ENABLED method set out of 405 `Allow` responses.

**Disposition.** These are not closable by wording alone. R1-H4, H5, H7, H9 and
the audit-reconstructability findings require design decisions; R1-H6 requires
replacing a rationale that is factually false. R1-H10 and R1-H11 name defects in
key design and in shared-kernel enforcement that sit outside this WP's
Markdown-only path allow-list, so they must be raised as prerequisites rather
than fixed here. Round 2 of the correction cycle is required, and it is
comparable in size to round 1.

#### Revision 8 — round 2 corrections (2026-07-31)

Every round-1 finding received a correction, again taking the fail-closed option
wherever one existed. The batch narrowed further rather than gaining capability.

| Finding | Correction |
|---|---|
| R1-H1 | `DB-005 §4.1` now reads `read/vread/history/search/update` for Patient post-cutover, with create marked 405/404 by phase; the access-pattern `create` row is annotated MedicationRequest-only |
| R1-H2 | `DB-005 §12` now prohibits retirement unconditionally, matching API-008 §12; the proof-conditioned wording is gone |
| R1-H3 | `API-008 §11` now requires 405 **post-cutover** and 404 **pre-cutover**, and states why: 405 would disclose that the route exists |
| R1-H4 | The monotonic-forward claim on `authorityState` is withdrawn and `POSTGRES_PRIMARY_ROLLED_BACK` added; only `authorityEpoch` is monotonic. `writerFenceToken` must now be held by the writer from its own configuration or lease and compared against the control item, so reading the item is no longer sufficient to satisfy the check |
| R1-H5 | Recorded that no enforceable fence primitive exists on the PostgreSQL side and that "in-flight = 0" cannot be proven without one. Requires either a write-grant revoke, a read-only role switch, or a DB-side fence, plus a post-cutover divergence detector, before cutover. `BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE` |
| R1-H6 | The rationale is replaced with the true one: aliases live in one partition per (tenant, pharmacy, resourceType) and **are** enumerable by a single-PK Query; what is missing is a scan bound, a simultaneous `replayUntil`-expiry-and-zero-residual proof, and failure/rollback semantics. The conservative conclusion stands on corrected grounds |
| R1-H7 | New `API-008 §2.2` declares `identifier`, the patientNumber slice and `Patient.id` immutable post-cutover, rejecting a changing PUT with 422 before the TWI. Also records that cutover-baseline uniqueness is merely inherited from the PostgreSQL constraint and stops protecting writes once PostgreSQL is no longer the writer. `BLOCKED_PATIENT_IDENTITY_MUTATION` |
| R1-H8 | The `deliveredAt` clear is now a TWI carrying `ConditionCheck(dedupe exists)` plus `attribute_not_exists(deliveredAt)`, and the outbox discipline is renamed *monotonic single-transition, no delete* so it is not mistaken for §6.1 immutability |
| R1-H9 | `resourceJson` is fixed as a UTF-8 byte string (`S`) because `N` normalisation drops FHIR decimal trailing zeros; serializer versions gain a retention obligation as strong as key material's; member-order collation is pinned to code-point order. The permanent-500 hole is **recorded as unresolved** — `BLOCKED_REPLAY_PERMANENT_FAILURE` — rather than claimed closed, because fail-closed here still leaves the client a duplicate-creating escape |
| R1-H10 | `GSI2PK` now carries the pharmacy segment; the false "all GSI PKs carry tenant+pharmacy" claim is corrected into a stated invariant for future indexes; SEC-008's verification scope is extended to GSI and Scan |
| R1-H11 | Recorded that `branded-ids.ts` enforces neither `#`-exclusion nor a `GLOBAL` reservation, that a pharmacy named `GLOBAL` would be reachable from the tenant-wide session policy, and that this escalation path did not exist before the correction. Raised as a prerequisite outside this WP's allow-list. `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` |
| audit | Intents must now carry an encrypted payload or immutable-store reference sufficient to reconstruct the fact, so a DLQ-stranded intent no longer loses what was disclosed. The durable-commit condition widened from "responses containing PHI" to "auditable operation", closing the deny-audit gap. Unauthenticated 401s are recorded as outside this contract's convergence guarantee, for SEC-007/SEC-008 to place |
| MEDIUM | Retained-version budget expressed as the residue of 100 actions and monitored at write preflight; key-compromise having no withdrawal path recorded as accepted; snapshot concurrency changed from a counter to an expiring lease; reconciliation given a sparse index and measured bounds; the unimplementable "no active cursor references it" test replaced by expiry; patientNumber guard given pharmacy+purpose key derivation and rotation discipline; request ordering fixed at authenticate → authorise → resolve → exist with a single 401 and no `Allow` for unauthenticated callers; `no-store` moved to a single send choke point; the bound-disclosure claim narrowed to "prevents precise inference", acknowledging the 1-bit threshold oracle |

Two findings could not be fixed here and are prerequisites for other work:
`branded-ids.ts` enforcement (`packages/` is outside the allow-list) and the
registration of the JP Core package artifact in `docs/regulatory/source_registry.md`.

Round 2 introduced five further blockers: `BLOCKED_PATIENT_IDENTITY_MUTATION`,
`BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE`, `BLOCKED_REPLAY_PERMANENT_FAILURE`,
`BLOCKED_AUTH_RESPONSE_FAMILY_ALIGNMENT`, `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT`.

#### Revision 8 re-review result (round 2) and Revision 9 corrections (round 3)

Round 2 returned REQUEST_CHANGES ×3 again, but converged sharply: the three
reviewers judged nearly every round-1 finding **closed**, and the new HIGH count
fell from 11 to 3 (independent verifier 2, security 3, data-integrity 0). All
three independently reproduced the frozen packet hash and confirmed no
exact-path violation. Round 3 corrected every round-2 finding.

The two round-2 HIGH findings worth recording in full, because both describe
defects that round 2's own corrections created:

- **The approval-facing records contradicted the SSOT.** `Plans.md`'s
  *Recommended safe default 3* — the very text the `推奨承認` applied to — still
  presented retirement as a supported mechanism, and `State.md` still called the
  authority state monotonic. A human approver reads those, not a 4,349-line
  diff, so the approval would have attached to a design that no longer exists.
  Round 3 rewrote both, plus the decision-surface row.
- **Patient became unregisterable.** Disabling create (round 2, to stop
  duplicate patientNumbers) combined with immutable identity, unsupported
  delete/merge, and PostgreSQL no longer being the writer, closes the Patient
  set permanently after cutover. Nothing in the cutover gate list required a
  registration path to exist, so cutover was executable into that state — leaving
  operations to choose between停止 and the PostgreSQL direct write the design
  forbids, or to rewrite an existing record's demographics and end up with two
  patients' dispensing history under one `Patient.id`. That is a worse
  misidentification hazard than the duplicate it was meant to prevent. Round 3
  made `BLOCKED_PATIENT_IDENTITY_MUTATION` a **cutover** blocker and added the
  registration/correction path to the §11 gate list.

Other round-3 corrections: `DB-005 §11` still defined the state machine as
one-way (the canonical definition, contradicting §5.1); the `authorityState`
correction was propagated to DOM-002, DOM-005 and DOM-006; the alias canonical
outcome tuple wrongly included `lookupKeyVersion`, which would have made every
replay after a rotation a permanent integrity error; the retained-version budget
residual was uncomputable without a cap on indexed token partitions, so
`maxIndexedTokenPartitions` was introduced as a joint invariant; `writerFenceToken`
self-holding was shown to be unenforceable at the DynamoDB layer — the same
"application self-restraint" this batch rejected on the PostgreSQL side — and is
now `BLOCKED_WRITER_FENCE_TOKEN_ISSUANCE` rather than claimed as working;
`BLOCKED_LOOKUP_KEY_RETIREMENT` was given the effect of gating write enablement,
since a key that cannot be withdrawn should not be in service; `Allow` is now
filtered by caller scope, closing the same disclosure in the scope dimension that
round 2 closed in the authentication dimension; the request ordering was split
into two authorisation stages so it is actually implementable alongside
per-interaction scopes; the audit outbox gained a `PENDING#`/`DONE#` namespace
(no new GSI, so it cannot repeat the GSI2 defect), inline-only payloads, a
post-convergence payload drop, and a deny-path quota, because making deny audit
durable had opened an attacker-driven path to unbounded permanent writes.

Two things were **simplified rather than patched**. Replay now returns the stored
`resourceJson` octets verbatim instead of re-deriving them through a pinned
serializer: the re-derivation path necessarily went bytes → parse → serialize →
bytes, and the parse layer was never fixed, so FHIR decimal trailing zeros could
be lost before serialisation regardless of the `S` storage decision. Removing the
serializer from the replay path also removes its retention obligation and its
collation risk. Separately, the `PHARMACY#GLOBAL` sentinel was replaced with a
distinct partition-key space, which structurally eliminates the escalation path a
pharmacy named `GLOBAL` would have opened — that fix was inside the allow-list all
along, so waiting on the external `branded-ids.ts` prerequisite was unnecessary.

Round 3 added `BLOCKED_WRITER_FENCE_TOKEN_ISSUANCE` and
`BLOCKED_AUDIT_PAYLOAD_EXTERNAL_STORE`, and narrowed
`BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` to prefix ambiguity only.

#### Revision 9 re-review result (round 3) — REQUEST_CHANGES ×3, iteration limit reached

All three reviewers returned REQUEST_CHANGES again and all three independently
reproduced the packet hash. Round 3 closed the great majority of round-2
findings — the independent verifier judged 17 of 19 closed, and the substantive
design work was called sound — but the pass is not decision-ready and the
correction cycle has reached its iteration limit. **This is a human escalation,
not a completion.**

Distinct round-3 findings, deduplicated across the three reviewers:

| Severity | Finding | Character |
|---|---|---|
| HIGH | `DB-005 §6.4`'s canonical key block still reads `SK = INTENT#EVENT{eventId}` while every other reference in the batch uses `PENDING#`/`DONE#`. An implementer copying the key block writes `INTENT#`, `reconciliation`'s `begins_with(SK, "PENDING#")` then returns the empty set forever, and `AUDIT_CONVERGENCE_PENDING` never fires. The clearing TWI still succeeds because a Delete on a non-existent key succeeds. This silently disables the mechanism the batch calls its only convergence detector — the exact outcome R1-H8 was written to prevent | Bookkeeping, one line, severe effect |
| HIGH | The approval-facing records still contradict the SSOT, for the **third consecutive round**. Safe default 3 still describes replay as re-derived through a pinned serializer — a path §12 now lists as 実装禁止 — still asserts the authority ConditionCheck means "a write cannot commit against a store that is no longer the authority" when §9.1 withdrew that guarantee, and still frames the un-withdrawable lookup key as an accepted risk rather than a write-enablement gate. `State.md`'s blocker list contains none of the blockers added in rounds 2 and 3, and the status string is two revisions stale | Bookkeeping, recurring |
| HIGH | DLQ payload retention is self-contradictory: §6.4 requires DLQ items to keep the payload so a stranded intent can still be reconstructed, and also requires the post-convergence drop to apply to them — but a DLQ item is by definition unconverged, so one reading keeps payloads forever and the other drops exactly the ones most needed. The drop itself is prose, not a ConditionCheck, unlike the clearing TWI it parallels | Design gap |
| HIGH | The deny quota's "cut off with 429 before the auditable operation happens" exists only in DB-005, contradicts API-008 §12's unconditional prohibition, and hands an attacker a way to exhaust the quota deliberately and then probe under an audit blackout. It reproduces, under attacker control, the invisibility this batch closed | Design gap |
| HIGH | Patient identity immutability — the batch's most safety-critical invariant — is enforced only by application self-restraint. The update TWI's ConditionExpression is `metaVersionId` alone; no guard or ConditionCheck binds identity. This is the same standard the batch explicitly rejected for the PostgreSQL fence and for `writerFenceToken`, applied inconsistently | Design gap |

MEDIUM findings, also deduplicated: `maxIndexedTokenPartitions` has no evaluation
point or overflow behaviour and its stated dependency on the §7.1 JSON caps does
not hold numerically, because one identifier yields two partitions; the
patientNumber guard is "one item" in API-008 and per-retained-version in DB-005,
and the joint invariant counts neither; the re-cutover path
`POSTGRES_PRIMARY_ROLLED_BACK → CUTOVER_PENDING` cannot satisfy the parity gate
because parity is only produced in `SHADOWING`, which is unreachable from the
rollback state; `BLOCKED_LOOKUP_KEY_RETIREMENT` carries a withdrawn rationale and
a weaker effect in DB-005 than in API-008; §11's test obligation still recites the
four-stage ordering §8 withdrew; **Revision 9 is absent from the body 変更履歴 of
all seven documents that declare that body history is the authoritative source**;
the frozen-packet note still says "Revisions 3–7 / Revision 7 entries"; the
403-versus-404 difference discloses cutover phase to an authenticated caller
holding no patient scope; and the new `SCOPE#TENANT#` prefix space has the same
tenantId prefix-ambiguity exposure that `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT`
only illustrates for pharmacyId.

**Assessment.** The trajectory is real — 11 HIGH in round 1, then a handful per
round, with each round's round-1 findings confirmed closed. But the residual
defects are dominated by one repeating failure: a correction lands in the section
that introduces a rule and not in every section that reads it. Three rounds of
manual sweeping have not caught it, and two of the three round-3 HIGHs are
instances of it. Reviewers proposed the systemic answer: derive the approval-facing
records from the SSOT blocker set mechanically, and add that consistency to
`check:ssot-index` rather than relying on a human sweep. That is a change to the
validation gates, which is outside this WP's Markdown-only scope.

**Iteration limit reached.** The correction cycle ran its three permitted rounds
and did not converge. WP-4250 returns to WIP for human direction; it is not
complete, not approved, and not landed.

**Post-round-3 mechanical fixes applied under explicit user direction.** Three
items were corrected after the escalation, chosen because reviewers agreed on
them and none carries design judgement:

1. `DB-005 §6.4`'s key block now declares `PENDING#` / `DONE#` / `DLQ#`
   explicitly, states the single transition, fixes the SK lexical order, and
   records why a single `INTENT#` namespace silently disables the convergence
   detector.
2. The approval-facing records were re-synced to the SSOT: safe default 3 and the
   decision-surface row no longer claim serializer re-derivation or unconditional
   fresh-writer exclusion and now present `BLOCKED_LOOKUP_KEY_RETIREMENT` as a
   write-enablement gate; `State.md` gained the full blocker list and a current
   status string; the frozen-packet note's revision range was corrected.

3. Revision 9 was added to the body 変更履歴 of the six documents that carry a
   Revision 9 change_log entry, closing the gap between the frontmatter and the
   body history those documents declare to be their authoritative source. The
   remaining three documents that make that declaration (API-003, API-004,
   API-001) were not changed in round 3, so they need no entry. DB-005's entry
   also records the key-block correction above, in both its frontmatter and its
   body.

#### Revision 10 — round-3 HIGH findings closed (2026-07-31)

The three design-level HIGH findings were corrected under user direction. Each
was an instance of the same thing: a rule that the batch declared but did not
enforce, or a correction that opened a new way around itself. All three are
closed by applying, to these rules, the standard the batch already applied
elsewhere.

| Finding | Correction |
|---|---|
| Patient identity immutability was enforced only by a pre-TWI 422 — application self-restraint, the very thing the batch rejected for the PostgreSQL fence and for `writerFenceToken` | CURRENT now carries an `identityDigest` attribute (SHA-256 over the length-prefixed identity tuple), and the Patient update's `Update(CURRENT)` composes `identityDigest = :expectedIdentityDigest` into its ConditionExpression. The adapter derives the expected value from the validated request resource, so a request that changed identity fails the condition and the TWI aborts atomically. **No extra action**, so the 100-action budget and the `maxIndexedTokenPartitions` invariant are unaffected. The pre-TWI 422 stays as the primary rejection; the ConditionCheck is the backstop for any path that bypasses it. An item with no `identityDigest` fails the comparison and is therefore fail-closed by construction |
| The deny quota cut the request off with 429 *without* generating the auditable operation, handing an attacker a way to exhaust the quota deliberately and then probe under an audit blackout — reproducing, under attacker control, the invisibility the batch had just closed | Quota exhaustion now **degrades to aggregate recording** rather than to silence: after the quota is reached, a single aggregate intent per (principal, scope, window) is durably committed *before* the 429 is returned. It carries the attempt count and window bounds but no target IDs, which is what caused the amplification. If the aggregate intent cannot be committed, the 429 is not returned either — it becomes a 500. **No unrecorded window can exist.** The quota applies per principal; scope alone is not a cut-off, since that would let one principal silence a whole pharmacy's deny audit. Coarser aggregation is left to SEC-007/SEC-008, but the floor — at least one durable record — is fixed here and not delegated. Phase-disabled 404s are recorded as auditable; unauthenticated callers never reach route resolution, so they fall outside. The wire behaviour now lives in API-008 §9.2/§6/§12 as well as DB-005 |
| DLQ payload retention required both keeping the payload for reconstruction and dropping it after a window, while a DLQ item is by definition unconverged — so one reading kept payloads forever and the other dropped exactly the ones most needed. The drop was prose, not a ConditionCheck | The drop is now **convergence-driven and machine-enforced**. A `DONE#` item has already proven convergence at clearing time, so its payload may be dropped after the safety window, via `ConditionCheck(dedupe exists)` + `attribute_exists(payload)` — the same shape as the clearing TWI, because dropping a payload is more destructive than clearing. A `DLQ#` item cannot satisfy that ConditionCheck until manual remediation makes the dedupe real, so **its payload never drops on a timer**. The clearing TWI carries the payload forward to `DONE#`. The unbounded retention that follows for stranded DLQ items is the intended fail-closed outcome and is sent to SEC-007/SEC-008 as `BLOCKED_AUDIT_PAYLOAD_RETENTION_POLICY` rather than solved with a timer |

**Round-3 MEDIUMs remain open** — among them `maxIndexedTokenPartitions` having no
evaluation point or overflow behaviour, the patientNumber guard's
one-item-versus-per-version contradiction between API-008 and DB-005, the
re-cutover path that cannot reach the parity evidence its own gate requires, and
the 403-versus-404 disclosure of cutover phase to an authenticated caller holding
no patient scope. Revision 10 has not been independently reviewed.

These two fixes invalidate the round-3 frozen packet. Any round 4 must re-freeze
and re-review from the hash recorded below.

**Independent review status — Codex lane unavailable, gate NOT satisfied.**
Fresh-context reviewer subagents (independent verifier, security/privacy,
data-integrity) were dispatched against the frozen packet and did not return a
verdict. The Codex second opinion could not run: `codex exec` reported
`You've hit your usage limit ... try again at Aug 5th, 2026`. Neither result is
counted as review evidence, and no verdict is claimed. The maker/checker
separation required for R4 is therefore **not** satisfied: this correction pass
has been checked only by its own author, which does not constitute approval.
WP-4250 stays `INDEPENDENT_RE_REVIEW_REQUIRED`. The self-consistency sweep above
invalidated the first frozen packet, so re-review must run against the current
one.

#### Round 4 re-review result (2026-07-31) and Revision 11 (mechanical)

Round 4 was run under direct user direction against the Revision 10 packet
(`cb5c543c…`, hash independently reproduced by the verifier lane). Two of
three lanes delivered — independent verifier (10/11 documents read in full,
including ARC-008) and data-integrity (DB-005/API-008 in full plus live-code
cross-checks) — **both REQUEST_CHANGES**; the security lane failed to report
twice (`independence_not_satisfied`). The two delivered lanes converged
independently on the same two defects, both introduced by Revision 10 itself
(the aggregate deny intent vs. the outbox lifecycle; the `_lastUpdated`
machinery). Key design findings, all still OPEN: search index deltas have
neither compaction nor a keep-latest rule (either reading decays
irreversibly); the cutover transaction has no path to update the
patientId-keyed projections (logicalId is unlinkable by design) and is not
idempotent (re-runs create duplicate Patients with no repair path);
the aggregate deny intent cannot satisfy the `PENDING#`/`DONE#` lifecycle;
the joint action-budget invariant undercounts update/create actions.
Data-integrity also corrected a premise: PostgreSQL currently has **zero**
Patient writers (repository is read-only), so the cutover gate's drain/fence
is trivially satisfiable today and does not measure what it claims.

**Revision 11 (mechanical, 2026-07-31)** applied only the bookkeeping subset,
per the post-round-3 precedent (no design judgement): DLQ "append-only"
wording aligned to DB-005 §6.4's single-transition discipline in API-008
§9.2/§11 (closing the self-contradiction with §12); the withdrawn 4-stage
ordering removed from API-008 §11's test obligation in favor of §8's 5-stage;
seven unprefixed cross-document `§` references given document prefixes;
patient-search bound-exceeded status deferred to API-001 §4 (withdrawing the
premature 429); `BLOCKED_WRITE_PRODUCER_PREREQUISITES` (API-003) and
`BLOCKED_FIELD_MAPPING` (DOM-006) registered in frontmatter blockers;
IDX-001's change_log revision range corrected; Revision 11 entries added to
the body histories of the four edited documents.

#### Revision 12 — round-4設計findingsの訂正(2026-07-31, user direction)

2026-07-31のuser direction(「NSIPS仕様書入手は後回し。その他はfableが決めた
内容に従う」)を、round-3 escalationが要求していた設計方向の人間委任として記録
する。この委任の効力は**PROPOSEDドラフトの訂正とround 5 re-reviewの実行まで**で
あり、final SSOT approval・implementation・landing・cutoverのいずれも承認しない。
Revision 12は round-4の全設計finding + round-3 open MEDIUM群へ、batchが他所で
既に採っている基準を一貫適用するfail-closed訂正を行った。

| Finding (round 4) | Correction |
|---|---|
| search index deltaに圧縮規則がなく、恒久保持(走査劣化)か規則なき削除の二択に落ちる | DB-005 §3.2へ**keep-latest圧縮規則**を新設: `(partition, logicalId)`単位、retention期限後のsuperseded deltaのみ削除可、latest delta非削除、latest=falseのpairは期限後に全体削除可、clinical TWI外の有界background操作、barrier test証明前は実行しない(未実装の既定=削除しない) |
| cutover transactionが非冪等(再実行が同一patientへ別logicalIdの重複Patientを作り、修復経路なし)かつpatientId-keyed投影への経路がない | DB-005 §11へ**PATIENTLINK item**(patientId→logicalIdのimmutable 1:1 linkage、per-patient TWI内のconditional Put)とCURRENTの`internalPatientId`内部属性を新設。再実行の進捗authorityをPATIENTLINKに一本化し、二重logicalId発行を条件不一致のatomic abortで構造的に排除。投影再生成とreception互換設計のlinkage経路を定義し、cutover gateへ追加(DOM-002 §2の前提列挙も同期) |
| 集約deny intentがPENDING#/DONE# lifecycleを満たせない(試行回数の累積Updateがimmutability違反、identity・配送時期未定義でdedupe ConditionCheckを満たす経路がない) | DB-005 §6.4 / API-008 §9.2で`eventId`を`(principal, scope, windowStart)`から決定的に導出、窓あたり1回のconditional Put、以後は強整合存在確認後に429、**試行回数の保持を撤回**、配送は窓閉鎖+clock skew後、集約deny eventをMOD-008登録範囲(`BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT`)へ追加 |
| joint action-budget invariantがupdate/createを過少計上(updateのdelta setはBEFORE/AFTER両versionに跨る。patientNumber guardは全version分を占めるのに「1件」計上) | operation別invariantへ訂正: MedicationRequest create `7+M+N<=100`、Patient update `7+2M+N<=100`、Patient create(将来)`7+M+2N<=100`(`M=maxIndexedTokenPartitions`)。評価点=write preflightの実数カウント、§7.1 JSON capの従属主張を撤回、API-008 §2.1の「guard 1件」をN件へ訂正 |
| (premise) PostgreSQLに現在Patient書込経路が存在せず、drain/fence gateはtrivially satisfiableで主張を測っていない | DB-005 §11へ前提訂正を記録: fence要件の対象は観測されたwriterではなく**write grant**。grant棚卸しとrevoke/read-only化のevidenceだけがstep 1を充足し、「現在writerがいない」は充足根拠にならない |
| (round-3 MEDIUM) 再cutover `POSTGRES_PRIMARY_ROLLED_BACK → CUTOVER_PENDING`はparity gateを満たせない到達不能経路 | 遷移を`POSTGRES_PRIMARY_ROLLED_BACK → SHADOWING → CUTOVER_PENDING`へ訂正(parity再生成を強制。rollback中のPostgreSQL書込も再parityで検出) |
| (round-3 MEDIUM) 403/404の別がcutover phaseをscope外callerへ開示 | API-008 §8の判定順序へ**phase/enablement判定**段を追加(6段)。phase依存応答はinteraction scope通過callerに限定し、scope欠如は両phaseで一律403 |

対象文書はDB-005・API-008・DOM-002の3件(いずれもexact11内)。各文書の
frontmatter change_logと本文変更履歴へRevision 12を同時記録し、§12停止条件・
test obligationsを同期した。新規blocker追加はなし。

#### Round 5 re-review result — 3レーン中1レーンのみ delivered、REQUEST_CHANGES

Revision 12 packet(`8ff16ca9…` / 5,195行)に対しfresh-context 3レーンを
dispatchした。結果は**部分的**であり、gate充足は主張しない。

| Lane | 結果 |
|---|---|
| data-integrity | **delivered / REQUEST_CHANGES**。packet hashを独立再現(一致)。HIGH 1件、MEDIUM 3件、LOW 3件 |
| security / privacy | **delivered / REQUEST_CHANGES**。同packet hashを独立再現(一致)。MEDIUM 2件、LOW 3件。Revision 12の訂正9項目自体はround-4 findingsを正しく閉じていると判定 |
| independent verifier | **delivered(5回目の起動、2026-08-01)**。Revision 14 packet `ab086c9f…` に対して hash を独立再現し一致。**packet本文 PASS(HIGHなし)**、総合は REQUEST_CHANGES(record-only — findings は全て packet 外)。1〜4回目は verdict を返せず(1回: session limit、3回: 起動後idleで報告なし・明示照会にも無応答)、`independence_not_satisfied` として review evidence に数えていない |
| codex second opinion | 利用不能(usage limit、2026-08-05まで)。記録のみ |

**round 5は3レーン全てがdeliveredとなり完了した。** data-integrityの
findingsはRevision 13で、security/privacyのfindingsはRevision 14で閉じた。
independent verifierは**Revision 14 packetに対してPASS(本文HIGHなし)**を返し、
`BLOCKED_INDEPENDENT_VERIFIER_LANE_UNAVAILABLE`は解除された。
**R4が要求するmaker/checker分離は充足した。**残るのはfinal human SSOT approvalである。

verifier laneの主な確認結果:

- packet hash `ab086c9f…`(5,559行)を独立再現し一致。
- **§7の実装主張をlive codeと突合し完全一致**: `check-boundaries.mjs`の
  marker検知・codec除外・test除外・`main()`からの呼び出しがいずれも実在、
  `check-scripts.mjs`のpositive/negative fixtureも登録済み、両scriptをfresh実行
  してPASS(exit 0)。`branded-ids.ts`の`#`拒否も実在。DB-005 §7が静的検知の
  限界を正直に記載していることも確認。
- **round 1〜4を落とし続けた失敗クラス(ルール導入節だけ直り参照側が旧のまま)は
  再発なし**。残存grep hitは全て却下理由の説明・凍結履歴・禁止リストであり正当。
  §8判定順序は本文とtest obligationの双方で6段一致、budget式・guard N件・
  `intentKind`/`deliverableAfter`/`retentionExpiresAt`/`internalPatientId`の宣言も
  同期済み。
- 未検証範囲(verifier自己申告): DOM-005/DOM-006/API-003/PH-OS/patient_search/
  jp_core strategy/ssot_indexの行単位精読(旧表現grepとentry確認のみ実施)、
  data-integrity/security両laneのfinding listとのDOM系逐条突合。

**MEDIUM 2件はState.md限定であり、同ファイルで閉じた**(packet hashは不変):
Next action節がround-5未完了の旧記述のままだった点と、dirty ownership正本に
未採番コード変更3 pathが未記載だった点。

**LOW 3件はpacket本文に触れるため意図的に未適用とし、State.mdへdeferredとして
記録した**。適用すればhashが動き、いま得たPASSを自ら無効化するためである
(round 1〜4で繰り返した誤りを再演しない)。次にpacket revisionを開く際に畳む:
(a) DB-005 frontmatter blocker注記がRevision 13表現のまま(§7本文と不一致だが
conservative側)、(b) ARC-008本文変更履歴のRevision 13 entryの並び順、
(c) §3.2のpair全体削除特例はsuperseding deltaを持たないため§3.2の機械強制
ConditionCheckを満たせず、当該削除を強制する条件式が未記載。

security laneがPASSと判定した項目(参考、単独ではapprovalではない):
phase非開示6段順序に新oracleは特定できず(403/404の別が漏らすのは静的契約構造
のみ)、keep-latest圧縮はindexが原則4の再生成可能projectionであるためappend-only
/法定保存群と衝突せず位置づけ一貫、budget式(7+M+N / 7+2M+N / 7+M+2N、guard
N件化、評価点=write preflight)はDB-005 §5.2とAPI-008 §2.1/§4.2.1で同一定義に
収束、cutover冪等化はPATIENTLINK単一progress authority・logicalId発行とlink Put
の同一TWI束縛・最終epoch CAS単一適用で二重logicalId経路を構造的に排除しGSI新設
なしでLeadingKeys粒度と整合、集約denyの存在確認→429経路はaudit-before-response
規律に適合(quota未満denyは個別intentで全件記録され無記録窓なし)。

#### Revision 14 — round-5 security/privacy findingsの訂正(2026-07-31)

| Severity | Finding | Correction |
|---|---|---|
| MEDIUM | PATIENTLINKの`SK = PATIENT#{patientId}`が「patientIdは内部surrogateだから非PHI」という**どのSSOTにも規律のない前提**に依存。`migrations/000002_…`の`patient_id`は自由形式TEXTで`patient_number`との同値を禁じる制約がなく、レガシーレセコン移行では患者ID=患者番号の運用が現実にある。その場合SKは生の患者番号となり原則7に直接違反。§5.2でpatientNumber guardをHMAC化していることとも非対称 | SKを`hmacPatientId`(`HKDF(root, tenantId, pharmacyId, purpose="patientLink")`、guardと同一のrotation規律)へ変更し、生値は暗号化item payload内のみに。決定的HMACなので再実行skip判定と投影linkageは復号なしで従来どおり成立。**正しさがpatientIdの由来に依存しなくなる**。あわせて最終epoch CASを**membership + cardinalityの合成**として定義し直し(membershipのみでは余剰link、cardinalityのみでは欠落と余剰の相殺を見逃す)、両検査ともpayload復号を要さないことを明記 |
| MEDIUM | keep-latest圧縮の「latest非削除・retention内非削除」がprose + barrier test依存で、本batchが§5.2 `identityDigest`と§6.4 payload削除に課した「破壊的操作をapplicationの自己抑制に委ねない」基準と非整合。誤削除は存命recordの検索欠落(SAF隣接) | 各deltaへ`retentionExpiresAt`属性を追加し、削除を`TWI(ConditionCheck(superseding delta s: exists AND s.retentionExpiresAt <= :now) + Delete(d exact key) with retentionExpiresAt <= :now)`として機械強制。圧縮roleのleast-privilege分離と実行記録の運用監査を実装WPの承認要件へ |
| LOW | `internalPatientId`のlog/trace/metric禁止がwire禁止と非対称(§11はwire resourceJson/FHIR responseのみ規定)。logicalIdは§9で範囲付き明示済み | §9へ`internalPatientId`と`patientId`生値の access log/APM/trace/exception/metric label/外部送信禁止をlogicalIdとparityで追加。許可される使用面はitem属性(保存時暗号化の対象内)に限定 |
| LOW | 集約deny `eventId`の導出が keyed HMACか無鍵hashか未指定。`eventId`はoutbox SKと§6.1 dedupe keyに載る | keyed HMAC(`HKDF(root, tenantId, purpose="denyAggregateEventId")`)と明記。無鍵hashでは`(principal, scope, windowStart)`の総当たりで「どのprincipalがいつquotaに達したか」をkeyの存在だけから逆引きできる |
| LOW | 開放窓中は集約intentが配送されずreconciliation対象外のため、進行中の総当たりのchain可視化が窓幅+skew分遅延。alertingはSEC-007管轄で未定義 | 本節が保証するのは**記録の完全性**であって**検知の即時性**ではないことを明記し、両者を混同しない旨を追加。「開放窓中のdeny集中を検知するoutbox非依存の経路」をSEC-007/SEC-008起票事項へ明示的に含める(本節でalertingを発明しない) |
| LOW | write grant棚卸しにbreak-glass/superuser/migration credentialの明示がなく、乖離detector期間が有限(`patients`行はjoin先として存続) | 棚卸し対象へ break-glass/緊急アクセスcredential・superuser/owner role・migration実行credential・運用者の直接接続を明示列挙し、列挙漏れを「停止済み」と扱わないことを規定。detector終了根拠を「一定期間経過」ではなく権限revokeの証跡または`patients`依存の解消へ紐付け |

対象文書はDB-005・DOM-002の2件。§12停止条件・test obligations(PATIENTLINKの
key形、membership+cardinalityの合成、圧縮の機械強制、keyed eventId)・変更履歴を
同期した。新規blocker追加はなし。

**訂正後の自己整合スイープ**(Revision 13と同じ手順を反復)。1件が該当し同じ
passで訂正した。**§9(暗号化と鍵管理の正本)が用途分離鍵を列挙していなかった**。
本batchは検索トークン(§3.2)以外にpatientNumber guard(§5.2)、PATIENTLINK
(§11)、idempotency lookup key(§5.2)、集約deny eventId(§6.4)で決定的HMACを
使うが、定義は各節に分散し、§9のQ4は`HKDF(root, tenantId)`の検索トークン鍵しか
挙げていなかった。鍵階層を読む実装者には他の4用途が見えず、tenant単位鍵の流用
(guard/PATIENTLINKでは低エントロピー値の総当たり列挙を許す)へ倒れる誘因が
残っていた。§9へ導出入力とローテ時の性質を含む正本一覧表を追加し、各節はこれを
参照する形にした。

delivered laneがPASSと判定した項目(参考、単独ではapprovalではない):
budget invariantの数え上げ(固定7・2M・2N)は正確でundercountなし、
`identityDigest`はaction数を増やさない、cutover冪等性のシナリオ(i)部分失敗後の
再実行 / (ii)並行実行 / (iii)epoch advance後の再実行は構造的に成立、
集約denyの「窓あたり1件以上」の下限は成立。またlive codeを確認し、
`patients`表へのproduction書込経路がゼロである(patient-repositoryはSELECTのみ、
INSERTはintegration test fixtureのみ)というround-4の前提訂正が**正確**である
ことを独立に確認した。

#### Revision 13 — round-5 data-integrity findingsの訂正(2026-07-31)

| Severity | Finding | Correction |
|---|---|---|
| HIGH | §3.2 keep-latest圧縮の削除条件が削除対象`d`のretention経過しか要求せず、superseding delta `s`が新しい場合に`d.commit <= fence < s.commit`のas-of materializationから logicalIdがsilentに欠落する。同節末尾のbarrier不変条件と数学的に矛盾 | 削除条件へ**`s`自身のretention経過**を追加。`s`が期限を経過していれば`d`を要する fence区間は全て期限外になる |
| MEDIUM | §6.4 集約deny intentのreconciliation除外条件(未閉鎖窓を差分に数えない)が実装不能 — `windowEnd`が暗号化payload内にしかなく、突合が復号と鍵可用性に依存する | 平文属性`intentKind`(`individual`/`aggregateDeny`)と`deliverableAfter`(`windowEnd + max clock skew`、生成時確定・以後不変)を追加。正確な窓境界とprincipal/scopeは暗号化payload側に維持 |
| MEDIUM | §11 rollback→再cutover 2周目: rollback期間中のPostgreSQL側の属性変更はparityで検出されるが解消経路が存在せず(VERSION 2+ backfill禁止・`SYSTEM_CUTOVER`はVERSION 1限定・PUT producer未成立)、統合/削除で対象集合が縮むとPATIENTLINKがorphanとして残り件数一致が恒久不成立。既存の「未解消差分はcutoverをblockする」と合成すると再cutoverが二度と成立しない | `BLOCKED_RECUTOVER_DIVERGENCE_RESOLUTION`として登録(DB-005 §11 / ARC-008 / DOM-002 §2)。解除は(a)反映経路の承認 または (b)rollback期間もPostgreSQLをread-onlyに保つ運用制約の承認。初回cutoverは対象外 |
| MEDIUM/LOW | §11 最終epoch CASの「件数一致」が基数比較として読め、欠落1件と余剰1件が相殺する。count QueryのConsistentRead未指定 | reconciliation対象集合 ⊆ PATIENTLINK集合の**membership検査**として定義。`ConsistentRead=true`の全ページ走査と対象集合の事前凍結を要求し、TOCTOU前提を明記 |
| LOW | `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT`の前提がstale — `branded-ids.ts`はWP-4050(base SHA後)で`#`拒否を実装済みでnegative testもある | round-4のPostgreSQL writer前提訂正と同種の事実訂正。blockerの範囲を「factoryが拒否しないこと」から「キー構築経路がbranded型を経由することの保証」へ縮小し、conservative側は維持 |
| LOW | cutover TWIのrotation CC要否が§5.2「全clinical TWI」と§11列挙で不整合 / CURRENTをPut置換すると`internalPatientId`がsilent消失(templateは`Update`だが保存義務が未明文) | per-patient cutover TWIもrotation CCを持つことを明示し固定action=8として数え方を確定。`internalPatientId`/`identityDigest`をCURRENTの保存必須属性として明文化しPut置換を§12で禁止 |

対象文書はDB-005・ARC-008・DOM-002の3件。§12停止条件・test obligations
(圧縮のsuperseding条件、平文属性による復号なしreconciliation、membership検査、
CURRENT属性保存の各negative test)・変更履歴を同期し、新規blocker
`BLOCKED_RECUTOVER_DIVERGENCE_RESOLUTION`を登録した。

**訂正後の自己整合スイープ**。round 1以降くり返している失敗クラス
(ルールを導入した節だけ直し、それを読む節が旧ルールのまま残る)を潰すため、
新設・変更した各ルールについて参照側をgrepで機械的に洗った。2件が該当し、
同じpassで訂正済みである。判断を要さない客観的矛盾なのでreviewerへ回さない。

1. **§11のPATIENTLINK bulletが旧「件数一致」のまま残っていた**。membership検査
   への訂正は後続bulletにしかなく、遷移条件を導入する側のbulletは
   「PATIENTLINK件数がreconciliation対象件数と一致することを確認した後」と
   読めた。実装者はこちらを先に読むため、round-5 findingが指摘した基数比較を
   そのまま実装し得た。導入側bulletをmembership検査へ書き換えた。
2. **`internalPatientId`が§3.1の属性列に未宣言だった**。§3.1はcurrent/version
   itemの属性の正本であり`identityDigest`はRevision 10でここに追加されている。
   `internalPatientId`は§11でだけ導入され、item schemaを読む実装者には見えて
   いなかった。§3.1へ追加し、両属性がCURRENTの保存必須属性でありPut置換を
   禁じることを同節にも明記した。

Current frozen packet (Revision 14; **the undelivered round-5 verifier lane
must start here**): base SHA `9d8dbc0c3f5201c762dbb39fd9b15fc3ddc4b875` (the
exact11 paths are byte-identical at local HEAD `a1fd780`, which contains no
exact11 changes); candidate diff SHA-256
`ab086c9f8d6e6bfd26e32fbfe9daa21a3b8b6ccd3f324f413b4d2975731cfab6` over 5,559
diff lines (Revision 14, including the post-correction self-consistency sweep
and the §7 record of the `check:boundaries` enforcement). Round 5's data-integrity and security/privacy lanes
both reviewed the Revision 12 packet
`8ff16ca9b3532a38bbf9cd02f3bd2d060be7768b22e6666eecd979a3d3af0592`
(5,195 lines) and each independently reproduced that hash; Revisions 13–14
supersede it, so any further review starts from the hash above.
The intermediate Revision 13 packet was
`3f5a1de2cf11592f779c69dc7c0b56691a640e5b70350f0a66710589e228fb1b`
(5,360 lines) and no lane reviewed it. Revision 12 had itself superseded the
Revision 11 packet
(`96ceec3a9d88e1fb9d9e700fd1d67807ae89c845257c4d30e3c091b187f4db30` / 4,935
lines), which no round reviewed. Round 4 itself reviewed
`cb5c543c73bfcc4d31af472b4a46134429882105be188c265027bf36de89ce57` over 4,919
diff lines (Revision 10). Round 3 itself reviewed
`634da8960b4893e5da7bfbb6ba5f4d9769b2fbdde6b7e0227ae090d19f5e2942` over 4,617
lines; the three mechanical fixes superseded it. (Round 1 reviewed `483411c7…` / 3,721 lines; round 2 reviewed
`a6751a4b…` / 4,349 lines. Each round's corrections superseded the prior packet.) The hash covers `git diff` over the **exact11 content documents
only**, in the order they are listed in the drafted-amendment-set bullet above.
`Plans.md` and `State.md` are owned and edited by this WP but are deliberately
excluded from the hashed range, because they carry the hash itself and would
otherwise make it unverifiable. Note that this diff spans Revisions 3–14; the
Revision 14 entries in DB-005/DOM-002's change_log are the most recent pass
(API-008's and ARC-008's most recent entries are Revision 12 and Revision 13
respectively; neither was edited in Revision 14). This sentence must be updated every round — it was left at "3–7 /
Revision 7" through rounds 2 and 3, which would have led a reviewer to treat
the corrections under review as out of scope.

Observed validation for the Revision 14 pass (2026-07-31):
`node scripts/check-ssot-index.mjs` PASS at 173 documents; `git diff --check`
PASS. The Revision 12 and 13 passes had the same two gates PASS. (The Revision 11 pass
also passed both; its pre-existing `git diff --check` failure — `Plans.md`
trailing blank line at EOF — was corrected in that edit.) No test, typecheck,
build, or runtime gate was run in Revision 12/13 because both passes change
only Markdown SSOT drafts and touch no source, contract artifact, schema, or
migration. No test, typecheck, build, or runtime gate was run because this
pass changes only Markdown SSOT drafts and touches no source, contract artifact,
schema, or migration. `pnpm` scripts could not be invoked because the local
`pnpm` is 11.17.0 while `package.json` pins `packageManager: pnpm@11.18.0`, so
the two applicable gates were executed directly through `node` and `git`.

- **Recommended safe default 1 — candidate profiles:** limit the proposed amendment scope to JP Core `JP_Patient` 1.2.0 and the oral/topical `JP_MedicationRequest` 1.2.0 use case, subject to official fixed-version package, canonical URL, digest, exact profile, terminology, and Must Support verification. This packet does not claim support. If the amendment is approved, injection, derived/unverified Must Support interpretations, and unknown or unresolved terminology remain unsupported and fail closed.
- **Recommended safe default 2 — lifecycle:** prohibit Patient auto-merge, physical delete, and tombstone revival. Initially accept MedicationRequest only with `intent=order`; correction and original-order linkage remain fail closed until an explicit human-approved workflow exists.
- **Recommended safe default 3 — create / update / idempotency:** create and every enabled Patient PUT require a tenant/pharmacy/resourceType-bound stable idempotency key, request-byte fingerprint over exact accepted request-entity bytes, and one conditional no-overwrite alias/guard for every configured active+retained lookup-key version in the same clinical TWI; Patient PUT additionally requires `If-Match` as its sole wire version authority. Each write strong-reads the persisted tenant+pharmacy rotation control and includes its exact generation, mandatory-set digest, and ACTIVE state as a same-TWI ConditionCheck, and additionally a ConditionCheck on the per-resourceType authority control item (`authorityState`, `authorityEpoch`, `writerFenceToken`). **That ConditionCheck does not by itself establish single-writer safety and this default does not claim it does**: `writerFenceToken` is a plaintext attribute every writer can read, so a writer that reads it and calls the value self-held cannot be distinguished at the DynamoDB layer — the same application self-restraint this batch rejected on the PostgreSQL side. Fresh-writer exclusion is not claimed until `BLOCKED_WRITER_FENCE_TOKEN_ISSUANCE` is cleared. **Lookup-key retirement is unsupported in this batch**: the retained version set only grows, key material is not removed, and a rotation that would exceed the approved bound is refused rather than retired past. A compromised lookup key therefore has no withdrawal path, and `BLOCKED_LOOKUP_KEY_RETIREMENT` **stops clinical write from being enabled** until an emergency deactivation route is approved — it is a gate, not an accepted residual risk. Patient create is disabled and, post-cutover, `identifier`, the patientNumber slice and `Patient.id` are immutable, so neither create nor update can produce a duplicate patientNumber — though that immutability is currently enforced only before the TWI, not by a ConditionCheck, and it also leaves no way to register or correct a patient after cutover, which is why it gates cutover. Same-byte replay returns the exact stored result **by returning the stored `resourceJson` octets verbatim**, verified against a stored digest; it is not re-derived through a serializer, and re-deriving it is a §12 prohibition. Byte-different reuse returns 409; ambiguous failure reconciles every applicable version without automatic retry. A digest mismatch is a permanent 500 with no client-side escape that avoids creating a duplicate — recorded as unresolved, not as safe. The whole TWI is limited to 100 distinct action targets and 4 MiB aggregate operation-after item size, each item to 400 KB; overflow is pre-write 422 and is never chunked or offloaded to S3.
- **Recommended safe default 4 — single-writer cutover:** PostgreSQL remains the sole Patient authority until read-only shadow parity is proven and a human approves cutover; the approved cutover transaction creates FHIR VERSION 1 as a truthful immutable `SYSTEM_CUTOVER` creation baseline and does not invent PostgreSQL history. After cutover the FHIR store is the sole Patient writer. **Cutover is not currently executable and this default does not authorize it.** Single-writer safety rests on a time-ordered handover (stop → drain → epoch advance → new writer), and no primitive exists on the PostgreSQL side to enforce the stop: an instance that never receives it keeps its write grant, and "in-flight is zero" is a property of the observation instant. Cutover is additionally blocked until the live `reception_entries` foreign key and `INNER JOIN patients` compatibility design is approved, and until a route exists by which a patient can be registered or an identity error corrected after cutover — with create disabled, identity immutable and PostgreSQL no longer the writer, the Patient set would otherwise be permanently closed. The cutover transaction itself is **idempotent by construction** (Revision 12): each per-patient TWI conditionally Puts an immutable PATIENTLINK and is bound to `authorityState=CUTOVER_PENDING` + epoch, so a partial-failure re-run skips linked patients and can never commit a second logicalId for the same patient; the link is keyed by `hmacPatientId` (pharmacy- and purpose-separated HKDF, sharing the patientNumber guard's rotation discipline) rather than the raw `patientId`, so correctness no longer rests on the unenforced premise that `patientId` is non-PHI — the column is free-form TEXT with nothing forbidding `patient_id = patient_number` (Revision 14); CURRENT carries `internalPatientId` (a mandatory retained attribute — CURRENT is never Put-replaced) so patientId-keyed projections and the reception compatibility design have a defined linkage path, and the final `CUTOVER_PENDING → FHIR_PRIMARY` advance is a single conditional epoch CAS gated on **set equality**, proven by a per-element membership check plus a cardinality check (both strongly read, neither requiring payload decryption) — a membership check alone misses a surplus link and a count match alone lets a missing-one/surplus-one pair cancel (Revisions 13–14). **Re-cutover after a rollback is separately blocked**: nothing can reconcile a PostgreSQL-side change made during the rollback window (VERSION 2+ backfill is prohibited, `SYSTEM_CUTOVER` is VERSION 1 only, and the PUT producer prerequisites are unmet), and a shrunken reconciliation set leaves an undeletable surplus PATIENTLINK — so `BLOCKED_RECUTOVER_DIVERGENCE_RESOLUTION` gates it until either a reflection path or a read-only-during-rollback operating constraint is approved. The first cutover is out of that blocker's scope. The authority state machine is **not** one-way: it carries a rollback value and only `authorityEpoch` is monotonic, and re-cutover from `POSTGRES_PRIMARY_ROLLED_BACK` must pass through `SHADOWING` again to regenerate the parity evidence its own gate requires — the previous direct transition to `CUTOVER_PENDING` was unreachable by design and is withdrawn. The PostgreSQL-side stop/drain gate is measured against **write grants**, not observed writers: the repository currently has zero Patient write paths, so "no writer observed today" satisfies nothing. MedicationRequest has no current runtime/store/writer/data: only after the amendment batch is approved, locked-profile validation passes, and security prerequisites pass does the FHIR store/API ingestion boundary become its sole initial writer from the first accepted create, with no legacy migration, backfill, dual writer, or automatic fallback. FHIR Provenance does not replace the internal append-only audit authority.
- **Drafted atomic amendment set (exact 11):** `docs/architecture/fhir_native_phos_aws_platform_direction.md`; `docs/api/platform_api_architecture.md`; `docs/domain/fhir_native_canonical_model.md`; `docs/domain/fhir_mapping_registry.md`; `docs/api/ph_os_reference_integration.md`; `docs/api/fhir_rest_facade_contract.md`; `docs/api/patient_search_contract.md`; `docs/domain/domain_model.md`; `docs/database/dynamodb_single_table_design.md`; `docs/product/jp_core_fhir_platform_strategy.md`; `docs/ssot_index.md`. All working versions are PROPOSED. ARC-008 v0.1.2 remains previous-version approval provenance; v0.1.3 retains the existing `amends` list until finalization. SEC-006/SEC-008 are unchanged.
- **Approval record:** current user wording `推奨承認` is accepted as explicit equivalent to `WP-4250を推奨方針で承認`; its effect is limited to PROPOSED drafting/review.
- **Approval effect:** authorizes only the listed PRC-007 **PROPOSED**
  amendment batch and review. The independent domain reviews are complete and
  FAIL; they do not self-approve their required corrections. This approval does
  not authorize implementation, schema/data migration, production access/write,
  deployment, conformance claims, landing, or final SSOT approval.
- **R4 stop conditions:** stop at PROPOSED correction while any finding in the
  independent-domain-review table, terminology/licensing, real validator and
  CapabilityStatement evidence, fixed package/profile provenance, atomic-set
  consistency, or final human approval is incomplete. Stop immediately on
  security/privacy semantic weakening, second writer, dual write, automatic
  fallback, invented history, unbounded work, or conformance claim. No source,
  contract artifact, schema, migration, runtime, production, commit, or push
  action belongs to this decision packet.
- **Dirty ownership / landing:** the same Codex root owns the existing WP-4254 IDX-001 delta; whole-file IDX ownership is resolved for cumulative review. Pre-edit `git diff -- docs/ssot_index.md` SHA-256 was `88c2ab2c375b8a8b7edbff9ec5cd2a21670cd58da4a1b5ef83fd0cdaf80b1f79`; all WP-4254/MOD-009 semantics/hunks must remain. WP-4250 owns only this active block, the active pointer snapshot, and the exact11 PROPOSED additions. No landing is authorized; cumulative exact-path landing remains separately gated after review/finalization.

### WP-4256 — 複合キー構築の機械強制と ingress delimiter 拒否の固定(2026-07-31〜08-01)

- **Status:** COMPLETED_LOCAL / MACHINE_VALIDATED / LANDING_APPROVED(2026-08-01
  の direct human approval「全て承認」で採番と landing を承認)
- **Risk:** P2 / R2。CI 検査規則の追加とテスト追加のみで、production 経路の
  挙動、contract、schema、migration、認可判定を変更しない。

2026-07-31 の user direction「実際のコードを編集して」に基づき、レビューが 2 ラウンド
連続で挙げた `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` の解除条件 (a) を実装した。
**これらの path は WP-4250 の markdown-only allow-list の外**であり、WP-4250 の
frozen packet(exact11 の 11 文書)には含まれない。したがって round-5 review を
無効化していない。

| Path | 変更 | 検証 |
|---|---|---|
| `scripts/check-boundaries.mjs` | 複合キー構築の機械検知を追加。AST 走査で `TENANT#`/`PHARMACY#` を含む literal を検出し、承認済み key codec(`apps/*/src/dynamodb/*key-codec.ts`)以外の production source にあれば exit 1。codec 限定は §10 の「DynamoDB マーシャリングはアダプタ層のみ」境界に一致させたもの。test source は codec 出力の期待値固定のため除外 | `node scripts/check-boundaries.mjs` PASS。ルール呼び出しを外す変異で negative test 3 件が落ちることを確認 |
| `scripts/check-scripts.mjs` | 上記の positive/negative fixture を追加し、テスト登録リストへ接続 | `node scripts/check-scripts.mjs` PASS |
| `apps/api/src/server.test.ts` | `malformedDevIdHeaderCases` へ **key-delimiter ケース 3 件**を追加。従来は blank と制御文字のみを網羅し、`branded-ids.ts` が prefix 曖昧性を理由に拒否を追加した `#` そのものが ingress で未固定だった。tenant には衝突実例 `tenant-001#PHARMACY#tenant-002` を用いる | api 849→855 PASS。`branded-ids.ts` の delimiter 拒否を外す変異で新規 6 件がちょうど落ちることを確認 |

**検知ルールの限界(実測)**: template literal と `+` 連結は検知するが、marker を
分割する形(`const P="TENANT"; ${P}#${t}`)と `["TENANT",t].join("#")` は通過する。
静的検知の原理的限界であり、DB-005 §7 は「迂回が入れば CI で落ちる保証であって
迂回経路が存在しないことの証明ではない」と記載済み。この限界記述を実測 4 変種
ベースの具体記述へ精緻化する作業は、packet hash を動かして review を無効化しない
よう **verifier lane の verdict 取得後**に回す。

`BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` の残余は **(b) 既存永続値の `#` 含有検証**
のみ。DDL/DML と production data 参照を伴うため人間承認が必要であり、本 session では
着手しない。blocker は維持する。

## 8. Implemented / Landing State — nonclaimable

### WP-4255 — Prevalidate audit-read response before recording success

- **Status:** COMPLETED_LOCAL / MACHINE_VALIDATED / INDEPENDENT_PASS / SECURITY_PASS / DATA_INTEGRITY_PASS / LANDING_NOT_REQUESTED
- **Risk:** P2 / R2. Reorders one authorized audit-read path to prevent a durable `audit.viewed` success when the eventual HTTP response cannot satisfy the existing API schema; no contract, event type, repository, migration, transaction, authorization, idempotency, retention, or production-state change.
- **Dependency:** separate prerequisite remediation for WP-4254, now independently accepted. WP-4254 owns no API change; WP-4255 owns only its exact API/test and active-board hunks.
- **Exact owned paths:** `Plans.md`, `State.md`, `apps/api/src/server.ts`, `apps/api/src/audit-log.test.ts`.
- **Implementation order:** list; dense snapshot; tenant/pharmacy scope check; full-chain verification and verified-chain identity/sequence checks; display ordering; selected-window projection; complete response-schema parse; only then snapshot the view clock and record plus validate exactly one `audit.viewed` success; return the exact prevalidated response object.
- **Invariant:** preserve existing `totalCount`, `checkedCount`, verified ordering, max-200 selection, and record-before-HTTP-200 behavior. For a broken chain, preserve raw append-window ordering and omission without backfill when a selected raw row cannot enter the display projection.
- **Durability boundary:** a `record` rejection before commit returns normalized 500 and leaves zero new view events. A successful `record` yields exactly one appended `audit.viewed` before HTTP 200. An ambiguous or post-commit failure, a returned-event invariant failure after the repository has committed, or HTTP delivery failure may leave one append despite a 500 or delivery failure. This slice makes no automatic retry, deduplication, client-delivery success, or rollback claim.
- **Acceptance:** a core-valid verified event with a 129-character displayed target ID returns 500 with `no-store`, does not echo the raw ID, does not call the clock, does not call `record`, and leaves persisted count unchanged; a successful route appends exactly one `audit.viewed`, while that newly appended view is absent from the exact response snapshot; an interleaving writer after list does not enter the response snapshot, whose `totalCount` and `checkedCount` remain N, while persisted chain N+2 stays valid and ends in exactly one `audit.viewed` targeting `view:N`; existing broken-chain reason/count/order/raw-window omission tests remain green.
- **Observed validation:** focused audit 73/73 PASS; API 808 PASS plus 14 expected PostgreSQL skips; workspace 1,782 PASS plus the same 14 expected skips; full workspace typecheck sequential PASS; build PASS with 11/11 static pages; OpenAPI, boundaries, SSOT index 173, and diff check PASS. Secrets remains fail-closed because of the existing external `.codegraph` symlink and is not claimed as PASS.
- **Independent review:** verifier, security, and data-integrity reviews PASS. No contract/repository/audit-core/migration/event/idempotency/transaction expansion was accepted.
- **Remaining gate:** exact-path landing is unrequested. Commit, push, deploy, and production mutation were not performed.

### WP-4254 — Remove the user-facing audit confirmation screen

- **Status:** COMPLETED_LOCAL / MACHINE_VALIDATED / INDEPENDENT_PASS / LANDING_NOT_REQUESTED
- **Risk:** C3 / R3 pre-implementation governance. Removes a user-facing U2 audit screen while preserving all audit production, authorization, append-only persistence, integrity verification, API contracts, and the existing max-200 response projection. Direct user instruction supplies the human product decision; independent security, privacy, medical-safety, and data-integrity review remains mandatory before implementation and does not constitute human risk acceptance.
- **Outcome:** pharmacists and general Web users no longer see or operate SCR-028; `/admin` remains a truthful placeholder for future tenant/pharmacy/user/permission management.
- **Owner:** Codex root as sole maintainer. All mapper, pre-plan, security, privacy, medical-safety, data-integrity, and independent verification roles are read-only.
- **Allowed editable paths:** `apps/web/app/admin/page.tsx`, `apps/web/app/admin/audit-log-view.tsx`, `apps/web/app/admin/audit-log-view.test.tsx`, `apps/web/app/globals.css`, `apps/web/app/shell-smoke.test.tsx`, `apps/web/app/dev-tenant.ts`, `docs/uiux/screen_inventory_draft.md`, `docs/uiux/workflow_map.md`, `docs/security/audit_log_design.md`, `docs/security/audit_worm_and_tenant_isolation_strategy.md`, `docs/plan/uiux_development_plan.md`, `DEVELOPMENT_POLICY.md`, current-fact corrections in `docs/ui-ux-refresh/02-compliance-applicability.md`, `04-screen-and-state-inventory.md`, and `11-remaining-risks.md`, the SEC-007/SEC-008/UIX-006/UIX-007 status rows, the pre-existing MOD-009 status reconciliation, and WP-4254 metadata in `docs/ssot_index.md`, and these active `Plans.md` / `State.md` snapshots.
- **Forbidden paths:** API server/repositories/tests, `packages/contracts`, `packages/audit`, `packages/shared-kernel` permissions, migrations, generic `AuditMetadata` components, frozen legacy ledgers, production/runtime state, and every unrelated dirty path.
- **SSOT:** revise UIX-006, UIX-007, SEC-007, and the stale implementation facts in SEC-008 through PRC-007 before source deletion; retain SCR-028 as a retired, non-reusable compatibility tombstone while removing it from the active 28-screen product inventory and admin home. Preserve the repository API contract and its max-200 response projection outside the pharmacist Web journey without claiming bounded internal work or a production operational path; record production tenant/auth incident-response, retention-period-complete export, and full-chain read amplification/self-growth as release blockers. PLAN-UIUX-001 must no longer schedule SCR-028.
- **Acceptance:** no Web import, render, style, or dedicated test for `AuditLogPanel` remains; `/admin` and its nav item remain as the SCR-029 placeholder; the WP-4254-owned diff does not include API/contracts/persistence/integrity paths; regression evidence retains deny-by-default for missing `audit-log:read`, cross-tenant/pharmacy denial without metadata leakage, response length at most 200, `no-store`, IDs-only projection with no patient/actor name or other PHI re-resolution, and the WP-4255 durability boundary: a pre-commit rejection leaves zero new view events, a successful valid record yields exactly one before HTTP 200, and ambiguous/post-commit, returned-event invariant, or delivery failure may leave one despite failure, with no automatic retry/dedupe/delivery-success/rollback claim; focused Web test/typecheck, SSOT index, boundaries, and diff checks pass; independent security/privacy/medical-safety/data-integrity/SSOT reviewers confirm the retained audit boundary; the current-fact corrections in `docs/ui-ux-refresh/02-compliance-applicability.md`, `04-screen-and-state-inventory.md`, and `11-remaining-risks.md` no longer count SCR-028 or its CRITICAL chain warning as a safety/compliance mitigation; SEC-007/SEC-008/UIX-006/UIX-007 and IDX-001 are atomically APPROVED before Web source deletion.
- **Abort:** do not delete source while SEC-007/SEC-008/UIX-006/UIX-007 or IDX-001 are PROPOSED, any required security/privacy/medical-safety/data-integrity/independent review is incomplete, or the global SSOT index gate is red. Any API, contracts, `packages/audit`, permission, repository, migration, or persisted-data change attributed to WP-4254 aborts that slice; the separately registered WP-4255 prerequisite remains outside WP-4254 ownership.
- **Rollback:** revert only the Web consumer and this atomic SSOT/planning batch. Never delete audit rows, roll back an applied migration, weaken authorization/integrity, or alter the audit API. If SSOT and Web source cannot finalize atomically, restore the prior APPROVED SSOT state and stop.
- **Human gate:** the direct user instruction from the pharmacist/product authority authorizes only removal of the user-facing screen. It does not accept residual production incident-investigation risk or authorize weakening audit retention, authorization, integrity, production controls, or compliance evidence provision; release stays blocked until the production operational path is separately approved and proven.
- **Observed validation:** focused shell smoke 15 and Web 423 PASS; WP-4255 focused audit 73/73 PASS; API 808 PASS plus 14 expected PostgreSQL skips; workspace 1,782 PASS plus the same 14 expected skips; full workspace typecheck sequential PASS; build PASS with 11/11 static pages; OpenAPI, boundaries, SSOT index 173, and diff check PASS. Secrets remains fail-closed because of the existing external `.codegraph` symlink and is not claimed as PASS.
- **Remaining gate:** the separately owned WP-4255 prerequisite has independent verifier, security, and data-integrity PASS. WP-4254 retains strict screen-removal/SSOT ownership separation from the API remediation and is completed-local but unlanded. Commit, push, deploy, and production mutation remain unrequested.
- **Commit/push:** not requested.

### WP-4253 — Refresh the stable software baseline

- **Status:** COMMITTED_LOCAL / MACHINE_VALIDATED / HOST_RUNTIME_ALIGNED / INDEPENDENT_PASS / PUSH_NOT_REQUESTED
- **Landing evidence:** local commit
  `9d8dbc0c3f5201c762dbb39fd9b15fc3ddc4b875`; `main` is one commit ahead of
  `origin/main`. No WP-4253 package/toolchain path remains dirty.
- **Risk:** R2. Major framework, compiler, test runner, package-manager, CI Action, and CI-only PostgreSQL changes; no production data or infrastructure mutation.
- **Policy alignment:** Milestone 1 green baseline and dependency hygiene. WP-4240 is absorbed rather than bypassed.
- **Outcome:** repository-managed software and every active Mac mini Node foundation run on the latest stable baseline, with prereleases excluded and Node pinned to the explicitly requested latest stable release.
- **Mapper evidence:** direct manifests, lockfile, `pnpm-workspace.yaml`, Next config, CI workflow, official release metadata, and current validation output were inspected before editing.
- **Pre-change baseline:** Node 24 / pnpm 11.13.1 / PostgreSQL 16 / Next 15 / TypeScript 5 / Vitest 3; the prior lock resolved vulnerable PostCSS 8.5.16.
- **Target baseline:** Node 26.5.0 across repository, CI, nvm, Homebrew, shells, Codex MCP launchers, user LaunchAgents, and active Node services; pnpm 11.18.0; PostgreSQL 18.4 in CI; latest stable GitHub Actions; latest stable direct npm dependencies. TypeScript 7 is the CLI compiler while the official TypeScript 6 compatibility package supplies the programmatic compiler API required by repository scripts and framework tooling.
- **Owner:** Codex root as sole maintainer. No concurrent editor.
- **Checkers:** read-only mapper, plan review, independent verifier, and dependency/security review are complete with no remaining P0–P3 finding. Built-in Codex subagents stayed inside the APPROVED single execution lane; no external agent, agmsg lane, or concurrent editor was used. Machine gates did not impersonate independent review.
- **Dependencies:** public npm, GitHub, Node.js, PostgreSQL, and container-registry release metadata. Preserve all unrelated dirty paths.
- **Owned editable paths:** `.nvmrc`, root/workspace `package.json` files, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `apps/web/next.config.ts`, migration-required source/tests only, the active snapshots at the top of `Plans.md` / `State.md`, and only the stale exact implementation-sequence entry in `DEVELOPMENT_POLICY.md`.
- **Host extension:** direct user instruction additionally covers the exact active Node selectors under `~/.zshenv`, `~/.codex/*.toml`, `~/.local/bin`, `~/Library/LaunchAgents`, the nvm default, Node 26 global CLI packages, and the current launchd user environment. Historical backups, disabled services, and older nvm installations remain inert rollback artifacts.
- **Forbidden paths/actions during implementation:** frozen legacy ledger bodies,
  APPROVED product/clinical SSOT, database migrations, production writes,
  deploy/publish/external send, secret changes, and any commit/push outside the
  root-owned landing gate.
- **Contract:** every direct external dependency is the newest stable compatible release; deliberate compatibility pins are explicit; every PostCSS resolution is `>=8.5.18`; no advisory ignore/allowlist; Node types remain aligned to Node 26.
- **Migration:** apply official Next.js 15→16 and Vitest 3→4 migration guidance; keep the existing Webpack resolver path until equivalent Turbopack behavior is proven; do not change runtime/API/UI semantics.
- **Acceptance:** clean `pnpm outdated -r`; frozen install and dedupe checks succeed; exact direct versions and CI pins match reviewed stable releases; dependency audit is high/critical zero; focused migration tests pass; full typecheck, test, build, script, OpenAPI, secret, boundaries, calculation-purity, SSOT-index, SBOM, and diff gates pass. PostgreSQL integration must run zero-skip on Node 26.5.0 against PostgreSQL 18.4 locally or on exact-head CI before landing.
- **Downstream validation:** `pnpm install --frozen-lockfile`; `pnpm outdated -r`; `pnpm dedupe --check`; `pnpm check:deps`; `pnpm check:sbom`; `pnpm test:scripts`; `pnpm -r typecheck`; `pnpm -r test`; `pnpm -r build`; `pnpm check:openapi`; `pnpm check:secrets`; `pnpm check:boundaries`; `pnpm check:calculation-purity`; `pnpm check:ssot-index`; `git diff --check`. No production/deploy claim.
- **Observed validation:** Node 26.5.0 and pnpm 11.18.0, including `.nvmrc`, nvm default, Homebrew, signed/notarized official macOS pkg under `/usr/local`, noninteractive/login/interactive shells, launchd PATH, direct Codex MCP launchers, remodex running+connected, Hermes launchd supervision (downstream messaging connection not independently proven), and every observed active Node executable; frozen install; clean recursive outdated result; dedupe; dependency audit high=0/critical=0 including production-only audit; SBOM 249; script harness; actionlint; OpenAPI; secret scan with the ignored external `.codegraph` symlink isolated and restored; boundaries; calculation purity; SSOT index 173; full typecheck; Next.js 16.2.12 Webpack production build with 11/11 static pages; PostgreSQL 18.4 full workspace test 1,843 PASS / 0 SKIP; diff check.
- **Remaining gate:** exact-path local commit is complete at `9d8dbc0`.
  Independent read-only verification passed; push, remote exact-head CI, deploy,
  and production mutation were not requested or performed.
- **Falsification:** prerelease adoption, unsupported runtime/type mismatch, stale direct dependency or CI pin, vulnerable resolution, unrelated lock drift, semantic behavior change, skipped required integration, or weakened gate fails the slice.
- **Rollback:** revert only WP-4253-owned dependency/toolchain/config changes; do not touch unrelated dirty files or production state.
- **Human gate:** none for local repository dependency and Mac mini runtime updates. Migration application, deploy/publish, production write, release acceptance, and any residual security/privacy exception remain separately gated.
- **Exact first command:** `pnpm outdated -r --format json`

### Human-gated next — nonclaimable

### WP-4050 — Atomic reception command boundary

- **Status:** COMMITTED_LOCAL / MACHINE_VALIDATED / INDEPENDENT_REVIEW_PENDING /
  PUSH_NOT_REQUESTED(2026-07-31)
- **Landing evidence:** local commits `42ef15c`(atomic boundary: migrations/000005
  outbox_events、PostgresReceptionCreateCommand 単一トランザクション、
  ComposedReceptionCreateCommand 補償型 in-memory、4 結果値
  created/existing_complete/legacy_orphan/idempotency_conflict)+
  `bf17cea`(branded ID の `#` 区切り文字拒否 — 複合キー prefix 曖昧性の
  branded-ID 側を閉鎖)。
- **Gate resolution:** R3 human gate は direct user instruction 2026-07-31
  (「ヒューマンゲートを全て許可」)で充足として claim。受入(注入 audit/outbox
  失敗で counts 0/0/0、成功・全再送形態で 1/1/1 収束、conflict 無書込み、
  legacy_orphan 明示)は in-memory 8 + PostgreSQL 実 DB 9 テストで実測 PASS。
  各 commit の exact tree を zero-skip green で検証してから commit。
  独立レビューは subagent 報告経路劣化により未取得
  (`independence_not_satisfied` ×2 記録)— codex lane 復帰(2026-08-05)後に実施。
- **Policy alignment:** Milestone 1 data-integrity exit and prerequisite for every later clinical write.
- **Outcome:** a successful reception can never exist without exactly one durable `reception.created` audit intent and required outbox intent; an ambiguous retry converges.
- **Evidence:** `POST /reception`, PostgreSQL reception repository, and audit repository currently commit in separate transactions; retry of the surviving reception does not repair the missing audit.
- **Scope:** API command/unit-of-work boundary, transaction-bound reception/audit/outbox persistence, in-memory semantic parity, focused unit/integration tests, and an explicit orphan-reconciliation result. A forward migration may be designed but not applied without separate approval.
- **Invariant:** trusted tenant/pharmacy/actor context, same-key/same-patient idempotency, mismatched-patient conflict, PHI-free target reference, append-only audit chain, no invented actor/time.
- **Dependency:** WP-4253 green baseline; R3 human scope approval; approved transaction/outbox/repair semantics.
- **Contract:** one command result distinguishes created, existing-complete, conflict, and legacy-orphan/reconciliation-required.
- **Migration:** add only the approved forward schema; do not backfill fictitious historical facts. Production application is separately human-gated.
- **Acceptance:** injected audit/outbox failure leaves reception count 0; success leaves reception/audit/outbox count 1 each; response loss, same-key retry, restart, and concurrent retry remain 1 each; different patient with same key returns 409 with no writes; orphan handling is explicit.
- **Downstream validation:** focused API/repository/audit tests, PostgreSQL integration, then full current gates.
- **Falsification:** any partial durable write, duplicate event, fabricated provenance, cross-tenant visibility, or rollback requiring production DML fails the design.
- **Rollback:** revert the command-boundary implementation and unapplied migration; do not run data rollback in this slice.
- **Human gate:** explicit R3 pre-implementation review by human product/safety authority; migration apply and production write need separate approval.
- **Exact first command:** `rg -n "POST /reception|receptionRepository\\.create|auditRepository\\.record|BEGIN|COMMIT|Outbox|idempotency" apps/api/src/server.ts apps/api/src/db apps/api/src/reception-repository.ts apps/api/src/audit-repository.ts docs/api/reception_queue_contract.md docs/domain/domain_model.md`

### READY — maximum two

No READY item is claimable while WP-4250 is
`WIP_REVIEW / PROPOSED / DOMAIN_REVIEW_FAIL / CHANGES_REQUIRED`.
Drafting/review authorization and the recommended work order are recorded; the
remaining gate is atomic exact11 correction, independent re-review, and final
human SSOT approval.

## Human gates

- WP-4050 R3 implementation scope and repair semantics.
- WP-4250 exact11 PROPOSED amendment finalization after all required
  architecture/API/FHIR/data-integrity/security/privacy/medical-safety/product
  reviews and corrections. ARC-008 retains its `amends` list until that
  finalization.
- Any migration application, production write, deploy, external send, pilot,
  standards-conformance claim, or release decision.

## NOT NOW

- WP-9002 metadata loops and WP-4158/4159/4160 evidence expansion.
- Full AWS/DynamoDB/FHIR server/PH-OS synchronization and 22-domain fan-out.
- JAHIS/QR, billing/claims/receipt, schedule/visit/report writers, broad
  task/notification platform, and noncritical hardening.
- Any task listed only in the frozen inventory archive
  (`Plans.legacy-archive-20260731.md`).

## Compact crosswalk

| Legacy work | Disposition |
|---|---|
| WP-4240 | absorbed by completed-local WP-4253; PostCSS remediation remains mandatory |
| WP-4255 | COMMITTED_LOCAL at `b9fc31a`(2026-07-31 landing、direct user instruction による)/ INDEPENDENT_PASS / SECURITY_PASS / DATA_INTEGRITY_PASS |
| WP-4254 | COMPLETED_LOCAL / INDEPENDENT_PASS / **UNLANDED — 自身の Abort 条項(IDX-001 が PROPOSED の間は Web source を削除しない)により WP-4250 帰結へ従属**。index frontmatter で v0.4.45(WP-4254)と v0.4.46(WP-4250)が不可分のため hunk 分離着地は不能(2026-07-31 検証) |
| WP-4253 | COMMITTED_LOCAL / PUSH_NOT_REQUESTED at `9d8dbc0`; WP-4240 superseded。host 拡張の取りこぼし(`~/.local/bin/pnpm` 11.17.0 残存)を 2026-07-31 に検出・修正(→11.18.0)— HOST_RUNTIME_ALIGNED は同日まで不完全だった |
| WP-4050 | COMMITTED_LOCAL at `42ef15c`+`bf17cea`(2026-07-31)。R3 gate は direct user instruction で充足 |
| WP-4236 / WP-4162 / WP-9008 | COMMITTED_LOCAL at `68e0d77` / `02a3409`+`566f386` / `2c84e66`(2026-07-31)。各 status 行参照 |
| WP-5101 | ドラフト 13〜17号+3-lane fresh-context checker 訂正を `3da2466` で着地。checker verdict は REQUEST_CHANGES→訂正適用済み。再チェックと human 内容判断(10 論点)は未取得 — 各ドラフト未決欄と session 記録参照 |
| WP-4250 | CURRENT / WIP_REVIEW / PROPOSED / DOMAIN_REVIEW_FAIL / CHANGES_REQUIRED |
| WP-0042 / WP-7001 / broad FHIR-AWS work | bounded by current WP-4250; remainder NOT_NOW |
| WP-9002 / WP-4158 / WP-4159 / WP-4160 | FROZEN / GIT_HISTORY_ONLY |
| all other incomplete entries below | NOT_NOW until a READY slot is deliberately opened |

## 4. Prioritized Backlog

These entries are evidence-backed but do not override the active milestone or
human gates. They are not claimable while WP-4250 review is WIP.

### P1

#### WP-4162 — Audit every reachable PHI read without leaking PHI

- **Status:** COMMITTED_LOCAL / MACHINE_VALIDATED / INDEPENDENT_REVIEW_PENDING
  (2026-07-31。local commits `02a3409` patient.viewed +
  `566f386` patient.searched / reception.queue.viewed。MOD-008 v0.2.4 改版で
  列挙アクセス 2 種を登録し、データ最小化 — クエリ文字列・PHI をペイロードへ
  入れない — を台帳へ明文化。sink 失敗は PHI 非返却 500、404/400 は非記録・
  非時計読取り、cardinality 1 リクエスト=1 イベント。deny(403)監査のみ
  SEC-007/SEC-008 設計へ明示 defer — WP-4250 レビューが示した攻撃面感応性のため。
  human gate は direct user instruction 2026-07-31 で充足として claim)
- **Confidence:** High.
- **Evidence:** `apps/api/src/server.ts` handlers for `GET /patients/search`,
  `GET /patients/:patientId`, and `GET /reception/queue` return PHI but do not
  call `auditRepository.record`; `docs/modules/audit_event_registry.md`
  registers `patient.viewed`, and APPROVED `docs/security/audit_log_design.md`
  requires sensitive-read audit.
- **Root cause:** read-event cardinality, zero-result/denied/failed semantics,
  audit-sink failure behavior, retry/reconciliation, and data minimization are
  not approved.
- **Desired behavior:** every approved sensitive read produces bounded,
  tenant/pharmacy/actor-scoped, identifier-only evidence with explicit failure
  semantics; query text, name, kana, birth date, and raw PHI never enter audit
  payloads or logs.
- **Scope:** patient search/get/reception queue read policies, contracts,
  server/repository integration, synthetic negative tests.
- **Out of scope:** production auth rollout, audit retention/export, UI viewer,
  production DB writes.
- **Acceptance:** approved event cardinality and failure matrix; success/denied/
  failed/empty/bulk tests; cross-scope denial; audit-sink failure; PHI-sentinel
  non-echo; focused API/PostgreSQL integration plus current full gates.
- **Stop:** no runtime/API/DB/migration change before human-approved
  security/privacy/data-integrity/medical-safety policy.

#### WP-4236 — Make audit corruption verification total before projection

- **Status:** COMMITTED_LOCAL / MACHINE_VALIDATED / INDEPENDENT_REVIEW_PENDING
  (2026-07-31。local commit `68e0d77`。verifyAuditHashChain を任意の永続入力
  — JSON null/scalar/array root、敵対的 accessor/Proxy/変異 graph — に対して
  全域化し、破断報告自身が対象へ触れない形へ。migrations/000006 が新規
  event_body を `NOT VALID` CHECK で object に制約(既存行は append-only の
  まま無裁定)。読取りルートは破損行で 500 でなく hash_format_invalid の
  CRITICAL 破断+omission を返す。human gate は direct user instruction
  2026-07-31 で充足として claim)
- **Confidence:** High.
- **Evidence:** `migrations/000004_create_audit_events.sql` accepts any non-null
  JSONB root; `apps/api/src/db/audit-repository.ts::rowToEvent` casts failed
  hydration output to `AuditEvent`; `packages/audit/src/index.ts::hashFormatFailure`
  dereferences `event.eventId`. A stored JSON `null`, scalar, or array can turn a
  fail-visible chain break into a 500.
- **Root cause:** persisted event graphs are not validated and detached as
  total `unknown` input before verification/projection.
- **Desired behavior:** malformed roots and hostile nested graphs yield a
  structured `hash_format_invalid` break without throw, echo, mutation, or
  backfill; new writes are constrained to object-shaped event bodies.
- **Scope:** audit verifier/hydration totality, forward schema constraint,
  corruption integration fixtures, existing graph-detachment acceptance.
- **Out of scope:** rewriting/deleting existing audit rows, physical WORM,
  retention/export, bounded verification architecture.
- **Acceptance:** null/scalar/array/accessor/Proxy/mutated nested graph cases are
  deterministic and non-echoing; existing corrupt rows remain append-only;
  forward migration rejects invalid new roots; focused audit/API/PostgreSQL
  integration and current full gates pass.
- **Stop:** R3 security/data-integrity/privacy review and migration approval are
  required before implementation or apply.

### P2

#### WP-9008 — Align the reachable API error contract with runtime behavior

- **Status:** COMMITTED_LOCAL / MACHINE_VALIDATED / INDEPENDENT_REVIEW_PENDING
  (2026-07-31。local commit `2c84e66`。実挙動を probe してから宣言を一致させる
  方式で wire 変更ゼロ: FrameworkErrorResponse を契約化し全ルートへ 500 宣言、
  POST /reception 400 を RCV-0001 ∪ parser 形の正直な union に、PHI ルートの
  no-store をヘッダ宣言、401 は実装が存在しないため**宣言しない**(拒否は一律
  403 AUTH-0003)と文書レベルで確定。producer conformance 13 テストで宣言と
  実応答の一致・raw/PHI 非 echo を固定。Web は宣言のみの変更のため不変)
- **Confidence:** High.
- **Objective:** make generated OpenAPI and consumer handling describe every
  reachable error/status/header surface rather than only selected 4xx results.
- **Evidence:** `packages/contracts/src/error.ts::errorResponseSchema` defines
  `{errorCode,message}`; `packages/contracts/src/openapi.ts` omits 500/default
  responses and a security scheme; `apps/api/src/server.ts` has no centralized
  error handler, while server/audit tests assert framework-shaped 500 bodies.
  `scripts/check-openapi.mjs` proves byte drift only, not runtime conformance.
- **User value:** clients can fail closed predictably instead of receiving an
  undeclared body/status that bypasses typed handling.
- **Scope:** reachable health/whoami/patient/reception/audit routes,
  contract/OpenAPI error schemas, headers, auth response model, producer
  conformance tests, Web generic error handling.
- **Out of scope:** FHIR routes, production identity provider implementation,
  new business behavior, weakening PHI-safe error normalization.
- **Dependencies:** approved API/security decision for 401 vs 403 and for
  framework/parser 400/415/500 normalization.
- **Acceptance:** every reachable route's declared status/body/header matrix
  matches producer tests, including malformed JSON/content type, auth denial,
  repository/invariant 500, and `Cache-Control: no-store`; no raw exception or
  PHI is exposed; generated artifact and semantic conformance gates pass.
- **Required verification:** focused contracts/API/Web tests, OpenAPI drift,
  typecheck, boundaries, secret scan, full workspace tests/build.
- **Rollback:** revert contract/error-handler/consumer changes as one slice;
  never relax authorization or error redaction.
- **Stop and escalate:** any incompatible public-client behavior, security
  semantic change, or need to expose raw errors requires API/security approval.

### UIUX — 一枚盤面刷新パイプライン(WP-5101〜5124・全件 GATED / NOT_READY)

> **来歴**: direct user instruction 2026-07-31(丁「一枚盤面」採用と詳細タスク化の指示)。
> 起草 lane は Claude(fable5)。Document Contract の sole editor 規律に対する例外は
> この direct user instruction を根拠とし、本グループ以外の記載に触れていない。
> **queue 規律**: 本グループは READY slot を消費しない。WP-4250 の CURRENT と
> WIP=1 / READY≤2 を変更せず、各 Gate 成立まで全件 claim 不可。
> **設計正本(non-SSOT ドラフト)**: `docs/ui-ux-refresh/13〜17号`(未コミット)。
> 昇格前は実装根拠にならない(fail-closed)。

#### Stage 0 — SSOT 整備(PLAN_ONLY・実装なし)

##### WP-5101 — 13〜17号ドラフトの独立レビューと確定

- **Status:** GATED / NOT_READY(fresh-context checker 未実施)
- **Gate:** fresh-context independent checker(fable5 セルフレビュー 17号は
  `independence_not_satisfied` — approval に数えない)+ human product 承認
- **Scope:** 13号(UIX-008 候補)/14号(丁決定+§7 ビュー・ロック)/15号(workflow-stage)/
  16号(主操作者調査)/17号(新要件 D-1..D-4・所見 AF/SF)の整合・網羅レビューと確定
- **Acceptance:** 全 findings が解消または記録済み。D-2 の2段分離、AF-2 の NSIPS 凍結整合、
  SF-1 の Phase A/B 分離が checker で再確認されている
- **Stop:** レビュー完了前に後続 WP の Gate を開かない

##### WP-5102 — DOM-004 改版起案(薬剤師最終確定の位置と2段分離)

- **Status:** GATED / SSOT_UPDATE_REQUIRED / NOT_READY
- **Gate:** WP-5101。改版承認は PRC-007 10段+medical_safety+薬剤師 human gate(R3 相当)
- **Scope:** APPROVED DOM-004 §1 の2段確認構造(PHARMACIST_CONFIRMED /
  dispensing:confirm 内包)と 17号 D-2(調剤・入力完了後の最終確定=調剤結果登録ジョブ投入を
  兼ねる)の整合。確定の対象粒度(17号 Q-2: 処方箋単位か RP 単位か)と訂正・再確定導線を含む
- **Acceptance:** 改版 DOM-004 が PRC-007 で APPROVED。確定=ローカル不可逆、
  登録=outbox 再試行の分離が遷移表・禁止遷移に反映されている
- **Stop:** 電子処方箋実装(RB-003)には踏み込まない。状態の shared-kernel 先行登録禁止

##### WP-5103 — workflow-stage enum SSOT 昇格

- **Status:** GATED / NOT_READY
- **Gate:** WP-5101 + WP-5102 APPROVED + exact11 landing(`docs/ssot_index.md`
  dirty ownership 解消)
- **Scope:** 15号を `docs/domain/` へ移設、DOM 系採番、frontmatter 正式化、index 登録。
  §9 未決(PATIENT_IDENTIFICATION 完了条件、CANCELLED 表示、一人薬剤師兼任)の解消を含む
- **Acceptance:** PRC-007 完了。`pnpm check:ssot-index` PASS。UIX-006 工程順との一致が
  レビュー記録に残る
- **Stop:** APPROVED 前の shared-kernel 実装禁止

##### WP-5104 — UIX-008(UI共通コンポーネントシステム)昇格

- **Status:** GATED / NOT_READY
- **Gate:** WP-5101 + exact11 landing
- **Scope:** 13号を `docs/uiux/ui_component_system.md` へ移設、UIX-008 採番確定、index 登録。
  L0〜L4 層構造、台帳20点+予約6点(WorkflowSheet/StageRow・ReceptionQueueRail・AlertRail・
  EvidenceDrawer・BoardViewSwitcher・FinalizeAndRegisterAction)、禁止8項、Phase A/B 分離
- **Acceptance:** PRC-007 完了。PLAN-UIUX-001 との参照整合
- **Stop:** 台帳外コンポーネントの追加は本 SSOT の改版なしに不可

##### WP-5105 — UIX-006 / UIX-007 / PLAN-UIUX-001 改版(3盤面写像)

- **Status:** GATED / SSOT_UPDATE_REQUIRED / NOT_READY
- **Gate:** WP-5101〜5104 + PLAN-UIUX-001 現 dirty ownership(WP-425x 系)解消
- **Scope:** active 28画面 →「調剤盤・請求盤・管理盤+常設レール+ドロワー」写像
  (14号 §2-2・プロトタイプ §再編)を APPROVED 台帳へ反映。ロール別ビュー(14号 §7.1)と
  UIX-006 §4 ロール別ホームの統合。SCR-028 RETIRED は不変
- **Acceptance:** 台帳にない構成の実装禁止規律の下で、丁の全実装 WP が台帳準拠になる
- **Stop:** U4 分類・human gate 要件を画面統合を理由に緩めない

##### WP-5106 — 電子薬歴連携の手段決定と連携契約 SSOT 起案

- **Status:** GATED / BLOCKED_HUMAN_GATE(経営判断)/ NOT_READY
- **Gate:** human 経営判断 — (a) NSIPS 正規許諾取得(RB-006 解除)or
  (b) 既定方針 Pharmacy Integration API(regulatory_blockers 既定)。judgement 前に
  NSIPS 仕様の参照・複製・模倣を行わない
- **Scope:** yrese→電子薬歴の調剤データ送信契約(17号 D-3)。ペイロード範囲と
  PHI 最小化(Q-3)、薬歴記載状態の逆方向連携要否(Q-1 — 薬学管理料の請求前点検
  BLOCKER 成立要件)を含む
- **Acceptance:** 手段決定 record + 連携契約 SSOT が PRC-007 で APPROVED。
  Q-1/Q-3 が解消または明示 defer
- **Stop:** 許諾なき NSIPS 準拠実装・仕様複製は行わない(RB-006)

#### Stage 1 — 実装基盤(前提: Stage 0 APPROVED + apps/web dirty slice(WP-4253/4254/4255)landing)

##### WP-5111 — L0 トークンテーマ基盤(Phase A・挙動不変)

- **Status:** GATED / NOT_READY
- **Gate:** WP-5104 + apps/web dirty landing
- **Scope:** `globals.css` トークン再編(甲乙丙テーマ差し替え可能な構造+暫定クローム)。
  DOM 構造・文言・contract 不変
- **Acceptance:** 既存 web テスト全緑(挙動不変の証跡 — 13号 Phase A)。typecheck/lint/build PASS。
  UIX-003 予算内(CSS サイズ・CLS 非悪化)
- **Stop:** L1 以上へ変更が波及したら Phase A を放棄し WP-5113 系へ再分類(全緑主張を捨てる)

##### WP-5112 — workflow-stage.ts 実装

- **Status:** GATED / NOT_READY
- **Gate:** WP-5103 APPROVED
- **Scope:** `packages/shared-kernel/src/workflow-stage.ts`(enum 9工程+STAGE_PROGRESSES 5値+
  `deriveStageProgress` 純関数)、Visual Status Registry 2軸(workflow-stage /
  stage-progress)、網羅テスト(15号 §7: 順序一致・fail-closed UNAVAILABLE・
  BLOCKED reason 必須・モード連動)
- **Acceptance:** 全 stage×progress 導出テスト PASS。契約未承認ドメイン入力 undefined →
  必ず UNAVAILABLE。既存 registry テスト流儀での label/tone/shape/ARIA 網羅
- **Stop:** DOM-004 状態の shared-kernel 登録は使用実装 WP 着地時のみ(先行登録禁止)

##### WP-5113 — 調剤盤シェル(3カラム+ロール別ビュー)【U4】

- **Status:** GATED / NOT_READY
- **Gate:** WP-5105 + WP-5112 + apps/web dirty landing
- **Scope:** 調剤盤 3カラム(ReceptionQueueRail / 患者フォーカスフレーム+WorkflowSheet 骨格 /
  AlertRail)、BoardViewSwitcher(投影のみ・権限非変更 — P-14)、
  兼任(一人薬剤師)統合ビュー、連続受付1操作復帰
- **Acceptance:** ロール別既定展開が 14号 §7.1 通り。畳んだ工程行でも状態 chip+サマリ常時可視
  (P-01 規律の型・テスト強制 = 14号 R-1 の解)。RTL テストで loading/empty/error/403 状態網羅
- **Stop:** U4 — 実装後に medical_safety / privacy / accessibility レビュー+human 承認必須。
  受付・患者検索の既存2実装フローを壊す変更は段階分離

##### WP-5114 — WorkflowSheet / WorkflowStageRow + EvidenceDrawer【U4】

- **Status:** GATED / NOT_READY
- **Gate:** WP-5113
- **Scope:** 工程アコーディオン(展開部=入力フォームのみを型で強制)、
  仮=点線/確定=実線の形状文法(P-05/06/07)、EvidenceDrawer(trace・履歴・監査メタ —
  P-13 一手)、外部登録待ちは PENDING_EXTERNAL_SYNC chip 併置(15号 SF-3 方針)
- **Acceptance:** 「安全情報を展開部に置けない」型テスト。fixture trace viewer(SCR-012)の
  ドロワー昇格。確定演出は版一致時のみ発火のテスト
- **Stop:** 工程行から契約外 API を呼ばない(API-002)

##### WP-5115 — 並行作業ロック(患者×工程 lease)

- **Status:** GATED / NOT_READY(設計課題 14号 §7.3 未解消)
- **Gate:** WP-5113 + §7.3 解消(lease/timeout・LOCAL_ONLY 時挙動の ARC 突合・
  差し戻し遷移の DOM-004 突合)
- **Scope:** 患者×工程(enum 工程粒度 — 17号 SF-4)の単一編集所有、
  「↻ 入力中 — 操作者(端末)」常時表示、stale 確定の 412/conflict(最終防衛は
  DOM-004 遷移ガード)、競合の人間返し(自動補正禁止)
- **Acceptance:** 同時編集・lease 失効・stale 署名失敗・競合の各テスト。無言グレーアウト非存在
- **Stop:** UI ロックを防衛と扱わない(API 側検証なしの排他は不可)

#### Stage 2 — 外部依存機能(各凍結解除後)

##### WP-5121 — アカウント種別制御の実装完遂(D-1)

- **Status:** GATED / BLOCKED_SECURITY_REVIEW / NOT_READY
- **Gate:** production 認証基盤の human/security 承認(release gate)。
  MOD-007 / permissions.ts を正本とし**新規機構を発明しない**(17号 AF-3)
- **Scope:** 認証 → runtime-role → scope 結線、requirePermission の全ルート適用確認、
  BoardViewSwitcher の capability 投影連動、権限変更履歴(SCR-029)
- **Acceptance:** deny-by-default の負系テスト(tenant/scope 越境 403+AUTH-0003)。
  UI 非表示と API 拒否の二層が全操作で一致
- **Stop:** dev header を production 権限根拠にしない

##### WP-5122 — FinalizeAndRegisterAction(D-2: 1操作・2段分離)【U4】

- **Status:** GATED / BLOCKED_REGULATORY_REVIEW / NOT_READY
- **Gate:** RB-003 解除(電子処方箋 技術解説書+記録条件 evidence+境界 SSOT APPROVED)+
  WP-5102 APPROVED + HPKI 署名位置づけ確定(legal_compliance_matrix #7)
- **Scope:** 薬剤師最終確定(ローカル不可逆・確認者/日時/対象版記録・二段階確認 P-11)→
  調剤結果登録ジョブ outbox 投入(PENDING_EXTERNAL_SYNC・再試行・DLQ→SCR-025)。
  段2失敗は段1を巻き戻さない/段2単独成功は存在しない順序保証
- **Acceptance:** LOCAL_ONLY 中のキュー蓄積、登録失敗の可視化、
  「確定●」「登録↻/●」chip 分離表示(単一成功表現の禁止 — 禁止3項/H-03)の各テスト
- **Stop:** 医療安全レビュー+薬剤師 human gate なしに確定機能を有効化しない

##### WP-5123 — 電子薬歴連携送信実装(D-3)

- **Status:** GATED / NOT_READY
- **Gate:** WP-5106 APPROVED(手段確定)+ outbox 基盤
- **Scope:** 確定済み調剤データの外部送信 Adapter(手段は WP-5106 の決定に従う)、
  送信状態の SCR-024/025 可視化、PHI 最小化(SEC-004)
- **Acceptance:** 送信ペイロードが契約 schema で検証される。失敗・再試行・DLQ の状態が
  隠れない。PHI がログへ出ない sentinel テスト
- **Stop:** 許諾外の NSIPS 実装禁止(RB-006)

##### WP-5124 — タブレット縮退+密度段階(R-2 / R-4)

- **Status:** GATED / NOT_READY
- **Gate:** WP-5113 + 薬剤師レビュー(密度既定・高齢者向け拡大の対象画面 — UIX-001 §6)
- **Scope:** 3カラム縮退(キュー・右レールのドロワー化、警告 chip のヘッダー残置)、
  密度段階(標準/圧縮)、キーボード完結(Tab/ショートカット — 16号 F-4)
- **Acceptance:** 縮退時も警告・患者文脈・モードが常時可視(P-01/03/09)。
  reduced-motion / forced-colors 対応
- **Stop:** 縮退を理由に安全情報を畳まない

## 5. Investigations

### INV-20260730-01 — Prove a bounded reception-queue read contract

- **Confidence:** Medium for production impact; High that current work is
  unbounded.
- **Evidence:** `packages/contracts/src/reception-queue.ts` accepts only a date;
  `apps/api/src/db/reception-repository.ts` performs an ordered query without
  `LIMIT`/cursor; the Web renders the full response. The contract relies on an
  unmeasured one-pharmacy/day cardinality assumption.
- **Question:** is an approved measured maximum sufficient, or must the route
  gain scope-bound stable pagination and an explicit response cap?
- **Exit:** synthetic volume measurement and an approved bound/pagination
  decision with a separate Task Packet. Do not issue an implementation task
  until the user-value/complexity tradeoff is established.

## 6. Resolved Work-Selection Decision

### DEC-20260730-01 — Finish WP-4250 review before implementation selection

- **Decision:** recommended ordering accepted. Finish the already-authorized
  WP-4250 correction/review/final-human-decision path without implementation;
  do not claim WP-4050 or any other implementation task concurrently.
- **Basis:** `AGENTS.md` requires the more specific same-layer rule to win.
  `DEVELOPMENT_POLICY.md` §11 specifically names WP-4250 as the current
  decision boundary and WP-4050 as separately human-gated. The user's
  `推奨承認` also confirms the recommended ordering.
- **Policy reconciliation:** the general Milestone 1→2 ordering still requires
  an atomic policy correction before the next implementation task is promoted.
  That edit is outside this Plans-only Goal.
- **Authority boundary:** this decision selects review order only. It does not
  grant WP-4250 final SSOT approval, WP-4050 R3 scope approval,
  implementation, migration application, landing, deploy, conformance, or
  production action.

## 7. Deferred / Known Release Blockers

- Bounded audit verification, read-driven self-growth, retention-complete
  export, and production incident-response path: known in SEC-007; do not
  duplicate as new tasks.
- Production AuthContext/OIDC, qualification, runtime role, RLS, break-glass,
  and credential transport: fail-closed release gates, not current runtime
  completion.
- Patient-search URL PHI, all-response `no-store`, pharmacy-level DB isolation,
  production qualification/purpose-of-use, and durable FHIR audit behavior:
  explicit WP-4250 correction blockers; no claim of current resolution.
- `State.md` still contains duplicated active detail and stale WP-4253
  no-commit wording. It is outside this Plans-only Goal and is non-authoritative;
  use the active board and live Git status above.
- Prescription, dispense, calculation consumer, billing, JAHIS/QR, schedule,
  visit, report, task/notification, PH-OS sync, and broad FHIR/AWS rollout:
  NOT NOW under the current policy.

## 9. Completed

- No uncommitted item is moved to `VERIFIED_COMPLETE` by this static audit.
- 2026-07-31(direct user instruction「ヒューマンゲートを全て許可」+ commit 承認
  による Claude lane 実装セッション): WP-4050(`42ef15c`+`bf17cea`)、
  WP-4255 landing(`b9fc31a`)、WP-4236(`68e0d77`)、WP-4162(`02a3409`+`566f386`、
  MOD-008 v0.2.4 同時改版)、WP-9008(`2c84e66`)、WP-5101 ドラフト着地(`3da2466`)を
  COMMITTED_LOCAL 化。全 commit で exact tree の zero-skip green
  (PostgreSQL 統合込み)を実測。push・deploy・production 変更なし。
  **独立レビューは全件未取得**(subagent 報告経路劣化+codex usage limit)—
  2026-08-05 の codex lane 復帰後の再レビューが残存 gate。
- WP-4253 is committed locally at `9d8dbc0`. WP-4254 remains an uncommitted
  ownership hold(WP-4250 帰結へ従属 — crosswalk 参照)。

## 10. Superseded / Archived

| Item | Disposition |
|---|---|
| WP-4240 | `SUPERSEDED_BY_WP-4253`; dependency remediation is in local commit `9d8dbc0` |
| WP-4238 | `SUPERSEDED_BY_WP-4254`; the dedicated audit Web consumer was removed locally |
| WP-9002, WP-4158, WP-4159, WP-4160 | `FROZEN / GIT_HISTORY_ONLY / NONCLAIMABLE` |
| All frozen legacy task definitions | classified as `FROZEN / NOT_NOW / NONCLAIMABLE`; active dispositions above win; body archived |

The legacy body was removed from this board on 2026-07-31 by direct user
instruction and archived in full to `Plans.legacy-archive-20260731.md`
(diff-verified byte-identical extraction). That archive is the preservation of
the pre-existing non-HEAD uncommitted provenance required by the previous
version of this note; it remains NONCLAIMABLE history.

## 11. Scan Ledger

| Scan area | Last commit | Status | Main finding | Next action |
|---|---|---|---|---|
| Product goal / vertical journeys | `9d8dbc0` | scanned | runtime stops after patient + paper reception; prescription onward disconnected | preserve North Star ordering |
| Frontend / state / accessibility | `9d8dbc0` | scanned | reachable patient/reception flows tested; remaining business screens are truthful placeholders | rescan only on Web diff |
| API / contracts / errors | `9d8dbc0` | rescanned; FAIL | exact11 producer ambiguity, replay/error gaps, and unbounded search materialization | correct WP-4250 atomically |
| Domain / repositories / DB | `9d8dbc0` | rescanned; FAIL | authority fence, Patient/reception cutover, Prescription ownership, uniqueness, rotation, and audit convergence gaps | correct WP-4250 atomically |
| Authn / authz / tenant / PHI | `9d8dbc0` | rescanned; FAIL | URL PHI, incomplete no-store, tenant-only IAM, qualification/purpose, parser limits, and audit durability gaps | correct WP-4250 atomically |
| Concurrency / idempotency / transaction | `9d8dbc0` | rescanned; FAIL | exact replay persistence and key-retirement proof remain incomplete | correct WP-4250 atomically |
| Cache / queue / async / external boundary | `9d8dbc0` | scanned | no runtime queue/worker/PH-OS/FHIR; URI/network constraints remain proposed | keep non-runtime claims explicit |
| Tests / CI / tooling / dependencies | `9d8dbc0` | scanned | broad tests/gates exist; tests not executed in this Goal | runtime verification remains unknown |
| Dead code / duplication / legacy | `9d8dbc0` | scanned | frozen legacy causes stale duplicate IDs and old execution orders | archive-only parser boundary |
| Performance / observability / audit | `9d8dbc0` | rescanned; FAIL | audit O(total history)+self-growth, reception queue, FHIR snapshot, and Patient projection decrypt work are unbounded | WP-4250 correction + investigation + SEC-007 pointer |
| Git history / churn / revert / rename | `9d8dbc0` | scanned | governance churn drove stale ledgers; one recent rename, no new executable finding | diff-first next run |
| Docs / APPROVED SSOT / implementation drift | `9d8dbc0` | rescanned; FAIL | exact11 remains PROPOSED; package/profile evidence and internal contract consistency are incomplete; work order is resolved | exact11 correction plus policy reconciliation |

- **Full baseline completed:** yes for available static evidence.
- **Incremental diff range:** `f4d0f8f..9d8dbc0` plus current working tree.
- **Consecutive no-new High/Medium actionable passes:** 2. Independent final
  verification found the unbounded API-001 Patient projection fetch/decrypt
  boundary now absorbed into WP-4250 and reset the counter. Two new distinct
  post-normalization full rescans then found no additional High/Medium item or
  reprioritization: (1) unbounded read/decrypt/materialization paths across
  exact11 and reachable runtime; (2) corrected WP-4250 coverage against all
  domain-review evidence and live producer/consumer paths.
- **Known blind spots:** no runtime/test/build/lint/typecheck/DB/external
  verification; no production auth/role/RLS; external standard artifacts were
  not refreshed because the Goal forbids external-service connection.
- **Next scan cursor:** diff-first from `9d8dbc0`; reset the counter if a new
  High/Medium item or reprioritization appears.
