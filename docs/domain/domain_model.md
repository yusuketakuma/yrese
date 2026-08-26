# domain_model — ドメインモデル(集約・不変条件)

```yaml
ssot_id: DOM-002
title: ドメインモデル(集約・不変条件)
domain: domain
status: APPROVED
approved_at: 2026-08-26
approved_by: "direct human authority 2026-08-26 (WP-5101 prescription draft landing confirmation: 承認); direct human authority 2026-08-01 (WP-4250 exact11 全て承認); round-5 independent verifier PASS on packet body with no HIGH finding (frozen packet ab086c9f8d6e6bfd26e32fbfe9daa21a3b8b6ccd3f324f413b4d2975731cfab6, base SHA 9d8dbc0c3f5201c762dbb39fd9b15fc3ddc4b875); round-5 security/privacy findings closed in Revision 14; round-5 data-integrity findings closed in Revision 13; codex second opinion unavailable until 2026-08-05 and not counted as evidence"
owner: codex_root
reviewers:
  - independent_verifier
  - architect
  - data_integrity_reviewer
  - medical_safety_reviewer
  - privacy_compliance_reviewer
  - human_pharmacist_product_authority
version: 0.1.3
created_at: 2026-07-09
updated_at: 2026-08-26
effective_from: 2026-08-26
effective_to: null
source_refs: 構築プロンプト v0.2.0 §12, §17, §18
depends_on: [DOM-001, PRD-001, SAF-001, MOD-004, MOD-005]
impacts: [DOM-004]
related_work_packages: [WP-1101, WP-9002-W5F, WP-4250, WP-5101]
related_tests: [pnpm check:ssot-index, git diff --check]
related_prs: []
evidence_ids: []
change_log:
  - "0.1.3 2026-08-26 WP-5101: 受付に従属するserver-saved prescription draftのbounded不変条件を承認。保存事実を処方ライフサイクル状態へ昇格せず、tenant/pharmacy/reception scope、受付由来patient、終端受付へのwrite拒否、version/If-Match conflict、content hash検証、read auditを固定。薬剤師確認・確定・訂正履歴・外部連携は対象外"
  - "0.1.2 2026-08-01 WP-4250 exact11 finalization: round-5の独立review三レーン完了(independent verifier PASS・本文HIGHなし)とdirect human approvalによりPROPOSED→APPROVED。本文semanticsは不変。承認範囲はSSOT改版のみであり、実装着手・schema/data migration・production action・conformance主張を含まない。登録済みblockerは全て据え置き"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 14: round-5 security/privacy re-reviewの同期。§2のPATIENTLINK gateをmembership+cardinalityの合成(集合等価)として明示し、SKが生patientIdではなくhmacPatientIdであることを追記"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 13: round-5 data-integrity re-reviewの同期。§2のPATIENTLINK gateをmembership検査として明示し、rollback経由の再cutoverをBLOCKED_RECUTOVER_DIVERGENCE_RESOLUTIONとして追加(初回cutoverは対象外)"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 12: round 4設計findings訂正の同期。§2のcutover前提列挙へPATIENTLINK存在とCURRENTのinternalPatientId保持(DB-005 §11の冪等性・投影linkage経路)を追加"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 9: re-review round 2訂正。§2のstate machine記述をDB-005 §5.1へ同期し一方向・atomic switchの主張を撤回、cutover前提へfence primitive/reception互換/登録・訂正経路を追加、§10へidentity不変性の役割を追記、blockersを同期"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 8: re-review round 1訂正。create無効化だけではPUT経由の患者番号重複が閉じないため、§2へAPI-008 §2.2のidentity不変性とcutover baseline一意性の継承限界を追記しBLOCKED_PATIENT_IDENTITY_MUTATIONを追加"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 7: HIGH-3/HIGH-4訂正。§0の内部authority列挙へPrescriptionを明示追加、§2にreception foreign key/join依存とPatient create disabled、§4にPrescription対MedicationRequestのownership未確定表とblockerを追加"
  - "0.1.2 2026-07-30 WP-4250 PROPOSED Revision 6: Patient cutover VERSION 1 SYSTEM_CUTOVER baselineと履歴非backfillをaggregate authority境界へ同期"
  - "0.1.2 2026-07-30 WP-4250 PROPOSED: bounded FHIR authorityとinternal aggregate authorityの境界を追加。旧0.1.1承認はprevious-version provenance"
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5F metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions: 本文【要確認】参照
blockers:
  - BLOCKED_RECEPTION_PATIENT_COMPATIBILITY: reception_entries の foreign key/join と Patient cutover の互換設計が承認されるまで cutover しない(§2)
  - BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP: Prescription 集約と MedicationRequest の cardinality/authority/status/correction lineage/projection 方向が承認されるまで ingestion しない(§4)
  - BLOCKED_PATIENT_IDENTITY_MUTATION: API-008 §2.2 により post-cutover Patient の identifier/patientNumber/logicalId は不変。付け替え・訂正は uniqueness guard と merge lineage 承認まで実施できず、**これは cutover 実行の blocker でもある**(§2)
  - BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE: PostgreSQL 側の構造的 write fence と cutover 後の乖離 detector が承認・実装されるまで cutover しない(§2)
```

