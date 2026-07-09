# calculation_rule_data_architecture — versioned rule data の構造方針

```yaml
ssot_id: CAL-009
title: 算定ルールデータのバージョン管理アーキテクチャ(ルールはデータ)
domain: calculation
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - 構築プロンプト v0.2.0 §18(versioned rule data / pure function)
  - CAL-004 v0.2.1 / CAL-005 / CAL-006(ルールDSL・評価順序)
  - CAL-003(evidence_register)
depends_on: [CAL-003, CAL-004, CAL-005, CAL-006]
impacts: [packages/calculation, ARC-006(projection_recalculation_policy), QUA-007]
open_questions:
  - ルールデータの配布形式(CAL-006 open_question を継承。第一候補: TS 型付き宣言オブジェクト)
  - ルールセット版の永続化先(イベントストア設計 = ARC-005 の適用判断後に確定)
blockers:
  - 乗率・減算・負担金等のルール表現は該当 evidence 発行まで定義不可(CAL-005 §3)
```

## 1. 目的と結論

算定ルールを「コード」ではなく「バージョン管理されたデータ」として扱うための構造方針を定める。

**結論: ルールセットは告示版単位で不変(immutable)なデータであり、リリース後の書き換えを禁止する。改定・訂正は常に新しい版として追加する。**

## 2. 版の3層構造

| 層 | 単位 | 例 | 選択規則 |
|---|---|---|---|
| ルール(rule) | 公式資料の1規定 = 1ルール(CAL-006 §1) | `EVD-CAL-0001:chozai-kihon-1` | effective_from / effective_to による当時有効版選択 |
| ルールセット(ruleset) | 告示版・施行日単位の集合 | `calculationRulesV20260601`(令和8年告示第69号、2026-06-01 施行) | `calculationRuleVersion` として算定入力に明示指定(CAL-005 §4) |
| 算定結果 | 1回の算定実行 | calculation_trace に使用ルールセット版を記録(CAL-008) | 再算定時も当時版を再現可能であること |

## 3. 不変条件

1. **リリース済みルールセットの silent 変更禁止**。点数・条件・上限の訂正が必要になった場合も、既存版を書き換えず新版を発行し、旧版は effective_to(または supersededBy)で閉じる。訂正理由と evidence_id を新版に記録する。
2. **evidence_id のないルールはデータとして存在できない**(CAL-006 §1。trace 層の実行時強制に接続)。
3. **effective_to なしでの複数版共存は禁止**(CAL-006 §3.1 の停止条件を本書でもルールデータ構造の停止条件として継承)。
4. **canonical ruleset は golden test の対象**(CAL-011)。版の追加・変更は golden test の追加を伴う。
5. 版選択は処方日・調剤日・請求月に基づく決定的な規則で行い、暗黙の現在時刻を使わない(CAL-010)。

## 4. canonical ruleset の位置づけ

- `calculationRulesV20260601`(WP-2101b、5ルール・golden 合計166点)は**最初の canonical ruleset** であり、本書の「告示版単位の不変データ」の第1実例である。166点は版依存の実例値であり、版差分が生じた場合(P-08 等の再検証結果を含む)は CAL-011 の手順で golden とともに更新される。
- canonical ruleset はエンジン実装(packages/calculation)と同一パッケージに同居してよいが、**エンジン(評価器)とルールデータの境界を保つ**(CAL-006 §4 の宣言化移行パスに従い、将来はデータとして分離可能な形を維持する)。
- ルールセットの外部配布(多店舗・マルチテナント配信)は要件が確定するまで設計しない(投機的実装の禁止)。必要になった時点で本書と CAL-006 を改版する。

## 5. 停止条件(fail-closed)

- リリース済み版の内容変更を含む差分 → SSOT_UPDATE_REQUIRED(新版発行手続きへ差し戻し)
- evidence_id なしのルールデータ追加 → 定義不可(実行時強制)
- 第2版導入時に effective_to ガード未実装 → BLOCKED(CAL-006 §3.1)
- 版指定なしの算定実行 → 入力検証(CAL-005 段1)で拒否

## 変更履歴

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(golden 合計166点が版依存の実例値であることを注記)。
- 0.1.0 (2026-07-09): 初版起草(WP-0044)。
