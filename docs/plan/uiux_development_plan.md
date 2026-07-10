# uiux_development_plan — UI/UX 開発計画(Phase UI-1〜UI-6)

```yaml
ssot_id: PLAN-UIUX-001
title: UI/UX 開発計画
domain: plan
status: PROPOSED
owner: codex_root
reviewers:
  - independent_verifier
  - frontend_reviewer
  - ui_flow_tester
  - accessibility_ux_reviewer
  - human_review_if_required
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-10
approved_at:
approved_by:
effective_from:
effective_to: null
source_refs:
  - 構築プロンプト v0.2.0 §7(医療UI原則)
  - ユーザー指示 2026-07-09(component.gallery 活用)
  - docs/agents/codex_single_lane_operating_model.md
depends_on: [AGT-018, UIX-001, UIX-002, UIX-003, UIX-004, UIX-006, UIX-007, API-001, API-002, PRD-008]
impacts: [UIX-007(画面台帳の実装状態更新), Plans.md WP-3006以降]
related_work_packages:
  - WP-3006
  - WP-9001
related_tests:
  - pnpm check:ssot-index
related_prs: []
evidence_ids: []
change_log:
  - 0.1.1 2026-07-10 direct user instruction (WP-9001) により現行UI routingをAGT-018のsole Codex maintainer + independent/domain reviewersへ切替。本文の旧role/model名はprovenanceとして保持
  - 0.1.0 2026-07-09 初版起案
open_questions: 受付キュー・処方・調剤・会計の各API契約SSOT(未起草)の採番と起草順
blockers: []
```

> [!IMPORTANT]
> **proposed UI routing (2026-07-10):** 本文中の旧model名、旧role名、旧lane、旧review呼称は過去の計画provenanceであり、新規Work Packageへコピーしない。AGT-018と本改版がAPPROVEDになった後、`apps/web/**`を含むUIのeditorはactive scopeごとにsole Codex maintainer 1名とする。実装前にread-only mapper / pre-plan reviewer、実装後にmakerとは別contextの`independent_verifier`、`frontend_reviewer`、`ui_flow_tester`、`accessibility_ux_reviewer`が確認する。U4画面・横断安全componentは`medical_safety_reviewer`と`privacy_compliance_reviewer`を必須追加し、薬剤師による専門判断、患者安全・請求安全の人間review/approval gateを省略しない。Codex rootだけがverification後にowned exact pathをstageし、commit/push要件を満たす。WP-9001自体はdirect user instructionにより同routingで実行中である。

## 1. 目的と上位方針

`apps/web/**`をCodex単一レーンのsole maintainerが担当し、画面台帳 UIX-007 の29画面に対してUI/UXを段階的に実装するための実行計画。次を上位方針とし、本計画はそれらを変更しない。

