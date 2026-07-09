# State.md — 活動ログ

調剤用レセプトコンピューター MVP(構築プロンプト v0.2.0)の活動記録。新しいエントリを上に追記する。

---

## 2026-07-10

### WP-4073 CI PostgreSQL integration fail-open closure

- fable5 の `PLAN_APPROVED` に基づき、CI `check` jobへ official `postgres:16@sha256:be01cf82fc7dbba824acf0a82e150b4b360f3ff93c6631d7844af431e841a95c` disposable serviceを追加。digest provenance は Docker Hub official tag API endpoint `https://hub.docker.com/v2/namespaces/library/repositories/postgres/tags/16` の `digest` fieldを2026-07-10に取得し、OCI index `sha256:be01cf82fc7dbba824acf0a82e150b4b360f3ff93c6631d7844af431e841a95c` を得たもの。合成専用user/password/database、port 5432、`pg_isready` health gateを設定し、`TEST_DATABASE_URL` は Test stepだけへ注入する。interim CI PostgreSQL 16はtest runtime限定で、production Aurora majorは別途SSOT_UPDATE対象として推測・流用しない。
- test-only `resolveTestDatabaseUrl()` を両PostgreSQL integration fileで共有。missing/blank URLかつ `CI` exact `true` は値を含まない固定errorでmodule load時にfail-closed、local missing/blankは従来どおり明示skip、configured URLは原文を保持する。integration SQL/test semantics、migration、package/lock、prod configは変更していない。
- 検証: localでは resolver focused 3 tests、`pnpm --filter @yrese/api test` 70 PASS + PostgreSQL integration 5 expected SKIP、API typecheck、workflow YAML parse/pin/Test-step-only env assertion、`actionlint .github/workflows/ci.yml`、`pnpm test:scripts`、`pnpm check:secrets`、`pnpm check:boundaries`、`git diff --check` がPASSし、docker/`TEST_DATABASE_URL`不在のためDB接続・migration適用なし。commit `b725545` の GitHub Actions run `29052682750` は success。pinned PostgreSQL container初期化後、migration integration 2 PASS、repository integration 3 PASS、resolver 3 PASS、API 8 files / 75 tests PASS・0 skippedを確認し、後続のOpenAPI/secrets/deps/SBOM/boundaries/calculation/SSOT gatesも全てgreen。staging/prod DBへのapplyは行っていない。

### WP-4070 SBOM component version/link validation fail-closed

- fable5 の `PLAN_APPROVED` に基づき、`scripts/check-sbom.mjs` の missing/blank version `0.0.0` 合成と malformed node silent skip を廃止。workspace root / dependency node / dependency container を plain object、name/version/path を primitive nonblank string として fail-closed 検証する。明示 `0.0.0` と nonblank version 原文は semver/trim 正規化せず維持し、`unsavedDependencies` は承認どおり対象外、既知 pnpm 追加fieldは許容する。
- workspace registry は absolute root path の一意性と同名 workspace の path/version consistency を強制。`link:` は nonblank suffix、absolute node path、登録済み target、dependency key/name一致、non-link concrete target version の全条件を要求する。ただしsuffixは表示metadataとして検証するだけでpath解決せず、pnpmのabsolute `node.path`→unique registryだけをidentity authorityとした。package name は whitespace/extra `@`/slashを拒否する unscoped/scoped grammarへ限定し、component Mapは曖昧なbom-refでなくJSON pair keyを使う。workspace rootsはdependency traversal前に全件applicationとしてcanonical emitし、root順序によるlibrary降格を防止。同名同versionのnon-link dependencyはworkspace impersonationとして拒否する。同一external dependency pairの再出現はdedupeを維持。errors は raw node/name/version/link/path/resolved URL を出さない固定contextとした。
- output は全validation後にserializeし、targetと同一directoryの exclusive unique 0600 temp fileへ書いてから atomic renameする。temp write/rename failure はbest-effort cleanup後に固定errorで停止し、既存targetを保持する。regression harness は invalid package name、raw値非露出、malformed時のoutput no-create/no-overwriteに加え、nonempty directoryをtargetにしたdeterministic rename failureでsentinel保持とtemp artifact不在を固定。package/lock/CI/docs は変更していない。
- 検証: root順序正逆、非権威link suffix、workspace/external identity conflict、bom-ref境界攻撃を追加固定。`node --check scripts/check-sbom.mjs` PASS、`node --check scripts/check-scripts.mjs` PASS、`pnpm test:scripts` PASS、`pnpm check:sbom` PASS(231 components)、`pnpm check:secrets` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4071 patientNumber tenant/pharmacy uniqueness enforcement

- fable5 の `PLAN_APPROVED` に基づき、APPROVED DOM-002 の薬局内患者番号一意性を PostgreSQL に fail-closed で反映。checksum 管理済み `000002_create_patient_and_reception_tables.sql` は SHA-256 `2910b460d2b9733904937093b399784089dbda9a444af75ac5fd498a1ae4b599` のまま変更せず、forward-only `000003_add_patient_number_scope_unique.sql` に named UNIQUE constraint `(tenant_id, pharmacy_id, patient_number)` を追加した。
- 一意性は保存済み exact 値に限定し、lower/trim/citext 等の正規化、既存重複の自動 cleanup/renumber/merge、DML、既存 `patients_search_idx` の削除は行っていない。既存 index は検索互換性を優先して明示的に保持する。legacy 重複がある環境では constraint 構築が SQLSTATE 23505 で失敗し、migration runner の既存 transaction により constraint/history 書込とも rollback、legacy rows は不変となる。
- static tests は `000002` checksum、`000003` の loader forward order、exact 3-column constraint、DML/normalization/index drop 不在を固定。disposable schema 専用 integration tests は同一 tenant+pharmacy+exact patientNumber の重複を constraint 名付き SQLSTATE 23505 で拒否し、tenant/pharmacy 越えの同値、case/whitespace variant、scoped search、legacy 重複時の rollback/history/rows不変を固定した。
- 検証: focused static 10 PASS + PostgreSQL integration 5 SKIP、`pnpm --filter @yrese/api test` 67 PASS + 5 SKIP、`pnpm --filter @yrese/api typecheck` PASS、`pnpm check:boundaries` PASS、`pnpm check:secrets` PASS、`git diff --check` PASS。`TEST_DATABASE_URL` 不在のため PostgreSQL integration は明示 skip。migration 適用や既存/dev/prod DB への DDL/DML は実行していない。

### WP-4068 event/audit ISO instant calendar validation

- fable5 の `PLAN_APPROVED` に基づき、`@yrese/events` に共有 `assertIsoInstant` を追加。primitive string / non-empty を明示検証し、既存の timezone 必須・任意長 year・offset・fraction の lexical semantics を維持しつつ、文字列から年月日を捕捉して proleptic Gregorian calendar 上の実在日を fail-closed に検証する。任意長 year は全体を数値化せず、400年周期に必要な末尾4桁のみで閏年を判定する。
- event envelope は検証済み `wallClock` の原文を保持する。`@yrese/audit` は重複していた ISO regex を削除し、文字列入力を共有 validator へ通してから既存の `Date` offset→UTC 正規化を実行する。Date 入力 branch と canonicalization、既存 audit golden hash は変更していない。
- tests は非閏年2026/2023/1900年の2月29日、2月30/31日、4月31日を Z/offset 入力で拒否し、2028/2024/2000年の leap day、任意長 year、events の原文保持、audit の valid leap offset 正規化を固定。null / undefined / boxed String / `toString` object の暗黙文字列化も拒否する。検証: `pnpm --filter @yrese/events test` PASS(45)、events typecheck/build PASS、`pnpm --filter @yrese/audit test` PASS(46)、audit typecheck/build PASS、`pnpm check:boundaries` PASS、`pnpm check:secrets` PASS、`git diff --check` PASS。

### WP-4069 dependency audit report fail-closed validation

- fable5 の `PLAN_APPROVED` に基づき、dependency audit gate の malformed/partial/error-only JSON false-pass と、parseable stdout 時の pnpm nonzero status 見落としを修正。`metadata.vulnerabilities` は plain object、info/low/moderate/high/critical はすべて finite な非負 safe integer を必須とし、error field・欠落・文字列・負数・小数・unsafe integer は fail-closed にした。
- live command は spawn error・signal・exit status を必ず評価し、検証済み0件かつ status=0 の場合だけ pass とする。registry/network の warn-only は具体的な pnpm/system error code に限定し、generic な `registry` / `network` / `socket` / `timeout` 文言は例外扱いしない。既存 HIGH/CRITICAL threshold と `--from-audit-json` / `--from-audit-error` fixture mode は維持した。
- `scripts/check-scripts.mjs` は clean、HIGH/CRITICAL、malformed shape/count matrix、明示 outage、generic near miss、偽 `pnpm` の parseable clean JSON + exit 23 を固定。検証: `pnpm test:scripts` PASS、元の `{}` / error-only / invalid-string reproduction は全て exit 1、`pnpm check:deps` PASS(high=0, critical=0)、`pnpm check:secrets` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4067 web API transport fail-closed + same-origin dev routing

