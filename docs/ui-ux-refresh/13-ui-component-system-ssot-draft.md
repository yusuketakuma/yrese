# 13 — UI共通コンポーネントシステム SSOT ドラフト(UIX-008 候補)

> **DRAFT / PROPOSED — 本書は non-SSOT 作業領域(`docs/ui-ux-refresh/`)上の起草文書である。**
> 正式 SSOT への昇格(`docs/uiux/ui_component_system.md` への移設・UIX-008 採番確定・
> `docs/ssot_index.md` 登録)は PRC-007 の10段改版フローに従い、現在 exact11 batch が
> 保全している `docs/ssot_index.md` の dirty ownership が解消(landing)した後に行う。
> それまで本書は承認・実装・準拠を主張しない。

```yaml
# 昇格時に確定する frontmatter 案
ssot_id: UIX-008        # 候補採番(UIX-001..007 の次。PRC-007 で確定)
title: UI共通コンポーネントシステム
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
  - human_review_required
version: 0.1.0-draft
created_at: 2026-07-31
source_refs:
  - docs/spec/construction_prompt_v0.2.0.md §7, §16
  - ユーザー指示 2026-07-31(UIは共通コンポーネントを導入。SSOT文書を作り、yrese内のUIUXルールをベースに構築する)
  - docs/ui-ux-refresh/08-target-design-direction.md(視覚的状態言語)
  - docs/ui-ux-refresh/12-component-contracts.md(コンポーネント契約)
  - デザイン探索ボード 2026-07-31(甲乙丙+五構造 — 別紙 Artifact bcc10e46)
  - 一枚盤面プロトタイプ 2026-07-31(丁 — 別紙 Artifact cb24845f)
  - docs/ui-ux-refresh/14-one-board-direction-decision.md(丁採用の決定記録 2026-07-31)
depends_on: [UIX-001, UIX-002, UIX-003, UIX-004, UIX-006, UIX-007, PLAN-UIUX-001, API-002]
impacts: [apps/web/**, docs/plan/uiux_development_plan.md]
open_questions: 本文 §9 参照
blockers:
  - BLOCKED_SSOT_INDEX_DIRTY(exact11 landing 前は docs/ssot_index.md へ登録しない)
  - apps/web の WP-4254/4255 未コミット slice の landing 前は実装 WP を発行しない
    (WP-4253 はローカル commit 済み 9d8dbc0 — 2026-07-31 checker M-13 訂正)
  - RTL/jsdom 相当の DOM テストハーネスは apps/web に未導入(devDependencies に
    jsdom / Testing Library なし — 2026-07-31 checker 実測)。§5-4 / §7 の RTL 前提の
    検証はハーネス整備 WP(未登載)の成果を前提とし、それまで実装 WP を発行しない
```

## 1. 目的と適用範囲

`apps/web/**` の全画面(UIX-007 active 28画面)は、状態表示・患者文脈・警告・確認操作・
ローディング/空/エラー表示を**本書が台帳化する共通コンポーネント経由でのみ**表現する。
画面ローカルでの状態表現の直接実装(hex 直指定・自由ラベルのドメイン状態・独自 severity)は禁止する。

本書は次を再定義しない(上位正本をそのまま参照する):

- 優先順位・原則 P-01..P-20・禁止15項・警告重要度5段 — **UIX-001**(APPROVED)
- 業務導線・モード分岐・ロール別ホーム — **UIX-006**(APPROVED)
- 画面台帳・ux_safety_level(U0..U4)— **UIX-007**(APPROVED)
- 実装波・品質ゲート — **PLAN-UIUX-001**
- contract-first(zod 契約経由のみの API 呼出)— **API-002**

## 2. レイヤ構造(5層)

