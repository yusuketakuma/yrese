# dynamodb_single_table_design — DynamoDB single-table ストレージ設計(FHIR 格納正本・投影・append-only 監査/台帳)

```yaml
ssot_id: DB-005
title: DynamoDB single-table ストレージ設計(FHIR 格納正本・投影・append-only 監査/台帳)
domain: database
status: APPROVED
approved_at: 2026-08-01
approved_by: "direct human authority 2026-08-01 (WP-4250 exact11 全て承認); round-5 independent verifier PASS on packet body with no HIGH finding (frozen packet ab086c9f8d6e6bfd26e32fbfe9daa21a3b8b6ccd3f324f413b4d2975731cfab6, base SHA 9d8dbc0c3f5201c762dbb39fd9b15fc3ddc4b875); round-5 security/privacy findings closed in Revision 14; round-5 data-integrity findings closed in Revision 13; codex second opinion unavailable until 2026-08-05 and not counted as evidence"
owner: codex_root
reviewers:
  - independent_verifier
  - db_steward
  - data_integrity_reviewer
  - architect
  - security_auditor
  - privacy_compliance_reviewer
  - medical_safety_reviewer
  - human_pharmacist_product_authority
version: 0.1.3
created_at: 2026-07-10
updated_at: 2026-07-31
effective_from: 2026-08-01
effective_to: null
source_refs:
  - docs/architecture/fhir_native_phos_aws_platform_direction.md(ARC-008 v0.1.2 APPROVED — 方針正本)
  - docs/research/dynamodb_fhir_store_design_proposal.md(WP-6001 codex 設計提案 — 骨格の入力)
  - opus4.8 敵対的レビュー(WP-6001、2026-07-10)— M1..M8 修正の根拠
  - AWS DynamoDB Developer Guide: TransactWriteItems(同一アイテム複数オペレーション禁止)
  - AWS DynamoDB Developer Guide: ConditionExpression / condition-based writes
  - AWS DynamoDB Developer Guide: IAM dynamodb:LeadingKeys condition key / fine-grained access
  - AWS STS: AssumeRole session policies / session tags(per-request テナントスコープ)
  - AWS DynamoDB Developer Guide: server-side encryption with KMS / TTL expiration behavior
depends_on:
  - ARC-008(FHIR ハイブリッド・AWS・DynamoDB 候補・不変条件の正本)
  - DB-001(スキーマ設計規約 — ARC-008 改版予約中/暫定 ARC-008 優先)
  - DB-002(マイグレーション規律 — 同上)
  - DB-003(テナント分離 — §4 critical の DynamoDB ネイティブ代替を本書で具体化)
  - DB-004(保存削除 — fail-closed「削除しない側」を継承)
  - SEC-006(tenant_isolation_design — テナント分離設計の正本)
  - SEC-007(audit_log_design — ハッシュチェーン正本)
  - SEC-008(audit_worm_and_tenant_isolation — 偽ハッシュ供給禁止・物理層 BLOCKED)
  - MOD-009(event_envelope_schema — 封筒不変条件 phiClassification≠none→encrypted)
  - MOD-010/MOD-011(金額整数/暦日・業務日)
  - API-001(patient_search_contract — 部分一致+カナ検索要件)
  - API-006(reception_queue_contract — 冪等・安定順序)
  - CAL-008(calculation_trace_schema)
  - packages/audit(WP-5004a canonical hash-chain core: createAuditEvent / computeAuditEntryHash / verifyAuditHashChain / AUDIT_GENESIS_PREV_HASH)
impacts:
  - Phase 1 実装 WP(FHIR ストアアダプタ・投影・監査永続化 WP-5004b)
  - apps/api persistence adapters(または新規 persistence パッケージ)
  - packages/contracts(FhirResourceStore/ProjectionStore/AuditAppendStore の入出力契約)
  - scripts/check-boundaries.mjs(AWS/DynamoDB import 境界検査の拡張 = WP-6002)
related_work_packages: [WP-5004, WP-6001, WP-6002, WP-7001, WP-9002-W5E, WP-4250]
related_tests:
  - packages/audit/src/audit.test.ts
  - packages/audit/src/audit-hydration.test.ts
  - packages/audit/src/intent-fingerprint.test.ts
  - apps/api/src/dynamodb/audit-persistence-key-codec.test.ts
related_prs: []
evidence_ids: []
change_log:
  - "0.1.3 2026-08-01 WP-4250 exact11 finalization: round-5の独立review三レーン完了(independent verifier PASS・本文HIGHなし)とdirect human approvalによりPROPOSED→APPROVED。本文semanticsは不変。承認範囲はSSOT改版のみであり、実装着手・schema/data migration・production action・conformance主張を含まない。登録済みblockerは全て据え置き"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 14: round-5 security/privacy re-reviewのfindings訂正。§11のPATIENTLINK SKを生patientIdからhmacPatientId(HKDF pharmacy+purpose分離、§5.2 guardと同一rotation規律)へ変更し「patientIdは非PHI」という無強制の前提への依存を解消(patient_idは自由形式TEXTでpatient_numberとの同値を禁じる制約がなく、移行運用で患者ID=患者番号がありうる)、最終epoch CASをmembership+cardinalityの合成として定義し余剰link検出を復号なしで成立化、§3.2の圧縮削除をConditionCheck(superseding delta実在+retentionExpiresAt経過)+Delete条件式で機械強制しdeltaへretentionExpiresAt属性を追加、圧縮roleのleast-privilege分離と運用監査を実装WP承認要件へ、§9へinternalPatientId/patientId生値のlog/APM/trace/metric/外部送信禁止をlogicalIdとparityで追加、§6.4の集約deny eventIdをkeyed HMAC導出(SK/dedupe keyに載るため無鍵hashでは総当たり逆引き可能)とし開放窓中の検知経路をSEC-007/008起票事項へ明示、§11 write grant棚卸しへbreak-glass/superuser/migration/運用者直接接続を列挙し乖離detector終了根拠を権限revoke証跡へ紐付け。§12停止条件とtest obligationsを同期。自己整合スイープで§9が用途分離鍵を列挙していなかったことを検出し、検索トークン/patientNumber guard/PATIENTLINK/idempotency lookup/集約deny eventIdの導出入力とローテ時の性質を§9の正本一覧表として追加。§7へBLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT (a)の機械強制実装(check:boundariesの複合キー構築検知)を記録し、残余を(b)既存永続値の検証のみへ縮小"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 13: round-5 data-integrity re-reviewのfindings訂正。§3.2圧縮の削除条件へsuperseding delta自身のretention経過を追加(HIGH: 旧条件はd.commit<=fence<s.commitのas-of snapshotからlogicalIdをsilentに欠落させ、同節のbarrier不変条件と矛盾)、§6.4へ平文属性intentKind/deliverableAfterを追加し集約intentの配送・reconciliation除外を復号なしで判定可能化、§11の最終epoch CASをmembership検査+ConsistentRead全ページ走査として定義しrotation CC込みの固定action=8を明示、rollback経由の再cutoverにおける乖離・余剰linkの解消経路不在をBLOCKED_RECUTOVER_DIVERGENCE_RESOLUTIONとして登録、CURRENTのinternalPatientId/identityDigest保存義務を明文化(Put置換禁止)、§7のBLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT前提をlive code事実へ訂正(branded-ids.tsは`#`をnegative test付きで既に拒否。残余は迂回経路の不在証明へ縮小、conservative維持)。§12停止条件を同期"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 12: re-review round 4の設計findings訂正(user direction下、fail-closed側選択)。§3.2へkeep-latest圧縮規則(latest非削除・期限後superseded deltaのみ・有界background・barrier test前提)、§5.2のjoint invariantをoperation別へ訂正(update=7+2M+N、Patient create将来=7+M+2N、評価点=write preflight、§7.1 JSON cap従属主張を撤回、guard per-version計上へ一本化)、§6.4の集約deny intentをPENDING#/DONE# lifecycleへ適合(決定的eventId・窓あたり1件conditional Put・試行回数保持を撤回・窓閉鎖後配送・MOD-008登録範囲へ追加)、§11の再cutoverをSHADOWING再経由へ訂正、cutover transactionへPATIENTLINK/internalPatientIdによる冪等性と投影linkage経路を新設、PostgreSQL Patient writerゼロの前提訂正(fence対象はwrite grant)。§12停止条件とtest obligationsを同期"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 11(mechanical): re-review round 4のbookkeeping findingsのみ訂正(設計findings — index delta compaction、投影更新経路、cutover冪等性、集約intent lifecycle等 — は未解決のまま記録・escalation維持)。無接頭辞の他文書§参照3箇所(API-008 §7.1/§9.2×2)へ文書接頭辞を付与"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 10: re-review round 3のHIGH 3件訂正。§3.1へidentityDigest属性、§5.2のUpdate(CURRENT)条件式へidentityDigest照合を合成しidentity不変性をTWIで構造強制、§6.4のpayload削除をConditionCheckで機械強制し収束駆動へ一本化(DLQは収束確認まで落とさない)、deny quotaを集約intentへ縮退、§2原則5(b)をmonotonic transition群へ改称。§12とblockersを同期"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 9 追補(round 3 escalation後): §6.4の正規keyブロックだけが SK = INTENT#EVENT#{eventId} のまま取り残されていたのを PENDING#/DONE#/DLQ# の3状態へ訂正。放置するとreconciliationのbegins_with(SK,\"PENDING#\")が恒常的に空集合を返し、唯一の収束検出器がsilentに無効化される"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 9: re-review round 2訂正。§2原則5へmonotonic single-transition群を追加、§3のtenant-wideをGLOBAL sentinelから別prefix空間へ移し昇格経路を構造的に解消、§4.1のPatient createを405/404へ、§5.1のwriterFenceToken強制不能を明示、§5.2でalias tupleからlookupKeyVersionを分離しmaxIndexedTokenPartitionsを新設、§6.4の消込をPENDING#/DONE#へ・payloadをinline限定・収束後削除・deny quota・共通属性継承、§11の一方向state machine定義を訂正しcutover gateへ登録経路を追加"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 8: independent re-review round 1のREQUEST_CHANGES訂正。§4.1のPatient post-cutover表記からcreateを除去、GSI2PKへpharmacy segmentを追加し§3.3の全GSI主張を事実化、§3.1でresourceJsonのS格納とlogicalIdの予測不能性MUST/pseudonymous分類、§5.1でauthorityStateの単調性撤回とrollback状態追加/writerFenceTokenの自己保持、§5.2でretirement論拠の事実訂正・budget侵食・key compromise受容・patientNumber guardの鍵導出とrotation規律、§6.4でintentのfact再構成payload・消込のConditionCheck・reconciliation boundとsparse index・deny監査、§7でSEC-008検証範囲へGSI/Scanを追加しbranded-ids前提の未強制をblocker化、§11でPostgreSQL fence primitive不在と乖離detectorを明示、§4.1のcleanup期限一本化とlease化を追加"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 7: independent domain review訂正。resource authority control item/epoch fence(§5.1)、idempotency record格納規律のAPI-008 §4.1.1委譲(§5.2)、lookup-key retirement unsupported、Patient create uniqueness guard要件、患者検索の候補フェッチbound(§3.4)、snapshot materialization boundの格納側強制(§4.1)、outbox intent→audit fact収束(§6.4)、LeadingKeysのpharmacy粒度化(§7)、reception FK互換とPrescription ownership blocker(§11)を追加"
  - "0.1.3 2026-07-30 WP-4250 PROPOSED Revision 6: distinct BEFORE/AFTER search delta、precision interval _lastUpdated、Patient cutover VERSION 1 baseline history、live-gated method projection、mandatory Patient PUT idempotencyをreview待ちとして固定"
  - "0.1.3 2026-07-30 WP-4250 PROPOSED Revision 5: persisted rotation fence、search token partitions/algebra、bounded history、native 400-KB/100-action/4-MiB limitsをreview待ちとして精密化。旧0.1.2承認はprevious-version provenance"
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5E metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions:
  - Q3 上位ティア: per-tenant table/account 物理分離(高リスク/大規模テナント向け)の提供有無と条件(商用判断 + SEC-008)
  - HMAC 決定的検索トークンの許容範囲(exact-token のみか、低感度粗バケットを許すか)は SEC-008 で確定
  - 患者検索の候補集合フェッチのスケール上限(1薬局患者数の実測)と粗バケット最適化の採否
  - 監査/台帳チェーンのセグメント化(月次等)+ アンカー連結の具体設計
blockers:
  - BLOCKED_SECURITY_REVIEW: IAM 条件式構文(StringEquals/StringLike)・per-request STS セッションポリシー/セッションタグの最終形・KMS 鍵階層・HMAC pepper 管理・break-glass ロールは SEC-008 §3 完了後に確定
  - BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT: MOD-008にFHIR read/search/create/update/deny/failure mappingが登録されるまでclinical routeを実装しない
  - BLOCKED_FHIR_SEARCH_SNAPSHOT_IMPLEMENTATION: immutable index delta/materialized as-of snapshotとretention/barrier testsが実装されるまでsearchを広告・実装しない
  - BLOCKED_LEGAL_REVIEW: FHIR 版履歴・監査・会計・確定請求/領収の保存年限は REG-003/DB-004 の法令整理まで断定しない(削除しない側に倒す)
  - BLOCKED_FHIR_CONFORMANCE_REVIEW: profile/terminology/conformance test なしに JP Core 準拠を訴求しない(PRD-007/ARC-008 継承)
  - BLOCKED_RECEPTION_PATIENT_COMPATIBILITY: reception_entries の foreign key/join と Patient cutover の互換設計が承認されるまで cutover しない(§11)
  - BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP: DOM-002 Prescription 集約と MedicationRequest の ownership/cardinality/correction lineage が承認されるまで ingestion しない(§11)
  - BLOCKED_LOOKUP_KEY_RETIREMENT: version-addressable residual manifest が存在しないため lookup-key retirement を unsupported とする(§5.2)
  - BLOCKED_PATIENT_SEARCH_SCALE_BOUND: 候補集合フェッチ/復号の measured cap と非 PHI 粗インデックス代替の採否が確定するまで患者検索を production 適用しない(§3.4)
  - BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE: §11 の PostgreSQL 側構造的 fence と cutover 後の乖離 detector が承認・実装されるまで Patient cutover を実行しない
  - BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT: キー構築経路が branded 型を経由することが強制されていないため prefix 曖昧性に対して pharmacy 粒度分離を無条件に安全とは主張しない(§7)。branded ID factory 自体は `#` を negative test 付きで既に拒否しており(round-5 事実訂正)、残余は迂回経路の不在証明と既存永続値の検証。packages/ は本 WP の path allow-list 外であり別 WP の prerequisite。`GLOBAL` sentinel 衝突は §3 の別 prefix 空間化で本 batch 内に解消済み
  - BLOCKED_WRITER_FENCE_TOKEN_ISSUANCE: §5.1 の `writerFenceToken` 自己保持が DynamoDB 層で強制できないため、発行経路または自称不能属性への拘束が承認されるまで fence だけで fresh writer 排除を主張しない
  - BLOCKED_AUDIT_PAYLOAD_RETENTION_POLICY: 収束しないまま滞留する DLQ item の暗号化 payload は無期限に残る。その保存年限・WORM・消去手順は SEC-007/SEC-008 の管轄であり、timer で消して解決したことにしない(§6.4)
  - BLOCKED_AUDIT_PAYLOAD_EXTERNAL_STORE: §6.4 の audit payload を外部 store 参照で保持する場合の書込順序/digest 検証/失敗時 semantics/budget 算入が未定義のため inline 保持のみを許可する
  - BLOCKED_PATIENT_IDENTITY_MUTATION: cutover 後の Patient 登録経路と identity 訂正経路が承認されるまで cutover しない(§11、API-008 §2.2)
  - BLOCKED_RECUTOVER_DIVERGENCE_RESOLUTION: rollback 期間中の PostgreSQL 側変更(属性変更・統合・削除)を FHIR authority へ反映する承認済み経路、または rollback 期間も PostgreSQL を read-only に保つ運用制約が承認されるまで、rollback を経た再 cutover を実行しない。VERSION 2+ backfill 禁止・`SYSTEM_CUTOVER` の VERSION 1 限定・PUT producer 未成立・PATIENTLINK 削除禁止の合成により、現設計では乖離の解消経路も余剰 link の除去経路も存在しない(§11)。初回 cutover は対象外
```

## 1. 目的と位置づけ

ARC-008(FHIR ハイブリッド・PH-OS 汎用投影・AWS 移行)のDynamoDB single-table**候補設計**。製品選定・実装済み・production適用を主張しない。

**本書の範囲**: single-table のキー設計・access pattern・楽観ロック・監査/台帳 append-only 機構・テナント分離機構・投影整合・暗号化/PHI 配置・persistence-agnostic アダプタ境界・段階移行。**範囲外**: FHIR REST の wire 契約・CapabilityStatement の正式契約(別 SSOT、API/FHIR ドメインで起草)、AWS 基盤 IaC(別 SSOT)。本書は格納の観点から必要な FHIR 相互作用・検索の**格納側決定**を規定し、対外契約はそちらへ委譲する。

**DynamoDB 製品確定は独立ゲート**(ARC-008 §2)。本書は「AWS 移行(ユーザー確定)」の下での第一候補設計であり、access pattern 検証 + BLOCKED_SECURITY_REVIEW 解除をもって製品確定する。DB-001..004 は ARC-008 により改版予約中(暫定 ARC-008 優先)であり、本書はその DynamoDB 具体化を担う。SEC-006/SEC-008を本改版へjoinせず、既存tenant/pharmacy/MOD-007境界を再利用する。production store/IAM/role/break-glassと新しいaudit registry/durability semanticsはそれぞれ別の承認済みamendmentが必要であり、本書はSEC完了を主張しない。

## 2. 設計原則(不変)

1. **テナント先頭キー**: すべてのテーブル PK と全 GSI パーティションキーは `TENANT#{tenantId}` で始まる。テナント境界を IAM に可視化し(§7)、通常系のクロステナントアクセスを構造的に排除する。
2. **ペイロードのauthorityを信用しない**: `tenantId`/`pharmacyId`、
   actor/principal/client identity、role、permission scopesはtrusted
   JWT/AuthContextからのみ導出する。FHIR `meta.security`・extension・path・body・
   queryは認可根拠にしない。adapterは全keyをAuthContextと検証済みbranded IDから
   構築する。
3. **集約ごと単一格納正本**: 候補FHIR authorityはPatientとoral/topical MedicationRequestだけ。Patientはhuman cutoverまでPostgreSQL authority、MedicationRequestはgate完了後のfirst accepted createからFHIR sole writer。その他は内部authorityを維持する。
4. **投影は再生成可能な非正本**: 検索索引・患者サマリ・PH-OS カード・キューカードは FHIR/内部正本から再生成できる投影であり、正本にならない。
5. **TTL / 物理削除を持たないアイテム集合**: 次の2群を対象とする。
   (a) **append-only 群**(更新も削除もしない): 監査イベント・会計台帳・確定請求・確定レセプト/領収・**FHIR 版履歴**。
   (b) **monotonic transition 群**(§6.4 が明示的に定義した遷移だけを許し、痕跡を失わない): audit outbox intent(`PENDING#` → `DONE#` の消込、および収束確認後の payload 削除)と DLQ item(収束確認後の payload 削除)。**遷移はいずれも ConditionCheck で機械強制**し、prose の手順に委ねない。定義外の更新・item そのものの削除は禁止する。
   いずれも DynamoDB TTL 属性を持たず、痕跡を消す物理削除経路を持たない(ARC-008 §8、DB-004 fail-closed)。以前の版は (a) だけを列挙しており、§6.4 が「原則5 の TTL/物理削除禁止を継承する」と述べても文言上の適用対象に入っていなかった。§2 だけを読む実装者が outbox/DLQ に TTL を設定すると、失効後に監査欠落が不可視化する。
6. **FHIR の可変性は履歴を弱めない**: current アイテムは楽観ロックで可変だが、受理された変更ごとに不変な version アイテムを生成する。FHIR delete は tombstone(状態遷移)であり物理削除ではない。
7. **キー・ログに生 PHI を置かない**: アイテムは保存時暗号化されるが、キー値と診断情報は運用メタデータになり得る。氏名・カナ・患者番号・保険者番号等は**キー/GSI/ログに平文で載せない**。決定的検索トークンはテナント別鍵の HMAC(§9)。
8. **アダプタのみが AWS を知る**: AWS SDK・DynamoDB 条件式・リトライ・AttributeValue マーシャリングは `apps/api` 永続化アダプタ(将来の persistence パッケージ)に限定。`packages/{calculation,money,date-time,trace,audit,shared-kernel,events,contracts}` は DynamoDB/AWS を import しない(check:boundaries が機械強制、WP-6002)。

## 3. single-table キー設計

論理テーブル(候補): `yrese-core`。

| キー | 型 | 規則 |
|---|---|---|
| `PK` | string | pharmacy-scoped itemは全て `TENANT#{tenantId}#PHARMACY#{pharmacyId}` 始まり |
| `SK` | string | アイテム種別ごとのソートキー |

共通属性: `tenantId` / `pharmacyId`(pharmacy スコープ時)/ `entityType` / `schemaVersion` / `createdAt` / `updatedAt`(アプリ供給。DB now() 禁止)/ `phiClassification` / `encryptionStatus`(MOD-009 継承: PHI/PII → `encrypted` 必須)。共通属性は outbox intent / DLQ を含む**全 item** に適用され、個別節の内容列挙はこれへの追加であって置換ではない。

**tenant-wide item は別 partition key 空間に置く(sentinel 廃止)**: 以前の版は
tenant-wide を `PHARMACY#GLOBAL` という sentinel pharmacyId で表現していた。
これは `pharmacyId = "GLOBAL"` の薬局が登録された場合に、その pharmacy-scoped
item が tenant-wide 空間と同居することを意味する。§7 が新設した「tenant-wide 用の
分離した session policy」はまさにその prefix を持つため、**tenant-wide session が
その 1 薬局の全 PHI へ到達する**という権限昇格経路が生じる。これは pharmacy 粒度化
以前には存在しなかった経路である。したがって sentinel を廃止し、tenant-wide item は
`PK = TENANT#{tenantId}#SCOPE#TENANT#...` のように **`PHARMACY#` とは異なる
接頭辞空間**へ置く。pharmacy-scoped 空間と tenant-wide 空間は prefix レベルで
交わらないため、pharmacyId の値がどうであっても衝突しない。この変更は key 設計内で
完結するため、`branded-ids.ts` の改修(`#` 排除、prefix 曖昧性対策)を待たずに
昇格経路そのものを構造的に消せる。`branded-ids.ts` の blocker は
`"A#PHARMACY#B"` 型の prefix 曖昧性のために引き続き必要である。

**キーセグメント正準形の不変条件**: `tenantId` を含む全補間値(`resourceType`/`logicalId`/`token`/`receptionId`/`pharmacyId` 等)は **`#` を含まない正準エンコード**を強制する。これはプレフィックス衝突(例: tenant "A" と "AB")・キー曖昧性・§7 の LeadingKeys プレフィックス安全性の前提である。FHIR logicalId は仕様上 `[A-Za-z0-9.\-]{1,64}` で `#` 不可だが、規律として明文化する。

**SK 時刻値の正準形の不変条件(MINOR-1/2)**: ソートキーに埋める時刻値(`acceptedAtIso` / GSI1SK の `lastUpdated` 等)は**固定桁・UTC・固定精度の ISO 8601 形式**(`toISOString()` 正準・ミリ秒固定)とし、辞書順 = 時系列順を保証する(精度混在で `asc` 順序が崩れることを防ぐ)。日付セグメント `DATE#{yyyyMmDd}` は **Asia/Tokyo 業務日(`businessDate`、MOD-011)**であり acceptedAt の UTC 日付ではない(JST 深夜跨ぎの誤パーティションを防ぐ。§4.3 の明示日付と整合)。

**SK 数値セグメント(連番)の正準形の不変条件(WP-7001/WP-4250)**:
監査/台帳とFHIR versionはそれぞれ独立したcounterだが、codecは同じ
`uint64 [1, 18446744073709551615]`、base10、JS `number`非経由の`bigint`、
固定20桁zero-pad keyを用いる。FHIR JSON `meta.versionId` とETagはunpadded
base10、VERSION keyだけが20桁zero-padであり、strict round-trip一致を要求する。
client supplied `meta.versionId` はauthorityにしない。0、overflow、duplicate
version、key/payload不一致はtransaction全体をabortする。

### 3.1 FHIR リソース current / 履歴

```text
current:  PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#FHIR#{resourceType}#{logicalId}   SK = CURRENT
version:  PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#FHIR#{resourceType}#{logicalId}   SK = VERSION#{zeroPad(metaVersionId)}
history order:
  PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#FHIRHISTORY#{resourceType}#{logicalId}
  SK = UPDATED#{canonicalLastUpdated}#VERSION#{zeroPad(metaVersionId)}
```

FHIR version codecの正本は本DB-005 §3である。current/version/history-order/index/
idempotency/referenceの全keyを同じtrusted tenant+pharmacy scopeから構成する。

**`resourceJson`はUTF-8 byte列(DynamoDB attribute型`S`)として格納する**
(API-008 §4.1.1が正本)。`M`/`N`等のstructured attributeへ分解してはならない。
`N`は末尾ゼロと指数表記を正規化するため、FHIR R4の`decimal`が有効数字として
保持する末尾ゼロが往復で失われ、byte-exact replayが原理的に成立しなくなる。
`resourceDigest`と`responseBodyDigest`はいずれもこのbyte列に対して計算する。

