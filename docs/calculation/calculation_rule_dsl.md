# calculation_rule_dsl — 算定ルールDSL(ルールメタデータ仕様)

```yaml
ssot_id: CAL-006
title: 算定ルールDSL(メタデータ・評価順序・バージョン管理)
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
  - ユーザー提供レセコン調査(2026-07-09)§5.5
  - CAL-004 v0.2.1 / CAL-005
depends_on: [CAL-003, CAL-004, CAL-005, CAL-007]
impacts: [packages/calculation/rules(将来), 全 fee-item-rules 実装WP]
open_questions:
  - DSL 表現形式の最終決定(第一候補: TS 型付き宣言オブジェクト。外部DSL/JSON化は多店舗配布要件が出た時点で再検討)【要確認】
  - frequency_limit(月内回数等)の判定に必要な「過去算定履歴」の入力方法(pure function 維持のため履歴スナップショットを明示入力とする方針)【要確認】
blockers:
  - required_facility_basis / frequency_limit / predicate の根拠となる留意事項通知・施設基準は evidence 未発行(CAL-003 P-05/P-06)
```

## 1. 原則

- **算定ルールをコードに直書きしない**。ルールは宣言的メタデータ+純粋な述語・計算式として定義し、エンジン(rule-evaluator)が評価する。
- ルール1件 = 公式資料の1規定に対応し、**evidence_id なしのルールは定義できない**(trace 層の実行時強制に接続)。
- ルールは版管理する(effective_from / effective_to / ruleVersion)。処方日・調剤日・請求月に対応する**当時有効版**を選択する(MST-001 の版選択ルールと同型)。

## 2. ルールメタデータ(全フィールド)

| フィールド | 必須 | 説明 | 現行実装(WP-2101b)との対応 |
|---|---|---|---|
| rule_id | ○ | 一意ID。`{evidence_id}:{slug}` 形式 | `ruleId` 実装済み |
| fee_item_code | ○ | 算定項目コード(fee_item_registry = WP-0024 の台帳キー) | 未実装(拡張) |
| rule_name | ○ | 表示名(公式名称準拠) | `description` で代替中 |
| effective_from | ○ | 施行日(CalendarDate) | `effectiveFrom` 実装済み(ガード付き) |
| effective_to | — | 廃止日。未設定=現行 | 未実装(拡張) |
| law_or_notice_ref | ○ | 告示・通知の文書参照(source_registry 連動) | `evidenceRefs[].title` で部分対応 |
| evidence_id | ○ | CAL-003 の evidence_id(複数可) | `evidenceRefs` 実装済み |
| trigger | ○ | 候補抽出条件(どの処方・調剤属性で候補になるか) | 未実装(現状は呼び出し側指定) |
| predicate | ○ | 適用可否述語(純関数。コンテキスト→boolean+理由) | 未実装。**要件 evidence 発行まで「常に要確認」固定** |
| calculation_formula | ○ | 点数計算式(固定点数/単価×数量/乗率等の宣言) | 固定点数のみ(`itemPoints`) |
| aggregation_scope | ○ | 適用単位(処方箋受付/剤/日数/月) | `applicationKey` の意味論として部分実装 |
| exclusion_group | — | 併算定不可グループ(evidence_id 必須 — CAL-004 §2) | `exclusivityGroup` 実装済み |
| upper_limit | — | 上限(回数・点数) | `maxApplications` 実装済み |
| frequency_limit | — | 期間内回数制限(月1回等)。履歴スナップショット入力が前提 | 未実装・BLOCKED(P-06) |
| required_records | — | 必要記録(薬歴・説明・同意等)。CAL-007 の REQUIRES_RECORD に接続 | 未実装 |
| required_facility_basis | — | 必要施設基準(WP-0027 FacilityBasisSnapshot 参照) | 未実装・BLOCKED(P-05) |
| required_patient_attributes | — | 患者属性条件(年齢等) | 未実装 |
| required_prescription_attributes | — | 処方属性条件 | 未実装 |
| required_dispensing_attributes | — | 調剤属性条件 | 未実装 |
| offline_allowed | ○ | LOCAL_ONLY で仮算定候補にしてよいか(WP-0029) | 未実装 |
| requires_human_confirmation | ○ | 薬剤師確認必須か(CAL-007 REQUIRES_PHARMACIST_CONFIRMATION) | 未実装 |
| test_case_refs | ○ | golden test 参照(TST-001) | テスト名の evidence_id 埋込で部分対応 |

## 3. 評価順序(14段)

```text
1 適用期間チェック(effective_from/to — 実装済みは from のみ)
2 マスター有効性チェック(BLOCKED: マスター未実装)
3 患者属性チェック
4 保険・公費・PMHチェック(BLOCKED: evidence 未発行)
5 薬局施設基準チェック(BLOCKED: P-05)
6 処方属性チェック
7 調剤属性チェック
8 算定候補抽出(trigger)
9 併算定不可・除外条件チェック(exclusion_group — 実装済み)
10 回数制限・月内制限・受付単位制限(upper_limit 実装済み / frequency_limit BLOCKED)
11 点数計算(calculation_formula — 固定点数のみ解禁)
12 負担金計算(BLOCKED: copay evidence 未発行)
13 レセプト出力可否判定(CAL-007 / isClaimable)
14 calculation_trace 生成(実装済み)
```

各段の判定結果は trace step として記録し、**評価しなかった段(BLOCKED)も trace に blocked step として残す**(監査・説明責任)。

## 4. 現行実装からの拡張パス

1. 現行 `CalculationRule`(ruleId/evidenceRefs/effectiveFrom/apply)は本DSLの**最小サブセット**として有効。既存5ルールは互換を保ったままメタデータ形式へ移行する。
2. 拡張は「メタデータ型の追加 → rule-evaluator の該当段実装 → 既存ルールの宣言化 → golden test 維持」の順。1WP=1〜2段。
3. predicate / trigger の導入時も **apply の純関数性を維持**(履歴・施設基準はスナップショット入力)。
4. ルール定義レビュー(opus4.8)の必須確認: evidence 実在・exclusion_group 網羅性・上限/期間の evidence 文言一致(AGT-014 準拠)。

## 5. 変更履歴

- 0.1.0 (2026-07-09): 初版。
