# fhir_rest_facade_contract — Bounded FHIR REST authority API contract

```yaml
ssot_id: API-008
title: Bounded FHIR REST authority API contract
domain: api
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - api_contract_reviewer
  - fhir_profile_reviewer
  - security_auditor
  - privacy_compliance_reviewer
  - medical_safety_reviewer
  - human_pharmacist_product_authority
version: 0.1.2
created_at: 2026-07-10
updated_at: 2026-07-31
approved_at: 2026-08-01
approved_by: "direct human authority 2026-08-01 (WP-4250 exact11 全て承認); round-5 independent verifier PASS on packet body with no HIGH finding (frozen packet ab086c9f8d6e6bfd26e32fbfe9daa21a3b8b6ccd3f324f413b4d2975731cfab6, base SHA 9d8dbc0c3f5201c762dbb39fd9b15fc3ddc4b875); round-5 security/privacy findings closed in Revision 14; round-5 data-integrity findings closed in Revision 13; codex second opinion unavailable until 2026-08-05 and not counted as evidence"
effective_from: 2026-08-01
effective_to: null
source_refs:
  - HL7 FHIR R4 4.0.1 RESTful API(https://hl7.org/fhir/R4/http.html)
  - HL7 FHIR R4 OperationOutcome / IssueType(https://hl7.org/fhir/R4/operationoutcome.html, valueset-issue-type.html)
  - HL7 FHIR R4 Search(https://hl7.org/fhir/R4/search.html)
  - HL7 FHIR R4 CapabilityStatement(https://hl7.org/fhir/R4/capabilitystatement.html)
  - JP Core 1.2.0(base FHIR R4 4.0.1、https://jpfhir.jp/fhir/core/1.2.0/)
  - DB-005(storage and transaction authority)
depends_on:
  - DB-005(storage/access/version/idempotency contract)
  - ARC-008(single-authority and Official Adapter boundary)
  - DOM-005 / DOM-006(selected resource and authority-boundary records)
  - MOD-007(permission scope registry)
  - MOD-008(audit event registry)
  - API-001(existing Patient read-only compatibility surface)
  - SEC-006 / SEC-008(existing tenant and production security controls)
impacts:
  - future packages/contracts FHIR wire schemas
  - future apps/api /fhir/R4 routes
related_work_packages: [WP-9002-W5A, WP-4250]
related_tests: [pnpm check:ssot-index, git diff --check]
related_prs: []
evidence_ids: []
change_log:
  - "0.1.2 2026-08-01 WP-4250 exact11 finalization: round-5の独立review三レーン完了(independent verifier PASS・本文HIGHなし)とdirect human approvalによりPROPOSED→APPROVED。本文semanticsは不変。承認範囲はSSOT改版のみであり、実装着手・schema/data migration・production action・conformance主張を含まない。登録済みblockerは全て据え置き"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 12: re-review round 4の設計findings訂正(user direction下、fail-closed側選択)。§9.2の集約deny intentをPENDING#/DONE# lifecycleへ適合(決定的eventId・窓あたり1件conditional Put・試行回数保持を撤回・窓閉鎖後配送・MOD-008登録範囲へ追加、§6の429行同期)、§4.2.1のjoint invariantをoperation別へ訂正(update=7+2M+N、Patient create将来=7+M+2N、評価点=write preflight、§7.1従属主張を撤回)、§2.1のguard算入を「1件」からversion数N件へ訂正(DB-005との不一致解消)、§8の判定順序へphase/enablement判定段を追加しphase依存応答をinteraction scope通過callerへ限定(cutover phaseのscope外開示を閉鎖、§7.1合成順序同期)。§11 test obligationsと§12停止条件を同期"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 11(mechanical): re-review round 4のbookkeeping findingsのみ訂正(設計findingsは未解決のまま記録・escalation維持)。§9.2/§11のDLQ「append-only」呼称をDB-005 §6.4のmonotonic single-transition規律へ整合(§12実装禁止との自己矛盾解消)、§11のtest obligationが再掲していた撤回済み4段判定順序を§8の5段へ訂正、無接頭辞の他文書§参照3箇所(DB-005 §11×2/§3.4)へ文書接頭辞、患者検索bound超過statusの正本をAPI-001 §4へ委譲(429の先行定義を撤回)"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 10: re-review round 3のHIGH 3件訂正。§2.2のidentity不変性へidentityDigest照合による構造的backstopを追加(TWI前422は一次拒否として維持)、§9.2のdeny quotaを「記録せず429で打ち切る」から(principal,scope,窓)あたり1件の集約intentへ縮退させ無記録の窓を禁止、payload削除をdedupe実在のConditionCheckで機械強制し収束していないDLQ payloadの時間経過削除を禁止。§6/§11/§12とblockersを同期"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 9: re-review round 2訂正。§2.1/§8へ405のphase修飾、§2.2をcutover blockerへ格上げし登録・訂正経路の消滅を明示、§3.2冒頭の非PHI断定を撤回、§4.1.1をverbatim返却へ変更しserializer往復をreplay経路から除去、§4.2.1へmaxIndexedTokenPartitionsとwrite有効化gate、§6のAllowをcaller scopeへfilter、§7.1と§8の合成順序、§8の判定順序を2段認可へ、§9.1のwriterFenceToken強制不能を明示、§9.2の条件へ空searchsetを追加、audit payloadをinline限定"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 8: independent re-review round 1のREQUEST_CHANGES訂正。Patient identity不変性(§2.2)、logical IDのpseudonymous分類と予測不能性MUST(§3.2)、resourceJsonのS格納/serializer保持義務/collation規定と恒久500の未解決明示(§4.1.1)、retirement論拠の事実訂正とbudget侵食/key compromise受容の明示(§4.2.1)、snapshot並行度のlease化とbound oracleの正直な限定(§5.3)、cleanup判定のexpiry一本化(§5.2)、判定順序の全体固定と未認証への単一401/no-store choke point(§8)、authorityStateの単調性撤回とwriterFenceToken自己保持/PostgreSQL fence primitive不在の明示(§9.1)、audit factの再構成可能性/deny監査/消込のConditionCheck(§9.2)を追加"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 7: independent domain review訂正。単一write producer前提、Patient create initially disabled(§2.1)、logical ID/tombstone境界(§3.2)、replay exactnessと保存response representation(§4.1.1)、lookup-key retirement unsupported(§4.2.1)、snapshot materialization bound(§5.3)、parse boundary(§7.1)、401/403分離と全response no-store、resource authority epoch束縛(§9.1)、audit intent→fact convergence(§9.2)を追加"
  - "0.1.2 2026-07-30 WP-4250 PROPOSED Revision 6: write-side canonical search delta、precision interval _lastUpdated、cutover baseline history、history fullUrl、live-gated Allow、Patient PUT idempotency、parameterized wildcard negotiationをreview待ちとして固定"
  - "0.1.2 2026-07-30 WP-4250 PROPOSED Revision 5: persisted rotation fence、FHIR search token semantics/algebra、DynamoDB native limits、range-local negotiation、exact error/Allow matrix、bounded instance historyをreview待ちとして精密化"
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5A metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions:
  - terminology expansion/licensing and real validator evidence
blockers:
  - BLOCKED_FHIR_CONFORMANCE_REVIEW: locked profile/terminology/real validator evidenceなしにJP Core準拠を訴求しない
  - BLOCKED_SECURITY_REVIEW: production store/IAM/role/break-glass evidenceはSEC-006/SEC-008の既存境界と別途承認が必要
  - BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT: read/search/create/update/deny/failureの登録済みaudit mappingがMOD-008に存在するまでclinical APIを実装しない
  - BLOCKED_FHIR_SEARCH_SNAPSHOT_IMPLEMENTATION: immutable index delta/materialized as-of snapshotとretention/barrier tests、および§5.3のmaterialization boundが実装・測定されるまでsearchを広告・実装しない
  - BLOCKED_WRITE_PRODUCER_PREREQUISITES: ARC-008 §3.1のproduction identity/role-to-scope/qualification/purpose-of-use registryが揃うまでcreate/updateを有効化・広告しない
  - BLOCKED_PATIENT_CREATE_UNIQUENESS: §2.1のpatientNumber uniqueness guardとpossible-match/merge lineageが承認されるまでPatient createをinitially disabledに維持する
  - BLOCKED_LOOKUP_KEY_RETIREMENT: §4.2.1の走査bound/同時証明手順/failure semanticsが未定義のためlookup-key retirementをunsupportedとする。**かつ、compromise時の緊急無効化経路(新規writeでは使わないがreplay検証には残すdeactivation)が承認されるまでclinical writeを有効化しない**。失効不能なHMAC鍵を抱えたままwriteを開始しない
  - BLOCKED_WRITER_FENCE_TOKEN_ISSUANCE: §9.1の`writerFenceToken`自己保持がDynamoDB層で強制できないため、発行経路または自称不能属性への拘束が承認されるまでfenceだけでfresh writer排除を主張しない
  - BLOCKED_AUDIT_PAYLOAD_RETENTION_POLICY: 収束しないまま滞留するDLQ itemの暗号化payloadは無期限に残る。保存年限/WORM/消去手順はSEC-007/SEC-008の管轄であり、timerで消して解決したことにしない(§9.2)
  - BLOCKED_AUDIT_PAYLOAD_EXTERNAL_STORE: §9.2のaudit payloadを外部store参照で保持する場合の書込順序/digest検証/失敗時semantics/budget算入が未定義のためinline保持のみを許可する
  - BLOCKED_PATIENT_IDENTITY_MUTATION: §2.2によりpost-cutover Patientのidentifier/patientNumber/logicalIdは不変。付け替え・訂正はuniqueness guardとmerge lineage承認まで実施できない
  - BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE: §9.1のPostgreSQL側構造的fenceとcutover後の乖離detectorが承認・実装されるまでPatient cutoverを実行しない
  - BLOCKED_REPLAY_PERMANENT_FAILURE: §4.1.1の恒久500がclientを重複リソース作成へ誘導する経路を残しているため、縮退経路のamendmentまでclinical writeを有効化しない
  - BLOCKED_AUTH_RESPONSE_FAMILY_ALIGNMENT: §8の401/403分離をSEC-006へ反映するamendmentが本契約のfinalizationとatomicに承認されるまで実装しない
```

## 1. Authority and scope

このファイル名の `facade` はlegacy pathであり、本文の契約は
`/fhir/R4/*` の**bounded FHIR REST authority API**である。generic/public
projection、partner consumer API、Official Adapterの契約ではない。対象候補は
Patient と oral/topical MedicationRequest のみで、現時点ではrouteも
CapabilityStatementも未実装である。

FHIR R4 4.0.1、`application/fhir+json` のみを候補とする。injection
MedicationRequest、その他resource、Patient merge/delete/tombstone operation、
MedicationRequest correction/original linkageは選択外である。Provenanceは
client write対象でもclinical authorityでもなく、commit済みinternal auditから
生成するread-only derivativeである。

## 2. Resource × phase matrix

| Resource / phase | Advertised and accepted interactions | Search parameters | Explicitly unsupported |
|---|---|---|---|
| server / implementation complete後 | authenticated `GET /fhir/R4/metadata` | — | implementation前のmetadata route/advertising |
| Patient / pre-cutover | **none**。shadowはinternal comparison専用。API-001 search/getがsole live read surface | none | authority API全体、CapabilityStatement advertising |
| Patient / post-cutover | read, vread, history-instance, search, update | `identifier`, `_lastUpdated` | **create(§2.1によりinitially disabled)**、delete, merge/unmerge, tombstone operation/resurrection, conditional create/update/delete, patch, history-type, transaction/batch; `updateCreate=false` |
| MedicationRequest / gates前 | none | none | authority API全体、advertising |
| MedicationRequest / initial gates後 | `intent=order` create, read, vread, history-instance, search | `identifier`, `subject`, `patient`, `code`, `_lastUpdated` | `medication` reference search, PUT/update, delete, correction/original linkage, conditional operations, patch, history-type, transaction/batch |

**全write interactionのproducer前提**: create/updateはARC-008 §3.1の単一
external write producer定義(actor/client class、audience、scope、qualification、
purpose-of-use、payload/result、idempotency)を全て満たす場合だけ有効化できる。
production identity、role-to-scope、qualification、purpose-of-use registryが
未実装・未承認である現在、両resourceのwrite interactionは実際には
phase-disabledであり、上表の「initial gates後」はその前提を満たした後の
契約状態を表す。

### 2.1 Patient createはinitially disabled(fail-closed)

DOM-002 §10はPatient patientNumberを`(tenantId, pharmacyId, patientNumber)`で
一意と定め、PostgreSQLは
`migrations/000003_add_patient_number_scope_unique.sql`の
`patients_tenant_pharmacy_patient_number_unique`でこれを強制している。本契約の
create TWI(§9 / DB-005 §5)にはこの一意性を保証するconditional targetが存在せず、
同時にPatient merge/unmergeは§1でunsupportedである。重複patientNumberを作れる
createと、重複を解消できないlifecycleの組合せは患者取り違えへ直結する。

したがってPatient createを**initially disabled**とする。`POST /fhir/R4/Patient`は
**post-cutover phaseでは**enabled targetのunsupported methodとして405
`not-supported`を返し、**pre-cutover phaseではphase-disabledにつき404**である
(§2 phase matrix)。いずれのphaseでもCapabilityStatementにも405 `Allow`にも
現れない。post-cutoverのPatient書込は
既存instanceへの`PUT`だけである。cutover baselineのVERSION 1はDB-005 §11の
approved cutover transactionが作るのであってこのcreate routeではない。

有効化するには次を全て満たすapproved amendmentを要する。

1. 同一clinical TWI内で`(tenantId, pharmacyId, patientNumber)`のimmutable
   uniqueness guardをconditional Put(`attribute_not_exists`)する。guardは
   DB-005 §5.2の規律どおりactive+retained**全version**へ1件ずつPutするため、
   §9のaction/aggregate budgetへは**version数`N`件**として算入する(「その1件」と
   していた以前の記述はDB-005とのround-3不一致であり撤回する。§4.2.1の
   operation別invariantを正とする)。
2. possible-match判定と、薬剤師によるmanual resolutionの契約結果を定義する。
   weak attribute(氏名・カナ・生年月日)によるautomatic mergeは禁止のまま。
3. merge/unmerge lineageとlifecycle(retire、reactivate、重複解消後の
   identifier保持)を定義する。定義前はmerge/unmerge禁止とcreate有効化を
   同時に成立させない。
4. patientNumber変更・再利用の可否と、旧値のindex/alias regeneration規律を定める。
5. guard HMACのkey導出、key version、rotation規律を定める。key rotationが
   uniqueness不変条件を壊さないことを証明する(§2.2)。

### 2.2 Patient update経路のidentity不変性(fail-closed)

§2.1でcreateを閉じてもハザードは閉じない。post-cutoverのPatient `PUT`は
有効なままで、そのTWI(DB-005 §5.2)には`(tenantId, pharmacyId, patientNumber)`
のuniqueness guardが**存在しない**。したがってupdateだけでも、既存Patientの
patientNumberを他のPatientと同じ値へ書き換えて重複を作れる。merge/unmergeは
unsupportedなので解消できない。これは§2.1が閉じようとしたハザードそのものである。

