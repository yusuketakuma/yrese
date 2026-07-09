# dynamodb_single_table_design — DynamoDB single-table ストレージ設計(FHIR 格納正本・投影・append-only 監査/台帳)

```yaml
ssot_id: DB-005
title: DynamoDB single-table ストレージ設計(FHIR 格納正本・投影・append-only 監査/台帳)
domain: database
status: APPROVED
approved_at: 2026-07-10
approved_by: opus4.8(敵対的レビュー + 再検証 APPROVED_READY)+ fable5
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required(セキュリティ/法令 — 機微部は BLOCKED_SECURITY_REVIEW/BLOCKED_LEGAL_REVIEW に退避)
version: 0.1.1
created_at: 2026-07-10
updated_at: 2026-07-10
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

### 3.1 FHIR リソース current / 履歴

```text
current:  PK = TENANT#{tenantId}#FHIR#{resourceType}#{logicalId}   SK = CURRENT
version:  PK = TENANT#{tenantId}#FHIR#{resourceType}#{logicalId}   SK = VERSION#{zeroPad(metaVersionId)}
```

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

**`sequenceNumber` はチェーン連番であり、SK 順序の正・`TIP` 保持値・entryHash に確定される canonical payload(packages/audit)が同一値でなければならない(MAJOR-2)。よって cloud チェーンの `sequenceNumber` は呼び出し側入力でなく `TIP` から採番する**(アダプタが `tip.sequenceNumber + 1` を設定。prevHash と同型に append の外部入力から除外 — §10)。

**append アルゴリズム(3アイテム超。同一アイテムへの複数オペレーションを含めない)**:
1. `TIP` を**強整合読取**(`ConsistentRead=true`)。無ければ genesis(`AUDIT_GENESIS_PREV_HASH`・`sequenceNumber` 初期値起点)。
2. `sequenceNumber = tip.sequenceNumber + 1`。`createAuditEvent`(prevHash = tip.entryHash, sequenceNumber = 上記)。**entryHash は packages/audit の core が計算**(呼び出し側は hex を供給しない=SEC-008 §2-3・型で強制)。
3. `TransactWriteItems`（3アイテム・すべて別 SK）:
   - `Put`(イベント) ConditionExpression: `attribute_not_exists(PK) AND attribute_not_exists(SK)`
   - `Put`(dedupe) ConditionExpression: `attribute_not_exists(PK) AND attribute_not_exists(SK)` — **eventId 単位・seq 非依存の冪等ガード**
   - `Update`(TIP) ConditionExpression: 通常追記 `entryHash = :prevHash` / genesis `attribute_not_exists(PK)`。set `entryHash`, `sequenceNumber`, `eventId`
   → tip.entryHash 条件が prefix をピン留めし seq 単調性を従属保証。**dedupe アイテムが並行下でも同一 eventId の二重追記を不可能にする**。
4. **曖昧失敗の冪等化(M3 修正・MAJOR-1)**: 論理 append 単位で `eventId`/`idempotencyKey` を**安定**させる。曖昧失敗時に再試行しても、初回がコミット済みなら **dedupe アイテムの `attribute_not_exists` 条件が必ず失敗しトランザクション全体が棄却**されるため、`TIP`/`seq` が他アペンダに進められていても二重追記は不可能。`tip.eventId == myEventId` 突合は**補助的短絡に留める**: 一致時のみ「コミット済み」と結論でき、**不一致は「未コミット」を意味しない**(並行追記で tip が進んだだけの可能性があるため、不一致時は再試行し dedupe ガードに最終判定を委ねる)。dedupe ガードを欠く無条件リトライは**論理的重複イベント**(chain としては valid で `verifyAuditHashChain` が検知不能)を生むため禁止。`ClientRequestToken` は prevHash/seq 再計算で item が変わり `IdempotentParameterMismatchException` になるため単独解にならない。

**チェーン検証の読取**: `verifyAuditHashChain` 等の連鎖検証は同一 `chainScope` PK を `begins_with(SK, "SEQ#")` で読み、`TIP`/`DEDUPE#` を除外する(SK 辞書順 `DEDUPE# < SEQ# < TIP` により `SEQ#` クエリでイベント列を清潔に分離できる)。

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
  append(input: Omit<CreateAuditEventInput, "prevHash" | "sequenceNumber">): Promise<AuditEvent>;  // §6 prevHash・sequenceNumber は tip 採番・型で供給排除(MAJOR-2)
  verify(input: AuditChainScope): Promise<AuditHashChainVerification>;
}
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

- 0.1.1 (2026-07-10): opus4.8 レビュー(CHANGES_REQUIRED、M1-M8 のうち7件 RESOLVED・M3 PARTIAL)の指摘を反映。**MAJOR-1**: §6.1 監査 append に **seq 非依存の dedupe ガードアイテム**(`SK=DEDUPE#EVENT#{eventId}` を `attribute_not_exists` で Put)を追加し、並行アペンダ下の論理重複窓を閉じた(`tip.eventId` 突合は補助的短絡へ降格・不一致=未コミットと結論しない)。**MAJOR-2**: cloud チェーンの `sequenceNumber` を **tip 採番**にし §10 append の Omit に追加(SK/tip/entryHash 連番の乖離防止)。**MAJOR-3**: §7 に LeadingKeys×StringLike 非成立時の **MVP スコープ内フォールバック**(テナント別テーブル/tenantId 単独 PK)を本文明示 + SEC-008 最優先検証化。MINOR-1/2(SK 時刻の固定桁 UTC ISO・DATE=Asia/Tokyo 業務日)、MINOR-3(金額は @yrese/money string/bigint・DynamoDB Number 不可)、MINOR-4(Patient テナント vs 投影薬局スコープの同期更新先)、MINOR-6(shard N 選定基準)、MINOR-7(TIP 書込集中は §13(e) 計測)を反映。dedupe ガードは opus が「正しい TransactWriteItems 雛形」と認めた §3.6 受付ガードと同一パターン。opus4.8 再検証で 3 MAJOR とも RESOLVED・新規誤りなしを確認(APPROVED_READY)。version drift を訂正し、チェーン検証読取の SK フィルタ(`begins_with(SK,"SEQ#")`)・dedupe の書込増幅コストの実装補足を追記のうえ **PROPOSED→APPROVED 昇格(opus4.8 + fable5)**。機微なセキュリティ/法令の具体は BLOCKED に退避。
- 0.1.0 (2026-07-10): 初版起草。WP-6001(codex 設計提案)の骨格を採用し、opus4.8 敵対的レビューの必須修正 M1(§5 楽観ロックの同一アイテム制約)/M2(§6.1 監査 tip の同一アイテム制約)/M3(監査 append の曖昧失敗冪等化)/M4(HMAC 部分一致不可 → API-001 投影経由)/M5(Provenance 投影・格納正本除外)/M6(per-request STS テナントスコープ)/M7(投影の同期更新)/M8(GSI シャーディング・チェーンセグメント化・10GB 訂正)と MINOR、fable5 決定 Q1-Q8 を織り込んで確定。ARC-008 優先の下で DB-001..004 の DynamoDB 具体化を担う。セキュリティ/法令の確定事項は BLOCKED を明示。opus4.8 レビュー前の PROPOSED。
```
