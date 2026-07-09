# implementation_migration_plan — 導入移行計画

```yaml
ssot_id: OPS-001
title: 導入移行計画
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
source_refs: 構築プロンプト v0.2.0 §9.1 / docs/plan/phase0_plan.md §7
depends_on:
  - MST-002 (code_mapping_registry_design)
  - OPS-002 (legacy_rececon_migration_matrix)
  - OPS-003 (parallel_run_and_cutover_plan)
  - REG-003 (legal_compliance_matrix)
open_questions:
  - 移行元レセコン機種の確定(対象ベンダー・バージョン)【要確認】
  - 移行元からのエクスポート形式の入手可否【要確認】
  - 旧システム保存義務データの範囲と参照期間【要確認 — REG-003 と同期】
```

## 1. 方針

MVPであっても、新規薬局の空環境だけを前提にしない(v0.2.0 §9.1)。
既存レセコン・電子薬歴・POS・監査機器・帳票・請求運用からの移行を第一級のユースケースとして扱う。

移行は以下の5段階で行う。

| 段階 | 内容 | 出口条件 |
|---|---|---|
| M1 アセスメント | 移行元システム・データ範囲・件数の棚卸し | OPS-002 マトリクス確定 |
| M2 マッピング | コード・患者・保険・公費のマッピング定義 | CodeMappingRegistry(MST-002)登録+レビュー |
| M3 リハーサル | 検証環境での移行実行・照合 | 件数・金額照合が許容差分内 |
| M4 並行稼働 | 旧新併用期間(OPS-003) | 並行稼働差分が Go/No-Go 基準内 |
| M5 カットオーバー | 本番切替(OPS-003) | Go/No-Go(OPS-012)通過 |

## 2. 移行照合(必須)

- 件数照合: 患者・保険・公費・処方・調剤・請求履歴の移行前後件数一致
- 金額照合: 請求履歴・未収・返金の金額合計一致(不一致は全件リスト化)
- 重複患者統合: 統合候補は自動確定せず人間レビュー(MANUAL_REVIEW_REQUIRED)
- 移行監査ログ: 移行実行者・日時・件数・差分・承認者を監査ログ(SEC-007)へ記録
- 移行後レビュー: 薬剤師・請求実務者による標本抽出レビュー

## 3. 禁止事項(v0.2.0 §9.1)

- 移行元データの意味を推測して取り込むこと
- コード不明データを自動で請求コードへ割り当てること(必ず CODE_MAPPING_REVIEW_REQUIRED)
- 移行照合なしに本番利用へ進むこと
- 切替失敗時の戻し手順なしに導入すること
- 旧システムで保存義務があるデータを勝手に破棄すること

## 4. BLOCKER 運用

| BLOCKER | 発生条件 | 解除条件 |
|---|---|---|
| BLOCKED_MIGRATION_MAPPING_UNKNOWN | 移行元コード体系が不明/マッピング未定義 | MST-002 への登録+レビュー完了 |
| BLOCKED_CUTOVER_ROLLBACK_UNDEFINED | 戻し手順が未定義 | OPS-003 のロールバック手順承認 |
| BLOCKED_LEGACY_RETENTION_UNKNOWN | 旧システム保存義務が未整理 | REG-003 で保存期間確定+参照期間合意 |

## 5. 請求月境界

- 切替日は請求月境界に合わせる(月中切替は原則禁止。例外は人間レビュー必須)
- 切替月のレセプトは「どちらのシステムで請求するか」を薬局単位で一意に確定する
- 切替前後のマスター版整合性を master_update_pipeline(MST-001)の版選択ルールで検証する
