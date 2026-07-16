# MHLW Security Guideline 7.0 exact-artifact manifest

- document_kind: non-normative retrieval manifest
- status: DRAFT / HUMAN_REVIEW_REQUIRED
- work_package: WP-0054p / G0-02a
- retrieved_at_utc: 2026-07-16T08:49:23Z
- official_landing_page: https://www.mhlw.go.jp/stf/shingi/0000516275_00006.html
- implementation_authority: none
- evidence_promotion: 0
- redistribution_authority: none
- production_or_external_write: none

## 1. Purpose and limits

This manifest fingerprints the exact public artifacts linked by the Ministry of Health,
Labour and Welfare landing page for the June 2026 Security Guideline 7.0 and the FY2026
medical institution/pharmacy cybersecurity checklist. It supports G0-02 artifact identity,
CPL-015 security-control mapping and G0-07 resilience planning.

It does not determine legal applicability, prove compliance, grant redistribution rights,
approve an SSOT amendment or authorize runtime/production work. The downloaded binaries
were held only in an automatically deleted temporary directory. No PDF/XLSX binary is
committed to this repository.

## 2. Landing-page observations

The official page states that Guideline 7.0 was revised in June 2026, identifies pharmacies
as part of the intended medical-institution scope, and publishes five audience-specific
volumes. It also publishes a unified FY2026 medical institution/pharmacy checklist,
manual, organization-side workbook and provider-side workbook. The page says the 7.0 Q&A
is under revision and was expected in July 2026; Q&A content is therefore not included in
this manifest and must not be treated as available evidence.

## 3. Exact artifact registry

Common controls for every row:

- source authority: MHLW official landing page
- rights: `LICENSE_HUMAN_REVIEW_REQUIRED`
- applicability: `CANDIDATE_NOT_PROMOTED`
- watch owner: security/privacy governance
- expiry/recheck: on landing-page change, hash drift, superseding version, or before any
  REG-001/REG-007/SEC SSOT promotion

