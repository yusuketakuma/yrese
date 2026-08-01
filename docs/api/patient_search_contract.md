# patient_search_contract — 患者検索・患者summary取得 API 契約

```yaml
ssot_id: API-001
title: 患者検索・患者summary取得 API 契約
domain: api
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - api_contract_reviewer
  - privacy_compliance_reviewer
  - medical_safety_reviewer
  - human_pharmacist_product_authority
version: 0.2.4
created_at: 2026-07-09
updated_at: 2026-07-31
approved_at: 2026-08-01
approved_by: "direct human authority 2026-08-01 (WP-4250 exact11 全て承認); round-5 independent verifier PASS on packet body with no HIGH finding (frozen packet ab086c9f8d6e6bfd26e32fbfe9daa21a3b8b6ccd3f324f413b4d2975731cfab6, base SHA 9d8dbc0c3f5201c762dbb39fd9b15fc3ddc4b875); round-5 security/privacy findings closed in Revision 14; round-5 data-integrity findings closed in Revision 13; codex second opinion unavailable until 2026-08-05 and not counted as evidence"
effective_from: 2026-08-01
effective_to: null
source_refs: [DOM-002(患者集約), UIX-007(SCR患者検索), SEC-004(PIA), MOD-012(validation policy)]
depends_on: [DOM-001..004(PROPOSED — 本契約はR1-R2骨格範囲で先行、Phase 1ゲートで両者同時承認)]
impacts: [packages/contracts, apps/api, apps/web(WP-3003)]
related_work_packages: [WP-2008, WP-3003, WP-4014, WP-4029, WP-4045, WP-4046, WP-4074, WP-5003, WP-9002-W5A, WP-4250]
related_tests:
  - packages/contracts/src/patient-search.test.ts
  - apps/api/src/patient-search-cursor.test.ts
  - apps/api/src/patient-get.test.ts
  - apps/api/src/server.test.ts
  - apps/api/src/db/postgres-repositories.integration.test.ts
  - apps/web/app/patients/patient-search.test.tsx
  - apps/web/app/components/patient-context.test.tsx
  - pnpm check:openapi
related_prs: []
evidence_ids: []
change_log:
  - "0.2.4 2026-08-01 WP-4250 exact11 finalization: round-5の独立review三レーン完了(independent verifier PASS・本文HIGHなし)とdirect human approvalによりPROPOSED→APPROVED。本文semanticsは不変。承認範囲はSSOT改版のみであり、実装着手・schema/data migration・production action・conformance主張を含まない。登録済みblockerは全て据え置き"
  - "0.2.4 2026-07-31 WP-4250 PROPOSED Revision 8: re-review round 1訂正。bound超過の非露出が防げる範囲を「精度の高い推測の防止」へ正直に限定し、503/200の1 bitが閾値oracleとして残ることを明記"
  - "0.2.4 2026-07-31 WP-4250 PROPOSED Revision 7: HIGH-8/MEDIUM-2訂正。GETクエリ形式をPRODUCTION_DISABLEDとしbody-based形式をproduction正規経路に指定、候補集合フェッチのmeasured capとfail-closed overload 503、非PHI粗インデックス代替の決定要件を追加"
  - "0.2.4 2026-07-30 WP-4250 PROPOSED Revision 6: Patient cutover VERSION 1 baseline後も既存search/getをread-only projectionとして維持しFHIR historyを推測しない"
  - "0.2.4 2026-07-30 WP-4250 PROPOSED Revision 3: existing search/get runtime contractとverified direct test pathsを固定。旧0.2.3承認はprevious-version provenance"
  - "body history authority: 本文§6変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5A metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions: []
blockers:
  - BLOCKED_PATIENT_SEARCH_URL_PHI: GETクエリ形式はPHIをURLへ載せるためproduction無効。body-based形式のcontract amendmentまでproduction適用しない(§2)
  - BLOCKED_PATIENT_SEARCH_SCALE_BOUND: 候補集合フェッチ/復号のmeasured capと非PHI粗インデックス代替の採否が確定するまでproduction適用しない(§5)
```

## 1. 目的とスコープ

受付ダッシュボード・患者選択画面(SCR患者検索)のための患者検索。**MVPの最初の業務API**。
リポジトリインターフェース、合成データ用インメモリ実装、PostgreSQL実装が存在する。現行wire contractは変更しない。

