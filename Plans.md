# Plans.md — Active execution board

> **AUTHORITATIVE ACTIVE BOARD (2026-08-26):** `DEVELOPMENT_POLICY.md`
> に従う。CURRENTは1件、READYは最大2件である。frozen legacy(完了済み・凍結
> 履歴)は direct user instruction 2026-07-31 により
> `Plans.legacy-archive-20260731.md` へ全量退避済みで、checkboxや旧statusに
> かかわらずclaim、assignment、current-task判断、completion判断へ使用しない。

## 0. Document Contract

- `Plans.md` は唯一のactive queueである。実装順、claimability、依存、受入条件、
  human gateはこのactive sectionだけを正とする。
- `DEVELOPMENT_POLICY.md` はwork-selection charter、APPROVED SSOTは製品・医療・
  法令・security/privacy/data-integrity authorityであり、本書は上書きしない。
- `State.md` はinterruption、blocker、human gate、uncommitted ownershipの
  pointer-only snapshotであり、通常の進捗台帳ではない。
- CURRENTはexactly one、READYはmaximum two。human-gated、completed-local、
  deferred、archivedはREADYへ数えない。
- completed evidenceはGit/CIへ委ねる。frozen legacyは全項目を
  `FROZEN / GIT_HISTORY_ONLY / NONCLAIMABLE`として一括分類し、
  `Plans.legacy-archive-20260731.md`(non-HEAD provenance の保全先)へ退避済み。
  active parser、task selection、completion判定から除外する。
- 本書のsole editorは `AGENTS.md` の `active_root_writer` である。書込み前に
  `git status --short --branch` と外部変更を再確認し、owned exact pathだけを変更する。
- 節番号は本書の物理順と一致させる。番号と順序が食い違った状態を放置しない
  (読み手がどの節が現行かを判断できなくなるため)。
- 完了済みreviewの逐次記録・round-by-roundのfinding表・承認済みSSOTの
  決定内容の複製を本書へ残さない。前二者はGit履歴、後者はAPPROVED SSOT本文が
  正本である。approval-facing recordをSSOTから複製したことが、WP-4250 round 2〜3で
  3ラウンド連続のHIGHを生んだ直接原因である。

## 1. Current Planning Snapshot

| Field | Current evidence |
|---|---|
| Review base | local `main` = `origin/main` = `02027c1`(2026-09-16 ユーザ指示で fast-forward merge + push + 全非 main ブランチ削除済み)、current branch = `main`。実測 2026-09-16 JST |
| Candidate branch | なし(作業ブランチ `refactor/wp-5275-failure-proof-describe-failure` は main へ取込後に削除)。WP-5275は`c3a0829`、WP-5276は`a463fac`、WP-5277は`011ac26`、WP-5278は`6d005ee`、WP-5279は`ad3aec2`、WP-5280は`b6d38e6`、WP-5281は`24319bf`へ着地済み(全て main の祖先) |
| Upstream relation | local `main` = `origin/main`(2026-09-16 ユーザ指示で push 済み)。deployは行わない |
| Candidate scope | WP-5279: 15領域監査で確認した低リスク範囲のうち、active snapshot、清掃・秘密スキャン境界、UIのARIA/患者識別子露出、処方下書き通信のtimeout/abort/再取得、依存監査の通信障害判定、local ComposeのPostgreSQL 17系digest固定を修正済み。認証、DB/migration、永続化/idempotency、observability、PHI/retention、backup/DRは対象外のまま。WP-5281: リポジトリ横断監査の確定 finding を修正 — pooled tx settle probe、postgres 構成 guard、eligibility idempotent retry、text 照合のコードポイント parity、queue reload force、draft conflict 維持、疎配列 fail-closed、秘密 scan・清掃・境界 script 強化 |
| Last update | 2026-09-16 JST(repository-wide audit で確定した不具合を修正し、workspace typecheck、unit tests(api 1,009 / web 763 / calculation 121 / shared-kernel 87)、embedded PG 18.4 実DB integration 81 tests、`test:scripts`、`check:boundaries`/`check:calculation-purity`/`check:secrets`/`check:deps`(high=0/critical=0)/`check:sbom`(249)/`check:ssot-index`(185)/`check:openapi`、`git diff --check`をPASS。独立 adversarial review は finding 0 で PASS。WP-5281は`24319bf`+本record commitへ着地) |
| C-100 review evidence | read-only independent context `wp5101_human_authority_map`; frozen exact3 SHA-256 `cdc6ac3ff79c78fd5e19d2a1b5aa990ac39c50a287d3f8f6fedb137ea211c4cf`; `git diff --check` PASS; findings 0; landed commit `9786fe8` |
| Active Goal | 2026-09-15 runで、15領域の全項目を監査し、仕様根拠のある安全な項目は修正・検証し、承認が必要な項目は未完了ゲートとして明示する |
| Current critical path | human/security/privacy/data-integrity gateが必要な残件の承認または明示的な未実施受入。高リスク項目はゲート成立後に別WPで再計画 |
| Main blocker | tenant/system認可、append-only DB/migration、下書きserver autosave/idempotency、structured observability、PHI/retention、backup/restore/DR、lint/fixture policy、PostgreSQL major version alignmentは、仕様・運用・人間/security/privacy/data-integrity gate待ち。Composeの17系mutable tagはdigest固定済み |
| Required verification | current diffのfocused test、`pnpm test:scripts`、`pnpm check:deps`、`pnpm check:secrets`、static gates、workspace typecheck/test/build、`docker compose config`、`git diff --check`を確認する。DB migration/apply、production、browser/AT、backup/restore、CI実行は未実施のまま成功扱いしない |
| Current CSS budget | 2026-08-27 human instruction「css予算上限を緩和」により、今後のcompiled CSS gzip上限を12 KiB(12,288 bytes)へ再設定。source separate-file gzip非増加、pixel一致、CLS非増加は緩和しない |
| Work-selection drift | CURRENTは0件、READYは0。WP-5279以前の実装記録はGit evidenceとして扱い、15領域の未解消ゲートを実装済みと数えない |
| Next scan cursor | `origin/main=c3a0829`; remote main更新またはfinal gate findingでreset |

実装証跡はGit diff/commit/CIを正本とし、本書へself-referential candidate hashを複製しない。
current batchはWP-5279の安全なcomplete slice消化で、current WIPは0件である。WP-5277は`011ac26`、WP-5278は`6d005ee`、
WP-5279は`ad3aec2`へ着地済み。migration 000013を含む環境適用、push、deploy、production変更、risk/release acceptance、外部状態変更は行わない。
ユーザー承認済みの公式JP Core packageについては、保存せずhash/sizeだけを再確認した。

### 1.1 Seven-day execution plan (2026-09-13〜2026-09-19 JST) — 履行済み・歴史記録

> 本表の実装対象(WP-5279〜5281)は全件着地済み。以後の work selection は §18(調剤レセコン
> 機能ギャップのロードマップ)と §16 の依存順序に従い、本表を claim 根拠にしない。

過去のGit履歴(WP-5101のdraft縦切り、WP-6003〜6006の連携基盤、WP-5271〜5278のhardening/refactor)とlive codeを突合した。
本runではWP-5279だけを実装対象とし、仕様・人間承認・外部手続き待ちの項目は実装済みと数えない。

| 日 | 実装 / 検証項目 | 完了条件 | 状態 |
|---|---|---|---|
| 9/13 | WP-5276の技術受入整理 | 実装をやり直さず、レビュー対象・ゲート対象・未commit所有・DB不可を分離 | 完了(Astra PASS・Oracle計画レビュー完了) |
| 9/14 | 既存draftのroute／service契約検証 | CAS、tenant／pharmacy／scope拒否、terminal reception拒否、受付→患者→draft紐づけを全suite内で再確認。DB-gated 3 files / 63 testsは未実施扱い | 実施済み(API 997 PASS / Web 754 PASS) |
| 9/15 | syntheticな受付→draft API／Web縦切りの確認 | 保存・再取得・競合時の非上書き、既存read audit／非漏洩境界を確認。薬剤師確定や完全なNorth Star E2Eとは呼ばない。migration 000013はsource確認のみ | 実施済み(API 155 PASS / Web 209 PASSの縦切りsuite、DB-gated 63 skip)。同日、human instructionでWP-5277着手を認可 |
| 9/16 | FHIR前提の判断packet整理 | JP Core hashは再取得・一致を確認済み。SSOTのVERIFIED昇格、mapping／ownership、単一writerの未充足条件は区別し、FHIR routeは実装しない | packet整理済み・人間判断待ち(JP Core hash一致・REG-001はPROPOSED維持・単一writer未充足条件を区別済み。実装なし) |
| 9/17 | 15領域監査の確定不具合・懸念をfinite queue化 | 再現根拠・scope・受入条件・停止条件・着手認可・WIP整理が揃った低リスク項目だけ修正。高リスクはgate待ち | 実施済み(WP-5279でroot boundary、UI状態/PHI、draft通信、dependency gateを修正。tenant認可、DB、durable recovery、observability、DRは別gateへ分離) |
| 9/18 | 最終候補に必要なゲートを集約 | 実行コード・依存・環境に変更があった場合だけ関連回帰と全体gateを実施。同一候補の既存PASSは再利用し、SKIPをPASSへ変えない | WP-5279の全体validation・frozen独立reviewを完了。browser/DB/restore/CI未実施は未実施のまま記録 |
| 9/19 | 最終判断・引継ぎ | 技術受入、未commit、未実施検証、human gateを分離。Plansはactive情報、Stateはpointerのみ。未認可のcommit／push／deployはしない | WP-5279はhuman commit認可により`ad3aec2`+本record commitへ着地。残件はhuman/security/privacy/data-integrity gate待ち |

薬剤師確認・確定(C-061以降)、FHIR facade、JAHIS/オン資/外部partner接続は今週の実装対象に昇格させない。前提gateが成立した時点で別WPとして再計画する。

## 2. Product and Architecture Guardrails

- 6–12 week North Star: synthetic patient search/selection → paper reception →
  manual prescription draft → pharmacist confirmation → immutable audit evidence.
- Current reachable runtime includes health/whoami, patient search/get, paper reception
  queue/create, audit read, and the bounded server-saved prescription draft API/Web flow.
  This local integration does not establish production/release readiness or pharmacist confirmation.
- Current persistent authorities include PostgreSQL `patients`, `reception_entries`,
  bounded prescription draft tables, and `audit_events`.
- Patient and MedicationRequest must have one writer. No dual write, hidden
  multi-master, automatic fallback, or conformance claim is permitted.
- Tenant/pharmacy/actor/scope must come from authenticated trusted context.
  Production authentication, qualification, runtime-role, and RLS proof remain
  release gates; development headers are not production authority.
- Reception/audit/outbox atomicity, clinical version history, immutable audit,
  evidence-backed calculation, and PHI-free logs/URLs fail closed.

## 3. Active Queue

### WIP — exactly one

**CURRENT は 0 件である。** WP-5280は`b6d38e6`、WP-5281は`24319bf`へ着地済み(実装+
独立 review PASS、後述の Historical 節を参照)。READYは0件である。reception wallClock意味論、FHIR
provenance/mapping、薬剤師確認・確定、その他の高リスク項目はgate待ちでpark継続。

### Historical landed WIP — WP-5281 Repository-wide audit finding remediation

repository-wide audit の確定 finding を修正した。推測・LOC 削減のみの変更は実施しない。

- **Scope(確定 finding のみ):** pooled transaction の callback 後 settle probe
  (`pg_current_xact_id_if_assigned` + 安全側 ROLLBACK + 検証不能時 client 破棄)、
  postgres mode で `receptionCreateCommand` 未指定を拒否(in-memory unit-of-work への
  silent fallback 遮断)、eligibility snapshot の idempotent retry を全 payload field 比較化
  (retry 時計 `now` は除外)と PK 衝突の domain error 化、user-facing text ソートの
  `COLLATE "C"` と in-memory コードポイント比較の parity(U+E000 vs U+10000)、
  reception queue の mutation 後 reload を `force` 化(mutation 前に開始した in-flight
  fetch への join を遮断)、処方下書きの server-conflict 状態を編集後も維持し draft
  response の identity 検証を追加、`isClaimable` と step-result 検証で疎配列 hole を
  fail-closed、結果の未知 field・負点数拒否・警告 dedup、secrets scan の in-root
  symlink/未 tracked protected root skip(out-of-root・dangling は引き続き abort)、
  clean.mjs の lstat guard、boundary check の `..` 接頭辞 directory 偽陰性修正・
  manifest 駆動 app 名・深い `aws-sdk/` import 検出・non-src package file 走査、
  purity check の qualified `parseFloat` 検出。
- **Out of scope:** tenant/system 認可、DB/migration 適用、durable recovery、
  observability sink、PHI retention、backup/restore/DR、FHIR、薬剤師確認・確定は
  引き続き gate 待ち。PostgreSQL major version alignment も未解消のまま。
- **Validation:** workspace typecheck;unit tests(api 1,009 / web 763 /
  calculation 121 / shared-kernel 87);embedded PostgreSQL 18.4 上の実 DB
  integration 81 tests(全 file PASS);`test:scripts`、`check:boundaries`、
  `check:calculation-purity`、`check:secrets`、`check:deps`(high=0/critical=0)、
  `check:sbom`(249)、`check:ssot-index`(185)、`check:openapi`、`git diff --check`。
- **Status:** 実装・検証・独立 adversarial review 完了。critical finding 0。
  WP-5280 で記録した `check:secrets` の tracked symlink `CLAUDE.md`→`AGENTS.md`
  既存不具合は本 WP の secrets-scan 修正で解消。
- **Landed:** `24319bf`(実装 39 paths)+本 record commit(Plans.md/State.md)。

### Historical landed WIP — WP-5280 Calculation finding remediation

ユーザ指示 2026-09-15「これらを改善する計画を立ててから実装」により、WP-5279 分離記録の
Oracle review で確定した finding を修正した。claimable 経路・算定要件判定・API/DB 配線は
対象外のまま(`POINTS_ONLY_COPAY_BLOCKED` / `claimable=false` 固定を維持)。

- **Risk / review:** 算定 logic・evidence_id 付き領域のため R3 相当で扱う
  (sole maintainer + maker≠checker の独立 verifier)。実装後、frozen diff への Oracle
  独立 review を完了条件とし、critical finding は閉じる。
- **Owned paths:** `packages/calculation/src/index.ts` / `formulas.ts` /
  `calculation.test.ts` / `formulas.test.ts`、`packages/money/src/index.ts`(+ test)、
  `Plans.md` / `State.md`。`packages/trace`・SSOT 文書は変更しない。
- **Scope(Oracle 確定 finding のみ):**
  1. A1 — `formulas.ts` の数量/点数中間演算を bigint 化
     (`Points.fromInteger` は bigint 受入済み)。`perSevenDayUnits` を
     `(BigInt(d)+6n)/7n` で計算し巨大入力の RangeError を解消。
  2. F1 — `createFixedPointsRule` に `exclusivityGroup`/`effectiveTo` 引数を追加し、
     `dispensingBasicFee1Rule` へ `{groupId:"dispensing-basic-fee", evidenceRef:EVD-CAL-0001}`。
  3. A2 — 湯薬・一包化の段階別ルールへ対象単位排他
     (`groupId` に `...:${applicationKey}` を含め、別対象の正当複数適用は維持)。
  4. F4 確定分 — 指導料1↔2(「1以外の患者」台帳文言)を同一 group、
     調剤管理料1イ↔ロ(「イ以外」)を剤単位 group。料2-vs-料1 と C2 の非対称排他は
     `exclusivityGroup.blocksGroupIdPrefixes`(任意フィールド)の最小機構拡張で順序非依存に
     実現: 料2 は `dmf-1:` 接頭辞を block、逓減は `drug-fee:` 接頭辞を block。
     表現不能分(指導料3/4・支援料1/2 の台帳未確定ペア)は排他を付与しない。
  5. F3 — EVD-CAL-0070/0071 に `effectiveTo=CalendarDate.fromString("2027-05-31")`。
  6. F2 — `createRegionalSupportSystemAdditionRule` に variant 引数を追加し、
     特別Aは `10/100` 乗率経路(全 level 非整数 → `requires_rounding_evidence` で
     BLOCKED。推測丸めしない)。
  7. A3 — factory 入口で入力値を snapshot(説明/output 用に文字列化して保持)。
     `DISPENSING_BASIC_FEE_BASES` の深い freeze、`Points`/`ScaledDecimal`/`Yen` の
     実行時 freeze(money package)。
  8. A4 — `composeDispensingBasicFeePoints` で `minimumPoints` 非負を検証、
     自家製剤 switch に `default` 拒否を追加。
  9. A5-lite — step の `output` に `applicationKey=` を付与し、重複/上限/排他拒否で
     専用 blocked step を追加(既存の trace 語彙内・新規 field は追加しない)。
     自家製剤の `output` に daysSupply/prePrepared 値を残す。
  10. C1 — `validateStepResult` が `ITEM_CALCULATED && affectsClaim!==true` を拒否
      (合算される正点数は全て claim-affecting → trace 層の evidence 強制に接続)。
  11. F6 — index.ts:1109 の dangling 参照を CAL-004 §8 へ修正、demo 束に
      provisional 注記、`ruleStep` を freeze 統一。
- **Out of scope(コード不変・gate 送り):** C3 「7日又はその端数」の単位定義
  (原本再照合 P-01〜P-04 で確定まで変更禁止)、C4 適用日基準の CAL-003/CAL-004 不整合
  (PRC-007 改版候補)、F5 frequency_limit・0035/0036 混在上限の集計単位(SSOT 確定待ち)、
  A5 構造化 trace field(CAL-008 改版事項)。`calculationRulesV20260601` の
  rename は破壊的 export 変更のためコメント注記に留める。
- **Acceptance:** 各 finding に回帰 test を追加(成立ケース→BLOCKED、単独適用→従来点数維持、
  境界日、入力後変更の不感性)。`packages/calculation`・`packages/money` の全 test、
  workspace typecheck、`check:calculation-purity`、`git diff --check` PASS。
  frozen diff の独立 review で確定不具合 0。
- **Rollback / stop:** owned exact path の差分のみ保持。`blocksGroupIdPrefixes` が
  review で SSOT 改版相当と判定された場合はその部分のみ切り戻し、対称 group で
  表現可能な範囲(F1/指導料1-2/料1イ-ロ/A2/C2 部分)で着地する。算定要件の推測実装、
  rounding evidence の捏造、claimable 化は行わない。
- **Status:** 実装・検証・独立 review 完了。frozen packet v1(diff SHA-256 `671c090e…a117f`)は
  Oracle `wp5280-impl-review` で CHANGES_REQUESTED(疎配列 shape 検証の不備 +
  A3/両順序/限定prefix の回帰テスト不足の2件)。修正後 v2(`8bff3685…b1e8`)で
  `wp5280-impl-review-v2` PASS、非ブロッキング補足(prefix 曖昧境界 pin・許容逆順序)を
  反映した v3(`1010e9da…0d10d`)で `wp5280-impl-review-v3` PASS。critical finding 0。
  計算出力は引き続き `claimable=false` 固定。**`check:secrets` は clean HEAD でも
  tracked symlink `CLAUDE.md`→`AGENTS.md` で scope error となる既存不具合を確認済み
  (本 diff 起因でない。gate script 修正は別WP候補)。**
- **Landed:** `b6d38e6`(実装 5 owned paths)。C3・C4・F5・A5 構造化 field・F2 丸め
  evidence 本体は deferred/gate 送りのまま。`check:secrets` の CLAUDE.md symlink 既存
  不具合は別WP候補として記録。

### Historical landed WIP — WP-5279 Root maintenance and safe failure-boundary slices

- **Purpose / layer:** active Plans/State snapshotを実測Gitへ同期し、清掃・秘密スキャン境界、UIのARIA/患者識別子露出、処方下書き通信のtimeout/abort/再取得、依存監査の通信障害判定を最小差分で是正する。算定・法令logic、DB schema、認証モデル、durable recoveryは変更しない。
- **Allowed files:** `Plans.md`、`State.md`、`compose.yaml`、`scripts/clean.mjs`、`scripts/check-secrets.mjs`、`scripts/check-scripts.mjs`、`scripts/check-deps.mjs`、`apps/web/app/admin/admin-dashboard.tsx`、`apps/web/app/checkout/checkout-context.test.tsx`、`apps/web/app/components/clinical-alert.test.tsx`、`apps/web/app/components/clinical-alert.tsx`、`apps/web/app/components/domain-status-badge.tsx`、`apps/web/app/components/error-notice.test.tsx`、`apps/web/app/components/error-notice.tsx`、`apps/web/app/components/patient-header.tsx`、`apps/web/app/cross-cutting-state.test.tsx`、`apps/web/app/error.tsx`、`apps/web/app/patients/patient-search.test.tsx`、`apps/web/app/prescriptions/[receptionId]/page.tsx`、`apps/web/app/prescriptions/prescription-draft-persistence.test.ts`、`apps/web/app/prescriptions/prescription-draft-persistence.ts`、`apps/web/app/prescriptions/prescription-launch-route.tsx`、`apps/web/app/prescriptions/prescription-reception-boundary.tsx`、`apps/web/app/prescriptions/prescription-workspace.tsx`、`apps/web/app/reception-dashboard.test.tsx`、`apps/web/app/reception-prescription-launch.tsx`、`apps/web/app/status/visual-status-registry.test.tsx`、`apps/web/app/status/visual-status-registry.ts`、`docs/ui-ux-refresh/08-target-design-direction.md`、`docs/ui-ux-refresh/12-component-contracts.md`。protected untracked roots、生成artifact、DB、`.env`は変更・参照しない。
- **Authority / risk:** AGT-018、PRC-003、PRC-005、SPEC-002、既存の15領域監査 evidence、UIX-001の既存契約。R1/R2のfilesystem、UI state、request failure、dependency-supply-chain boundary。Oracleは明示送信許可リスト不足で未実行。security/auth、privacy、data-integrity、migration、production gateはこのWPの範囲外。
- **Acceptance:** (A1) active snapshotがcurrent branch/HEAD/local main/origin main/ownershipを一致表示。(A2) `clean.mjs`は`apps`/`packages`内の生成物だけを一時rootで削除し、保護rootのsentinelを保持。(A3) `check-secrets.mjs`は既知の未追跡保護rootを降下せず明示報告し、同名のtracked contentと通常のignored `.env`は従来どおり検査。(A4) 非blocking ERRORは`status`/polite、blocking ERRORは`alert`/assertive、患者IDはDOM属性へ出さない。(A5) draft load/save/reloadはcaller abortと30秒timeoutを分類し、再取得操作を提供する。(A6) registry/network errorの依存監査はunverifiedでexit 1。(A7) syntax、focused/full applicable tests、typecheck、static gates、secret/dependency scan、diff checkがPASS。(A8) local ComposeのPostgreSQL 17系は検証済みimmutable digestを使用し、major versionは変更しない。
- **Rollback / stop:** 未commitのowned exact path差分を戻せる状態で保持する。新たなtracked/production/PHI/DB/auth scope、保護rootの読み取り要求、secret/dependency coverageの不明確化、draft idempotencyやdurable persistenceが必要と判明したら停止し、未検証扱いにする。
- **Status:** LANDED `ad3aec2` / validation PASS / Compose pin added / final exact-hash independent review PASS。commitはhuman認可済み、push/merge/deployは行わない。高リスク監査findingは下記の別gate/別WP候補として記録し、WP-5279の完了条件に混ぜない。

#### WP-5279 分離記録 — 点数計算 package の read-only 監査 finding(2026-09-15・別WP候補。claimしない)

ユーザ指示「点数計算ロジックを重点レビュー」に対する read-only 監査の確定 finding。
対象は `packages/calculation/src/formulas.ts`(330行)、`index.ts`(1861行)、
`calculation.test.ts` + `formulas.test.ts`(90件・実測全 PASS)、および根拠 SSOT
CAL-001/CAL-003/CAL-004/CAL-005/CAL-006/CAL-010・MOD-010。`apps/` に consumer は存在せず、
`calculate()` は copay evidence 未発行により常に `POINTS_ONLY_COPAY_BLOCKED`
(`claimable=false`)を返すため、現時点の blast radius は表示値の誤りまでである。
ただし claim 配線前の must-fix 候補群であり、算定 logic 変更は R2+ 独立 review 対象、
charter 上 P3 DEFER・CAL-001 解除手順(APPROVED_FOR_IMPLEMENTATION 未達)の管理下にある。
**本記録は claim ではなく、READY 昇格と risk 分類を経るまでは着手しない。**

監査で正しさを確認済みの領域(反証なし): IEEE-754 不使用・bigint/ScaledDecimal
演算(MOD-010)、端数は丸めず `requires_rounding_evidence` → BLOCKED、StepResult の
unknown-field/負 itemPoints/instanceof 検証、effectiveFrom/effectiveTo・duplicate・
maxApplications・exclusivityGroup の各ガード、`affectsClaim`⇒evidenceRefs 必須の実行時
throw、warnings 重複排除と必須 warning 付与、`check:calculation-purity` による
`Date.now`/`new Date`/`Math.random`/`parseFloat`/`Math.round` の静的拒否。

##### F1 — 調剤基本料の排他バイパス(確定不具合)

- **重要度:** MEDIUM(claimable=false で封じ込め済み。claim 配線時は誤請求経路)
- **箇所:** `packages/calculation/src/index.ts` — `dispensingBasicFee1Rule`(620-627)、
  `createDispensingBasicFeeRule`(979-1064)、`calculationRulesV20260601`(1721-1727)
- **成立条件:** `dispensingBasicFee1Rule`(`exclusivityGroup` 非宣言、
  `applicationKey="prescription"`)と `createDispensingBasicFeeRule({base: FEE_2})`
  (applicationKey `"dispensing-basic-fee"` + exclusivityGroup)を同一 ruleset に入れると、
  ruleId/applicationKey が別物で重複・排他のいずれにも抵触せず、47+30=77点が
  blocker なしで合算される。出荷済み `calculationRulesV20260601` がこの bypass 可能な
  旧式固定ルールを内包している。
- **根拠:** exclusivity 判定は StepResult の `exclusivityGroup` 宣言がある場合のみ発火
  (index.ts 1839-1846)。旧式 `createFixedPointsRule` 経路は同 field を持たない。
- **最小修正案:** (a) 基本料の生成経路を `createDispensingBasicFeeRule` に一本化し
  `dispensingBasicFee1Rule` を廃止、(b) `createFixedPointsRule` に exclusivityGroup
  引数を追加し基本料ルールへ適用、のいずれか。同一 evidence 系列(区分00)の
  「1受付1区分」を engine 不変条件として扱うかは CAL-004/005 側の確認事項。
- **確認方法:** `[dispensingBasicFee1Rule, createDispensingBasicFeeRule({base:FEE_2})]`
  で total=77・blocker なしになる回帰 test(現状再現)→ 修正後は exclusivity BLOCKED。

##### F2 — EVD-CAL-0009 特別調剤基本料A variant 未実装(確定 gap)

- **重要度:** MEDIUM(同上。SPECIAL_A 薬局で過大算定)
- **箇所:** `createRegionalSupportSystemAdditionRule`(index.ts 1121-1133)、
  evidence `docs/calculation/evidence_register.md:74`
- **成立条件:** evidence 文言は「27/59/67/37/59点(特別調剤基本料A薬局は100分の10)」。
  実装は満額固定のみで、特別A薬局における逓減(100分の10)を表現する経路が存在しない。
  SPECIAL_A 基本料と併用しても満額が算定される。なお「100分の10」の母数
  (加算の所定点数か基本料か)は evidence 文言が曖昧で、解釈確認が前提。
- **最小修正案:** variant 入力(特別A薬局フラグ)を追加し 100分の10 乗率経路を用意
  (端数は既存の requires_rounding_evidence 規律に従う)。母数解釈は CAL-002/留意事項
  通知で確定させる。
- **確認方法:** SPECIAL_A + level1 で満額27点が出る現状 test → 修正後は 100分の10 結果。

##### F3 — EVD-CAL-0070/0071 の effectiveTo 未設定(確定 gap・時限爆弾)

- **重要度:** LOW→MEDIUM(現時点では正しい値を出すが、2027-06-01 以降に stale 化)
- **箇所:** `dispensingBaseUpEvaluationFeeRule` / `dispensingPriceResponseFeeRule`
  (index.ts 1701-1719)、evidence `evidence_register.md:165-166`
- **成立条件:** evidence は「令和9年6月以降は所定点数の100分の200」。両ルールは
  `effectiveFrom=2026-06-01`・`effectiveTo` 未設定で、2027-06-01 以降も 4点/1点を
  出し続ける。CAL-006 §3.1 の失効ガード機構が存在するのに未適用。
- **最小修正案:** `effectiveTo=2027-05-31` を設定し、2027-06 版は evidence 発行後に
  別ルール(乗率型)として追加。少なくとも失効日の設定で stale 出力を機械的に止める。
- **確認方法:** dispensingDate=2027-06-01 で当該ルールが BLOCKED になる test。

##### F4 — 相互排他カテゴリの exclusivityGroup 未宣言(確定 gap・機構不足を含む)

- **重要度:** MEDIUM(同上。caller 選択ミスで silent 二重算定)
- **箇所:** 服薬管理指導料1/2/3/4(index.ts 1322-1359、650-657)、
  外来服薬支援料1/2(1484-1492、818-839)、調剤管理料1/2(1238-1262、641-648)
- **成立条件:** これらは患者条件・施設基準により択一のカテゴリだが exclusivityGroup を
  宣言せず、同一 ruleset に複数入れると合算される(例: 指導料1 45点+指導料2 59点)。
- **根拠/限界:** 現行機構は ruleset 全体で一意な `groupId` のみ。「1以外の場合」
  (調剤管理料2)や剤単位の条件付き排他は表現不能で、機構拡張か caller 側仕様
  (CAL-004/005)の確認が前提。
- **最小修正案:** 少なくとも同一処方箋で択一が明確なカテゴリへ groupId を付与。
  条件付き排他が必要なら exclusivity 機構の拡張設計を SSOT 側で確定してから実装。
- **確認方法:** 排他ペア同時適用で exclusivity BLOCKED になる回帰 test。

##### F5 — 頻度キャップの宣言不統一と構造的限界(確定 gap + 設計課題)

- **重要度:** LOW(同一 calculate 呼出し内でのみ観測可能)
- **箇所:** 宣言あり — EVD-CAL-0018/0046/0057(`claim-month`+maxApplications=1)、
  0063(`patient`+1)、0059 各 variant(maxApplications=1)。未宣言 —
  0050/0052/0065(6月に1回)、0051/0071(3月に1回)。
- **成立条件:** 未宣言ルールは同一呼出し内で applicationKey を変えて複数適用可能。
  受付横断の頻度判定(月1回/6月に1回等)は `CalculationRequest` に履歴・施設基準
  snapshot が存在せず構造的に表現不能(CAL-005 §4 の `priorCalculationHistoryRef`/
  `FacilityBasisSnapshotRef` が contract に未導入)。
- **最小修正案:** 同一呼出し内の防御として未宣言系へ maxApplications=1 を付与。
  受付横断の頻度判定は snapshot 入力の contract 拡張(SSOT 影響)として別途設計。
- **確認方法:** 同一 ruleId で applicationKey 違いの2適用が BLOCKED になる test。

##### F6 — 軽微(任意改善)

- index.ts 1108-1109「(下部コメント参照)」は dangling — 対象外項目の説明コメントが
  ファイル末尾に存在しない。参照先を削除するか注記を実体化する。
- `ruleStep`(306-320)のみ `Object.freeze` 漏れ(他の step builder は frozen)。
- `calculationRulesV20260601` は正式版付き名だが任意の5件デモ束(施設訪問の指導料3を
  含む点も不自然)。demo 用途を名前または doc で明示する余地。

##### 本来の unblock(human/external gate)

留意事項通知精読(P-06)、原本再照合(P-01〜P-04)、修正版確認(P-08)、
golden test 作成→opus4.8 相当レビュー→CAL-001 行 status の APPROVED_FOR_IMPLEMENTATION
昇格。これらなしに算定 workflow 実装へ進まない。

##### Oracle 独立 review 結果(2026-09-15・session `wp5279-calculatio-review`)

browser engine・requested=gpt-6-pro(解決: model picker「Latest」+ thinking「Pro」、
いずれも verified=yes)・12ファイル/~78k tokens・33m47s。判定: **CHANGES_REQUESTED**。
transcript 保存済み `~/.oracle/sessions/wp5279-calculatio-review/artifacts/transcript.md`
(sha256 0c35277c…c944)。注意点: ChatGPT 側 archive は skipped(artifact-save-failed —
model 生成の sandbox 添付 .md/.zip の download fallback 失敗に連動。会話 URL は meta.json に
保存済み)、reviewer の検算は @yrese/date-time・shared-kernel・trace の test double による
隔離実行で、実 workspace の vitest/typecheck とは別物。以下の採否は実コード照合済み。

**F1〜F6 への判定:**

- **F1 成立(確定不具合 P1):** 旧基本料1+合成ルールで同一基本料が94点まで二重計上。
  最小修正は旧ルールへの根拠付き exclusivityGroup 付与(統合は後でよい)。混在経路は
  既存 test 未カバー。
- **F2 成立(確定不具合〔実装範囲欠落〕P2):** 通常点数の照合は一致するが 10% 分岐の
  指定経路がない。特別Aの5段階は全て非整数となるため、現行規律では正しい実装結果は
  **全件 requires_rounding_evidence → BLOCKED**。推測丸め禁止。
- **F3 成立(確定不具合 P1・成立期間は2027-06-01以降):** `effectiveTo=2027-05-31` の
  宣言が最小修正。旧版・新版併存時の不適用版 BLOCKED 挙動に注意。
- **F4 限定成立(確定不具合 P1/一部懸念):** 指導料1+「1以外」の2(45+59=104点)のような
  台帳上矛盾する組合せは確定。ただし**全カテゴリの一律排他までは台帳だけでは確定
  できず**、確定組合せへの限定付与 + 対象単位の明確化が最小修正。
- **F5 構造的限界は成立・現行契約違反は不成立(懸念 P2):** `maxApplications` は1回の
  calculate 内の制限であり、履歴を要する frequency_limit は CAL-006 が明示的に未実装・
  BLOCKED 扱い。固定 applicationKey のルールは同一呼出し内で duplicate に既に止まるため
  「未宣言=無制限」という従来の主張は訂正。**副次懸念:** 調剤管理料1イ/ロの「上限3剤」が
  共通上限か区分別か台帳上不明(イ3+ロ3=210点が通る)→SSOT 確認事項。
- **F6 一部成立(P3):** dangling コメントは CAL-004 §8 への参照に置換が適切。demo 束命名は
  任意改善。`ruleStep` 非freezeは **不具合として不成立** — 実 trace 層 `freezeStep`
  (packages/trace/src/index.ts:337)が step を copy+deep-freeze するため最終 trace は
  不変(実コード照合で判定不能→非該当を確認)。

**新規 finding(採否は実コード照合済み):**

- **A1 採用(確定不具合 P1):** `formulas.ts` が Points 変換前に number 演算
  (`190+(d-7)*10`、`Math.ceil(d/7)`、`34*units`、`20*units`)。通常域で値誤りなしだが
  MOD-010 の IEEE-754 禁止規律違反、かつ巨大 daysSupply で中間積が safe integer を超え
  RangeError(宣言済み入力域と実装の不一致)。bigint 化が最小修正。
- **A2 採用(確定不具合 P1):** 湯薬・一包化の ruleId が段階 evidenceId 込み
  (`${fee.appliedEvidenceId}:…`)のため、同一対象に異段階を渡すと重複検知を回避して
  二重計上(湯薬7+8日=390点、一包化42+43日=444点)。項目種別+対象単位の排他が最小修正。
- **A3 採用(確定不具合 P2):** `createDrugFeeRule` 等が点数を factory 時点で計算する一方、
  apply の説明・output が `input.unitPriceYen` の live 参照を読む。factory 後の入力変更で
  点数と trace が乖離(2点のまま trace は 105円)。`DISPENSING_BASIC_FEE_BASES` の
  浅い freeze・Points 値オブジェクトの非 freeze も同系。入口で値を snapshot するのが最小修正。
- **A4 採用(確定不具合 P2):** `composeDispensingBasicFeePoints` が minimumPoints の非負を
  検証せず clamp を負値検査より先に実行(負 min で `points:-3` を成功形返却)、
  `selfPreparationAdditionPoints` の switch に default 拒否なし(未知 kind で
  `points:undefined`)。組込み経路からは非到達だが公式 API 境界の確定不具合。
