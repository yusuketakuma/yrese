# Plans.md — 調剤用レセプトコンピューター MVP タスク計画

構築プロンプト v0.1.7 / `docs/plan/phase0_plan.md` に基づく実行計画。
運用ルール: 活動単位ごとにコミット&プッシュ。活動ログは `State.md` に記録。
高リスク領域(R3+)は根拠(evidence_id)未確認のまま実装しない — 「根拠不足を正しく検知して止まるコード」を優先する。

## ステータス凡例

- `[ ]` TODO / `[~]` IN_PROGRESS / `[x]` DONE / `[!]` BLOCKED

## Phase 0: 調査・計画(ドキュメント)

- [x] WP-0001 Phase 0 計画書作成(docs/plan/phase0_plan.md)— 人間承認済み(「次に進む」)
- [x] WP-0002 実行モード・能力検証(codex CLI / agmsg / ultracode)
- [x] WP-0003 二系統運用・エージェント統率SSOT(docs/agents/ 15文書、status PROPOSED)— 8d47d70
- [x] WP-0004 llm_capability_registry / codex_capability_verification(実測検証反映、AGMSG_PROTOCOL_UNVERIFIED解除)(aa904f9)
- [x] WP-0005 規制・法令SSOT 6文書(GL6.0/7.0・JAHIS1.10/1.11の版差異を人間レビュー論点化)(c1fbad8)
- [x] WP-0006 医療安全+スコープSSOT 7文書(リスク33件、算定25行は全行BLOCKED+行単位解除手順)(ae24ae6)
- [x] WP-0007 外部境界・マスターSSOT 6文書(50f988e)
- [x] WP-0008 UI/UX・体験品質SSOT 7文書(4aa6595)
- [x] WP-0009 セキュリティSSOT 7文書(bcdf89f)
- [x] WP-0010 運用・移行・ガバナンスSSOT 14文書(ff145ae)
- [x] WP-0011 実装統率・品質SSOT 11文書(008baec)
- [x] WP-0012 共通モジュールSSOT 14文書(a257598)
- [x] WP-0013 ssot_index(97文書)+品質3文書補完+Phase 0ゲート報告(79edf9a)— **人間レビュー待ち**

Phase 0 文書は実装と並行して整備する(ユーザー指示により実装開始が承認済み)。
ただし R3+ 実装の根拠となるSSOTは該当実装より先に APPROVED にする。

## Phase 2: 実装(承認済み範囲から着手)

### 基盤(shared / R0-R1)

- [x] WP-1001 monorepo scaffold(pnpm workspaces / strict TS base)— c81d6ca
- [x] WP-1002 packages/shared-kernel: branded ID型(TenantId/PharmacyId/PatientId/PrescriptionId/ClaimId/EventId等)、システムモード(NORMAL〜RECOVERY_SYNC)、PENDING系status、BLOCKER種別、error/warning code registry型、permission scope型 + unit tests
- [x] WP-1003 packages/money: bigint ScaledDecimal / Yen / Points、丸めは明示パラメータのみ(政策値はevidence_id確認まで配線禁止)(codex実装・claudeレビュー、533f89a)
- [x] WP-1004 packages/date-time: CalendarDate/処方日・調剤日・受付日/ClaimMonth、現在時刻への暗黙依存禁止(codex実装・claudeレビュー、ab234fe)
- [x] WP-1005 packages/trace: evidence必須強制・PHI排除設計(codex実装・claudeレビュー、ddc06a1)
- [x] WP-1006 packages/events: EventEnvelope(PHI≠none→encrypted必須)(codex実装・claudeレビュー、85bd3aa)
- [x] WP-1007 packages/contracts: contract-first の器、healthスキーマ移設(codex実装・claudeレビュー、7fa369c)

### バックエンド(Codex側所有 / apps/api)

