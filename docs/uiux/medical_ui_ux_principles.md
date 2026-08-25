# medical_ui_ux_principles — yrese UI/UX 基盤

```yaml
ssot_id: UIX-001
title: yrese UI/UX 基盤
domain: uiux
status: PROPOSED
owner: codex_root
reviewers:
  - independent_verifier
  - frontend_reviewer
  - ui_flow_tester
  - accessibility_ux_reviewer
  - medical_safety_reviewer
  - security_critic
  - privacy_compliance_reviewer
  - api_contract_reviewer
  - data_integrity_auditor
  - test_architect
  - claim_clerk_workflow_reviewer
  - human_pharmacist_workflow_authority
  - human_product_authority
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-08-26
approved_at:
approved_by:
effective_from:
effective_to: null
source_snapshot_commit: 9786fe8eab3da97213d5b641b725531b13f10290
source_refs:
  - docs/spec/construction_prompt_v0.2.0.md §7, §8, §9.3, §12, §15, §16
  - docs/uiux/experience_quality_baseline.md UIX-002 v0.1.0
  - docs/uiux/performance_budget.md UIX-003 v0.1.0
  - docs/uiux/usability_acceptance_criteria.md UIX-004 v0.1.0
  - docs/uiux/stability_slo_policy.md UIX-005 v0.1.0
  - docs/uiux/workflow_map.md UIX-006 v0.2.0
  - docs/uiux/screen_inventory_draft.md UIX-007 v0.2.0
  - docs/ui-ux-refresh/08-target-design-direction.md
  - docs/ui-ux-refresh/12-component-contracts.md
  - docs/ui-ux-refresh/13-ui-component-system-ssot-draft.md v0.1.7-draft
  - docs/ui-ux-refresh/14-one-board-direction-decision.md
  - docs/ui-ux-refresh/15-workflow-stage-enum-ssot-draft.md
  - docs/ui-ux-refresh/17-adversarial-review-and-new-requirements.md
  - docs/regulatory/legal_compliance_matrix.md REG-003 §7
  - docs/regulatory/regulatory_blockers.md REG-004 RB-003
  - design exploration board artifact bcc10e46 (2026-07-31)
  - one-board prototype artifact cb24845f (2026-07-31; repository外provenance。screen mapping authorityには使わない)
  - direct_user_instruction 2026-08-26 (Candidate A選択。未決のmedical-safety/privacy/accessibility/pharmacist判断は各該当gateへ委譲)
depends_on:
  - docs/product/mvp_scope.md
  - docs/architecture/offline_mode_matrix.md
  - docs/architecture/recovery_sync_design.md
  - API-002
  - API-009
  - API-012
  - API-013
  - DOM-004
  - MOD-007
  - MOD-008
  - MOD-009
  - REG-003
  - REG-004 RB-003
  - SEC-006
  - SEC-007
  - PRC-007
  - PLAN-UIUX-001
impacts:
  - apps/web/**
  - docs/plan/uiux_development_plan.md
  - docs/testing/test_strategy.md
  - docs/quality/**
  - docs/operations/**
related_work_packages:
  - WP-5101
  - WP-5104
  - WP-5105
  - WP-5111
  - WP-5112
  - WP-5113
  - WP-5121
  - WP-5122
  - WP-5123
  - WP-5124
related_tests:
  - pnpm check:ssot-index
  - pnpm --filter @yrese/web test
  - pnpm --filter @yrese/web typecheck
  - node scripts/ui-browser-check.mjs (isolated CI harness)
related_prs:
  - Draft PR #5
evidence_ids: []
change_log:
  - 0.2.0 2026-08-26 PROPOSED Candidate A: UIX-002〜007とcomponent-system規律をUIX-001へ集約。final approval前は実装根拠にしない
  - 0.1.2 2026-07-11 Visual Status Registry実装対応を追加。旧APPROVED版
  - 0.1.1 2026-07-09 警告重要度へERRORを追加。旧APPROVED版
  - 0.1.0 2026-07-09 初版APPROVED
open_questions:
  - L0 theme、density、tablet縮退、lock表現は本文 §17 の該当gateで確定
  - 高齢患者向け拡大表示、常設キューの氏名表示、薬剤師確認位置は本文 §17 の該当gateで確定
blockers:
  - BLOCKED_FINAL_HUMAN_SSOT_APPROVAL
  - BLOCKED_MEDICAL_SAFETY_REVIEW
  - BLOCKED_SECURITY_REVIEW
  - BLOCKED_PRIVACY_REVIEW
  - BLOCKED_ACCESSIBILITY_REVIEW
  - BLOCKED_PHARMACIST_WORKFLOW_REVIEW
  - BLOCKED_SCREEN_TO_BOARD_MAPPING_SOURCE
  - BLOCKED_DOM004_FINALIZE_TRANSITION_AMENDMENT
  - BLOCKED_RB003_ELECTRONIC_PRESCRIPTION
  - BLOCKED_HPKI_LEGAL_CLASSIFICATION
  - BLOCKED_OUTBOX_DELIVERY_PROFILE
  - BLOCKED_L0_TOKEN_AUTHORITY_RECONCILIATION
  - BLOCKED_PERFORMANCE_SLO
  - BLOCKED_USABILITY_ACCEPTANCE
  - BLOCKED_STABILITY_VALIDATION
```

> **PROPOSED / REVIEW ONLY:** Candidate AのPRC-007 review revisionである。finalizationまでは
> UIX-001〜007の既存APPROVED版が現行根拠であり、本revisionを実装根拠にしない。

§4、§12、§13の「実装済み」「current」「file対応」はsource snapshot上のfile/symbol/rendering
inventoryだけを表し、runtime integration、authorization enforcement、production readiness、test PASSを意味しない。

## 1. 優先順位

UI/UX のあらゆる判断は次の優先順で行う。下位の価値のために上位を犠牲にしてはならない。

**患者安全 > 医療安全(誤調剤・誤操作防止)> 誤請求防止・監査証跡・法令適合性 > 視認性・説明可能性・業務継続性 > 入力効率・キーボード操作 > 見た目**

v0.2.0 §7 の優先項目(薬剤師確認 / 障害時の誤認防止 / 権限管理 / 現場デバイス対応 / 高齢患者対応 / 混雑時対応 / 多職種利用 / アクセシビリティ)はすべてこの枠内で扱う。

## 2. 基本原則(正式版)

| # | 原則 | 補足 |
|---|---|---|
| P-01 | 重要情報を隠さない | 折りたたみ・タブの裏に安全情報を置かない |
| P-02 | 外部確認未完了状態を明確に表示する | PENDING_REVERIFY / PENDING_EXTERNAL_SYNC / PENDING_PMH_REVERIFY は常時可視 |
| P-03 | オフライン状態(LOCAL_ONLY等)を全画面で明示する | グローバルヘッダー固定表示 |
| P-04 | 請求不可状態を明確に表示する | isClaimable=false のデータは請求可能に見せない |
| P-05 | 仮算定と確定算定を明確に区別する | PROVISIONAL_CALCULATION はラベル+枠で区別 |
| P-06 | 仮保存と確定を視覚・文言両方で区別する | ボタン形状・ラベル・確認手順を変える |
| P-07 | 薬剤師確認前と確認後を明確に区別する | 確認者・確認日時を表示 |
| P-08 | 警告疲れを防ぎつつ重大警告を埋もれさせない | 警告重要度分類(§5)に従う |
| P-09 | 患者取り違えを防ぐ | 認証済み患者業務フローで患者選択後、氏名+カナ+生年月日+年齢+性別を同フローの全画面に固定表示。待合表示・共用表示・support面には投影しない |
| P-10 | 類似医薬品名・規格違い・剤形違いを取り違えにくくする | 差分強調表示。サジェストで誤薬を誘発しない |
| P-11 | 破壊的操作は二段階確認+権限確認 | ワンクリック実行禁止 |
| P-12 | 取消・訂正・再計算・返金・再請求は履歴を残す | 履歴の不可視化禁止 |
| P-13 | 金額の根拠を薬剤師・事務が説明できる | calculation_trace への導線を算定結果に常設 |
| P-14 | UIだけで権限制御せず、API側でも制御する | requirePermission(deny-by-default)と対 |
| P-15 | アニメーション・装飾を優先しない | 機能表示を優先 |
| P-16 | ダークパターン・広告誘導・患者誘導を禁止する | 業務画面に宣伝表現を混在させない |
| P-17 | 誤認を招く緑チェック・完了表示を安易に使わない | 「完了」は根拠のある確定状態のみ |
| P-18 | エラーは「何が危険か」「何を確認するか」「請求できるか」を明示する | error code(AUTH-0003等)を併記 |
| P-19 | 障害時は「できること」「できないこと」「復旧後に必要なこと」を明示する | offline_mode_matrix と文言を同期 |
| P-20 | 色だけに依存しない状態表現 | ラベル・形状・アイコンを併用 |

## 3. 禁止事項(v0.2.0 §7 全15項)