したがってpost-cutover Patientについて次をimmutableと宣言する。

- `Patient.identifier`(全要素、`system`/`value`とも)
- patientNumberを表すidentifier slice
- `Patient.id`(logicalId)

`PUT`のvalidated resourceがこれらのいずれかを現行versionと異なる値で含む場合、
TWI発行前に**422 `business-rule`**で拒否する。差分の内容、旧値、新値を
responseへ載せない。要素の削除・追加も変更とみなす。

**この事前拒否だけでは不変性を強制できない。** TWI前の検証はapplicationの
自己抑制であり、adapterの分岐漏れ、refactoring、あるいは2経路目のupdate pathが
検証を迂回してTWIを組めば、storage層は何も拒否しない。本契約は§9.1で
PostgreSQL側の停止について、DB-005 §5.1で`writerFenceToken`について、
同じ性質を理由にblocker化している。**本batchで最も患者安全に直結する不変条件に
だけその基準を適用しないのは非対称**である。

したがってDB-005 §5.2は、CURRENT itemの`identityDigest`属性を
`Update(CURRENT)`のConditionExpressionへ合成することを要求する。adapterは
期待値をvalidated request resourceのidentityから導出するので、identityを変更した
requestは条件不一致でTWI全体がatomicにabortする。action数は増えない。
本§のTWI前422は一次拒否として維持し、ConditionCheckはそれを迂回した経路に
対する構造的backstopとする。**両者が揃って初めて不変性が「宣言」から「強制」に
なる**。片方だけの実装を完了扱いにしない。

identity変更を伴う正当な業務(患者番号の付け替え、誤登録の訂正)は、上記
§2.1のuniqueness guard、possible-match、merge/unmerge lineageが承認されるまで
**この契約では実施できない**。承認前にPUT経由で回避しない。それまで
`BLOCKED_PATIENT_IDENTITY_MUTATION`とする。

**この不変性はcutoverの前提条件であり、post-cutoverの挙動宣言ではない。**
create無効化・delete無効化・merge/unmerge unsupported・identity不変を合成すると、
`FHIR_PRIMARY`ではPatient集合が閉じ、identifierも凍結される。すなわち
**cutover後に新患を登録する経路も、誤登録を訂正する経路も系全体に存在しない**。
この状態でcutoverすると、現場に残る操作可能なfieldは氏名・カナ・生年月日など
mutableな人口統計項目だけになり、運用は必然的に「既存recordの氏名を正しい患者へ
書き換えて使い回す」か「DB-005 §11が禁じるPostgreSQL直接書込」へ流れる。前者は
1つの`Patient.id`の下に2名分の調剤・処方履歴が連結されたchartを作り、
本§が閉じようとした患者番号重複より検知困難かつ危険である(SAF-001)。

したがって`BLOCKED_PATIENT_IDENTITY_MUTATION`は**cutover実行のblockerである**。
解除には次のいずれかを要する。

1. §2.1のuniqueness guard、possible-match、merge/unmerge lineageを承認して
   Patient createを有効化し、そのうえでidentity訂正経路を定義する。
2. またはidentityを変更しない退避経路 — `Patient.active=false`相当のretireと、
   正しいidentityでの再登録、両者のlineage記録 — をuniqueness guardと同時に
   設計し承認する。

DB-005 §11のcutover前提一覧にも「Patient登録経路と identity訂正経路が
存在すること」をgateとして加える。**訂正できないままcutover可能という組合せは
fail-closedではなく危険側**であり、それを許す記述を残さない。

この不変性宣言はcutover baselineには適用されない。DB-005 §11のcutover
transactionが作るVERSION 1のidentityは、PostgreSQL側の
`patients_tenant_pharmacy_patient_number_unique`と`CUTOVER_PENDING`の
「unresolved duplicate = zero」要件から継承する。**この継承はcutover時点でのみ
成立し、PostgreSQLがwriterでなくなった後の書込を守らない**。だからこそ
create無効化とupdate identity不変性の両方が必要である。

enabled target routeへの未対応interactionは `405` + `not-supported`。phase-disabled
routeは404かつ非広告である。未対応search parameter
(Patient/MRの`name`を含む)は `400` + `not-supported` とし、FHIRのlenient
handlingを採用せず常時strictとする。MedicationRequest createはvalidated
resourceの `intent=order` だけを受理し、それ以外は `422 business-rule`。

CapabilityStatementは**実装・locked-profile validation・必要gateが完了した
exact subsetだけ**を宣言する。interaction/searchParam/profileの将来候補を
先行広告しない。Patientはpost-cutoverのみ、MedicationRequestはinitial gates後
のみ広告し、`updateCreate=false` とする。各`searchParam.documentation`は§5.1の
accepted form、repeat/comma規則、unsupported modifier/chaining、filter-required
規則を同じgrammar versionで明示する。

`GET /fhir/R4/metadata`もdeny-by-defaultである。trusted AuthContextに加え、
既存MOD-007の `patient:read`, `patient:write`, `prescription:read`,
`prescription:write` の少なくとも1つを要求し、欠如は403とする。新しいmetadata
scopeは作らない。CapabilityStatementはglobalにenabledかつgate通過済みのrouteと
caller scopeのintersectionへfilterする。read系は対応`*:read`、create/updateは
対応`*:write`がある場合だけ表示する。callerごとに変わるため
`Cache-Control: no-store`と`Vary: Authorization`を付ける。広告はenabled route/
test evidenceを超えず、route無効化と同じatomic config generationで縮小する。
metadata生成はrequest時に同じatomic config generationのLIVE ENABLED method setを
読む。405の`Allow`もこの同一generationから導出し、potential/static phase matrixを
広告根拠にしない。

## 3. Read, version, history and update

- read: `GET [type]/[id]` → 200、unknown/foreign scope → 404、永続tombstone
  read → 410。
- vread: `GET [type]/[id]/_history/[vid]` → immutable version 200、unknown/
  foreign scope/version → 404。
- update: Patient post-cutoverだけ。`PUT Patient/[id]` は `If-Match:
  W/"{versionId}"` と `Idempotency-Key` の双方が毎回必須。欠如/invalidは
  400 `required`/`invalid`、staleは412 `conflict`。検証済みheaderからadapter `expectedVersion`を一度だけ
  導出し、body/query/meta.versionIdをauthorityにしない。
- 成功responseは `ETag: W/"{base10VersionId}"`、`Last-Modified`、
  resource `meta.versionId`/`meta.lastUpdated`を同じcommitted versionから返す。

### 3.1 Bounded instance history

対応routeは `GET /fhir/R4/{type}/{id}/_history` だけである。first pageはtrusted
scope内のCURRENTと、その`metaVersionId`が指すimmutable VERSIONをstrong readし、
identity/version/digest一致を検証して`historyWatermarkVersion`として固定する。
存在したことがない、またはforeign
tenant/pharmacyのinstanceは404。pre-cutover historyを推測・生成しない。

対象はwatermark以下のimmutable VERSION recordで、`lastUpdated` descending、
同時刻はnumeric `versionId` descendingのdeterministic orderとする。`_count`は
single canonical decimal 1..100、default 20だけを許す。`_since`, `_at`, `_list`,
`_sort`、その他parameter、modifier、repeat/commaは400 `not-supported`。
first page後のcursorはsigned/opaqueで
`tenantId, pharmacyId, resourceType, logicalId, historyWatermarkVersion, pageSize,
last tuple, expiry, token version`へ拘束する。next URLはverbatim carrierで、
query併用、token再構成、scope/resource/id/count driftは400 `invalid`。

responseは`Bundle.type=history`でself link、続きがある場合だけnext linkを持つ。
各entryは該当immutable versionのfull resourceと次を持つ。

- `fullUrl`: absolute unversioned `[base]/{type}/{id}`。同一instanceの全versionで
  同じ値とし、`/_history/{versionId}` URLを置かない
- `request.method`: create versionは`POST`、update versionは`PUT`
- `request.url`: createは`{type}`、updateは`{type}/{id}`
- `response.status`: createは`201`、updateは`200`
- `response.location`: `{type}/{id}/_history/{versionId}`
- `response.etag`: `W/"{versionId}"`
- `response.lastModified`: そのversionの`meta.lastUpdated`

page間writeはwatermarkより大きいversionを追加するだけで既存page membership/
順序/entryを変えない。VERSION recordはwrite interaction種別もimmutableに保持する。
missing/corrupt version、watermark矛盾、duplicate versionは500 `incomplete`で全結果を
拒否する。CapabilityStatementはこのexact route/parameterだけをhistory-instance
として宣言する。

Patient cutover baselineはDB-005 §11のcutover transactionが作るauthoritative
FHIR creation VERSION 1である。history entryは通常createと同じ
`request.method=POST`, `request.url=Patient`, `response.status=201`を表現するが、
これは外部REST callerがPOSTしたという主張ではない。immutable internal
`changeOrigin=SYSTEM_CUTOVER`とregistered internal auditが非REST originを保持する。
PostgreSQLの過去変更をFHIR versionとして推測、backfill、合成しない。

### 3.2 Logical IDとtombstoneの境界

**logical IDはserver生成のopaque値**である。分類は本節後段のとおり
「PHIでない」ではなく**pseudonymousかつ患者に紐づく識別子**であり、
使用可否は範囲付きで定まる。

- 値域はFHIR `id`の`[A-Za-z0-9.\-]{1,64}`に従う。DB-005 §3のkey segment正準形
  (`#`非包含)も同時に満たす。
- 生成はserverのみ。client供給のid、`meta.id`、body内idはauthorityにしない。
  `updateCreate=false`であり、未知idへのPUTでinstanceを作らない。
- **PHIまたはPHIから導出可能な値をlogical IDにしない**。氏名、カナ、生年月日、
  患者番号、保険者番号、identifier値、およびそれらのhash/暗号文/連結を
  含めない。
- **暗号論的に予測不能な値でなければならない(MUST)**。CSPRNG由来とし、
  時刻成分・カウンタ成分・登録順に相関する成分を含めない。以前の版はこれを
  「推奨」に留めていたが、その水準ではULID/UUIDv7のような時刻順序IDが
  「random/opaque」に見えて採用され得る。時刻順序IDは登録時刻と登録順、ひいては
  薬局の登録密度を漏らし、本項が禁じた「母集団規模や登録順を漏らす値」に該当
  する。logical IDは`Location`と`entry.fullUrl`に載りbrowser履歴・reverse proxy・
  referrer・サポートissueへ複製されるため、この漏洩は trust boundary の外へ出る。
  検証は単調性検定という機械可能な形でplanned testへ落とす。DB-005 §3.4の
  `patientSurrogateSortKey`(ULID/内部連番を許容)には同じ基準を適用しない。
  あちらは暗号化itemのsort keyでありURL/外部へ出ないためである。
- **分類は「PHIでない」ではなく「pseudonymous かつ患者に紐づく識別子」**とする。
  以前の版は「定義上PHIでない」と断じたが、それはDB-005 §9が`logicalId`を名指しで
  キー/GSI/logへ載せることを禁じている記述と矛盾したまま許可だけを広げていた。
  正しくは**範囲付きで両立**させる。
  - **許可**: trust boundary内のpath、`Location`、`entry.fullUrl`、cursor拘束、
    DynamoDB key。
  - **禁止**: access log、APM、trace、exception、metric label、外部送信、
    error本文。ここは§10の規律をそのまま適用する。
  identifierやpatientNumberをpath segmentへ置くことは引き続き禁止する。
  DB-005 §9の非露出列挙は本項の範囲付き許可と整合するよう改める。
- logical IDは同一instanceで不変であり、再割当・再利用・別instanceへの
  移譲を行わない。

**tombstoneは本batchでunsupported**である。§2 phase matrixのとおりdeleteは
全phaseで非対応であり、この契約は新たなtombstoneを作らない。

- `DELETE`はenabled targetへのunsupported methodとして405 `not-supported`。
- したがって本契約の運用下で410 `deleted`が発生する経路は存在しない。§3の
  「永続tombstone read → 410」および§6の410行は、**将来legacy dataを取り込む
  場合にだけ適用される予約semantics**であり、現行phaseの到達可能な結果では
  ない。CapabilityStatementはdeleteもtombstoneも広告しない。
- tombstoneのresurrection(同一logical IDでの再作成)は、将来deleteを有効化する
  場合も禁止のままとする。
- deleteを有効化するには、法定保存年限(REG-003 / DB-004 / BLOCKED_LEGAL_REVIEW)、
  physical deleteを伴わないtombstone表現、監査への影響、search index deltaの
  `present=false`との関係を定めたapproved amendmentを要する。

## 4. Wire idempotency contract

`Idempotency-Key` はFHIRの `If-None-Exist` と異なるyrese custom HTTP headerで
ある。全createと、enabledなPatient PUT/updateの毎回で必須。値はopaque、PHI-free、
非blank、control characterなし、UTF-8で最大128文字。server生成keyでwriteを
再試行しない。client retryは**同じheaderと完全に同じaccepted request-entity
bytes**を
再送する。

### 4.1 Request-byte fingerprint v1

request-byte fingerprintはtenant-scoped secret keyによるHMAC-SHA-256。
曖昧な連結を避ける
ため、次の順序で各fieldを `uint32-be byteLength || exact UTF-8 bytes` として
連結する。

1. operation (`create` or `update`)
2. trusted tenantId
3. trusted pharmacyId
4. authenticated principal/client id
5. resourceType
6. target logicalId or empty
7. validated If-Match exact canonical value or empty
8. SHA-256 of the exact accepted request-entity bytes

request-entity bytesはHTTP transfer framingを除いた受信octet列で、JSON parse/
profile validation/normalization/re-serialization**前**にcaptureする。
`Content-Encoding`はabsentまたは`identity`だけを許すためdecompression差はない。
validation成功時も同じcaptured bytesをhashする。JSONとして意味が同じでも
whitespace、member order、escapeを含め1 byteでも異なれば別intentである。
clock、attempt、assigned logicalId、
assigned versionIdは入力に含めない。raw key、raw fingerprint input、raw payloadを
log/responseしない。immutable idempotency recordは最低§4.1.1のfield setを
trusted tenant+pharmacy scopeで保持する。recordは`replayUntil` + maximum clock skew
+ approved safety window前に削除せず、retention未承認ならTTLを付けず長い側へ倒す。

### 4.1.1 Replay exactnessと保存response representation

replayは**wire byte-exact**である。同一fingerprintの再送はstatus line、
選択済みresponse header set、response body octet列が初回acceptedと1 byteも
違ってはならない。

byte同一性はidempotency recordへresponse bodyを保存して達成しない。§10はraw
payloadのidempotency record保存を禁止しており、保存replicaはPHIの二重保持に
なる。代わりに**「書込時に一度だけ直列化し、保存したoctetをそのまま返す」**で
達成する。

- clinical writeはaccepted resourceをcanonical serializerで**一度だけ**直列化し、
  その結果のoctet列をimmutable VERSION recordの`resourceJson`として格納する
  (§9 / DB-005 §3.1)。同じoctet列を初回responseのbodyとして返す。
- replayは`resourceJson`のoctet列を**verbatimで返す**。parse・再直列化・
  正規化を経由しない。
