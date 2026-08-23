# Plans.md — Active execution board

> **AUTHORITATIVE ACTIVE BOARD (2026-08-01):** `DEVELOPMENT_POLICY.md`
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
| Branch | `main` |
| Local HEAD | landing record 直前 `491aea5033ad1c67b07abee96ddcf40603e1385b`。本record commit後の最終値はGitを正本とする |
| Upstream divergence | fetch後のrecord直前 `origin/main...HEAD = 0 behind / 16 ahead`。2026-08-23 direct user instructionでpush要求済み |
| Working tree | landing recordの `Plans.md` / `State.md` exact2のみ。final record commit後はcleanを要求 |
| Last update | 2026-08-23 JST(§16 情報連携主軸ギャップ分析・実装計画を inventory 追加。product WIP/READYは不変更) |
| Active Goal | grouped commit/push finalization。product queueはWIP 0のまま |
| Current critical path | Milestone 1 exit の残余 — WP-4050 の独立レビュー(codex lane 復帰 2026-08-05) |
| Main blocker | WP-4050 の独立レビュー(2026-08-05 待ち)と `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` 残余 (b) の DDL human gate |
| Runtime verification | Node 26.6.0でfrozen install、typecheck、1,877 tests(skip 0)、script harness、build 11/11、OpenAPI、secrets、deps、SBOM 249、boundaries、calculation purity、SSOT index 173、actionlint、diff check PASS |
| Next scan cursor | diff-first from `f91ae78`; reset on new High/Medium finding or reprioritization |

実装証跡はGit diff/commitとCIを正本とし、本書はindexにとどめる。record直前の
outgoing stackはbase `4f4ba68`、HEAD `491aea5`、16 commits、37 paths、diff SHA-256
`611b8082d7268bed787d9afa08b73a4d434457ad22b1b56955bdad1be63283c8`。pushはcurrent
user requestで許可されたが、最終frozen review PASSとremote fast-forward再確認後だけ
実行する。deploy、migration、production変更、release acceptanceは許可されていない。

## 2. Product and Architecture Guardrails

- 6–12 week North Star: synthetic patient search/selection → paper reception →
  manual prescription draft → pharmacist confirmation → immutable audit evidence.
- Current reachable runtime is limited to health/whoami, patient search/get,
  paper reception queue/create, and audit read. Prescription/dispensing,
  calculation consumer, billing, schedule, visit, report, notification, and
  PH-OS synchronization are not connected.
- Current persistent authorities are PostgreSQL `patients`,
  `reception_entries`, and `audit_events`.
- Patient and MedicationRequest must have one writer. No dual write, hidden
  multi-master, automatic fallback, or conformance claim is permitted.
- Tenant/pharmacy/actor/scope must come from authenticated trusted context.
  Production authentication, qualification, runtime-role, and RLS proof remain
  release gates; development headers are not production authority.
- Reception/audit/outbox atomicity, clinical version history, immutable audit,
  evidence-backed calculation, and PHI-free logs/URLs fail closed.

## 3. Active Queue

### WIP — exactly one

**現在 WIP は 0 件である。** 直前まで本節に並んでいた5項目はいずれも landing 済み、
または human gate 待ちであり、claim 対象ではない。次の claim は下の Human gates が
解除された時点で `DEVELOPMENT_POLICY.md §8` の work-selection に従って選ぶ。
WIP を 0 のまま放置することと、gate 待ちの項目を WIP に置き続けることは別である。
後者は §0 の「CURRENT は exactly one」に反するため行わない。

| 直前まで WIP にあった項目 | 現在の扱い | 参照 |
|---|---|---|
| WP-4250 | FINALIZED / APPROVED(SSOT 改版のみ)。local commit `89275d2` | 下の決定記録 |
| WP-4258 | FINALIZED / APPROVED(2026-08-01)。改版 `1dedf27`、APPROVED 化 `1ec57d5` | Implemented / Landing State |
| WP-4257 | COMMITTED_LOCAL `a911a99` / LANDED | Implemented / Landing State |
| WP-4256 | COMMITTED_LOCAL `ab63db6` / LANDED | Implemented / Landing State |
| `BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` 残余 (b) | 実行仕様のみ確定。DDL と実データ参照を伴うため human gate | Human gates |