1. オフライン処理をオンライン確認済みのように見せること
2. PENDING_REVERIFY を目立たない場所に隠すこと
3. PENDING_EXTERNAL_SYNC を成功扱いに見せること
4. PENDING_PMH_REVERIFY を成功扱いに見せること
5. 算定根拠不明の金額を確定額のように表示すること
6. 請求不可データを請求可能に見せること
7. 薬剤師確認前の処方・調剤を確定済みのように見せること
8. 返戻・再請求・訂正履歴を見えなくすること
9. 監査ログを一般ユーザーが改ざん可能にすること
10. 権限外操作をUIだけで隠し、API側で制御しないこと
11. 視覚的に似たボタンで「仮保存」と「確定」を混同させること
12. 破壊的操作をワンクリックで実行すること
13. 特定薬局・特定サービス・特定商品へ不適切に誘導すること
14. 医療広告・宣伝的表現を業務画面に混在させること
15. 患者安全より販売促進や操作短縮を優先すること

## 4. 原則→実装対応(2026-07-09 時点)

| 原則 | 実装 | 場所 / コミット |
|---|---|---|
| P-03, P-20 | SystemModeBadge: 5モードを日本語ラベル+data-mode背景で常時表示(色非依存、role="status") | apps/web/app/system-mode-badge.tsx(12a5ac2) |
| P-02, P-09, P-20 | PatientHeader: カナ併記・生年月日+年齢・資格確認状態のテキストラベル(VERIFIED/PENDING_REVERIFY/LOCAL_ONLY_UNVERIFIED/NOT_CHECKED)+最終確認日時 | apps/web/app/components/patient-header.tsx(1acfa3f) |
| P-04 | isClaimable(): 保留・対象外ステータスが1つでもあれば請求データ生成不可(API側の単一実装) | packages/shared-kernel status.ts(9ab039e) |
| P-14 | PermissionScope型・定数はshared-kernel、deny-by-defaultの`requirePermission` enforcement(403 + AUTH-0003)はAPI tenant-context plugin | packages/shared-kernel/src/permissions.ts / apps/api/src/plugins/tenant-context.ts |
| 直感性(業務順ナビ) | BusinessNav: 受付→患者→処方入力→会計→請求前点検→月次締めの業務順 | apps/web/app/nav.tsx(2b195b5) |
| キーボード操作 | :focus-visible フォーカスリング常時明示 | apps/web/app/globals.css(12a5ac2) |
| P-17, P-20, P-08 | Visual Status Registry: ドメイン状態キー→label/tone/形状/ARIA を単一正本で決定。色/形単独禁止・severity 別 live region。既存ラベルマップ(MODE/ELIGIBILITY/RECEPTION/SEVERITY)を集約。forced-colors / reduced-motion 対応追加。【human_review_required】 | apps/web/app/status/visual-status-registry.ts / components/domain-status-badge.tsx / globals.css |
| P-05〜P-07, P-10〜P-13, P-15〜P-19 | 未実装(該当画面の実装WPで本SSOTを根拠に実装) | — |

## 5. 警告重要度分類

| レベル | 表示 | 応答要求 |
|---|---|---|
| BLOCKER | 画面中央・進行停止 | 解除条件充足まで先へ進めない |
| CRITICAL(患者安全) | 赤系+アイコン+テキスト、確認操作必須 | 薬剤師確認の記録 |
| ERROR(技術・システム) | 赤系+テキスト、次アクション提示 | 再試行・管理者連絡。患者安全事象には使わない(CRITICAL を使う) |
| WARNING(請求・業務) | 黄系+テキスト、一覧化 | 確認チェック(まとめ確認可) |
| INFO | 控えめ表示 | 応答不要 |

濫発防止: WARNING 以下を CRITICAL 表示にエスカレートしない。技術例外を CRITICAL に割り当てない(CRITICAL の希釈防止)。warning fatigue review(§5.1 / UAC-12 / §16.1)で監査する。

### 5.1 live region と warning fatigue の契約

| レベル | ARIA / 読み上げ | focus |
|---|---|---|
| BLOCKER / CRITICAL | `role="alert"` + `aria-live="assertive"`。患者安全上の対象・危険・解除条件を一つの文脈で通知 | 通知だけではfocusを奪わない。blocking dialogを開く場合だけ§13.3のdialog契約で初期focusを移す |
| ERROR | 非blockingは`role="status"`+`aria-live="polite"`。user submit/saveを止めるblocking errorはERRORの視覚分類を維持したerror summaryで通知し、患者安全CRITICALへ昇格しない | 非blockingは自動移動しない。blockingはuser action後にsummaryへfocus、または同等のassertive通知で次actionへ到達可能にする |
| WARNING / INFO | `role="status"` + `aria-live="polite"` | 自動移動しない |

- warning identityは次の3要素を一つのcanonical contractとして扱う。
  `contextPartition`はtrusted tenant+pharmacy+session/grantと、patient / record / RP / global /
  system-operationのdiscriminated subjectから成る。非patient warningへsynthetic patient IDを捏造しない。
  `eventIdentity`は同一logical occurrence中に安定したopaque IDで、poll/re-renderごとに再採番しない。
  `contentRevision`はseverity、error/status code、権限内の対象label、hazard/理由、解除条件または必要な確認、
  next actionのいずれかが変われば必ず変わる。
- dedupe keyは`contextPartition + eventIdentity`とする。同一revisionの再renderは再announceせず、同一eventの
  `contentRevision`変更は一度だけ再announceする。別eventIdentityは他fieldが同じでも別件として保持する。
  tenant、pharmacy、session、role、grant、patientの切替時は旧partitionのcacheと非同期結果を破棄する。
  opaque identityはDOM、`data-*`、log、URL、artifactへ出さない。
- 未解決のBLOCKER/CRITICALは、severity、権限内の対象label、hazard、解除条件または必要な確認、次action、
  occurrenceを一件ずつ表示する。内部のopaque identityは対象labelの代用として画面へ出さない。
- 同時のBLOCKER/CRITICALは可視cardを個別保持し、severity優先、同severityは発生順の決定的な
  assertive announcement queueで一件ずつ通知する。後続通知で先行通知を欠落させず、各解消も
  一度だけpoliteに通知する。解消通知に新hazardがある場合だけ新しいassertive eventとして扱う。
- 患者切替は旧contextと旧患者由来の非同期結果を破棄してから、新患者の識別文脈を一度だけ
  politeに通知する。SystemMode変更も一度だけ通知し、BLOCKERを伴う場合はBLOCKER契約を優先する。
- UAC-12はsynthetic sessionでCRITICAL見落とし0、同一WARNINGの重複表示/重複announce 0、
  集約後の件数保持を必須とする。非重複WARNINGの許容頻度はpharmacist workflow gateが
  scenarioと閾値を記録するまで未確定とし、release acceptanceをblockする。

## 6. 【要確認】

- 高齢患者向け表示(文字サイズ切替等)の対象画面範囲(薬剤師レビュー)
- 疑義照会記録の必須項目(実務レビュー)
- 現場用語⇔公式用語対応表の初版(薬剤師・事務レビュー)

## 7. 体験品質ベースライン(UIX-002統合)

### 7.1 最低基準

1. サクサク動く
2. 安定している
3. マニュアルがなくても一目でわかる
4. 入力の途中で迷わない
5. エラー時に次に何をすればよいか分かる
6. 重要な状態が見た瞬間に分かる
7. 画面遷移が遅くて業務が止まらない
8. 検索・入力・保存・帳票出力が待たされすぎない
9. 混雑時でも受付・調剤・会計・請求前点検が滞らない
10. 障害時でも「できること」と「できないこと」が明確に分かる
11. 復旧後に何を再確認すべきか一目で分かる

### 7.2 三本柱

- **速さ:** Edge Nodeをローカル読み書きの一次面とし、患者検索・医薬品検索・処方入力・
  仮算定はローカル完結する。レセプト生成・月次締め・master検証等は非同期化し、進捗・
  background状態・完了・失敗を表示する。local cache/search index、keyboard shortcut、連続入力、
  画面遷移削減、一括操作、読取device即時反映、帳票preview待ち時間削減は安全契約内で最適化する。
- **安定性:** §10の自動保存、入力保護、冪等性、部分失敗、LOCAL_ONLY、入力復元に従う。
  失敗を握りつぶさず、再確認・再送・必要な人間reviewへ導く。
- **直感性:** 業務順ナビ、医療実務用語と公式用語の対応、文脈help、入力例、error原因・対処・
  次action、仮/確定/保留/請求不可の色非依存表示を使い、過剰なtutorialへ依存しない。

次を禁止する: 未完了を完了に見せる、エラーを隠す、外部未確認を成功扱いする、必須確認を
省略する、処理中/同期中/保留中を曖昧にする、薬剤師確認を省略する、請求コードを曖昧に
自動決定する、サジェストで誤薬を誘発する、監査証跡や根拠を削る、見た目のため安全情報を
減らす。性能・直感性の改善は外部確認、薬剤師確認、算定根拠、監査ログ、レセプト検証を
省略する理由にならず、直感性のため制度上必要な確認項目・危険表示を隠さない。