`logicalId`は**server生成のopaque値**である(API-008 §3.2が正本)。氏名、
カナ、生年月日、患者番号、identifier値、およびそれらのhash/暗号文/連結を
含めない。**暗号論的に予測不能でなければならず**、時刻成分・カウンタ成分・
登録順に相関する成分を含めない(ULID/UUIDv7等の時刻順序IDは不可)。§3.4の
`patientSurrogateSortKey`はULID/内部連番を許容するが、あちらは暗号化itemの
sort keyでURL/外部へ出ないため基準が異なる。

logicalIdの分類は「PHIでない」ではなく**pseudonymousかつ患者に紐づく識別子**で
ある。したがって原則7との関係は**範囲付きで両立**する。PK/SK/GSI key/cursor
拘束といったtrust boundary内での使用は許可し、access log/APM/trace/metric label/
非redact error/外部送信は§9のとおり引き続き禁止する。logicalIdは同一instanceで
不変であり、再割当・再利用・別instanceへの移譲を行わない。client供給idを
authorityにしない。

属性: `resourceType`(CapabilityStatement で allow-list)/ `logicalId` /
`metaVersionId`(整数・リソース毎単調増加)/ `lastUpdated`(アプリ供給)/
`resourceJson`(canonical FHIR JSON = 格納正本)/ `profileRefs`(conformance review
まで参考情報)/ `pharmacyId`(pharmacy スコープ時)/ `deleted`(tombstone)/
`identityDigest`(Patient のみ。identity tuple の SHA-256。§5.2 の
`Update(CURRENT)` 条件式が identity 不変性を構造的に強制するために使う。
item 属性であり key/GSI/log へは置かない)/ `internalPatientId`(Patient の
CURRENT/VERSION のみ。§11 の cutover が設定する非 PHI の内部 surrogate。
patientId-keyed 投影・受付の linkage 経路であり、`resourceJson` へ含めず
FHIR response/wire へ出さない。key/GSI/log へも置かない)。
`identityDigest` と `internalPatientId` は **CURRENT の保存必須属性**であり、
update は `Update(CURRENT)` で行って Put 置換しない(Put 置換は両属性を silent に
落とし、identity 強制と投影 linkage を同時に壊す。§11、§12)。
VERSIONはさらにimmutable `interactionMethod` (`POST` or `PUT`)を保持し、
API-008 §3.1 history entryのrequest/response metadataを再構成する。Patient
cutover VERSION 1だけはさらにimmutable `changeOrigin=SYSTEM_CUTOVER`を保持し、
external REST caller originを主張しない。pre-cutover PostgreSQL
historyは推測生成/backfillしない。history order itemもimmutableで
`metaVersionId, lastUpdated, resourceDigest`だけを持ち、対応VERSIONと同じTWIで
conditional Putする。

**WP-4250候補リソース**: Patient / oral-topical MedicationRequestのみ。injection MedicationRequestおよびCoverage / Organization / Practitioner / PractitionerRole / Location / Medication / MedicationDispense / DocumentReference等はunsupported/unselectedで、この設計を実装根拠にしない。

**Provenance は格納正本一覧に含めない**(M5)。監査由来 Provenance は §6 の内部監査からの**read-only 派生投影**であり、格納正本(可変・版管理)にしない(ARC-008 §6/§8 二重格納禁止)。外部由来の非監査 provenance を扱う場合は別途分離設計。

### 3.2 FHIR 検索索引(exact-token のみ)

```text
exact-token:
PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#FHIRIDX#{resourceType}#{searchParam}#{token}
SK = COMMIT#{zeroPad(indexCommitSequence)}#RESOURCE#{logicalId}#VERSION#{zeroPad(metaVersionId)}

_lastUpdated range:
PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#FHIRIDX#{resourceType}#_lastUpdated#SHARD#{shard}
SK = VALUE#{lastUpdated}#COMMIT#{zeroPad(indexCommitSequence)}#RESOURCE#{logicalId}#VERSION#{zeroPad(metaVersionId)}
```

- Patientは`identifier`, `_lastUpdated`だけ、MedicationRequestは`identifier`,
  `subject`, `patient`, `code`, `_lastUpdated`だけを索引化する。standard
  `medication` reference searchは索引化/広告せず400 `not-supported`。
- parameter grammar/normalizationはAPI-008 §5.1を正本とする。`identifier`は
  bare=`ANY_SYSTEM(value)`、empty-system=`NO_SYSTEM(value)`、
  system指定=`EXACT_SYSTEM(system,value)`の別tag/partitionを持ち、相互変換しない。
  `code`はapproved `EXACT_CODE(system,code)`、
  `subject`/`patient`はcanonical `Patient/{logicalId}`、
  `_lastUpdated`はsupported prefix + UTC-normalized precision interval
  `[lower,upper)`だけを検索入力にする。秒/小数1〜3桁のquantumとtimezoneを
  API-008 §5.1どおりparseし、fingerprintはprefix/lower/upper tupleを使う。
  predicateはeq `lower<=t<upper`、gt `t>=upper`、ge `t>=lower`、
  lt `t<lower`、le `t<upper`。repeat AND/comma ORの各clause構造を維持し、modifier/chaining/unknown/
  empty/filterless queryを索引fallbackへ流さない。
- identifier writeはsystemありなら`ANY_SYSTEM(value)`と
  `EXACT_SYSTEM(system,value)`、systemなしなら`ANY_SYSTEM(value)`と
  `NO_SYSTEM(value)`へ同じcommit sequenceのdeltaを作る。これによりbare queryは
  any system、empty-system queryはsystem absentだけとなり、fingerprintとcandidate
  partitionが一致する。
- writeごとにvalidated BEFORE version（createはempty set）とaccepted AFTER
  versionから、全multi-valued indexed fieldの**distinct canonical partition set**
  `B`/`A`をTWI列挙前に作る。重複Identifier/Coding/tokenはpartition単位でdedupeし、
  複数identifierが同じvalue/異systemなら`ANY_SYSTEM(value)`は1件へcollapse、
  `EXACT_SYSTEM(system,value)`はsystemごとに維持する。
- `A`の各partitionへNEW `metaVersionId`の`present=true` deltaをexactly once作る。
  `B ∩ A`のretained tokenも新versionのtrueを作り、falseは作らない。
  `B \ A`の各partitionへNEW `metaVersionId`の`present=false`をexactly once作る。
  delta item identity/action targetをdedupeし、同一itemへの複数actionを禁止する。
  この確定済みdelta setを§5のdistinct action/operation-after size preflightへ渡す。
- `membershipQueryFingerprint`はAPI-008 §5.1のlength-prefixed structured tupleの
  SHA-256であり、URL文字列やparameter順序をauthorityにしない。`_count`はmembership
  fingerprintから除外し、snapshot METAのpage sizeへ別に拘束する。index lookup、
  METAのmembership query digest、CapabilityStatementは同じgrammar/versionを使う。
- as-of fence以下のdeltaをlogicalIdごとにvalidateしlatest add/removeへ縮約した後、
  comma alternativesをunion、repeat occurrenceをintersection、異なるclinical
  parameterをintersection、subject/patientを同一slotへnormalizeしてintersection、
  最後に`_lastUpdated` predicateをintersectionする。各段階でlogicalIdをdedupeし、
  as-of `(lastUpdated, logicalId, versionId)`をsortしてmanifest化する。空集合は
  empty searchsetで、filterless fallbackではない。
- PHI を含むトークンはテナント別鍵の**決定的 HMAC トークン**(§9)。非 PHI の code トークンは正規化 code-system|code 文字列を SEC 承認のうえ可(§9)。
- **氏名・カナ・部分一致は本索引で扱わない**(M4: HMAC は prefix/substring を保存しない=暗号学的に不可能)。患者の氏名/カナ部分一致検索は §4.2 の API-001 投影経由とする。FHIR facade の `name` 検索は MVP で**未対応宣言**(OperationOutcome)。
- index itemはimmutable deltaで、`present`, `lastUpdated`, `logicalId`,
  `metaVersionId`, `indexCommitSequenceDecimal`, `retentionExpiresAt`
  (下記keep-latest圧縮の条件式が読む保持期限。書込時に確定し更新しない)を
  保持する。AFTERの全partition
  （retained tokenを含む）は`present=true`、BEFOREだけのpartitionは
  `present=false`であり、既存deltaをupdate/deleteしない。cursor expiry + maximum clock
  skew + approved safety windowまでは必ず保持し、その後もactive snapshotが参照中なら
  削除しない。indexは再生成可能projectionだが、上記retention期間中の再構築で
  old generationを破棄しない。判定はcursor参照の有無ではなく期限で行う(§4.1)。
- **保持は無期限ではなく、keep-latest圧縮で有界化する(round-4 HIGH訂正)**。
  以前の版は保持期限だけを定め、期限後のdelta圧縮規則を持たなかった。その読み
  では (a) 全deltaを恒久保持して読取・走査コストがpartitionの全書込履歴に比例
  して不可逆に劣化するか、(b) 規則なき削除を実装が補って必要なdeltaが消えるか、
  のどちらかに落ちる。圧縮を次のkeep-latest規則として定義する。
  - 圧縮単位は`(partition, logicalId)`。ある delta `d` を削除できるのは、同一
    `(partition, logicalId)` により大きい`indexCommitSequence`を持つ delta `s`
    (superseding delta)が存在し、**かつ `s` 自身が retention 期限(cursor
    expiry + maximum clock skew + approved safety window)を経過している**
    ときだけである。**latest deltaは削除しない**。
    **`s` の経過を要求するのが本規則の核心である(round-5 HIGH訂正)**: 以前の
    版は削除対象 `d` の経過だけを条件にしていたが、`d` が古く `s` が新しい場合、
    `d.indexCommitSequence <= fence < s.indexCommitSequence` を満たす as-of
    fence は依然 retention 内に存在し得る。その fence の materialization は
    `d` を読んで membership を決めるため、`d` を消すと当該 snapshot から
    logicalId が **silent に欠落**する。これは本節末尾の barrier 不変条件
    (retention 期限より新しい as-of fence の結果を変えない)と数学的に矛盾する。
    `s` が期限を経過していれば、`d` を必要とする fence 区間は全て期限外である。
  - latestが`present=false`でretention期限を経過した`(partition, logicalId)`は
    pair全体を削除できる。期限後の新規読取にとって「latest false」と「delta
    不在」はmembership上等価である。latest 以外の delta の削除可否は上記の
    superseding-delta 条件に従う(pair 全体削除はその特例であり、例外ではない)。
  - 圧縮はclinical TWIの外で走る有界のbackground保守操作とする。§4.1と同型の
    実測bound(走査件数・削除件数・経過時間)を課し、超過時は中断して再開可能と
    する。削除対象はexact `(PK, SK)`で指定する。並行writerの新規deltaは必ず
    より大きい`indexCommitSequence`を持つため、削除対象と交差しない。
  - **削除条件を機械強制する(round-5 security訂正)**。以前の版は上記2条件を
    proseとbarrier testだけに委ねていたが、本batchは§5.2の`identityDigest`と
    §6.4のpayload削除について「破壊的操作をapplicationの自己抑制に委ねない」
    基準を既に採っており、存命recordの検索欠落(SAF隣接)を招き得る削除にだけ
    その基準を適用しないのは非対称である。したがって次を要求する。
    - 各index deltaは書込時に`retentionExpiresAt`(cursor expiry + maximum
      clock skew + approved safety windowから算出した時刻)を属性として持つ。
      immutable deltaの一部であり後から更新しない。
    - 削除は単一TWIとする:
      `TransactWriteItems(ConditionCheck(superseding delta s: attribute_exists(PK)
      AND s.retentionExpiresAt <= :now) + Delete(d の exact (PK,SK))
      with ConditionExpression: retentionExpiresAt <= :now)`。
      `s`の実在と期限経過、`d`自身の期限経過の3条件が条件式で担保され、
      走査結果が古い場合はTWIがabortする。
    - 圧縮を実行するroleはclinical writerと分離したleast-privilegeとし、
      当該partitionへのDelete以外の権限を持たせない。圧縮の実行記録
      (対象範囲・削除件数・中断理由)を運用監査の対象とする。role分離と
      監査経路は実装WPの承認要件に含める。
  - 圧縮はretention期限より新しいas-of fenceのquery結果を変えてはならない。
    これをbarrier testで証明するまで圧縮を実行しない。**圧縮未実装時の既定は
    「削除しない」でありfail-closed側**である。無圧縮運転の走査コストは
    §13(a)の計測対象へ含める。

### 3.3 型 × 更新時刻 GSI(書込シャーディング)

```text
GSI1PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#FHIRTYPE#{resourceType}#SHARD#{shard}   GSI1SK = UPDATED#{lastUpdated}#RESOURCE#{logicalId}
```

- `shard = hash(logicalId) mod N`(N は設計時定数。過小 N は大規模テナントでホット、過大 N は小規模テナントで読み増幅 — N 選定基準・再シャード方針は §13(a) の計測に紐付けて確定する)。**大規模テナントで単一 resourceType が単一パーティションに集中してホットになる問題(M8)を書込シャーディングで回避**。列挙時は N シャードを跨いでマージ。
- 用途: 合成環境のconformance fixture列挙 / projection catch-up/index rebuild。
  **FHIR REST `_lastUpdated` search/pagingのauthorityには使わず**、§3.2のimmutable
  range deltaを使う。MedicationRequest authorityは新規開始なので
  clinical authority data backfillはない。index rebuildをauthority migrationと
  混同しない。
- 全 GSI PK もtrusted tenant+pharmacy prefixで始まる(§7)。この主張は
  **不変条件であり、新規 GSI を追加する際の必須条件**である。以前の版は §3.5 の
  GSI2 がこれを満たしていないにもかかわらず主張していた。GSI2 は §3.5 で
  pharmacy segment を PK へ含める形へ訂正済みであり、以後 index を含む全 access
  path が pharmacy prefix を持つことを §7 の分離根拠とする。
- 注: 10GB 制約は LSI 固有の item collection 制限で **GSI には非適用**(M8 訂正)。GSI の制約は単一パーティションの ~1000 WCU / ~3000 RCU。

### 3.4 患者サマリ投影 / 患者検索投影(API-001)

患者検索は現行Patient authorityの **PHI投影 + 資格状態**。human cutover前はPostgreSQL、cutover後はFHIR PatientがPatient sourceである。投影は直接編集せず、現行Patient authorityと内部Coverage/資格スナップショットから再生成する。

```text
サマリ:   PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#PATIENT_SUMMARY#{patientId}   SK = CURRENT
検索候補: PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#PATIENT_SEARCH               SK = PATIENT#{patientSurrogateSortKey}#{patientId}
```

- **キーに生の氏名/カナ/患者番号を置かない**(原則7)。氏名・カナ・患者番号は**暗号化アイテムペイロード内**に保持する。
- **MVP の部分一致・カナ検索(M4 決定 Q2)**: 薬局スコープの検索候補アイテム集合(1薬局患者数は有界)を PK 単一クエリで取得し、アプリ内でペイロードを復号して**メモリ上で部分一致/カナ一致**する。キーに PHI を露出せず API-001 の部分一致+カナ要件を満たす。
- **カナ正規化**(全半角・濁点/半濁点・長音)を**索引生成時と照会時で同一適用**する(契約 = 医療 UI の取り違え防止に直結)。
- `patientSurrogateSortKey` は**非 PHI のソート可能サロゲート**(ULID / 内部連番)。「非可逆かつソート可能」は不可(M-minor)なので、非可逆ハッシュをソートキーにしない。表示用患者番号は暗号化ペイロード内。

**候補集合フェッチの上限(MEDIUM-2 訂正・fail-closed)**: 「1薬局患者数は有界」は
未計測の仮定であり、それ自体は上限ではない。全候補の取得と復号を無制限に行う
設計は、大規模薬局・移行直後・異常データで RCU/メモリ/レイテンシを線形に
消費する。したがって次の configured bound を **実測ベースで** 課す。

| Bound | 対象 | 超過時 |
|---|---|---|
| `maxFetchedCandidateItems` | PK クエリで取得する検索候補アイテム件数の累計 | fail-closed overload |
| `maxDecryptedPayloadBytes` | 復号したペイロードの累計バイト数 | fail-closed overload |
| `maxMatchWorkingSetBytes` | マッチング中に保持する in-memory working set | fail-closed overload |
| `maxSearchWallTime` | 1 リクエストの検索経過時間 | fail-closed overload |
| `maxConcurrentSearchesPerScope` | tenant+pharmacy scope の同時実行検索数 | fail-closed overload |

- bound は推定でなく**実測でインクリメンタルに**評価し、到達時点で即中断する。
- **fail-closed overload result**: 部分一致結果を返さない。truncated results、
  近似 `nextCursor`、silent な件数削減のいずれも行わない。API-001 §4 の
  エラー契約に従い、上限超過を表す明示のエラーで拒否する(具体の
  status/error code は API-001 の改版で確定し、本書で先行定義しない)。
- **measured cap**: 各 bound の値は合成データでの実測(1薬局あたり患者数分布、
  ペイロードサイズ分布、復号コスト)から決定し、承認を得る。§13(c) の計測項目へ
  「候補集合フェッチ件数・復号バイト数・p95 レイテンシ」を含める。
- **非 PHI 粗インデックス代替**: production 利用の前に、全候補復号に依存しない
  検索経路(非 PHI の粗バケット索引 + 絞り込み後の限定復号)の採否を決定する。
  採用する場合、粗バケットの選択で PHI が推測可能にならないこと(バケット
  cardinality と分布の安全性)を SEC-008 で評価する。決定前は本方式を
  production の既定にしない。
- 上記が未確定である間、患者検索は合成データ環境に限定し、production 適用を
  `BLOCKED_PATIENT_SEARCH_SCALE_BOUND` とする。

### 3.5 受付エントリ(内部運用集約 — Q1)

Reception は MVP で内部運用集約を維持する(§Q1)。

```text
キュー:  PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#RECEPTION#DATE#{yyyyMmDd}   SK = ACCEPTED#{acceptedAtIso}#RECEPTION#{receptionId}
GSI2:    GSI2PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#RECEPTION#{receptionId}   GSI2SK = DATE#{yyyyMmDd}
```

属性: `receptionId`/`patientId`(branded)/ `acceptedAt`(アプリ供給 UTC)/ `businessDate`(Asia/Tokyo 業務日 MOD-011)/ `receptionStatus`(shared-kernel `RECEPTION_STATUSES`)/ `prescriptionIntakeType`(初期 `paper`)/ `idempotencyKeyHash`(PHI 非包含)。キュークエリは基表 SK 昇順で `acceptedAt asc + receptionId asc` を自然に返す。GSI2 は receptionId 直接引き(高カーディナリティ=ホットなし)。

**GSI2PK に pharmacy segment を含める(HIGH-8 訂正の補完)**: 以前の版の GSI2PK は
`TENANT#{tenantId}#RECEPTION#{receptionId}` で pharmacy を GSI2SK 側に置いていた。
これは §7 の `dynamodb:LeadingKeys` を tenant + pharmacy 粒度へ拡張する訂正の
**反例**であり、当該 GSI だけが prefix 条件の外に出る。その結果、(a) GSI2 query が
prefix 条件に一致せず冪等 lookup が壊れるか、(b) 条件が効かず同一 tenant 内
cross-pharmacy の受付読み取りが DB 層で素通りするか、のいずれかになる。(b) なら
pharmacy 粒度分離はアプリ層の正しさだけに戻り、多層防御という訂正の目的が失われる。
GSI2 lookup は trusted tenantId + pharmacyId を持つ文脈でのみ発生するため、
pharmacyId を PK 側へ移しても機能を失わない。`receptionId` は高カーディナリティを
維持するのでホットパーティションも生じない。

### 3.6 受付冪等ガード

```text
PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#IDEMPOTENCY#RECEPTION   SK = KEY#{sha256(idempotencyKey)}
```

作成フロー: (1) ガード読取(強整合)。(2) 同一 patientId で存在 → 既存受付を返す(200)。(3) 異なる patientId で存在 → 409 `RCV-0003`。(4) 非存在 → `TransactWriteItems`: `Put`ガード(`attribute_not_exists(PK) AND attribute_not_exists(SK)`)+ `Put`キューアイテム(`attribute_not_exists(PK) AND attribute_not_exists(SK)`)。**この2アイテムは別アイテムなので有効**(§5/§6 の同一アイテム制約と対照)。並行同一キーの後着は `attribute_not_exists` で安全に失敗するため、`TransactionCanceledException` を捕捉 → ガード再読込 → 既存返却/`RCV-0003` の回復経路を実装する。

## 4. access pattern

### 4.1 FHIR REST(格納側)

| 操作 | キー/索引 |
|---|---|
| read | current を `...#FHIR#{type}#{id}` / `CURRENT` で Get |
| vread | version を同 PK / `VERSION#{vid}` で Get |
| history-instance | CURRENT + pointed VERSIONをstrong readしてwatermark固定後、history-order PKをdescending Queryしwatermark以下だけを返す |
| create | §5 の create トランザクション。**MedicationRequest のみ**。Patient create は API-008 §2.1 により initially disabled |
| update | §5 の楽観ロックトランザクション |
| delete | API-008 phase matrixでunsupported。既存tombstone readは410、物理削除/復活なし |
| `_lastUpdated` | §3.2 immutable range deltaをQueryし、§4.1 as-of snapshotへmaterialize |
| `identifier`/`subject`/`patient`/`code` | §3.2 exact-token/reference 索引 |

API-008のexact matrixに従う。Patient pre-cutoverとMedicationRequest gates前は
FHIR REST accessなし。Patient post-cutoverは
**read/vread/history/search/update のみ**で、
**createはAPI-008 §2.1によりinitially disabled**(post-cutoverは405、
pre-cutoverはphase-disabledにつき404)。updateもAPI-008 §2.2により
`identifier`/patientNumber slice/`Patient.id`は不変である。
MedicationRequest initialは`intent=order` create/read/vread/history/search
のみ。検索parameterもAPI-008のresource別allowlistと一致させる。
405 `Allow`とCapabilityStatementは同じatomic config generationのLIVE ENABLED
method setからrequest時に投影し、DB設計上のpotential methodを直接広告しない。
blocked search/create/updateは含めず、enabled method 0件ならempty Allowを許す。

FHIR searchは`_count` 1..100(default 20)、`(lastUpdated, logicalId)` ascendingを
固定する。upper watermarkだけのpagingは未読membership消失を防げないため禁止する。

instance historyはAPI-008 §3.1だけを実装する。CURRENTとpointed VERSIONをstrong
readしてidentity/version/digest一致後の`metaVersionId`をwatermarkとする。
history-order PKを`ScanIndexForward=false`でQueryし、watermark超過itemをskipしながら
`lastUpdated desc, metaVersionId desc`で `_count` 件まで読む。各itemが指すVERSIONを
strong readしdigest/tupleを検証する。cursorはtrusted scope/type/id/watermark/count/
last evaluated key/expiry/versionへ署名拘束する。`_count`以外を拒否し、
missing/corrupt/duplicate versionは500で全結果を拒否する。later versionは
watermark超過なので、過去lastUpdatedで挿入されてもskipされ既存membershipを
変えない。Bundle entryの`fullUrl`はabsolute unversioned
`[base]/{type}/{logicalId}`で全version同一とし、history URLを使わない。

scope fence:
`PK=TENANT#{tenantId}#PHARMACY#{pharmacyId}#FHIRINDEXFENCE#{resourceType}`,
`SK=COMMIT_SEQUENCE`。FHIR writeはfenceをstrong readし、`bigint + 1`をcandidateとし、
current/version/idempotency/audit-outbox/index deltaと同じTWIで完全tuple CAS更新する。
transaction commitはatomicなので、first-pageがfenceをstrong readした後、その
sequence以下のdeltaは全てdurableで不変である。base-table Queryを
`ConsistentRead=true`で全page exhaustし、GSIの結果整合性をsnapshot根拠にしない。

first pageは各token partitionのdeltaから
`indexCommitSequence <= asOfCommitSequence`だけを取り、logicalIdごとのlatest delta
を選択、`present=true`だけをexactly once残す。結果tuple
`(lastUpdated, logicalId, versionId)`をsortし、次へimmutable materialized snapshot
として保存する。

```text
PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#FHIRSEARCHSNAPSHOT#{snapshotId}
SK = META | SEGMENT#{zeroPad(segmentNumber)}
```

METAはresourceType、membershipQueryFingerprint、query grammar version、order、page size、
asOfCommitSequence、segment count、manifest digest、expiry、schemaVersionを保持。
SEGMENTはordered tupleだけをencrypted保存する。snapshotIdはrandom/opaque/
non-PHI。全Putは`attribute_not_exists(PK) AND attribute_not_exists(SK)`でimmutable。
segmentを先にwriteし、全segmentのcount/digestをstrong read検証した後にMETAを
最後のconditional Putでpublishする。META欠如のpartial snapshotは不可視で、
bounded cleanup対象。META publish後はsegment/METAをupdateしない。
後続pageはsnapshot segmentをstrong readしてdigest/segment cardinalityを検証する。
later writeはdeltaを追加するだけでmanifest membership/versionを変えない。

signed tokenはtrusted tenantId/pharmacyId/resourceType/
membershipQueryFingerprint/query grammar version/order/page size/snapshotId/
manifestDigest/asOfCommitSequence/expiry/token versionへ拘束し、verbatim
`Bundle.link[next].url`だけをcarrierとする。snapshotと必要deltaはexpiry +
maximum clock skew + approved safety windowまで保持する。DynamoDB TTLだけで
安全期限前に削除せず、application retention gateがこの期限を検証してから
cleanupする。**判定は期限一本化とし、「active cursor参照が消えるまで」という
条件は用いない**。cursorはclientが保持する署名付きopaque tokenであり、発行済み
cursorを記録するitemがkey設計に存在しないため、serverはどのcursorが生きて
いるかを知り得ない。cursorの生存はtoken自身のexpiryによって上界が決まる、という
関係で保持期間を導出する。実装不能な条件を残すと、安全側に倒して永久保持するか、
expiryだけで削除しながらSSOTを満たしたと記録するかのどちらかになる。expired/tampered/driftは400 restart、missing/corrupt snapshot/segment/
digestは500 incompleteでfail closed。

