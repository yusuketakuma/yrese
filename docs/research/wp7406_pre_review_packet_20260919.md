# WP-7406 pre-review packet — fail-closed 可視化総点検 + 薬剤師 human safety/UX review packet

- 作成: 2026-09-19(WP-7405 着地 `c2b9d97` 直後の前準備)
- 正本: Plans.md WP-7406 行(C-065/C-066、前提 WP-7405、【HG】)
- base SHA: `c2b9d97`(本 packet 作成時点の HEAD)
- task mode: PLAN_ONLY で起案後、2026-09-19 の direct user instruction
  「進んでいい」により D-1〜D-5 を承認済みとして点検実施 + P-1 文言修正を
  本 diff に含める(approval_basis: direct user instruction)。
  HG 本体(薬剤師レビュー実施・pilot 判断)は引き続き fail-closed。

## 1. 目的

WP-7406 は 2 つの成果物を持つ:

1. **C-065 fail-closed 可視化総点検** — 算定・請求・帳票・連携の各画面が
   「未実施」「未接続」「取得不能」を成功・正常・0 件に見せていないことの点検表。
2. **C-066 薬剤師 human safety/UX review packet** — pilot 判断前に薬剤師
   reviewer が実画面・実行程を評価するための入力資料【HG】。

本 packet は前準備として「点検対象の inventory」「点検観点」「予備調査で
見つかった候補 findings」「human review 入力の構成」を確定する。
HG 本体(薬剤師レビュー実施・pilot 判断)は人間の作業であり fail-closed。

## 2. 点検対象 inventory(2026-09-19 コード調査)

算定・請求・帳票・連携の「未実施を成功に見せない」対象画面。
既存の fail-closed 機構は `status/visual-status-registry.ts`(Executable SSOT)、
`operational-prototype-truthfulness.test.tsx`(4 画面の gate/safetyCopy 固定)、
各画面の `「—」は0円/0件を意味しません` 注記。

| 領域 | 画面 / component | 現状の fail-closed 表現 | 点検論点 |
|---|---|---|---|
| 算定 | `checkout/page.tsx`・`checkout-context.tsx` | 「算定・会計API未接続」pill、`「—」は0円・支払完了・請求不要を意味しません`、行数=保存済み事実のみ | truthfulness test に gateIds 固定済み。「—」 semantics が全 metric で一貫か |
| 算定 | `prescriptions/prescription-workspace.tsx` 算定プレビュー | 「算定エンジンと根拠トレースが未接続」(PrototypeAction disabled)、`点数・薬価の表示は RB-008` | 同上 |
| 算定 | `components/calculation-trace-view.tsx` | WP-7501 で consumer 配線予定。現在は component のみ | trace 未供給時の表示が「算定済み 0 点」に見えないか(要確認) |
| 請求 | `claim-check/page.tsx` | RB-001/RB-008/RB-009 名指し、`点検結果ではありません`、CSV出力は PrototypeAction disabled、点検対象件数「—」 | 受付実件数(実測)と点検結果(未接続)の混同防止が十分か |
| 請求 | `monthly-closing/page.tsx` | `claim:finalize` 未登録・RB-001/RB-004/ARC-007・UIX-001 §12.4、締め・ロック・送信不可の明示、`「—」は0件・提出済み・対応完了を意味しません` | 「指定業務日の受付件数」だけが live — 実測と未接続の分離維持 |
| 帳票 | (RCP-001〜006 画面なし) | WP-7503/7504/7603 で未実装。画面非存在 | 帳票出力の入口が無いこと自体は問題ないが、monthly-closing の CSV出力・各所 PrototypeAction が「出力可能」に見えないか |
| 連携 | `sync-status/page.tsx` | モード検知API 不在で NORMAL 推測しない、外部連携すべて未接続、実測は health+outbox 件数のみ、`「—」は0件を意味しません` | outbox 配送件数が「連携成功」に読めないか(件数≠配送成功) |
| 連携 | `admin/admin-dashboard.tsx` 連携 tab | 実測: whoami/health/migration-state のみ。権限不足は管理情報非表示 | tab label「連携」の下で未接続一覧が十分か(要目視) |
| 受付・資格 | `reception-dashboard.tsx` / eligibility badge | snapshot 由来表示(WP-7204)、RECEPTION_ELIGIBILITY_PRESENTATION 全 7 状態定義済み | UNVERIFIED/EXPIRED/MISMATCH が請求可能に見えないか |
| 処方 lifecycle | `prescriptions/prescription-workspace.tsx` lifecycle panel | WP-7402 接続済み(確認・確定・dialog 責任文言)、RB-007/RB-008 停止名指し | 確定済みの read-only 化と「訂正=新版」案内の整合 |
| 調剤 | (調剤 UI なし) | WP-7404 は API のみ、UI 統合は WP-5113【REF】。fixture journey は direct fetch(D-3) | 「調剤記録が存在しない」ことを画面が沈黙しないか — 処方確定後の次工程表示(要確認) |