### 7.3 必須テスト

performance budget / perceived performance / latency regression / usability heuristic /
first-run task completion / manual-less workflow / keyboard-only workflow / error recovery /
offline UX / recovery sync UX / accessibility / warning fatigue / pharmacist workflow /
claim clerk workflowを、各gateが観測する契約に応じて実施する。

## 8. 性能予算(UIX-003統合)

### 8.1 前提

- 患者検索・医薬品検索・処方入力・仮算定は薬局内Edge Nodeで完結し、Cloud Core往復を要求経路に置かない。
- 帳票生成・レセプト生成・月次締め・マスター検証は非同期ジョブとし、進捗と完了/失敗を明示する。
- 測定点はユーザー操作から結果が利用可能になるまでのperceived latency。correlation_id付きで計測しPHIを出力しない。

### 8.2 候補値(Phase 1実測前)

| # | 操作 | p50 | p95 | 形態 |
|---|---|---:|---:|---|
| 1 | 受付ダッシュボード初期表示 | 300ms | 1,000ms | 同期 |
| 2 | shell内画面遷移 | 150ms | 500ms | 同期 |
| 3 | 患者検索(ローカル) | 100ms | 200ms | 同期 |
| 4 | 医薬品検索(ローカルindex) | 100ms | 200ms | 同期 |
| 5 | 処方箋2次元シンボル読取から仮取込表示 | 500ms | 1,500ms | 同期 |
| 6 | 処方入力保存(ローカル) | 150ms | 400ms | 同期 |
| 7 | 仮算定(ローカル) | 200ms | 500ms | 同期 |
| 8 | calculation_trace表示 | 100ms | 300ms | 同期 |
| 9 | 帳票preview | 500ms | 1,500ms | 同期(生成先行可) |
| 10 | 帳票印刷queue投入 | 200ms | 500ms | 同期(完了は非同期) |
| 11 | 会計確定 | 300ms | 800ms | 同期 |
| 12 | 請求前点検(月内全件・1,000件規模) | — | 30s | 非同期+進捗 |
| 13 | 月次締め | — | 5min | 非同期+進捗 |
| 14 | 電子レセプト出力 | — | 10min | 非同期+進捗 |
| 15 | マスター更新検証(24段pipeline) | — | 業務非block | 非同期(旧版継続) |
| 16 | Cloud Core / Edge同期の通常backlog解消 | — | 5min | background |
| 17 | network断検知からLOCAL_ONLY表示 | — | 10s | 自動 |
| 18 | RECOVERY_SYNC開始から要再検証一覧表示 | — | 60s | 非同期+進捗 |

全数値は候補であり、Phase 1実測・capacity整合・human product/operations acceptance前に
release SLOとして使わない。予算超過は品質課題として扱い、高速化のため算定検証・監査ログ・
外部確認を省略しない。非同期処理は進捗・残件数・失敗件数を表示する。

## 9. ユーザビリティ受入基準(UIX-004統合)

MVP release gateで次の全件をsynthetic/demo dataのみで判定する。pharmacist、claim-clerk、
accessibility、productの該当human approval前にusability/release acceptanceを主張しない。

| ID | 基準 | 検証方法 | 合格条件(候補) | 対象ロール |
|---|---|---|---|---|
| UAC-01 | 主要業務flowをmanualなしで完了 | 初見で受付→処方入力→仮算定→会計→帳票 | 3 role各2名以上、進行不能/誤確定0、完了率100% | 新人事務・薬剤師・管理者 |
| UAC-02 | role別の迷い箇所を抽出 | heuristic review + UAC-01観察 | 一覧化しU3+は改善または警告で対処 | 全role |
| UAC-03 | 処方入力→算定確認の体感速度 | perceived performance + §8 #6-8 | 予算内かつ「業務に支障」0 | 事務・薬剤師 |
| UAC-04 | 混雑時の連続受付 | 処方箋N枚の連続入力scenario。Nはperformance capacity planと整合【要確認】 | 候補基準は連続10件でkeyboard運用が途切れず保存失敗0。capacity plan確定前に十分性を主張しない | 事務 |
| UAC-05 | 主要画面で状態誤認しない | P-05仮算定/確定算定、P-06仮保存/確定、P-07薬剤師確認前/後、請求可/不可を各々独立提示 | 許可されたrole-screen pairだけを個別採点しU4正答100%、その他95%以上 | clerk / pharmacist / adminの許可pair。supportは業務状態を提示せずdenyを別採点 |
| UAC-06 | offlineをonline確認済みと誤認しない | LOCAL_ONLY UX test | 確認済み/送信済み誤答0 | 事務・薬剤師 |
| UAC-07 | 外部送信失敗後の操作が分かる | failure injection recovery test | 全員が画面のみで正しい次actionへ到達 | 事務・薬剤師 |
| UAC-08 | 復旧後の未解決taskが分かる | RECOVERY_SYNC UX test | 件数・種別・担当を一覧から即答 | 薬剤師・管理者 |
| UAC-09 | 帳票再出力・請求前点検の導線が分かる | manual-less帳票/点検scenario | 説明なしで再出力・点検・履歴へ到達 | 事務 |
| UAC-10 | keyboard中心で主要業務を実行 | mouseなし受付→入力→算定→会計 | 全工程完了、focus喪失0 | 事務 |
| UAC-11 | accessibility基準を満たす | §14.1のWCAG 2.2 AA候補scopeを自動+手動で別記録 | 対象success criteria全件PASS、色非依存、重大違反0。human gate前は適合主張不可 | 全role |
| UAC-12 | 重大警告をwarning fatigueで無視しない | §5.1のsynthetic警告session | CRITICAL見落とし0、同一WARNING重複表示/announce 0、件数保持。非重複頻度はpharmacist gate閾値内 | 薬剤師 |

不合格はdefectとして管理し、患者安全影響はcritical、請求事故影響はhigh以上とする。
被験者にproduction個人情報を使わない。pharmacist/claim-clerk workflow reviewは結果を
実務観点で承認する最終human reviewであり、自動testで代替しない。
UAC-05の非該当role-screen pairは分母から除外して理由を記録する。supportは状態識別試験へ
参加させず、scope不足/cross-tenant/pharmacyの403、response/DOMのPHI 0、患者context非mountを採点する。

## 10. 安定性SLO・設計要求(UIX-005統合)

### 10.1 SLO候補値

| 指標 | 候補値 | 測定方法 |
|---|---|---|
| crash-free sessions | ≥99.5% | PHI非送信のfrontend error計測 |
| successful save rate | ≥99.9% | API応答計測 |
| duplicate submission rate | 0(検出時block) | Idempotency-Key衝突計測 |
| 主要API error rate | <0.5% | 構造化log |
| print failure rate | <1%(失敗100%可視化+再試行) | 印刷job計測 |
| sync backlog / queue age | Phase 1閾値超過で警告 | 同期dashboard |
| external adapter timeout | Phase 1閾値超過でEXTERNAL_DEGRADED | Adapter計測 |

### 10.2 設計要求

| ID | 要求 | 必須方針 |
|---|---|---|
| ST-01 | frontend crash耐性 | route単位error boundary、復旧導線、入力保全 |
| ST-02 | API timeout | 全呼出にtimeoutと可視の失敗。握りつぶさない |
| ST-03 | retry | 自動は冪等readのみ。writeはIdempotency-Key付き明示retry |
| ST-04 | autosave | 処方・調剤・疑義照会draft。間隔は該当gateで確定し「仮」表示 |
| ST-05 | 入力中data保護 | refresh・sleep・通信断後に復元 |
| ST-06 | 二重送信防止 | 多重押下防止+server Idempotency-Key(`@yrese/events`契約準拠) |
| ST-07 | 部分失敗 | success/failure件数とfailure明細を表示 |
| ST-08 | network断検知 | 10s以内にSystemModeBadge更新 |
| ST-09 | LOCAL_ONLY安全遷移 | 禁止操作を無効化し理由表示。ARC-001準拠 |
| ST-10 | RECOVERY_SYNC復旧 | 要再検証一覧をhome固定表示。ARC-002準拠 |
| ST-11 | 帳票出力失敗retry | failure一覧・retry・印刷済み証跡で二重印刷防止 |
| ST-12 | 請求data生成失敗 | error code+該当data導線。error文へPHIを含めない |
| ST-13 | audit欠落防止 | audit write成功を対象操作の完了条件とする |
| ST-14 | Edge Node自己診断 | startup self-testをadminとSystemModeへ反映 |
| ST-15 | version不整合 | Cloud/Edge schema/master差を警告し機能制限 |

安定して見せるための例外握りつぶし、未完了処理の完了表示、曖昧な「処理中」放置を禁止する。
SLO数値、自動保存間隔・保持世代は実測とoperations gateで確定する。Phase 1 SLO実測、
ST-01〜15 runtime/integration validation、audit sink、human product/operations acceptance前に
stability/release readinessを主張しない。

