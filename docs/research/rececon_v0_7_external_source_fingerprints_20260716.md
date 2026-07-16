# yrese / PH-OS v0.7 external source fingerprint registry

```yaml
proposal_id: WP-0054c-SOURCE-FINGERPRINTS-20260716
title: yrese / PH-OS v0.7 external source fingerprint registry
status: DRAFT
implementation_authority: none
created_at: 2026-07-16
retrieved_at: 2026-07-16T07:36:51Z
baseline_commit: 5c77ba9
owner: codex_root
authority_refs:
  - docs/regulatory/source_registry.md
  - docs/regulatory/evidence_verification_log.md
  - docs/product/rececon_feature_benchmark.md
```

## 1. Purpose and limits

This research artifact closes the URL-only gap for WP-0054c by recording a reproducible
HTTP snapshot of the external landing pages cited by v0.7. It does not issue an
`evidence_id`, approve a legal interpretation, authorize implementation, or redistribute
the underlying publications. REG-001 and REG-007 remain the normative source authorities.

Retrieval method:

```text
curl -L --compressed --max-time 40 --retry 1
     -A yrese-evidence-registry/0.1
sha256(decoded response body bytes)
```

All 38 rows were also opened through the web retrieval tool or their same-domain official
entrypoint was inspected. HTTP `200` proves only that the captured page was reachable at
the recorded time. It does not prove completeness, legal applicability, conformance, or
permission to redistribute linked PDF/package content.

## 2. Rights and authority classes

| Class | Allowed use in this repository | Prohibited inference |
|---|---|---|
| `A-LANDING` | Link, identify publisher/version, drive human retrieval | Landing page alone is not the linked normative PDF/specification |
| `A-STANDARD` | Architecture/conformance candidate after package/license review | Public HTML does not automatically authorize terminology redistribution |
| `B-RESTRICTED` | Record existence, access route and blocker | Do not copy, implement, or reverse engineer restricted content |
| `B-SERVICE-DOC` | Architecture/security candidate with live service recheck | Current service documentation is not a frozen product contract |
| `C-VENDOR` | Feature discovery and market benchmark only | Never legal, claim, clinical-safety, conformance, or calculation authority |

For all classes, raw content redistribution and embedded copying remain
`LICENSE_REVIEW_REQUIRED` unless the exact artifact license has been separately approved.

## 3. Official and public-sector entrypoints

Hashes are SHA-256 over decoded response bytes. `HTML landing` means linked normative
artifacts require their own retrieval and hash before evidence promotion.