## 0. 原則

- 実装済み共有カーネル型(MOD-004)が正本。本書の集約はそれらを組み合わせる。
- 金額・点数は @yrese/money、日付は @yrese/date-time、根拠は @yrese/trace の型のみを使う。
- **PHI を含む集約は、ログ・trace・agmsg・イベント平文へ出さない**(SEC-004)。
- 集約IDは branded ID 12種(TenantId / PharmacyId / UserId / PatientId / **ReceptionId** / PrescriptionId / DispensingId / ClaimId / EventId / DeviceId / EvidenceId / WorkPackageId — MOD-004 と一致)を使い、生 string を禁止する。
- 全集約は tenant_id + pharmacy_id を保持し、クエリ境界で強制する(SEC-006)。
- WP-4250候補ではPatientとoral/topical MedicationRequestだけが所定gate後にFHIR格納正本となり得る。Reception、Coverage、**Prescription**、Dispensing、CalculationResult、Claim、Report、Master、audit/accountingは内部authorityを維持する。
  - **Prescription(§4 C4)は内部authorityであり、MedicationRequestはその置換でも
    1対1写像でもない**。両者のownershipは未確定であり、§4に記録した
    `BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP`が解除されるまで
    MedicationRequest ingestionを開始しない。以前の版でPrescriptionがこの
    列挙から欠落していたことは、内部authorityの放棄を意味しない。

## 1. Reception(受付)集約 — C1

| 要素 | 内容 |
|---|---|
| ルート | ReceptionEntry(ReceptionId) |
| 主要属性 | 患者参照(PatientId — 集約間参照は ID のみ)、受付時刻(acceptedAt、サーバー採番)、受付状態、処方箋受付区分(MVP は paper のみ — API-006) |
| 状態 | RECEPTION_STATUSES(shared-kernel 正本: WAITING / IN_PROGRESS / COMPLETED / CANCELLED)。副状態機械は DOM-004 §2 |
| 不変条件 | tenant_id + pharmacy_id 必須(§0)/ 冪等一意性 (tenantId, pharmacyId, idempotencyKey) と conflict 時 409 の意味論は **API-006 v0.2.0 を正本とし本書で再定義しない** / 取消は CANCELLED の論理状態で保持(物理削除禁止 — P-12)/ 業務日付は JST 暦日(MOD-011) |
| 実装 | WP-3009-BE(apps/api reception-repository)・WP-3009-UI が実装済み。本節はその集約定義の追認 |

## 2. Patient(患者)集約 — C2

| 要素 | 内容 |
|---|---|
| ルート | Patient(PatientId) |
| 主要属性 | 氏名、**カナ(必須)**、生年月日(CalendarDate)、性別、連絡先、患者番号(薬局内) |
| 値オブジェクト | PatientName(漢字+カナ対)、PatientIdentitySummary(取り違え防止表示用: カナ・生年月日・年齢・性別 — PatientHeader の props に対応) |
| 不変条件 | カナなしで確定登録不可 / 生年月日は実在日付(CalendarDate が強制)/ 統合(マージ)は旧レコードを削除せず履歴保持+監査イベント必須 |
| 医療安全 | SAF-001「患者取り違え」対策の情報源。同姓同名・類似カナの警告表示は Patient 検索サービスの責務 |

