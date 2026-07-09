# dynamodb_fhir_store_design_proposal — DynamoDB single-table + FHIR store design proposal

```yaml
proposal_id: WP-6001
title: DynamoDB single-table + FHIR store technical design proposal
domain: research
status: DRAFT(codex 設計提案・fable5 レビュー用・SSOT ではない)
owner: codex
reviewer: fable5
risk_class: R2
created_at: 2026-07-10
updated_at: 2026-07-10
source_refs:
  - docs/architecture/fhir_native_phos_aws_platform_direction.md(ARC-008 v0.1.1)
  - docs/database/db_schema_design_standards.md(DB-001 v0.1.1)
  - docs/security/audit_worm_and_tenant_isolation_strategy.md(SEC-008 v0.1.1)
  - docs/api/patient_search_contract.md(API-001 v0.2.3)
  - docs/api/reception_queue_contract.md(API-006 v0.2.2)
  - packages/audit(WP-5004a canonical hash-chain core)
  - AWS DynamoDB Developer Guide: IAM dynamodb:LeadingKeys condition key (https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/specifying-conditions.html)
  - AWS DynamoDB Developer Guide: TransactWriteItems condition patterns (https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-example.html)
  - AWS DynamoDB Developer Guide: TTL expiration behavior (https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html)
  - AWS DynamoDB Developer Guide: server-side encryption with KMS (https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/encryption.tutorial.html)
non_goals:
  - implementation code
  - migration code
  - APPROVED SSOT化
  - DynamoDB final product decision before access-pattern validation and BLOCKED_SECURITY_REVIEW release
```

## 0. Proposal Status

This document is a Codex design proposal for fable5 review. It is not an approved SSOT.
It must not be used as implementation authority until fable5 formalizes the accepted parts into the relevant SSOT set.

The proposal follows ARC-008 strictly:

- clinical/external resources are FHIR R4 / JP Core ready storage-of-record resources exposed through `/fhir/R4/*`;
- calculation, claim finalization, receipt export, and audit remain non-FHIR internal records of truth;
- PH-OS is the first user of generic projection APIs, not a privileged API consumer;
- AWS is the target platform direction, while DynamoDB is still a candidate pending access-pattern validation and security review;
- pure core packages stay persistence-agnostic.

## 1. Design Principles

1. **Tenant-first keys**: every table primary key and every GSI partition key starts with `TENANT#{tenantId}`. This keeps the tenant boundary visible to IAM `dynamodb:LeadingKeys` policies and prevents accidental cross-tenant access in normal roles.
2. **No tenant trust from payload**: `tenantId` / `pharmacyId` are derived from JWT/AuthContext. FHIR `meta.security`, FHIR extensions, path parameters, request bodies, and query strings never authorize tenant access.
3. **Single storage authority per aggregate**: FHIR resources are not duplicated as internal clinical aggregates. Patient is migrated to FHIR Patient as the authority. Reception remains one operational aggregate until fable5 chooses a FHIR Appointment/Task mapping.
4. **Search indexes are projections**: search index items, patient summaries, PH-OS cards, and queue cards are rebuildable projections. They do not become records of truth.
5. **Append-only records never use TTL**: audit events, accounting ledger entries, finalized claims, and finalized receipt/claim exports have no DynamoDB TTL attribute and no physical delete path.
6. **FHIR mutability does not weaken history**: the current FHIR item is mutable through optimistic locking, but every accepted change creates a version item. FHIR delete is a tombstone/state transition, not physical removal.
7. **No raw PHI in logs or avoidable keys**: table items are encrypted at rest, but key values and request diagnostics can still become operational metadata. Name/kana/patient-number search keys should use deterministic tenant-scoped HMAC tokens rather than raw PHI text.
8. **Adapters only**: AWS SDK, DynamoDB condition expressions, retry policy, and serialization-to-AttributeValue stay in `apps/api` persistence adapters or a future persistence package. `packages/calculation`, `packages/money`, `packages/date-time`, `packages/trace`, and `packages/audit` must not import DynamoDB.

