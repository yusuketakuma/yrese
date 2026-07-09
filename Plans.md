# Plans.md — 調剤用レセプトコンピューター MVP タスク計画

構築プロンプト v0.2.0 / `docs/plan/phase0_plan.md` に基づく実行計画。
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
- [x] WP-2002 認証認可・テナント分離の骨格(RBAC scope、tenant_id/pharmacy_id 強制)(codex実装・claudeレビュー、40a2512)
- [ ] WP-2003 監査ログ骨格(audit event envelope、PHI非出力)
- [ ] WP-2004 患者・保険・公費ドメインCRUD(SSOT承認後)
- [x] WP-2008 患者検索APIバックエンド(API-001 v0.2.0、errorResponseSchema統合、PAT-0001、tenant/pharmacy/query拘束cursor、no-store)(codex実装・claudeレビュー、bb3d237)
- [!] WP-2101 算定エンジン(公式点数根拠 evidence_id 未確認 → BLOCKED_REGULATORY_REVIEW。純粋関数の骨格・trace配線のみ先行可)
- [!] WP-2102 電子レセプト生成(記録条件仕様未確認 → BLOCKED_REGULATORY_REVIEW)
- [!] WP-2103 Official Adapter 実装(ONS資料未確認 → BLOCKED_REGULATORY_REVIEW)

### フロントエンド(Claude側所有 / apps/web)

- [x] WP-3001 apps/web scaffold(Next.js 15 shell + SystemModeBadge、12a5ac2)
- [x] WP-3002 患者ヘッダーコンポーネント(apps/web内に配置。packages/ui化は第二利用者出現時 — shared肥大化防止)(1acfa3f)
- [x] WP-3003 患者検索・受付ダッシュボードUI(API契約確定後、5b7f6ad)
- [x] WP-3004 画面群ルーティングシェル(業務順ナビ+8ルート、解除条件明記)(2b195b5)
- [x] WP-0014 公式資料検証リサーチ(全10項目CONFIRMED、施行日R8.6.1確定、記録条件仕様公開確認)(f166bee)

#### UI/UX 開発計画(正本: docs/plan/uiux_development_plan.md = PLAN-UIUX-001。詳細・依存・品質ゲートは計画書に従う)

- [x] WP-3006 デザイントークン+共通状態コンポーネント基盤(f4c7160): StatusBadge/BlockerBanner/SeverityList/EmptyState/LoadingState。shared-kernel 型再利用・色非依存。component.gallery は 403 のため一般慣行で代替(次回は /browse 経由で照合)— UI-1
- [x] WP-3007 SCR-013 横断警告・エラー・BLOCKER 表示(1b9e753 + 是正 9c5d2e9): ErrorNotice(次アクション対提示)/error boundary(PHI 非表示)。opus4.8 医療安全レビュー APPROVED(MEDIUM 3件即時是正: console PHI 封鎖・ERROR 格下げ・errorCode 検証。UIX-001 §5 に ERROR 行追加 v0.1.1)— UI-1
- [x] WP-3008 SCR-002 患者検索強化(1ffd6ea + 是正): 同姓同名警告(P-09)/ stale response 世代ガード(WP-4037)/ dev ヘッダ本番境界(WP-4038)/ 資格状態文言一本化(WP-4041)。opus4.8 医療安全レビュー APPROVED — F1(続きあり時の同姓同名可能性注記)/ F3(append 競合の回帰テスト)は即時是正済み — UI-2
- [ ] WP-3022 SCR-002 類似候補区別(opus4.8 レビュー F2): カナ近似(長音・濁点ゆれ等)の差分強調。近似規則の定義が必要なため UIX 系 SSOT へ類似判定規則を起案(SSOT_UPDATE 相当)→ APPROVED 後に実装。患者選択動線の実装 WP では同姓同名該当時に選択前確認を課す(F6 申し送り)。
- [ ] WP-3009 SCR-001 受付ダッシュボード実体化(受付キュー契約 SSOT 起草含む)— UI-2
- [ ] WP-3010 SCR-026 LOCAL_ONLY モード UX(判定は shared-kernel 関数のみ)— UI-2
- [ ] WP-3011 SCR-012 calculation_trace ビューア(表示のみ、QUA-007 L2 の初 UI)— UI-3
- [ ] WP-3012 SCR-025 同期状態画面(契約 SSOT 起草含む)— UI-3
- [ ] WP-3013 SCR-024 外部連携状態 — UI-3
- [ ] WP-3014 処方・調剤 API 契約 SSOT パック起草 → WP-3015 SCR-004 処方入力 / WP-3016 SCR-010+014 調剤入力・薬剤師確認 — UI-4(契約 APPROVED が発行条件)
- [ ] WP-3017 SCR-011 算定結果 / WP-3018 SCR-016+017 会計・未収 / WP-3019 SCR-018 帳票出力 — UI-5(WP-2201/2202 契約が発行条件)
- [ ] WP-3020 SCR-019 請求前点検 / WP-3021 SCR-020 月次締め — UI-6(CLM 系実装が発行条件)

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

- [!] WP-4007 package entrypoint/build output alignment(DEFERRED — 外部公開/partner配布決定時に再開)
  - 発見根拠: `packages/*/package.json` は `main` / `types` / `exports` が `./src/index.ts` を指す一方、`pnpm -r build` は `dist/` を生成する。build成果物を使う実行・配布・CI検証の方針がmetadataに反映されていない。
  - 目的: workspace内部はsource参照、build成果物はdist参照など、Phase 0のpackaging方針に合わせてpackage entrypointをSSOT化する。
  - fable5判断(2026-07-09): 現時点はworkspace内消費のみで、src exports は dev/test/transpilePackages と整合。dist exports 切替は `pnpm clean` 後の解決不能や web extensionAlias 前提を壊すリスクが大きいため DEFER。外部公開(開かれたレセコン SDK / partner配布)開始時に conditional exports(development=src / default=dist)として再起動する。
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

- [x] WP-3005 web shell smoke tests(f46d626、WP-4007と併走レビュー済み)
  - 発見根拠: `apps/web/package.json` の `test` は `vitest run --passWithNoTests` で、現時点のweb shell/navigation/system-mode badgeには自動テストがない。
  - 目的: 主要ナビゲーション項目、システムモード表示、placeholder routeの最低限のrender契約を固定し、routing shellの退行を早期検知する。
  - 想定スコープ: `apps/web/**`。
  - 検証: `pnpm --filter @yrese/web test`, `pnpm --filter @yrese/web typecheck`。