## 11. 情報設計・業務導線(UIX-006統合)

### 11.1 NORMAL

```text
受付(紙/手入力/2次元symbol仮取込; 電子処方箋はONS gate)
  -> 患者特定(患者検索 / 新規登録、PatientHeader開始)
  -> 患者・保険・公費確認(online資格/PMHは外部仕様gate)
  -> 処方入力(RP単位、紙面照合、必要時は疑義照会)
  -> 調剤入力(残薬・後発品変更等を記録)
  -> 仮算定(calculation_trace、警告、BLOCKED_UNSUPPORTED_CLAIM=請求データ生成禁止)
  -> 薬剤師確認(確認者・日時。ここまで「確認前」)
  -> 会計(確定算定、未収・返金・差額)
  -> 帳票(再出力履歴)
  -> 月次: 請求前点検 -> 月次締め(NORMAL/claim:finalizeのみ)
            -> 電子レセプト(公式evidence gate) -> 返戻・再請求
```

各工程の仮/確定/保留/請求不可を次工程前に判別できなければならない。

### 11.2 LOCAL_ONLY

```text
network断/Cloud障害 -> 10s以内にLOCAL_ONLY表示
  -> 紙処方箋/QRの仮受付(新規online資格確認は禁止+理由)
  -> 最終資格snapshot(確認日時+PENDING_REVERIFY)
  -> 処方・調剤入力 -> PROVISIONAL_CALCULATION -> 薬剤師確認
  -> 「仮」帳票・仮精算
  -> sync queue + 復旧後再検証list
```

請求前点検、月次締め、レセプト出力、外部送信を禁止する。

### 11.3 RECOVERY_SYNC

```text
復旧 -> RECOVERY_SYNC -> 要再検証一覧
  + 資格再確認(PENDING_REVERIFY)
  + 外部再送(PENDING_EXTERNAL_SYNC)
  + PMH再確認(PENDING_PMH_REVERIFY)
  + 再計算・差額精算
  + conflict -> CONFLICT_REQUIRES_HUMAN_REVIEW(自動補正禁止)
  -> 全件解消+承認後にNORMAL(月次締めはそれまで禁止)
```

### 11.4 role別homeと遷移原則

| role | 最優先表示 |
|---|---|
| clerk | 受付queue・入力中draft・帳票failure・未収 |
| pharmacist | 確認待ち・疑義照会中・CRITICAL・要再検証 |
| admin | system mode・sync・master version・月次締め |
| support | default deny。role→scope/tenant binding未承認のため業務画面・PHIを表示しない |

監査イベントは一般業務Webや`/admin`へ表示しない。repositoryの`GET /audit/events`は
development/test contract evidenceで、production incident-response経路ではない。productionの
権限制御経路と保持期間全体の監査済み出力は別APPROVED security/operations contractまでblockする。

support投影は、別APPROVED authorization/operations contractが対象tenant/pharmacy、time-bound session、
目的、許可する非PHI診断field、同意、全操作audit、事後reviewを確定するまで実装しない。scope不足、
tenant/pharmacy不一致、support roleの患者/受付/処方面要求はAPIで403 fail-closedとし、UI上の非表示を
authorizationの代用にしない。

- navigation順は業務工程順と一致する。
- 会計完了から1操作で次の受付へ戻れる。
- 認証済み患者業務面では患者文脈を失わず、全業務画面でSystemModeBadgeを失わない。
- 疑義照会/残薬調整の詳細はpharmacist gate、電子処方箋/資格/レセプトは公式evidence gateで確定する。

## 12. 画面台帳と安全分類(UIX-007統合)

`ux_safety_level`: U0=UI影響なし、U1=通常UI、U2=業務導線、U3=医療安全/請求事故、
U4=患者取り違え/薬剤師確認/外部未確認/請求確定。scopeは`@yrese/shared-kernel`の
`resource:action`形式で、【要確認】はregistry未確定の仮割当である。

| ID | 画面/機能 | 主要状態 | scope | U | 実装状態 |
|---|---|---|---|---|---|
| SCR-001 | 受付dashboard | system mode / 受付状態 | queue=`reception:read`+`patient:read`; create=`reception:write`+`patient:read` | U2 | `/` shell |
| SCR-002 | 患者検索・選択 | 同姓同名/類似候補 | patient:read | U4 | `/patients` shell |
| SCR-003 | 患者文脈(横断) | 氏名カナ・生年月日・年齢・性別 | `patient:read`。呼出元の同一tenant/pharmacyに限定 | U4 | PatientHeader実装済み |
| SCR-004 | 処方入力 | 仮/確定・薬剤師確認前 | prescription:write | U4 | `/prescriptions` shell |
| SCR-005 | 2次元symbol読取 | 仮取込/照合未了/error | prescription:write | U4 | 未実装(JAHIS Ver.1.11 evidence待ち / BLOCKED_JAHIS_SPEC_ACQUISITION) |
| SCR-006 | 電子処方箋受付 | 取得/PENDING_EXTERNAL_SYNC | prescription:write | U4 | ONS gate |
| SCR-007 | 患者・保険・公費確認 | 有効期限/負担/要確認 | insurance:read, public-expense:read | U4 | 未実装 |
| SCR-008 | online資格確認結果 | VERIFIED/PENDING_REVERIFY/日時 | insurance:read | U4 | 状態のみ実装、ONS gate |
| SCR-009 | PMH確認結果 | PENDING_PMH_REVERIFY | public-expense:read | U3 | PMH仕様gate |
| SCR-010 | 調剤入力 | 確認前/残薬調整 | dispensing:write | U4 | 未実装 |
| SCR-011 | 算定結果 | 仮/確定・警告・BLOCKER | calculation:read | U3 | 算定engine gate |
| SCR-012 | calculation_trace | master/rule/evidence | calculation:read | U3 | fixture viewerのみ、live gate |
| SCR-013 | 警告/error/BLOCKER(横断) | severity | source screenのexact scopeを継承。追加取得権限なし | U4 | 未実装 |
| SCR-014 | 薬剤師確認 | 確認者・日時・前後 | dispensing:confirm | U4 | 未実装 |
| SCR-015 | 疑義照会 | 照会中/回答/訂正 | prescription:write【要確認】 | U3 | 未実装 |
| SCR-016 | 会計 | 確定額/LOCAL_ONLY仮精算 | calculation:read【要確認】 | U3 | `/checkout` shell |
| SCR-017 | 未収・返金・差額 | 未収/返金/根拠 | claim:write【要確認】 | U3 | 未実装 |
| SCR-018 | 帳票出力 | 履歴/再出力/failure | view=`report:read`; output/reprint/retry=`report:write` | U3 | 未実装 |
| SCR-019 | 請求前点検 | 結果/請求不可 | claim:read | U3 | `/claim-check` shell |
| SCR-020 | 月次締め | 締め/RECOVERY_SYNC blocker | claim:finalize | U4 | `/monthly-closing` shell |
| SCR-021 | レセプト出力 | 生成/検証/lock | claim:finalize | U4 | 公式evidence gate |
| SCR-022 | 返戻・再請求 | 理由/状態/履歴 | view=`claim:read`; correct/resubmit=`claim:write` | U3 | 未実装 |
| SCR-023 | master更新 | 版/有効日/検証 | master:admin | U3 | `/masters` shell |
| SCR-024 | 外部連携状態 | EXTERNAL_DEGRADED | sync:read | U2 | 未実装 |
| SCR-025 | 同期状態 | backlog/age/failure | sync:read | U2 | `/sync-status` shell |
| SCR-026 | LOCAL_ONLY(横断) | 禁止+理由/仮件数 | source screenのexact scopeを継承。追加取得権限なし | U4 | fixture guardのみ、live gate |
| SCR-027 | RECOVERY_SYNC | 未解消/conflict | sync:confirm【要確認】 | U4 | 未実装 |
| SCR-029 | 管理・権限 | 設定/権限の変更履歴(audit eventではない) | user/role=`user:admin`; tenant setting=`tenant:admin`; current shell=allOf両scope | U3 | `/admin` shell |

### 12.1 retired ID

| ID | 状態 | 維持する境界 |
|---|---|---|
| SCR-028 監査log | RETIRED。一般業務Webへ復活させずID再利用禁止 | SEC-007のevent生成、`audit-log:read`、権限制御API、append-only保存、hash-chain検証 |

### 12.2 台帳運用

- U3/U4実装前にindependent/front-end/flowに加え、relevant medical-safety/privacy/accessibilityと必要なhuman authorityを確認する。実装後も同観点の独立evidenceを要求する。
- 画面追加・統合は本台帳を改版してから行い、台帳外画面を実装しない。
- 実装状態は該当WP完了時にGit evidenceへ同期する。
- SCR-028互換参照は監査API存続だけを表し、Web閲覧画面の根拠にしない。
- SCR-029の変更履歴は設定/権限変更の業務投影だけとし、`audit_events`一覧、chain状態、import、
  retry、audit tabを含めない。静的+browser回帰でそれらの一般Web復活がないことを確認する。