| 層 | 内容 | 正本 | 変更の自由度 |
|---|---|---|---|
| L0 | デザイントークン(CSS custom properties: 色・タイポ・余白・密度・状態色) | `apps/web/app/globals.css` | **高** — デザイン方向(甲/乙/丙)の差し替えはこの層のみで行う |
| L1 | 状態表現の単一正本(domain×key → label/tone/shape/ARIA) | `apps/web/app/status/visual-status-registry.ts` | 低 — ドメイン enum SSOT 承認後のみ軸追加 |
| L2 | 基礎コンポーネント(バッジ・リスト・バナー・ダイアログ・状態画面) | `apps/web/app/components/` | 中 — 本書の契約と追加手順(§5)に従う |
| L3 | 業務複合コンポーネント(PatientHeader・ClinicalAlert・trace viewer 等) | 同上 | 中 — U4 該当はレビュー体制必須 |
| L4 | 画面(UIX-007 の SCR-xxx) | `apps/web/app/**/page.tsx` | 画面は L0-L3 を組み合わせるだけ。独自の状態表現を持たない |

**核となる規律(2026-07-31 敵対的レビュー SF-1 により二相へ訂正)**: 刷新は性質の異なる二相に分離する。

- **Phase A(視覚テーマ = L0 のみ)**: 甲乙丙のトークン差し替え。L1 以上の契約・文言・DOM 構造を
  変えない。**ただし「既存テスト全緑」を挙動不変の証跡と呼ばない**(2026-07-31 checker 訂正):
  現行 web テストは renderToStaticMarkup による静的マークアップ検証のみで、スタイルを
  一切観測せず(`toHaveStyle`/`getComputedStyle` 使用ゼロ)、`globals.css` はテストの
  レンダリング経路に入らない。全緑が証明するのは「L1 以上を触っていない」ことまでである。
  Phase A の受入は既存テスト全緑**に加えて**、(a) L0 トークン参照の静的検査
  (hex 直指定の残存ゼロ — 現行 `globals.css` には `#f0f2f5` 等の直指定が複数残存し
  §6-1 に自ら違反している。Phase A はその解消を含む)、(b) §7 の a11y 検証
  (forced-colors / reduced-motion / コントラスト)を必須とする。
- **Phase B(丁 一枚盤面 = L2〜L4 構造変更)**: 画面構成・遷移・コンポーネント合成が変わるため、
  既存テストは**壊れることが正常**。回帰証跡は「L1 Registry の文言・ARIA 網羅テスト不変」+
  「新盤面の新規テスト(14号 §7 の投影・ロック・確定演出を含む)」で構成し、
  既存テスト全緑を Phase B の証跡として主張しない。

「見た目の刷新」と「安全規律の回帰試験」の分離という価値は Phase A にのみ成立する。

## 3. コンポーネント台帳(2026-07-31 実在確認済み)

分類は `docs/ui-ux-refresh/12-component-contracts.md` の契約を正とし、本書は台帳(存在・分類・状態)を持つ。
契約詳細は 12 号を参照(重複記載しない)。

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
| PatientHeader | `components/patient-header.tsx` | ✅ 実装済 | P-09。氏名・カナ・生年月日・年齢・性別・資格状態 |
| PatientContextProvider / Bar | `components/patient-context.tsx` | ✅ 実装済 | 全画面横断固定。別患者選択で前文脈破棄 |

### 3.3 警告・エラー・確認(L2/L3)

| コンポーネント | ファイル | 状態 | 備考 |
|---|---|---|---|
| ErrorNotice + error-code | `components/error-notice.tsx` / `error-code.ts` | ✅ 実装済 | エラーコード+次アクションの対提示(P-18) |
| BlockerBanner | `components/blocker-banner.tsx` | ✅ 実装済 | BLOCKER 理由+次アクション |
| ClinicalAlert / Summary | `components/clinical-alert.tsx` | ◐ 表示層のみ | **判定エンジン接続前に医療安全レビュー+SaMD 該当性評価必須** |
| ConfirmationDialog / DestructiveActionDialog | `components/confirmation-dialog.tsx` | ✅ 実装済 | P-11 二段階確認。focus trap は呼出側 client 装着 |

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
   28画面の写像表と前提条件は 14号 §2/§4 を正とする。
