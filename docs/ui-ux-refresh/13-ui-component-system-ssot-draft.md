# 13 — UI共通コンポーネントシステム統合元(Candidate A / UIX-001改版)

> **DRAFT / PROPOSED — 本書は non-SSOT 作業領域(`docs/ui-ux-refresh/`)上の起草文書である。**
> direct user instruction 2026-08-26 は §0 の Candidate A を選択した。正式化では
> UIX-001 を改版し、本書を独立SSOTへ昇格せず、UIX-008も採番しない。
> Candidate AのPROPOSED batchとfinalizationはPRC-007の10段改版フローに従う。
> historical exact11 と WP-4254/4255 は historical landing base `c7b6140` までに landing 済みであり、
> 現在の blocker には数えない。
> それまで本書は承認・実装・準拠を主張しない。

```yaml
# Candidate A UIX-001改版へ統合するnon-SSOT proposal metadata
proposal_id: WP-5101-UIX-001-COMPONENT-SOURCE
target_ssot_id: UIX-001
title: UI共通コンポーネントシステム統合元
domain: uiux
status: PROPOSED
owner: codex_root
reviewers:
  - independent_verifier
  - frontend_reviewer
  - ui_flow_tester
  - accessibility_ux_reviewer
  - medical_safety_reviewer      # U4 該当コンポーネント
  - privacy_compliance_reviewer  # U4 該当コンポーネント
  - security_critic
  - api_contract_reviewer
  - data_integrity_auditor
  - test_architect
  - claim_clerk_workflow_reviewer
  - human_pharmacist_workflow_authority
  - human_product_authority
version: 0.1.7-draft
created_at: 2026-07-31
source_snapshot_commit: 9786fe8eab3da97213d5b641b725531b13f10290
source_refs:
  - docs/spec/construction_prompt_v0.2.0.md §7, §16
  - ユーザー指示 2026-07-31(UIは共通コンポーネントを導入。SSOT文書を作り、yrese内のUIUXルールをベースに構築する)
  - docs/ui-ux-refresh/08-target-design-direction.md(視覚的状態言語)
  - docs/ui-ux-refresh/12-component-contracts.md(コンポーネント契約)
  - デザイン探索ボード 2026-07-31(甲乙丙+五構造 — 別紙 Artifact bcc10e46)
  - 一枚盤面プロトタイプ 2026-07-31(丁 — 別紙 Artifact cb24845f)
  - docs/ui-ux-refresh/14-one-board-direction-decision.md(丁採用の決定記録 2026-07-31)
  - docs/ui-ux-refresh/17-adversarial-review-and-new-requirements.md
  - docs/regulatory/legal_compliance_matrix.md REG-003 §7
  - docs/regulatory/regulatory_blockers.md REG-004 RB-003
depends_on: [UIX-001, UIX-002, UIX-003, UIX-004, UIX-005, UIX-006, UIX-007, PLAN-UIUX-001, API-002, API-009, API-012, API-013, DOM-004, MOD-007, MOD-008, MOD-009, REG-003, REG-004, SEC-006]
impacts: [apps/web/**, docs/plan/uiux_development_plan.md]
open_questions: 本文 §9 参照
blockers:
  - BLOCKED_CANDIDATE_A_PRC007_PROPOSED_BATCH
  - BLOCKED_RELEVANT_MEDICAL_SAFETY_PRIVACY_ACCESSIBILITY_PHARMACIST_GATES
  - BLOCKED_SECURITY_REVIEW(production auth、role-to-scope、support access)
  - BLOCKED_SCREEN_TO_BOARD_MAPPING_SOURCE(artifact cb24845fはrepository未転記)
  - BLOCKED_DOM004_RB003_OUTBOX_CONTRACT
  - BLOCKED_HPKI_LEGAL_CLASSIFICATION(REG-003 §7)
  - BLOCKED_L0_TOKEN_AUTHORITY_RECONCILIATION(§2 の current implementation drift)
```

## 0. Current topology と unique SSOT target(2026-08-26)