- **A5 採用(確定不具合 P2):** `ruleStep` が applicationKey・入力値・拒否理由を trace に
  残さない(rp:a→rp:b の変更が trace 上区別不能、重複/上限/排他拒否が step に残らない)。
  構造化追加は CAL-008 整合が前提。
- **C1 採用(P1 相当懸念・実 trace 層で確認済み):** `affectsClaim:false`+正点数+evidence 空
  の項目が計算層を通り、trace 層も evidence 強制は affectsClaim=true のみ
  (trace/src/index.ts:367)のため合算に混入可能。正点数合算項目への evidence 必須化が最小修正。
- **C2 採用(P1 相当懸念):** 多剤逓減ルールは逓減後総額(90%)を正点数で返すため、元の
  薬剤料との併用で 19点(本来9点)。置換契約の不足 — 合成 factory 化か同一対象の排他が必要。
- **C3 採用・人間ゲート送り(P2):** 自家製剤/一包化の「7日又はその端数を増すごとに」の
  端数単位は添付 SSOT 文言に未展開(コードコメント由来の解釈)。原本再照合(P-01〜04)で
  確定するまで **変更禁止**(floor 化等は誤修正リスク)。
- **C4 採用・SSOT 改版事項(P2):** CAL-003(処方日・調剤日ともに2026-05-31以前禁止)と
  CAL-004 §3(調剤日のみガード)の適用日基準が不整合。コードではなく SSOT governance
  (PRC-007)で解消。

**棄却された過剰指摘:** 薬価変換 ceil・基本料合成順(乗率→減算→下限)は CAL-004 が明示する
暫定式であり無断実装ではない。0008/0013-0015/0060 の未実装は明示的除外で欠落ではない。
エンジンガード(期間/重複/上限/排他/StepResult 検証)と固定点数 78 ケースの台帳照合は
反証なし。claimable 到達経路は引き続き存在しない。

**修正優先度(実施は別 WP・R2+ 独立 review 前提、本記録で着手しない):**
① A1 bigint 化、② F1/F4-確定分/A2 の重複・排他、③ F3 の effectiveTo、④ F2 variant
(全件 BLOCKED 形)、⑤ A3〜A5、⑥ C1 evidence 強制、⑦ C2 置換契約。F5 頻度・混在上限・
C3 端数単位・C4 日付基準は SSOT/人間ゲート確定後。Oracle 助言は承認ではなく、実装可否は
CAL-001 昇格プロセスとリスク分類に従う。

### Historical landed WIP — WP-5278

**WP-5278(dedupe OpenAPI domain error responses)は`6d005ee`へ着地済みで、CURRENTではない。**
全フォルダ走査(`apps/api/src` 87・`apps/web/app` 137・`packages` 95ファイル)で重複候補を棚卸し、
timeout実装(意味論差)、web API client(error taxonomy差)、JST helper(意味論差)、route別scope定数(意図的分散)の
統合は見送りとした上で、`packages/contracts/src/openapi.ts`の重複domain error response 19ブロック
(403×11・400×5・404×2・409×1)を`forbiddenErrorResponse({noStore})`/`domainErrorResponse(description)`へ
集約したexact1 slice。prescription-draft 2サイトの`headers: noStoreHeaders`付き403は`{noStore:true}`で保持。
reception-create 400(union schema)とframework shapeは対象外。着手認可は human instruction
2026-09-15「全フォルダ対象のコードリファクタリングを実行」。
検証 evidence: `check:openapi` drift PASS(生成`docs/api/openapi.yaml`がbyte-identical)、contracts 136/136、
workspace 2,417 PASS、typecheck 10 projects clean、`git diff --check` clean。

### Historical landed WIP — WP-5277

**WP-5277(dedupe pooled transaction wrapper)は`011ac26`へ着地済みで、CURRENTではない。**
`apps/api/src/db`の7サイトに重複していたpool管理transaction wrapperを`runInPooledTransaction`(`db/pool.ts`)
へ集約したreuse-first dedupe。`partner-registry.ts`(REPEATABLE READ READ ONLY)とmigration-runner(個別tx)は
別構造で対象外。宣言済み意図的差分: eligibilityはROLLBACK失敗時にclientをpoolへ戻さず破棄する挙動へ統一。
着手認可は human instruction 2026-09-15「新規WPとしてrefactor続行」(7日計画の「実装はWP-5276だけ」境界の明示更新)。
検証・review evidence: helper契約DB-less test 4件追加、full API 1,001/1,001、独立review findings 0(ACCEPT)、
9/15前倒しのgate集約でworkspace 2,417 PASS・DB-gated suite 1,064/1,064・0 skip(local PostgreSQL@18
`yrese_test`)・全static gate PASS・`git diff --check` clean。

### Historical landed WIP — WP-5276

**WP-5276(dependency baseline + Web TypeScript compatibility、R2 FROZEN_REVIEW_PASS /
ORACLE_PLAN_REVIEW_COMPLETE / ORACLE_IMPLEMENTATION_REVIEW_COMPLETE)は`a463fac`へ着地済みで、
CURRENTではない。**
Next.js 16.3.3 / sharp 0.35.4の監査修正と、`experimental.useTypeScriptCli: false`による
既存TypeScript 6 API・7 CLI分離の維持。検証・review evidenceはlanding commitと
`git show a463fac` のrecord更新を参照。

### Historical landed WIP — WP-5275

**WP-5275(failure-proof describe failure、旧状態ではR2 FROZEN_REVIEW_PASS / LOCAL_LANDING_PENDING)は`c3a0829`へ着地済みで、CURRENTではない。**
WP-5274はlocal commit `d7a3676`で着地済み。WP-5235はSSOT_UPDATE_REQUIREDで未claim、READYは0件である。
reception wallClock意味論はconformance questionとしてhuman/SSOT明確化待ちでpark継続。

- **Purpose / layer:** outbox配送`deliverOne`の失敗記録catch内で、`describeFailure`のown `error.name`/
  `error.constructor?.name`読取と`error instanceof SinkTimeoutError`分類(Proxy `getPrototypeOf` trapで
  throw可能)が例外を投げると、失敗1件の記録で済むはずのat-least-once runが全体abortしていた。
  両検査をtotal化(fail-closed固定fallback)し、記録経路を落とさない。
- **Allowed / forbidden:** exact4は`apps/api/src/db/outbox-delivery.ts`、同integration test、`Plans.md`、`State.md`。
  genuine Error/SinkTimeoutErrorのreason・timedOut挙動、SQL/query text、配送フロー、contracts/API/DML、
  APPROVED SSOT、保護untracked 3 pathは変更・参照しない。
- **Authority / evidence:** repo内に既存の総称error-name抽出helperはなし(単独出現)につきlocal guarded
  inspectionのみで共有抽象は作らない(YAGNI、Codex指定)。Codex addendumによりinstanceof分類のProxy trap
  経路も対象化。pre-planはR2(配送ループのresilience/data-integrity)、SSOT改版・human/Oracle gate不要と
  判定した(agmsg 2026-08-28)。
- **Acceptance / tests:** (A1)hostile name getterのErrorでrun継続・failed:1・reason unknown・sentinel非漏洩。
  (A2)throwする`getPrototypeOf` trapのProxyでrun継続・timedOut false・reason unknown・sentinel非漏洩。
  (A3)genuine Error(RangeError等)のreason passthroughとSinkTimeoutError分類は不変。(A4)full API・typecheck・boundaries PASS。
- **PIA / offline:** synthetic sink/rowのみ。real network、DB、PHI/PII、credential、cache、retry/offline stateを追加しない。
- **Roles / stop / rollback:** `active_root_writer`はClaude、frozen reviewerはCodex。shared treeは単独writer。
  genuine Errorのreason差、配送フロー/SQL変更、追加path必要が判明したら停止。
  exact4を単一`WP-5275:` commit、rollbackは確定commitへの`git revert <commit>`。push、merge、deploy、migration/DDL/DMLは認可外。
- **Validation evidence:** RedはDB-less 2件(hostile name getterでrunOnce reject、Proxy trapでreject)が
  期待どおり失敗し、genuine passthroughは現行でもPASS。GreenはDB-less 5 PASS(新規3 test込み)、
  full API 997 PASS / 63 DB-gated skip、API typecheck PASS、`pnpm check:boundaries` PASS(Boundary check passed.)、
  `git diff --check` PASS。frozen R2 reviewは初回PASS・findings 0。レビュー対象のpre-verdict exact4 SHA-256
  `0b44ddeacdd5797c83e8503d9f968df4c6b2c59eb465621a3a1f26c22f1ed4f5`をCodexが再現した(verdict記録後のexact4は本書へ複製しない)。

| prior nonclaimable item | 現在の扱い | 参照 |
|---|---|---|
| date-time terminal-line candidate | NOT_A_BUG。live Node 26/V8でCalendarDate/ClaimMonthはLF/CR/CRLF/U+2028/U+2029 suffixを既にRangeError拒否 | packages/date-time live runtime / MOD-011 |
| WP-5235 EventEnvelope root input guard | SSOT_UPDATE_REQUIRED。APPROVED MOD-009がSSOT改版→review→実装を要求するため未着手 | MOD-009 / live package trace |
| WP-4250 | FINALIZED / APPROVED(SSOT 改版のみ)。local commit `89275d2` | 下の決定記録 |
| WP-4258 | FINALIZED / APPROVED(2026-08-01)。改版 `1dedf27`、APPROVED 化 `1ec57d5` | Implemented / Landing State |
| WP-4257 | COMMITTED_LOCAL `a911a99` / LANDED | Implemented / Landing State |
| WP-4256 | COMMITTED_LOCAL `ab63db6` / LANDED | Implemented / Landing State |
| `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` 残余 (b) | 実行仕様のみ確定。DDL と実データ参照を伴うため human gate | Human gates |

#### Historical nonclaimable — WP-4250 Bounded Patient + MedicationRequest authority decision

- **Status:** FINALIZED / APPROVED(2026-08-01)/ COMMITTED_LOCAL `89275d2`
- **承認範囲は SSOT 改版のみ。** exact11 の11文書が
  `direct human authority 2026-08-01(全て承認)` により PROPOSED→APPROVED へ
  同一 batch で昇格した(PRC-007 §4 step 8)。**実装着手・schema/data migration・
  production action・conformance 主張・cutover は含まない。**
- **登録済み blocker は1件も解除していない。** 承認で充足した
  `FINAL_HUMAN_APPROVAL_REQUIRED` を10文書から除いただけであり、
  ARC-008 15件 / DB-005 16件 / API-008 14件 / DOM-006 9件 / DOM-005 7件 /
  DOM-002・PRD-007 各4件 / API-003 3件 / API-001 2件 は据え置き。
  **blocker 集合の正本は exact11 各文書の frontmatter `blockers`** であり、
  その snapshot は `State.md` にある。本書はそれを複製しない(下記「学習」参照)。
- **`amends` / `PENDING_REVISION` は解除しない。** 本 batch は bounded scope であり
  DOM-005 / API-004 / PRD-007 の完全改版ではない。ARC-008 の `amends` は
  DB-001〜004・ARC-005・ARC-007 も対象に含み、これらは packet 外である。
- **承認済み exact11:** ARC-008 / API-003 / API-001 / API-004 / API-008 /
  DOM-002 / DOM-005 / DOM-006 / DB-005 / PRD-007 / IDX-001。
  内容不変の10文書は version 据え置き、IDX-001 のみ 0.4.46→0.4.47。
- **決定内容そのものは承認済み SSOT を正本とする。** 以前ここに置いていた
  「Recommended safe default 1〜4」と decision-surface 表は削除した。round 2〜3 で
  **3ラウンド連続の HIGH** が「approval-facing record が SSOT と矛盾している」で
  あった原因が、まさにこの複製だったためである。承認範囲・lifecycle・
  create/update/idempotency・single-writer cutover の各決定は ARC-008 / DOM-005 /
  API-008 / DB-005 の本文を読む。
- **Review 経過(要約):** 独立 review を5ラウンド、draft を Revision 14 まで実施。
  round 1 は HIGH 11件、round 2〜4 は各ラウンド数件で、いずれも REQUEST_CHANGES ×3。
  round 5 で data-integrity / security-privacy / independent verifier の3レーンが
  全て delivered となり、verifier は Revision 14 packet に対し
  **本文 PASS(HIGH なし)** を返した。**R4 が要求する maker/checker 分離は充足**。
  Codex second opinion は usage limit(2026-08-05 まで)で利用不能、記録のみ。
- **Frozen packet(最終):** base SHA `9d8dbc0c3f5201c762dbb39fd9b15fc3ddc4b875`、
  candidate diff SHA-256
  `ab086c9f8d6e6bfd26e32fbfe9daa21a3b8b6ccd3f324f413b4d2975731cfab6`、5,559 行。
  hash 対象は exact11 の本文 11 文書のみで、`Plans.md` / `State.md` は hash 自体を
  載せるため意図的に除外している。
- **学習(durable):** round 1〜4 を通して残り続けた失敗クラスは
  **「ルールを導入した節だけ訂正し、それを読む節が旧ルールのまま残る」** である。
  round 3 の reviewer が提案した systemic な対策(approval-facing record を SSOT
  から機械的に導出し、その整合を `check:ssot-index` に入れる)を、本書側は
  上記の複製削除で、gate 側は WP-4257(frontmatter の YAML 検証)で実施した。
  finalization 中に ARC-008 frontmatter の blocker 値がバッククォート始まりで
  **YAML として parse 不能**だったこと、それを `check:ssot-index` も round-5 の
  独立 review 三レーンも検出できなかったことが WP-4257 の直接の起点である。
- **round 1〜5 の全経過(Revision 7〜14、各ラウンドの finding 表と disposition)は
  本書から削除した。** git 履歴に完全な形で残っており、`4f4ba68:Plans.md` で読める。
  active queue に完了済み review の逐次記録を残さないことは
  `DEVELOPMENT_POLICY.md §8 Record policy` の要求である。

### READY — maximum two

READY は 0 件である。`DEVELOPMENT_POLICY.md §8` により READY は最大2件だが、
現時点で claim 可能な item がない。WP-4050 は実装・独立review・HIGH-3 local/CI landing済みで、
production applicationは別human gateである。WP-4251 / WP-4252 は label であって READY ではない。§8 Prioritized Backlog の
BUG 群は READY へ昇格しうる候補であり、昇格前は claim しない。

## 4. Implemented / Landing State — nonclaimable

本節は landing 済みで claim 対象外の項目を保持する。実装証跡は Git diff と commit
であり、本節はその index にとどめる(`DEVELOPMENT_POLICY.md §8 Record policy`)。
UI/UX 系(WP-5111 呼称 `3bc4805` / WP-5201 `ad44068`)の landing record は §17.1 に
一元化する(本節と二重登録しない)。

### WP-5262 — Hoist JST Intl formatters(2026-08-28)

- **Status:** `COMMITTED_LOCAL ded58dd / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** patient age/admin時刻の既存`Intl.DateTimeFormat`を各moduleで1回だけ構築。locale/timezone/output、UI/contract/DBは不変。
- **Gate:** Red 2件、focused 115、Web全体752、typecheck、post-commit focused 115 PASS。LOW test gap解消後のfrozen R2 reviewはfinding 0。

### WP-5261 — Reception create route extraction(2026-08-28)

- **Status:** `COMMITTED_LOCAL c6c473c / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** `POST /reception`とcreate専用helper/constantを専用pluginへ移動。auth/idempotency/audit/outbox/rollback、contract/schema/DB/DMLは不変。
- **Gate:** focused 336、API全体980 / DB-gated 62 skip、typecheck、boundary、post-commit focused 336 PASS。frozen R2 reviewはfinding 0。

### WP-5260 — Reception queue route extraction(2026-08-28)

- **Status:** `COMMITTED_LOCAL 7b4e311 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** read-only受付キューを専用pluginへ、共有entry snapshot/invalid responseを同moduleへ移動。
  auth/no-store/PHI audit、受付create本体、contract/schema/DB/DMLは不変。
- **Gate:** focused 328、API全体980 / DB-gated 62 skip、typecheck、boundary、post-commit focused 328 PASS。
  frozen technical/security/privacy reviewは全finding 0。

### WP-5259 — Patient route extraction(2026-08-28)

- **Status:** `COMMITTED_LOCAL 99e8660 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** 患者検索・患者取得を専用pluginへ、generic own-property helperを共通moduleへ移動。
  cursor/auth/no-store/PHI audit、受付createのpatient snapshot、contract/schema/DB/DMLは不変。
- **Gate:** focused 337、API全体980 / DB-gated 62 skip、typecheck、boundary、post-commit focused 337 PASS。
  frozen technical/security/privacy reviewは全finding 0。

### WP-5258 — Audit-log route extraction(2026-08-28)

- **Status:** `COMMITTED_LOCAL 5a84208 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** `GET /audit/events`を専用pluginへ、共有防御helper 4件を循環なしの共通moduleへ移動。
  route/auth/scope/no-store/error、contract/schema/repository/DB/DMLは不変。
- **Gate:** focused 91、API全体980 / DB-gated 62 skip、typecheck、boundary、post-commit focused 91 PASS。
  frozen technical/security/privacy reviewは全finding 0。

### WP-5257 — Single-read duplicate kana(2026-08-28)

- **Status:** `COMMITTED_LOCAL 15a9bc3 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** patient searchのduplicate kana判定を各result 1 readの`seen`/`duplicates` single passへ変更。
  warning membership、copy/DOM/ARIA/CSS、contract/API/network/DBは不変。
- **Gate:** Red 4≠2、focused 97、Web全体64 files / 750、typecheck、post-commit focused 97 PASS。
  frozen technical/security/privacy/accessibility reviewは全finding 0。

### WP-5256 — Single-pass draft hash(2026-08-28)

- **Status:** `COMMITTED_LOCAL d0a159e / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** 両draft saveでcanonical contentとhashを1回のschema parseから生成。
  公開normalize/hash、stored hash、DB read integrity、SQL/DML、contracts/schemaは不変。
- **Gate:** Red 2≠1、focused 17、API 980 / DB-gated 62 skip、typecheck、post-commit focused 9 PASS。
  frozen technical/security/privacy/data-integrity reviewは全finding 0。

### WP-5255 — Single-parse draft normalization(2026-08-28)

- **Status:** `COMMITTED_LOCAL 76a4937 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** `normalizePrescriptionDraftContent`の同一schema二重parseを信頼境界の1回へ削減。
  canonical出力、content hash、受理集合、contracts/schema/DB/DMLは不変。
- **Gate:** Red 2≠1、focused 15、API 978 / DB-gated 62 skip、typecheck、post-commit focused 7 PASS。
  frozen technical/security/privacy/data-integrity reviewはblocking/non-blocking finding 0。

### WP-5254 — Bounded endpoint DNS validation(2026-08-28)

- **Status:** `COMMITTED_LOCAL 2c675cc / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** 配送時DNS再検証を最大8件の順序保持batchへ変更。全候補のSSRF guard、
  target/rejection順序、suspended semantics、contract/schema/DBは不変。
- **Gate:** expected Red 1≠8、focused/policy 24、API 977 / DB-gated 62 skip、typecheck PASS。
  frozen technical/security/privacy reviewはblocking/non-blocking finding 0。

### WP-5253 — Unused endpoint-policy import removal(2026-08-28)

- **Status:** `COMMITTED_LOCAL 5d9bb9c / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** Partner Registryからconsumer 0の`assertPublicHttpsEndpoint` named importだけを削除。
  共有endpoint validation、webhook sink、contract/schema/DB/migrationは不変。
- **Gate:** endpoint policy focused 23 tests、module import smoke、consumer再検索/path/diff PASS。
  frozen independent reviewはblocking/non-blocking finding 0。

### WP-5252 — Dead eligibility guard removal(2026-08-28)

- **Status:** `COMMITTED_LOCAL 5e29e8e / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** private shared-kernelからconsumer 0の`isEligibilityStatus` runtime exportだけを削除。
  `ELIGIBILITY_STATUSES`、`EligibilityStatus`、他guard、contracts/API/DB/migrationは不変。
- **Gate:** expected Red 1 failure / 64 PASS→focused 65、shared-kernel 3 files / 86 PASS、consumer再検索/path/diff PASS。
  frozen independent reviewとrecord-only recheckはfinding 0。

### WP-5251 — Dead status label projections removal(2026-08-28)

- **Status:** `COMMITTED_LOCAL 91c74de / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** consumer 0の派生label runtime export 5件だけを削除。全presentation map、使用中alias、
  DOM/CSS/copy/ARIA/enum/rendered behaviorは不変。
- **Gate:** expected Red 1 failure / 13 PASS→focused/post-commit 14 PASS、consumer再検索/path/diff PASS。
  frozen independent reviewとrecord-only rechecksはfinding 0。

### WP-5250 — Evidence-id collector one-shot snapshot(2026-08-28)

- **Status:** `COMMITTED_LOCAL 4a69188 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** `collectCalculationTraceEvidenceIds`の各stepで`evidenceRefs`/`rounding`を各1回読み、
  検証したfirst-read値だけを順次収集。順序、dedup、freeze、error precedence、public contractは不変。
- **Gate:** expected Red 1 failure / 2 PASS→focused 3、trace 61、contracts 136、calculation 90、
  affected typecheck/boundaries/calculation-purity/path/diff PASS。frozen reviewsとrecord rechecksはfinding 0。

### WP-5244 — InputsSummary ref freezer family one-shot snapshot(2026-08-28)

- **Status:** `COMMITTED_LOCAL f632823 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** 4種2-field ref freezerのknown fieldを各1回読み、検証したlocalだけでexplicit objectを構築。
  unknown own keyは読まず保持せず、EvidenceRef/array/top-level、Trace型、contracts/calculation/API/UIは不変。
- **Gate:** expected Red 1件 / existing 50 PASS→trace 50、contracts 136、calculation 90、各typecheck、boundaries、path/diff PASS。
  frozen independent/trace-data-integrityとrecord rereviewsはfinding 0。

### WP-5243 — CalculationTraceRounding one-shot snapshot(2026-08-28)

- **Status:** `COMMITTED_LOCAL 6c23221 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** `freezeRounding`のmethod→evidenceIdを各1回読み、検証したlocalだけでexplicit objectを構築し、
  derived `evidenceIds`にもfirst-read evidenceIdだけを渡す。Trace型、contracts/calculation/API/UIは不変。
- **Gate:** expected Red 1件 / existing 48 PASS→trace 49、contracts 136、calculation 90、各typecheck、boundaries、path/diff PASS。
  frozen independent/trace-data-integrityとrecord rereviewsはfinding 0。

### WP-5242 — CalculationTraceStep top-level one-shot snapshot(2026-08-28)

- **Status:** `COMMITTED_LOCAL fb42c37 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** `freezeStep`のCAL-008既知13 top-level fieldを各1回読み、検証したlocalだけでexplicit objectを構築。
  unknown own keyは読まず保持せず、optional `undefined`は省略。nested freezer、Trace型、contracts/calculation/API/UIは不変。
- **Gate:** expected Red 4件 / existing 43 PASS→trace 47、contracts 136、calculation 90、各typecheck、boundaries、path/diff PASS。
  frozen independent/trace-data-integrity/privacy-securityとrecord rereviewsはfinding 0。

### WP-5241 — Trace integer primitive guard(2026-08-28)

- **Status:** `COMMITTED_LOCAL b10ffc9 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** canonical trace integer predicateをprimitive stringへshort-circuitし、type-erased objectのregex coercion・true受理を拒否。
  public signature/regex、valid string、Trace/contracts/wire/calculation、CAL-008/API-007は不変。
- **Gate:** expected Red 1件(true受理・coercion 1回)→trace 42、contracts 136、calculation 90、各typecheck、boundaries、path/diff PASS。
  frozen independent/trace-data-integrityとrecord rereviewsはfinding 0。

### WP-5240 — CalendarDate parts sequential snapshot(2026-08-28)

- **Status:** `COMMITTED_LOCAL e1aa0cc / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** one-caller date validatorをfactoryへ戻し、year→month→dayを各1回だけ読んで検証した同じlocal値で構築。
  public signature、valid calendar/leap/wrapper、timezone、ClaimMonth、calculation/API/DB/UI、MOD-004/MOD-011は不変。
- **Gate:** expected Red 1件(read 3/3/4・`0000-13-32`)→date-time focused/package 20、calculation 90、
  date-time/calculation/API/Web typecheck、boundaries、path/diff PASS。frozen independent/date-integrityとrecord rereviewsはfinding 0。

### WP-5239 — ClaimMonth validation-order snapshot(2026-08-28)

- **Status:** `COMMITTED_LOCAL 121bce4 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** ClaimMonth partsをyear→month順に1回だけ読み、同じlocal値で検証・構築し、CalendarDate導出を既存factoryへ集約。
  public signature、valid date/month、timezone/締め、calculation/API/DB、MOD-004/MOD-011は不変。
- **Gate:** initial Red 4件とreview-closure Red 1件→date-time focused/package 18、calculation 90、両typecheck、boundaries、path/diff PASS。
  frozen reviewersの同一Medium validation-order findingを閉じ、final/record rereviewsはfinding 0。

### WP-5238 — Audit identifier primitive guard(2026-08-28)

- **Status:** `COMMITTED_LOCAL ab05c4c / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** auditのcontrol-char helperへ既存string validatorを1行reuseし、7 envelope IDのtype-erased objectをregex coercion前に拒否。
  events/schema/hash/registry/API/DB、SEC-007/MOD-009は不変。
- **Gate:** expected Red 6件→audit focused 66/package 202、events 46、audit/events/API typecheck、boundaries、path/diff PASS。
  frozen independent/audit-security-data-integrityとrecord rereviewsはfinding 0。

### WP-5237 — Eligibility transition primitive guard(2026-08-28)

- **Status:** `COMMITTED_LOCAL fbf8557 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** eligibility transition predicateへ既存state guardを1行短絡し、invalid/coercible sourceのnative error/fail-openを拒否。
  transition table、valid results、API/DB/audit、ADP-004/MOD-005は不変。
- **Gate:** expected Red 4件→shared-kernel focused 8/package 85、shared-kernel/API typecheck、boundaries、path/diff PASS。
  frozen independent/eligibility-data-integrityとrecord rereviewsはfinding 0。DB integrationはDML authority外で未実行。

### WP-5236 — Money round nullish options guard(2026-08-28)

- **Status:** `COMMITTED_LOCAL 913bd48 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** `ScaledDecimal.round`のnullish optionsを既存scale validatorへ閉じる1行guard。public API、rounding policy/formula、
  valid output、consumer、MOD-010/CAL-010は不変。
- **Gate:** expected Red 2件→money 17、calculation 90、各typecheck、calculation purity、boundaries、path/diff PASS。
  reviewer LOW 1件をerror型+exact message assertionで閉じ、frozen independent/money-data-integrityとrecord rereviewsはfinding 0。

### WP-5234 — Dependency-audit structured transient(2026-08-28)

- **Status:** `COMMITTED_LOCAL 41e3389 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** live pnpm audit failureのtransient判定をparsed root/error/code exact matchへ限定。
  captured raw mode/pattern/message/count/dependency/lock/workflowは不変。
- **Gate:** expected Red 4件→`pnpm test:scripts` Green、対象script checks、boundaries、path/diff、
  frozen independent finding 0、dependency/security WP PASS、record rereviews PASS。actual network auditは未実行。
  reviewerのP3 2件は本差分が導入していない別候補。

### WP-5233 — Error-code primitive guard(2026-08-28)

- **Status:** `COMMITTED_LOCAL e20bae9 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** shared-kernel共通error-code predicateをprimitive stringへshort-circuitし、type-erased objectのcoercion/受理を拒否した。
  public signature/regex/registry/consumer/API/MOD-006は不変。
- **Gate:** expected Red 1件→shared-kernel focused 64/package 81、contracts error 6/package 136、Web error-notice 6/package 747、
  各typecheck、boundaries、`git diff --check`、frozen independent/security-contract reviewとrecord-only recheckがfinding 0でPASS。
  Registry invalid-definition error renderingのcoercion totalityはpredicate acceptance外の既存residualとして分離した。

### WP-5232 — Trace array-kind guard(2026-08-28)

- **Status:** `COMMITTED_LOCAL b1ad99e / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** trace共通dense-array assertionで既存runtime array-kind guardを再利用し、type-erased primitive stringの
  文字配列化を拒否した。public trace/evidence/claim/PHI/URL contractは不変。
- **Gate:** expected Red 1件→trace 41、calculation 90、contracts calculation-trace 20、各typecheck、calculation purity、
  boundaries、`git diff --check`、frozen independent/trace-data-integrity reviewとrecord-only recheckがfinding 0でPASS。

### WP-5231 — Calculation application-key primitive guard(2026-08-28)

- **Status:** `COMMITTED_LOCAL e9a597f / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** calculation共通non-empty-string assertionを既存primitive helperへ一本化し、type-erased object/nullish値を
  fixed `RangeError`へ閉じた。rule/evidence/points/public contractは不変。
- **Gate:** expected Red 3件→focused 60、calculation 2 files / 90 tests、trace 40 tests、各typecheck、calculation purity、
  boundaries、`git diff --check`、frozen independent/calculation-data-integrity reviewとrecord-only recheckがfinding 0でPASS。

### WP-5220 — Web operations abort semantics(2026-08-28)

- **Status:** `COMMITTED_LOCAL 0c99bd8 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** operations shared transportで意図的abortの元rejection objectを保持し、未abort transportの
  `UNAVAILABLE`、HTTP/JSON/schema/scope/no-store/non-echo契約を維持した。同commitで今後のcompiled CSS
  gzip上限を12 KiBへ再設定し、WP-5211 historical evidenceと他のCSS品質gateは維持した。
- **Gate:** Red 1件→focused 17 tests、Web 64 files / 746 tests、Web typecheck、`git diff --check`、
  frozen independent/API-client reviewとrecord-only recheckがfinding 0でPASS。

### WP-5219 — Web whoami transport reuse(2026-08-27)

- **Status:** `COMMITTED_LOCAL 7077b62 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** `/whoami`のURL、development header、`no-store` fetch、signal、JSON/schema検証を既存
  `fetchSessionScopes`へ収束し、admin固有のscopeと401/403/status分類をconsumer側へ維持した。
- **Gate:** Red 4件→focused 2 files / 26 tests、Web 64 files / 745 tests、Web typecheck、
  `git diff --check`、frozen independent/security reviewとrecord-only recheckがfinding 0でPASS。

### WP-5217A — Reception visibility refresh(2026-08-27)

- **Status:** `COMMITTED_LOCAL 1fedfe3 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** 既存queue runnerとexplicit target trackerを再利用し、hidden→visible edgeだけを
  再取得する。network failureは検証済みqueueを保持し、trusted 403だけは旧queueと一時登録結果を消去する。
- **Gate:** Red 3件→focused 168 tests、Web 64 files / 740 tests、Web typecheck、
  `git diff --check`、frozen independent/frontend/privacy-security reviewがPASS。single-object readの
  slice BはAPI-006/MOD-008/SEC-004の3 gate未成立で、引き続き着手しない。

### WP-5211 — CSS token authority Phase A(2026-08-27)

- **Status:** `COMMITTED_LOCAL 6e40b5b / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** 7 active CSSを3へ統合し、`globals.css`を唯一のtop-level token/direct-color
  authorityにした。cascade、DOM、文言、contract、表示結果を保持し、nowrap 12件を保持6/
  是正6へ固定した。
- **Gate:** Red 5→Web 64 files / 739 tests、typecheck/lint/build、browser 36 route-viewports /
  5 suites、screenshot 36/36 pixel一致、CLS最大差0、source separate gzip 13,401≤15,170、
  compiled gzip 9,672≤10,240、`git diff --check`、frozen R2 technical reviewがPASS。このlanding時の
  実測証跡は不変で、今後のcompiled CSS上限だけを2026-08-27 human instructionにより
  12 KiB(12,288 bytes)へ再設定した。

### WP-5216 — 警告階層化と実データ面の視覚昇格(2026-08-27)

- **Status:** `COMMITTED_LOCAL 0782d86 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** 4つのSSOT_BLOCKED画面でfull gate説明を上部 `PrototypeBanner`へ一元化し、
  rail/downstreamを短い参照へ縮約した。全canonical gate ID、unavailable-value safety copy、
  action不可理由を保持し、既存live-data surfaceを未取得metricより前へ移した。
- **Gate:** hierarchy Red 1 / 737→Web 64 files / 737 tests、Web typecheck、browser 36
  route-viewports / 5 suites(Axe critical/serious 0、console error 0)、4画面目視、
  `git diff --check`、frozen independent / medical-safety reviewがPASS。

### WP-5215 — フォーカス可視性・a11y 基盤是正(2026-08-27)

- **Status:** `COMMITTED_LOCAL 47100b7 / PUSH_NOT_REQUESTED / NOT_MERGED`。
- **Scope:** root focus tokenを既存 `#6b4eff` fallbackへ接続し、dark sidebarはwhite ringを再定義、
  command inputの `outline: 0` を削除した。DOM、layout、forced-colors、API、schemaは不変。
- **Gate:** static Red→Green、focused 5 tests、Web typecheck、Web 64 files / 736 tests、browser 36
  route-viewports / 5 suites、keyboard computed-style、`git diff --check`、frozen independent /
  accessibility reviewがPASS。screen reader実機、forced-colors、zoomのhuman確認はrelease gateのまま。

### WP-5218 — Web test type boundary repair(2026-08-27)

- **Status:** **この記録が `WP-5218:` commit の tree に含まれる場合に限り**
  `COMMITTED_LOCAL / PUSH_NOT_REQUESTED / NOT_MERGED`。未commit worktree上では landing claim
  ではなく finalization candidate と読む。
- **Scope:** patient search test fixtureをproduction consumerと同じ既存 `toPatientContextData`へ通し、
  `exactOptionalPropertyTypes`の境界不一致を閉じた。production source、type、schema、helper、挙動は
  変更していない。
- **Gate:** Web typecheckの既知TS2375をRedとし、focused 96 tests、Web typecheck、Web 64 files /
  735 tests、`git diff --check`、frozen exact1 reviewがPASS。workspace-wide gateやrelease readinessは
  主張しない。

### WP-5214 — 横断 retry / route state 整備(non-JST、2026-08-27)

- **Status:** **この記録が `WP-5214:` commit の tree に含まれる場合に限り**
  `COMMITTED_LOCAL / PUSH_NOT_REQUESTED / NOT_MERGED`。未commit worktree上では landing claim
  ではなく finalization candidate と読む。
- **Scope:** checkout、masters、cloud health の失敗表示へ既存 reload token と operator buttonを
  接続し、admin loader の同期throw / rejected promiseを固定non-echo errorへ収束した。
  `error.tsx` は inline styleを削除し、`not-found.tsx` は既存 `ErrorNotice` を再利用した。
  API、contract、schema、migration、CSS、APPROVED SSOT、JST変換は変更していない。
- **Gate:** 最小 Red 7件→focused 51 tests、MetricGrid ARIA Red 1件→focused 10 tests、
  Web 64 files / 735 tests、browser 36 route-viewports / 5 interaction suites、`git diff --check`、
  frozen technical review PASS。Web typecheck の唯一の失敗は exact12外の既知fixture mismatchで、
  WP-5218へ分離した。workspace typecheck PASSとは主張しない。

### WP-5213 — 処方入力の破壊的操作安全化(2026-08-27)

- **Status:** **この記録が `WP-5213:` commit の tree に含まれる場合に限り**
  `COMMITTED_LOCAL / PUSH_NOT_REQUESTED / NOT_MERGED`。未commit worktree上では landing claim
  ではなく finalization candidate と読む。
- **Scope:** 既存 inline 二段階確認を維持し、復元差分と409競合へ変更項目名だけを表示した。
  未取得の最新server内容、臨床値、患者識別子は表示せず、local validation は field / RP 行を
  特定する。表示用差分判定は既存 wire 正規化を再利用し、空白・zero paddingだけを変更扱いしない。
  API、contract、schema、migration、permission、error code、日数優先関係は変更していない。
- **Gate:** focused 31 tests、Web 731 tests、browser 36 route-viewports / 5 interaction suites、
  frozen technical / medical-safety / privacy / accessibility review PASS。Web typecheck の唯一の失敗は
  exact4外の既存 `patient-search.test.tsx` fixture mismatchであり、WP-5213 PASSへ読み替えない。

### WP-5212 — 受付・患者 動線キーストローク削減(2026-08-27)

- **Status:** **この記録が `WP-5212:` commit の tree に含まれる場合に限り** `COMMITTED_LOCAL /
  PUSH_NOT_REQUESTED / NOT_MERGED`。未commit worktree上では landing claim ではなく finalization
  candidate と読む。§17.2 の scope を既存 helper / guarded handoff で実装し、API、schema、
  migration、domain status は変更していない。検証・frozen review の正本は当該 Git diff / commit
  と local command evidenceであり、production/release readiness や保留中の手動 accessibility
  gateを示さない。