- [x] WP-2001 apps/api scaffold(Fastify 5 + zod healthcheck、codex実装・claudeレビュー、58411c0)
- [ ] WP-2002 認証認可・テナント分離の骨格(RBAC scope、tenant_id/pharmacy_id 強制)
- [ ] WP-2003 監査ログ骨格(audit event envelope、PHI非出力)
- [ ] WP-2004 患者・保険・公費ドメインCRUD(SSOT承認後)
- [x] WP-2008 患者検索APIバックエンド(API-001 v0.2.0、errorResponseSchema統合、PAT-0001、tenant/pharmacy/query拘束cursor、no-store)(codex実装・claudeレビュー、bb3d237)
- [!] WP-2101 算定エンジン(公式点数根拠 evidence_id 未確認 → BLOCKED_REGULATORY_REVIEW。純粋関数の骨格・trace配線のみ先行可)
- [!] WP-2102 電子レセプト生成(記録条件仕様未確認 → BLOCKED_REGULATORY_REVIEW)
- [!] WP-2103 Official Adapter 実装(ONS資料未確認 → BLOCKED_REGULATORY_REVIEW)

### フロントエンド(Claude側所有 / apps/web)

- [x] WP-3001 apps/web scaffold(Next.js 15 shell + SystemModeBadge、12a5ac2)
- [x] WP-3002 患者ヘッダーコンポーネント(apps/web内に配置。packages/ui化は第二利用者出現時 — shared肥大化防止)(1acfa3f)
- [ ] WP-3003 患者検索・受付ダッシュボードUI(API契約確定後)
- [x] WP-3004 画面群ルーティングシェル(業務順ナビ+8ルート、解除条件明記)(2b195b5)
- [x] WP-0014 公式資料検証リサーチ(全10項目CONFIRMED、施行日R8.6.1確定、記録条件仕様公開確認)(f166bee)

### 横断

- [x] WP-4001 CI(GitHub Actions: typecheck/test/build、初回グリーン。依存方向チェック等はSSOT承認後に追加)(2116587)
- [x] WP-4002 codex側委任フロー稼働(agmsg、WP_ASSIGN→CODEX_PLAN→承認→WP_HANDOFF→レビュー→コミットを3周完走)

## 直近の実行順序

1. WP-1001 scaffold → 2. WP-1002 shared-kernel → 3. WP-1003 money → 4. WP-1004 date-time → 5. WP-1005 trace → 6. WP-0003 フォーク成果コミット → 7. WP-1006/1007 → 8. apps scaffold(WP-2001/3001)→ 9. Phase 0 残ドキュメント並行整備

- [x] WP-4003 依存方向・重複定義チェック CI(違反注入検出を確認)(codex実装・claudeレビュー、0213ac0)
- [x] WP-2002 テナントコンテキスト/権限骨格(deny-by-default、本番無条件起動拒否 — レビュー往復でバイパス除去)(codex実装・claudeレビュー、40a2512)
- [x] WP-0015 一次資料精読(記録仕様レコード体系一式+点数約45項目。人間目視ダブルチェックが evidence_id 発行条件)(0ef7ab3)
- [x] WP-2101a 算定エンジン純粋関数骨格(空ruleset→BLOCKED、複数CALCULATED→SSOT_UPDATE_REQUIREDガード)(codex実装・claudeレビュー、d26424d)
- [ ] WP-0016 ONS登録手続き(人間作業依頼: オン資外部IF・電子処方箋記録条件の入手)

## Codex 自律スキャン backlog

Claude から新規 `WP_ASSIGN` がない場合、Codex はコードベースをスキャンし、実装可能な新規タスク候補をここへ追記する。
他エージェントの未追跡 `docs/**` は所有権不明のため触らず、コード・CI・契約境界を優先して候補化する。

- [x] WP-4004 root `lint` スクリプト整合化(5729ea7)
  - 発見根拠: root `package.json` に `lint: pnpm -r --parallel lint` があるが、現時点の `apps/*/package.json` / `packages/*/package.json` に `lint` script がない。
  - 目的: ルート検証コマンドが存在しないpackage scriptで失敗しないよう、lint方針をSSOT化するか、最小のrepo-local lint/check scriptを追加する。
  - 想定スコープ: `package.json`, 各workspace `package.json`, 必要なら `scripts/**`。
  - 検証: `pnpm lint`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4005 CI build対象をworkspace実態に合わせる(5729ea7)
  - 発見根拠: root `build` は `pnpm -r build` だが、`.github/workflows/ci.yml` は `@yrese/web` と `@yrese/api` だけをbuildしており、`packages/calculation` などpackages buildがCIで直接検証されない。
  - 目的: 新規packages追加時にCI build漏れが起きないよう、CIを `pnpm -r build` へ寄せるか、packages build stepを明示する。
  - 想定スコープ: `.github/workflows/ci.yml`。
  - 検証: `pnpm -r build`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-1008 packages/events dead-letter invariant hardening(5729ea7)
  - 発見根拠: `SyncStatus` は `dead_letter` を持つが、`createEventEnvelope()` は `syncStatus === 'dead_letter'` と `deadLetterReason` の同時必須をまだ強制していない。
  - 目的: Outbox実装前に、dead letter化したイベントが理由なしで保存・転送されない型/validation基盤にする。
  - 想定スコープ: `packages/events/**`。
  - 検証: `pnpm --filter @yrese/events typecheck`, `pnpm --filter @yrese/events test`。