UIX-001 v0.2.0はdirect user instructionにより限定foundationとしてAPPROVEDとなり、
UIX-002〜007はUIX-001 §§7〜12へSUPERSEDEDとして統合された。本書は引き続き
component systemのreview provenanceを扱うnon-SSOTである。
一方、current taskはUI/UX原則・IA・操作/表示体系・theme・
tokens・canonical components・state・a11y・responsive・debt/change management を集約した
**唯一の UI/UX SSOT file**を要求する。component-only の UIX-008 を追加し UIX-001〜007 を
APPROVED のまま維持する構成は、この unique-file 要件を満たさない。

PRC-007 の atomic cutover で選べる topology は次の二つだけであり、中間状態を main へ置かない。

| Candidate | Reuse | Atomic cutover |
|---|---|---|
| **A(選択済み、2026-08-26)** | 既存 UIX-001 を unique foundation へ改版 | UIX-002〜007 と本ドラフトの必要内容を UIX-001 へ集約し、旧文書を同一 batch で SUPERSEDED にする |
| B(不採用) | UIX-008 を新しい unique foundation として採番 | UIX-001〜007 と本ドラフトの必要内容を UIX-008 へ集約し、UIX-001〜007 を同一 batch で SUPERSEDED にする |

どちらも UIX-001〜007 の安全・品質要件を削除しない。特に UIX-004 の UAC-01〜12、
synthetic/demo data 限定、pharmacist / claim-clerk / accessibility / product の human approval、
UAC-11 の自動+手動検証、および UIX-005 の ST-01〜15(入力保全・冪等性・部分失敗・
LOCAL_ONLY/RECOVERY_SYNC・監査欠落防止を含む)を cutover checklist に明記して保存する。

既存正本を再利用する A を direct user instruction 2026-08-26 が選択し、同日の限定承認で
UIX-001 v0.2.0のfoundation昇格に必要な観点を承認した。この承認は未決領域の実装、
risk acceptance、external action、UNMAPPED、HPKI/legal、RB-003 blockerを解除しない。

### 0.1 Candidate A preservation matrix

finalization batchでUIX-001をAPPROVED、UIX-002〜007をSUPERSEDEDとし、indexとdirect live
referencesを同時更新する。旧source本文は履歴/provenanceとして保存する。

| source | Candidate A UIX-001 target | preservation pin |
|---|---|---|
| UIX-001 v0.1.2 | §§1〜6 | P-01〜20、禁止15、警告5段、旧実装対応、3 open questions |
| UIX-002 v0.1.0 | §7 | 最低基準11、3本柱、禁止10、必須test 14、2 open questions |
| UIX-003 v0.1.0 | §8 | 前提3、候補予算18、運用3、未実測/release blocker |
| UIX-004 v0.1.0 | §9 | UAC-01〜12、synthetic/demo限定、4 human approval、UAC-11自動+手動 |
| UIX-005 v0.1.0 | §10 | SLO候補7、ST-01〜15、禁止2、実測/runtime/human blocker |
| UIX-006 v0.2.0 | §11 | NORMAL/LOCAL_ONLY/RECOVERY_SYNC、4 role home、監査Web禁止、遷移原則 |
| UIX-007 v0.2.0 | §12 | active 28 screen、U0〜U4、SCR-028 RETIRED、U3/U4 gate |
| 本書 v0.1.7-draft | §§13〜17 | L0〜L4、Phase A/B、component ledger/予約、禁止、a11y/responsive、debt/change、未決gate |

旧sourceの候補値・未実装・blocker・human gateは、集約によって解除・完了扱いにしない。

## 1. 目的と適用範囲

`apps/web/**` のUIX-001 §12 active 28画面は、該当する状態表示・警告・確認操作・
ローディング/空/エラー表示を**本書が台帳化する共通コンポーネント経由でのみ**表現する。
患者文脈は認証済み患者業務面だけへ適用し、待合・共用・support面には投影しない。
画面ローカルでの状態表現の直接実装(hex 直指定・自由ラベルのドメイン状態・独自 severity)は禁止する。
support denyとtenant/pharmacy bindingはCandidate Aのtarget acceptanceであり、trusted role/subject、
membership/active grant、API/OpenAPI operation mappingが未承認の間はenforcement PASSや実装可能性を主張しない。