Patient authority controlはDB-005 §5.1/§11のpersisted state
(`POSTGRES_PRIMARY`, `SHADOWING`, `CUTOVER_PENDING`, `FHIR_PRIMARY`,
`POSTGRES_PRIMARY_ROLLED_BACK`)と`authorityEpoch`/`writerFenceToken`を正とする。
**state machineは一方向ではなく、単調なのは`authorityEpoch`だけ**である。
PostgreSQLは**時間順序の交代**(停止 → drain確認 → epoch advance/fence →
新writer開始)が完了するまでsole writer、shadowは比較専用でwriterにならない。
**この交代はatomicではない**。PostgreSQLのtransactionとDynamoDBの
TransactWriteItemsは同一のatomic unitではなく、cross-store atomicityの主張は
DB-005 §12で実装禁止である。さらに現時点ではPostgreSQL側に停止を強制する
primitiveが存在しないため、cutoverは`BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE`で
停止している。
approved field mapping、identifier reconciliation、zero unresolved
duplicate/orphan/conflict/merge-link、bounded count/content digest parity、
synthetic/de-identified sampling、stable watermark、human approval record、
**PostgreSQL側の構造的write fence primitiveとcutover後の乖離detector**、
**reception foreign key/join互換設計**、
**cutover後のPatient登録経路とidentity訂正経路**(API-008 §2.1/§2.2)、
**全reconciled patientのPATIENTLINK存在とCURRENTの`internalPatientId`保持**
(DB-005 §11 — patientId-keyed投影・受付のlinkage経路かつ再実行冪等性の
進捗authority。判定はmembership検査(対象集合⊆PATIENTLINK集合)とcardinality
検査の合成で集合等価を確認するものであり、いずれか片方では欠落または余剰を
見逃す。PATIENTLINKのSKは生のpatientIdではなくpharmacy+用途分離鍵による
`hmacPatientId`である)が
一つでも欠ければcutoverしない。さらに**rollbackを経た再cutover**は、rollback
期間中のPostgreSQL側変更(属性変更・統合・削除)の反映経路またはread-only運用
制約が承認されるまで`BLOCKED_RECUTOVER_DIVERGENCE_RESOLUTION`で実行しない
(初回cutoverは対象外)。switch failureはold/new writerのどちらか一方に
fail closedし、dual-writeやstale fallbackを禁止する。cutover後はFHIR store/API
だけをwriterとし、automatic merge、physical delete、tombstone resurrectionを
禁止する。cutover transactionはFHIR VERSION 1をimmutable
`changeOrigin=SYSTEM_CUTOVER`のauthoritative creation baselineとして作り、
PostgreSQLの過去historyをFHIR versionへ推測/backfillしない。

**Reception集約からの構造的依存(HIGH-3 訂正)**: §1のReceptionは`PatientId`で
Patientを参照し、現行実装ではPostgreSQL `reception_entries`から`patients`への
foreign keyとINNER JOINとして具体化されている
(`migrations/000002_create_patient_and_reception_tables.sql`の
`reception_entries_patient_fk`、`apps/api/src/db/reception-repository.ts`)。
Patient authorityをFHIRへ移してもこの参照整合性とjoin経路は消えない。
cutoverはDB-005 §11のreception互換要件(参照先、参照整合性の強制主体、join
代替、rollback整合)がapproveされるまで実行できず、
`BLOCKED_RECEPTION_PATIENT_COMPATIBILITY`とする。「集約間参照はIDのみ」という
本書§1の規律は、DB層の参照整合性を黙って外してよい根拠ではない。

**Patient createは`/fhir/R4`側でinitially disabled**である(API-008 §2.1)。
§10の`(tenant_id, pharmacy_id, patientNumber)`一意性を保証するguardがFHIR側
create TWIに存在せず、同時にmerge/unmergeがunsupportedであるため、重複を
作れて解消できない組合せを避ける。PostgreSQL側の一意性制約
(`patients_tenant_pharmacy_patient_number_unique`)は引き続き有効である。

