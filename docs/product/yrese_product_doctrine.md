# yrese_product_doctrine — yrese 製品ドクトリン

```yaml
ssot_id: PRD-008
title: yrese 製品ドクトリン(意思決定原則の製品レベル確定)
domain: product
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: [構築プロンプト v0.2.0 §1〜§5, PRD-006, PRD-007]
impacts: [全SSOT, 全Work Package, Plans.md 優先順位]
```

本書は PRD-006(対抗コンセプト4本柱)を上位方針とし、日々の設計・実装・レビューの
意思決定で適用する製品ドクトリンを確定する。柱の解釈に迷ったら本書に従い、
本書で解決しない場合は SSOT_UPDATE_REQUIRED として fable5 へ返す。

## ワンライナー(v0.2.0 §2)

> NSIPSを境界に追放し、イベントログを心臓に据え、品質を公開数字で証明し、APIで生態系を作る、止まらないレセコン。

## ドクトリン(優先順)

### D1 — 法令・医療安全・請求正確性が常に最上位

「開かれている」「止まらない」「速い」は、正確で安全であることの上にのみ成立する。
v0.2.0 §28 の停止条件はどのドクトリンよりも優先し、バージョン間で緩和しない(累積有効)。

### D2 — fail-closed: 根拠がなければ動かず止まる

- 未知のステータス・空のルールセット・未確認の外部結果は「通す」のではなく BLOCKED / PENDING にする。
- isClaimable は allow-list、監査イベントは台帳外種別を実行時拒否、PHI 未暗号化イベントは生成不可 — 実装済みの実行時強制を後退させる変更は禁止。
- 「根拠不足で止まるコード」が正であり、止まった箇所は SSOT/evidence の不備として上流で直す。

### D3 — SSOT 駆動: 仕様が先、実装が後

- APPROVED でない SSOT に基づく実装をしない。仕様不備はコードで吸収せず SSOT_UPDATE_REQUIRED として返す。
- 算定・請求・帳票ロジックは evidence_id(docs/calculation/evidence_register.md)の裏付けが必須。点数値・法令要件を推測実装しない。
- SSOT 間の矛盾を発見したら実装を止め、索引(docs/ssot_index.md)の owner に裁定を求める。

### D4 — 公開品質: 品質は主張ではなく検証可能な事実

- 主要データモデル・conformance test 結果・SLO 実績・返戻率 KPI(匿名化・同意前提)を公開する方針を既定とする。
- 公開をためらう品質実績が出た場合、隠すのではなく改善 WP を起こす。粉飾・成功偽装・失敗隠蔽は D1 違反として扱う。
- 公開 KPI に PHI・薬局秘密情報・契約上非公開情報を含めない(v0.2.0 §28)。

### D5 — 境界の規律: 外部規格はアダプタに閉じ込める

- NSIPS は許諾取得時のみ Legacy Adapter(詳細: ARC-003 / ARC-004)。コアへの概念浸食は停止条件。
- JAHIS 等の公式規格は Official Adapter としてフル対応し、勝手に解釈・置換しない(PRD-007 の分離原則)。
- コアは FHIR/JP Core Ready な Canonical Model で設計するが、Official Adapter 仕様を FHIR で置き換えない。

### D6 — API-first dogfooding: yrese 自身が最初のパートナー

- yrese UI は公開 API を dogfooding する。専用裏口 API・直接 DB 参照連携・undocumented API は禁止。
- 最初の外部接続クライアントは PH-OS(参照連携)とし、パートナー個別の場当たり仕様を作らない。

### D7 — シンプル実装・二重実装禁止

- 要求を満たす最小の実装を選び、投機的抽象化・使われないオプション・「ついでの改善」を入れない(改善は新 WP)。
- 同じ概念・enum・validation・money/date 処理を複数箇所に実装しない(COMMON_MODULE_DUPLICATION_BLOCKED)。

## 適用

- WP の起案・レビュー・裁定では、本書 D1〜D7 との整合を確認事項に含める。
- ドクトリン間の衝突は番号の小さい方を優先する(D1 が常勝)。
- 4つの戦い(PRD-009)の戦術が本書と矛盾する場合、本書を優先し PRD-009 を改版する。

## 変更履歴

- 0.1.0 (2026-07-09): WP-0041 により起案(PROPOSED)。