- fable5 の `PLAN_APPROVED` に基づき、患者検索・受付一覧・受付登録の API endpoint 解決を `apps/web/app/api-transport.ts` へ集約。明示された HTTP(S) / 安全な root-relative base のみ許可し、production/test/staging/undefined で base が欠落・空・不正なら、設定値・患者検索語・患者IDを含まない固定エラーで `fetch` 前に停止する。
- development の未設定時だけ `/_yrese-api` を同一オリジン base として返し、Next rewrite で `127.0.0.1:3001` へ転送する。rewrite 自体も `NODE_ENV=development` のみ生成し、production/test/staging では internal-loopback proxy route を公開しない。broad CORS、apps/api、WP-4066 auth semantics、WP-4065 dev-only least-privilege headers は変更していない。
- tests は resolver environment matrix、unsafe base 拒否、production 設定欠落時の患者検索/受付一覧/受付登録の zero fetch、エラーへの query/患者ID 非露出、3操作の same-origin URL、rewrite の development-only matrixを固定。検証: `pnpm --filter @yrese/web test` PASS(63)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm --filter @yrese/web build` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4066 dev tenant context explicit opt-in — completed / HIGH review APPROVED

- fable5 の `PLAN_ADJUSTMENT_APPROVED` に基づき、caller-controlled dev tenant headers を composition root の明示 opt-in なしでは一切 trusted context にしない deny-by-default 境界を実装。tenant context plugin から `process.env` 参照を除去し、常時 `tenantContext=undefined` を decorate、明示 `dev_headers` mode の場合だけ header hook を登録する。
- config resolver は parsed DB URL / resolved repository mode を受け、flag exact true + environment exact development/test + repository exact in_memory + parsed DB URL absent の全条件でのみ `dev_headers` を返す。absent / exact false は disabled、malformed flag と undefined/staging/Production/typo/production/PostgreSQL/DB URLありは入力値を含まない固定 startup errorで拒否する。
- `buildServer()` は既定 disabled とし、`dev_headers` + explicit in_memory 以外を Fastify construction 前に拒否。`main.ts` は repository mode と tenant mode を一度ずつ解決して両 repository 経路へ渡し、API dev script は必要な環境変数を明示した。OIDC・audit event・permission semantics・DB操作は変更していない。
- テストは既存の header/permission security cases を explicit dev helper で維持し、default server に attacker-selected headers を送った患者検索・受付一覧・受付登録が全て403、患者 repository search/findById と受付 repository list/create が全て0 callであることを追加固定。検証: focused config/server 53 tests PASS、API全体65 tests PASS + PostgreSQL integration 3 tests expected SKIP(`TEST_DATABASE_URL`不在)、`pnpm --filter @yrese/api typecheck` PASS、`pnpm check:boundaries` PASS、`pnpm check:secrets` PASS、`git diff --check` PASS。
- commit `137315d` に対する fable5/Opus 4.8 の `REVIEW_RESULT: APPROVED` と GitHub CI green を確認し、WP-4066 を完了。残る外部 deployment black-box verification は deployment gate として維持し、コード完了の blocker とはしない。

### WP-7001 Phase 1 DynamoDB persistence foundation — PLAN_APPROVED / implementation HOLD

- fable5 から WP-7001 `PLAN_APPROVED` を受領。persistence adapter は `apps/api` server-only、AWS SDK import は adapter 層限定、最初の集約は FHIR Patient を推測実装せず synthetic-only `AuditAppendStore` とする計画が承認された。DynamoDB Local harness の限界、trusted context 由来の authority、PHI非露出、HIGH handoff + opus4.8 review の各条件も維持する。
- decision A/B/C は全て承認済み。A=`SEQ#` zero-pad width 20 / uint64範囲 / overflow事前拒否。B=app-local verification が連番・dedupe・TIP整合を検証し、hash continuity は audit core に委譲。C=同一 eventId + 同一 logical intent は冪等成功、異なる intent は hard conflict。同時に event/dedupe/TIP の tenant-scoped同一PK・別SKと、retry loop 外で一度だけ生成する stable eventId を確認した。
- 必須制約は adapter 層以外への AWS import 禁止、同一 item の ConditionCheck+Update 禁止、監査 dedupe guard + tip 採番 sequence、TTL/物理削除禁止、per-request tenant scope、PHI のキー/GSI/ログ非露出、PostgreSQL 正本の段階移行維持。`AuditWriteContext` の trusted tenant/pharmacy/user だけから scope を再構成し、caller intent に authority/prevHash/sequence を持たせない。
- 実装着手条件の (a) WP-4066 landing は充足済み。残る条件は (b) fable5 の DB-005 §6/§10 pin 反映通知のみ。通知受領までは `PLAN_APPROVED / implementation HOLD` であり、DB-005 pin landing は未確認、AWS SDK/package/DynamoDB Local/adapter コードは未変更。

### WP-4065 dev tenant header least-privilege split

- fable5 から `WP-4065(dev tenant header least-privilege split)` の `PLAN_APPROVED` を受領。dev-only・frontend-only だが auth/security hygiene のため `[risk: HIGH]` handoff 対象として扱い、スコープを `apps/web` と focused tests に限定。API認可plugin・DB・SSOT本文・contract shape は変更なし。
- `devTenantHeaders()` を shared-kernel の `permissionScope()` / `PermissionScope` に結び、既定の患者検索 request は `patient:read` のみを送るように変更。production/test/undefined では引き続き `{}` を返し、本番境界は緩めていない。
- 受付ダッシュボードは queue fetch を `reception:read,patient:read`、create request を `reception:write,patient:read` に分割。dev stub で過剰権限を前提にした UI 側 permission drift が見えるようにした。
- focused tests で患者検索・受付一覧・受付登録それぞれの `x-dev-scopes` を固定し、dev-only gating の既存テストも維持。検証: `pnpm --filter @yrese/web test` PASS(37)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4065 dev tenant header least-privilege split plan request

- agmsg inbox 空、monitor は `yrese/codex` alive。Claude 側 dirty の `docs/ssot_index.md` / `docs/database/dynamodb_single_table_design.md` は引き続き温存。
- self-scan で `apps/web/app/patients/patient-search.tsx` の `devTenantHeaders()` が development 限定ながら全 request に `patient:read,reception:read,reception:write` を送っており、患者検索・受付一覧・受付登録の必要scopeと比べて過剰である点を確認。
- auth/security 境界に触れるため即実装せず、Claude へ `CODEX_PLAN_REQUEST [risk: HIGH]` を送信。想定は frontend-only で操作別の最小 `x-dev-scopes` に分割し、API認可plugin・DB・SSOT本文・contract shape は変更しない。
- `Plans.md` に WP-4065 を未完了の承認待ち候補として登録。検証: `git diff --check` のみ(ledger update)。

### WP-4055 / WP-4058 DB migration runner fail-closed hardening