本書は次を再定義しない(上位正本をそのまま参照する):

- 優先順位・原則 P-01..P-20・禁止15項・警告重要度5段 — **UIX-001 §§1〜6**
- 業務導線・モード分岐・ロール別ホーム — **UIX-001 §11**
- 画面台帳・ux_safety_level(U0..U4)— **UIX-001 §12**
- 実装波・品質ゲート — **PLAN-UIUX-001**
- contract-first(zod 契約経由のみの API 呼出)— **API-002**

## 2. レイヤ構造(5層)

| 層 | 内容 | 正本 | 変更の自由度 |
|---|---|---|---|
| L0 | デザイントークン(CSS custom properties: 色・タイポ・余白・密度・状態色) | target: 単一 token authority; current direct imports: `globals.css` / `operator-first.css` / `operator-ux-refinement.css` / `operator-first-navigation.css` / `operator-adversarial-refinement.css` / `operator-completion-refinement.css`; transitive: `legacy.css` via `globals.css`; route-local: `apps/web/app/admin/admin-dashboard.module.css` via `admin-dashboard.tsx` | **高** — Phase A で一つの token authority へ集約後、テーマ差し替えはこの層のみで行う |
| L1 | 状態表現の単一正本(domain×key → label/tone/shape/ARIA) | `apps/web/app/status/visual-status-registry.ts` | 低 — ドメイン enum SSOT 承認後のみ軸追加 |
| L2 | 基礎コンポーネント(バッジ・リスト・バナー・ダイアログ・状態画面) | `apps/web/app/components/` | 中 — 本書の契約と追加手順(§5)に従う |
| L3 | 業務複合コンポーネント(PatientHeader・ClinicalAlert・trace viewer 等) | 同上 | 中 — U4 該当はレビュー体制必須 |
| L4 | 画面(UIX-001 §12 の SCR-xxx) | `apps/web/app/**/page.tsx` | 画面は L0-L3 を組み合わせるだけ。独自の状態表現を持たない |

**核となる規律(2026-07-31 敵対的レビュー SF-1 により二相へ訂正)**: 刷新は性質の異なる二相に分離する。

- **Phase A(視覚テーマ = L0 のみ)**: 甲乙丙のトークン差し替え。L1 以上の契約・文言・DOM 構造を
  変えない。**ただし「既存テスト全緑」を挙動不変の証跡と呼ばない**(2026-07-31 checker 訂正):
  Vitest の component tests は主に static markup/純関数を観測し、Playwright/axe browser gate は
  route、keyboard、reflow、forced-colors、重大 a11y 違反を観測する。いずれも token ownership
  全体を単独では証明しない。全緑が証明する範囲は各 test が実際に観測した契約に限定する。
  Phase A の受入は既存テスト全緑**に加えて**、(a) L0 トークン参照の静的検査
  (active stylesheet の component selector にある直指定色を token へ集約し、token 宣言と
  forced-colors override だけを明示例外にする)、(b) §7 の browser/a11y 検証
  (forced-colors / reduced-motion / コントラスト)を必須とする。現行
  `style-load-order.test.ts` は cascade 順、legacy import、廃止/重複 stylesheet の不在、
  desktop grid、completion layer の sidebar override 禁止を検査するが、token/direct-color は
  検査しない。Phase A は上記 direct/transitive/route-local 全体を対象にした最小の failing
  test から始める。
- **Phase B(丁 一枚盤面 = L2〜L4 構造変更)**: 画面構成・遷移・コンポーネント合成が変わるため、
  既存テストは**壊れることが正常**。回帰証跡は「L1 Registry の文言・ARIA 網羅テスト不変」+
  「新盤面の新規テスト(14号 §7 の投影・ロック・確定演出を含む)」で構成し、
  既存テスト全緑を Phase B の証跡として主張しない。

「見た目の刷新」と「安全規律の回帰試験」の分離という価値は Phase A にのみ成立する。