### WP-5210 — 記録整合と計画正規化(PLAN_ONLY、2026-08-27)

- **Status:** 本記録変更 commit(`WP-5210:` prefix)をもって着地。対象は Plans.md /
  State.md のみ、アプリコード変更ゼロ。maker≠checker の frozen review 済み(証跡は
  Git 履歴)。内容は §17.0 の human 判断記録と §17 backlog 登録、State.md ACTIVE
  SNAPSHOT を参照
- **Claim 根拠:** current user instruction 2026-08-27 に基づく PLAN_ONLY 記録整合であり、
  WIP slot を消費しない扱い(claim ではない。§3 の CURRENT=0 と両立)

### WP-4258 — round-5 deferred LOW の改版

- **Status:** FINALIZED / APPROVED(2026-08-01)。改版は `1dedf27`、APPROVED 化は
  `1ec57d5`。DB-005 / ARC-008 は 0.1.4 APPROVED、IDX-001 は 0.4.49(集計
  143/13/17、合計173)。承認範囲は SSOT 改版のみで、登録済み blocker は据え置き
- **対象:** DB-005(0.1.3→0.1.4)、ARC-008(0.1.3→0.1.4)、IDX-001(0.4.47→0.4.48)
- **Risk:** P2 / R2。撤回と記述精緻化のみで capability の追加・制約の緩和はない。
- **主要な変更:** §3.2 の pair 全体削除特例を**撤回**。特例の論拠(期限後は latest
  false と delta 不在が membership 上等価)は正しいが、Revision 14 が新設した機械
  強制は superseding delta の実在を ConditionCheck で要求するため、superseding
  delta を持たない latest delta の削除を表現できない。規則が許し強制機構が表現でき
  ない状態は条件式なし Delete への圧力になる。§12 の「latest delta 削除は実装禁止」
  との既存矛盾も同時に解消した。
- **独立 review:** frozen packet `ef2db67b…` を hash 独立再現のうえ REQUEST_CHANGES
  (HIGH 0)。指摘3件はすべて記録側で、同 revision 内で訂正済み。うち MEDIUM 1件は
  **こちらの計数正規表現 `[A-Z]+-[0-9]+` が `SRC-FHIR-00x` 形式を取りこぼし**、
  IDX-001 の集計値を誤らせていたもの。正しくは 143/13/17 → 141/15/17(合計173)。
  `check:ssot-index` は section 件数と総数を検証するが change_log の散文集計は
  検証しないため、この種の誤りは機械検査を素通りする。
- **再凍結後の packet:** base `a911a99`、diff SHA-256
  `92c4765be23e4440b21d6022c0f50d7e3373dc729b6ac03a6803157b3f1c5e06`、276行。

### WP-4257 — frontmatter を YAML として検証する

- **Status:** COMMITTED_LOCAL `a911a99` / MACHINE_VALIDATED / LANDED
- **Risk:** P2 / R2。検査規則の追加と、意味を変えない引用符付与のみ。
- WP-4250 finalization 中に ARC-008 の blocker 値がバッククォート(YAML の予約文字)
  で始まり frontmatter が parse 不能だったことが判明した。`check:ssot-index` も
  round-5 の独立 review 三レーンも検出できなかった。原因は `parseFrontmatter` が
  行単位の正規表現で `ssot_id` / `status` だけを抜き、YAML としての妥当性を一切
  見ていなかったことである。
- `scripts/check-ssot-index.mjs` へ実 YAML parse を追加し `document.errors` を
  violation として報告する。parse 失敗時に `undefined` を返すと呼び出し側が
  「文書が存在しない」と誤報告して連鎖偽陽性になるため、field 抽出は従来経路で
  続行する。
- 導入直後の全173文書 scan で**既存4文書に実在の YAML 欠陥を検出**
  (`payment_allocation_policy.md` / `jahis_adapter_inventory.md` /
  `audit_event_registry.md` / `claim_return_rate_kpi_policy.md`)。いずれも値に
  `: ` を含み入れ子マッピングと誤解釈されるもので、引用符で囲んで修復した。
  意味変更がないことは修復後の parse 実値が意図した全文字列(40 / 65 / 325 / 56
  文字)と一致することで確認済み。

### WP-4256 — 複合キー構築の機械強制と ingress delimiter 拒否の固定

- **Status:** COMMITTED_LOCAL `ab63db6` / MACHINE_VALIDATED / LANDED
- **Risk:** P2 / R2。CI 検査規則とテストの追加のみで、production 経路の挙動、
  contract、schema、migration、認可判定を変更しない。
- `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` の解除条件 (a) を実装した。
  `check-boundaries.mjs` が AST 走査で `TENANT#`/`PHARMACY#` を含む literal を検出し、
  承認済み key codec 以外の production source にあれば exit 1 とする。
  `server.test.ts` へ key-delimiter の ingress ケース3件を追加(tenant には衝突実例
  `tenant-001#PHARMACY#tenant-002` を使用)。
- **検知ルールの限界(実測4変種):** template literal と `+` 連結は検知するが、
  marker を分割する形(`const P="TENANT"; ${P}#${t}`)と `["TENANT",t].join("#")`
  は通過する。静的検知の原理的限界であり、DB-005 §7 は「迂回が入れば CI で落ちる
  保証であって迂回経路が存在しないことの証明ではない」と記載済み。
- 残余 (b) は Human gates を参照。

### WP-4255 — Prevalidate audit-read response before recording success

- **Status:** COMMITTED_LOCAL `b9fc31a` / MACHINE_VALIDATED / INDEPENDENT_PASS / SECURITY_PASS / DATA_INTEGRITY_PASS / PUSH_NOT_REQUESTED
- **Risk:** P2 / R2. Reorders one authorized audit-read path to prevent a durable `audit.viewed` success when the eventual HTTP response cannot satisfy the existing API schema; no contract, event type, repository, migration, transaction, authorization, idempotency, retention, or production-state change.
- **Dependency:** separate prerequisite remediation for WP-4254, now independently accepted. WP-4254 owns no API change; WP-4255 owns only its exact API/test and active-board hunks.
- **Exact owned paths:** `Plans.md`, `State.md`, `apps/api/src/server.ts`, `apps/api/src/audit-log.test.ts`.
- **Implementation order:** list; dense snapshot; tenant/pharmacy scope check; full-chain verification and verified-chain identity/sequence checks; display ordering; selected-window projection; complete response-schema parse; only then snapshot the view clock and record plus validate exactly one `audit.viewed` success; return the exact prevalidated response object.
- **Invariant:** preserve existing `totalCount`, `checkedCount`, verified ordering, max-200 selection, and record-before-HTTP-200 behavior. For a broken chain, preserve raw append-window ordering and omission without backfill when a selected raw row cannot enter the display projection.
- **Durability boundary:** a `record` rejection before commit returns normalized 500 and leaves zero new view events. A successful `record` yields exactly one appended `audit.viewed` before HTTP 200. An ambiguous or post-commit failure, a returned-event invariant failure after the repository has committed, or HTTP delivery failure may leave one append despite a 500 or delivery failure. This slice makes no automatic retry, deduplication, client-delivery success, or rollback claim.
- **Acceptance:** a core-valid verified event with a 129-character displayed target ID returns 500 with `no-store`, does not echo the raw ID, does not call the clock, does not call `record`, and leaves persisted count unchanged; a successful route appends exactly one `audit.viewed`, while that newly appended view is absent from the exact response snapshot; an interleaving writer after list does not enter the response snapshot, whose `totalCount` and `checkedCount` remain N, while persisted chain N+2 stays valid and ends in exactly one `audit.viewed` targeting `view:N`; existing broken-chain reason/count/order/raw-window omission tests remain green.
- **Observed validation:** focused audit 73/73 PASS; API 808 PASS plus 14 expected PostgreSQL skips; workspace 1,782 PASS plus the same 14 expected skips; full workspace typecheck sequential PASS; build PASS with 11/11 static pages; OpenAPI, boundaries, SSOT index 173, and diff check PASS. Secrets remains fail-closed because of the existing external `.codegraph` symlink and is not claimed as PASS.
- **Independent review:** verifier, security, and data-integrity reviews PASS. No contract/repository/audit-core/migration/event/idempotency/transaction expansion was accepted.
- **Remaining gate:** landed at `b9fc31a`. Push, deploy, and production mutation were not requested or performed.

### WP-4254 — Remove the user-facing audit confirmation screen

- **Status:** COMMITTED_LOCAL `2db1ec1` / MACHINE_VALIDATED / INDEPENDENT_PASS / PUSH_NOT_REQUESTED
- **Risk:** C3 / R3 pre-implementation governance. Removes a user-facing U2 audit screen while preserving all audit production, authorization, append-only persistence, integrity verification, API contracts, and the existing max-200 response projection. Direct user instruction supplies the human product decision; independent security, privacy, medical-safety, and data-integrity review remains mandatory before implementation and does not constitute human risk acceptance.
- **Outcome:** pharmacists and general Web users no longer see or operate SCR-028; `/admin` remains a truthful placeholder for future tenant/pharmacy/user/permission management.
- **Owner:** Codex root as sole maintainer. All mapper, pre-plan, security, privacy, medical-safety, data-integrity, and independent verification roles are read-only.
- **Allowed editable paths:** `apps/web/app/admin/page.tsx`, `apps/web/app/admin/audit-log-view.tsx`, `apps/web/app/admin/audit-log-view.test.tsx`, `apps/web/app/globals.css`, `apps/web/app/shell-smoke.test.tsx`, `apps/web/app/dev-tenant.ts`, `docs/uiux/screen_inventory_draft.md`, `docs/uiux/workflow_map.md`, `docs/security/audit_log_design.md`, `docs/security/audit_worm_and_tenant_isolation_strategy.md`, `docs/plan/uiux_development_plan.md`, `DEVELOPMENT_POLICY.md`, current-fact corrections in `docs/ui-ux-refresh/02-compliance-applicability.md`, `04-screen-and-state-inventory.md`, and `11-remaining-risks.md`, the SEC-007/SEC-008/UIX-006/UIX-007 status rows, the pre-existing MOD-009 status reconciliation, and WP-4254 metadata in `docs/ssot_index.md`, and these active `Plans.md` / `State.md` snapshots.
- **Forbidden paths:** API server/repositories/tests, `packages/contracts`, `packages/audit`, `packages/shared-kernel` permissions, migrations, generic `AuditMetadata` components, frozen legacy ledgers, production/runtime state, and every unrelated dirty path.
- **SSOT:** revise UIX-006, UIX-007, SEC-007, and the stale implementation facts in SEC-008 through PRC-007 before source deletion; retain SCR-028 as a retired, non-reusable compatibility tombstone while removing it from the active 28-screen product inventory and admin home. Preserve the repository API contract and its max-200 response projection outside the pharmacist Web journey without claiming bounded internal work or a production operational path; record production tenant/auth incident-response, retention-period-complete export, and full-chain read amplification/self-growth as release blockers. PLAN-UIUX-001 must no longer schedule SCR-028.
- **Acceptance:** no Web import, render, style, or dedicated test for `AuditLogPanel` remains; `/admin` and its nav item remain as the SCR-029 placeholder; the WP-4254-owned diff does not include API/contracts/persistence/integrity paths; regression evidence retains deny-by-default for missing `audit-log:read`, cross-tenant/pharmacy denial without metadata leakage, response length at most 200, `no-store`, IDs-only projection with no patient/actor name or other PHI re-resolution, and the WP-4255 durability boundary: a pre-commit rejection leaves zero new view events, a successful valid record yields exactly one before HTTP 200, and ambiguous/post-commit, returned-event invariant, or delivery failure may leave one despite failure, with no automatic retry/dedupe/delivery-success/rollback claim; focused Web test/typecheck, SSOT index, boundaries, and diff checks pass; independent security/privacy/medical-safety/data-integrity/SSOT reviewers confirm the retained audit boundary; the current-fact corrections in `docs/ui-ux-refresh/02-compliance-applicability.md`, `04-screen-and-state-inventory.md`, and `11-remaining-risks.md` no longer count SCR-028 or its CRITICAL chain warning as a safety/compliance mitigation; SEC-007/SEC-008/UIX-006/UIX-007 and IDX-001 are atomically APPROVED before Web source deletion.
- **Abort:** do not delete source while SEC-007/SEC-008/UIX-006/UIX-007 or IDX-001 are PROPOSED, any required security/privacy/medical-safety/data-integrity/independent review is incomplete, or the global SSOT index gate is red. Any API, contracts, `packages/audit`, permission, repository, migration, or persisted-data change attributed to WP-4254 aborts that slice; the separately registered WP-4255 prerequisite remains outside WP-4254 ownership.
- **Rollback:** revert only the Web consumer and this atomic SSOT/planning batch. Never delete audit rows, roll back an applied migration, weaken authorization/integrity, or alter the audit API. If SSOT and Web source cannot finalize atomically, restore the prior APPROVED SSOT state and stop.
- **Human gate:** the direct user instruction from the pharmacist/product authority authorizes only removal of the user-facing screen. It does not accept residual production incident-investigation risk or authorize weakening audit retention, authorization, integrity, production controls, or compliance evidence provision; release stays blocked until the production operational path is separately approved and proven.
- **Observed validation:** focused shell smoke 15 and Web 423 PASS; WP-4255 focused audit 73/73 PASS; API 808 PASS plus 14 expected PostgreSQL skips; workspace 1,782 PASS plus the same 14 expected skips; full workspace typecheck sequential PASS; build PASS with 11/11 static pages; OpenAPI, boundaries, SSOT index 173, and diff check PASS. Secrets remains fail-closed because of the existing external `.codegraph` symlink and is not claimed as PASS.
- **Remaining gate:** the separately owned WP-4255 prerequisite has independent verifier, security, and data-integrity PASS. WP-4254 retained strict screen-removal/SSOT ownership separation from the API remediation and landed at `2db1ec1` on 2026-08-01, after WP-4250 finalization made IDX-001 APPROVED and cleared its own Abort clause. Push, deploy, and production mutation remain unrequested.

### WP-4253 — Refresh the stable software baseline

> **2026-08-23 follow-up:** executable Node selector 4か所を26.6.0へ揃え、
> `fast-uri` 3.1.6/4.1.3と`nanoid` 3.3.18で当日公開High advisoryを閉じた。
> follow-up commitsは`9087f61`と`491aea5`。Node 26.6.0でfull 1,877 tests(skip 0)、
> typecheck/build/全CI checker、dependency high=0/critical=0を再検証し、pushは
> 2026-08-23 direct user instructionで要求済み。以下の26.5.0記述は元WP landing時の
> historical evidenceであり、current executable selectorではない。

- **Status:** COMMITTED_LOCAL / MACHINE_VALIDATED / HOST_RUNTIME_ALIGNED / INDEPENDENT_PASS / PUSH_NOT_REQUESTED
- **Landing evidence:** local commit
  `9d8dbc0c3f5201c762dbb39fd9b15fc3ddc4b875`; `main` is one commit ahead of
  `origin/main`. No WP-4253 package/toolchain path remains dirty.
- **Risk:** R2. Major framework, compiler, test runner, package-manager, CI Action, and CI-only PostgreSQL changes; no production data or infrastructure mutation.
- **Policy alignment:** Milestone 1 green baseline and dependency hygiene. WP-4240 is absorbed rather than bypassed.
- **Outcome:** repository-managed software and every active Mac mini Node foundation run on the latest stable baseline, with prereleases excluded and Node pinned to the explicitly requested latest stable release.
- **Mapper evidence:** direct manifests, lockfile, `pnpm-workspace.yaml`, Next config, CI workflow, official release metadata, and current validation output were inspected before editing.
- **Pre-change baseline:** Node 24 / pnpm 11.13.1 / PostgreSQL 16 / Next 15 / TypeScript 5 / Vitest 3; the prior lock resolved vulnerable PostCSS 8.5.16.
- **Target baseline:** Node 26.5.0 across repository, CI, nvm, Homebrew, shells, Codex MCP launchers, user LaunchAgents, and active Node services; pnpm 11.18.0; PostgreSQL 18.4 in CI; latest stable GitHub Actions; latest stable direct npm dependencies. TypeScript 7 is the CLI compiler while the official TypeScript 6 compatibility package supplies the programmatic compiler API required by repository scripts and framework tooling.
- **Owner:** Codex root as sole maintainer. No concurrent editor.
- **Checkers:** read-only mapper, plan review, independent verifier, and dependency/security review are complete with no remaining P0–P3 finding. Built-in Codex subagents stayed inside the APPROVED single execution lane; no external agent, agmsg lane, or concurrent editor was used. Machine gates did not impersonate independent review.
- **Dependencies:** public npm, GitHub, Node.js, PostgreSQL, and container-registry release metadata. Preserve all unrelated dirty paths.
- **Owned editable paths:** `.nvmrc`, root/workspace `package.json` files, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `apps/web/next.config.ts`, migration-required source/tests only, the active snapshots at the top of `Plans.md` / `State.md`, and only the stale exact implementation-sequence entry in `DEVELOPMENT_POLICY.md`.
- **Host extension:** direct user instruction additionally covers the exact active Node selectors under `~/.zshenv`, `~/.codex/*.toml`, `~/.local/bin`, `~/Library/LaunchAgents`, the nvm default, Node 26 global CLI packages, and the current launchd user environment. Historical backups, disabled services, and older nvm installations remain inert rollback artifacts.
- **Forbidden paths/actions during implementation:** frozen legacy ledger bodies,
  APPROVED product/clinical SSOT, database migrations, production writes,
  deploy/publish/external send, secret changes, and any commit/push outside the
  root-owned landing gate.
- **Contract:** every direct external dependency is the newest stable compatible release; deliberate compatibility pins are explicit; every PostCSS resolution is `>=8.5.18`; no advisory ignore/allowlist; Node types remain aligned to Node 26.
- **Migration:** apply official Next.js 15→16 and Vitest 3→4 migration guidance; keep the existing Webpack resolver path until equivalent Turbopack behavior is proven; do not change runtime/API/UI semantics.
- **Acceptance:** clean `pnpm outdated -r`; frozen install and dedupe checks succeed; exact direct versions and CI pins match reviewed stable releases; dependency audit is high/critical zero; focused migration tests pass; full typecheck, test, build, script, OpenAPI, secret, boundaries, calculation-purity, SSOT-index, SBOM, and diff gates pass. PostgreSQL integration must run zero-skip on Node 26.5.0 against PostgreSQL 18.4 locally or on exact-head CI before landing.
- **Downstream validation:** `pnpm install --frozen-lockfile`; `pnpm outdated -r`; `pnpm dedupe --check`; `pnpm check:deps`; `pnpm check:sbom`; `pnpm test:scripts`; `pnpm -r typecheck`; `pnpm -r test`; `pnpm -r build`; `pnpm check:openapi`; `pnpm check:secrets`; `pnpm check:boundaries`; `pnpm check:calculation-purity`; `pnpm check:ssot-index`; `git diff --check`. No production/deploy claim.
- **Observed validation:** Node 26.5.0 and pnpm 11.18.0, including `.nvmrc`, nvm default, Homebrew, signed/notarized official macOS pkg under `/usr/local`, noninteractive/login/interactive shells, launchd PATH, direct Codex MCP launchers, remodex running+connected, Hermes launchd supervision (downstream messaging connection not independently proven), and every observed active Node executable; frozen install; clean recursive outdated result; dedupe; dependency audit high=0/critical=0 including production-only audit; SBOM 249; script harness; actionlint; OpenAPI; secret scan with the ignored external `.codegraph` symlink isolated and restored; boundaries; calculation purity; SSOT index 173; full typecheck; Next.js 16.2.12 Webpack production build with 11/11 static pages; PostgreSQL 18.4 full workspace test 1,843 PASS / 0 SKIP; diff check.
- **Remaining gate:** exact-path local commit is complete at `9d8dbc0`.
  Independent read-only verification passed; push, remote exact-head CI, deploy,
  and production mutation were not requested or performed.
- **Falsification:** prerelease adoption, unsupported runtime/type mismatch, stale direct dependency or CI pin, vulnerable resolution, unrelated lock drift, semantic behavior change, skipped required integration, or weakened gate fails the slice.
- **Rollback:** revert only WP-4253-owned dependency/toolchain/config changes; do not touch unrelated dirty files or production state.
- **Human gate:** none for local repository dependency and Mac mini runtime updates. Migration application, deploy/publish, production write, release acceptance, and any residual security/privacy exception remain separately gated.
- **Exact first command:** `pnpm outdated -r --format json`

### WP-4050 — Atomic reception command boundary

- **Status:** INDEPENDENT_REVIEW_CLOSED(2026-08-23) / HIGH-1・HIGH-2 修正 `28fd62e` は
  checker PASS / MEDIUM-1・LOW-2 閉鎖 `273c66e` / HIGH-3 は human approval 後に
  migration 000007 として local synthetic / CI へ landing 済み。production/staging
  application は別 human gate
- **初回独立レビュー(2026-08-23、fresh-context data-integrity lane、codex 不使用):**
  frozen packet base `9d8dbc0`(= `42ef15c~1`)→ head `9a404fe`、9 path、diff
  SHA-256 `494a79e60462731034a539adf670098d0c0074c85b576e19972a4348cff7008f`、
  hash 再現一致。verdict **REQUEST_CHANGES**(HIGH 3 / MEDIUM 4 / LOW 4)。
  Postgres の原子境界そのもの(acceptance 1・2・4・5・6)は PASS。
  - HIGH-1 legacy_orphan が process 外へ一切出ない → `28fd62e` で
    `X-Yrese-Reconciliation: legacy_orphan` header(OpenAPI 200 に宣言)。
  - HIGH-2 完全性判定が outbox のみ → `28fd62e` で audit_events との JOIN を要求。
  - **HIGH-3 `outbox_events` に FK なし**(aggregate_id→reception_entries、
    audit_event_id→audit_events)。DDL のため **human gate**。migration 案:
    `ALTER TABLE outbox_events ADD CONSTRAINT outbox_events_reception_fk FOREIGN KEY
    (tenant_id, pharmacy_id, aggregate_id) REFERENCES reception_entries (tenant_id,
    pharmacy_id, reception_id); ADD CONSTRAINT outbox_events_audit_fk FOREIGN KEY
    (tenant_id, pharmacy_id, audit_event_id) REFERENCES audit_events (tenant_id,
    pharmacy_id, event_id);`(aggregate_type='reception' 前提。汎用化時は partial
    制約へ)。適用前に既存 dangling 行の棚卸し SELECT が必要。
  - MEDIUM-1〜4(in-memory 補償の opt-in、rollback 部分失敗の判別不能、commit と
    検証の間の throw 窓、`#` 既存データ未検査)と LOW-1〜4 は §8 backlog 候補。
    MEDIUM-4 は `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` 残余 (b) と同一枠。
  - 修正 diff `28fd62e` は maker=本 lane と別 context の checker が PASS。
    残る finding は `273c66e`、`a20d8b9`、human-approved migration 000007
    (`425294a` + `6f62b92`)で閉鎖し、production/staging application だけを別 gate に残す。
- **Landing evidence:** local commits `42ef15c`(atomic boundary: migrations/000005
  outbox_events、PostgresReceptionCreateCommand 単一トランザクション、
  ComposedReceptionCreateCommand 補償型 in-memory、4 結果値
  created/existing_complete/legacy_orphan/idempotency_conflict)+
  `bf17cea`(branded ID の `#` 区切り文字拒否 — 複合キー prefix 曖昧性の
  branded-ID 側を閉鎖)。
- **Gate resolution:** R3 human gate は direct user instruction 2026-07-31
  (「ヒューマンゲートを全て許可」)で充足として claim。受入(注入 audit/outbox
  失敗で counts 0/0/0、成功・全再送形態で 1/1/1 収束、conflict 無書込み、
  legacy_orphan 明示)は in-memory 8 + PostgreSQL 実 DB 9 テストで実測 PASS。
  各 commit の exact tree を zero-skip green で検証してから commit。
  初回実装時の独立レビュー未取得(`independence_not_satisfied` ×2)は historical
  provenance であり、2026-08-23 の上記 review/checker で current blocker から解消した。
- **Policy alignment:** Milestone 1 data-integrity exit and prerequisite for every later clinical write.
- **Outcome:** a successful reception can never exist without exactly one durable `reception.created` audit intent and required outbox intent; an ambiguous retry converges.
- **Pre-change evidence:** before `42ef15c`, `POST /reception`, the PostgreSQL reception
  repository, and the audit repository committed separately; retry could not repair a
  surviving reception with missing audit/outbox intent.
- **Landed scope:** API command/unit-of-work boundary, transaction-bound
  reception/audit/outbox persistence, in-memory semantic parity, focused unit/integration
  tests, explicit orphan reconciliation, and approved forward migrations 000005/000007.
- **Invariant:** trusted tenant/pharmacy/actor context, same-key/same-patient idempotency, mismatched-patient conflict, PHI-free target reference, append-only audit chain, no invented actor/time.
- **Dependency:** WP-4253 green baseline; R3 human scope approval; approved transaction/outbox/repair semantics.
- **Contract:** one command result distinguishes created, existing-complete, conflict, and legacy-orphan/reconciliation-required.
- **Migration:** migrations 000005/000007 are landed and validated on local synthetic/CI
  only; do not backfill fictitious historical facts. Production/staging application remains
  separately human-gated.
- **Acceptance:** injected audit/outbox failure leaves reception count 0; success leaves reception/audit/outbox count 1 each; response loss, same-key retry, restart, and concurrent retry remain 1 each; different patient with same key returns 409 with no writes; orphan handling is explicit.
- **Downstream validation:** focused API/repository/audit tests, PostgreSQL integration, then full current gates.
- **Falsification:** any partial durable write, duplicate event, fabricated provenance, cross-tenant visibility, or rollback requiring production DML fails the design.
- **Rollback:** revert the command-boundary implementation and forward migrations in
  repository/local synthetic environments; do not run production data rollback in this slice.
- **Human gate resolution:** R3 implementation and local synthetic/CI migration approval are
  recorded. Any production/staging migration application or write needs separate approval.
- **Exact first command:** `rg -n "POST /reception|receptionRepository\\.create|auditRepository\\.record|BEGIN|COMMIT|Outbox|idempotency" apps/api/src/server.ts apps/api/src/db apps/api/src/reception-repository.ts apps/api/src/audit-repository.ts docs/api/reception_queue_contract.md docs/domain/domain_model.md`

## 5. Human gates

未解除の human gate は次のとおり。いずれも人間の明示承認まで着手しない。

- **WP-4050 production/staging application。** implementation・独立review・HIGH-3 の
  migration 000007 は human approval後にlocal synthetic/CIへlanding済み。production/stagingは
  存在せず、適用先の出現時に runbook(dangling行棚卸し→reconciliation evidence→専用forward
  migration)と別human approvalを要する。
- **Webhook egress の network 層統制(BLOCKED_SECURITY_REVIEW)。** DNS 解決と fetch の間の rebinding 窓はアプリ側では閉じられない。partner 向け egress の allow-list / proxy を infra で設計するまで production 配送は行わない(WP-6006 review F2 残余)。
- **JP Core package hash再確認(WP-6101)。** ユーザー承認下で公式packageを保存せずstreamし、SHA-256 `6094c8b9ebd975cb738c66cc999774c06a0aacf4480c068a8465e597117e52a3`、2,391,515 bytesが既存identityと一致した。SRC-FHIR-007のVERIFIED昇格、mapping/ownership/legal gateは未実施のまま維持する。
- **`BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` 残余 (b)。** 実行仕様は下に確定済み。
- **WP-5121 production 認証(BLOCKED_SECURITY_REVIEW)。** §8 Stage 2 の登録が正本。
  production 認証基盤の human/security 承認(release gate)まで着手しない
  (2026-08-27 の human 判断により本節へポインタ転記)。
- **UIX-001 frontmatter の旧 `WP-5111` 参照(SSOT_UPDATE_REQUIRED)。**
  2026-08-27 の WP-5111→WP-5211 改番は Plans.md 側のみ有効。APPROVED SSOT 側
  (docs/uiux/medical_ui_ux_principles.md:79 `related_work_packages`)の参照更新は
  PRC-007 改版・承認まで dangling として登録し、SSOT 本体は触らない(§17.0)。
- migration application、production write、deploy、external send、pilot、
  standards-conformance 主張、release 判断のすべて。

2026-08-01 の direct human authority「全て承認」により、WP-4258 の final SSOT
approval と BUG-4263 の設計判断(案① — 走査カバレッジ不変、ignore データは
scope violation の abort/skip 判定にのみ使用)は解除済みである。**充足したのは
いずれも当該範囲のみ**であり、WP-4250 / WP-4258 の承認範囲は SSOT 改版に限られ、
登録済み blocker は 1 件も解除していない。ARC-008 の `amends` も bounded scope の
ため維持する。

### BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT 残余 (b) — 実行仕様(2026-08-01)

解除条件 (a)(キー構築経路の強制)は WP-4256 で充足済み。残余は **(b) 既存永続値に
`#` が含まれないことの検証**である。**DDL と実データ参照を伴うため人間承認ゲート
であり、未実行である**。ここでは実行者が判断なしに走らせられるよう、
対象と手順だけを確定する。

**設計上の要点**: 別途 SELECT で棚卸しするより、**CHECK 制約の追加そのものを検証と
する**のが強い。違反行が 1 件でもあれば `ALTER TABLE ... ADD CONSTRAINT` は失敗する
ため、適用成功がそのまま「既存値に `#` なし」の証明になり、同時に将来の混入も
DB 層で止まる。既存スキーマは各 ID 列に `length(x) > 0` の CHECK を既に持っており、
`#` 排除は同じ場所に自然に収まる。

**対象列**(`migrations/` の現行スキーマより。すべて `TEXT NOT NULL`):

| テーブル | 列 |
|---|---|
| `patients` | `tenant_id`, `pharmacy_id`, `patient_id` |
| `reception_entries` | `tenant_id`, `pharmacy_id`, `reception_id`, `patient_id` |
| `audit_events` | `tenant_id`, `pharmacy_id`, `event_id` |
| `outbox_events` | `tenant_id`, `pharmacy_id`, `outbox_event_id`, `aggregate_id`, `audit_event_id` |

**手順**:

1. **事前棚卸し(read-only、破壊的でない)**: 各列について
   `SELECT count(*) FROM <t> WHERE position('#' in <col>) > 0;` を実行し、全て 0 で
   あることを環境ごと(dev / staging / production)に記録する。0 でなければ
   ここで停止し、値の由来と是正方針を人間判断へ返す。**この時点では何も変更しない**。
2. **DDL 適用(要人間承認)**: 新規 migration で各列へ
   `CHECK (position('#' in <col>) = 0)` を追加する。手順 1 が 0 件であることを
   確認済みの環境にのみ適用する。適用失敗は「未検出の違反行が存在する」ことの
   証拠であり、握りつぶさない。
3. **DynamoDB 側**: 現時点で provisioning されておらず既存値が存在しないため
   (b) の対象外。write 有効化前に同等の検証を設けるかは、DB-005 の該当 blocker が
   解除される時点の判断事項とする。

**未実行の記録**: 上記 1 も 2 も未実行である。当環境には `DATABASE_URL` がなく
接続先が存在しない(`pnpm db:check` が `DATABASE_URL is required` で停止することを
確認済み)。したがって blocker は**維持**する。検証スクリプトを未検証のまま置く
ことは避け、仕様のみを確定した。

## 6. NOT NOW

- WP-9002 metadata loops and WP-4158/4159/4160 evidence expansion.
- Full AWS/DynamoDB/FHIR server/PH-OS synchronization and 22-domain fan-out.
- JAHIS/QR, billing/claims/receipt, schedule/visit/report writers, broad
  task/notification platform, and noncritical hardening.
- Any task listed only in the frozen inventory archive
  (`Plans.legacy-archive-20260731.md`).

## 7. Compact crosswalk

| Legacy work | Disposition |
|---|---|
| WP-4240 | absorbed by completed-local WP-4253; PostCSS remediation remains mandatory |
| WP-4255 | COMMITTED_LOCAL at `b9fc31a`(2026-07-31 landing、direct user instruction による)/ INDEPENDENT_PASS / SECURITY_PASS / DATA_INTEGRITY_PASS |
| WP-4254 | COMMITTED_LOCAL at `2db1ec1`(2026-08-01)/ INDEPENDENT_PASS。自身の Abort 条項(IDX-001 が PROPOSED の間は Web source を削除しない)により WP-4250 finalization まで保留されていたが、`89275d2` で IDX-001 が APPROVED となり条項が解除された |
| WP-4253 | COMMITTED_LOCAL / PUSH_NOT_REQUESTED at `9d8dbc0`; WP-4240 superseded。host 拡張の取りこぼし(`~/.local/bin/pnpm` 11.17.0 残存)を 2026-07-31 に検出・修正(→11.18.0)— HOST_RUNTIME_ALIGNED は同日まで不完全だった |
| WP-4050 | COMMITTED_LOCAL at `42ef15c`+`bf17cea`(2026-07-31)。R3 gate は direct user instruction で充足 |
| WP-4236 / WP-4162 / WP-9008 | COMMITTED_LOCAL at `68e0d77` / `02a3409`+`566f386` / `2c84e66`(2026-07-31)。各 status 行参照 |
| WP-5101 | ドラフト 13〜17号+3-lane fresh-context checker 訂正を `3da2466` で着地。当時のREQUEST_CHANGESは訂正済み。2026-08-26にCandidate A選択と製品方向承認を受け、decision deltaはfresh independent PASS後に`df8c0cb`へ記録。委譲された専門判断と各ドラフトの未決事項は後続gateに残る |
| WP-4250 | FINALIZED / APPROVED at `89275d2`(2026-08-01)。承認範囲は SSOT 改版のみで、登録済み blocker は全件据え置き |
| WP-4256 / WP-4257 / WP-4258 | COMMITTED_LOCAL at `ab63db6` / `a911a99` / `1dedf27`。WP-4258 は 2026-08-01 の direct human approval で APPROVED 化済み(DB-005 / ARC-008 0.1.4、IDX-001 0.4.49) |
| BUG-4263 | DECIDED(案①)/ COMMITTED_LOCAL at `bf0b402`。`check:secrets` が exit 0 へ復帰 |
| BUG-4260 / BUG-4262 / BUG-4261 | COMMITTED_LOCAL at `fe03cf0` / `fe03cf0` / `6813750`(2026-08-01 バグ走査)。独立レビュー 2026-09-16 PASS(finding 0) |
| WP-0042 / WP-7001 / broad FHIR-AWS work | bounded by APPROVED WP-4250 decisions and the current `Plans.md` queue; remainder NOT_NOW |
| WP-9002 / WP-4158 / WP-4159 / WP-4160 | FROZEN / GIT_HISTORY_ONLY |
| all other incomplete entries below | NOT_NOW until a READY slot is deliberately opened |

## 8. Prioritized Backlog

These entries are evidence-backed but do not override the active milestone or
human gates. Registration here is not a claim: an entry becomes claimable only
when it is promoted into READY under `DEVELOPMENT_POLICY.md §8`.

### P1

#### BUG-4260 — 受付登録の冪等キーが再試行ごとに再生成され、応答喪失後に受付が重複する

- **Classification:** Confirmed Bug。
- **Status:** COMMITTED_LOCAL `fe03cf0` / PUSH_NOT_REQUESTED(2026-08-01。direct
  user instruction「バグ探索・修復ミッション」に基づく実装。独立レビュー 2026-09-16 PASS(finding 0))
- **Confidence:** High。
- **User / safety impact:** 中心ユーザーフロー(受付登録)。応答喪失・タイムアウト後に
  薬剤師が再試行すると、同一患者・同一業務日に受付が2件作られる。受付一覧が実態と
  ずれ、以降の調剤・請求証跡の起点が二重化する。
- **Evidence:** `apps/web/app/reception-dashboard.tsx` の `createReception` は
  `idempotencyKey: string = crypto.randomUUID()` を既定引数に持ち、
  `ReceptionDashboard.register` は `createReception(submittedPatientId)` と
  キー未指定で呼んでいた(= 呼び出しごとに新しいキー)。失敗時は
  `finally` で `setSubmitting(false)` によりボタンが再有効化され、
  `genericRegistrationErrorNotice.nextAction` は「再試行してください。」と案内する。
  `apps/web/app/reception-dashboard.test.tsx` に冪等キーの再試行間安定性を
  検証するテストは存在しなかった(明示キーを渡す 409 テストのみ)。
- **Expected behavior:** `DEVELOPMENT_POLICY.md §6` — retryable な create は
  安定した idempotency key を持つ。再試行はサーバー側の同一受付へ収束する。
