# calculation_golden_test_source_policy — golden test の根拠規律

```yaml
ssot_id: CAL-011
title: 算定 golden test の根拠規律(evidence 裏付けのないテスト値の禁止)
domain: calculation
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - CAL-003(evidence_register)/ CAL-004 v0.2.1 / CAL-006(test_case_refs)
  - REG-007(evidence_verification_log)
depends_on: [CAL-003, CAL-004, CAL-006, CAL-009, CAL-010]
impacts: [packages/calculation のテスト, 全 fee-item-rules 実装WP]
open_questions:
  - TST-001(テスト戦略SSOT)への golden test 台帳の統合方法
blockers: []
```

## 1. 目的と結論

算定 golden test(期待値固定テスト)の期待値がどこから来てよいかを確定する。

**結論: golden の期待値は evidence_id で裏付けられた公式資料の値のみ。推測値・実装出力の写経・他社レセコンの出力を期待値にすることを禁止する。**

## 2. 規律

1. **期待値 = evidence 由来**。各 golden test は根拠となる evidence_id(CAL-003)をテスト名またはテスト内参照として明記する(CAL-006 の test_case_refs)。
2. **実装出力の写経禁止**。「現行実装が返した値」をそのまま期待値として固定しない。期待値は register の記載から独立に導出し、実装と照合する(実装出力から golden を作ると、実装バグごと固定される)。
3. **他社出力・経験値の禁止**。ベンダーレセコンの計算結果・現場の経験的な点数を期待値の根拠にしない(模倣禁止と根拠追跡の両面)。
4. **境界の両側をテストする**。適用日・上限・排他は「通る側」と「止まる側」の両方を golden 化する(CAL-004 opus レビューで境界通過側テスト追加を必須化した経緯を規律化)。
5. **BLOCKED も golden 対象**。evidence 未発行領域が正しく BLOCKED になることをテストで固定する(fail-closed の退行検知)。

## 3. register 照合手順(期待値作成時に必須)

1. 対象ルールの evidence_id を CAL-003 で引き、**register の記載文言そのもの**から期待値・上限・条件を導出する(設計文書・記憶からの転記禁止)。
2. 文言の限定表現(「以上は算定しない」「までに限り」等)を数値に変換する際は、変換結果を register の文言と並記してテストコメントに残す。
   - 教訓事例: EVD-CAL-0021「4剤分以上は算定しない」= 上限3適用。設計側(CAL-004 初稿・opus レビュー)が揃って「4剤分まで」と誤読し、register 照合で訂正された。**register との直接照合を省略した期待値は無効**。
3. 複数ルールの合算 golden(canonical ruleset 合計 — 現行166点)は、構成ルールの evidence_id を全て列挙する。
4. 照合の実施記録は WP の検証記録(State.md / レビュー)に残す。

## 4. 改版時の扱い

- ルールセット新版(CAL-009)導入時は、旧版 golden を削除せず**版別に保持**する(当時版の再現性 = 再算定・監査対応)。
- 期待値の訂正が必要になった場合、それは「テスト修正」ではなく evidence / ルールデータの訂正イベントであり、CAL-009 の新版発行手続きを先行させる。

## 5. 停止条件(fail-closed)

- evidence_id 参照のない golden test 追加 → CHANGES_REQUESTED
- 実装出力を期待値として固定した形跡(導出過程の記録なし) → CHANGES_REQUESTED
- register 照合記録なしの点数系 golden → 承認不可

## 変更履歴

- 0.1.0 (2026-07-09): 初版起草(WP-0044)。EVD-CAL-0021 誤読事例を照合手順として規律化。