**create無効化だけでは閉じない**。post-cutoverのPatient `PUT`は有効なままで、
そのTWIにも一意性guardがない。したがってupdateだけでも既存Patientの
patientNumberを他のPatientと同じ値へ書き換えて重複を作れる。API-008 §2.2は
これを受けて、post-cutover Patientの`identifier`、patientNumberを表す
identifier slice、`Patient.id`を**不変**と宣言し、変更を含むPUTをTWI発行前の
422で拒否する。患者番号の付け替えや誤登録の訂正は、uniqueness guard、
possible-match、merge/unmerge lineageが承認されるまで実施できない
(`BLOCKED_PATIENT_IDENTITY_MUTATION`)。

cutover baselineのidentity一意性は、PostgreSQL側制約と`CUTOVER_PENDING`の
「unresolved duplicate = zero」要件から**継承しているだけ**である。この継承は
cutover時点でのみ成立し、**PostgreSQLがwriterでなくなった後の書込を守らない**。
だからこそcreate無効化とupdate identity不変性の両方が必要である。

## 3. Coverage(保険・公費)集約 — C3

| 要素 | 内容 |
|---|---|
| ルート | CoverageProfile(患者ごと) |
| 構成 | InsuranceCard 履歴(保険者番号・記号番号・負担割合・有効期間)、PublicExpense 履歴(負担者番号・受給者番号・優先順位)、**EligibilitySnapshot**(資格確認スナップショット) |
| EligibilitySnapshot | 不変(immutable)。確認日時・確認方法(オン資/目視/災害時)・結果・有効期限を保持。@yrese/calculation の InsuranceSnapshotRef はこのIDを指す |
| 不変条件 | スナップショットの上書き禁止(新規追加のみ)/ 期限切れ・保険者変更検出時は PENDING_REVERIFY を付与 / PENDING_REVERIFY が残る限り isClaimable=false(実装済みガードに委譲)/ LOCAL_ONLY 中の新規確認は LOCAL_ONLY_UNVERIFIED のみ(canConfirmExternal) |
| 公費 | 優先順位・併用の組合せは算定入力。順位決定ロジックの根拠は evidence_id 必須【要確認: 主要公費のMVP対象リスト】 |

## 4. Prescription(処方)集約 — C4

| 要素 | 内容 |
|---|---|
| ルート | Prescription(PrescriptionId) |
| 主要属性 | 由来(PAPER / QR_SYMBOL / E_PRESCRIPTION境界)、処方日(PrescriptionDate)、医療機関・医師参照、RP明細(Rp)コレクション |
| Rp(RP単位) | 医薬品参照(マスター版付きコード — CodeMappingRegistry 経由)、用法、用量、日数/回数、数量、一般名処方フラグ、後発品変更可否 |
| 状態 | DOM-004 の処方ライフサイクルに従う(仮受付→仮取込→薬剤師確認→確定) |
| 不変条件 | **確定は薬剤師確認後のみ**(scope: prescription:confirm)/ QR由来は原本照合記録なしに確定不可 / 確定後の変更は訂正版の新規作成+履歴保持のみ(無履歴変更禁止)/ コード変換の曖昧一致は CODE_MAPPING_REVIEW_REQUIRED で停止 |

### 4.1 Server-saved prescription draft (WP-5101 bounded slice)

- 受付ごとに1件だけ保持し、authority keyは認証済み`tenantId` + `pharmacyId` +
  `receptionId`とする。`patientId`は検証済み受付からサーバー側で導出し、URL・query・request
  bodyをauthorityにしない。
- server-savedであることは**永続化済みという事実**であり、§4またはDOM-004の処方
  ライフサイクル状態ではない。`SERVER_SAVED`その他の新規状態を導入しない。
- writeは受付が`WAITING`または`IN_PROGRESS`の間だけ許可し、`COMPLETED` / `CANCELLED`
  ではcreate/updateとも拒否する。判定は保存と同じtransaction内のfreshな受付行に基づく。