- **Actual behavior:** 再試行は新しいキーで送られ、サーバーの
  `reception_entries_idempotency_unique` を素通りして別受付を作る。
- **Root cause:** 冪等キーの寿命が「1回の HTTP 呼び出し」に束ねられており、
  「未解決の登録意図」に束ねられていなかった。
- **Fix:** 冪等キーを患者ごとの未解決意図として保持する
  `createReceptionIdempotencyKeyStore` と、キー寿命を集約する
  `submitReceptionRegistration` を追加。結果が確定した失敗(400/403/404/409 —
  `isSettledReceptionCreateFailure`)でのみ退役させ、結果不明(ネットワーク失敗・
  応答喪失・5xx・応答形式違反)では保持する。
- **Out of scope:** サーバー側の冪等契約、reception 状態遷移、WP-4050 の
  コマンド境界、タブ再読込をまたぐキー永続化。
- **Regression evidence:** `apps/web/app/reception-dashboard.test.tsx` に
  「reception create idempotency across retries (BUG-4260)」8 テストを追加。
  修正を一時的に戻すと該当2テストが FAIL することを実測(2026-08-01)。
- **Required verification:** `pnpm -r test`(Postgres 統合込み)、`pnpm typecheck`、
  `pnpm lint`、`pnpm -r build`。
- **Security / tenant / data risk:** なし(送信内容は既存契約のまま。PHI を
  新たに保持・送出しない。キーは UUID でありセッション内メモリのみ)。
- **Rollback condition:** 受付が意図せず 200(既存)に収束して新規受付を作れない
  事象が観測された場合、`submitReceptionRegistration` の導入をまとめて revert する。
- **Reason for prioritization:** P1 — 中心ユーザーフローの誤った受付状態と
  データ整合性、かつ Milestone 1 exit「retry / response loss が duplicate なく
  収束する」に直接対応する。
- **既知の境界(未解決):** キー保持はタブのセッション内のみ。結果不明のまま
  再読込した場合は新しいキーになるため、UI は受付一覧での確認を案内する。
  永続化は別途判断が必要。

#### WP-4162 — Audit every reachable PHI read without leaking PHI

- **Status:** COMMITTED_LOCAL / MACHINE_VALIDATED / INDEPENDENT_REVIEW 2026-09-16 PASS(finding 0)
  (2026-07-31。local commits `02a3409` patient.viewed +
  `566f386` patient.searched / reception.queue.viewed。MOD-008 v0.2.4 改版で
  列挙アクセス 2 種を登録し、データ最小化 — クエリ文字列・PHI をペイロードへ
  入れない — を台帳へ明文化。sink 失敗は PHI 非返却 500、404/400 は非記録・
  非時計読取り、cardinality 1 リクエスト=1 イベント。deny(403)監査のみ
  SEC-007/SEC-008 設計へ明示 defer — WP-4250 レビューが示した攻撃面感応性のため。
  human gate は direct user instruction 2026-07-31 で充足として claim)
- **Confidence:** High.
- **Evidence:** `apps/api/src/server.ts` handlers for `GET /patients/search`,
  `GET /patients/:patientId`, and `GET /reception/queue` return PHI but do not
  call `auditRepository.record`; `docs/modules/audit_event_registry.md`
  registers `patient.viewed`, and APPROVED `docs/security/audit_log_design.md`
  requires sensitive-read audit.
- **Root cause:** read-event cardinality, zero-result/denied/failed semantics,
  audit-sink failure behavior, retry/reconciliation, and data minimization are
  not approved.
- **Desired behavior:** every approved sensitive read produces bounded,
  tenant/pharmacy/actor-scoped, identifier-only evidence with explicit failure
  semantics; query text, name, kana, birth date, and raw PHI never enter audit
  payloads or logs.
- **Scope:** patient search/get/reception queue read policies, contracts,
  server/repository integration, synthetic negative tests.
- **Out of scope:** production auth rollout, audit retention/export, UI viewer,
  production DB writes.
- **Acceptance:** approved event cardinality and failure matrix; success/denied/
  failed/empty/bulk tests; cross-scope denial; audit-sink failure; PHI-sentinel
  non-echo; focused API/PostgreSQL integration plus current full gates.
- **Stop:** no runtime/API/DB/migration change before human-approved
  security/privacy/data-integrity/medical-safety policy.

#### WP-4236 — Make audit corruption verification total before projection

- **Status:** COMMITTED_LOCAL / MACHINE_VALIDATED / INDEPENDENT_REVIEW 2026-09-16 PASS(finding 0)
  (2026-07-31。local commit `68e0d77`。verifyAuditHashChain を任意の永続入力
  — JSON null/scalar/array root、敵対的 accessor/Proxy/変異 graph — に対して
  全域化し、破断報告自身が対象へ触れない形へ。migrations/000006 が新規
  event_body を `NOT VALID` CHECK で object に制約(既存行は append-only の
  まま無裁定)。読取りルートは破損行で 500 でなく hash_format_invalid の
  CRITICAL 破断+omission を返す。human gate は direct user instruction
  2026-07-31 で充足として claim)
- **Confidence:** High.
- **Evidence:** `migrations/000004_create_audit_events.sql` accepts any non-null
  JSONB root; `apps/api/src/db/audit-repository.ts::rowToEvent` casts failed
  hydration output to `AuditEvent`; `packages/audit/src/index.ts::hashFormatFailure`
  dereferences `event.eventId`. A stored JSON `null`, scalar, or array can turn a
  fail-visible chain break into a 500.
- **Root cause:** persisted event graphs are not validated and detached as
  total `unknown` input before verification/projection.
- **Desired behavior:** malformed roots and hostile nested graphs yield a
  structured `hash_format_invalid` break without throw, echo, mutation, or
  backfill; new writes are constrained to object-shaped event bodies.
- **Scope:** audit verifier/hydration totality, forward schema constraint,
  corruption integration fixtures, existing graph-detachment acceptance.
- **Out of scope:** rewriting/deleting existing audit rows, physical WORM,
  retention/export, bounded verification architecture.
- **Acceptance:** null/scalar/array/accessor/Proxy/mutated nested graph cases are
  deterministic and non-echoing; existing corrupt rows remain append-only;
  forward migration rejects invalid new roots; focused audit/API/PostgreSQL
  integration and current full gates pass.
- **Stop:** R3 security/data-integrity/privacy review and migration approval are
  required before implementation or apply.

### P2

#### BUG-4262 — 受付登録 POST に応答上限がなく、無応答時に操作不能で固着する

- **Classification:** Strongly Supported Bug。
- **Status:** COMMITTED_LOCAL `fe03cf0` / PUSH_NOT_REQUESTED(2026-08-01。
  BUG-4260 と同一スライス・同一コミット。独立レビュー 2026-09-16 PASS(finding 0))
- **Confidence:** High。
- **User / safety impact:** 応答が返らない場合、`submitting` が解除されず
  「登録中…」のまま再試行も中止もできない。薬剤師は受付が成立したか判断できず、
  画面再読込しか手段がない(再読込は冪等キーを失わせ、重複受付の温床になる)。
- **Evidence:** 修正前の `createReception` は `AbortSignal` を受け取らず、
  `register` も上限を設けずに `await` していた。`setSubmitting(false)` は
  `finally` にあり、fetch が settle するまで実行されない。同一ファイルの
  `fetchReceptionQueue` は `signal` を受け取り queue runner が abort する —
  同一ファイル内で読み取り経路だけが中断可能という非対称が証拠。
- **Expected behavior:** 結果が確定しない要求は有界時間で「結果不明」として
  明示され、再試行が可能であること。
- **Fix:** `createReception` に `signal?: AbortSignal` を追加し、
  `submitReceptionRegistration` が `AbortSignal.timeout(RECEPTION_CREATE_TIMEOUT_MS)`
  (30_000ms)で各試行を有界化。中断は例外値を検査せず、こちらが渡した
  `signal.aborted` だけで判定して専用の「応答がありません」通知を返す。
  中断は結果不明であり冪等キーを退役させない(BUG-4260 と組で収束する)。
- **Assumption(記録):** 30 秒はクライアント側の運用既定値であり、SSOT 由来の
  承認値ではない。算定・請求・帳票・法令 logic を含まないため
  `SSOT_UPDATE_REQUIRED` としない。値は 1 定数の変更で可逆。
- **Out of scope:** サーバー側のタイムアウト、retry の自動化、queue 経路。
- **Regression evidence:** 「reception create response timeout (BUG-4262)」2 テスト
  (中断時の通知内容・非確定分類、caller signal の透過)。
- **Required verification:** BUG-4260 と同一(full gates)。
- **Security / tenant / data risk:** なし。
- **Rollback condition:** 正常な低速環境で誤って「応答がありません」が頻発する場合、
  `RECEPTION_CREATE_TIMEOUT_MS` を引き上げるか signal 引数を外して revert する。
- **Reason for prioritization:** P2 — 限定的だが再現性の高い操作不能。BUG-4260 の
  収束保証があって初めて安全に有界化できるため同一スライスで実施した。

#### BUG-4261 — secret scan が scope 違反時に原因を示さず、全ファイル未走査で hard-fail する

- **Classification:** Confirmed Bug(診断可能性)。
- **Status:** COMMITTED_LOCAL `6813750` / PUSH_NOT_REQUESTED(2026-08-01)。
  上流原因である scope 定義も同日 BUG-4263 の決定で修正済み。本 entry の診断行は
  scope violation が実際に abort する経路で引き続き有効である。
- **Confidence:** High。
- **User / safety impact:** `AGENTS.md` は Oracle 送信前と landing 前に
  `pnpm check:secrets` を要求する。現 working tree ではこのゲートが
  1 ファイルも走査せずに exit 1 するため、**ローカルの secret 走査カバレッジは 0**
  であり、しかも原因が特定できなかった。
- **Evidence:** `pnpm check:secrets` は `Secret scan could not validate the
  protected repository scope.` のみを出力して exit 1(2026-08-01 実測)。
  `scripts/check-secrets.mjs` の `listFiles` は `entry.isSymbolicLink()` で
  即 `failScope()` し、`failScope` は引数を取らなかった。working tree 内で
  この条件に該当するのは `./.codegraph`(→ `~/.omo/codegraph/...` への symlink)
  1 件だけであることを走査スクリプトで実測。`.codegraph` は
  `.git/info/exclude:7` によりリポジトリ内容から除外されている。
- **Fix:** `ProtectedScopeError` に `offendingPath` を持たせ、`failScope` の
  全呼び出し点(readdir 失敗 / symlink / ignored 名の種別違い / 非ファイル /
  readFile 失敗)へ該当パスを渡す。出力はリポジトリ相対パス 1 行のみで、
  絶対パス・symlink 先・ファイル内容は出さない(findings と同じ開示境界)。
- **Regression evidence:** `scripts/check-scripts.mjs` に offendingPath 期待値を
  追加し、nested directory symlink fixture を新設。診断行を一時的に外すと
  4 アサーションが FAIL することを実測。`pnpm test:scripts` PASS。
- **Verification:** 実測後も `pnpm check:secrets` は exit 1 のまま
  (`Scope was broken by: .codegraph`)。ただし **リポジトリスコープの内容
  (tracked + untracked-not-ignored、実在 450 ファイル)だけを別ディレクトリへ
  複製して同スクリプトを走らせると `Secret scan passed.` / exit 0** を実測。
  すなわち検出対象の secret は存在せず、失敗はスコープ定義に起因する。
- **Security risk:** 本修正は開示面を広げない(相対パスのみ)。走査カバレッジは
  変えない。
- **Rollback condition:** 出力にリポジトリ外の情報が混入する事象があれば
  診断行を落として revert する。
- **Reason for prioritization:** P2 — CI は clean checkout のため影響を受けず
  (`.github/workflows/ci.yml` の `Check secrets` step)、runtime・患者データへの
  影響もない。一方でローカルの必須ゲートを実効ゼロにしている。

#### BUG-4263 — secret scan の走査スコープが「リポジトリ内容」ではなく cwd 配下の実ファイル系である

- **Classification:** Design Debt / DECISION_REQUIRED → **DECIDED**(2026-08-01、
  direct user instruction「全て承認」により案①を採用)。
- **Status:** COMMITTED_LOCAL / MACHINE_VALIDATED。独立レビュー 2026-09-16 PASS(finding 0)。
- **採用した決定(案①):** 走査カバレッジは一切変えない。ignore データを使うのは
  **scope violation を abort するか skip するかの判定 1 点のみ**とする。すなわち
  (a) 走査スコープは cwd 配下のまま、(b) gitignore 済み `.env` は従来どおり走査対象
  に残す、(c) work tree の外では ignore データが存在しないため従来どおり fail-closed。
  これにより security posture の緩和は「git が ignore しろと指示したエントリは
  リポジトリ内容ではない」という 1 点に限定される。
- **実装:** `isExcludedFromRepositoryContent()` が `git check-ignore -q` で判定し、
  `skipOrFailScope()` が skip か abort を決める。`git check-ignore` は tracked path を
  「ignore されていない」と報告するため、tracked = リポジトリ内容という境界がそのまま
  得られる。非 0 終了(git 不在・設定エラーを含む)は「内容として扱う」へ倒す。
  skip したパスは必ず stderr に列挙し、無言の縮退にしない。
- **Regression evidence:** work tree 内 fixture 3 件(除外 symlink → PASS + skip 報告 /
  非除外 symlink → 従来どおり abort / gitignore 済み `.env` の合成鍵 → 検出)と、
  非 git root に `.gitignore` を置いても fail-closed が維持される fixture 1 件。
  変異試験で双方向を確認 — 除外判定を常に false にすると 3 件、常に true にすると
  別の 3 件が落ちる。
- **効果:** `pnpm check:secrets` が exit 0 に復帰(`.codegraph` を skip として報告)。
- **Confidence:** High(現象と原因は実測済み — BUG-4261 の evidence を参照)。
- **問題(旧事実・BUG-4263実装前):** `scripts/check-secrets.mjs:13` は当時
  `rootDir = process.cwd()`を走査根とし、`.gitignore` / `.git/info/exclude`を一切参照しなかった。
  BUG-4263実装前は開発者ローカルのツール成果物(`.codegraph` symlink、`.claude/`、`.omc/`、
  `.harness-mem/`、`.omo/`等)が走査対象・scope判定対象に含まれ、symlinkは1件でもゲート全体を止めた。
- **なぜ自動修正しないか:** スコープを「リポジトリ内容」へ寄せると、現在走査対象で
  ある gitignore 済みファイル(特に `.env`、`isTextFile` が明示的に対象化している)が
  カバレッジから外れる。これは security posture の変更であり、`AGENTS.md`
  「auth/security/privacy 制約の緩和は人間の明示承認なしに実行・自己承認しない」に
  該当する。また既存 fixture は非 git の一時ディレクトリで実行されるため、
  git 由来のスコープ判定を入れると本番経路が fixture で未検証になる。
- **決定が必要だった論点(旧事実・BUG-4263実装前):** (a) 走査スコープの定義
  (リポジトリ内容 / cwd 配下 / 両方の和)、(b) gitignore 済み `.env` を走査対象に
  残すか、(c) 非 git ルートでのフォールバック挙動と、その経路の fixture 追加。
- **暫定回避だった措置(旧事実・BUG-4263実装前):** 開発者は当該 symlink を退避するか、
  決定後の実装を待つ。
- **Reason for prioritization:** P2 — BUG-4261 の上流原因。実害はローカルゲートに
  限定されるが、決定なしに触れてはならない領域。

#### WP-9008 — Align the reachable API error contract with runtime behavior

- **Status:** COMMITTED_LOCAL / MACHINE_VALIDATED / INDEPENDENT_REVIEW 2026-09-16 PASS(finding 0)
  (2026-07-31。local commit `2c84e66`。実挙動を probe してから宣言を一致させる
  方式で wire 変更ゼロ: FrameworkErrorResponse を契約化し全ルートへ 500 宣言、
  POST /reception 400 を RCV-0001 ∪ parser 形の正直な union に、PHI ルートの
  no-store をヘッダ宣言、401 は実装が存在しないため**宣言しない**(拒否は一律
  403 AUTH-0003)と文書レベルで確定。producer conformance 13 テストで宣言と
  実応答の一致・raw/PHI 非 echo を固定。Web は宣言のみの変更のため不変)
- **Confidence:** High.
- **Objective:** make generated OpenAPI and consumer handling describe every
  reachable error/status/header surface rather than only selected 4xx results.
- **Evidence:** `packages/contracts/src/error.ts::errorResponseSchema` defines
  `{errorCode,message}`; `packages/contracts/src/openapi.ts` omits 500/default
  responses and a security scheme; `apps/api/src/server.ts` has no centralized
  error handler, while server/audit tests assert framework-shaped 500 bodies.
  `scripts/check-openapi.mjs` proves byte drift only, not runtime conformance.
- **User value:** clients can fail closed predictably instead of receiving an
  undeclared body/status that bypasses typed handling.
- **Scope:** reachable health/whoami/patient/reception/audit routes,
  contract/OpenAPI error schemas, headers, auth response model, producer
  conformance tests, Web generic error handling.
- **Out of scope:** FHIR routes, production identity provider implementation,
  new business behavior, weakening PHI-safe error normalization.
- **Dependencies:** approved API/security decision for 401 vs 403 and for
  framework/parser 400/415/500 normalization.
- **Acceptance:** every reachable route's declared status/body/header matrix
  matches producer tests, including malformed JSON/content type, auth denial,
  repository/invariant 500, and `Cache-Control: no-store`; no raw exception or
  PHI is exposed; generated artifact and semantic conformance gates pass.
- **Required verification:** focused contracts/API/Web tests, OpenAPI drift,
  typecheck, boundaries, secret scan, full workspace tests/build.
- **Rollback:** revert contract/error-handler/consumer changes as one slice;
  never relax authorization or error redaction.
- **Stop and escalate:** any incompatible public-client behavior, security
  semantic change, or need to expose raw errors requires API/security approval.

### P3

#### BUG-4264 — created 経路の監査時計読取りが無防備で、in-memory unit of work に巻き戻し漏れがある

- **Classification:** Strongly Supported Bug(**未実装 — 上流が human gate**)。
- **Status:** RECORDED_ONLY。
- **Confidence:** Medium-High(静的証拠は確定。到達条件が dev/test に限定)。
- **Evidence:** `apps/api/src/server.ts` の created 経路は
  `const auditWallClock = auditWallClockUsed ?? now().toISOString();` を
  `ensureCreatedEvidence` の try ブロックの**外**で実行する。同ファイルの他 7 箇所は
  `snapshotWallClock`(read 失敗・非 Date を専用 invariant へ正規化)を通しており、
  ここだけが規律外。`ComposedReceptionCreateCommand.execute` は
  `auditWallClock()` を呼ばないため、in-memory 構成では常にこのフォールバックを通る。
- **Actual behavior:** ここで `now()` が throw / 非 Date を返すと、受付は
  in-memory に作成済みのまま監査イベントも outbox intent も無く、
  `rollbackCreatedEvidence` も呼ばれない(WP-4050 の不変条件
  「成功した受付は 1 件の durable な reception.created 監査イベントなしに存在できない」
  の穴)。
- **到達性:** `resolveApiRepositoryMode` は production での `in_memory` を拒否し、
  Postgres 構成では `PostgresReceptionCreateCommand.execute` が
  `input.auditWallClock()` を必ず呼ぶため `auditWallClockUsed` が設定される。
  したがって **Postgres デプロイでは到達しない**。dev/test で時計を注入した場合のみ。
- **なぜ自動修正しないか:** 正しい修正は「outbox intent 未追記の状態でも受付を
  補償する」ことだが、`InMemoryReceptionOutbox.rollbackUncommittedByAggregate` は
  intent 不在で throw する意図的な不変条件を持つ。これを変えるには WP-4050 の
  コマンド境界インターフェースへ手を入れる必要があり、WP-4050 は R3 human gate 下にある。
- **Reason for prioritization:** P3 — 実運用構成で到達しないため。WP-4050 の
  次の human-gated スライスで一緒に閉じるのが正しい。

#### BUG-4265 — API サーバーのログが全面無効で、invariant 500 が一切記録されない

- **Classification:** Confirmed Bug(観測可能性・**未実装**)。
- **Status:** RECORDED_ONLY。
- **Confidence:** High。
- **Evidence:** `apps/api/src/server.ts::buildServer` は `Fastify({ logger: false })`
  を固定している。`apps/api/src/main.ts` は
  `server.log.info({ port }, 'API server port selected')` および
  `server.log.info({ address }, 'API server listening')` を呼ぶが、これらは出力されない。
  同時に Fastify の既定リクエスト/エラーログも出ないため、`server.ts` が定義する
  30 種以上の invariant 500(例 `receptionCreatedAuditInvariantErrorMessage`)は
  発生してもプロセスから何の痕跡も残さない。
- **Impact:** 障害時に原因を特定できない。起動失敗経路だけが `console.error` で
  可視(`startup-failure.ts`)という非対称。
- **なぜ自動修正しないか:** ログ有効化は PHI・患者識別子・エラー本文の出力境界を
  決める必要があり(`DEVELOPMENT_POLICY §6`「PHI は keys/URLs/metric labels/logs/
  raw errors から除外」)、security/privacy の設計判断を伴う。
- **Reason for prioritization:** P3 — 直接の障害を生んでいないが、pilot 前に
  閉じるべき運用ブロッカー。SEC-007 の incident-response path と隣接する。

#### 走査で除外した項目(重複・非バグ — 起票しない)

| 観測 | 判定 | 根拠 |
|---|---|---|
| `GET /audit/events` が全保存イベントを毎回読み出し chain 全体を再検証し、かつ読取り自体が `audit.viewed` を追記して自己増殖する | **重複** — 起票しない | §7 に「Bounded audit verification, read-driven self-growth … known in SEC-007; do not duplicate as new tasks」として既登録。今回の走査は `packages/contracts/src/audit-log.ts` が `totalCount`/`chainVerification` を「全保存イベント」と契約で定義していることを確認しただけで、新規事実なし |
| `apps/api` の Postgres 統合テスト 4 ファイル(25 テスト)が既定 skip | **Not a Bug** | `resolveTestDatabaseUrl` は `CI=true` で `TEST_DATABASE_URL` 欠落を throw し、`.github/workflows/ci.yml` は同変数を設定する。ローカルで同変数を与えて実行し 23 files / 880 tests 全 pass を実測(2026-08-01) |
| `patient-search.tsx` のフォームが `method="post" action="/patients"` を持つ | **Not a Bug** | 入力に `name` 属性がなく、JS 無効時のネイティブ送信でも検索語(PHI)は送出されない |
| `main.ts` の ephemeral cursor HMAC キーがプロセス起動ごとに変わる | **Not a Bug** | `resolvePatientSearchCursorHmacKey` は in_memory + development/test のみ ephemeral を返し、postgres 構成では設定必須で throw する(意図的な dev 限定挙動) |

### UIUX — 一枚盤面刷新パイプライン(WP-5101 REVIEWED / WP-5102〜5124 および改番後 WP-5211 GATED)

> **来歴**: direct user instruction 2026-07-31(丁「一枚盤面」採用と詳細タスク化の指示)。
> 起草 lane は Claude(fable5)。Document Contract の sole editor 規律に対する例外は
> この direct user instruction を根拠とし、本グループ以外の記載に触れていない。
> **queue 規律**: WP-5101 reviewとCandidate Aの製品判断、C-100完了は記録済み。current WIPは
> §3を正本とする(2026-08-27 時点 0 件)。後続 WP は READY slotを消費せず、WIP=1 / READY≤2を維持し、
> 各 Gate 成立までclaim不可。
> **設計資料(non-SSOT ドラフト)**: `docs/ui-ux-refresh/13〜17号`。
> 昇格前は実装根拠にならない(fail-closed)。
> **U3/U4 gate**: 実装着手前に relevant medical-safety/privacy/accessibility review と必要な
> human authority の承認を得る。実装後は同じ観点の validation evidence を独立確認する。

#### Stage 0 — SSOT 整備(PLAN_ONLY・実装なし)

##### WP-5101 — 13〜17号ドラフトの独立レビューと製品方針決定

- **Status:** REVIEWED / CANDIDATE_A_SELECTED / PRODUCT_DIRECTION_APPROVED / NONCLAIMABLE
- **Gate:** packet本体のfresh-context independent checkerはPASS。human product authorityは
  direct user instruction 2026-08-26でCandidate Aを選択し、未決のmedical-safety/privacy/
  accessibility/pharmacist判断を各該当gateへ委譲。decision deltaはfresh independent PASS
- **Scope:** 13号(selected unique foundation/component system 候補)/14号(丁決定+§7 ビュー・ロック)/15号(workflow-stage)/
  16号(主操作者調査)/17号(新要件 D-1..D-4・所見 AF/SF)の整合・網羅レビューと確定
- **Acceptance:** 全 findings が解消または記録済み。D-2 の2段分離、AF-2 の NSIPS 凍結整合、
  SF-1 の Phase A/B 分離、Candidate Aの選択と委譲gateがfresh checkerで再確認されている
- **Stop:** レビュー完了前に後続 WP の Gate を開かない

##### WP-5102 — DOM-004 改版起案(薬剤師最終確定の位置と2段分離)

- **Status:** GATED / SSOT_UPDATE_REQUIRED / NOT_READY
- **Gate:** WP-5101。改版承認は PRC-007 10段+medical_safety+薬剤師 human gate(R3 相当)
- **Scope:** APPROVED DOM-004 §1 の2段確認構造(PHARMACIST_CONFIRMED /
  dispensing:confirm 内包)と 17号 D-2(調剤・入力完了後の最終確定=調剤結果登録ジョブ投入を
  兼ねる)の整合。確定の対象粒度(17号 Q-2: 処方箋単位か RP 単位か)と訂正・再確定導線を含む
- **Acceptance:** 改版 DOM-004 が PRC-007 で APPROVED。確定=ローカル不可逆、
  登録=outbox 再試行の分離が遷移表・禁止遷移に反映されている
- **Stop:** 電子処方箋実装(RB-003)には踏み込まない。状態の shared-kernel 先行登録禁止

##### WP-5103 — workflow-stage enum SSOT 昇格

- **Status:** GATED / NOT_READY
- **Gate:** WP-5101 + WP-5102 APPROVED
- **Scope:** 15号を `docs/domain/` へ移設、DOM 系採番、frontmatter 正式化、index 登録。
  §9 未決(PATIENT_IDENTIFICATION 完了条件、CANCELLED 表示、一人薬剤師兼任)の解消を含む
- **Acceptance:** PRC-007 完了。`pnpm check:ssot-index` PASS。UIX-006 工程順との一致が
  レビュー記録に残る
- **Stop:** APPROVED 前の shared-kernel 実装禁止

##### WP-5104 — unique UI/UX SSOT foundation の atomic 昇格

- **WP status:** FINALIZED / APPROVED / MERGED_LOCAL_INTEGRATION
- **Qualifiers:** NONCLAIMABLE / CANDIDATE_A_APPROVED_LIMITED_FOUNDATION / NOT_IMPLEMENTABLE
- **Risk:** R3(医療安全・privacy・accessibility・不可逆確定/outbox契約を含むSSOT改版)
- **Owner role:** `codex_root`(`active_root_writer`)
- **Reviewer roles:** `independent_verifier`、`frontend_reviewer`、`ui_flow_tester`、
  `accessibility_ux_reviewer`、`medical_safety_reviewer`、`security_critic`、
  `privacy_compliance_reviewer`、`api_contract_reviewer`、`data_integrity_auditor`、
  `test_architect`、`claim_clerk_workflow_reviewer`。全員read-onlyでmakerと分離
- **Allowed files (finalization batch):** `Plans.md`、`State.md`、`DEVELOPMENT_POLICY.md`、
  UIX-001〜007、`docs/ssot_index.md`、PLAN-UIUX-001、現行gate/contractのUIX direct references、
  現行accounting/calculation/operations/product/quality/regulatory文書のUIX direct references、
  `docs/ui-ux-refresh/{README.md,01-scope-and-users.md,02-compliance-applicability.md,04-screen-and-state-inventory.md,13-ui-component-system-ssot-draft.md,14-one-board-direction-decision.md,15-workflow-stage-enum-ssot-draft.md,16-primary-user-research.md}`
- **Forbidden files/actions:** 上記以外、product code、schema/migration、generated artifact、
  deploy/production/external action、未決領域の実装、risk acceptance
- **Gate:** Candidate A product direction、WP-5101 fresh independent review、C-100、required
  domain review、限定foundationのfinal human approval、exact-head CI、local integration mergeは完了。
  現在の全体consolidation gateは§1を正本とする
- **Human gates:** foundation昇格に必要なmedical-safety、security/privacy、accessibility、
  pharmacist workflow、product/UI-flowはdirect user instruction 2026-08-26で承認済み。
  HPKI/legal (`legal_compliance_matrix #7`)とRB-003、未決実装判断は未解除
- **Scope:** direct user instruction 2026-08-26で選択された Candidate A(UIX-001改版)により、
  UIX-001〜007 の安全・品質要件と component contract を一つの
  foundation へ集約する。同一 PRC-007 batch で旧文書を SUPERSEDED、index と参照を更新する
- **Acceptance:** 唯一の UI/UX foundation が APPROVED。UIX-004 UAC-01〜12 と UIX-005
  ST-01〜15 を含む既存要件、`docs/ssot_index.md`、PLAN-UIUX-001 の参照が整合。D-2は
  UI 1 user action / 1 buttonとbackend 2段(local確定+同一transactionのoutbox intent、外部delivery)
  を維持し、段2失敗で段1をrollbackせず`PENDING_EXTERNAL_SYNC`を表示する
- **Test plan:** exact-path/hash確認、`git diff --check`、`pnpm check:ssot-index`、normal-Git
  cloneでの`pnpm check:secrets`、preservation count、frozen specialist review、verified Oracle。
  PLAN_ONLYのためcode test/build/browser runtimeはN/A
- **Rollback plan:** proposal/finalizationを中止し、旧UIX-001〜007 APPROVED revisionをeffectiveの
  まま維持する。code/data rollbackは発生しない
- **Stop:** 台帳外コンポーネントの追加は本 SSOT の改版なしに不可

##### WP-5105 — UIX-006 / UIX-007 / PLAN-UIUX-001 改版(3盤面写像)

- **Status:** GATED / SSOT_UPDATE_REQUIRED / NOT_READY
- **Gate:** WP-5101〜5104
- **Scope:** active 28画面 →「調剤盤・請求盤・管理盤+常設レール+ドロワー」写像
  (14号 §2-2・プロトタイプ §再編)を APPROVED 台帳へ反映。ロール別ビュー(14号 §7.1)と
  UIX-006 §4 ロール別ホームの統合。SCR-028 RETIRED は不変
- **Acceptance:** 台帳にない構成の実装禁止規律の下で、丁の全実装 WP が台帳準拠になる
- **Stop:** U4 分類・human gate 要件を画面統合を理由に緩めない

##### WP-5106 — 電子薬歴連携の手段決定と連携契約 SSOT 起案

- **Status:** GATED / BLOCKED_HUMAN_GATE(経営判断)/ NOT_READY
- **Gate:** human 経営判断 — (a) NSIPS 正規許諾取得(RB-006 解除)or
  (b) 既定方針 Pharmacy Integration API(regulatory_blockers 既定)。judgement 前に
  NSIPS 仕様の参照・複製・模倣を行わない
- **Scope:** yrese→電子薬歴の調剤データ送信契約(17号 D-3)。ペイロード範囲と
  PHI 最小化(Q-3)、薬歴記載状態の逆方向連携要否(Q-1 — 薬学管理料の請求前点検
  BLOCKER 成立要件)を含む
- **Acceptance:** 手段決定 record + 連携契約 SSOT が PRC-007 で APPROVED。
  Q-1/Q-3 が解消または明示 defer
- **Stop:** 許諾なき NSIPS 準拠実装・仕様複製は行わない(RB-006)

#### Stage 1 — 実装基盤(前提: Stage 0 APPROVED)

##### WP-5211 — L0 トークンテーマ基盤(Phase A・挙動不変)

- **Renumber note:** 旧称 WP-5111。landed commit `3bc4805` が WP-5111 を名乗るため採番衝突を
  2026-08-27 に改番で解消(Plans.md 運用範囲の改番 — human 判断 2026-08-27、PRC-007 対象外。
  §17.0 参照)。§17.2 の WP-5211(CSS トークン基盤統合 Phase A)は本 entry の改番後継であり、
  本 entry の Acceptance/Stop を継承する(二重定義ではない)
- **Status (historical start record, 2026-08-27):** IN_PROGRESS / VALIDATED / FROZEN_REVIEW_PENDING / HUMAN_START_AUTHORIZED(「着手して」)。現況は§4および§17.2の`COMMITTED_LOCAL 6e40b5b / PUSH_NOT_REQUESTED / NOT_MERGED`を参照する。
- **Gate:** WP-5104(FINALIZED / APPROVED だが NOT_IMPLEMENTABLE qualifier — 実装 gate は
  単独では開かない)。§17.2 の実行順は WP-5216 local landing `0782d86` で成立し、
  2026-08-27 human instruction「着手して」が本 WP の実装着手判断を明示した。
- **Scope:** active stylesheet に分散した token/direct color を一つの token authority へ集約
  (甲乙丙テーマ差し替え可能な構造+暫定クローム)。DOM 構造・文言・contract 不変
- **Acceptance:** relevant web tests PASS + exact-path diff review(各 test の観測範囲だけを証跡化)。
  active stylesheet の token/direct-color static check、UIX-004 の targeted automated+manual
  verification、typecheck/lint/build PASS。UIX-001 §8 予算内(旧 UIX-003 は SUPERSEDED。compiled CSSは
  2026-08-27 human再設定の12 KiB以下、source separate-file gzipはbaseline以下、CLS非悪化。
  WP-5211 landing時の実測9,672≤10,240 bytesはhistorical evidenceとして保持)
- **Stop:** L1 以上へ変更が波及したら Phase A を放棄し WP-5113 系へ再分類(全緑主張を捨てる)

##### WP-5112 — workflow-stage.ts 実装

- **Status:** GATED / NOT_READY
- **Gate:** WP-5103 + WP-5104 APPROVED(UNAVAILABLE shape decision を含む)
- **Scope:** `packages/shared-kernel/src/workflow-stage.ts`(enum 9工程+STAGE_PROGRESSES 5値+
  `deriveStageProgress` 純関数)、Visual Status Registry 2軸(workflow-stage /
  stage-progress)、網羅テスト(15号 §7: 順序一致・fail-closed UNAVAILABLE・
  BLOCKED reason 必須・モード連動)
- **Acceptance:** 全 stage×progress 導出テスト PASS。契約未承認ドメイン入力 undefined →
  必ず UNAVAILABLE。事前承認済み shape を用い、Registry は identity の label/shape と
  progress の label/tone/shape/ARIA を網羅
- **Stop:** DOM-004 状態の shared-kernel 登録は使用実装 WP 着地時のみ(先行登録禁止)

##### WP-5113 — 調剤盤シェル(3カラム+ロール別ビュー)【U4】

- **Status:** GATED / NOT_READY
- **Gate:** WP-5105 + WP-5112
- **Scope:** 調剤盤 3カラム(ReceptionQueueRail / 患者フォーカスフレーム+WorkflowSheet 骨格 /
  AlertRail)、BoardViewSwitcher(投影のみ・権限非変更 — P-14)、
  兼任(一人薬剤師)統合ビュー、連続受付1操作復帰
- **Acceptance:** ロール別既定展開が 14号 §7.1 通り。畳んだ工程行でも状態 chip+サマリ常時可視
  (P-01 規律の型・テスト強制 = 14号 R-1 の解)。最小の Vitest contract で
  loading/empty/error/403 を網羅し、DOM interaction が必要な state は targeted Playwright/axe
  scenario を追加する。現行 browser gate 単独はこの4状態の網羅証跡にしない
- **Stop:** 上記 U3/U4 gate を満たさないまま実装しない。受付・患者検索の既存2実装フローを
  壊す変更は段階分離

##### WP-5114 — WorkflowSheet / WorkflowStageRow + EvidenceDrawer【U4】

- **Status:** GATED / NOT_READY
- **Gate:** WP-5113 + medical-safety/privacy/accessibility の実装前 review + 必要な human 承認
- **Scope:** 工程アコーディオン(展開部=入力フォームのみを型で強制)、
  仮=点線/確定=実線の形状文法(P-05/06/07)、EvidenceDrawer(calculation trace +
  記録版履歴の版・確認者・確認日時 — P-13 一手)、外部登録待ちは
  PENDING_EXTERNAL_SYNC chip 併置(15号 SF-3 方針)。`audit_events` 一覧・chain 状態・
  再試行操作は含めず、SCR-028 を別名で復活させない
