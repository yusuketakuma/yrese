# money_point_policy — 金額・点数ポリシー

```yaml
ssot_id: MOD-010
title: 金額・点数ポリシー
domain: modules
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs:
  - 構築プロンプト v0.2.0 §3(floating point禁止), §18(算定エンジン必須事項), §0.0.3.3
depends_on:
  - packages/money(533f89a)
  - docs/calculation/tensuhyo_reading_notes.md(CAL-002 — 一次資料ノート)
open_questions:
  - 使用薬剤料の端数処理(15円以下1点・10円ごと1点の正確な適用式)— CAL-002 の人間目視ダブルチェック+留意事項通知の確認後に evidence_id 付きで確定
  - 一部負担金の丸め(負担割合適用後の端数)— 公式根拠確認後に確定
  - 公費按分の丸め順序 — BLOCKED_PMH_REVIEW / 公費SSOT確定後
blockers:
  - 丸め政策値の配線は BLOCKED_REGULATORY_REVIEW(evidence_id 発行まで)
```

## 1. 絶対規則(v0.2.0 §3, §18)

1. **金額・点数・数量・負担金の計算に IEEE-754 floating point を使わない**。正本実装は `@yrese/money`(bigint 係数+scale の ScaledDecimal、整数 bigint の Yen / Points)
2. 非整数 number からの構築は実行時拒否(fromInteger は safe integer のみ、fromString は10進リテラルのみ)
3. money/date-time helper のローカル実装禁止(`COMMON_MODULE_DUPLICATION_BLOCKED`)
4. **丸め処理は公式根拠がある場合のみ実装する**。丸め単位・端数処理・負担割合・公費按分・請求先別金額は evidence_id 付きで calculation_trace に記録する(§18)

## 2. 丸めの呼び出し境界(実装済み)

- RoundingMode(7種): toward_zero / away_from_zero / half_up / half_down / half_even / floor / ceiling
- `round({scale, mode})` は **明示パラメータのみ** — どの業務がどの mode/scale を使うかの「政策値」は `@yrese/money` にハードコードしない
- 政策値の配線先は算定ルール(@yrese/calculation の CalculationRule)側とし、当該ルールの evidenceRefs に丸め根拠の evidence_id を含める(trace 層の affectsClaim 強制により、根拠なし配線は実行時に throw)

## 3. 単位の扱い

- 円(Yen)と点(Points)は型で分離し、暗黙変換しない。点→円換算(1点=10円等)も**公式根拠の evidence_id 付きルール**としてのみ実装する【要確認 — CAL-002 精読+人間レビュー】
- 表示用フォーマット(カンマ区切り等)は frontend 所有。backend は文字列表現(toString)のみ提供

## 4. テスト規約

- golden test の期待値は evidence_id 付き SSOT 由来のみ(TST-001 の5則)
- 丸めルール実装時は、各 RoundingMode の負値・境界値(half ちょうど)を含むテストを必須とする(既存 money.test.ts 11件が基礎)