| ID | Landing-page label / observed identity | Resolved URL | HTTP / MIME / bytes | SHA-256 | Local format check | Date/version observation | Control mapping |
|---|---|---|---|---|---|---|---|
| MHLW-GL7-01 | Security Guideline 7.0, Overview volume | `https://www.mhlw.go.jp/content/10808000/001716290.pdf` | 200 / `application/pdf` / 1160725 | `367c1b5637f89ebf5034a7ec98aea5a83081f8216648dbe496867974b018dec6` | PDF 1.7; 11 pages; first page identifies 7.0 / Overview | landing: June 2026 | G0-02, G0-07, CPL-015 |
| MHLW-GL7-02 | Security Guideline 7.0, Management volume | `https://www.mhlw.go.jp/content/10808000/001716291.pdf` | 200 / `application/pdf` / 1841740 | `fec841b6b87aff8a8655d529c398eadec6c3d2b32ad3e8997cbe0e4979ef9cf9` | PDF 1.7; 21 pages; first page identifies 7.0 / Management | landing: June 2026 | G0-02, G0-07, CPL-015 |
| MHLW-GL7-03 | Security Guideline 7.0, Planning-management volume | `https://www.mhlw.go.jp/content/10808000/001716292.pdf` | 200 / `application/pdf` / 2149115 | `f87040d2793bdb98c83b494288b1b2b79dedddd61b2fbac514e853fa45202cf7` | PDF 1.7; 59 pages; first page identifies 7.0 / Planning Management | landing label: May 2026 | G0-02, G0-07, CPL-015 |
| MHLW-GL7-04 | Security Guideline 7.0, System-operations volume | `https://www.mhlw.go.jp/content/10808000/001716295.pdf` | 200 / `application/pdf` / 2263676 | `e914cd87386ae869b92220f13043931453866ba119c4eb61069f95060de09564` | PDF 1.7; 51 pages; first page identifies 7.0 / System Operations | landing: June 2026 | G0-02, G0-07, CPL-015 |
| MHLW-GL7-05 | Security Guideline 7.0, Maintenance-contractor volume | `https://www.mhlw.go.jp/content/10808000/001716297.pdf` | 200 / `application/pdf` / 1486844 | `4f66b479f265a87a8b4245521c21d8095b1d2e626cab261ba2ed6e25858bb11d` | PDF 1.7; 27 pages; first page identifies 7.0 / Maintenance Contractor | per June 2026 Guideline 7.0 section; row label has no separate date | G0-02, G0-07, CPL-015 |
| MHLW-GL7-06 | FY2026 medical institution/pharmacy cybersecurity checklist | `https://www.mhlw.go.jp/content/10808000/001716185.pdf` | 200 / `application/pdf` / 614686 | `a1250114cd1dfb33049f27d86f6c883b61881207e5a47ce8adf11d2dd2ebea8a` | PDF 1.7; 2 pages; first page identifies FY2026 organization-side checklist | landing: June 2026 | G0-02, G0-07, CPL-015 |
| MHLW-GL7-07 | FY2026 checklist manual for medical institutions, pharmacies and providers | `https://www.mhlw.go.jp/content/10808000/001716186.pdf` | 200 / `application/pdf` / 2191433 | `a5cbb45d7582c9309a81bf537cf97abddc5336dfd45a6274a394059cfdc6df78` | PDF 1.7; 18 pages; first page identifies the checklist manual; extracted title visually omits one character in `年度`, so landing label controls | landing: June 2026 | G0-02, G0-07, CPL-015 |
| MHLW-GL7-08 | Organization-confirmation FY2026 checklist workbook | `https://www.mhlw.go.jp/content/10808000/001716187.xlsx` | 200 / `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` / 25655 | `b811208b1d29fe0f3310adf810aa3b072e6272eb3669de768b79949b6872c987` | ZIP integrity PASS; workbook has one checklist sheet; shared strings identify FY2026 organization/pharmacy confirmation use | landing: June 2026 | G0-02, G0-07, CPL-015 |
| MHLW-GL7-09 | Provider-confirmation FY2026 checklist workbook | `https://www.mhlw.go.jp/content/10808000/001716188.xlsx` | 200 / `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` / 25018 | `e1a2a763c97c5434d53b745c5fc1643a22a9497ea48354182ab6a93df1e881a0` | ZIP integrity PASS; workbook has one checklist sheet; shared strings identify FY2026 provider confirmation and responsibility boundary | landing: June 2026 | G0-02, G0-07, CPL-015 |
| MHLW-GL7-10 | Notice concerning establishment of Security Guideline 7.0, `産情発0629第1号` | `https://www.mhlw.go.jp/content/10808000/001716656.pdf` | 200 / `application/pdf` / 93016 | `f944c67de54578deec47960a6690a8d2d4d722c4e55bbb3b2a053b53b7a6c931` | PDF 1.6; 2 pages; first page identifies notice number and addressees | 2026-06-29 | G0-02, G0-03, CPL-015 |

## 4. Retrieval and validation method

Each URL was fetched from the official MHLW host with redirect following, compression,
bounded retries and a 60-second timeout. Validation used:

```text
curl -fL --compressed --retry 2 --max-time 60
file
wc -c
shasum -a 256
pdfinfo
pdftotext -f 1 -l 1
unzip -t
unzip -p <xlsx> xl/workbook.xml
unzip -p <xlsx> xl/sharedStrings.xml
```

Observed result: 10/10 HTTP 200, final host `www.mhlw.go.jp`, expected PDF/OOXML
signature, nonzero byte count, unique URL and unique SHA-256. Temporary binaries were
deleted after inspection.

## 5. Promotion and stop conditions

The following remain open:

1. legal review of use, extraction, caching, redistribution and publication rights;
2. security/privacy/management/pharmacy-operator determination of which requirements
   apply to yrese as a provider, to a pharmacy as an operator, or to both;
3. responsibility allocation against contracts, MDS/SDS, cloud/Edge/device and support
   boundaries;
4. control-by-control mapping and evidence/test ownership under REG-001/REG-007/SEC;
5. independent re-retrieval/hash verification;
6. Q&A retrieval after publication and applicability review;
7. PRC-007 evidence promotion and SSOT amendment approval.

Until these close, `evidence_promotion=0`, no compliance claim may be made, and no
runtime, production, external connection or release gate may be activated from this
manifest.