- [x] WP-1009 concrete error code registry seed(b5e4f22)
  - 発見根拠: `@yrese/shared-kernel` には `ErrorCodeRegistry` 型基盤がある一方、APIは `AUTH-0003` をローカル文字列として返している。
  - 目的: 承認済み最小コード(`AUTH-0003`など)をshared-kernel側で一元管理し、apps側の重複定義を避ける。
  - 想定スコープ: `packages/shared-kernel/**`, `apps/api/**`。
  - 注意: error_code_registry SSOT APPROVED 後に実装する。
  - 検証: `pnpm --filter @yrese/shared-kernel test`, `pnpm --filter @yrese/api test`, `pnpm check:boundaries`。

- [x] WP-2005 API error contract package化(bb3d237、WP-2008に統合)
  - 発見根拠: `/whoami` の403レスポンス `{ errorCode, message }` は `@yrese/contracts` に未定義で、frontend/API間の契約がhealth以外にまだ広がっていない。
  - 目的: PHIを含まない共通error response schemaを `@yrese/contracts` に追加し、API側がschema parseを通して返す。
  - 想定スコープ: `packages/contracts/**`, `apps/api/**`。
  - 検証: `pnpm --filter @yrese/contracts test`, `pnpm --filter @yrese/api test`, `pnpm check:boundaries`。

- [x] WP-4006 build artifact hygiene: test files excluded from dist(e51f920)
  - 発見根拠: `pnpm -r build` 後、`apps/api/dist/server.test.js` や `packages/*/dist/*.test.js` が生成され、runtime/package成果物にtest codeが混入している。
  - 目的: `tsconfig.build.json` などでbuild出力から `*.test.ts` を除外し、test/typecheckは既存コマンドで維持する。
  - 想定スコープ: `apps/api/**`, `packages/**` のtsconfig/build script。
  - 検証: `pnpm -r build`, `find apps packages -path '*/dist/*test*'` が空、`pnpm -r test`, `pnpm -r typecheck`。

- [x] WP-1010 PermissionScope runtime parser strictness(e51f920)
  - 発見根拠: `isPermissionScope()` は `value.split(':')` の先頭2要素だけを見るため、`tenant:read:extra` のような余分なsegment付き文字列を許しうる。
  - 目的: runtime validationを `PermissionScope` 型どおり `resource:action` の2segmentだけに厳格化し、dev stub header由来scopeも過剰受理しない。
  - 想定スコープ: `packages/shared-kernel/**`。
  - 検証: `pnpm --filter @yrese/shared-kernel test`, `pnpm --filter @yrese/api test`, `pnpm check:boundaries`。

- [ ] WP-4007 package entrypoint/build output alignment
  - 発見根拠: `packages/*/package.json` は `main` / `types` / `exports` が `./src/index.ts` を指す一方、`pnpm -r build` は `dist/` を生成する。build成果物を使う実行・配布・CI検証の方針がmetadataに反映されていない。
  - 目的: workspace内部はsource参照、build成果物はdist参照など、Phase 0のpackaging方針に合わせてpackage entrypointをSSOT化する。
  - 想定スコープ: `packages/*/package.json`, 必要なら `tsconfig*.json`。
  - 検証: `pnpm -r build`, `pnpm -r typecheck`, `pnpm check:boundaries`。

- [x] WP-2006 API malformed permission scope regression(b5e4f22)
  - 発見根拠: `@yrese/shared-kernel` では `tenant:read:extra` を拒否する回帰テストを追加済みだが、`apps/api` の `/whoami` テストはdev header由来のmalformed scopeが権限付与されないことを直接固定していない。
  - 目的: authz境界であるAPI preHandler経路でも、malformed scopeがdeny-by-defaultになることをテストで固定する。
  - 想定スコープ: `apps/api/**`。
  - 検証: `pnpm --filter @yrese/api test`, `pnpm --filter @yrese/shared-kernel test`。

