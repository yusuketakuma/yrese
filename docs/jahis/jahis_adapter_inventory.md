# jahis_adapter_inventory — JAHIS Adapter 台帳

```yaml
ssot_id: JHS-003
title: JAHIS Adapter 台帳
domain: jahis
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: [構築プロンプト v0.1.8 §0.0.4.10, REG-007, ADP-001, MST-002, CLM-002]
blockers:
  - 全 Adapter: 仕様本文の正規入手まで実装 BLOCKED(入手経路=JAHIS 会員/購入の要否【要確認: 人間手続き】)
```


## Adapter 必須要件(v0.1.8 §0.0.4.10 の16項)

全 JAHIS Adapter は以下を備える。

| # | 要件 | 実装上の対応 |
|---|---|---|
| 1 | 仕様版管理 | Adapter ごとに supportedVersions を宣言、版は evidence_id 付き |
| 2 | 旧版互換方針 | 読み取りは旧版許容範囲を明示、出力は原則最新版(例外は本台帳に記録) |
| 3 | CSV/XML/固定長/Shift-JIS等の公式仕様優先 | 独自JSON化しない(v0.1.7 §12 Official Adapter 原則) |
| 4 | 文字コード変換 | JHS-006 準拠(Shift-JIS ⇄ UTF-8 境界は Adapter 内に限定) |
| 5 | 改行コード方針 | 仕様指定(CR/LF等)を Adapter 内で厳密に扱い、内部表現へ持ち込まない |
| 6 | レコード順検証 | 仕様のレコード順をパース時に検証、違反は取込拒否 |
| 7 | 必須項目検証 | スキーマ検証で強制 |
| 8 | 条件付き必須項目検証 | 条件ロジックも仕様本文の evidence 付きで実装 |
| 9 | コード表検証 | MST-002 CodeMappingRegistry 経由(曖昧一致禁止) |
| 10 | サンプルデータ検証 | 仕様添付サンプルを golden file 化(合成データのみ) |
| 11 | round-trip test | JHS-008 準拠 |
| 12 | golden file test | JHS-005 準拠 |
| 13 | invalid file test | 破損・違反ファイルの安全な拒否を固定 |
| 14 | 仕様差分検知 | JHS-004 watchlist + 版差分レポート |
| 15 | Adapter ごとの責務境界 | ADP-001 と整合(取込は仮取込まで — 原本照合・薬剤師確認は上位業務фロー) |
| 16 | evidence_id | 全変換・検証ロジックに evidence 紐付け(trace 層強制) |

## Adapter 台帳

| Adapter | 対象仕様 | 仕様本文入手状態 | 実装状態 | 解除条件 |
|---|---|---|---|---|
| JAHIS-2D(Prescription2DSymbol) | 2次元シンボル規約 Ver.1.11 | **未入手**(id=1233。Ver.1.9 までは PDF 公開実績あり — 1.11 の公開/会員限定は【要確認】) | **BLOCKED** | 本文正規入手 → 精読ノート → evidence 発行 → opus4.8 レビュー → WP-2204 |
| JAHIS-YAKUREKI(薬歴連携) | 薬局レセコン電子薬歴連携仕様 Ver.1.1【版要確認】 | 未入手 | **BLOCKED** | 版確定 → 本文入手 → 同上 |
| JAHIS-OKUSURI(お薬手帳) | お薬手帳フォーマット Ver.2.6 | 未入手(Ver.2.5 PDF は公開確認済み — 2.6 の公開状態【要確認】) | **BLOCKED**(Phase 2 以降) | 同上 |

注意: 仕様本文の内容(レコード定義・項目)を入手前に推測記載・推測実装してはならない。
