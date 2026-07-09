# non_mvp_scope — MVP対象外範囲

```yaml
ssot_id: PRD-002
title: MVP対象外範囲
domain: product
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs: 構築プロンプト v0.1.7 §2, §18, §29 / docs/plan/phase0_plan.md §2.2
depends_on:
  - docs/product/mvp_scope.md
impacts:
  - docs/calculation/calculation_coverage_matrix.md
  - docs/claim/claim_scope_matrix.md
open_questions:
  - 電子処方箋フル実装の投入時期(義務化動向・市場要件 — 人間レビュー)
  - 地方単独公費のMVPカバーリスト(対象自治体の限定)
blockers: []
```

## 原則

- 対象外は「実装しない」だけでなく、**対象外を含む処方を検知して請求データ生成前に停止する**ことまでがMVPの責務(v0.1.7 §18)。
- 検知時のステータスは `BLOCKED_UNSUPPORTED_CLAIM` / `MANUAL_REVIEW_REQUIRED` / `FUTURE_SCOPE_NOT_CLAIMABLE`(@yrese/shared-kernel 実装済み)。

## MVP対象外(将来対応)

| # | 項目 | 対象外の理由 | 検知・停止方法 | 再開条件 |
|---|---|---|---|---|
| N1 | 電子処方箋フル実装(取得・調剤結果送信・HPKI署名) | ONS仕様・接続試験環境・HPKI体制の確認が先(境界設計のみMVP) | 電子処方箋受付を機能フラグで無効化。境界APIは PENDING_EXTERNAL_SYNC のみ返す | 技術解説書2.04版以降+記録条件仕様の確認、接続試験合格 |
| N2 | PMHフル実装 | 制度関連マスタ・利用規約・対象自治体の確認が先(状態管理のみMVP) | PMH確認は常に PENDING_PMH_REVERIFY / MANUAL_REVIEW_REQUIRED | PMH利用規約・事前検証の完了 |
| N3 | オンライン請求の直接送信自動化 | 公式接続方式・電子証明書・運用規約が未確認 | 送信機能自体を実装しない(公式手順への受け渡しまで) | BLOCKED_REGULATORY_REVIEW 解消+接続試験 |
| N4 | 在宅関連の複雑算定・介護保険請求 | 算定・請求体系が別系統で検証負荷が大きい | 在宅系の処方・算定入力を BLOCKED_UNSUPPORTED_CLAIM | coverage matrix への追加とgolden test整備 |
| N5 | 麻薬帳簿・向精神薬の帳簿管理機能 | 法令要件(記載・保存)の確認が先。※麻薬処方の受付・算定可否は coverage matrix で別途判定 | 帳簿機能なし。麻薬含有処方は MANUAL_REVIEW_REQUIRED | 法令確認+薬剤師レビュー |
| N6 | 自家製剤・計量混合の複雑ケース | 算定解釈の幅が大きく人間確認が前提 | 該当加算入力時 MANUAL_REVIEW_REQUIRED | coverage matrix 拡充 |
| N7 | 分割調剤・リフィルの全パターン | パターン網羅の検証が先(基本パターンのMVP可否は coverage matrix で判定) | 未対応パターン検知で BLOCKED_UNSUPPORTED_CLAIM | golden test 整備 |
| N8 | NSIPS Adapter | 利用許諾未取得(BLOCKED_NSIPS_LICENSE) | 実装しない。仕様の複製・模倣も禁止 | 正規許諾取得(人間判断) |
| N9 | POS・在庫・分包機との双方向連携フル実装 | Integration API v0(薬歴向け最小)を先行 | 該当エンドポイント未提供 | API v1 設計 |
| N10 | 多店舗本部機能・経営分析 | 請求基幹の安全性確立が先 | 機能なし | MVP安定稼働後 |
| N11 | 電子版お薬手帳連携 | JAHIS Ver.2.6以降の確認とAPI設計が先 | 機能なし | 仕様確認後 |
| N12 | 地方単独公費の全国網羅 | 制度差分が大きい。MVPは限定リスト(未確定【要確認】) | 未対応公費コード検知で BLOCKED_UNSUPPORTED_CLAIM | 対象制度リストの人間承認 |
| N13 | 労災・自賠責等の保険外請求系 | 別請求体系 | BLOCKED_UNSUPPORTED_CLAIM | 将来判断 |
| N14 | 治験・院内製剤等の特殊調剤 | MVP外 | MANUAL_REVIEW_REQUIRED | 将来判断 |

## 禁止事項

- 対象外領域を「ついで実装」してはならない(新WPとして fable5 に提案する)。
- 対象外の検知を緩めて請求を通してはならない(請求事故直結)。
- N8(NSIPS)は許諾なしにコード・ドキュメントいずれにも仕様内容を書き写してはならない。