- [x] WP-1011 shared-kernel test fixture control-character hygiene(7a74076)
  - 発見根拠: `packages/shared-kernel/src/kernel.test.ts` に実NUL/制御文字を含むfixture文字列があり、`git diff --numstat -- packages/shared-kernel/src/kernel.test.ts` がbinary扱いになる。
  - 目的: runtimeで同じ不正ID入力を検証しつつ、source file上は `String.fromCharCode(0)` 等で表現してdiff/review/toolingをtext扱いに戻す。
  - 想定スコープ: `packages/shared-kernel/src/kernel.test.ts`。
  - 検証: `pnpm --filter @yrese/shared-kernel test`, `git diff --numstat -- packages/shared-kernel/src/kernel.test.ts` が行数差分を表示、`git diff --check`。

- [x] WP-2007 API PORT environment validation(a90df35)
  - 発見根拠: `apps/api/src/main.ts` は `Number.parseInt(process.env.PORT ?? '', 10)` と `Number.isInteger` でportを決めており、`3001abc` のような文字列を3001として受理し、負数・範囲外portもlisten時まで流れる。
  - 目的: 起動設定の入力検証を明示し、未指定は3001、指定時は10進整数文字列かつ1-65535のみ受理する。
  - 想定スコープ: `apps/api/src/main.ts`, 必要なら起動設定helper/test。
  - 検証: `pnpm --filter @yrese/api test`, `pnpm --filter @yrese/api typecheck`。

- [x] WP-4008 workspace TypeScript/Vitest version alignment(a90df35)
  - 発見根拠: `apps/api/package.json` は `typescript:^5.8.0` / `vitest:^3.2.0`、他workspaceは主に `typescript:^5.7.3` / `vitest:^3.0.0` で、同一repo内のtoolchain指定が揺れている。
  - 目的: Phase 0の品質方針に合わせ、workspace全体のTypeScript/Vitest version policyを一元化し、将来の型/テスト挙動差分を避ける。
  - 想定スコープ: `apps/*/package.json`, `packages/*/package.json`, `pnpm-lock.yaml`。
  - 検証: `pnpm install --frozen-lockfile`, `pnpm -r typecheck`, `pnpm -r test`, `pnpm -r build`。

- [x] WP-4009 CI secret/dependency scan expansion(a90df35)
  - 発見根拠: `.github/workflows/ci.yml` にはsecret scan追加TODOが残り、security/test strategy系SSOTでもsecret scan / dependency scan / SBOMがPhase 2拡充項目として記録されている。
  - 目的: 既存のtypecheck/test/build/boundaryに加え、secret混入と依存リスクをCIで機械的に検出する。
  - 想定スコープ: `.github/workflows/ci.yml`, `package.json`, 必要なら `scripts/**`。
  - 検証: `pnpm check:boundaries`, 追加scanコマンド、`git diff --check`。

- [x] WP-4010 workspace generated artifact cleanup command(a90df35)
  - 発見根拠: `pnpm -r build` 後に `apps/api/dist`, `apps/web/.next`, `packages/*/dist` が残るが、root `package.json` にclean scriptがなく、generated artifact掃除の標準手順がない。
  - 目的: build/test後のローカル状態を再現可能にするため、ignored生成物を安全に削除するrepo標準コマンドを用意する。
  - 想定スコープ: `package.json`, 必要なら `scripts/**`。
  - 検証: `pnpm build`, `pnpm clean`, `git status --short --untracked-files=all` が生成物を表示しないこと、`git diff --check`。

- [x] WP-4011 repository script regression harness(c3db115)
  - 発見根拠: `scripts/check-boundaries.mjs`, `scripts/check-secrets.mjs`, `scripts/clean.mjs` はCI品質ゲートとして重要だが、現時点では手動検証のみで、fixtureベースの自動回帰テストがない。
  - 目的: 一時workspace fixtureで boundary violation / secret finding / allowlist / clean 対象削除を自動検証し、品質ゲート自体の退行を防ぐ。
  - 想定スコープ: `scripts/**`, `package.json`。
  - 検証: 追加するscript testコマンド、`pnpm check:boundaries`, `pnpm check:secrets`, `pnpm clean`, `git diff --check`。

