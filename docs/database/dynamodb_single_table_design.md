# dynamodb_single_table_design — DynamoDB single-table ストレージ設計(FHIR 格納正本・投影・append-only 監査/台帳)

```yaml
ssot_id: DB-005
title: DynamoDB single-table ストレージ設計(FHIR 格納正本・投影・append-only 監査/台帳)
domain: database
status: APPROVED
approved_at: 2026-07-10
approved_by: opus4.8(敵対的レビュー + 再検証 APPROVED_READY・v0.1.1)+ codex 独立2レビュア 5-round 敵対的ピアレビュー CONSISTENT + opus4.8 最終確認(OPUS_CONFIRMED・v0.1.2 監査 append/verify pin)+ fable5
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required(セキュリティ/法令 — 機微部は BLOCKED_SECURITY_REVIEW/BLOCKED_LEGAL_REVIEW に退避)
version: 0.1.2
created_at: 2026-07-10
updated_at: 2026-07-11
effective_from: null
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
related_work_packages: [WP-5004, WP-6001, WP-6002, WP-7001, WP-9002-W5E]
related_tests:
  - packages/audit/src/audit.test.ts
  - packages/audit/src/audit-hydration.test.ts
  - packages/audit/src/intent-fingerprint.test.ts
  - apps/api/src/dynamodb/audit-persistence-key-codec.test.ts
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5E metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions:
  - Q3 上位ティア: per-tenant table/account 物理分離(高リスク/大規模テナント向け)の提供有無と条件(商用判断 + SEC-008)
  - HMAC 決定的検索トークンの許容範囲(exact-token のみか、低感度粗バケットを許すか)は SEC-008 で確定
  - 患者検索の候補集合フェッチのスケール上限(1薬局患者数の実測)と粗バケット最適化の採否
  - 監査/台帳チェーンのセグメント化(月次等)+ アンカー連結の具体設計
blockers:
  - BLOCKED_SECURITY_REVIEW: IAM 条件式構文(StringEquals/StringLike)・per-request STS セッションポリシー/セッションタグの最終形・KMS 鍵階層・HMAC pepper 管理・break-glass ロールは SEC-008 §3 完了後に確定
  - BLOCKED_LEGAL_REVIEW: FHIR 版履歴・監査・会計・確定請求/領収の保存年限は REG-003/DB-004 の法令整理まで断定しない(削除しない側に倒す)
  - BLOCKED_FHIR_CONFORMANCE_REVIEW: profile/terminology/conformance test なしに JP Core 準拠を訴求しない(PRD-007/ARC-008 継承)
```

## 1. 目的と位置づけ

ARC-008(FHIR ハイブリッド・PH-OS 汎用投影・AWS 移行)の格納層を、DynamoDB single-table として設計する正本。WP-6001(codex 設計提案)の健全な骨格を採用し、opus4.8 敵対的レビューの必須修正(M1..M8)と fable5 の設計決定(Q1..Q8)を織り込んで確定する。

**本書の範囲**: single-table のキー設計・access pattern・楽観ロック・監査/台帳 append-only 機構・テナント分離機構・投影整合・暗号化/PHI 配置・persistence-agnostic アダプタ境界・段階移行。**範囲外**: FHIR REST の wire 契約・CapabilityStatement の正式契約(別 SSOT、API/FHIR ドメインで起草)、AWS 基盤 IaC(別 SSOT)。本書は格納の観点から必要な FHIR 相互作用・検索の**格納側決定**を規定し、対外契約はそちらへ委譲する。

**DynamoDB 製品確定は独立ゲート**(ARC-008 §2)。本書は「AWS 移行(ユーザー確定)」の下での第一候補設計であり、access pattern 検証 + BLOCKED_SECURITY_REVIEW 解除をもって製品確定する。DB-001..004 は ARC-008 により改版予約中(暫定 ARC-008 優先)であり、本書はその DynamoDB 具体化を担う。

## 2. 設計原則(不変)