**materialization boundの格納側責務(HIGH-7 訂正)**: bound定義はAPI-008 §5.3を
正本とし、本書は格納面の強制を規定する。

- 走査したdelta item数、縮約後candidate logicalId数、生成SEGMENT数、
  operation後SEGMENT byte合計、経過時間を materialization 中に**実測で
  incremental計上**し、boundへ到達した時点でQueryを中断する。
  `Limit`とpaginationは bound を超えないよう設定し、「読んでから捨てる」を
  しない。
- 中断時はMETAをpublishしない。META不在のSEGMENTは不可視であり
  (既述)、bounded cleanup対象として登録する。cleanupは他snapshotのsegmentへ
  触れない。cleanup失敗はretryし、silent放置しない。META不在のsegmentには
  有効なcursorが原理的に発行され得ないため、cleanup可否は期限だけで判定できる。
- `maxConcurrentSnapshotsPerScope`は**期限付きlease item**で強制する。
  materializationごとに1 leaseを作り、`maxMaterializationWallTime` + safety
  marginで自動失効させ、同時実行数はlease生存数で数える。leaseもtrusted scope
  配下に置き、caller供給値をkeyにしない。**単純counterにしてはならない**:
  increment済み・decrement未実行のままprocessがcrash(OOM、deploy中のSIGKILL)
  するとcounterが上限に張り付き、当該scopeの全searchが恒久的に429になる。
  429/503はserver側の自動retryを伴わないため自己回復もせず、fail-closedを狙った
  boundが可用性の恒久喪失へ転化する。lease方式ならcleanup失敗時も時間経過で
  必ず回復する。
- client切断・timeout・shutdownでmaterializationを継続しない。バックグラウンドで
  完走させてMETAを後から publish しない。

mechanism/cleanup/concurrency test実装と上記boundの実測確定までは
`BLOCKED_FHIR_SEARCH_SNAPSHOT_IMPLEMENTATION`でsearch非広告・非実装。

### 4.2 患者検索 API(API-001)

| 操作 | access pattern |
|---|---|
| `GET /patients/search` | §3.4 検索候補を薬局スコープで Query → ペイロード復号 → メモリ内で氏名/カナ部分一致 → カーソルをテナント/薬局/クエリに拘束してページング |
| `findById` | 現行authority由来の`PATIENT_SUMMARY#{patientId}`をGet。automatic fallbackなし |

患者検索投影は非正本。現行Patient authorityと内部Coverage/資格スナップショットから再生成できる。

### 4.3 受付キュー API(API-006)

| 操作 | access pattern |
|---|---|
| `GET /reception/queue?date=YYYY-MM-DD` | `...#RECEPTION#DATE#{date}` を SK 昇順 Query。**日付は明示。サーバ側 "today" を推論しない** |
| `POST /reception` | 患者サマリ投影を取得 → §3.6 冪等ガード + キューアイテムのトランザクション |
| 冪等再送 | ガード読取 → 基表/GSI2 lookup。**登録直後 lookup は強整合の基表ガードに依存**させ、結果整合の GSI2 に依存させない |
| 競合 | 異 patientId ガード存在 → `RCV-0003` |

### 4.4 汎用投影 API / PH-OS

```text
PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#PROJECTION#{projectionName}
SK = SUBJECT#{patientId}#DATE#{yyyyMmDd}#RESOURCE#{resourceType}#{logicalId}
```

投影例はhistorical design illustrationであり、本WPはPatient/oral-topical MedicationRequest以外のresource/store/projection実装を認可しない。**partner 中立**: `PH-OS` は認可・契約テストのpartner app/clientとしてのみ現れ、格納キー名・専用scopeに現れない。

## 5. 楽観ロック(M1 修正)

FHIR current は `metaVersionId` を書込バージョンとする。**同一 `CURRENT` アイテムへ `ConditionCheck` と `Update` を1トランザクションに併用しない**(DynamoDB は同一アイテムへの複数オペレーションを `ValidationException` で拒否する)。条件は **`Update` の `ConditionExpression` に統合**する。

```text
idempotency:
  PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#FHIRIDEMPOTENCY#{resourceType}
  SK = KEY#{hmacIdempotencyKey}

rotation control:
  PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#FHIRIDEMPOTENCY#CONTROL
  SK = ROTATION
  attributes = { generation, mandatoryVersionSetDigest, state }

authority control (§5.1):
  PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#FHIRAUTHORITY#{resourceType}
  SK = CONTROL
  attributes = { authorityState, authorityEpoch, writerFenceToken }
```

### 5.1 resource authority control item(API-008 §9.1)

rotation controlはlookup-key設定だけを束縛し、**当該resourceの書込権威が今どの
storeにあるか**を束縛しない。この状態を束縛しないTWIは、cutover進行中や巻き戻し
直後にPostgreSQL側とFHIR側の双方がcommitし得る。したがってresourceTypeごとの
persisted authority control itemを置き、全clinical TWIへそのConditionCheckを
含める。

- `authorityState`: §11の`POSTGRES_PRIMARY → SHADOWING → CUTOVER_PENDING →
  FHIR_PRIMARY`に加え、rollback後を表す`POSTGRES_PRIMARY_ROLLED_BACK`。
  **単調前進ではない**。
- `authorityEpoch`: monotonic uint64。§3のSK数値正準形と同じ
  `bigint`/base10/JS number非経由の規律に従う。**単調増加は本fieldだけの性質**
  であり、state遷移およびrollbackを含む全変更で必ず増加する。
- `writerFenceToken`: 当該epochで書込を許可されたwriterへ**発行**された非PHI
  opaque値。epochと同時にのみ変わる。

**`authorityState`の単調前進主張は撤回する(HIGH 訂正)**。§11はcutoverの
rollbackを想定しているのに、以前の版はrollback後の状態を表す値を持たなかった。
その結果stateは`FHIR_PRIMARY`のまま残り、writer前提を「stateが`FHIR_PRIMARY`で
あること」とした判定では**rollback後に新しく起動したFHIR writerが前提も
ConditionCheckも通過**した。epoch fenceが止められるのは既にtokenを持っている
stale writerだけで、fresh writerは止まらない。単調性はepochだけが持つ。

規律:

- 全clinical writeはこのitemを`ConsistentRead=true`で読む。
- **writer前提の判定は「stateが期待値」では不十分**である。writerは自分の
  `writerFenceToken`を**control itemからではなく起動時configurationまたは
  発行されたleaseから**保持し、読み取った値が自己保持値と一致することを要求する。
  以前の版の`writerFenceToken`は、読んだ値をそのままConditionCheckへ入れるだけ
  だったためidentityとして機能せず、`authorityEpoch`の冗長コピーにすぎなかった。
- **ただしこの自己保持は現設計では構造的に強制できない**。tokenはcontrol itemの
  平文attributeとして保存され、全clinical writeが同itemを`ConsistentRead`で読む。
  DynamoDBのConditionCheckは「supplied value == stored value」しか表現できない
  ため、**writerがtokenをcontrol itemから読んで自己保持値と称しても、DynamoDB層
  では正当な保持と区別できない**。「control itemから取得した値で自己照合しない」は
  §11でPostgreSQL側について正しく退けたのと同じ**applicationの自己抑制**であり、
  同一batch内で片側にだけ厳しい基準を適用するのは非対称である。さらにtokenの
  発行主体、配布経路、epoch更新時の再配布、lease失効規律がいずれも未定義であり、
  実装にとって最も安価な解は「control itemから読む」——すなわち§12が禁じている
  実装そのものである。禁止だけあって供給経路がない規律は破られる方向へ圧力が
  かかる。したがって次のいずれかを承認するまで、本fenceだけでfresh writerの
  排除が成立するとは主張しない。
  1. tokenをDynamoDBから取得不能な値に変える。control itemには
     `writerFenceTokenId`と発行元だけを置き、照合をSTS session tag、KMS由来
     credential、lease itemのowner principalなど**writerが自称できない属性**へ
     拘束する。
  2. またはtokenにCSPRNG由来・epochごと独立というMUSTを課し、発行主体と配布
     経路(configuration deployかlease service)を選択してSSOTへ固定し、
     epoch advanceとwriter fleet更新の順序およびその間の503窓を明記する。
  それまで`BLOCKED_WRITER_FENCE_TOKEN_ISSUANCE`とする。§11 test obligationsには
  「control itemから読んだ値を自己保持値として使わない」ことのnegative testを
  含める(現行は挙動のtestはあるが供給元のtestがない)。
- 同一TWIへ
  `ConditionCheck(authorityState = :s AND authorityEpoch = :e AND writerFenceToken = :w)`
  を含める。これは1 action / 1 itemとして§5のdistinct action数と
  operation後aggregate item sizeへ算入する。
- 読取後commit前にepochが進んだwriterは必ずabortする。abortはAPI-008 §4.3の
  ambiguous outcome経路で扱い、自動write retryしない。
- `authorityState`が自分のwriter前提と異なる場合はDynamoDB write前に503とし、
  TransactWriteItemsを発行しない。
- rotation controlのConditionCheckはこれと**別item・別action**であり、
  どちらかで他方を代替しない。

**cross-store atomicityを主張しない**: PostgreSQLのtransactionとDynamoDBの
TransactWriteItemsは同一のatomic unitではない。両者に跨るcommit/rollbackの
連動を設計・記述・実装しない。cutoverの安全性はatomicityではなく、
停止 → drain確認 → epoch advance/fence → 新writer開始という**時間的に重ならない
単一writerの交代**によってのみ担保する(§11)。要約時も第1段(停止)を省略しない。

**ただしその時間順序を強制するprimitiveがPostgreSQL側に存在しない**。この
ConditionCheckはDynamoDB側writer同士しか拘束せず、「PostgreSQL側writerを停止
する」はapplicationの自己抑制でしかない。詳細と解除条件は§11に記す。
`BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE`が解除されるまで、本節のfenceだけで
single-writerが担保されたと主張しない。

### 5.2 idempotency record、lookup、rotation、write transaction テンプレート

raw `Idempotency-Key`をkey/logへ置かない。lookup keyとAPI-008 fingerprintは
tenant-scoped secretからpurpose-separated keyでHMACし、key rotation/versionを
`lookupKeyVersion`としてrecordに保存する。record schemaとfingerprint schemaの
versionは別fieldで混同しない。

idempotency recordが保持する最小field setは**API-008 §4.1.1を正本**とする。
本書はその格納面だけを規定し、field setを二重定義しない。特に次を守る。

- raw response bodyもraw request payloadも保存しない。replayは参照する
  immutable VERSIONの`resourceJson`へ、保存済み
  `resourceJson` octet列を**verbatimで返す**。parse・再直列化・正規化を経由
  しない。直列化は書込時に一度だけ行い、その出力を`resourceJson`として格納する
  (§3.1)。`responseBodyDigest`一致を検証してから返す。
- digest不一致は500であり、近似bodyを返さない。
- `responseContentType`はrecordへ明示保存し、後の既定変更が黙ってreplayを
  変えないようにする。

lookupはactive + retained lookup-key versionsのbounded configured setをversion
ascendingで全件計算し、全候補をstrong readする。old key material/discoverabilityは
そのversionの全record lifetime + maximum clock skew + approved safety window以上
secret storeで保持する。**本batchではretirement自体がunsupported**(§5.2)であり、
期間経過後もkey materialを削除せずretained setは単調増加のみとする。新規writeはwriterに
設定されたactive + retainedの**全version**について、同一clinical TWI内で
immutable alias/guard recordを1件ずつconditional Putする。各aliasは
`requestByteFingerprint, logicalId, versionId, status, Location,
ETag, resourceDigest, replayUntil`の**同一**canonical outcome tupleを保持する。
`lookupKeyVersion`はこのtupleに**含めない**。aliasはlookup versionごとに1件
作られ各々が自分のversionを保持するため、`lookupKeyVersion`は
**alias間で異なるのが正常**である。以前の版はこれをtupleへ混入させており、
literalに実装するとactive=v2 / retained={v1,v2}のtenantで同一bytesの再送が
2件matchし、`lookupKeyVersion`がv1≠v2で「全tuple一致」に失敗して
integrity errorになる。これは異常系ではなく**rotationを行った全tenantの
全replayで常時発生**し、§4.1.1の`BLOCKED_REPLAY_PERMANENT_FAILURE`と合成すると
clientは別keyを送るしかなく重複リソース作成へ誘導される。同一性要求の対象は
API-008 §4.2が正本であり、本書はそれを二重定義しない。
複数matchは上記tupleが一致するときだけreplayし、不一致・corruptはintegrity error。
approved boundを超えるrotationは開始しない。secretをrecord/docs/logへ置かない。
recordは`replayUntil`を持ち、その時刻 + skew/safety window前にTTL/cleanupしない。
retention未承認ならrecord/key versionとも削除しない側へ倒す。

rotation configはmonotonic generationを持ち、rollout中のversion setはadditive
supersetとする。上記rotation control itemがtrusted tenant+pharmacy scopeの
authoritative persisted fenceである。writerは`ConsistentRead=true`で読み、
local configがmandatory setをexactにcoverすることを確認する。欠落/余分version、
digest mismatch、generation regression、`state != ACTIVE`はDynamoDB write前に503。
digestはstable ascending version identifierをuint32-be length-prefixで連結した
SHA-256とする。
全clinical TWIは同control itemへ
`ConditionCheck(generation=:g AND mandatoryVersionSetDigest=:d AND state=:ACTIVE)`
を含める。

**lookup-key retirementは本batchでunsupported**である(API-008 §4.2.1が正本)。

**論拠を事実へ訂正する(HIGH 訂正)**: 以前の版は「alias recordはresource
instanceのPK配下に分散し、lookup versionを軸に全件列挙するaccess pathが存在
しない」としていたが、これは本書自身のkey設計と矛盾する。aliasのkeyは上記の
`PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#FHIRIDEMPOTENCY#{resourceType}` /
`SK = KEY#{hmacIdempotencyKey}`であり、resource instanceごとではなく
**(tenant, pharmacy, resourceType)ごとの単一partition**である。したがって
単一PKのpaginated Queryで全件列挙でき、各aliasは`lookupKeyVersion`を保持する。
「列挙不能」は誤りであり撤回する。また「fence後に新残存が生じない」条件は、
§4.2のgeneration fenceが既に満たしている。

実際に不足しているのは、(a) 走査コストのbound(当該partitionは全writeのaliasを
retained version数だけ倍増させて蓄積する)、(b) `replayUntil`満了と残存zeroを
同時に証明する手順、(c) 走査途中失敗・fence advance後のkey removal失敗・部分
削除からの復旧semanticsである。保守的結論は維持するが、根拠はこれである。

**この単一partitionはhot partitionになる**。全writeがretained version数だけ
aliasを書き込むため、書込集中は§6.3のaudit chainと同型の問題を持つ。§13(a)の
計測対象へ含める。

- retained lookup-key setは**単調増加のみ**とし、versionをmandatory setから
  外すoperationを定義・実装・実行しない。key materialは削除しない。
- retained setがapproved boundへ接近した場合はrotationを開始せずsecurity
  reviewへ返す。boundを超えるためのretirementを回避策にしない。
- retirementを可能にするには、走査のbound、`replayUntil`満了と残存zeroの同時
  証明手順、fence advance→走査→key removalの順序、各段階のfailure/rollback
  semanticsを定めたapproved amendmentを要する。既存の単一PKで走査可能なので、
  `FHIRIDEMPOTENCYBYVERSION`のような別access pathを新設する前提を置かない。
  それまで`BLOCKED_LOOKUP_KEY_RETIREMENT`とする。
- **retained setの単調増加がaction budgetを侵食する**。全writeはactive+retained
  の全versionについてalias 1件をconditional Putし、各aliasは1 action/1 itemと
  して100/4 MiB budgetへ算入される。write TWIの固定actionは
  AUTHORITY CC + ROTATION CC + CURRENT + VERSION + history-order + fence CAS +
  audit intent = 7 であり、残り93をalias数`N`とindex delta数が分け合う。
  **index delta数はresource 1 versionのpartition数ではなく、当該writeが生む
  delta set `|A ∪ (B \ A)|`である(round-4 undercount訂正)**。updateはBEFORE
  versionのtoken除去(false)とAFTER versionのtoken追加(true)が全て入れ替わる
  最悪ケースで`|B| + |A|`まで達するため、per-version cap 1個分だけを差し引く
  以前のinvariantは最大でcap 1個分を過少計上していた。capとinvariantを次の
  とおり定める。
  - `maxIndexedTokenPartitions`は**resource 1 versionが属するdistinct canonical
    partition数の上限**であり、`_lastUpdated` range partition(version当たり1)を
    含む全indexed parameterを算入する。
  - operation別invariant(いずれもSSOT上のjoint invariantであり、API-008
    §4.2.1と同一定義):
    - MedicationRequest create: `7 + maxIndexedTokenPartitions + N <= 100`
      (`B`は空集合)
    - Patient update: `7 + 2*maxIndexedTokenPartitions + N <= 100`
    - Patient create(将来有効化時): `7 + maxIndexedTokenPartitions + 2N <= 100`。
      patientNumber uniqueness guardは本節の規律どおりactive+retained
      **全version**へ同一TWIでconditional Putするため、guardも`N`件を占める。
      「guard 1件」を前提にした算入(以前のAPI-008 §2.1)は過少計上であり、
      本定義へ一本化する。
  - **評価点はwrite preflightである**。capは宣言値ではなく、§5のdistinct
    action/size preflightがBEFORE/AFTER実測のdelta set・alias数・固定actionを
    合算して評価する。いずれかのversionのpartition数が
    `maxIndexedTokenPartitions`を超える場合、または合算が100 actions/4 MiBを
    超える場合は、DynamoDB call前に422 `business-rule`でfail closedする。
  - **API-008 §7.1のJSON構造capはこのcapを含意しない(round-3訂正)**。
    identifier 1件は`ANY_SYSTEM`と`EXACT_SYSTEM`/`NO_SYSTEM`の2 partitionを
    生むため、`maxJsonArrayElements <= maxIndexedTokenPartitions`という数量
    関係は成立しない。partition capの強制はpreflightの実数カウントだけが担い、
    JSON capはparse作業量のboundにとどまる。
  - bound接近をrotation開始時だけでなくwrite preflight時にも監視する。
    retirementで`N`を減らす回避策は取らない。この上限がないと残余が計算不能と
    なり、identifierの多い患者だけが後からpre-write 422で**恒久的に書込不能**に
    なるdead-endが生じる。
- **key compromise時の緊急経路が存在しない**。HMAC lookup keyが漏洩しても
  mandatory setから外せないため、全新規writeがcompromised keyのaliasを作り
  続ける。本batchはこの状態を受容しており、これは`BLOCKED_LOOKUP_KEY_RETIREMENT`
  の一部としてsecurity reviewの判断対象である。

persisted rotation fence(generation/mandatory digest/ACTIVEのsame-TWI
ConditionCheck)はretirement可否と独立に維持する。
stale/reanimated writerは旧generationのConditionCheckでcommitできない。
新writerは旧version aliasも
conditional Putするため旧/新writer同時実行は共通旧aliasで一方だけcommitする。
旧writer先行時も新writerは全version pre-readで旧aliasを発見する。aliasをTWI外で
backfill/overwriteしない。

**create** (`If-Match`は使わない。API-008 §2.1により**Patient createはinitially
disabled**であり、本テンプレートが適用されるのはgate完了後のMedicationRequest
だけである。Patient createを将来有効化する場合は、下記に
`Put(immutable PATIENTNUMBER uniqueness guard)`
`ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)`
を同一TWIへ追加し、action/aggregate budgetへ算入する必要がある。guard keyは
`PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#PATIENTNUMBER`,
`SK = VALUE#{hmacPatientNumber}`とし、生のpatientNumberをkeyへ置かない(原則7)。
このHMACは`HKDF(root, tenantId, pharmacyId, purpose="patientNumberGuard")`の
ように**pharmacy と用途で分離した鍵**から導出し、§9 Q4のtenant単位鍵を流用しない。
tenant単位鍵では同一tenant内の全薬局で同じpatientNumberが同じdigestになり、
patientNumberは低エントロピー(多くは連番)なので、鍵漏洩時に全薬局の使用中番号を
総当たりで列挙でき薬局ごとの母集団規模と登録密度が判る。さらにguardには
`lookupKeyVersion`相当を持たせ、rotationをidempotency aliasと同じ
「active + retained全versionへ同一TWIでconditional Put、全versionをstrong read」
パターンへ揃える。**これがないと鍵ローテで一意性が黙って壊れる**: v1→v2で同じ
patientNumberから異なるSKが導出され、`attribute_not_exists`が成功して重複
Patientが生成され、例外もエラーも出ない。§9の「決定的トークンゆえ鍵ローテ =
索引再構築」は再生成可能な検索索引の話であり、正しさの不変条件であるguardには
適用できない。possible-match/manual resolution、merge/unmerge lineage、
patientNumber再利用可否、およびこの鍵導出/version/rotation規律が承認される
まで有効化しない):
```text
ConditionCheck(AUTHORITY control) exact authorityState + authorityEpoch + writerFenceToken
+ ConditionCheck(ROTATION control) exact generation + mandatory digest + ACTIVE
Update/Put(CURRENT) ConditionExpression: attribute_not_exists(PK)
+ Put(VERSION#1)     ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)
+ For each configured active+retained lookup version:
    Put(immutable IDEMPOTENCY alias/guard) ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)
+ Put(immutable history-order item) ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)
+ Put(immutable index add/remove delta) ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)
+ Update(FHIRINDEXFENCE) complete-tuple CAS
+ Put(registered audit/outbox intent)
```

`Idempotency-Key`、request-byte fingerprint v1、replay precedence、record
schemaはAPI-008
§4を正本とする。idempotency recordはcurrentと同じtrusted tenant+pharmacy
prefixを持つ。fingerprint bytesはaccepted request-entity bytesをparse/
normalization/re-serialization前にcaptureしたoctet列で、byte-different JSONは
different intent。same fingerprintではreferenced immutable version/digestを強読して
original resultを返し、currentだけでreplay判定しない。different intentは409。
corrupt/missing referenceはintegrity error。TWI cancellation/ambiguous outcomeは
全active/retained lookup versionsをstrong readし、same bytesはexact replay、
different bytesは409、bounded reconciliation後もabsentなら503、multiple conflict/
corruptはfail closed。recordをoverwriteせずautomatic write retryは行わない。

**Patient update(If-Match + Idempotency-Key)**:
```text
ConditionCheck(AUTHORITY control) exact authorityState + authorityEpoch + writerFenceToken
+ ConditionCheck(ROTATION control) exact generation + mandatory digest + ACTIVE
Update(CURRENT)  ConditionExpression: metaVersionId = :expectedVersion AND identityDigest = :expectedIdentityDigest   (resourceJson 更新, metaVersionId+1, lastUpdated=アプリ供給)
+ Put(VERSION#new)  ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)
+ For each configured active+retained lookup version:
    Put(immutable IDEMPOTENCY alias/guard) ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)
+ Put(immutable history-order item) ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)
+ Put(immutable index add/remove delta) ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)
+ Update(FHIRINDEXFENCE) complete-tuple CAS
+ Put(registered audit/outbox intent)
```

wireの唯一のversion authorityは`If-Match`であり、adapterの`expectedVersion`は
検証済みheaderから一度だけ導出する。body/query/別fieldを第二authorityにしない。
enabledなPatient PUTは毎回stable idempotency keyとrequest-byte fingerprintを持つ。
missing keyはTWI前にAPI-008の400 `required`（yrese coding absent）で拒否する。
MedicationRequest PUTはdisabledのまま405である。
stale/ambiguous failureをautomatic write retryしない。

**identity不変性をTWIで構造的に強制する(HIGH 訂正)**: API-008 §2.2は
post-cutover Patientの`identifier`、patientNumber slice、`Patient.id`を不変と
宣言し、違反をTWI発行前の422で拒否する。しかしそれだけでは**applicationの
自己抑制**にすぎず、adapterの分岐漏れ、refactoring、あるいは2経路目のupdate path
(将来のbulk correction、data-fix script、admin route)が事前検証を通らずにTWIを
組めばDynamoDBは何も拒否しない。本書は§11のPostgreSQL側停止と§5.1の
`writerFenceToken`について同じ性質を理由にblocker化しており、**本batchで最も
患者安全に直結する不変条件にだけその基準を適用しないのは非対称**である。

したがってCURRENT itemへ`identityDigest`属性を持たせ、上記のとおり
`Update(CURRENT)`のConditionExpressionへ合成する。

- `identityDigest`は、当該Patientのidentity tupleに対するSHA-256である。入力は
  §4.1と同じ`uint32-be byteLength || exact UTF-8 bytes`のlength-prefix連結とし、
  (1) `system|value`をcode point順にsortしたidentifier列、(2) patientNumberを
  表すidentifier sliceのvalue、(3) `logicalId`をこの順で連結する。set/order
  ambiguityを許さない。
- adapterは`:expectedIdentityDigest`を**validated request resourceのidentityから**
  導出する。requestがidentityを変更していれば導出値は格納値と一致せず、TWIは
  atomicにabortする。変更していなければ一致して通過する。
- この照合は**action数を増やさない**。既存の`Update(CURRENT)`の条件式へ項を
  足すだけであり、§5の100 action / 4 MiB budgetにも
  `maxIndexedTokenPartitions`のjoint invariantにも影響しない。
