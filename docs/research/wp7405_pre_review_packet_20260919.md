# WP-7405 pre-review packet — North Star 全行程 E2E

```yaml
work_package: WP-7405
risk: R2
date: 2026-09-19
author: devin (active_root_writer)
approval_basis: direct human authority 2026-09-19 (残タスク一括許可 — 「残タスクをそのまま実装」)
source_refs:
  - Plans.md WP-7405 行(North Star 全行程 E2E、C-064)
  - WP-7104 着地済み部分 journey(north-star-journey.test.ts / checkNorthStarJourney)
  - SEC-009 authenticated_context_boundary 0.1.0 APPROVED(§4 test_signed adapter)
  - DOM-002 §5 / DOM-004 §1 / API-021(調剤記録)
```

## 1. 目的

WP-7104 の部分 journey(検索→受付→draft→監査/outbox)を North Star 全行程へ拡張する:

> 受付 → 原本 metadata → Rp 構造化 → 薬剤師確認 → 確定 → 調剤記録 →
> audit / outbox evidence

を **in_memory(dev_headers)** と **postgres(test_signed)** の両 mode で
API 層(fastify inject)貫通し、browser 層は既存 UI が持つ行程
(検索→受付→引継ぎ→draft→確認/確定)を実 UI で、調剤記録は fixture API 経由で
貫通する(調剤 UI は WP-5113【REF】統合の別 WP — 本 WP の UI 範囲外)。

fail-closed 経路(非資格 actor・未解決行・終端受付)を必ず含む。

## 2. test_signed 認証 adapter(SEC-009 §4 の実装)

postgres mode の inject E2E を可能にするため、SEC-009 §4 で APPROVED 済みの
`test_signed` mode を実装する。これは WP-7405 の前提条件
(「WP-7101 の test-auth adapter 承認後」— SEC-009 0.1.0 APPROVED 済み)を
満たすための最小実装であり、OIDC provider は範囲外。

### 2.1 wire 形式

- header `x-test-auth`: `<base64url(payloadJson)>.<base64url(hmac)>`
- payloadJson = `{ tenant, pharmacy, actor, scopes: string[] }`
- 署名 = HMAC-SHA256(payloadJson, 鍵)。鍵は env `YRESE_TEST_AUTH_KEY`
  (repo には commit しない — test は生成鍵を buildServer option で注入)
- payload の field 検証: branded id 変換失敗・scope 集合外の値は全て
  credential 不正として 401(部分的受理なし)

### 2.2 有効化条件(SEC-009 §4 全条件)

`resolveTenantContextMode` に `testSigned` 入力を追加し、以下**すべて**を
満たす場合のみ `test_signed` を返す:

1. `YRESE_TEST_AUTH=1`(flag opt-in は全環境で必須 — `NODE_ENV=test`
   単独では有効化しない)
2. `YRESE_TEST_AUTH_KEY` が設定済み(鍵不在で test_signed 要求 → throw)
3. `repositoryMode === 'postgres'` の場合、DATABASE_URL の db 名が
   `yrese_test*` allowlist に一致
4. `NODE_ENV === 'production'` では常に拒否(flag 有無にかかわらず throw)

in_memory + test_signed も許可する(dev_headers と併存、§4 末尾)。
`dev_headers` の条件(§6)は一切緩和しない。

### 2.3 失敗応答(SEC-009 §5)

- `test_signed` mode で credential 欠落/署名不正/形式不正 → 401 `AUTH-0004`
  (理由内訳を応答に含めない — 固定文言)
- AUTH-0004 を shared-kernel error code + MOD-006 registry へ登録
  (§5 の bounded amendment 指示に従う: 0001〜0002 は欠番維持)
- `disabled`/`dev_headers` の既存応答(403 AUTH-0003)は不変

実装上の決定: route 層は provider を区別しない(§2)。plugin が
`request.tenantContextResolution` を `'resolved' | 'unauthenticated' | 'none'`
で装飾し、`requirePermission` は tenantContext 欠落時に
`unauthenticated` なら 401 AUTH-0004、それ以外は現行 403 を返す。

## 3. API 層 journey(WP-7104 の拡張)

`north-star-journey.test.ts` に全行程 test を追加。

### 3.1 in_memory 全行程

1. 患者検索 → 紙受付 POST(201)
2. `POST /reception/{id}/transitions` で IN_PROGRESS(If-Match CAS)
3. draft PUT: `sourceMetadata`(原本 type/日付/日数の必須要素)+ `rpGroups`
   で resolved medication/usage 参照(master seed 経由の既知 ID)
4. `POST /prescriptions/{id}/confirm`(薬剤師 grant 済み actor)→
   PHARMACIST_CONFIRMED
5. `POST /prescriptions/{id}/finalize` → PRESCRIPTION_FINALIZED + version=1
6. `POST /dispensings` → 201、`POST /dispensings/{id}/confirm` →
   DISPENSING_RECORDED
7. `/audit/events` で監査種別集合に `prescription.confirmed/finalized`・
   `dispensing.recorded/confirmed` を含むこと、`chainVerification.ok`
