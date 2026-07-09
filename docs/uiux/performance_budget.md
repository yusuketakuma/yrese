# performance_budget — 主要操作の性能予算

```yaml
ssot_id: UIX-003
title: 性能予算(performance budget)
domain: uiux
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs: 構築プロンプト v0.1.7 §8.1, §9.3 / docs/plan/phase0_plan.md §6, §8
depends_on: [docs/uiux/experience_quality_baseline.md]
open_questions:
  - 全数値は Phase 0 候補値。Phase 1 以降の実測(latency regression test)で調整する
  - 混雑時(ピーク時)の同時操作数の定義は performance_capacity_plan と整合させる【要確認】
```

## 1. 設計前提

- **Edge Node ローカル一次面**: 患者検索・医薬品検索・処方入力・仮算定は薬局内 Edge Node で完結させ、Cloud Core 往復を要求経路に置かない。
- 帳票生成・レセプト生成・月次締め・マスター検証は**非同期ジョブ**とし、UI は進捗と完了/失敗を明示する(体感速度と正確性の分離)。
- 測定点は「ユーザー操作 → 画面上で結果が利用可能になるまで」(perceived latency)。計測は correlation_id 付き構造化ログで行う(PHI 非出力)。

## 2. 候補値(すべて Phase 1 実測調整前提)

| # | 操作(§9.3 対象) | p50 | p95 | 形態 |
|---|---|---|---|---|
| 1 | 受付ダッシュボード表示(初期表示) | 300ms | 1,000ms | 同期 |
| 2 | 画面遷移(shell内) | 150ms | 500ms | 同期 |
| 3 | 患者検索(ローカル) | 100ms | 200ms | 同期 |
| 4 | 医薬品検索(ローカルインデックス) | 100ms | 200ms | 同期 |
| 5 | 処方箋2次元シンボル読取→仮取込表示 | 500ms | 1,500ms | 同期 |
| 6 | 処方入力保存(ローカル) | 150ms | 400ms | 同期 |
| 7 | 算定実行(仮算定・ローカル) | 200ms | 500ms | 同期 |
| 8 | calculation_trace 表示 | 100ms | 300ms | 同期 |
| 9 | 帳票プレビュー | 500ms | 1,500ms | 同期(生成は先行非同期可) |
| 10 | 帳票印刷キュー投入 | 200ms | 500ms | 同期(印刷完了は非同期通知) |
| 11 | 会計確定 | 300ms | 800ms | 同期 |
| 12 | 請求前点検(月内全件・1,000件規模) | — | 30s | 非同期+進捗 |
| 13 | 月次締め | — | 5min | 非同期+進捗 |
| 14 | 電子レセプト出力 | — | 10min | 非同期+進捗 |
| 15 | マスター更新検証(24段パイプライン) | — | 業務非ブロック | 非同期(旧版継続) |
| 16 | Cloud Core / Edge 同期(通常時バックログ解消) | — | 5min | バックグラウンド |
| 17 | ネットワーク断検知 → LOCAL_ONLY 表示 | — | 10s | 自動 |
| 18 | RECOVERY_SYNC 開始 → 要再検証一覧表示 | — | 60s | 非同期+進捗 |

## 3. 運用ルール

- 予算超過は BLOCKED_PERFORMANCE_SLO 相当の品質課題として扱い、リリースゲートで latency regression test により検査する。
- **高速化のために算定検証・監査ログ・外部確認を省略してはならない**(v0.1.7 §9.3 禁止事項)。
- 非同期ジョブは「処理中・同期中・保留中」を曖昧に表示しない(§8.5-5)。進捗・残件数・失敗件数を表示する。
