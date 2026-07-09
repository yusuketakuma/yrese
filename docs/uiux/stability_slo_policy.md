# stability_slo_policy — 安定性SLO・設計要求

```yaml
ssot_id: UIX-005
title: 安定性SLOポリシー
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
source_refs: 構築プロンプト v0.2.0 §8.2, §9.3 / docs/plan/phase0_plan.md §6, §8
depends_on: [docs/architecture/offline_mode_matrix.md, docs/architecture/recovery_sync_design.md]
open_questions:
  - SLO数値は候補値。sla_slo_policy(operations)と統合し Phase 1 実測で確定【要確認】
  - 自動保存間隔・保持世代数は入力画面実装時に確定【要確認】
```

## 1. SLO候補値(UI起点)

| 指標(§9.3) | 候補値 | 測定方法 |
|---|---|---|
| crash-free sessions | ≥ 99.5% | フロントエンドエラー計測(PHI非送信) |
| successful save rate(処方入力保存) | ≥ 99.9% | API 応答計測 |
| duplicate submission rate(二重送信) | 0(検出時ブロック) | Idempotency-Key 衝突計測 |
| error rate(主要API) | < 0.5% | 構造化ログ |
| print failure rate | < 1%(失敗は100%可視化+再試行導線) | 印刷ジョブ計測 |
| sync backlog size / queue age | 閾値超過でUI警告(閾値は Phase 1) | 同期ダッシュボード |
| external adapter timeout rate | 閾値超過で EXTERNAL_DEGRADED 遷移提示 | Adapter 計測 |

## 2. 設計要求(§8.2 全項目)

| ID | 要求 | 実装方針 |
|---|---|---|
| ST-01 | フロントエンドクラッシュ耐性 | ルート単位の error boundary。復旧導線と入力保全を表示 |
| ST-02 | APIタイムアウト設計 | 全呼び出しにタイムアウト+ユーザー可視の失敗表示(握りつぶし禁止) |
| ST-03 | リトライ設計 | 冪等な読み取りのみ自動リトライ。書き込みは Idempotency-Key 付き明示リトライ |
| ST-04 | 自動保存 | 処方入力・調剤入力・疑義照会記録は下書き自動保存(間隔【要確認】)。下書きは「仮」表示(P-06) |
| ST-05 | 入力中データ保護 | ブラウザ更新・端末スリープ・通信断後に入力復元(UAC 対象) |
| ST-06 | 二重送信防止・冪等性 | 送信ボタン多重押下防止+サーバ側 Idempotency-Key(@yrese/events 準拠) |
| ST-07 | 部分失敗の可視化 | 一括操作は成功/失敗件数と失敗明細を必ず表示 |
| ST-08 | ネットワーク断の検知 | 検知→10s以内にモード表示更新(UIX-003 #17)。SystemModeBadge が単一表示点 |
| ST-09 | LOCAL_ONLY への安全な遷移 | offline_mode_matrix(ARC-001)の許可・禁止に従い、禁止操作をUI上も無効化+理由表示 |
| ST-10 | RECOVERY_SYNC の安全な復旧導線 | recovery_sync_design(ARC-002)の要再検証一覧をホームに表示 |
| ST-11 | 帳票出力失敗時の再試行 | 失敗ジョブの一覧・再試行・二重印刷防止(印刷済み証跡) |
| ST-12 | 請求データ生成失敗時の原因表示 | 失敗原因を error code + 該当データへの導線付きで表示(PHI をエラー文へ含めない) |
| ST-13 | ログ・監査証跡の欠落防止 | 監査対象操作は監査ログ書き込み成功を操作完了条件にする(audit_log_design) |
| ST-14 | Edge Node 自己診断 | 起動時 self-test 結果を管理画面と SystemMode に反映 |
| ST-15 | バージョン不整合検出 | Cloud/Edge の schema/master 版不一致を検出し警告+機能制限 |

## 3. 禁止

- 安定して見せるためにエラーを握りつぶすこと(§8.2)
- 未完了処理の完了表示・曖昧な「処理中」放置(§8.5)