## 3. 点検観点(チェックリスト骨格)

各 surface について以下を採点する(PASS / FAIL / N/A + 証拠スクショまたは DOM):

- **V-1 「—」/空状態の非ゼロ化**: 「—」が 0 件・0 円・正常に読めない。
  意味を否定する注記が近接している。
- **V-2 停止理由の名指し**: 未接続・停止の理由(gate ID: RB-001/004/007/008/009、
  MST-001、UIX-001 §12.x、SCR-xxx)が利用者に到達する文言で示される。
- **V-3 実測と推測の分離**: API 実測値のみを表示し、未取得値を既定値
  (NORMAL・0・済)で埋めない。
- **V-4 成功装飾の禁止**: 未実施区画に ok tone(緑・●)・成功文言を使わない。
- **V-5 操作の fail-closed**: 未接続 operation のボタンは disabled +
  理由表示(PrototypeAction 規約)。submit できてもサーバで 403/409/422 に
  なる経路が UI 文言と矛盾しない。
- **V-6 ARIA/支援技術**: alert/polite の付与が severity に比例
  (visual-status-registry 準拠)。色のみ依存の表現がない。
- **V-7 逆向きの truthfulness**: 「未実装」と表示された機能が実際には
  実装済みでないか(stale な未実装表示も信頼性を損なう → §4 P-1)。
- **V-8 監査・証跡への導線**: deny/未接続の発生が audit/outbox のどこで
  確認できるかが reviewer に示せる。

## 4. 予備調査 findings(仮。human review packet 入力候補)

- **P-1 stale「未実装」表示 ×5**(V-7 違反 → 修正済み):
  - `prescription-launch-route.tsx:172` 「薬剤師確認(SCR-014)は未実装」—
    WP-7402 で confirm/finalize route 実装済み。同 workspace.tsx:1221 は
    「実APIへ接続しています」と正しい記述で不整合。→ 「接続済みだが
    下書き保存は確認・確定を意味しない」へ修正。
  - `prescription-launch-route.tsx:479` 「薬剤師確認(SCR-014)は実行できません」
    → 「ワークスペース上の実APIで実行可能。算定・臨床判断支援は引き続き
    実行不能」へ修正。
  - `components/operator-focus-board.tsx:72`
    「薬剤師確認API(SCR-014 dispensing:confirm)が未実装です」— 確認コマンド
    `prescription:confirm` は実装済みで scope 名も誤り。不足は確認待ちの
    横断集計 read API のみ → 文言を「横断集計する一覧APIが未提供
    (コマンド実装済み)」へ修正。
  - `components/operator-focus-board.tsx:78` 「疑義照会API(SCR-015)が未実装」
    — WP-7403 で処方単位の照会 route 実装済み。不足は滞留の横断集計 →
    同様に修正。
  - `prescription-reception-boundary.tsx:198` 「確定処理は未接続」— WP-7402
    finalize は接続済み → 「薬剤師確認・確定処理は接続済み、臨床判定・算定は
    未接続」へ修正。
  - 回帰 guard: `operator-focus-board.test.ts` に「実装済みコマンドを未実装と
    表示しない」テスト、`prescription-launch-route.test.tsx` に stale 文言の
    不存在 assert を追加。
- **P-2 調剤工程の UI 不在**: 処方確定後、調剤記録の存在・状態を示す UI が
  無い(API-021 に GET endpoint も非提供)。pilot review で「確定したが
  調剤はどこで見るか」が問われる可能性が高い → human review 入力に
  「調剤 UI 不在は既知(WP-5113【REF】)」と明記する。
- **P-3 outbox 配送件数の読み違い余地**: sync-status の outbox 件数は
  「生成済み event 数」であり配送成功ではない。文言は未接続を名指し
  しているが、数値の意味(配送成功≠)を reviewer が誤読しないか要確認。