## 2. Single-table Model

### 2.1 Table

Candidate logical table: `yrese-core`.

Primary key:

| key | type | rule |
|---|---|---|
| `PK` | string | starts with `TENANT#{tenantId}` for every item |
| `SK` | string | item-type-specific sort key |

Common attributes:

| attribute | purpose |
|---|---|
| `tenantId` | branded TenantId, copied from AuthContext |
| `pharmacyId` | branded PharmacyId when pharmacy-scoped; tenant-wide items use `PHARMACY#GLOBAL` in keys and an explicit `scope = tenant` attribute |
| `entityType` | `FHIR_RESOURCE_CURRENT`, `FHIR_RESOURCE_VERSION`, `FHIR_SEARCH_INDEX`, `PATIENT_SUMMARY`, `RECEPTION_ENTRY`, `AUDIT_EVENT`, `AUDIT_CHAIN_TIP`, etc. |
| `schemaVersion` | application-controlled schema version |
| `createdAt` / `updatedAt` | application-supplied instants; no DB `now()` equivalent |
| `phiClassification` / `encryptionStatus` | follows MOD-009 invariant; PHI/PII payloads require `encrypted` |

No DynamoDB item should rely on a body-carried tenant. The adapter constructs all keys from AuthContext and validated branded IDs.

### 2.2 IAM Boundary

Normal application roles should be scoped so all allowed table and index partition keys begin with:

```text
TENANT#{tenantId}
```

Recommended policy shape for review:

- use `dynamodb:LeadingKeys` on table and GSI access;
- for tenant-specific roles, allow only partition keys matching the tenant prefix;
- prove the exact condition operator in SEC-008 review: if final keys remain prefix-expanded (`TENANT#{tenantId}#...`), the policy needs reviewed prefix matching; if final SSOT chooses exact tenant PKs, use exact matching;
- keep break-glass and support roles separate, time-bound, and audited;
- also enforce tenant/pharmacy checks in application code and contract tests.

Final IAM condition syntax, wildcard/prefix use, role decomposition, and KMS key policy are `BLOCKED_SECURITY_REVIEW`.

## 3. Key Design

### 3.1 FHIR Resource Current and History

Current resource item:

```text
PK = TENANT#{tenantId}#FHIR#{resourceType}#{logicalId}
SK = CURRENT
```

Version item:

```text
PK = TENANT#{tenantId}#FHIR#{resourceType}#{logicalId}
SK = VERSION#{zeroPad(meta.versionId)}
```

Attributes:

| attribute | description |
|---|---|
| `resourceType` | FHIR type, allow-listed by CapabilityStatement |
| `logicalId` | FHIR logical id |
| `metaVersionId` | integer/string version, monotonically increasing per resource |
| `lastUpdated` | application-supplied instant |
| `resourceJson` | canonical FHIR JSON as stored authority |
| `profileRefs` | declared profiles, informational until conformance review |
| `pharmacyId` | required for pharmacy-scoped resources |
| `deleted` | tombstone marker for FHIR delete semantics |

Supported initial resource types from WP-6001 scope:

- Patient
- Coverage
- Organization
- Practitioner
- PractitionerRole
- Location
- Medication
- MedicationRequest
- MedicationDispense
- DocumentReference
- Provenance

Recommended addition for ARC-008 consistency: keep FHIR Provenance as a projection of internal audit facts when it reflects audit activity. It must not replace `AUDIT_EVENT`.

### 3.2 FHIR Search Index Items

Search index item:

```text
PK = TENANT#{tenantId}#FHIRIDX#{resourceType}#{searchParam}#{token}
SK = RESOURCE#{logicalId}#VERSION#{meta.versionId}
```

Search token rules:

