# fhir_native_phos_aws_platform_direction — FHIR ネイティブ・PH-OS 連携・AWS プラットフォーム方針

```yaml
ssot_id: ARC-008
title: FHIR ネイティブ(ハイブリッド)・PH-OS 汎用投影・AWS プラットフォーム方針
domain: architecture
status: APPROVED
approved_at: 2026-08-01
approved_by: "direct human authority 2026-08-01 (WP-4250 exact11 全て承認); round-5 independent verifier PASS on packet body with no HIGH finding (frozen packet ab086c9f8d6e6bfd26e32fbfe9daa21a3b8b6ccd3f324f413b4d2975731cfab6, base SHA 9d8dbc0c3f5201c762dbb39fd9b15fc3ddc4b875); round-5 security/privacy findings closed in Revision 14; round-5 data-integrity findings closed in Revision 13; codex second opinion unavailable until 2026-08-05 and not counted as evidence"
effective_from: 2026-08-01
effective_to: null
owner: codex_root
reviewers:
  - independent_verifier
  - architect
  - api_contract_reviewer
  - data_integrity_reviewer
  - security_auditor
  - privacy_compliance_reviewer
  - medical_safety_reviewer
  - human_pharmacist_product_authority
version: 0.1.3
created_at: 2026-07-10
updated_at: 2026-07-31
source_refs:
  - ユーザー実装親プロンプト(2026-07-10「PH-OS接続FHIRネイティブ・レセコン実装」)
  - ユーザー方針決定(2026-07-10 AskUserQuestion: FHIR=ハイブリッド / PH-OS=汎用投影 / インフラ=AWS移行)
depends_on: [PRD-006, PRD-007, DOM-005, API-004, PRC-007]
amends: [PRD-007, DOM-005, API-004, DB-001, DB-002, DB-003, DB-004, ARC-005, ARC-007]
impacts:
  - API-003(platform_api_architecture — bounded /fhir/R4 authority + generic read projection)
  - packages/contracts(CapabilityStatement・投影契約を contract-first 単一正本へ)
  - SEC-006(JWT 認可・テナント取得の拡張)/ SEC-008(本番認証・分離方式の独立ゲート)
  - 新規 SSOT: AWS 基盤設計 / DynamoDB single-table 設計 / FHIR ストア・CapabilityStatement 設計 / DOM-006 拡張(FHIR extension) / 汎用投影 API 契約
  - WP: Phase 1..6(FHIR 契約・REST API・投影・Claim/レセ電・電子処方箋・テスト)
related_work_packages: [WP-6001, WP-9002-W5B, WP-4250]
related_tests: [pnpm check:ssot-index, git diff --check]
related_prs: []
evidence_ids: []
change_log:
  - "0.1.3 2026-08-01 WP-4250 exact11 finalization: round-5の独立review三レーン完了(independent verifier PASS・本文HIGHなし)とdirect human approvalによりPROPOSED→APPROVED。本文semanticsは不変。承認範囲はSSOT改版のみであり、実装着手・schema/data migration・production action・conformance主張を含まない。登録済みblockerは全て据え置き"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 13: round-5 data-integrity re-reviewの同期。BLOCKED_RECUTOVER_DIVERGENCE_RESOLUTIONを登録し、BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENTの前提をlive code事実へ訂正(branded-ids.tsは`#`をnegative test付きで既に拒否。残余はキー構築経路のbranded型強制)"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 10: re-review round 3のHIGH 3件訂正を同期し、BLOCKED_AUDIT_PAYLOAD_RETENTION_POLICYを登録"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 9: re-review round 2訂正。writer fence token発行経路とaudit payload外部store参照のblockerを追加し、key canonical form blockerの範囲をprefix曖昧性へ限定"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 8: re-review round 1訂正。§3へPostgreSQL側write fence primitiveの不在とPatient identity不変性を追加し、fence primitive/identity mutation/replay恒久失敗/key canonical form強制の4 blockerを登録"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 7: independent domain review HIGH-1/2/3の訂正。single external write producerを/fhir/R4へ確定しintake commandをunselected化、producer属性表とwrite無効化条件、reception FK互換blocker、Prescription/MedicationRequest ownership blockerを追加"
  - "0.1.3 2026-07-30 WP-4250 PROPOSED Revision 6: API-008/DB-005のwrite delta、date interval、baseline history、live Allow、PUT idempotency契約をbounded authority decisionへ同期"
  - "0.1.3 2026-07-30 WP-4250 PROPOSED Revision 4: trusted AuthContext tuple、read-only generic projection、separate intake command、request-derived URI no-network boundaryを精密化。旧0.1.2承認はprevious-version provenance"
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5B metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions:
  - DynamoDB single-table の key 設計と FHIR/レセコン関係データの access pattern(専用設計 SSOT で確定)
  - Cognito/API Gateway JWT Authorizer のtrusted claim設計(tenant_id, pharmacy_id, actor/principal/client identity as applicable, role, permission scopes)と本番認証解禁(SEC-008 セキュリティレビューと同期)
  - PostgreSQL→DynamoDB の段階移行の具体手順(動く実装を即撤去しない前提)
  - DynamoDB 製品確定そのもの(下記 §2 の派生設計判断。access pattern 検証 + BLOCKED_SECURITY_REVIEW の解除後に確定)