1. **医療UI原則(UIX-001 / v0.2.0 §7)**: 患者文脈の常時固定表示(PatientHeader)、状態は色だけに依存せずテキストラベル併記、システムモード常時可視。U4画面はindependent verifier、`medical_safety_reviewer`、`privacy_compliance_reviewer`、accessibility/flow reviewersと、該当する人間薬剤師・患者安全authorityのreviewを必須とする
2. **contract-first / dogfooding(API-002)**: UI は @yrese/contracts の zod 契約経由でのみ API を呼ぶ。契約外フィールドの仮定禁止、抜け道 API 禁止
3. **fail-closed の可視化**: BLOCKED・PENDING 系ステータスを隠さない。「なぜ操作できないか」を理由付きで表示する(UIX-007 SCR-013/026 の趣旨)
4. **デザイン参照規律(ユーザー指示 2026-07-09)**: 新規コンポーネントの設計前に The Component Gallery(https://component.gallery/components/)で標準パターン・命名・バリエーション・a11y 慣行を確認し、独自発明を避ける。医療UI原則と衝突する場合は医療UI原則が優先
5. **シンプル実装**: packages/ui 化は第二利用者出現時(既決)。コンポーネントは apps/web/app/components/ に置き、投機的な汎用化をしない

## 2. 現状(2026-07-09)

- 実装済み: シェル+9ルート(業務順ナビ)、SystemModeBadge、PatientHeader(SCR-003)、患者検索 UI(SCR-002 基本形)、shell-smoke 10テスト
- 利用可能な基盤: 患者検索契約(API-001 v0.2.1)、calculation 5ルール+trace 型(CAL-008 拡張済み)、SYSTEM_MODES 判定関数、エラー契約(errorResponseSchema)
- BLOCKED(外部依存): SCR-005(JAHIS)/006/008(ONS=WP-0016)/009(PMH)/021(記録条件 evidence)

## 3. 実装波(Phase UI-1〜UI-6)

依存が満たされた波から着手する。**各画面の実装前に UIX-007 の該当行を確認し、台帳にない画面は実装しない。**

### Phase UI-1: デザイン基盤(依存なし — 即時着手可)

- **WP-3006 デザイントークン+共通状態コンポーネント基盤**
  - CSS カスタムプロパティによるトークン(色・タイポ・余白・状態色。状態色は必ずテキストラベルとペア)
  - 共通コンポーネント: StatusBadge(PENDING系/VERIFIED系のテキスト+色)、BlockerBanner(BLOCKER 理由+次アクション)、SeverityList(BLOCKER/CRITICAL/WARNING/INFO — UIX-001 §5)、EmptyState、LoadingState
  - component.gallery で badge / banner / alert / empty-state の標準パターン・命名を照合してから設計
  - 既存 SystemModeBadge / PatientHeader をトークンに載せ替え(挙動不変)
- **WP-3007 SCR-013 横断警告・エラー・BLOCKER 表示(U4)**
  - WP-3006 の SeverityList を業務画面共通のエラー境界・警告領域として配線
  - エラーコード(AUTH-0003/PAT-0001 等)と「次のアクション」の対提示
  - **opus4.8 医療安全レビュー必須**(横断 U4)

### Phase UI-2: 受付・患者線(依存: API-001 済み — UI-1 完了後)

- **WP-3008 SCR-002 患者検索強化(U4)**: 同姓同名警告・類似候補の区別表示(カナ・生年月日の並置強調)。WP-4037(stale response/race guard)・WP-4038(dev header 本番境界)を統合。opus4.8 医療安全レビュー必須
- **WP-3009 SCR-001 受付ダッシュボード実体化(U2)**: 受付キュー表示。**前提: 受付キュー API 契約 SSOT の起案→codex 実装可能性レビュー→APPROVED**(API-001 と同じ手順)。契約起草は本 WP に含む
- **WP-3010 SCR-026 LOCAL_ONLY モード UX(U4)**: モード別の禁止操作一覧+理由表示。shared-kernel 判定関数(canConfirmExternal 等)を唯一の判定源とし、UI 側で独自判定しない。opus4.8 レビュー必須

### Phase UI-3: 説明可能性・運用線(依存: trace 型済み/events 型済み)

- **WP-3011 SCR-012 calculation_trace ビューア(U3)**: 既存5ルールの算定 trace(evidenceRef・ルール版・適用/除外理由)の表示。品質柱「証明可能な品質」(QUA-007 L2)の最初の UI 実装。点数の新規計算はしない(表示のみ)
- **WP-3012 SCR-025 同期状態画面の実体化(U2)**: Outbox/Inbox キュー・dead_letter 件数・queue age 表示。**前提: 同期状態 API 契約 SSOT**(起草含む)
- **WP-3013 SCR-024 外部連携状態(U2)**: Adapter 稼働状態の一覧(EXTERNAL_DEGRADED 詳細)。SCR-025 と契約を共有できる場合は統合を検討(台帳更新が先)

### Phase UI-4: 処方・調剤線(依存: 処方・調剤ドメイン契約 SSOT — 未起草)

- **WP-3014 処方・調剤 API 契約 SSOT パック起草**(fable5)→ codex 実装可能性レビュー → APPROVED 後に:
- **WP-3015 SCR-004 処方入力(U4)** / **WP-3016 SCR-010 調剤入力+SCR-014 薬剤師確認(U4)**: 仮/確定・薬剤師確認前後の状態区別を UIX-001 準拠で表示。いずれも opus4.8 医療安全レビュー必須
- SCR-015 疑義照会は SCR-004 の後続(照会中/回答済み状態)

### Phase UI-5: 算定・会計線(依存: WP-2201/2202 会計・領収証バックエンド契約)

- **WP-3017 SCR-011 算定結果(U3)**: 仮算定/確定・警告・BLOCKER の区別表示。copay BLOCKED の間は「点数のみ・負担金 BLOCKED(根拠不足)」を正直に表示(POINTS_ONLY_COPAY_BLOCKED の UI 化)
- **WP-3018 SCR-016 会計+SCR-017 未収・返金(U3)**: 未入金の領収済み表示禁止(fail-closed)を UI で強制。ACC 系 SSOT の PATIENT/PAYMENT ステータスに追従
- **WP-3019 SCR-018 帳票出力(U3)**: 領収証・明細書の出力履歴・再発行(RCP 系 SSOT 準拠、再発行の理由必須)

### Phase UI-6: 請求線(依存: CLM 系実装 — 大半 BLOCKED)

- **WP-3020 SCR-019 請求前点検(U3)** / **WP-3021 SCR-020 月次締め(U4)**: 月次締めは NORMAL モードのみ活性(allowsClaimFinalization)+締め状態の不可逆性を明示。U4 は opus4.8 レビュー必須
- SCR-021 レセプト出力・SCR-022 返戻は evidence/CLM 実装解除後に採番

### 保留(外部依存解除待ち)

SCR-005(JAHIS 2D)/ SCR-006・008(ONS = WP-0016 人間作業)/ SCR-009(PMH)/ SCR-028 監査ログ閲覧(WP-2009 ハッシュチェーン後)/ SCR-029 管理(認証基盤の本実装後)

## 4. 品質ゲート(全 WP 共通)

1. コンポーネント/画面テスト必須(vitest + Testing Library。--passWithNoTests は既に禁止)
2. 契約検証: レスポンスは必ず contracts の zod schema で parse(既存 patient-search の方式を踏襲)
3. a11y: UIX-004 受入基準 + 色非依存(テキストラベル必須)・キーボード操作・role/aria の基本確認をレビュー項目化
4. U4 画面と横断コンポーネントは opus4.8 医療安全レビューを実装後に必須(UIX-007 運用ルール)
5. 性能: UIX-003 の性能予算に収まること(初期は計測基盤のみ。数値ゲート化は OPS 系と同期)
6. PHI をログ・計測・エラーメッセージへ出さない(SEC-004)

## 5. 実行順序と当面のコミットメント

```
UI-1(WP-3006→3007)→ UI-2(WP-3008→3009→3010)→ UI-3(WP-3011→3012→3013)
以降 UI-4/5/6 は各契約 SSOT の APPROVED を発行条件とする(fail-closed: 契約なしに画面を作らない)
```

- 第1弾として WP-3006 / WP-3007 / WP-3011 を近日着手(依存が全て満たされているため)
- 各 WP 完了時に UIX-007 の「実装状態」列を更新する(台帳が実態を反映し続けること)

## 変更履歴

- 0.1.1 (2026-07-10): direct user instruction (WP-9001) により、現行routingをAGT-018のsole Codex maintainer、independent verifier、frontend/UI-flow/accessibility reviewersへ変更。U4のmedical/privacy reviewerと既存の薬剤師・人間gateを維持。本文の旧role/model名は歴史的provenanceとして保持。
- 0.1.0 (2026-07-09): 初版起案(ユーザー指示「UIUXの今後の開発計画」による)。
