# change_control_policy — 変更管理ポリシー

```yaml
ssot_id: QUA-003
title: 変更管理ポリシー
domain: quality
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.1.7 §10, §21, §0.1.6.17
depends_on:
  - PRC-007 ssot_governance
  - MST-001 master_update_pipeline
  - REG-002 version_watchlist
open_questions:
  - CCB(変更管理委員会)相当の構成員(人間側)の確定
```

## 1. 変更クラス

| クラス | 例 | 必要ゲート |
|---|---|---|
| C1: 通常変更 | R0-R2 のコード変更、文書整形 | 通常レビュー(PRC-005)+ CI |
| C2: 契約・共有変更 | openapi/contracts、共通モジュール public API、breaking change | CONTRACT_CHANGE_REQUEST → fable5 承認 → 両レーン影響確認 → 再生成 |
| C3: 高リスク変更 | 算定・請求・レセプト・Official Adapter・認証・監査・migration・同期 | SSOT更新 + opus4.8 レビュー + CCB相当(fable5+人間レビュー候補)+ golden/regression |
| C4: 外部起因変更 | 法令改定・マスター更新・外部IF版上げ(version_watchlist 検知) | 影響分析 → SSOT改版 → C2/C3 として処理。マスターは MST-001 の24段パイプライン |
| C5: 緊急変更 | 患者安全・請求事故・セキュリティの緊急修正 | 最小差分 + 事後CCBレビュー(72時間以内)+ incident 記録 |

## 2. 原則

- すべての変更は WP に紐づく。SSOT差分なしの高リスク実装変更を禁止する(PRC-007)。
- 共通モジュールの breaking change を agmsg 合意だけで入れない — SSOT更新+レビュー後にWP再発行(v0.1.7 §0.0.3.9)。
- generated code の手編集を禁止する(GENERATED_CODE_DRIFT_BLOCKED)。
- 請求・算定に影響するマスターは即時本番反映しない(MST-001: 検証→承認→反映→Edge配布→ロールバックポイント)。
- 変更の rollback 方法を変更前に定義する(migration は expand-migrate-contract)。
- リリース前に rollback rehearsal を行う(Phase 1 以降の環境整備後)。

## 3. version_watchlist 起点の変更フロー

1. REG-002 の監視対象に版差分を検知(定期確認 or 通知)
2. fable5 が影響分析(calculation/claim/masters/adapters への波及)
3. evidence_verification_log に新版を一次確認で追記
4. 該当SSOTを改版(当時有効版の併存保持 — 処方日・調剤日・請求月対応)
5. C2〜C4 として実装WPを発行、golden test を新旧両版で維持

## 4. 記録

変更履歴は git(WP-ID付きコミット)+ 各SSOTの change_log + State.md で三重に追跡する。C3以上は人間レビュー記録を必須とする。