- したがってreplay経路にserializerは介在せず、`bytes → parse → serialize →
  bytes`の往復も発生しない。以前の版はreplayを再導出で行っていたが、その場合
  実行経路が必然的に往復になり、**parse側の数値内部表現が未固定**であるため
  `1.10`のようなFHIR `decimal`の末尾ゼロが直列化前に失われ得た。`S`格納で
  DynamoDB側の正規化を排しても、parse層が固定されていなければ有効数字は
  保存されない。verbatim返却はこの層を経路から除去する。
- 書込時の直列化は依然としてdeterministicでなければならないが、要求されるのは
  「同一入力から同一出力」ではなく「**一度だけ実行され、その出力が保存される**」
  ことである。したがってserializer versionの稼働fleetからの除去はreplayを
  壊さない。

- **`resourceJson`はUTF-8 byte列として格納する**(DynamoDB attribute型は`S`)。
  structured attribute(`M`/`N`)へ分解して格納してはならない。`N`は末尾ゼロと
  指数表記を正規化するため、FHIR R4の`decimal`が有効数字として保持する末尾ゼロが
  失われ、byte同一性が原理的に成立しなくなる。`resourceDigest`と
  `responseBodyDigest`はいずれもこのbyte列に対して計算する。両者は同一値である。
- 書込時のcanonical serializerはmember order、whitespace、number形式、escape、
  Unicode正規化を含め全出力byteを決定する。member orderは**Unicode code point順
  固定・locale非依存**とし、実行環境のcollationやロケールに依存させない。
  数値は受理したlexical形をそのまま出力し、float化して有効数字を落とさない。
- replay前に、読み出した`resourceJson` octet列のSHA-256が保存済み
  `responseBodyDigest`と一致することを検証する。一致しない場合は
  **差異のあるbodyを返さず**500 `incomplete`とする。近似replay、
  re-normalization、best-effort等価は認めない。

**恒久500がidempotency契約に開ける穴を、解消済みと主張しない。** §4.3 rule 1に
よりrecordが存在する限りwriteは再実行されず、自動retryも禁止である。したがって
digest不一致に陥ったcommit済みwriteについて、clientは同じ`Idempotency-Key`では
永久に500しか得られない。別keyを送ればfingerprintが変わり**新規createとして
重複リソースを作る**。fail-closedのつもりが、clientを重複臨床データ作成へ誘導
する経路が残っている。MedicationRequestであれば処方重複であり臨床安全事象で
ある。

本batchはこれを未解決の欠陥として記録し、次を要求する。

- digest不一致は**integrity incidentとしてalert
  対象**とし、通常のerror扱いで埋没させない。
- clientが重複を作らずに済む縮退経路(同一keyに対してbodyを伴わない真正な
  結果tupleだけを返す、または結果不明を表す専用OperationOutcomeを返す)を
  approved amendmentで定義する。
- それまで`BLOCKED_REPLAY_PERMANENT_FAILURE`とし、この穴が存在する状態で
  clinical writeを有効化しない。

この項目は「fail-closedだから安全」と主張しない。fail-closedの結果として
client側に重複作成という危険な脱出路が残ることを、明示的に未解決とする。

immutable idempotency recordが保持する最小field setは次のとおり。

| Field | 内容 |
|---|---|
| `schemaVersion` | record schema version(fingerprint schema versionとは別field) |
| `lookupKeyVersion` | 当該aliasを作ったlookup HMAC key version |
| `requestByteFingerprint` | §4.1のHMAC-SHA-256値 |
| `logicalId` / `versionId` | 参照するimmutable VERSIONの識別子 |
| `resourceDigest` | 当該VERSION `resourceJson`のSHA-256 |
| `httpStatus` | 初回acceptedのstatus code(create=201、enabled update=200)。reason phraseは保持せず、実装は当該codeの固定phraseだけを返す |
| `responseSerializerId` / `responseSerializerVersion` | 書込時に一度だけ適用したcanonical serializerの識別子と版。監査/再現のための記録であり、replay経路では使わない |
| `responseBodyDigest` | 初回acceptedのresponse body octet列のSHA-256 |
| `responseContentType` | 常に`application/fhir+json; charset=utf-8; fhirVersion=4.0`。値はrecordへ明示保存し、後の既定変更が黙ってreplayを変えないようにする |
| `responseLocation` | createの`Location`(`{type}/{id}/_history/{versionId}`) |
| `responseETag` | `W/"{unpadded base10 versionId}"` |
| `responseLastModified` | 当該VERSIONの`meta.lastUpdated`から導出したHTTP-date |
| `replayUntil` | replay保証期限 |

replay応答のheader setは上記の`responseContentType`、`responseLocation`
(createのみ)、`responseETag`、`responseLastModified`、および§10の
`Cache-Control: no-store`に固定する。ここに列挙しないheaderをreplay応答へ
追加しない。

**`Prefer`はMVPで未対応**とする。`Prefer` headerが存在する場合は値を問わず
400 `not-supported`であり、`return=minimal`/`representation`/`OperationOutcome`の
いずれも受理しない。理由は、`Prefer`がresponse representationを変えるにも
かかわらず§4.1のfingerprint v1入力に含まれておらず、同一bytes + 異なる`Prefer`が
同一fingerprintで異なるresponseを要求する矛盾を生むためである。将来`Prefer`を
受理する場合はfingerprint schemaを新versionへ上げ、`Prefer`の正規化値を
入力へ追加する改版を要する。既存recordのreplay時にfingerprint schemaを
読み替えない。

### 4.2 Lookup-key rotation and discovery

lookup HMAC keyはactive versionと、record lifetime内の全retained versionからなる
**bounded configured set**で管理する。serverはversion numberのstable ascending
orderで全applicable versionのlookup digestを計算し、全候補をstrong readする。
新規writeは、その時点でwriterに設定された**active + retainedの全version**について、
同一clinical TWI内でimmutable alias/guard recordを1件ずつconditional Putする。
各Putは `attribute_not_exists(PK) AND attribute_not_exists(SK)` を要求し、全aliasは
同一のrequest-byte fingerprint、result tuple、referenced immutable version/digest、
replayUntilを保持する。aliasをtransaction外で追記したり、active versionだけを
作成したり、後からoverwriteして補完してはならない。alias件数は§9のtransaction
budgetへ含める。

old lookup key materialとversion discoverabilityは、そのversionで作られた最後の
recordの全lifetimeに、maximum clock skewとapproved safety windowを加えた期間以上、
KMS等のsecret storeで保持する。**本batchではretirement自体がunsupportedである**
(§4.2.1)ため、key materialは期間経過後も削除せず、retained setは単調増加のみと
する。record/docs/logへkey materialを保存しない。retained setがapproved boundを
超えるrotationは開始せずsecurity reviewへ戻す。boundを超えるためのretirementを
回避策にしない。

rotation configはmonotonic generationを持ち、rollout中のversion setはadditive
supersetでなければならない。authorityはtrusted tenant+pharmacy scopeのpersisted
strongly-consistent control item
`{generation, mandatoryVersionSetDigest, state}`で、`state=ACTIVE`だけがwrite可能。
digestはstable ascendingのversion identifier列を§4.1と同じuint32-be length-prefix
で連結したSHA-256で、set/order ambiguityを許さない。
各clinical writeはこのitemをstrong readし、local configがmandatory version setを
exactにcoverすることを確認する。欠落/余分version、digest mismatch、generation
regression、non-ACTIVEはDynamoDB write前に503。さらに同じclinical TWIへ
`ConditionCheck(generation=:g AND mandatoryVersionSetDigest=:d AND state=:ACTIVE)`
を含める。このConditionCheckも§9のaction/aggregate item budgetへ数えるため、
check後にretireされたstale/reanimated writerはcommitできない。

新version active化前にfleet compatibilityを証明する。新writerは旧versionも同じTWIへ
書くため、旧writer/新writerの同時writeは共通旧versionのconditional Putで一方だけ
がcommitする。旧writerが先にcommitした場合も、新writerの全version pre-readで
旧recordを発見してreplay/conflictへ収束する。

0 matchは未記録、1 matchは通常判定。複数versionにmatchした場合は全recordの
request-byte fingerprint、result tuple、referenced immutable version/digestが
一致するときだけ同じrecordとして扱い、1 fieldでも違えばintegrity failureで停止
する。recordをoverwrite/consolidateして回復しない。

### 4.2.1 Lookup-key retirementは本batchでunsupported(fail-closed)

retirementは次の2つを両方満たさなければ安全に成立しない。

1. **drain前のfence**: retire対象versionを含むmandatory setで書き得るwriterが
   1つも残っていないことを、persisted control itemのgeneration advanceによって
   先に強制すること。
2. **stable version-addressable residual zero**: 当該lookup versionで作られた
   idempotency alias/guard recordが残存0であることを、**version単位で
   addressableな完全manifest/index**に対して証明し、証明時点から
   key removalまでの間に新たな残存が生じ得ないこと。

(1)は§4.2のpersisted rotation fenceが既に満たしている。mandatory setから
versionを外した新generationへadvanceすれば、旧generationを持つwriterのTWIは
commit時のConditionCheckで必ず落ちる。

(2)は**証明不能ではなく、手順が未定義かつ走査コストがunbounded**である。
alias recordのkeyはDB-005 §5.2の
`PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#FHIRIDEMPOTENCY#{resourceType}` /
`SK = KEY#{hmacIdempotencyKey}`であり、resource instanceごとではなく
(tenant, pharmacy, resourceType)ごとの単一partitionに置かれる。したがって
単一PKのpaginated Queryで全件列挙でき、各aliasは`lookupKeyVersion`を保持する。
「列挙するaccess pathが存在しない」は誤りであり、以前の版のその記述は撤回する。

実際に不足しているのは次である。

- 走査コストのbound。当該partitionは全writeのaliasをretained version数だけ
  倍増させて蓄積するため、全件走査の件数・byte・時間に上限がない。
- `replayUntil`満了と残存zeroを**同時に**証明する手順。個々のaliasの
  `replayUntil`が満了していることと、走査中に新たなaliasが生じないことを
  同一の論拠で示す方法が定義されていない。
- 各段階のfailure/rollback semantics。走査途中失敗、fence advance後の
  key removal失敗、部分削除からの復旧が未定義である。

したがって本batchでは**lookup-key retirementをunsupportedと宣言する**。
結論は保守側で維持するが、その根拠は上記のとおりであり、「列挙不能」ではない。

- retained lookup-key setは**単調増加のみ**とし、versionを外すoperationを
  定義・実装・実行しない。key materialは削除しない。
- retained setがapproved boundへ接近した場合、rotationを**開始せず**
  security reviewへ返す。boundを超えるためのretirementを回避策にしない。
- retirementを可能にするには、走査のbound、`replayUntil`満了と残存zeroの
  同時証明手順、fence advance→走査→key removalの順序、および各段階の
  failure/rollback semanticsを定めたapproved amendmentを要する。それまで
  `BLOCKED_LOOKUP_KEY_RETIREMENT`とする。
- 既存§4.2のpersisted rotation fence(generation/mandatory digest/ACTIVEの
  same-TWI ConditionCheck)はretirement可否と無関係に維持する。これはstale
  writerのcommit阻止のための独立した不変条件である。

**retained setの単調増加がtransaction budgetを侵食する**。全writeはactive +
retainedの全versionについてalias 1件をconditional Putし、各aliasは§9の
100 action / 4 MiB budgetへ算入される。retained set数`N`が増えるほど、
index token数`M`が多いresourceから先にbudget超過(pre-write 422)へ到達する。
したがってapproved boundは絶対値ではなく、**100 actionsから固定action数と
最悪index delta数を差し引いた残余**として定義する。boundへの接近はrotation
開始時だけでなく**write preflight時にも監視**し、超過が予見される時点で
security reviewへ返す。retirementでN を減らす回避策は取らない。「最悪index
delta数」はper-version cap `maxIndexedTokenPartitions`(DB-005 §5.2)から導くが、
**updateのdelta setはBEFORE/AFTER両versionに跨るため
`2 * maxIndexedTokenPartitions`まで達する(round-4 undercount訂正)**。
operation別のjoint invariantは次のとおりで、DB-005 §5.2と同一定義である:
MedicationRequest create `7 + maxIndexedTokenPartitions + N <= 100`、
Patient update `7 + 2*maxIndexedTokenPartitions + N <= 100`、
Patient create(将来有効化時)`7 + maxIndexedTokenPartitions + 2N <= 100`
(patientNumber guardが全version分`N`件を占めるため。§2.1)。評価点はwrite
preflightであり、実測のdelta set・alias数・固定actionの合算で判定する。
**§7.1のJSON構造capはこのcapを含意しない**: identifier 1件が2 partitionを
生むため数量関係が成立せず、partition capの強制はpreflightの実数カウントだけが
担う。この上限がないと残余が計算不能となり、identifierの多い患者だけが後から
恒久的に書込不能になるdead-endが生じる。

**key compromise時の経路が存在しないことを明示する**。lookup HMAC keyが漏洩
しても、retirementがunsupportedである以上mandatory setから外せず、全新規write
がcompromised keyのaliasを作り続ける。本batchはこの状態を受容しており、緊急
無効化の経路を持たない。retirementとは別概念の「新規writeでは使わないが
replay検証には残す無効化」が成立するかは、上記amendmentの検討課題として
明示的に起票する。この受容は`BLOCKED_LOOKUP_KEY_RETIREMENT`の一部であり、
**同blockerはclinical writeの有効化を止める効力を持つ**。他のblockerが全て
解除されても、緊急無効化経路が承認されるまでwriteを開始しない。失効不能な鍵を
抱えたままwriteを始めると、漏洩時に回復手段が設計上存在しない状態へ不可逆に
入るためである。patientNumber guard鍵(§2.1・DB-005 §5.2)も同じ規律を共有する。
patientNumberは多くが連番の低エントロピー値なので、鍵漏洩は当該薬局で使用中の
患者番号の総当たり列挙と母集団規模・登録密度の露出に直結する。

### 4.3 Replay and ambiguous outcome precedence

write前とtransaction cancellation/ambiguous result後に、§4.2の全applicable
lookup versionsをstrong readする。

1. recordあり・request-byte fingerprint同一: referenced immutable versionと
   `resourceDigest`をstrong readで検証し、currentが後続更新されていても
   §4.1.1の手順で**original status/body/header setをwire byte-exactにreplay**する
   (create=201、enabled update=200)。`responseBodyDigest`不一致は500 `incomplete`
   であり、差異のあるbodyを返さない。
2. recordあり・request-byte fingerprint相違: 409 `conflict`。
3. recordやreferenced versionが欠落/corrupt/ambiguous: integrity failureとして
   500、依存storeの一時的不完全性なら503。write retryしない。
4. recordなし: 通常のcreate条件、またはupdateのIf-Match条件を一度だけ評価する。

transaction cancellation/ambiguous resultはbounded reconciliationとして全lookup
versions、record、referenced immutable versionをstrong readする。有効な同一bytes
recordならreplay、different fingerprintなら409、bounded reconciliation後も全version
で不存在なら503で「accepted」を主張しない。corruptまたはconflicting multiple
recordsは500/503でfail closedする。recordを上書きせず、serverは自動write retry
しない。