- fable5 から `WP-4055 + WP-4058(bundle)` の `PLAN_APPROVED` を受領。DB runner 領域のため HIGH risk とし、スコープを `apps/api/src/db/migrations.ts` と focused unit test のみに限定。Claude 側 dirty の `docs/ssot_index.md` / `docs/database/dynamodb_single_table_design.md` は温存。
- WP-4055: `loadMigrationFiles()` の silent filter を廃止し、migration directory entry を先に分類するように変更。`NNNNNN_snake_case.sql` は読み込み、`README.md` / `.gitkeep` / `.DS_Store` は明示 allowlist で無視し、それ以外の不正/typo/大文字/backup系 entry はファイル名付きで fail-closed に throw する。既存の SQL 内容・checksum・version sort・duplicate version semantics は変更なし。
- WP-4058: `defaultMigrationsDirectory()` を `process.cwd()` 依存から `import.meta.url` 由来の repo root anchor へ変更。`pnpm --filter @yrese/api` や任意 cwd から呼んでも root `migrations/` を解決する。明示 `migrationsDirectory` 引数は従来どおり尊重。
- focused test: valid migrations の version sort/checksum、allowlist file ignore、不正 migration-like file の throw、`process.chdir()` 後の cwd 非依存 default path を追加。
- 検証: `pnpm --filter @yrese/api exec vitest run src/db/migrations.test.ts` PASS(7)、`pnpm --filter @yrese/api test` PASS(60 + 3 SKIP)、`pnpm --filter @yrese/api typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4064 PatientSearch runner lazy initialization

- WP-4063 handoff後も agmsg inbox は空。dev tenant scope の最小化候補は auth/security 境界に触れるため即実装せず、純粋な Web 内部初期化の self-scan を優先。
- `apps/web/app/patients/patient-search.tsx` の `useRef(createSearchRunner(fetchSearch, setState))` は render ごとに初期値式を評価し、最初の runner 以外に未使用の runner closure を生成しうる点を確認。
- `runnerRef` を `null` 初期化し、初回 render 時だけ `createSearchRunner()` を代入する lazy ref に変更。検索 runner 内の generation guard の所有者が明確になり、表示・API・契約shapeは不変更。
- 検証: `pnpm --filter @yrese/web test` PASS(37)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4063 web display label exhaustiveness tightening

- WP-4062 handoff後も agmsg inbox は空。DB runner の高リスク PLAN_REQUEST は承認待ちのため、Web表示型の低リスク self-scan を継続。
- 性別ラベル(`PatientSearch` / `PatientHeader`)と処方箋受付区分ラベル(`ReceptionDashboard`)が現行値は満たす一方、契約/props union に対する明示的な `Record<..., string>` 網羅性を持っていない点を検出。
- `SEX_LABELS` を `PatientSearchResult["sex"]` / `PatientHeaderProps["sex"]` に、`PRESCRIPTION_INTAKE_LABELS` を `ReceptionQueueEntry["prescriptionIntakeType"]` に結び、将来の値追加時に typecheck が未対応ラベルを検出できるようにした。表示文言・DOM・契約shapeは不変更。
- 検証: `pnpm --filter @yrese/web test` PASS(37)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4062 frontend error code registry filtering

- agmsg inbox 空、DB-005/DB設計の Claude 側 dirty 差分(`docs/ssot_index.md` / `docs/database/dynamodb_single_table_design.md`)は触らず、frontend-only self-scan を継続。
- `apps/web/app/patients/patient-search.tsx` と `apps/web/app/reception-dashboard.tsx` が API body の `errorCode` を形式チェックだけで表示対象にしており、`packages/contracts/src/error.ts` の登録済み registry 制約と drift している点を検出。
- `apps/web/app/components/error-code.ts` に `registeredErrorCodeOrUndefined()` を追加し、shared-kernel の `createKernelErrorCodeRegistry()` に登録済みのコードだけを `ErrorNotice` へ渡すように統一。患者検索・受付画面の API error parsing を更新し、`SYSTEM-9999` のような未登録コードを表示しないテストを追加。
- 検証: `pnpm --filter @yrese/web test` PASS(37)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4061 ReceptionDashboard queue stale response guard

- agmsg inbox 空のため、DB/SSOT/docs/database に触れない frontend-only self-scan を継続。
- `apps/web/app/reception-dashboard.tsx` の受付一覧 `load()` が generation guard を持たず、連続した日付表示で古い応答・古い失敗が後続の日付表示を上書きしうる点を検出。
- `createReceptionQueueRunner()` を追加し、最新ロードだけが `QueueState` を更新できるようにした。`ReceptionDashboard` は runner を `useRef` で保持し、既存の API 契約・表示構造は変更していない。web test で stale success / stale failure の破棄を固定。
- 検証: `pnpm --filter @yrese/web test` PASS(36)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4060 ReceptionDashboard acceptedAt clock display JST pin

- agmsg inbox 空、`yrese/codex` monitor alive、`main` は `origin/main` と同期済みから再開。DB-005 関連の `docs/ssot_index.md` / `docs/database/dynamodb_single_table_design.md` は Claude 側 dirty として触らない。
- self-scan で `apps/web/app/reception-dashboard.tsx` の受付時刻表示が `acceptedAt` UTC instant をホスト/ブラウザ timezone 依存で表示している点を検出。受付業務日付は WP-4053 で JST 固定済みのため、時刻表示も `Asia/Tokyo` 明示へ寄せた。
- `formatAcceptedTime()` を `Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo" })` に変更し、UTC 20:15 が JST 05:15 として表示されるテストを追加。契約・DB・SSOT本文は変更なし。
- 検証: `pnpm --filter @yrese/web test` PASS(34)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-2003 audit skeleton ledger closure

- DB-005 commit_request 待ちの interim として、上部一覧に残っていた WP-2003 の未完了表示を再確認。
- `@yrese/audit` は audit event registry / AuditEvent envelope / targetRef・outcome・businessReason・hash field guard を実装済みで、WP-2003 opus4.8 事後レビューも APPROVED 済み。LOW 指摘の否定テスト補強は WP-4024 で反映済み。
- `Plans.md` 上部の WP-2003 を完了済みに更新。hash-chain 計算/永続化は既存どおり WP-2009 / WP-5004 に残し、コード・SSOT本文・docs/database には触れていない。
- 検証: `pnpm --filter @yrese/audit test` PASS(41)、`pnpm --filter @yrese/audit typecheck` PASS、`pnpm check:boundaries` PASS。

### WP-4037/4038/4041 PatientSearch hardening closure

- DB-005 commit_request 待ちの interim として、SSOT/DB migration/docs/database に触れない patient search backlog の重複状態を再確認。
- 現行 `apps/web/app/patients/patient-search.tsx` は `createSearchRunner()` の generation guard で stale success / stale failure / stale append を破棄し、`devTenantHeaders()` は development 以外で dev tenant headers を送らない。資格状態表示は `PatientHeader` の `ELIGIBILITY_LABELS` を再利用し、PatientSearch 側の安全文言二重実装はない。
- `apps/web/app/patients/patient-search.test.tsx` は WP-4037 / WP-4038 / WP-4041 の該当挙動を個別テストで固定済み。`Plans.md` の未完了候補を現行実装で解消済みに更新。コード変更なし。
- 検証: `pnpm --filter @yrese/web test` PASS(33)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4023 PatientHeader eligibility status type convergence

- DB-005 commit_request 待ちの interim として、既存 backlog のうち SSOT/DB migration に触れない WP-4023 を実施。
- `apps/web/app/components/patient-header.tsx` の `EligibilityDisplayStatus` ローカル union を削除し、`@yrese/contracts` の `EligibilityStatus` alias へ変更。資格状態の値集合は contracts/shared-kernel 正本、表示文言は引き続き web の `ELIGIBILITY_LABELS` が唯一の正。
- 検証: `pnpm --filter @yrese/web typecheck` PASS、`pnpm --filter @yrese/web test` PASS(33)、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4042 /whoami contract and OpenAPI coverage decision closure

- self-scan で WP-4042 の現状を再確認。現行 `@yrese/contracts` は `whoamiResponseSchema` / `WhoamiResponse` を持ち、`packages/contracts/src/index.ts` から export 済み。`apps/api/src/server.ts` の `/whoami` は `whoamiResponseSchema.parse()` を通して返す。
- `packages/contracts/src/openapi.ts` と generated `docs/api/openapi.yaml` に `/whoami` / `WhoamiResponse` が含まれることを確認。route print でも `/whoami` が登録済み。
- `Plans.md` の WP-4042 を現行実装で解消済みに更新。コード変更なし。
- 検証: `pnpm --filter @yrese/contracts test` PASS(66)、`pnpm check:openapi` PASS、`pnpm --filter @yrese/api exec tsx -e ...server.printRoutes()` PASS、`git diff --check` PASS。

### WP-4059 PostgreSQL reception integration test load-bearing narrowing

- agmsg inbox 空、HEAD=origin/main=`c8ec0df`、worktree clean から再開。Claude へ、返信待ちの間は SSOT/DB migration 方針に触れない test-only WP-4059 を読む旨を通知。
- `apps/api/src/db/postgres-repositories.integration.test.ts` の受付冪等性ケースに `expectReceptionEntryResult()` helper を追加。`created` / `existing` を期待する場面で `idempotency_conflict` や別 kind が返った場合は即時 throw し、entry 比較から型上の逃げ道を削除した。
- 実装コード・migration・契約・SSOT本文は変更なし。`TEST_DATABASE_URL` 不在時は PostgreSQL 統合テスト本体が skip されるため、型検査で narrowing が成立することを検証の中心にした。
- 検証: `pnpm --filter @yrese/api typecheck` PASS、`pnpm --filter @yrese/api test` PASS(53 PASS + 3 SKIP)、`git diff --check` PASS。

### WP-6003 pure core AWS boundary non-static import regression coverage

- agmsg で WP-6001 REVIEW_RESULT(CHANGES_REQUIRED、formalize は fable5 側)と WP-6002 の位置づけを再確認。WP-6002 は `c18d50d` で push 済み、inbox は空、monitor bridge は `yrese/codex` alive、worktree clean から再開。
- self-scan で、WP-6002 の checker 本体は `require()` / dynamic `import()` / `export ... from` も抽出する一方、回帰 fixture は static import 中心であることを確認。純粋コアへの AWS/DynamoDB 混入を non-static 経路でも固定する scripts-only 追補として WP-6003 を追加。
- 実装: `scripts/check-scripts.mjs` に pure core `trace` fixture を追加し、`require('aws-sdk')`、`import('@aws-sdk/client-dynamodb')`、`export * from 'dynamodb-toolbox'` が `check-boundaries` で拒否されることを固定。アプリ本体・SSOT本文・WP-6001 proposal は変更なし。
- 台帳: `Plans.md` に WP-6001 / WP-6002 の現状と WP-6003 の完了を追記。
- 検証: `pnpm test:scripts` PASS、`pnpm check:boundaries` PASS、`pnpm check:secrets` PASS、`git diff --check` PASS。

