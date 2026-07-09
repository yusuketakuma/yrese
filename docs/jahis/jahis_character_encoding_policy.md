# jahis_character_encoding_policy — JAHIS文字コードポリシー

```yaml
ssot_id: JHS-006
title: JAHIS文字コードポリシー
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


## 原則

- 内部表現は UTF-8(TypeScript string)。**Shift-JIS 等の外部符号は Official Adapter 境界内でのみ扱い、内部へ持ち込まない**。
- 参考実測(CLM-002): レセプト記録仕様は JIS X 0201-1976 8単位符号 + JIS X 0208-1983 附属書1 シフト符号化表現(シフトJIS)、区切りコンマ(2C)・レコード区切り CR LF(0D 0A)・EOF(1A)。JAHIS 各仕様の文字符号規定は**本文入手後に仕様ごとに確定**する(推測禁止)。

## 必須規律

- 変換不能文字(UTF-8→Shift-JIS 外字等)は**無言の置換をしない**: 取込側は保持+警告、出力側はエラー(請求・交付文書に「?」等が混入する事故を防ぐ)
- 機種依存文字・外字の扱いは仕様ごとに evidence 付きで定義
- 半角カナ(JIS X 0201 片仮名)の許容範囲は仕様規定に従う
- BOM 禁止/許容、改行コード、EOF の扱いを Adapter ごとに宣言しテストで固定
- エンコーディング検証は invalid file test(JHS-005)の必須項目

## 実装配置

- 変換ユーティリティは Adapter パッケージ内(汎用 shared へ置かない — MOD-002 の「Adapter固有処理を汎用sharedへ混ぜない」原則)