reconciliationの**bound**はconfigured定数で明示する: reconciliation read
attemptは1 request当たり最大3回、attempt間はfixed backoff、reconciliation全体の
wall timeは承認済みupper boundを超えない。boundに達しても確定できない場合は
503 `incomplete` + `Retry-After`を返し、blind retryもwriteも行わない。
attempt回数とwall timeの具体値は実装WPで測定して確定し、SSOTは「boundが存在し、
超過時は503でfail closedする」ことを固定する。reconciliation中に新たな
TransactWriteItemsを発行しない。

## 5. Search and pagination

### 5.1 Exact search grammar and normalization

resource別parameter allow-listは§2の表だけである。raw queryはRFC 3986として
parameter occurrenceを保持してparseし、invalid percent encoding、不正UTF-8、
raw `+`、空parameter名、空value、control characterを400 `invalid`で拒否する。
値はexactly once percent-decodeする。parameter modifier (`:`)、chaining (`.`)、
unknown parameter、`_include`、`_revinclude`、`_sort`、`_summary`、`_elements`は
400 `not-supported`であり、黙って無視しない。

| Parameter type | Accepted grammar | Canonical form |
|---|---|---|
| `identifier` token | bare `value`, `\|value`, or `system\|value`; value is nonempty; system, when present, is an absolute URI syntax | three distinct tagged forms: `ANY_SYSTEM(value)`, `NO_SYSTEM(value)`, `EXACT_SYSTEM(system,value)`; never collapse bare and empty-system forms |
| `code` token | exactly `system\|code`; both components nonempty; system/code must match the locked local terminology allow-list | exact approved `EXACT_CODE(system,code)` for MedicationRequest.medicationCodeableConcept |
| `subject` / `patient` reference | bare FHIR id `[A-Za-z0-9.-]{1,64}` or `Patient/{id}` only | `Patient/{id}`; absolute/versioned/query/fragment references are rejected |
| `_lastUpdated` date | optional prefix `eq`, `ge`, `gt`, `le`, `lt` followed by a full RFC 3339 instant `YYYY-MM-DDThh:mm:ss[.S..SSS](Z|±hh:mm)` | no prefix becomes `eq`; parse to the precision-derived UTC half-open interval `[lower, upper)` |
| `_count` | one occurrence, canonical decimal integer 1..100 | canonical base-10 decimal; default 20 |

bare identifierはsystemを問わずvalue exact match、`\|value`はsystem absentだけ、
`system\|value`はsystem/value双方exact matchである。各意味をfingerprint tagと
別index lookup/partitionで維持する。MedicationRequest profileは
medicationCodeableConceptを使うためstandard `code` tokenだけを広告する。
standard `medication` reference searchは意味を再定義せず400 `not-supported`で、
CapabilityStatementから省略する。

`_lastUpdated`はFHIR date search instantをprecision intervalとして扱う。秒精度は
`upper=lower+1 second`、小数1/2/3桁はそれぞれ`+100/+10/+1 millisecond`とし、
offsetをUTCへ変換しても元precisionのquantumを維持する。比較対象resource timestamp
を`t`として、`eq: lower <= t < upper`、`gt: t >= upper`、
`ge: t >= lower`、`lt: t < lower`、`le: t < upper`である。fingerprint canonical
alternativeはprefix、UTC lower、UTC upperのlength-prefixed tupleとし、異なるoffset
で同じintervalになる入力は同じ意味へ正規化する。

`_lastUpdated`の`ne`, `sa`, `eb`, `ap`、date-only、timezoneなし、fraction 4桁以上、
calendar/RFC 3339としてinvalidな値は400 `invalid`でrejectする。許可precisionは
秒および小数1〜3桁だけである。same parameterの反復はAND、1 occurrence内のunescaped comma-separated
valuesはORとする。空alternativeは禁止する。`subject`と`patient`は同じcanonical
reference filter slotへ統合し、各occurrenceのAND/OR構造を維持する。`_count`は
comma/反復を許さない。

検索は最低1つのresource-specific clinical filterを必須とする。空queryまたは
`_count`だけのfilterless queryは400 `required`であり、全件列挙へfallbackしない。
正規化は、各OR alternativeをcanonical化してsort/dedupeし、AND occurrenceも
sort/dedupeしたlength-prefixed structured tuple
`(resourceType, parameter, [[canonicalAlternative...]...])` とする。URL文字列連結を
fingerprintにしない。`membershipQueryFingerprint`はこのtupleだけのSHA-256で、
page sizeである`_count`は含めず、cursorへ別fieldとして拘束する。DB-005のsnapshot
META、index lookup、CapabilityStatementのsearchParam名と説明はこのgrammar/
fingerprintへexactに一致させる。

candidate setはas-of fence以下のimmutable add/remove deltaをlogicalIdごとに検証し、
latest deltaが`present=true`のversionだけへ確定してから集合演算する。1 occurrenceの
comma alternativesはunion、同じcanonical parameter slotの反復occurrenceは
intersection、異なるclinical parameterもintersectionする。`subject`/`patient`は
同一reference slotへnormalizeした後に同じoccurrence algebraを適用する。
`_lastUpdated` predicateはclinical intersectionの最終集合へintersectionする。
各段階でlogicalIdをdedupeし、最後にas-of versionの
`(lastUpdated, logicalId, versionId)`をdeterministic sortしてmanifest化する。
空集合は成功したempty searchsetであり、filterless queryの禁止とは別である。

### 5.2 Immutable snapshot pagination

`_count` は1..100、default 20。順序は常に `(lastUpdated, logicalId)` ascending。
upper watermarkだけではlater updateが未読memberをindexから消し、duplicate/skipを
防げないため採用しない。

候補設計はDB-005のimmutable index delta + immutable materialized search snapshot
である。first pageはstrong-read scope commit sequenceをas-of fenceとし、その
sequence以下のimmutable add/remove deltaからlogicalIdごとにlatest deltaを選び、
`present=true`だけをdedupeして `(lastUpdated, logicalId, versionId)` のimmutable
ordered manifestへmaterializeする。later update/deleteは新しいsequenceのdeltaを
追加するだけで、cursor expiryまではold delta/manifestを削除しない。後続pageは
manifestだけを読むためmembershipとversionがas-ofで固定される。

成功は `Bundle(type=searchset)` と `Bundle.link[relation=self]` を返し、次pageが
ある場合だけ `Bundle.link[relation=next]` を返す。**opaque next URLが継続情報の
唯一のcarrier**であり、clientはURLをverbatimでfollowする。tokenを分解、再構成、
queryと併用してはならない。

tokenは署名付きでtrusted `tenantId, pharmacyId, resourceType,
membershipQueryFingerprint, query grammar version, order, page size, snapshotId,
manifestDigest, asOfCommitSequence, expiry,
token version` に拘束する。snapshotと必要deltaはcursor expiry + maximum clock
skew + approved safety windowまで保持する。logicalIdはmanifest内でexactly once、
versionIdはas-of versionへ固定する。

expired/tampered/query-drift tokenは400 `invalid`でrestartを要求する。snapshot/
segment/digest欠落またはcorruptionは500 `incomplete`で結果を返さずfail closed。
token/raw next URLをlogしない。このsnapshot mechanism、retention cleanup、
concurrent writer/barrier testが実装されるまで
`BLOCKED_FHIR_SEARCH_SNAPSHOT_IMPLEMENTATION`でsearch routeを広告・実装しない。

### 5.3 Snapshot materializationの作業量上限(fail-closed)

`_count` 1..100はpage sizeだけを縛り、first pageが行うmanifest materialization
の作業量を縛らない。低cardinalityなfilter 1つでも、当該partitionの全delta走査と
集合演算を誘発しうる。したがってsnapshot作成を次のconfigured boundで**事前に**
拘束する。全boundはrequest開始時に確定し、実行中に緩めない。

| Bound | 対象 | 超過時 |
|---|---|---|
| `maxScannedDeltaItems` | 全token partitionから読むimmutable delta itemの累計件数 | 429 `throttled` + `Retry-After` |
| `maxCandidateLogicalIds` | 縮約後candidate setのlogicalId数(集合演算の各中間段階でも評価) | 429 `throttled` + `Retry-After` |
| `maxManifestEntries` | materializeするmanifest entry総数 | 429 `throttled` + `Retry-After` |
| `maxSnapshotSegments` | 生成するSEGMENT item数 | 429 `throttled` + `Retry-After` |
| `maxSnapshotBytes` | 全SEGMENTのoperation後item size合計 | 429 `throttled` + `Retry-After` |
| `maxMaterializationWallTime` | first pageのmaterialization経過時間 | 503 `incomplete` + `Retry-After` |
| `maxConcurrentSnapshotsPerScope` | trusted tenant+pharmacy scopeで同時に作成中のsnapshot数 | 429 `throttled` + `Retry-After` |

- boundは**推定でなく実測**で評価する。走査済みitem数、候補数、生成byte数、
  経過時間をmaterialization中にincrementalに計上し、boundへ到達した時点で
  即時中断する。「たぶん収まる」による続行を認めない。
- 中断は**partial resultを返さない**。truncated Bundle、`total`の近似、
  next linkによる継続再開のいずれも行わない。clientはfilterを狭めて
  再実行する。
- 中断時の**cleanup**: publish前のSEGMENT itemはMETA不在で不可視である
  (DB-005 §4.1)。中断したmaterializationはMETAをpublishせず、書込済みSEGMENTを
  bounded cleanup対象として登録する。cleanupは他snapshotのsegmentを削除しない。
  **cleanup可否の判定は「expiry + maximum clock skew + approved safety window
  を経過したこと」に一本化する。** 「active cursorが参照していないことを確認」
  という判定は実装不能なので用いない。cursorはclientが保持する署名付きopaque
  tokenであり、発行済みcursorを記録するitemがkey設計に存在しないため、serverは
  どのcursorが生きているかを知り得ない。cursorの生存はtoken自身のexpiryによって
  上界が決まる、という関係で保持期間を導出する。
- **cancellation**: client切断、request timeout、shutdown signalのいずれでも
  materializationを中断し、上記cleanup経路へ入る。切断後にsnapshot生成を
  継続しない。
- **retry**: 429/503はserver側の自動retryを伴わない。`Retry-After`はscope単位の
  quota回復見込みから導出し、raw internal metricを露出しない。
- `maxConcurrentSnapshotsPerScope`はtenant+pharmacy scopeのquotaであり、
  1 callerが他callerのsnapshot作成を枯渇させないことを目的とする。scope外の
  値をquota keyにしない。**単純カウンタで実装してはならない。** increment済み・
  decrement未実行のままprocessがcrash(OOM、deploy中のSIGKILL)すると、カウンタが
  上限に張り付いて当該scopeの全searchが恒久的に429になる。§5.3は429/503でserver
  側の自動retryを行わないため自己回復もせず、fail-closedを狙ったboundが可用性の
  恒久喪失へ転化する。したがって**期限付きlease item**として定義する。
  materializationごとに1 leaseを作り、`maxMaterializationWallTime` + safety margin
  で自動失効させ、同時実行数はlease生存数で数える。cleanup失敗時も時間経過で
  必ず回復する形にする。
- **bound超過が漏らす情報を正直に限定する**。エラー本文からbound名・閾値・
  実測値・候補件数を落としても、bound超過応答(status正本はAPI-001 §4 — 現行は503のみを定義し、本書は先行定義しない)が返るか否かという1 bitは残る。DB-005 §3.4の
  患者検索は候補集合フェッチが`q`に依存しないため、この1 bitは「当該薬局の
  患者数が`maxFetchedCandidateItems`を超えているか」をそのまま表す。時系列観測で
  閾値を超えた時期も判り、レイテンシも規模にほぼ線形である。§5.3の
  `maxCandidateLogicalIds`はquery依存なので、集合演算の中間段階のcardinality
  比較oracleになり得る。したがって本規律の主張は「**精度の高い**推測を防ぐ」で
  あり、「母集団規模の漏洩を防ぐ」ではない。粗い情報は残り、それは当該scopeへ
  認可された主体にのみ観測可能である。この限定を超える保証を後続設計が前提に
  しない。
- 各boundの具体値は実装WPが合成データで測定して確定し、承認を得るまで
  search routeは`BLOCKED_FHIR_SEARCH_SNAPSHOT_IMPLEMENTATION`のままとする。
  本SSOTはboundの存在、評価方法、超過時のfail-closed結果を固定する。

## 6. Exact OperationOutcome matrix

全error responseは
`Content-Type: application/fhir+json; charset=utf-8; fhirVersion=4.0`、
`resourceType: OperationOutcome`、`issue` 1件以上、severity `error`以上である。

| HTTP | Exact condition | IssueType | yrese code |
|---|---|---|---|
| 400 | missing required Idempotency-Key / If-Match / required clinical filter | `required` | absent |
| 400 | malformed header/search/cursor/token | `invalid` | absent |
| 400 | unsupported search/history parameter, modifier, chaining, `_format`, or `Prefer` | `not-supported` | absent |
| 401 | trusted AuthContextを確立できない(credential不在/malformed/期限切れ/署名不正/audience不一致)。`WWW-Authenticate`必須 | `security` | absent |
| 403 | AuthContextは確立できたがMOD-007 scope欠如。`WWW-Authenticate`を返さない | `forbidden` | `AUTH-0003` |
| 404 | unknown/foreign tenant-pharmacy resource or version, or phase-disabled route | `not-found` | absent |
| 405 | enabled target routeへのunsupported method | `not-supported` | absent |
| 409 | same key different intent、resurrection/immutable lifecycle conflict | `conflict` | absent |
| 410 | tombstone read | `deleted` | absent |
| 412 | stale If-Match | `conflict` | absent |
| 406 | no acceptable response media range | `not-supported` | absent |
| 413 | request entityがpre-capture byte capを超過(§7.1)。parse前に判定 | `too-costly` | absent |
| 415 | unsupported request Content-Type / Content-Encoding | `not-supported` | absent |
| 422 | malformed/profile/terminology validation failure、invalid UTF-8、duplicate JSON member | `invalid` | absent |
| 422 | JSON depth/member/element/node cap超過(§7.1) | `too-costly` | absent |
| 422 | intent/business/TWI/item-size validation failure | `business-rule` | absent |
| 429 | quota/rate/snapshot bound超過。`Retry-After`必須。deny経路のquota到達で返す場合は§9.2の集約intentのdurable commitまたは強整合存在確認の後に限る | `throttled` | absent |
| 500 | internal exception | `exception` | absent |
| 500 | persistent integrity/corruption failure | `incomplete` | absent |
| 503 | ambiguous/incomplete/transient dependency state、reconciliation bound超過、materialization wall time超過。`Retry-After`必須 | `incomplete` | absent |

401は下位のFHIR IssueType(`login`, `expired`, `unknown`)を使わず親の
`security`に統一する。credential不在、期限切れ、署名不正、audience不一致を
IssueTypeで区別すると、認証失敗の種別が未認証callerへ漏れるためである。
同じ理由で全401は同一のIssueTypeとheader setを返す。

`Retry-After`はdelta-secondsのみを用い、scope単位のquota回復見込みから導出する。
internal metric、queue深さ、他tenantの負荷を反映した値を露出しない。401の
`WWW-Authenticate`と429/503の`Retry-After`は該当statusで必須であり、
省略をclientのretry抑止に使わない。