- [x] WP-4018 web test gate strictness after smoke tests
  - 発見根拠: `apps/web/app/shell-smoke.test.tsx` が導入済みなのに、`apps/web/package.json` の `test` はまだ `vitest run --passWithNoTests` のまま。将来テストファイルが誤って消えても web test が成功しうる。
  - 目的: web shell smoke tests 導入後のCI退行検知力を上げるため、web test script から `--passWithNoTests` を外す。
  - 想定スコープ: `apps/web/package.json`。
  - 実施: `apps/web/package.json` の `test` を `vitest run` に変更し、webテスト不在時に成功しないゲートへ戻した。
  - 検証: `pnpm --filter @yrese/web test`, `pnpm --filter @yrese/web typecheck`, `pnpm -r test`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4020 ssot_index 整合性 CI ゲート(codex実装・claudeレビュー、c06c913。WP-4027 で台帳反映)
  - 発見根拠: WP-0051 で索引未登録の約50文書を検出(索引の手動更新漏れが再発性の欠陥)。
  - 目的: `scripts/check-ssot-index.mjs` を新設し、docs/**/*.md と ssot_index.md の相互一致(索引にない文書・文書にない索引行・status/ssot_id の不一致・ssot_id 重複・frontmatter 欠落)を CI で機械検査する。`pnpm check:ssot-index` として root script + ci.yml に追加。
  - 想定スコープ: `scripts/check-ssot-index.mjs`, `package.json`, `.github/workflows/ci.yml`, `scripts/check-scripts.mjs`(回帰ハーネス登録)。
  - 検証: 正常系 + 意図的な不一致 fixture での検出、`pnpm test:scripts`, `pnpm check:ssot-index`。

- [x] WP-4019 OpenAPI generation pipeline(codex 実装)
  - 発見根拠: `packages/contracts/src/index.ts` に TODO(Phase 1): OpenAPI YAML generation pipeline。
  - 目的: zod 契約(単一正本)から OpenAPI YAML を生成し、契約と API ドキュメントのドリフトを構造的に防ぐ。
  - 実装: `@yrese/contracts` に OpenAPI document builder を追加し、`zod-openapi` で `docs/api/openapi.yaml` を生成。root script `generate:openapi` / `check:openapi` と CI drift check を追加し、生成物には手編集禁止ヘッダを付与。MOD-014 を v0.1.1 に改版し、OpenAPI生成方式を確定。
  - 検証: `pnpm generate:openapi`, `pnpm check:openapi`, `pnpm --filter @yrese/contracts test`, `pnpm --filter @yrese/contracts typecheck`, `pnpm test:scripts`, `pnpm -r typecheck`, `pnpm -r test`, `pnpm build`, `pnpm check:deps`, `pnpm check:sbom`, `pnpm check:boundaries`, `pnpm check:ssot-index`, `git diff --check`。

- [x] WP-4021 患者検索 dev ヘッダと synthetic fixture の整合(codex 提案 SELF-SCAN-20260709-02。本WPで実装)
  - 発見根拠: `apps/web/app/patients/patient-search.tsx` の DEV_HEADERS(t-dev/ph-dev)と `apps/api/src/patient-repository.ts` の syntheticPatients(tenant-001/pharmacy-001)が不一致で、既定の dev UI 検索が常に0件。
  - 目的: dev テナント文脈と synthetic fixture のテナントを一致させ、dev 動作確認を実態のあるものにする(本番個人情報は使用しない)。
  - 実装: Web側の既定DEV_HEADERS(t-dev/ph-dev/u-dev)は変更せず、API synthetic fixture に同テナントの非PHI合成患者を追加し、route-level APIテストで検索結果を固定。
  - 検証: `pnpm --filter @yrese/api test`, `pnpm --filter @yrese/api typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4022 date-time 日付ラッパーの nominal brand 付与(codex 提案 SELF-SCAN-20260709-03。本WPで実装)
  - 発見根拠: 日付ラッパー3種(処方日・調剤日・請求月系)が構造的同型で異種間 compare がコンパイルを通る(shared_type_registry.md の既知課題、独立WP未登録だった)。
  - 目的: nominal brand を追加し異種日付の比較・代入を型で拒否する。共通モジュール改版のため shared_type_registry.md の改版を伴う。
  - 実装: PrescriptionDate / DispensingDate / ReceptionDate を nominal brand 化し、`compare()` / `equals()` を同種ラッパーのみに制限。実行時挙動は維持。`@ts-expect-error` 型テストで異種 compare / 代入がコンパイル不可であることを固定し、MOD-004 を v0.1.1 へ改版。
  - 検証: `pnpm --filter @yrese/date-time test`, `pnpm --filter @yrese/date-time typecheck`, `pnpm -r typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [ ] WP-4023 PatientHeader 資格状態型の contracts 一本化(codex 提案 SELF-SCAN-20260709-04)
  - 発見根拠: `apps/web/app/components/patient-header.tsx` が `EligibilityDisplayStatus` union をローカル定義しており、`packages/contracts/src/patient-search.ts` の `ELIGIBILITY_STATUSES` / `EligibilityStatus`(正本)と二重実装(COMMON_MODULE_DUPLICATION_BLOCKED 対象)。
  - 目的: PatientHeader の資格状態型を contracts 正本から参照させ、表示ラベルのみ web 側責務として残す。

- [x] WP-4025 API health timestamp clock injection(codex 自律スキャン SELF-SCAN-20260709-05)
  - 発見根拠: `apps/api/src/server.ts` の `/health` が `new Date().toISOString()` を直接呼び、`apps/api/src/server.test.ts` は timestamp をparse可能かだけ確認しており、health契約の決定的な回帰テストができない。
  - 目的: `buildServer()` に低リスクな clock injection を追加し、通常運用の現在時刻生成は維持しつつ、テストでは固定時刻でhealth responseを検証できるようにする。
  - 実施: `BuildServerOptions.now` を追加し、`/health` の timestamp を `now().toISOString()` へ切り出した。既存の本番挙動はデフォルトclockで維持。
  - 検証: `pnpm --filter @yrese/api test`, `pnpm --filter @yrese/api typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4026 API PORT validation fail-fast(codex 自律スキャン SELF-SCAN-20260709-06)
  - 発見根拠: WP-2007 は `PORT` 指定時に10進整数文字列かつ1〜65535のみ受理する方針だが、現実装は `3001abc` / `0` / `65536` などを黙って `3001` へフォールバックしており、設定ミスを隠す。
  - 目的: `PORT` 未指定・空白は従来どおりdefault 3001、明示指定が不正な場合は起動失敗としてfail-fastにする。
  - 実施: `parseApiPort()` を不正指定で `RangeError` を投げる契約へ変更し、`main.ts` のtryブロック内でport解決を行うようにした。
  - 検証: `pnpm --filter @yrese/api test`, `pnpm --filter @yrese/api typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [ ] WP-2009 audit hash-chain canonicalization / hydrate split
  - 発見根拠: WP-2003 は assignment 明記どおり `prevHash` / `entryHash` の sha-256 hex 形式検証のみで、entryHash 計算自体は呼び出し側/永続層責務として残した。SEC-007 は最終的に `entryHash = H(prevHash || 正規化ペイロード)` を要求する。
  - 目的: 監査ログ永続化実装時に、canonical payload から entryHash を生成する作成APIと、保存済みレコードを検証して復元する hydrate/verify API を分離し、任意hexを真正性証跡として扱わない。
  - 想定スコープ: `packages/audit/**`、将来の監査永続化パッケージ/アプリ配線。必要なら SEC-007/MOD-008 改版を fable5 に依頼。
  - 検証: payload変更でhash不一致になるテスト、prevHash連鎖テスト、hydrate時の不一致拒否テスト、`pnpm --filter @yrese/audit test`。
  - opus4.8 事後レビュー申し送り(2026-07-09): createAuditEvent は sha256 hex 形式検証のみで entryHash の計算・連続性は未検証。WP-2009 完了まで本番配線で任意ハッシュを供給する呼び出しを作らない(裏付けのない tamper-evidence を提示しない)。