| ID | Source / observed version | HTTP snapshot | SHA-256 | Class / applicability / watch |
|---|---|---|---|---|
| OFF-SEC-001 | MHLW medical information security guideline 7.0, June 2026; Q&A still being revised on capture date | `200 text/html 11801B` <https://www.mhlw.go.jp/stf/shingi/0000516275_00006.html> | `5d78477d650aaa16d64c7ddc0c48b712f7dbf2009e00a0bbed87e9902f6dfcfb` | `A-LANDING`; D21/WP-0054d; monthly until Q&A release, then quarterly; REG-002 owner |
| OFF-EP-001 | MHLW electronic prescription portal; continuously updated landing | `200 text/html 20671B` <https://www.mhlw.go.jp/stf/denshishohousen.html> | `0fdcecc1dae7204b05eeeb7bdba158c02da90d5e3d0479dbc239bb7ebd063f2e` | `A-LANDING`; D03/D13; monthly; official IF still ONS-gated |
| OFF-PMH-001 | Digital Agency Public Medical Hub; continuously updated landing | `200 text/html 19208B` <https://www.digital.go.jp/policies/health/public-medical-hub> | `9d73e1798fa5003d25b55dd7a183963dcbf27b50eec20421e253da47b3bad563` | `A-LANDING`; D13; monthly and municipality-release event; API artifact separately required |
| OFF-CLAIM-001 | SSK electronic receipt creation landing | `200 text/html 19151B` <https://www.ssk.or.jp/seikyushiharai/iryokikan/iryokikan_02.html> | `65510c67fb97c1c157a8d6a87772b3f03667f8c1d4e604b825ffba55df737196` | `A-LANDING`; D08/D10/D17; monthly in revision season; linked record-spec files need separate hashes |
| OFF-CLAIM-002 | SSK online claim landing | `200 text/html 44928B` <https://www.ssk.or.jp/seikyushiharai/iryokikan/index.html> | `abfef299635c43dc5fdc6aa24b117322cb29eaa9dcc16c3ad555055dc85b052b` | `A-LANDING`; D08; monthly; does not authorize direct cloud submission |
| OFF-JPCORE-001 | JP Core history: Current 1.2.0/FHIR 4.0.1; 1.3.0-dev development only | `200 text/html 3908B` <https://jpfhir.jp/fhir/core/history.html> | `f54c05bbdfe7a4e7a0136b41f5ee487b59f6b6f17727bb1f9e196486798eef9b` | `A-STANDARD`; D18; monthly; package lock remains required |
| OFF-JPCORE-002 | JP Core Implementation Guide 1.2.0 | `200 text/html 8663B` <https://jpfhir.jp/fhir/core/1.2.0/> | `caf7213a54993d27b33605ce074c2392621521b96e12c63523569290b725e937` | `A-STANDARD`; D01/D03/D04/D18; package/artifact/license review before conformance authority |
| OFF-EHR-001 | MHLW electronic health record information sharing service landing | `200 text/html 13916B` <https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryou/johoka/denkarukyouyuu.html> | `c909540e80d7479ff194b0943b010f0118d0153ff00a9038cd581d2da09d8484` | `A-LANDING`; D18 future interoperability direction only; monthly |
| OFF-PMDA-001 | PMDA drug recall information landing; continuously updated | `200 text/html 110118B` <https://www.pmda.go.jp/safety/info-services/drugs/calling-attention/recall-info/0002.html> | `4a96b6b94d7df8d47e36453f1559508fc6b8fc4f2c6058453fe5322a766fcb7f` | `A-LANDING`; D11/D17; event-driven/daily operational feed design required; landing not a machine contract |
| OFF-GS1-001 | GS1 Japan healthcare standards landing | `200 text/html 89113B` <https://www.gs1jp.org/standard/healthcare/> | `ae7b539fc9e9ad7871a479d3ca5a1904f5662ffae877d918cdaee2d2bf4189f3` | `A-LANDING`; D05/D11/D12; quarterly; exact GS1 specification/license separately required |

## 4. HL7 interoperability standards

| ID | Source / observed version | HTTP snapshot | SHA-256 | Class / applicability / watch |
|---|---|---|---|---|
| STD-FHIR-001 | HL7 FHIR R4 4.0.1 | `200 text/html 5458B` <https://hl7.org/fhir/R4/> | `e6e6c88cce751664da1f53d0e17972d4224800749ab3d7f80473bc998a9b1b88` | `A-STANDARD`; D18 baseline; quarterly; retain R4 while JP Core depends on it |
| STD-FHIR-002 | CapabilityStatement, FHIR R4 4.0.1 | `200 text/html 103746B` <https://hl7.org/fhir/R4/capabilitystatement.html> | `94004ea62a9421e8769630f59330026bfe81b71cffcb4fc17d02152fabdb987a` | `A-STANDARD`; D18 conformance design; package/license review |
| STD-FHIR-003 | Subscription, FHIR R4 4.0.1 | `200 text/html 22025B` <https://hl7.org/fhir/R4/subscription.html> | `bf93dc48986036343efb2d7cddb2ce7c9e89fbb43b06408194ec7495f0ef7d97` | `A-STANDARD`; D18; R4 delivery limitations must be tested, not inferred |
| STD-SMART-001 | SMART App Launch 2.2.0, STU 2.2, R4 package | `200 text/html 8784B` <https://hl7.org/fhir/smart-app-launch/> | `74f0778857be28b11dc7ae139bc1b429668b1519b1374913fbd8ed04b15475a2` | `A-STANDARD`; D18/Gate 5; quarterly; OAuth/OIDC/security review required |
| STD-BULK-001 | FHIR Bulk Data Access 3.0.0, STU 3, R4 | `200 text/html 466B` <https://hl7.org/fhir/uv/bulkdata/> | `b00afce0ea8fdc5f5aac5293b7ae336be4d4b1f2fc915dade5c87479e25fe2c2` | `A-STANDARD`; D18/Gate 5; language redirect landing captured, package artifact still required |
| STD-CDS-001 | CDS Hooks 2.0.1 | `200 text/html 198176B` <https://cds-hooks.hl7.org/> | `4ef0899ab55e6da6613952fe27411d37c5206b8ef2e18ffef26017f788e5defa` | `A-STANDARD`; D06/D18/Gate 5; advisory-only/human-decision invariant remains |