- API-008 §2.2のTWI前422は引き続き一次拒否として維持する。ConditionCheckは
  それを置き換えるのではなく、事前検証を迂回した経路に対する構造的backstopで
  ある。両者が揃って初めてidentity不変性が「宣言」から「強制」になる。
- `identityDigest`はitem属性であり、**key・GSI key・log・metric labelへ置かない**
  (原則7)。保存時暗号化の対象内に置く。
- cutover transaction(§11)が作るVERSION 1のCURRENTにも同じ規則で
  `identityDigest`を設定する。属性が存在しないCURRENTに対しては
  `identityDigest = :expectedIdentityDigest`がfalseに評価されて条件が落ちるため、
  未設定itemへのupdateは自動的にfail-closedになる。これを「設定漏れでも通る」
  方向へ緩めない。

rotation fence、current、immutable version、history-order item、全同期search
index、immutable idempotency alias/guard set、registered audit/outbox intentは
同一transactionでatomicにcommitし、一つでも失敗
すれば全体abortする。outbox intentはaudit factではない。2xxはdurable commit後だけ。
登録済みinternal auditへexactly-once convergenceする。event名は本書で発明せず、
MOD-008のread/search/create/update/deny/failure mappingが承認されるまで
`BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT`。`If-Match`欠如は400 `required`、
staleは412 `conflict`。

TWI構築前にauthority control ConditionCheck(§5.1)、rotation control
ConditionCheck、current、version、
active+retained全alias/guard、全index delta、fence CAS、audit/outbox intent、
immutable history-order item、その他固定itemを含む全action targetを列挙する。最大100は**distinct item action
target数**であり、同じitemへ複数actionを置かない。AWS 4 MiBはrequest/expression
bytesではなく、全distinct itemのDynamoDB item-size ruleによる
**operation後item size aggregate**である。Putはnew item、Updateは更新後item、
Delete/ConditionCheckはexisting item sizeを保守的に算入し、exact boundを証明
できなければwriteしない。rotation control/aliasも各1 action/itemである。
100 actions/4 MiB以下だけを許し、101 actionsまたは4 MiB超はDynamoDB call前に
422 `business-rule`へfail closedする。SDK request-size guardは別の保守的internal
limitとして追加可能だがAWS 4 MiBと呼ばない。preflight後のitem追加、複数TWIへの
chunking、partial commit、transaction外補完は禁止する。

各operation後itemはDynamoDB 400 KB以下を要求する。validated FHIR resource/itemが
超過すれば422で、TransactWriteItems/S3 write call=0。bounded
Patient/MedicationRequest authorityに
S3 pointer/offload/cross-service fallbackはなく、partial write/2xxを返さない。
client supplied ProvenanceのPOST/PUTはtransactionへ入れず拒否する。Provenanceは
commit済みinternal auditからのみ生成するread-only derivativeである。

実装前のnegative/barrier testsはcreate/update双方で、TWI各item境界の
cancellation/timeout、parallel same-key same-bytes、same-key different-bytes、
response loss、lookup-key rotationを注入する。どのbarrierでもaccepted logical
operation当たりcurrent resource、新immutable version、audit-outbox intent set、
canonical outcome setは最大1で、各configured versionの
idempotency aliasは最大1であること、same bytesはexact result replay、
different bytesは409、全version不在は503、corrupt/multiple conflictはfail closed、
conditional idempotency Putをoverwriteへ弱めないことを証明する。
old-active/new-active writerのconcurrent/sequential barrierではcanonical outcome
setが最大1で、共通alias collisionまたは全version pre-readへ収束することを証明する。
controlをG3へfence(mandatory setはadditive supersetのまま。**retirementでは
ない**)した後にG1 writerをreviveするsequential same-key G1/G3 testでは
stale DynamoDB writes=0、canonical outcome set=1を証明する。「retire」の語は
retained setからの除去だけを指し、active versionの交代は`deactivate` /
`generation advance`と呼び分ける。本testは後者のみを対象とする。
§5.1 rollback testとして、cutover後に`POSTGRES_PRIMARY_ROLLED_BACK` + epoch
advanceした状態で**新しく起動した**FHIR writerがwrite前提を満たさず
DynamoDB write=0であること、writerが自己保持`writerFenceToken`との一致を要求し
control itemを読めるだけでは条件を満たせないことを証明する。
**Patient update と MedicationRequest create** でIdempotency-Key missing、
same/different request bytes、ambiguous resultを固定し、enabled updateのkey省略は
400 `required`かつDynamoDB write=0とする。**Patient POSTはAPI-008 §2.1により
post-cutoverで405 / pre-cutoverで404、DynamoDB write=0**を別項目として固定する
(Patient createのidempotency fixtureを作るためにtest環境でcreate routeを
有効化してはならない)。Patient updateについてはAPI-008 §2.2のidentity不変性
(`identifier`/patientNumber slice/`Patient.id`の変更がTWI前の422 `business-rule`
かつDynamoDB write=0)も固定する。
search delta fixtureはretained-token update、duplicate token、same value across
systems、multi-valued add/removeを含め、distinct `B`/`A`、retained true-only、
removed false-only、delta target/action uniquenessを検証する。
さらにexact 100/101 distinct targets、operation後aggregate 4 MiB直下/超過、
single item 400 KB直下/超過をfixture化し、limit超過時の
TransactWriteItems/S3 write call=0、
write chunking/cross-service fallback=0を証明する。

search contract fixtureは`_lastUpdated`の秒/小数1〜3桁、timezone equivalence、
lower/upper exact boundary、mixed filter、invalid/no-timezoneをAPI-008と同じ
prefix/lower/upper fingerprintで検証する。history fixtureはabsolute unversioned
`entry.fullUrl`がversion間で同一かつhistory URLでないことを検証する。Patient
cutover fixtureはVERSION 1/create/201/`SYSTEM_CUTOVER`を1件だけ作り、
PostgreSQL history backfill=0、audit registry/gate欠如時write=0を証明する。
さらに§11の冪等性fixtureとして、per-patient TWIの部分失敗後の再実行が
PATIENTLINK既存patientをskipし、同一patientIdに対するlogicalId発行が全経路で
高々1件であること、link Putの条件不一致でTWI全体がabortすること、最終epoch CAS
の再実行が二重適用されないこと、index delta圧縮のbarrier test(retention期限
より新しいas-of読取の結果不変・latest delta非削除)を証明する。
round-5訂正に対応するfixtureとして次を追加する。
- **圧縮のsuperseding条件**: 古い`d`が新しい`s`にsupersedeされ`s`がretention内で
  ある状態で、`d.commit <= fence < s.commit`のas-of読取を実行し、圧縮pass後も
  membershipが不変であること(=`d`が削除されないこと)を証明する。`s`が期限を
  経過した後は`d`が削除可能になることも併せて固定する。
- **集約deny intentの平文属性**: reconciliationが復号を一切行わずに
  `deliverableAfter > now`のitemを除外できること、`deliverableAfter`が生成後に
  変化しないこと、窓閉鎖後に通常の消込TWIで収束することを証明する。
- **最終epoch CASのmembership検査**: 「欠落1件 + 余剰1件」の状態でCASが**通らない**
  こと(基数一致で相殺されないこと)、PATIENTLINK Queryが強整合で全ページを
  走査することを証明する。
- **CURRENT属性の保存**: update経路の実行後も`internalPatientId`と
  `identityDigest`が保持されること、Put置換実装がnegative testで検出されることを
  証明する。
- **PATIENTLINKのkey形**: SKが`hmacPatientId`であり生の`patientId`を含まない
  こと、`patientId = patientNumber`のfixtureでもkeyへPHIが現れないこと、
  鍵rotation時も既存linkの解決が壊れないことを証明する。
- **membership + cardinalityの合成**: 「欠落1件 + 余剰1件」でCASが通らないこと、
  membershipのみ・cardinalityのみでは余剰または欠落を見逃すことを、それぞれ
  独立のfixtureで固定する。いずれの検査もitem payloadを復号しないことを
  証明する。
- **圧縮の機械強制**: `retentionExpiresAt`未経過の`s`をConditionCheck対象に
  した削除がabortすること、`d`自身が未経過なら条件式で落ちること、走査結果が
  古い(その後`s`が消えた等)場合にabortすることを証明する。
- **集約deny eventIdのkeyed導出**: 同一入力から同一`eventId`が再現し、鍵なしでは
  再現できないことを証明する。

## 6. append-only 監査 / 会計 / 確定請求(M2/M3 修正)

### 6.1 監査チェーン

```text
chainScope = TENANT#{tenantId}#PHARMACY#{pharmacyId}#AUDIT#CHAIN#CLOUD
event:  PK = {chainScope}   SK = SEQ#{zeroPad(sequenceNumber)}#EVENT#{eventId}
dedupe: PK = {chainScope}   SK = DEDUPE#EVENT#{eventId}
tip:    PK = {chainScope}   SK = TIP
```

可変な `TIP` は調整メタデータであり監査イベントではない。イベントアイテムと dedupe アイテムは append-only(更新/削除しない・§2 原則5 の no-TTL/no-delete 対象)。

