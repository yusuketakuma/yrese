# maint-v7 台帳 (2026-09-28)

- B = fb601d1 (devin/maint-v7-20260928, = main HEAD)
- 前回未commit成果(既存差分, partner IPv6 rewrite + webhook body release + tests)を検証済み・translated range 追加
- inventory: tracked 789 = src 346 / test 192 / docs 251 / migrations 24 / scripts 13 / CI 3
- main checkout は codex_root WP-7600 所有(触らない)。wp-7500 worktree も別lane
- I = B + uncommitted diff (`.maint-v7/patch-B-to-I.patch`, 262行, partner 4ファイルのみ)

## Coverage 状態

| module | 範囲 | status | evidence |
|---|---|---|---|
| partner/endpoint-policy | src+test | REVIEWED+FIXED | IPv6 translated `::ffff:0:0/96` 追加、DNS層回帰テスト、47 PASS |
| api infra (server/config/pool/tx/migrate) | 全 src | REVIEWED | fail-closed dev stub 境界、checksum forward-only |
| audit (in-mem+pg+routes+dynamodb codec) | 全 src | REVIEWED | hash chain per-scope advisory lock、raw fail-visible |
| patient (in-mem+pg+cmd+routes+cursor) | 全 src | REVIEWED | ILIKE parity = boundary note 下記参照 |
| reception (repo/cmd/routes/queue+pg) | 全 src | REVIEWED | 遷移表→CAS 順序、idempotency provenance、legacy_orphan 分類 |
| prescription (draft/lifecycle/amend/inquiry+pg) | 全 src | REVIEWED | lock 内再検査、version append-only、qualification guard |
| dispensing (service/routes+pg) | 全 src | REVIEWED | confirm 資格→行lock→audit/outbox 原子化 |
| coverage / eligibility (cmd/repo+pg) | 全 src | REVIEWED | snapshot 原子的保存、method-state 整合 |
| operations read | src | REVIEWED | 集計のみ・PHI 非含有・fail-safe migration state |
| master (repo+seed+pg) | 全 src | REVIEWED | synthetic 冪等 seed、write 経路は module のみ |
| api test suite | 75 files | REVIEWED | 1256 pass、149 skip=PG 統合(TEST_DATABASE_URL 未提供=CI のみ)、zero-expect 0 件 |
| web transport/client/launch/draft | 精読 | REVIEWED | echo照合・error whitelist・dev stub 非本番送信・storage XSS sink なし |
| web 残 component/page | subagent e1e3efc6 | 監査中 | 809 test PASS・zero-expect 0 件・storage/cookie/innerHTML 0 |
| packages 8 | subagent e26d383c | 監査中 | 814 test PASS |
| scripts 13 | clean/secrets/boundary 精読+全実行 | REVIEWED | symlink fail-closed、secret-scan skip 可視化 |
| .github/workflows 3 | 全文 | REVIEWED | SHA pin・最小権限・postgres service・evidence upload |
| migrations 24 | 全文+runner | REVIEWED | forward-only・NOT VALID legacy・複合FK・CHECK |
| docs 251 | check:ssot-index 機械検証 | REVIEWED | 191 doc index 整合・openapi drift 0 |

## Boundary notes (確定 defect ではない残差)

1. **patient search ILIKE parity**: in-mem は `trim+toLocaleLowerCase('ja-JP')`→includes、
   PG は `ILIKE '%q%'`(q は schema で trim 済み、%_\\ escape 済み)。
   ドメイン入力(和名/カナ/英数 patient_number)では一致。異種 Unicode fold
   (ß/İ 等)のみ残差。DDL 固定不可(DB collation 依存)のため観測のみ。
2. **DNS rebinding 窓**: partner registry は配送毎に再解決するが
   resolve→connect の race は残存(前回 ponytail 記録済み・維持)。
3. **api dist 非実行**: workspace pkg が `.ts` を export するため
   `node dist/server.js` は contracts 解決失敗。実行入口は `tsx src/main.ts`
   であり dist は typecheck 成果物。CI も同構造で green。deploy 未整備は
   既知設計(human gate)であり本監査で変更しない。