#### WP-4250 — Bounded Patient + MedicationRequest authority decision(決定記録)

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
現時点で claim 可能な item がない。WP-4050 は実装 landing 済みで独立レビュー待ち、
WP-4251 / WP-4252 は label であって READY ではない。§8 Prioritized Backlog の
BUG 群は READY へ昇格しうる候補であり、昇格前は claim しない。

## 4. Implemented / Landing State — nonclaimable

本節は landing 済みで claim 対象外の項目を保持する。実装証跡は Git diff と commit
であり、本節はその index にとどめる(`DEVELOPMENT_POLICY.md §8 Record policy`)。

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

- **Status:** COMMITTED_LOCAL / MACHINE_VALIDATED / INDEPENDENT_REVIEW_PENDING /
  PUSH_NOT_REQUESTED(2026-07-31)
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
  独立レビューは subagent 報告経路劣化により未取得
  (`independence_not_satisfied` ×2 記録)— codex lane 復帰(2026-08-05)後に実施。
- **Policy alignment:** Milestone 1 data-integrity exit and prerequisite for every later clinical write.
- **Outcome:** a successful reception can never exist without exactly one durable `reception.created` audit intent and required outbox intent; an ambiguous retry converges.
- **Evidence:** `POST /reception`, PostgreSQL reception repository, and audit repository currently commit in separate transactions; retry of the surviving reception does not repair the missing audit.
- **Scope:** API command/unit-of-work boundary, transaction-bound reception/audit/outbox persistence, in-memory semantic parity, focused unit/integration tests, and an explicit orphan-reconciliation result. A forward migration may be designed but not applied without separate approval.
- **Invariant:** trusted tenant/pharmacy/actor context, same-key/same-patient idempotency, mismatched-patient conflict, PHI-free target reference, append-only audit chain, no invented actor/time.
- **Dependency:** WP-4253 green baseline; R3 human scope approval; approved transaction/outbox/repair semantics.
- **Contract:** one command result distinguishes created, existing-complete, conflict, and legacy-orphan/reconciliation-required.
- **Migration:** add only the approved forward schema; do not backfill fictitious historical facts. Production application is separately human-gated.
- **Acceptance:** injected audit/outbox failure leaves reception count 0; success leaves reception/audit/outbox count 1 each; response loss, same-key retry, restart, and concurrent retry remain 1 each; different patient with same key returns 409 with no writes; orphan handling is explicit.
- **Downstream validation:** focused API/repository/audit tests, PostgreSQL integration, then full current gates.
- **Falsification:** any partial durable write, duplicate event, fabricated provenance, cross-tenant visibility, or rollback requiring production DML fails the design.
- **Rollback:** revert the command-boundary implementation and unapplied migration; do not run data rollback in this slice.
- **Human gate:** explicit R3 pre-implementation review by human product/safety authority; migration apply and production write need separate approval.
- **Exact first command:** `rg -n "POST /reception|receptionRepository\\.create|auditRepository\\.record|BEGIN|COMMIT|Outbox|idempotency" apps/api/src/server.ts apps/api/src/db apps/api/src/reception-repository.ts apps/api/src/audit-repository.ts docs/api/reception_queue_contract.md docs/domain/domain_model.md`

## 5. Human gates

未解除の human gate は次のとおり。いずれも人間の明示承認まで着手しない。

- **WP-4050 R3 implementation scope と repair semantics。** 実装自体は
  `42ef15c`+`bf17cea` へ COMMITTED_LOCAL だが、独立レビューが未取得であり
  (`independence_not_satisfied` ×2)、codex lane 復帰(2026-08-05)後の
  再レビューが残存 gate である。