- **P-4 calculation-trace-view の空状態**: consumer 未配線(WP-7501)。
  component の空表示を確認し「0 点・算定済み」に見えないことを点検へ。
- **P-5 SSOT 側の SCR-014/015 drift**(R1 review で検出、開示のみ):
  `docs/uiux/medical_ui_ux_principles.md`(UIX-001 APPROVED 0.2.2)と
  `docs/uiux/screen_inventory_draft.md`(UIX-007 SUPERSEDED)の SCR-014 行が
  scope を `dispensing:confirm`・状態を「未実装」と記載、SCR-015 も「未実装」。
  実装は `prescription:confirm` + confirm/finalize route(WP-7402)、
  per-prescription inquiries(WP-7403)。この doc 記述が UI 側 stale 文言
  (P-1)の由来と推定される。UIX-001 は APPROVED SSOT のため本 WP では
  修正せず、**UIX-001 の改版提案**(SCR-014: scope `prescription:confirm`・
  状態「コマンド接続済み/横断キュー未提供」、SCR-015: 処方単位 route
  実装済み/横断集計未提供)を別途起案して human gate へ送る。
  なお `docs/ui-ux-refresh/04-screen-and-state-inventory.md`・
  `07-use-error-risk-register.md`(非 SSOT の時点調査記録)にも SCR-014
  未実装の記述が残存する — 時点スナップショット文書のため修正せず、
  既知残存としてここに開示する。

## 5. C-066 human review packet 構成(入力資料の目次案)

薬剤師 reviewer へ渡す資料として以下を同梱する想定:

1. **対象 journey**: WP-7405 の全行程(受付→処方入力→確認→確定→調剤)の
   実機手順 + fixture 起動方法(`ui-fixture-api.mjs` + `ui-browser-check.mjs`
   の人間用読み替え手順)。
2. **fail-closed 点検表**: §2/§3 の採点結果(全項目 PASS/FAIL/証拠)。
3. **既知の制限**: 調剤 UI 不在、算定 RB-008、請求 RB-001/RB-004、
   臨床判断支援 RB-007、test_signed は production 認証ではない(SEC-009)。
4. **safety 論点リスト**: 未解決 RP で確定不可・非資格者 403+deny 監査・
   終端受付の編集不可・後発品変更の fail-closed・append-only/訂正=新版。
5. **判断を仰ぐ項目(D-系)**: pilot 可否は人間が決める。packet は判断材料で
   あり合否を決めない。

## 6. 設計決定(D-系・承認済み 2026-09-19「進んでいい」)

- **D-1**: 点検表の格納場所。`docs/research/` の WP-7406 成果物 doc に採点表を
  書く案(既存 packet 慣行に一致)。SSOT 化はしない。
- **D-2**: 点検の実施方法。コード調査 + `renderToStaticMarkup` ベースの
  truthfulness test 拡張(自動化) + browser での目視証跡の 3 層案。
- **D-3**: 帳票領域の扱い。画面非存在ゆえ「入口の誤認可能性」のみ点検し、
  帳票そのものの点検は WP-7503/7504 へ送る。
- **D-4**: P-1 stale 文言の修正実施可否・修正範囲(文言訂正のみ、構造変更なし)。
- **D-5**: 点検で FAIL が出た場合の扱い — 本 WP 内で文言修正してよい範囲と、
  別 WP へ送る閾値(機能追加・API 変更は必ず別 WP)。

## 7. 検証 gate(実施時)

- `pnpm --filter @yrese/web test`(truthfulness/contract test 含む)
- `pnpm check:ssot-index` / `check:boundaries` / `check:secrets`
- browser gate(`scripts/ui-browser-check.mjs`)— 点検表の証跡採取と同一走行可

## 8. 範囲外(human gate・別 WP)

- 薬剤師レビューの実施と pilot 判断(C-066 本体)。
- 算定 consumer 配線(WP-7501)・帳票(WP-7503/7504)・請求中間モデル
  (WP-7701)の実装。
- 資格登録/取消 route、SEC-009 production OIDC provider。
- production/staging 適用・外部送信。

## 9. 実装状況・独立 review

### 点検実施(2026-09-19、コード調査 + renderToStaticMarkup 証跡)

C-065 総点検を §2 inventory × §3 観点で採点。証拠は各 source 行と
`operational-prototype-truthfulness.test.tsx`(既存 4 画面の固定検査)+
今回追加の回帰テスト。