- [ ] WP-3005 web shell smoke tests
  - 発見根拠: `apps/web/package.json` の `test` は `vitest run --passWithNoTests` で、現時点のweb shell/navigation/system-mode badgeには自動テストがない。
  - 目的: 主要ナビゲーション項目、システムモード表示、placeholder routeの最低限のrender契約を固定し、routing shellの退行を早期検知する。
  - 想定スコープ: `apps/web/**`。
  - 検証: `pnpm --filter @yrese/web test`, `pnpm --filter @yrese/web typecheck`。

- [ ] WP-4012 dependency scan / SBOM CI gate
  - 発見根拠: `.github/workflows/ci.yml` には dependency scan / SBOM 追加TODOが残り、`package.json` にも依存脆弱性・SBOM生成を検査するroot scriptが未定義。
  - 目的: secret scan に加えて、依存脆弱性検知とSBOM生成/検証をCIの機械ゲートにし、security SSOTの「dependency scan / SBOM」予定項目を実装へ進める。
  - 想定スコープ: `package.json`, `.github/workflows/ci.yml`, 必要なら `scripts/**`。
  - 検証: 追加する依存scan/SBOMコマンド、`pnpm install --frozen-lockfile`, `pnpm check:secrets`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4013 boundary duplicate registry scan expansion(b210984)
  - 発見根拠: `docs/modules/dependency_direction_policy.md` は `PERMISSION_RESOURCES` / `ERROR_DOMAINS` などの検査対象追加を想定しているが、`scripts/check-boundaries.mjs` の重複const検査は現状 `SYSTEM_MODES` / `PROVISIONAL_STATUSES` / `BLOCKER_TYPES` の3種だけ。
  - 目的: shared-kernelの権限・エラー系レジストリ(`PERMISSION_ACTIONS`, `PERMISSION_RESOURCES`, `ROLE_NAMES`, `ERROR_SEVERITIES`, `ERROR_DOMAINS`, `KERNEL_ERROR_CODES` など)もローカル再定義検出対象に広げ、COMMON_MODULE_DUPLICATION_BLOCKEDを機械的に強化する。
  - 想定スコープ: `scripts/check-boundaries.mjs`, 必要なら `scripts/**` のfixture test、`Plans.md`。
  - 検証: `pnpm check:boundaries`, 意図的な一時fixtureで追加const名の重複検出確認、`git diff --check`。

- [x] WP-4014 API-001 patient search contract readiness follow-up(bb3d237、WP-2008で解消)
  - 発見根拠: `docs/api/patient_search_contract.md` は患者検索APIをPROPOSED化したが、現状の `@yrese/contracts` はhealthのみで、eligibility statusの値集合は `apps/web` 側 `PatientHeader` が先に持っている。また、query validationは `q` 不正だけが明記され、`limit` / `cursor` 不正、tenant/pharmacy境界、PHIレスポンスのcache/logging制約が実装前に曖昧になりうる。
  - 目的: API-001承認後、患者検索のquery/response/error zod schemaを `@yrese/contracts` に置き、backend repository interfaceがtenantId/pharmacyIdを必ず受ける形にし、cursorを非PHI・tenant/pharmacy/query境界内で扱う契約を固定する。
  - 解消根拠: API-001 v0.2.0 APPROVED 後、WP-2008 で contracts schema / PAT-0001 / repository tenant-pharmacy boundary / no-store を実装。
  - 想定スコープ: `docs/api/patient_search_contract.md`(契約修正が承認された場合のみ), `packages/contracts/**`, `apps/api/**`。
  - 検証: `pnpm --filter @yrese/contracts test`, `pnpm --filter @yrese/api test`, `pnpm check:boundaries`, `pnpm check:secrets`。

- [ ] WP-4015 error_code_registry SSOT/code drift cleanup
  - 発見根拠: `packages/shared-kernel/src/error-codes.ts` は `KERNEL_ERROR_CODES` に `AUTH-0003` と `PAT-0001` をseed済みだが、`docs/modules/error_code_registry.md` はまだ `AUTH-0003` を「ErrorCodeRegistry 未登録」と記載し、API-001で実装済みの `PAT-0001` 行もない。
  - 目的: error_code_registry SSOTを実装済みseedと同期し、以後のAPI実装が古い台帳を根拠に誤ったCODEX_PLANを出さないようにする。
  - 想定スコープ: `docs/modules/error_code_registry.md`, 必要なら `docs/modules/common_module_inventory.md` / `State.md` の状態記述のみ。
  - 検証: `rg -n "AUTH-0003|PAT-0001|未登録|要整備" docs/modules/error_code_registry.md packages/shared-kernel/src/error-codes.ts`, `git diff --check`。