- **`BLOCKED_KEY_CANONICAL_FORM_ENFORCEMENT` 残余 (b)。** 実行仕様は下に確定済み。
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
| WP-5101 | ドラフト 13〜17号+3-lane fresh-context checker 訂正を `3da2466` で着地。checker verdict は REQUEST_CHANGES→訂正適用済み。再チェックと human 内容判断(10 論点)は未取得 — 各ドラフト未決欄と session 記録参照 |
| WP-4250 | FINALIZED / APPROVED at `89275d2`(2026-08-01)。承認範囲は SSOT 改版のみで、登録済み blocker は全件据え置き |
| WP-4256 / WP-4257 / WP-4258 | COMMITTED_LOCAL at `ab63db6` / `a911a99` / `1dedf27`。WP-4258 は 2026-08-01 の direct human approval で APPROVED 化済み(DB-005 / ARC-008 0.1.4、IDX-001 0.4.49) |
| BUG-4263 | DECIDED(案①)/ COMMITTED_LOCAL at `bf0b402`。`check:secrets` が exit 0 へ復帰 |
| BUG-4260 / BUG-4262 / BUG-4261 | COMMITTED_LOCAL at `fe03cf0` / `fe03cf0` / `6813750`(2026-08-01 バグ走査)。独立レビュー未取得 |
| WP-0042 / WP-7001 / broad FHIR-AWS work | bounded by current WP-4250; remainder NOT_NOW |
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
  user instruction「バグ探索・修復ミッション」に基づく実装。独立レビュー未取得)
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

- **Status:** COMMITTED_LOCAL / MACHINE_VALIDATED / INDEPENDENT_REVIEW_PENDING
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

- **Status:** COMMITTED_LOCAL / MACHINE_VALIDATED / INDEPENDENT_REVIEW_PENDING
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
  BUG-4260 と同一スライス・同一コミット。独立レビュー未取得)
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
- **Status:** COMMITTED_LOCAL / MACHINE_VALIDATED。独立レビュー未取得。
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
- **問題:** `scripts/check-secrets.mjs:13` は `rootDir = process.cwd()` を走査根と
  し、`.gitignore` / `.git/info/exclude` を一切参照しない。したがって開発者ローカルの
  ツール成果物(`.codegraph` symlink、`.claude/`、`.omc/`、`.harness-mem/`、`.omo/` 等)
  が走査対象・scope 判定対象に含まれる。symlink は 1 件でもゲート全体を止める。
- **なぜ自動修正しないか:** スコープを「リポジトリ内容」へ寄せると、現在走査対象で
  ある gitignore 済みファイル(特に `.env`、`isTextFile` が明示的に対象化している)が
  カバレッジから外れる。これは security posture の変更であり、`AGENTS.md`
  「auth/security/privacy 制約の緩和は人間の明示承認なしに実行・自己承認しない」に
  該当する。また既存 fixture は非 git の一時ディレクトリで実行されるため、
  git 由来のスコープ判定を入れると本番経路が fixture で未検証になる。
- **決定が必要な論点:** (a) 走査スコープの定義(リポジトリ内容 / cwd 配下 /
  両方の和)、(b) gitignore 済み `.env` を走査対象に残すか、(c) 非 git ルートでの
  フォールバック挙動と、その経路の fixture 追加。
- **暫定回避:** 開発者は当該 symlink を退避するか、決定後の実装を待つ。
- **Reason for prioritization:** P2 — BUG-4261 の上流原因。実害はローカルゲートに
  限定されるが、決定なしに触れてはならない領域。

#### WP-9008 — Align the reachable API error contract with runtime behavior

- **Status:** COMMITTED_LOCAL / MACHINE_VALIDATED / INDEPENDENT_REVIEW_PENDING
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

### UIUX — 一枚盤面刷新パイプライン(WP-5101〜5124・全件 GATED / NOT_READY)

> **来歴**: direct user instruction 2026-07-31(丁「一枚盤面」採用と詳細タスク化の指示)。
> 起草 lane は Claude(fable5)。Document Contract の sole editor 規律に対する例外は
> この direct user instruction を根拠とし、本グループ以外の記載に触れていない。
> **queue 規律**: 本グループは READY slot を消費しない。WP-4250 の CURRENT と
> WIP=1 / READY≤2 を変更せず、各 Gate 成立まで全件 claim 不可。
> **設計正本(non-SSOT ドラフト)**: `docs/ui-ux-refresh/13〜17号`(未コミット)。
> 昇格前は実装根拠にならない(fail-closed)。