blockers:
  - BLOCKED_SECURITY_REVIEW: 本番 Cognito 認証・KMS(保存時暗号化)・S3/DynamoDB のテナント分離方式(IAM 条件キー等)の確定はセキュリティレビュー完了後(SEC-008 §3 と同期)
  - BLOCKED_FHIR_CONFORMANCE_REVIEW: profile/terminology/conformance test なしに JP Core 準拠を訴求しない(PRD-007 継承)
  - BLOCKED_OFFICIAL_ADAPTER_BOUNDARY: 電子処方箋・オン資・オンライン請求・PMH・JAHIS・レセ電・NSIPS(ARC-003 隔離境界)を FHIR で置換しない(DOM-005/DOM-006 継承)
  - BLOCKED_LEGAL_REVIEW: 監査・会計・確定レセプト/確定請求の保存年限未確定(DB-004 継承。削除しない側に倒す)
  - BLOCKED_WRITE_PRODUCER_PREREQUISITES: §3.1のproduction identity/role-to-scope/qualification/purpose-of-use registryが揃うまでcreate/updateをphase-disabledに維持する
  - BLOCKED_RECEPTION_PATIENT_COMPATIBILITY: live reception_entriesのforeign key/joinとPatient cutoverの互換設計が承認されるまでcutoverしない
  - BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP: DOM-002 Prescription集約とMedicationRequestのownership/cardinality/correction lineageが承認されるまでingestionしない
  - BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE: PostgreSQL側の構造的write fenceとcutover後の乖離detectorが承認・実装されるまでPatient cutoverを実行しない(DB-005 §11 / API-008 §9.1)
  - BLOCKED_PATIENT_IDENTITY_MUTATION: post-cutover Patientのidentifier/patientNumber/logicalIdは不変。付け替えはuniqueness guardとmerge lineage承認まで実施できない(API-008 §2.2)
  - BLOCKED_REPLAY_PERMANENT_FAILURE: replayの恒久500がclientを重複リソース作成へ誘導する経路を残しているため、縮退経路のamendmentまでclinical writeを有効化しない(API-008 §4.1.1)
  - BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT: キー構築経路がbranded型を経由することが強制されていないためprefix曖昧性に対してpharmacy粒度分離を無条件に安全とは主張しない(DB-005 §7)。branded ID factory自体は`#`をnegative test付きで既に拒否している(round-5事実訂正)
  - "BLOCKED_WRITER_FENCE_TOKEN_ISSUANCE: `writerFenceToken`の自己保持がDynamoDB層で強制できないため、発行経路の承認までfenceだけでfresh writer排除を主張しない(DB-005 §5.1 / API-008 §9.1)"
  - BLOCKED_AUDIT_PAYLOAD_RETENTION_POLICY: 収束しないDLQ payloadの保存年限/WORM/消去手順はSEC-007/SEC-008の管轄(DB-005 §6.4)
  - BLOCKED_AUDIT_PAYLOAD_EXTERNAL_STORE: audit payloadの外部store参照は書込順序/digest検証/失敗時semantics/budget算入が未定義のためinline保持のみ(DB-005 §6.4)
  - BLOCKED_RECUTOVER_DIVERGENCE_RESOLUTION: rollback期間中のPostgreSQL側変更をFHIR authorityへ反映する経路、またはrollback期間のread-only運用制約が承認されるまで、rollbackを経た再cutoverを実行しない(DB-005 §11)。初回cutoverは対象外