### WP-4056 API repository mode explicitness and in-memory startup guard

- fable5 PLAN_APPROVED に基づき、API 起動時の暗黙 in-memory fallback を廃止する方針で実装中。`YRESE_API_REPOSITORY_MODE` を明示 repository mode とし、許可値は `postgres` / `in_memory` のみ。`DATABASE_URL` がある場合は `postgres`、`DATABASE_URL` 不在時は `YRESE_API_REPOSITORY_MODE=in_memory` の明示がある場合だけ in-memory 起動を許可する。
- `YRESE_API_REPOSITORY_MODE=in_memory` は `NODE_ENV=production` で起動拒否。未知の mode、`postgres` 明示かつ `DATABASE_URL` 不在、`in_memory` 明示かつ `DATABASE_URL` ありは fail-closed。
- dev 起動は `pnpm --filter @yrese/api dev` が `YRESE_API_REPOSITORY_MODE=in_memory tsx src/main.ts` を使うため、開発時は明示 in-memory mode で起動する。永続化期待環境では `DATABASE_URL` を設定して PostgreSQL repository を使う。
- 検証: `pnpm --filter @yrese/api test` 53 PASS + 3 SKIP、`pnpm --filter @yrese/api typecheck` PASS、`pnpm -r typecheck` PASS、`pnpm check:boundaries` PASS、`pnpm test` PASS。`pnpm --filter @yrese/api dev` は明示 `YRESE_API_REPOSITORY_MODE=in_memory` 経由で起動開始を確認し、確認後に停止。

### WP-1101 DOM-001..004 APPROVED 昇格と opus4.8 指摘是正

- Claude側 fable5 から commit_request を受領し、対象7文書のみを stage して `99e84c2` として commit/push。対象は `docs/domain/bounded_contexts.md`、`docs/domain/domain_model.md`、`docs/domain/ubiquitous_language.md`、`docs/domain/state_transition.md`、`docs/modules/shared_type_registry.md`、`docs/modules/status_registry.md`、`docs/ssot_index.md`。
- DOM-001〜004 を APPROVED へ昇格。DOM-002 に Reception 集約を追加し、branded ID は実装済み12種(ReceptionId含む)へ同期。Reception の冪等性境界は API-006 を正本として再定義しない方針に整理。
- DOM-001 は C8 Billing の独立維持(ACC-001〜011 が正本)を明記し、C12/C13 の正本参照を補強。DOM-003 は受付用語と DOM-004 状態名(RECEIVED_PROVISIONAL / IMPORTED_PROVISIONAL)を統一。DOM-004 は受付キュー副状態機械(RECEPTION_STATUSES)とライフサイクル状態所有権を追記。
- MOD-004(shared_type_registry)を 0.1.2 へ、MOD-005(status_registry)を 0.1.4 へ改版し、DOM昇格に伴う共有型・状態台帳のdriftを是正。`docs/ssot_index.md` は168文書で再生成済み。
- 検証: `git diff --check` PASS、`pnpm check:ssot-index` PASS、`pnpm check:secrets` PASS、`pnpm check:boundaries` PASS、`pnpm check:calculation-purity` PASS、`pnpm test:scripts` PASS、`pnpm check:deps` PASS、`pnpm check:openapi` PASS、`pnpm check:sbom` PASS、`pnpm -r typecheck` PASS、`pnpm -r test` PASS、`pnpm build` PASS、`pnpm lint` PASS。

## 2026-07-09(続き)

### WP-5003 患者・受付 Repository DB 実装差し替え

- fable5 PLAN_APPROVED に基づき、`docs/domain` と `docs/modules` の MOD-004/005 には触れず実装。`ELIGIBILITY_STATUSES` は contracts ローカル tuple から shared-kernel 正本へ移し、`RECEPTION_STATUSES` と同じくDB CHECK値源として扱う。`scripts/check-boundaries.mjs` / `check-scripts.mjs` も正本移動に合わせて更新。
- DB migration: `migrations/000002_create_patient_and_reception_tables.sql` を追加。`patients` / `reception_entries` は DB-001 規約どおり tenant_id + pharmacy_id を必須化。`accepted_at` は TIMESTAMPTZ、`business_date` は DATE。`reception_entries` は `(tenant_id, pharmacy_id, idempotency_key)` unique、queue index は `(tenant_id, pharmacy_id, business_date, accepted_at, reception_id)`。監査・会計・イベント系 append-only テーブルは未作成(WP-5004/5005へ分離)。
- DB Repository: `PostgresPatientRepository` / `PostgresReceptionRepository` を追加。既存 interface は不変、in-memory は既定維持。`DATABASE_URL` 設定時のみ API 起動時の schema check 後に PostgreSQL 実装を注入し、startup check は引き続き自動適用なし。
- テスト: migration DDL の CHECK 値が shared-kernel tuple と一致すること、PostgreSQL 統合テスト(TEST_DATABASE_URL gate)で patient search/find、tenant/pharmacy不可視、reception create/list、冪等再送 existing、idempotency conflict、JST business_date、accepted_at+reception_id 安定順序を検証するテストを追加。ローカル環境では `TEST_DATABASE_URL`・`docker`・`psql` が不在のため実DB統合は明示 skip。
- 検証: `pnpm --filter @yrese/api test` 48 PASS + PostgreSQL integration 3 SKIP、`pnpm --filter @yrese/api typecheck` PASS、`pnpm --filter @yrese/contracts test` 66 PASS、`pnpm --filter @yrese/shared-kernel test` 23 PASS、`pnpm -r typecheck` PASS、`pnpm -r test` PASS、`pnpm build` PASS、`pnpm check:openapi` PASS、`pnpm check:ssot-index` PASS、`pnpm check:secrets` PASS、`pnpm check:boundaries` PASS、`pnpm test:scripts` PASS、`pnpm lint` PASS、`pnpm check:deps` PASS、`pnpm check:sbom` PASS、`pnpm check:calculation-purity` PASS、`git diff --check` PASS。

### WP-5002 開発 PostgreSQL + マイグレーション基盤

- fable5 PLAN_APPROVED に基づき、既製 migration tool ではなく repo-local forward-only SQL runner + `pg` を採用。DB-002 の3分類照合(前方互換な DB 先行は許容 / checksum相違・未適用要求は起動拒否)を直接実装し、起動時は照合のみで自動適用しない方針にした。
- 実装: `compose.yaml` に dev PostgreSQL(`127.0.0.1:55432`)を追加し、PHI/PII/本番薬局データ投入禁止をコメントで明示。`migrations/000001_create_schema_migrations.sql` は履歴テーブルのみで、業務テーブルは WP-5003 以降へ分離。
- `apps/api/src/db/**` に migration loader、checksum、state reconciliation、explicit apply CLI(`pnpm db:migrate`)、startup check CLI(`pnpm db:check`)を追加。`DATABASE_URL` がある API 起動時は `assertMigrationStateAllowsStartup` のみ実行し、未適用 migration は fail-closed にする。
- 既存 `BuildServerOptions` の `patientRepository` / `receptionRepository` injection seam を維持し、既存テストは in-memory 既定のまま。PostgreSQL 統合テストは `TEST_DATABASE_URL` 不在時に skip 名を表示する `describe.skip` にし、silent pass にしない。
- 検証: `pnpm --filter @yrese/api test` 47 PASS + PostgreSQL integration 1 SKIP(`TEST_DATABASE_URL` 不在)、`pnpm --filter @yrese/api typecheck` PASS、`pnpm -r typecheck` PASS、`pnpm -r test` PASS(全体 47+1 skip を含む)、`pnpm build` PASS、`pnpm check:openapi` PASS、`pnpm check:secrets` PASS、`pnpm check:deps` PASS、`pnpm check:sbom` PASS、`pnpm check:boundaries` PASS、`pnpm check:ssot-index` PASS、`pnpm check:calculation-purity` PASS、`pnpm test:scripts` PASS、`git diff --check` PASS。`docker` CLI 不在のため compose 起動と実 PostgreSQL 統合テストは未実行。

### WP-4046 API ID wire-field validation policy

- fable5 裁定: wire ID は素の string を維持しつつ、受付系と同じ検証水準(非空・空白のみ拒否・制御文字拒否・妥当な max 長)を全契約で統一。
- 実装: `@yrese/contracts` に shared-kernel branded ID factory 由来の共通 `wire-id` schema を追加。`patientSearchResultSchema.patientId`、`whoamiResponseSchema.tenantId/pharmacyId/actorId`、受付キューの `receptionId` / `patientId` を同一 helper へ寄せ、contracts ローカルの ID 規則再発明を避けた。
- API-001 / API-006 / MOD-012 / MOD-001 を改版。OpenAPI には対象 ID field の `maxLength: 128` を generator 経由で反映。wire shape は string のまま変更なし。
- 検証: `pnpm --filter @yrese/contracts test` 66 tests PASS、`pnpm --filter @yrese/contracts typecheck` PASS、`pnpm --filter @yrese/api test` 40 tests PASS、`pnpm --filter @yrese/api typecheck` PASS、`pnpm check:openapi` PASS、`pnpm check:ssot-index` PASS、`pnpm check:boundaries` PASS、`pnpm -r typecheck` PASS、`git diff --check` PASS。