#### Stage 0 — SSOT 整備(PLAN_ONLY・実装なし)

##### WP-5101 — 13〜17号ドラフトの独立レビューと確定

- **Status:** GATED / NOT_READY(fresh-context checker 未実施)
- **Gate:** fresh-context independent checker(fable5 セルフレビュー 17号は
  `independence_not_satisfied` — approval に数えない)+ human product 承認
- **Scope:** 13号(UIX-008 候補)/14号(丁決定+§7 ビュー・ロック)/15号(workflow-stage)/
  16号(主操作者調査)/17号(新要件 D-1..D-4・所見 AF/SF)の整合・網羅レビューと確定
- **Acceptance:** 全 findings が解消または記録済み。D-2 の2段分離、AF-2 の NSIPS 凍結整合、
  SF-1 の Phase A/B 分離が checker で再確認されている
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
- **Gate:** WP-5101 + WP-5102 APPROVED + exact11 landing(`docs/ssot_index.md`
  dirty ownership 解消)
- **Scope:** 15号を `docs/domain/` へ移設、DOM 系採番、frontmatter 正式化、index 登録。
  §9 未決(PATIENT_IDENTIFICATION 完了条件、CANCELLED 表示、一人薬剤師兼任)の解消を含む
- **Acceptance:** PRC-007 完了。`pnpm check:ssot-index` PASS。UIX-006 工程順との一致が
  レビュー記録に残る
- **Stop:** APPROVED 前の shared-kernel 実装禁止

##### WP-5104 — UIX-008(UI共通コンポーネントシステム)昇格

- **Status:** GATED / NOT_READY
- **Gate:** WP-5101 + exact11 landing
- **Scope:** 13号を `docs/uiux/ui_component_system.md` へ移設、UIX-008 採番確定、index 登録。
  L0〜L4 層構造、台帳20点+予約6点(WorkflowSheet/StageRow・ReceptionQueueRail・AlertRail・
  EvidenceDrawer・BoardViewSwitcher・FinalizeAndRegisterAction)、禁止8項、Phase A/B 分離
- **Acceptance:** PRC-007 完了。PLAN-UIUX-001 との参照整合
- **Stop:** 台帳外コンポーネントの追加は本 SSOT の改版なしに不可

##### WP-5105 — UIX-006 / UIX-007 / PLAN-UIUX-001 改版(3盤面写像)

- **Status:** GATED / SSOT_UPDATE_REQUIRED / NOT_READY
- **Gate:** WP-5101〜5104 + PLAN-UIUX-001 現 dirty ownership(WP-425x 系)解消
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

#### Stage 1 — 実装基盤(前提: Stage 0 APPROVED + apps/web dirty slice(WP-4253/4254/4255)landing)

##### WP-5111 — L0 トークンテーマ基盤(Phase A・挙動不変)

- **Status:** GATED / NOT_READY
- **Gate:** WP-5104 + apps/web dirty landing
- **Scope:** `globals.css` トークン再編(甲乙丙テーマ差し替え可能な構造+暫定クローム)。
  DOM 構造・文言・contract 不変
- **Acceptance:** 既存 web テスト全緑(挙動不変の証跡 — 13号 Phase A)。typecheck/lint/build PASS。
  UIX-003 予算内(CSS サイズ・CLS 非悪化)
- **Stop:** L1 以上へ変更が波及したら Phase A を放棄し WP-5113 系へ再分類(全緑主張を捨てる)

##### WP-5112 — workflow-stage.ts 実装

- **Status:** GATED / NOT_READY
- **Gate:** WP-5103 APPROVED
- **Scope:** `packages/shared-kernel/src/workflow-stage.ts`(enum 9工程+STAGE_PROGRESSES 5値+
  `deriveStageProgress` 純関数)、Visual Status Registry 2軸(workflow-stage /
  stage-progress)、網羅テスト(15号 §7: 順序一致・fail-closed UNAVAILABLE・
  BLOCKED reason 必須・モード連動)