```

## 1. 目的

2026-07-10のAPPROVED方向をprevious-version provenanceとして保持しつつ、WP-4250のbounded clarificationをatomic PROPOSED batchとしてreviewする。v0.1.3は最終承認前の実装根拠ではない。

## 2. 決定の記録(2026-07-10)

**ユーザー確定判断**(AskUserQuestion):

| # | 論点 | ユーザー決定 |
|---|---|---|
| 1 | FHIR の位置づけ | **ハイブリッド**: 臨床/外部向けリソースは FHIR を格納正本とし FHIR REST API で提供。算定・請求確定・レセ電・監査の内部コアは非 FHIR 正本を維持 |
| 2 | PH-OS 向け API | **汎用投影 API に一般化**(partner 中立・PH-OS を最初の利用者・専用抜け道禁止 — API-004 の原則維持) |
| 3 | インフラ | **AWS スタックへ移行** |

**既存派生設計判断(未確定・§8/open_questions のゲート対象)**: AWS具体構成としてCognito(JWT)/API Gateway(JWT Authorizer)/DynamoDB single-table/S3を第一候補とする。**製品確定はaccess pattern検証 + BLOCKED_SECURITY_REVIEW解除後**であり、AWS移行方向と製品選定を混同しない。

## 3. 目標アーキテクチャ(格納正本と投影の一意な境界)

```text
[認可] Cognito JWT -> API Gateway JWT Authorizer
        -> trusted AuthContext(tenant_id, pharmacy_id, actor/principal/client identity,
           role, permission scopes)
        認可・キー・repository scopeは常にtrusted JWT/AuthContextだけから導出。
        body/query/path/FHIR meta.security/extension はauthorityを供給できない(SEC-006)

[格納正本 — 単一格納。集約ごとに正本は1つ]
  A. 候補FHIR格納正本 = Patient + oral/topical MedicationRequest のみ
     - meta.versionId + 楽観ロック(If-Match)。保存は暗号化必須(§6)
     - この格納正本を提供する面がbounded FHIR REST authority API
       (`/fhir/R4/*`)。**generic read projectionではない**
     - **external authoritative write producerは`/fhir/R4/*`ただ1つ**(§3.1)。
       separate intake command boundaryは本batchでunselectedであり、write
       producerとして設計・実装・広告しない
  B. 算定・請求確定・レセ電・監査 = 非 FHIR 内部正本コア(@yrese/calculation / claim / money / date-time / trace / audit)
     - 算定/請求は A の臨床リソースを「入力として読む」。A を二重格納しない
     - FHIR Claim は請求候補の中間表現 -> 内部 BillingLine -> レセ電 CSV(日本仕様。FHIR で請求を完結しない)
     - 監査は非FHIR内部正本(append-only + ハッシュチェーン)。FHIR Provenance を公開する場合は「内部監査の投影」であり内部監査正本を置換しない(§6)

[読取投影 — 非正本・A/B から再生成可能]
  汎用read projection API(BFF、partner-neutral、将来consumer候補)
  - GET/readだけ。write、command、intake、authority mutationを禁止
  - FHIR authority APIとintake commandはこのread projection層に含めない

[取込command — 本batchでunselected]
  separate intake command boundaryは本batchのwrite producerに**選択しない**。
  contract、route、model、実装、広告のいずれも本batchで認可しない。将来選択する
  場合はPRC-007改版と§3.1と同等のproducer定義を新たに要する。
  projection endpointへのPOST/PUTやprojection read modelからのauthority逆流は
  引き続き禁止