現行runtimeではPostgreSQL Patientがsole authorityである。本endpointはshadow/cutover期間を通じてPHI-bearing internal read-only projectionであり、writer、merge面、authority APIへ変更しない。既存wire contract、authorization、tenant/pharmacy-bound cursor、no-storeを保持する。cutover後もdirect FHIR authority writeは`/fhir/R4/*`側だけが担う。
cutover時のFHIR VERSION 1 `SYSTEM_CUTOVER` baselineは本endpointのwire shapeや
cursorを変更せず、PostgreSQLの過去historyを本projectionまたはFHIR historyとして
合成しない。

## 2. エンドポイント

`GET /patients/search?q=<string>&limit=<int>&cursor=<string>`

> **PRODUCTION_DISABLED(HIGH-8 訂正)**: このGET形式は検索語 `q` に氏名・カナ・
> 患者番号というPHIをURLへ載せる。URLはaccess log、APM、proxy、referrer、
> browser history、CDNへ複製され得るため、運用基盤側のredactionだけでは
> PHI retentionを閉じられない。したがって**このGET形式はsynthetic dataの
> 開発/テスト環境限定**とし、production環境では**無効化する**。無効化は
> 運用手順ではなくruntime configの既定として実装し、fail-closed(設定不備時は
> 有効化されない側)とする。
>
> production向けの正規経路は**body-based形式**であり、検索語をrequest bodyへ
> 置く。wire shape、authorization、tenant/pharmacy-bound cursor、
> `Cache-Control: no-store`、§3のresponse shapeはGET形式と同一とし、
> 検索語の運搬方法だけを変える。body-based形式のexact method、path、
> request schema、cachability、CSRF対策は別contract amendmentで確定する。
> それまでproduction適用は`BLOCKED_PATIENT_SEARCH_URL_PHI`とする。
>
> 本改版は既存GET wireのshapeを変更しない。既存consumer(WP-3003 web、
> 既存direct tests)は開発環境で従来どおり動作する。

- 認可: `patient:read` scope 必須(requirePermission — deny-by-default)。tenantContext 必須。
- `q`: 1〜100文字。氏名(漢字)・カナ・患者番号の部分一致(検索アルゴリズムの詳細は実装側の自由。ただしカナ検索を必須サポート — 医療UI原則の取り違え防止)。
- `limit`: 1〜50、default 20。`cursor`: 不透明文字列(pagination)、最大512文字。巨大 cursor は contract 層で拒否し、backend decode 前に `PAT-0001` とする。

`GET /patients/:patientId`

- 認可、trusted tenantId + pharmacyId、`Cache-Control: no-store`はsearchと同一。
- 200 bodyは§3の**単一 `PatientSearchResult`そのもの**であり、wrapperやFHIR
  resourceへのredirect/shape変更をしない。
- invalid path idは400 `PAT-0001`。unknownまたはcross-tenant/pharmacyは同じ
  404 `PAT-0002`で存在を漏らさない。
- Patient cutover前後を通じて本routeを維持し、`/fhir/R4/Patient/{id}`へ
  redirectしない。既存R-PATCTX consumer互換を壊さない。

## 3. レスポンス(200)

```
{
  results: PatientSearchResult[],
  nextCursor?: string
}

PatientSearchResult = {
  patientId: string,          // branded PatientId
  name: string,               // 漢字氏名
  kana: string,               // カナ氏名(必須 — 取り違え防止)
  birthDate: string,          // YYYY-MM-DD
  sex: 'male' | 'female' | 'unknown',
  patientNumber: string,      // 薬局内患者番号
  eligibilityStatus: 'VERIFIED' | 'PENDING_REVERIFY' | 'LOCAL_ONLY_UNVERIFIED' | 'NOT_CHECKED',
  eligibilityCheckedAt?: string  // ISO datetime(未確認時なし)
}
```