- identifier, name, kana, patient-number, subject, patient, performer, medication-code, date, and `_lastUpdated` indexes are generated by the FHIR store adapter;
- PHI-bearing tokens use deterministic tenant-scoped HMAC tokens instead of raw values;
- non-PHI code tokens may use normalized code-system/code strings if approved by security review;
- each index item stores only the minimal projection required to fetch the current resource item.

The index item is a rebuildable projection. It can be deleted/replaced when the current FHIR resource changes. The version item remains as history.

### 3.3 Type and Updated-time GSI

Candidate GSI1: `gsi1_by_type_updated`

```text
GSI1PK = TENANT#{tenantId}#FHIRTYPE#{resourceType}
GSI1SK = UPDATED#{lastUpdated}#RESOURCE#{logicalId}
```

Use cases:

- FHIR `_lastUpdated` search;
- conformance test fixture enumeration in non-production synthetic environments;
- catch-up projections for PH-OS/public projection API;
- operational backfill jobs under tenant-scoped roles.

All GSI partition keys still start with `TENANT#{tenantId}`.

### 3.4 Patient Summary Projection

Patient search response is a PHI projection of FHIR Patient plus eligibility state:

```text
PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#PATIENT_SUMMARY#{patientId}
SK = CURRENT
```

Search projection items:

```text
PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#PATIENT_SEARCH#{field}#{hmacToken}
SK = PATIENT#{patientNumberSortKey}#{patientId}
```

Rationale:

- API-001 search needs `name`, `kana`, `patientNumber`, eligibility display, and deterministic pagination;
- FHIR Patient remains the source of patient identity;
- the summary is rebuilt from FHIR Patient/Coverage/eligibility snapshot and never edited directly;
- raw names/kana/patient numbers should not be placed in keys.

`patientNumberSortKey` must be a non-PHI sortable surrogate or a normalized non-sensitive sequence. If patient number is treated as PHI, use a non-reversible sortable internal key and keep display patientNumber inside the encrypted item payload.

### 3.5 Reception Entry

Reception is currently an operational queue aggregate. ARC-008 allows mapping to FHIR Appointment/Task later or internal holding. This proposal keeps Reception as an internal operational aggregate until DOM/API SSOT chooses the final mapping.

Queue item:

```text
PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#RECEPTION#DATE#{yyyyMmDd}
SK = ACCEPTED#{acceptedAtIso}#RECEPTION#{receptionId}
```

Attributes:

| attribute | description |
|---|---|
| `receptionId` | branded ReceptionId |
| `patientId` | branded PatientId |
| `acceptedAt` | application-supplied UTC instant |
| `businessDate` | Asia/Tokyo business date, from MOD-011/WP-4053 |
| `receptionStatus` | shared-kernel `RECEPTION_STATUSES` |
| `prescriptionIntakeType` | initially `paper` |
| `idempotencyKeyHash` | hash of opaque client key; no PHI |

Direct lookup GSI2:

```text
GSI2PK = TENANT#{tenantId}#RECEPTION#{receptionId}
GSI2SK = PHARMACY#{pharmacyId}#DATE#{yyyyMmDd}
```

Reception queue access uses the base table query and naturally returns `acceptedAt asc + receptionId asc`.

### 3.6 Reception Idempotency Guard

Guard item:

```text
PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#IDEMPOTENCY#RECEPTION
SK = KEY#{sha256(idempotencyKey)}
```

Attributes:

- `patientId`
- `receptionId`
- `acceptedAt`
- `requestHash`

Create flow:

1. Read guard by key.
2. If guard exists with same patientId, return existing reception entry.
3. If guard exists with different patientId, return 409 / `RCV-0003`.
4. If guard does not exist, `TransactWriteItems`:
   - `Put` guard with `attribute_not_exists(PK)` and `attribute_not_exists(SK)`;
   - `Put` queue item with `attribute_not_exists(PK)` and `attribute_not_exists(SK)`.

This preserves API-006 semantics without relying on eventual duplicate detection.