- screen/API operationごとに承認済みAPI contractのexact scopeを要求する。missing/invalid context、
  scope不足、未承認roleは固定`403 AUTH-0003`、権限外resource selectorはmissing resourceと識別不能な
  404または承認済みの同等な存在非開示応答とし、status/body/header/timingのleakを検証する。横断componentは
  呼出元権限を拡張せず、CSS非表示でPHIをmaskしない。
- 待合/共用表示とsupport面はpatient context surfaceではない。氏名、カナ、生年月日、年齢、性別、
  patient IDをserver responseにもDOMにも含めないことをsynthetic fixtureで検証する。
- trusted tenant/pharmacy contextはIDが二つ存在するだけでは成立しない。認証authorityがrole/subjectと
  tenant-pharmacy membership/active grantを検証し、target resourceのtenant/pharmacyと一致させる。
  body/queryのtenant/pharmacyをauthorityにせず、mismatchはdata access/side effect前に拒否する。
- supportの業務/PHI default denyはtarget acceptanceである。current `TenantContext`はtrusted roleを持たず、
  MOD-007のrole-to-scopeも未確定なため、現時点のenforcement PASSを主張しない。auth/security SSOTが
  trusted role/subjectとsupport allow-listを承認し、過剰scopeを含むAPI negative testが通るまで、
  support向け患者業務/PHI accessを実装・有効化しない。

### 12.3 operation authorization matrix

scope組合せはすべて`allOf`であり、`,`や表示上のrole名から`anyOf`を推測しない。SCR-001-Q/Cと
SCR-002-L/Dだけがcurrent API/OpenAPIへ接続済みで、SCR-018/022/029は候補mappingである。候補はcanonical API/OpenAPI
operation registryへ登録し、UIXとの一致をcontract testで固定するまで実装authorityにしない。
表にないoperationと【要確認】operationも、該当SSOT/API registryが承認されるまで実装・有効化しない。

| operation ID | operation | exact scope | authority status | combination / binding | negative acceptance |
|---|---|---|---|---|---|
| SCR-001-Q | 受付queue参照 | `reception:read` + `patient:read` | current API/OpenAPI | allOf / trusted tenant+pharmacy | context/scope不足403、server-side scope絞込み、該当なしは200 empty、PHI/存在情報leak 0 |
| SCR-001-C | 受付作成 | `reception:write` + `patient:read` | current API/OpenAPI | allOf / trusted tenant+pharmacy | 片方不足403、scope外患者/tenant/pharmacyは存在非開示404、side effect 0 |
| SCR-002-L | 患者検索/list | `patient:read` | current API/OpenAPI | single / trusted tenant+pharmacy | context/scope不足403、server-side絞込み、該当なし200 empty、PHI/存在情報leak 0 |
| SCR-002-D | 患者exact選択/detail | `patient:read` | current API/OpenAPI | single / trusted tenant+pharmacy | scope不足403、scope外patient selectorは存在非開示404 |
| SCR-018-L | 帳票履歴list | `report:read` | candidate / API未登録 | single / trusted tenant+pharmacy | scope不足403、server-side絞込み、該当なし200 empty |
| SCR-018-D | 帳票job exact status/failure detail | `report:read` | candidate / API未登録 | single / trusted tenant+pharmacy | scope不足403、scope外recordは存在非開示404 |
| SCR-018-O | 帳票初回出力 | `report:write` | candidate / API未登録 | single / trusted tenant+pharmacy | scope不足403、scope外recordは存在非開示404、side effect 0 |
| SCR-018-P | 帳票再出力 | `report:write` | candidate / API未登録 | single / trusted tenant+pharmacy | scope不足403、scope外recordは存在非開示404、side effect 0 |
| SCR-018-Y | failure job retry | `report:write` | candidate / API未登録 | single / trusted tenant+pharmacy | scope不足403、scope外jobは存在非開示404、side effect 0 |
| SCR-022-L | 返戻list | `claim:read` | candidate / API未登録 | single / trusted tenant+pharmacy | scope不足403、server-side絞込み、該当なし200 empty |
| SCR-022-D | 返戻exact detail | `claim:read` | candidate / API未登録 | single / trusted tenant+pharmacy | scope不足403、scope外claimは存在非開示404 |
| SCR-022-C | 訂正 | `claim:write` | candidate / API未登録 | single / trusted tenant+pharmacy | scope不足403、scope外claimは存在非開示404、side effect 0 |
| SCR-022-S | 再請求 | `claim:write` | candidate / API未登録 | single / trusted tenant+pharmacy | scope不足403、scope外claimは存在非開示404、side effect 0 |
| SCR-029-U | user/role権限操作 | `user:admin` | candidate / API未登録 | single / trusted tenant+pharmacy | tenant:adminだけは403、scope外targetは存在非開示404 |
| SCR-029-T | tenant設定操作 | `tenant:admin` | candidate / API未登録 | single / trusted tenant+pharmacy | user:adminだけは403、scope外targetは存在非開示404 |
| SCR-029-S | current `/admin` shell参照 | `user:admin` + `tenant:admin` | current presentation / mutation API未登録 | allOf / trusted tenant+pharmacy | 片方不足/supportは403、PHI 0 |
| ACT-FINALIZE-AND-QUEUE | 薬剤師の1 user command: local確定+durable外部登録intent | 【要確認: DOM-004 + RB-003 + MOD-007/API operation registry】 | blocked | 1 button / 1 user action、backend 2段。未承認のため禁止 | scope/roleから推測せずAPIを提供しない |
| JOB-REGISTER-EXTERNAL | outbox workerによる外部登録delivery | 【要確認: RB-003 + partner/service authorization】 | blocked / user-facing APIではない | authorized intent後だけ実行。system retryはAPPROVED delivery policyだけに従う | user commandのscopeや成功をprovider authorizationへ流用しない |
| ACT-RESEND-DLQ | DLQからの人間による再送 | candidate `tenant:admin`、exact API operation registry承認待ち | blocked / API-012 | trusted actor+tenant/pharmacy+outbox target binding、current partner/grant/subscription/consent/regulatory revalidation | scope不足403、scope外targetは存在非開示404、side effect 0。`delivery.resent`+必須`businessReason`を同一操作で監査 |

scopeが同じでもside-effect operationごとに別API operationId、API-013 namespace/body fingerprint、
MOD-008 event/firing pointを登録する。initial output/reprint/retry、correction/resubmissionを束ねない。
`ACT-FINALIZE-AND-QUEUE`と`JOB-REGISTER-EXTERNAL`は一つのuser submitを二つに増やさず、commandと
consumerでauthorization、idempotency/dedupe、audit event、response/delivery stateを分離する。

### 12.4 local finalize / external register durability boundary(candidate / blocked)

- candidate UIはP-11の確認dialogを経る1 button / 1 user actionとし、一回の明示confirmで
  local finalize commandを開始する。backendはlocal commitとexternal deliveryの2段へ分離する。
  これはDOM-004の既存2確認行為を自動統合する承認ではなく、同改版までは実装しない。
- local finalizeは確定者・日時・対象版を記録する不可逆なdomain transitionである。訂正は履歴を消す
  rollbackでなく、DOM-004改版が承認する新版+再確定だけを使う。
- local domain mutation、operation-scoped idempotency record、required audit record、external registerの
  durable outbox intent、初期`pending` delivery stateは、MOD-009に従い同一DB transactionで保存する。
  commit前にいずれかが失敗すればlocal finalizeを成功にしない。commit後のexternal delivery failureは
  local factを巻き戻さず、`PENDING_EXTERNAL_SYNC`をdurable outbox intent/delivery stateから復元する。
- external register consumerはlocal finalize成功後だけ動き、operation-scoped retry/dedupe、terminal failure、
  DLQ/manual recovery、別response state、409 semantics、別audit firing pointを持つ。登録完了前に
  「登録済み」と表示せず、local確定chipと登録chipを単一successへ束ねない。
- local commit時にtrusted tenant/pharmacy/actor、qualification/scope、対象版を検証する。初回delivery、
  retry、`ACT-RESEND-DLQ`ではimmutableなauthorized intentと対象版に加え、現在のpartner/endpoint状態、
  PartnerGrant、購読、同意、規制modeを再評価する。stale/unknown/失効時は送信せず、APPROVED delivery
  contractどおりholdまたはterminal failureへ遷移し、監査とhuman reviewへ送る。user sessionの現行scopeを
  worker authorizationとして再利用しない。`ACT-RESEND-DLQ`はworker system authorizationと分離し、
  `delivery.resent`と必須`businessReason`の監査が同一操作で永続化できなければ成功にしない。
