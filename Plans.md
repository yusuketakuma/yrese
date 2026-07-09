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

- [ ] WP-2005 API error contract package化
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

- [ ] WP-4011 repository script regression harness
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
