# observability_plan — 可観測性計画

```yaml
ssot_id: OPS-009
title: 可観測性計画
domain: operations
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs: 構築プロンプト v0.2.0 §9.6 / docs/plan/phase0_plan.md §8
depends_on:
  - SEC-007 (audit_log_design)
  - SEC-004 (privacy_impact_assessment)
  - OPS-005 (sla_slo_policy)
open_questions:
  - APM/ログ基盤の製品選定(CloudWatch 中心 or 追加 SaaS)(Phase 1)
  - Edge Node からのテレメトリ送信頻度と LOCAL_ONLY 時のバッファ上限(Phase 1)
  - アラート通知先(オンコール体制)【要確認 — 経営レビュー】
```

## 1. 原則

- 障害調査のために PHI/PII をログへ出さない。同時に、correlation_id の欠落により原因追跡不能な設計も不可(v0.2.0 §9.6)
- **監査ログ(SEC-007)とデバッグ/運用ログは分離する**: 保存先・権限・保持期間・改ざん統制が異なる
- ログは structured logs(JSON)とし、全リクエスト・全同期イベントに correlation_id / causation_id を貫通させる(@yrese/events の EventEnvelope が correlation/causation を必須化済み — 85bd3aa)

## 2. ログフィールド標準

必須: timestamp / level / service / correlation_id / causation_id(イベント系)/ tenant_id / pharmacy_id / device_id / actor_id(ある場合)/ event_id(イベント系)/ error_code(エラー時)

禁止(平文出力禁止 — v0.2.0 §9.6): 患者氏名 / 生年月日 / 保険者番号・記号番号 / 公費受給者番号 / 処方内容 / その他 PHI classification ≠ none のペイロード

- redaction: ログ出力層で許可フィールドの allowlist 方式(denylist ではなく)
- PHI classification: @yrese/events の phiClassification を運用ログ経路にも適用し、phi≠none のペイロードはログ経路に乗せない(ID 参照のみ)

## 3. メトリクス・トレース

- メトリクス: UIX-003 予算対応の操作別 latency(p50/p95/p99)、error rate、二重送信検知数、sync backlog size、queue age、external adapter timeout rate、print failure rate、master distribution lag、claim batch completion time、Edge health、crash-free sessions
- トレース: リクエスト単位の分散トレース(Cloud Core 内)。Edge→Cloud は correlation_id で接続

## 4. ダッシュボード(9種 — v0.2.0 §9.6)

| # | ダッシュボード | 主要ウィジェット |
|---|---|---|
| 1 | SLO | 可用性・latency予算消化・エラーバジェット |
| 2 | 同期(sync) | backlog・queue age・dead letter・競合発生数 |
| 3 | 外部 Adapter | オン資/電子処方箋/請求の成功率・timeout・PENDING滞留 |
| 4 | 請求バッチ(claim batch) | 月次締め進捗・レセプト生成・記録条件検証エラー |
| 5 | マスター更新 | 配布 lag・検証失敗(PENDING_MASTER_VALIDATION)・版分布 |
| 6 | Edge Node health | self-test・ディスク・バージョン分布・LOCAL_ONLY 中の薬局 |
| 7 | 監査(audit) | 監査ログ書込成功率・改ざん検知・break glass 使用 |
| 8 | サポートアクセス | サポート操作数・PHI閲覧同意記録・異常アクセス |
| 9 | デバイス | 印刷失敗率・読取エラー率・デバイス接続断 |

## 5. アラートルーティング

- P1(請求不能・データ破損・PHI漏えい疑い・全 Edge 同期停止): 即時オンコール呼出+OPS-004 §4 エスカレーション
- P2(SLO 割れ進行・adapter 障害・特定薬局の業務影響): 業務時間内対応+薬局通知
- P3(劣化傾向・容量予兆): 週次レビュー
- インシデントタイムライン: correlation_id 起点で自動収集し、インシデント報告(OPS-013 / incident_management_policy)へ添付

## 6. 禁止事項(v0.2.0 §9.6)

- 患者氏名、保険者番号、公費受給者番号、処方内容等の平文ログ出力
- 障害調査に必要な correlation_id の欠落
- 監査ログとデバッグログの混同
- サポート担当者がログ閲覧で過剰な医療情報へアクセスできること