- **Acceptance:** 「安全情報を展開部に置けない」型テスト。fixture trace viewer(SCR-012)の
  ドロワー昇格。確定演出は版一致時のみ発火のテスト
- **Stop:** 工程行から契約外 API を呼ばない(API-002)。実装後の同観点 independent validation 必須

##### WP-5115 — 並行作業ロック(患者×工程 lease)

- **Status:** GATED / NOT_READY(設計課題 14号 §7.3 未解消)
- **Gate:** U4。WP-5113 + §7.3 解消(lease/timeout・LOCAL_ONLY 時挙動の ARC 突合・
  差し戻し遷移の DOM-004 突合) + medical-safety/privacy/accessibility の実装前 review
  と必要な human 承認
- **Scope:** 患者×工程(enum 工程粒度 — 17号 SF-4)の単一編集所有、
  「↻ 入力中 — 操作者(端末)」常時表示、stale 確定の 412/conflict(最終防衛は
  DOM-004 遷移ガード)、競合の人間返し(自動補正禁止)
- **Acceptance:** 同時編集・lease 失効・stale 署名失敗・競合の各テスト。無言グレーアウト非存在
- **Stop:** UI ロックを防衛と扱わない(API 側検証なしの排他は不可)。実装後の同観点
  independent validation 必須

#### Stage 2 — 外部依存機能(各凍結解除後)

##### WP-5121 — アカウント種別制御の実装完遂(D-1)

- **Status:** GATED / BLOCKED_SECURITY_REVIEW / NOT_READY
- **Gate:** production 認証基盤の human/security 承認(release gate)。
  MOD-007 / permissions.ts を正本とし**新規機構を発明しない**(17号 AF-3)
- **Scope:** 認証 → runtime-role → scope 結線、requirePermission の全ルート適用確認、
  BoardViewSwitcher の capability 投影連動、権限変更履歴(SCR-029)
- **Acceptance:** deny-by-default の負系テスト(tenant/scope 越境 403+AUTH-0003)。
  UI 非表示と API 拒否の二層が全操作で一致
- **Stop:** dev header を production 権限根拠にしない

##### WP-5122 — FinalizeAndRegisterAction(D-2: 1操作・2段分離)【U4】