1. **テナント先頭キー**: すべてのテーブル PK と全 GSI パーティションキーは `TENANT#{tenantId}` で始まる。テナント境界を IAM に可視化し(§7)、通常系のクロステナントアクセスを構造的に排除する。
2. **ペイロードのテナントを信用しない**: `tenantId`/`pharmacyId` は JWT/AuthContext からのみ導出する。FHIR `meta.security`・FHIR extension・path・body・query は認可根拠にしない(ARC-008 §6)。アダプタは全キーを AuthContext と検証済み branded ID から構築する。
3. **集約ごと単一格納正本**: FHIR リソースを内部臨床集約として二重格納しない。Patient は FHIR Patient を正本へ移行。Reception は**内部運用集約を維持**(§Q1)。
4. **投影は再生成可能な非正本**: 検索索引・患者サマリ・PH-OS カード・キューカードは FHIR/内部正本から再生成できる投影であり、正本にならない。
5. **append-only アイテムに TTL を付けない**: 監査イベント・会計台帳・確定請求・確定レセプト/領収・**FHIR 版履歴**は DynamoDB TTL 属性を持たず、物理削除経路を持たない(ARC-008 §8、DB-004 fail-closed)。
6. **FHIR の可変性は履歴を弱めない**: current アイテムは楽観ロックで可変だが、受理された変更ごとに不変な version アイテムを生成する。FHIR delete は tombstone(状態遷移)であり物理削除ではない。
7. **キー・ログに生 PHI を置かない**: アイテムは保存時暗号化されるが、キー値と診断情報は運用メタデータになり得る。氏名・カナ・患者番号・保険者番号等は**キー/GSI/ログに平文で載せない**。決定的検索トークンはテナント別鍵の HMAC(§9)。
8. **アダプタのみが AWS を知る**: AWS SDK・DynamoDB 条件式・リトライ・AttributeValue マーシャリングは `apps/api` 永続化アダプタ(将来の persistence パッケージ)に限定。`packages/{calculation,money,date-time,trace,audit,shared-kernel,events,contracts}` は DynamoDB/AWS を import しない(check:boundaries が機械強制、WP-6002)。

## 3. single-table キー設計

論理テーブル(候補): `yrese-core`。

| キー | 型 | 規則 |
|---|---|---|
| `PK` | string | 全アイテムで `TENANT#{tenantId}` 始まり |
| `SK` | string | アイテム種別ごとのソートキー |

共通属性: `tenantId` / `pharmacyId`(pharmacy スコープ時。tenant-wide は `PHARMACY#GLOBAL` + `scope=tenant`)/ `entityType` / `schemaVersion` / `createdAt` / `updatedAt`(アプリ供給。DB now() 禁止)/ `phiClassification` / `encryptionStatus`(MOD-009 継承: PHI/PII → `encrypted` 必須)。

**キーセグメント正準形の不変条件**: `tenantId` を含む全補間値(`resourceType`/`logicalId`/`token`/`receptionId`/`pharmacyId` 等)は **`#` を含まない正準エンコード**を強制する。これはプレフィックス衝突(例: tenant "A" と "AB")・キー曖昧性・§7 の LeadingKeys プレフィックス安全性の前提である。FHIR logicalId は仕様上 `[A-Za-z0-9.\-]{1,64}` で `#` 不可だが、規律として明文化する。

**SK 時刻値の正準形の不変条件(MINOR-1/2)**: ソートキーに埋める時刻値(`acceptedAtIso` / GSI1SK の `lastUpdated` 等)は**固定桁・UTC・固定精度の ISO 8601 形式**(`toISOString()` 正準・ミリ秒固定)とし、辞書順 = 時系列順を保証する(精度混在で `asc` 順序が崩れることを防ぐ)。日付セグメント `DATE#{yyyyMmDd}` は **Asia/Tokyo 業務日(`businessDate`、MOD-011)**であり acceptedAt の UTC 日付ではない(JST 深夜跨ぎの誤パーティションを防ぐ。§4.3 の明示日付と整合)。