- exact scope、DOM-004 transition/訂正、HPKI署名の段帰属、RB-003解除、API-013 profile、MOD-008 event、
  MOD-009 event/outbox profileとdelivery/DLQ contractがAPPROVEDになるまで両operation/APIを実装・有効化しない。
  user commandのscope・確認・idempotency・audit成功をprovider/service authorizationやdelivery成功へ
  継承せず、delivery成功もlocal確定の根拠にしない。

## 13. 共通UI component system

`apps/web/**`の状態、患者文脈、警告、確認操作、loading/empty/errorは、台帳化した共通component
経由で表現する。既存の画面local構成要素はfinalization時点の経過措置とし、後続WPで台帳登録か
廃止を決める。既存codeを遡及的な違反にしない。

### 13.1 layerとauthority

| layer | 内容 | authority | 変更自由度 |
|---|---|---|---|
| L0 | color/type/space/density/stateのCSS token | targetは単一token authority。current direct importsは`apps/web/app/globals.css`、`apps/web/app/operator-first.css`、`apps/web/app/operator-ux-refinement.css`、`apps/web/app/operator-first-navigation.css`、`apps/web/app/operator-adversarial-refinement.css`、`apps/web/app/operator-completion-refinement.css`; transitiveは`apps/web/app/legacy.css`; route-localは`apps/web/app/admin/admin-dashboard.module.css` | 高。Phase A後はtheme差替えをここだけで行う |
| L1 | domain×key -> label/tone/shape/ARIA | `visual-status-registry.ts` | 低。domain enum SSOT後のみaxis追加 |
| L2 | badge/list/banner/dialog/state view | `apps/web/app/components/` | 中。本節の追加手順に従う |
| L3 | PatientHeader/ClinicalAlert/trace等の業務複合 | 同上 | 中。U4は専門review必須 |
| L4 | §12のscreen | `apps/web/app/**/page.tsx` | L0〜L3を合成し独自状態表現を持たない |

### 13.2 Phase A/B

- **Phase A(L0 themeのみ):** L1以上のcontract、文言、DOMを変えない。既存test全緑は各testが
  観測した範囲だけのevidenceであり、挙動全体の不変証明ではない。active stylesheet全体の
  direct colorをtokenへ集約する最小failing test、token宣言/forced-colors例外の静的検査、
  browser/a11yのforced-colors・reduced-motion・contrastを追加する。
- **Phase B(L2〜L4の一枚盤面):** 構造変更なので旧DOM testが壊れること自体は異常ではない。
  L1 Registryの文言/ARIA網羅を維持し、新盤面の投影・lock・確定演出・reflowを新testで検証する。

### 13.3 canonical component台帳

「実装済み」はfrozen base `9786fe8`で対象file/rendering骨格が存在するというinventory語であり、
本PROPOSED contractへの適合、live integration、自動test、専門review、release admissionを意味しない。
部分実装・fixture・未接続は各行と§13.3.1のgateを優先する。

| category | component | 状態 | contract / gate |
|---|---|---|---|
| status | Visual Status Registry | 実装済み | domain状態表示の単一正本 |
| status | DomainStatusBadge | 実装済み | 新規domain状態はこれだけ。自由label/tone禁止 |
| status | StatusBadge | legacy互換 | 新規domain状態に使わない |
| status | SeverityList | 実装済み | §5の5段 |
| status | RecordStateBadge | 実装済み | record lifecycle 11状態 |
| status | PrescriptionChangeIndicator | 表示実装済み | live data配線は別gate |
| patient | PatientHeader | 実装済み | P-09識別子、U4 |
| patient | PatientContextProvider / Bar | 実装済み | 別患者選択時に旧context破棄、U4 |
| warning | ErrorNotice + error-code | 実装済み | P-18 error+next action |
| warning | BlockerBanner | 実装済み | reason+next action必須 |
| warning | ClinicalAlert / Summary | 表示層のみ | 判定engine前にmedical review+SaMD評価 |
| action | ConfirmationDialog / DestructiveActionDialog | 表示骨格のみ | P-11。§13.3.1のfocus管理をcomponent内へ実装するまでU3/U4で利用禁止 |
| mode | SystemModeBadge | 実装済み | P-03、5 mode常時表示 |
| mode | ModeCapabilityView | 実装済み | shared-kernel判定のみ |
| sync | SyncIndicator / OfflineBanner / SystemHealthBanner / EmergencyModeBanner | 表示層のみ | local保存≠server保存。live syncは別gate |
| state | EmptyState / LoadingState | 実装済み | loading/emptyをdomain成功と混同しない |
| evidence | CalculationTraceView | fixtureのみ | live endpoint/tenant/permission/routeは別WP。旧WP-3011b/cはcurrent active queueに存在しない |
| file | FileUploadStatus | 表示層のみ | live object-storage導線は別gate |
| audit | AuditMetadata | 実装済み | audit event viewerを一般Webへ復活させない |
| auth | AuthSession | 表示実装済み | production authはsecurity gate |

#### 13.3.1 component contract 最低要件

`docs/ui-ux-refresh/12-component-contracts.md`は統合元の版付きprovenanceであり、finalization後の
別authorityにしない。各componentは次のProps / ARIA・keyboard / 禁止 / testを本書内で満たす。
個別contractを確定できない予約componentは実装しない。

| component group | required Props / source | ARIA / keyboard | 禁止 | 最小test |
|---|---|---|---|---|
| DomainStatusBadge / SeverityList / RecordStateBadge / PrescriptionChangeIndicator | shared-kernel enumまたはRegistry query。自由label/tone/severityを受けない | Registryのrole/live/label/shapeを§5.1どおり投影 | 色/icon/motion単独、画面local mapping | enum全数、label/shape、ARIA、unknown fail-closed |
| PatientHeader / PatientContextProvider / Bar | branded patient ID、氏名、カナ、生年月日、年齢、性別、資格状態。認証済み同一tenant/pharmacy APIだけをsourceにする | 一つのpatient context landmark。切替は§5.1どおり一度通知し、論理focus順を維持 | 待合/共用/support投影、stale患者response、CSSだけのmask | 選択/切替/clear/stale抑止、cross-tenant/scope不足deny、非patient surfaceでPHI 0 |
| ErrorNotice / BlockerBanner / ClinicalAlert / Summary | §5.1の`contextPartition`、stable `eventIdentity`、`contentRevision`、権限内の表示content。BLOCKER/CRITICALはhazardと解除条件または必要な確認も必須。clinical alertは承認済みdomain typeだけ | §5.1。重複announceせず、同時重大alertは決定的queue、blocking ERRORはsummaryへ到達可能にする | 技術ERRORのCRITICAL化、判定engineのUI捏造、理由なしblock、opaque identityのDOM露出 | occurrence別2行/2通知、同一event再render抑止、nextAction/解除条件だけの変更、pharmacy/role/grant/patient切替、非patient system warning、同時重大警告の順序/解消、blocking/nonblocking ERROR、medical gate前のengine未接続 |
| ConfirmationDialog / DestructiveActionDialog | open、title、message、影響、confirm/cancel handlerとlabel、`subject` discriminated union(patient / claim / user / tenant-setting / system-operation)。patient subjectは認証済み同一tenant/pharmacy operationだけ | `dialog`または`alertdialog`、`aria-modal=true`、可視titleを`aria-labelledby`、必要な説明を`aria-describedby`で関連付け、背景をinertにする。全modalはopen時にdialog内の安全なcontrolへfocusし、DestructiveActionDialogとU3/U4不可逆操作はcancelへ初期focus、初期状態のEnterでconfirmしない。confirmは明示focus+activationだけ。Tab/Shift+Tab trap、Escape取消、close後invokerへreturn。invoker消失時は最寄りの論理見出しまたはmain actionへ戻す | callerごとのfocus実装、outside click/Enter一発確定、対象/影響省略、非patient dialogへの患者data、nested modal | 各subject/role callerでaccessible name/description、inert、通常modalの初期focus、破壊的dialogのcancel初期focus、初期Enter非confirm、cycle、Escape、return/fallback、confirm/cancel一回、nested拒否 |
| SystemModeBadge / ModeCapabilityView / sync banners | shared-kernel mode/capability/sync stateと理由。UI独自判定なし | modeは常時label、変更はpolite一回。禁止操作の理由へ到達可能 | local/server、pending/successの統合、無言disable | 全mode/state、理由、遷移announce、未承認操作deny |
| EmptyState / LoadingState / FileUploadStatus | 明示state、次action、uploadはdurabilityを別fieldで表す | loading/status、error/alertを意味どおり使用 | empty/loading/partialをsuccess扱い、完了前の保存済み表示 | 全state、partial failure、retry/cancel、durable境界 |
| CalculationTraceView / EvidenceDrawer / AuditMetadata | calculation traceまたはrecord version metadataとexact permission。audit event collectionは受けない | triggerはnative button+`aria-expanded`/`aria-controls`。desktop inline drawerはnon-modal、狭幅overlayはmodalとして初期focus、trap、Escape、inert、invoker returnを共通実装。見出しと根拠へkeyboard到達 | audit list/chain/import/retry、tenant外data、PHI artifact、caller独自drawer focus | permission/tenant deny、320/768でinline/overlay keyboard、modal focus/inert/Escape/return、SCR-028別名復活なし |
| BoardShell | 承認済みscreen projectionと§14.1 DOM順 | landmarkとDOM/read順をreflow後も維持 | CSS orderだけの意味順変更、独自authority | 320/375/768/1024 CSS px、200%/400% zoom、keyboard/read順 |
| WorkflowSheet / WorkflowStageRow | 承認済みworkflow enum、常時可視summary、入力form | heading内のnative buttonに`aria-expanded`/`aria-controls`。Enter/Spaceで開閉し、閉じた内容をfocus不能にする | safety summary/BLOCKER/CRITICALのaccordion格納、未承認enum | keyboard開閉、focus、常時summary、state全数 |
| ReceptionQueueRail / ConfirmationQueueRail | 承認済みqueue projection、role capability。projectionはauthorityを増やさない | `section`+`aria-labelledby`、`ul/li`、native link/button。選択buttonは`aria-pressed`、navigation上のcurrent page linkだけ`aria-current="page"`とし意味を混同しない | roving focusの独自実装、permission変更、待合/supportへのPHI投影 | keyboard順、selected/currentの読分け、role/scope/privacy negative |
| AlertRail | 承認済みwarning projection | `aside`+`aria-labelledby`。未解決BLOCKER/CRITICALを一件ずつmain DOM/read順へ残す | 重大警告のcountだけへの集約、drawer内だけの表示 | 同時重大警告、各幅DOM/read順、WARNING/INFO集約 |
| BoardViewSwitcher | 承認済みrole projectionとcapability | label付きnative button群で選択を`aria-pressed`表示 | role/scope/permission変更、選択の色単独表示 | pressed/focus/keyboard、projection、scope negative |
| StageLockIndicator / StageReturnAction / FinalizeAndRegisterAction | 承認済みlock/transition、actor/device、理由、1 user actionとbackend 2段、local確定/外部登録の直交state | lock理由、差戻し、1 buttonの確認dialog、2 chipをtextで常時識別 | 無言lock、自動競合解消、二つの確認行為の無断統合、2 user submit化、単一success | stale/concurrent/deny、差戻し、1 action、local確定≠外部登録、delivery failure、pharmacist gate |
| AuthSession | trusted auth/session stateだけ | expiry/lockをstatusまたはalertで通知し再認証へfocus可能 | development headerをproduction authority化、token/secret表示 | production fail-closed、expiry/lock、secret/PHI非出力 |