yrese codeは `issue.details.coding` に
`system: urn:yrese:error-code` と登録済みcodeだけを置く。diagnostics/details/
expression/locationにはraw input、resource、logicalId、identifier、reference、
header、query、validation path/value、internal exception/stackを載せない。
現行registryでFHIR汎用codeは未登録のため、403 permission denialだけは既存
`AUTH-0003`をexactに使い、それ以外のFHIR errorは
`issue.details.coding[system=urn:yrese:error-code]`を**省略**する。PAT/RCV等の別domain
codeを流用しない。FHIR codeを必須化する実装はMOD-006登録まで停止する。

405はOperationOutcomeに加えmandatory `Allow` headerを返す。値はrequest時の
exact target、phase、product gateについて、同じatomic config
generationの**LIVE ENABLED method set**からdeterministicに導出し、
**さらにcaller scopeとのintersectionへfilterする**。以前の版はこれを
scope-independentとしていたが、CapabilityStatementは§2でcaller scopeへfilter
されるため、`patient:read`だけを持つ認証済みcallerが405を引くと、
CapabilityStatementが隠している「create/updateが今liveか」を`Allow`から読めた。
§8が未認証次元で塞いだ非開示規律をscope次元でも成立させる。callerが要求scopeを
持たないmethodは`Allow`に現れない。staticな
potential method listを使わず、blocked search/create/updateを広告しない。enabled
targetは存在するがenabled methodが0件の契約状態ではempty `Allow`を許す。
phaseでroute自体がdisabledなら404/非広告であり405にしない。metadata/
CapabilityStatementも同じgenerationを読み、405とadvertisingが異なるgenerationを
混在させない。

## 7. Content negotiation

responseはJSONだけで、常に
`Content-Type: application/fhir+json; charset=utf-8; fhirVersion=4.0`。
`Accept` absentは受理する。存在する場合は各media rangeを独立にparse/matchし、
RFC 9110のprecedence（exact `application/fhir+json` > `application/*` > `*/*`）
とqualityを適用する。選択表現に対して最もspecificな**matching** rangeの`q>0`を
要求し、そのrangeが`q=0`なら、より広いwildcardが`q>0`でもexcludedで406となる。
`application/*`と`*/*`はこの規則で受理可能である。`application/json`やFHIR XML
だけでmatching rangeがない場合も406。複数rangeのunsupported typeは、有効な
matching rangeを無効化しない。

type/subtype、parameter名、charset名/valueはcase-insensitiveにparseする。
`fhirVersion=4.0`と`charset=utf-8`だけを許し、`fhirVersion`の重複または4.0以外、
unknown parameterを含むrangeは、exact/wildcardを問わず**そのrangeだけ**
nonmatchingとするため、別のvalid rangeはfallbackできる。supported parameterを
持つwildcard rangeはselected representation
`application/fhir+json;charset=utf-8;fhirVersion=4.0`へ照合し、
`application/*;charset=UTF-8`もmatching rangeになり得る。parameter数の多い
matching rangeは同じtype/subtype specificity内でよりspecificであり、そのrangeの
qを選択表現へ適用する。たとえばparameter-specific rangeがq=0なら、
parameter-less rangeまたはより広いwildcardがq>0でもfallbackせず除外する。
quality parameterはmedia
parameter評価後のAccept weightとして扱う。quoted-stringはRFC 9110に従って
unquoteした後の値を比較し、`"4.0"`は4.0、`"4.0.1"`等はunsupportedとする。

`_format`はMVPで未対応であり、値を問わず400 +
OperationOutcome(`not-supported`)。`Accept`をoverrideしない。

POST/PUTは`Content-Type: application/fhir+json`必須。type/subtype、parameter名、
charset名/valueはcase-insensitiveにparseし、`charset=utf-8`と
`fhirVersion=4.0`だけを各最大1回
許す。parameter自体は省略可能である。4.0以外の`fhirVersion`、missing/wrong
media type、FHIR XML、`application/json`、unknown/duplicate parameterは415。
quoted-string parameterはunquote後のexact valueで同じ判定を行う。
`Content-Encoding`はabsentまたは`identity`だけを許し、gzip等は415。
GET/metadataはrequest bodyを受理しない。未対応の`_format`は上記どおりAcceptを
overrideせず400である。

### 7.1 Request parse boundary(pre-capture cap優先)

§4.1のrequest-byte fingerprintはparse前のoctet列を入力にするが、capture自体を
無制限に行ってはならない。判定順序を次に固定する。**前段でrejectしたrequestは
後段の処理へ進まず、fingerprint計算もbyte captureも行わない。**

**§8との合成順序**: §8はrequest全体を「認証 → route-family粗認可 →
route/method解決 → interaction別scope認可 → phase/enablement判定 → 存在」に
固定する。本節のparse順序は
その中でbodyを扱う段に属するが、**pre-capture capだけは認証完了前でも上限として
作用する**。すなわち、未認証requestに対して巨大bodyを受信し続けない一方、
413/415をcapの結果として返さず、**未認証には§8のとおり単一の401だけを返して
bodyを捨てる**。認証済み・粗認可通過後に初めて413/415を返す。以前の版は両順序の
相対関係を定めておらず、framework既定のまま413/415が認証より前に返ると§8の
非開示規律に穴が開いた。

1. **Content-Length / 受信byte数のpre-capture cap**: `maxRequestEntityBytes`
   (configured定数)を超える、またはContent-Length不在でstreaming受信中にcapを
   超えた時点で受信を打ち切り、**captureせずに**413 `too-costly`を返す。cap判定は
   §9のitem-size preflightより前段であり、両者を混同しない。cap値はDynamoDB
   400 KB item上限より小さい安全側の値を実装WPで確定する。
2. **Content-Encoding**: absentまたは`identity`以外は415(§7)。decompressionを
   行わないため、圧縮爆弾によるcap回避経路を持たない。
3. **Content-Type**: §7の判定で415。
4. **byte capture**: ここで初めて§4.1のaccepted request-entity bytesを確定する。
5. **UTF-8検証**: 不正UTF-8 sequence、overlong encoding、surrogate単独、
   BOM混入は422 `invalid`。lossy replacement characterへ置換して続行しない。
6. **JSON構造cap**: `maxJsonDepth`、`maxJsonMembersPerObject`、
   `maxJsonArrayElements`、`maxJsonTotalNodes`をparse中にincrementalに評価し、
   超過は422 `too-costly`。parse完了後に評価しない。
7. **duplicate member**: 同一JSON objectに重複keyがある場合は422 `invalid`で
   rejectする。last-wins、first-wins、silent mergeのいずれも採らない。重複keyの
   解釈差はfingerprint同一で意味が異なるrequestを生むため許容しない。
8. **profile/terminology validation**: ここまで通過した後に実施し、失敗は
   422 `invalid`(§6)。

各capの超過はcap名、閾値、実測値をresponseへ載せない(§6の非露出規律)。cap値は
実装WPで測定確定し、SSOTはcapの存在、評価順序、fail-closed結果を固定する。

**cursor restart**: search/history cursorが400 `invalid`で拒否された場合、
clientはcursorなしのrequestから再開する。serverはcursorを部分的に補正、
再署名、近似復元しない。restartで得られるsnapshotは新しいas-of fenceを持つため、
以前のpage membershipとの連続性を主張しない。

## 8. Permission and non-disclosure

権限はMOD-007の既存scopeをexactに再利用する。

| Resource | Interaction | Required scope |
|---|---|---|
| Patient | read/vread/history/search | `patient:read` |
| Patient | post-cutover update | `patient:write` |
| Patient | create | **なし。§2.1によりinitially disabled(post-cutover 405 / pre-cutover 404)。scope保持だけでは有効化されない** |
| MedicationRequest | read/vread/history/search | `prescription:read` |
| MedicationRequest | initial create | `prescription:write` |

**401と403を別意味として区別する**。credentialが不在、malformed、期限切れ、
署名検証失敗、audience不一致等でtrusted AuthContextを確立できない場合は
**401 `security`** とし、RFC 9110に従い`WWW-Authenticate`を必須で返す。値は
登録済みscheme名とrealmだけを含み、trusted AuthContextを確立できなかった理由、
raw token、claim、内部診断を載せない。AuthContextは確立できたがMOD-007 scopeを
欠く場合は**403 `forbidden` + `AUTH-0003`**とし、`WWW-Authenticate`を返さない。
どちらもresourceの存在有無を反映しない。

**判定順序はrequest全体で「認証 → route-family粗認可 → route/method解決 →
interaction別scope認可 → phase/enablement判定 → 存在」に固定する。**認可を1段と
しないのは、本節のscope表がrequired scopeを`Resource × Interaction`の組で定めて
おり、どのscopeを要求するかがroute/methodを解決しなければ決まらないためである。
phase/enablement判定をscope認可の後に置く理由は本節末尾(phase membershipの
非開示)に記す。以前の版は
「認証 → 認可 → route/method解決 → 存在」と書いていたが、これは文字どおりには
実装できず、順序を守ろうとする実装がroute非依存の粗い認可へ退行してper-interaction
認可を弱める誘因になっていた。粗認可は`/metadata`と同じ判定、すなわち
MOD-007の`patient:read` / `patient:write` / `prescription:read` /
`prescription:write`のいずれか1つ以上の保持だけを見る。**未認証および粗認可
失敗の応答は、route/methodの有無を一切反映しない。**
以前の版は「同一routeでは認証→認可→存在」としか書かず、405のmethod解決と
phase-disabled routeの404判定が認証より前か後かを定めていなかった。frameworkの
routerは通常、認証hookより前にmethod not allowed / not foundを決める。その実装
では未認証callerが`DELETE /fhir/R4/Patient/x`、`POST /fhir/R4/Patient`、
`GET /fhir/R4/MedicationRequest?...`を順に叩き、401 / 404 / 405 + `Allow`の
返り分けを観測できる。`Allow`は§6のとおりLIVE ENABLED method setそのものなので、
**どのresourceのどのinteractionが現在有効かが未認証で判る**。これは
CapabilityStatementを認証 + caller scopeのintersectionへfilterして隠した情報と
同一であり、非開示規律の迂回である。writeが有効化された時期を外部から観測できる
ことは攻撃タイミングの選定に直結する。したがって未認証callerには、routeの有無も
methodの有無も反映しない単一の401を返し、`Allow`を付けない。

**phase membershipもinteraction scopeで守る(round-3 MEDIUM訂正)**。判定順序を
「認証 → route-family粗認可 → route/method解決 → interaction別scope認可 →
phase/enablement判定 → 存在」へ固定し、**phase依存の応答(pre-cutover 404 /
post-cutover 405等)はinteraction別scope認可を通過したcallerにだけ観測可能**と
する。以前の順序はroute/method解決の時点でphase-disabled 404を確定させていた
ため、粗認可だけを通過した(当該resourceのscopeを持たない)callerが
`POST /fhir/R4/Patient`や`PUT /fhir/R4/Patient/{id}`への403/404/405の別から
cutover phaseの進行を観測できた。write有効化時期の外部観測は、本節と§6が
CapabilityStatementと`Allow`のfilterで閉じた非開示規律の迂回である。したがって
当該interactionのrequired scope(§2.1のcreateのように「有効化scopeなし」の
interactionは、同一resourceのwrite系scope `patient:write`を観測資格として扱う)
を欠くcallerには、phaseにかかわらず一律403 `forbidden` + `AUTH-0003`を返す。
phase判定はscope認可の後にのみ行う。

この401/403分離はAPI-001既存routeのwire behaviorを変更せず、`/fhir/R4/*`にだけ
適用する。ただし現行の認可は`requirePermission` / tenantContext pluginという
**共有実装**であり、route prefixによる分岐は存在しない。共有middlewareを401対応へ
改修すると副作用でAPI-001も401を返し始め、SEC-006の既存回帰(コンテキスト不在は
403かつrepository呼び出し0回)が破れる。逆に分岐を入れ忘れると`/fhir/R4/*`が403の
ままとなり`WWW-Authenticate`必須を満たさない。したがってSEC-006へ
「401/403の別はroute familyごとに定義され、既存API-001 familyは403一本を維持する」
ことを明記するPRC-007 amendmentを、本契約のfinalizationと**atomicに**扱う。
実装では401/403の選択をroute familyの型/設定から導出し、middleware内の暗黙分岐に
しない。それまで`BLOCKED_AUTH_RESPONSE_FAMILY_ALIGNMENT`とする。

direct lookupのforeign scopeは404で
存在を漏らさない。searchはpermission適用後の集合を返し、foreign dataはempty
として見えない。tenantId、pharmacyId、actor/principal/client identity、role、
permission scopesはtrusted AuthContextだけから導出し、path、query、body、
FHIR `meta.security`/extensionをauthorityにしない。

**全FHIR responseに`Cache-Control: no-store`を付ける**。成功、error、
OperationOutcome、`/metadata`、405、404、空searchsetを含め例外を作らない。PHIを
含むかどうかで分岐させない。分岐はPHI判定の誤りが即座にcache漏洩になるため
採用しない。caller依存でbodyが変わるresponseには`Vary: Authorization`も併せて
付ける。intermediary cacheを前提にした`private`、`max-age`、`ETag`ベースの
再検証によるbody省略を、`no-store`の代替にしない。`ETag`はoptimistic
concurrencyのためだけに用いる。

`no-store`は**応答送出の単一choke pointで付与する**。route handler側での付与に
すると、handlerへ到達しない応答(§7.1の413、router段階の405/404)で漏れる。
`Vary`については、`no-store`が無条件である以上これを正しさの根拠にしない。
`Vary: Authorization`はcaller依存responseへの補助的付与であり、認証ヘッダ名を
本契約へhard-codeしない。認証がcookieやmTLSへ変わった場合も`no-store`が権威で
あることは変わらない。

Referenceは同一trusted tenant+pharmacy内のlocal relative referenceだけを許可する。
absolute/external URLはrejectし、network fetchしない。malformed/foreign referenceを
OperationOutcomeやlogへechoしない。

request由来のURI/canonical-like値は全て同じno-network境界に置く。対象には
`meta.profile`、`Coding.system`、`identifier.system`、extension URL/valueCanonical、
canonical/reference URI等を含む。URI文字列をidentifierとして保持すること自体は
禁止せず、locked local package/terminology/extension allow-listに対してsyntaxと
semantic membershipを検証する。ただしrequest由来値をHTTP client、DNS、
redirect resolver、package downloaderへ渡さずdereferenceしない。loopback、
private/link-local、IPv4/IPv6、encoded/decimal IP、protocol-relative URL、
redirect chain、DNS rebindingを含めnetwork resolutionは常に0。

validator/resolverはpinned local FHIR/JP Core packageとapproved local terminology
artifactだけを参照する。planned negative testsは各URI fieldと上記host表現、
redirect/rebinding stubを投入し、outbound HTTP/DNS/package-fetch call=0、
allow-list外semantic=422 OperationOutcome、raw URI非echoを証明する。

## 9. Transaction budget, audit, durability and Provenance