## v0.1.8 レセコンベンチマーク反映(ユーザー提供調査 2026-07-09)

ユーザー提供の主要レセコン調査(MEDIXS / EMシステムズ MAPs・Recepty NEXT / PHC Pharnes / Pharmy Connect / P-CUBE n / GENNAI just / 調剤くんV8)に基づく計画拡張。
方針決定(fable5): ①各社実装の模倣ではなく公式仕様準拠の**根拠追跡型・決定論的ルールエンジン**として設計する ②**LLM/AIに算定判断をさせない**(補助・候補提示・説明生成のみ可) ③ベンダー公開情報は Priority C(要件抽出の補助のみ、実装根拠禁止) ④MVPは「正確な算定・請求」に加えて入力速度・請求前点検・連携口・オフライン・二重UXまでを競争力条件とする。

### ベンチマーク・スコープSSOT

- [ ] WP-0018 レセコン機能ベンチマークSSOT: docs/product/rececon_feature_benchmark.md(ベンダー別特徴・出典URL付き・Priority C明記)+ docs/product/major_rececon_feature_matrix.md(14分類×ベンダー×MVP反映方針)。ユーザー提供調査を一次入力とし、source_registry へベンダーURL(Priority C)とSSK電子レセプト作成手引きページ(Priority A)を追記
- [ ] WP-0019 mvp_scope(PRD-001)改版: ベンチマーク由来の必須機能を反映 — 前回Do入力 / OCR受け口 / 電子薬歴連携API(薬歴未記載チェック=薬学管理料整合の請求前点検) / 処方監査システム双方向API / 在庫連携口+現在庫表示 / 請求前点検の拡充(入力漏れ・算定根拠・薬歴未記載・資格確認・公費・レセプト形式) / 二重UX(初心者ガイド+熟練者ショートカット) / リモート診断。後続フェーズ表(AI薬歴・服薬フォロー・本部入力・在庫高度化・経営分析・オンライン服薬指導・多店舗薬歴共有)も正式化。opus4.8+人間レビュー

### 算定エンジンSSOT(CAL-004 の後継拡張群)

- [ ] WP-0020 calculation_engine_architecture.md: 9段パイプライン(入力検証→マスター解決→処方グルーピング→候補抽出→条件評価→点数計算→負担金計算→請求可否判定→出力)+ CalculationInput/Output 型仕様(mode・versions・外部確認状態を明示入力)。CAL-004 を包含・置換
- [ ] WP-0021 calculation_rule_dsl.md: ルールメタデータ仕様(rule_id / fee_item_code / effective_from・to / law_or_notice_ref / evidence_id / predicate / calculation_formula / exclusion_group / upper_limit / frequency_limit / required_records / required_facility_basis / offline_allowed / requires_human_confirmation / test_case_refs)。コード直書き禁止の根拠
- [ ] WP-0022 claimability_status_policy.md: 候補抽出と確定算定の分離ステータス(AUTO_CALCULATED / SUGGESTED_REQUIRES_CONFIRMATION / REQUIRES_PHARMACIST_CONFIRMATION / REQUIRES_RECORD / BLOCKED_MISSING_EVIDENCE / BLOCKED_UNSUPPORTED_CLAIM)— shared-kernel status_registry との整合必須
- [ ] WP-0023 calculation_trace_schema.md: trace拡張仕様(formula / intermediateValues / rounding{method, evidenceId} / status: applied|suggested|excluded|blocked)— @yrese/trace 現行実装からの拡張差分を定義
- [ ] WP-0024 fee_item_registry.md: 算定項目台帳(候補抽出対象の全項目体系: 調剤基本料〜調剤ベースアップ評価料。CAL-001/CAL-003 と行対応)
- [ ] WP-0025 drug_fee_policy.md: 薬剤料計算(15円以下1点・10円ごと1点の evidence 化 — EVD-CAL 済み分参照、材料料=価格/10円)+ 計算単位(剤・調剤単位)定義。丸め根拠 evidence_id 必須
- [ ] WP-0026 prescription_grouping_policy.md: 「剤」判定(内服/内滴/屯服/外用、用法・服用時点・剤形・同一有効成分・日数合算)— PrescriptionGroupResolver の仕様。留意事項通知(P-06)精読が前提の行は BLOCKED 明記
- [ ] WP-0027 facility_basis_policy.md: 施設基準スナップショット(FacilityBasisSnapshot を請求月単位で固定)・届出情報管理
- [ ] WP-0028 selected_medical_care_policy.md: 長期収載品選定療養の別建て計算(保険請求分/患者一部負担/選定療養額/消費税/帳票表示/レセプト影響/患者説明履歴の分離)
- [ ] WP-0029 offline_calculation_policy.md: LOCAL_ONLY 時の仮算定境界(PROVISIONAL_CALCULATION 系、外部確認必要項目の成功扱い禁止)— ARC-001/ARC-002 との整合
- [ ] WP-0030 calculation_golden_test_plan.md: golden test 体系(evidence 連動・剤パターン・公費組合せ・境界日・逓減)