- **Acceptance:** 全 stage×progress 導出テスト PASS。契約未承認ドメイン入力 undefined →
  必ず UNAVAILABLE。既存 registry テスト流儀での label/tone/shape/ARIA 網羅
- **Stop:** DOM-004 状態の shared-kernel 登録は使用実装 WP 着地時のみ(先行登録禁止)

##### WP-5113 — 調剤盤シェル(3カラム+ロール別ビュー)【U4】

- **Status:** GATED / NOT_READY
- **Gate:** WP-5105 + WP-5112 + apps/web dirty landing
- **Scope:** 調剤盤 3カラム(ReceptionQueueRail / 患者フォーカスフレーム+WorkflowSheet 骨格 /
  AlertRail)、BoardViewSwitcher(投影のみ・権限非変更 — P-14)、
  兼任(一人薬剤師)統合ビュー、連続受付1操作復帰
- **Acceptance:** ロール別既定展開が 14号 §7.1 通り。畳んだ工程行でも状態 chip+サマリ常時可視
  (P-01 規律の型・テスト強制 = 14号 R-1 の解)。RTL テストで loading/empty/error/403 状態網羅
- **Stop:** U4 — 実装後に medical_safety / privacy / accessibility レビュー+human 承認必須。
  受付・患者検索の既存2実装フローを壊す変更は段階分離

##### WP-5114 — WorkflowSheet / WorkflowStageRow + EvidenceDrawer【U4】

- **Status:** GATED / NOT_READY
- **Gate:** WP-5113
- **Scope:** 工程アコーディオン(展開部=入力フォームのみを型で強制)、
  仮=点線/確定=実線の形状文法(P-05/06/07)、EvidenceDrawer(trace・履歴・監査メタ —
  P-13 一手)、外部登録待ちは PENDING_EXTERNAL_SYNC chip 併置(15号 SF-3 方針)
- **Acceptance:** 「安全情報を展開部に置けない」型テスト。fixture trace viewer(SCR-012)の
  ドロワー昇格。確定演出は版一致時のみ発火のテスト
- **Stop:** 工程行から契約外 API を呼ばない(API-002)

##### WP-5115 — 並行作業ロック(患者×工程 lease)

- **Status:** GATED / NOT_READY(設計課題 14号 §7.3 未解消)
- **Gate:** WP-5113 + §7.3 解消(lease/timeout・LOCAL_ONLY 時挙動の ARC 突合・
  差し戻し遷移の DOM-004 突合)
- **Scope:** 患者×工程(enum 工程粒度 — 17号 SF-4)の単一編集所有、
  「↻ 入力中 — 操作者(端末)」常時表示、stale 確定の 412/conflict(最終防衛は
  DOM-004 遷移ガード)、競合の人間返し(自動補正禁止)