### 13.4 一枚盤面の予約component(未承認enumを実装しない)

| component | 目的 | stop condition |
|---|---|---|
| BoardShell | 左rail・中央・右railの共通container | responsive/a11y contract承認 |
| WorkflowSheet / WorkflowStageRow | 工程accordion。summary状態は常時可視、展開部はinputのみ | workflow-stage enum + DOM-004 |
| ReceptionQueueRail | 常設queue+検索 | privacy上の氏名表示gate |
| ConfirmationQueueRail | pharmacist確認待ちqueue | 並び順のpharmacist review |
| AlertRail | 常設警告。BLOCKERは中央へ進出 | medical-safety review |
| EvidenceDrawer | calculation traceとrecord版履歴 | audit event一覧/chain/retryを扱わない |
| BoardViewSwitcher | role別projection切替 | permissionを変更しない。MOD-007/API scope準拠 |
| StageLockIndicator | 操作者/端末とlock理由を常時表示 | lock model承認。無言disable禁止 |
| StageReturnAction | 差し戻し | DOM-004 transition承認 |
| FinalizeAndRegisterAction | 1 button / 1 user actionからlocal確定+outbox intentをcommitし、worker deliveryへ進むbackend 2段container。2 chip/別event/stateを維持 | §12.4、DOM-004、RB-003、MOD-007/API authorization、API-013、MOD-008、MOD-009、HPKI/legal、pharmacist gate。2 user submitにせず、DOM-004の2確認行為を勝手に統合しない |

丁「一枚盤面」はL2〜L4の構成原理であり、画面を調剤盤・請求盤・管理盤へ写像する。
選択=常設queue、工程=展開、根拠=drawerで遷移を減らすが、P-01の安全情報は折りたたまない。
甲/乙/丙のvisual languageはL0 theme候補であり、theme選択前に複数tenant theme機能を作らない。

#### 13.4.1 screen-to-board placement authority

repository内で検証できるplacementだけを下表に固定する。14号が参照するartifact `cb24845f`の
28画面写像表はrepositoryへ未転記であり、provenanceであってauthorityではない。screen名から配置を
推測せず、3盤面という構成原理だけで吸収・移動を承認しない。

| SCR ID | Candidate A placement | 維持する境界 | status / stop |
|---|---|---|---|
| SCR-001 | ReceptionQueueRail | §12のID/U2/scope、empty≠UNAVAILABLE | explicit sourceあり。privacy/flow gate前は既存surface維持 |
| SCR-002 | ReceptionQueueRailの検索/選択 + 選択後の中央patient context | §12のID/U4/`patient:read`、患者再確認、PHI最小化 | explicit sourceあり。medical/privacy/accessibility gate前は既存surface維持 |
| SCR-013 | AlertRail。未解決BLOCKER/CRITICALはmain DOMにも個別表示 | §12のID/U4/source scope、§5 severity | explicit sourceあり。medical/accessibility gate前は既存surface維持 |
| SCR-003, SCR-004, SCR-005, SCR-006, SCR-007, SCR-008, SCR-009, SCR-010, SCR-011, SCR-012, SCR-014, SCR-015, SCR-016, SCR-017, SCR-018, SCR-019, SCR-020, SCR-021, SCR-022, SCR-023, SCR-024, SCR-025, SCR-026, SCR-027, SCR-029 | UNMAPPED。§12の既存screen/surfaceを維持 | 各ID/U/scope/状態/患者文脈/安全情報を変更しない | repository-verifiable mapping + product/flow/relevant human gate + PRC-007まで移動・吸収禁止 |
| SCR-028 | placementなし(RETIRED) | ID再利用禁止、監査API境界だけ維持 | 別名復活禁止 |

mapping変更は本節と§12を同一PRC-007 batchで改版する。全active IDのboard/rail/workflow row/drawer、
scope、U分類、患者文脈、常時可視情報、前提/stop conditionをrepository内へ記録するまで、WP-5105以降の
一枚盤面実装を開始しない。14号は方向選定のprovenanceに限定し、final authorityとして参照しない。

### 13.5 component追加手順

1. Component Galleryで標準pattern、命名、a11y慣行を確認する。法令、公式な医療・請求要件、
   患者安全、human gate、APPROVED SSOTを上書きできず、衝突時はBLOCKEDとして該当authorityへ
   エスカレーションする。
2. Purpose / Props / ARIA / Prohibited / Testsのcontractを定義する。
3. domain状態は対応enumがshared-kernel SSOTにあることを確認し、なければ承認まで実装しない。
4. 必要なRegistry axis、最小production change、最小contract testの順にTDDする。DOM interactionは
   既存Playwright/axeで観測できる場合それを再利用し、新dependencyを先に追加しない。
   `--passWithNoTests`を禁止し、selected test/scenario/route/component件数が0ならfailする。
   収集件数と対象名をartifactへ記録し、empty suiteをPRC-007 evidenceとして受理しない。
5. U3/U4は実装前後にrelevant medical-safety/privacy/accessibilityと必要なhuman authorityを通す。
6. 本台帳へ追加してからscreenでimportする。

## 14. 表示、responsive、accessibility

- stateはlabel+shape/icon+toneの複数手掛かりを使い、色/emoji/icon単独にしない。
- keyboard-onlyで主要flowを完了でき、skip link、visible focus、論理的focus順、dialog focus returnを保つ。
- live regionはseverityに応じて使い、技術ERRORを患者安全CRITICALとしてannounceしない。
- 320 CSS px相当からdesktopまで、patient context、system mode、BLOCKER、確定状態をviewport外へ隠さない。
- 200% zoomに加え、1280 CSS px viewportの400% zoom(320 CSS px相当)で二方向page scrollを
  作らない。tableは行contextを保つ内部scrollまたはresponsive表示にする。
- forced-colorsで状態境界とfocusを失わず、reduced-motionで意味のないmotionを止める。motionを唯一の状態伝達にしない。
- touch target、文字size、density、高齢患者向け拡大範囲はaccessibility/pharmacist gateで確定する。
- 常設queueの氏名/識別子は必要最小限とし、設置環境とprivacy reviewなしに待合から読める表示を採用しない。
- actual screen reader、200%/400% zoom、keyboard、forced-colors、reduced-motion、contrastは自動testだけで完了扱いしない。
- UAC-11の候補targetはWCAG 2.2 Level AAとする。JIS X 8341-3との適用関係、正式scope、
  accessibility supportはhuman accessibility gateで確定し、未確定を適合と呼ばない。