8. `/operations/outbox-summary` で `prescription.finalized`・
   `dispense.confirmed` の pending を確認

### 3.2 postgres 全行程

同一 journey を `TEST_DATABASE_URL`(yrese_test)上で test_signed 認証で
貫通する。buildServer を postgres 構成で組み立てるため、main.ts の
postgres composition を test 用に抽出/再現する。seed は migration 適用後の
isolated schema + SQL seed(patient/master/qualification)で行う。

- test credential は test 生成鍵で署名(production 鍵系統と無関係)
- fail-closed: 無効署名 → 401、scope 不足 → 403、cross-tenant → 404

### 3.3 fail-closed 行程(両 mode 共通の acceptance)

- 非資格 actor の confirm → 403(unqualified)+ deny 監査
- 未解決 rpItem 残存での confirm → 409(全解決 guard)
- COMPLETED 受付への draft save → 404(終端受付は editable でないため
  context not found — 実装準拠)
- test_signed: 不正署名/欠落 → 401 AUTH-0004(postgres のみ)

## 4. fixture + browser 層

- `scripts/ui-fixture-api.mjs` に `POST /dispensings` +
  `POST /dispensings/{id}/confirm` を追加(in-memory journey 状態を持つ
  最小実装 — fixture 規約の冪等収容に合わせる)。`migrationState` は 24 維持。
- `checkNorthStarJourney` を拡張: 受付→処方入力→保存 の後に UI lifecycle
  panel で確認→確定を実行し、調剤記録は fixture API への fetch で
  create/confirm し audit/outbox evidence を検証する。
  UI に無い操作(dispensing)は fixture fetch で代替する旨を test 名に明記。

## 5. 不変条件

- 本 WP は**本番経路に新規の認証・認可緩和を加えない**: test_signed は
  flag + test db allowlist + 非 production の三重 gate。
- dev header 条件・`disabled` の挙動・route 側 scope 判定は不変。
- credential/署名/鍵は log・audit・error 応答に出さない。
- PHI fixture は MOD-013 synthetic のみ。browser 失敗時 artifact は
  `artifacts/` 配下。
- audit/outbox evidence の検証は件数ではなく種別・鎖整合性・payload
  非含有(PHI)を対象とする。

## 6. Error codes

- AUTH-0004: 認証失敗の汎用(401)。`unauthenticated`。MOD-006 へ登録。
  domain AUTH、severity ERROR、affectsClaimability=false、
  requiresHumanReview=false(他 AUTH ERROR 行と同一)。

## 7. 設計決定

- D-1: provider 抽象 interface(TenantContextProvider)の全リファクタは
  OIDC WP 送り — 本 WP は既存 mode 機構への `test_signed` 追加で
  SEC-009 §4 の機能要件のみ実装する(route 層 provider 非依存は維持)。
- D-2: postgres journey は test 内で composition を組み立てる
  (main.ts の分岐を test 専用経路へ一般化しない — 影響範囲を限定)。
- D-3: browser 層で dispensing は fixture fetch。UI 未実装の工程を
  UI 経由と偽らない。
- D-4: reception IN_PROGRESS 遷移は既存 transition route 経由
  (直接 seed しない — North Star の実経路に乗せる)。

## 8. テスト計画

- config unit: resolveTenantContextMode の test_signed 全条件分岐
  (production 拒否・allowlist 外 db 拒否・鍵未設定拒否・flag 経路)
- plugin unit: 署名不正/形式不正/payload field 不正 → 401、正常 credential
  → context 解決、scope 不足 → 403
- journey: in_memory 全行程 + fail-closed、postgres 全行程 + fail-closed
- fixture/browser: journey 拡張の `test:ui`(実行環境依存 — 少なくとも
  fixture parity は node 起動で smoke)
- 既存 journey 3 test の非回帰

## 9. 検証 gate

typecheck・全 workspace test・check:openapi(変更なしのはず)・
ssot-index(MOD-006 改版反映)・boundaries・secrets・deps・sbom・
calculation-purity・test:scripts。

## 10. 実装状況・独立 review

### 実装(2026-09-19)

- `test_signed` tenant context mode(SEC-009 §4): `x-test-auth` header
  (`payload.signature` compact 形・HMAC-SHA256・timing-safe 比較)、
  `resolveTenantContextMode` で flag opt-in + 非 production + 鍵設定の
  三重 gate、plugin 起動時に鍵未設定なら `done(error)` で fail-closed。
  `signTestAuthCredential` helper export。不正・欠落 credential → 401
  AUTH-0004、scope 不足 → 403 AUTH-0003。credential/鍵は log/応答へ
  出さない。`BuildServerOptions.tenantContextTestAuthKey`、
  main.ts は `YRESE_TEST_AUTH_KEY` env 配線。MOD-006 0.2.2 に
  AUTH-0004 登録、IDX-001 0.4.76。