### WP-4053 reception business date JST boundary

- fable5 から WP-4053-UI commit_request と WP-4053-API assign を受領。UI側は `todayAsIsoDate()` を `Asia/Tokyo` 固定にする Claude 差分を `49fb867` として commit/push 済み。
- API側実装: `apps/api/src/reception-repository.ts` の `acceptedAt` → `record.date` 導出を JST 固定の業務日付へ変更し、UTC 日付(`toISOString().slice(0,10)`)の流用を廃止。`server.test.ts` に JST 00:00〜08:59 境界(UTCでは前日)の受付がJST業務日のキューへ入るテストを追加。
- MOD-011(date_time_policy)を v0.1.1 へ改版し、業務日付は薬局ロケール(MVPでは `Asia/Tokyo` 固定)の暦日、UTC日付流用禁止を明記。
- 検証: `pnpm --filter @yrese/api test` 40 tests PASS、`pnpm --filter @yrese/api typecheck` PASS、`pnpm check:ssot-index` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-5001 DB設計 SSOT パック

- Claude側 fable5 起草の DB-001〜004 を Codex 側 commit/push 対象として受領。初回 PROPOSED commit 後、opus4.8 レビュー反映により `docs/database/db_schema_design_standards.md`、`db_migration_policy.md`、`db_tenant_isolation_ddl_policy.md`、`db_retention_and_deletion_policy.md` は v0.1.1 APPROVED へ昇格。
- 要旨: DB-001 は tenant/pharmacy 必須・money/date型・enum二重実装禁止・ScaledDecimal scale保持、DB-002 は前方一方向+3段適用+明示運用操作+起動時照合3分類(前方互換な DB 先行は許容 / checksum相違・未適用要求は起動拒否)、DB-003 はテナント分離DDL/Repository方針(通常系接続でテナント越え不可を要件化、RLS採用はBLOCKED_SECURITY_REVIEWまで候補)、DB-004 は保存期間・削除方針(年限未確定は削除しない側に倒す)。
- 検証: `pnpm check:ssot-index` PASS、`git diff --check` PASS。

### WP-4052 web typecheck prebuild reproducibility

- fable5 裁定: WP-4052 は frontend/tooling 領域として Codex 実装可。clean checkout でも `pnpm --filter @yrese/web typecheck` が単独 PASS することを目的に実施。
- 実装: `apps/web/package.json` の `typecheck` を `next typegen && tsc --noEmit` へ変更。Next.js 15 の `.next/types` 生成を型検査前に実行し、`apps/web/tsconfig.json` の `.next/types/**/*.ts` include は推奨構成として維持。UIコード、webpack extensionAlias、実行時設定は不変更。
- 検証: `pnpm clean` で生成物を削除後、`pnpm --filter @yrese/web typecheck` PASS(Next route types 生成確認)、`pnpm -r typecheck` PASS、`pnpm --filter @yrese/web test` 32 tests PASS、`pnpm check:ssot-index` PASS、`pnpm check:boundaries` PASS、`pnpm build` PASS、`git diff --check` PASS。

### WP-3009 完結・commit/push 運用変更

- WP-3009 SCR-001 受付ダッシュボード実体化が完結。API-006 受付キュー契約 APPROVED(30f09a3) → backend 実装(WP-3009-BE/93aefa1: shared-kernel ReceptionId / RECEPTION_STATUSES / RCV-0001〜0003 / contracts+OpenAPI / apps/api) → frontend 実装(WP-3009-UI/8bdee8a: 受付ダッシュボード UI)の3段を完了。
- WP-4049/911e009 + follow-up 0282410 で、MOD-001/002/012 と API-006 の実装状態を受付キュー実装後の実態へ同期。要件・規律・wire 形状は不変更。fable5 レビュー APPROVED。
- 検証証跡: web 32 tests / api 39 tests / contracts 43 tests を含む `pnpm -r test` PASS、`pnpm lint` PASS、`pnpm build` PASS、`pnpm -r typecheck` PASS。初回 typecheck は build 前の `.next/types` 未生成で TS6053 失敗したため、WP-4052 として再現性改善候補を Plans.md に登録(f6581cb)。
- 運用変更(ユーザー指示 2026-07-09 / fable5通知): 以後、git commit と push は Codex 側が実行する。Claude 側の変更は `[commit_request]` として対象ファイル・commit message・検証結果を Codex へ渡し、Codex が対象ファイルのみ stage して検証後に commit & push する。Claude 側変更の commit には `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` を併記する。

### データベース構築計画の立案(ユーザー指示)

- ユーザー指示3件: (1)「各種データベースの構築計画立案を開始」、(2) 医療機関・薬剤など他のマスター DB の個別台帳化、(3) 漏れの網羅確認
- `docs/plan/database_construction_plan.md`(PLAN-DB-001、PROPOSED)を起案: 種別台帳12種(業務OLTP / イベントストア / 監査 / マスター群 / Edge / 同期キュー / 検索分析 / 帳票文書 / 請求成果物 / 外部連携記録 / 認証テナント / アーカイブ法定保存)+ マスター個別台帳 M1〜M10(医薬品・一般名・点数・医療機関・医師・保険者・公費・用法・薬局内・安全性系[BLOCKED])+ 対象外3(電子薬歴=外部面 / 在庫=non-MVP / 安全性DB)
- 横断原則: アプリ層テナント分離が正 / 浮動小数点カラム禁止 / DB now() 業務使用禁止 / append-only の DDL/DCL 化 / 前方一方向マイグレーション(明示操作のみ)
- 段階計画 DB-0〜DB-5(WP-5001〜5008 を Plans.md 登録)。本番インフラ製品確定は SEC-008 §3 + 人間承認の独立ゲート
- WP-3009-BE(受付バックエンド、93aefa1)レビュー APPROVED — 全10ワークスペース 252 テスト・全ゲート PASS。WP-3009-UI(受付ダッシュボード)フォーク実行中

### WP-4019 — OpenAPI generation pipeline

- fable5 PLAN_APPROVED 後に codex 実装。`@yrese/contracts` の zod schema を正本として `zod-openapi` で OpenAPI 3.1 YAML を生成する pipeline を追加。
- 生成物は `docs/api/openapi.yaml` にコミットし、`GENERATED - DO NOT EDIT` / 手編集禁止 / 再生成コマンド / 生成ツール版をヘッダに記録。`pnpm generate:openapi` で生成、`pnpm check:openapi` で再生成ドリフトを `GENERATED_CODE_DRIFT_BLOCKED` として検出する。
- CI に OpenAPI drift check を追加し、`scripts/check-scripts.mjs` にドリフト検出の回帰テストを追加。MOD-014 `generated_code_policy.md` は v0.1.1 に改版し、OpenAPI は zod schema 正本 + `zod-openapi` 方式へ確定。generated client は未導入として分離。
- 検証予定: contracts test/typecheck、openapi generate/check、script harness、全体 typecheck/test/build、deps/sbom、boundaries、ssot-index、diff check。

### WP-4034 — calculation StepResult runtime shape guard

- fable5 PLAN_APPROVED 後に codex 実装。`@yrese/calculation` の `rule.apply()` 戻り値に runtime shape guard を追加し、型を迂回した不正 `StepResult` を曖昧な TypeError ではなく `BLOCKED` / `SSOT_UPDATE_REQUIRED` として fail-closed に返すようにした。
- probe で判明した `{ status: "SKIPPED" } as any` に加え、`ITEM_CALCULATED` の `applicationKey` 欠落、`BLOCKED` の `blocker` 欠落を否定テストで固定。warning は `算定ルール戻り値SSOT不一致(SSOT_UPDATE_REQUIRED)` に統一。
- 既存の算定ルール、点数値、正常系 trace/golden は変更なし。正常系16本を含む calculation 19テストが PASS。
- 検証: `pnpm --filter @yrese/calculation test`(19 tests PASS)、`pnpm --filter @yrese/calculation typecheck`、`pnpm -r typecheck`、`pnpm check:boundaries`、`pnpm check:ssot-index`、`git diff --check`。

### UI/UX 開発計画の起案(ユーザー指示)

