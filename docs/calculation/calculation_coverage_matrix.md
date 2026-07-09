# calculation_coverage_matrix — 算定カバレッジマトリクス

```yaml
ssot_id: CAL-001
title: 算定カバレッジマトリクス
domain: calculation
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
source_refs: 構築プロンプト v0.1.7 §18 / docs/plan/phase0_plan.md §2.1
depends_on:
  - docs/product/mvp_scope.md
  - docs/product/non_mvp_scope.md
impacts:
  - WP-2101(算定エンジン)
  - docs/claim/claim_scope_matrix.md
open_questions:
  - 全項目の点数・算定要件・施設基準は公式資料未確認(点数値は本書に一切記載しない)
  - 項目名称は令和6年度改定時点の一般的呼称で仮置きしており、令和8年度改定での名称・体系変更は【要確認】
  - 服薬管理指導料等の薬学管理料のMVP境界(人間レビュー)
blockers:
  - 全行 BLOCKED_REGULATORY_REVIEW(evidence_id 未発行)。解除は行単位で行う
```

## 重要な前提(捏造禁止)

- **本書に点数値・算定要件の具体・施設基準の具体は記載しない。** 公式資料(調剤点数表・留意事項通知・疑義解釈)の版・適用日を source_registry に登録し evidence_id を発行した後、行単位で追記する。
- MVP判定欄が「MVP」でも、evidence_id が空欄の間は算定エンジンに実装してはならない(@yrese/trace が実行時にも拒否する)。
- 「オフライン算定」列は LOCAL_ONLY での**仮算定**可否(確定算定は不可 — allowsFinalCalculation 実装済み)。

## マトリクス

凡例 — MVP判定: MVP / 非MVP / 【要確認】。人間Rv: 人間レビュー要否。

