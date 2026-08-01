# fhir_mapping_registry — canonical model ↔ FHIR/JP Core マッピング台帳

```yaml
ssot_id: DOM-006
title: canonical model ↔ FHIR/JP Core マッピング台帳(枠組み)
domain: domain
status: APPROVED
approved_at: 2026-08-01
approved_by: "direct human authority 2026-08-01 (WP-4250 exact11 全て承認); round-5 independent verifier PASS on packet body with no HIGH finding (frozen packet ab086c9f8d6e6bfd26e32fbfe9daa21a3b8b6ccd3f324f413b4d2975731cfab6, base SHA 9d8dbc0c3f5201c762dbb39fd9b15fc3ddc4b875); round-5 security/privacy findings closed in Revision 14; round-5 data-integrity findings closed in Revision 13; codex second opinion unavailable until 2026-08-05 and not counted as evidence"
owner: codex_root
reviewers:
  - independent_verifier
  - fhir_profile_reviewer
  - medical_safety_reviewer
  - privacy_compliance_reviewer
  - data_integrity_reviewer
  - human_pharmacist_product_authority
version: 0.1.2
created_at: 2026-07-09
updated_at: 2026-07-31
effective_from: 2026-08-01
effective_to: null
source_refs: PRD-007(SRC-FHIR-001..006 経由), 構築プロンプト v0.2.0 §17, §22
depends_on: [PRD-007, DOM-005, ADP-001, ADP-002]
impacts: [WP-0046]
related_work_packages: [WP-0042, WP-9002-W5F, WP-4250]
related_tests: [pnpm check:ssot-index, git diff --check]
related_prs: []
evidence_ids: []
change_log:
  - "0.1.2 2026-08-01 WP-4250 exact11 finalization: round-5の独立review三レーン完了(independent verifier PASS・本文HIGHなし)とdirect human approvalによりPROPOSED→APPROVED。本文semanticsは不変。承認範囲はSSOT改版のみであり、実装着手・schema/data migration・production action・conformance主張を含まない。登録済みblockerは全て据え置き"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 11(mechanical): status欄・本文が使用するBLOCKED_FIELD_MAPPINGをfrontmatter blockersへ登録(round 4 L-2)"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 9: re-review round 2訂正。Patient authority-boundary recordへPostgreSQL fence primitive/登録・訂正経路の前提とidentity不変性を追加し、対応blockerを登録"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 7: MEDIUM-4/HIGH-3/HIGH-4訂正。package identityをUNREGISTERED_PROVENANCEとしSRC登録を前提化、authority-boundary recordへPatient create disabled/reception FK互換/Prescription ownership blockerを追加"
  - "0.1.2 2026-07-30 WP-4250 PROPOSED Revision 6: Patient authority-boundary recordへVERSION 1 SYSTEM_CUTOVER baseline/non-backfill条件を追加"
  - "0.1.2 2026-07-30 WP-4250 PROPOSED: Patient/oral-topical MedicationRequestのauthority boundary registryを追加。field mapping completionは非主張。旧0.1.1承認はprevious-version provenance"
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5F metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions:
  - conformance validator / CapabilityStatement実証
  - terminology expansionと利用条件
blockers:
  - BLOCKED_OFFICIAL_ADAPTER_BOUNDARY: 公的接続系を FHIR マッピングで置換しない(§4)
  - BLOCKED_FHIR_CONFORMANCE_REVIEW: real validator/CapabilityStatement/terminology検証未完了
  - BLOCKED_FIELD_MAPPING: field mappings/署名・checksum/Must Support確定は§1.1の前提充足まで未確定(status欄・本文と整合 — Revision 11でfrontmatter登録)
  - BLOCKED_PACKAGE_PROVENANCE: package artifactがsource_registryへ未登録のためpackage/profile identityを確定扱いしない(§1.1)
  - BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP: DOM-002 §4 Prescription集約とMedicationRequestのownership未確定(§1.1)
  - BLOCKED_RECEPTION_PATIENT_COMPATIBILITY: reception foreign key/join互換設計未承認のためPatient cutoverしない(§1.1)
  - BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE: PostgreSQL側の構造的write fenceと乖離detector未承認のためPatient cutoverしない(§1.1)
  - BLOCKED_PATIENT_IDENTITY_MUTATION: cutover後のPatient登録経路とidentity訂正経路が未承認のためPatient cutoverしない(§1.1)
  - BLOCKED_REPLAY_PERMANENT_FAILURE: replay恒久失敗の縮退経路が未承認のためclinical writeを有効化しない(§1.1)
```