**3アイテム同一 PK の不変条件(WP-7001)**: `event` / `dedupe` / `TIP` の3アイテムは**同一の tenant スコープ `chainScope` PK を共有**し、SK のみ相違する(`SEQ#{zeroPad(sequenceNumber)}#EVENT#{eventId}` / `DEDUPE#EVENT#{eventId}` / `TIP`)。根拠は **chain-locality / クエリ不変条件**である: 単一 `chainScope` PK に同居させることで、**PK 単位の `Query`(paginated・1MB/ページ)** で3種を取得できる(または `SEQ#` の `begins_with` Query + `DEDUPE#`/`TIP` の Get に分ける。`SEQ#`/`DEDUPE#`/`TIP` は共通 SK 接頭を持たないため単一 `begins_with` では3種が揃わない・#8)。相異なる SK が3アイテムに相異なる完全キーを与える(`TransactWriteItems` の「相異なる主キー」要件は SK 差で満たす)。**根拠の限定(#7)**: `TransactWriteItems` は同一 PK を要求しない(クロスパーティションも可)、`LeadingKeys` はアイテム毎の PK 接頭で効くため別 PK でも許可テナント接頭を満たせば分離は成立し得る。したがって同一 PK は「TWI/IAM の必須要件」ではなく **co-location と uniform policy scope を得るための設計選択**である(IAM 条件式の最終形の証明は §7 の BLOCKED_SECURITY_REVIEW 継続)。`chainScope` は append/verify とも trusted な認可コンテキストからのみ構成する(呼び出し側 payload の tenant フィールドを PK に用いない・§7/§10/§12)。

**`sequenceNumber` はチェーン連番であり、SK 順序の正・`TIP` 保持値・entryHash に確定される canonical payload(packages/audit)が同一値でなければならない(MAJOR-2)。よって cloud チェーンの `sequenceNumber` は呼び出し側入力でなく `TIP` から採番する**(prevHash と同型に append の外部入力から除外 — §10)。**表現の統一(#4/#6)**: 永続 attr `sequenceNumberDecimal` は **unpadded base10**(grammar `/^[1-9][0-9]*$/`・`1..uint64max`。`0` は virtual genesis 専用で**永続化しない**。`+1`/`01`/前後空白等は reject)とし、TIP/dedupe/event の attr で統一する。SK の連番セグメントは**同一数値の 20桁 zeroPad 派生**(§3)であり、attr と SK は同一 bigint の2エンコーディングとして **strict round-trip 一致**を要求する(同一「表現」ではなく同一「値」)。採番は attr を **bigint へ strict decode(検証済み)してから +1**、再エンコードする(JS number 非経由・`tip.sequenceNumber + 1` のような number 演算に依存しない)。

**append アルゴリズム(3アイテム超。同一アイテムへの複数オペレーションを含めない)**:
1. `TIP` を**強整合読取**(`ConsistentRead=true`)。**genesis 証明(#4・fail-closed)**: `TIP` 欠如「単独」は genesis の十分条件ではない。events/dedupe が残存し `TIP` だけ欠落した状態を genesis と誤認すると、別 `eventId` の新イベントが `seq=1` で3条件を通過し**チェーンを fork** し得る。よって genesis は **強整合読取で `SEQ#` アイテムも `DEDUPE#` アイテムも存在しないことを証明した時のみ**成立する(`TIP` 欠如かつ events/dedupe いずれか存在 → genesis でなく integrity error で停止)。genesis の連番規約: **virtual genesis は `sequenceNumber=0` / `prevHash=AUDIT_GENESIS_PREV_HASH`、初回永続イベントは `sequenceNumber=1`**。`sequenceNumber` が uint64 上限(§3)に達したら **overflow stop**(書込拒否)。
2. **非 genesis `TIP` の true-tail 検証(#1/#2/#5・fork 防止 + 並行安定化)**: 既存 `TIP` を無条件に信頼しない。stale/orphan/corrupt な `TIP` は古い hash から追記させ、event SK が `eventId` を含むため同一 seq に別 `eventId` の第二イベントが `Put` を通過し **fork** し得る。
   - **読取安定化(#1)**: 強読は snapshot ではない。`TIP1`(強)→ 参照 event・実 tail・tail dedupe(強)→ `TIP2`(強)の順で読み、**`TIP1 != TIP2` は通常の contention** としてリトライする(integrity error にしない)。**`TIP1 == TIP2`(安定窓)で不一致がある時のみ integrity error**。genesis 側も **最終 `TIP` 再読**を行い、新出現の `TIP` は corruption でなく contention として扱う。
   - **eventSk 導出(#5)**: 参照 event の `eventSk` は `TIP` schema に保存しないため、**`TIP.sequenceNumberDecimal`+`TIP.eventId` から正準 `eventSk`(`SEQ#{zeroPad(sequenceNumber)}#EVENT#{eventId}`)を導出**して Get・検証する。
   - **重複検出(#2)**: 降順 Limit 1 は同一最大 seq の重複(`SEQ#N#EVENT#a` と `#b`)を見逃す。**`TIP` の seq 接頭を exact query して count=1 を要求**(または Limit 2 で重複無しを証明)し、かつ **より高い seq が存在しない**ことを証明する。
   - 安定窓で **`TIP {eventId, sequenceNumberDecimal, entryHash}` == 参照 event == 実 tail**、かつ tail dedupe と event/TIP の tuple・`intentFingerprint`/`fingerprintSchemaVersion` の coherence を要求する(欠落/corrupt → integrity error・§12)。
   採番は `TIP.sequenceNumberDecimal` を bigint decode して `+1`(#4/#6)。`createAuditEvent`(prevHash = tip.entryHash, sequenceNumber = 採番値)。**entryHash は packages/audit の core が計算**(呼び出し側は hex を供給しない=SEC-008 §2-3・型で強制)。
3. `TransactWriteItems`（3アイテム・すべて別 SK）:
   - `Put`(イベント) ConditionExpression: `attribute_not_exists(PK) AND attribute_not_exists(SK)`
   - `Put`(dedupe) ConditionExpression: `attribute_not_exists(PK) AND attribute_not_exists(SK)` — **eventId 単位・seq 非依存の冪等ガード**
   - `Update`(TIP) ConditionExpression: 通常追記は **完全 tuple の CAS**(`entryHash = :prevHash AND sequenceNumberDecimal = :prevSeq AND eventId = :prevEventId`。entryHash 単独に依存しない・#2)/ genesis は `attribute_not_exists(PK) AND attribute_not_exists(SK)`。set `entryHash`, `sequenceNumberDecimal`, `eventId`
   → 完全 tuple CAS が並行追記を直列化し(同一 seq に別 eventId の第二 event を書いても TIP CAS は1つしか通らず他方のトランザクション全体が棄却され fork しない)、seq 単調性を保証する。**dedupe アイテムが並行下でも同一 eventId の二重追記を不可能にする**。
4. **曖昧失敗の冪等化(M3 修正・MAJOR-1)**: 論理 append 単位で `eventId`(**唯一の dedupe identity**・#8)を**安定**させ、retry ループの外側で一度だけ生成し全 attempt で再利用する(attempt 毎の再生成は dedupe を破る)。曖昧失敗時に再試行しても、初回がコミット済みなら **dedupe アイテムの `attribute_not_exists` 条件が必ず失敗しトランザクション全体が棄却**されるため、`TIP`/`seq` が他アペンダに進められていても二重追記は不可能。**`tip.eventId` の一致を成功の証明に用いない(#1)**: `tip.eventId` が自分の `eventId` と一致しても、同一 `eventId` で intent が相違する場合は hard-conflict にせねばならず、`TIP` 一致だけでは冪等成功を結論できない。よって回復は**常に dedupe → 参照 event を読み `intentFingerprint` を比較**する(手順5)。dedupe ガードを欠く無条件リトライは**論理的重複イベント**(chain としては valid で `verifyAuditHashChain` が検知不能)を生むため禁止。`ClientRequestToken` は prevHash/seq 再計算で item が変わり `IdempotentParameterMismatchException` になるため単独解にならない(冪等の正は dedupe アイテム)。

5. **冪等衝突の semantics(WP-7001・decision C、#1/#2/#3 訂正)**: 曖昧失敗の回復は `TransactionCanceledException` の reason code 解釈でなく **state 再読で駆動**する(reason code は DynamoDB Local 差異があるため信頼しない)。**dedupe + 参照 event が既存コミットを証明**し、**`TIP` は dedupe 不在時の next-attempt 入力にのみ用いる**(#7)。
   - **`intentFingerprint`(#2/#3)**: 冪等一致判定は entryHash では行わない — entryHash は adapter 採番の `prevHash`/`sequenceNumber` を確定に含み、`@yrese/audit` の canonical payload も `sequenceNumber` を含むため、並行追記後の retry で chain 位置が変わり fingerprint が不安定(偽 conflict)になる。代わりに **`intentFingerprint` を別定義**する = trusted `{tenantId, pharmacyId, actorId}` + `AuditAppendIntent` の全フィールド(**エンベロープ `retryCount` を含む** — それは `AuditAppendIntent` の一部で永続化され entryHash に確定されるため、除外すると `retryCount` だけ異なる同一 `eventId` が偽の「同一 intent」になる・#3)を入力とし、**`prevHash`/`sequenceNumber`/`entryHash` と adapter 内部 attempt カウンタ(回復ループの transient 状態・`AuditAppendIntent` 外)のみを除外**する。`TIP` 読取前に計算し、hash のみを保存/比較する(payload 生値・PHI を露出しない)。
   - **fingerprint の永続契約(#3/#4)**: 跨プロセス/跨デプロイの retry で偽 conflict を起こさないよう versioned に固定する: **`fingerprintSchemaVersion=1`(初版)** + **SHA-256 over sorted-key canonical JSON**(bigint base10・instant UTC 正準化)。`fingerprintSchemaVersion` を dedupe/event に保存し、**回復時は保存 version で canonicalization を dispatch**する(active-v2 と stored-v1 の retry も有効。未知 version は generic な intent conflict でなく **distinct な unsupported/integrity 理由**)。**正確な canonicalization 規則(undefined キーの omit vs reject・array 順序/undefined・null・非対応値・nested・golden test vector)は WP-7001 実装で確定し golden test vector で固定する**(canonicalization の正しさは prose でなく test vector で証明される性質のため、SSOT は version=1 とアルゴリズム骨格を pin し規則表は実装+テストへ委譲する)。
   - **dedupe / TIP スキーマ pin(#3/#5)**: 直接回復のため dedupe アイテムは最低 **`{eventId, eventSk, sequenceNumberDecimal, entryHash, intentFingerprint, fingerprintSchemaVersion}`** を保持する(event SK は seq 前置のため `eventId` 単独では event を Get できず `eventSk` が必要)。`TIP` は **`{eventId, sequenceNumberDecimal, entryHash}`** を保持し、**`eventSk` は保存せず `sequenceNumberDecimal`+`eventId` から正準導出**する(#5)。回復時は strict tuple 等価 + codec 検証を要求する。
   - **判定(#1/#5・corrupt/swap 検知)**: 回復の全読取は **`ConsistentRead=true`**(強整合)。同一 `eventId` の dedupe が存在する場合、`dedupe.eventSk` で参照 event を強整合 Get(codec で hydrate)し、**3者一致**を要求する: 今回の `intentFingerprint` == `dedupe.intentFingerprint` == **保存 event から再計算した `intentFingerprint`**(event の logical フィールドを trusted context + intent に射影し chain 位置を除外して再計算・#1。dedupe 保存値を単独で信頼しない)。加えて dedupe の `{eventId, eventSk, sequenceNumberDecimal, entryHash, fingerprintSchemaVersion}` が event の key/payload と一致すること。**全一致 → 既存 event を返す**(冪等・新規 append しない)。**今回 intent が相違 → hard conflict**。**dedupe/event の相互不一致・欠落・malformed(corrupt/swap)→ integrity error**(distinct な `AuditPersistenceVerification` 理由・§12 stop)。dedupe が**無ければ**未コミットとして `TIP` を強整合再読し next 位置を得て retry(**idempotent 返却時は `TIP` 一致を要求しない** — 後続 append が `TIP` を進めている可能性があるため。`TIP` は dedupe 不在時の next-attempt 位置決めのみに用いる)。`eventId`/`intentFingerprint` は retry 間で不変。

**チェーン検証の読取**: `verifyAuditHashChain` 等の連鎖検証は同一 `chainScope` PK を `begins_with(SK, "SEQ#")` で読み、`TIP`/`DEDUPE#` を除外する(SK 辞書順 `DEDUPE# < SEQ# < TIP` により `SEQ#` クエリでイベント列を清潔に分離できる)。

**検証層の分担(WP-7001・decision B、#5/#6 訂正)**: `AuditAppendStore.verify` は **app-local な `AuditPersistenceVerification` を返す**(#5)。core の `AuditHashChainVerification` は `prev_hash_mismatch`/`entry_hash_mismatch`/`hash_format_invalid` しか表現できず、seq/dedupe/TIP/key/codec/scope の失敗を表せないため。`AuditPersistenceVerification` は**相異なる fail-closed 理由の union**(委譲した core 結果を内包)とする。
   - **読取安定化(verify も安定窓が必要・round-4)**: `ConsistentRead` はページ毎であり multi-page snapshot ではない。検証中に正常 append が起きると old events と new dedupe/TIP(逆も)が混在し **偽の gap/cardinality/TIP-corruption verdict** を生む。よって verify も append と同じ安定窓で行う: `TIP1`(強)→ 全 `SEQ#`/`DEDUPE#` ページを強読で exhaust → `TIP2`(強)。**`TIP1 != TIP2` は検証中の contention** としてリトライ(verdict を出さない)。**`TIP1 == TIP2` の安定窓でのみ** seq/cardinality/core-hash の verdict を発行する。valid-empty 判定も**最終 `TIP` 再読**を要する(新出現 `TIP` は corruption でなく contention)。
   - **app 層が検証する項目**: `sequenceNumber` の連続・event 毎に dedupe 1件・dedupe ポインタ/hash が event と一致・`TIP` が末尾 event と一致・SK の seq/eventId が payload と一致・bigint が10進文字列で往復・型/PK/SK スコープの妥当。ハッシュ連鎖の継続性(prevHash/entryHash の連結)は **`@yrese/audit` の `verifyAuditHashChain`(純粋コア)へ委譲**し再実装しない(二重実装禁止・§10 境界)。
   - **bijective + 空状態明示(#6)**: 検証は全単射で空状態を明示する。**valid-empty** は event=0 かつ dedupe=0 かつ `TIP` 不在の時のみ(#4 genesis 証明と一致)。**valid-nonempty** は次を全て満たす時のみ: `sequenceNumberDecimal` が正確に `1..N` 連続、**`eventId` が一意**(重複なし)、**event 件数 == dedupe 件数**、各 `dedupe.eventSk` が**厳密に1つの event を一意参照**、全 dedupe の tuple・`entryHash`・`intentFingerprint`(+`fingerprintSchemaVersion`)が参照 event と一致、`TIP` が1件で末尾 event tuple に一致。**集合の等価だけでは不十分**(異なる seq に重複 `eventId` があると Set で潰れ偽陽性になる・#6)。orphan dedupe(対応 event 無し)/ orphan TIP / 重複 `eventId` / 件数不一致は**相異なる失敗**として拒否する。
   - 生 DynamoDB item を検証前に `AuditEvent` へ cast しない(codec 経由で厳格に hydrate)。malformed item / seq の gap・重複 / key-payload 不一致 / dedupe 欠落・orphan / TIP 不一致・orphan / core hash 失敗は**相異なる fail-closed 理由**として区別する(silent pass を作らない)。

**dedupe の追加コスト**: dedupe アイテムにより append ごとの書込が単一アクティブ partition で 2→3 アイテム・格納数も倍増する(§6.3 の成長・§13(a)(e) 計測の対象)。dedupe は append-only(TTL を付けると失効後に二重追記が可能になり冪等保証が崩れるため §2 原則5 の no-TTL/no-delete 対象)。

**Edge 将来**: オフライン中は device-local subchain(`CHAIN#EDGE#DEVICE#{deviceId}`)。RECOVERY_SYNC で cloud チェーンへ subchain tip を参照するアンカーイベントを追記。cloud 正本は tenant+pharmacy スコープを維持(device 恒久断片化を回避)。

### 6.2 会計台帳 / 確定請求

```text
台帳: PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#LEDGER#{ledgerType}      SK = SEQ#{zeroPad(sequenceNumber)}#EVENT#{eventId}
確定: PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#CLAIM#MONTH#{claimMonth} SK = CLAIM#{claimId}#FINALIZED#{finalizedAt}
```

規律: **TTL なし・update/delete API なし**・訂正は reversal/amendment イベント(ARC-007)・レセ/領収の export ペイロードは将来 S3 の不変オブジェクト戦略へ、DynamoDB は正本メタデータ/ハッシュ/evidence ref/オブジェクトポインタを保持。

### 6.3 チェーン成長(M8)

単一 `chainScope` PK は append-only で無限成長し、パーティション上限に接近し得る。**月次等のチェーンセグメント化 + セグメント間アンカーイベント連結**(§6.1 Edge アンカー方式の再利用)を設計する(open_question)。なお**セグメント化はパーティション「サイズ」成長には効くが、単一アクティブ `TIP` への書込集中(ハッシュチェーン固有の直列単一ホットアイテム)は緩和しない**(MINOR-7)。tip 書込集中率/条件衝突率は §13(e) で計測する。

### 6.4 outbox intent → audit fact の収束(HIGH-9 訂正)

§5 の clinical TWI が commit するのは audit/outbox **intent** であり、§6.1 の
チェーンへ追記された audit **fact** ではない。両者を同一視すると、2xx を返した
operation に対応する監査事実が存在しない状態を検出できない。格納面の規律を
次に固定する(API-008 §9.2 が wire 側の正本)。

```text
outbox intent (未収束):  PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#AUDITOUTBOX
                         SK = PENDING#EVENT#{eventId}
outbox intent (収束済):  PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#AUDITOUTBOX
                         SK = DONE#EVENT#{eventId}
dlq:                     PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#AUDITOUTBOX
                         SK = DLQ#EVENT#{eventId}
```

intent は `PENDING#` として生まれ、消込 TWI が `PENDING#` を Delete して
`DONE#` を Put する単一遷移だけを持つ(詳細は本節「intent の消込」)。
`DONE#` は intent が存在した痕跡であり、削除しない。この 3 つ以外の SK を
本 PK 配下へ置かない。SK 辞書順は `DLQ# < DONE# < PENDING#` であり、
reconciliation は `begins_with(SK, "PENDING#")` だけを走査すれば未収束集合を
過不足なく得られる。**`INTENT#` のような単一名前空間を使ってはならない**:
その場合 `begins_with(SK, "PENDING#")` が恒常的に空集合を返し、消込 TWI の
`Delete` は非存在キーに対しても成功するため TWI 全体が通り、未収束 intent が
1 件も検出されないまま `AUDIT_CONVERGENCE_PENDING` が永久に立たない。本節が
「唯一の収束検出器」と呼ぶ機構が silent に無効化される。

- **stable identity**: intent は `eventId` を唯一の identity とする。これは
  §6.1 の dedupe identity と**同一値**であり、別体系を作らない。`eventId` は
  論理 append 単位で retry ループの外側で一度だけ生成する(§6.1 #8)。
- **intent item の内容**: trusted scope、`eventId`、`intentFingerprint`、
  `fingerprintSchemaVersion`、生成時刻(アプリ供給)、配送 attempt 数に加え、
  **audit fact を再構成できる全入力**(action、対象 resourceType、target ID、
  actor、結果)を **同一 item 内の暗号化 payload** として保持する。**本 batch は
  inline 保持のみを許可する**。immutable payload store への外部参照 + digest は、
  その書込が clinical TWI に含まれるのか、100 action / 4 MiB budget へどう算入
  するのか、書込失敗時の semantics が何かをいずれも定義できていない。TWI が
  commit して 2xx を返した後に外部 payload 書込が失敗すれば、DLQ item には解決
  不能な参照と一致しない digest だけが残り、本項が閉じたはずの再構成不能が
  そのまま再現する。外部 store 参照を採る場合は、書込順序(intent commit より
  前に完了)、digest 検証、失敗時の response 抑止、budget 算入根拠を定めた
  amendment を要し、それまで `BLOCKED_AUDIT_PAYLOAD_EXTERNAL_STORE` とする。
  以前の版はこの列挙を閉じた形で固定し payload を
  持たせていなかったが、`intentFingerprint` は hash なので payload を復元
  できず、worker は intent item だけでは chain へ追記すべき event を構築
  できない。さらに DLQ へ落ちた場合、PHI は既に client へ返っているのに
  **何が誰へ開示されたかを再構成する手段が残らない**。漏えい報告や開示記録の
  要求に応えられなくなる。PHI 生値の禁止は「暗号化して保持」で満たす。
  DLQ item も同じ payload 参照を保持し、DLQ 滞留から fact を後追い再構成
  できることを acceptance に含める。
- **idempotent delivery**: worker は intent を at-least-once で配送する。
  同一 `eventId` を何度配送しても、§6.1 の dedupe item の
  `attribute_not_exists` により追記は高々 1 件に収束する。exactly-once
  **配送**は主張しない。収束先が exactly-once である。
- **intent の消込は dedupe 実在を機械強制する**: 消込を無条件操作にしては
  ならない。消込は次の単一 TWI とする。
  `TransactWriteItems(ConditionCheck(対応する DEDUPE#EVENT#{eventId} が存在)
  + Delete(SK = PENDING#EVENT#{eventId})
  + Put(SK = DONE#EVENT#{eventId}) with attribute_not_exists(PK) AND attribute_not_exists(SK))`
  以前の版は「配送成功後に Update する」という手順上の前提だけを書き、それを
  強制する条件式を持たなかった。reconciliation は未収束集合しか見ないため、
  **一度でも誤って消込めば、対応する audit fact が存在しなくてもその `eventId` は
  未収束集合から永久に消え、監査欠落が silent になる**。worker が配送直前に
  timeout し再起動後に「配送済みかもしれない」と判断して無条件に消込む経路で
  現実に起こる。ConditionCheck が dedupe の実在を、`Put` の
  `attribute_not_exists` が二重消込を、それぞれ機械的に排除する。
  この規律を「append-only」と呼ばない。§6.1 の append-only は「更新/削除しない」
  (不変性)を意味し、`PENDING#` item の Delete はそれに反する。outbox は
  **monotonic transition, no data loss** という別規律であり、intent の
  痕跡は `DONE#` item として必ず残る。§2 原則 5 からは TTL 禁止だけを継承する。
  同じ名前で呼ぶと実装側が §6.1 の不変性まで満たしていると誤認する。
- **retry / DLQ**: 配送失敗は bounded attempt + backoff で再試行する。上限
  到達後は同一 `eventId` の DLQ item を conditional Put する。**DLQ item は
  §2 原則 5(b) の monotonic transition 群であり、TTL なし・物理削除なし**。
  「append-only」とは呼ばない。§6.1 の append-only は「更新も削除もしない」
  (不変性)を意味するが、DLQ item は収束確認後の payload 削除という単一遷移を
  持つためそれに反する。TTL を付けると失効後に監査欠落が不可視化されるため
  §2 原則 5 の TTL 禁止は継承する。item そのものは削除しない。
- **reconciliation**: 未収束 intent は
  「`begins_with(SK, "PENDING#")` の intent 集合」と
  「対応する `DEDUPE#EVENT#{eventId}` の不在」の突合で検出する。両方を
  強整合で読み、片方だけで結論しない。差分が解消しない scope は
  `AUDIT_CONVERGENCE_PENDING` として記録し、silent pass を作らない。
- **reconciliation の走査を bound する**: intent は単一 PK に置かれ、削除も
  TTL もなく、clinical write と全 PHI read の累計として単調増加する。以前の版は
  絞り込み経路を定義していなかったため、reconciliation は当該 partition の全
  intent を読んで filter することになり、走査が unbounded だった。Revision 7 が
  search materialization(§4.1)と患者検索(§3.4)には実測 bound を課しながら、
  自ら新設したこの経路にだけ課していなかったのは規律の非整合である。したがって
  **未収束 intent を base-table の SK 名前空間分離で addressable にする**。
  新規 GSI を作らない。intent は未収束の間 `SK = PENDING#EVENT#{eventId}` に置き、
  消込 TWI が `PENDING#` item を削除して `SK = DONE#EVENT#{eventId}` を Put する
  単一遷移とする(削除と Put は同一 TWI・別 item なので §12 の同一 item 制約に
  抵触しない。intent の痕跡は `DONE#` 側に残るので「存在したが痕跡が消えた」
  状態を作らない)。reconciliation は `begins_with(SK, "PENDING#")` の Query
  だけを走査すればよく、対象は未収束集合に縮む。GSI を新設しないので §3.3 の
  「全 GSI PK が tenant+pharmacy prefix」不変条件との適合を別途証明する必要も
  なく、R1-H10 と同型の穴を作らない。以前の版は「sparse index で addressable に
  する」とだけ書き key 形を定義していなかったため、tenant 止まりの GSI が
  追加される余地を残していた。あわせて §4.1 と同型の実測 bound(走査件数・
  経過時間)と超過時の fail-closed 記録を課す。
- **書込集中**: PHI read ごとに intent を 1 件書くため、outbox partition への
  書込は read トラフィックに比例する。§6.3 が audit chain について挙げた
  「単一 PK の append-only 無限成長 + 単一アクティブ item への書込集中」と同型の
  問題が outbox にも生じる。§6.3 の segment 化検討を outbox にも適用対象として
  明記し、§13(a)(e) の計測対象へ含める。
- **failure behavior**: TWI を伴わない read/search/deny では、audit intent の
  durable commit が **response 送出より前**に完了しなければならない。intent
  commit 失敗時は **当該 operation の response を返さず** 500 とする。
  条件を「**PHI を含む** response」に限定してはならない。deny の response
  (401/403/404)は定義上 PHI を含まないため、その限定は **deny 監査の欠落を
  許容**する。cross-scope の logicalId 総当たり試行に対し、監査ストアが劣化
  している間も 404/403 は返り続け deny 監査だけが残らず、intent が commit
  されていないので reconciliation の差分にも現れない。**欠落自体が不可視**に
  なる。条件は「auditable operation の response」であり、成功・deny・failure・
  **空 searchset** を区別しない。空 searchset は cross-pharmacy 探索の結果として
  返るが PHI を含まず deny でもないため、「PHI または deny」という列挙では漏れる。
  列挙ではなく operation の性質で判定する。
- **intent commit 成功後に response 送出が失敗した場合**: 実際には開示されて
  いない PHI について「read した」という intent が残る。これは fail-safe 側の
  過剰記録であり、**intent は開示の「試行」を表し送出成功を主張しない**と
  意図的に固定する。送出成功を別 fact へ収束させる設計は本 batch で採らない。
- **payload の保持を収束で終える**。intent が持つ暗号化 payload は audit fact を
  再構成するための一時的な複製であり、正本は §6.1 の chain である。したがって
  fact への収束が確認できた後に **payload だけを落とす**遷移を定義する。
  `DONE#` item 自体は残るので、監査欠落の検出可能性と「intent が存在した」と
  いう事実は失わない。この削除経路がないと、保存年限も WORM も消去手順も未定義の
  場所に全 PHI read と全 deny の開示記録が永久に蓄積し、crypto-shred 以外の
  消去手段を持たない PHI 保持面を新設することになる。

  **削除は時間経過ではなく収束で駆動し、機械強制する(HIGH 訂正)**。以前の版は
  「収束 + safety window の経過後」と書き、同じ規律を DLQ item にも適用すると
  していたが、**DLQ item は定義上収束していない**(配送に失敗したから DLQ に
  ある)ため、二通りに読めた。収束を前提とすれば DLQ payload は永久に落ちず
  「恒久保持を既定にしない」が空文になり、window 単独と読めば**最も再構成が
  必要な滞留 intent の payload だけが時間経過で消える**。後者は本項が payload を
  必須化した理由そのものを破壊する。したがって次に一本化する。

  - **`DONE#` item の payload 削除**: 消込 TWI が `ConditionCheck(dedupe 実在)`
    を通過した時点で収束は証明済みである。その後 safety window を経過したら
    payload を落とせる。削除は消込と同型に機械強制する:
    `TransactWriteItems(ConditionCheck(対応する DEDUPE#EVENT#{eventId} が存在)
    + Update(DONE# item の payload 属性を REMOVE) with attribute_exists(payload))`。
    `attribute_exists` が二重実行を排除する。payload 削除は消込より破壊的な
    操作であり、prose の手順だけに委ねない。
  - **`DLQ#` item の payload 削除**: dedupe が存在しない間は上記 ConditionCheck が
    通らないため、**payload は落ちない**。これは既定であって例外ではない。手動
    remediation が chain への追記を成立させ dedupe が実在するようになった後に
    のみ、同じ TWI で削除できる。**時間経過だけでは決して落とさない。**
  - この結果、収束しないまま滞留する DLQ item の暗号化 payload は無期限に残る。
    それは意図した fail-closed であり、そこから生じる PHI 保持面の保存年限・
    WORM・消去手順は SEC-007 / SEC-008 の管轄として
    `BLOCKED_AUDIT_PAYLOAD_RETENTION_POLICY` に置く。**timer で消して解決した
    ことにしない。**
  - `PENDING#` → `DONE#` の消込 TWI は payload を `DONE#` へ引き継ぐ。引き継が
    ないと収束直後に再構成不能になり、上記の削除遷移が意味を失う。
- **intent / DLQ item は §3 の共通属性を継承する**。`phiClassification` と
  `encryptionStatus` を明示的に持ち、MOD-009 の不変条件(PHI≠none →
  `encrypted` 必須)の適用対象とする。上記の内容列挙は共通属性への**追加**で
  あって置換ではない。鍵階層と crypto-shred 到達性は SEC-008 の対象へ入れる。
- **deny 監査の write 増幅を bound する**。durable-commit 条件を auditable
  operation へ拡大した結果、403/404 も応答前に outbox への Put を要求する。
  outbox は単一 PK・TTL なし・物理削除なしで単調増加するため、**認証済み caller が
  cross-scope の logicalId を総当たりすると 1 probe = 1 件の恒久 item** となり、
  hot partition 化と正当な clinical write の audit intent commit の throttle を
  同時に招く。監査を強化した規律が監査経路を人質にした可用性攻撃面へ転化する。
  したがって deny 経路の intent 生成に quota を課すが、**quota 到達を「記録せずに
  打ち切る」形にしてはならない(HIGH 訂正)**。以前の版は「quota 到達時は deny
  応答自体を 429 で先に打ち切って auditable operation を発生させない」と書いて
  いたが、これは API-008 §9.2 が確立した「auditable operation の response は audit intent
  の durable commit 前に返さない」という規律に、**攻撃者が到達条件を制御できる
  例外**を作る。攻撃者が無害な cross-scope probe で quota を意図的に焼き切れば、
  以後その scope の deny は無記録の 429 になり、その窓の中で行われた総当たりは
  **1 件も監査に残らず reconciliation の差分にも現れない**。本節が「欠落自体が
  不可視になる」として閉じた穴が、閉じ方そのものによって再現する。

  代わりに **集約記録へ縮退させる**。quota 到達後は、個々の deny について intent を
  作る代わりに、**(principal, scope, 時間窓) あたり 1 件の集約 intent** を
  durable commit してから 429 を返す。集約 intent は窓の開始/終了と quota 値を
  暗号化 payload に持ち、個々の target ID は持たない(それが増幅の原因だったため)。

  **集約 intent は本節の `PENDING#`/`DONE#` lifecycle にそのまま適合させる
  (round-4 HIGH 訂正)**。以前の版は集約 intent に「試行回数」を持たせていたが、
  それは deny のたびに既存 `PENDING#` item を Update することを含意し、intent の
  immutability と単一遷移規律に反する。また identity と配送時期が未定義のため、
  消込 TWI の `ConditionCheck(dedupe 実在)` を満たす経路が存在しなかった。
  次のとおり確定する。

  - **identity**: 集約 intent の `eventId` は `(principal, trusted scope,
    windowStart)` から versioned derivation で**決定的に**導出する(導出関数と
    schema version は API-008 §9.2 の intent fingerprint と同じ規律で pin する)。
    同一窓の全 deny が同一 `eventId` へ収束するため、§6.1 の dedupe identity と
    してそのまま機能する。
    **導出は無鍵 hash ではなく keyed HMAC とする(round-5 security 訂正)**。
    `eventId` は outbox の SK と §6.1 chain の dedupe key に載る、すなわち
    **key 面に現れる**。無鍵 hash では、principal 識別子の候補集合が小さい
    環境で `(principal, scope, windowStart)` の総当たりにより「どの principal が
    いつ deny quota に達したか」を key の存在だけから逆引きできる。鍵は
    `HKDF(root, tenantId, purpose="denyAggregateEventId")` から導出し、§9 Q4 の
    tenant 別鍵と用途分離する。個別 intent の `eventId` は従来どおり論理 append
    単位で生成した値であり本項の対象外である。
  - **窓あたり 1 件・immutable**: quota 到達後の最初の deny が
    `Put(SK = PENDING#EVENT#{eventId})` を `attribute_not_exists(PK) AND
    attribute_not_exists(SK)` で 1 回だけ commit する。以後の同一窓の deny は
    intent を書かず、当該 `eventId` の `PENDING#` または `DONE#` item の存在を
    強整合で確認してから 429 を返す。conditional Put が競合で落ちた場合も同じ
    存在確認へ倒す。item を後から Update しないため**試行回数は保持しない**。
    正確な回数を主張せず、「窓内で quota 超過が継続した」事実のみを記録する。
  - **配送は窓の閉鎖後**: worker は `windowEnd + maximum clock skew` を過ぎる
    まで集約 intent を配送しない。配送後は通常の消込 TWI(dedupe 実在
    ConditionCheck + `PENDING#` Delete + `DONE#` Put)がそのまま適用される。
    reconciliation は窓が未閉鎖の集約 intent を期待どおりの `PENDING#` として
    扱い、`AUDIT_CONVERGENCE_PENDING` の対象にしない。窓閉鎖後は通常 intent と
    同一に扱う。
  - **この除外判定を実装可能にする平文属性を定める(round-5 MEDIUM訂正)**:
    以前の版は窓境界を暗号化 payload にだけ持たせていたため、reconciliation は
    `PENDING#` item を復号しなければ「未閉鎖だから除外」を判定できず、除外条件が
    実装不能だった。復号を reconciliation の前提にすると、監査経路の突合が鍵
    可用性に依存し、PHI 復号を伴わない突合という設計意図にも反する。したがって
    intent item は次の 2 属性を **平文** で持つ。
    - `intentKind`: `individual` | `aggregateDeny`。列挙値であり PHI を含まない。
    - `deliverableAfter`: `windowEnd + maximum clock skew` の時刻。`individual`
      intent では intent 生成時刻(即時配送可)を入れる。
    reconciliation は `begins_with(SK, "PENDING#")` の走査結果から
    `deliverableAfter > now` の item を除外し、残りだけを dedupe 不在と突合する。
    worker の配送可否判定も同じ属性を読む。窓境界の**正確な値**(開始/終了)と
    principal/scope の詳細は従来どおり暗号化 payload 側に持ち、平文側は
    「いつ以降なら配送・突合の対象か」だけを表す。`deliverableAfter` は
    intent 生成時に確定し、以後 Update しない(本節の immutability を維持する)。
  - **event mapping**: 集約 deny event の種別・payload schema は MOD-008 への
    登録対象であり、`BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT` の範囲に含める。
    登録前に deny quota 経路を有効化しない。
  - **無記録の窓を作らない**。集約 intent の commit にも存在確認にも失敗した
    場合は 429 を返さず、API-008 §9.2 の failure behavior に従って 500 とする。
  - 増幅は窓あたり 1 件へ落ちるので、当初の目的(単調増加する恒久 item の抑制)は
    達成される。
  - quota の適用次元は **principal 単位**とする。scope 単位を単独の遮断条件に
    しない。scope 単位だけだと 1 principal がその scope 全体の deny 監査を停止
    できてしまう。
  - quota 値と窓幅は §4.1 と同じく実測で確定する。集約の粒度をこれより粗くして
    よいか(例: 窓幅の延長、principal のグルーピング)は SEC-007/SEC-008 の判断
    事項として明示起票する。**粒度の決定は委譲するが、「最低 1 件は必ず残る」
    という下限は本節で固定し委譲しない。**
  - **開放窓中の検知経路も同じ起票に含める(round-5 security)**。集約 intent は
    窓の閉鎖まで配送されず reconciliation の対象にもならないため、進行中の
    総当たりが audit chain に現れるまで「窓幅 + clock skew」の遅延がある。本節は
    **記録の完全性**(無記録の窓を作らない)を保証するが、**検知の即時性**は
    保証しない。両者を混同しない。窓幅の決定は検知遅延の上限決定でもあるため、
    SEC-007/SEC-008 への起票事項に「開放窓中の deny 集中を検知する経路
    (outbox 依存でない alerting)」を明示的に含める。本節では alerting を
    発明しない。
  - **phase-disabled route への 404 は auditable operation に当たる**。認証済み
    caller に対する deny だからである。未認証 caller に対しては §8 の判定順序に
    より route/method を反映しない単一の 401 だけが返り、route 解決に到達しない
    ので本規律の対象外である。

  この wire 挙動は **API-008 §9.2 / §6 / §12 が正本**であり、本書はその格納側の
  強制だけを持つ。片方の文書にだけ carve-out を置かない。
- 本節は audit event 名、payload schema、保存年限、export、物理 WORM を定義
  しない。MOD-008 / SEC-007 / SEC-008 の管轄であり先取りしない。ただし上記の
  収束後 payload 削除・共通属性継承・quota は、本節が新設した保持面と write 経路に
  対する最小限の自己完結規律であり、委譲先の未定を理由に省略しない。MOD-008 に
  read/search/create/update/deny/failure mapping が登録されるまでは
  `BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT` により当該 route 自体を実装しない。

## 7. テナント分離機構(M6 — DB-003 §4 の DynamoDB ネイティブ代替)

全pharmacy-scoped PK/GSI PKが
`TENANT#{tenantId}#PHARMACY#{pharmacyId}` 始まりであることは分離の
**構造的土台**だが、それだけでは不十分。tenantId/pharmacyIdはtrusted
AuthContextからのみ導出し、current/history/index/cursor/idempotency/referenceの
全操作で同じscopeを使う。

- **既定機構(MVP)**: 単一ベースロールに対し、**リクエスト毎の STS AssumeRole セッションポリシー**(具体 prefix を注入)または**セッションタグ**で `dynamodb:LeadingKeys` をスコープダウンする。これにより通常系のクロステナントアクセスを**権限的に不可能**にする(DB-003 §4 critical / ARC-008 §6)。N テナント = N 静的ロールにしない。
- **スコープダウンは tenant + pharmacy の両方まで行う(HIGH-8 訂正)**:
  注入する prefix は `TENANT#<tid>#*` ではなく
  **`TENANT#<tid>#PHARMACY#<pid>#*`**(セッションタグ形では
  `TENANT#${aws:PrincipalTag/TenantId}#PHARMACY#${aws:PrincipalTag/PharmacyId}#*`)
  とする。tenant 止まりの LeadingKeys は、同一テナント内の別薬局データへの
  DB 層アクセスをアプリ層の正しさだけに依存させるため、多層防御として
  不十分である。§3 の全 pharmacy-scoped PK/GSI PK は
  `TENANT#{tenantId}#PHARMACY#{pharmacyId}` 始まりであり、この粒度の
  prefix 拘束が構造的に可能である。
  - tenant-wide item(§3 により `TENANT#{tenantId}#SCOPE#TENANT#...` の
    **別 prefix 空間**。sentinel は廃止済み)へアクセスする
    operation は、pharmacy prefix では届かない。tenant-wide read を要する
    経路は、その別 prefix を持つ**分離した session policy**で扱い、
    pharmacy 粒度の既定 session を緩めて兼用しない。どの operation が
    tenant-wide を要するかは実装 WP で列挙し、承認を得る。
  - `dynamodb:LeadingKeys` は PK 全体ではなく **partition key 値**に対する
    条件であるため、上記 prefix は PK 文字列の先頭一致として評価される。
    prefix 一致演算子(`StringLike`)の実現可能性は下記 MAJOR-3 と同じ
    BLOCKED_SECURITY_REVIEW の対象であり、成立しない場合の fallback も
    pharmacy 粒度を落とさない形で選ぶ。
  - **SEC-008 の検証項目に GSI を明示的に含める**。以前の版は `StringLike` の
    可否だけを検証範囲としており、`dynamodb:LeadingKeys` が GSI query に対して
    どう評価されるか(基表 PK への条件が index query でどう効くか)を範囲に
    入れていなかった。`Scan` に対する扱いも同様に検証範囲へ入れる。base table・
    GSI・Scan の三つで pharmacy 粒度が成立することを一次情報で確認するまで、
    分離が成立したと主張しない。
- **プレフィックス安全性**: §3 のキーセグメント正準形(`#` 非包含)不変条件に依存する。tenant 値と pharmacy 値の双方が `#` を含まないことが、prefix 境界の一意性の前提である。
- **前提が現行コードで強制されていない(HIGH 訂正・prerequisite)**: 上の
  pharmacy 粒度化は「canonical な `#` 非包含 ID」と「`GLOBAL` が予約語である
  こと」に依存すると明示的に宣言した。しかし現行の
  `packages/shared-kernel/src/branded-ids.ts` の `tenantId()` / `pharmacyId()`
  factory は非空・空白のみでない・制御文字なししか検証せず、`#` を含む値も
  `"GLOBAL"` も受理する。正準エンコードの helper も存在しない。前提を強化した
  訂正が、前提の強制手段を伴っていない。
  - `pharmacyId = "A#PHARMACY#B"` のような値が通ると、
    `TENANT#t#PHARMACY#A#PHARMACY#B#…` が別の正当なキーと曖昧になり、session
    policy の prefix 一致が意図しない partition を覆う。
  - (**round 3 で解消済み**)`pharmacyId = "GLOBAL"` の薬局による昇格経路は、
    §3 で tenant-wide を別 prefix 空間へ移したことで構造的に消滅した。以下は
    その経路が存在した理由の記録である。sentinel 方式では pharmacy-scoped item が
    tenant-wide 空間(`PHARMACY#GLOBAL`)と同居する。本訂正が新設した
    「tenant-wide 用の分離した session policy」はまさにその prefix を持つため、
    **tenant-wide session がその 1 薬局の全 PHI へ到達する**。これは訂正前
    (tenant 粒度 LeadingKeys 一本)には存在しなかった権限昇格経路である。
  上記2件のうち **sentinel 衝突は §3 の別 prefix 空間化で本 batch 内に解消した**
  (allow-list 内で閉じられるものを外部依存の blocker で待たない)。

  **prefix 曖昧性についての事実訂正(round-5 LOW)**: 「branded ID factory が
  `#` 非包含を強制していない」という前提は、本 packet の base SHA 時点では
  真だったが**現在は偽である**。`packages/shared-kernel/src/branded-ids.ts` は
  `KEY_DELIMITER = "#"` を定義し、全 branded ID factory が通る `assertValidId`
  で `value.includes(KEY_DELIMITER)` を `RangeError` として拒否する。理由は
  複合キーの prefix 曖昧性であるとコメントに明記され、`kernel.test.ts` は全
  factory に対し `"a#b"`, `"#leading"`, `"trailing#"`, `"#"`, `"A#PHARMACY#B"`
  の拒否と、相異なる ID 対が同一複合キーを生まないことを negative test で
  固定している。round-4 の「PostgreSQL に Patient writer が存在しない」と同種の
  前提訂正であり、記録を live code に合わせる。
  - したがって blocker の範囲は「factory が `#` を拒否しないこと」ではなく、
    **キー構築経路が branded 型を経由することの保証**へ縮む。生文字列から
    `TENANT#...` を組み立てる経路が 1 つでもあれば factory の強制を迂回できる。
    解除には (a) キー構築が branded 型のみを入力に取ることの型・境界検査での
    強制、(b) 既存永続値に `#` 含有がないことの検証、を要する。
  - **(a) は `check:boundaries` の機械検知として実装済みである(2026-07-31)**。
    `scripts/check-boundaries.mjs` は AST 走査で `TENANT#` / `PHARMACY#` を含む
    文字列 literal を検出し、**承認済み key codec**
    (`apps/*/src/dynamodb/*key-codec.ts`)以外の production source にあれば
    violation として exit 1 する。承認済み codec に限定するのは §10 の
    「アダプタのみが DynamoDB マーシャリングを持つ」境界と同一の理由であり、
    pure core package での構築は許可しない。test source は codec の出力を
    期待値として固定するため対象外とする。`scripts/check-scripts.mjs` に
    positive/negative の両 fixture を持ち、規則の呼び出しを外すと negative test
    が落ちることを変異で確認済みである。
    **限界**: 静的検知は literal を伴わない動的連結までは捕捉しない。したがって
    これは「迂回経路が入り込んだら CI で落ちる」ことの保証であって、迂回経路が
    数学的に存在しないことの証明ではない。
  - 残余は **(b) 既存永続値の検証**である。これが完了するまで blocker を維持する。
  - 予約語 `GLOBAL` の拒否は sentinel 廃止により不要であり、factory も実装して
    いない。これは欠落ではなく設計どおりである。
  この残余が閉じるまで `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` を維持し、
  pharmacy 粒度化を prefix 曖昧性に対して無条件に安全とは主張しない
  (conservative 側を維持する。factory 強制の存在は根拠を強めるが、
  迂回経路の不在を証明しない)。
- **pharmacy 内分離**: 上記の DB 層 prefix 拘束と、アプリ層deny-by-default
  (requirePermission + tenant/pharmacy文脈拘束)の双方で担保する。DB層が
  あるからアプリ層を緩めない。逆に、アプリ層があるからDB層をtenant止まりに
  しない。
- **多層防御**: 上記に加え、アプリコードと契約テストでテナント/薬局チェックを常に行う。
- **FHIR Reference**: 同一trusted tenant+pharmacy内のlocal relative
  referenceだけを許可する。absolute/external referenceは拒否し、network fetch
  しない。foreign/malformed値をlog/OperationOutcomeへechoしない。
- **request-derived URI/canonical no-network**: `meta.profile`, Coding.system,
  identifier.system, extension/canonical URL等はinert valueとしてのみ扱い、pinned
  local package/terminology allow-listで検証する。URIであることだけで拒否しないが、
  HTTP/DNS/redirect/package resolverへ渡さない。loopback/private/link-local/IPv6/
  encoded/protocol-relative/redirect/DNS rebindingを含むoutbound call=0をnegative
  testで証明する。
- **same-tenant cross-pharmacy negative tests**: pharmacy A AuthContextから
  pharmacy B logical IDをread/vread/historyして404、searchはempty、foreign
  Reference/cursorはrejectし、pharmacy B scopeのrepository query/network accessが
  0であることをadapter spyで証明する。body/query/path/metaのpharmacy値でtrusted
  scopeが変わらないことも固定する。これはplanned obligationであり未実装PASSを
  主張しない。
- **LeadingKeys 演算子の実現可能性は SEC-008 の最優先検証事項(MAJOR-3)**: `StringEquals`(キー値=プリンシパル識別子の完全一致・高確度)は成立するが、本設計の複合 PK(`TENANT#{tid}#…`)をテナントで絞るには prefix/ワイルドカード一致(`StringLike`)が要り、`dynamodb:LeadingKeys` × `StringLike` の有効性は公式に明確でない。**LeadingKeys で複合プレフィックス分離が成立しない場合の MVP スコープ内フォールバックを本書で確定する**: (i) テナント別テーブル/アカウント分離(§Q3 上位ティア)を「critical 分離要件を満たす標準構成」へ格上げ、または (ii) テーブルの PK 先頭を **`{tenantId}#{pharmacyId}` を単一の複合値として保持する専用属性**へ再設計し `StringEquals` を可能にする。**(ii) を tenantId 単独へ退化させない**: tenantId 単独の `StringEquals` は pharmacy 粒度の DB 層分離を失うため、上記 HIGH-8 訂正の要件を満たさない。tenant-wide item は別 partition key 空間へ分離し、tenant-wide 用の session policy だけがそこへ到達する。ARC-008 §6 / DB-003 §4 の「通常系テナント越え不可」は **critical(努力目標でない)**であり、**実証済みの DB 層分離手段を欠いたまま実装着手しない**(fail-closed)。STS セッションポリシー/タグの最終形・ロール分解も SEC-008 で確定。BLOCKED_SECURITY_REVIEW。

## 8. 投影整合(M7)

patient summary/search・reception 等の投影は正本から再生成される派生。**更新機構を明示する**:

- **MVP = 同期更新**: FHIR/内部正本の書込transaction内でprojection/indexも
  同期更新する(**read-after-write保証**)。「今登録した患者を即検索/受付
  できない」ラグを防ぐ。index rebuildは再生成可能projectionの保守であり、
  MedicationRequest authority dataのmigration/backfillではない。
- **非同期(DynamoDB Streams 等)は post-MVP**: 採用時はラグ許容値・突合/再生成手順・非正本明示を規定する。
- **投影の同期更新先**: FHIR Patient currentとpatient_summary/searchは同じ
  trusted tenant+pharmacy scope。1患者が複数薬局に跨る共有はpost-MVPで、
  本draftはcross-pharmacy authorityを認可しない。

## 9. 暗号化と PHI 配置

- **DynamoDB 保存時暗号化(KMS)必須**(FHIR/リソースストア)。CMK 階層・テナント別鍵戦略・環境別テーブル鍵ポリシー・break-glass 復号ポリシーは BLOCKED_SECURITY_REVIEW。MOD-009 封筒不変条件(phiClassification≠none→encryptionStatus 'encrypted'、違反 throw)を継承。
- **検索トークン鍵(Q4)**: KMS ルートから `HKDF(root, tenantId)` で**テナント別鍵を導出**(クロステナント相関防止・テナント削除時 crypto-shred・鍵ローテ可)。pepper をハードコードしない。**決定的トークンゆえ鍵ローテ = 索引再構築**。鍵管理は M4 の部分一致不可能性を解決しない(必要条件であり十分条件でない)。
- **用途分離鍵の一覧(round-5 訂正)**: 本 batch は検索トークン以外にも決定的
  HMAC を使う。それぞれ導出入力と鍵ローテ時の挙動が異なるため、Q4 の
  tenant 別鍵を流用せず**用途ごとに分離**する。以下を本節の正本一覧とし、
  各節はこれを参照する(以前は §5.2 / §6.4 / §11 に分散して定義され、鍵階層を
  読む実装者からは見えなかった)。

  | 用途 | 導出 | ローテ時の性質 |
  |---|---|---|
  | 検索トークン(§3.2) | `HKDF(root, tenantId)` | 索引再構築で回復可能(再生成可能 projection) |
  | patientNumber uniqueness guard(§5.2) | `HKDF(root, tenantId, pharmacyId, purpose="patientNumberGuard")` | **一意性不変条件に直結**。active + retained 全 version へ同一 TWI で conditional Put し全 version を強読する。片側だけのローテは重複 Patient を silent に生む |
  | PATIENTLINK key(§11) | `HKDF(root, tenantId, pharmacyId, purpose="patientLink")` | guard と同一規律を共有する。link は immutable なので旧 version の解決可能性を保持する |
  | idempotency lookup key(§5.2) | tenant-scoped secret からの purpose 分離 HMAC(`lookupKeyVersion` で版管理) | retirement は本 batch で unsupported。retained set は単調増加 |
  | 集約 deny `eventId`(§6.4) | `HKDF(root, tenantId, purpose="denyAggregateEventId")` | key 面(outbox SK / dedupe key)に現れるため無鍵 hash 不可。ローテは新窓からのみ適用し、既存 intent の identity を変えない |

  pharmacy 粒度で分離する用途(guard / PATIENTLINK)は、tenant 単位鍵では
  同一 tenant 内の全薬局で同じ入力が同じ digest になり、低エントロピー値
  (患者番号・連番 patientId)の総当たり列挙と薬局ごとの母集団規模推定を許すため
  である。鍵階層と crypto-shred 到達性は SEC-008 の対象に含める。
- **S3 historical candidate**: DocumentReference等はWP-4250非選択で実装非認可。将来別WPで選択される場合もS3 + KMS、tenant-scoped object key等のsecurity reviewが必要。Object Lock/WORMは本書で確定しない。
- **FHIR authority item上限**: Patient/MedicationRequest itemはoperation後400 KB
  以下。超過はpre-write 422でありS3退避/ポインタ化しない。前項のS3 historical
  candidateはWP-4250非選択resourceの将来別設計だけで、clinical TWI fallbackではない。
- **金額・点数の DynamoDB 表現(MINOR-3)**: @yrese/money 経由で **string/bigint として直列化**し、金額・点数を DynamoDB Number(JS float 由来の精度落ち)にコード化しない(MOD-010 の格納面。ARC-008 §6「浮動小数点禁止」の具体化)。
- **生 PHI 非露出**: resource/body、氏名・カナ・患者番号・
  identifier、search/query/cursor/Reference、Authorization、Idempotency-Key、
  validation location/expressionを**キー/GSI/access log/APM/trace/metric label/
  非redact errorに載せない**。allowlist以外をdrop/redactする。fixtureは合成のみ。
- **`logicalId`と`path`の扱いは範囲付き**(§3.1、API-008 §3.2)。以前の版は
  これらを上の一律禁止列挙へ含めていたが、§3.1がkey/URLでの使用を許可した
  ことと矛盾していた。正しくは、**trust boundary内のPK/SK/GSI key/cursor拘束/
  path/`Location`/`entry.fullUrl`では許可**し、**access log/APM/trace/exception/
  metric label/外部送信/非redact error本文では禁止**する。この許可はlogicalIdが
  §3.1の予測不能性要件を満たすことに依存しており、時刻順序IDやPHI由来値を
  logicalIdにした時点で成立しない。
- **`internalPatientId`と`patientId`生値にも同じ禁止側を適用する
  (round-5 security訂正)**。§11はこれらをwire resourceJson / FHIR responseへ
  出さないとだけ規定しており、logicalIdについて明示している
  access log/APM/trace/exception/metric label/外部送信の禁止が非対称に欠けて
  いた。`internalPatientId`とlogicalIdの相関ペアが観測面に揃うと、pseudonymous
  identifierの再識別材料になる。両者を同じ禁止列挙の対象とし、許可される使用面は
  **item属性(保存時暗号化の対象内)に限る**。`patientId`生値は§11のとおりkeyへ
  置かず、PATIENTLINKのSKは`hmacPatientId`とする。

## 10. persistence-agnostic アダプタ境界(設計形)

```ts
interface FhirResourceStore {
  read(input: FhirReadInput): Promise<FhirResourceCurrent | undefined>;
  vread(input: FhirVersionReadInput): Promise<FhirResourceVersion | undefined>;
  search(input: FhirSearchInput): Promise<FhirSearchPage>;   // 有界 allow-list。未対応は OperationOutcome
  create(input: FhirCreateInput): Promise<FhirWriteResult>;
  update(input: FhirUpdateInput): Promise<FhirWriteResult>;  // §5 楽観ロック
}
interface ProjectionStore {
  getPatientSummary(input: PatientLookupInput): Promise<PatientSearchResult | undefined>;
  searchPatients(input: PatientSearchInput): Promise<PatientSearchPage>;  // §4.2 候補集合+メモリ内一致
  listReceptionQueue(input: ReceptionListInput): Promise<readonly ReceptionQueueEntry[]>;
  createReception(input: ReceptionCreateInput): Promise<ReceptionCreateResult>;  // §3.6 冪等
}
interface AuditAppendStore {
  // 認可(tenant/pharmacy/actor)と chain 位置(prevHash/seq)は intent が持てない(型で供給排除・WP-7001/MAJOR-2)。
  append(context: AuditWriteContext, intent: AuditAppendIntent): Promise<AuditEvent>;
  verify(context: AuditWriteContext): Promise<AuditPersistenceVerification>;  // #5 app-local 型(seq/dedupe/TIP/key/codec/scope 失敗を表現)。chainScope は context(tenant+pharmacy)からのみ構成
}
// AuditWriteContext = AuthContext 由来の trusted TenantContext { tenantId: TenantId, pharmacyId: PharmacyId, actorId: UserId }(live apps/api TenantContext と同名・#8。呼び出し側 payload 由来でない)
// AuditAppendIntent  = Omit<CreateAuditEventInput, "tenantId" | "pharmacyId" | "actorId" | "prevHash" | "sequenceNumber">
//   append は scope を context からのみ再構成し foreign tenant フィールドを混ぜない(§6.1 3アイテム同一PK・§7・§12)
//   eventId は唯一の dedupe identity(#8)。caller が intent を retry ループ外で一度構成し全 attempt で同一 eventId を再利用する
```

境界規律: アダプタのみ AWS SDK / DynamoDB マーシャリング / リトライ / テーブル名を持つ。契約は `@yrese/contracts`、ID/status/error 値は `@yrese/shared-kernel`、監査ハッシュ計算は `@yrese/audit`。純粋コアはアダプタ/AWS を import しない。**check:boundaries を実装前に拡張(WP-6002)**して本境界を機械検知する。

## 11. PostgreSQL → DynamoDB 段階移行(fail-closed)

WP-5002/5003のPostgreSQL Patient実装を撤去しない。persisted control stateは
state machineとする。値集合は
`POSTGRES_PRIMARY`, `SHADOWING`, `CUTOVER_PENDING`, `FHIR_PRIMARY`,
`POSTGRES_PRIMARY_ROLLED_BACK` であり、**一方向ではない**。前進遷移は
`POSTGRES_PRIMARY → SHADOWING → CUTOVER_PENDING → FHIR_PRIMARY`、rollback遷移は
`FHIR_PRIMARY → POSTGRES_PRIMARY_ROLLED_BACK`、再cutoverは
`POSTGRES_PRIMARY_ROLLED_BACK → SHADOWING → CUTOVER_PENDING` である。それ以外の
遷移を定義しない。**rollback状態から`CUTOVER_PENDING`へ直接遷移できない
(round-3 MEDIUM訂正)**: `CUTOVER_PENDING`のparity要件(bounded count/content
digest parity)は`SHADOWING`でのみ生成されるため、以前の版の直接遷移
`POSTGRES_PRIMARY_ROLLED_BACK → CUTOVER_PENDING`は自らのgateを満たせない到達
不能経路だった。再cutoverは必ず`SHADOWING`を再経由してparityを再生成する。
rollback中にPostgreSQL側で行われた書込はこの再parityで検出される。**単調性は`authorityEpoch`だけの性質**であり、前進・rollback・
再cutoverのいずれの遷移でもepochは必ず増加する(§5.1が正本)。
以前の版はここを「一方向state machine」と書いていたが、同じ§11がrollbackを
認めているため自己矛盾であり、かつ§5.1の撤回と食い違っていた。実装者が本節を
値集合の正本として読むため、この不整合はrollback後のsplit-authorityへ直結する。

- `POSTGRES_PRIMARY`/`SHADOWING`: PostgreSQLがsole writer。shadowは比較専用で
  writerにならない。
- `CUTOVER_PENDING`: approved field mapping、identifier reconciliation、
  unresolved duplicate/orphan/conflict/merge-linkがzero、bounded count/content
  digest parity、synthetic/de-identified manual sampling、stable watermarkと
  write drain/fence、human approval recordを全て要求する。さらに下記
  **reception互換要件**の承認を要求する。
- **reception互換要件(HIGH-3 訂正・cutover blocker)**: live receptionは
  PostgreSQL `patients` 行に構造的に依存している。
  `migrations/000002_create_patient_and_reception_tables.sql` は
  `reception_entries_patient_fk FOREIGN KEY (tenant_id, pharmacy_id, patient_id)
  REFERENCES patients (...)` を宣言し、`apps/api/src/db/reception-repository.ts`
  は `INNER JOIN patients p` で患者属性を解決している。Patient authorityを
  FHIRへ移してもこの参照整合性とjoin経路は消えない。したがってcutoverは
  次を定めたapproved設計なしに実行してはならない。
  0. **Patient登録経路とidentity訂正経路が存在すること**(API-008 §2.2)。
     create無効・delete無効・merge/unmerge unsupported・identity不変を合成すると
     `FHIR_PRIMARY`ではPatient集合が閉じ、新患登録も誤登録訂正もできない。
     この状態でcutoverすると業務停止か本節が禁じるPostgreSQL直接書込
     (split-authority)かの二択になり、現場は既存recordの人口統計項目を
     書き換えて流用する方向へ圧力を受ける。`BLOCKED_PATIENT_IDENTITY_MUTATION`
     と`BLOCKED_PATIENT_CREATE_UNIQUENESS`の解除順序はcutoverより**前**である。
  1. cutover後に`reception_entries.patient_id`が何を参照するか(PostgreSQL
     `patients`をread modelとして残すのか、参照先を変えるのか)。
  2. 参照整合性を強制する主体。DB制約を外してapplication層へ黙って降格しない。
     降格する場合は、孤児受付の検出・修復契約を同時に定義する。
  3. `INNER JOIN patients` の代替(投影の同期更新か、join除去か)。既存受付
     一覧が cutover 前後で欠落・重複・順序変化しないことを含む。
  4. rollback時の整合。cutoverを戻す際にreception側が壊れないこと。
  この設計が承認されるまで`BLOCKED_RECEPTION_PATIENT_COMPATIBILITY`とし、
  `CUTOVER_PENDING`から先へ進めない。
- **switchの順序(cross-store atomicityに依存しない)**: switchはPostgreSQLと
  DynamoDBに跨るatomic operationとして実装できない。安全性は次の順序、すなわち
  **時間的に重ならない単一writerの交代**によってのみ担保する。
  1. PostgreSQL側writerを停止する。**applicationの自己抑制では足りない**
     (下記 fence primitive 要件を参照)。
  2. in-flight transactionのdrain完了を確認する。in-flight件数が0であることを
     証明できない間は次へ進まない。
  3. §5.1のauthority control itemを`authorityEpoch`単調増加と
     `writerFenceToken`更新でconditional atomic advance/fenceする。
  4. **その後だけ**FHIR側writeを許可する。
  fence前の`authorityEpoch`を持つwriterは以後すべてTWI condition failureとなる。
  失敗時はexactly old writerかexactly new writerのどちらか一方でなければならず、
  両方が書ける中間状態を作らない。PostgreSQL側の再有効化(rollback)も同じ
  4段順序でepochをさらにadvanceして行い、旧FHIR writerをfenceする。
  2 phase commit、XA、best-effort補償によるcross-store atomicityの主張は
  `SSOT_UPDATE_REQUIRED`とする。
- **PostgreSQL側fence primitiveの不在を解消済みと主張しない(HIGH 訂正)**:
  上記step 1「停止」を、以前の版は「新規write受付を拒否」としか書いていなかった。
  これはapplication層の自己抑制であり、停止信号を受け取っていないinstanceは
  `patients`へのINSERT/UPDATE権限を保持したままである。network partition中の
  instanceが回復後にキュー済みの更新をcommitすれば、DynamoDB側と並走して
  同一Patientに2系統の履歴が生じ、どちらが正かを判定する情報が両storeに残らない。
  またstep 2の「in-flight件数が0」は**観測時点の性質**でしかなく、観測直後に
  開始されるtransactionを排除できない。write を拒否させる仕組みなしの
  「in-flight = 0 の証明」は原理的に成立しない。したがって次を要求する。
  1. 停止を**構造的に不可能**にするprimitiveを用意する。PostgreSQL側の書込権限を
     revokeする、roleをread-onlyへ切り替える、またはauthority epochを参照する
     DB側fenceを置く。いずれを採るかをapproved amendmentで確定しSSOTへ固定する。
     applicationの自己抑制をこのprimitiveの代替にしない。
     **棚卸しの対象は「applicationが使うrole」に限らない(round-5 security)**。
     `patients`へ書き得る主体として、application role、**break-glass /
     緊急アクセス用credential、superuser / owner role、migration実行用
     credential、運用者の直接接続**を明示的に列挙し、各々についてrevokeまたは
     read-only化の証跡を要求する。列挙から漏れた経路は「停止済み」と扱わない。
  2. cutover後も承認された期間、`patients`への書込発生を検出する片方向
     detectorを置く。検出時は`AUTHORITY_SPLIT_DETECTED`としてfail-closedで
     停止する。cutover後の継続的な乖離検出経路は現在`SHADOWING`のparity比較
     しかなく、cutover後には存在しない。§11のreception互換要件が示すとおり
     `patients`行はcutover後もjoin先として生き続ける前提なので、書き手が
     残存する現実的経路がある。**detectorの稼働期間を有限にする場合、その
     終了根拠を承認事項とする(round-5 security)**: `patients`行がjoin先として
     存続する限り書き手の出現可能性は消えないため、「一定期間経過」だけを
     終了根拠にしない。終了は、書込権限の恒久的revokeが証跡付きで確認された
     時点、または`patients`への依存自体が解消された時点に紐づける。
  この2点が承認・実装されるまで`BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE`とし、
  Patient cutoverを実行しない。
  **前提の訂正(round-4 data-integrity)**: 現時点のrepository実装には
  PostgreSQL `patients`への書込経路が存在しない(patient repositoryは
  read-onlyで、INSERT/UPDATEを発行するproduction code pathがない)。したがって
  「writerを停止しdrainする」は**今日の観測ではtrivially真**であり、code path
  の観測はcutover gateの充足証明にならない。fence要件の対象は観測された
  writerではなく**write grant**である: `patients`へ書き得るrole/credentialの
  棚卸しと、実行時点でのrevoke/read-only化のevidenceをもってstep 1を充足とし、
  「現在writerがいない」ことを根拠にstep 1/2を省略しない。将来Patient登録経路
  (API-008 §2.2解除)がPostgreSQL側へ実装された場合、この前提訂正は失効し、
  実writerに対する通常のdrain/fenceが必要になる。
- approved cutover transactionは各reconciled PatientについてFHIR creation
  `VERSION#00000000000000000001`をauthoritative baselineとして作る。CURRENT、
  immutable VERSION 1 (`interactionMethod=POST`,
  `changeOrigin=SYSTEM_CUTOVER`)、history-order、AFTER distinct canonical
  search delta、fence CAS、registered internal audit/outbox intent、および下記
  **PATIENTLINK item**を同じbounded transactionへ含める。history wire metadataは
  create/`POST Patient`/201だが、
  internal originは非REST cutoverでありexternal callerを主張しない。
  PostgreSQLの過去version/historyをFHIR VERSION 2以降へ推測・合成・backfillしない。
  mapping/reconciliation/audit registry/human cutover gateが欠ければtransactionを
  実行しない。
- **cutover transactionは冪等でなければならない(round-4 HIGH訂正)**。以前の
  版は再実行時の挙動を定めておらず、`logicalId`は生成のたびに新値になるため、
  部分失敗後の再実行が同一patientに対して**2つ目のFHIR Patientを別logicalIdで
  作成**し、merge/delete unsupportedのため修復経路が存在しなかった。次で
  構造的に排除する。
  - **PATIENTLINK item**: 各patientについて
    `PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#PATIENTLINK` /
    `SK = PATIENT#{hmacPatientId}` のimmutable linkage itemを、per-patient
    cutover TWI内で`attribute_not_exists(PK) AND attribute_not_exists(SK)`の
    conditional Putとして作る。itemは`{patientId, logicalId, authorityEpoch}`を
    暗号化payloadとして保持する。linkageは1:1かつimmutableで、更新・削除・
    再割当を行わない。
    **`patientId`を生値でkeyへ置かない(round-5 security訂正)**。以前の版は
    「`patientId`は内部surrogateだから非PHIであり原則7に適合する」と断定して
    いたが、`patientId`の生成規律・形式はどのAPPROVED SSOTにも存在せず、
    `migrations/000002_create_patient_and_reception_tables.sql`の`patient_id`は
    自由形式TEXTで`patient_number`との同値を禁じる制約も持たない。レガシー
    レセコンからの移行では「患者ID = 患者番号」の運用が現実にあり、その場合
    `SK = PATIENT#{patientId}`は**生の患者番号をkeyへ置く**ことになり原則7へ
    直接違反する。本batchは§5.2でpatientNumber guardを低エントロピー・列挙
    リスクを理由にHMAC化しており、同じ値を別の場所で生のままkeyへ置くのは
    非対称である。したがって前提に依存せず構造的に閉じる。
    - `hmacPatientId`は`HKDF(root, tenantId, pharmacyId, purpose="patientLink")`
      から導出した鍵によるHMACとし、§5.2のpatientNumber guardと同じ
      pharmacy+用途分離とkey version/rotation規律を共有する。生の`patientId`は
      暗号化item payload内にのみ置く。
    - 決定的HMACなので、patientIdが既知であれば
      `patientId → hmacPatientId → link`の解決は従来どおり成立し、再実行の
      skip判定・投影のlinkage解決はいずれも復号を要しない。
    - この構造化により、`patientId`がPHI由来値であるか否かに**正しさが依存
      しなくなる**。ただし`patientId`はitem payloadとCURRENTの
      `internalPatientId`にも載るため、いずれも保存時暗号化の対象内に置き、
      §9のlog/trace/metric禁止を適用する。
  - **再実行はPATIENTLINKを唯一の進捗authorityとする**: 再実行・再開時は
    PATIENTLINKを強整合で読み、存在するpatientをskipする。linkが存在しない
    patientだけが新しいlogicalIdの発行対象になる。logicalIdの発行(VERSION 1/
    CURRENTの作成)はlink Putと同一TWIに束ねられているため、同一patientへ2つ目の
    logicalIdがcommitされる経路は条件不一致でatomicにabortする。「VERSION 1の
    存在」や「CURRENTの存在」を進捗判定に使わない(logicalIdが未知では
    addressできないため)。
  - **per-patient TWIはauthority stateへ束縛する**: 各per-patient TWIは
    `ConditionCheck(authorityState = CUTOVER_PENDING AND authorityEpoch = :e)`を
    含み、cutover実行中のepochへ固定する。最終遷移
    `CUTOVER_PENDING → FHIR_PRIMARY`は、**reconciliation対象集合とPATIENTLINK
    集合が等しいこと**を下記のmembership検査とcardinality検査の**合成**で確認
    した後の単一conditional epoch CASであり(基数比較単独でも包含検査単独でも
    足りない)、それ自体も再実行で二重適用されない。
  - **PATIENTLINKは投影とreceptionのlinkage経路である(round-4 HIGH訂正)**:
    §3.4のpatient summary/search投影は`patientId`をkeyに持つが、cutover後の
    正本はlogicalIdでaddressされるFHIR Patientであり、以前の版には両者を結ぶ
    経路が存在しなかった(logicalIdはPHI由来・関連付け可能値を禁じるため
    `patientId`から導出できない)。cutover transactionはVERSION 1/CURRENT item
    へ内部属性`internalPatientId`(非PHI surrogate。wire resourceJsonへ含めず
    FHIR responseへ出さない)を持たせ、投影再生成はCURRENTから直接patientIdを
    解決する。PATIENTLINKはpatientId→logicalId方向の解決と再実行進捗の
    authorityを担い、§11のreception互換設計(`reception_entries.patient_id`の
    参照先)もこのlinkageを利用できる。これらなしのcutoverはpatientId-keyed
    投影・受付を再生成不能にするため、cutover gateへ「全reconciled patientの
    PATIENTLINK存在とCURRENTの`internalPatientId`保持」を含める。
  - per-patient TWIのaction数はVERSION 1経路の固定action + AFTER delta +
    PATIENTLINK 1件として§5のpreflightへ算入する。**per-patient cutover TWIも
    §5.2の「全clinical TWI」に含まれ、rotation control ConditionCheckを持つ**
    (round-5訂正: 上記のaction列挙がrotation CCを省いて読めたため明示する)。
    固定actionの数え方はAUTHORITY CC + ROTATION CC + CURRENT + VERSION 1 +
    history-order + fence CAS + audit intent + PATIENTLINK = 8 であり、
    §5.2のupdate/create invariantと同じ規律でAFTER deltaを加算する。
  - **最終epoch CASの件数一致確認をmembership比較として定義する(round-5訂正)**:
    「PATIENTLINK件数がreconciliation対象件数と一致」は基数比較としても読め、
    その読みでは「1件欠落 + 1件余剰」が一致と判定される。確認は次の**2条件の
    合成**とし、片方だけで結論しない。
    1. **membership**: reconciliation対象の各patientIdについて
       `hmacPatientId`を導出し、対応するlinkの存在を`ConsistentRead=true`で
       個別に確認する(対象集合 ⊆ PATIENTLINK集合)。
    2. **cardinality**: PATIENTLINK partitionを`ConsistentRead=true`で全ページ
       走査し、件数が対象集合の要素数と一致することを確認する。
    1と2が同時に成立するとき、かつそのときに限り両集合は等しく、余剰link
    (対象外patientIdのlink)が存在しないことが従う。**この構成はitem payloadの
    復号を要しない**ため、突合が鍵可用性に依存しない(§6.4 reconciliationと
    同じ規律)。余剰linkを検出した場合は下記のre-cutover divergenceとして扱い、
    欠落と相殺しない。この検査はTOCTOU窓を持つため、検査開始前に
    reconciliation対象集合を凍結し、検査中の新規link生成が起き得ないこと
    (cutover実行主体が単一であること)を運用前提として明記する。前提を強制する
    primitiveがない間は下記blockerの範囲に含める。
  - **rollback後の再cutoverには未解決の乖離解消経路がある(round-5 MEDIUM)**:
    `FHIR_PRIMARY → POSTGRES_PRIMARY_ROLLED_BACK → SHADOWING → CUTOVER_PENDING`
    の2周目では、既にPATIENTLINKを持つpatientはskipされる。しかしrollback期間中に
    PostgreSQL側で当該patientの人口統計項目が変更された場合、再parityは差分を
    **検出はする**が、解消経路が存在しない: VERSION 2以降のbackfillは禁止、
    `SYSTEM_CUTOVER` baselineはVERSION 1限定、Patient PUTはwrite producer
    prerequisites未成立で使えない。同様に、rollback中にPostgreSQL側でpatientが
    統合・削除されてreconciliation対象集合が縮んだ場合、対応するPATIENTLINKは
    削除禁止のためorphanとして残り、上記membership検査は通っても余剰linkが
    恒久的に残る。どちらも現設計では恒久dead-endであり、「未解消差分はcutoverを
    blockする」という既存規律と合成すると**再cutoverが二度と成立しない**状態に
    なり得る。したがって`BLOCKED_RECUTOVER_DIVERGENCE_RESOLUTION`とし、
    rollbackを経た再cutoverは、(a) rollback期間中のPostgreSQL側変更を
    FHIR authorityへ反映する承認済み経路、または (b) 変更を禁じるrollback期間の
    運用制約(PostgreSQL側もread-onlyに保つ)、のいずれかが承認されるまで
    実行しない。初回cutoverはこのblockerの対象外である。
- `FHIR_PRIMARY`: FHIR store/APIだけがwriter。stale PostgreSQL fallbackなし。
  post-cutoverのPatient updateは`Update(CURRENT)`であり、CURRENT itemを
  Put置換しない。**`internalPatientId`と`identityDigest`はCURRENTの保存必須属性
  であり、いかなる更新経路でも失わせない**(round-5訂正: Put置換実装は
  `internalPatientId`をsilentに落とし、投影・受付のlinkageを破壊する。
  §5.2のtemplateは`Update`を指定しているが、保存義務を明文化していなかった)。

production PHI parityは別human approvalを要する。shadow dataはapproved field
mappingの最小項目だけ、encrypted、least privilege、audited、bounded retention。
abort/cutover後はapproved privacy policyに従いcleanupまたはisolated retentionし、
未解消差分はcutoverをblockする。

MedicationRequestはcurrent runtime/store/writer/dataがないため、final approval、
locked-profile validation、security prerequisites、MOD-008 audit mapping後の
first accepted createからFHIR ingestionをsole initial writerとする。clinical
authority dataのmigration/backfillはなく、projection index rebuildだけを許す。
Reception、audit、accounting、billing、calculation、claims、dispensingは移行しない。

**MedicationRequest対内部Prescriptionのownership未解決(HIGH-3 訂正)**:
DOM-002 §4のPrescription集約(C4)は`PrescriptionId`をrootとし、RP明細、
DOM-004の処方ライフサイクル(仮受付→仮取込→薬剤師確認→確定)、訂正版による
履歴保持を持つ内部authorityである。MedicationRequestはこの集約の置換でも
1対1写像でもない。両者について次が本batchで未確定である。

- cardinality(Prescription 1件と MedicationRequest の対応数。RP単位か処方箋単位か)
- どちらがどのfieldの可変authorityを持つか
- status対応(DOM-004ライフサイクルとFHIR `MedicationRequest.status`/`intent`)
- correction lineage(訂正版新規作成とFHIR側versionの関係)
- projection方向(内部→FHIR、FHIR→内部、双方向禁止の別)

未確定のままMedicationRequest ingestionを開始すると、同一臨床事実に対する
authorityが2箇所に生じる(ARC-008 §8「同一集約をFHIR正本と内部正本に二重格納」
禁止に抵触する)。したがって`BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP`
とし、DOM-002 / DOM-005 / DOM-006へownership recordを登録するapproved
amendmentまでingestionを開始しない。「MedicationRequestは新規開始なので競合
しない」という理由づけは、Prescription集約が既に定義済みである以上成立しない。

ロールバック: Patient cutover前はshadowを無効化してPostgreSQL authorityを維持。cutover後は明示的逆移行計画+human reviewが必要で、stale PostgreSQLへのautomatic fallbackはしない。MedicationRequestはaccepted create後に別writerへautomatic fallbackしない。

## 12. 不変条件・停止条件

- 認可を body/query/path/FHIR meta の tenant で行う → 実装禁止(§2/§7)
- 静的共有ロールのみでテナント分離を主張(per-request スコープなし)→ CHANGES_REQUESTED(§7 M6)
- `dynamodb:LeadingKeys` のスコープダウンを tenant 止まりにする、または fallback
  で pharmacy 粒度を失う → 実装禁止(§7 HIGH-8 訂正)
- clinical TWI に §5.1 の authority control ConditionCheck を含めない、
  `authorityEpoch` を advance せずに writer を交代させる、PostgreSQL と
  DynamoDB に跨る cross-store atomicity を主張する → 実装禁止(§5.1/§11)
- reception FK/join 互換設計の承認前に Patient cutover を実行 →
  BLOCKED_RECEPTION_PATIENT_COMPATIBILITY(§11)
- Prescription 集約と MedicationRequest の ownership 未確定のまま
  MedicationRequest ingestion を開始 →
  BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP(§11)
- Patient create の TWI に `(tenantId, pharmacyId, patientNumber)` uniqueness
  guard を欠いたまま create を有効化、または生の patientNumber を key へ置く →
  実装禁止(§5 create テンプレート・原則7)
- lookup-key version を retained set から外す、retirement を実装・実行する →
  BLOCKED_LOOKUP_KEY_RETIREMENT(§5.2)
- idempotency record へ raw response body / raw request payload を保存する、
  replay で `resourceJson` を parse・再直列化してから返す、digest 不一致で
  近似 body を replay する →
  実装禁止(§5.2、API-008 §4.1.1)
- 患者検索の候補集合フェッチ/復号を bound なしに実行、または上限超過時に
  truncated results を返す → BLOCKED_PATIENT_SEARCH_SCALE_BOUND(§3.4)
- snapshot materialization を bound 評価なしに実行、中断した materialization の
  SEGMENT を cleanup 登録しない、client 切断後にバックグラウンドで完走させる →
  実装禁止(§4.1、API-008 §5.3)
- audit outbox の `DONE#` 痕跡を物理削除する、DLQ item へ TTL を付ける、intent と
  dedupe の突合による reconciliation を持たない、audit intent の durable commit
  前に **auditable operation の response(成功・deny・failure・空 searchset を
  区別しない)** を返す → 実装禁止(§6.4)
- PHI または PHI 由来値を `logicalId` にする、時刻成分・カウンタ成分・登録順
  相関成分を含める(ULID/UUIDv7 等)、`logicalId` を再利用・再割当する
  → 実装禁止(§3.1、API-008 §3.2)
- `resourceJson` を `M`/`N` 等の structured attribute で格納する
  → 実装禁止(§3.1。`N` の数値正規化が FHIR decimal の末尾ゼロを落とし
  byte-exact replay を壊す)
- `authorityState` を単調前進と扱う、rollback 後の状態を `FHIR_PRIMARY` のまま
  残す、writer が `writerFenceToken` を control item から取得した値で自己照合
  する → 実装禁止(§5.1)
- PostgreSQL 側の書込停止を application 自己抑制だけで担保する、cutover 後の
  乖離 detector なしに cutover を実行する
  → BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE(§11)
- pharmacy segment を持たない GSI PK を追加する、`LeadingKeys` の粒度検証から
  GSI/Scan を除外する → 実装禁止(§3.3、§7)
- canonical form(`#` 非包含)と `GLOBAL` 予約が型で強制されていない状態で
  pharmacy 粒度分離を実装根拠にする
  → BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT(§7)
- patientNumber guard の HMAC を tenant 単位鍵で導出する、guard に key version /
  rotation 規律を持たせない → 実装禁止(§5.2。鍵ローテで一意性が silent に壊れる)
- outbox intent に audit fact 再構成用の暗号化 payload を持たせない、消込を
  dedupe 実在の ConditionCheck なしに実行する、outbox の可変性を「append-only」と
  呼ぶ、reconciliation を `PENDING#` 名前空間分離と bound なしに実行する、
  未収束 intent 用に tenant 止まりの GSI を新設する、収束後も payload を
  落とさず恒久保持する、deny 経路の intent 生成に quota を課さない、
  auditable operation の response を audit intent commit 失敗時に返す
  → 実装禁止(§6.4)
- audit payload を外部 store 参照で保持する
  → BLOCKED_AUDIT_PAYLOAD_EXTERNAL_STORE(§6.4)
- payload 削除を dedupe 実在の ConditionCheck なしに実行する、収束していない
  DLQ item の payload を時間経過だけで落とす、`DONE#` へ payload を引き継がない
  → 実装禁止(§6.4)
- deny 経路の quota 到達を記録せずに 429 で打ち切る、集約 intent の commit 失敗後に
  429 を返す、quota を scope 単位だけで遮断する → 実装禁止(§6.4)
- 集約 deny intent へ試行回数を Update で累積する、決定的 `eventId` 導出なしに
  集約 intent を作る、窓の閉鎖前に集約 intent を配送する、存在確認と commit の
  双方に失敗した状態で 429 を返す → 実装禁止(§6.4)
- 検索 index delta の圧縮で latest delta を削除する、retention 期限内の delta を
  削除する、**superseding delta 自身の retention 経過を確認せずに superseded
  delta を削除する**、keep-latest 規則と barrier test なしに圧縮を実行する、圧縮を
  clinical TWI 内で行う → 実装禁止(§3.2)
- 集約 deny intent の配送可否・reconciliation 除外を暗号化 payload の復号に
  依存して判定する、`intentKind`/`deliverableAfter` を平文属性として持たない、
  `deliverableAfter` を後から Update する → 実装禁止(§6.4)
- 最終 epoch CAS の判定を PATIENTLINK の基数比較だけで行う、membership 検査
  だけで行う(余剰 link を検出しない)、PATIENTLINK Query を
  `ConsistentRead=false` で行う → 実装禁止(§11。membership と cardinality の
  合成のみを可とする)
- PATIENTLINK の SK へ生の `patientId` を置く、`hmacPatientId` を pharmacy/用途
  分離のない鍵で導出する、guard/alias と異なる rotation 規律にする
  → 実装禁止(§11、原則7、§5.2)
- `internalPatientId` / `patientId` 生値を access log / APM / trace / exception /
  metric label / 外部送信へ載せる → 実装禁止(§9)
- 集約 deny intent の `eventId` を無鍵 hash で導出する → 実装禁止(§6.4。
  `eventId` は SK と dedupe key に載るため総当たりで principal を逆引きできる)
- index delta 圧縮の削除を ConditionCheck なしに実行する、`retentionExpiresAt`
  を持たない delta を削除対象にする、圧縮 role を clinical writer と同一権限で
  実行する → 実装禁止(§3.2)
- PostgreSQL 側 write grant の棚卸しから break-glass / superuser / migration
  credential / 運用者直接接続を除外する、乖離 detector の終了根拠を「一定期間
  経過」だけにする → BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE(§11)
- rollback を経た再 cutover を、rollback 期間中の PostgreSQL 側変更の反映経路
  または変更禁止の運用制約が承認される前に実行する →
  BLOCKED_RECUTOVER_DIVERGENCE_RESOLUTION(§11)
- CURRENT を Put 置換して `internalPatientId` / `identityDigest` を失わせる
  → 実装禁止(§11、§5.2)
- cutover transaction を PATIENTLINK conditional Put なしに実行する、再実行の
  進捗判定を PATIENTLINK 以外(VERSION/CURRENT の存在等)で行う、同一 patientId
  へ複数 logicalId を commit し得る経路を残す、PATIENTLINK を更新・削除・再割当
  する、CURRENT の `internalPatientId` を wire resourceJson / FHIR response へ
  出す → 実装禁止(§11)
- 再 cutover を `SHADOWING` 再経由なしに `CUTOVER_PENDING` へ直接遷移させる →
  実装禁止(§11)
- 「現在 PostgreSQL 側に Patient 書込経路が存在しない」ことを cutover gate の
  drain/fence 充足根拠にする → 実装禁止(§11)
- update の budget preflight で delta set を per-version cap 1 個分として計上
  する、patientNumber guard を 1 件として計上する、§7.1 の JSON cap を partition
  cap の根拠にする → 実装禁止(§5.2)
- Patient update の `Update(CURRENT)` 条件式へ `identityDigest` 照合を合成せず、
  identity 不変性を TWI 前検証だけで担保する → 実装禁止(§5.2、API-008 §2.2)
- `identityDigest` を key/GSI key/log/metric label へ置く → 実装禁止(原則7、§3.1)
- snapshot 並行度を単純 counter で強制し crash 時に恒久 429 へ張り付かせる、
  cleanup 可否を「active cursor 参照の確認」で判定する → 実装禁止(§4.1)
- 同一アイテムへ ConditionCheck+Update を1トランザクションで併用 → 実装禁止(§5/§6 M1/M2)
- create/updateのidempotency Putから
  `attribute_not_exists(PK) AND attribute_not_exists(SK)`を外す、recordをoverwrite、
  cancellation/ambiguous後にactive+retained全lookup versionを強読しない →
  実装禁止(§5)
- active versionだけにidempotency recordを作る、aliasをtransaction外で補完する、
  persisted control ConditionCheckを省く、rotation generationを退行させる、
  および**lookup-key retirementの実装・実行(§5.2により種類を問わずunsupported。
  証明の有無を条件にしない)** → 実装禁止(§5)
- TWI全distinct action targets/operation後item aggregateをpreflightしない、
  100 actions/4 MiBを超える、または
  chunking/partial commitで回避する → 実装禁止(§5)
- bounded FHIR authorityの400 KB超itemをS3 offload/pointerで成功扱い →
  実装禁止(§5/§9)
- upper watermarkだけでFHIR searchのduplicate/skip防止を主張、immutable delta/
  materialized as-of snapshot/retention/corruption/barrier testなしにsearchを広告 →
  `BLOCKED_FHIR_SEARCH_SNAPSHOT_IMPLEMENTATION`
- 監査 append に seq 非依存の dedupe ガード(§6.1)を欠く / 曖昧失敗を dedupe ガードなしにリトライ → 実装禁止(論理重複・§6.1 MAJOR-1)
- cloud 監査チェーンの sequenceNumber を tip 採番でなく呼び出し側供給にする → 実装禁止(SK/tip/entryHash 連番の乖離・§6.1 MAJOR-2)
- 監査 append intent が tenantId/pharmacyId/actorId/prevHash/sequenceNumber を authority・chain 位置として供給できる型 → 実装禁止(trusted `AuditWriteContext` のみ・§10/§6.1 WP-7001)
- 監査 `event`/`dedupe`/`TIP` を相異なる PK に分散(3アイテム同一 `chainScope` PK を破る)→ 実装禁止(chain-locality/co-location と単一 `Query` 取得の設計不変条件・§6.1。TWI/LeadingKeys の必須要件ではない点は §6.1 #7 参照)
- 同一 `eventId` + 相違 logical intent を新規 append(冪等衝突を hard conflict で拒否しない)→ 実装禁止(§6.1 decision C)
- 曖昧失敗回復を `TransactionCanceledException` reason code 解釈で駆動し state 再読(dedupe→event, TIP)に依らない → CHANGES_REQUESTED(DynamoDB Local 差異・§6.1)
- ストレージ整合検証(seq 連続/dedupe/TIP/SK-payload 一致)を `verifyAuditHashChain` に再実装(コア委譲でなく)→ CHANGES_REQUESTED(二重実装禁止・§10/§6.1 decision B)
- `zeroPad`定義域外(0以下・uint64上限超過)を書込、固定20桁key/
  unpadded base10 attr/ETag/meta.versionIdのround-tripを崩す、JS numberを経由、
  client meta.versionIdをauthority化、duplicate versionを受理 → 実装禁止
- 監査 `tip.eventId` 一致だけで冪等成功と結論(dedupe→event の intent 比較を経ない)→ 実装禁止(§6.1 #1)
- 冪等一致判定を chain 位置込みの fingerprint(entryHash / `sequenceNumber` 込み)で行う → 実装禁止(並行追記で偽 conflict。`intentFingerprint` は prevHash/seq/entryHash/attempt 除外・§6.1 #2)
- dedupe/`TIP` のスキーマ未 pin のまま直接回復を実装 → CHANGES_REQUESTED(dedupe `{eventId,eventSk,sequenceNumberDecimal,entryHash,intentFingerprint,fingerprintSchemaVersion}` / TIP `{eventId,sequenceNumberDecimal,entryHash}`・§6.1 #3)
- `TIP` 欠如「単独」を genesis と扱い SEQ#/DEDUPE# の非存在を強整合で証明しない → 実装禁止(seq=1 fork・§6.1 #4)
- 非 genesis `TIP` を true-tail 検証せず信頼(TIP 参照 event と実 last SEQ# を強読しない)/ TIP CAS を完全 tuple(eventId+seq+entryHash)でなく entryHash 単独で行う → 実装禁止(stale/corrupt TIP による fork・§6.1 #2)
- 強読を snapshot と誤認し `TIP1`/`TIP2` の再読なしに mismatch を integrity error とする → 実装禁止(正常 contention を corruption と誤判定。`TIP1 != TIP2` は retry・§6.1 #1)
- 同一最大 seq の重複(`SEQ#N#EVENT#a` と `#b`)を降順 Limit 1 のみで検出済みと見なす → 実装禁止(seq 接頭の exact query で count=1 を要求・§6.1 #2)
- `intentFingerprint` から envelope `retryCount` を除外する → 実装禁止(`AuditAppendIntent` の一部で entryHash に確定・除外すると偽 same-intent。除外は adapter 内部 attempt カウンタのみ・§6.1 #3)
- verify を安定窓(`TIP1`→全ページ強読→`TIP2`)なしで実施し `TIP1 != TIP2` を integrity error とする → 実装禁止(検証中の正常 append を corruption と誤判定・§6.1 round-4)
- 監査 adapter の永続書込 / 本 pin の完了を、正確な v1 canonicalizer と golden input/output vector が実装 + レビュー済みになる前に行う → 実装禁止(canonicalization は §6.1 #4 で WP-7001 実装 + golden vector に委譲。SSOT-first fail-closed の担保)
- 回復で dedupe 保存 `intentFingerprint` のみ比較し保存 event から再計算・tuple 整合検証をしない → 実装禁止(corrupt/swap dedupe を冪等成功として受理・§6.1 #1)
- 冪等 fingerprint のアルゴリズム/`fingerprintSchemaVersion` を永続契約として固定しない(跨デプロイで不安定)→ CHANGES_REQUESTED(§6.1 #3)
- `sequenceNumber` を TIP/dedupe/event/SK で異なる表現・JS number 経由で扱う → 実装禁止(`sequenceNumberDecimal` base10 統一・decode してから +1・§6.1 #4)
- 全単射検証を集合等価のみで行う(eventId 一意・件数一致・ポインタ一意参照を課さない)→ 実装禁止(重複 eventId が Set で潰れ偽陽性・§6.1 #6)
- 監査 `verify` が core `AuditHashChainVerification` を返し seq/dedupe/TIP/key/codec/scope 失敗を表現しない → CHANGES_REQUESTED(app-local `AuditPersistenceVerification`・§6.1 #5/§10)
- dedupe/`TIP` を破損・orphan(対応 event 無し / event 集合と dedupe eventId 集合が不一致)のまま valid と扱う → 実装禁止(bijective 検証・§6.1 #6)
- `eventId` を retry ループ内で再生成 / dedupe identity を `eventId` 以外に二重化 → 実装禁止(dedupe 破綻・§6.1 #8)
- append-only・法定保存アイテム(監査/台帳/確定請求/確定領収/FHIR 版履歴)への TTL/物理削除 → 実装禁止(§2/§5、ARC-008 §8、DB-004)
- 同一集約を FHIR 正本と内部正本に二重格納 / Provenance を格納正本化 → 実装禁止(§3.1 M5、ARC-008 §8)
- 生 PHI をキー/GSI/ログに露出 / 氏名・カナを HMAC で prefix 検索と称する → 実装禁止(§9 M4)
- 純粋コアへの AWS/DynamoDB 直結合 → CHANGES_REQUESTED(§10、check:boundaries)
- 投影を同期/非同期いずれとも規定せず read-after-write を壊す → SSOT_UPDATE_REQUIRED(§8 M7)
- DynamoDB 設計未確定のまま PostgreSQL 正本を撤去 → SSOT_UPDATE_REQUIRED(§11)
- 一次情報未確認の DynamoDB/FHIR 実装(推測実装)→ SSOT_UPDATE_REQUIRED

## 13. access-pattern 実証メトリクス(製品確定ゲート、Q8)

DynamoDB 製品確定の前提として計測する: (a) **単一 PK の WCU/RCU 使用率 対 ~1000/3000 上限**(`chainScope`・GSI1PK — 真のホットパーティション実証)/ (b) 受付キュー query p95 / (c) FHIR 検索 p95 **かつ 患者 name/kana 部分一致の recall/precision**(M4 ギャップを実測で露見)/ (d) 投影再生成ラグ(read-after-write)/ (e) **監査 append の tip 条件衝突/リトライ率** / (f) 薬局あたりコスト。

## 変更履歴

- 0.1.3 (2026-08-01 finalization): round-5 の独立 review 三レーン完了
  (independent verifier は packet 本文 PASS・HIGH なし)と direct human approval に
  より PROPOSED → APPROVED。**本文 semantics は不変**。承認範囲は SSOT 改版のみで
  あり、実装着手・schema/data migration・production action・conformance 主張は
  含まない。登録済み blocker は全て据え置きである。
- 0.1.3 (2026-07-31 Revision 14): round-5 独立 security/privacy re-review の
  findings を訂正。**MEDIUM**: §11 の PATIENTLINK は `SK = PATIENT#{patientId}`
  として生の `patientId` を key へ置き、その正当化を「patientId は内部
  surrogate だから非 PHI」という**どの SSOT にも規律のない前提**に置いていた。
  `migrations/000002_…` の `patient_id` は自由形式 TEXT で `patient_number` との
  同値を禁じる制約を持たず、レガシーレセコン移行では「患者 ID = 患者番号」の
  運用が現実にある。その場合 SK は生の患者番号そのものになり原則 7 に違反する。
  本 batch が §5.2 で patientNumber guard を低エントロピー・列挙リスクゆえに
  HMAC 化していることとも非対称だった。SK を
  `hmacPatientId`(`HKDF(root, tenantId, pharmacyId, purpose="patientLink")`、
  guard と同一の rotation 規律)へ変更し、生値は暗号化 item payload 内のみと
  した。決定的 HMAC なので再実行 skip 判定と投影 linkage は復号なしで従来どおり
  成立する。あわせて最終 epoch CAS を **membership + cardinality の合成**として
  定義し直し(membership だけでは余剰 link を、cardinality だけでは欠落と余剰の
  相殺を見逃す)、両検査とも payload 復号を要さないことを明記した。
  もう 1 件の **MEDIUM**: §3.2 の keep-latest 圧縮は「latest 非削除・retention
  内非削除」を prose と barrier test だけに委ねており、本 batch が §5.2
  `identityDigest` と §6.4 payload 削除に課した「破壊的操作を application の
  自己抑制に委ねない」基準と非整合だった。誤削除は存命 record の検索欠落
  (SAF 隣接)を招く。各 delta へ `retentionExpiresAt` を持たせ、削除を
  `TransactWriteItems(ConditionCheck(superseding delta s: exists AND
  s.retentionExpiresAt <= :now) + Delete(d exact key) with retentionExpiresAt
  <= :now)` として機械強制し、圧縮 role の least-privilege 分離と実行記録の
  運用監査を実装 WP の承認要件に加えた。**LOW 3 件**: §9 へ
  `internalPatientId` と `patientId` 生値の access log/APM/trace/metric label/
  外部送信禁止を logicalId と parity で追加(相関ペアの観測面露出は再識別材料に
  なる)。§6.4 の集約 deny `eventId` は outbox SK と dedupe key に載るため、
  無鍵 hash では `(principal, scope, windowStart)` の総当たりで「どの principal が
  いつ quota に達したか」を key の存在だけから逆引きできる。keyed HMAC
  (`purpose="denyAggregateEventId"`)へ変更した。あわせて、本節が保証するのは
  記録の完全性であって検知の即時性ではないことを明記し、開放窓中の deny 集中を
  検知する outbox 非依存の経路を SEC-007/SEC-008 起票事項へ含めた。§11 の
  write grant 棚卸しへ break-glass / superuser / migration credential / 運用者
  直接接続を明示列挙し、乖離 detector の終了根拠を「一定期間経過」ではなく
  権限 revoke の証跡または `patients` 依存の解消へ紐付けた。
  訂正後の自己整合スイープで **§9 が用途分離鍵を列挙していなかった**ことを検出
  した。検索トークン以外に patientNumber guard(§5.2)、PATIENTLINK(§11)、
  idempotency lookup key(§5.2)、集約 deny `eventId`(§6.4)が決定的 HMAC を
  使うが、定義が各節へ分散し、鍵階層の正本である §9 Q4 は検索トークン鍵しか
  挙げていなかった。tenant 単位鍵の流用(guard / PATIENTLINK では低エントロピー
  値の総当たり列挙を許す)へ倒れる誘因が残るため、導出入力とローテ時の性質を
  含む正本一覧表を §9 へ追加した。
  あわせて §7 の `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` について、解除条件
  (a)「キー構築経路が branded 型を経由することの保証」を
  `scripts/check-boundaries.mjs` の複合キー構築検知として**実装した**ことを
  記録した(承認済み key codec 以外の production source が `TENANT#` /
  `PHARMACY#` を含む literal を持つと CI が落ちる。positive/negative fixture を
  `check-scripts.mjs` に追加し、規則の呼び出しを外すと negative test が落ちる
  ことを変異で確認)。静的検知は動的連結までは捕捉しないため証明ではない旨も
  明記し、残余を (b) 既存永続値の検証のみへ縮小した。blocker は維持する。
- 0.1.3 (2026-07-31 Revision 13): round-5 独立 data-integrity re-review の
  findings を訂正。**HIGH**: §3.2 の keep-latest 圧縮は削除対象 delta `d` の
  retention 経過だけを条件にしていたが、`d` を supersede する delta `s` が
  retention 内に新しく作られている場合、`d.indexCommitSequence <= fence <
  s.indexCommitSequence` を満たす as-of fence が依然有効であり、その
  materialization は `d` を読む。旧条件では当該 snapshot から logicalId が
  silent に欠落し、同節末尾の barrier 不変条件と数学的に矛盾していた。削除条件へ
  **superseding delta 自身の retention 経過**を追加して閉じた。§6.4 の集約
  deny intent は、窓境界を暗号化 payload にしか持たないため
  「未閉鎖窓を reconciliation 差分から除外する」判定が復号なしには実装不能
  だった。平文属性 `intentKind`(`individual`/`aggregateDeny`)と
  `deliverableAfter`(`windowEnd + max clock skew`、生成時確定・以後不変)を
  追加し、配送可否と除外判定の双方を平文で行えるようにした(正確な窓境界と
  principal/scope は暗号化 payload 側に残す)。§11 の最終 epoch CAS は
  「件数一致」が基数比較としても読め、欠落1件と余剰1件が相殺する読みを許して
  いたため、**reconciliation 対象集合 ⊆ PATIENTLINK 集合の membership 検査**
  として定義し、`ConsistentRead=true` の全ページ走査と対象集合の事前凍結を
  要求した。per-patient cutover TWI が §5.2 の「全 clinical TWI」に含まれ
  rotation ConditionCheck を持つことを明示し、固定 action を 8 として数え方を
  確定した。rollback を経た再 cutover については、rollback 期間中の
  PostgreSQL 側の属性変更・統合・削除に対する解消経路が VERSION 2+ backfill
  禁止 / `SYSTEM_CUTOVER` の VERSION 1 限定 / PUT producer 未成立 /
  PATIENTLINK 削除禁止の合成により存在せず、「未解消差分は cutover を block
  する」既存規律と合わせると再 cutover が恒久的に成立しなくなり得ることを
  `BLOCKED_RECUTOVER_DIVERGENCE_RESOLUTION` として登録した(初回 cutover は
  対象外)。CURRENT の `internalPatientId` / `identityDigest` を保存必須属性と
  明文化し、Put 置換による silent 消失を §12 で禁止した。§7 の
  `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` は前提が live code と乖離していた
  ため事実訂正した: `branded-ids.ts` は `KEY_DELIMITER = "#"` を全 factory の
  `assertValidId` で拒否し、`kernel.test.ts` が全 factory の negative test と
  複合キー曖昧性の不成立を固定している。blocker の範囲を「factory が拒否しない
  こと」から「キー構築経路が branded 型を経由することの保証」へ縮め、
  conservative 側は維持した(round-4 の PostgreSQL writer 前提訂正と同種)。
- 0.1.3 (2026-07-31 Revision 12): round 4 の設計 findings を user direction 下で
  訂正(いずれも fail-closed 側を選択)。§3.2 へ検索 index delta の
  **keep-latest 圧縮規則**を新設: 圧縮単位は `(partition, logicalId)`、retention
  期限経過後の superseded delta のみ削除可、latest delta は削除しない、latest が
  `present=false` の pair は期限後に全体削除可、圧縮は clinical TWI 外の有界
  background 操作で barrier test 証明前は実行しない(未実装の既定=削除しない)。
  §5.2 の joint invariant を **operation 別**へ訂正: update の delta set は
  `|A ∪ (B \ A)|` で per-version cap の最大2倍に達するため
  `7 + 2*maxIndexedTokenPartitions + N <= 100`、MedicationRequest create は
  `7 + maxIndexedTokenPartitions + N <= 100`、Patient create(将来)は guard が
  active+retained 全 version 分 `N` 件を占めるため
  `7 + maxIndexedTokenPartitions + 2N <= 100`。評価点は write preflight の実数
  カウントであり、§7.1 JSON cap がこの cap を含意するという主張は撤回
  (identifier 1件=2 partition)。§6.4 の集約 deny intent を `PENDING#`/`DONE#`
  lifecycle へ適合: `eventId` は `(principal, scope, windowStart)` から決定的に
  導出、窓あたり1回だけ conditional Put、以後は存在の強整合確認後に 429、
  **試行回数の保持を撤回**(既存 item の Update を含意するため)、配送は窓閉鎖
  + clock skew 後、集約 deny event は MOD-008 登録範囲
  (`BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT`)へ追加。§11 の再 cutover を
  `POSTGRES_PRIMARY_ROLLED_BACK → SHADOWING → CUTOVER_PENDING` へ訂正(parity は
  `SHADOWING` でのみ生成されるため直接遷移は自らの gate を満たせない)。cutover
  transaction へ **PATIENTLINK item**(patientId→logicalId の immutable 1:1
  linkage、conditional Put)と CURRENT の `internalPatientId` 内部属性を新設し、
  再実行の進捗 authority を PATIENTLINK に一本化して同一 patientId への複数
  logicalId 発行を構造的に排除、patientId-keyed 投影と reception 互換設計の
  linkage 経路を定義、最終 epoch CAS を件数一致確認後の単一 conditional 遷移と
  した。PostgreSQL `patients` への書込経路が現在ゼロである事実を記録し、fence
  要件の対象を観測された writer から **write grant** へ再定義(「現在 writer が
  いない」は gate 充足根拠にならない)。§12 停止条件と §5.2 test obligations を
  同期。
- 0.1.3 (2026-07-31 Revision 11 — mechanical): round 4 findings のうち他文書 § 参照3箇所へ文書接頭辞を付与。設計 findings は未解決のまま escalation を維持。
- 0.1.3 (2026-07-31 Revision 10): independent re-review round 3 の HIGH 3 件の
  訂正。§3.1 へ Patient の `identityDigest` 属性(identity tuple の SHA-256、
  item 属性であり key/GSI/log へは置かない)を追加し、§5.2 の Patient update
  テンプレートの `Update(CURRENT)` 条件式へ
  `identityDigest = :expectedIdentityDigest` を合成して、API-008 §2.2 の
  identity 不変性を TWI で構造的に強制した。期待値は validated request resource の
  identity から導出するので、identity を変更した request は条件不一致で TWI 全体が
  abort する。action 数は増えず joint invariant にも影響しない。属性未設定の
  CURRENT への update も条件が false に評価されて自動的に fail-closed になる。
  §6.4 の payload 破棄は「収束 + safety window の経過後」という時間駆動の記述が
  DLQ item(定義上未収束)に対して二通りに読めたため、**収束駆動へ一本化**した:
  `DONE#` は消込 TWI で収束が証明済みなので window 経過後に削除でき、`DLQ#` は
  dedupe が実在するようになるまで落ちない。削除自体も消込と同型の
  `ConditionCheck(dedupe 実在)` + `attribute_exists` で機械強制する。消込 TWI は
  payload を `DONE#` へ引き継ぐ。収束しない DLQ payload の無期限保持は
  `BLOCKED_AUDIT_PAYLOAD_RETENTION_POLICY` として SEC-007/SEC-008 へ送る。
  deny quota は「記録せず 429 で打ち切る」形をやめ、(principal, scope, 時間窓)
  あたり 1 件の集約 intent を durable commit してから 429 を返す形へ縮退させ、
  無記録の窓を禁止した。quota は principal 単位とし scope 単位単独で遮断しない。
  phase-disabled route への 404 は auditable operation に当たることを明記。
  §2 原則 5(b) を monotonic transition 群へ改称し、遷移が ConditionCheck で
  機械強制されることを明示。§12 と blockers を同期。PROPOSED を維持。
- 0.1.3 (2026-07-31 Revision 9): independent re-review round 2 の訂正。
  §2 原則 5 を「TTL / 物理削除を持たないアイテム集合」へ改め、append-only 群
  (a)に加えて monotonic single-transition 群(b)として outbox intent と DLQ を
  明示列挙(§6.4 の継承主張に文言上の根拠がなかったため)。§3 の tenant-wide を
  `PHARMACY#GLOBAL` sentinel から `TENANT#{tenantId}#SCOPE#TENANT#...` の別
  prefix 空間へ移し、`GLOBAL` という名の薬局が tenant-wide session policy から
  到達される権限昇格経路を構造的に解消(この修正は allow-list 内で完結するため
  `branded-ids.ts` の外部 prerequisite を待つ必要がなかった)。§3.1 へ
  `resourceJson` の `S` 格納と `logicalId` の予測不能性 MUST / pseudonymous 分類。
  §4.1 の Patient post-cutover 表記から create を除去し 405/404 の phase 差を明記。
  §5.1 で `authorityState` の単調前進主張を撤回して `POSTGRES_PRIMARY_ROLLED_BACK`
  を追加し、`writerFenceToken` の自己保持が DynamoDB 層で強制できないことを
  明示して `BLOCKED_WRITER_FENCE_TOKEN_ISSUANCE` 化。§5.2 で alias の canonical
  outcome tuple から `lookupKeyVersion` を分離(混入していると rotation 済み
  tenant の全 replay が integrity error になる)、`maxIndexedTokenPartitions` を
  新設して retained 版数 bound の残余を計算可能化、patientNumber guard の鍵導出を
  pharmacy + 用途分離へ。§6.4 で消込を `PENDING#` 削除 + `DONE#` Put の単一 TWI
  へ改め、payload を inline 保持のみ・収束後削除・共通属性継承とし、deny 経路の
  intent 生成 quota と reconciliation の名前空間分離・bound を追加。§7 の SEC-008
  検証範囲へ GSI と Scan を追加。§11 の「一方向 state machine」定義を訂正し、
  cutover gate の先頭に Patient 登録経路と identity 訂正経路を追加。§12 と
  blockers を同期。PROPOSED を維持。
- 0.1.3 (2026-07-31 Revision 9 追補、round 3 escalation 後): §6.4 の正規 key
  ブロックだけが `SK = INTENT#EVENT#{eventId}` のまま取り残されていたのを
  `PENDING#` / `DONE#` / `DLQ#` の 3 状態へ訂正。この 1 行を放置すると、実装者が
  key ブロックどおりに書いた場合に reconciliation の
  `begins_with(SK, "PENDING#")` が恒常的に空集合を返し、消込 TWI も非存在キーへの
  Delete が成功するため通ってしまい、本節が「唯一の収束検出器」と呼ぶ機構が
  silent に無効化される。SK 辞書順と単一遷移、および単一名前空間を使ってはならない
  理由も本文へ記録した。
- 0.1.3 (2026-07-31 Revision 8): independent re-review round 1 の
  REQUEST_CHANGES ×3 を訂正。§4.1 の Patient post-cutover 表記から `create` を
  除去(格納側実装者が最初に読む節に create 有効の記述が残っていた)。§3.5 の
  GSI2PK へ pharmacy segment を追加し、§3.3 の「全 GSI PK が tenant+pharmacy
  prefix」という主張を事実と一致させた。§3.1 に `resourceJson` の `S` 格納と
  `logicalId` の予測不能性 MUST / pseudonymous 分類を追加。§5.1 で
  `authorityState` の単調前進主張を撤回し `POSTGRES_PRIMARY_ROLLED_BACK` を
  追加、`writerFenceToken` を writer 自己保持値との照合へ改めた。§5.2 で
  retirement の論拠を事実へ訂正(alias は単一 partition で列挙可能)し、
  retained set 単調増加による action budget 侵食、key compromise 時の経路不在、
  patientNumber guard の鍵導出/version/rotation 規律を追加。§6.4 で intent へ
  audit fact 再構成用 payload を要求し、消込を dedupe 実在の ConditionCheck 付き
  TWI へ、reconciliation に sparse index と bound を、failure behavior を deny
  を含む auditable operation へ拡張。§7 で SEC-008 の検証範囲へ GSI/Scan を
  追加し、branded ID factory が canonical form と `GLOBAL` 予約を強制していない
  ことを blocker 化。§11 で PostgreSQL 側 fence primitive の不在と cutover 後の
  乖離 detector 要件を明示。§4.1 の cleanup 判定を期限一本化し並行度を lease 化。
  §12 停止条件と blockers を同期。PROPOSED を維持。
- 0.1.3 (2026-07-31 Revision 7): independent domain review の HIGH/MEDIUM 訂正。
  §3.1 に server 生成 opaque 非 PHI `logicalId` を明記。§3.4 に候補集合フェッチ/
  復号/working set/wall time/並行度の measured cap と fail-closed overload、
  非 PHI 粗インデックス代替の決定要件を追加。§4.1 に snapshot materialization
  bound の格納側強制と中断時 cleanup を追加。§5.1 で resource authority control
  item(`authorityState`/`authorityEpoch`/`writerFenceToken`)を新設し全 clinical
  TWI へ ConditionCheck を必須化、cross-store atomicity の主張を禁止。§5.2 で
  idempotency record の field set を API-008 §4.1.1 へ委譲し raw body 非保存を
  明記、lookup-key retirement を unsupported と宣言。create テンプレートへ
  Patient create の patientNumber uniqueness guard 要件を追加。§6.4 で outbox
  intent → audit fact の収束、DLQ の append-only、reconciliation、PHI response
  前の durable commit を規定。§7 で `dynamodb:LeadingKeys` を tenant + pharmacy
  粒度へ拡張し fallback でも粒度を落とさないことを明記。§11 に reception
  foreign key/join 互換要件、drain → fence → epoch advance → 新 writer の 4 段
  順序、Prescription/MedicationRequest ownership blocker を追加。PROPOSED を維持。
- 0.1.3 (2026-07-30 Revision 6): distinct BEFORE/AFTER canonical partition
  delta、precision-derived `_lastUpdated` interval、Patient cutover VERSION 1
  `SYSTEM_CUTOVER` baseline、history fullUrl、live method projection、
  mandatory Patient PUT idempotencyとplanned fixturesを追加。PROPOSEDを維持。
- 0.1.3 (2026-07-30): WP-4250 PROPOSED。DynamoDBを未選定候補のまま維持し、Patient/oral-topical MedicationRequestだけへauthority scopeを限定。create idempotency、single If-Match authority、automatic write retry禁止、Patient shadow/human cutover、MedicationRequest no-backfill initial writerを整合。
  Revision 4で全active+retained lookup version alias、monotonic rotation、
  API-008 exact search fingerprint、URI no-network、100-action/4-MiB
  transaction preflightを追加。Revision 5でpersisted rotation control fence、
  standard identifier/code semanticsとset algebra、bounded history、DynamoDB native
  400-KB/100-action/4-MiB accounting、S3 fallback禁止を追加。
- 0.1.2 (2026-07-10): WP-7001(Phase 1 AuditAppendStore スライス)の監査 append/verify 設計詳細を pin(APPROVED 0.1.1 設計に矛盾しない fail-closed 明確化)。§3 `zeroPad`(uint64 固定20桁・監査/台帳 SEQ# に scope・FHIR VERSION# は `encodeFhirVersionKey` として API-008 保留)。§6.1: 3アイテム同一 `chainScope` PK(co-location/query 不変条件)、genesis 空証明(SEQ#/DEDUPE# 非存在を強整合で証明)、非 genesis TIP の **TIP1/TIP2 読取安定化 + true-tail 検証 + 完全 tuple CAS**(fork 防止)、`intentFingerprint`(chain 位置除外・retryCount 包含・SHA-256/sorted-key canonical JSON/`fingerprintSchemaVersion=1`)、回復の corrupt/swap 検知(current==dedupe==recompute(event) 3者一致 + tuple 整合 + ConsistentRead)、`sequenceNumberDecimal` 表現統一(attr unpadded / SK 20桁 zeroPad の同値2エンコーディング)、bijective 検証、verify も TIP1/TIP2 安定窓、app 層 `AuditPersistenceVerification`。§10 `append(context, intent)`・`verify(context)`、`AuditWriteContext {tenantId, pharmacyId, actorId: UserId}`。§12 対応停止条件。canonicalization の正確な規則表は golden-before-write stop 付きで WP-7001 実装+golden vector に委譲(SSOT は意味論=何を含むかを pin)。**レビュー: codex 独立2レビュア 5-round 敵対的ピアレビュー(round-1〜5・累計 HIGH/MED/LOW を解決)CONSISTENT + opus4.8 最終確認 OPUS_CONFIRMED(§12 dedupe schema の fingerprintSchemaVersion 追記・changelog ラウンド整合の 2 MINOR を修正)+ fable5 で PROPOSED→APPROVED 昇格。** WP-7001 実装は golden vector 完成が前提(§12 stop)。
- 0.1.1 (2026-07-10): opus4.8 レビュー(CHANGES_REQUIRED、M1-M8 のうち7件 RESOLVED・M3 PARTIAL)の指摘を反映。**MAJOR-1**: §6.1 監査 append に **seq 非依存の dedupe ガードアイテム**(`SK=DEDUPE#EVENT#{eventId}` を `attribute_not_exists` で Put)を追加し、並行アペンダ下の論理重複窓を閉じた(`tip.eventId` 突合は補助的短絡へ降格・不一致=未コミットと結論しない)。**MAJOR-2**: cloud チェーンの `sequenceNumber` を **tip 採番**にし §10 append の Omit に追加(SK/tip/entryHash 連番の乖離防止)。**MAJOR-3**: §7 に LeadingKeys×StringLike 非成立時の **MVP スコープ内フォールバック**(テナント別テーブル/tenantId 単独 PK)を本文明示 + SEC-008 最優先検証化。MINOR-1/2(SK 時刻の固定桁 UTC ISO・DATE=Asia/Tokyo 業務日)、MINOR-3(金額は @yrese/money string/bigint・DynamoDB Number 不可)、MINOR-4(Patient テナント vs 投影薬局スコープの同期更新先)、MINOR-6(shard N 選定基準)、MINOR-7(TIP 書込集中は §13(e) 計測)を反映。dedupe ガードは opus が「正しい TransactWriteItems 雛形」と認めた §3.6 受付ガードと同一パターン。opus4.8 再検証で 3 MAJOR とも RESOLVED・新規誤りなしを確認(APPROVED_READY)。version drift を訂正し、チェーン検証読取の SK フィルタ(`begins_with(SK,"SEQ#")`)・dedupe の書込増幅コストの実装補足を追記のうえ **PROPOSED→APPROVED 昇格(opus4.8 + fable5)**。機微なセキュリティ/法令の具体は BLOCKED に退避。
- 0.1.0 (2026-07-10): 初版起草。WP-6001(codex 設計提案)の骨格を採用し、opus4.8 敵対的レビューの必須修正 M1(§5 楽観ロックの同一アイテム制約)/M2(§6.1 監査 tip の同一アイテム制約)/M3(監査 append の曖昧失敗冪等化)/M4(HMAC 部分一致不可 → API-001 投影経由)/M5(Provenance 投影・格納正本除外)/M6(per-request STS テナントスコープ)/M7(投影の同期更新)/M8(GSI シャーディング・チェーンセグメント化・10GB 訂正)と MINOR、fable5 決定 Q1-Q8 を織り込んで確定。ARC-008 優先の下で DB-001..004 の DynamoDB 具体化を担う。セキュリティ/法令の確定事項は BLOCKED を明示。opus4.8 レビュー前の PROPOSED。
```