## 5. JAHIS, NSIPS and constrained specifications

| ID | Source / observed version | HTTP snapshot | SHA-256 | Class / applicability / watch |
|---|---|---|---|---|
| OFF-JAHIS-001 | JAHIS 2D outpatient prescription symbol 1.11, May 2026 | `200 text/html 6253B` <https://www.jahis.jp/standard/detail/id=1233> | `5d5c1779a0f2b7ae245116a5769ca5cb9241c7ddc63ec05b173c8c7bd582af0d` | `A-LANDING`; D03; quarterly; linked full publication/license must be separately hashed and reviewed |
| OFF-JAHIS-002 | JAHIS pharmacy rececon/e-medication-record e-prescription linkage 1.1, October 2024 | `200 text/html 6340B` <https://www.jahis.jp/standard/detail/id=1129> | `85d9dce1fe620db2e6209cafdd0ed13b23cbfd928bdce1e2ffe30ddaec807ef0` | `A-LANDING`; D03/D18 adapter input only; no Clinical Core leakage |
| OFF-NSIPS-001 | Japan Pharmaceutical Association NSIPS overview and facility-local purpose | `200 text/html 12847B` <https://www.nichiyaku.or.jp/yakuzaishi/activities/nsips> | `307d3b8e0d47cd1c50841918af80267f9b3c9008c5ec8750b36dfbc2a86f2ce2` | `B-RESTRICTED`; D03/D12; implementation and copying remain blocked |
| OFF-NSIPS-002 | NSIPS use application page; final URL normalized to `/yakuzaishi/activities/nsips/use` | `200 text/html 12625B` <https://www.nichiyaku.or.jp/yakuzaishi/activities/nsips/use> | `74a19351681974ea2d742b17478297ee3f551789f68f2cbbf1c3f4e56988744d` | `B-RESTRICTED`; annual/pre-procurement watch; human membership/license decision required |

## 6. Amazon Bedrock service documentation

These are dynamic service documents. Their hashes are operational snapshots, not a model
lock. Model availability, region, lifecycle, retention mode, provider terms, pricing and
guardrail behavior must be rechecked at design approval and every release.

| ID | Source | HTTP snapshot | SHA-256 | Class / applicability / watch |
|---|---|---|---|---|
| AWS-BEDROCK-001 | Model lifecycle | `200 text/html 5685B` <https://docs.aws.amazon.com/bedrock/latest/userguide/model-lifecycle.html> | `f81c82aecf7259a97583170461ec56d3a4e722d44e547ef7ad0ca1b01f55254e` | `B-SERVICE-DOC`; D22; monthly and before model change; do not pin “Sonnet family” by prose alone |
| AWS-BEDROCK-002 | Data retention | `200 text/html 7080B` <https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html> | `923eafaffe6a40e8adbebeacc4c58c6ebc453fe78eada24711a4651d3ca6ccf4` | `B-SERVICE-DOC`; D22/D21; account/project/model effective mode must be verified; PHI use remains blocked pending privacy/security approval |
| AWS-BEDROCK-003 | Inference profile region/model support | `200 text/html 5477B` <https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html> | `9ae98859646ebf9ffbaad790b5b58c78132c98cb28b4d32d48dbc32847ca76db` | `B-SERVICE-DOC`; D22; monthly and deployment-time regional verification |
| AWS-BEDROCK-004 | Guardrails behavior | `200 text/html 4037B` <https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-how.html> | `30be91e0df21bd85643ffc37a444fc444760c7c9a11405de1e061c2469656cb1` | `B-SERVICE-DOC`; D22; guardrails supplement but never replace deterministic rules or human review |