| ID | 算定項目(仮称・要改定確認) | MVP判定 | 根拠資料(要登録) | 必要マスター | 必要患者/薬局属性 | 公費影響 | オフライン仮算定 | test case | 医療安全影響 | 人間Rv | evidence_id | status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAL-R-001 | 調剤基本料(区分・特例含む) | MVP | 調剤点数表・施設基準・届出 | 調剤行為 | 薬局届出・受付回数・集中率 | あり | 可 | golden: 基本料区分別 | 誤請求 | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-002 | 地域支援体制加算等の基本料加算 | 【要確認】 | 施設基準・届出 | 調剤行為 | 薬局届出 | あり | 可 | golden: 届出有無 | 誤請求 | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-003 | 薬剤調製料(剤形別) | MVP | 調剤点数表 | 調剤行為・医薬品 | 剤形・調剤量 | あり | 可 | golden: 剤形×日数 | 誤請求 | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-004 | 無菌製剤処理加算等の調製系加算 | 非MVP | 同上 | 同上 | 設備要件 | あり | — | — | — | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-005 | 自家製剤加算 | 非MVP(non_mvp N6) | 同上+疑義解釈 | 同上 | — | あり | — | 検知テストのみ | 解釈幅大 | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-006 | 計量混合調剤加算 | 非MVP(non_mvp N6) | 同上 | 同上 | — | あり | — | 検知テストのみ | 同上 | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-007 | 時間外・休日・深夜加算 | MVP | 調剤点数表 | 調剤行為 | 受付日時区分 | あり | 可 | golden: 時間帯境界 | 誤請求 | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-008 | 麻薬・向精神薬・毒薬・覚醒剤原料加算 | 【要確認】 | 調剤点数表 | 医薬品(区分) | — | あり | 可 | golden: 区分判定 | 誤調剤・誤請求 | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-009 | 一包化(外来服薬支援料2 相当) | 【要確認】 | 調剤点数表・留意事項 | 調剤行為 | 指示有無 | あり | 可 | golden: 日数区分 | 誤請求 | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-010 | 調剤管理料 | MVP | 調剤点数表 | 調剤行為 | 処方内容 | あり | 可 | golden: 日数区分 | 誤請求 | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-011 | 重複投薬・相互作用等防止加算 | 【要確認】(SaMD該当性と関連) | 留意事項・疑義解釈 | — | 薬歴・疑義照会記録 | あり | 不可(外部確認前提の場合) | 検知テスト | チェック未実施誤認 | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-012 | 服薬管理指導料 | MVP(境界【要確認】) | 調剤点数表・留意事項 | — | 手帳有無・期間 | あり | 可 | golden: 手帳×期間 | 誤請求 | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-013 | かかりつけ薬剤師指導料・包括管理料 | 非MVP | 施設基準・同意要件 | — | 同意記録 | あり | — | 検知テストのみ | — | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-014 | 服薬情報等提供料 | 非MVP | 留意事項 | — | 提供記録 | あり | — | 検知テストのみ | — | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-015 | 外来服薬支援料1 | 非MVP | 同上 | — | — | あり | — | 検知テストのみ | — | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-016 | 在宅患者訪問薬剤管理指導料ほか在宅系 | 非MVP(non_mvp N4) | 同上 | — | — | あり | — | 検知テストのみ | — | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-017 | 薬剤料(所定単位・剤形別計算) | MVP | 調剤点数表・薬価基準 | 医薬品・薬価 | 用法用量・日数 | あり | 可 | golden: 五捨五超入等の端数処理【要確認】 | 金額誤り | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-018 | 特定保険医療材料料 | MVP | 材料価格基準 | 材料マスター | — | あり | 可 | golden: 材料別 | 金額誤り | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-019 | 一般名処方・後発品変更の取扱い | MVP | 関連通知 | 医薬品(一般名対応) | 変更可否 | — | 可 | golden: 変更パターン | 誤調剤 | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-020 | 長期収載品の選定療養 | MVP | 関連通知・疑義解釈 | 医薬品(対象区分) | 患者希望・医療上必要性 | あり(選定療養は保険外併用) | 可 | golden: 対象判定×負担計算 | 患者負担誤り | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-021 | リフィル処方箋対応 | 【要確認】(基本パターンのみ検討) | 関連通知 | — | 回数・期間 | あり | 可 | golden: 回次管理 | 誤調剤 | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-022 | 分割調剤 | 非MVP(non_mvp N7) | 留意事項 | — | — | あり | — | 検知テストのみ | — | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-023 | 調剤ベースアップ評価料 | 【要確認】 | 施設基準・届出 | 調剤行為 | 薬局届出 | あり | 可 | golden: 届出有無 | 誤請求 | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-024 | 一部負担金計算(負担割合・端数処理) | MVP | 健保法・通知【要確認】 | — | 負担割合・限度額 | あり(公費優先順位) | 仮計算可 | golden: 割合×端数 | 患者負担誤り | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |
| CAL-R-025 | 公費併用の按分計算 | MVP(対象公費は限定【要確認】) | 各公費制度・請求省令 | 公費マスター | 受給者証 | 本体 | 仮計算可 | golden: 併用パターン | 誤請求 | 要 | 【要確認】 | BLOCKED_REGULATORY_REVIEW |

## 行の解除手順(BLOCKED_REGULATORY_REVIEW → 実装可)

1. 公式資料の版・適用日・入手元を source_registry(WP-0005)へ登録
2. evidence_id を発行し本書の該当行に記載
3. 期待値(golden test 入出力)を公式資料から作成し、opus4.8 相当レビュー
4. 本書該当行の status を APPROVED_FOR_IMPLEMENTATION に変更
5. WP を発行(実装は Codex側、期待値レビューは Claude側)

## 実装制約(algo)

- 算定関数は純粋関数(DB・外部API・現在時刻に依存しない)。入力は患者・保険・公費・処方・調剤・施設基準・処方日/調剤日/請求月・マスター版・算定ルール版の明示引数(v0.1.7 §18)。
- 金額・点数は @yrese/money(bigint)のみ。丸めモード・単位は evidence_id 付きパラメータとして注入。
- 出力は点数明細+calculation_trace+warnings+blockers+evidence_id一覧。同一入力→同一出力。