## 1. 目的

canonical model(DOM-002/DOM-005)と FHIR/JP Core プロファイル間の変換を、**登録済みマッピングのみ実装可**とするための台帳の枠組みを定める。
本書は台帳の形式・登録手順・検証ゲートに加え、WP-4250の**resource-level authority boundary**だけをPROPOSED登録する。field-level mapping実体、terminology completion、conformance completionは含まず、mapping completeを主張しない。

## 1.1 WP-4250 PROPOSED authority-boundary records

次のrecordはmapping entryでも実装allow-listでもない。resource selection、
single-writer、phase、unsupported境界だけを記録する別schemaである。

| authority_boundary_id | resource/use case | owner / sole writer | candidate profile / API phase | source | cutover / lifecycle | status / blocker |
|---|---|---|---|---|---|---|
| AUTH-FHIR-PATIENT-001 | Patient | pre-cutover: PostgreSQL; post-cutover: FHIR store/API | `JP_Patient` v1.2.0 candidate; API-008 phase matrix | ARC-008 / API-008 / DB-005 | field mapping未定義。read-only shadow parity→human cutover→FHIR VERSION 1 `SYSTEM_CUTOVER` creation baseline。PostgreSQL history backfill、dual-write/auto fallback/auto merge/physical delete/tombstone resurrection禁止。**createはpatientNumber uniqueness guard不在によりinitially disabled**(API-008 §2.1)。**cutoverはlive reception_entriesのforeign key/join互換設計、PostgreSQL側の構造的write fence primitiveとcutover後の乖離detector、およびcutover後のPatient登録経路とidentity訂正経路の承認が前提**。post-cutoverのidentifier/patientNumber/logicalIdは不変(API-008 §2.2) | PROPOSED / BLOCKED_FIELD_MAPPING / BLOCKED_RECEPTION_PATIENT_COMPATIBILITY / BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE / BLOCKED_PATIENT_IDENTITY_MUTATION |
| AUTH-FHIR-MR-ORAL-TOPICAL-001 | oral/topical MedicationRequest | gate完了後のfirst accepted createからFHIR store/API ingestion | `JP_MedicationRequest` v1.2.0 candidate; API-008 initial phase | ARC-008 / API-008 / DB-005 | current runtime/store/writer/dataなし。authority migration/backfillなし。initial `intent=order`のみ。**DOM-002 §4 Prescription集約とのcardinality/可変field authority/status対応/correction lineage/projection方向が未確定** | PROPOSED / BLOCKED_FIELD_MAPPING / BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP |
| AUTH-FHIR-MR-INJECTION-UNSUPPORTED-001 | injection MedicationRequest | none | unsupported/unselected | ARC-008 / PRD-007 | intake/projection/storeなし | PROPOSED / UNSUPPORTED |

候補package identityは`jpfhir.jp.core#1.2.0`、FHIR R4 4.0.1、canonical base `http://jpfhir.jp/fhir/core`。2026-07-30取得identityはSHA-256 `6094c8b9ebd975cb738c66cc999774c06a0aacf4480c068a8465e597117e52a3`、content-length 2391515、last-modified `2025-11-28T05:12:19Z`。published signature/checksumはなく、manifestの`notForPublication`とfile URL不整合があるため、これはidentity recordであってauthenticity/conformance evidenceではない。Must Supportはderived IGへ委譲し、追加send/receive要件を推測しない。terminology expansion/licensing、real validator、CapabilityStatementはBLOCKED。

**provenance chainは未確立(MEDIUM-4 訂正)**: 上記のhash/length/last-modifiedは
`docs/regulatory/source_registry.md`の**どのSRC entryにも登録されていない**。
現行のSRC-FHIR-002はJP Coreの公開バージョン履歴ページ
(`https://jpfhir.jp/fhir/core/history.html`)、SRC-FHIR-003は実装ガイドの
index ページ(`https://jpfhir.jp/fhir/core/1.2.0/index.html`)であり、いずれも
**HTMLページであってpackage artifactではなく、状態は`FETCHED`・「ハッシュ未取得」**
である。したがってこの2件は、上記のpackage tarball identityも、
`http://jpfhir.jp/fhir/core/StructureDefinition/JP_Patient` /
`JP_MedicationRequest` のcanonical URLとversionも裏付けていない。

- 本batchでは上記package identityを`UNREGISTERED_PROVENANCE`として扱う。
  identity record、verified package identity、canonical identityのいずれとしても
  **確定扱いしない**。
