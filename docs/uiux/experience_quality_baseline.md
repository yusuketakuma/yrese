# experience_quality_baseline — 体験品質ベースライン

```yaml
ssot_id: UIX-002
title: 体験品質ベースライン
domain: uiux
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-12
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: null
effective_to: null
source_refs: 構築プロンプト v0.2.0 §8 / docs/plan/phase0_plan.md §6
depends_on: [docs/uiux/medical_ui_ux_principles.md]
impacts: [docs/uiux/performance_budget.md, docs/uiux/usability_acceptance_criteria.md, docs/uiux/stability_slo_policy.md]
related_work_packages: [WP-0032, WP-3007, WP-9002-W25]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - 0.1.0 2026-07-09 初版APPROVED
  - 0.1.0 2026-07-12 WP-9002-W25 metadata-only migration; body and UX authority unchanged
open_questions:
  - 「混雑時」の定量定義(処方箋枚数/時)— performance_capacity_plan と整合(実測前は候補値)
  - training mode の提供時期(MVP同梱か直後か)
blockers: []
```

## 1. 最低基準(v0.2.0 §8)

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

## 2. 三本柱の設計方針

### 2.1 速さ(§8.1)

- Pharmacy Edge Node をローカル読み書きの一次面とし、患者検索・医薬品検索・処方入力・仮算定はローカル完結(数値目標は performance_budget.md)
- 重い処理(レセプト生成・月次締め・マスター検証)は非同期化+進捗表示+バックグラウンド状態表示
- ローカルキャッシュ・検索インデックス・キーボードショートカット・連続入力導線・画面遷移数削減・一括操作・読取デバイス即時反映・帳票プレビュー待ち時間削減
- **禁止**: 速さのために外部確認・薬剤師確認・算定根拠・監査ログ・レセプト検証を省略すること

### 2.2 安定性(§8.2)

- 詳細は stability_slo_policy.md。自動保存・入力中データ保護・二重送信防止・冪等性・部分失敗の可視化・LOCAL_ONLY への安全遷移・入力復元を設計要求とする
- **禁止**: エラーの握りつぶし。失敗は失敗として明示し、再確認・再送・人間レビューへ導く

### 2.3 直感性(§8.3)

- 業務順序に沿ったナビゲーション(実装済み: BusinessNav 2b195b5)
- 医療・薬局実務に沿った用語+公式用語の対応付け(対応表は【要確認】UIX-001 §6)
- 文脈ヘルプ・入力例・エラー原因と対処・次操作の提示・警告重要度分類(UIX-001 §5)
- 仮・確定・保留・請求不可の状態明確化、色非依存(実装済み: SystemModeBadge / PatientHeader)
- 過剰なチュートリアル依存禁止
- **禁止**: 直感性のために制度上必要な確認項目・危険表示を隠すこと

## 3. 体験品質で禁止すること(§8.5 全10項)

1. 速く見せるために未完了処理を完了済みに見せる
2. エラーを隠して安定しているように見せる
3. 外部確認未完了を成功扱いに見せる
4. UIを簡単に見せるために必須確認を省略する
5. 処理中・同期中・保留中を曖昧に表示する
6. 画面操作の短縮のために薬剤師確認を省略する
7. 自動補完で請求コードを曖昧決定する
8. サジェストで誤薬・規格違いを誘発する
9. 初見で分かることを理由に監査証跡・根拠表示を削る
10. 見た目の洗練を理由に医療安全上の情報密度を下げすぎる

## 4. 必須テスト(§8.6 → test_strategy へ反映)

performance budget test / perceived performance review / latency regression test / usability heuristic review / first-run task completion test / manual-less workflow test / keyboard-only workflow test / error recovery usability test / offline UX test / recovery sync UX test / accessibility test / warning fatigue review / pharmacist workflow review / claim clerk workflow review

## 5. 【要確認】

- 「混雑時」の定量定義(処方箋枚数/時)— performance_capacity_plan と整合(実測前は候補値)
- training mode の提供時期(MVP同梱か直後か)