## 4. Access Patterns

### 4.1 FHIR REST

| operation | access pattern | key/index |
|---|---|---|
| `read` | `GET /fhir/R4/{resourceType}/{id}` | Get current item by `TENANT#...#FHIR#{type}#{id}` / `CURRENT` |
| `vread` | `GET /fhir/R4/{type}/{id}/_history/{vid}` | Get version item by same PK / `VERSION#{vid}` |
| `history-instance` | list resource versions | Query same PK with `begins_with(SK, VERSION#)` |
| `create` | create current + version + search indexes | TransactWrite with `attribute_not_exists(CURRENT)` |
| `update` | optimistic update | TransactWrite with current version condition + new version item + index changes |
| `delete` | tombstone current + version | TransactWrite with If-Match where required; no physical delete of version |
| `_lastUpdated` | type/date search | GSI1 query |
| `identifier` | token search | `FHIRIDX#{type}#identifier#{token}` |
| `name` / kana-like search | tokenized HMAC prefix search | `FHIRIDX#Patient#name#{hmacToken}` etc. |
| `subject` / `patient` | reference search | `FHIRIDX#{type}#subject#{hmacPatientRef}` |
| `medication` | code/reference search | token search after terminology mapping review |

Initial search support should be explicitly enumerated in the CapabilityStatement. Unsupported search parameters return FHIR OperationOutcome with fail-closed behavior, not partial silent filtering.

### 4.2 Patient Search API

| operation | access pattern |
|---|---|
| `GET /patients/search` | Query patient search projection by tenant/pharmacy/field/HMAC token, BatchGet patient summary projection, enforce cursor tenant/pharmacy/query binding |
| `findById` | Get `PATIENT_SUMMARY#{patientId}` projection, fallback to FHIR Patient only during rebuild jobs |

Patient search projection is not authoritative. A rebuild process can regenerate it from FHIR Patient/Coverage/eligibility snapshots.

### 4.3 Reception Queue API

| operation | access pattern |
|---|---|
| `GET /reception/queue?date=YYYY-MM-DD` | Query `TENANT#...#PHARMACY#...#RECEPTION#DATE#{date}` with SK ascending |
| `POST /reception` | Get patient summary projection in tenant/pharmacy, then idempotency guard + queue item transaction |
| idempotent resend | Read guard, then direct GSI2 or queue item lookup |
| conflict | Guard exists with different patientId -> `RCV-0003` |

The date remains explicit. The API must not infer server-side "today".

### 4.4 Generic Projection API / PH-OS

Candidate projection item:

```text
PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#PROJECTION#{projectionName}
SK = SUBJECT#{patientId}#DATE#{yyyyMmDd}#RESOURCE#{resourceType}#{logicalId}
```

Projection examples:

- prescription card projection;
- dispensing workflow card;
- residual/risk-review task intake;
- claim candidate summary;
- homecare visit-related medication context.

The projection API is partner-neutral. `PH-OS` must appear only as a partner app/client in authorization and contract tests, not in storage key names or special scopes.

## 5. Optimistic Locking

FHIR current items use `meta.versionId` as the write version.

Create:

```text
ConditionExpression:
  attribute_not_exists(PK) AND attribute_not_exists(SK)
```

Update with `If-Match`:

```text
ConditionExpression:
  metaVersionId = :expectedVersion
```

Transaction contents:

1. `ConditionCheck` current item version matches `If-Match`;
2. `Update` current item to new resource JSON, `metaVersionId + 1`, app-supplied `lastUpdated`;
3. `Put` immutable version item with `attribute_not_exists`;
4. Put/delete rebuildable search projection items.

If `If-Match` is missing for an update that requires it, return a FHIR OperationOutcome conflict/precondition response according to the future FHIR contract SSOT.

## 6. Append-only Audit, Accounting, and Claim Items

### 6.1 Audit Chain Scope

Recommended cloud chain scope:

```text
chainScope = TENANT#{tenantId}#PHARMACY#{pharmacyId}#AUDIT#CHAIN#CLOUD
```

Audit event item:

```text
PK = {chainScope}
SK = SEQ#{zeroPad(sequenceNumber)}#EVENT#{eventId}
```

Chain tip item:

```text
PK = {chainScope}
SK = TIP
```

The mutable `TIP` item is coordination metadata, not an audit event. Audit event items are append-only and never updated or deleted.

Append algorithm:

1. Read `TIP` or use `AUDIT_GENESIS_PREV_HASH`.
2. Call `createAuditEvent` with `prevHash = tip.entryHash`; `entryHash` is computed by the audit core.
3. `TransactWriteItems`:
   - `ConditionCheck` `TIP.entryHash = :prevHash` or `attribute_not_exists(TIP)` for genesis;
   - `Put` audit event with `attribute_not_exists(PK)` and `attribute_not_exists(SK)`;
   - `Update` `TIP` to `entryHash`, `sequenceNumber`, `eventId`.
4. On condition failure, retry from step 1 with bounded retry and correlation ID.

Future Edge Node handling:

- Edge can keep device-local subchains under `CHAIN#EDGE#DEVICE#{deviceId}` while offline.
- RECOVERY_SYNC appends an anchor event into the cloud chain referencing the edge subchain tip.
- The cloud canonical audit chain remains tenant+pharmacy scoped, avoiding permanent fragmentation by device.

### 6.2 Accounting and Finalized Claim

Accounting ledger and finalized claim items should follow the same pattern:

```text
PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#LEDGER#{ledgerType}
SK = SEQ#{zeroPad(sequenceNumber)}#EVENT#{eventId}
```

Finalized claim snapshots:

```text
PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#CLAIM#MONTH#{claimMonth}
SK = CLAIM#{claimId}#FINALIZED#{finalizedAt}
```

Rules:

- no DynamoDB TTL;
- no update/delete API;
- correction is a reversal/amendment event;
- receipt/claim export payloads can be stored in S3 with immutable object strategy later, but DynamoDB stores the authoritative metadata, hash, evidence refs, and object pointer.

## 7. Encryption and PHI Placement

Table-level encryption:

- DynamoDB server-side encryption with KMS is required for FHIR/resource stores.
- Customer-managed key hierarchy, per-tenant key strategy, table-per-environment key policy, and break-glass decrypt policy remain `BLOCKED_SECURITY_REVIEW`.

S3:

- large DocumentReference attachments, receipt PDFs, claim export artifacts, and immutable archives should use S3 object storage with KMS;
- object keys must start with `tenant/{tenantId}/...` or a reviewed equivalent;
- Object Lock/WORM mode is not finalized here.

Search:

- PHI-bearing search tokens use deterministic HMAC tokens;
- key-generation secrets/pepper management is security-reviewed and not hard-coded;
- raw names, kana, patient numbers, insurance numbers, public expense recipient numbers, prescription contents, and medication instructions must not appear in application logs, agmsg, or unredacted operational errors.

## 8. Persistence-agnostic Adapter Boundary

Candidate interfaces are shown as design shapes only.

```ts
interface FhirResourceStore {
  read(input: FhirReadInput): Promise<FhirResourceCurrent | undefined>;
  vread(input: FhirVersionReadInput): Promise<FhirResourceVersion | undefined>;
  search(input: FhirSearchInput): Promise<FhirSearchPage>;
  create(input: FhirCreateInput): Promise<FhirWriteResult>;
  update(input: FhirUpdateInput): Promise<FhirWriteResult>;
  tombstone(input: FhirDeleteInput): Promise<FhirWriteResult>;
}

interface ProjectionStore {
  getPatientSummary(input: PatientLookupInput): Promise<PatientSearchResult | undefined>;
  searchPatients(input: PatientSearchInput): Promise<PatientSearchPage>;
  listReceptionQueue(input: ReceptionListInput): Promise<readonly ReceptionQueueEntry[]>;
  createReception(input: ReceptionCreateInput): Promise<ReceptionCreateResult>;
}

interface AuditAppendStore {
  append(input: Omit<CreateAuditEventInput, "prevHash">): Promise<AuditEvent>;
  verify(input: AuditChainScope): Promise<AuditHashChainVerification>;
}
```