- ユーザー指示2件: (1) UI 構築時は The Component Gallery(component.gallery)を活用する(メモリにも保存)、(2) fable5 が UI/UX の今後の開発計画を緻密に立案する
- `docs/plan/uiux_development_plan.md`(PLAN-UIUX-001、PROPOSED)を起案: UIX-001〜007 と画面台帳 SCR-001〜029 を基に Phase UI-1(デザイン基盤)〜UI-6(請求線)の6波を定義。契約 SSOT なしに画面を作らない fail-closed 発行条件、U4 画面の opus4.8 医療安全レビュー必須、component.gallery 参照規律を組込み
- Plans.md に WP-3006〜3021 を登録。第1弾は WP-3006(トークン+状態コンポーネント)/ WP-3007(SCR-013 横断表示)/ WP-3011(trace ビューア)
- codex: WP-4033(money RoundingMode ガード、ef978d4)/ WP-4022(date-time nominal brand、6f04722)いずれもレビュー APPROVED(money 12・date-time 8 テスト、全 typecheck PASS)

### WP-4022 — date-time clinical wrapper nominal brands

- fable5 PLAN_APPROVED 後に codex 実装。`@yrese/date-time` の PrescriptionDate / DispensingDate / ReceptionDate を nominal brand 化し、異種ラッパーの `compare()` / `equals()` と代入を型で拒否するようにした。
- 実行時挙動は維持。既存コード調査では本番側に意図的な異種ラッパー比較はなく、旧テスト内の異種比較だけを同種比較+`@ts-expect-error` 型テストへ置換。
- MOD-004 `shared_type_registry.md` を v0.1.1 へ改版し、日付ラッパー nominal brand の open question を解消済みに移動。
- 検証: `pnpm --filter @yrese/date-time test`(8 tests PASS)、`pnpm --filter @yrese/date-time typecheck`、`pnpm -r typecheck`、`pnpm check:boundaries`、`pnpm check:ssot-index`、`git diff --check`。

### WP-4033 — @yrese/money RoundOptions.mode runtime guard

- fable5 PLAN_APPROVED 後に codex 実装。MOD-010 の RoundingMode 7種と一致する `ROUNDING_MODES` const tuple を追加し、`RoundingMode` 型を tuple から派生させて runtime allow-list と型の値源を単一化。
- `ScaledDecimal.round()` で `options.mode` を明示検証し、`invalid_mode` や `mode` 欠落は `RangeError` で fail-closed。既存の丸め結果・政策値/evidence 規律は変更なし。
- 既存テストで全 mode の代表値を固定済みであることを確認し、`ROUNDING_MODES` の値順と invalid/missing mode の否定テストを追加。
- 検証: `pnpm --filter @yrese/money test`(12 tests PASS)、`pnpm --filter @yrese/money typecheck`、`pnpm -r typecheck`、`pnpm check:boundaries`、`git diff --check`。

### SSOT 第3波(WP-0046/0047)

- WP-0046: API-first platform pack — API-002(dogfooding: 自社 UI も公開 API と同一契約のみ、抜け道 API 禁止)/ API-003(公開 API 共通土台: deny-by-default・テナント境界・バージョニング。数値は BLOCKED_PERFORMANCE_SLO)/ API-004(PH-OS リファレンス連携、特別扱い API 禁止)/ API-005(OSS 公開 allow-list、実公開は BLOCKED_LEGAL_REVIEW + 人間最終承認)。全て PROPOSED
- WP-0047: SEC-008 — 監査 WORM・テナント分離戦略。論理層(append-only・SEC-007 ハッシュチェーン・偽ハッシュ供給禁止の規律化)と物理層候補(S3 Object Lock/KMS/RLS = 追加防御)を分離、break-glass は監査必須 fail-closed。PROPOSED
- ssot_index 再生成: 161文書。check:ssot-index / boundaries PASS
- codex: WP-4032(events 実行時ガード強化、d665c06)レビュー APPROVED — enum 値源を const tuple に単一化、events 31テスト PASS

### WP-4032 — EventEnvelope ID / enum runtime guard

- fable5 PLAN_APPROVED 後に codex 実装。`@yrese/events` の `SyncStatus` / `PhiClassification` / `EncryptionStatus` を既存 union literal と同じ値の exported const tuple から派生させ、runtime allow-list と型の値源を単一化。
- `createEventEnvelope()` で eventId / tenantId / pharmacyId / deviceId / actorId / causationId / correlationId / aggregateId / aggregateType / idempotencyKey の空白のみ・制御文字を拒否。`syncStatus='lost'`、`phiClassification='bad'`、`encryptionStatus='plain'` は fail-closed に拒否する否定テストを追加。
- PHI≠none→encrypted と dead-letter reason の既存不変条件は維持。
- 検証: `pnpm --filter @yrese/events test`(31 tests PASS)、`pnpm --filter @yrese/events typecheck`、`pnpm -r typecheck`、`pnpm check:boundaries`、`git diff --check`。

### codex autonomous scan — trace / money follow-up candidates

- agmsg 未読なしを確認後、read-only スキャンを継続。`@yrese/trace` の runtime enum/kind guard 補強候補(WP-4039)と、`@yrese/money` constructor 入力型ガード候補(WP-4040)を `Plans.md` へ登録。
- 既存の WP-4033(rounding mode guard)とは別に、trace の target/kind drift と money constructor の不明瞭 TypeError 化を後続 triage 対象に分離。
- 追加スキャンで PatientSearch の資格状態表示が PatientHeader より安全含意の弱い文言になっている点を検出し、frontend owner確認待ち候補 WP-4041 として `Plans.md` へ登録。

### SSOT 第1〜2波 opus4.8 レビュー → 一括 APPROVED(WP-0052/0053)

- opus4.8 レビュー3系統(doctrine 6 / FHIR 3 / calc・quality 9)完了。BLOCKER 1件(PRD-007 の source_registry 未記録日付)、MAJOR 5件(ARC-010 の OPS-005/009 取り違え、QUA-009 の RCP→CLM 委譲先取り違え、DOM-005 の MOD-009 誤参照、DOM-006 台帳の §7 必須フィールド欠落、新規ブロッカーコード2種の allow-list 未登録)、ほか MINOR 群
- WP-0052: 指摘を11ファイルで是正(各文書 v0.1.1 化、blockers.ts に BLOCKED_OFFICIAL_ADAPTER_BOUNDARY / BLOCKED_FHIR_CONFORMANCE_REVIEW 追加、MOD-005 status_registry 31→33種 v0.1.2)
- WP-0053: 18文書(PRD-007/008/009、ARC-003〜007/010/011、DOM-005/006、CAL-009〜011、QUA-007〜009)を APPROVED へ昇格(approved_by: opus4.8 review + fable5)。索引再生成、shared-kernel 22テスト・boundaries・ssot-index・全 typecheck PASS
- codex 並行: WP-4031 APPROVED。WP-4032〜4036 を codex が直接登録(CLAUDE.md/AGENTS.md に直接 commit&push 規定追記 f4ad019 — codex 経由のユーザー指示と報告)
- 次: WP-4032(events の PHI enum ガード優先)→ WP-4022 を codex へ。Claude 側は第3波(WP-0046/0047)起草へ

### WP-4031 — CAL-008 trace optional extension fields

- codex実装。`@yrese/trace` の `CalculationTraceStep` に CAL-008 の optional 拡張フィールド(`feeItemCode` / `formula` / `intermediateValues` / `rounding` / `stepStatus` / `resultPoints` / `resultYen`)を追加。
- 後方互換性を維持し、既存の最小 trace は変更なしで通る。`affectsClaim=true → evidenceRefs>=1` の既存不変条件は維持。`rounding.evidenceId` 必須、intermediateValues string-only/PHI-like key拒否、stepStatus enum検証、nested freeze、rounding evidenceId集約を追加。
- 検証: `pnpm --filter @yrese/trace test`(11 tests PASS)、`pnpm --filter @yrese/calculation test`(16 tests PASS)、`pnpm -r typecheck`、`pnpm check:boundaries`、`git diff --check`。

### WP-4029 — patient search cursor length cap

- codex実装。`@yrese/contracts` に `PATIENT_SEARCH_CURSOR_MAX_LENGTH = 512` を追加し、query cursor / response nextCursor の最大長を契約層で固定。
- API route でも長大 cursor は backend decode 前に 400 `PAT-0001` となることをテストで固定。API-001 文書へ同じ上限を追記し、fable5承認条件に従い API-001 version を 0.2.1 へ更新。
- 検証: `pnpm --filter @yrese/contracts test`(21 tests PASS)、`pnpm --filter @yrese/api test`(30 tests PASS)、contracts/api typecheck、`pnpm check:boundaries`、`git diff --check`。

### WP-4024 — audit runtime guard negative tests

- codex実装。WP-2003 opus4.8 レビューのLOW指摘に対応し、既存のauditランタイムガードを否定テストで固定。
- `targetRef` 空/制御文字/非snake_case、invalid outcome、malformed `businessReason.code`、missing `correlationId` を追加カバー。実装コード変更なし。
- 検証: `pnpm --filter @yrese/audit test`(28 tests PASS)、`pnpm --filter @yrese/audit typecheck`、`pnpm check:boundaries`、`git diff --check`。

### WP-4021 — dev patient search fixture alignment

