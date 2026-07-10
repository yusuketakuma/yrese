# fhir_rest_facade_contract — FHIR REST facade 契約(相互作用・楽観ロック・OperationOutcome・CapabilityStatement)

```yaml
ssot_id: API-008
title: FHIR REST facade 契約(相互作用・楽観ロック・OperationOutcome・CapabilityStatement)
domain: api
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required(外部IF・conformance)
version: 0.1.1
created_at: 2026-07-10
updated_at: 2026-07-11
approved_at: null
approved_by: null
effective_from: null
effective_to: null
source_refs:
  - HL7 FHIR R4 4.0.1 RESTful API(https://hl7.org/fhir/R4/http.html)
  - HL7 FHIR R4 OperationOutcome / IssueType(https://hl7.org/fhir/R4/operationoutcome.html, valueset-issue-type.html)
  - HL7 FHIR R4 Search(https://hl7.org/fhir/R4/search.html §3.1.1.3 handling)
  - HL7 FHIR R4 CapabilityStatement(https://hl7.org/fhir/R4/capabilitystatement.html)
  - JP Core 1.2.0(base FHIR R4 4.0.1、https://jpfhir.jp/fhir/core/1.2.0/)
  - FHIR R4/JP Core grounding 研究(document-specialist、2026-07-10)
  - docs/database/dynamodb_single_table_design.md(DB-005 — 格納側の正本。本契約は wire 側)
depends_on:
  - DB-005(格納側 access pattern/楽観ロック/tombstone の正本 — 本契約と 1:1 整合)
  - ARC-008(FHIR ハイブリッド・認可 JWT のみ・Official Adapter 境界)
  - DOM-005(canonical/facade 関係)/ DOM-006(FHIR mapping registry — extension/profile 台帳)
  - PRD-007(FHIR 戦略・conformance を訴求しない)
  - API-001(patient_search_contract — 氏名/カナ部分一致は投影経由)
  - API-003(platform_api_architecture)/ SEC-006(テナント分離)/ MOD-004(shared_type_registry)
impacts:
  - Phase 1 FHIR REST 層 実装 WP
  - packages/contracts(FHIR wire schema・OperationOutcome・CapabilityStatement を contract-first 単一正本へ)
  - apps/api(/fhir/R4/* ルート)
related_work_packages: [WP-9002-W5A]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5A metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions:
  - If-Match 欠如(400)に用いる IssueType コードの確定(FHIR は専用コードを規定せず yrese 選定 — §4 で `required` を暫定)
  - JP Core 1.2.0 の DocumentReference profile 正式ステータス・must-support(artifacts.html の StructureDefinition 直接確認 — grounding で抽出結果が矛盾)
  - tombstone からの PUT 復活の最終方針(§6 で MVP 禁止と決定。post-MVP の管理付き un-delete を将来検討)
blockers:
  - BLOCKED_FHIR_CONFORMANCE_REVIEW: profile URL(meta.profile)宣言・terminology binding 検証・conformance test(公式 FHIR Validator + JP Core IG package)なしに JP Core 準拠を訴求しない(PRD-007/DOM-005 継承)
  - BLOCKED_SECURITY_REVIEW: 本番 JWT 認証(Cognito)・テナントスコープの最終形は SEC-008 完了後(DB-005 §7 と同期)
  - BLOCKED_OFFICIAL_ADAPTER_BOUNDARY: 電子処方箋・オン資・オンライン請求・レセ電・NSIPS 等を FHIR REST で置換しない(ARC-008/DOM-005 継承)
```

## 1. 目的と位置づけ

DB-005 が前方参照する「FHIR REST の wire 契約・CapabilityStatement の正式契約」を確定する。DB-005 は**格納側**(DynamoDB キー設計・access pattern・楽観ロック・tombstone)を規定し、本契約は**対外 wire 側**(HTTP 相互作用・ステータス・ETag/If-Match・OperationOutcome・CapabilityStatement)を規定する。両者は 1:1 で整合する(DB-005 §4.1/§5 ↔ 本契約 §2/§3)。

**contract-first**: FHIR の wire schema・OperationOutcome・CapabilityStatement は packages/contracts を単一の正本とし、型/enum/IssueType 値集合をローカル再定義しない(§12)。フロントおよび外部利用者(PH-OS 等)は契約外フィールドを仮定しない。

本契約は FHIR R4 = 4.0.1 を基準とし、確認済みの一次情報(source_refs)に基づく。JP Core 準拠の訴求は BLOCKED_FHIR_CONFORMANCE_REVIEW。

## 2. 対応相互作用と HTTP セマンティクス(FHIR R4 http.html 準拠)

