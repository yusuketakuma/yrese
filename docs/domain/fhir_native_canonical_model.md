# fhir_native_canonical_model — canonical model と FHIR/JP Core の関係方針

```yaml
ssot_id: DOM-005
title: canonical model と FHIR/JP Core の関係方針
domain: domain
status: APPROVED
approved_at: 2026-08-01
approved_by: "direct human authority 2026-08-01 (WP-4250 exact11 全て承認); round-5 independent verifier PASS on packet body with no HIGH finding (frozen packet ab086c9f8d6e6bfd26e32fbfe9daa21a3b8b6ccd3f324f413b4d2975731cfab6, base SHA 9d8dbc0c3f5201c762dbb39fd9b15fc3ddc4b875); round-5 security/privacy findings closed in Revision 14; round-5 data-integrity findings closed in Revision 13; codex second opinion unavailable until 2026-08-05 and not counted as evidence"
owner: codex_root
reviewers:
  - independent_verifier
  - architect
  - medical_safety_reviewer
  - privacy_compliance_reviewer
  - data_integrity_reviewer
  - human_pharmacist_product_authority
version: 0.1.3
created_at: 2026-07-09
updated_at: 2026-07-31
effective_from: 2026-08-01
effective_to: null
amended_by: [ARC-008]
amendment_status: PENDING_REVISION
amendment_note: "WP-4250 PROPOSED draftで本文は改版済みだが、required reviewと最終human approval前のためrevision完了を先取りしない。ARC-008 amendsはfinalizationまで保持する。"
source_refs: PRD-007(SRC-FHIR-001..006 経由), 構築プロンプト v0.2.0 §12, §17
depends_on: [PRD-007, DOM-001, DOM-002, ADP-001, ADP-002, MOD-009(event_envelope_schema)]
impacts: [DOM-006, WP-0046]
related_work_packages: [WP-0042, WP-9002-W5F, WP-4250]
related_tests: [pnpm check:ssot-index, git diff --check]
related_prs: []
evidence_ids: []
change_log:
  - "0.1.3 2026-08-01 WP-4250 exact11 finalization: round-5の独立review三レーン完了(independent verifier PASS・本文HIGHなし)とdirect human approvalによりPROPOSED→APPROVED。本文semanticsは不変。承認範囲はSSOT改版のみであり、実装着手・schema/data migration・production action・conformance主張を含まない。登録済みblockerは全て据え置き"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 9: re-review round 2訂正。§4のcutover未解決境界へfence primitiveと登録・訂正経路を追加しblockersを同期"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 7: HIGH-1/HIGH-3訂正。原則2をsingle write producerへ確定しintake commandをunselected化、§4へPrescription ownership・reception FK互換・Patient create disabledの未解決境界を追加"
  - "0.1.3 2026-07-30 WP-4250 PROPOSED Revision 6: Patient cutoverのFHIR VERSION 1 SYSTEM_CUTOVER baselineと非backfill境界を明確化"
  - "0.1.3 2026-07-30 WP-4250 PROPOSED Revision 3: bounded hybrid authority、read-only projection、separate intake commandへ精密化。旧0.1.2承認はprevious-version provenance"
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5F metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions: PRD-007 open_questions を継承(JP-CLINS参照範囲 / 業務イベントの表現分担 / conformance条件)
blockers:
  - BLOCKED_FHIR_CONFORMANCE_REVIEW: profile / terminology mapping / conformance testなしにJP Core準拠を訴求しない
  - BLOCKED_OFFICIAL_ADAPTER_BOUNDARY: 公的接続系・JAHIS・NSIPSをFHIRで置換しない
  - BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP: DOM-002 §4 Prescription集約とMedicationRequestのownershipが承認されるまでingestionしない(§4)
  - BLOCKED_RECEPTION_PATIENT_COMPATIBILITY: reception foreign key/join互換設計が承認されるまでPatient cutoverしない(§4)
  - BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE: PostgreSQL側の構造的write fenceとcutover後の乖離detectorが承認されるまでcutoverしない(§4)
  - BLOCKED_PATIENT_IDENTITY_MUTATION: post-cutover Patientのidentity不変により登録・訂正経路が存在しないため、その経路が承認されるまでcutoverしない(§4)
  - BLOCKED_REPLAY_PERMANENT_FAILURE: replayの恒久500がclientを重複作成へ誘導する経路を残しているため、縮退経路の承認までclinical writeを有効化しない(§4)
```

## 1. 目的と結論

yrese 内部の正本データモデル(canonical model)と FHIR/JP Core リソースの関係を確定する。