### 請求・UXSSOT

- [ ] WP-0031 receipt_intermediate_model.md + pre_claim_check_policy.md(docs/claim/): レセプト中間モデル(CLM-002 記録仕様ノート準拠)+ 請求前点検ポリシー(薬歴未記載チェック含む — 電子薬歴連携APIとの責務分界)
- [ ] WP-0032 rececon_workflow_benchmark.md + fast_input_interaction_policy.md(docs/uiux/): 入力速度ベンチマーク(1画面設計・ファンクションキー/ショートカット・1way入力・処方入力時の現在庫+患者情報+警告同一画面表示)+ 二重UX(ガイド付き/高速入力)設計。UIX-001〜007 との整合

### 実装WP(SSOT承認後に発行)

- [ ] WP-2103 PrescriptionGroupResolver 骨格(packages/calculation/grouping — WP-0026 承認後)
- [ ] WP-2104 薬剤料計算モジュール(drug-fee — WP-0025 承認後。使用薬剤料 evidence は EVD-CAL 採番済み分から)
- [ ] WP-2105 候補抽出/確定分離ステータスの shared-kernel 追加(WP-0022 承認後)
- [ ] WP-2106 選定療養計算モジュール(WP-0028 承認後・選定療養 evidence 発行後)
- [ ] WP-2107 電子薬歴/監査/在庫連携APIの契約設計(Pharmacy Integration API v0 — API-001 パターン踏襲)

### 実行順序(fable5 判断)

1. WP-0018(ベンチマークSSOT・フォーク)+ WP-0020〜0023(エンジン中核SSOT・フォーク)を並列
2. WP-0019(mvp_scope改版)は 0018 完了後に fable5 が起案 → opus4.8 → 人間レビュー
3. WP-0024〜0030 を第2波フォーク、WP-0031/0032 を第3波
4. 実装WP(2103〜)は各SSOT承認+evidence充足を確認して逐次発行

## v0.1.8 ベースライン差分計画(2026-07-09 受理)

v0.1.7 → v0.1.8 の差分を fable5 が棚卸しした結果。既存承認済みSSOT・実装は維持し、新規範囲を追加する。
ディレクトリは既存規約 docs/<domain>/ を維持(v0.1.8 の docs/ssot/ 表記は本規約へ読み替え、PRC-007 に既録)。

### 充足状況マッピング

- §0.0.4.12 ベンチマーク: **一部充足**(PRD-004/005 済み)→ 不足分: ORCA会計思想・POS/セルフレジ製品・API公開性/標準規格対応の観点追加 + derivative_feature_inventory + mvp_feature_prioritization
- §0.0.4.14 算定エンジン深化: **一部充足**(CAL-005〜008 PROPOSED・opus4.8レビュー中、WP-0024〜0030 計画済み)→ 不足分: calculation_pipeline / canonical_prescription_model / master_resolution_policy / material_fee_policy(fee_item_registry・drug_fee 等は既計画)
- §0.0.4.1〜0.0.4.7 会計・収納・領収証・日計・POS・施設請求: **全面新規**(Calculation/Claim/Accounting/Receipt/POS の5領域分離、append-only ledger、一部入金MVP必須)
- §0.0.4.8〜0.0.4.9 Integration Hub モジュール化: **新規**(API-001/contracts の実績を基盤に拡張)
- §0.0.4.10 JAHISフル対応: **新規**(Applicability Matrix 方式。全標準の無差別実装ではない)
- §0.0.4.11 開かれたレセコン: **一部充足**(OPS-011 portability / MOD 公開SSOT)→ 不足分: sandbox・SDK・開発者ポータル方針