エンドポイントは `/fhir/R4/*`。MVP 対応相互作用と成功/主エラーステータス:

| 相互作用 | パターン | 成功 | 主なエラー |
|---|---|---|---|
| read | `GET [type]/[id]` | 200 | 404(未知)/ **410(tombstone 済み)** |
| vread | `GET [type]/[id]/_history/[vid]` | 200 | 404(版なし)/ 410 |
| create | `POST [type]` | 201 + `Location`(new id/versionId) | 400 / 422 |
| update | `PUT [type]/[id]` | 200(更新)/ 201(新規) | 400(If-Match 欠如 §3)/ 404 / **412(版不一致 §3)**/ 422 |
| delete | `DELETE [type]/[id]` | 200 / 204 | 405(方針で禁止時)/ 409 |
| history-instance | `GET [type]/[id]/_history` | 200 + Bundle(type=history) | 404 |
| search | `GET [type]{?params}` | 200 + Bundle(type=searchset) | **400(未対応パラメータ §5)**/ 401 / 403 / 404 |

**post-MVP**(本契約では未対応宣言): conditional create/update/delete、patch、history-type、`_search`(POST body)、transaction/batch。未対応の相互作用・パラメータへのアクセスは §4 の OperationOutcome で fail-closed に拒否する(暗黙の部分処理をしない)。

対応リソース(MVP、DB-005 §3.1 と一致): Patient / Coverage / Organization / Practitioner / PractitionerRole / Location / Medication / MedicationRequest / MedicationDispense / DocumentReference。**Provenance は格納正本にせず**、監査投影として別途扱う(DB-005 §3.1/§6、ARC-008 §6)。正式なリソース集合・優先度は DOM-006 / FHIR ストア設計で確定する。

## 3. 楽観ロック(ETag / If-Match — FHIR R4 §3.1.0.1.3/§3.1.0.5 準拠)

- 応答は `ETag: W/"{versionId}"`(weak validator)と `Last-Modified` を返す。`meta.versionId` ↔ ETag、`meta.lastUpdated` ↔ Last-Modified が対応(DB-005 §3.1 の `metaVersionId`/`lastUpdated`)。
- **update は `If-Match` を必須**とする(yrese の fail-closed 選択。盲目的上書きを許さない)。
  - **`If-Match` の versionId が現行と不一致 → `412 Precondition Failed`**(FHIR 仕様どおり。IssueType = `conflict`)。DB-005 §5 の `ConditionExpression: metaVersionId = :expectedVersion` 失敗に対応。
  - **`If-Match` 欠如 → `400`**(FHIR は If-Match 必須化時に 400 を許容。**412 とは別ステータス**として分離)。IssueType は FHIR が専用コードを規定しないため yrese は `required`(必須の前提条件欠如)を暫定選定(open_question)。
- create の同時実行は DB-005 §5 の `attribute_not_exists` により一意化。id 衝突 → 409/422。

## 4. OperationOutcome(エラー表現 — fail-closed)

エラー応答本文は FHIR `OperationOutcome`。`issue[]` の各要素は `severity`(fatal|error|warning|information)・`code`(IssueType)・`details`(任意)・`diagnostics`(任意・**PHI 非包含**)・`expression`(任意)。HTTP ステータスと整合させる(3xx 以上は severity=error 以上の issue を最低1つ持つ)。

MVP で用いる IssueType(allow-list。値集合は FHIR R4 valueset-issue-type を正とし契約側で手書きしない):

| 事象 | HTTP | IssueType |
|---|---|---|
| 版不一致(If-Match) | 412 | `conflict` |
| If-Match 欠如 | 400 | `required`(yrese 選定・§3) |
| 未知リソース | 404 | `not-found` |
| tombstone 済み read | 410 | `deleted` |
| 未対応の相互作用/検索パラメータ | 400/404 | `not-supported` |
| テナント/権限違反 | 403 | `forbidden` / `security` |
| 構造・必須不備 | 400/422 | `invalid` / `required` |

- **fail-closed**: エラー本文は error code registry(shared-kernel)の登録コード + 上記 IssueType のみを可視化する。未登録コード・内部例外文言・スタックの verbatim 露出を禁止(WP-3007a 同型)。
- **PHI 非露出**: `diagnostics`/`details` に氏名・カナ・患者番号・保険者番号・処方内容等を載せない(SEC-004/DB-005 §9)。

## 5. search(MVP 対応パラメータと fail-closed 逸脱の明示)

