# code_mapping_registry_design — CodeMappingRegistry 設計

```yaml
ssot_id: MST-002
title: CodeMappingRegistry 設計
domain: masters
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - 構築プロンプト v0.1.7 §22, §26, §27
depends_on:
  - docs/masters/master_update_pipeline.md
  - docs/regulatory/source_registry.md
impacts:
  - packages/masters(将来)
  - Official Adapter 全種(コード変換の共通基盤)
open_questions:
  - 電子処方箋医薬品コード対応表の配布形式【要確認】
  - JAHIS 規約内コード表の利用条件(規約入手後)
  - mapping_confidence の閾値運用(人間レビュー通過基準)
```

## 1. 原則(v0.1.7 §22)

- 「JAHISコード」という**単一コード体系がある前提で設計してはならない**。
- **曖昧一致で請求コードを決定してはならない。** 曖昧な変換は `CODE_MAPPING_REVIEW_REQUIRED`(@yrese/shared-kernel 実装済み)とし、人間レビューを経るまで請求経路に流さない。
- すべてのマッピングは evidence_id(公式対応表・規約への参照)を持つ。根拠のない推測マッピングの登録を禁止する。

## 2. 対象コード体系

| code_system | 用途 | 配布元/根拠 |
|---|---|---|
| レセプト電算コード(医薬品/調剤行為/コメント) | 請求 | 診療報酬情報提供サービス【要確認】 |
| HOTコード | 医薬品同定・薬局内連携 | MEDIS-DC【要確認】 |
| YJコード | 医薬品同定 | 【要確認】 |
| 薬価基準収載医薬品コード | 薬価 | 厚労省告示【要確認】 |
| 一般名コード | 一般名処方 | 厚労省【要確認】 |
| 電子処方箋関連コード | 電子処方箋 | 電子処方箋医薬品コード対応表【要確認】 |
| JAHIS 仕様上のコード表 | 2Dシンボル・薬歴連携 | JAHIS 規約(入手後) |
| 用法コード | 用法標準化 | 【要確認 — JAMI標準用法等の適用可否含む】 |
| 保険者番号 / 公費負担者・受給者番号 | 資格・公費 | 制度体系(桁構造の検証規則含む) |
| 医療機関コード / 薬局コード / 都道府県番号 / 点数表区分 | 請求記録 | 【要確認】 |

## 3. レコード構造(必須フィールド — v0.1.7 §22)

```yaml
mapping_id:            # 一意ID
code_system:           # 変換元コード体系
code:                  # 変換元コード
display_name:          # 表示名
target_code_system:    # 変換先コード体系
target_code:           # 変換先コード
source:                # 根拠資料(公式対応表等)
version:               # 根拠資料の版
valid_from:            # 有効開始日
valid_to:              # 有効終了日(null=現行)
deprecated_flag:       # 廃止フラグ
replacement_code:      # 廃止時の後継コード
mapping_confidence:    # exact | official_table | derived | ambiguous
evidence_id:           # source_registry の evidence_id(必須)
review_status:         # UNREVIEWED | REVIEWED | CODE_MAPPING_REVIEW_REQUIRED
reviewed_by:           # レビュー者
reviewed_at:           # レビュー日時
```

## 4. 運用ルール

1. `mapping_confidence` が `exact` / `official_table` 以外のマッピングは、請求データ生成経路での使用を禁止する(isClaimable と同様のゲートを実装)。
2. `derived` / `ambiguous` は CODE_MAPPING_REVIEW_REQUIRED を付与し、薬剤師または請求実務者のレビュー後に `REVIEWED` へ。
3. マスター更新(MST-001)の段11(参照整合性)で、廃止コードを参照するマッピングを検出し、replacement_code の提示と再レビューを要求する。
4. 版管理: マッピングも「当時有効版」を保持し、過去の請求月の再現(返戻・再請求)に対応する。
5. 監査: マッピングの追加・変更・レビューは全件監査ログに記録する。
6. 移行データのコード変換(legacy_rececon_migration)も本 Registry を経由する — 移行専用の別ルート変換を禁止する(v0.1.7 §9.1: コード不明データの自動割当禁止)。

## 5. 実装方針(Phase 1 以降)

- `packages/masters` 内のドメインモデル + DB テーブル(Cloud Core 正本、Edge 配布)。
- 変換 API は「変換結果 + confidence + evidence_id + review_status」を常に返し、呼び出し側が請求可否を判定できる形にする。
- 単体テスト: 曖昧一致が請求経路で拒否されること、廃止コードの後継提示、当時有効版の選択。
