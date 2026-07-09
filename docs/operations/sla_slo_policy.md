# sla_slo_policy — SLA / SLO ポリシー

```yaml
ssot_id: OPS-005
title: SLA / SLO ポリシー
domain: operations
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
source_refs: 構築プロンプト v0.1.7 §9.3, §9.8 / docs/plan/phase0_plan.md §8
depends_on:
  - UIX-003 (performance_budget)
  - UIX-005 (stability_slo_policy)
  - OPS-006 (performance_capacity_plan)
open_questions:
  - SLA(契約値)と SLO(内部目標)の乖離幅の事業判断【要確認 — 経営レビュー】
  - メンテナンスウィンドウの標準時間帯(薬局営業時間外の定義)【要確認】
  - 全数値は候補値 — Phase 1 実測で調整
```

## 1. 位置づけ

- **性能の予算値**(操作別 p50/p95)は UIX-003 を正本とし、本書で重複定義しない。
- **安定性の SLO**(crash-free・二重送信ゼロ等)は UIX-005 を正本とする。
- 本書は「サービスとしての SLA/SLO 体系・エラーバジェット・メンテナンス・通知」を定義する。

## 2. サービス SLO(候補値)

| 指標 | SLO 候補値 | 計測 |
|---|---|---|
| Cloud Core 可用性(月間) | 99.9% | ヘルスチェック+合成監視 |
| 業務継続可用性(Edge 併用時) | 99.95% 相当(LOCAL_ONLY 継続を含む) | モード遷移ログから算出 |
| RTO(Cloud Core 全損) | 4時間【候補値】 | DR 訓練で実測 |
| RPO(Cloud Core) | 15分【候補値】 | PITR/バックアップ設定から検証 |
| RPO(Edge Node 単体故障) | 最終同期時点+ローカルバックアップ差分 | リストア訓練 |
| 月次請求バッチ完了時間 | 請求データロックから2時間以内【候補値】 | claim batch dashboard |
| 外部 Adapter タイムアウト率 | < 1%(外部側障害を除く) | adapter dashboard |

- SLA(対外契約値)は SLO から安全マージンを取って設定する【要確認 — 経営レビュー】。
- SLA/SLO 未定義で本番提供することを禁止する(v0.1.7 §9.8)。

## 3. エラーバジェット運用

- SLO 割れが発生した月は、新機能リリースより信頼性改善を優先する(release gate に反映)
- 月次請求期(1日〜10日【候補値】)は変更凍結(OPS-004 §3)とし、エラーバジェットを消費する変更を持ち込まない

## 4. メンテナンス・通知

- 計画メンテナンス: 薬局営業時間外【要確認】に実施し、7日前通知【候補値】。Blue/Green により原則無停止(v0.1.7 §30)
- 緊急メンテナンス: 事後説明責任(インシデント報告と紐づけ)
- 障害通知: OPS-004 §4 のエスカレーション基準に従う
- SLO 実績はテナント向けに月次で開示する【候補値 — 開示範囲は経営レビュー】

## 5. 禁止事項

- SLA/SLO 未定義での本番提供
- コスト削減のために監査ログ・バックアップ・暗号化を削ること(OPS-014 と同期)
- 高速化・安定表示のための検証省略・エラー隠蔽(UIX-002/003/005 の禁止を継承)