- **契約の正本は @yrese/contracts の zod schema**(PatientSearchQuery / PatientSearchResponse / eligibilityStatus 値集合)。apps/web の PatientHeader は契約由来型へ適合させる(WP-3003)— contracts は apps に依存できないため(MOD-003)。
- `patientId` は wire 上は schema 検証済みの素の string とする。branded PatientId 化は backend/frontend の内部で行う。@yrese/contracts は shared-kernel の値源・ガード(`isPermissionScope`、branded ID factory 等)を再利用してよいが、依存方向は MOD-003 に従う。
- `patientId` の wire 検証は shared-kernel の `patientId()` factory と同水準に揃え、非空・空白のみ拒否・制御文字拒否・最大128文字を契約層で fail-closed に拒否する(WP-4046)。wire 型は素の string から変更しない。
- **検索結果の時点で資格確認状態を可視化**する(v0.2.0 §7: 外部確認未完了状態を隠さない)。
- resultsはrepositoryのstable non-PHI surrogate ordering + patientId tie-breakで
  deterministicに返す。同一page入力は同じ順序となり、cursorはその順序へ拘束する。
- 複数候補からのautomatic selection/mergeを禁止する。薬剤師が表示された
  `name, kana, birthDate, sex, patientNumber, eligibilityStatus`を確認して患者を
  明示選択する。similar-patient warningをこのwire shapeへ追加してbreaking changeに
  しない。現行shapeで安全に表現できないwarningはSAF/UI amendment blockerとして
  別途扱う。
- PHI classification: レスポンスは PHI を含む。ログへの平文出力禁止(OPS-009)。correlation_id はヘッダで伝播。

## 4. エラー

- 400: **クエリ検証失敗の全ケース**(q 欠落/空白のみ/長さ超過、limit 範囲外、cursor 不正形式・境界不一致)→ `PAT-0001`(invalid patient search query)。`PAT-0001` は実装前に error_code_registry(MOD-006)と shared-kernel シードへ登録する。
- 403: scope不足(AUTH-0003、既存)
- 検索0件は 200 + 空配列(エラーではない)
- **503: 候補集合フェッチ上限の超過(§5 MEDIUM-2 訂正)**。`Retry-After` を付け、
  結果を一切返さない。partial results、truncated results、近似 `nextCursor` の
  いずれも返さない。error code は実装前に error_code_registry(MOD-006)と
  shared-kernel シードへ新規登録する(`PAT-` 系)。登録前に実装しない。
  response に bound 名、閾値、実測値、候補件数を載せない。
  この 503 は現行 runtime の到達可能な結果ではなく、bound 実装後に有効になる。
  **この非露出が防げる範囲を正直に限定する**: §5 の設計上、候補集合フェッチは
  薬局スコープ全件で `q` に依存しないため、503 が返るか否かという 1 bit は
  「当該薬局の患者数が `maxFetchedCandidateItems` を超えているか」をそのまま
  表す。時系列観測で閾値を超えた時期も判り、レイテンシも患者数にほぼ線形である。
  したがって主張は「**精度の高い**推測を防ぐ」であって「母集団規模の漏洩を
  防ぐ」ではない。粗い情報は残り、それは `patient:read` を持つ主体にのみ観測
  可能である(その主体は検索結果からも規模を概算できる)。この限定を超える
  保証を後続の設計判断が前提にしない。

## 5. 実装規律

- `related_tests`の`apps/api/src/patient-get.test.ts`と
  `apps/web/app/components/patient-context.test.tsx`は2026-07-30のrepository
  filesystemで存在を確認した既存direct testsである。path登録はtest PASSや
  cutover/FHIR behaviorの実装済み主張ではない。
- zod schema を @yrese/contracts に置き、frontend は契約外フィールドを仮定しない(v0.2.0 §0.0.2.2)。
- 契約変更は CONTRACT_CHANGE_REQUEST 経由。
- backend 実装(WP-2008)は PatientRepository インターフェース + インメモリ合成データ(MOD-013: PHI混入禁止・fixtures は合成のみ)。DB導入は data_model SSOT 承認後に差し替え。
- **リポジトリ入力は tenantContext 由来の tenantId + pharmacyId を必須**とし、cursor は不透明・非PHI・(tenant, pharmacy, query) に拘束された値とする。境界不一致の cursor は 400 で安全に拒否し、**ページネーションがテナント/薬局境界を越えられない**ことをテストで固定する。
- PHI レスポンスには `Cache-Control: no-store` を付与。Fastify ログに PHI を出さない(OPS-009)。generated client パイプライン導入までは、frontend は @yrese/contracts の schema 由来型を直接 import する。
- access log/APM/trace/exception/metric labelはallowlist方式とし、`q`,
  `cursor`, `identifier`, `logicalId`/`patientId`, `Authorization`,
  `Idempotency-Key`, `Reference`, raw URLをdrop/redactする。raw query/pathを
  default access logへ残さない。allowlist方式のredactionは多層防御の1層であり、
  §2のPRODUCTION_DISABLEDを代替しない。redactionが効いていることを理由に
  production でGET形式を有効化しない。
