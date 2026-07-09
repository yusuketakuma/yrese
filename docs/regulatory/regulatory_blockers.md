# regulatory_blockers — 規制系BLOCKER台帳

```yaml
ssot_id: REG-004
title: 規制系BLOCKER台帳
domain: regulatory
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
source_refs: 構築プロンプト v0.1.7 §42, docs/plan/phase0_plan.md §20
open_questions:
  - ONSアクセス確保の主体・時期(人間の手続きが必要)
blockers: 本台帳の全行
```

## 運用ルール

- 本台帳は「実装してはいけない範囲」を明示する。解除は fable5 が解除条件の充足を確認し、該当SSOTを APPROVED にしたうえで行う。
- 解除条件の中核は evidence_id 発行(source_registry で版・取得日記録)。
- 高リスク領域の解除は opus4.8 レビュー+人間レビューを経る。

## 台帳

| ID | BLOCKER | 対象機能 | 実装禁止範囲 | 解除条件 | 次アクション | 担当 |
|---|---|---|---|---|---|---|
| RB-001 | BLOCKED_REGULATORY_REVIEW | 電子レセプト生成 | 記録条件仕様に依存するファイル生成・バリデーション実装 | 調剤用記録条件仕様の版確認+evidence_id発行+electronic_receipt_design APPROVED | 支払基金サイトから最新仕様を取得し版を記録 | fable5 |
| RB-002 | BLOCKED_REGULATORY_REVIEW | オンライン資格確認連携 | 外部IF仕様に依存する接続実装 | オン資外部IF仕様書の入手(ONS)+境界SSOT APPROVED | ONSアクセス手段の確保(人間手続き) | 人間+fable5 |
| RB-003 | BLOCKED_REGULATORY_REVIEW | 電子処方箋 | 取得・調剤結果送信・チェック機能の実装 | 技術解説書(2.04版以降指定)+記録条件仕様の確認+境界SSOT APPROVED | ONSアクセス確保後に仕様確認 | 人間+fable5 |
| RB-004 | BLOCKED_REGULATORY_REVIEW | オンライン請求送信 | 公式手順外の送信自動化・画面自動操作・非公式API | 公式接続方式・電子証明書・接続試験・運用規約の確認 | MVPでは公式手順への受け渡しまでに限定(設計で分離済み) | fable5 |
| RB-005 | BLOCKED_PMH_REVIEW | PMH医療費助成 | 助成確認・按分計算の実装 | PMH利用規約・制度関連マスタ・事前検証要件の確認 | デジタル庁PMHサイトの資料確認 | fable5 |
| RB-006 | BLOCKED_NSIPS_LICENSE | NSIPS Adapter | NSIPS仕様の参照・複製・模倣・アダプター設計 | 日本薬剤師会の正規許諾取得 | 許諾取得の要否・時期を経営判断(human_review_checklist #4) | 人間 |
| RB-007 | BLOCKED_PMDA_SAMD_REVIEW | 重複投薬等チェック・併用禁忌チェック・調剤監査支援 | 臨床判断支援に該当しうる機能の実装 | SaMD該当性判定(samd_applicability_assessment)完了+人間レビュー | 該当性ガイドラインとの照合を実施 | fable5+法務 |
| RB-008 | BLOCKED_REGULATORY_REVIEW | 算定エンジン(点数値) | 具体的な点数・算定条件・丸め政策値のコード化 | 令和8年度調剤報酬(点数表・留意事項)の版確認+calculation_rules APPROVED+golden test期待値のSSOT化 | 厚労省告示・通知の取得と calculation_coverage_matrix 整備 | fable5+opus4.8 |
| RB-009 | BLOCKED_CODE_MAPPING_REVIEW | コードマッピング | 曖昧一致による請求コード決定 | CodeMappingRegistry 設計 APPROVED+マスター取得 | code_mapping_registry_design 作成(WP-0007) | fable5 |
| RB-010 | BLOCKED_QUALITY_REGULATORY_REVIEW | 品質規格該当性 | ISO 13485/IEC 62366等の適用前提の確定 | SaMD該当性判定の結果に従い要否確定 | RB-007 の後続 | fable5+品質 |

## 解除履歴

(なし — 解除時に「日付 / ID / 解除根拠 evidence_id / 承認者」を記録する)