**結論: bounded hybrid authority。Patientとoral/topical MedicationRequestだけは、所定のcutover/start gate後にFHIR R4/JP Core resourceを格納正本候補とする。それ以外は内部canonical modelが正本である。**

```text
Patient + oral/topical MedicationRequest: FHIR candidate authority -> /fhir/R4 direct authority API
all other domains/resources: internal canonical authority -> generic/public read-only projections
```

## 2. 原則

1. **選択範囲だけFHIR authority**。Patientとoral/topical MedicationRequest以外のbilling、calculation、claims、audit、accounting、reception、dispensingその他全resource/aggregateは内部canonical authorityを維持する。injection MedicationRequestはunsupported/unselected。
2. **FHIR authorityとread projectionを分離し、write producerは1つに固定する**。
   `/fhir/R4/*`は選択リソースのbounded authority面であり、ARC-008 §3.1により
   **external authoritative write producerはこの面ただ1つ**である。separate
   intake command contractは本batchでunselectedであり、write入口として設計・
   実装・広告しない。generic/public APIとPH-OS向け出力はread-onlyで再生成可能な
   非正本投影であり、write/intakeやauthority逆流を許さない。
3. **変換は DOM-006(fhir_mapping_registry)に登録されたマッピングのみ**。台帳外の暗黙変換は実装禁止。
4. **JP Core で表現しきれない業務イベントを FHIR に無理に押し込まない**。疑義照会・後発変更・分割調剤・リフィル・在宅訪問・服薬フォロー・残薬調整・監査ログ・請求確定・返戻再請求は、yrese event / Official Adapter / JAHIS / Provenance / AuditEvent / 独自 Extension の分担で扱う(分担確定は PRD-007 open_question — 未確定のまま実装しない)。
5. **金額・点数・日付は共通パッケージが正本**。FHIR表現時も
   @yrese/money / @yrese/date-timeの値から導出し、authority/intake/projection
   境界で浮動小数点に落とさない。

## 3. PHI 分類・暗号化との整合

FHIR リソースは Patient / MedicationDispense 等、ほぼ常に PHI を含む。次を不変条件とする。

- FHIR 表現を **イベントエンベロープ(@yrese/events)で運ぶ場合、phiClassification は none 以外**を指定する。events パッケージの実行時不変条件(PHI≠none → encryptionStatus 'encrypted' 必須)がそのまま適用される。
- FHIR リソース(JSON)を**ログ・trace・agmsg・エラーメッセージへ平文出力しない**(SEC-004 と同一規律)。
- FHIR fixture・サンプルに本番個人情報を使わない。PHI/PII を含む FHIR fixture の公開・OSS 化は禁止(PRD-007 §6)。
- authority/intake/projection APIのアクセス制御はapps/apiのdeny-by-default
  権限配下に置き、tenant_id + pharmacy_idをFHIR検索パラメータより優先する。

## 4. 対象リソースの優先順位

本改版で選択する候補はPatientとoral/topical MedicationRequestだけである。Patientのlive PostgreSQL authorityはread-only shadow parityとhuman cutoverまで維持し、approved cutover transactionがFHIR VERSION 1をimmutable `SYSTEM_CUTOVER` originのauthoritative creation baselineとして作った後だけFHIR sole writerとする。PostgreSQLの過去historyをFHIR versionへ推測/backfillしない。MedicationRequestは現行runtime/store/writer/dataがないため、final approval、locked-profile validation、security prerequisites後の最初のaccepted createからFHIR ingestionをsole writerとする。dual-write、automatic fallback/merge、migration/backfill、physical delete、tombstone resurrectionは禁止。MedicationRequestは当初`intent=order`のみで、correction/original linkageは別human-approved workflowまで拒否する。**個々のフィールドマッピングは本書で定義しない**。

**未解決のauthority境界(independent domain review HIGH-3 訂正)**: 本書§2 原則1は
選択範囲外を内部canonical authorityとするが、DOM-002 §4のPrescription集約と
oral/topical MedicationRequestの関係は「選択/非選択」の二分では決まらない。
両者のcardinality、可変fieldのauthority、DOM-004ライフサイクルとFHIR
`status`/`intent`の対応、correction lineage、projection方向が未確定である。
これが確定するまでMedicationRequest ingestionを開始しない
(`BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP`)。DOM-002 §4が
未確定事項の正本、DOM-006 §1.1が確定後のrecord登録先である。

同様に、Patient cutoverは次がすべて解決するまで実行しない。

- live receptionのforeign key/join依存(`BLOCKED_RECEPTION_PATIENT_COMPATIBILITY`。
  DOM-002 §2 / DB-005 §11)