Boundary rules:

- the adapter may import AWS SDK, DynamoDB marshalling, retry helpers, and table names;
- contracts use `@yrese/contracts` schemas;
- ID/status/error values use `@yrese/shared-kernel`;
- audit hash calculation uses `@yrese/audit`;
- pure core packages never import adapter or AWS modules;
- `check:boundaries` must be extended before implementation if it cannot detect this boundary.

## 9. PostgreSQL to DynamoDB Migration

Do not remove WP-5002/WP-5003 PostgreSQL work immediately. The proposed migration is staged:

1. **Design formalization**: fable5 converts accepted parts of this proposal into DB/FHIR/AWS SSOTs.
2. **Synthetic proof**: implement DynamoDB adapters against local/ephemeral synthetic data only; no PHI.
3. **Shadow projection**: while PostgreSQL remains authoritative for existing patient/reception, replicate synthetic or dev data into DynamoDB as explicitly non-authoritative projections. No partner/API reads use it as truth.
4. **Aggregate cutover by type**:
   - Patient: transform to FHIR Patient authority; patient summary becomes a projection.
   - Reception: choose internal operational item or FHIR Appointment/Task mapping; one authority only.
   - Audit persistence: use DynamoDB append-only once chain-tip design passes opus/fable5/security review.
5. **Read cutover**: switch repository injection per aggregate after contract tests prove parity.
6. **Write cutover**: stop writes to the previous authority for that aggregate. Do not maintain dual authoritative writes.
7. **Retirement**: remove PostgreSQL tables/adapters only after rollback window, migration reconciliation, and fable5 approval.

Rollback rule:

- before write cutover, rollback means disabling DynamoDB reads/writes and keeping PostgreSQL authority;
- after write cutover, rollback requires an explicit reverse migration plan and human review, not automatic fallback to stale PostgreSQL data.

## 10. Open Questions for fable5

1. Should Reception remain an internal operational aggregate for MVP, or be represented as FHIR Appointment/Task from the first DynamoDB cutover?
2. Which FHIR search parameters are MVP-required for each resource type, and which are explicitly unsupported OperationOutcome cases?
3. Should tenant isolation use one pooled table with IAM `LeadingKeys`, per-tenant table/account isolation for high-risk tenants, or both as deployment tiers?
4. What is the approved tenant-scoped HMAC/search-token key management pattern?
5. Are FHIR version history items considered legal-retention artifacts requiring the same no-delete treatment as audit/claim records?
6. What exact CapabilityStatement interactions are MVP: read/vread/search/create/update/history/delete?
7. How should FHIR Provenance projection reference internal audit events without exposing audit chain internals or PHI?
8. Which metrics prove access-pattern viability: tenant hot partition threshold, queue query p95, FHIR search p95, projection rebuild lag, and cost per pharmacy?

## 11. Validation Gates Before Implementation

- ARC-008 cascaded SSOT updates are APPROVED or explicitly marked with ARC-008 priority.
- DynamoDB single-table SSOT is APPROVED.
- FHIR store/CapabilityStatement SSOT is APPROVED.
- SEC-006/SEC-008 security review resolves Cognito, IAM `LeadingKeys`, KMS, and break-glass roles.
- Contract tests cover FHIR read/search/write and existing `/patients/search` / `/reception` parity.
- Boundary checks reject AWS imports in pure packages.
- Synthetic fixtures only; no production PHI or real patient data in tests.
- A migration runbook proves no aggregate has two authoritative stores at the same time.