- **Status:** GATED / BLOCKED_REGULATORY_REVIEW / NOT_READY
- **Gate:** RB-003 解除(電子処方箋 技術解説書+記録条件 evidence+境界 SSOT APPROVED)+
  WP-5102 APPROVED + HPKI 署名位置づけ確定(legal_compliance_matrix #7)+
  medical-safety/privacy/accessibility の実装前 review + 薬剤師 human 承認
- **Scope:** 薬剤師最終確定(ローカル不可逆・確認者/日時/対象版記録・二段階確認 P-11)→
  調剤結果登録ジョブ outbox 投入(PENDING_EXTERNAL_SYNC・再試行・DLQ→SCR-025)。
  段2失敗は段1を巻き戻さない/段2単独成功は存在しない順序保証
- **Acceptance:** LOCAL_ONLY 中のキュー蓄積、登録失敗の可視化、
  「確定●」「登録↻/●」chip 分離表示(単一成功表現の禁止 — 禁止3項/H-03)の各テスト
- **Stop:** 上記 gate なしに実装しない。実装後の同観点 independent validation なしに有効化しない

##### WP-5123 — 電子薬歴連携送信実装(D-3)

- **Status:** GATED / NOT_READY
- **Gate:** WP-5106 APPROVED(手段確定)+ outbox 基盤
- **Scope:** 確定済み調剤データの外部送信 Adapter(手段は WP-5106 の決定に従う)、
  送信状態の SCR-024/025 可視化、PHI 最小化(SEC-004)
- **Acceptance:** 送信ペイロードが契約 schema で検証される。失敗・再試行・DLQ の状態が
  隠れない。PHI がログへ出ない sentinel テスト
- **Stop:** 許諾外の NSIPS 実装禁止(RB-006)

##### WP-5124 — タブレット縮退+密度段階(R-2 / R-4)

- **Status:** GATED / NOT_READY
- **Gate:** WP-5113 + medical-safety/privacy/accessibility の実装前 review + 薬剤師 human 承認
  (密度既定・高齢者向け拡大の対象画面 — UIX-001 §6)
- **Scope:** 3カラム縮退(キュー・右レールのドロワー化、警告 chip のヘッダー残置)、
  密度段階(標準/圧縮)、キーボード完結(Tab/ショートカット — 16号 F-4)
- **Acceptance:** 縮退時も警告・患者文脈・モードが常時可視(P-01/03/09)。
  reduced-motion / forced-colors 対応
- **Stop:** 縮退を理由に安全情報を畳まない。実装後の同観点 independent validation 必須

## 9. Investigations

### INV-20260730-01 — Prove a bounded reception-queue read contract

- **Confidence:** Medium for production impact; High that current work is
  unbounded.
- **Evidence:** `packages/contracts/src/reception-queue.ts` accepts only a date;
  `apps/api/src/db/reception-repository.ts` performs an ordered query without
  `LIMIT`/cursor; the Web renders the full response. The contract relies on an
  unmeasured one-pharmacy/day cardinality assumption.
- **Question:** is an approved measured maximum sufficient, or must the route
  gain scope-bound stable pagination and an explicit response cap?
- **Measurement (2026-09-16, embedded PostgreSQL 18.4, synthetic rows, real
  queue query + serialized payload):** ~318 B/entry JSON。n=100 → 31 KiB /
  1.1ms、n=300 → 93 KiB / 4.5ms、n=1000 → 310 KiB / 40ms、n=3000 →
  933 KiB / 282ms。線形・`reception_entries_queue_idx` による index-ordered
  scan(Incremental Sort)。WHERE は tenant+pharmacy+business_date で scope-bound
  — 日次 queue は日またぎで蓄積しないため、入力任意性ではなく薬局1日の
  業務量が構造的 bound になる。現実的 volume(50〜500/日)では 16〜160 KiB /
  <10ms で問題なし。residual は pathological volume(3000+/日)での ~1MB
  応答のみ。
- **Recommendation(人間判断待ち):** measured maximum で十分 — pagination は
  このデータ形状では不要な複雑さ。選択肢: (a) 現状維持(構造 bound に依存)、
  (b) 防御的 row cap(例 N 超過で明示 error)を最小差分で追加。決定は
  approved bound/pagination judgment として human に残す。
- **Exit:** synthetic volume measurement and an approved bound/pagination
  decision with a separate Task Packet. Do not issue an implementation task
  until the user-value/complexity tradeoff is established.

## 10. Resolved Work-Selection Decision

### DEC-20260730-01 — Finish WP-4250 review before implementation selection

- **Status:** CLOSED(2026-08-01)。WP-4250 は `89275d2` で FINALIZED / APPROVED
  となり、本決定が定めた順序は履行された。以降の work selection は
  `DEVELOPMENT_POLICY.md §8` に戻る。以下は決定当時の記録である。
- **Decision:** recommended ordering accepted. Finish the already-authorized
  WP-4250 correction/review/final-human-decision path without implementation;
  do not claim WP-4050 or any other implementation task concurrently.
- **Basis:** `AGENTS.md` requires the more specific same-layer rule to win.
  `DEVELOPMENT_POLICY.md` §11 specifically names WP-4250 as the current
  decision boundary and WP-4050 as separately human-gated. The user's
  `推奨承認` also confirms the recommended ordering.
- **Policy reconciliation:** the general Milestone 1→2 ordering still requires
  an atomic policy correction before the next implementation task is promoted.
  That edit is outside this Plans-only Goal.
- **Authority boundary:** this decision selects review order only. It does not
  grant WP-4250 final SSOT approval, WP-4050 R3 scope approval,
  implementation, migration application, landing, deploy, conformance, or
  production action.

## 11. Deferred / Known Release Blockers

- Bounded audit verification, read-driven self-growth, retention-complete
  export, and production incident-response path: known in SEC-007; do not
  duplicate as new tasks.
- Production AuthContext/OIDC, qualification, runtime role, RLS, break-glass,
  and credential transport: fail-closed release gates, not current runtime
  completion.
- Patient-search URL PHI, all-response `no-store`, pharmacy-level DB isolation,
  production qualification/purpose-of-use, and durable FHIR audit behavior:
  explicit WP-4250 correction blockers; no claim of current resolution.
- `check:secrets` の走査スコープは BUG-4263 の決定で「cwd 配下を走査し、ignore
  データは scope violation の abort/skip 判定にのみ使う」へ確定した。カバレッジは
  不変だが、**「git が ignore しろと指示したエントリはリポジトリ内容ではない」**
  という前提を 1 つ受け入れている。この前提が崩れる運用(意図せず ignore された
  リポジトリ内容)が現れた場合は再判断が要る。
- Prescription, dispense, calculation consumer, billing, JAHIS/QR, schedule,
  visit, report, task/notification, PH-OS sync, and broad FHIR/AWS rollout:
  NOT NOW under the current policy.

## 12. Completed

- No uncommitted item is moved to `VERIFIED_COMPLETE` by this static audit.
- 2026-07-31(direct user instruction「ヒューマンゲートを全て許可」+ commit 承認
  による Claude lane 実装セッション): WP-4050(`42ef15c`+`bf17cea`)、
  WP-4255 landing(`b9fc31a`)、WP-4236(`68e0d77`)、WP-4162(`02a3409`+`566f386`、
  MOD-008 v0.2.4 同時改版)、WP-9008(`2c84e66`)、WP-5101 ドラフト着地(`3da2466`)を
  COMMITTED_LOCAL 化。全 commit で exact tree の zero-skip green
  (PostgreSQL 統合込み)を実測。push・deploy・production 変更なし。
  **独立レビューは全件未取得**(subagent 報告経路劣化+codex usage limit)—
  2026-08-05 の codex lane 復帰後の再レビューが残存 gate。
- WP-4253 is committed locally at `9d8dbc0`.
- 2026-08-01(direct user instruction「全ての変更をグループごとにコミット」):
  working tree 全体を所有グループごとに local commit した。work-selection charter
  と agent instruction(`4d889d5`)、legacy refactor ledger の FROZEN 化
  (`7650cad`)、WP-4254(`2db1ec1`)、WP-4050 outbox intent profile の PROPOSED 化
  (`f7eeb67`)、BUG-4260 + BUG-4262(`fe03cf0`)、BUG-4261(`6813750`)、
  台帳(`f91ae78`)。landing 直前の tree 全体に対して `typecheck` / `lint` /
  `test:scripts` / apps/web 437 tests / `check-ssot-index` 173 / `git diff --check`
  がいずれも PASS。**各グループを exact-path stage で分離したため、中間 commit 単体
  では gate 検証していない。** push・deploy・production 変更なし。独立レビュー:
  コード commit は 2026-09-16 PASS(finding 0。`fe03cf0`/`6813750`/`bf0b402`/
  `2db1ec1`/WP-4162 `02a3409`+`566f386`)、docs/record commit(`7650cad`/`f7eeb67`/
  `f91ae78`)は runtime surface なしのため対象外。

## 13. Superseded / Archived

| Item | Disposition |
|---|---|
| WP-4240 | `SUPERSEDED_BY_WP-4253`; dependency remediation is in local commit `9d8dbc0` |
| WP-4238 | `SUPERSEDED_BY_WP-4254`; the dedicated audit Web consumer was removed locally |
| WP-9002, WP-4158, WP-4159, WP-4160 | `FROZEN / GIT_HISTORY_ONLY / NONCLAIMABLE` |
| All frozen legacy task definitions | classified as `FROZEN / NOT_NOW / NONCLAIMABLE`; active dispositions above win; body archived |

The legacy body was removed from this board on 2026-07-31 by direct user
instruction and archived in full to `Plans.legacy-archive-20260731.md`
(diff-verified byte-identical extraction). That archive is the preservation of
the pre-existing non-HEAD uncommitted provenance required by the previous
version of this note; it remains NONCLAIMABLE history.

## 14. Scan Ledger

| Scan area | Last commit | Status | Main finding | Next action |
|---|---|---|---|---|
| Product goal / vertical journeys | `9d8dbc0` | scanned | runtime stops after patient + paper reception; prescription onward disconnected | preserve North Star ordering |
| Frontend / state / accessibility | `9d8dbc0` | scanned | reachable patient/reception flows tested; remaining business screens are truthful placeholders | rescan only on Web diff |
| API / contracts / errors | `9d8dbc0` | rescanned; FAIL | exact11 producer ambiguity, replay/error gaps, and unbounded search materialization | correct WP-4250 atomically |
| Domain / repositories / DB | `9d8dbc0` | rescanned; FAIL | authority fence, Patient/reception cutover, Prescription ownership, uniqueness, rotation, and audit convergence gaps | correct WP-4250 atomically |
| Authn / authz / tenant / PHI | `9d8dbc0` | rescanned; FAIL | URL PHI, incomplete no-store, tenant-only IAM, qualification/purpose, parser limits, and audit durability gaps | correct WP-4250 atomically |
| Concurrency / idempotency / transaction | `9d8dbc0` | rescanned; FAIL | exact replay persistence and key-retirement proof remain incomplete | correct WP-4250 atomically |
| Cache / queue / async / external boundary | `9d8dbc0` | scanned | no runtime queue/worker/PH-OS/FHIR; URI/network constraints remain proposed | keep non-runtime claims explicit |
| Tests / CI / tooling / dependencies | `9d8dbc0` | scanned | broad tests/gates exist; tests not executed in this Goal | runtime verification remains unknown |
| Dead code / duplication / legacy | `9d8dbc0` | scanned | frozen legacy causes stale duplicate IDs and old execution orders | archive-only parser boundary |
| Performance / observability / audit | `9d8dbc0` | rescanned; FAIL | audit O(total history)+self-growth, reception queue, FHIR snapshot, and Patient projection decrypt work are unbounded | WP-4250 correction + investigation + SEC-007 pointer |
| Git history / churn / revert / rename | `9d8dbc0` | scanned | governance churn drove stale ledgers; one recent rename, no new executable finding | diff-first next run |
| Docs / APPROVED SSOT / implementation drift | `9d8dbc0` | rescanned; FAIL | exact11 remains PROPOSED; package/profile evidence and internal contract consistency are incomplete; work order is resolved | exact11 correction plus policy reconciliation |

- **Full baseline completed:** yes for available static evidence.
- **Incremental diff range:** `f4d0f8f..9d8dbc0` plus current working tree.
- **Consecutive no-new High/Medium actionable passes:** 2. Independent final
  verification found the unbounded API-001 Patient projection fetch/decrypt
  boundary now absorbed into WP-4250 and reset the counter. Two new distinct
  post-normalization full rescans then found no additional High/Medium item or
  reprioritization: (1) unbounded read/decrypt/materialization paths across
  exact11 and reachable runtime; (2) corrected WP-4250 coverage against all
  domain-review evidence and live producer/consumer paths.
- **Known blind spots:** no runtime/test/build/lint/typecheck/DB/external
  verification; no production auth/role/RLS; external standard artifacts were
  not refreshed because the Goal forbids external-service connection.
- **Next scan cursor:** diff-first from `9d8dbc0`; reset the counter if a new
  High/Medium item or reprioritization appears.

### 実行付きバグ走査(2026-08-01, base `4f4ba68` + working tree)

前回までの走査と異なり、**runtime verification を実行した**上での走査である
(direct user instruction「バグ探索・修復ミッション」)。上の「Known blind spots」
のうち test/build/lint/typecheck/DB の項目はこの走査に限り解消している。

| 項目 | 実測結果 |
|---|---|
| baseline gates | `typecheck` / `lint` / `check:boundaries` / `check:calculation-purity` / `check:deps` / `check:openapi` / `check:sbom` / `check:ssot-index` / `test:scripts` / `build` すべて exit 0 |
| baseline tests | `pnpm -r test` exit 0。ローカル Postgres(compose.yaml)を起動し `TEST_DATABASE_URL` を与えて **skip 0**(apps/api 23 files / 880 tests、workspace 合計 1877 tests)を実測 |
| 既存の失敗ゲート | `check:secrets` のみ exit 1 → BUG-4261 / BUG-4263 として起票 |
| 走査範囲 | apps/api 全 src(server / plugins / db / audit / reception / patient / config / startup)、apps/web 全 app、packages 全 8、scripts 全 11、migrations 6、CI workflow |
| 起票 | P1 1 件(BUG-4260)、P2 3 件(BUG-4261 / BUG-4262 / BUG-4263)、P3 2 件(BUG-4264 / BUG-4265)。重複 1 件・Not a Bug 3 件を明示除外 |
| 実装 | Active Batch = BUG-4260 / BUG-4261 / BUG-4262。BUG-4260 と BUG-4262 は `fe03cf0`、BUG-4261 は `6813750` へ COMMITTED_LOCAL。回帰テスト付き、独立レビュー 2026-09-16 PASS(finding 0)、push 未要求 |
| 未解決 | `check:secrets` は `.codegraph` により exit 1 のまま(BUG-4263 の決定待ち)。リポジトリスコープ内容 450 ファイルのみの走査は `Secret scan passed.` を実測 |

## 15. Candidate Work Inventory — 次期100項目(2026-08-02)

> **来歴:** direct user instruction 2026-08-02(コミット履歴・本書・`State.md` の
> 解析に基づく「次にすべき100項目」の抽出・記載指示)。抽出根拠は
> `DEVELOPMENT_POLICY.md` §4 Milestones / §7 Core Logic Register、`State.md`
> active snapshot の blocker 集合、本書 §3〜§11、および `f91ae78..0507c02` の
> コミット履歴である。
> **queue 規律:** 本節は inventory であり **READY slot を消費せず、登録は claim
> ではない**(§8 冒頭と同じ扱い)。WIP=1 / READY≤2、human gate、登録済み blocker、
> §6 NOT NOW、§11 release blockers を一切上書きしない。昇格は
> `DEVELOPMENT_POLICY.md §8` work-selection に従い、READY 昇格時に個別の
> Task Packet(scope / acceptance / stop / 検証)を確定してから claim する。
> **blocker 名の正本は exact11 各文書の frontmatter `blockers`** であり、本節は
> それを解除条件つき作業項目として指す index にとどめる(内容を複製しない)。
> **凡例:** 【HG】= human gate 必須、【SSOT】= PRC-007 改版必須、
> 【GATED】= 前提未成立、【REG】= 本書既登録項目への参照(重複起票ではない)。

### 15.1 Milestone 1 完了残余 — 独立レビューと landing 後始末(C-001〜C-014)

| # | 項目 | 前提 / Gate |
|---|---|---|
| C-001 | **完了(2026-08-23)** — WP-4050 独立レビュー packet を再凍結(base `9d8dbc0`、head `9a404fe`、diff `494a79e6...`) | — |
| C-002 | **完了(2026-08-23)** — 初回 REQUEST_CHANGES、`28fd62e` checker PASS、残 finding を `273c66e` / `a20d8b9` / `425294a` + `6f62b92` で閉鎖【REG: §5】 | C-001 |
| C-003 | BUG-4260 / BUG-4262(`fe03cf0`)の独立レビュー【REG: §8】 | codex lane 復帰 |
| C-004 | BUG-4261(`6813750`)の独立レビュー【REG: §8】 | 同上 |
| C-005 | BUG-4263(`bf0b402`)の独立レビュー — 「ignore 指示 = 非リポジトリ内容」前提 1 点の security posture 妥当性確認込み【REG: §8/§11】 | 同上 |
| C-006 | WP-4256(`ab63db6`)の独立レビュー — 検知 4 変種の限界表の独立再現【REG: §4】 | 同上 |
| C-007 | WP-4257(`a911a99`)の独立レビュー — 既存 4 文書修復の意味不変確認【REG: §4】 | 同上 |
| C-008 | WP-9008(`2c84e66`)の独立レビュー【REG: §8】 | 同上 |
| C-009 | WP-4236(`68e0d77`)の独立レビュー — migrations/000006 含む【REG: §8】 | 同上 |
| C-010 | WP-4162(`02a3409`+`566f386`)の独立レビュー — MOD-008 v0.2.4 改版込み【REG: §8】 | 同上 |
| C-011 | WP-4050 outbox intent profile(`f7eeb67` PROPOSED)の独立レビューと PRC-007 昇格【SSOT】【HG】 | C-002 |
| C-012 | 2026-08-01 グループ landing の中間 commit 単体 gate 未検証(§12 注記)の扱い決定 record(再検証 or 受容) | — |
| C-013 | push 判断(0 behind / 11 ahead)と、push 後の remote exact-head CI green 確認【HG: push は明示要求時のみ】 | C-002〜C-010 |
| C-014 | Milestone 1 exit 総括判定 record — `DEVELOPMENT_POLICY.md §4` M1 exit criteria と evidence の突合 | C-002 / C-011 / C-015〜016 |

### 15.2 Milestone 1 残バグ・調査・観測性(C-015〜C-022)

| # | 項目 | 前提 / Gate |
|---|---|---|
| C-015 | `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` 残余 (b) 手順1: 事前棚卸し SELECT(read-only、環境ごと記録)【REG: §5 実行仕様】 | `DATABASE_URL` のある環境 |
| C-016 | 同 (b) 手順2: `CHECK (position('#' in col) = 0)` migration 起案と適用【HG: DDL】 | C-015 全 0 件 |
| C-017 | BUG-4264 — created 経路 audit 時計の `snapshotWallClock` 規律化と in-memory 巻き戻し閉鎖(WP-4050 次スライスに同梱)【REG: §8 P3】【GATED】 | WP-4050 R3 gate |
| C-018 | BUG-4265 — API logger の PHI-safe 出力境界設計(SEC 系 SSOT)【SSOT】【HG: security/privacy】【REG: §8 P3】 | — |
| C-019 | BUG-4265 — Fastify logger 有効化実装+PHI sentinel テスト | C-018 APPROVED |
| C-020 | INV-20260730-01 — reception queue の synthetic volume 測定【REG: §9】 | — |
| C-021 | INV-20260730-01 — bound/pagination 決定 record と実装 Task Packet 起票 | C-020 |
| C-022 | WP-4162 明示 defer 分 — deny(403)監査の SEC-007/SEC-008 設計反映【SSOT】 | — |

### 15.3 Milestone 2 前提解除 — exact11 登録 blocker の解除作業(C-023〜C-042)

いずれも WP-4250/4258 で APPROVED 済み SSOT が登録する blocker の解除作業であり、
解除は該当 SSOT の改版(PRC-007)または approved evidence を要する。

| # | 項目 | 前提 / Gate |
|---|---|---|
| C-023 | `BLOCKED_WRITE_PRODUCER_PREREQUISITES` — 解除ロードマップ record(前提の全列挙・順序・担当 gate) | — |
| C-024 | `BLOCKED_PACKAGE_PROVENANCE` — JP Core 1.2.0 package artifact の `source_registry.md` 登録【SSOT】 | — |
| C-025 | locked-profile validation の実行 evidence(WP-4157 系 FHIR toolchain の後続) | C-024 |
| C-026 | `BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP` — 紙処方 draft と MedicationRequest の所有境界 SSOT 起案【SSOT】 | — |
| C-027 | `BLOCKED_RECEPTION_PATIENT_COMPATIBILITY` — 受付⇔Patient authority 互換規則の確定【SSOT】 | — |
| C-028 | `BLOCKED_PATIENT_CREATE_UNIQUENESS` — Patient create の一意性・登録経路設計(cutover 後の集合閉鎖回避)【SSOT】 | — |
| C-029 | `BLOCKED_PATIENT_IDENTITY_MUTATION` — identityDigest 構造 backstop の実装検証(cutover blocker) | — |
| C-030 | `BLOCKED_LOOKUP_KEY_RETIREMENT` — 鍵退役の安全設計(clinical write enablement gate。漏えい鍵の撤回経路)【SSOT】【HG: security】 | — |
| C-031 | `BLOCKED_POSTGRES_WRITER_FENCE_PRIMITIVE` — PostgreSQL 側 stop/drain 強制 primitive の設計 | — |
| C-032 | `BLOCKED_WRITER_FENCE_TOKEN_ISSUANCE` — fence token 発行と自己保持強制の設計 | — |
| C-033 | `BLOCKED_REPLAY_PERMANENT_FAILURE` — replay 恒久失敗 semantics の確定【SSOT】 | — |
| C-034 | `BLOCKED_AUTH_RESPONSE_FAMILY_ALIGNMENT` — 位相依存 401/403/404/405 応答族の API/security 決定(WP-9008 と連続)【SSOT】【HG: security】 | — |
| C-035 | `BLOCKED_AUDIT_PAYLOAD_EXTERNAL_STORE` — 監査 payload 外部ストア設計【SSOT】 | — |
| C-036 | `BLOCKED_AUDIT_PAYLOAD_RETENTION_POLICY` — 保持ポリシー SSOT【SSOT】【HG: retention】 | — |
| C-037 | `BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT` — MOD-008 への FHIR read/search/create/update/deny/failure 監査 mapping 登録【SSOT】 | — |
| C-038 | `BLOCKED_PATIENT_SEARCH_URL_PHI` — 検索語の URL PHI 排除の決定と実装【SSOT】【HG: security/privacy】 | — |
| C-039 | `BLOCKED_PATIENT_SEARCH_SCALE_BOUND` — patient search の有界化(cap/cursor) | C-038 と同一決定枠 |
| C-040 | `BLOCKED_FHIR_SEARCH_SNAPSHOT_IMPLEMENTATION` — immutable index delta / as-of snapshot の証明計画(upper-watermark paging 拒否のまま) | — |
| C-041 | `BLOCKED_RECUTOVER_DIVERGENCE_RESOLUTION` — rollback 窓の read-only 制約 or approved 反映経路の設計(re-cutover 用。初回 cutover は対象外)【SSOT】 | — |
| C-042 | deny-burst の open-window 内検知経路(outbox 非依存)の SEC-007/SEC-008 起案(`State.md` filed 分)【SSOT】 | — |

### 15.4 Milestone 2 実装 — bounded architecture proof(WP-4251 の分解、C-043〜C-055)

全件【GATED】: WP-4251 label の解放(必要 blocker 解除+human gate)まで claim 不可。
synthetic data 限定。migration 適用・production 行為は含まない。

| # | 項目 | 前提 / Gate |
|---|---|---|
| C-043 | synthetic 検証環境の決定 record(DynamoDB Local 等。provisioning なしで proof を成立させる方式) | — |
| C-044 | approved key codec の複合キー拡張実装(DynamoDB 側。WP-4256 検知規則と整合) | C-043 |
| C-045 | Patient read-only shadow projection 実装(Postgres→FHIR、loss 全列挙) | C-043 |
| C-046 | shadow parity 比較 harness(synthetic、mapping loss の可視化) | C-045 |
| C-047 | authority state machine 実装(authorityEpoch 単調・遷移表・rollback 遷移)+網羅テスト | C-043 |
| C-048 | cutover transaction 実装(PATIENTLINK 条件付き Put、hmacPatientId HKDF、冪等 re-run) | C-047 |
| C-049 | set-equality epoch CAS 実装(membership+cardinality の二重証明) | C-048 |
| C-050 | MedicationRequest create ingestion boundary 実装(stable idempotency key・request-byte fingerprint・全版 alias TWI) | C-023 解除 |
| C-051 | Patient PUT の `If-Match` / `Idempotency-Key` 強制実装(400 required / 412 conflict) | C-050 |
| C-052 | transaction budget preflight 実装(100 action targets / 4MiB / 400KB 超過 = 422、chunking なし) | C-050 |
| C-053 | search index delta の keep-latest compaction 実装(`retentionExpiresAt` 条件付き TWI 削除、既定は削除しない) | C-040 |
| C-054 | retention / corruption / concurrent-writer テスト群 | C-047〜C-053 |
| C-055 | Milestone 2 exit proof — cross-tenant 否認・stale conflict・retry dedupe・単一 writer の contract/integration 証明と、不成立時の stop/reframe 判定 record | C-044〜C-054 |

### 15.5 Milestone 3 — 薬剤師 vertical journey(WP-4252 の分解、C-056〜C-066)

原則【GATED】: Milestone 2 exit まで claim 不可。synthetic data 限定。direct human approval
2026-08-26は、下表C-056〜C-060のうちserver-saved draftに限るbounded sliceを例外的に承認した。
C-061以降、薬剤師確認・確定・訂正履歴・外部連携のgateは解除しない。

| # | 項目 | 前提 / Gate |
|---|---|---|
| C-056 | **BOUNDED COMPLETE** — server-saved紙処方draftの非ライフサイクル性と受付write guardをDOM-002/004へ同期。pharmacist-confirmed分離の完全設計はGATED | direct approval 2026-08-26 |
| C-057 | **COMPLETE** — prescription draft contract/generated OpenAPI/consumer同期 | C-056 bounded approval |
| C-058 | **SOURCE COMPLETE / APPLY GATED** — forward migration 000013 source。環境適用は別HG | direct approval 2026-08-26 |
| C-059 | **BOUNDED COMPLETE** — authenticated scopeでreception→patient→draftをserver-side linkage | C-057 |
| C-060 | **COMPLETE (synthetic)** — draft入力API/Web、CAS conflict、read audit | C-057 |
| C-061 | 薬剤師確認の actor/qualification boundary 実装(承認済み境界のみ)【HG: medical safety】 | C-084 |
| C-062 | 訂正=新版追加の version history 実装(前版保存・上書き禁止) | C-058 |
| C-063 | 確定操作の audit + transactional outbox evidence 接続 | C-059 |
| C-064 | North Star synthetic E2E(browser/API 統合 scenario の全行程) | C-059〜C-063 |
| C-065 | calculation / claims / JAHIS / PH-OS の fail-closed 可視化の総点検 | C-064 |
| C-066 | 薬剤師 human safety/UX review(pilot 判断前)【HG】 | C-064 |

### 15.6 UIUX 盤面刷新 pipeline の gate 進行(既登録 WP-5101〜5124、C-067〜C-082)

全件【REG: §8 UIUX 節】。本節は順序 index のみ。

| # | 項目 | 前提 / Gate |
|---|---|---|
| C-067 | WP-5101 — 13〜17号ドラフトの fresh-context 再チェックと human 内容判断(10 論点)【HG】 | — |
| C-068 | WP-5102 — DOM-004 改版起案(2段分離)【SSOT】【HG: R3 相当】 | C-067 |
| C-069 | WP-5103 — workflow-stage enum SSOT 昇格【SSOT】 | C-068 |
| C-070 | WP-5104 — 選択された unique UI/UX foundation の atomic 昇格【SSOT】 | C-067 |
| C-071 | WP-5105 — UIX-006/007/PLAN-UIUX-001 改版(3盤面写像)【SSOT】 | C-069/C-070 |
| C-072 | WP-5106 — 電子薬歴連携手段の経営判断と連携契約 SSOT【HG: 経営判断】【SSOT】 | — |
| C-073 | WP-5211 — L0 トークンテーマ基盤(Phase A・挙動不変。旧称 WP-5111、2026-08-27 改番) | C-070 |
| C-074 | WP-5112 — workflow-stage.ts 実装(UNAVAILABLE shape 事前決定済み) | C-069/C-070 |
| C-075 | WP-5113 — 調剤盤シェル【U4】【HG: 実装前承認+実装後validation】 | C-071/C-074 |
| C-076 | WP-5114 — WorkflowSheet / EvidenceDrawer【U4】【HG: medical/privacy/a11y実装前承認+実装後validation】 | C-075 |
| C-077 | WP-5115 前提 — 14号 §7.3 設計課題の解消(lease/timeout・LOCAL_ONLY・差し戻し遷移の ARC/DOM 突合)【U4】【HG: §14共通gate(medical/privacy/a11y実装前承認+実装後independent validation)】 | C-075 |
| C-078 | WP-5115 — 並行作業ロック実装【U4】【HG: §14共通gate(medical/privacy/a11y実装前承認+実装後independent validation)】 | C-077 |
| C-079 | WP-5121 — アカウント種別制御【HG: security release gate】 | C-083〜C-085 |
| C-080 | WP-5122 — FinalizeAndRegisterAction【U4】【HG: RB-003/HPKI法務+medical/privacy/a11y/薬剤師実装前承認+実装後validation】 | C-068 |
| C-081 | WP-5123 — 電子薬歴連携送信実装 | C-072 |
| C-082 | WP-5124 — タブレット縮退+密度段階【U4】【HG: medical/privacy/a11y/薬剤師実装前承認+実装後validation】 | C-075 |

### 15.7 Security / Privacy / Release gates(C-083〜C-094)

release gate 群。§11 の既知 blocker を作業項目化した index であり、SEC-007 等の
正本を複製しない。

| # | 項目 | 前提 / Gate |
|---|---|---|
| C-083 | production AuthContext / OIDC 設計 SSOT(dev header の非 production 化を固定)【SSOT】【HG】 | — |
| C-084 | 薬剤師資格(qualification)検証の設計と evidence 境界【SSOT】【HG】 | C-083 |
| C-085 | runtime role + RLS proof【HG: security】 | C-083 |
| C-086 | break-glass アクセス設計(監査必須)【SSOT】【HG】 | C-083 |
| C-087 | credential transport / secret rotation 運用設計【HG: secret rotation】 | — |
| C-088 | bounded audit chain verification 設計(O(total history) 解消。SEC-007 既知)【SSOT】 | — |
| C-089 | audit read self-growth(`audit.viewed` 自己増殖)の設計解消(SEC-007 既知)【SSOT】 | C-088 |
| C-090 | retention-period-complete audit export【SSOT】【HG】 | C-036 |
| C-091 | production tenant/auth incident-response path【SSOT】【HG】 | C-083 |
| C-092 | pharmacy-level DB isolation の要否決定 record【HG: security】 | — |
| C-093 | 全応答 `no-store` 残余の閉鎖確認(WP-4250 correction blocker の実測突合) | — |
| C-094 | SEC-006 / SEC-008 の現状整理と完了計画(exact11 に未結合のまま)【SSOT】 | — |

### 15.8 運用・保守・記録整備(C-095〜C-100)

| # | 項目 | 前提 / Gate |
|---|---|---|
| C-095 | `check:secrets` の BUG-4263 前提(意図せず ignore されたリポジトリ内容)の検出補助を CI 側へ置くかの要否判断 record | — |
| C-096 | Scan Ledger の diff-first 再走査(`f91ae78..0507c02` 以降)と cursor 更新 | C-002〜C-010 後 |
| C-097 | `State.md` frozen legacy log(約 2,200 行)の退避判断 — pointer-only 契約との整合。`AGT-018 §§3.2, 4` / PRC-007 と競合するなら fail-closed で停止【HG: 記録政策】 | — |
| C-098 | 本書 §4 landing 済み index の圧縮(Record policy 準拠。独立レビュー完了後) | C-002〜C-010 |
| C-099 | 依存 baseline の次回周期更新(`pnpm outdated -r`、WP-4253 方式の再実行) | — |
| C-100 | **COMPLETED / REVIEWED / NONCLAIMABLE** — `DEVELOPMENT_POLICY.md §11` Exact implementation sequenceを現状へ反映。independent PASS後に`9786fe8`でfeature branchへ記録。SSOT・実装・production gateは変更していない | C-002(完了) |

**集計:** 15.1=14 / 15.2=8 / 15.3=20 / 15.4=13 / 15.5=11 / 15.6=16 / 15.7=12 /
15.8=6 — 合計 100 項目。本節の追加は planning record の変更のみであり、実装・
検証実行・commit・push・gate 解除をいずれも行っていない。

## 16. 情報連携主軸の機能ギャップ分析と実装計画(2026-08-23)

> **来歴:** direct user instruction 2026-08-23「コードベースを理解し、調剤レセコンとして
> 不足している機能を調査して実装計画を立てる。yrese の強みは情報連携(FHIR JP Core
> ネイティブ対応・JAHIS 準拠・共有 API 解放)とし、情報連携を最大化する機能と、
> オンライン資格確認・マイナンバーシステム連動を加える」。
> **調査根拠:** live code(`apps/api/src/server.ts`、`migrations/`、`packages/*`、
> `apps/web/app/*`)、`docs/ssot_index.md` IDX-001 0.4.49(173 文書 / APPROVED 143 /
> PROPOSED 13)、PRD-001/002/005、CAL-001、CLM-001、ACC-001、RCP-001〜006、MST-001、
> REG-004、ADP-001、DOM-005/006、API-003/005/008、JHS-001〜008、SPEC-002 §8〜§11。
> **queue 規律:** 本節は §15 と同じ inventory である。**READY slot を消費せず、登録は
> claim ではない。** WIP=1 / READY≤2、human gate、登録済み blocker、§6 NOT NOW、
> §11 release blockers を上書きしない。昇格は `DEVELOPMENT_POLICY.md §8` に従う。
> **凡例:** 【HG】human gate、【SSOT】PRC-007 改版必須、【GATED】前提未成立、
> 【REG】既登録 item 参照、【EXT】外部手続き(仕様入手・許諾・接続試験)が前提。

### 16.0 方針上の注記 — charter との関係(human decision 必要)

- `DEVELOPMENT_POLICY.md §9` は JAHIS/QR、PH-OS 同期、broad FHIR/AWS を
  「North Star 前提(Milestone 1〜2)までは NOT NOW」と定める。本節の方向性
  (情報連携を製品の主軸とする)はこの charter の **reframe** であり、
  `DEVELOPMENT_POLICY.md §2 / §9 / §11` の改版を要する。本節は改版を**行わず**、
  改版提案として記録する。改版は 2026-08-23 direct user instruction「推奨通りに進んで」により **決定済み** — `DEVELOPMENT_POLICY.md` §1/§2/§4/§9/§11 を同日改版(Milestone 2.5 / 4 追加、§9 NOT NOW から JAHIS・FHIR facade・Hub・資格境界を除外)。
- 改版有無にかかわらず次は不変: (a) Milestone 1 exit(WP-4050 独立レビュー)と
  Milestone 2(bounded Patient + MedicationRequest 単一 writer 証明)は情報連携の
  **前提**であり迂回しない。FHIR facade は単一 writer が証明された resource だけを
  公開する。(b) REG-004 RB-001〜RB-010 は全件未解除であり、解除履歴なしに外部 IF
  依存コードを書かない。(c) 外部 IF 仕様の入手(ONS、JAHIS 頒布、NSIPS 許諾)は
  人間手続きであり、本節はそれを「着手可能」と表記しない。
- 推奨する charter 改版の骨子: Milestone 3(薬剤師 vertical journey)と並行して
  **Milestone 2.5「Integration Hub 基盤 + FHIR facade read 面」** を置き、
  Milestone 4 を「JAHIS 2D 取込 + 電子薬歴配信 + オン資境界」とする。
  North Star の journey に「外部へ配信された調剤イベントを partner sandbox が受信
  する」を 1 行加える(API-first dogfooding、API-002)。

### 16.1 ギャップマトリクス(調剤レセコン機能 × SSOT × 実装)

実装列は live code の実測。SSOT 列は frontmatter status。

| 領域 | 機能 | SSOT(status) | 実装 | 主 blocker |
|---|---|---|---|---|
| 受付 | 受付キュー・紙処方箋受付・冪等登録 | API-006 APPROVED | **稼働**(`POST /reception`、`GET /reception/queue`) | — |
| 受付 | 2次元シンボル/電子処方箋/OCR/前回Do の統一取込 | PRD-001 M1 APPROVED、PRD-005 PROPOSED | なし(`prescription_intake_type` 列のみ) | JAHIS 仕様未入手、RB-003 |
| 患者 | 検索・取得 | API-001 APPROVED | **稼働**(cursor、no-store) | 検索語 URL PHI(C-038) |
| 患者 | 登録・更新・統合・取り違え防止 | DOM-002 APPROVED | なし(write route 0) | Patient create uniqueness(C-028)、identity mutation(C-029) |
| 保険 | 保険・公費・負担割合・資格スナップショット | PRD-001 M2/M3 APPROVED | なし(`eligibility_status` 列のみ) | RB-002、境界 SSOT 不在 |
| 処方 | RP 単位処方入力・用法用量・疑義照会・残薬 | DOM-001 C4/C5 APPROVED、DOM-005 APPROVED | なし(UI shell) | C-026/C-056 |
| 調剤 | 調剤記録・薬剤師確認・訂正履歴 | DOM-004、DOM-001 C5 | なし | C-061/C-062 |
| 算定 | 調剤報酬点数 | CAL-001 16 行 EVIDENCE_ISSUED | **孤立**(68 evidence ルール、既定セット 5 本、API/DB consumer 0) | RB-008、一部負担金 CAL-R-024 BLOCKED |
| 算定 | 一部負担金・公費按分・選定療養 | CAL-R-024/025/020 BLOCKED | なし(`patientCopay` 型のみ) | BLOCKED_REGULATORY_REVIEW |
| 請求 | レセプト中間モデル・電算生成・記録条件検証・月次締め・返戻再請求 | CLM-001 APPROVED(工程 3/4/5/9/10 BLOCKED) | なし(`/claim-check` `/monthly-closing` placeholder) | RB-001、RB-004 |
| 会計 | 患者請求・未収・一部入金・返金・日計 | ACC-001〜011 APPROVED | なし(`/checkout` placeholder) | 算定 consumer 不在 |
| 帳票 | 領収証・調剤明細書・調剤録・薬袋・薬情 | RCP-001〜006 APPROVED、PRD-001 M7 | なし | 算定 consumer 不在 |
| マスター | 医薬品・薬価・調剤行為・公費・保険者・コードマッピング | MST-001/002 APPROVED | なし(`/masters` placeholder) | RB-009 |
| 薬歴 | 電子薬歴 API 連携・薬歴未記載チェック | PRD-001 M12 APPROVED | なし | Integration Hub 不在 |
| 監査 | 処方監査外部 API 取込(未加工転記) | PRD-005 PROPOSED、REG-005 | なし | RB-007 |
| **FHIR** | JP Core Patient / MedicationRequest facade | ARC-008/DOM-005/006/API-008 APPROVED | なし(`/fhir/R4` 0 route、mapping entry 0、package provenance 未登録) | C-023〜C-042、BLOCKED_PACKAGE_PROVENANCE |
| **FHIR** | MedicationDispense / Coverage / Organization / Practitioner / Bundle | 選択外(DOM-005 §bounded) | なし | SSOT 改版必須 |
| **JAHIS** | 2次元シンボル Ver.1.11 decode、薬歴連携 Ver.1.1、お薬手帳 Ver.2.6 | JHS-001〜008 **全件 PROPOSED** | なし | 仕様本文未入手【EXT】、JHS 昇格 |
| **Partner API** | Partner Registry / OAuth2 CC / mTLS / webhook / inbox / DLQ / sandbox / contract test / SDK / versioning | **SSOT 不在**(WP-0036 未起票)、API-003/005 APPROVED | outbox テーブル+intent 記録のみ(配送 worker 0) | BLOCKED_SECURITY_REVIEW、BLOCKED_LEGAL_REVIEW |
| **オン資** | 資格確認・薬剤情報/特定健診取得・請求前資格確認・障害時モード | ADP-A1、RB-002 | なし | ONS アクセス【EXT】、`online_qualification_boundary.md` 不在 |
| **電子処方箋** | 引換番号受付・処方取得・調剤結果登録・HPKI | ADP-A2、RB-003、N1(境界設計のみ MVP) | なし | 技術解説書【EXT】 |
| PMH | 医療費助成の資格確認・按分入力 | ADP-A4、RB-005 | なし | 【EXT】 |
| NSIPS | 薬局内機器連動 ACL | ARC-003 APPROVED、RB-006 | なし(設計自体凍結) | 許諾【HG】 |
| 同期/BCP | 5 モード検知・LOCAL_ONLY・RECOVERY_SYNC | ARC-001/002 APPROVED | なし(NORMAL 固定表示) | — |
| 認証 | production OIDC / 資格 / RLS | SEC-006/007/008 | dev header stub のみ | C-083〜C-085 |

### 16.2 実装計画 — Track 別 Work Package(WP-6xxx、全件 inventory)

#### Track A — Integration Hub 基盤(共有 API 解放の土台。WP-0036 の復活)

| WP | 内容 | 前提 / Gate |
|---|---|---|
| WP-6001 | Integration Hub SSOT 11 本の起案: `integration_hub_architecture.md`、`partner_registry_policy.md`、`api_scope_registry.md`、`webhook_event_catalog.md`、`idempotency_policy.md`、`partner_sandbox_policy.md`、`contract_test_policy.md`、`data_portability_policy.md`、`adapter_registry.md`、`data_sharing_policy.md`、`data_sharing_module_inventory.md`(SPEC-002 §11 / §29 の既定名)【SSOT】【HG: PRC-007】 | §16.0 charter 決定 |
| WP-6002 | API-003 §4 / API-005 §4 の「WP-0036 で確定」依存解消(versioning 廃止期間、OSS 公開範囲)【SSOT】 | WP-6001 |
| WP-6003 | outbox 配送 worker: `outbox_events` pending→delivered の単一遷移 worker、at-least-once、順序保証(aggregate 単位)、PHI-free payload 検証、injected sink failure テスト | WP-4050 独立レビュー(C-002) |
| WP-6004 | Event Catalog v0 + MOD-009 `event_envelope_schema` の APPROVED 昇格(現在 PROPOSED)。`reception.created` を第 1 event とする【SSOT】 | WP-6001 |
| WP-6005 | Webhook delivery: 署名(HMAC、key rotation)、retry/backoff、DLQ テーブルと可視化 API、replay protection、partner ごとの rate limit | WP-6003、WP-6004 |
| WP-6006 | Partner Registry + Scope 管理の persistence/API(tenant/pharmacy/partner_id、scope、PHI classification、data minimization)。MOD-007 内部 scope との対応表 | WP-6001 |
| WP-6007 | OAuth2 Client Credentials(partner 認証)+ mTLS 境界設計と実装。dev header stub を production で無効化する release gate と同一 packet【HG: security】【SSOT: C-083】 | C-083 |
| WP-6008 | Inbox(partner → yrese)受信境界: idempotency、schema validation、PHI classification、`PENDING_EXTERNAL_SYNC` 状態。書込みは MedicationRequest ingestion(C-050)の単一 writer 経由のみ | C-050、WP-6006 |
| WP-6009 | Partner Sandbox: synthetic tenant、fixture seeding(MOD-013)、本番 PHI 混入ゼロの機械検証 | WP-6006 |
| WP-6010 | Contract Test Harness: OpenAPI 3.1 + JSON Schema からの consumer-driven contract test、CI gate 化(`check:openapi` の拡張) | WP-6009 |
| WP-6011 | Partner SDK(TypeScript 生成、API-005 の legal review 後に OSS 公開)【HG: legal】 | WP-6002、WP-6010 |
| WP-6012 | Data Portability: tenant 自身のデータ export(FHIR Bundle `collection` + JSON Lines、署名付き manifest)と import dry-run。SPEC-002 §18 | WP-6101〜 |
| WP-6013 | 公開品質 KPI endpoint(API 可用性、配送成功率、返戻率 QUA-009)。PHI-free | WP-6005 |

#### Track B — FHIR R4 / JP Core ネイティブ facade

| WP | 内容 | 前提 / Gate |
|---|---|---|
| WP-6101 | JP Core 1.2.0 package artifact の `source_registry` 登録と SHA-256 固定(`BLOCKED_PACKAGE_PROVENANCE` 解除)【REG: C-024】【SSOT】 | — |
| WP-6102 | FHIR validator toolchain 選定と locked-profile validation の CI 実行(C-025)。validator は外部 network なし・package pinned | WP-6101 |
| WP-6103 | DOM-006 field mapping entry の記入: `JP_Patient`(identifier / name(漢字・カナ)/ birthDate / gender / address / telecom)と `JP_MedicationRequest`(経口・外用、用法 JP Core extension、dosageInstruction、dispenseRequest)。loss_notes を全列挙【SSOT】 | WP-6101 |
| WP-6104 | `GET /fhir/R4/metadata` CapabilityStatement(authenticated)+ OpenAPI 登録。mode は実装済み interaction だけを宣言 | WP-6103、WP-6007 |
| WP-6105 | Patient read-only shadow projection → `GET /fhir/R4/Patient/{id}`、`vread`、`search(identifier,_lastUpdated)`(C-045/046 と同一 packet)。pre-cutover は API-008 matrix に従い非公開 | C-045 |
| WP-6106 | MedicationRequest `intent=order` create/read/vread/search(C-050/051/052)。Idempotency-Key + If-Match 強制、Provenance を audit から派生 | C-050 |
| WP-6107 | Provenance / AuditEvent read-only derivative(commit 済み audit からの生成。client write 不可) | WP-6105、C-037 |
| WP-6108 | DOM-005 改版提案: MedicationDispense(調剤結果)、Coverage(資格スナップショット)、Organization/Practitioner(薬局・薬剤師)を bounded scope へ追加する amendment packet。**採否は human gate**【SSOT】【HG】 | Milestone 2 exit、C-056 |
| WP-6109 | MedicationDispense projection(薬剤師確認済み調剤のみ。provisional は公開しない) | WP-6108、C-061 |
| WP-6110 | FHIR Subscription(R4 `rest-hook`)を Track A webhook 上に載せる。Subscription 登録は partner scope 必須 | WP-6005、WP-6105 |
| WP-6111 | Bundle `transaction`/`batch` の扱い決定 record(API-008 は unsupported)。導入するなら transaction budget(C-052)と整合【SSOT】 | WP-6106 |
| WP-6112 | JP Core conformance 証明 packet(synthetic、validator 出力、known loss 一覧)。`BLOCKED_FHIR_CONFORMANCE_REVIEW` 解除は human review【HG】 | WP-6102〜6107 |

#### Track C — JAHIS 準拠

| WP | 内容 | 前提 / Gate |
|---|---|---|
| WP-6201 | JAHIS 仕様本文の入手経路決定と入手(2次元シンボル Ver.1.11、電子薬歴連携 Ver.1.1、お薬手帳 Ver.2.6、監査証跡メッセージ Ver.2.2)【EXT】【HG: 経営判断 — 会員/購入】 | — |
| WP-6202 | ADP-001(Ver.1.10)と JHS-001/004(Ver.1.11)の版認識不整合の解消、REG-002 watchlist 更新【SSOT】 | WP-6201 |
| WP-6203 | JHS-001〜008 の PROPOSED → APPROVED 昇格 batch(owner を現行 lane へ移管、精読ノート追加)【SSOT】【HG: PRC-007】 | WP-6202 |
| WP-6204 | `jahis_boundary.md`(ADP-A5 前提境界 SSOT)起案: decode 成功 ≠ 構文妥当 ≠ 患者同一 ≠ 原本真正 ≠ 薬剤師確認 の 5 結果分離【SSOT】 | WP-6203 |
| WP-6205 | 2次元シンボル decoder package(`packages/jahis-2d`): Shift-JIS 境界、レコード順検証、版検出、golden file、round-trip(JHS-008)。純粋関数・外部依存なし | WP-6204 |
| WP-6206 | 2D 取込 → 受付 `prescription_intake_type=qr` → provisional 処方 draft(C-056 の状態機械)接続。薬剤師確認前は算定・配信へ流さない | WP-6205、C-059 |
| WP-6207 | 電子薬歴連携(JAHIS Ver.1.1)出力 adapter: Track A event を JAHIS 形式へ変換する Official Adapter。contract test 付き | WP-6005、WP-6203 |
| WP-6208 | 電子版お薬手帳 Ver.2.6 export(患者交付。Phase 2 扱いのまま設計のみ)【GATED: N11】 | WP-6203 |
| WP-6209 | JAHIS 監査証跡メッセージ標準 Ver.2.2 への audit event mapping 評価 record | WP-6203 |
| WP-6210 | JHS-002 の「JAHIS 対応」6 条件の充足 evidence packet。`BLOCKED_JAHIS_CONFORMANCE_REVIEW` 解除は human【HG】 | WP-6205〜6207 |

#### Track D — オンライン資格確認・マイナンバー連動・電子処方箋

全件 RB-002 / RB-003 / RB-005 配下。**外部 IF 仕様入手前に書けるのは境界 SSOT、
ドメインモデル、synthetic fixture、fail-closed 状態機械、UI 状態表示まで**。

| WP | 内容 | 前提 / Gate |
|---|---|---|
| WP-6301 | ONS(医療機関等向けポータル)アクセス確保と外部 IF 仕様書・版の `source_registry` 登録【EXT】【HG: 人間手続き】 | — |
| WP-6302 | `online_qualification_boundary.md` 起案(ADP-A1 前提): 資格確認端末経由 / API 経由の選択、資格スナップショット不変性、再確認周期、請求前資格確認、災害時・障害時モードの状態【SSOT】【HG: R3】 | — (仕様入手前に骨子は書ける) |
| WP-6303 | 資格確認スナップショット domain model + schema 設計: 保険者番号・記号番号・負担割合・限度額区分・確認日時・確認方式(マイナ/券面/未確認)を append-only で保持。Coverage projection の canonical 元【SSOT: DOM 改版】 | WP-6302 |
| WP-6304 | 受付との接続: `eligibility_status` を `UNVERIFIED / VERIFIED_MYNA / VERIFIED_CARD / EXPIRED / MISMATCH / OFFLINE_PROVISIONAL` の状態機械へ置換。未確認受付は算定・請求へ進めない fail-closed | WP-6303、WP-4050 |
| WP-6305 | 薬剤情報・特定健診情報・診療情報の閲覧同意取込(マイナ保険証同意フロー)の境界設計: 同意記録、閲覧監査(MOD-008 追加)、表示のみ・yrese は正本を持たない【SSOT】【HG: privacy】 | WP-6302、C-037 |
| WP-6306 | ADP-A1 adapter 実装(synthetic stub 先行 → 公式接続試験)。外部 IF 応答の未加工保存+PHI classification、timeout/partial failure の fail-closed | WP-6301、WP-6304 |
| WP-6307 | 請求前資格確認バッチ(CLM-001 工程 6 の点検項目)。未確認・資格喪失・保険者変更を `MANUAL_REVIEW_REQUIRED` で保留 | WP-6306、Track F 請求 |
| WP-6308 | 電子処方箋 ADP-A2 境界 SSOT(`electronic_prescription_boundary.md`): 引換番号受付、処方情報取得、調剤結果登録、重複投薬等チェック結果の未加工転記、HPKI 署名呼出境界。**MVP は境界設計のみ(N1)**【SSOT】【HG: R3】 | WP-6301 |
| WP-6309 | 電子処方箋管理サービスの処方情報(FHIR JP 電子処方箋 profile)→ MedicationRequest ingestion(C-050)への写像 entry 追加。Track B の単一 writer を再利用【SSOT: DOM-006】 | WP-6308、WP-6106 |
| WP-6310 | 調剤結果登録(FHIR MedicationDispense ベース)の送信境界。送信失敗の誤認防止(MSR-017)を outbox/DLQ で可視化 | WP-6109、WP-6005 |
| WP-6311 | PMH(ADP-A4)境界 SSOT `pmh_boundary.md` と受給者証スナップショット。按分計算入力は CAL-R-025 解除まで `PENDING_PMH_REVERIFY`【SSOT】 | WP-6301 |
| WP-6312 | 災害時・障害時モード(EXTERNAL_DEGRADED / LOCAL_ONLY)での資格確認保留と RECOVERY_SYNC 再検証の実装(ARC-001/002 の最初の実体) | WP-6304 |

#### Track E — 情報連携を最大化する追加機能(提案)

| WP | 内容 | 前提 / Gate |
|---|---|---|
| WP-6401 | 電子薬歴 Pharmacy Integration API v0(PRD-001 M12): 処方・調剤イベント配信、薬歴未記載チェックの双方向(薬歴側 → `yakureki.recorded` inbox event)、薬学管理料整合の請求前点検入力 | WP-6005、WP-6008 |
| WP-6402 | 処方監査システム双方向 API(RB-007 を侵さない「未加工転記+出典明示」のみ)。監査結果は `ClinicalAlert` として表示、算定判断に使わない | WP-6008、REG-005 |
| WP-6403 | 在庫・分包機・POS 向け read-only projection API(現在庫表示の連携口、N9 の範囲内)。書込みなし | WP-6006 |
| WP-6404 | PH-OS 参照連携(API-004): schedule proposal / visit / report の projection 受信と調剤イベント配信。single writer per resource | WP-6005、WP-6008 |
| WP-6405 | 医療機関向けトレーシングレポート・服薬情報提供の FHIR Communication / DocumentReference projection(送信は partner 経由、yrese は直接送信しない)【SSOT: DOM-005 改版】 | WP-6108 |
| WP-6406 | 薬局間データ移行(他社レセコン → yrese)import 境界: JAHIS/FHIR/CSV の三系統入力を CanonicalPrescription に正規化、原本扱いしない。移行 dry-run と差分レポート | WP-6012、WP-6205 |
| WP-6407 | Developer Portal(OpenAPI/FHIR CapabilityStatement/event catalog/sandbox 申請)の静的公開【HG: legal(API-005)】 | WP-6011 |
| WP-6408 | 連携状態ダッシュボード(SCR-024/025): partner ごとの配送状態、DLQ、資格確認サービス・電子処方箋サービスの疎通状態、5 モード検知の実体化 | WP-6005、WP-6312 |

#### Track F — 連携が運ぶデータを生む中核レセコン機能(既登録 C-056〜C-066 の補完)

情報連携は配信対象(処方・調剤・算定・請求)が存在して初めて価値を持つ。
以下は §15.5 と重複しない差分のみ。

| WP | 内容 | 前提 / Gate |
|---|---|---|
| WP-6501 | 算定エンジンの API/DB consumer 接続: 確定調剤 → `calculate()` → `calculation_trace` 永続化 → API-007 read route(唯一の契約あり route なし resource)。既定ルールセットを EVIDENCE_ISSUED 16 行分へ拡張 | C-061、RB-008 行単位解除 |
| WP-6502 | 一部負担金・公費按分(CAL-R-024/025)の evidence 発行と golden test【HG: 診療報酬】 | 【EXT: 公式資料】 |
| WP-6503 | マスター基盤: 医薬品・薬価・調剤行為・公費・保険者の effective-dated テーブルと MST-001 24 段 pipeline の最小実装(取得→ハッシュ→スキーマ→差分→有効日→承認→反映→ロールバック)。CodeMappingRegistry(MST-002) | RB-009 |
| WP-6504 | 会計 append-only ledger(ACC-001 21 概念のうち Charge / PatientReceivable / Payment / PartialPayment / Refund)と領収証・調剤明細書(RCP-001〜004)の発行 | WP-6501 |
| WP-6505 | レセプト中間モデル生成(CLM-001 工程 2)と請求前点検(工程 6)。電算生成(工程 3)は RB-001 解除まで `BLOCKED_REGULATORY_REVIEW` | WP-6501、WP-6307 |
| WP-6506 | 帳票基盤: 調剤録・薬袋・薬情の template registry(RCP-005)、ハッシュ・版・出力者記録、PDF 生成 | WP-6501 |
| WP-6507 | システムモード検知 backend(NORMAL 固定表示の置換)と LOCAL_ONLY 仮受付・仮算定 | WP-6312 |

### 16.3 段階と exit criteria

| 段階 | 内容 | exit |
|---|---|---|
| **S0(現行)** | Milestone 1 exit: WP-4050 独立レビュー(C-001〜C-014)、§16.0 charter 決定 | WP-4050 PASS、`DEVELOPMENT_POLICY.md` 改版 or 現行維持の明示決定 |
| **S1** | Track B 前提(WP-6101〜6103)+ Track A SSOT(WP-6001/6002/6004)+ Track C/D の外部手続き着手(WP-6201/6301)+ JHS 昇格 | package provenance 登録、mapping entry ≥ Patient 全 Must Support、Hub SSOT 11 本 PROPOSED、MOD-009 APPROVED |
| **S2** | Milestone 2(C-043〜C-055)と同一 packet で WP-6105/6106/6107、outbox worker WP-6003 | cross-tenant 否認・stale conflict・retry dedupe・単一 writer 証明 + FHIR Patient read が validator PASS |
| **S3** | Milestone 3(C-056〜C-066)+ WP-6005/6006/6009/6010(webhook・registry・sandbox・contract test)+ WP-6104 CapabilityStatement | North Star E2E に「partner sandbox が `dispense.confirmed` を受信」を含めて PASS |
| **S4** | WP-6205〜6207(JAHIS 2D 取込・薬歴配信)、WP-6302〜6304(オン資境界・状態機械)、WP-6401/6402、WP-6501/6503 | 2D 取込 → 薬剤師確認 → 算定 trace → 薬歴配信が synthetic で貫通。資格未確認受付が請求へ進めないことを fail-closed テストで証明 |
| **S5** | WP-6007(OAuth2/mTLS)、WP-6108/6109(MedicationDispense)、WP-6306/6307(オン資実接続)、WP-6308〜6310(電子処方箋)、WP-6011/6407(SDK/Portal) | 公式接続試験 PASS【EXT】、conformance packet human review、legal review |
| **S6** | WP-6012/6013/6403〜6406/6504〜6507 | データ主権 export、KPI 公開、移行 dry-run |

### 16.4 本節が要求する human gate / 外部手続き(集約)

- charter 改版(§16.0)— `DEVELOPMENT_POLICY.md §2/§9/§11`、PRC-007。
- Integration Hub SSOT 11 本、DOM-005 bounded scope 拡張(MedicationDispense /
  Coverage / Organization / Practitioner)、JHS-001〜008 昇格、MOD-009 昇格 — PRC-007。
- 外部仕様入手: ONS アクセス(RB-002/003)、JAHIS 頒布(会員/購入判断)、PMH(RB-005)、
  NSIPS 許諾(RB-006、本節では設計も凍結のまま)。
- security: OAuth2 CC / mTLS / production 認証(C-083〜C-087)、partner scope。
- privacy: 薬剤情報・特定健診閲覧同意(WP-6305)、data portability export(WP-6012)。
- legal: OSS SDK / Developer Portal 公開(API-005 `BLOCKED_LEGAL_REVIEW`)。
- 診療報酬: CAL-R-024/025 evidence(WP-6502)、RB-008 行単位解除。
- conformance 主張: FHIR(WP-6112)、JAHIS(WP-6210)は human review 後のみ。

### 16.5 READY 昇格候補(slot は消費しない。順序は推奨)

**進捗(2026-08-23、codex 不使用・Claude が sole writer):**

| 候補 | 状態 | commit |
|---|---|---|
| WP-6101 | SRC-FHIR-007 を PROPOSED 登録。hash 再現は egress 承認待ち | `c9e6f18` |
| WP-6001 | Integration Hub SSOT 11 本を PROPOSED 起案(API-009〜018、ADP-003) | `034fe40` |
| WP-6202/6203 | 版不整合(Ver.1.10→1.11)を ADP-001/REG-001/REG-002 で訂正、JHS-001〜008 を 23 field 補完・0.1.1。全件 PROPOSED | `f5c0771` |
| WP-6302 | ADP-004 `online_qualification_boundary.md` 骨子を PROPOSED 起案 | `30a2957` |
| WP-4050 review | REQUEST_CHANGES → HIGH-1/2 修正 `28fd62e` → checker **PASS**(新規 HIGH なし)→ 残課題 MEDIUM-1/LOW-2 を `273c66e` で閉鎖。HIGH-3 FK は次行のhuman approval後にlocal/CI landing、MEDIUM-2(orphan の運用照合経路)は §8 候補 | `df2b628` |
| WP-6003 | `3c0c1fa` → 独立レビュー REQUEST_CHANGES(HIGH 1: 順序キー)→ `6f62b92` で全 finding 閉鎖(sequence_number、clock_timestamp、sink timeout、failures 報告、rowCount 検証、000007 書換え)。統合テスト 8 本 PASS | `6f62b92` |
| WP-4050 HIGH-3 | **human approval 2026-08-23** → migrations/000007(FK NOT VALID+VALIDATE、aggregate_type CHECK、sequence_number、index)。local synthetic / CI のみ適用 | `425294a` `6f62b92` |
| MEDIUM-2 | `listLegacyOrphans` 照合 query | `a20d8b9` |
| WP-6004 | Event Catalog v0 `reception.created` schema(packages/contracts)+ outbox→partner 投影 | `2f1b592` |
| WP-6005(最小形) | HMAC 署名 webhook sink(endpoint/secret 注入、registry 配線・key-id・rotation 未) | `1f2d45d` |
| SSOT review | api-contract lane REQUEST_CHANGES(HIGH 4)/ security-privacy lane REQUEST_CHANGES(HIGH 6)→ 全 finding 閉鎖。**Inbox は clinical 書込み経路でなくなり FHIR facade の単一 producer を維持、`inventory:read` 削除、MOD-005 に blocker 5 種登録(code 同期)** | `28dae05` `f07e76e` |
| SSOT 承認 batch | closure checker PASS → direct human approval で 25 文書 APPROVED(IDX-001 0.4.55) | `eb7c2d3` |
| MOD-008 0.2.5 | 情報連携監査種別 21 種(partner/delivery/eligibility/consent/external_record/sandbox/import)を PROPOSED 追加、`@yrese/audit` 同期。**review 待ち** | `b62f2bc` |
| WP-6006 | Partner Registry persistence(migrations/000008)、SSRF endpoint policy、registry-routed webhook 配送、key-id header、redirect 非追従。登録 HTTP route と partner.* 監査発火は contract-first の次 WP | `5d964aa` |
| WP-6303/6304 | `ccc2640` → 独立レビュー REQUEST_CHANGES(HIGH 4: 粒度・method/state・attach 上書き・過剰遷移)→ `b073f2a` で全閉鎖(受付単位の遷移元、同一 tx 記録+紐づけ、ADP-004 §3 と一致する遷移表、method↔state CHECK、CalendarDate 比較、migration 000011)。closure checker 待ち | `b073f2a` |
| WP-6006 review | 独立レビュー REQUEST_CHANGES(HIGH 4: 末尾ドット SSRF、DNS 再解決、先頭失敗の飢餓、国/所有権未検証)→ `66e4058` で 13 finding 全閉鎖(migration 000010)。closure checker 待ち | `66e4058` |
| MOD-008 review | REQUEST_CHANGES(21→20 種、payload/phiClassification 未定義)→ `b073f2a` で閉鎖。MOD-005 0.1.6 / ADP-004 0.1.1 と共に PROPOSED、承認 batch 待ち | `b073f2a` |
| closure checker | SSOT batch PASS(条件 M5 → `7f7df40` で解消)/ WP-6303 PASS / WP-6006 新規 HIGH 2(SUSPENDED 判定・policy 非適合行)→ `7f7df40` で閉鎖(migration 000012: 国 CHECK、grant/subscription 履歴、raw_response_ref 形式) | `7f7df40` |
| 承認 batch 2 | MOD-005 0.1.6 / MOD-008 0.2.5 / ADP-004 0.1.1 を APPROVED(IDX-001 0.4.58)。`BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT` の前提が揃い、partner.* / delivery.* / eligibility.* の監査発火が次 WP で可能 | — |
| 既知の上限(ponytail) | 配送可能 target と停止中 / 非適合 app が混在する event は前者へ配送して配送済みにする(後者は受け取れない)。配送先ごとの delivery state table(API-012、DDL)まで | — |

PROPOSED 化した SSOT(REG-001 / REG-002 / ADP-001 / ADP-004 / API-009〜018 / ADP-003 /
JHS-001〜008)は PRC-007 §4 step 6(独立 review)と step 7(human approval)待ち。


1. **WP-6101** JP Core package provenance 登録(C-024 と同一。外部手続き不要、
   SSOT 改版のみ、FHIR Track 全体の根)。
2. **WP-6001** Integration Hub SSOT 起案(charter 決定後。コード変更なし)。
3. **WP-6202 + WP-6203** JAHIS 版不整合解消と昇格 batch(仕様入手と並行可能な
   文書作業)。
4. **WP-6302** オン資境界 SSOT 骨子(仕様入手前に書ける範囲。ADP-A1 前提文書)。
5. **WP-6003** outbox 配送 worker(WP-4050 独立レビュー PASS 直後の最初のコード
   slice。配信がなければ共有 API は成立しない)。

**集計:** Track A=13 / B=12 / C=10 / D=12 / E=8 / F=7 — 合計 62 WP。本節の追加は
planning record の変更のみであり、実装・検証実行・commit・push・gate 解除・
`DEVELOPMENT_POLICY.md` 改版をいずれも行っていない。

## 17. 全画面 UI/UX 改善計画 v2.3 backlog(2026-08-27・inventory・claim ではない)

> **queue 規律:** 本節は §15/§16 と同じ inventory である。**READY slot を消費せず、登録は
> claim ではない。** WIP=1 / READY≤2、human gate、登録済み blocker、§6 NOT NOW、
> `DEVELOPMENT_POLICY.md §8` work-selection に従い、READY 昇格時に個別の DoR
> (PRC-003 19 項目)充足確認を行う。

### 17.0 Provenance・規律突合・human 判断記録(2026-08-27)

- **出自:** 計画 v2.3(独立多段敵対レビュー済み — 経過の逐次記録は §0 Document Contract
  により本書へ残さない。証跡は Git 履歴と非追跡作業文書)。計画全文は
  `.omc/plans/uiux-refresh-v2-plan.md`(非追跡の作業文書・non-authoritative)。
  **本節の登録内容だけが claimability の正本**であり、計画全文と
  食い違う場合は本節と APPROVED SSOT を優先する。
- **§8 登録規律突合(WP-5210-6):** 登録時点の READY = **0 件**(本書 §3)。
  DEVELOPMENT_POLICY §8「While two READY items exist, do not discover or register more work」
  の発動条件を満たさない。inventory 登録は claim でない(§15/§16 前例)。
  **7 件一括 backlog 登録は §8 適合 — human 判断 2026-08-27。**
- **WP-5111→WP-5211 改番の管轄:** Plans.md 運用範囲内(PRC-007 対象外)— human 判断
  2026-08-27。根拠: PRC-007:47 は Plans.md を非 SSOT と規定、旧 WP-5111 に ssot_id なし。
  定義本体(§8 Stage 1)と C-073 index 行の両方へ適用済み。
  **SSOT drift 登録(SSOT_UPDATE_REQUIRED):** APPROVED SSOT UIX-001 の frontmatter
  `related_work_packages`(docs/uiux/medical_ui_ux_principles.md:79)が旧 `WP-5111` を参照
  したまま dangling になる。本改番は Plans.md 側のみ有効であり、SSOT 側の参照更新は
  PRC-007 改版まで行わない(docs/ 本体は本 WP で触らない。§5 にも pointer 登録)。
- **WP-5121 の §5 転記:** 実施 — human 判断 2026-08-27(§5 参照)。
- **untracked disposition:** 「保持を記録」— human 判断 2026-08-27(§17.4)。
- **push authority / BLOCKER 解除:** main=`ad44068` までの merge・push はユーザーが
  2026-08-27 に明示許可したと確認済み(State.md ACTIVE SNAPSHOT に引用・経路を記録)。
  これにより WP-5210 は分岐 A(遡及記録で整合)で実施した。

### 17.1 Nonclaimable landing records

| landed commit | 内容 | 扱い |
|---|---|---|
| `3bc4805` | WP-5111(commit message 上の呼称)— 全 10 画面 UI/UX 刷新+実データ結線、read API 3 本 | FROZEN / GIT_HISTORY_ONLY / NONCLAIMABLE。§8 Stage 1 の L0 トークン WP とは別スコープ(採番衝突は WP-5211 改番で解消) |
| `ad44068` | WP-5201 runtime hardening(shutdown/pool cleanup races、reentrancy、pool lifetime)の consolidated UI branch への merge(main へは branch `integrate/all-remote-20260827` 経由の fast-forward、reflog 実測) | FROZEN / GIT_HISTORY_ONLY / NONCLAIMABLE。Plans.md 事前登録なしで着地(記録乖離は本節で解消) |

### 17.2 Work Package inventory(WP-5211〜5218、実行順 5212→5213→5214→5218→5215→5216→5211→5217)

全 WP 共通: 実装規約は計画 v2.3 §2.3(8 枚目 CSS 層禁止、表示値三択、破壊的操作の
二段階確認 UIX-001 P-11、可変長文言への nowrap 禁止)。SSOT_BLOCKED 4 画面+
/prescriptions RailCard 5 面の誤読防止不変条件(面単位隣接性)を全 WP で維持。
体制は role/capability ベース(sole writer = active_root_writer、read-only mapper /
verifier、+PRC-005 §2 の risk 別 specialist のみ追加。固定 reviewer 数の宣言はしない)。
gate/Git 操作は root lane 単独。R3 判定時は human pre-review record 成立まで実装開始しない。

| WP | 内容(1 行) | effort | risk 分類 | 依存 | DoR gate 条件 / reviewer_roles 候補 |
|---|---|---|---|---|---|
| WP-5212 | 受付・患者 動線キーストローク削減(業務日 required 化・引き継ぎ日付同期・選択中 pill・満年齢併記・処方への導線) | M | R2 | WP-5210(本記録変更の着地をもって成立) | 年齢併記は PRC-003 #8 PHI/PII 影響評価(SEC-004 PIA)完了が DoR 条件。reviewer: technical + security/privacy(年齢併記部分) |
| WP-5213 | 処方入力の破壊的操作安全化(serverChangedWhileAway・409 conflict の両分岐へ差分サマリ+二段階確認)とエラー特定性 | M | R2、unknown 時 R3 へ倒す | WP-5212 | medical_safety reviewer 該当性を DoR で判定(計画 v2.3 §7-3)。交付日数/行日数の優先関係が仕様未確定なら SSOT_UPDATE_REQUIRED で当該項除外。P-11 権限確認側は WP-5121 依存の open gap として State.md 転記 |
| WP-5214 | 横断パターン整備 — JST 日時共通化・再試行 UI・ルート横断状態ファイル | M | R2 | WP-5210(本記録変更の着地をもって成立)。5212/5213 と独立 | 既存共有フォーマッタとの重複禁止を frozen brief で確認。reviewer: technical |
| WP-5218 | Web test type boundary repair — patient search fixtureを既存 patient-context adapterへ通す | XS | R1 | WP-5214 の known typecheck blocker記録 | production consumerと同じ既存 `toPatientContextData` を再利用。exact1、production挙動・型定義・helper追加なし |
| WP-5215 | フォーカス可視性・a11y 基盤是正(--color-focus 定義、リングコントラスト 3:1、コマンドバー focus ring) | M | R2 | WP-5210(本記録変更の着地をもって成立) | WCAG 2.4.7/1.4.11 級欠陥の是正。≤540px コントロール入替は UIX-001 §17 凍結への抵触可否を DoR で判定(抵触なら WP-5124 へ切出し)。reviewer: accessibility_ux_reviewer。OperatorPreferences 削除は human 確認(計画 v2.3 §7-6)後のみ |
| WP-5216 | 警告階層化と実データ面の視覚昇格(gate 説明の正本 1 箇所+参照化、文言テスト同時改版) | L | R2 | WP-5214、WP-5215 | gate ID・誤読防止文の削除禁止(面単位隣接性不変条件)。gate 文言階層化の最終解釈は human(計画 v2.3 §7-4)。reviewer: medical_safety_reviewer 候補 |
| WP-5211 | CSS トークン基盤統合 Phase A(7 層→3 ファイル、nowrap 保持6/是正6) | L | R2 | `COMMITTED_LOCAL 6e40b5b` | 視覚差分ゼロ、landing実測9,672≤10 KiB。今後の上限はhuman再設定の12 KiB。frozen technical review PASS、push/mergeなし |
| WP-5217 | contract-first 結線強化 — A: 受付一覧hidden→visible再取得 / B: 単一対象 read | A=S, B=M | A=R2、B=未確定 | AはWP-5211 `6e40b5b`、Bは右記3 gate | Aは§3 exact4 DoRに限定。**Bは API-006 §7 CONTRACT_CHANGE_REQUEST + MOD-008 event判断 + SEC-004 PIA の全成立まで着手禁止** |

### 17.3 UI/UX design debt ledger(UIX-001 §16.2 様式)

| WP | affected UIX section | exact code path | observable harm | ux_safety_level | trigger | owner gate | polish/root-cause 区分 |
|---|---|---|---|---|---|---|---|
| WP-5211 | UIX-001 §16.2 / §8(予算) | apps/web/app/*.css 7 ファイル(operator-first.css:32-154 ほか)、layout.tsx:16-21 | 「可逆 refinement」契約の破綻(後続層トークンへのフォールバック無し依存)、hex 直値 distinct 82・出現 121(2026-08-27 WP-5215後のlive再計測。再現コマンドは表下注記)、token 正本二重化 | medium | レビューラウンドごとの CSS 層追加が層間矛盾を蓄積 | WP-5210 分岐 A 遡及記録(本記録変更の着地をもって成立)+§8 Stage 1 Renumber note の着手 gate | **polish ではなく root cause の統合是正**(可逆 refinement 契約破綻の解消) |
| WP-5215 | UIX-001 §4 実装対応表(キーボード操作)・§9 / WCAG 2.4.7・1.4.11 | operator-first.css:64(focus ring 欠如)、legacy.css:26 vs operator-first.css:43,51(リングコントラスト約 2.9:1 / 約 1.1:1)、--color-focus 未定義 | キーボード操作者がフォーカス位置を視認できない(SSOT は globals.css の focus ring 常時明示を記録するが operator-first.css:64 の outline: 0 が打ち消している — SSOT 記載との乖離) | high | WCAG 違反級欠陥の実測確認(2026-08-27 recon) | accessibility_ux_reviewer による frozen review | **defect 是正**(WCAG 2.4.7/1.4.11 違反級) |
| WP-5216 | UIX-001 P-01 / 警告設計 | checkout/page.tsx:38-151、monthly-closing/page.tsx:83-85 ほか(同趣旨 gate 説明が 1 画面 6〜7 箇所反復) | 警告過多により唯一の実データ面が埋没し、安全情報が読み飛ばされる | high | warning-fatigue の recon 実測(2026-08-27) | gate 文言階層化の human 最終解釈(計画 v2.3 §7-4)+medical_safety reviewer | **defect 是正**(安全情報埋没の解消) |

> 再現(hex 直値): 出現数 = `rg -o --no-filename '#[0-9a-fA-F]{3,8}' apps/web/app/*.css | wc -l` → 121、
> distinct = 同コマンド末尾を `| sort -u | wc -l` → 82(表セル内に `|` を置くと GFM が列を破棄するため表外注記とする)。

### 17.4 Untracked disposition(2026-08-27 human 判断)

- `ui-test-tools/`(browser gate 実行スクリプト群+node_modules)と `artifacts/ui-browser/`
  (検証スクリーンショット証跡)は **browser gate 検証ツール・証跡として保持**する。
  所有 WP: WP-5211/5215/5216 の browser gate 検証で使用。
- tracked 化(scripts のみ commit+`.gitignore` へ artifacts/・node_modules 追加)は
  WP-5211 系の別項として実施する(WP-5210 は「アプリコード変更ゼロ」のため本 WP では
  行わない)。browser gate の依存が untracked にしか存在しない状態は独立レビューで指摘済みであり、tracked 化完了までは再現手順が本 disposition
  記録に依存する。

## 18. 調剤レセコン機能ギャップの現状再評価と実装ロードマップ(2026-09-16)

> **来歴:** direct user instruction 2026-09-16「Plans.md 内のプランをレビュー。またコードベースを
> 探索して開発すべき計画を追加して。調剤薬局のレセプトコンピューターとして不足している機能を
> 特定して実装までの道筋を細かく立てること」。task mode は `PLAN_ONLY`(本書と State.md の
> pointer 以外を変更しない)。
> **調査根拠(live code、main=`02027c1`):** `apps/api/src/server.ts` / `main.ts` / `config.ts` /
> `plugins/tenant-context.ts` / `*-routes.ts`、`apps/api/src/db/*`、`migrations/000001〜000013`、
> `packages/{shared-kernel,contracts,calculation}/src`、`apps/web/app/*`、`scripts/ui-browser-check.mjs`、
> `.github/workflows/*`。SSOT は IDX-001(185 文書)の frontmatter status、PRD-001 M1〜M12、
> PRD-005(PROPOSED)§2「MVP 必須機能セット」、DOM-002/004、API-006/007、CAL-001、REG-004、
> ADP-004、ACC-001〜011、RCP-001〜006、CLM-001、MST-001/002、SPEC-002 §8〜§13。
> **queue 規律:** 本節は §15/§16 と同じ **inventory** であり、READY slot を消費せず登録は claim
> ではない。WIP=1 / READY≤2、human gate、登録済み blocker、§6 NOT NOW、§11 release blockers、
> `DEVELOPMENT_POLICY.md §9/§11` を上書きしない。昇格は `DEVELOPMENT_POLICY.md §8` に従う。
> 既登録の C-xxx / WP-6xxx は置換せず参照で結ぶ。新規 ID は WP-71xx〜WP-78xx(工程 R0〜R7)。
> **凡例:** 【HG】human gate、【SSOT】PRC-007 改版必須、【EXT】外部手続き前提、【REG】既登録項目参照、
> 【GATED】前提未成立、【REF】§15/§16 の既登録 ID を詳細化(重複起票ではない)。

### 18.0 既存プランのレビュー結果(§1〜§17)

live code との突合で見つかった stale 記載・要注記事項。gate 判断を誤らせる矛盾は検出しなかった。

| 節 | 記載 | 実測(2026-09-16) | 処置 |
|---|---|---|---|
| §1 Review base / Candidate branch | current branch = `refactor/wp-5275-…` | 当該ブランチはユーザ指示で main 取込後に削除。local/remote 共に `main` のみ | 本 record で訂正済み |
| §1.1 Seven-day plan | 9/13〜9/19 の実装計画 | 対象 WP は全件着地。期間内の計画として履行済み | 歴史記録として保持し注記を付与(削除しない) |
| §6 NOT NOW「billing/claims/receipt」 | 無条件に読める | charter §9 は「North Star 前提の前」に限定 | 矛盾なし。本節 R5/R6 はその前提充足後の順序記録であり、NOT NOW を解除しない |
| §8 P1〜P3 | 独立レビュー待ちの記載が残存 | 2026-09-16 に 8 code commit 全件 PASS(finding 0)。残るのは BUG-4264(C-017【GATED】)/BUG-4265(C-018/019【SSOT】) | 各行は同日訂正済み。追加変更なし |
| §16.1 処方行 | 「なし(UI shell)」 | bounded server-saved draft が稼働(`GET/PUT /prescription-drafts/by-reception/{id}`、CAS、read audit、migration 000013)。ただし行は **free-text**(`drug_text`/`usage_text`/`quantity_text`)で Rp・医薬品コード・構造化用量なし | §18.2 で「部分稼働(非構造化)」へ更新。§16.1 本体は 2026-08-23 時点の記録として不変 |
| §16.1 保険行 | 「なし(`eligibility_status` 列のみ)」 | `eligibility_snapshots`(000009/000011)+ `PostgresEligibilitySnapshotRepository` + shared-kernel 状態機械(ADP-004 §3)が着地。**HTTP route 0、main composition 未配線** | §18.2 で「永続層のみ・未配線」へ更新 |
| §16.1 Partner API 行 | 「配送 worker 0」 | `PostgresOutboxDeliveryWorker.runOnce`、HMAC webhook sink、registry-routed sink、partner registry 永続化(000008/000010/000012)が着地(WP-6003〜6006)。**runner process 0、登録 HTTP route 0** | §18.2 で「worker class あり・常駐 runner なし」へ更新 |
| §16.1 認証行 | 「dev header stub のみ」 | 追記: `tenantContextMode` は `disabled`/`dev_headers` の 2 値で、`dev_headers` は **in_memory mode 限定**(`server.ts` guard)。postgres mode では context が常に `undefined` → `requirePermission` 付き全 route が 403。**durable mode に認証済み到達経路が存在しない**(fail-closed 設計の帰結だが、North Star を実 DB で貫通できない構造要因) | §18.1 構造的発見 (1) として登録。R0 の最上位前提 |
| §16.1 算定行 | 「既定セット 5 本」 | `calculationRulesV20260601` はコード注記で「既定の算定セットではない例示。claimable=false 表示専用」と明示 | §18.3 WP-7501 では「参照用ルール束(例示)」として扱う。§16.1 本体は不変 |
| §16.5 進捗表 | 2026-08-23 時点 | 以後の WP-5101 draft 着地・WP-52xx・WP-527x〜5281 を反映しない | 当時の記録として不変。現状は §18.1 が正 |
| §17 / §15.6 UIUX pipeline | WP-5211〜5218 landed、WP-5112〜5124 GATED | 変化なし | 不変 |

### 18.1 実装実測 — 何が動き、何が眠り、何が無いか(main=`02027c1`)

**到達可能 runtime(12 operation、OpenAPI 同期・drift gate 有効):** `/health`、`/whoami`、
`GET /patients/search`(cursor、no-store、`patient.searched` 監査)、`GET /patients/{id}`、
`POST /reception`(冪等、WP-4050 原子境界: reception+audit intent+outbox intent 同一 tx)、
`GET /reception/queue`(unbounded、INV-20260730-01 実測済み)、`GET/PUT /prescription-drafts/by-reception/{id}`
(CAS `If-Match`、受付 WAITING/IN_PROGRESS write guard、`prescription.draft.viewed`)、`GET /audit/events`
(hash chain 検証、破損 total)、`GET /operations/{outbox-summary,reception-summary,migration-state}`。

**永続(migration 000001〜000013、全て forward-only、環境適用は【HG】):** `patients`、`reception_entries`、
`audit_events`(+object-root CHECK)、`outbox_events`(+FK/sequence)、partner registry 3 系(+history/country)、
`eligibility_snapshots`、`prescription_drafts`/`_rows`/`_flags`。`reception_entries` に version /
status 変更時刻 / 取消理由の列はない。

**眠っている資産(実装済みだが配線・消費者がない):**

| 資産 | 所在 | 欠けている接続 |
|---|---|---|
| 算定エンジン(68 evidence ルール、`calculate()`、trace、`POINTS_ONLY_COPAY_BLOCKED`) | `packages/calculation` | apps/api・apps/web に import 0。`packages/contracts/src/calculation-trace.ts` と API-007 契約は存在するが route なし |
| outbox 配送 worker + HMAC sink + registry-routed sink | `apps/api/src/db/outbox-delivery.ts` ほか | `main.ts` に runner なし(常駐 process / interval / 停止処理 / 単一 runner 排他) |
| eligibility snapshot repository + 状態機械 | `apps/api/src/db/eligibility-snapshot-repository.ts`、shared-kernel `eligibility.ts` | HTTP route・契約 SSOT・Web 表示接続なし |
| partner registry 永続化 + SSRF endpoint policy | `apps/api/src/db/partner-registry.ts`、`partner-endpoint-policy.ts` | 登録/照会 route なし、`partner.*` 監査発火なし |
| `calculation-trace-view` / `clinical-alert` / `mode-capability-view` component | `apps/web/app/components` | 供給する API が無い(表示器のみ) |
| `RECORD_LIFECYCLE_STATUSES`(UNSAVED〜FINALIZED/AMENDED/SUPERSEDED) | shared-kernel | サーバ側に対応する処方ライフサイクル永続なし(draft は「保存事実」のみ) |

**Web 9 route の実態:** `/`(受付ダッシュボード: 実データ)、`/patients`(検索: 実データ、登録 UI なし)、
`/prescriptions/[receptionId]`(draft 編集: 実データ)は業務可能。`/checkout`、`/claim-check`、`/monthly-closing`、
`/masters`、`/sync-status`、`/admin` は **読取専用シェル**(受付 summary・scope・migration state・停止中 gate 名の
表示のみ)。`/sync-status` の system mode は NORMAL 固定。

**CI:** PostgreSQL 18.4 service での integration(81 tests)+ Playwright/axe による 9 route × viewport の
見出し・a11y smoke。**業務 journey を貫通する E2E は存在しない**(C-064 未着手)。

**構造的発見(3 点。以降の全 WP の前提):**

1. **postgres mode に認証済み到達経路がない**(§18.0 認証行)。実 DB で動かすには production AuthContext
   (C-083)か、少なくとも「認証済み context を信頼境界から注入する adapter」の SSOT 承認が要る。
2. **受付状態遷移の route がない。** `reception_status` は `WAITING` で登録後、`IN_PROGRESS`/`COMPLETED`/
   `CANCELLED` へ遷移させる操作が API に存在しない(DOM-004 §2 の遷移表は APPROVED だが API-006 は
   GET/POST のみ)。draft の write guard が参照する終端状態に、実運用で到達できない。
3. **患者 write route がない。** `POST /patients` / `PUT /patients/{id}` は未実装(C-028/C-029【SSOT】)。
   in_memory fixture 以外で患者を系に入れる手段が DB 直接操作しかなく、紙運用の第一歩(初回来局患者の登録)が
   成立しない。

### 18.2 ギャップマトリクス(PRD-001 M1〜M12 × 実測 × SSOT × 主 gate)

「稼働」= 認可済み HTTP で到達可能、「永続のみ」= schema/repository あり route なし、「型のみ」= shared-kernel/contracts
の型・enum のみ、「なし」= コード 0。SSOT 列は IDX-001 status。

| M | 業務工程 | 機能 | 実測 | SSOT | 主 gate / 参照 |
|---|---|---|---|---|---|
| M1 | 受付 | 紙処方箋受付・冪等登録・当日キュー | **稼働** | API-006 APPROVED | queue bound 決定(C-021、INV-20260730-01) |
| M1 | 受付 | 状態遷移(対応開始・完了・取消) | **なし**(発見 2) | DOM-004 §2 APPROVED、API-006 に route なし | API-006 改版【SSOT】→ WP-7201 |
| M1 | 受付 | 処方箋原本 metadata(医療機関・医師・発行日・有効期限・リフィル) | なし(`prescription_date` のみ) | DOM-002 §4 主要属性 | DOM-002 §4.1 bounded 範囲拡張【HG】→ WP-7205 |
| M1 | 受付 | 2 次元シンボル / 電子処方箋 / OCR 取込 | なし(`prescription_intake_type` 列のみ) | JHS PROPOSED、RB-003 | §16 Track C/D【EXT】 |
| M2 | 患者 | 検索・取得 | **稼働** | API-001 APPROVED | 検索語 URL PHI(C-038) |
| M2 | 患者 | 登録・更新・取り違え防止 | **なし**(発見 3) | DOM-002 §2 APPROVED、API-001 は read のみ | C-028/C-029【SSOT】→ WP-7202 |
| M2 | 保険 | 保険証・公費受給者証の履歴(保険者番号・記号番号・負担割合・有効期間) | **なし** | DOM-002 §3 APPROVED(契約 SSOT なし) | 契約起案【SSOT】→ WP-7203 |
| M2/M3 | 資格 | 資格確認 snapshot(券面・目視の手動記録) | **永続のみ**(000009/000011、状態機械) | ADP-004 APPROVED §3 | 契約起案【SSOT】→ WP-7204 |
| M3 | 資格 | オンライン資格確認 | なし | ADP-004、RB-002 | 【EXT】WP-6301/6306 |
| M4 | 処方 | 手入力 draft(受付 1:1、CAS、監査) | **部分稼働(free-text 行)** | DOM-002 §4.1 APPROVED bounded | — |
| M4 | 処方 | Rp 構造化(医薬品参照・用法・用量・日数・数量・一般名・後発可否) | **なし** | DOM-002 §4 Rp APPROVED | DOM-002 §4.1 改版【SSOT】+ 医薬品マスター → WP-7302 |
| M4 | 処方 | 前回 Do | なし | PRD-005 §2(PROPOSED、PRD-001 未記載) | PRD-001 改版提案【SSOT】→ WP-7304 |
| M4 | 処方 | 疑義照会記録・残薬調整記録 | なし(`LEFTOVER_ADJUSTMENT` flag のみ) | DOM-002 §4/§5 | WP-7403 / WP-7404 |
| M4 | 確認 | 薬剤師確認・確定・訂正=新版 | **なし** | DOM-004 §1 APPROVED、C-061〜063 | C-084 資格境界【HG medical safety】→ WP-7401〜7403 |
| M4 | 調剤 | 調剤記録(Rp ごと実施・後発品変更・薬剤師確認) | **なし** | DOM-002 §5 APPROVED(契約 SSOT なし) | 契約起案【SSOT】→ WP-7404 |
| M5 | 算定 | 調剤報酬点数(consumer 配線・trace 永続・API-007 read) | **孤立**(engine のみ) | CAL-001 16 行 EVIDENCE_ISSUED、API-007 APPROVED | RB-008 行単位解除(step 3〜5)【HG 診療報酬】→ WP-7501 |
| M5 | 算定 | 一部負担金・公費按分・選定療養 | 型のみ(`POINTS_ONLY_COPAY_BLOCKED`) | CAL-R-024/025/020 BLOCKED | 【HG】【EXT】→ WP-7601/7605 |
| M6 | 会計 | 患者請求・未収・一部入金・返金・日計(append-only ledger) | **なし**(`/checkout` シェル) | ACC-001〜011 APPROVED | WP-7601 後 → WP-7602〜7604 |
| M7 | 帳票 | 調剤録(法定)・薬袋・薬情 | **なし** | RCP-005 APPROVED、REG-003 | 帳票 legal review【HG】→ WP-7503/7504 |
| M7 | 帳票 | 領収証・調剤明細書(採番・再発行・取消) | なし | RCP-001〜004/006 APPROVED | WP-7603 |
| M8 | 請求 | レセプト中間モデル・請求前点検 | なし(`/claim-check` シェル) | CLM-001 工程 2/6 | WP-7701/7702 |
| M8 | 請求 | 電算生成・記録条件検証 | なし | CLM-001 工程 3/4、RB-001 | 【HG】【EXT】WP-7705 |
| M8 | 請求 | 月次締め・ロック・返戻再請求 | なし(`/monthly-closing` シェル) | ARC-007、CLM-001 工程 7〜10 | WP-7703/7704 |
| M9 | マスター | 医薬品・薬価・用法・調剤行為・保険者・公費 | **なし**(`/masters` シェル) | MST-001/002 APPROVED | synthetic 先行 → WP-7301/7303、実データは RB-009【EXT】→ WP-7801 |
| M10 | BCP | 5 モード検知・LOCAL_ONLY・RECOVERY_SYNC | なし(NORMAL 固定) | ARC-001/002 APPROVED | WP-6507/6312【REF】→ WP-7802 |
| M11 | 基盤 | 認証(production AuthContext / OIDC) | **なし**(発見 1) | SEC-006/007/008 | C-083【HG security】→ WP-7101 |
| M11 | 基盤 | RBAC(scope 強制) | **稼働**(`requirePermission`、UI+API) | MOD-007 APPROVED | 資格(C-084)・runtime role/RLS(C-085) |
| M11 | 基盤 | 監査ログ(append-only、hash chain、PHI read 監査) | **稼働** | SEC-007、MOD-008 APPROVED | bounded 検証(C-088)・export(C-090)・自己増殖(C-089) |
| M11 | 基盤 | migration 環境適用 | source のみ | DB-002 | 【HG DDL】→ WP-7102 |
| M11 | 基盤 | structured logging / observability | **なし**(logger 全面無効、BUG-4265) | OPS-009 APPROVED | C-018/019【SSOT】→ WP-7803 |
| M11 | 基盤 | backup / restore / DR 演習 | なし | OPS-013 | 【HG】→ WP-7804 |
| M12 | 連携 | outbox 配送 runner・partner 登録 route・sandbox・contract test | worker + runner(WP-7103 着地・既定 off・local/CI sink のみ) | API-009〜018 APPROVED | egress 統制【HG security】(production のみ)→ §16 Track A |
| — | 検証 | North Star journey E2E | 部分 journey 稼働(WP-7104 着地: 検索〜draft〜audit/outbox) | C-064 | → WP-7405(全行程: 確認・確定・調剤記録を含む) |

**総括:** 「受付 → 患者検索 → 下書き → 監査」の骨格は稼働しているが、調剤レセコンとしての
**業務完結に必要な 3 系統 — (a) 患者・保険・資格の登録系、(b) 処方の構造化 → 薬剤師確認 → 調剤記録、
(c) 算定 → 会計 → 帳票 → 請求 — はいずれも未着手または孤立**している。(c) は法令 evidence gate が支配的で
順序を変えられないが、(a)(b) は APPROVED domain SSOT を持ちながら**契約 SSOT と実装だけが欠けている**領域であり、
ここが次の主戦場になる。

### 18.3 実装ロードマップ — 工程 R0〜R7(WP-71xx〜78xx、全件 inventory)

各 WP は **目的 / 現状 / 実装 phase(contract → schema → repository → route → web → test の順を既定)/
受入条件 / 検証 / gate・停止条件** を持つ。risk は PRC-005 §2 の分類で、R3 以上は human pre-review record
まで開始しない。実装 phase の「契約」は API-002(契約先行)と MOD-012 に従い `packages/contracts` + OpenAPI
再生成 + `check:openapi` を同一 WP で同期する。migration は DB-002 に従い forward-only・環境適用は別【HG】。

#### R0 — 稼働前提(durable runtime を人が使える状態にする)

| WP | 目的 / 内容 | 前提 / gate | risk |
|---|---|---|---|
| WP-7101 | **認証済み context 注入境界の SSOT**(C-083【REF】の詳細化)。`TenantContextMode` に production 用 provider(OIDC claims → `TenantContext`)を追加する**設計**と、CI/E2E 用の「署名付き test-auth adapter」(dev header と別物。in_memory 限定 guard を postgres でも安全に外せる条件)を SEC-006 系 SSOT へ起案。**コードは書かない。** 受入: provider 抽象(interface)、claims→scope 写像、失敗時 401/403 応答族(C-034)、dev header の production 不可条件が 1 文書で確定。**着地済み(SSOT 承認): SEC-009(authenticated_context_boundary)0.1.0 APPROVED — 独立 review 修正後に昇格。コードは WP どおり未実装** | 【SSOT】【HG security】 | R3 |
| WP-7102(着地済み — 手順確定のみ) | **migration 環境適用 runbook**(C-058 apply gate の実行仕様)。対象環境の列挙、`db:check` 事前確認、適用順、失敗時 forward-fix 方針、適用記録の置き場(Git ではなく運用記録)。§5「残余 (b)」と同じ様式で**手順だけを確定**し実行しない。**実績:** `docs/research/migration_apply_runbook.md` を起案(対象環境列挙・`db:check` preflight・版順適用・forward-fix・Git 外の運用記録・production/staging 適用は別承認のまま) | 【HG DDL】 | R3 |
| WP-7103(着地済み `c0d98b9`) | **outbox 配送 worker の runner**(WP-6003【REF】の未接続部)。`main.ts` composition に `PostgresOutboxDeliveryWorker` の常駐 loop(interval、`runOnce` の直列化、graceful shutdown で in-flight 完了、複数 process 時の単一 runner 排他 = advisory lock)を追加。sink は injected(local/CI では synthetic sink)に限定し、**production 配送は BLOCKED_SECURITY_REVIEW(egress)維持**。受入: `reception.created` が at-least-once 配送・重複なし・sink 障害注入で backoff・停止時に途中 event を失わない、を PG integration test で証明。**実績:** `PostgresOutboxDeliveryRunner` + `YRESE_OUTBOX_DELIVERY_*` config(既定 off)+ runtime event sink(local/CI 専用・外部送信なし)。PG integration 5 tests + DB-less 5 tests(計 10)で at-least-once・直列化・retry・standby 待機/failover・graceful stop・lock client 断線回復・運用 event を実証 | gate なし(local/CI 限定。config で既定 off)→ 着地 | R2 |
| WP-7104(着地済み `ea021f5`) | **North Star 部分 E2E harness**(C-064 の前身)。in_memory + dev header の現行到達可能 journey: 患者検索 → 選択 → 紙受付 → queue 反映 → draft 保存 → 再取得 → CAS 競合 → audit read で `patient.searched`/`reception.created`/`prescription.draft.viewed` を確認。API 層(fastify inject)と browser 層(既存 `ui-browser-check.mjs` の journey suite 追加)の 2 層。**アプリコード変更なし**。受入: CI で決定的に PASS、PHI fixture は MOD-013 synthetic のみ、失敗時 artifact(スクリーンショット)は `artifacts/` 配下。**実績:** API 層 `north-star-journey.test.ts` 3 tests(tenant 横断・scope 不足の fail-closed・hash chain 検証含む)。browser 層 `checkNorthStarJourney` + fixture `POST /reception` 冪等収容、実 UI 36 routes / 6 suites PASS(`north-star-journey.png`) | gate なし → 着地 | R1 |
| WP-7105(着地済み) | reception queue 防御的 cap(C-021 選択肢 b = RECEPTION_QUEUE_MAX_ENTRIES=1000)。**実績:** repository は cap+1 件まで読み(Postgres `LIMIT $4`、in-memory slice)、route は `snapshotDenseArray` の `maximum` で安全に検出し 503 `RCV-0007` + PHI 非含有 `nextAction` を返す(hostile Proxy 不変条件を維持 — raw `.length` 先読みを排除)。監査 `reception.queue.viewed` は cap 超過時に記録しない。API-006 0.3.3、MOD-006 0.1.6 で RCV-0007 登録、OpenAPI 503 追加、Web は非 200 を notice 化済み。regression test で 503/errorCode/nextAction/監査非記録を固定 | 着地 | R1 |

#### R1 — 受付・患者・保険の業務完結(APPROVED domain SSOT を持ち、契約 + 実装が欠ける領域)

| WP | 目的 / 内容 | 前提 / gate | risk |
|---|---|---|---|
| WP-7201(着地済み `f96e236`) | **受付状態遷移 API**(発見 2 の解消)。phase 1【SSOT】: API-006 CONTRACT_CHANGE_REQUEST — `POST /reception/{receptionId}/transitions` body `{to: IN_PROGRESS|COMPLETED|CANCELLED, expectedVersion, businessReason?}`(CANCELLED は businessReason 必須 = MOD-008 `reception.cancelled` 規律)、`If-Match` 併用、逆行/終端後遷移は 409 `RCV-0004`(MOD-006 追加)。MOD-008 に `reception.started` / `reception.completed` を追加(`reception.cancelled` は既存)。phase 2: migration 000014 — `reception_entries` に `version INTEGER NOT NULL DEFAULT 1`、`status_changed_at TIMESTAMPTZ`、`cancel_reason TEXT`(CHECK: CANCELLED ⇔ non-null)。phase 3: WP-4050 の command 境界を再利用し、遷移 + audit intent + outbox intent を同一 tx(in_memory 側も同型)。phase 4: Web queue 行に「対応開始 / 完了 / 取消」操作(confirmation-dialog 既存、取消理由入力)。受入: 遷移表(DOM-004 §2)の許可 4 / 禁止 全組合せを表駆動テスト、cross-tenant 404、stale version 409、終端後の draft PUT が既存 guard で 409、audit 1 操作 = 1 event、queue reload が force。**実績:** `POST /reception/{id}/transitions` + `If-Match`/`expectedVersion` CAS、RCV-0004/0005/0006(0006 は MOD-006 0.1.4 で新規登録)、`businessReason` は構造化コード(`/^[A-Z][A-Z0-9_]{2,63}$/`)、migration 000014、Postgres は SELECT FOR UPDATE+監査を同一 tx、in-memory は監査失敗時 undo 巻戻し、queue entry に version 公開、Web 行操作(対応開始/完了/取消 + 二段階確認 + 理由コード選択 + force reload)。route 27 tests・表駆動不許可遷移・cross-tenant/pharmacy 404・stale 409・監査巻戻しを含む | 【SSOT: API-006/MOD-006/MOD-008】。000014 の環境適用は【HG】 | R2 |
| WP-7202(着地済み) | **患者登録・更新 API**(発見 3 の解消、C-028/C-029【REF】)。phase 1【SSOT】: C-028 起案 — `patientNumber` 発番方式(薬局採番 / 自動採番)、一意性(既存 `patients_tenant_pharmacy_patient_number_unique` を authority とする)、identityDigest(C-029)の更新制約(氏名・生年月日・性別の変更は「訂正」として履歴保持)、同姓同名・同生年月日の登録時警告(取り違え防止、UIX-001)。API-001 を write 対応へ改版: `POST /patients`(Idempotency-Key 必須)、`PUT /patients/{id}`(`If-Match` 必須、412)。監査は MOD-008 **既存**種別 `patient.created` / `patient.updated` を発火(payload は patientId のみ。registry 改版不要)。phase 2: migration 000015 — `patients` に `version`、`created_at/updated_at/created_by/updated_by`、`patient_identity_history`(append-only)。phase 3/4: repository(tx + audit)、route、Web 登録フォーム(カナ・生年月日の二重確認、重複候補表示は既存 search 再利用)。**実績:** pre-review packet 全決定 APPROVED(D-1〜D-5)→ 実装。POST/PUT/GET versioned 全配線、`PAT-0007`(write 400)をギャップ訂正で登録(API-001 0.3.1 / MOD-006 0.1.5)、GET に `version` additive(API-001 0.3.1)、migration 000015(identity_history・idempotency・append-only trigger)を `yrese_dev` へ適用済み、Postgres は advisory lock + INSERT + 監査を同一 tx・numeric 任意精度採番、in-memory は補償 rollback + BigInt parity、UIX-001 §12.3 へ SCR-002-C/U 登録(0.2.1)、Web 登録フォーム + POSSIBLE_DUPLICATE 警告。route テスト + 実 PG 統合 11 tests。**R3 review gate: 別 context read-only review で HIGH1/MEDIUM2/LOW6 → 全件修正後 FINDINGS_NONE(frozen diff sha256 45636e1c)**。C-029 は cutover blocker 維持(patientNumber 不変・merge 経路なし) | 【SSOT: C-028、API-001】 | R3 |
| WP-7203(着地済み) | **保険・公費(Coverage)登録**。API-020 APPROVED。phase 1【SSOT】: `coverage_contract.md` 起案済み(一括 APPROVE)。**負担割合は入力値であり本 WP は計算しない**(CAL-R-024 BLOCKED を侵さない)。**実績:** pre-review packet D-3/D-4 APPROVED → 実装。`GET/POST /patients/{id}/coverage` 全配線(asOf 必須・kind 別 write scope・supersede は target-kind write)、append-only InsuranceCard/PublicExpense 履歴、訂正は supersede のみ(UPDATE/DELETE 経路なし)、migration 000016(3 表 + block_mutation trigger + supersede 一意 index + patient scope index)を `yrese_dev` へ適用済み(手動 backfill: 000017 先行適用のため runner 外で SQL+schema_migrations 行を tx 適用)。INS-0001〜0006 を MOD-006 準拠で shared-kernel へ実装登録。Postgres は advisory lock + 行+冪等+監査を単一 tx(REPEATABLE READ の GET で in-memory と snapshot parity)、in-memory は補償 rollback。POST 応答は行そのもの(envelope なし、API-020 §2 忠実化は review 指摘で修正)。UIX-001 §12.3 へ SCR-007-R/C 登録(0.2.2)、Web 患者 coverage パネル(明示 asOf・記録値 honest 表示・訂正 supersede 導線)。route 15 tests + 実 PG 統合 7 tests。**R3 review gate: 別 context read-only review で MEDIUM3/LOW4 → 全件修正後、再審 MEDIUM0/LOW3 → 全件修正後 FINDINGS_NONE(frozen diff sha256 2e14f411)** | 【SSOT: API-020】 | R3 |
| WP-7204(着地済み) | **資格確認 snapshot の手動記録 route**(眠っている 000009/000011 の配線)。phase 1【SSOT】: `eligibility_snapshot_contract.md` 起案 — ADP-004 §3 状態機械を wire に写す。手動記録できる遷移は `VERIFIED_CARD`(券面確認)/ `PROVISIONAL_VISUAL` のみ、`VERIFIED_MYNA` は外部 IF 由来限定で本 WP では 422。phase 2: `POST /reception/{id}/eligibility-snapshots`、`GET` 同、Web 受付行・patient-header の eligibility 表示を snapshot 由来へ切替。受入: 既存 repository の idempotent retry / conflict テストを route 層まで貫通、`eligibility.*` 監査(MOD-008 0.2.5 で登録済み種別)、`allowsFinalCalculationForEligibility` が UI のみで判断されない。**実績:** POST/GET `/reception/{id}/eligibility-snapshots`(POST=insurance:write+reception:read、GET=insurance:read+reception:read)、INS-0007〜0010(MOD-006 登録済み・実装済みへ更新)、asOfDate 必須(MOD-011 明示日付権威)、append-only + 同一内容再送 200 / 別内容 409、Postgres は advisory lock + snapshot INSERT + 受付紐づけ + 監査を同一 tx(監査失敗は全 rollback)、in-memory は undo 補償、監査 `eligibility.verified`/`eligibility.provisional_recorded`/`insurance.viewed`、queue entry に `eligibility` 公開(API-006 0.3.2 additive)、Web は受付行バッジ・metrics・launch 画面を snapshot 由来へ切替(reception-eligibility ドメインを visual-status-registry へ追加)。route 24 tests + contract テスト + 実 PG 統合 14 tests | 【SSOT: 新契約】。ONS 接続は含まない(RB-002) | R2 |
| WP-7205(着地済み) | **処方箋原本 metadata**(医療機関コード/名称、医師名、発行日、有効期限 = 発行日+4 日の既定は**入力値**、リフィル回数・残回数、分割調剤指示)。DOM-002 §4.1 bounded slice の範囲外のため、まず §4.1 改版【HG: 2026-08-26 bounded approval の拡張】。migration 000017 で `prescription_drafts` に列追加(nullable、後方互換)。有効期限超過は警告(`ClinicalAlert` 表示器再利用)であり拒否しない(薬剤師判断)。**実績:** DOM-002 §4.2a は 2026-09-17 一括 APPROVE で承認済み【HG 解消】— `sourceMetadata`(medicalInstitution{code nullable,name}/prescriberName/issueDate/validUntil/refill{total,remaining}/splitDispensing)を draft content schema へ additive 追加(省略時 null、validUntil<issueDate と remaining>total を schema 拒否)、migration 000017 は 8 列 nullable + 「全列 NULL または必須列すべて非 NULL + valid_until≥issue_date + refill 整合」CHECK で fail-closed、content hash は新構造を含み既存行は sourceMetadata キーなしの legacy hash で後方互換受理、Web は原本情報入力欄 + 発行日+4日の入力補助(保存値は入力値)+ 期限超過を ClinicalAlert(DOCUMENT_VALIDITY 新規 alertType・非ブロッキング)で警告。contract テスト + 実 PG 統合(metadata round-trip・CHECK 拒否・legacy hash 受理・unchanged 判定) | 【SSOT: DOM-002 §4.2】 | R2 |

#### R2 — 処方の構造化とマスター(算定・帳票・連携が消費できる形にする)

| WP | 目的 / 内容 | 前提 / gate | risk |
|---|---|---|---|
| WP-7301(着地済み) | **医薬品マスター基盤(synthetic 先行)**。MST-001 の「版・有効日・上書き禁止」だけを先に実装: migration 000018 `master_versions`(種別・版・有効開始・廃止・経過措置・配布状態、DOM-002 §9)、`medication_items`(版 FK、自局コード、YJ/レセ電/HOT コード列は nullable、名称、規格単位、薬価(整数・単位付き、MOD-010)、後発区分、一般名コード、麻/向/毒/劇 区分)。`GET /masters/medications?asOf=&q=` 読取 route(no-store 不要 — PHI ではない。ただし tenant 横断で共有可否は DB-003 で確定)。**実データ取込は本 WP に含めない**(RB-009、source registry 登録後の WP-7801)。fixture は MOD-013 synthetic(架空名称・架空コード)。受入: as-of 解決が(処方日・調剤日)明示入力、版上書き不可、廃止日以降の解決は `PENDING_MASTER_VALIDATION` 相当の blocker。**実績:** MST-003 0.1.0 APPROVED(独立 review 修正後に昇格)→ migration 000018(master_versions/medication_items/usage_items + append-only trigger + scope index)、`GET /masters/medications?asOf=&q=`(`master:read`、asOf 必須、q=localCode 前方一致/name 部分一致・COLLATE "C" parity、no_version は 200 空集合)、synthetic seed(MOD-013 合成規則・冪等・`SYN-` 接頭辞)を `master-seed.ts` + `db:seed-masters` CLI で実装(in-memory dev は起動時自動 seed、postgres は CLI 経由のみ)。MST-0001 実装・MST-0002 予約登録(MOD-006 0.1.7)。route 13 tests + contract 9 + 実 PG 統合 7 | 【SSOT: MST-001 の実装分解記録】。実データ【EXT】 | R2 |
| WP-7302(着地済み — D-1〜D-5 APPROVED・実装完了・R3 review 4 ラウンド閉塞) | **Rp 構造化**。**実績:** packet D-1〜D-5 を「次に進んで」で APPROVED。contracts に `rpGroups`/`rpItems`(剤形区分 enum、用法・品目参照の resolved/unresolved union、groups ≤50/items ≤200/text ≤500/dose ≤64、連番・ID 一意性、rows+rpGroups 同時指定 400、legacy rows は `deriveRpGroupsFromLegacyRows` で UNRESOLVED_TEXT 決定的読み替え、unresolved counts/guard 関数)。`RX-0001 CODE_MAPPING_REVIEW_REQUIRED` を shared-kernel+MOD-006 0.1.8 登録。migration `000019`(`prescription_drafts.rp_groups JSONB` + JSONB 検証 + `prescription_draft_rows` write-block trigger — `yrese_dev` 適用済み)。API は save 時 materialize・read は rpGroups 優先/legacy 導出・content hash 3形式受理・CAS/監査不変。Web は構造化 Rp エディタ(剤形・薬剤/用法コード選択・用量・一般名/後発品)+ master picker + RX-0001 未解決バッジ。薬剤師確認 route は WP-7402 で実装済み。用量計算・FHIR 投影なし。**R3 review: 独立 reviewer で 4 ラウンド(R1: 6M/6L → R2: 2M/8L → R3/R4: 各 1L)全件修正** — group field 伝播・phantom 品目防止・empty draft 拒否・制御文字拒否・master timeout/版一致 hydrate・LIKE escape・flag canonical 比較・trigger/hash 統合テスト。packet §9 に記録 | — | R3 |
| WP-7303(着地済み) | **用法マスター(synthetic)**。自局用法コード・用法文・服用タイミング構造(1 日 N 回、食前/食後/就寝前、頓用)。JAHIS 用法コードへの写像列は仕様入手(WP-6201)まで空。薬袋・薬情(WP-7504)の用法印字の供給元。**実績:** WP-7301 と同基盤で着地 — `usage_items` 表、`GET /masters/usages?asOf=&q=`(同規則)、synthetic usage seed 6 件(食前/食後/就寝前/頓用)、jahisCode は nullable(WP-6201 まで空)。同じ PG 統合・route テストで検証済み | WP-7301 | R1 |
| WP-7304(実装着地) | **前回 Do(過去処方の複製起点)**。**実績:** packet D-1〜D-8(`docs/research/wp7304_pre_review_packet_20260919.md`)に沿って実装。`POST /prescription-drafts/by-reception/{receptionId}/from-prior`(`prescription:write`+`reception:read`+`patient:read`、明示 `sourcePrescriptionId` 必須・`sourceVersion` 省略時は最新確定版、対象 reception は WAITING/IN_PROGRESS + patient/date 一致、既存 draft は 409)。migration `000023`(`prescription_drafts.copied_from_*` + 両 null/両非 null CHECK + `prescription_versions` 複合 FK — `yrese_dev` 適用済み)。旧 resolved item は `findMedicationItemById`/`findUsageItemById` で旧 `localCode` を復元し現行 asOf version で再解決、廃止/不存在品目は旧 display text で unresolved 降格、未解決 ref はそのまま、`prescriptionDate`/`sourceMetadata` はリセット。監査は source `prescription.draft.viewed` + 新 draft `prescription.created`、PG は単一 tx、in-memory/PG parity。OpenAPI `createPrescriptionDraftFromPrior` 再生成、web test mock 4 件追随。route 記法は find-my-way の `:param:suffix` 非対応により `/from-prior` static セグメント(packet §11 に逸脱として記録)。**独立 review 2 ラウンド(R1 FAIL 1M → R2 PASS)** — PG tx 保持中の pool 再借用(枯渇 stall/POOL_MAX=1 timeout)を `masterReadRepositoryForClient` client 束縛で修正 + poolMax=1 回帰。API 1,332 PASS(実 PG・skip 0)+ 全 gate 緑。packet §11 に記録 | 【SSOT: PRD-001】、WP-7302、WP-7402 | R2 |

#### R3 — 薬剤師確認・確定・調剤記録(Milestone 3 中核。C-061〜C-066【REF】を実行可能な粒度へ)

| WP | 目的 / 内容 | 前提 / gate | risk |
|---|---|---|---|
| WP-7401(着地済み) | **薬剤師 actor/qualification 境界 SSOT**(C-084【REF】)。`prescription:confirm` / `dispensing:confirm` scope の付与条件(薬剤師免許 evidence の保持形・確認者・有効性)、資格 evidence の tenant 内管理と監査、HPKI は境界外(RB-003)、非薬剤師 actor の確定操作拒否(403 + 監査 deny = C-022)。**実績:** `docs/security/pharmacist_qualification_boundary.md` SEC-010 APPROVED(scope claim + ACTIVE `PHARMACIST_LICENSE` evidence の実行時判定、evidence 欠落/REVOKED は fail-closed、deny 監査、登録/取消 route は後続 WP)。IDX-001 0.4.71。**コードなし** | 【SSOT】【HG medical safety + security】 | R3 |
| WP-7402(実装着地) | **処方確認・確定 command**(C-061/C-063)。**実績:** packet D-1〜D-6 を「残タスクを実行。すべて許可」で APPROVED(`docs/research/wp7402_pre_review_packet_20260919.md`)。`POST /prescriptions/{id}/confirm`(status NULL → PHARMACIST_CONFIRMED、ガード: `prescription:confirm` scope + SEC-010 ACTIVE 資格 + 全 Rp 解決済み + 原本 metadata 充足 + 受付 IN_PROGRESS)、`POST /prescriptions/{id}/finalize`(→ PRESCRIPTION_FINALIZED、未解決/metadata 再検証)。migration `000020`(status 列 + 単方向/不変 trigger + `prescription_versions`/`actor_qualifications` append-only + outbox aggregate_type 'prescription' 拡張 — `yrese_dev` 適用済み)。同一 tx で version=1 immutable snapshot + content hash 一致検証 + audit `prescription.confirmed/finalized` + deny 時 `prescription.{confirm,finalize}.denied` + outbox `prescription.finalized`(PHI なし payload)。status NULL 以外の draft PUT は 409。Idempotency-Key 同一再送は `replayed:true`。RX-0002〜0006 を shared-kernel+MOD-006 登録。Web は lifecycle panel(状態・未解決数・未保存・metadata 充足・確認/確定者時刻)+ 責任文言付き 2 dialog + 確定後 read-only。MOD-008 0.2.8・API-012 0.1.1・MOD-009 0.2.2・MOD-005 §2.3・IDX-001 0.4.72 同期済み。受入全件を実 PG 統合で検証。資格登録/取消 route・production 適用・外部配送 worker は別 WP/gate。**R3 review: 4 ラウンド(R1: 2H/7M/9L FAIL → R2: 3M/1L → R3: fixture 2M/1L → R4: PASS)全件修正** — partner projection `version` 投影 + payload fail-closed、PG confirm lock 順を save と同じ reception→draft、status/replay 判定を draft lock 後へ移動(reception 完了後も same-key replay が 200)、in-memory は evidence 書込み後に状態適用 + lock 内で record 再読込、metadata ガードに type/date/days 追加、migration `000021`(identity/lifecycle 記録/冪等 key 不変 trigger + 子表 post-confirm 全 DML 拒否 + 親 DELETE 拒否 + `actor_qualifications.recorded_seq` tiebreak)、`ConfirmationDialog` へ置換 + 患者再提示 + actor 表示、MOD-009 文言整合(`<eventId>:1`、outbox_event_id↔audit_event_id FK)、confirm replay post-finalize は 409(packet D-7)、fixture lifecycle endpoint + view shape + 冪等 key parity、locked PUT `code:RX-0002`、PG 統合で rollback/concurrent/REVOKED/deny/envelope/chain/tamper/replay-after-completion を検証。packet §10 に記録 | WP-7401、WP-7302、WP-7201(IN_PROGRESS 到達)、WP-7205 | R3 |
| WP-7403(実装着地) | **訂正 = 新版 + 疑義照会記録**(C-062)。**実績:** packet D-1〜D-7(`docs/research/wp7403_pre_review_packet_20260919.md`)に沿って実装。`POST /prescriptions/{id}/inquiries` + `/inquiries/{inquiryId}/answer`(`prescription:write`、Idempotency-Key 必須、回答 write-once、同 key+別 payload は 409 RX-0010)、`POST /prescriptions/{id}/amend`(`prescription:confirm` + SEC-010 ACTIVE 資格、資格判定を存在判定より先に実行、PRESCRIPTION_FINALIZED + 同 scope/同処方の RESOLVED+CHANGED inquiry 必須、§4 guard 順序準拠)、`GET /prescriptions/{id}/versions[/{version}]` + `/inquiries`(scope 隔離・read 監査・no-store)。migration `000022`(`prescription_inquiries` append-only + write-once answer trigger + TRUNCATE 拒否、`prescription_versions` v≥2 lineage 列 + lineage CHECK、`outbox_events.intent_dedup_key` — `yrese_dev` 適用済み)。新版は `supersedesVersion`/`inquiryId`/`amendedBy/At` を持つ append-only 行、confirm+finalize provenance は amend 実行者・時刻、`prescription_drafts` 非接触・status は FINALIZED 維持。同一 tx で version+audit `prescription.amended`+outbox(payload = prescriptionId+version のみ、partner projection fail-closed)。監査は `inquiry.recorded/answered`・`prescription.amended`・`prescription.amend.denied` を registry+runtime 登録、payload は structured targetRef+`INQUIRY_RESULT_*` の識別子のみで本文/PHI 非含有。RX-0007〜0010 登録。in-memory/PG parity、OpenAPI 6 path 再生成、fixture migrationState=000022。**R3 review: 3 ラウンド(R1: 3M/4L FAIL → R2: 1L FAIL → R3: PASS)全件修正** — amend replay の payload 比較に inquiryId 追加、v≥2 provenance を amend 実行者・時刻へ、監査識別子(inquiryId/result/version)を structured targetRef で付与、replay を guard 6 へ移動、in-memory finalize v1 `confirmedBy` を confirm 実行者へ修正(parity)、F-5/F-6 は根拠付き不採用(WP-7402 同順序・draft lock 下 SELECT で担保)。packet §10 に記録 | WP-7402 | R3 |
| WP-7404(実装着地) | **調剤記録(DispensingRecord)**。**実績:** packet `wp7404_pre_review_packet_20260919.md` + 契約 SSOT API-021(`docs/api/dispensing_record_contract.md` v0.1.2)に沿って実装。`POST /dispensings`(`dispensing:write`)+ `POST /dispensings/{id}/confirm`(`dispensing:confirm` + SEC-010 ACTIVE 資格を存在判定より先に評価、deny 監査)。1 版 1 記録・全 rpItem ちょうど 1 回カバー・`dispensedMedicationItemId` XOR `dispensedText`(空文字は null 正規化)・quantity は文字列のまま数値解釈しない・後発品変更は `genericSubstitutionPermitted === true` + `genericNameCode` 一致必須の fail-closed(resolved 行への free text も変更扱いで可否必須、dispensed 側 master 未存在=409、確定版参照品目の不在=不変条件 breach 500)。migration `000024`(dispensing_records/dispensing_items、append-only trigger、`create_request` 不変、status NULL→DISPENSING_RECORDED のみ、confirm key UNIQUE、outbox aggregate `dispensing` — `yrese_dev` 適用済み・checksum 一致)。confirm は status+監査+outbox `dispense.confirmed`(payload は prescriptionId+version のみ、PHI 非含有)を単一 tx。冪等: create は JSONB `=` payload 等価 replay、並行 same-key は draft `FOR UPDATE` lock 後の再評価で replay/conflict/duplicate を区別、23505 は rollback+retry。DSP-0001〜0008、監査 3 種、in-memory/PG parity(canonical JSON replay・scope-wide lock)。GET endpoint は本 WP では非提供。**独立 review 4 ラウンド(R1 FAIL 5M/7L → R2 FAIL 2M/3L → R3 FAIL 2L → R4 PASS)** — guard 順序・TOCTOU・23505 handling・XOR 正規化・registry drift を修正。API 1,372 PASS(実 PG・skip 0)+ 全 gate 緑。packet §10 に全記録。Web 調剤盤は WP-5113【REF】統合で別途 | 【SSOT: API-021】、WP-7402、WP-7403 | R3 |
| WP-7405(実装着地) | **North Star 全行程 E2E**(C-064)。**実績:** packet `wp7405_pre_review_packet_20260919.md` に沿って実装。`test_signed` tenant context(SEC-009 §4: `x-test-auth` HMAC-SHA256・timing-safe 比較・flag+非 production+鍵の三重 gate・鍵未設定は起動 fail、401 AUTH-0004 / 403 AUTH-0003、MOD-006 0.2.2・IDX-001 0.4.76)。in-memory journey は受付→IN_PROGRESS(実 transition route)→master 検索→resolved Rp draft→薬剤師確認→確定→調剤記録→調剤確定→audit 7 種+outbox evidence、fail-closed 3 経路(非資格 403+deny 監査・未解決 confirm 409 RX-0001・終端受付保存 404)。postgres journey は実 migration・実 PG・test_signed で同行程完走。fixture は masters/transitions/dispensing endpoint + 受付 version/eligibility 補完 + 冪等/CAS parity、browser journey は UI で受付→確認→確定、調剤は fixture fetch(D-3)、outbox 集計まで検証。drift していた aria-label 群を修正。**検証:** API 1,386 PASS(実 PG・skip 0)、workspace 全 PASS、browser gate 36 routes/6 suites PASS、全 check gate 緑 | WP-7402〜7404、WP-7101 | R2 |
| WP-7406 | **fail-closed 可視化総点検 + 薬剤師 human safety/UX review packet**(C-065/C-066)。算定・請求・帳票・連携の各画面が「未実施」を成功に見せていないことの点検表と、pilot 判断前 human review の入力 packet。**実績(点検部分)**: packet `wp7406_pre_review_packet_20260919.md`(D-1〜D-5 は 2026-09-19「進んでいい」で承認済み)。C-065 点検表を採点(packet §9 — 15 surface 行、うち帳票・調剤 UI は画面非存在) — P-1 stale「未実装」文言を 8 箇所修正(画面 6・README/test docstring 2)、P-5 SSOT drift(UIX-001 SCR-014/015)は改版提案へ送り packet で開示。C-066 human review packet 構成は packet §5。薬剤師レビュー実施と pilot 判断は【HG】で未実施。後続起案: `uix001_scr014_015_amendment_proposal_20260919.md`(P-5 改版提案)、`wp7407_qualification_route_packet_20260919.md`(資格登録/取消 route)、`wp7408_oidc_provider_packet_20260919.md`(SEC-009 OIDC 実装)— すべて承認待ち | WP-7405 | 【HG】 |

#### R4 — 算定配線(点数のみ)と法定帳票

| WP | 目的 / 内容 | 前提 / gate | risk |
|---|---|---|---|
| WP-7501 | **算定 consumer 配線**(WP-6501【REF】の詳細化)。`dispense.confirmed` を契機に `CalculationRequest` を組立(patient / insuranceSnapshot = WP-7204 の snapshot ID / publicExpenses = WP-7203 / prescription version / dispensing / receptionDate / claimMonth / masterVersion = WP-7301 / calculationRuleVersion 明示)→ `calculate()` → `calculation_traces`(CAL-008 schema、append-only、入力の再現に必要な全参照を保持、migration 次番号 000025 — 000024 は WP-7404 で使用済み)→ `GET /calculations/{dispensingId}`(API-007 契約 APPROVED、`packages/contracts/src/calculation-trace.ts` 既存)→ Web `calculation-trace-view`(既存 component)へ供給。監査は MOD-008 **既存** `calculation.finalized`。**`POINTS_ONLY_COPAY_BLOCKED` を維持し金額を表示しない**。参照用ルール束 `calculationRulesV20260601`(5 本。コード注記どおり「既定の算定セットではない例示」であり、適用ルールは呼び出し側 = WP-7502 が明示指定)に限る `claimable=false` 表示専用の bounded slice から始め、EVIDENCE_ISSUED 16 行は RB-008 step 3〜5(rule 実装 → golden test 期待値 SSOT 化 → APPROVED_FOR_IMPLEMENTATION)を行単位で通す。受入: 純粋性 gate(`check:calculation-purity`)不変、trace なし結果が存在しない(型)、`affectsClaim` step は evidenceRefs≥1、同一入力の再計算で同一 trace hash、`isClaimable=false` の表示が外れない | WP-7404、WP-7204、WP-7301、【HG 診療報酬: RB-008 行単位解除】 | R3 |
| WP-7502 | **算定要件入力(applicationKey)と施設基準**。`requirementsNotVerifiedWarning` が示す「呼び出し側指定」項目(時間外・休日・深夜、一包化、自家製剤、計量混合、麻薬/向精神薬加算、施設基準届出 = `facility_basis_version`)を、薬局設定(施設基準届出の版・有効日、`pharmacy_facility_basis` テーブル = migration 次番号で新設)と調剤記録の flag から組み立てる。**適用可否の判断はしない**(入力と evidence 参照の記録のみ) | WP-7501 | R2 |
| WP-7503 | **調剤録**(薬剤師法 §28、REG-003)。RCP-005 template registry と `report_instances`(DOM-002 §8: 種別・版・出力日時・出力者・hash・出力時点の算定根拠/マスター版参照、migration 次番号 000026)。PDF 生成は pure renderer(外部 network なし)。再出力 = 新 instance、内容改変なし、hash による改ざん検知。法定記載事項と保存期間は REG-003【要確認】→ DB-004 retention と接続。受入: 出力後の元データ変更で hash 不一致が検出される、出力者・時刻・版が instance に固定、PHI が file 名・log に出ない | WP-7404(調剤記録)、WP-7501(点数記載は任意)、【HG: 帳票 legal reviewer】 | R3 |
| WP-7504 | **薬袋・薬剤情報提供文書**。同 template registry。用法印字は WP-7303、品目名は WP-7301。薬情の効能・副作用文言は医薬品添付情報(実データ【EXT】)が要るため synthetic template で構造のみ先行。受入: 患者交付済み flag と取消監査(DOM-002 §8) | WP-7503 | R2 |
| WP-7505 | **請求前点検リスト帳票**(RCP-005、PRD-001 M7)— R6 WP-7702 の点検結果を帳票化 | WP-7702 | R1 |

#### R5 — 会計・領収(一部負担金 evidence 後)

| WP | 目的 / 内容 | 前提 / gate | risk |
|---|---|---|---|
| WP-7601 | **CAL-R-024 一部負担金 evidence 発行 + golden test**(WP-6502【REF】前半)。負担割合・高額療養費限度額区分・端数処理(MOD-010)の公式資料を source registry に登録し、CAL-003 evidence_register へ行追加、golden test 期待値を SSOT 化。**コード実装は evidence APPROVED 後** | 【HG 診療報酬】【EXT: 公式資料】 | R4 |
| WP-7602 | **会計 append-only ledger**(ACC-001 の Charge / PatientReceivable / Payment / PartialPayment / Refund / Adjustment、ACC-002〜006)。migration 次番号 000027。修正は reversal/adjustment 行の追加のみ(SPEC §9)。一部入金・入金割当(ACC-003)・ar_status(ACC-006)・日計(ACC-007)・支払方法(ACC-008、現金のみ先行)。受入: 未入金額を領収済みとして返す経路がない、reversal で残高が整数一致、同一 receipt への二重入金は冪等 | WP-7601、WP-7501 | R3 |
| WP-7603 | **領収証・調剤明細書**(RCP-001〜004/006)。採番(RCP-002、tenant+pharmacy+年度で単調)、再発行・取消(RCP-003、新 instance + 取消監査)、明細書の記載項目(RCP-004)。監査は MOD-008 **既存** `receipt.issued/reissued/cancelled/voided`。WP-7503 の report_instances 基盤を共有 | WP-7602、WP-7503 | R3 |
| WP-7604 | **会計 UI**(`/checkout` シェルの実体化。既存 `checkout-context` は受付 queue 読取のみ)。未収・一部入金・返金の状態を `ar_status` バッジで区別、金額は ledger 由来のみ(UI 側計算禁止) | WP-7602/7603 | R2 |
| WP-7605 | **公費按分(CAL-R-025)+ PMH 境界**(WP-6311【REF】)。evidence 発行【HG】【EXT】。解除まで公費併用受付の算定は `PENDING_PMH_REVERIFY` / `MANUAL_REVIEW_REQUIRED` を付与し `isClaimable=false` | 【HG】【EXT】 | R4 |

#### R6 — レセプト請求・月次締め(CLM-001 の工程分解)

| WP | 目的 / 内容 | 前提 / gate | risk |
|---|---|---|---|
| WP-7701 | **レセプト中間モデル生成**(CLM-001 工程 2)。算定 trace + coverage + patient + dispensing から請求月・保険者単位の `claim_drafts`(projection、ARC-005/006 に従い再投影可能、migration 000026)。**電算 file 生成(工程 3)は RB-001 解除まで `BLOCKED_REGULATORY_REVIEW` を API/UI に明示**し、生成 route を置かない | WP-7501、WP-7602 | R3 |
| WP-7702 | **請求前点検**(工程 6)。点検項目: 入力漏れ(原本 metadata・Rp 解決)、算定根拠(trace の evidenceRefs)、資格未確認(`isClaimable` + WP-7204 状態)、公費(WP-7605 解除前は保留)、薬歴未記載(WP-6401【REF】接続後)、レセプト形式(工程 4 解除後)。結果は `claim_check_results`(append-only)、監査は MOD-008 **既存** `claim.checked`。`/claim-check` シェルの実体化 | WP-7701 | R2 |
| WP-7703 | **月次締め = claim snapshot / lock**(ARC-007、工程 7/8)。`allowsClaimFinalization(mode)` NORMAL のみ、RECOVERY_SYNC 未完了ゼロ、締め操作者と承認者の分離【要確認 DOM-004: 単独薬局での二者承認の現実性 → human 判断】、ロック後の変更禁止(DB 制約 + route)。監査は MOD-008 **既存** `claim.closed` / `claim.locked`。`/monthly-closing` シェルの実体化。締め中も受付・調剤・会計を止めない(SPEC §13) | WP-7702、【HG: 二者承認方針】 | R3 |
| WP-7704 | **返戻・再請求管理**(工程 10)。返戻受領登録、新版レセプト生成(元データ改変禁止)、点検再通過。状態細分は審査支払機関運用確認後【要確認】 | WP-7703、【EXT】 | R3 |
| WP-7705 | **電子レセプト生成 + 記録条件検証**(工程 3/4)。RB-001 解除(記録条件仕様の版確認 + evidence + `electronic_receipt_design` APPROVED)後のみ。CLM-002 reading notes を起点 | 【HG】【EXT: RB-001】 | R4 |

#### R7 — マスター運用・BCP・基盤

| WP | 目的 / 内容 | 前提 / gate | risk |
|---|---|---|---|
| WP-7801 | **MST-001 24 段 pipeline の最小実装**(取得 → hash → 形式/文字コード/schema → 差分 → 有効日/廃止日/経過措置 → 参照整合 → 回帰 → 影響レポート → staging → 承認 → 反映 → rollback point → 監査)。実データは source registry 登録 + RB-009 解除後。WP-7301 の `master_versions` を配布状態管理に使い、監査は MOD-008 **既存** `master.approved/applied/rolled_back` | WP-7301、【EXT】【HG: 承認・本番反映】 | R3 |
| WP-7802 | **システムモード検知 backend**(WP-6507/6312【REF】)。NORMAL 固定を ARC-001 の 5 モードへ。外部公的システム疎通・Cloud Core 疎通の probe、LOCAL_ONLY での `PROVISIONAL_CALCULATION` 付与、RECOVERY_SYNC の `CONFLICT_REQUIRES_HUMAN_REVIEW`。`/sync-status` `mode-overview` を実データへ | WP-7204(資格保留)、WP-7501(仮算定) | R3 |
| WP-7803 | **PHI-safe structured logging**(C-018/019【REF】、BUG-4265)。SEC 系 SSOT で出力境界(identifier のみ・PHI sentinel test)を確定後、Fastify logger 有効化 + request id + PHI-free error 相関。OPS-009 の最小実装 | 【SSOT】【HG security/privacy】 | R2 |
| WP-7804 | **backup / restore 演習 runbook + restore test**。対象(PostgreSQL 論理/物理)、RPO/RTO(OPS-005)、restore 後の audit chain 再検証(SEC-007)、migration 状態の整合確認。実行は【HG】 | 【HG】 | R3 |
| WP-7805 | 監査 bounded chain verification(C-088)/ retention-complete export(C-090)/ 自己増殖(C-089)【REF】 | 【SSOT】【HG】 | R3 |
| WP-7806 | **在庫 read-only projection API 口**(PRD-005 #10、WP-6403【REF】)。調剤記録(WP-7404)由来の払出 projection のみ。書込みなし | WP-7404 | R1 |

### 18.4 段階 exit criteria(R0〜R7)

| 段階 | 主 WP | exit(全件 synthetic。production/pilot 判断は含まない) |
|---|---|---|
| **R0** | 7101〜7104(7105 は決定待ち) | 認証境界 SSOT が PROPOSED、migration runbook が確定、outbox runner が CI で at-least-once 証明、部分 journey E2E が CI で決定的 PASS |
| **R1** | 7201〜7205 | 受付が WAITING→IN_PROGRESS→COMPLETED/CANCELLED を API/Web で遷移し監査 1:1、新規患者を UI から登録して受付できる、保険・公費履歴と券面資格確認が snapshot として受付に紐づく、未確認受付が「確定算定可」と表示されない |
| **R2** | 7301〜7304 | synthetic 医薬品/用法マスターに対し Rp 構造化 draft が保存・CAS・hash 検証を通り、未解決行を含む draft が「確認可能」と表示されない |
| **R3** | 7401〜7406 | Milestone 3 exit(`DEVELOPMENT_POLICY.md §4`)全項目: 仮/確定の状態分離、資格境界必須、訂正=新版、全遷移に version/audit/outbox evidence、North Star E2E PASS、算定/請求/JAHIS/PH-OS の fail-closed 可視化、human pharmacist review packet 提出 |
| **R4** | 7501〜7505 | 確定調剤 → trace 永続 → API-007 read → Web 表示が evidence 済みルール限定で貫通、金額非表示、調剤録 instance が hash 付きで出力・改変検知 |
| **R5** | 7601〜7605 | CAL-R-024 evidence APPROVED、ledger が append-only で一部入金・返金を表現、領収証/明細書が採番・再発行・取消の履歴を持つ |
| **R6** | 7701〜7704(7705 は RB-001) | 中間モデル・点検・月次 snapshot/lock が NORMAL 限定で動作、電算生成は明示 BLOCKED 表示 |
| **R7** | 7801〜7806 | 実マスター取込 pipeline が承認 flow を持つ、5 モード検知、PHI-safe log、restore 演習記録 |

R0〜R2 は互いに独立性が高く並行起案できるが、**実装は WIP=1**。R3 は R1(7201/7205)と R2(7302)に依存し、
R4 以降は R3 の確定調剤なしに開始できない(算定・帳票・会計・請求は確定事実の消費者)。R7 の 7803/7804 は
任意時点で差し込める(pilot 前には必須)。

### 18.5 human gate・SSOT 改版・外部手続きの集約(本節が新たに要求するもの)

- **SSOT 改版(PRC-007)、実装を直接 unlock するもの(documentation-only work として `DEVELOPMENT_POLICY.md §8`
  が許容する範囲):** API-006 遷移 route + MOD-006 `RCV-0004` + MOD-008 `reception.started/completed`(7201)、
  C-028 Patient create 一意性 + API-001 write 改版 + MOD-008 `patient.created/updated`(7202)、coverage 契約(7203)、
  eligibility snapshot 契約(7204)、DOM-002 §4.1 拡張 — 原本 metadata と Rp 構造化(7205/7302)、dispensing 契約(7404)、
  MST-001 実装分解(7301)、PRD-001 前回 Do(7304)、MOD-008 種別追加 `prescription.confirmed/finalized/amended`
  (7402/7403)、API-012 / MOD-009 Event Catalog 追加 `prescription.finalized` / `dispense.confirmed`(7402/7404)。
  **既存種別で足りるもの(改版不要):** `patient.created/updated`、`insurance.viewed/updated`、`eligibility.*`、
  `dispensing.confirmed`、`calculation.finalized`、`claim.checked/closed/locked`、`receipt.*`、`master.*`。
- **human gate(security/privacy):** 認証済み context 注入境界と test-auth adapter(7101)、PHI-safe logging 境界(7803)、
  restore 演習(7804)、egress 統制(production 配送、既登録)。
- **human gate(medical safety):** 薬剤師 actor/qualification 境界(7401)、pharmacist safety/UX review(7406)、
  帳票 legal review(7503)、月次締め二者承認方針(7703)。
- **human gate(DDL/運用):** migration 000001〜000013 適用(7102)、以降の 000014〜000026 も各 WP で source landing と
  環境適用を分離。
- **human gate(診療報酬)+ 外部手続き:** RB-008 行単位解除(7501)、CAL-R-024(7601)、CAL-R-025(7605)、RB-001(7705)、
  RB-009 + 実マスター(7801)、bound 決定(7105)。
- **本節が解除しないもの:** REG-004 RB-001〜RB-010 全件、HPKI、FHIR/JAHIS conformance 主張、production/deploy/pilot、
  §11 release blockers。いずれも既登録 gate のまま。

### 18.6 READY 昇格候補(slot は消費しない。順序は推奨)

現行 queue は CURRENT=0 / READY=0。2026-09-17 に起案 batch が direct human approval で
**APPROVED 昇格済み**(`ee4f49a`)、**WP-7201 は `f96e236` で着地済み**(受付状態遷移 API +
Web 行操作 + migration 000014 作成)、**WP-7204 は着地済み**(資格確認 snapshot route +
queue entry `eligibility` + Web 切替。migration 000014 のローカル適用と push は
2026-09-18 のユーザ許可で実施済み)、**WP-7205 も着地済み**(処方箋原本 metadata +
migration 000017 + Web 原本情報入力と期限警告)。R1 残り WP-7202(R3・
human pre-review record 必須)/ WP-7203(R3・同)は SSOT
APPROVED 済みだが R3 のため実装は human pre-review record 待ち。2026-09-16 のユーザ指示「Plans.md 内のタスクが全て実装完了と
みなせるまでループ」により候補 1・2 を実装し、それぞれ `ea021f5`(WP-7104)・`c0d98b9`(WP-7103)へ
着地済みである。候補 3 の SSOT 起案 batch は 2026-09-17 に `f3dcf31` で **PROPOSED 起案として着地**
(API-006 0.3.0 / API-001 0.3.0 / API-019・API-020 新規 / DOM-002 0.1.4 / MOD-006 0.1.3 /
MOD-008 0.2.7 / IDX-001 0.4.63・総数 187)。全件 PROPOSED であり APPROVED 昇格・実装は
independent review + human approval まで行わない。残る候補は次のとおり。

| 順 | 候補 | 種別 | 根拠 |
|---|---|---|---|
| ~~1~~ | ~~WP-7104 North Star 部分 E2E harness~~ | 着地済み `ea021f5` | API 層 3 tests + browser 層実 UI journey PASS |
| ~~2~~ | ~~WP-7103 outbox 配送 runner(local/CI sink 限定)~~ | 着地済み `c0d98b9`+`3110ecb`+`1cd9fb1` | runner + config(既定 off)+ integration 10 tests(PG 5 + DB-less 5)。production egress は BLOCKED_SECURITY_REVIEW 維持 |
| ~~3~~ | ~~SSOT 起案 batch(PLAN_ONLY)~~ | 起案着地済み `f3dcf31` | 7 文書 PROPOSED(新規 2 + 改版 5)。承認は human gate のまま |
| 4 | **human 決定待ち** — 7105(bound)、7102(migration 適用)、7101(認証境界)、起案 batch の承認 | 決定 | 決定なしに実装しない |

**ループ終端(2026-09-17 時点):** gate なしで実装可能な WP は残っていない。§18 の残り全 WP は
(a) 上記 PROPOSED SSOT の APPROVED 昇格待ち、(b) 明示【HG】(security / DDL / medical safety /
診療報酬 / legal)、(c)【EXT】(JAHIS・オン資・電子処方箋・診療報酬公式資料等の外部仕様未入手)、
(d) PRC-005 の R3+ 独立 review 要件(maker≠checker、root 自己検証で代替不可)のいずれかで
停止している。§16 Track A の未着地 WP(6005 webhook delivery / 6006 partner registry / 6009 sandbox /
6010 contract test 等)は SSOT 上は起票可能な面があるが、partner 向け external action 面であり
PRC-005 §2 の human gate(external action・security 制約)と §18 の工程順序(R7/Track A は core
journey 完了後)の双方に該当するため、本ループの対象外と判断した。

**明示的に READY へ推奨しないもの:** 7202 以降の全実装 WP(根拠 SSOT が PROPOSED 止まり)、R4〜R6(確定調剤が存在しない)、
外部 IF 系(仕様未入手)。「関連コードが既に存在する」ことは READY の根拠にならない(§18.1 の眠っている資産は
配線先の契約 SSOT が無いため)。

**集計:** R0=5 / R1=5 / R2=4 / R3=6 / R4=5 / R5=5 / R6=5 / R7=6 — 合計 41 WP(うち既登録 C-xxx/WP-6xxx の
詳細化【REF】11 件、新規 30 件)。本節の追加は planning record の変更のみであり、実装・検証実行・SSOT 改版・
migration 適用・gate 解除・commit 以外の Git 操作をいずれも行っていない。
