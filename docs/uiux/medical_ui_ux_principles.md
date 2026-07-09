# medical_ui_ux_principles — 医療システムに相応しいUI/UX原則

```yaml
ssot_id: UIX-001
title: 医療UI/UX原則
domain: uiux
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs: 構築プロンプト v0.1.7 §7 / docs/plan/phase0_plan.md §5
depends_on: [docs/product/mvp_scope.md, docs/architecture/offline_mode_matrix.md]
impacts: [apps/web/**, docs/uiux/screen_inventory_draft.md]
open_questions: 本文の【要確認】参照
```

## 1. 優先順位

UI/UX のあらゆる判断は次の優先順で行う。下位の価値のために上位を犠牲にしてはならない。

**患者安全 > 医療安全(誤調剤・誤操作防止)> 誤請求防止・監査証跡・法令適合性 > 視認性・説明可能性・業務継続性 > 入力効率・キーボード操作 > 見た目**

v0.1.7 §7 の優先項目(薬剤師確認 / 障害時の誤認防止 / 権限管理 / 現場デバイス対応 / 高齢患者対応 / 混雑時対応 / 多職種利用 / アクセシビリティ)はすべてこの枠内で扱う。

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
| P-09 | 患者取り違えを防ぐ | 氏名+カナ+生年月日+年齢+性別を患者文脈の全画面に固定表示 |
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

## 3. 禁止事項(v0.1.7 §7 全15項)

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
| P-14 | PermissionScope 型 + requirePermission(deny-by-default、403 + AUTH-0003)【WP-2002 実装中】 | packages/shared-kernel permissions.ts(9ab039e) |
| 直感性(業務順ナビ) | BusinessNav: 受付→患者→処方入力→会計→請求前点検→月次締めの業務順 | apps/web/app/nav.tsx(2b195b5) |
| キーボード操作 | :focus-visible フォーカスリング常時明示 | apps/web/app/globals.css(12a5ac2) |
| P-05〜P-08, P-10〜P-13, P-15〜P-19 | 未実装(該当画面の実装WPで本SSOTを根拠に実装) | — |

## 5. 警告重要度分類

| レベル | 表示 | 応答要求 |
|---|---|---|
| BLOCKER | 画面中央・進行停止 | 解除条件充足まで先へ進めない |
| CRITICAL(患者安全) | 赤系+アイコン+テキスト、確認操作必須 | 薬剤師確認の記録 |
| WARNING(請求・業務) | 黄系+テキスト、一覧化 | 確認チェック(まとめ確認可) |
| INFO | 控えめ表示 | 応答不要 |

濫発防止: WARNING 以下を CRITICAL 表示にエスカレートしない。warning fatigue review(§8.6)で定期監査する。

## 6. 【要確認】

- 高齢患者向け表示(文字サイズ切替等)の対象画面範囲(薬剤師レビュー)
- 疑義照会記録の必須項目(実務レビュー)
- 現場用語⇔公式用語対応表の初版(薬剤師・事務レビュー)