- codex実装。Web側の既定DEV_HEADERS(`t-dev` / `ph-dev` / `u-dev`)を変更せず、API synthetic fixture に同じdevテナントの非PHI合成患者2件を追加。
- `/patients/search?q=合成` をWeb既定devヘッダで呼ぶroute-level APIテストを追加し、開発UIの手動確認で空結果にならないことを固定。
- 検証: `pnpm --filter @yrese/api test`(29 tests PASS)、`pnpm --filter @yrese/api typecheck`、`pnpm check:boundaries`、`git diff --check`。

### WP-4030 — dev tenant context malformed ID route tests

- codex自律バックログから実施。`apps/api/src/server.test.ts` に `/whoami` と `/patients/search` の不正 dev ID ヘッダ否定テストを追加。
- 空白 `x-dev-tenant`、制御文字入り `x-dev-pharmacy`、制御文字入り `x-dev-actor` は route 経由で 403 `AUTH-0003` となることを固定。`tenant-context` 実装は既に fail-closed のため変更なし。
- 検証: `pnpm --filter @yrese/api test`(28 tests PASS)、`pnpm --filter @yrese/api typecheck`、`pnpm check:boundaries`、`git diff --check`。

### SSOT 第1波(WP-0041/0042/0043)+ 索引整合性修復(WP-0051)

- WP-0041(6cd714e): yrese doctrine pack — PRD-008 製品ドクトリン D1〜D7 / PRD-009 4つの戦い / ARC-003 NSIPS隔離ACL / ARC-004 Legacy Adapter S3/Lambda 方針。全て PROPOSED
- WP-0042(4482e1e): FHIR canonical pack — DOM-005(canonical model ≠ FHIR、facade投影・PHI整合)/ DOM-006(マッピング台帳枠組み、Official Adapter 置換禁止 = BLOCKED_OFFICIAL_ADAPTER_BOUNDARY)。PRD-007 とセットで承認予定
- WP-0043(cc47d59): quality transparency pack — QUA-007/008/009(証明可能性4層・公開KPI前提条件・返戻率 fail-closed 集計)。外部公開実施は BLOCKED_LEGAL_REVIEW 解除まで BLOCKED
- **WP-0051: ssot_index.md に約50文書が未登録という整合性欠陥を検出**(accounting/calculation/domain/jahis/receipt/api/spec 等が Phase 0 ゲート後の索引更新漏れ)。frontmatter からの機械再生成で全148文書を索引化(IDX-001 v0.3.0)。以後、索引は手編集禁止。CI ゲート化は WP-4020(codex へアサイン予定)
- codex: WP-0050(AGENTS.md ミラー、8970be8)/ WP-4018(web test gate、b800ab2)APPROVED。自律スキャン提案 WP-4019/4021/4022 をバックログ登録
- **WP-2003 opus4.8 事後レビュー完了: APPROVED**(audit 17テスト・全10ワークスペース typecheck・boundaries 全て PASS、台帳60種別を MOD-008 と1件ずつ照合し完全一致)。LOW 2件: (1) entryHash の計算・連続性未検証は WP-2009 の範囲 — 完了まで本番配線で任意ハッシュ供給禁止を申し送り、(2) 実行時ガードの否定テスト補強 → WP-4024 として登録
- 進行中: WP-0044/0045 第2波起草フォーク、codex WP-4020(ssot_index CI ゲート)

### SSOT 第2波(WP-0044/0045)+ codex 横断ゲート群の統合

- WP-0044: calculation event-sourcing pack — CAL-009(versioned rule data、silent 変更禁止)/ CAL-010(純粋関数規律)/ CAL-011(golden test は evidence_id 由来のみ)/ ARC-005(ES は履歴が正本であるべき集約に限定、既定非適用)/ ARC-006(イベントが正本・投影は使い捨て、再算定は新イベント追記)/ ARC-007(確定レセプト append-only、訂正は返戻再請求レーン、確定は NORMAL のみ)。全て PROPOSED
- WP-0045: always-on pack — ARC-010(Cloud Core / Edge Node 役割分担、SystemMode 5態と shared-kernel 判定関数の整合)/ ARC-011(夜間バッチ廃止、月次締めは明示業務操作)。PROPOSED
- ssot_index 再生成: 156文書(IDX-001 v0.3.0 系列)。codex の WP-4020 ゲート(`pnpm check:ssot-index`)が未索引8文書を正しく検出→再生成後 PASS を確認
- codex レビュー3件 APPROVED: WP-4020(c06c913、ssot_index CI ゲート)/ WP-4025(06c3c80、health clock 注入化)/ WP-4026(2c4758c、不正 PORT fail-fast)。api 22テスト PASS で検証
- 台帳整合(WP-4027): WP-4020 完了反映。codex 提案 WP-4028(純粋関数静的検査)/ WP-4029(cursor 上限)/ WP-4030(不正 dev ヘッダ否定テスト)をバックログ登録
- 一時保留(ユーザー操作)→「続きを実行」指示で再開

### WP-4018 — web test gate strictness

- `apps/web/package.json` の `test` から `--passWithNoTests` を削除し、webテストが誤って消えた場合に成功扱いにならないようにした。
- 既存の `apps/web/app/shell-smoke.test.tsx` が実テストとして存在することを確認し、WP-3005後の退行検知ゲートを厳格化。
- 検証: `pnpm --filter @yrese/web test`, `pnpm --filter @yrese/web typecheck`, `pnpm -r test`, `pnpm check:boundaries`, `git diff --check`。

### 構築プロンプト仕様の0.2.0一本化

- WP-0049: `docs/spec/construction_prompt_baseline.md` を0.2.0正本入口へ縮約し、過去版本文・版一覧・版間優先順位規定を削除。
- `docs/spec/construction_prompt_v0.2.0.md` を唯一の正本として、SSOT駆動、Claude/Codex二系統運用、共通モジュール、会計・領収証、JAHIS、Integration Hub、Open Rececon Platform、FHIR/JP Core、24/365稼働、監査WORM等を0.2.0へ集約。
- リポジトリ全体の構築プロンプト参照を v0.2.0 へ統一し、旧プロダクト呼称を yrese へ正規化。

### 17:00〜17:10 — マイルストーン: 初の evidence 裏付け算定コード(WP-2101b)

- **Phase 0 ゲート通過**(人間承認)→ 98 SSOT 一括 APPROVED(5fa3f14)
- WP-0017: evidence 71件正式採番、算定16行 EVIDENCE_ISSUED 化(8cf3f10)
- CAL-004 算定エンジン設計: fable5起案 → opus4.8 レビュー(APPROVE_WITH_CHANGES)→ 全指摘反映+register照合訂正(EVD-CAL-0021=3剤分まで)で v0.2.1 APPROVED(24adf71)
- **WP-2101b マージ(76da0d6)**: 5ルール(調剤基本料1=47点/内服薬剤調製料=24点上限3/調剤管理料2=10点/服薬管理指導料3=45点/夜間・休日等加算=40点)、POINTS_ONLY_COPAY_BLOCKED(claimable:false型強制)、適用日ガード(2026-06-01 inclusive)、重複・上限検知、golden 16テスト。opus4.8事後レビュー(APPROVE_WITH_CHANGES→境界通過側テスト2件+canonical golden 166点を追加して解消)
- copay(一部負担金)は evidence 未発行のため BLOCKED_REGULATORY_REVIEW 維持(点→円換算・負担割合・端数処理の根拠が必要)
- WP-1101 ドメイン設計SSOT 4文書(PROPOSED、Phase 1ゲート対象)f817dc2
- codex後続: WP-4011(スクリプト回帰ハーネス)→ WP-4013(重複レジストリスキャン拡充)を発行済み

## 2026-07-09

### 16:00〜16:35 — 第4〜5波: Phase 0 文書完成・算定骨格・codex自律スキャン・ゲート報告

- SSOT完成: WP-0008(UI/UX 7)4aa6595 / WP-0009(セキュリティ 7)bcdf89f / WP-0010(運用 14)ff145ae / WP-0011(プロセス・品質 11)008baec / WP-0012(共通モジュール 14)a257598 / WP-0013(ssot_index 97文書+品質3補完+ゲート報告)79edf9a
- WP-2101a 完了: @yrese/calculation 骨格(空ruleset→BLOCKED、複数CALCULATED→SSOT_UPDATE_REQUIRED ガードをレビュー往復で追加)d26424d
- WP-0015 完了: 一次資料精読(記録条件仕様R8.6 レコード体系一式+点数表約45項目、人間ダブルチェック待ち)0ef7ab3
- codex 自律スキャン運用開始(ユーザーがcodex側へ直接指示): バックログ5+2+1件提案 → WP-1008(dead-letter不変条件)/WP-4005(CI全build)/WP-4004(lint整合)5729ea7、WP-1010(**権限スコープ検証の実バグ修正**)/WP-4006(dist衛生)e51f920、WP-2006(認可回帰テスト)/WP-1009(エラーコードシード)b5e4f22 — すべてレビュー承認済み
- kernel.test.ts のリテラル制御文字混入(codex発見・WP-1011)を修正
- **Phase 0 ゲート報告を提出(docs/plan/phase0_gate_report.md)— 人間レビュー待ち。新規 WP_ASSIGN は一時停止、codex はバックログ提案のみ継続**
- 現時点: コミット40件超、テスト66+件全パス、CI グリーン、二系統WPフロー13件完走(CHANGES_REQUESTED 2件はいずれも安全側修正)