### v0.1.8 新停止条件(即時有効)

- 会計SSOT(17文書)未承認のまま会計・未収・領収証・入金APIを実装しない
- JAHIS Applicability Matrix / full support definition / conformance test 未整備で「JAHIS対応」を名乗らない(BLOCKED_JAHIS_CONFORMANCE_REVIEW)
- 未入金額を領収済み表示する設計を禁止 / LOCAL_ONLY会計の同期・重複防止未設計での実装禁止
- 外部ベンダー直接DBアクセス禁止 / undocumented API 本番利用禁止

### 新規SSOT WP

- [ ] WP-0033 会計SSOT 11文書(docs/accounting/: domain_model / patient_receivable / payment_allocation / partial_payment / refund_adjustment / ar_status_registry / daily_cash_closing / payment_method_registry / pos_integration / facility_billing / accounting_audit_log)— append-only ledger・状態機械(PatientReceivable 10状態 / Payment 10状態)・一部入金・割当順序
- [ ] WP-0034 領収証SSOT 6文書(docs/receipt/: issuance / numbering / reissue_cancel / statement_issuance / template_registry / privacy)— 領収証=入金事実対応・明細書=算定基礎項目の分離、再発行表示・交付履歴・0円時明細書【要確認】
- [ ] WP-0035 JAHIS SSOT 8文書(docs/jahis/: applicability_matrix / full_support_definition / adapter_inventory / version_watchlist / conformance_test_plan / character_encoding_policy / code_mapping_policy / roundtrip_test_policy)
- [ ] WP-0036 Integration Hub SSOT 11文書(docs/integration/: hub_architecture / partner_registry / data_sharing_module_inventory / data_sharing_policy / api_scope_registry / webhook_event_catalog / idempotency_policy / partner_sandbox / contract_test_policy / data_portability / adapter_registry)
- [ ] WP-0037 派生機能調査+ベンチマーク拡張(docs/product/: derivative_feature_inventory / mvp_feature_prioritization + PRD-004/005 への ORCA・POS・API公開性観点追記)
- [ ] WP-0038 mvp_scope(PRD-001)v0.1.8改版: WP-0019 を統合し、一部入金・会計台帳・領収証発行・日計をMVP必須へ、POS/セルフレジ/施設請求は境界設計のみ等を確定 → opus4.8+人間レビュー
- [ ] WP-0039 算定エンジン深化 残SSOT(docs/calculation/: calculation_pipeline / canonical_prescription_model / master_resolution_policy / material_fee_policy)— WP-0024〜0030 と統合実行

### 新規実装WP(SSOT承認後に発行、v0.1.8 §0.0.4.15 レーン準拠)

- [!] WP-2201 会計台帳バックエンド(codex — WP-0033 APPROVED まで BLOCKED)
- [!] WP-2202 領収証ドキュメントバックエンド(codex — WP-0034 APPROVED まで BLOCKED)
- [!] WP-2203 Integration Hub 骨格(codex — WP-0036 APPROVED まで BLOCKED)
- [!] WP-2204 JAHIS 2Dシンボル Adapter(codex — WP-0035 承認 + JAHIS仕様本文入手(Ver.1.11、入手経路【要確認: 人間手続きの可能性】)まで BLOCKED)
- [!] WP-3101 会計・未収・一部入金・領収証画面(claude — WP-0033/0034 + API契約承認まで BLOCKED)
- [ ] 共通モジュール追加(shared-kernel: accounting/payment/receipt status enum — WP-0033/0034 承認後、MOD-005 改版経由)

### 実行順序

1. フォーク第1波: WP-0033(会計)+ WP-0034(領収証)+ WP-0035(JAHIS)並列
2. フォーク第2波: WP-0036(Integration)+ WP-0037(派生機能)+ WP-0039(算定残)
3. WP-0038 mvp_scope 改版は第1波完了後に fable5 起案
4. 進行中作業は継続: CAL-005〜008 opus4.8レビュー、codex WP-2008b・統合スモーク