### 14.1 UAC-11 / responsive gate の再現可能な入力

| 対象 | candidate acceptance / 記録 |
|---|---|
| scope | §12のactive screen、§13.3のcanonical component、全role。除外・非該当はsuccess criterion単位で理由とhuman承認を記録 |
| automated | axe等の結果と手動結果を別artifactにする。自動違反0だけでWCAG/JIS適合としない |
| keyboard/dialog | skip link、全control、focus visible/order/non-obscured、全dialog callerのTab/Shift+Tab trap・Escape・invoker return |
| screen reader | 実行時versionを固定したVoiceOver+SafariとNVDA+Firefox ESRまたはChromeで、5 severity、patient切替、SystemMode、BLOCKER、form error、drawer/dialogを実読み上げ |
| zoom/reflow | 320 / 375 / 768 / 1024 CSS px、200% zoom、1280 CSS px viewportの400% zoom(320 CSS px相当)で、patient context、SystemMode、BLOCKER、確定操作、論理順、clip/focus遮蔽、page横scroll、内部table scrollを記録 |
| forced colors / motion | 全canonical componentと代表routeで境界・focus・text cueを確認し、`prefers-reduced-motion`で非本質motion停止をbehavior assert |
| target size | WCAG 2.2 SC 2.5.8の24x24 CSS pxまたは同criterionのspacing等例外はcandidate floorに限定。tablet/高齢者向けproduct下限はaccessibility+pharmacist gateでapprove/amendし、それまでtouch最適化完了を主張しない |

Phase Bのcandidate breakpointは`>=1024 CSS px`で3 column、`<1024 CSS px`でqueue/evidenceを
`aria-expanded`/`aria-controls`付き明示buttonからmodal drawerとして開く。drawerは初期focus、
Tab trap、Escape、背景inert、invoker returnを共通実装する。warning count/indicatorは補助表示にできるが、未解決の
BLOCKER/CRITICALは全件を個別summaryとしてmain DOM/read順へ残し、WARNING/INFOだけを集約または
drawerへ移せる。patient context、SystemMode、確定操作もdrawerへ隠さない。DOM/read順はcontext -> mode -> alerts -> main -> actions ->
補助queue/evidenceとする。accessibility/pharmacist gateがbreakpoint、drawer順、target size、
高齢患者向け拡大範囲をapproveまたはamendするまでPhase Bを実装せず、既存safe layoutを維持する。

## 15. 禁止pattern

1. component/selectorでtokenを迂回する色直指定(final token declarationとforced-colors overrideを除く)
2. 色・icon・motion単独の状態表現
3. domain状態の自由label/tone、Registry迂回
4. UI独自のmode/permission判定、API側authorizationの代替
5. local保存、仮、確認前を確定と同じ成功表現にする
6. PHI/PIIをlog、metric、error、URL、technical `data-*`属性、未承認client storage、fixture、
   screenshotへ出す。clipboard/browser notification/printは明示操作・最小投影・該当privacy gateなしに出さない
7. 第二利用者前の`packages/ui`移動、新dependency、投機的abstraction
8. 台帳外の共通componentまたはscreen追加
9. reasonなしのBLOCKED、無言disable、無言gray-out
10. 破壊的/不可逆操作のone-click実行
11. 操作数削減を患者安全、常時可視、薬剤師判断より優先する
12. audit event viewerを別名で一般業務Webへ復活させる
13. loading/empty/error/partial failureを成功または完了に見せる
14. 未承認domain enum、請求logic、薬学判断をUI local定数として捏造する

## 16. 検証、design debt、change management

### 16.1 verification

- L1 Registryは型+unit testで状態網羅、label、ARIAを検査する。
- component contractは最小Vitest、DOM/reflow/keyboard/a11yは既存browser gateを使う。
- test selectorが対象を一件も収集しない成功を禁止し、expected/collected scenario countを別記録する。
- 現行browser gateが観測する範囲と未観測(actual 200% zoom、screen reader、reduced-motion挙動等)を分離して記録する。
- L0変更はrelevant tests、direct-color静的検査、CSS size/CLS、全canonical componentと代表routeの
  forced-colors/contrast/reduced-motion behaviorを確認する。`/prescriptions` screenshot一枚を全体証跡にしない。
- browser/screenshot/trace/videoはproduction接続を持たないsynthetic fixtureだけで生成する。patient sentinelは
  intended screenshot DOM以外のconsole、URL、error、artifact名へ出ないことをscanし、外部共有時はredactする。
  artifactはCI retention policyの期間だけ保持し、production data/PHIを取得・保存しない。
- UIX-003候補予算、UAC-01〜12、ST-01〜15は該当実測/human gateなしにPASSと呼ばない。

### 16.2 design debt

design debtは新しいcomponentやgeneric layerではなく、次の最小ledger rowとして`Plans.md`へ登録する:
affected UIX section / exact code path / observable harm / ux_safety_level / trigger / owner gate。
安全、privacy、accessibility、data-loss debtはNOT NOWへ隠さない。単なるvisual polishはcurrent WIPを
割り込まず、同じroot causeを持つ時だけ既存WPへ統合する。

### 16.3 change management

- 本書、§12台帳、L1 Registry、shared-kernel enum、API contractのauthorityを先に確認し、同じ概念を二重実装しない。
- UI/UX規範変更はPRC-007、screen/component追加は本書改版、domain状態変更は対応domain SSOT改版を先に行う。
- sole maintainerが最小complete diffを作り、makerと別contextがfrozen hashをreviewする。
- final approval後だけAPPROVED化し、旧UIX-002〜007のSUPERSEDED化、index、direct live referencesを同一batchで更新する。
- finalization前は旧UIX-001〜007がcurrent authorityであり、このPROPOSED revisionを実装根拠にしない。
- 変更後はaffected testsとbrowser/manual gateを実行し、未実行gateをPASSと記録しない。

## 17. 未決事項とhuman gate

| topic | authority / gate | 未決中の扱い |
|---|---|---|
| L0 theme、tenantごとの複数theme | human product + accessibility | 単一current themeを維持し設定機能を作らない |
| density、tablet縮退、拡大表示 | accessibility + pharmacist | §14.1 candidateをapprove/amendするまで既存safe layoutを維持 |
| 常設queueの氏名表示 | privacy + product | 最小表示。待合視認前提を置かない |
| 「混雑時」の処方箋数/同時操作数 | product + operations実測 | §8候補値をcapacity確定値にしない |
| usability被験者の確保方法/人数 | product + operations +各human reviewer | synthetic/demo dataでの試験計画承認までacceptanceを主張しない |
| training modeのMVP提供時期 | human product | 未決の機能を実装前提にしない |
| lock、患者切替、差し戻し | data-integrity + pharmacist | 無言lock/自動競合解消を禁止 |
| 薬剤師確認位置、確定粒度 | medical-safety + pharmacist + DOM-004 PRC-007 | current approved transitionを変更しない |
| D-2 HPKI署名の主体・時点・段帰属 | legal/regulatory (`legal_compliance_matrix #7`) + medical-safety + pharmacist | 法務判断とRB-003解除まで署名・外部登録を実装しない |
| workflow-stage enum | domain PRC-007 | shared-kernelへ先行実装しない |
| 現場用語と公式用語の対応表 | pharmacist + claim clerk | 既存語を推測で置換しない |
| screen統合と仮permission scope | product + security/privacy +該当domain | §12のID/U分類を維持し、trusted role/subject・tenant/pharmacy grant・API/OpenAPI operation registry改版を先に行う |
| active screenのboard placement | product + ui-flow + relevant medical/privacy/accessibility/pharmacist | §13.4.1のUNMAPPEDは既存surface維持。repository-verifiable mapping承認まで移動・吸収しない |
| UAC-11正式scope、JIS関係、AT/browser matrix | accessibility human gate | WCAG 2.2 AAは候補target。gate記録まで適合主張しない |
| performance/SLO/capacity | product + operations実測 | §8/§10を候補値として扱う |
| 疑義照会/残薬/高齢患者表示 | pharmacist workflow | current approved requirementを維持し推測しない |

Candidate A選択はこの表の判断、SSOT final approval、実装、migration、deploy、production/external
action、release/risk acceptanceを含まない。

## 変更履歴

- 0.2.0 (2026-08-26, PROPOSED): Candidate AによりUIX-002〜007とcomponent-system規律を
  UIX-001へ集約。required review/final human approval前は実装根拠にしない。
- 0.1.2 (2026-07-11): §4 に Visual Status Registry(視覚的状態言語の単一正本)実装対応行を追加。原則本文は不変。実装対応は【human_review_required】(医療安全レビュー未了)。詳細は docs/ui-ux-refresh/08,09,10。
- 0.1.1 (2026-07-09): WP-3007 opus4.8 医療安全レビュー反映 — §5 に ERROR(技術・システム)行を追加し、技術例外を CRITICAL に割り当てない濫発防止規定を明記。
- 0.1.0: 初版(WP-0008)。