- **MVP 対応パラメータ(exact-token、DB-005 §3.2/§4.1 と一致)**: `identifier` / `subject`・`patient`(参照)/ `medication`(terminology マッピング後 code)/ `_lastUpdated`(DB-005 GSI1)。リソース別の対応集合は CapabilityStatement(§8)で宣言する。
- **氏名・カナの部分一致は FHIR `name` 検索で提供しない**(DB-005 §3.2/M4: HMAC は部分一致不可)。患者の氏名/カナ検索は API-001 の専用投影経由とし、FHIR facade の `name` は MVP で**未対応宣言**。
- **未対応パラメータは `400` + OperationOutcome(`not-supported`)で fail-closed に拒否する。**
  - **これは FHIR 既定(lenient: 未知パラメータは SHOULD ignore、strict は `Prefer: handling=strict` 時のみ — search.html §3.1.1.3)からの意図的逸脱である。** 逸脱理由: 未対応パラメータを黙って無視すると**意図と異なる患者集合を成功として返し**(医療安全リスク: 取り違え)、fail-closed 原則(空/誤りは止める)に反するため。yrese は **常時 strict** を採用する。
  - この既定は CapabilityStatement と API ドキュメントに**明記**し、lenient 前提のクライアントとの衝突を防ぐ(将来 `Prefer: handling` 対応時も既定は strict を維持)。
- 検索結果は `Bundle`(type=searchset)。**成功時は `Bundle.link[relation=self]` に実際に処理へ用いた検索パラメータを反映する**(FHIR R4 search.html の SHALL: サーバは処理に使用したパラメータを返す)。ページングはテナント/薬局/クエリに拘束したカーソル(DB-005 §4.2)。

## 6. delete と tombstone(FHIR R4 §3.1.0.7 準拠 + yrese 業務決定)

- `DELETE [type]/[id]` は**物理削除しない**。DB-005 §3.1/§6 に従い current を `deleted`(tombstone)化し version アイテムを追記する(FHIR の「削除済みマークの履歴エントリ作成」と概念一致)。成功 = 200/204。
- tombstone 後の**バージョン非指定 read は `410 Gone`**(404 でない)。search からも除外。vread(過去版)は引き続き取得可(履歴は消えない)。
- **PUT による tombstone からの「復活」は MVP で禁止する(fable5 決定・fail-closed)。** FHIR 仕様は復活を許容し得るとするが、削除済み臨床リソースの復活は (a) 会計台帳・確定請求の append-only 不変性(ARC-007/DB-004)と整合しにくく、(b) 訂正を隠蔽し得るため、MVP では認めない。tombstone された id への PUT は `409 conflict`(OperationOutcome `conflict`)で拒否する。新たな臨床事実は新規リソースまたは明示的な訂正レーンで表現する。post-MVP に管理付き un-delete を別途検討(open_question)。

## 7. 表現(Content-Type / meta)

- MIME type は `application/fhir+json`(`application/fhir+xml` は MVP 非対応)。`_format` は将来拡張。
- create/update 成功時、応答リソースに **`meta.versionId` と `meta.lastUpdated` を新しい値で必ず設定**(SHALL、DB-005 §3.1 の格納値から)。
- 数値・金額・点数は DB-005 §9(@yrese/money 由来 string/bigint)に従い、wire でも浮動小数点で表現しない(MOD-010)。

## 8. CapabilityStatement(最小宣言 + fail-closed)

- サーバは**実装済みの範囲のみを宣言**する(FHIR は部分宣言を許容)。`rest.resource.interaction` に §2 の対応相互作用、`rest.resource.searchParam` に §5 の対応パラメータ、`rest.resource.versioning = versioned-update` を宣言。
- `conditionalCreate`/`conditionalUpdate` = false(boolean・post-MVP)。**`conditionalDelete` = `not-supported`・`conditionalRead` = `not-supported`**(FHIR R4 ではこれらは boolean でなく code 型 `conditional-delete-status`/`conditional-read-status`。packages/contracts の FHIR スキーマで boolean 化しない)。patch 非対応は `interaction` リストからの省略で表現する。
- **宣言されていない相互作用・検索パラメータへのアクセスは拒否(§4)であり、暗黙に無視しない**旨を CapabilityStatement の記述(`documentation`)に明記する(§5 の strict 既定)。
- CapabilityStatement は packages/contracts から生成する単一正本(手書きの二重管理をしない)。

## 9. 認可とテナント(JWT/AuthContext のみ)