2. **甲乙丙 = L0 トークンテーマ**。`globals.css` のトークンセット差し替えで実現し、コンポーネント契約は不変。
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
     UIX-006 §4「監査イベントは一般業務Webへ表示しない」と SEC-005「一般薬剤師向けWeb画面は
     提供しない」の明示禁止に従う(SCR-028 RETIRED を別名で復活させない — 2026-07-31 checker C-1 訂正)
   - `BoardViewSwitcher` — ロール別ビューの投影切替(14号 §7.1)。**権限を一切変更しない**
     (capability の正は MOD-007 + API scope — 17号 D-1/SF-6)
   - `FinalizeAndRegisterAction` — 薬剤師最終確定の1操作・2段分離。**「2段」= 段1 ローカル確定
     (不可逆)/ 段2 外部登録(outbox 再試行)であり(17号 §2)、DOM-004 の2つの確認行為
     (`prescription:confirm` / `dispensing:confirm`)の統合を意味しない** — その統合可否は
     DOM-004 改版(WP-5102)の承認事項であり本コンポーネントの前提(2026-07-31 checker H-7 訂正)。
     完了表現は「確定」chip と「登録」chip を併置し単一成功表現で束ねない(H-03)
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

1. **The Component Gallery**(https://component.gallery/components/)で標準パターン・命名・a11y 慣行を照合(ユーザー指示 2026-07-09。医療UI原則と衝突時は UIX-001 優先)
2. 契約起草 — `12-component-contracts.md` へ Purpose / Props / ARIA / Prohibited / Tests を追記
3. ドメイン状態を扱う場合: 対応 enum が shared-kernel SSOT に存在することを確認。無ければ **enum SSOT 承認まで実装しない**(予約として設計のみ記録)
4. Registry 軸追加(必要時)→ コンポーネント実装 → vitest + Testing Library テスト(--passWithNoTests 禁止)
5. U4 該当(患者文脈・薬剤師確認・外部未確認状態・請求確定に影響)は medical_safety_reviewer / privacy_compliance_reviewer / accessibility レビュー+必要な人間承認を実装後に必須
6. 本書 §3 台帳へ行を追加(台帳にないコンポーネントを画面から import しない)

## 6. 禁止事項

1. 画面・コンポーネントでの hex/色 直指定(L0 トークン経由のみ)
2. 色単独・アイコン単独の状態表現(label 必須 — P-20)
3. ドメイン状態の自由 label/tone 表示(DomainStatusBadge / Registry を迂回しない)
4. UI 側での独自モード・権限判定(shared-kernel 判定関数と API 側制御が正 — P-14)
5. ローカル保存・仮状態・確認前状態に確定と同じ成功表現を使うこと(P-05/06/07/17)
6. PHI をログ・計測・エラーメッセージ・テストフィクスチャへ出すこと(SEC-004)
7. `packages/ui` への投機的移動(第二利用者出現まで `apps/web/app/components/` — 既決)
8. 台帳外コンポーネントの新設・台帳外画面からの利用
   (**適用範囲は共通コンポーネント(L1〜L3)**。既存の画面ローカル構成要素
   — `nav.tsx` の BusinessNav、`reception-dashboard.tsx`、`patients/patient-search.tsx` 等 —
   は昇格時点の経過措置として存続し、UIX-008 昇格改版で台帳登録か廃止かを個別判断する。
   起草時点の既存コードを遡及的に SSOT 違反としない — 2026-07-31 checker M-11 訂正)
9. 無言のグレーアウト・無言の操作不能化(「誰が・なぜ」の理由提示を必ず添える — 14号 §7.2)
10. 理由(reason)なしの BLOCKED 表示(15号 §3 の型契約と同一規律)
11. 破壊的・不可逆操作のワンクリック実行(UIX-001 禁止12 — 二段階確認 P-11 を経る)
12. 操作数削減を患者安全・情報の常時可視性(P-01)より優先する設計判断(UIX-001 禁止15)。
    密度段階(圧縮)でも状態 chip のラベルを省略しない(P-20)

## 7. 検証

- 単体: 各コンポーネントの RTL テスト(状態網羅・ARIA・色非依存)。Registry は網羅性を型+テストで担保。
  **前提**: RTL/jsdom ハーネスは apps/web に未導入(frontmatter blockers 参照)。
  ハーネス整備 WP の完了が全 RTL 要件の前提であり、それまで「テストで担保」を主張しない
- 回帰: L0 差し替え時は既存テスト全緑(=L1 以上の契約・文言・DOM 構造の不変)**に加えて**、
  L0 トークン参照の静的検査と下記 a11y 検証を証跡とする(§2 の訂正どおり、
  全緑単独を挙動不変の証跡と呼ばない)
- a11y: UIX-004 受入基準+forced-colors / reduced-motion / キーボード操作
- 性能: UIX-003 予算内(トークン差し替えで CSS サイズ・CLS を悪化させない)

## 8. 昇格手順(fail-closed)

1. 本ドラフトのレビュー(frontend / accessibility / independent)
2. exact11 batch の landing により `docs/ssot_index.md` の dirty ownership 解消
3. `docs/uiux/ui_component_system.md` へ移設、UIX-008 採番確定、frontmatter 正式化、ssot_index 登録(PRC-007 10段)
4. PLAN-UIUX-001 の Phase UI-1(WP-3006)を本書参照へ改版
5. 実装 WP は Plans.md の queue 規律(WIP=1 / READY≤2)に従い登載後に claim

## 9. Open questions

- workflow-stage enum の SSOT 粒度・所在 — **丁採用により必須化** → **15号として起案済み(2026-07-31)**。残る論点は 15号 §9(薬剤師確認の位置の DOM-004 突合ほか)【レビュー待ち】
- L0 テーマ(甲乙丙)の選定と、薬局ごとの複数保持を許すか全テナント単一か(製品判断)【要確認】
- 丁の並行作業ロック表現・タブレット縮退・密度既定値(14号 R-2/R-3/R-4)【要設計・薬剤師レビュー】
- 密度段階(標準/圧縮)と高齢患者向け拡大表示の対象画面範囲(UIX-001 §6 の既存要確認と統合)【薬剤師レビュー】

## 変更履歴

- 0.1.3-draft (2026-07-31): WP-5101 fresh-context checker(3 lane)findings 反映 —
  EvidenceDrawer から監査メタを削除し UIX-006/SEC-005 の明示禁止へ整合(C-1)、
  Phase A の「全緑=挙動不変」主張を検出力の実態へ訂正し受入へ静的検査+a11y を追加(H-4)、
  RTL ハーネス未導入を blocker 化(H-5)、予約へ BoardShell / ConfirmationQueueRail /
  StageLockIndicator / StageReturnAction を追加(M-12)、禁止8項→12項(M-2 / H-6 / L-1)、
  台帳外禁止の適用範囲を共通コンポーネントへ限定し既存コードへ経過措置(M-11)、
  「2段分離」の語義明確化(H-7)、WP-3011b/c の active queue 不在を明示(LOW-15)、
  WP-4253 の commit 済み事実へ blocker 記述を訂正(M-13)。
- 0.1.2-draft (2026-07-31): 敵対的レビュー(17号)反映 — §2 を Phase A/B 二相へ訂正(SF-1)、§4 予約へ `BoardViewSwitcher` / `FinalizeAndRegisterAction` を追加(SF-6 / D-1 / D-2)。
- 0.1.1-draft (2026-07-31): §4 を丁「一枚盤面」採用(14号決定記録)へ改訂。丁が要求する新規コンポーネント4種を予約として追加、workflow-stage enum 起案を必須化。
- 0.1.0-draft (2026-07-31): 初版起草(ユーザー指示「UIは共通コンポーネントを導入。SSOT文書を作り、yrese内のUIUXルールをベースに構築する」による)。non-SSOT 作業領域に起草し、昇格は §8 に従う。