## 3. コンポーネント台帳(2026-07-31 実在確認済み)

`docs/ui-ux-refresh/12-component-contracts.md` は統合元の版付きprovenanceである。Candidate Aでは
Purpose / Props / ARIA / Prohibited / Testsの最低契約をUIX-001 §13.3.1へ統合し、12号を
別authorityとして残さない。本書は台帳(存在・分類・状態)と統合漏れの確認元を持つ。
`✅ 実装済`はfrozen base `9786fe8`でfile/rendering骨格が存在するinventory語に限定し、
Candidate A contract適合、live integration、自動test、専門review、release admissionを意味しない。

### 3.1 状態表現(L1/L2)

| コンポーネント | ファイル | 状態 | 備考 |
|---|---|---|---|
| Visual Status Registry | `status/visual-status-registry.ts` | ✅ 実装済 | 状態表現の単一正本。severity / system-mode / eligibility / reception / provisional + 拡張軸 |
| DomainStatusBadge | `components/domain-status-badge.tsx` | ✅ 実装済 | **新規のドメイン状態表示はこれのみ**。自由 label/tone を受けない |
| StatusBadge | `components/status-badge.tsx` | ✅ レガシー互換 | 非ドメイン状態の汎用バッジ。新規のドメイン状態には使わない |
| SeverityList | `components/severity-list.tsx` | ✅ 実装済 | UIX-001 §5 の5段表示 |
| RecordStateBadge | `components/record-state-badge.tsx` | ✅ 実装済 | 記録ライフサイクル11状態 |
| PrescriptionChangeIndicator | `components/prescription-change-indicator.tsx` | ✅ 実装済 | 前回/今回差分。実データ配線は残 |

### 3.2 患者文脈(L3・U4)

| コンポーネント | ファイル | 状態 | 備考 |
|---|---|---|---|
| PatientHeader | `components/patient-header.tsx` | ✅ 実装済 | P-09。認証済み患者業務面だけに氏名・カナ・生年月日・年齢・性別・資格状態を表示 |
| PatientContextProvider / Bar | `components/patient-context.tsx` | ✅ 実装済 | 認証済み患者業務面で横断固定。別患者選択で前文脈破棄。待合/共用/support面へ投影しない |

### 3.3 警告・エラー・確認(L2/L3)

| コンポーネント | ファイル | 状態 | 備考 |
|---|---|---|---|
| ErrorNotice + error-code | `components/error-notice.tsx` / `error-code.ts` | ✅ 実装済 | エラーコード+次アクションの対提示(P-18) |
| BlockerBanner | `components/blocker-banner.tsx` | ✅ 実装済 | BLOCKER 理由+次アクション |
| ClinicalAlert / Summary | `components/clinical-alert.tsx` | ◐ 表示層のみ | **判定エンジン接続前に医療安全レビュー+SaMD 該当性評価必須** |
| ConfirmationDialog / DestructiveActionDialog | `components/confirmation-dialog.tsx` | ◐ 表示骨格のみ | P-11。UIX-001 §13.3.1のtrap/Escape/returnをcomponent内へ実装するまでU3/U4利用禁止 |

### 3.4 モード・同期(L2/L3)

| コンポーネント | ファイル | 状態 | 備考 |
|---|---|---|---|
| SystemModeBadge | `app/system-mode-badge.tsx` | ✅ 実装済 | P-03。5モード常時表示 |
| ModeCapabilityView | `components/mode-capability-view.tsx` | ✅ 実装済 | 可否+理由。判定は shared-kernel 関数のみ |
| SyncIndicator / OfflineBanner / SystemHealthBanner / EmergencyModeBanner | `components/sync-indicator.tsx` | ◐ 表示層のみ | ローカル保存済み≠サーバ保存済み(H-03)。実同期配線は残 |

### 3.5 画面状態・その他(L2/L3)

