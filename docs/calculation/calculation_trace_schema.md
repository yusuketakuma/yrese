# calculation_trace_schema — 算定トレース拡張スキーマ

```yaml
ssot_id: CAL-008
title: 算定トレース拡張スキーマ(formula・中間値・丸め根拠・step status)
domain: calculation
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - ユーザー提供レセコン調査(2026-07-09)§8
  - MOD-004(shared_type_registry — 変更手順)
depends_on: [MOD-004, CAL-004, CAL-005, CAL-007]
impacts: [packages/trace(後方互換拡張WP), packages/calculation]
open_questions:
  - intermediateValues の値型(string | number)における number の扱い — 金額・点数は文字列表現(bigint由来)へ限定すべきか【要確認 — MOD-010 と整合させ、float混入を型で防ぐ方針を第一候補】
blockers:
  - rounding.evidenceId を要する丸め処理自体が evidence 未発行(copay・乗率)。本スキーマは器の先行定義であり、丸め step の実装は evidence 発行後
```

## 1. 位置づけ

- **現行 @yrese/trace の実装(EvidenceRef / CalculationTrace / CalculationTraceStep / affectsClaim→evidenceRefs≥1 実行時強制 / inputsSummary の型レベルPHI排除 / URL禁止)を正本とする。**本書はその**後方互換の拡張差分**を定義する。
- calculation_trace は薬剤師・事務・請求担当・監査ログ・レセプト点検・返戻対応の**共通言語**である(説明責任: 「金額の根拠を薬剤師・事務が説明できる」 v0.1.7 §7)。

## 2. 拡張差分(現行 CalculationTraceStep への追加フィールド)

| フィールド | 型(目標) | 必須 | 説明 |
|---|---|---|---|
| feeItemCode | string | 拡張後○ | 算定項目コード(fee_item_registry = WP-0024 のキー)。現行 stepId(`{evidence_id}:{slug}`)と併存 |
| formula | string | 点数計算stepで○ | 計算式の宣言的表現(例: `fixed(47)` / `perUnit(24, oral, max=3)`)。**式文字列はPHIを含まない** |
| intermediateValues | Record<string, string> | — | 中間値(数量・単価・係数等)。**金額・点数は bigint 由来の文字列表現に限定**(float混入防止 — MOD-010)。PHI禁止(値は数量・コード・版のみ) |
| rounding | { method: string; evidenceId: EvidenceId } | 丸め発生stepで○ | 丸め方式と**丸め根拠の evidence_id(必須)**。evidence なしの丸め step は生成不可とする(実行時強制を trace 層に追加) |
| stepStatus | 'applied' \| 'suggested' \| 'excluded' \| 'blocked' | 拡張後○ | CAL-007 の候補/確定分離に対応。現行実装は applied/blocked 相当のみ |
| resultPoints / resultYen | string(bigint文字列) | — | step 単位の結果値。現行 `output`(自由文字列)の構造化後継 |

現行フィールド(stepId / description / affectsClaim / evidenceRefs / inputRefs / output)は**維持**。`output` は resultPoints/resultYen 導入後も人間可読サマリーとして残す。

## 3. 後方互換の拡張手順(MOD-004 準拠)

1. 本SSOT承認(opus4.8)→ @yrese/trace への追加は**すべて optional フィールドとして導入**(既存 trace 生成コードを壊さない)。
2. 実装WPで: 型追加 → freezeStep への検証追加(rounding.evidenceId 必須強制・intermediateValues の PHI/float 検査)→ テスト。
3. packages/calculation 側の生成コードを段階移行(stepStatus / feeItemCode 付与)。全ルールが新フィールドを付与した時点で「拡張後○」フィールドを必須化する改版を行う(2段階必須化)。
4. **既存の実行時強制(affectsClaim=true → evidenceRefs≥1)は絶対に緩めない。**stepStatus='suggested' / 'excluded' の step も evidenceRefs を持つ(なぜ候補・なぜ除外かの根拠)。

## 4. ステータス対応表

| stepStatus | 意味 | CAL-007 との対応 |
|---|---|---|
| applied | 適用・点数算入 | AUTO_CALCULATED / 確定済み |
| suggested | 候補提示(未確定・点数算入しない) | SUGGESTED_* / REQUIRES_* |
| excluded | 併算定不可・除外条件で不適用 | (項目ステータスなし — 除外理由を reason に) |
| blocked | 根拠不足・適用日前・上限超過等で停止 | BLOCKED_* |

## 5. 変更履歴

- 0.1.0 (2026-07-09): 初版。
