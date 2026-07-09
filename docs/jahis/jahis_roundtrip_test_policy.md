# jahis_roundtrip_test_policy — JAHIS round-trip テストポリシー

```yaml
ssot_id: JHS-008
title: JAHIS round-trip テストポリシー
domain: jahis
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: [構築プロンプト v0.2.0 §0.0.4.10, REG-007, ADP-001, MST-002, CLM-002]
```


## 目的

出力系 JAHIS Adapter(お薬手帳出力・薬歴連携出力等)が、内部モデル→JAHIS形式→内部モデル の往復で情報を失わない・改変しないことを機械的に保証する。

## 等価の定義

- **意味的等価**: 医療上・請求上の意味が変わらないこと。以下は等価違反とする:
  - 医薬品・用法・数量・日数・患者識別子のいずれかの欠落・改変
  - コードの別コードへの置換(同義でも CodeMappingRegistry の根拠なしは違反)
  - 文字化け・変換不能文字の無言置換(JHS-006)
- 許容差: 仕様上意味を持たない空白・パディング・項目順(仕様がレコード順を規定する場合は順序も等価条件に含める)

## 規律

- 取込専用 Adapter(2Dシンボル読取)は逆方向生成を実装しないため round-trip 対象外 — 代わりに「同一入力の再取込冪等性」テストを課す
- round-trip fixture は合成データのみ、仕様版ごとに管理
- 失敗時は Adapter 実装ではなく**まず仕様解釈を疑い** SSOT_UPDATE_REQUIRED として fable5 へ返す(勝手にテスト緩和しない)