- in-memory 全行程 journey(`apps/api/src/north-star-journey.test.ts`):
  受付作成 → 実 transition route で IN_PROGRESS → 実 master route で
  検索 → resolved Rp 構造化 draft 保存 → 薬剤師確認 → 確定 →
  調剤記録作成 → 調剤確定 → audit 7 種(reception.created/started・
  prescription.created/confirmed/finalized・dispensing.recorded/
  confirmed)と outbox evidence を検証。fail-closed 3 件:
  非資格 actor → 403+deny 監査、未解決品目 confirm → 409 RX-0001、
  終端受付への保存 → 404。
- postgres 全行程 journey(`apps/api/src/db/north-star-journey.integration.test.ts`):
  実 migration・実 PG repository・`test_signed` 認証・実 route
  composition で同一 journey を完走(TEST_DATABASE_URL)。
- fixture(`scripts/ui-fixture-api.mjs`): master medications/usages
  endpoint(asOf 必須・localCode 前方一致/名称部分一致)、受付 entry の
  `version`/`eligibility` 補完、`POST /reception/{id}/transitions`
  (If-Match+expectedVersion 二重 CAS・遷移表 parity)、
  `POST /dispensings` + `/confirm`(1版1記録・冪等 replay/conflict・
  finalized guard・rpItem カバー guard)、outbox summary へ
  `prescription.finalized`/`dispense.confirmed` 集計、whoami scopes
  拡充、終端受付への PUT を 404。
- browser(`scripts/ui-browser-check.mjs`): `checkNorthStarJourney` を
  全行程へ拡張 — 受付登録→UI 対応開始→引継ぎ→原本 metadata+master
  解決品目で保存→UI lifecycle で確認/確定→調剤は fixture fetch(D-3)
  →outbox evidence 検証。structured-RP 化で drift していた旧 aria-label
  群(`RP1 薬剤名`/`用法用量`/`数量`)を現行 label へ修正。
  `ui-browser-gate-contract.test.ts` の check 名を追随。

### 検証(全実行済み)

- `pnpm --filter @yrese/api test`(TEST_DATABASE_URL=実 PG): 58 files /
  1,386 tests PASS(skip 0)
- `pnpm -r --parallel typecheck`: 全 package PASS
- `pnpm -r --parallel test`(TEST_DATABASE_URL 付き): 全 package PASS
- `pnpm --filter @yrese/web build`: PASS
- browser gate(fixture API + dev server + Playwright):
  `36 routes, 6 interaction suites` PASS — 全行程 journey 完走
- check:boundaries / calculation-purity / deps / openapi / sbom /
  secrets / ssot-index / test:scripts: 全 PASS

### 独立 review

fresh-context read-only reviewer による frozen-diff review 3 ラウンドで閉塞
(Oracle Pro 不可のため WP-7403 と同じ代替経路・ユーザ明示承認済み)。

- **R1 FAIL(2M/7L)** → 全件修正:
  - F-1(M): main.ts in-memory 分岐が `tenantContextTestAuthKey` を未転送で
    自己矛盾 → `YRESE_TEST_AUTH_KEY` を転送。
  - F-2(M): fixture transitions の guard 順を正本順序へ(RCV-0004 → RCV-0005)。
  - F-3(M): fixture の invalid request を DSP-0005 へ(実 API の
    `DISPENSING_INVALID_REQUEST` と一致)、duplicate-version guard を品目
    検証より前へ。
  - F-4(L): dispensingDate 形式検証 + confirm key 他 record 再利用 →
    DSP-0008 を追加。generic 整合 guard は fixture 最小 parity の範囲外
    (browser check が当該経路を踏まない)として本 packet に記録。
  - F-5(L): `to` enum + `expectedVersion>=1` 検証を追加。
  - F-6/F-7(L): §2.2(`NODE_ENV=test` 単独では有効化しない)・§3.3/テスト名
    の 409→404 訂正。
  - F-8(L): plugin boot check で空文字/空 Buffer の鍵も拒否。
  - F-9(L): fixture whoami scopes に `master:read`/`audit-log:read` 追加。
- **R2 FAIL(4L)** → 全件修正:
  - confirm は status 判定(DSP-0002)を key 一意性(DSP-0008)より先へ
    (API-021 §5 準拠)。
  - create は形状検証を replay lookup より前へ(route schema 相当)。
  - replay fingerprint を `canonicalJson`(key 再帰ソート)へ — 実装の
    canonical JSON/JSONB `=` と parity。
  - browser journey の作成行特定を `queueRows.last()`(acceptedAt ソート
    依存・JST 0:00-9:30 で seed-002 を指す窓あり)から POST /reception
    応答の receptionId(handoff link aria-label 内の `受付ID`)へ変更。
- **R3 FAIL(1L)** → 修正: gate contract test が script に存在しない
  リテラル `対応開始: テスト患者 一` を assert → `/対応開始: /u` へ。
- **R4 PASS** — 修正確認・新規欠陥 0。fixture `asOf` の日付妥当性
  緩和(2026-02-30 受理)は最小 parity の既知簡略化として残置。

最終 frozen diff: `/tmp/wp7405-frozen-r4.diff`、2,972 行、
SHA-256 `537ce79815e49b8e88b91cc436845acc83b8e74a644da74a2960958b5f4c7d51`。