4. **PG 統合 test 149 skip**: ローカルに TEST_DATABASE_URL/Docker なし。
   CI(ci.yml postgres:18.4 service)で実行される経路は存在するが、
   本環境での実測値は未取得 → 残項目として報告。

## 検証記録 (worktree, Node 26.6.0 / pnpm 11.18.0)

| cmd | exit |
|---|---|
| pnpm --filter @yrese/api test | 0 (1256 pass / 149 skip) |
| pnpm --filter @yrese/web test | 0 (809 pass) |
| pnpm -r test (全 workspace) | 0 (2879 pass) |
| pnpm -r typecheck | 0 |
| pnpm -r lint | 0 |
| pnpm -r build | 0 (api dist・web .next 生成) |
| pnpm test:scripts | 0 |
| check:boundaries / calculation-purity / secrets / ssot-index / openapi / sbom / deps | 全 0 |
| api dist 隔離 import (leaf 3 module, /tmp 外側 node_modules なし) | OK |
| PG integration / browser playwright | 未実行(環境) |

## Round 2 修復(確定 finding → 実装済み)

| finding | 対象 | 修復 | 検証 |
|---|---|---|---|
| coverage panel 既定日が UTC 前日化 | apps/web patient-coverage.tsx | todayAsIsoDate(JST固定) へ | render test で JST 日付 assert |
| fetchCoverage/recordCoverage に timeout/abort 無し・stale 応答 | 同上 | signal 引数 + 30s timeout、世代+AbortController guard、dispose で unmount abort | controller test: stale 抑止・signal.aborted |
| 患者切替で coverage panel の state 残存 | patient-search.tsx:438 | key={selected.patientId} で remount | 型/レンダー test 緑 |
| 冪等キー毎回再生成・再入 guard 無し | patient-coverage.tsx | submission store(content-keyed)+submitting flag+settled(4xx)退役、createCoverageController 抽出 | test: retry 同 key・4xx/成功後新 key・double submit 1 POST |
| buildRequest schema 失敗が silent | 同上 | 固定文言 ErrorNotice(patient-registration 規約) | render/typecheck |
| `!res.ok && res.status !== 200` dead cond | 同上 | `!res.ok` のみ | test 緑 |
| createPatient に signal 未接続 | patient-registration.tsx | AbortSignal.timeout(30s) 配線 | web test 緑 |
| contracts export map 3件 stale | packages/contracts/package.json | calculation-trace/patient-search/reception-queue の実在 path へ | typecheck/build 緑 |
| zod-openapi が devDeps(runtime import あり) | 同上 | dependencies へ移動(lockfile 更新) | install/build 緑 |
| test-support が dist へ emit | 全 9 tsconfig.build.json | `src/**/*test-support.ts` exclude(patient-repository-support.ts は本番 import のため除外対象外) | clean build で 0 emit 確認 |
| rules.ts に未使用複製 createFixedPointsRule+imports | packages/calculation/src/rules.ts | barrel のみへ縮退 | calculation test 121 緑 |
| patient write schema が空白/制御文字を受理 | patient-search.ts | non-blank + 制御文字拒否(prescription-draft 同規則) | 新規拒否 test 追加 |
| OpenAPI `x-yrese-required-scope` 単複混在・dispensing body required 欠落 | openapi-paths-* | 複数形配列へ統一(条件 write scope は description が正本)、dispensing POST/confirm に required:true | openapi regen + drift PASS |
| trace 構築側が affectsClaim 型/output 必須/配列要素型を未検証 | packages/trace/src/index.ts | freezeStringArray + boolean/non-empty assert(wire contract と parity) | 新規 test 3件 |
| audit verify が未知 field/sparse hole を受理 | packages/audit/src/index.ts | copyExactAuditEventShape で strict 化+hole は破断 | 新規 test 2件+既存 totality 緑 |
| money round() upscale 分岐のみ非正規化 | packages/money/src/index.ts | .normalize() 追加 | 新規 test +全緑 |

検証(修復後): contracts 265 / trace / audit 208 / calculation 121 / api 1256 pass・149 skip / web 813 pass / typecheck・lint・build・test:scripts・check:* 全緑・openapi drift 0。dist から test-support emit 0 を clean rebuild で実証。