## 7. Vendor public benchmark snapshots

All rows are `C-VENDOR`. Edition, package, optional feature, partner product, deployment
model, contract condition and current availability are not fully established unless the
page explicitly says so. These pages may change without versioned release notes.

| ID | Public page | HTTP snapshot | SHA-256 | Observed use / watch |
|---|---|---|---|---|
| VND-MEDIXS-001 | MEDIXS function list | `200 text/html 14413B` <https://medixs.jp/product/function/> | `dbbdf5cedb13b06b83ea87738290cc2d2c03eb4074e594645399dd41d91ba0a2` | D02/D05/D11/D15/D16; options are mixed; quarterly |
| VND-MEDIXS-002 | MEDIXS rececon | `200 text/html 14887B` <https://medixs.jp/product/receipt/> | `14e07bbff1a6f737bf17ef0861bfd1e5fb818c42719827f0139d4f4ee3c97721` | local/offline and workflow value signal only; quarterly |
| VND-EMSYS-001 | MAPs for PHARMACY | `200 text/html 24562B` <https://service.emsystems.co.jp/maps_series/for_pharmacy/> | `9531ecacdf3cefee270764bde774e94c1f8b80c5a97d3ae851b8be1cd6627fbf` | D05/D11/D14/D16/D19; product family/options unresolved; quarterly |
| VND-EMSYS-002 | EM Systems pharmacy portfolio | `200 text/html 17595B` <https://emsystems.co.jp/product/pharmacy.html> | `598f5a28750b895b0dea985e94742befdc6be305aee807dec8adbb573a641893` | portfolio discovery only; quarterly |
| VND-PHARNES-001 | PharnesX-EX | `200 text/html 23185B` <https://www.phchd.com/jp/medicom/pharmacies/pharnesx> | `ca1dbbe592aa232cf76357b31ebc0093845f28f14024d8d77c05aa1dbc78c8a9` | D06/D08/D21 operational-value signal; quarterly |
| VND-PHARNES-002 | PharnesX-MX | `200 text/html 23935B` <https://www.phchd.com/jp/medicom/pharmacies/pharnesx-mx> | `43ad4dff5a7242695bef090724169f1e30dd4f3a79f804cb0690b5d977037636` | safety/medication-record value signal; quarterly |
| VND-PCUBE-001 | P-CUBE n function index | `200 text/html 6621B` <https://www.unike.co.jp/product/pharmacy/p-cuben/function/> | `67eff124e115f0570d5aea237e87e8ce46eff9bcdf60bed897d6aa4b1d4748db` | D02-D19 broad discovery only; quarterly |
| VND-PCUBE-002 | P-CUBE n prescription input | `200 text/html 3816B` <https://www.unike.co.jp/product/pharmacy/p-cuben/function/prescription-input.html> | `962373d45032b989a876801c1987bae6e6918d2a8b2d13eed27dea6123743d00` | D04/D06/UX input-flow signal; quarterly |
| VND-PCUBE-003 | P-CUBE n inventory | `200 text/html 3822B` <https://www.unike.co.jp/product/pharmacy/p-cuben/function/stock-control.html> | `d82d95048c9ea26f8d2e07875e099b2f254c52a40749c7ecac4f0f35cc90e636` | D11 market-value signal; quarterly |
| VND-PCUBE-004 | P-CUBE n home care | `200 text/html 3997B` <https://www.unike.co.jp/product/pharmacy/p-cuben/function/home.html> | `607873b7b9ea18a5fab665cd9591691300367c6f4fa0b855273f54e71e8d9468` | D14 market-value signal; quarterly |
| VND-PHARMY-001 | Pharmy function list | `200 text/html 51400B` <https://www.moinetsystem.com/system/pharmy-feature/> | `cc9963a5cd4d62edc61c60c778b51f0c72a026e6eba567607185597cf1381920` | D03/D09/D11/D13; edition/options unresolved; quarterly |
| VND-PHARMY-002 | Pharmy-linked POS | `200 text/html 48491B` <https://www.moinetsystem.com/system/onregi/> | `498008808ba58fb13f22f0b8cb8e83585e3f2ebd40fb5bd32290d063bd713bc4` | D09/D16; page identifies partner product and change-without-notice risk; quarterly |
| VND-GENNAI-001 | GENNAI just | `200 text/html 48737B` <https://dx.emedical.ne.jp/products/rececom/> | `b21fab384744042e64971ffdd4e257f10f2a8978143583f22542f6041c5998e1` | D04/D06/D11/UX value signal; quarterly |
| VND-CHOZAIKUN-001 | Chozai-kun V8 | `200 text/html 49246B` <https://chouzai-sys.nextit.co.jp/> | `e474f80b53134f77324a7b251ea9b2e5528954c22843cdc1d75f4b9a75cebbb6` | D14/D16/D22/Guided+Expert UX; option boundaries explicit in parts; quarterly |