- 初回保存は`expectedVersion=0`かつ`If-Match`なし、更新は一致する`expectedVersion`とquoted
  `If-Match`をともに必須とする。同一内容を含むstale writeは常にconflictで、create replayや
  idempotency成功を主張しない。
- versionは単調増加、`updatedAt`は直前値より必ず後、content hashはread/write境界で再計算して
  不一致をfail-closedとする。構造化行だけを保持し、自由形式payloadの保存へfallbackしない。
- successful readはMOD-008の`prescription.draft.viewed`をresponse前に永続化する。targetは
  prescription IDだけとし、処方本文・患者識別子・検索条件を監査payloadへ入れない。
- 本sliceは薬剤師確認、処方確定、確定後訂正/version history、outbox、外部連携を含まない。

**Prescription対MedicationRequestのownership未解決(HIGH-3 訂正)**:
Prescriptionは本書の内部authority集約であり、WP-4250候補のoral/topical
MedicationRequestはその置換でも1対1写像でもない。次が本batchで未確定である。

| 未確定事項 | 内容 |
|---|---|
| cardinality | Prescription 1件に対するMedicationRequestの件数。RP(Rp)単位か処方箋単位か |
| 可変fieldのauthority | どのfieldをどちらが権威として持つか。重複保持する場合の同期方向 |
| status対応 | DOM-004の処方ライフサイクル(仮受付→仮取込→薬剤師確認→確定)とFHIR `MedicationRequest.status`/`intent`の対応 |
| correction lineage | 訂正版の新規作成+履歴保持と、FHIR側version/`priorPrescription`相当の関係 |
| projection方向 | 内部→FHIR、FHIR→内部、いずれか一方向。双方向は禁止 |

未確定のままMedicationRequest ingestionを開始すると、同一の臨床事実に対する
authorityが2箇所に生じ、ARC-008 §8「同一集約をFHIR正本と内部正本に二重格納」
禁止に抵触する。したがって`BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP`
とし、DOM-005 / DOM-006へownership recordを登録するapproved amendmentまで
ingestionを開始しない。「MedicationRequestは新規開始でデータがないので競合
しない」という理由づけは、Prescription集約が既に定義済みである以上成立しない。

## 5. Dispensing(調剤)集約 — C5

| 要素 | 内容 |
|---|---|
| ルート | DispensingRecord(DispensingId) |
| 主要属性 | 対象 PrescriptionId、調剤日(DispensingDate)、調剤内容(Rpごとの実施記録)、後発品変更記録、残薬調整記録、疑義照会記録参照、薬剤師確認記録 |
| 不変条件 | 薬剤師確認(dispensing:confirm)前の確定禁止 / 疑義照会による処方変更は Prescription の訂正版を経由(Dispensing 側での書き換え禁止)/ 調剤録の保存要件(REG-003【要確認: 保存期間】)に従い削除禁止 |

## 6. CalculationResult(算定結果)— C6

| 要素 | 内容 |
|---|---|
| 実体 | @yrese/calculation の CalculationResult(判別union: BLOCKED / CALCULATED)が正本 |
| 区分 | 仮算定(PROVISIONAL_CALCULATION — LOCAL_ONLY 等)と確定算定を厳格分離 |
| 不変条件 | calculation_trace なしの結果は存在しない(型で強制)/ affectsClaim ステップは evidenceRefs>=1(実行時強制済み)/ 確定算定は allowsFinalCalculation(mode) が真のときのみ / 入力(マスター版・ルール版・各日付)を trace に保存し再現可能にする |

## 7. Claim(請求)集約 — C7

| 要素 | 内容 |
|---|---|
| ルート | Claim(ClaimId)、請求月(ClaimMonth)単位の ClaimBatch |
| 構成 | レセプト中間モデル、電子レセプトデータ参照(生成後)、記録条件検証結果、点検結果、返戻・再請求履歴 |
| 状態 | DOM-004 の請求ライフサイクル(生成→検証→点検→締め→ロック→受渡→返戻→再請求) |
| 不変条件 | **isClaimable=false のデータから生成不可**(実装済みガード)/ 記録条件検証全件通過が「請求可能」の前提(M8)/ 月次締め・ロックは NORMAL モードのみ(allowsClaimFinalization)/ ロック後の変更禁止 — 訂正は返戻・再請求フローの新版のみ / 生成時のマスター版・算定ルール版・trace を保存(帳票・監査から参照可能) |