| コンポーネント | ファイル | 状態 | 備考 |
|---|---|---|---|
| EmptyState / LoadingState | `components/empty-state.tsx` / `loading-state.tsx` | ✅ 実装済 | |
| CalculationTraceView | `components/calculation-trace-view.tsx` | ◐ fixture のみ | P-13。live 結線の WP-3011b/c は**現 active queue(Plans.md)に存在しない**(frozen archive のみ — 2026-07-31 checker 訂正)。結線は契約承認後の実装 WP 起草が前提 |
| FileUploadStatus | `components/file-upload-status.tsx` | ◐ 表示層のみ | 実 S3 導線は残 |
| AuditMetadata ほか | `components/audit-metadata.tsx` | ✅ 実装済 | 監査 API 実配線は残 |
| AuthSession | `components/auth-session.tsx` | ✅ 実装済 | 認証本体は BLOCKED_SECURITY_REVIEW |

## 4. デザイン方向との接続(2026-07-31 改訂 — 丁採用)

**構造方向は「丁 一枚盤面」が採用決定済み**(14号決定記録 / direct user instruction 2026-07-31)。
甲(静謐な台帳)/乙(管制室)/丙(工程レール)のビジュアル言語は L0 トークンテーマとして
引き続き選択可能であり、丁の構造とどれでも合成できる(暫定はプロトタイプのクローム)。

写像:

1. **丁 一枚盤面 = L2〜L4 の構成原理**。画面(L4)は「調剤盤・請求盤・管理盤」の3盤面へ再編し、
   遷移を「選択(常設キュー)・展開(工程行)・ドロワー(根拠)」の三置換で消す。
   repository内で検証できるplacementはCandidate A UIX-001 §13.4.1だけを正とする。14号が参照する
   28画面写像artifactは未転記のためprovenanceに限定し、残るscreenを推測配置しない。
2. **甲乙丙 = L0 トークンテーマ**。Phase A で確定する単一 token authority の差し替えで実現し、コンポーネント契約は不変。
3. **状態インク = L1 Registry の視覚仕様**。tone×shape×label の三重エンコードは既に Registry が保持。テーマはトーンの具体色のみ変える。
4. **患者フォーカスフレーム = PatientContextBar の視覚強化**(L3 の style 変更、契約不変)。盤面中央の患者枠として常設。
5. **モードシアター = SystemModeBadge + ModeCapabilityView + L0 のモード連動テーマ**。新規判定ロジックは作らない。
6. **丁が要求する新規 L2/L3 コンポーネント(予約 — enum SSOT 承認まで実装しない)**:
   - `WorkflowSheet` / `WorkflowStageRow` — 工程アコーディオン。サマリ行(状態 chip+要約)は常時可視、
     展開部に置けるのは入力フォームのみ(安全情報の格納を型で禁止 — 14号 R-1)
   - `ReceptionQueueRail` — 常設キュー+展開検索(SCR-001/002 吸収)
   - `AlertRail` — 右レール常設警告(SCR-013 吸収。BLOCKER の中央進出は UIX-001 §5 準拠)
   - `EvidenceDrawer` — calculation trace(P-13)と記録版履歴(P-12: 版・確認者・確認日時)の
     その場開閉。**監査イベント(audit_events 由来の一覧・chain 状態・再試行操作)は扱わない** —
     UIX-001 §11.4「監査イベントは一般業務Webへ表示しない」と SEC-005「一般薬剤師向けWeb画面は
     提供しない」の明示禁止に従う(SCR-028 RETIRED を別名で復活させない — 2026-07-31 checker C-1 訂正)
   - `BoardViewSwitcher` — ロール別ビューの投影切替(14号 §7.1)。**権限を一切変更しない**
     (capability の正は MOD-007 + API scope — 17号 D-1/SF-6)
   - `FinalizeAndRegisterAction` — 一つのsurface上の1 button / 1 user actionから、段1の
     local確定と段2の外部登録をbackendで分離するcontainer。**「2段」= 段1 ローカル確定
     (不可逆)+outbox intentのatomic commit / 段2 workerによる外部登録(再試行)である(17号 §2)。
     ただしDOM-004 の2つの確認行為
     (`prescription:confirm` / `dispensing:confirm`)の統合を意味しない** — その統合可否は
     DOM-004 改版(WP-5102)の承認事項であり本コンポーネントの前提(2026-07-31 checker H-7 訂正)。
     完了表現は「確定」chip と「登録」chip を併置し単一成功表現で束ねない(H-03)。user commandと
     delivery workerのauthorization/idempotency/auditを分離し、DOM-004/RB-003/MOD-007の該当改版、
     API-013のoperation契約、MOD-008の別event登録、MOD-009のatomic outbox/delivery profileが
     完了するまで推測実装・権限流用しない。人間の別操作はAPI-012準拠のtenant adminによる
     DLQ resendだけとし、UIX-001 §12.3の個別operation/authority/audit contractまで実装しない。
     local確定は不可逆、外部登録失敗は巻き戻さず、`PENDING_EXTERNAL_SYNC`をdurable stateから
     復元する(UIX-001 §12.4)
   - `BoardShell` — 3カラム(左レール・中央・右レール)を保持する盤面の器(L2)。
     3盤面(L4)が器を画面ごとに再実装しないための共通枠(2026-07-31 checker M-12 追加)
   - `ConfirmationQueueRail` — 薬剤師ビュー主役の確認待ちキュー(14号 §7.1)。
     ReceptionQueueRail とはデータ源・並び順が異なる別コンポーネント。並び順は
     14号 §7.3 の薬剤師レビュー未決(2026-07-31 checker M-12 追加)
   - `StageLockIndicator` — 編集所有の常時表示「↻ 入力中 — 操作者(端末)」(14号 §7.2)。
     無言グレーアウト禁止の実装点(2026-07-31 checker M-12 追加)
   - `StageReturnAction` — 差し戻し導線(14号 §7.1 薬剤師ビュー)。遷移定義は
     14号 §7.3 の DOM-004 突合未決が前提(2026-07-31 checker M-12 追加)
   - 前提: workflow-stage enum の shared-kernel SSOT 起案・承認(14号 R-5)。存在しない間は実装しない(捏造禁止)。
     `FinalizeAndRegisterAction` はさらに RB-003(電子処方箋凍結)解除と DOM-004 改版(17号 SF-2)が前提。