| surface | V-1 | V-2 | V-3 | V-4 | V-5 | V-6 | V-7 | V-8 | 判定 |
|---|---|---|---|---|---|---|---|---|---|
| checkout | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| claim-check | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| monthly-closing | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| masters | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| sync-status + outbox-board | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| admin | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| patients(検索/保険) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| reception dashboard/eligibility | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| prescription workspace | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| prescription-launch-route | — | — | — | — | — | — | FAIL→修正 | — | 修正済み |
| operator-focus-board | — | — | — | — | — | — | FAIL→修正 | — | 修正済み |
| prescription-reception-boundary | — | — | — | — | — | — | FAIL→修正 | — | 修正済み |
| calculation-trace-view | PASS | PASS | PASS | PASS | N/A(未配線) | PASS | PASS | PASS | PASS |
| 帳票(RCP 画面) | N/A | N/A | N/A | N/A | PASS(入口 disabled) | N/A | N/A | N/A | 画面非存在(D-3) |
| 調剤 UI | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | 画面非存在(P-2 既知) |

補足:

- P-3(outbox 配送済み列): 画面上部に「外部サービスへ到達したことは
  意味しません」の注記あり。`delivered_at` は sink 配送の記録であり外部
  到達ではない — 文言がこの区別を保持。PASS(改善余地は人間レビューへ)。
- P-4(calculation-trace-view): blockers を `role="alert"` で提示、
  affectsClaim+evidence 欠落を「異常」と明示、未知値は「不明」fallback、
  空 steps は「導出ステップはありません」。0 点・算定済みに見えない。
  なお現時点で consumer 配線なし(WP-7501)のため live 画面には未露出。

### 修正実施(D-1〜D-5 承認: 2026-09-19「進んでいい」)

P-1 の stale 文言 5 箇所 + R1 で追加検出した同型 stale 3 箇所を実態へ修正:

- 画面文言: `prescription-launch-route.tsx` ×2、`operator-focus-board.tsx` ×2、
  `prescription-reception-boundary.tsx` ×1、`prescription-workspace.tsx` ×1
  (患者固有タスクの疑義照会 nuance — F-4)。
- code-adjacent doc: `prescriptions/README.md`(SCR-014 の誤 scope 記載)、
  `north-star-journey.test.ts` file docstring(「未実装のため対象外」を全行程へ更新)。
- `prescription-launch-route.tsx` の「実行できます」に条件 qualifier
  (要資格・受付 IN_PROGRESS・全Rp解決)を追加 — F-3。
- SSOT 側 drift(UIX-001/UIX-007)は改版ゲート対象のため修正せず P-5 で開示。
- 回帰テスト 2 件追加。

### 検証(実行済み)

- `pnpm --filter @yrese/web test`: 67 files / 809 tests PASS(回帰テスト含む)

### 独立 review

fresh-context read-only reviewer による frozen-diff review(WP-7405 と同経路)。

- **R1 FAIL(2M/2L/1info)** → 全件対応:
  - F-1(M): Plans.md「承認後」/State.md「承認待ち」/packet header「別途実施」
    と §9「承認済み」の自己矛盾 + approval provenance 欠落 → header に
    `approval_basis` 記録、3 箇所を実施済みへ整合。
  - F-2(M): V-7 sweep 不完全 — 同型 stale が `prescriptions/README.md`・
    `north-star-journey.test.ts` docstring・UIX-001/UIX-007 docs に残存。
    前者 2 件を修正、SSOT 2 件は改版ゲートのため P-5 で開示。
  - F-3(L): 「実行できます」へ条件 qualifier 追加(要資格・受付
    IN_PROGRESS・全Rp解決・原本情報充足 — R2 で metadata を補完)。
  - F-4(L): workspace 患者固有タスク文言に処方単位 inquiry 実装済みの
    区別を追加。
- **R2 PASS(2L/2info)** → 残置分を仕上げ:
  - qualifier に原本情報充足を追加(全 confirm guard を網羅)。
  - `docs/ui-ux-refresh/` の時点調査 2 doc に残存する SCR-014 未実装記述を
    P-5 へ追記(非 SSOT の時点スナップショットとして既知残置)。
  - §6 見出しを「承認済み」へ、Plans.md の surface 数を 15 行へ整合。

最終 frozen diff: `/tmp/wp7406-frozen-r3.diff`(hash は commit 記録に同記)。