- **候補集合フェッチの上限(MEDIUM-2 訂正)**: 現行の検索実装は薬局スコープの
  候補集合を取得してからマッチングする(DB-005 §3.4)。この作業量は
  `limit` では縛られない。取得候補件数、復号バイト数、in-memory working set、
  wall time、scope 単位の同時実行数に configured bound を課し、実測で
  incremental に評価する。bound 到達時は **truncated results を返さず**、
  §4 の明示エラーで fail-closed に拒否する。
- **measured cap と代替経路**: 各 bound の値は合成データでの実測(1薬局あたり
  患者数分布、ペイロードサイズ分布、復号コスト、p95 レイテンシ)から決定し、
  承認を得る。production 適用の前に、全候補復号に依存しない非 PHI 粗インデックス
  経路の採否を決定する。粗バケットを採る場合は、バケット選択から PHI が
  推測可能にならないこと(cardinality と分布の安全性)を SEC-008 で評価する。
  未確定の間は `BLOCKED_PATIENT_SEARCH_SCALE_BOUND` とし、合成データ環境に
  限定する。
- frontend 実装(WP-3003)は generated/contracts 型のみを参照。

## 6. 変更履歴

- 0.2.4 (2026-07-31 Revision 8): independent re-review round 1 の訂正。
  §4 の bound 超過非露出について、防げる範囲を「精度の高い推測の防止」へ
  限定し、候補集合フェッチが `q` に依存しない設計上 503/200 の 1 bit が
  閾値 oracle として残ることを明記。
- 0.2.4 (2026-07-31 Revision 7): independent domain review の HIGH-8 / MEDIUM-2
  訂正。§2 の GET クエリ形式を PRODUCTION_DISABLED とし、production 正規経路を
  body-based 形式に指定(既存 GET wire shape は不変、合成データ環境では従来
  どおり)。§5 に候補集合フェッチ件数・復号バイト数・working set・wall time・
  scope 単位並行度の bound、measured cap の決定要件、非 PHI 粗インデックス
  代替の採否要件を追加。§4 に上限超過の fail-closed 503(`Retry-After` 付き・
  MOD-006 事前登録必須・母集団規模非露出)を追加。
- 0.2.4 (2026-07-30 Revision 6): FHIR cutover VERSION 1 baseline後も
  existing search/getはread-only projectionで、過去historyを合成しない。
- 0.2.4 (2026-07-30): WP-4250 PROPOSED。既存searchと
  `GET /patients/:patientId`のwire互換、deterministic ordering、manual identity
  confirmation、PHI logging禁止をcutover前後で固定。
- 0.2.3 (2026-07-09): WP-4046 — `patientId` wire 検証を shared-kernel branded ID factory 由来の共通 refine へ統一し、非空・空白のみ拒否・制御文字拒否・最大128文字を明記。wire 型は string 維持。
- 0.2.2 (2026-07-09): WP-4045 追補 — contracts から shared-kernel 値源・ガードを再利用できる旨を明記し、依存方向は MOD-003 に従う方針へ整合。
- 0.2.1 (2026-07-09): WP-4029 追補 — cursor 最大長512文字を契約へ追加し、巨大 cursor は decode 前に `PAT-0001` として拒否する。
- 0.2.0 (2026-07-09): codex 実装可能性レビューの CONTRACT_CHANGE_REQUESTS 4件+non-blocking 3件を反映して承認(契約正本化 / wire は素のstring / エラー網羅+PAT-0001 事前登録 / cursor のテナント境界拘束 / no-store / PHIログ禁止)。
- 0.1.0 (2026-07-09): 初版起案。
