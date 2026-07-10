# calculation_pure_function_policy — 算定エンジン純粋関数規律

```yaml
ssot_id: CAL-010
title: 算定エンジンの純粋関数規律(決定論・I/O分離・暗黙時刻禁止)
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
updated_at: 2026-07-11
effective_from: null
effective_to: null
source_refs:
  - 構築プロンプト v0.2.0 §18
  - CAL-004 v0.2.1 / CAL-005 §2(大原則)/ CAL-006 §4
  - MOD-010(money_point_policy)/ MOD-003(依存方向)
depends_on: [CAL-004, CAL-005, CAL-006, MOD-003, MOD-010]
impacts: [packages/calculation, ARC-005, ARC-006, CAL-011]
related_work_packages: [WP-0044, WP-2101b, WP-4028, WP-9002-W6C]
related_tests:
  - packages/calculation/src/calculation.test.ts
  - pnpm check:calculation-purity
  - pnpm test:scripts
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W6C metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions: []
blockers: []
```

## 1. 目的と結論

算定エンジン(packages/calculation)が満たすべき純粋関数規律を、既存実装(WP-2101b)で成立している性質の明文化として確定する。

**結論: 算定は「同一入力 → 同一出力」の純粋関数である。この性質は再算定・再投影(ARC-006)・golden test(CAL-011)・監査説明responsibility の前提であり、緩和不可。**

## 2. 規律(全て機械検証可能であること)

1. **暗黙の現在時刻禁止**。`Date.now()` / `new Date()` を算定経路で呼ばない。日付は全て入力(prescriptionDate / receptionDate / dispensingDate / claimMonth — @yrese/date-time の CalendarDate/ClaimMonth)として受け取る。
2. **浮動小数点禁止**。金額・点数は @yrese/money(bigint ベース)のみ(MOD-010)。`number` による金額演算・`parseFloat`・`Math.round` 系の丸めを算定経路に置かない。
3. **同一入力 → 同一出力**。乱数・環境変数・ロケール・実行順序に依存しない。Map/Set の列挙順に意味を持たせる場合は明示的にソートする。
4. **I/O 分離**。DB・外部 API・ファイル・UI への依存禁止(MOD-003)。マスター・施設基準・過去算定履歴・外部確認状態は**スナップショットとして明示入力**する(CAL-005 §4 の FacilityBasisSnapshotRef / priorCalculationHistoryRef が正)。
5. **例外も出力の一部**。根拠不足・不正入力は BLOCKED 結果または型付きエラーとして決定的に返す。ログ出力を副作用として算定経路に混ぜない(trace が唯一の説明チャネル — CAL-008)。
6. **trace は純粋な戻り値**。calculation_trace は関数の戻り値として構築し、グローバル状態・collector への書き込みで蓄積しない。

## 3. 入力スナップショット原則

pure function を維持したまま状態依存の判定(月内回数・施設基準・外部確認)を扱うため、**状態は全て呼び出し側が固定したスナップショットとして渡す**。

- スナップショットの鮮度・整合性(いつ取得したか、請求月単位の固定)は呼び出し側の責務であり、該当 SSOT(WP-0027 facility basis、CAL-007 請求可否)で定める。
- エンジンはスナップショットの中身を信頼せず、構造検証(CAL-005 段1)を通ったものだけを評価する。

## 4. 検証方法

- 既存 golden test(CAL-011)は同一入力の繰り返し実行で常に同一結果になることを前提とする。
- 機械ゲート候補: 算定パッケージ内の `Date.now` / `new Date(` / `Math.random` / `parseFloat` の静的検査(scripts/check-boundaries.mjs の拡張として提案可 — 実装は独立 WP)。

## 5. 停止条件(fail-closed)

- 算定経路への時刻・乱数・I/O 依存の混入 → CHANGES_REQUESTED(レビューゲートで拒否)
- スナップショット入力を経ない状態参照(DB 直読み等) → BLOCKED(MOD-003 違反)
- 浮動小数点による金額・点数演算 → BLOCKED(MOD-010 違反)

## 変更履歴

- 0.1.0 (2026-07-09): 初版起草(WP-0044)。既存実装(WP-2101b)で成立している性質の明文化。