## 5. 新規コンポーネント追加手順

1. **The Component Gallery**(https://component.gallery/components/)で標準パターン・命名・a11y 慣行を照合する。法令、公式な医療・請求要件、患者安全、human gate、APPROVED SSOTを上書きできず、衝突時はBLOCKEDとして該当authorityへエスカレーションする
2. 契約起草 — Candidate Aの唯一正本UIX-001 §13.3.1へ Purpose / Props / ARIA / Prohibited / Testsを追記。12号はreview用provenanceだけを同期
3. ドメイン状態を扱う場合: 対応 enum が shared-kernel SSOT に存在することを確認。無ければ **enum SSOT 承認まで実装しない**(予約として設計のみ記録)
4. Registry 軸追加(必要時)→ コンポーネント実装 → 最小の Vitest 契約テスト+
   DOM interaction/a11y がある場合は既存 Playwright/axe browser gate(--passWithNoTests 禁止)。
   jsdom / Testing Library は既存 stack で必要契約を検証できない場合だけ別 WP で判断する
5. U3/U4 該当は実装着手前に medical_safety / privacy / accessibility の relevant review と
   必要な human authority の承認を得る。実装後は同じ観点の検証 evidence を独立確認する
6. 本書 §3 台帳へ行を追加(台帳にないコンポーネントを画面から import しない)

## 6. 禁止事項

1. 画面・コンポーネントでの hex/色 直指定(L0 トークン経由のみ)
2. 色単独・アイコン単独の状態表現(label 必須 — P-20)
3. ドメイン状態の自由 label/tone 表示(DomainStatusBadge / Registry を迂回しない)
4. UI 側での独自モード・権限判定(shared-kernel 判定関数と API 側制御が正 — P-14)
5. ローカル保存・仮状態・確認前状態に確定と同じ成功表現を使うこと(P-05/06/07/17)
6. PHI をログ・計測・エラーメッセージ・URL・technical `data-*`・未承認client storage・
   テストフィクスチャ・screenshotへ出すこと(SEC-004。synthetic fixture/artifactは§7だけで使用)
7. `packages/ui` への投機的移動(第二利用者出現まで `apps/web/app/components/` — 既決)
8. 台帳外コンポーネントの新設・台帳外画面からの利用
   (**適用範囲は共通コンポーネント(L1〜L3)**。既存の画面ローカル構成要素
   — `nav.tsx` の BusinessNav、`reception-dashboard.tsx`、`patients/patient-search.tsx` 等 —
   は昇格時点の経過措置として存続し、選択された unique foundation の cutover 改版で
   台帳登録か廃止かを個別判断する。
   起草時点の既存コードを遡及的に SSOT 違反としない — 2026-07-31 checker M-11 訂正)
9. 無言のグレーアウト・無言の操作不能化(「誰が・なぜ」の理由提示を必ず添える — 14号 §7.2)
10. 理由(reason)なしの BLOCKED 表示(15号 §3 の型契約と同一規律)
11. 破壊的・不可逆操作のワンクリック実行(UIX-001 禁止12 — 二段階確認 P-11 を経る)
12. 操作数削減を患者安全・情報の常時可視性(P-01)より優先する設計判断(UIX-001 禁止15)。
    密度段階(圧縮)でも状態 chip のラベルを省略しない(P-20)

## 7. 検証

- 単体: 各コンポーネントの最小 Vitest 契約テスト(状態網羅・ARIA・色非依存)。Registry は
  網羅性を型+テストで担保する。DOM interaction は既存 Playwright/axe browser gate で検証し、
  現行 stack が観測しない契約を「テストで担保」と主張しない
- 回帰: L0 差し替え時は relevant tests の PASS と exact-path diff review に加えて、L0 token
  参照の静的検査と下記 a11y 検証を証跡とする。各 test が実際に観測した契約だけを根拠とし、
  全緑を L1 以上の文言・DOM 構造の包括的不変証明と呼ばない
- 現行 browser gate の自動範囲は、route 2xx・main landmark・desktop shell geometry・
  page overflow、console/page error、axe critical/serious、mobile safety context、skip link・
  `/` shortcut・admin tabs、受付/検索から処方への guarded handoff、draft recovery・
  `beforeunload`・患者切替時の draft 非混入、複数 reflow viewport、および
  `/prescriptions` の forced-colors screenshot である。`reducedMotion: "reduce"` は設定のみで
  挙動 assertion はない
- actual 200% zoom、内部 scroll、screen reader、forced-colors の自動判定、reduced-motion の
  挙動、`prefers-contrast: more`、将来の WorkflowSheet は targeted test と手動確認を別途行う。
  現行 gate 単独を UIX-001 §9/UAC-11 適合の証跡と呼ばない
- target gateは`/prescriptions`一枚に限定せず、全canonical componentと代表routeの
  forced-colors境界/focus、reduced-motionの停止挙動、320/375/768/1024 CSS px、200% zoom、
  dialog focus、実screen readerをUIX-001 §14.1の自動+手動matrixで確認する
- browser artifactはproduction接続なしのsynthetic fixtureだけで生成する。patient sentinelを
  console、URL、error、artifact名へ含めず、screenshot外部共有時はredactしCI retention期間だけ保持する
- a11y: UIX-001 §§9,14.1の受入基準を自動+手動で確認し、結果を別artifactにする
- 性能: UIX-001 §8予算内(トークン差し替えで CSS サイズ・CLS を悪化させない)

## 8. 昇格手順(fail-closed)

1. 本ドラフトのレビュー(frontend / accessibility / independent)
2. §0 の unique SSOT topologyをhuman product authorityが承認(2026-08-26 Candidate A選択済み)。
   §9の未決事項はそれぞれの該当gateで解消する
3. UIX-001 revisionと§0.1 preservation matrixのrequired reviewを完了する(完了)
4. direct user final approvalに基づき、UIX-001 APPROVED、UIX-002〜007 SUPERSEDED、
   `docs/ssot_index.md`、PLAN-UIUX-001とdirect live referencesを同一finalization batchで更新する(実施中)
5. finalization diffを再確認してlandingした後だけ、実装WPをqueue規律に従ってclaimする

## 9. Open questions

- workflow-stage enum の SSOT 粒度・所在 — **丁採用により必須化** → **15号として起案済み(2026-07-31)**。残る論点は 15号 §9(薬剤師確認の位置の DOM-004 突合ほか)【レビュー待ち】
- L0 テーマ(甲乙丙)の選定と、薬局ごとの複数保持を許すか全テナント単一か(製品判断)【要確認】
- 丁の並行作業ロック表現・タブレット縮退・密度既定値(14号 R-2/R-3/R-4)。
  UIX-001 §14.1の`>=1024`候補とdrawer順はaccessibility/pharmacist gateでapprove/amend【要設計・薬剤師レビュー】
- 密度段階(標準/圧縮)と高齢患者向け拡大表示の対象画面範囲(UIX-001 §6 の既存要確認と統合)【薬剤師レビュー】

## 変更履歴

- 0.1.7-draft (2026-08-26): frozen reviewのD-2操作逆転、reviewer/source trace、authority優先順位を修正。
  1 user action / backend 2段、MOD-009同一transaction、各専門/human gateを維持。
- 0.1.6-draft (2026-08-26): Candidate A UIX-001 PROPOSED packetのpreservation matrix、
  component contractのUIX-001統合、focus/privacy/a11y artifact境界を固定。review中は
  UIX-002〜007をAPPROVEDのまま維持しfinalizationでのみSUPERSEDEDにする順序を固定。
- 0.1.5-draft (2026-08-26): direct user instructionによりCandidate A(UIX-001改版)を選択。
  本書は独立SSOT/UIX-008へ昇格せず、未決のmedical-safety/privacy/accessibility/pharmacist
  判断を各該当gateへ委譲。PRC-007 final approvalと実装は未承認のまま維持。
- 0.1.4-draft (2026-08-26): current `c7b6140` へ再同期 — exact11/WP-4254/4255 の
  historical dirty blocker を除去し、unique SSOT task と UIX-001〜007 の current topology
  の競合を atomic cutover decision として明示。L0 token の実在する分散 ownership と、
  Vitest + Playwright/axe の現行 test stack に検証記述を合わせた。
- 0.1.3-draft (2026-07-31): WP-5101 fresh-context checker(3 lane)findings 反映 —
  EvidenceDrawer から監査メタを削除し current UIX-001 §11/SEC-005 の明示禁止へ整合(C-1)、
  Phase A の「全緑=挙動不変」主張を検出力の実態へ訂正し受入へ静的検査+a11y を追加(H-4)、
  RTL ハーネス未導入を blocker 化(H-5)、予約へ BoardShell / ConfirmationQueueRail /
  StageLockIndicator / StageReturnAction を追加(M-12)、禁止8項→12項(M-2 / H-6 / L-1)、
  台帳外禁止の適用範囲を共通コンポーネントへ限定し既存コードへ経過措置(M-11)、
  「2段分離」の語義明確化(H-7)、WP-3011b/c の active queue 不在を明示(LOW-15)、
  WP-4253 の commit 済み事実へ blocker 記述を訂正(M-13)。
- 0.1.2-draft (2026-07-31): 敵対的レビュー(17号)反映 — §2 を Phase A/B 二相へ訂正(SF-1)、§4 予約へ `BoardViewSwitcher` / `FinalizeAndRegisterAction` を追加(SF-6 / D-1 / D-2)。
- 0.1.1-draft (2026-07-31): §4 を丁「一枚盤面」採用(14号決定記録)へ改訂。丁が要求する新規コンポーネント4種を予約として追加、workflow-stage enum 起案を必須化。
- 0.1.0-draft (2026-07-31): 初版起草(ユーザー指示「UIは共通コンポーネントを導入。SSOT文書を作り、yrese内のUIUXルールをベースに構築する」による)。non-SSOT 作業領域に起草し、昇格は §8 に従う。