- [x] WP-4024 audit 実行時ガードの否定テスト補強(opus4.8 レビュー指摘 LOW。本WPで実装)
  - 発見根拠: WP-2003 事後レビューで、assertTargetRef(空/制御文字/非snake_case)、assertOutcome(不正値)、businessReasonCodePattern(小文字/不正コード)、correlationId 欠落の否定テストが未カバーと指摘。ガード自体は実装済みで正しく動作。
  - 目的: 回帰保護のため否定テストを追加する。実装変更は不要。
  - 実装: `targetRef` 空/制御文字/非snake_case、invalid outcome、malformed `businessReason.code`、missing `correlationId` の否定テストを追加。実装コード変更なし。
  - 検証: `pnpm --filter @yrese/audit test`, `pnpm --filter @yrese/audit typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4027 WP-4020 完了の台帳反映(codex 提案 SELF-SCAN-20260709-07。本改版で反映済み)

- [ ] WP-4028 算定パッケージ純粋関数規律の静的検査ゲート(codex 提案 SELF-SCAN-20260709-08)
  - 発見根拠: CAL-010 が `Date.now` / `new Date(` / `Math.random` / `parseFloat` 等の静的検査を独立WP候補として明記する一方、現行 check-boundaries は import 方向・循環・重複定義のみ。
  - 目的: packages/calculation(将来は money/date-time も)に対する禁止パターン静的検査を CI ゲート化する。CAL-010 APPROVED 後に実装。
  - 検証: 違反注入 fixture での検出、`pnpm test:scripts`。

- [x] WP-4029 患者検索 cursor の contract 層上限(codex 提案 SELF-SCAN-20260709-09。本WPで実装)
  - 発見根拠: `patientSearchQuerySchema` の `cursor: z.string().optional()` に長さ上限がなく、巨大 cursor 文字列を contract 層で拒否できない。
  - 目的: cursor に妥当な max 長を設け、fail-closed に契約層で拒否する(API-001 の改版を伴う場合は SSOT 先行)。
  - 実装: `PATIENT_SEARCH_CURSOR_MAX_LENGTH = 512` を contracts 正本として追加し、query cursor / response nextCursor schema と API-001 文書へ反映。長大 cursor は decode 前に `PAT-0001`。
  - 検証: `pnpm --filter @yrese/contracts test`, `pnpm --filter @yrese/api test`, `pnpm --filter @yrese/contracts typecheck`, `pnpm --filter @yrese/api typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4030 不正 dev ID ヘッダの API 否定テスト補強(codex 提案 SELF-SCAN-20260709-10。本WPで実装)
  - 発見根拠: dev tenant stub は空白・制御文字入り `x-dev-tenant` 等を branded ID factory で拒否する設計だが、API route 経由の否定テストは「ヘッダ欠落・scope不足・malformed scope」までで不正IDヘッダの deny 検証が未カバー。
  - 目的: 不正IDヘッダ→401/403 の回帰テストを追加する。実装変更は原則不要。
  - 実装: `/whoami` と `/patients/search` で、空白 tenant / 制御文字 pharmacy / 制御文字 actor を 403 `AUTH-0003` として拒否する route-level 回帰テストを追加。実装コード変更なし。
  - 検証: `pnpm --filter @yrese/api test`, `pnpm --filter @yrese/api typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4031 @yrese/trace の CAL-008 拡張フィールド実装(codex 提案 SELF-SCAN-20260709-11。本WPで実装)
  - 発見根拠: CAL-008 calculation_trace_schema は APPROVED 済みだが、@yrese/trace は拡張前の CalculationTraceStep 形状のみを公開している。
  - 目的: CAL-008 定義の後方互換な optional 拡張フィールドと実行時ガードを実装する(affectsClaim=true→evidenceRef 必須の既存不変条件は維持)。
  - 実装: `feeItemCode` / `formula` / `intermediateValues` / `rounding` / `stepStatus` / `resultPoints` / `resultYen` を optional 追加。`rounding.evidenceId` 必須、intermediateValues string-only/PHI-like key拒否、stepStatus enum検証、nested freeze、rounding evidenceId集約を実装。
  - 検証: `pnpm --filter @yrese/trace test`, `pnpm --filter @yrese/calculation test`, `pnpm -r typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4032 EventEnvelope ID/enum runtime guard(codex 提案 SELF-SCAN-20260709-12、fable5 triage 済み。本WPで実装)
  - 発見根拠: `packages/events/src/index.ts` の `createEventEnvelope()` は ID-like fields の非空検査とPHI暗号化不変条件を持つが、ID制御文字拒否は `packages/audit` 側が個別実装している。また read-only probe で `syncStatus='lost'`、`phiClassification='bad'`、`encryptionStatus='plain'` が受理されることを確認。
  - 目的: Outbox/Inbox境界のイベントが制御文字入りIDや未承認 enum 値を保持しないよう、EventEnvelope自体で fail-closed にする。
  - 実装: 既存 union literal を `@yrese/events` の exported const tuple へ昇格し、型を tuple から派生。`createEventEnvelope()` で ID-like fields の空白のみ・制御文字を拒否し、`syncStatus` / `phiClassification` / `encryptionStatus` を MOD-009 値の allow-list で runtime 検証する。PHI≠none→encrypted と dead-letter reason の既存不変条件は維持。
  - 検証: `pnpm --filter @yrese/events test`, `pnpm --filter @yrese/events typecheck`, `pnpm -r typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4033 @yrese/money RoundOptions.mode runtime guard(codex 提案 SELF-SCAN-20260709-13。本WPで実装)
  - 発見根拠: `packages/money/src/index.ts` の丸め分岐は `RoundingMode` の実行時検証を持たず、read-only probe で `ScaledDecimal.fromString('12.345').round({ scale: 2, mode: 'invalid_mode' as any })` と `mode: undefined` がどちらも `12.34` を返した。
  - 目的: 金額・点数領域で不正丸めモードを黙って toward_zero 相当に扱わず、設定ミスや外部入力バグを早期に検出する。
  - 実装: MOD-010 の7種と一致する `ROUNDING_MODES` const tuple から `RoundingMode` 型を派生させ、`round()` で `options.mode` を allow-list 検証する。不正/未指定 mode は `RangeError` で fail-closed。既存の丸め結果・政策値/evidence 規律は変更なし。
  - 検証: `pnpm --filter @yrese/money test`, `pnpm --filter @yrese/money typecheck`, `pnpm -r typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4034 calculation StepResult runtime shape guard(codex 提案 SELF-SCAN-20260709-14、fable5 PLAN_APPROVED。本WPで実装)
  - 発見根拠: custom rule が `{ status: 'SKIPPED' } as any` を返す read-only probe で、`calculate()` は意図的な fail-closed エラーではなく `TypeError Cannot read properties of undefined (reading 'trim')` を投げた。
  - 目的: 将来の rule DSL / adapter-generated rules 境界で、不正 `StepResult` を曖昧な TypeError ではなく明示的な規律違反として拒否する。
  - 実装: `rule.apply()` 直後に `StepResult` runtime shape guard を追加。`status` 不正、`ITEM_CALCULATED` 必須フィールド欠落、`BLOCKED` の blocker 欠落などは例外ではなく `BLOCKED` 結果として返し、blocker は `SSOT_UPDATE_REQUIRED`、warning は `算定ルール戻り値SSOT不一致(SSOT_UPDATE_REQUIRED)` に統一した。既存の算定ルール・点数値・正常系 trace/golden は変更なし。
  - 検証: `pnpm --filter @yrese/calculation test`, `pnpm --filter @yrese/calculation typecheck`, `pnpm -r typecheck`, `pnpm check:boundaries`, `pnpm check:ssot-index`, `git diff --check`。

- [x] WP-4035 contract enum/status duplication boundary scan expansion(codex 提案 SELF-SCAN-20260709-15、fable5 PLAN_APPROVED。本WPで実装)
  - 発見根拠: `scripts/check-boundaries.mjs` の重複 const 検査は shared-kernel 由来名かつ `packages/**` 中心で、`packages/contracts/src/patient-search.ts` の `ELIGIBILITY_STATUSES` に対応する `apps/web` 側ローカル union 再定義のような contract-owned enum drift を検出できない。
  - 目的: WP-4023 で PatientHeader の資格状態型を contracts 正本へ寄せた後、同種の重複再発を CI で検出できるよう tooling gate を広げる。
  - 実装: `check-boundaries` の重複 const 検査を `apps/**` にも拡大し、contracts 正本 const(`ELIGIBILITY_STATUSES`, `PATIENT_SEARCH_CURSOR_MAX_LENGTH`)の再定義を violation 化。`*.test.*` は現行慣行どおり除外。MOD-003 を v0.1.2 へ改版。
  - 検証: `pnpm test:scripts`(apps側違反注入fixtureで contracts const 2種の検出実証), `pnpm check:boundaries`, `pnpm check:ssot-index`, `git diff --check`。

- [ ] WP-4036 ErrorResponse errorCode contract hardening(codex 提案 SELF-SCAN-20260709-16、CONTRACT_CHANGE_REQUEST待ち)
  - 発見根拠: `packages/contracts/src/error.ts` の `errorResponseSchema` は `errorCode: z.string().min(1)` のみで、read-only probe では `not-a-code` と `AUTH-3` が受理された。一方、`packages/shared-kernel/src/error-codes.ts` と `docs/modules/error_code_registry.md` は `AUTH-0003` / `PAT-0001` などの形式・登録台帳を持つ。
  - 目的: API契約が malformed / unregistered errorCode を許す状態を避け、contract-first error handling と frontend/admin diagnostics の信頼性を上げる。
  - 境界論点: `contracts -> shared-kernel` 依存追加は MOD-003 / API-001 の現行依存グラフに影響するため、(A) contracts が registry を参照する、(B) apps/api 側で shared-kernel registry invariant を強制する、(C) no-dep error-code-format helper を抽出する、のいずれかを fable5 が裁定する。
  - 検証: 裁定後に `pnpm --filter @yrese/contracts test`, `pnpm --filter @yrese/api test`, `pnpm check:boundaries`, `git diff --check`。

- [ ] WP-4037 PatientSearch stale response/race guard(codex 提案 SELF-SCAN-20260709-17、frontend owner確認待ち)
  - 発見根拠: `apps/web/app/patients/patient-search.tsx` の `runSearch()` は request id / AbortController / latest query guard を持たず、先に投げた検索の遅延レスポンスが後続検索結果を上書きしうる。患者検索結果は患者取り違え防止UIの入口であり、古い検索結果表示は医療安全上の誤認につながる。
  - 目的: 最新検索だけが state を更新できるようにし、追加読み込み時も対象 query/cursor の整合を保つ。併せて患者検索UIのコンポーネントテストを追加し、stale response を固定する。
  - 想定スコープ: `apps/web/app/patients/patient-search.tsx`, `apps/web/app/**.test.tsx`。frontend 所有のため Claude/fable5 が owner を決める。
  - 検証: `pnpm --filter @yrese/web test`, `pnpm --filter @yrese/web typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [ ] WP-4038 PatientSearch dev header production boundary(codex 提案 SELF-SCAN-20260709-18、auth SSOT連動)
  - 発見根拠: `apps/web/app/patients/patient-search.tsx` は client component 内で常に `x-dev-tenant` / `x-dev-pharmacy` / `x-dev-actor` / `x-dev-scopes` を送信する。バックエンド dev tenant stub は `NODE_ENV=production` で起動拒否されるが、Web 側は production build でも dev header を送る構造のまま。
  - 目的: 本番認証(OIDC等)のSSOT承認前でも、dev-only header が production bundle / production API request の前提にならないよう境界を明確化する。暫定的には dev-only adapter に隔離し、productionでは BLOCKED_SECURITY_REVIEW 表示または認証adapter未実装エラーへ fail-closed にする。
  - 想定スコープ: `apps/web/app/patients/patient-search.tsx` または frontend API client adapter。auth SSOT / generated client 方針と整合後に実装。
  - 検証: `pnpm --filter @yrese/web test`, `pnpm --filter @yrese/web typecheck`, production-like env test, `pnpm check:boundaries`, `git diff --check`。

- [ ] WP-4039 @yrese/trace runtime enum/kind guard(codex 提案 SELF-SCAN-20260709-19、fable5 triage待ち)
  - 発見根拠: `packages/trace/src/index.ts` の `createLegalTrace()` は `targetType` を runtime allow-list で検証していない。また `createCalculationTrace()` の `inputsSummary.ids[].kind` / `dates[].kind` も Object.freeze のみで、型を迂回した不正 kind や空 id/value を保持できる。
  - 目的: calculation_trace / legal_trace が未承認 target/kind や空参照を保持しないよう、TraceIdRef.kind / TraceDateRef.kind / LegalTraceTargetType を正本値から派生した allow-list で fail-closed にする。
  - scope注記: WP-4034 opus4.8 申し送りとして、将来 `calculation` 側で `exclusivityGroup` を使うルールを追加する前に、`validateEvidenceRefShape()` でも `EvidenceSourceType` allow-list 照合を行うこと。現状は `exclusivityGroup` 使用ゼロかつ trace 側で不正 `sourceType` を拒否するため低優先。
  - 想定スコープ: `packages/trace/**`。CAL-008/MOD-004 との整合確認後に実装。
  - 検証: `pnpm --filter @yrese/trace test`, `pnpm --filter @yrese/trace typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [ ] WP-4040 @yrese/money constructor input type guard(codex 提案 SELF-SCAN-20260709-20、fable5 triage待ち)
  - 発見根拠: `packages/money/src/index.ts` の `parseIntegerInput()` は `bigint` / `number` 以外を string として扱い `value.trim()` へ進むため、型を迂回した object / boolean 等で意図的な `RangeError` ではなく `TypeError` になりうる。`ScaledDecimal.fromString()` も string runtime guard を持たない。
  - 目的: 金額・点数境界で不正入力を曖昧な TypeError にせず、外部入力・fixture・adapter生成値の誤配線を明示的に拒否する。WP-4033(rounding mode guard)とは別に constructor 入力境界を固める。
  - 想定スコープ: `packages/money/**`。
  - 検証: `pnpm --filter @yrese/money test`, `pnpm --filter @yrese/money typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [ ] WP-4041 PatientSearch eligibility safety label alignment(codex 提案 SELF-SCAN-20260709-21、frontend owner確認待ち)
  - 発見根拠: `apps/web/app/components/patient-header.tsx` は `PENDING_REVERIFY` を「資格再確認待ち(請求前に再確認必須)」、`LOCAL_ONLY_UNVERIFIED` を「ローカル参照のみ(オンライン未確認)」と表示する一方、`apps/web/app/patients/patient-search.tsx` の検索結果表示は「資格再確認待ち」「ローカル参照のみ(未確認)」に留まり、請求前再確認必須・オンライン未確認の安全含意が弱い。
  - 目的: 患者検索結果段階でも外部確認未了状態を弱く見せず、PatientHeader / UIX-001 / status_registry と同じ安全文脈で表示する。WP-4023(型のcontracts一本化)と整合させ、表示文言はfrontend責務として管理する。
  - 想定スコープ: `apps/web/app/patients/patient-search.tsx`、必要ならweb shell smoke/患者検索UIテスト。frontend 所有のため Claude/fable5 が owner を決める。
  - 検証: `pnpm --filter @yrese/web test`, `pnpm --filter @yrese/web typecheck`, `pnpm check:boundaries`, `git diff --check`。

- [ ] WP-4042 /whoami contract and OpenAPI coverage decision(codex 提案 SELF-SCAN-20260709-22、API契約境界)
  - 発見根拠: `apps/api/src/server.ts` は `/whoami` を実装し、`apps/api/src/server.test.ts` も 200/403 を検証しているが、`@yrese/contracts` に `whoamiResponseSchema` がなく、WP-4019 の `docs/api/openapi.yaml` 生成対象にも含めていない。現状の契約正本は `/health` と API-001 `/patients/search` に限定されている。
  - 目的: `/whoami` を公開API、内部API、dev-only診断エンドポイントのどの契約境界に置くか fable5 が裁定する。公開または内部APIとして維持する場合は個別契約SSOT、contracts schema、OpenAPI生成対象へ追加する。dev-only診断エンドポイントなら production/API-first dogfooding から除外する方針を文書化する。
  - 想定スコープ: `docs/api/**`, `packages/contracts/**`, `apps/api/src/server.ts`, `docs/api/openapi.yaml`。API契約SSOT承認後に実装。
  - 検証: `pnpm --filter @yrese/contracts test`, `pnpm --filter @yrese/api test`, `pnpm generate:openapi`, `pnpm check:openapi`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4043 audit/common-module SSOT implementation-state drift cleanup(codex 提案 SELF-SCAN-20260709-23、SSOT整合)
  - 発見根拠: `packages/audit` は WP-2003 以降で実装済みだが、`docs/modules/common_module_inventory.md` は `packages/audit(仮)` を今後候補のまま、`docs/modules/common_module_boundary.md` は audit event type を「未実装」、`docs/modules/audit_event_registry.md` も「実装状態: 未着手」「将来 packages/audit」と記載している。
  - 目的: 承認済みSSOTが実装済み共通モジュールを未実装扱いし続ける drift を解消し、以後の Work Package が古い状態を根拠に重複実装や誤った owner/scope を組まないようにする。
  - 解消根拠: WP-4043/6c5aa61 で MOD-001/002/003/008/012 を version +0.0.1 し、`@yrese/audit` / `@yrese/contracts` / OpenAPI drift check / 依存グラフ / 実装済みパッケージ数を現行 packages/* 実態へ同期。要件・文法・禁止事項は不変更。
  - 想定スコープ: `docs/modules/common_module_inventory.md`, `docs/modules/common_module_boundary.md`, `docs/modules/audit_event_registry.md`, 必要なら `docs/ssot_index.md`。SSOT改版が必要なため fable5 裁定後に実施。
  - 検証: `rg -n \"packages/audit|audit event type|未実装|未着手|WP-2003\" docs/modules`, `pnpm check:ssot-index`, `git diff --check`。

- [x] WP-4044 contracts/OpenAPI common-module SSOT implementation-state drift cleanup(codex 提案 SELF-SCAN-20260709-24、SSOT整合)
  - 発見根拠: `@yrese/contracts` は WP-2008 で `/patients/search` 契約、WP-4019 で zod 正本→OpenAPI 3.1 生成と `pnpm check:openapi` drift gate を実装済みだが、`docs/modules/common_module_inventory.md` と `docs/modules/common_module_boundary.md` はまだ「health のみ」と記載し、`docs/modules/validation_schema_policy.md` も contract drift を「将来 CI 検査」と記載している。
  - 目的: API契約・OpenAPI生成の実装状態を共通モジュールSSOTへ反映し、以後の contract-first WP が古い「healthのみ / drift検査未実装」前提で計画されることを防ぐ。
  - 解消根拠: WP-4043/6c5aa61 に統合。MOD-001/002/012 で `@yrese/contracts` を health/error/patients/search/whoami + OpenAPI 3.1生成済みへ更新し、MOD-003 で contracts→shared-kernel 依存も反映。
  - 想定スコープ: `docs/modules/common_module_inventory.md`, `docs/modules/common_module_boundary.md`, `docs/modules/validation_schema_policy.md`, 必要なら `docs/ssot_index.md`。SSOT改版が必要なため fable5 裁定後に実施。
  - 検証: `rg -n \"health のみ|contract drift は将来|OpenAPI 生成\" docs/modules`, `pnpm check:ssot-index`, `git diff --check`。

- [x] WP-4045 API-001 contracts/shared-kernel dependency policy cleanup(codex 提案 SELF-SCAN-20260709-25、fable5正式アサイン範囲)
  - 発見根拠: WP-4042 で `@yrese/contracts` は `whoamiResponseSchema` の PermissionScope 検証のため `@yrese/shared-kernel` へ依存し、MOD-001/003/012 もそれを反映済み。一方 `docs/api/patient_search_contract.md` はまだ「contracts → shared-kernel 依存は追加しない」と記載していた。
  - 目的: API-001 と MOD-003/MOD-012 の依存方針を整合させる。fable5裁定により、contracts は shared-kernel の値源・ガード(`isPermissionScope` 等)を再利用してよく、依存方向は MOD-003 に従う。
  - 実装: API-001 を v0.2.2 へ改版し、古い依存禁止文言を shared-kernel 値源・ガード再利用可の方針へ更新。契約形状・実装コードは不変更(d37963b)。
  - 検証: `rg` による依存文言確認、`pnpm check:ssot-index`, `pnpm check:boundaries`, `git diff --check`, `git diff --cached --check`。

- [ ] WP-4046 API ID wire-field validation policy decision(codex 提案 SELF-SCAN-20260709-25 の残論点、CONTRACT_CHANGE_REQUEST待ち)
  - 発見根拠: `whoamiResponseSchema` / `patientSearchResultSchema` の ID系 wire field は `z.string().min(1)` に留まり、shared-kernel の branded ID factory が拒否する空白のみ・制御文字を契約層で拒否するか未裁定。
  - 目的: fable5 が「contracts は shared-kernel ID factory/refine を再利用して ID wire field も fail-closed に寄せる」か「wire schema は plain string のまま、ID正規化は apps/api 側責務として明記する」かを裁定し、SSOTと実装を一致させる。
  - 想定スコープ: `docs/api/**`, `packages/contracts/src/whoami.ts`, `packages/contracts/src/patient-search.ts`, `packages/contracts` の否定テスト。契約意味変更を伴う場合は fable5 の CONTRACT_CHANGE_REQUEST 承認後。
  - 検証: 裁定後に `pnpm --filter @yrese/contracts test`, `pnpm --filter @yrese/api test`, `pnpm check:openapi`, `pnpm check:boundaries`, `git diff --check`。

- [x] WP-4047 Quality/Security CI scan implementation-state drift cleanup(codex 提案 SELF-SCAN-20260709-26、fable5 APPROVED_AS_WP。本WPで実装)
  - 発見根拠: WP-4009/WP-4012 で `check:secrets` / `check:deps` / `check:sbom` は package.json と CI に実装済みだが、quality/security/testing 系SSOTの一部が「未着手」「Phase 1/2でCI追加予定」のまま残っていた。
  - 目的: 実装状態の記述のみを WP-ID/commit 根拠付きで実態同期し、規律・要件・脅威判断は変更しない。
  - 実装: QUA-001 / TST-001 / SEC-002 / SEC-003 / SEC-004 を version +0.0.1。secret scan は WP-4009/a90df35、dependency scan / SBOM は WP-4012/b0ecf84+702c2f5 に同期。SAST/DAST、fixtures PHI scan、isolation/E2E/golden 等の未実装状態は維持。
  - 検証: `rg` による drift 文言確認、`pnpm check:ssot-index`, `git diff --check`。

- [ ] WP-4048 SEC-001 vulnerability/patch scan implementation-state drift cleanup(codex 提案 SELF-SCAN-20260709-27、fable5裁定待ち)
  - 発見根拠: WP-4047 で QUA-001/TST-001/SEC-002/SEC-003/SEC-004 は secret/dependency/SBOM CI 実装状態へ同期したが、SEC-001 `docs/security/security_guideline_mapping.md` の脆弱性・パッチ管理行はまだ「CI一部実装(boundary check)、scan拡充は Phase 2」と記載している。現実には `check:secrets`(WP-4009/a90df35) と `check:deps`/`check:sbom`(WP-4012/b0ecf84+702c2f5) が CI で稼働中。
  - 目的: SEC-001 の実装状態だけを WP-ID/commit 根拠付きで実態同期する。第7.0版本文未精読、管理策番号、追加SAST/DAST、定期スキャン運用などの要件判断は変更しない。
  - 想定スコープ: `docs/security/security_guideline_mapping.md`, 必要なら `docs/ssot_index.md`。status 不変、version +0.0.1、変更履歴1行。
  - 検証: `rg` による drift 文言確認、`pnpm check:ssot-index`, `git diff --check`。

- [x] WP-4012 dependency scan / SBOM CI gate(b0ecf84、addendum 702c2f5)
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

- [x] WP-4015 error_code_registry SSOT/code drift cleanup(5edb140)
  - 発見根拠: `packages/shared-kernel/src/error-codes.ts` は `KERNEL_ERROR_CODES` に `AUTH-0003` と `PAT-0001` をseed済みだが、`docs/modules/error_code_registry.md` はまだ `AUTH-0003` を「ErrorCodeRegistry 未登録」と記載し、API-001で実装済みの `PAT-0001` 行もない。
  - 目的: error_code_registry SSOTを実装済みseedと同期し、以後のAPI実装が古い台帳を根拠に誤ったCODEX_PLANを出さないようにする。
  - 想定スコープ: `docs/modules/error_code_registry.md`, 必要なら `docs/modules/common_module_inventory.md` / `State.md` の状態記述のみ。
  - 検証: `rg -n "AUTH-0003|PAT-0001|未登録|要整備" docs/modules/error_code_registry.md packages/shared-kernel/src/error-codes.ts`, `git diff --check`。

- [x] WP-1012 shared-kernel isClaimable fail-closed conversion(41d5113)
  - 発見根拠: opus4.8 レビューで deny-list 方式の `isClaimable()` が未知ステータスを請求可として扱う fail-open を検出。
  - 目的: `CLAIMABLE_SAFE_STATUSES` allow-list 方式へ転換し、未知ステータス・未承認ステータスは請求不可にする。
  - 解消根拠: `packages/shared-kernel/src/status.ts` / `kernel.test.ts` で実装・回帰テスト固定。全112 tests + boundaries verified。

## v0.2.0 レセコンベンチマーク反映(ユーザー提供調査 2026-07-09)

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

## v0.2.0 統合ベースライン計画(2026-07-09 受理)

0.2.0正本へ集約した会計・領収証・Integration Hub・JAHIS・開かれたレセコン・算定エンジン深化の実行計画。既存承認済みSSOT・実装は維持し、0.2.0正本を根拠に不足範囲を追加する。
ディレクトリは既存規約 docs/<domain>/ を維持し、構築プロンプト上の表記差分は本規約へ読み替える(PRC-007 に既録)。

### 充足状況マッピング

- ベンチマーク: **一部充足**(PRD-004/005 済み)→ 不足分: ORCA会計思想・POS/セルフレジ製品・API公開性/標準規格対応の観点追加 + derivative_feature_inventory + mvp_feature_prioritization
- 算定エンジン深化: **一部充足**(CAL-005〜008 PROPOSED・opus4.8レビュー中、WP-0024〜0030 計画済み)→ 不足分: calculation_pipeline / canonical_prescription_model / master_resolution_policy / material_fee_policy(fee_item_registry・drug_fee 等は既計画)
- 会計・収納・領収証・日計・POS・施設請求: **全面新規**(Calculation/Claim/Accounting/Receipt/POS の5領域分離、append-only ledger、一部入金MVP必須)
- Integration Hub モジュール化: **新規**(API-001/contracts の実績を基盤に拡張)
- JAHISフル対応: **新規**(Applicability Matrix 方式。全標準の無差別実装ではない)
- 開かれたレセコン: **一部充足**(OPS-011 portability / MOD 公開SSOT)→ 不足分: sandbox・SDK・開発者ポータル方針

### v0.2.0 統合停止条件(即時有効)

- 会計SSOT(17文書)未承認のまま会計・未収・領収証・入金APIを実装しない
- JAHIS Applicability Matrix / full support definition / conformance test 未整備で「JAHIS対応」を名乗らない(BLOCKED_JAHIS_CONFORMANCE_REVIEW)
- 未入金額を領収済み表示する設計を禁止 / LOCAL_ONLY会計の同期・重複防止未設計での実装禁止
- 外部ベンダー直接DBアクセス禁止 / undocumented API 本番利用禁止

### 新規SSOT WP

- [x] WP-0033 会計SSOT 11文書(docs/accounting/: domain_model / patient_receivable / payment_allocation / partial_payment / refund_adjustment / ar_status_registry / daily_cash_closing / payment_method_registry / pos_integration / facility_billing / accounting_audit_log)— append-only ledger・状態機械(PatientReceivable 10状態 / Payment 10状態)・一部入金・割当順序(4780ded、status PROPOSED・opus4.8レビュー待ち)
- [x] WP-0034 領収証SSOT 6文書(docs/receipt/: issuance / numbering / reissue_cancel / statement_issuance / template_registry / privacy)— 領収証=入金事実対応・明細書=算定基礎項目の分離、再発行表示・交付履歴・0円時明細書【要確認】(06c8a35、status PROPOSED)
- [x] WP-0035 JAHIS SSOT 8文書(docs/jahis/: applicability_matrix / full_support_definition / adapter_inventory / version_watchlist / conformance_test_plan / character_encoding_policy / code_mapping_policy / roundtrip_test_policy)(5d73a20、status PROPOSED)
- [ ] WP-0036 Integration Hub SSOT 11文書(docs/integration/: hub_architecture / partner_registry / data_sharing_module_inventory / data_sharing_policy / api_scope_registry / webhook_event_catalog / idempotency_policy / partner_sandbox / contract_test_policy / data_portability / adapter_registry)
- [ ] WP-0037 派生機能調査+ベンチマーク拡張(docs/product/: derivative_feature_inventory / mvp_feature_prioritization + PRD-004/005 への ORCA・POS・API公開性観点追記)
- [ ] WP-0038 mvp_scope(PRD-001)0.2.0統合改版: WP-0019 を統合し、一部入金・会計台帳・領収証発行・日計をMVP必須へ、POS/セルフレジ/施設請求は境界設計のみ等を確定 → opus4.8+人間レビュー
- [ ] WP-0039 算定エンジン深化 残SSOT(docs/calculation/: calculation_pipeline / canonical_prescription_model / master_resolution_policy / material_fee_policy)— WP-0024〜0030 と統合実行

### 新規実装WP(SSOT承認後に発行、0.2.0実装レーン準拠)

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

## v0.2.0 yrese ベースライン受理(ユーザー提供 2026-07-09)

ユーザー提供の「調剤用レセプトコンピューター MVP 構築プロンプト v0.2.0」を受理し、正本として `docs/spec/construction_prompt_v0.2.0.md` に保存した。
`docs/spec/construction_prompt_baseline.md` は0.2.0正本への入口に縮約し、過去版本文・版一覧・版間優先順位規定は削除済み。

v0.2.0の最上位方針:

- プロダクト名を **yrese** とする。
- 一文定義: NSIPSを境界に追放し、イベントログを心臓に据え、品質を公開数字で証明し、APIで生態系を作る、止まらないレセコン。
- 戦う対象は NSIPS支配、低品質シェア、不安定な24時間稼働、弱い連携基盤の4つ。
- NSIPSはAnti-Corruption Layer / Legacy Adapterへ隔離し、FHIRネイティブCanonical Coreを中心に据える。
- 算定エンジンは versioned rule data + effective-dated master data + deterministic pure functions + calculation trace + golden tests + receipt validation + event-sourced facts + projections とする。
- 夜間バッチ停止を廃止し、イベントログとprojectionを中核にして24/365稼働品質を目指す。
- yrese UIも公開APIをdogfoodingし、PH-OSを最初のリファレンス接続クライアントにする。

### v0.2.0 新停止条件(即時有効)

- NSIPSの概念がCanonical Modelへ浸食している場合は停止。
- NSIPSファイル連携をコアロジックとして扱う場合は停止。
- NSIPS許諾未確認のまま互換実装を進める場合は停止。
- FHIRネイティブ方針とOfficial Adapter境界が未定義の場合は停止。
- 公式仕様をFHIR内部モデルで勝手に置き換える場合は停止。
- 算定ルールをversioned rule dataではなくコード直書きする場合は停止。
- calculation golden testの根拠が未定義の場合は停止。
- イベント再投影で確定済み請求を人間承認なしに変更する場合は停止。
- 夜間バッチのためにシステム停止を前提とする場合は停止。
- Cloud Core停止時のLOCAL_ONLY業務継続が未定義の場合は停止。
- yrese UIが公開APIをdogfoodingしていない場合は停止。
- PH-OS連携が専用裏口APIに依存する場合は停止。
- 公開KPIにPHI、薬局秘密情報、契約上非公開情報が含まれる場合は停止。
- OSS SDKに許諾上公開できない仕様情報が含まれる場合は停止。
- 監査ログの改ざん検知方針がない場合は停止。
- tenant isolationがアプリケーション層だけに依存している場合は停止。

### v0.2.0 新規SSOT WP

- [x] WP-0040 v0.2.0構築プロンプト保存: `docs/spec/construction_prompt_v0.2.0.md` を追加。
- [x] WP-0049 構築プロンプト版統一: `docs/spec/construction_prompt_baseline.md` を0.2.0正本入口へ縮約し、旧版本文・旧版優先順位・旧版見出しを削除。`docs/spec/construction_prompt_v0.2.0.md` に統合方針を集約。
- [x] WP-0041 yrese doctrine SSOT pack(6cd714e): PRD-008 製品ドクトリン / PRD-009 4つの戦い / ARC-003 NSIPS境界隔離ACL / ARC-004 Legacy Adapter S3/Lambda候補構成。全て PROPOSED(承認は PRC-007 フロー)。
- [x] WP-0042 FHIR canonical SSOT pack(4482e1e): DOM-005 canonical model ≠ FHIR 方針 / DOM-006 マッピング台帳枠組み(MAP-FHIR-####、APPROVED エントリのみ実装可)。Official Adapter の FHIR 置換は BLOCKED_OFFICIAL_ADAPTER_BOUNDARY。PROPOSED(PRD-007 と合わせて承認)。
- [x] WP-0048 JP Core/FHIR Ready 薬局データ連携基盤戦略: `docs/product/jp_core_fhir_platform_strategy.md` を追加し、電子処方箋対応とJP Core/FHIR準拠を分離。公式ソース台帳 `SRC-FHIR-001..006` を `docs/regulatory/source_registry.md` に追加。WP-0042/WP-0046の上流方針とする。
- [x] WP-0043 Quality transparency SSOT pack(cc47d59): QUA-007 証明可能性戦略 / QUA-008 公開KPI一般方針(匿名化・同意・悪用リスク5類型)/ QUA-009 返戻率KPI定義(fail-closed 集計)。外部公開の実施は BLOCKED_LEGAL_REVIEW 解除まで BLOCKED。PROPOSED。
- [x] WP-0051 ssot_index 整合性修復: 索引未登録の約50文書(accounting/calculation/domain/jahis/receipt/api/spec ほか)を検出し、frontmatter からの機械再生成で全148文書を索引化(IDX-001 v0.3.0)。索引は以後手編集しない。恒久ゲートは WP-4020。
- [x] WP-0044 Calculation event-sourcing SSOT pack: CAL-009 versioned rule data / CAL-010 純粋関数規律 / CAL-011 golden test 根拠規律 / ARC-005 ES適用境界(既定は非適用)/ ARC-006 再投影・再算定境界 / ARC-007 確定請求 immutability(append-only、訂正は返戻再請求レーン)。全て PROPOSED。
- [x] WP-0045 Always-on architecture SSOT pack: ARC-010 24/365アーキテクチャ(Cloud Core / Edge Node、SystemMode対応、zero planned downtime)/ ARC-011 夜間バッチ廃止(月次締めは NORMAL のみの明示業務操作)。SLA/SLO 数値は OPS-009 へ委譲。PROPOSED。
- [x] WP-0046 API-first platform SSOT pack(docs/api/): API-002 dogfooding 原則(抜け道 API 禁止)/ API-003 公開 API 共通土台(deny-by-default・バージョニング3段階廃止手順、PRD-007 前方参照解消)/ API-004 PH-OS リファレンス連携(特別扱い禁止)/ API-005 OSS 公開 allow-list(PHI/NSIPS/ONS/JAHIS 本文公開禁止、実公開は BLOCKED_LEGAL_REVIEW)。PROPOSED。
- [x] WP-0047 Audit/WORM tenant isolation SSOT(docs/security/): SEC-008 — 論理層規律(append-only・SEC-007 ハッシュチェーン正本・偽ハッシュ供給禁止)と物理層候補構成(S3 Object Lock/KMS/RLS は追加防御、確定は BLOCKED_SECURITY_REVIEW 解除後)を分離。break-glass は監査必須・fail-closed。PROPOSED。

### v0.2.0 既存WPへの影響

- WP-0036 Integration Hub SSOTは、0.2.0正本のOpen Rececon Platform、Partner Sandbox、Contract Test Kit、API-first dogfooding、PH-OSリファレンス連携を統合する。
- WP-0039 算定エンジン深化は、v0.2.0のversioned rule data / pure function / event re-projection / finalized claim immutabilityを追加前提にする。
- WP-2203 Integration Hub骨格、WP-2204 JAHIS Adapter、会計/領収証系実装は、上記SSOTがAPPROVEDになるまで該当範囲を拡張実装しない。
- WP-2009 audit hash-chain canonicalization / hydrate split は、`audit_worm_and_tenant_isolation_strategy.md` とSEC-007/MOD-008改版後に実装へ進める。

### 実行順序(v0.2.0)

1. WP-0041 / WP-0042 / WP-0043 を第1波として起案し、Open Rececon/FHIR/品質公開のプロダクト・境界方針を固める。WP-0042はWP-0048(PRD-007)の「電子処方箋対応 ≠ JP Core/FHIR準拠」「JP Core/FHIR Readyな薬局データ連携基盤」方針を前提にする。
2. WP-0044 / WP-0045 を第2波として、算定・イベント・24/365アーキテクチャの高リスク設計を固める。
3. WP-0046 / WP-0047 を第3波として、API-first platformと監査・テナント分離の実装前ゲートを固める。
4. 実装WPは、該当SSOTがAPPROVEDになり、fable5/opus4.8レビューと必要な人間レビューが完了してから発行する。