**SK 数値セグメント(連番)の正準形の不変条件(WP-7001)**: `zeroPad(n)` は**固定20桁・10進・ゼロ埋め**を意味し、`n` の定義域は uint64 `[1, 18446744073709551615]`(20桁)とする。辞書順 = 数値順を全 uint64 で保証するために幅を固定する。定義域外(0 以下・上限超過)は**書込前に拒否**する(fail-closed。桁溢れの静かな巻き戻り・SK 順序破綻を防ぐ)。監査 `sequenceNumber` は `SEQ#` セグメント・イベント payload(entryHash 確定値)・`dedupe` ポインタ・`TIP` 保持値で**同一 bigint** を共有する(§6.1 MAJOR-2)。**適用範囲(#9)**: 本 pin は**監査/台帳の `SEQ#{zeroPad(sequenceNumber)}`(§6)に限定**する。FHIR `VERSION#{zeroPad(metaVersionId)}`(§3.1)は**本 pin の対象外** — FHIR `versionId` は外部から見え得る opaque id であり、内部 BigInt カウンタ・FHIR JSON/ETag の10進文字列表現・JS number 非経由・クライアント供給 `meta.versionId` の非流用は FHIR ストレージ SSOT(API-008 系)側で確定するまで、監査/台帳の連番規約を FHIR 版へ流用しない。

### 3.1 FHIR リソース current / 履歴

```text
current:  PK = TENANT#{tenantId}#FHIR#{resourceType}#{logicalId}   SK = CURRENT
version:  PK = TENANT#{tenantId}#FHIR#{resourceType}#{logicalId}   SK = VERSION#{encodeFhirVersionKey(metaVersionId)}
```

**FHIR 版キーの符号化(#7・#9)**: `encodeFhirVersionKey` は §3 の監査/台帳向け `zeroPad`(uint64 固定20桁)とは**別の符号化**であり、その最終形(内部 BigInt カウンタ・辞書順保証の桁固定・FHIR JSON/ETag の10進文字列表現・JS number 非経由・クライアント供給 `meta.versionId` の非流用)は **API-008 系 FHIR ストレージ SSOT で確定するまで PENDING**。監査/台帳の連番規約を FHIR 版へ流用しない(§3 の `zeroPad` pin は FHIR VERSION# に適用しない)。

属性: `resourceType`(CapabilityStatement で allow-list)/ `logicalId` / `metaVersionId`(整数・リソース毎単調増加)/ `lastUpdated`(アプリ供給)/ `resourceJson`(canonical FHIR JSON = 格納正本。400KB 超は §9 の S3 退避)/ `profileRefs`(conformance review まで参考情報)/ `pharmacyId`(pharmacy スコープ時)/ `deleted`(tombstone)。

**MVP 対象リソース**(§Q2、正式集合は DOM-006/FHIR ストア契約 SSOT で確定): Patient / Coverage / Organization / Practitioner / PractitionerRole / Location / Medication / MedicationRequest / MedicationDispense / DocumentReference。

**Provenance は格納正本一覧に含めない**(M5)。監査由来 Provenance は §6 の内部監査からの**read-only 派生投影**であり、格納正本(可変・版管理)にしない(ARC-008 §6/§8 二重格納禁止)。外部由来の非監査 provenance を扱う場合は別途分離設計。

### 3.2 FHIR 検索索引(exact-token のみ)

```text
PK = TENANT#{tenantId}#FHIRIDX#{resourceType}#{searchParam}#{token}   SK = RESOURCE#{logicalId}#VERSION#{metaVersionId}
```

- **exact-match のトークンのみ**を索引化する: `identifier` / `subject`・`patient`(参照)/ `medication`(terminology マッピング後の code)/ `_lastUpdated`(§3.3 GSI)。
- PHI を含むトークンはテナント別鍵の**決定的 HMAC トークン**(§9)。非 PHI の code トークンは正規化 code-system|code 文字列を SEC 承認のうえ可(§9)。
- **氏名・カナ・部分一致は本索引で扱わない**(M4: HMAC は prefix/substring を保存しない=暗号学的に不可能)。患者の氏名/カナ部分一致検索は §4.2 の API-001 投影経由とする。FHIR facade の `name` 検索は MVP で**未対応宣言**(OperationOutcome)。
- 索引アイテムは再生成可能投影。current 変更時に置換/削除してよい。version アイテムは履歴として残る。

### 3.3 型 × 更新時刻 GSI(書込シャーディング)

```text
GSI1PK = TENANT#{tenantId}#FHIRTYPE#{resourceType}#SHARD#{shard}   GSI1SK = UPDATED#{lastUpdated}#RESOURCE#{logicalId}
```

- `shard = hash(logicalId) mod N`(N は設計時定数。過小 N は大規模テナントでホット、過大 N は小規模テナントで読み増幅 — N 選定基準・再シャード方針は §13(a) の計測に紐付けて確定する)。**大規模テナントで単一 resourceType が単一パーティションに集中してホットになる問題(M8)を書込シャーディングで回避**。列挙時は N シャードを跨いでマージ。
- 用途: `_lastUpdated` 検索 / 合成環境の conformance fixture 列挙 / 投影 catch-up / テナントスコープの backfill。
- 全 GSI PK も `TENANT#{tenantId}` 始まり(§7)。
- 注: 10GB 制約は LSI 固有の item collection 制限で **GSI には非適用**(M8 訂正)。GSI の制約は単一パーティションの ~1000 WCU / ~3000 RCU。

### 3.4 患者サマリ投影 / 患者検索投影(API-001)

患者検索は FHIR Patient 正本の **PHI 投影 + 資格状態**。FHIR Patient が患者同一性の source。投影は直接編集せず、Patient/Coverage/資格スナップショットから再生成する(§8 で同期更新)。

```text
サマリ:   PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#PATIENT_SUMMARY#{patientId}   SK = CURRENT
検索候補: PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#PATIENT_SEARCH               SK = PATIENT#{patientSurrogateSortKey}#{patientId}
```

- **キーに生の氏名/カナ/患者番号を置かない**(原則7)。氏名・カナ・患者番号は**暗号化アイテムペイロード内**に保持する。
- **MVP の部分一致・カナ検索(M4 決定 Q2)**: 薬局スコープの検索候補アイテム集合(1薬局患者数は有界)を PK 単一クエリで取得し、アプリ内でペイロードを復号して**メモリ上で部分一致/カナ一致**する。キーに PHI を露出せず API-001 の部分一致+カナ要件を満たす。
- **カナ正規化**(全半角・濁点/半濁点・長音)を**索引生成時と照会時で同一適用**する(契約 = 医療 UI の取り違え防止に直結)。
- `patientSurrogateSortKey` は**非 PHI のソート可能サロゲート**(ULID / 内部連番)。「非可逆かつソート可能」は不可(M-minor)なので、非可逆ハッシュをソートキーにしない。表示用患者番号は暗号化ペイロード内。
- スケール上限(候補集合フェッチのコスト)と粗バケット最適化の採否は open_questions(SEC-008 と実測で判断)。

### 3.5 受付エントリ(内部運用集約 — Q1)

Reception は MVP で内部運用集約を維持する(§Q1)。

```text
キュー:  PK = TENANT#{tenantId}#PHARMACY#{pharmacyId}#RECEPTION#DATE#{yyyyMmDd}   SK = ACCEPTED#{acceptedAtIso}#RECEPTION#{receptionId}
GSI2:    GSI2PK = TENANT#{tenantId}#RECEPTION#{receptionId}                        GSI2SK = PHARMACY#{pharmacyId}#DATE#{yyyyMmDd}
```

属性: `receptionId`/`patientId`(branded)/ `acceptedAt`(アプリ供給 UTC)/ `businessDate`(Asia/Tokyo 業務日 MOD-011)/ `receptionStatus`(shared-kernel `RECEPTION_STATUSES`)/ `prescriptionIntakeType`(初期 `paper`)/ `idempotencyKeyHash`(PHI 非包含)。キュークエリは基表 SK 昇順で `acceptedAt asc + receptionId asc` を自然に返す。GSI2 は receptionId 直接引き(高カーディナリティ=ホットなし)。

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
| history-instance | 同 PK を `begins_with(SK, VERSION#)` で Query |
| create | §5 の create トランザクション |
| update | §5 の楽観ロックトランザクション |
| delete | tombstone(current を `deleted` 化 + version 追記。物理削除しない) |
| `_lastUpdated` | GSI1 を Query(N シャードマージ) |
| `identifier`/`subject`/`patient`/`medication` | §3.2 exact-token 索引 |

MVP CapabilityStatement 相互作用(§Q6): **read / vread / search(有界 allow-list)/ create / update / history-instance / delete=tombstone**。未対応の検索パラメータ・相互作用は FHIR **OperationOutcome** で fail-closed に返す(部分的な暗黙フィルタをしない)。conditional 系・patch・batch/transaction は post-MVP。

### 4.2 患者検索 API(API-001)

| 操作 | access pattern |
|---|---|
| `GET /patients/search` | §3.4 検索候補を薬局スコープで Query → ペイロード復号 → メモリ内で氏名/カナ部分一致 → カーソルをテナント/薬局/クエリに拘束してページング |
| `findById` | `PATIENT_SUMMARY#{patientId}` を Get。再生成ジョブ時のみ FHIR Patient にフォールバック |

患者検索投影は非正本。FHIR Patient/Coverage/資格スナップショットから再生成できる。

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

投影例: 処方カード / 調剤ワークフローカード / 残薬・リスクレビュー intake / 請求候補サマリ / 在宅訪問関連の服薬コンテキスト。**partner 中立**: `PH-OS` は認可・契約テストの partner app/client としてのみ現れ、**格納キー名・専用 scope に現れない**(API-004)。

## 5. 楽観ロック(M1 修正)

FHIR current は `metaVersionId` を書込バージョンとする。**同一 `CURRENT` アイテムへ `ConditionCheck` と `Update` を1トランザクションに併用しない**(DynamoDB は同一アイテムへの複数オペレーションを `ValidationException` で拒否する)。条件は **`Update` の `ConditionExpression` に統合**する。

**create**:
```text
Update/Put(CURRENT) ConditionExpression: attribute_not_exists(PK)
+ Put(VERSION#1)     ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)
+ Put/Delete(検索索引アイテム)   … すべて別アイテム
```

**update(If-Match)**:
```text
Update(CURRENT)  ConditionExpression: metaVersionId = :expectedVersion   (resourceJson 更新, metaVersionId+1, lastUpdated=アプリ供給)
+ Put(VERSION#new)  ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)
+ Put/Delete(検索索引アイテム)   … すべて別アイテム
```

`ConditionCheck` は「自分が書き換えない**別アイテム**」の表明にのみ使う。`If-Match` を欠く update-requiring 操作は FHIR OperationOutcome(conflict/precondition)を返す(FHIR REST 契約 SSOT で確定)。索引ファンアウトは 100 アクション/4MB のトランザクション予算内に有界化する(§8)。

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

## 7. テナント分離機構(M6 — DB-003 §4 の DynamoDB ネイティブ代替)

全 PK/GSI PK が `TENANT#{tenantId}` 始まり(§2)であることは分離の**構造的土台**だが、それだけでは不十分。**静的な共有アプリケーションロール + 固定ポリシーでは、リクエスト毎に変わる tenantId を `dynamodb:LeadingKeys` に束縛できない**。

- **既定機構(MVP)**: 単一ベースロールに対し、**リクエスト毎の STS AssumeRole セッションポリシー**(具体 `TENANT#<tid>#*` を注入)または**セッションタグ**(`TENANT#${aws:PrincipalTag/TenantId}#*`)で `dynamodb:LeadingKeys` をテナントにスコープダウンする。これにより通常系のクロステナントアクセスを**権限的に不可能**にする(DB-003 §4 critical / ARC-008 §6)。N テナント = N 静的ロールにしない。
- **プレフィックス安全性**: §3 のキーセグメント正準形(`#` 非包含)不変条件に依存する。
- **pharmacy 内分離**: LeadingKeys の対象外。**アプリ層 deny-by-default**(requirePermission + テナント/薬局文脈拘束)で担保(DB-003)。DB 層は多層防御の「追加」であり、DB 層があるからアプリ層を緩めない。
- **多層防御**: 上記に加え、アプリコードと契約テストでテナント/薬局チェックを常に行う。
- **FHIR 参照のテナント再導出**: `subject: Patient/x` や絶対 URL 参照は**常に JWT からテナントを再導出**し、取込 ACL がクロステナント/絶対 URL 参照を拒否・正規化する(ARC-008 §3 の ACL 具体化)。
- **LeadingKeys 演算子の実現可能性は SEC-008 の最優先検証事項(MAJOR-3)**: `StringEquals`(キー値=プリンシパル識別子の完全一致・高確度)は成立するが、本設計の複合 PK(`TENANT#{tid}#…`)をテナントで絞るには prefix/ワイルドカード一致(`StringLike`)が要り、`dynamodb:LeadingKeys` × `StringLike` の有効性は公式に明確でない。**LeadingKeys で複合プレフィックス分離が成立しない場合の MVP スコープ内フォールバックを本書で確定する**: (i) テナント別テーブル/アカウント分離(§Q3 上位ティア)を「critical 分離要件を満たす標準構成」へ格上げ、または (ii) テーブルの PK 先頭を tenantId 単独属性へ再設計し `StringEquals` を可能にする。ARC-008 §6 / DB-003 §4 の「通常系テナント越え不可」は **critical(努力目標でない)**であり、**実証済みの DB 層分離手段を欠いたまま実装着手しない**(fail-closed)。STS セッションポリシー/タグの最終形・ロール分解も SEC-008 で確定。BLOCKED_SECURITY_REVIEW。

## 8. 投影整合(M7)

patient summary/search・reception 等の投影は正本から再生成される派生。**更新機構を明示する**:

- **MVP = 同期更新**: FHIR/内部正本の書込トランザクション内で投影も同期更新する(**read-after-write 保証**)。「今登録した患者を即検索/受付できない」ラグ(API-001/API-006 実務要件違反)を防ぐ。索引ファンアウトは 100 アクション/4MB 予算内に有界化する。
- **非同期(DynamoDB Streams 等)は post-MVP**: 採用時はラグ許容値・突合/再生成手順・非正本明示を規定する。
- **投影の同期更新先(MINOR-4)**: FHIR Patient current は**テナントスコープ**(PK に pharmacy 無し)、patient_summary/search 投影は**薬局スコープ**。MVP は**薬局単位の患者登録**(1患者 = 登録薬局スコープの投影)を前提とし、Patient 書込時の同期更新先は登録薬局の投影に限定する。1患者が複数薬局に跨る共有は post-MVP(投影ファンアウト先の集合と跨薬局 read-after-write の整合機構を別途定義。MVP 範囲外)。

## 9. 暗号化と PHI 配置

- **DynamoDB 保存時暗号化(KMS)必須**(FHIR/リソースストア)。CMK 階層・テナント別鍵戦略・環境別テーブル鍵ポリシー・break-glass 復号ポリシーは BLOCKED_SECURITY_REVIEW。MOD-009 封筒不変条件(phiClassification≠none→encryptionStatus 'encrypted'、違反 throw)を継承。
- **検索トークン鍵(Q4)**: KMS ルートから `HKDF(root, tenantId)` で**テナント別鍵を導出**(クロステナント相関防止・テナント削除時 crypto-shred・鍵ローテ可)。pepper をハードコードしない。**決定的トークンゆえ鍵ローテ = 索引再構築**。鍵管理は M4 の部分一致不可能性を解決しない(必要条件であり十分条件でない)。
- **S3**: 大 DocumentReference 添付・領収 PDF・レセ export・不変アーカイブは S3 + KMS。オブジェクトキーは `tenant/{tenantId}/...`(または SEC 承認の等価形)始まり。Object Lock/WORM は本書で確定しない。
- **item 上限**: 400KB 超の大 `resourceJson` は S3 退避 + ポインタ。
- **金額・点数の DynamoDB 表現(MINOR-3)**: @yrese/money 経由で **string/bigint として直列化**し、金額・点数を DynamoDB Number(JS float 由来の精度落ち)にコード化しない(MOD-010 の格納面。ARC-008 §6「浮動小数点禁止」の具体化)。
- **生 PHI 非露出**: 氏名・カナ・患者番号・保険者番号・公費受給者番号・処方内容・服薬指導内容を**キー/GSI/アプリログ/agmsg/非redactエラーに載せない**(SEC-004/DOM-005 §3)。fixture は合成のみ(MOD-013)。

## 10. persistence-agnostic アダプタ境界(設計形)

```ts
interface FhirResourceStore {
  read(input: FhirReadInput): Promise<FhirResourceCurrent | undefined>;
  vread(input: FhirVersionReadInput): Promise<FhirResourceVersion | undefined>;
  search(input: FhirSearchInput): Promise<FhirSearchPage>;   // 有界 allow-list。未対応は OperationOutcome
  create(input: FhirCreateInput): Promise<FhirWriteResult>;
  update(input: FhirUpdateInput): Promise<FhirWriteResult>;  // §5 楽観ロック
  tombstone(input: FhirDeleteInput): Promise<FhirWriteResult>;
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

WP-5002/5003 の PostgreSQL 実装を即撤去しない。(1) 設計 formalize(本書 + FHIR/AWS SSOT)。(2) 合成データのみで DynamoDB アダプタ実証(PHI なし)。(3) shadow 投影(PostgreSQL が既存 patient/reception の正本のまま、DynamoDB へ**非正本**複製。partner/API は正本として読まない)。(4) 集約ごと cutover(Patient=FHIR Patient 正本化・サマリは投影 / Reception=内部運用アイテム / 監査永続化=チェーン tip 設計が opus/fable5/security レビュー通過後に DynamoDB append-only)。(5) read cutover(契約テストで parity 実証後にリポジトリ注入切替)。(6) write cutover(旧正本への書込停止。**二重正本書込を恒常化しない**)。(7) 退役(ロールバック窓 + 移行突合 + fable5 承認後にのみ PostgreSQL 撤去)。

ロールバック: write cutover 前 = DynamoDB read/write 無効化 + PostgreSQL 正本維持。cutover 後 = 明示的逆移行計画 + 人間レビュー(stale な PostgreSQL への自動フォールバックにしない)。

## 12. 不変条件・停止条件

- 認可を body/query/path/FHIR meta の tenant で行う → 実装禁止(§2/§7)
- 静的共有ロールのみでテナント分離を主張(per-request スコープなし)→ CHANGES_REQUESTED(§7 M6)
- 同一アイテムへ ConditionCheck+Update を1トランザクションで併用 → 実装禁止(§5/§6 M1/M2)
- 監査 append に seq 非依存の dedupe ガード(§6.1)を欠く / 曖昧失敗を dedupe ガードなしにリトライ → 実装禁止(論理重複・§6.1 MAJOR-1)
- cloud 監査チェーンの sequenceNumber を tip 採番でなく呼び出し側供給にする → 実装禁止(SK/tip/entryHash 連番の乖離・§6.1 MAJOR-2)
- 監査 append intent が tenantId/pharmacyId/actorId/prevHash/sequenceNumber を authority・chain 位置として供給できる型 → 実装禁止(trusted `AuditWriteContext` のみ・§10/§6.1 WP-7001)
- 監査 `event`/`dedupe`/`TIP` を相異なる PK に分散(3アイテム同一 `chainScope` PK を破る)→ 実装禁止(chain-locality/co-location と単一 `Query` 取得の設計不変条件・§6.1。TWI/LeadingKeys の必須要件ではない点は §6.1 #7 参照)
- 同一 `eventId` + 相違 logical intent を新規 append(冪等衝突を hard conflict で拒否しない)→ 実装禁止(§6.1 decision C)
- 曖昧失敗回復を `TransactionCanceledException` reason code 解釈で駆動し state 再読(dedupe→event, TIP)に依らない → CHANGES_REQUESTED(DynamoDB Local 差異・§6.1)
- ストレージ整合検証(seq 連続/dedupe/TIP/SK-payload 一致)を `verifyAuditHashChain` に再実装(コア委譲でなく)→ CHANGES_REQUESTED(二重実装禁止・§10/§6.1 decision B)
- `zeroPad` 定義域外(0 以下・uint64 上限超過)を書込 / 固定20桁を崩す → 実装禁止(SK 数値正準形・§3。監査/台帳 SEQ# に scope・FHIR VERSION# は対象外)
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

- 0.1.2 (2026-07-10): WP-7001(Phase 1 AuditAppendStore スライス)の監査 append/verify 設計詳細を pin(APPROVED 0.1.1 設計に矛盾しない fail-closed 明確化)。§3 `zeroPad`(uint64 固定20桁・監査/台帳 SEQ# に scope・FHIR VERSION# は `encodeFhirVersionKey` として API-008 保留)。§6.1: 3アイテム同一 `chainScope` PK(co-location/query 不変条件)、genesis 空証明(SEQ#/DEDUPE# 非存在を強整合で証明)、非 genesis TIP の **TIP1/TIP2 読取安定化 + true-tail 検証 + 完全 tuple CAS**(fork 防止)、`intentFingerprint`(chain 位置除外・retryCount 包含・SHA-256/sorted-key canonical JSON/`fingerprintSchemaVersion=1`)、回復の corrupt/swap 検知(current==dedupe==recompute(event) 3者一致 + tuple 整合 + ConsistentRead)、`sequenceNumberDecimal` 表現統一(attr unpadded / SK 20桁 zeroPad の同値2エンコーディング)、bijective 検証、verify も TIP1/TIP2 安定窓、app 層 `AuditPersistenceVerification`。§10 `append(context, intent)`・`verify(context)`、`AuditWriteContext {tenantId, pharmacyId, actorId: UserId}`。§12 対応停止条件。canonicalization の正確な規則表は golden-before-write stop 付きで WP-7001 実装+golden vector に委譲(SSOT は意味論=何を含むかを pin)。**レビュー: codex 独立2レビュア 5-round 敵対的ピアレビュー(round-1〜5・累計 HIGH/MED/LOW を解決)CONSISTENT + opus4.8 最終確認 OPUS_CONFIRMED(§12 dedupe schema の fingerprintSchemaVersion 追記・changelog ラウンド整合の 2 MINOR を修正)+ fable5 で PROPOSED→APPROVED 昇格。** WP-7001 実装は golden vector 完成が前提(§12 stop)。
- 0.1.1 (2026-07-10): opus4.8 レビュー(CHANGES_REQUIRED、M1-M8 のうち7件 RESOLVED・M3 PARTIAL)の指摘を反映。**MAJOR-1**: §6.1 監査 append に **seq 非依存の dedupe ガードアイテム**(`SK=DEDUPE#EVENT#{eventId}` を `attribute_not_exists` で Put)を追加し、並行アペンダ下の論理重複窓を閉じた(`tip.eventId` 突合は補助的短絡へ降格・不一致=未コミットと結論しない)。**MAJOR-2**: cloud チェーンの `sequenceNumber` を **tip 採番**にし §10 append の Omit に追加(SK/tip/entryHash 連番の乖離防止)。**MAJOR-3**: §7 に LeadingKeys×StringLike 非成立時の **MVP スコープ内フォールバック**(テナント別テーブル/tenantId 単独 PK)を本文明示 + SEC-008 最優先検証化。MINOR-1/2(SK 時刻の固定桁 UTC ISO・DATE=Asia/Tokyo 業務日)、MINOR-3(金額は @yrese/money string/bigint・DynamoDB Number 不可)、MINOR-4(Patient テナント vs 投影薬局スコープの同期更新先)、MINOR-6(shard N 選定基準)、MINOR-7(TIP 書込集中は §13(e) 計測)を反映。dedupe ガードは opus が「正しい TransactWriteItems 雛形」と認めた §3.6 受付ガードと同一パターン。opus4.8 再検証で 3 MAJOR とも RESOLVED・新規誤りなしを確認(APPROVED_READY)。version drift を訂正し、チェーン検証読取の SK フィルタ(`begins_with(SK,"SEQ#")`)・dedupe の書込増幅コストの実装補足を追記のうえ **PROPOSED→APPROVED 昇格(opus4.8 + fable5)**。機微なセキュリティ/法令の具体は BLOCKED に退避。
- 0.1.0 (2026-07-10): 初版起草。WP-6001(codex 設計提案)の骨格を採用し、opus4.8 敵対的レビューの必須修正 M1(§5 楽観ロックの同一アイテム制約)/M2(§6.1 監査 tip の同一アイテム制約)/M3(監査 append の曖昧失敗冪等化)/M4(HMAC 部分一致不可 → API-001 投影経由)/M5(Provenance 投影・格納正本除外)/M6(per-request STS テナントスコープ)/M7(投影の同期更新)/M8(GSI シャーディング・チェーンセグメント化・10GB 訂正)と MINOR、fable5 決定 Q1-Q8 を織り込んで確定。ARC-008 優先の下で DB-001..004 の DynamoDB 具体化を担う。セキュリティ/法令の確定事項は BLOCKED を明示。opus4.8 レビュー前の PROPOSED。
```