clinical writeはTWI構築前に、**resource authority control ConditionCheck**(§9.1)、
rotation control ConditionCheck、current、
immutable version、active+retained全
idempotency alias/guard、immutable history-order item、全search index delta、
fence CAS、registered audit/outbox intent、その他固定itemを含む
**全TransactWriteItems action target**を列挙する。actionは
distinct item最大100件で、同一itemを複数actionのtargetにしない。AWS 4 MiB limitは
expression/request JSON bytesではなく、transaction内の全distinct itemについて
DynamoDB item-size ruleで計算した**operation後item sizeのaggregate**である。
Putはnew item、Updateは更新後item、Delete/ConditionCheckは既存itemのsizeを
pre-read/既知schemaから保守的に算入し、exact sizeを証明できなければwriteしない。
alias/guardとrotation ConditionCheckも各1 action/itemとして数える。100 actions/
4 MiB以下だけを許し、101 actionsまたは4 MiB超はTransactWriteItems callを0回のまま
422 OperationOutcome(`business-rule`, yrese coding absent)とする。transactionを
chunking、部分commit、非同期補完して上限を回避してはならない。SDK request
serialization sizeのconservative internal guardを追加してもよいが、AWS 4 MiB
authorityと混同しない。

全search index deltaはvalidated BEFORE resource versionとaccepted AFTER resource
versionから、API-008 §5.1の**distinct canonical partition set**をそれぞれ先に
計算してからTWI actionを列挙する。重複Identifier/Coding/tokenはpartition単位で
dedupeする。同値identifierが複数systemにある場合、`ANY_SYSTEM(value)`は1 partition
へcollapseし、各`EXACT_SYSTEM(system,value)`は別partitionを維持する。すべての
multi-valued indexed tokenを対象とする。AFTERの各partitionにはNEW
`metaVersionId`の`present=true`をexactly once（BEFOREにも存在するretained tokenを
含む）、`BEFORE \ AFTER`の各partitionにはNEW `metaVersionId`の`present=false`を
exactly once作る。retained tokenへfalseを作らない。delta identityとaction target
はuniqueで、同じitemを複数actionにしない。このdedupe後のdelta setを100-action/
4-MiB preflightへ入力する。

FHIR resourceを含む各DynamoDB itemはoperation後400 KB以下をpreflightする。
validated resource/itemが400 KBを超える場合も422、
TransactWriteItems/S3 write call=0とする。
本bounded clinical authorityはS3 pointer/offloadやcross-service fallbackを持たず、
400 KB/4 MiB超過を部分保存または2xxにしない。

clinical write successはrotation fence、current、immutable version、
history-order item、全同期search index、immutable scoped idempotency alias/guard
set、registered internal audit/outbox **intent**を同一transactionで
commitした場合だけ返す。どれかの失敗は全体abort。outbox intentはaudit factでは
なく、2xxはdurable commitだけを意味する。登録済みinternal audit eventへ
exactly-onceに収束するまでreconciliationする。

本書はevent名を発明しない。MOD-008にread/search/create/update/deny/failureの
mappingが登録されるまで `BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT` として全clinical
route実装を停止する。audit semantics変更が必要ならSEC SSOTも別PRC-007 amendment
とする。client supplied Provenance POST/PUTは拒否し、Provenanceはcommitted internal
auditだけから生成する。

### 9.1 Resource authority stateとepochへのTWI束縛

§4.2のrotation controlはlookup-key設定だけを束縛し、**当該resourceの書込権威が
今どのstoreにあるか**を束縛しない。この状態を束縛しないTWIは、cutover進行中や
巻き戻し直後にPostgreSQL側とFHIR側の双方がcommitし得るため、single-writer
不変条件を保証できない。

trusted tenant+pharmacy scopeに、resourceTypeごとのpersisted
**authority control item**を置く。DB-005 §11の
`POSTGRES_PRIMARY → SHADOWING → CUTOVER_PENDING → FHIR_PRIMARY`
state machineの永続表現であり、格納keyはDB-005 §5.1を正本とする。

保持するfieldは最低次のとおり。

| Field | 内容 |
|---|---|
| `authorityState` | 下記の値集合のいずれか。**単調前進ではない**(rollbackで後退しうる) |
| `authorityEpoch` | monotonic uint64。**単調増加は`authorityEpoch`だけの性質**であり、state遷移・rollbackを含む全変更で必ず増加する |
| `writerFenceToken` | 当該epochで書込を許可されたwriterへ**発行**された識別子。epochと同時にのみ変わる |

**`authorityState`の単調前進主張は撤回する。** DB-005 §11はcutoverのrollback
(PostgreSQL再有効化)を明示的に想定しているのに、以前の版はrollback後の状態を
表す値を持たなかった。その結果stateは`FHIR_PRIMARY`のまま残り、writer前提を
「stateが`FHIR_PRIMARY`であること」とした判定では、**rollback後に新しく起動した
FHIR writerが前提もConditionCheckも通過**した。epoch fenceが止められるのは
既にtokenを持っているstale writerだけで、fresh writerは止まらない。値集合に
`POSTGRES_PRIMARY_ROLLED_BACK`を加え、rollbackはこの値へ遷移させる。単調性は
epochだけが持つ。

- **全clinical write**は、TWI発行前にこのitemを`ConsistentRead=true`で読む。
- writer前提の判定は「stateが期待値であること」では**不十分**である。writerは
  自分の`writerFenceToken`を**control itemからではなく、起動時configuration
  または発行されたleaseから**保持し、読み取った`writerFenceToken`が
  **自己保持値と一致すること**を要求する。一致しない場合はDynamoDB write前に503
  `incomplete` + `Retry-After`とし、書込を試行しない。
  **ただしこの自己保持は現設計では構造的に強制できない**。tokenはcontrol itemの
  平文attributeで全writerが読めるため、control itemから読んだ値を自己保持値と
  称する実装をDynamoDB層では区別できない。これは§9.1がPostgreSQL側で退けたのと
  同じapplication自己抑制であり、発行主体・配布経路・epoch更新時の再配布・lease
  失効規律も未定義である。DB-005 §5.1の2案(writerが自称できない属性への拘束、
  またはCSPRNG由来tokenと発行経路のSSOT固定)のいずれかが承認されるまで、
  本fenceだけでfresh writer排除が成立するとは主張せず
  `BLOCKED_WRITER_FENCE_TOKEN_ISSUANCE`とする。
- さらに**同一TWI内**へ
  `ConditionCheck(authorityState = :s AND authorityEpoch = :e AND writerFenceToken = :w)`
  を含める。`:w`は自己保持値である。このConditionCheckは§9のdistinct action
  target数とoperation-after aggregate item sizeへ算入する。
- 読取後・commit前にepochが進んだwriterは、このConditionCheckで必ずabortする。
  abortは§4.3のambiguous outcome経路で扱い、自動write retryしない。

**PostgreSQL writerのfence primitiveが不在であることを、解消済みと主張しない。**
DynamoDBのConditionCheckはDynamoDB側writer同士しか拘束しない。以前の版は安全性を
「drain → fence → epoch advance → 新writer」という時間順序だけに預けたが、その
順序を強制する機構をどこにも定義していなかった。「PostgreSQL側writerを停止する」は
**applicationの自己抑制**であり、停止信号を受け取っていないinstanceは`patients`
への書込権限を保持したままである。「in-flight件数が0」は観測時点の性質でしかなく、
観測直後に開始されるtransactionを排除できない。したがって次を要求する。

1. 停止を**構造的に不可能**にするprimitiveを用意する。PostgreSQL側の書込権限を
   revokeする、roleをread-onlyへ切り替える、またはauthority epochを参照するDB側
   fenceを置く。いずれを採るかをapproved amendmentで確定し、SSOTへ固定する。
   applicationの自己抑制をこのprimitiveの代替にしない。
2. cutover後も一定期間、`patients`への書込発生を検出する片方向detectorを置く。
   検出時は`AUTHORITY_SPLIT_DETECTED`としてfail-closedで停止する。cutover後の
   継続的な乖離検出経路がない状態でcutoverしない。

この2点が承認・実装されるまで`BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE`とし、
Patient cutoverを実行しない。順序記述はDB-005 §11の4段(停止 → drain確認 → epoch
advance/fence → 新writer開始)を正本とし、本節はそれを要約する際もstep 1を
省略しない。PostgreSQL側の再有効化も同じ4段でepochをさらにadvanceして行い、
旧FHIR writerをfenceする。

**cross-store atomicityを主張しない**: PostgreSQLのtransactionとDynamoDBの
TransactWriteItemsは同一のatomic unitではない。両者に跨る「同時にcommitされる」
「片方の失敗で他方がrollbackされる」という設計・記述・実装を禁止する。
cutoverの安全性はatomicityではなく、**時間的に重ならない単一writerの交代**
(drain → fence → epoch advance → 新writer開始)によってのみ担保する。
2 phase commit、XA、best-effort補償によるcross-store atomicity主張は
`SSOT_UPDATE_REQUIRED`とする。

### 9.2 Durable audit semanticsとintent→fact convergence

§9のTWIがcommitするのはaudit/outbox **intent**であって、audit **fact**では
ない。2xxはintentのdurable commitだけを意味する。PHI read/search/denyを含む
全auditable operationについて、intentがfactへ収束する規律を次に固定する。

- **stable event identity**: 各auditable operationは、retry・reconciliation・
  worker再起動を跨いで不変な`eventId`を1つ持つ。`eventId`はrequest処理の
  最初に一度だけ生成し、全attemptで再利用する。attemptごとの再生成を禁止する
  (DB-005 §6.1と同一規律)。
- **intent fingerprint**: intentの同一性は、trusted scope + intent fieldから
  導出するversioned fingerprintで判定する。chain位置(prevHash / sequenceNumber /
  entryHash)とadapter内部attempt counterは入力から除外する。
- **intentはfactを再構成できなければならない**: intentが保持するのは
  `eventId`とfingerprintだけではない。audit eventを構成するのに必要な全入力
  (action、対象resourceType、target ID、actor、結果、時刻)を、**暗号化した
  payload**として同一item内に保持する(本batchはinline保持のみ。外部store参照は
  書込順序・digest検証・失敗時semantics・budget算入が未定義のため
  `BLOCKED_AUDIT_PAYLOAD_EXTERNAL_STORE`。DB-005 §6.4が正本)。
  fingerprintはhashなのでpayloadを復元できない。この保持がないと、DLQへ落ちた
  intentから残るのは「`eventId` Xが収束していない」という事実だけになり、
  **PHIは既にclientへ返っているのに、何が誰へ開示されたかを再構成できない**。
  漏えい報告や開示記録の要求に応えられなくなる。DLQ itemも同じpayload参照を
  保持し、DLQ滞留からfactを後追い再構成できることをacceptanceに含める。
  PHI生値の禁止は「暗号化して保持」で満たす。
- **idempotent delivery**: outbox workerは同じ`eventId`のintentを何度配送しても
  audit chainへの追記が高々1件であることを、DB-005 §6.1のdedupe item
  (`attribute_not_exists`)で保証する。at-least-once配送 + dedupeであり、
  exactly-once配送を主張しない。収束先がexactly-onceである。
- **消込はdedupe実在を機械強制する**: intentの消込は無条件Updateにしない。
  `TransactWriteItems(ConditionCheck(対応するdedupe itemが存在) +
  Delete(PENDING# item) + Put(DONE# item) with attribute_not_exists)`とする
  (key設計はDB-005 §6.4が正本)。
  無条件な消込は、誤って一度実行しただけでその`eventId`を未収束集合から
  永久に除外し、**監査欠落をsilentにする**。reconciliationは未収束集合しか
  見ないため、これが唯一の収束検出器を無効化する。
- **retry / DLQ**: 配送失敗はbounded attemptとbackoffで再試行し、上限到達後は
  DLQへ退避する。DLQ item自体もDB-005 §6.4の**monotonic single-transition
  規律**に従い(「append-only」とは呼ばない — DB-005 §12 はこの呼称を実装禁止と
  する。DLQ itemは収束確認後のpayload削除という単一遷移を持つ)、TTL/物理削除を
  持たない。
  DLQ滞留はfail-closedのalert対象であり、自動破棄しない。
- **reconciliation**: commit済みintentのうちaudit factへ収束していないものを
  検出するreconciliation経路を必須とする。検出は`eventId`単位で、
  intent集合とdedupe集合の差分として定義する。差分が解消しない間は当該
  scopeを`AUDIT_CONVERGENCE_PENDING`として記録する。
- **failure behavior**: PHI readのようにTWIを伴わないoperationでは、audit
  intentのdurable commitが**response送出より前**に完了しなければならない。
  intent commitに失敗した場合、**当該operationのresponseを返さず**500とする。
  「読めたが監査できなかった」を成功として返さない。
  条件を「**PHIを含む**response」に限定してはならない。denyのresponse
  (401/403/404)は定義上PHIを含まないため、その限定は**deny監査の欠落を許容**
  する。cross-tenant/cross-pharmacyのlogicalIdを総当たりする試行に対し、監査
  ストアが劣化している間も404/403は返り続け、deny監査だけが残らない。intentが
  commitされていないのでreconciliationの差分にも現れず、**欠落自体が不可視**に
  なる。したがって条件は「auditable operationのresponse」であり、
  成功・deny・failure・**空searchset**を区別しない。空searchsetは§8のとおり
  cross-pharmacy探索の結果として返るが、PHIを含まずdenyでもないため、
  「PHIまたはdeny」という列挙では漏れる。列挙ではなくoperationの性質で判定する。
- **deny経路のquotaは集約記録へ縮退する**: durable-commit条件をauditable
  operationへ拡大した結果、403/404も応答前にoutbox writeを要求する。認証済み
  callerがcross-scopeのlogicalIdを総当たりすると1 probe = 1件の恒久itemとなり、
  監査を強化した規律が可用性攻撃面へ転化する。したがってdeny経路のintent生成に
  **principal単位のquota**を課す。ただし**quota到達を「記録せずに打ち切る」形に
  してはならない**。それは攻撃者が到達条件を制御できる例外を作り、quotaを故意に
  焼き切った窓の中で行われた総当たりが1件も監査に残らない — 本節が閉じた
  「欠落自体が不可視」がそのまま再現する。
  quota到達後は個々のdenyのintentに代えて、**(principal, scope, 時間窓)あたり
  1件の集約intent**をdurable commitしてから429を返す。集約intentの`eventId`は
  `(principal, trusted scope, windowStart)`から決定的に導出し、窓あたり1回だけ
  conditional Putする(round-4訂正: 以後の同一窓denyはintentを書かず、当該
  intentの`PENDING#`/`DONE#`存在を強整合で確認してから429を返す。**試行回数は
  保持しない** — 既存itemのUpdateを含意しimmutabilityに反するため撤回。配送は
  窓の閉鎖 + clock skew後に行い、通常の消込lifecycleへ適合させる。格納面の
  正本はDB-005 §6.4)。集約intentは窓境界とquota値を持ち、個々のtarget IDは
  持たない。集約intentのcommitにも存在確認にも失敗した場合は429を返さず500と
  する(**無記録の窓を作らない**)。quotaはscope単位を単独の遮断条件にしない。
  集約粒度をこれより粗くしてよいかはSEC-007/SEC-008の判断事項だが、**「最低1件は
  必ず残る」という下限は本契約で固定し委譲しない**。集約deny eventの種別・
  payload schemaはMOD-008への登録対象であり
  `BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT`の範囲に含める(登録前にdeny quota
  経路を有効化しない)。429は§6のとおり`Retry-After`必須である。
- **phase-disabled routeへの404はauditable operationに当たる**。認証済みcallerに
  対するdenyだからである。未認証callerには§8の判定順序によりroute/methodを
  反映しない単一の401だけが返り、route解決に到達しないため本規律の対象外である。