- 解除には、package artifact自体(取得URL、取得日時、SHA-256、content-length、
  取得手段、公式配布元の確認方法)を`source_registry.md`へ新規SRC entryとして
  登録し、その`SRC-ID`を本表と PRD-007 §4 から参照することを要する。
  `source_registry.md`は本exact11 batchの対象外であるため、この登録は
  **別のPRC-007改版**を要する`SSOT_UPDATE_REQUIRED`である。
- 併せて、profile canonical URLとversionの根拠を、HTML index ページではなく
  package内のStructureDefinition artifactへ紐づけ直す。
- 登録完了まで`BLOCKED_PACKAGE_PROVENANCE`とし、package/profile identityを
  実装、validation設定、conformance主張の根拠にしない。

## 2. 台帳形式

field mappingは 1 エントリ = 1 (canonical 概念, FHIR リソース/要素) 対応とし、
次のフィールドを必須とする。§1.1 authority-boundary recordはこのschemaに属さず、
`MAP-FHIR-*` IDを消費せず、変換実装を許可しない。

| フィールド | 内容 |
|---|---|
| mapping_id | `MAP-FHIR-<4桁連番>`(採番はSSOT owner roleのみ) |
| canonical_ref | DOM-002 の集約・属性への参照 |
| fhir_resource | 対象リソース(例: MedicationDispense) |
| fhir_profile | JP Core プロファイル名 + **プロファイルバージョン**(例: JP Core 1.2.0 / FHIR R4 4.0.1) |
| direction | `projection`(canonical→FHIR)/ `intake`(FHIR→canonical)/ `both` |
| terminology | 使用するコード体系・ValueSet と、コードマッピングの根拠(§22 コードマッピング規律に従い CODE_MAPPING_REVIEW_REQUIRED の対象) |
| loss_notes | 変換で失われる/近似される情報の明示(無損失なら `none`) |
| source_ref | 公式仕様の根拠(source_registry.md の SRC-ID) |
| evidence_id | 請求・算定に影響するマッピングでは必須(evidence_register の ID)。それ以外は source_ref のみで可と明記して省略できる |
| conformance_status | UNVERIFIED / VERIFIED(検証ツール・手順は open_question。UNVERIFIED のまま「JP Core 準拠」を訴求しない) |
| valid_from / valid_to | 有効期間(effective-dating)。版切替は既存エントリの書き換えではなく新エントリ起案+旧エントリの valid_to 設定・DEPRECATED 化で行う(§3-5 と整合) |
| status | DRAFT / PROPOSED / APPROVED / DEPRECATED |

台帳本体は本書の後続版(または `fhir_mapping_entries/` 配下の分割ファイル)に
APPROVED `MAP-FHIR-<4桁連番>` entryのみを正本として保持する。現在はfield
mapping entryがゼロであり、Patient/MR intake/projection implementationは
`BLOCKED_FIELD_MAPPING`。

## 3. 登録手順と検証ゲート

1. **起案**: 個別 WP でエントリを DRAFT 登録。source_ref 必須(公式仕様の裏付けなしに登録不可)。
2. **レビュー**: terminology を含むエントリは CODE_MAPPING_REVIEW_REQUIRED、業務影響が高いものはrelevant domain reviewerとhuman pharmacist/product authorityのreview必須。
3. **承認**: status を APPROVED に。実装は APPROVED エントリのみ参照可。
4. **検証ゲート**(実装時):
   - 変換実装は mapping_id を参照し、台帳外変換は実行時拒否(audit registry と同型の allow-list 方式)
   - projection の往復テスト(canonical → FHIR → canonical で loss_notes 以外の情報が保存されること)
   - FHIR validator / conformance test によるプロファイル適合検証(ツール選定は open_question — 未選定の間、「JP Core 準拠」の訴求は BLOCKED_FHIR_CONFORMANCE_REVIEW)
5. **改版**: JP Core / プロファイルのバージョン更新時は既存エントリを自動で読み替えず、新バージョン向けエントリを別途起案する(旧エントリは DEPRECATED)。

## 4. Official Adapter 境界(置換禁止)

**FHIR マッピングは Official Adapter(ADP-001)の代替ではない。** 次は別レーンであり、本台帳の対象外とする。

