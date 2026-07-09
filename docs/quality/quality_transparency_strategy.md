# quality_transparency_strategy — 品質の証明可能性戦略

```yaml
ssot_id: QUA-007
title: 品質の証明可能性戦略(quality transparency)
domain: quality
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.2.0 §10、PRD-006 product_concept(柱2「証明可能な品質」)
depends_on:
  - PRD-006 product_concept
  - QUA-001 quality_plan
  - CAL-004 calculation_engine_design
  - CAL-008 trace_schema
impacts:
  - QUA-008 public_quality_kpi_policy
  - QUA-009 claim_return_rate_kpi_policy
blockers:
  - BLOCKED_LEGAL_REVIEW(公開KPIの法令適合性が未確認の間、外部公開の実施は BLOCKED)
open_questions:
  - 外部監査(第三者による算定根拠検証)の受け入れ形式(監査用エクスポートの仕様)
```

## 1. 目的

PRD-006 柱2「証明可能な品質」を実行可能な品質体系に落とす。yrese の品質主張は
「主張」ではなく**再現可能な証拠**で裏付ける:

1. **根拠の証明** — 算定・請求・帳票ロジックは evidence_id(evidence_register)に紐づく。
   根拠のないロジックは実装されない(fail-closed)。
2. **過程の証明** — affectsClaim=true の全算定ステップは calculation_trace に evidenceRef
   付きで記録され、任意のレセプトについて「なぜこの点数か」を後から完全再構成できる。
3. **版の証明** — ルールは versioned rules として告示版数・施行日に紐づき、
   「いつ・どの版で算定したか」が一意に定まる。
4. **結果の証明** — 品質KPI(返戻率等)を定義に基づき機械的に集計し、
   条件を満たす場合に外部公開する(QUA-008 / QUA-009)。

## 2. 証明可能性の4層

| 層 | 対象 | 実現手段 | 正本 |
|---|---|---|---|
| L1 根拠 | 点数・要件の出典 | evidence_register(EVD-CAL-*) | CAL-003 |
| L2 過程 | 個別算定の導出 | calculation_trace + evidenceRef 実行時強制 | CAL-008 / trace パッケージ |
| L3 版 | ルールの時間軸 | ruleset バージョン(例: calculationRulesV20260601)+ effectiveFrom ガード | CAL-004 |
| L4 結果 | 集計品質指標 | 公開KPI(返戻率等)の fail-closed 集計 | QUA-008 / QUA-009 |

L1〜L3 は実装済みの規律の再宣言であり、本書はそれらを「外部に証明を提示できる」
一貫した体系として束ねる。L4 が本 WP(WP-0043)の新規部分である。

## 3. 原則

- **証拠なき品質主張の禁止**: 対外的な品質表明(返戻率・稼働率等)は、定義 SSOT と
  集計手順が APPROVED である指標のみ行う。定義のない数値の対外提示は BLOCKED。
- **fail-closed 集計**: 確定していないデータ(未確定レセプト・PENDING 系ステータス)は
  KPI 分母・分子のいずれにも算入しない。不明は「含めない」に倒す。
- **再現可能性**: 公開した KPI 値は、集計時点のデータスナップショットと定義版数から
  第三者(監査人)が再計算できる形で記録する(監査エクスポートの仕様は open question)。
- **PHI 非露出**: 公開・証明のいずれの経路でも PHI/PII を外部に出さない。
  匿名化・集計粒度の要件は QUA-008 に従う。

## 4. 適用範囲と非範囲

- 範囲: 品質の対外証明に関する方針・KPI 定義体系・公開判断手順。
- 非範囲: KPI の具体的閾値・公開頻度・公開媒体(法令レビューと運用実績を踏まえ、
  改版で決定する)。個別 KPI の定義本体は QUA-008 / QUA-009 以降の各 SSOT が持つ。

## 5. 停止条件

- 法令レビュー(BLOCKED_LEGAL_REVIEW)完了まで、KPI の**外部公開の実施**は BLOCKED。
  内部集計・定義整備は進めてよい。
- 定義 SSOT が APPROVED でない KPI の公開は不可(SSOT_UPDATE_REQUIRED)。

## 変更履歴

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(QUA-008/QUA-009 への参照を depends_on から impacts へ移動し循環依存を解消)。
- 0.1.0 (2026-07-09): 初版起草(WP-0043)。