- **未認証の試行**: trusted AuthContextを確立できない401はtenant+pharmacyの
  chain scopeを構成できないため、audit chainへ載せられない。その記録先
  (tenant非依存の別系統security log、あるいは別chain)はSEC-007/SEC-008の管轄
  として必須事項に起票し、本契約で発明しない。それまで未認証試行の記録は本契約の
  audit convergence保証の対象外であることを明示する。
- **intent commit成功後にresponse送出が失敗した場合**: 実際には開示されて
  いないPHIについて「readした」というintentが残る。方向としてはfail-safe
  (過剰記録)だが、監査は記録の真正性が問われるため意図的な選択として固定する。
  **intentは開示の「試行」を表し、送出成功を主張しない**。送出成功を別のfactへ
  収束させる設計は本batchで採らない。この意味づけはaudit event registryへの
  登録時にも維持する。
- **read/search/deny auditの前提**: 上記semanticsを満たすためには、MOD-008に
  read/search/create/update/deny/failureのmappingが登録されている必要がある。
  未登録の現在は`BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT`により当該route自体を
  実装しない。registry未登録のままPHI readを有効化することは、この節の
  failure behaviorを満たせないため二重に禁止される。
- 本節はaudit event名、payload schema、retention、export、physical WORMを
  定義しない。それらはSEC-007/SEC-008とMOD-008の管轄であり、本契約から
  先取りしない。

## 10. Logging and retention

FHIR resource/body、path/logicalId、identifier、search value、Reference、
Authorization、Idempotency-Key、If-Match、query、cursor/next URL、validation
location/expressionはPHI/secret候補としてaccess log、APM、trace、exception、
metric labelからallowlist方式でdrop/redactする。未知fieldは記録しない。raw payload
をidempotency recordへ保存せずdigestとimmutable version referenceだけを持つ。

## 11. Planned contract-test obligations

次はimplementation WPで作成すべきtest obligationsであり、現時点の
`related_tests`やPASS evidenceではない。test file pathは実装時に正式登録する。

- phase/resource/permissionごとのrouteとfiltered CapabilityStatementの双方向一致。
  metadata missing auth/scope=403、scope別filter、disabled route非広告。
- Accept exact/multiple/specific q=0/wildcard precedence、FHIR
  `fhirVersion=4.0`/unsupported version、`_format`、request Content-Type
  parameter、Content-Encodingの406/415/400 matrix。`Application/FHIR+JSON`,
  `charset=UTF-8`、quoted valid value、unknown exact parameter + valid wildcard
  fallback、`application/*;charset=UTF-8`、parameter-specific q=0と
  less-specific q>0、unsupported parameter付きwildcard + valid fallbackを含む。
- create/updateごとにbarrierを置いたparallel same-key/same-bytes、
  same-key/different-bytes、transaction cancellation、response loss、ambiguous
  result。各barrier後のpersistent cardinalityは最大
  current=1/new immutable version=1/canonical outcome set=1/
  各configured lookup versionのalias=1/audit-outbox intent set=1で、
  same bytesはexact replay、different bytesは409、absent reconciliationは503。
- active/retained lookup-key versionのrotation、old-key replay、全version alias
  conditional Put、複数一致同値、複数一致conflict/corrupt、retirement refusal。
  old-active/new-active writerのconcurrentおよびsequential barrierでaccepted
  canonical outcome setが最大1であることを証明する。secret値はfixture/logへ出さない。
- persisted rotation fenceをgeneration G3へadvance(mandatory setはadditive
  supersetのまま。**retirementではない**)した後、stale G1 writerをreviveし、
  sequential same-key G1/G3を実行する。stale DynamoDB writes=0、canonical
  outcome set=1、control ConditionCheck action/budget算入を証明する。「retire」の
  語はretained setからの除去だけを指し、active versionの交代は`deactivate` /
  `generation advance`と呼び分ける。本testは後者のみを対象とする。
- §5.1のparameter別grammar、repeat AND/comma OR、normalization、
  `_lastUpdated` prefix/precision、reference forms、empty/filterless、
  modifiers/chaining rejectとmembershipQueryFingerprintのgolden vectors。
  identifier 3形式の非同値partition、`code`、unsupported `medication`、OR、
  repeated AND、cross-param AND、subject/patient alias、date combination、empty setを
  fixture化する。秒/小数1〜3桁、timezone equivalence、lower/upper exact boundary、
  mixed `_lastUpdated` filters、timezone欠如/invalid precisionを含む。
- **注**: 以下のBEFORE/AFTER delta fixtureのうちtoken remove(`B \ A ≠ ∅`)は、
  Patient `identifier`が§2.2で不変・MedicationRequest PUTが405である現行phaseでは
  **有効なwire interactionから到達できない**。storage-layerへの直接注入で
  fixtureを構成すること。wire経由で到達可能と読み替えない。
- create/updateのBEFORE/AFTER distinct canonical partition fixtureとして、
  retained-token update、duplicate token、同じvalueの複数system、token add/remove、
  multi-valued全要素、dedupe後action-budget境界を検証する。retained partitionは
  NEW versionのtrueが1件/false 0件、removed partitionはfalse 1件、同一delta
  targetへの複数action 0件を要求する。
- URI/canonical fieldごとのloopback/private/link-local/IPv6/encoded/
  protocol-relative/redirect/DNS rebinding negative testでoutbound call=0。
- full TWI preflightのexact 100/101 distinct action targets、AWS item-size ruleで
  operation後aggregate 4 MiB直下/超過、single item 400 KB直下/超過。limit超過時は
  TransactWriteItems/S3 write call=0で、chunking/partial commit/
  cross-service fallbackがない。
- history first/next page、descending timestamp/version tie、watermark後update、
  cursor drift/expiry、foreign/never-existing、missing/corrupt version、
  unsupported parameter、full Bundle entry metadataを検証する。各entryの
  absolute unversioned `fullUrl`が全versionで同一、history URLでないこと、
  `resource.meta.versionId`だけが異なることを固定する。Patient cutover baselineは
  VERSION 1/create/201 + internal `SYSTEM_CUTOVER`で、PostgreSQL historyが0件
  backfillされることを証明する。
- immutable index delta/as-of snapshotで、page間のcreate/update/remove、
  same timestamp、logicalId tie、expiry、segment欠落、digest corruptionを注入し、
  manifest内logicalId exactly-onceとas-of version固定を証明する。
- same tenant/cross-pharmacyでread/vread/history=404、search=empty、Reference/
  cursor=reject、foreign pharmacy repository/network call=0を証明する。
- OperationOutcomeのstatus + exact IssueType + `AUTH-0003`またはcoding absence、
  405 target別mandatory Allow、PHI/raw path/query/header/body非露出を検証する。
  mixed gateでLIVE ENABLED methodだけをAllow/CapabilityStatement双方へ同一config
  generationから反映し、blocked search/create/updateを広告しない。Patient update
  とMedicationRequest createでIdempotency-Key missing=400 `required`/yrese coding
  absent、same bytes replay、different bytes=409、ambiguous reconciliationを検証し、
  **Patient POSTは§2.1により405**、MedicationRequest PUTは405のままとする。
- ARC-008 §3.1 producer属性の各項目が未充足の状態で、Patient PUTと
  MedicationRequest POSTがCapabilityStatementにも405 `Allow`にも現れず、
  routeが実際に無効であることを検証する。1項目でも充足を偽装した設定で
  有効化されないことを固定する。
- §2.1 Patient create disabled: **post-cutover phaseでは**`POST /fhir/R4/Patient`
  が405 + `not-supported`、**pre-cutover phaseでは404かつ非広告**(§2の
  phase matrixによりPatient authority API全体がphase-disabledのため)。
  「全phaseで405」としない。405はtargetが存在してmethodだけが違うことを意味し、
  cutover前に非広告であるべきroute の存在を開示するためである。いずれのphaseでも
  CapabilityStatement非広告、DynamoDB write=0。cutover baseline VERSION 1が
  このrouteを経由せずDB-005 §11のcutover transactionだけから生じることを固定する。
- §2.2 Patient identity不変性: post-cutover PUTが`identifier`、patientNumber
  slice、`Patient.id`のいずれかを現行versionと異なる値で含む場合に、TWI発行前の
  422 `business-rule`で拒否され、DynamoDB write=0であることを検証する。旧値・
  新値・差分内容がresponseへ出ないこと、要素の削除/追加も変更として扱われることを
  含める。**さらに、TWI前検証を意図的に迂回したrequestに対して
  `Update(CURRENT)`の`identityDigest`照合が条件不一致でTWI全体をabortさせ、
  永続状態が一切変わらないことを検証する**(構造的backstopが実際に効くこと)。
  `identityDigest`未設定のCURRENTへのupdateもfail-closedになることを固定する。
- §9.2 deny quota: quota到達後の429が、(principal, scope, 窓)あたり1件の集約
  intentのdurable commit、または既commit済み集約intentの強整合存在確認の
  **後にだけ**返ること、commitと存在確認の双方に失敗した場合は429ではなく500に
  なること、無記録の窓が発生しないこと、quotaがscope単位単独では遮断しないことを
  検証する。集約intentが個々のtarget IDを持たないことも固定する。さらに
  round-4訂正のlifecycle適合を検証する: 同一窓の並行denyで集約intentのPutが
  高々1回commitされ以後Updateが発生しないこと(試行回数の累積なし)、`eventId`が
  `(principal, scope, windowStart)`から決定的に再導出できること、窓閉鎖 +
  clock skew前に配送されないこと、窓閉鎖後は通常の消込TWI(dedupe実在
  ConditionCheck + `PENDING#` Delete + `DONE#` Put)で収束すること。
- §9.2 payload lifecycle: `DONE#`のpayload削除がdedupe実在のConditionCheckと
  `attribute_exists`を伴い二重実行が排除されること、収束していない`DLQ#`の
  payloadが時間経過だけでは落ちないこと、消込TWIがpayloadを`DONE#`へ引き継ぐ
  ことを検証する。
- 未認証callerに対し、`DELETE`/`POST`/`GET`のいずれを送っても単一の401だけが
  返り、`Allow`が付かず、route/methodの有無やenabled/disabledの別が観測できない
  ことを検証する(判定順序は§8の6段
  「認証 → route-family粗認可 → route/method解決 → interaction別scope認可 →
  phase/enablement判定 → 存在」を正とする — 旧4段/5段の記述は§8で撤回済み)。
- §8 phase非開示: 認証済みだが当該interactionのrequired scope(createは観測資格
  としての`patient:write`)を欠くcallerが、pre-cutover/post-cutoverのいずれでも
  同一の403 `forbidden` + `AUTH-0003`を受け取り、応答の別からcutover phaseを
  観測できないことを検証する。phase依存の404/405はscope保持callerにのみ返る
  ことを固定する。
- `no-store`が応答送出の単一choke pointで付与され、routeへ到達しない413/405/404
  でも付くことを検証する。
- §4.1.1 serializer: `resourceJson`が`S`(UTF-8 byte列)として格納され、末尾ゼロを
  持つFHIR `decimal`が**accepted requestから格納octetまで、さらにreplayまで**
  保存されること、member order比較がlocale非依存であること、replayが
  `resourceJson`をverbatimで返しparse/再直列化を経由しないことを検証する。
- §9.1 rollback: cutover後にrollbackして`POSTGRES_PRIMARY_ROLLED_BACK` +
  epoch advanceした状態で、**新しく起動した**FHIR writerがwrite前提を満たさず
  DynamoDB write=0であることを検証する。writerが自己保持`writerFenceToken`と
  control item値の一致を要求し、control itemを読めるだけでは条件を満たせない
  ことも固定する。
- §9.2 audit: deny(401/403/404)でaudit intent commitが失敗した場合に当該
  responseを返さず500になること、intentからaudit factを再構成できること、
  消込がdedupe実在のConditionCheckを伴い、`PENDING#`削除と`DONE#` Putが
  同一TWIで行われ、二重消込が`attribute_not_exists`で排除されることを検証する。
- §4.1.1 replay exactness: 同一fingerprintのreplayがstatus/header set/body octet
  列まで初回と一致すること、`responseBodyDigest`不一致が500 `incomplete`になり
  近似bodyを返さないこと、`Prefer`付きrequestが値を問わず400 `not-supported`に
  なることを検証する。
  idempotency recordがraw response bodyを保持しないことも固定する。
- §4.2.1 retirement unsupported: retained lookup-key setからversionを外す操作が
  存在せず、bound接近時にrotationが開始されずsecurity reviewへ返ること、
  persisted rotation fenceのstale writer阻止は独立して機能することを検証する。
- §5.3 materialization bound: 各boundの直下と超過をfixture化し、超過時に
  429/503 + `Retry-After`が返りpartial result/truncated Bundle/next linkが
  生じないこと、publish前SEGMENTがMETA不在で不可視かつcleanup登録されること、
  client切断でmaterializationが継続しないことを検証する。
- §7.1 parse boundary: pre-capture cap超過が413でbyte captureとfingerprint計算を
  伴わないこと、`Content-Encoding: gzip`が415でdecompressionされないこと、
  不正UTF-8/overlong/単独surrogate/BOMが422 `invalid`、duplicate JSON memberが
  422 `invalid`、depth/member/element/node cap超過が422 `too-costly`になること、
  cap名・閾値・実測値がresponseへ露出しないことを検証する。
- 401/403分離: credential不在/malformed/期限切れ/署名不正/audience不一致が
  すべて同一の401 + `security` + `WWW-Authenticate`(realmとscheme名のみ)を返し、
  scope欠如だけが403 + `AUTH-0003`かつ`WWW-Authenticate`なしになることを検証する。
- 全FHIR responseの`Cache-Control: no-store`: 成功、error、OperationOutcome、
  `/metadata`、405、404、空searchsetの全てで付与され、caller依存responseに
  `Vary: Authorization`が付くことを検証する。
- §9.1 authority binding: authority control ConditionCheckがTWIに含まれ
  action/aggregate budgetへ算入されること、読取後commit前のepoch advanceで
  writeが必ずabortしauto retryしないこと、`authorityState`不一致がDynamoDB
  write前の503になることを検証する。PostgreSQL drain未完了でcutoverが実行
  されないことも固定する。
- §9.2 audit convergence: 同一`eventId`のintentを複数回配送してもaudit chain
  追記が高々1件であること、bounded attempt超過でDLQへ退避しDLQ itemが
  DB-005 §6.4のmonotonic single-transition規律に従うこと(定義外の更新・削除の
  拒否と、収束確認後のpayload削除という単一遷移の両方 — 「append-only」検証と
  呼ばない)、intent集合とdedupe集合の差分がreconciliationで
  検出されること、audit intentのdurable commit失敗時にPHI responseを返さず
  500になることを検証する。
- §3.2 logical ID/tombstone: server生成logical IDがPHI由来値を含まず再利用
  されないこと、client供給idがauthorityにならないこと、`DELETE`が405で
  tombstoneが生成されず410が現行phaseで到達不能であることを検証する。

## 12. Stop conditions

- phase matrix外のroute/CapabilityStatement advertising。
- `/fhir/R4/*`以外のexternal authoritative write producer、またはARC-008 §3.1の
  producer属性未充足のままのcreate/update有効化。