## 8. Coverage and promotion audit

| Category | Rows | Has HTTP 200 | Has SHA-256 | Promoted to evidence_id |
|---|---:|---:|---:|---:|
| public-sector / official entrypoints | 10 | 10 | 10 | 0 |
| HL7 interoperability standards | 6 | 6 | 6 | 0 |
| JAHIS / NSIPS | 4 | 4 | 4 | 0 |
| AWS Bedrock service docs | 4 | 4 | 4 | 0 |
| vendor public benchmark | 14 | 14 | 14 | 0 |
| total | 38 | 38 | 38 | 0 |

No row is promoted because the following evidence-strength requirements remain:

1. linked PDF, package, terminology artifact, API specification, or downloadable standard
   needs its own byte hash rather than inheriting the landing-page hash;
2. legal/claim/clinical/security applicability and effective date need human authority;
3. license and redistribution rights need exact-artifact review;
4. ONS and NSIPS restricted materials require approved human access/contract steps;
5. dynamic AWS and vendor pages require watch/revalidation rather than permanent pinning.

## 9. Contradictions and exact next actions

- **Security guideline:** 7.0 is confirmed, but its Q&A was still under revision on the
  capture date. WP-0054d must not claim Q&A-complete mapping.
- **JP Core:** 1.2.0/FHIR 4.0.1 is the Current published baseline; 1.3.0-dev remains watch-only.
- **FHIR ecosystem:** SMART 2.2.0, Bulk Data 3.0.0 and CDS Hooks 2.0.1 are current page
  versions, but their adoption is not implied by FHIR R4 support.
- **JAHIS:** public landing pages confirm versions, not blanket redistribution rights.
- **NSIPS:** the public pages confirm purpose and access path; implementation remains frozen.
- **Bedrock:** model lifecycle/region/retention are live operational facts. A generic
  “Claude Sonnet family” requirement is insufficient for production model selection.
- **Vendors:** optional/partner/edition boundaries prevent claim-count comparison and
  feature parity assertions. Use only to discover workflows and acceptance questions.

Exact next action: WP-0054d creates the legal/regulatory/clinical compliance matrix using
only Priority A sources with explicit effective date, jurisdiction, applicability, control,
test evidence and human sign-off. In parallel, a later evidence WP must retrieve and hash
the exact linked PDFs/packages before REG-001/REG-007 evidence promotion.