[基盤] DynamoDB single-table(候補)/ S3 / CloudWatch(構造化ログ・PHI 非出力)
```

### 3.1 単一external write producerの確定(fail-closed)

bounded authorityへ外部から書き込めるproducer面は`/fhir/R4/*`ただ1つとする。
複数producerを併存させない。

| 属性 | 確定内容 |
|---|---|
| producer面 | `/fhir/R4/*` のみ。generic/public projectionとseparate intake commandはwrite producerでない |
| actor / client class | trusted AuthContextが解決したtenant+pharmacy所属のconfidential client(machine client)と、その委任を受けたauthenticated pharmacy userの2 classだけ。public client、anonymous client、partner clientは非対象 |
| audience | 当該tenantのyrese bounded authority resource server 1つ。partner API、projection API、Official Adapterをaudienceに含めない |
| scope | MOD-007の既存`patient:write` / `prescription:write`をexactに再利用する。新規write scopeを発明しない(API-008 §8) |
| qualification | 薬剤師資格・runtime roleを要するoperationはtrusted claimで検証する。qualification claimが未実装・未承認である現在は**write interactionを有効化しない** |
| purpose-of-use | 各writeはregistered purpose-of-use値を要求する。registryが存在しない現在は充足不能であり、これもwrite無効化の独立した理由である |
| payload / result | request/responseはAPI-008 §7のexact media typeとOperationOutcome matrixに従う。producerごとの別表現を作らない |
| idempotency | API-008 §4のrequest-byte fingerprint v1と`Idempotency-Key`を全writeで必須とする |

**現在の有効状態**: production identity、role-to-scope、qualification、
purpose-of-use registryのいずれも未実装・未承認である。したがって本batchでは
Patient / MedicationRequestのcreate/update interactionを**phase-disabled**に維持し、
enabled write producerは存在しない。有効化にはこの表の全項目の実装と、
SEC-006/SEC-008系のsecurity reviewおよびhuman approvalを個別に要する。

- **bounded authority**: 本改版で候補正本にできるのは Patient と oral/topical MedicationRequest だけである。Coverage、Medication、MedicationDispense、Organization、Practitioner、PractitionerRole、Location、DocumentReference、Reception、dispensing、billing、calculation、claims、audit、accountingその他のリソース/集約は非選択で、既存内部モデルが権威を維持する。injection MedicationRequest は明示的にunsupported/unselected。
- **Patient cutover**: live PostgreSQLをsole authority/sole writerとして維持し、FHIR側はread-only shadow parityだけを行う。parity証明後もhuman cutoverまでは権威化しない。approved cutover transactionはFHIR VERSION 1を`SYSTEM_CUTOVER` originのauthoritative create baselineとして作り、PostgreSQL historyをFHIR履歴へ捏造しない。cutover後はFHIRがsole writerとなり、dual-write、automatic fallback、automatic merge、physical delete、tombstone resurrectionを禁止する。
- **Patient cutoverのreception互換blocker**: live receptionは`reception_entries`から
  `patients`へのforeign keyとINNER JOINでPatient行に依存している
  (`migrations/000002_create_patient_and_reception_tables.sql`の
  `reception_entries_patient_fk`、`apps/api/src/db/reception-repository.ts`の
  `INNER JOIN patients p`)。Patient authorityをFHIRへ移してもこの参照整合性と
  join経路は消えない。本batchはこの互換設計を確定していないため、
  `BLOCKED_RECEPTION_PATIENT_COMPATIBILITY`としてcutoverを禁止する。解除には
  reception側の参照対象、参照整合性の強制主体、join代替、既存受付の可視性、
  rollback時の整合を定めたapproved設計を要する。referential integrityを黙って
  application層へ降格させない。
- **single-writerは時間順序でしか担保されておらず、その順序を強制する
  primitiveがPostgreSQL側に存在しない**: DynamoDBのConditionCheckはDynamoDB側
  writer同士しか拘束しない。「PostgreSQL側writerを停止する」はapplicationの
  自己抑制であり、停止信号を受け取っていないinstanceは書込権限を保持したまま
  である。「in-flight = 0」は観測時点の性質でしかなく、直後に開始される
  transactionを排除できない。書込権限のrevoke、read-only role切替、または
  DB側fenceのいずれかを承認し、あわせてcutover後の乖離detectorを置くまで
  `BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE`とする(DB-005 §11 / API-008 §9.1)。
  §6の「テナント越えを通常系で権限的に不可能にする」と同じ思想を、
  writer交代にも適用する。
- **Patient identityはpost-cutoverで不変**: createを無効化しても、有効なままの
  PUTでpatientNumber重複を作れる。`identifier`、patientNumber slice、
  `Patient.id`を不変と宣言し、変更を含むPUTを422で拒否する(API-008 §2.2)。
  cutover baselineの一意性はPostgreSQL制約からの継承にすぎず、cutover後の書込を
  守らない。
- **MedicationRequest対内部Prescriptionのownership未解決**: DOM-002 §4の
  Prescription集約(C4)は内部authorityであり、MedicationRequestはその置換でも
  写像でもない。両者のcardinality、可変field、status対応、correction lineage、
  projection方向は本batchで未確定である。したがって
  `BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP`としてMedicationRequest
  ingestionを禁止し、解除にはDOM-002/DOM-005/DOM-006へownership recordを
  登録するapproved amendmentを要する。二重authorityを暗黙に作らない。
- **MedicationRequest start**: 現在runtime/store/writer/dataは存在しない。本batchの最終APPROVED、locked-profile validation、security prerequisites完了後に限り、FHIR store/API ingestionが最初のaccepted createからsole initial writerになる。migration/backfill/dual writer/fallbackは行わない。初期は`intent=order`のみ。correction/original linkageは別のhuman-approved workflowまでfail-closed。

## 4. 改版が必要な既存 SSOT(§9 の順序で実施)

- **PRD-007**(jp_core_fhir_platform_strategy): §4「FHIR=Facade のみ」を「Patient + oral/topical MedicationRequestだけのbounded FHIR格納正本候補、内部コアと非選択resourceは非FHIR authority」へ改版。§6 停止条件は維持。
- **DOM-005**(fhir_native_canonical_model): Patient + oral/topical MedicationRequestだけをbounded FHIR authority候補にし、direct authority API、intake command、generic read projectionを分離。**§2 原則3(DOM-006台帳のみ)・原則4(業務イベント分担)・原則5(money/date)・§3 PHI・§5停止条件は維持**。
- **API-004**(ph_os_reference_integration): PH-OS を「汎用投影 API の最初の利用者」と再定義。投影 API 追加を許容しつつ partner 中立・非正本・専用抜け道禁止(§2/§4)を維持。
- **DB-001〜004**: **DB-001 は「製品中立(PostgreSQL は例示)」を、ユーザー AWS 決定に基づき DynamoDB 第一候補へ狭める**(製品確定自体は独立ゲート — 保存時暗号化・分離方式は BLOCKED_SECURITY_REVIEW 継続)。金額整数・DB now() 禁止・append-only・テナント必須・enum は正本参照等の**不変規律は維持**。DB-002 マイグレーション規律・DB-003 テナント分離・DB-004 保存削除を DynamoDB 文脈で再定義(§6 の DynamoDB 固有ガードを反映)。
- **ARC-005**(event_sourcing_architecture): 永続化技術 BLOCKED(§5)を本 ADR が DynamoDB 方向で上位判断する。ES イベントストアの DynamoDB 実現に append-only・リプレイ決定論(CAL-009/010)・時刻トリガー自動実行禁止(ARC-011)・WORM 志向を継承要件として改版。
- **ARC-007**(claim_finalization_immutability): 確定請求 append-only ストアが DynamoDB へ移ることを反映(§6 TTL 禁止・保存時暗号化を継承)。

## 5. Historical follow-on candidates(WP-4250実装認可外)

- AWS 基盤設計(Cognito/API Gateway/実行基盤/S3/CloudWatch、IaC 方針)
- DynamoDB single-table 設計(key 設計・access pattern・GSI・テナント分離 PK・IAM 条件キー)
- bounded FHIR store/CapabilityStatement design(Patient + oral/topical MedicationRequestのみ。locked-profile validationまで非実装・非広告)
- read-only汎用投影API契約(処方カード等の再生成可能なpartner-neutral read model。
  GET/readのみ、write/intake/command禁止)— packages/contracts単一正本
- separate intake command契約(dispense-workflow/residual/risk-review/
  claim-candidate等を将来選択する場合のvalidation/idempotency/authority transaction。
  generic projection route/modelを入口にしない)
- **JWT 認可・テナント取得は SEC-006 の拡張**として設計(新規独立 SSOT でなく SEC-006/008 に接続)
- FHIR extension は **DOM-006 の拡張**として台帳登録(packaging-instruction / set-method / set-target / residual-used / phos-card-link / source-system 等)

## 6. 維持する不変条件(方針転換でも緩めない)

- **認可はJWT/AuthContext**。trusted tenant_id、pharmacy_id、actor/principal/
  client identity、role、permission scopesをrequest開始時に確定する。body/query/
  path/FHIR meta.security/extensionはauthorityを供給できない。全DB query/key/
  cursor/idempotency/referenceを同じtenant+pharmacy contextへ拘束する。
- **テナント越えを通常系で権限的に不可能にする**(DB-003 §4 の critical 要件)。DynamoDB では RLS が無いため、**IAM 条件キー(`dynamodb:LeadingKeys` 等)+ テナント別 PK 前提の接続ロール分離**を DB-003 §4 の DynamoDB ネイティブ代替として要件化する(確定は BLOCKED_SECURITY_REVIEW)。多層防御の DB 層を AWS 移行で暗黙に消さない。
- **純粋コアは persistence-agnostic を維持**(MOD-003・CLAUDE.md「packages/* は runtime-neutral」)。DynamoDB 結合は**永続化アダプタ層に限定**し、calculation/money/date-time/trace/audit の純粋コアは DynamoDB を知らない(check:boundaries が機械強制)。
- **PHI 非露出 + 保存時暗号化**: FHIR リソース(PHI をほぼ常に含む)・PHI をログ/trace/agmsg/エラーへ平文出力しない(SEC-004/DOM-005 §3)。**FHIR 格納正本ストアは保存時暗号化必須**(鍵運用=KMS は BLOCKED_SECURITY_REVIEW)。MOD-009 封筒不変条件(phiClassification≠none → encryptionStatus 'encrypted'、違反 throw)を継承。fixture は合成のみ(MOD-013)。
- **evidence 規律**: 算定・請求・帳票は evidence_id 裏付け必須。FHIR 化しても点数根拠なしに算定しない(算定エンジンは BLOCKED 継続)。
- **Official Adapter 境界**: 電子処方箋・オン資・オンライン請求・PMH・JAHIS・レセ電・**NSIPS(ARC-003 隔離境界)**を FHIR で置換しない(BLOCKED_OFFICIAL_ADAPTER_BOUNDARY)。レセ電最終出力は FHIR でなく日本のレセ電仕様/マスターコード/CSV。
- **監査 append-only + ハッシュチェーン**: WP-5004a の監査 core を維持。永続化先が DynamoDB でも append-only(UPDATE/DELETE 不可)・prevHash を永続 tip から採番・外部アンカー可能構造(SEC-007/008)。**FHIR Provenance を公開する場合は内部監査の投影であり内部監査ハッシュチェーン正本を置換しない**(監査正本の二重化防止)。
- **金額・点数・日付**: @yrese/money / date-time が正本。浮動小数点禁止。DB now() のビジネスカラム禁止(アプリ供給タイムスタンプ)。
- **二重実装の禁止**: enum/status/money/date/validation を共通パッケージ正本から再利用。集約ごとの格納正本は単一(§3)。DynamoDB 側で独自 enum を定義しない。
- **公式情報確認**: FHIR R4 / JP Core / 厚労省 / 支払基金の一次情報を確認してから実装(推測実装禁止)。
- **request-derived URIはdereferenceしない**: Referenceだけでなく
  `meta.profile`、Coding/identifier system、extension/canonical URL等はpinned local
  package/terminology allow-listで意味を検証する。inert URI identifierは一律禁止
  しないが、HTTP/DNS/redirect/package fetchへ渡さず、loopback/private/link-local/
  IPv6/encoded/protocol-relative/redirect/DNS rebindingを含むoutbound callを0にする。

tenant isolation test obligationは同一tenant内のpharmacy A credentialでpharmacy Bを
対象にし、read/vread/history=404、search=empty、Reference/cursor=reject、foreign
pharmacy repository/network access=0を証明する。body/query/path/metaにpharmacy Bを
埋めてもAuthContext scopeは変化しない。これはplanned obligationであり現時点の
runtime PASS evidenceではない。

## 7. 段階移行方針(fail-closed)

- **動く PostgreSQL 実装(WP-5002/5003)を即撤去しない**。DynamoDB single-table 設計 SSOT を先に確定・レビューし access pattern を検証してから移行する。
- **移行中も集約ごとの格納正本は常に単一**。他方(構築中)は非正本とし cutover まで権威にしない(二重権威・二重書きの恒常化を禁止)。
- WP-5004a(監査 hash core、純粋ロジック)は永続化非依存のため維持。WP-5004b(永続化)は DynamoDB 設計確定後に再アサイン。
- 本番 AWS 認証(Cognito)・KMS・分離方式の確定は BLOCKED_SECURITY_REVIEW(SEC-008 §3 と同期)。それまで dev スタブは本番起動拒否(WP-4056 の fail-closed 継承)。

## 8. 停止条件

- 認可を body/query/path/FHIR meta の tenant で行う → 実装禁止(§6)
- `/fhir/R4/*`以外にexternal authoritative write producerを設ける、または
  separate intake command boundaryをwrite入口として設計/実装/広告する →
  実装禁止(§3.1 単一producer)
- §3.1の未充足項目(production identity / role-to-scope / qualification /
  purpose-of-use registry)を残したままcreate/updateを有効化・広告 →
  BLOCKED_WRITE_PRODUCER_PREREQUISITES
- reception_entriesのforeign key/join互換設計の承認前にPatient cutoverを実行 →
  BLOCKED_RECEPTION_PATIENT_COMPATIBILITY
- Prescription集約とMedicationRequestのownership未確定のままMedicationRequest
  ingestionを有効化、または両者を暗黙に同一視 →
  BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP
- 算定・請求・レセ電・監査の内部正本を FHIR に置換 → BLOCKED(ハイブリッドの範囲外。§3)
- 同一集約を FHIR 正本と内部正本に二重格納 → 実装禁止(§3・§6 二重実装)
- **append-only・法定保存アイテム(監査/会計台帳/確定レセプト/確定請求)への DynamoDB TTL(自動失効)設定 → 実装禁止**(物理削除と同一、DB-004/SEC-008 違反。BLOCKED_LEGAL_REVIEW 継承)
- 純粋コアへの DynamoDB 直結合 → CHANGES_REQUESTED(persistence-agnostic 違反、§6)
- PH-OS 専用の抜け道 API・専用 scope → API_CONTRACT_BLOCKED(API-004 §4 継承)
- DynamoDB 設計 SSOT 未確定のまま PostgreSQL 正本を撤去 → SSOT_UPDATE_REQUIRED(§7)
- 一次情報未確認の FHIR/レセ電/電子処方箋実装 → SSOT_UPDATE_REQUIRED(推測実装禁止)

## 9. 改版カスケードの順序(APPROVED 同士の矛盾回避 — fail-closed)

PRC-007 §7の`amends`機構に従い、PROPOSED中に解決済みを先取りしない。これを防ぐため:

1. PROPOSED review中はARC-008の既存`amends`列挙を変更しない。WP-4250で本文を全面改版するPRD-007/DOM-005/API-004は、各文書で「本文改版済み・finalization待ち」と明示する。required reviewと最終human approval後のatomic finalization時だけ、解決済み対象を`amends`から外す。DB-001..004/ARC-005/ARC-007は本WPの対象外で、既存予約を変更しない。
2. 本exact11は全件PROPOSEDとしてatomic reviewし、required reviewsと最終human approvalの完了前にAPPROVED化・landing・実装しない。
3. PRC-007 v0.3.1 §7による`amends`/暫定権威の定義はhistorical prerequisiteとして完了済み。本WPでPRC-007を編集しない。
4. 個別実装 WP は、本exact11の最終APPROVED、locked-profile validation、security prerequisites、required human gateの完了まで着手しない。

## 変更履歴

- 0.1.3 (2026-08-01 finalization): round-5 の独立 review 三レーン完了
  (independent verifier は packet 本文 PASS・HIGH なし)と direct human approval に
  より PROPOSED → APPROVED。**本文 semantics は不変**。承認範囲は SSOT 改版のみで
  あり、実装着手・schema/data migration・production action・conformance 主張は
  含まない。登録済み blocker は全て据え置きである。
- 0.1.3 (2026-07-31 Revision 10): independent re-review round 3 の HIGH 3 件の
  訂正を同期。Patient identity 不変性が TWI の条件式で構造的に強制されること、
  deny quota が無記録の窓を作らず集約 intent へ縮退すること、audit payload の
  破棄が時間経過ではなく収束で駆動されることを反映し、収束しない DLQ payload の
  保存年限を `BLOCKED_AUDIT_PAYLOAD_RETENTION_POLICY` として登録。
- 0.1.3 (2026-07-31 Revision 13): round-5 独立 data-integrity re-review の同期。
  rollback を経た再 cutover には、rollback 期間中の PostgreSQL 側変更(属性
  変更・統合・削除)を FHIR authority へ反映する経路が存在せず、PATIENTLINK も
  削除できないため余剰 link が恒久的に残る。「未解消差分は cutover を block
  する」既存規律と合成すると再 cutover が二度と成立しない状態になり得るため、
  `BLOCKED_RECUTOVER_DIVERGENCE_RESOLUTION` を登録した(初回 cutover は対象外)。
  あわせて `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` の前提を live code の事実へ
  訂正した: branded ID factory は `#` を negative test 付きで既に拒否しており、
  残余はキー構築経路が branded 型を経由することの保証である。範囲は縮んだが
  conservative 側は維持する。
- 0.1.3 (2026-07-31 Revision 9): independent re-review round 2 の訂正。
  `writerFenceToken` の自己保持が DynamoDB 層で強制できないこと、および audit
  payload の外部 store 参照が書込順序・digest 検証・失敗時 semantics・budget
  算入を欠くことを受け、`BLOCKED_WRITER_FENCE_TOKEN_ISSUANCE` と
  `BLOCKED_AUDIT_PAYLOAD_EXTERNAL_STORE` を登録。`GLOBAL` sentinel 衝突が
  DB-005 §3 の別 prefix 空間化で本 batch 内に解消されたため、
  `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` の範囲を prefix 曖昧性のみへ限定。
- 0.1.3 (2026-07-31 Revision 8): independent re-review round 1 の訂正。§3 へ
  「single-writer は時間順序でしか担保されておらず、その順序を強制する
  primitive が PostgreSQL 側に存在しない」ことと、post-cutover Patient の
  identity 不変性を追加。`BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE`、
  `BLOCKED_PATIENT_IDENTITY_MUTATION`、`BLOCKED_REPLAY_PERMANENT_FAILURE`、
  `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` を登録。
- 0.1.3 (2026-07-31 Revision 7): independent domain reviewのHIGH-1/2/3訂正。
  §3.1でexternal authoritative write producerを`/fhir/R4/*`単一に確定し、
  separate intake command boundaryをunselectedへ降格。producerの
  actor/client class、audience、scope、qualification、purpose-of-use、
  payload/result、idempotencyを表で確定し、未充足につきcreate/updateを
  phase-disabledに維持。live reception foreign key/join互換と
  Prescription/MedicationRequest ownershipを新blockerとして明記。
  PROPOSEDと既存amendsは維持。
- 0.1.3 (2026-07-30 Revision 6): bounded authorityのAPI-008/DB-005
  write/search/history/cutover精密化を同期し、PROPOSEDと既存amendsを維持。
- 0.1.3 (2026-07-30): WP-4250推奨承認に基づくPROPOSED draft。ARC-008の既存方向をPatient + oral/topical MedicationRequestのbounded authorityへ精密化し、Patient shadow/human cutover、MedicationRequest initial single-writer、非選択リソース/internal authority、injection unsupported、final review/human gateを明記。0.1.2の承認履歴はprevious-version provenanceであり本draftの承認ではない。
- 0.1.2 (2026-07-10): opus4.8 再レビュー(APPROVED_READY)の任意文言改善 R1-R3 を反映(再レビュー不要と明言済み)。R1: §9 step4 の実装ゲートに step1 に加え step3(PRC-007 改版)完了を明記し、暫定優先注記が PRC-007 裏付け前に実装が始まる循環を閉じた。R2: §3 §A のリソース列挙が例示であり正式集合は FHIR ストア設計 SSOT / DOM-006 で確定する旨を追記(§4 優先表との粒度差の吸収先を明示)。R3: Reception の写像先(Appointment/Task か内部保持か)が未確定の設計選択で設計 SSOT で確定する旨を明示。方針・不変条件・fail-closed 性に変更なし。人間承認(2026-07-10「承認して実行」)取得により PROPOSED→APPROVED 昇格、§9 改版カスケード(PRD-007/DOM-005/API-004/DB-001..004/ARC-005/ARC-007 の改版予約注記 + PRC-007 改版)を同一バッチで実行。
- 0.1.1 (2026-07-10): opus4.8 レビュー反映。§3 の FHIR 正本/投影の自己矛盾を一意化(FHIR REST=格納正本の直接面、汎用投影のみ非正本層)+ 調剤 straddle の単一格納正本を確定。§4 DOM-005 改版スコープ精密化(原則2 投影方向も改版、構造誤参照訂正、DB-001 は製品中立→DynamoDB へ)。§6 に DynamoDB 固有ガード追加(persistence-agnostic 維持・保存時暗号化+MOD-009・IAM LeadingKeys の DB-003§4 代替・Provenance 投影・NSIPS 追加)。§8 に TTL 物理削除禁止。§9 改版カスケード順序を新設(amends の fail-closed 担保)。amends/impacts に ARC-005/ARC-007/API-003 追加。§2 でユーザー確定(AWS)と派生設計(DynamoDB 等)を分離。
- 0.1.0 (2026-07-10): ユーザー実装親プロンプト + 方針決定を ARC-008 として起草。
```