- 認可は **JWT/AuthContext からのみ**(ARC-008 §6/DB-005 §7)。**FHIR `meta.security`・extension・path・body・query の tenant を認可根拠にしない。** 権限は deny-by-default(requirePermission)。FHIR リソースへのアクセスは対応する権限スコープ(例 `patient:read`)に拘束する。
- テナント越えの FHIR read/search は構造的に不可能(DB-005 §7 の per-request テナントスコープ)。参照(`subject: Patient/x`・絶対 URL)は**常に JWT からテナントを再導出**し、取込 ACL がクロステナント/絶対 URL 参照を拒否・正規化する(DB-005 §7/ARC-008 §3)。
- 本番認証(Cognito JWT)の最終形は BLOCKED_SECURITY_REVIEW。synthetic/dev は stub tenant で可・本番境界を緩めない(WP-4056)。

## 10. JP Core / conformance(BLOCKED)

- 基準参照は **JP Core 1.2.0**(base FHIR R4 4.0.1)。優先リソースの多くに profile が存在するが、**profile URL(`meta.profile`)宣言・terminology binding 検証・conformance test(公式 FHIR Validator + JP Core IG package)なしに「JP Core 準拠」を訴求しない**(BLOCKED_FHIR_CONFORMANCE_REVIEW、PRD-007/DOM-005 継承)。
- DocumentReference の JP Core profile 正式ステータスは未確定(grounding で抽出矛盾)→ その profile 取扱いは BLOCKED(open_question)。`profileRefs`(DB-005 §3.1)は conformance review まで参考情報。
- レセ電最終出力は FHIR でなく日本のレセ電仕様/CSV(ARC-008 §6・Official Adapter 境界)。FHIR Claim は請求候補の中間表現であり本 REST 契約の確定対象外(内部 BillingLine へ変換)。

## 11. 停止条件(fail-closed)

- 認可を FHIR `meta.security`/extension/path/body/query の tenant で行う → 実装禁止(§9)
- update で If-Match を必須にせず盲目的上書きを許す → 実装禁止(§3)
- 412(版不一致)と 400(If-Match 欠如)を混同・単一化する → CHANGES_REQUESTED(§3、仕様が別ステータス)
- 未対応検索パラメータを黙って無視し部分結果を成功で返す → 実装禁止(§5、医療安全・fail-closed)
- tombstone を物理削除にする / tombstone からの PUT 復活を MVP で許す → 実装禁止(§6、append-only 整合)
- OperationOutcome/diagnostics に PHI・未登録コード・内部例外を露出 → 実装禁止(§4)
- profile/terminology/validation なしに JP Core 準拠を訴求 → BLOCKED_FHIR_CONFORMANCE_REVIEW(§10)
- FHIR wire type/IssueType/CapabilityStatement をローカル再定義 → COMMON_MODULE_DUPLICATION_BLOCKED(§12)

## 12. 正本と非再定義(二重実装の禁止)

- FHIR wire schema・OperationOutcome・IssueType 値集合・CapabilityStatement は **packages/contracts を単一の正本**とし、契約側で値を手書きしない(FHIR R4 の定義を出所とする)。
- 格納側(キー・楽観ロック・tombstone)の正本は DB-005。本契約は wire 表現であり格納設計を再定義しない(1:1 整合、ドリフト時は本契約の改版で追従)。
- ID/status/error 値は @yrese/shared-kernel、金額・日付は @yrese/money・date-time を再利用する。

## 変更履歴

- 0.1.1 (2026-07-10): document-specialist の FHIR R4 一次情報照合(hl7.org/fhir/R4)で **FHIR_COMPLIANT** を確認(§3 の 412/400 分離・§5 の strict 逸脱・§6 の 410+tombstone/PUT 復活禁止 は逐語一致)。実装向け指摘3点を反映: §8 の `conditionalDelete`/`conditionalRead` を boolean でなく code 型(`not-supported`)に、§5 成功検索の `Bundle.link[self]` に使用パラメータ反映(SHALL)を追加、§4 の If-Match 欠如 `required` は専用コードなしのため open_question 維持。FHIR Patient 実装は Phase 1 で deferred のため PROPOSED 継続(実装接近時に APPROVED 昇格)。
- 0.1.0 (2026-07-10): 初版起草。FHIR R4 4.0.1 の一次情報(http/operationoutcome/search/capabilitystatement)と JP Core 1.2.0 現況の grounding(document-specialist 2026-07-10)に基づき、DB-005(格納側)と 1:1 整合する wire 契約を定義。楽観ロックの 412(版不一致)/400(If-Match 欠如)分離、search 未対応パラメータの fail-closed(FHIR lenient 既定からの意図的逸脱を明記)、delete=410+tombstone・PUT 復活の MVP 禁止、OperationOutcome の fail-closed・PHI 非露出、CapabilityStatement 最小宣言、認可 JWT のみ、JP Core conformance の BLOCKED を確定。opus4.8 レビュー前の PROPOSED。