| 系統 | 従うべき仕様 |
|---|---|
| オンライン資格確認 | 公式外部IF仕様(ONS 経由入手 — BLOCKED_OFFICIAL_ADAPTER_SPEC) |
| 電子処方箋管理サービス | 公式仕様(HPKI 署名・調剤結果登録等を含む) |
| オンライン請求・電子レセプト | 公式仕様(CSV/UKE 等の指定形式) |
| PMH | 公式仕様 |
| JAHIS 連携(レセコン・電子薬歴) | JAHIS 仕様書 |
| NSIPS(薬局内機器連動) | NSIPS ライセンスと ARC-003 の隔離境界(ACL)。FHIR authority/projection scopeに取り込まない |

これらの接続を「JP Coreで表現できるから」とbounded FHIR authority APIや
generic projectionへ寄せる変更はBLOCKED_OFFICIAL_ADAPTER_BOUNDARY。
外部partner連携は別のgeneric projection contractとapprovalが必要であり、本台帳は
support/connectivityを主張しない。

## 5. 停止条件(fail-closed)

- source_ref のないエントリ登録 → 登録不可
- source_registry へ未登録の package artifact identity を verified/確定として
  扱う、または HTML index ページの SRC entry で package tarball hash や profile
  canonical URL の provenance を裏付けたと主張 → BLOCKED_PACKAGE_PROVENANCE(§1.1)
- Prescription 集約と MedicationRequest の ownership 未確定のまま authority
  boundary record を実装根拠にする → BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP
- 台帳外・DRAFT/PROPOSED エントリに基づく変換実装 → SSOT_UPDATE_REQUIRED
- Official Adapter 系統の FHIR 置換 → BLOCKED_OFFICIAL_ADAPTER_BOUNDARY
- プロファイルバージョン無指定のマッピング → 登録不可
- conformance 未検証での「JP Core 準拠」訴求 → BLOCKED_FHIR_CONFORMANCE_REVIEW

## 変更履歴

- 0.1.2 (2026-08-01 finalization): round-5 の独立 review 三レーン完了
  (independent verifier は packet 本文 PASS・HIGH なし)と direct human approval に
  より PROPOSED → APPROVED。**本文 semantics は不変**。承認範囲は SSOT 改版のみで
  あり、実装着手・schema/data migration・production action・conformance 主張は
  含まない。登録済み blocker は全て据え置きである。
- 0.1.2 (2026-07-31 Revision 9): independent re-review round 2 の訂正。
  §1.1 の Patient authority-boundary record へ、cutover の前提として
  PostgreSQL 側の構造的 write fence primitive と cutover 後の乖離 detector、
  および cutover 後の Patient 登録経路と identity 訂正経路を追加。post-cutover
  の `identifier` / patientNumber / logicalId が不変であること(API-008 §2.2)も
  記録し、`BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE`、
  `BLOCKED_PATIENT_IDENTITY_MUTATION`、`BLOCKED_REPLAY_PERMANENT_FAILURE` を
  frontmatter blockers へ登録。
- 0.1.2 (2026-07-31 Revision 7): independent domain review の MEDIUM-4 /
  HIGH-3 / HIGH-4 訂正。§1.1 の package identity を `UNREGISTERED_PROVENANCE`
  と明記し、SRC-FHIR-002/003 が HTML ページであって package artifact でも
  profile canonical URL の裏付けでもないことを記録。source_registry への
  新規 SRC 登録を別 PRC-007 改版の前提として要求し、`BLOCKED_PACKAGE_PROVENANCE`
  を追加。authority-boundary record へ Patient create の initially disabled、
  reception foreign key/join 互換 blocker、Prescription 対 MedicationRequest の
  ownership blocker を追加。§5 停止条件と blockers を同期。
- 0.1.2 (2026-07-30 Revision 6): Patient authority-boundary recordへ
  VERSION 1 `SYSTEM_CUTOVER` baseline/non-backfill条件を追加。
- 0.1.2 (2026-07-30): WP-4250 PROPOSED authority-boundary recordsをmapping
  entry/allow-listから分離。field-level `MAP-FHIR-<4桁>` entry、terminology、
  validator/CapabilityStatement、conformanceは未完了としてBLOCKEDを維持。
- 0.1.1 (2026-07-09): opus4.8 レビュー反映(v0.2.0 §7 指定の evidence_id / conformance_status / valid_from / valid_to を台帳必須フィールドへ追加・§4 置換禁止レーンに NSIPS を追加)。
- 0.1.0 (2026-07-09): 台帳の枠組み・登録手順・Official Adapter 境界を初版起草(WP-0042)。マッピング実体は未登録。