## 8. Report(帳票)— C9

| 要素 | 内容 |
|---|---|
| 実体 | ReportInstance(帳票種別・版・出力日時・出力者・ハッシュ・出力時点の算定根拠/マスター版参照) |
| 不変条件 | 出力済み帳票の内容改変禁止(再出力は新インスタンス+履歴)/ ハッシュによる改ざん検知(e-文書法 真正性)/ 患者交付済みフラグの取消は監査イベント必須 |

## 9. Master(マスター)— C10

| 要素 | 内容 |
|---|---|
| 実体 | MasterVersion(マスター種別・版・有効開始日・廃止日・経過措置・配布状態) |
| 不変条件 | 版の上書き禁止(新版追加のみ)/ 当時有効版の解決は(処方日・調剤日・請求月)を明示入力(MST-001)/ 検証未通過版の本番適用禁止(PENDING_MASTER_VALIDATION) |

## 10. 一意性・冪等性境界

| 集約 | 一意性・冪等性境界 |
|---|---|
| Reception | 冪等一意性 (tenantId, pharmacyId, idempotencyKey)。同一 key + 同一 patientId = 既存返却、同一 key + 異なる patientId = 409(**正本は API-006 v0.2.0** — 本書で再定義しない) |
| Patient | 患者番号(patientNumber)はテナント内(tenant_id + pharmacy_id)で一意(API-001 の patientNumber と整合)。PostgreSQL では `patients_tenant_pharmacy_patient_number_unique` が強制する。**FHIR 側 create にはこの一意性を保証する同一 TWI guard が未定義**のため、API-008 §2.1 により Patient create は initially disabled。post-cutover に PostgreSQL が writer でなくなった後の一意性維持手段は API-008 §2.2 の identity 不変性であり、PostgreSQL 制約からの継承は cutover 時点でのみ成立する(§2)|
| その他の集約 | 各実装 WP の契約 SSOT で確定する(未実装分の一意性境界を本書で先行固定しない — fail-closed) |

## 11. 横断: SyncEvent / AuditEvent / Identity

- **SyncEvent**: @yrese/events EventEnvelope が正本(MOD-009)。集約の状態変更は Outbox 経由で発信し、直接RPC しない。
- **AuditEvent**: 追記専用・削除不可・ハッシュチェーン(SEC-007)。業務集約から Audit への依存は「発行」のみ。
- **Identity**: TenantId / PharmacyId / UserId / RoleName / PermissionScope(実装済み)。集約操作の権限は API 側 requirePermission で強制(UIのみの制御禁止)。

## 12. 【要確認】

- 主要公費のMVP対象リストと優先順位規則の evidence_id(REG-004 RB-系と連動)
- 調剤録・帳票の法定保存期間(REG-003 の確認結果を反映)
- 返戻・再請求の状態細分(審査支払機関の運用確認後)
- Patient 統合の操作権限(専用 scope 要否 — MOD-007 open_questions と同期)

## 変更履歴

- 0.1.2 (2026-08-01 finalization): round-5 の独立 review 三レーン完了
  (independent verifier は packet 本文 PASS・HIGH なし)と direct human approval に
  より PROPOSED → APPROVED。**本文 semantics は不変**。承認範囲は SSOT 改版のみで
  あり、実装着手・schema/data migration・production action・conformance 主張は
  含まない。登録済み blocker は全て据え置きである。
- 0.1.2 (2026-07-31 Revision 14): round-5 独立 security/privacy re-review の同期。
  §2 の PATIENTLINK gate を membership 検査単独から **membership + cardinality の
  合成**(集合等価)へ改め、片方だけでは欠落または余剰を見逃すことを明記した。
  あわせて PATIENTLINK の SK が生の `patientId` ではなく pharmacy+用途分離鍵に
  よる `hmacPatientId` であることを追記した(`patientId` は自由形式 TEXT で
  患者番号と同値になり得るため、生値を key へ置くと原則 7 に違反する)。