- PostgreSQL側の構造的write fence primitiveとcutover後の乖離detector
  (`BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE`)。single-writerは時間順序でしか
  担保されておらず、その順序を強制する機構がPostgreSQL側に存在しない
- **cutover後のPatient登録経路とidentity訂正経路**
  (`BLOCKED_PATIENT_IDENTITY_MUTATION`)。FHIR側Patient createは
  `(tenantId, pharmacyId, patientNumber)`一意性guardがcreate TWIに存在しない
  ためinitially disabledであり(API-008 §2.1)、post-cutoverのidentityも不変で
  ある(API-008 §2.2)。この2つとdelete/merge unsupportedを合成すると
  `FHIR_PRIMARY`ではPatient集合が閉じ、新患登録も誤登録訂正もできない。
  この状態でcutoverすると業務停止かPostgreSQL直接書込かの二択になり、
  fail-closedではなく危険側へ倒れる

またauthority state machineは一方向ではなく、単調なのは`authorityEpoch`だけで
ある(DB-005 §5.1/§11)。

## 5. 停止条件(fail-closed)

- DOM-006 台帳に未登録のリソース・フィールド変換を実装しようとした → SSOT_UPDATE_REQUIRED
- 選択範囲外をFHIR格納正本にしようとした → SSOT_UPDATE_REQUIRED
- `/fhir/R4/*`以外にexternal authoritative write producerを設けた、または
  unselectedなintake command contractをwrite入口として実装 → 実装禁止(§2 原則2)
- Prescription集約とMedicationRequestのownership未確定のままingestionを開始、
  または両者を暗黙に同一視 → BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP
- reception foreign key/join互換設計の承認前にPatient cutoverを実行 →
  BLOCKED_RECEPTION_PATIENT_COMPATIBILITY
- profile version / terminology mapping / conformance test なしに「JP Core 準拠」を訴求 → BLOCKED_FHIR_CONFORMANCE_REVIEW(PRD-007)
- Official Adapter領域をFHIRで置換しようとした →
  BLOCKED_OFFICIAL_ADAPTER_BOUNDARY(NSIPSもauthority/projection scope外)
- PHI を含む FHIR 表現の平文ログ・平文イベント → 実装禁止(events 実行時例外)

## 変更履歴

- 0.1.3 (2026-08-01 finalization): round-5 の独立 review 三レーン完了
  (independent verifier は packet 本文 PASS・HIGH なし)と direct human approval に
  より PROPOSED → APPROVED。**本文 semantics は不変**。承認範囲は SSOT 改版のみで
  あり、実装着手・schema/data migration・production action・conformance 主張は
  含まない。登録済み blocker は全て据え置きである。
- 0.1.3 (2026-07-31 Revision 9): independent re-review round 2 の訂正。§4 の
  Patient cutover 未解決境界を列挙形へ改め、live reception の foreign key/join
  依存に加えて、PostgreSQL 側の構造的 write fence primitive と cutover 後の
  乖離 detector、および cutover 後の Patient 登録経路と identity 訂正経路を
  前提として追加。create 無効化・identity 不変・delete/merge unsupported の
  合成が `FHIR_PRIMARY` で Patient 集合を閉じることを明記。authority state
  machine が一方向でなく単調なのは `authorityEpoch` だけであることを追記し、
  対応する 4 blocker を frontmatter へ同期。
- 0.1.3 (2026-07-31 Revision 7): independent domain review の HIGH-1 / HIGH-3
  訂正。§2 原則2 を「write producer は `/fhir/R4/*` ただ1つ」へ確定し、
  separate intake command contract を本 batch unselected へ降格。§4 に
  Prescription 集約と MedicationRequest の ownership 未確定、live reception の
  foreign key/join 互換、FHIR 側 Patient create の initially disabled を
  未解決 authority 境界として追加。§5 停止条件と blockers を同期。
- 0.1.3 (2026-07-30 Revision 6): Patient cutoverのFHIR VERSION 1
  `SYSTEM_CUTOVER` baselineとPostgreSQL history非backfillを追加。
- 0.1.3 (2026-07-30): WP-4250 PROPOSED body revision。Patient +
  oral/topical MedicationRequestだけのbounded hybrid authority、single-writer
  gate、非選択resource/internal authority、lifecycle stopを定義。
  amendment_statusはfinalizationまでPENDING_REVISIONを維持。
- 0.1.1 (2026-07-09): opus4.8 レビュー反映(events 参照を MOD-009 へ訂正・§5 列挙に JAHIS/NSIPS 境界を追記・書名 fhir_native の意味を明確化)。
- 0.1.0 (2026-07-09): PRD-007 を上流として初版起草(WP-0042)。