### 15:40〜15:55 — 実装第3波: 契約基盤・境界検査・SSOT量産・公式資料確定

- WP-1007 完了: @yrese/contracts(contract-first の器。health スキーマ移設、zod v4 z.iso.datetime)codex実装・claudeレビュー、7fa369c
- WP-3004 完了: 業務ルーティングシェル(業務順ナビ+8ルート、各プレースホルダーに解除条件明記)2b195b5
- WP-0005 完了: 規制・法令SSOT 6文書 c1fbad8 / WP-0006 完了: 医療安全・スコープSSOT 7文書 ae24ae6 / WP-0007 完了: 外部境界・マスターSSOT 6文書 50f988e
- WP-4003 完了: check-boundaries(依存方向・循環・重複const検査をCIへ。違反注入検出を実証)codex実装・claudeレビュー、0213ac0
- **WP-0014 完了(重要)**: 公式資料検証 — 全10項目 CONFIRMED。令和8年度改定実在(施行R8.6.1)、記録条件仕様(調剤)R8.6版が公開中、安全管理GL第7.0版・JAHIS Ver.1.11 実在(v0.2.0 の記載が正確、f2の旧情報を訂正)。オン資外部IF・電子処方箋記録条件は ONS 限定 → WP-0016(人間作業)f166bee
- WP-2002: codex実装 → claudeレビューで CHANGES_REQUESTED(本番起動拒否のバイパスオプション allowDevTenantContextInProduction の除去を要求 — セキュリティ規律)
- 進行中フォーク: f6=WP-0015(記録条件仕様・点数表の一次精読)、f7=WP-0008(UI/UX SSOT)、f8=WP-0009(セキュリティSSOT)

### 15:30〜 — ユーザー指示: fable5 全権コントロール・公式資料検索許可・完了まで継続

- ユーザー指示(原文趣旨): fable5 は全体コントロール役。必要に応じて公式資料をインターネット検索して最新情報を取得し、計画を修正して実装完了まで動き続ける。タスクの追加・削除・修正権限を持つ
- 運用への反映:
  - 公式資料(厚労省・支払基金・診療報酬情報提供サービス・デジタル庁等)のWeb調査を evidence_id 発行の正規手段として使用する(Priority A/B のみ実装根拠化、Priority C は補助)
  - BLOCKED_REGULATORY_REVIEW の解除は「公式ソースの版・適用日を source_registry に記録 → evidence_id 発行 → 該当SSOT APPROVED」の手順で行う
  - Plans.md のタスクは fable5 判断で随時追加・削除・修正する
- WP-1006 完了: @yrese/events(EventEnvelope、PHI≠none→encrypted必須、sha-256形式検証、bigint clock)codex実装・claudeレビュー、7テストパス、85bd3aa
- WP-1007 発行: @yrese/contracts(contract-first の器、healthスキーマ移設)→ codex
- フォーク2系統実行中: WP-0005 規制・法令SSOT / WP-0006 医療安全・スコープSSOT

### 15:20〜15:30 — 実装第2波: date-time / trace / CI / 患者ヘッダー

- WP-1004 完了: @yrese/date-time(CalendarDate 実カレンダー検証・うるう年、処方日/調剤日/受付日、ClaimMonth、現在時刻への暗黙依存なし)codex実装・claudeレビュー、8テストパス、ab234fe。レビューノート: 日付ラッパー3種が構造的に同型のため異種間compareが可能 → 算定エンジン接続時にnominal brand追加予定
- WP-1005 完了: @yrese/trace(CalculationTrace/LegalTrace/EvidenceRef。affectsClaim=trueのstepはevidenceRef必須=「evidence_idのない算定ロジック禁止」を型・実行時で強制。inputsSummaryは型設計でPHI排除。URLはコード禁止=source_registry管理)codex実装・claudeレビュー、6テストパス、ddc06a1
- WP-0004 完了: llm_capability_registry + codex_capability_verification(AGMSG_PROTOCOL_UNVERIFIED を実測により解除。CODEX_CAPABILITY_UNVERIFIED はモデルID・Cloud関連のみ継続)aa904f9
- WP-4001 完了: GitHub Actions CI(typecheck/test/build)初回グリーン49秒、2116587
- WP-3002 完了: PatientHeader(カナ併記・生年月日+年齢・資格確認状態のテキストラベル表示、PENDING_REVERIFY/LOCAL_ONLY可視化)1acfa3f
- WP-1006 進行中: @yrese/events(sync event envelope、PHI未暗号化拒否の不変条件)を codex へ WP_ASSIGN
- 二系統WPフロー4周目。競合ゼロ、レビュー指摘は軽微のみ

### 15:05〜15:20 — 実装第1波: scaffold + 共通モジュール + 両アプリ骨格

- WP-0003 完了: 二系統運用SSOT 15文書(docs/agents/、status PROPOSED)コミット 8d47d70。フォークの open_questions(Codexモデル名、agmsgルーム機能なし→[room]タグ代替等)は llm_capability_registry 作成時に反映予定
- WP-1001 完了: monorepo scaffold(pnpm workspaces + strict TS base)c81d6ca
- WP-1002 完了: @yrese/shared-kernel(branded ID / SystemMode / PENDING系status / BLOCKER種別 / エラーコード・権限スコープ基盤)テスト15件パス、9ab039e
- WP-2001 完了: @yrese/api scaffold(Fastify 5 + zod /health)— **codex実装・claudeレビュー承認**、58411c0。二系統WPフロー(WP_ASSIGN→CODEX_PLAN→承認→実装→WP_HANDOFF→レビュー→コミット)が一巡目から正常動作
- WP-3001 完了: @yrese/web scaffold(Next.js 15、全画面共通SystemModeBadge=色非依存の状態表示、フォーカスリング、受付ダッシュボードプレースホルダー)build+typecheckパス、12a5ac2
- WP-1003 完了: @yrese/money(bigint ScaledDecimal / Yen / Points、丸め政策値の配線はBLOCKED_REGULATORY_REVIEW明記)— codex実装・claudeレビュー(丸めロジックのbigint truncated-division整合を確認)、11テストパス、533f89a
- WP-1004 進行中: @yrese/date-time を codex へ WP_ASSIGN、CODEX_PLAN 承認済み
- 運用メモ: pnpm-lock.yaml は claude が一括コミット(codexはcommit禁止の取り決めが機能)

### 15:00 — agmsg 連携確立(Claude側⇄Codex側)

- チーム `yrese` を作成し `claude`(このセッション)が join。配信モード monitor(リアルタイム受信)
- Codex側 `codex` が join 済みを確認。挨拶メッセージ受信
- 連携プロトコルを送信: レーン分担(claude=仕様/SSOT/frontend、codex=backend)、WP_ASSIGN→CODEX_PLAN→実装→WP_HANDOFF、共有ファイルのロック、R3+高リスク領域のBLOCKED維持
- ユーザー指示: 「codexはclaudeと連携しながら動作。可能なら常に連絡を取り合い、タスクのやりとりをする。お互いを尊重して動作」

### 14:5x — セッション開始〜Phase 0 承認〜実装開始指示

- GitHub 公開リポジトリ作成: https://github.com/yusuketakuma/yrese(main、.claude/.omc/.harness-mem は gitignore)
- Phase 0 計画案 `docs/plan/phase0_plan.md` をコミット(d24ecac)。人間レビューで承認(「次に進む」)
- **能力検証(WP-0002)完了**:
  - Codex側: codex-cli 0.143.0(~/.agents/bin/codex)、ChatGPTログイン済み。モデル名「GPT-5.6 sol max」は【要確認】
  - agmsg: ~/.agents/skills/agmsg/scripts/ 稼働確認
  - Claude側 /ultracode: 本環境のマルチエージェントオーケストレーション(fork/Workflow)として利用可能
- WP-0003 起動: 二系統運用SSOT 15文書を fork で並列作成中(docs/agents/ 配下のみ、完了待ち)
- ユーザー指示により実装開始承認。Plans.md / State.md 運用開始、活動単位ごとにコミット&プッシュ
- 方針: R3+ 高リスク領域(算定点数の具体値・レセプト記録条件・Official Adapter)は公式根拠 evidence_id 確認まで BLOCKED。R0-R2 の基盤(scaffold・共通モジュール)から実装

### 次アクション

- WP-1001 monorepo scaffold(claude)
- WP-2001 apps/api scaffold を codex へ WP_ASSIGN(scaffold 完了後)
- WP-0003 フォーク成果(docs/agents/)の受領・コミット