- 0.1.2 (2026-07-31 Revision 13): round-5 独立 data-integrity re-review の同期。
  §2 の PATIENTLINK gate が基数比較として読める余地を閉じ、reconciliation
  対象集合 ⊆ PATIENTLINK 集合の membership 検査であることを明示。あわせて
  rollback を経た再 cutover を `BLOCKED_RECUTOVER_DIVERGENCE_RESOLUTION` として
  追加した(rollback 期間中の PostgreSQL 側変更に解消経路がなく、余剰 link も
  除去できないため。初回 cutover は対象外)。
- 0.1.2 (2026-07-31 Revision 12): round 4 設計 findings 訂正の同期。§2 の
  cutover 前提列挙へ「全 reconciled patient の PATIENTLINK 存在と CURRENT の
  `internalPatientId` 保持」を追加(DB-005 §11 が新設した cutover transaction の
  冪等性と patientId-keyed 投影・受付の linkage 経路。これらなしの cutover は
  投影・受付を再生成不能にし、再実行が同一 patient へ複数 logicalId を発行し得る)。
- 0.1.2 (2026-07-31 Revision 9): independent re-review round 2 の訂正。§2 の
  Patient authority control 記述を DB-005 §5.1 へ同期し、authority state が
  一方向でも単調でもないこと(単調なのは `authorityEpoch` だけ)と、writer 交代が
  atomic ではなく時間順序であることを明記して「atomic switch」の主張を撤回。
  cutover 前提の列挙へ PostgreSQL 側の構造的 write fence primitive と乖離
  detector、reception foreign key/join 互換設計、cutover 後の Patient 登録経路と
  identity 訂正経路を追加。§10 の Patient 一意性行へ、post-cutover に PostgreSQL
  が writer でなくなった後の一意性維持手段が API-008 §2.2 の identity 不変性で
  あり、PostgreSQL 制約からの継承は cutover 時点でのみ成立することを追記。
  `BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE` を登録し、
  `BLOCKED_PATIENT_IDENTITY_MUTATION` が cutover blocker でもあることを明記。
- 0.1.2 (2026-07-31 Revision 8): independent re-review round 1 の訂正。
  Patient create の無効化だけでは PUT 経由の patientNumber 重複が閉じない
  ことを受け、§2 に API-008 §2.2 の identity 不変性(identifier /
  patientNumber slice / logicalId)と、cutover baseline の一意性が PostgreSQL
  制約からの継承にすぎず cutover 後の書込を守らないことを追記。
  `BLOCKED_PATIENT_IDENTITY_MUTATION` を追加。
- 0.1.2 (2026-07-31 Revision 7): independent domain review の HIGH-3 / HIGH-4
  訂正。§0 の内部 authority 集約列挙から欠落していた Prescription を明示追加。
  §2 に live reception の foreign key / INNER JOIN 依存を cutover blocker として
  記録し、FHIR 側 Patient create が patientNumber uniqueness guard 不在により
  initially disabled であることを明記。§4 に Prescription と MedicationRequest の
  cardinality / 可変 field authority / status 対応 / correction lineage /
  projection 方向の未確定表と blocker を追加。§10 の Patient 一意性行へ
  PostgreSQL 制約名と FHIR 側 guard 未定義を追記。
- 0.1.2 (2026-07-30 Revision 6): Patient cutover VERSION 1
  `SYSTEM_CUTOVER` baselineとPostgreSQL history非backfillを追加。
- 0.1.2 (2026-07-30): WP-4250 PROPOSED。Patientのshadow/human cutoverとbounded FHIR authorityを追加し、全非選択aggregateのinternal authorityを維持。
- 0.1.1 (2026-07-09): opus4.8 レビュー反映(BLOCKER: Reception 集約を追記[C1、実装済み WP-3009 の追認]、branded ID を実装12種へ訂正、一意性・冪等性境界の節を新設)。
- 0.1.0 (2026-07-09): 初版起草(WP-1101)。
