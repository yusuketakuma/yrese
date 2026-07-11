# 算定エンジン ロジックレビュー(2026-07-11)

対象: `packages/calculation/src/index.ts`(CAL-004 v0.2.1 / CAL-006 v0.2.0 準拠実装)。
本書は non-SSOT の作業文書(レビュー記録)。修正はすべて **CAL-004/CAL-006 の承認済みセマンティクスの範囲内の強化**であり、
スコープ外(乗率・減算・クランプ・要件自動判定・copay)は実装しない。

## 所見(重大度順)

| # | 重大度 | 所見 | 対応 |
|---|---|---|---|
| R-1 | **High** | **負点数の混入を防げない**。`validateStepResult` は `itemPoints instanceof Points` しか検査せず、`Points` は負値を表現できる(`fromInteger(-5)`/`subtract`)。CAL-004 §2 は減算をスコープ外とし「実装は本SSOTの改版まで禁止」と明記するが、エンジンは負の固定点数として混入した減算を検知せず合算してしまう(誤請求方向の欠陥。fail-closed 原則違反) | **修正**: `itemPoints` が負なら `SSOT_UPDATE_REQUIRED` で BLOCKED(0 は許容 — 合算に無害) |
| R-2 | **High** | **effectiveTo(適用終了)ガードが無い**。CAL-006 §3.1 停止条件は「effective_to なしでの複数版共存は禁止(失効ルールの適用継続=誤請求リスク)」。第2版 evidence(改定・修正版 P-08)導入前の必須前提が未実装 | **修正**: `CalculationRule.effectiveTo?: CalendarDate`(最終有効日・その日を含む)を追加し、調剤日 > effectiveTo で BLOCKED(適用終了後)。既存ルールは effectiveTo 未設定=現行(挙動不変) |
| R-3 | Medium | **maxApplications の宣言不整合を検知しない**。適用回数カウンタは ruleId 単位だが、上限値は各 StepResult の申告値をその都度参照する。同一 ruleId の複数適用が異なる上限(または宣言有無)を申告した場合、evidence 文言との1:1対応(CAL-004 §2)が壊れているのに黙って通る | **修正**: 同一 ruleId 内で maxApplications の宣言値(未宣言含む)が食い違ったら `SSOT_UPDATE_REQUIRED` で BLOCKED |
| R-4 | Medium | **StepResult の未知フィールドを黙認する**。`validateStepResult` は既知フィールドのみ検査し、SSOT 外のフィールド(例: BLOCKED 結果に itemPoints、将来 DSL フィールドの先行密輸)を素通しする。「SSOT外の形は SSOT_UPDATE_REQUIRED」という自らの契約(invalidStepResultWarning)と不整合 | **修正**: status 別の許可フィールド集合で検査し、未知フィールドは `SSOT_UPDATE_REQUIRED` で BLOCKED |
| R-5 | Low | **warnings が重複蓄積する**(同一警告が適用数ぶん並ぶ)。警告過多は UIX-001 の warning fatigue 原則に反し、重要警告の視認性を下げる | **修正**: 初出順を保った重複排除(必須警告 requirementsNotVerifiedWarning の存在保証は不変) |
| R-6 | Info | `!hasItemCalculation && blockers.length === 0` 分岐は非空 ruleset では到達不能(各イテレーションは必ず item 加算か blocker 追加のどちらか)。防御的分岐として妥当なので維持 | 対応なし(コメントで明示) |
| R-7 | Info | 排他グループ検査は重複・上限検査の後段。blocker 発生時は最終的に total ごと破棄されるため順序による誤算定は無い | 対応なし |
| R-8 | Info | 適用日前 blocker が `BLOCKED_REGULATORY_REVIEW` を使うのは CAL-004 §3 の明文どおり(意味論の再検討は SSOT 改版事項) | 対応なし |

## スコープ外(実装しない — CAL-004 §2/§5 遵守)

乗率(EVD-CAL-0007/0068)、減算、下限クランプ(EVD-CAL-0020)、算定要件の自動判定、copay 算出、
発行保留リスト(P-01〜P-08)項目のルール実装。

## SSOT 整合

- R-1/R-3/R-4/R-5 は承認済みセマンティクスの**機械的強制の強化**であり、算定結果の意味論を変えない
  (既存 golden test の期待値に影響しないことをテストで確認する)。
- R-2(effectiveTo)は CAL-004 §3 が「将来の版管理で追加する」と予告し、CAL-006 §3.1 が第2版導入の
  必須前提とする拡張。CAL-004 の変更履歴に追記する(human_review_required)。