- **Acceptance:** 同時編集・lease 失効・stale 署名失敗・競合の各テスト。無言グレーアウト非存在
- **Stop:** UI ロックを防衛と扱わない(API 側検証なしの排他は不可)

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
  WP-5102 APPROVED + HPKI 署名位置づけ確定(legal_compliance_matrix #7)
- **Scope:** 薬剤師最終確定(ローカル不可逆・確認者/日時/対象版記録・二段階確認 P-11)→
  調剤結果登録ジョブ outbox 投入(PENDING_EXTERNAL_SYNC・再試行・DLQ→SCR-025)。
  段2失敗は段1を巻き戻さない/段2単独成功は存在しない順序保証
- **Acceptance:** LOCAL_ONLY 中のキュー蓄積、登録失敗の可視化、
  「確定●」「登録↻/●」chip 分離表示(単一成功表現の禁止 — 禁止3項/H-03)の各テスト
- **Stop:** 医療安全レビュー+薬剤師 human gate なしに確定機能を有効化しない

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
- **Gate:** WP-5113 + 薬剤師レビュー(密度既定・高齢者向け拡大の対象画面 — UIX-001 §6)
- **Scope:** 3カラム縮退(キュー・右レールのドロワー化、警告 chip のヘッダー残置)、
  密度段階(標準/圧縮)、キーボード完結(Tab/ショートカット — 16号 F-4)
- **Acceptance:** 縮退時も警告・患者文脈・モードが常時可視(P-01/03/09)。
  reduced-motion / forced-colors 対応
- **Stop:** 縮退を理由に安全情報を畳まない

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
  では gate 検証していない。** push・deploy・production 変更なし。独立レビュー未取得。

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
| 実装 | Active Batch = BUG-4260 / BUG-4261 / BUG-4262。BUG-4260 と BUG-4262 は `fe03cf0`、BUG-4261 は `6813750` へ COMMITTED_LOCAL。回帰テスト付き、独立レビュー未取得、push 未要求 |
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
| C-001 | WP-4050 独立レビュー packet の再凍結(base SHA・diff hash・acceptance・検証結果。対象 `42ef15c`+`bf17cea`) | codex lane 復帰(2026-08-05) |
| C-002 | WP-4050 独立レビュー実施と finding 解消(`independence_not_satisfied` ×2 の解消記録)【REG: §5】 | C-001 |
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

全件【GATED】: Milestone 2 exit まで claim 不可。synthetic data 限定。

| # | 項目 | 前提 / Gate |
|---|---|---|
| C-056 | 紙処方 draft のドメインモデル/状態 SSOT 起案(provisional と pharmacist-confirmed の分離)【SSOT】 | C-026 |
| C-057 | prescription draft の contract-first 契約設計(generated artifact / consumer 同期) | C-056 |
| C-058 | prescription draft schema / forward migration 設計(適用は別 gate)【HG: migration apply】 | C-056 |
| C-059 | reception → prescription draft の linkage 実装(WP-4050 コマンド境界と整合) | C-057 |
| C-060 | draft 入力 API/Web 実装(synthetic) | C-057 |
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
| C-070 | WP-5104 — UIX-008 昇格【SSOT】 | C-067 |
| C-071 | WP-5105 — UIX-006/007/PLAN-UIUX-001 改版(3盤面写像)【SSOT】 | C-069/C-070 |
| C-072 | WP-5106 — 電子薬歴連携手段の経営判断と連携契約 SSOT【HG: 経営判断】【SSOT】 | — |
| C-073 | WP-5111 — L0 トークンテーマ基盤(Phase A・挙動不変) | C-070 |
| C-074 | WP-5112 — workflow-stage.ts 実装 | C-069 |
| C-075 | WP-5113 — 調剤盤シェル【U4】【HG: 実装後レビュー】 | C-071/C-074 |
| C-076 | WP-5114 — WorkflowSheet / EvidenceDrawer【U4】 | C-075 |
| C-077 | WP-5115 前提 — 14号 §7.3 設計課題の解消(lease/timeout・LOCAL_ONLY・差し戻し遷移の ARC/DOM 突合) | C-075 |
| C-078 | WP-5115 — 並行作業ロック実装 | C-077 |
| C-079 | WP-5121 — アカウント種別制御【HG: security release gate】 | C-083〜C-085 |
| C-080 | WP-5122 — FinalizeAndRegisterAction【U4】【HG: RB-003 + 医療安全】 | C-068 |
| C-081 | WP-5123 — 電子薬歴連携送信実装 | C-072 |
| C-082 | WP-5124 — タブレット縮退+密度段階【HG: 薬剤師レビュー】 | C-075 |

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
| C-100 | `DEVELOPMENT_POLICY.md §11` Exact implementation sequence の現状反映改版(WP-4250 FINALIZED / WP-4258 APPROVED / WP-4050 COMMITTED_LOCAL を反映) | C-002 |

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
  改版提案として記録する。改版は user の明示決定まで `POLICY_AMENDMENT_PENDING`。
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
| WP-6006 | Partner Registry + Scope 管理の persistence/API(tenant/pharmacy/partner_id、scope、PHI classification、data minimization)。MOD-011 内部 scope との対応表 | WP-6001 |
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