- §2.1のuniqueness guard/possible-match/merge lineage未承認のままPatient create
  を有効化・広告。
- post-cutover Patient PUTで`identifier`/patientNumber slice/`Patient.id`の変更を
  受理する(§2.2 identity不変性違反)。
- `authorityState`を単調前進と扱う、rollback後の状態を`FHIR_PRIMARY`のまま残す、
  writerが`writerFenceToken`をcontrol itemから取得した値で自己照合する(§9.1)。
- PostgreSQL側の書込停止をapplication自己抑制だけで担保する、cutover後の
  乖離detectorなしにcutoverを実行する(§9.1)。
- `resourceJson`を`M`/`N`等のstructured attributeで格納する、replayで
  `resourceJson`をparse・再直列化してから返す、member order比較をlocale依存に
  する、数値をfloat化して有効数字を落とす(§4.1.1)。
- replayの恒久500を「fail-closedだから解決済み」と扱い、client側の重複作成経路を
  未解決として記録しない(§4.1.1)。
- audit intentがaudit factを再構成できる情報を持たない、消込をdedupe実在の
  ConditionCheckなしに実行する、**auditable operationのresponse(成功・deny・
  failure・空searchsetを区別しない)**をaudit intentのdurable commit前に返す
  (§9.2)。deny専用の禁止はこの一般規則の例示にすぎない。
- deny経路のquota到達を記録せずに429で打ち切る、集約intentのcommit失敗後に
  429を返す、quotaをscope単位だけで遮断する(§9.2)。
- 集約deny intentへ試行回数をUpdateで累積する、決定的`eventId`導出なしに集約
  intentを作る、窓の閉鎖前に配送する、commitと存在確認の双方に失敗した状態で
  429を返す、MOD-008未登録のままdeny quota経路を有効化する(§9.2)。
- interaction別scope認可の前にphase依存の404/405を返す(cutover phaseの
  scope外開示。§8)。
- updateのbudget preflightでdelta setをper-version cap 1個分として計上する、
  patientNumber guardを1件として計上する、§7.1のJSON capをpartition capの
  根拠にする(§4.2.1、§9)。
- payload削除をdedupe実在のConditionCheckなしに実行する、収束していないDLQ
  itemのpayloadを時間経過だけで落とす(§9.2、DB-005 §6.4)。
- post-cutover Patientのidentity不変性をTWI前検証だけで担保し、
  `Update(CURRENT)`の条件式へ`identityDigest`照合を合成しない(§2.2)。
- 未認証callerへroute/methodの有無を反映した404/405や`Allow`を返す(§8)。
- `no-store`をroute handlerで付与し、routeへ到達しない応答で欠落させる(§8)。
- logical IDに時刻成分・カウンタ成分・登録順相関成分を含める(§3.2)。
- snapshot並行度を単純カウンタで強制し、crash時に恒久429へ張り付かせる(§5.3)。
- §4.2.1のresidual manifestなしにlookup-key retirementを実装・実行、または
  retained setからversionを外す。
- replayでresponse bodyをidempotency record内の保存replicaから返す、
  digest不一致で近似bodyを返す、`Prefer`を受理してfingerprint schemaを据え置く。
- §5.3のmaterialization boundを評価せずsnapshotを作成、bound超過でpartial
  resultやtruncated Bundleを返す、中断したmaterializationをcleanupしない。
- §7.1のpre-capture cap評価前にrequest-entity bytesをcaptureする、duplicate JSON
  memberをlast-wins等で受理する、不正UTF-8をreplacement characterへ置換して続行。
- 401と403を同一視する、401で`WWW-Authenticate`を省く、認証失敗の種別を
  IssueTypeで区別する。
- FHIR responseの一部で`Cache-Control: no-store`を省略する、PHI有無で分岐させる。
- §9.1のauthority control ConditionCheckを欠いたclinical TWI、epoch advanceを
  伴わないwriter交代、PostgreSQLとDynamoDBに跨るcross-store atomicityの主張。
- §9.2のstable event identity/dedupe/reconciliationを欠いたaudit intent、
  audit intentのdurable commit前にauditable operationのresponse(成功・deny・
  failure・空searchsetを問わない)を返す、DLQ itemの自動破棄。
- PHIまたはPHI由来値をlogical IDにする、logical IDを再利用・再割当する。
- deleteまたはtombstone生成経路を本batchで実装・広告する。
- partner consumerまたはgeneric projectionを本authority contractへ混在。
- trusted tenant+pharmacy以外からscope/key/referenceを導出。
- automatic write retry、current resourceだけを用いたreplay、stale fallback。
- active versionだけのidempotency record、transaction外alias補完、
  persisted rotation fence不在、non-monotonic rotation、およびlookup-key
  retirementの実装・実行(§4.2.1により種類を問わずunsupported)。
- 100 actions/4 MiB超過TWI、budget preflight後のitem追加、write chunking。
- FHIR resource/item >400 KBのS3 offload、cross-service partial authority。
- immutable search snapshot未実装でsearchを広告、またはupper watermarkだけで
  duplicate/skip防止を主張。
- planned test obligationsを未実装testのPASS evidenceとして記録。
- audit registry未登録のclinical operation。
- profile/terminology/validator evidenceなしのconformance/support claim。
- OperationOutcome/logへのraw input、PHI、secret、unregistered code露出。

## 変更履歴

- 0.1.2 (2026-08-01 finalization): round-5 の独立 review 三レーン完了
  (independent verifier は packet 本文 PASS・HIGH なし)と direct human approval に
  より PROPOSED → APPROVED。**本文 semantics は不変**。承認範囲は SSOT 改版のみで
  あり、実装着手・schema/data migration・production action・conformance 主張は
  含まない。登録済み blocker は全て据え置きである。
- 0.1.2 (2026-07-31 Revision 12): round 4 の設計 findings を user direction 下で
  訂正(いずれも fail-closed 側を選択)。§9.2 の集約 deny intent を
  `PENDING#`/`DONE#` lifecycle へ適合: `eventId` は `(principal, trusted scope,
  windowStart)` から決定的に導出、窓あたり1回だけ conditional Put、以後は
  `PENDING#`/`DONE#` の強整合存在確認後に 429、**試行回数の保持を撤回**(既存
  item の Update を含意し immutability に反するため)、配送は窓閉鎖 + clock skew
  後、集約 deny event は MOD-008 登録範囲へ追加(§6 の 429 行も同期)。§4.2.1 の
  joint invariant を operation 別へ訂正: update の delta set は BEFORE/AFTER 両
  version に跨るため `7 + 2*maxIndexedTokenPartitions + N <= 100`、
  MedicationRequest create は `7 + maxIndexedTokenPartitions + N <= 100`、
  Patient create(将来)は guard が全 version 分を占めるため
  `7 + maxIndexedTokenPartitions + 2N <= 100`。評価点は write preflight の実数
  カウントとし、§7.1 JSON cap の従属主張を撤回。§2.1 の guard 算入を「その1件」
  から version 数 `N` 件へ訂正(DB-005 §5.2 との round-3 不一致解消)。§8 の
  判定順序へ **phase/enablement 判定**段を追加し、phase 依存の 404/405 を
  interaction 別 scope 認可を通過した caller に限定(scope を欠く caller は
  phase にかかわらず一律 403 とし、cutover phase の scope 外開示を閉鎖。§7.1 の
  合成順序記述も同期)。§11 test obligations と §12 停止条件を同期。
- 0.1.2 (2026-07-31 Revision 11 — mechanical): round 4 findings のうち design judgement を伴わない項目のみ訂正 — DLQ 呼称の §6.4 整合、§11 test obligation の 撤回済み4段の除去、他文書 § 参照への接頭辞、bound超過 status の API-001 委譲。設計 findings は未解決のまま escalation を維持。
- 0.1.2 (2026-07-31 Revision 10): independent re-review round 3 の HIGH 3 件の
  訂正。いずれも「宣言はあるが強制手段がない」または「訂正自身が新たな抜け道を
  作った」型であり、本 batch が他所で採った基準を一貫適用する形で閉じた。
  §2.2 の identity 不変性は TWI 前の 422 だけでは application の自己抑制に
  すぎなかったため、DB-005 §5.2 の `Update(CURRENT)` 条件式へ `identityDigest`
  照合を合成する構造的 backstop を要求した。action 数は増えず、TWI 前 422 は
  一次拒否として維持する。§9.2 の deny quota は「quota 到達時に記録せず 429 で
  打ち切る」としていたが、これは攻撃者が到達条件を制御できる例外であり、quota を
  故意に焼き切った窓の総当たりが 1 件も監査に残らない。(principal, scope, 時間窓)
  あたり 1 件の集約 intent を durable commit してから 429 を返す形へ縮退させ、
  集約 intent の commit 失敗時は 429 ではなく 500 とすることで**無記録の窓**を
  禁止した。quota は scope 単位単独では遮断しない。payload の破棄は時間経過では
  なく収束で駆動し、消込と同型に `ConditionCheck(dedupe 実在)` +
  `attribute_exists` で機械強制する。収束していない DLQ item の payload は
  時間経過だけでは決して落とさず、そこから生じる無期限保持は
  `BLOCKED_AUDIT_PAYLOAD_RETENTION_POLICY` として SEC-007/SEC-008 へ送る
  (timer で消して解決したことにしない)。§6 の 429 行、§11 test obligations、
  §12 停止条件、blockers を同期。status/version は PROPOSED のまま。
- 0.1.2 (2026-07-31 Revision 9): independent re-review round 2 の訂正。
  §2.1 と §8 の 405 へ phase 修飾(post-cutover 405 / pre-cutover 404)を追加。
  §2.2 を post-cutover の挙動宣言から **cutover blocker** へ格上げし、create
  無効化・delete 無効化・merge unsupported・identity 不変の合成が cutover 後の
  Patient 登録経路と誤登録訂正経路を系全体から消すこと、その状態での cutover が
  fail-closed ではなく危険側であることを明記。§3.2 冒頭の「非 PHI 値」断定を
  撤回し pseudonymous 分類へ一本化。§4.1.1 を **verbatim 返却**へ変更し、
  書込時に一度だけ直列化して保存した octet をそのまま返す形にして serializer の
  往復を replay 経路から除去(parse 層が未固定である限り `S` 格納だけでは FHIR
  decimal の末尾ゼロが保存されないため)。§4.2.1 へ `maxIndexedTokenPartitions`
  による joint invariant と、`BLOCKED_LOOKUP_KEY_RETIREMENT` が clinical write の
  有効化を止める効力を追加。§6 の `Allow` を caller scope との intersection へ
  filter。§7.1 と §8 の合成順序を確定し、pre-capture cap は認証前でも作用するが
  未認証には単一 401 だけを返すことを明記。§8 の判定順序を「認証 → route-family
  粗認可 → route/method 解決 → interaction 別 scope 認可 → 存在」の 2 段認可へ
  改め、旧 4 段が実装不能であったことを記録。§9.1 で `writerFenceToken` の
  自己保持が DynamoDB 層で強制できないことを明示し
  `BLOCKED_WRITER_FENCE_TOKEN_ISSUANCE` 化。§9.2 の durable-commit 条件へ
  空 searchset を追加し、audit payload を inline 保持のみへ限定。§11 / §12 /
  blockers を同期。status/version は PROPOSED のまま。
- 0.1.2 (2026-07-31 Revision 8): independent re-review round 1 の
  REQUEST_CHANGES ×3 を訂正。§2.2 で post-cutover Patient の identifier /
  patientNumber / logicalId を不変と宣言し、create 無効化だけでは閉じなかった
  重複ハザードを塞いだ。§3.2 で logical ID の分類を「PHI でない」から
  「pseudonymous かつ患者に紐づく識別子」へ改め、許可を trust boundary 内へ
  範囲限定したうえで予測不能性を MUST へ格上げ。§4.1.1 で `resourceJson` の
  `S` 格納、serializer version の保持義務、locale 非依存 collation を追加し、
  恒久 500 が client を重複作成へ誘導する経路を未解決欠陥として明示。§4.2.1 の
  retirement 論拠を事実へ訂正(alias は単一 partition で列挙可能。真の不足は
  走査 bound と同時証明手順)し、retained set 単調増加による budget 侵食と
  key compromise 時の経路不在を明記。§5.2 の cleanup 判定を expiry 一本化、
  §5.3 の並行度を lease 化し bound oracle の主張を正直な範囲へ限定。§8 で
  判定順序を request 全体へ固定し未認証には単一 401、`no-store` を単一 choke
  point 付与、SEC-006 との atomic amendment を要求。§9.1 で `authorityState` の
  単調前進主張を撤回して rollback 状態を追加し、`writerFenceToken` を writer
  自己保持へ、PostgreSQL 側 fence primitive の不在を blocker として明示。
  §9.2 で audit fact の再構成可能性、deny を含む auditable operation への
  durable commit、`deliveredAt` 消込の ConditionCheck を追加。§11 / §12 /
  blockers を同期。status/version は PROPOSED のまま。
- 0.1.2 (2026-07-31 Revision 7): independent domain reviewのHIGH/MEDIUM訂正。
  ARC-008 §3.1の単一external write producerを前提化し、Patient createを
  patientNumber uniqueness未整備につきinitially disabled(§2.1)、server生成
  opaque非PHI logical IDとtombstone予約semantics(§3.2)、wire byte-exact replayを
  pinned deterministic serializerと`responseBodyDigest`で担保する保存response
  representationおよび`Prefer`未対応(§4.1.1)、version-addressable residual
  manifest不在によるlookup-key retirement unsupported(§4.2.1)、snapshot
  materializationの走査/候補/segment/byte/wall time/並行度bound(§5.3)、
  pre-capture byte capを最優先とするparse boundaryとduplicate member/UTF-8
  policy(§7.1)、401 `security` + `WWW-Authenticate`と403 `AUTH-0003`の分離、
  全FHIR responseへの`Cache-Control: no-store`、413/`too-costly`と
  `Retry-After`を含むOperationOutcome matrix拡張、resource authority
  state/epochへのTWI束縛とcross-store atomicity禁止(§9.1)、audit intent→fact
  convergenceとPHI response前のdurable commit要求(§9.2)を追加。status/versionは
  PROPOSEDのまま。
- 0.1.2 (2026-07-30 Revision 6): distinct BEFORE/AFTER search delta、
  precision-derived `_lastUpdated` interval、Patient cutover VERSION 1 baseline、
  history `fullUrl`、live-gated Allow、mandatory Patient PUT idempotency、
  parameterized wildcard Acceptとplanned fixturesを追加。status/versionは
  PROPOSEDのまま。
- 0.1.2 (2026-07-30): WP-4250 PROPOSED body revision。bounded authority、
  resource×phase matrix、immutable snapshot pagination、request-byte
  fingerprint/rotation/replay、content negotiation、OperationOutcome、
  permission、audit/storage transaction境界を明確化。Revision 4で全version
  alias、exact search grammar、URI no-network、TWI budget、RFC 9110 wildcard/
  `fhirVersion` negotiationを追加。Revision 5でpersisted rotation fence、
  standard token semantics/search algebra、native Dynamo limits、range-local
  negotiation、exact error/Allow matrix、bounded instance historyを追加。
- 0.1.1 (2026-07-10): FHIR R4 primary-source review。
- 0.1.0 (2026-07-10): 初版。
