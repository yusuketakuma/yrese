# version_watchlist — 仕様版監視台帳

```yaml
ssot_id: REG-002
title: 仕様版監視台帳(version watchlist)
domain: regulatory
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.1.7 §4, §10, docs/regulatory/source_registry.md
open_questions:
  - 監視の自動化手段(公式サイトの更新検知)と担当の確定
  - ONSアクセス確保前は 10.5/10.6 系の監視が実施不能
blockers: []
```

## 運用ルール

- 監視対象ごとに「現在採用版(evidence_id)」「監視方法」「頻度」「変更検知時のアクション」を管理する。
- 版変更を検知したら: (1) source_registry へ新版を FETCHED で登録 → (2) fable5 が影響範囲を判定 → (3) 該当SSOTの更新(SSOT_UPDATE_REQUIRED) → (4) 適用日・経過措置を分離記録 → (5) 回帰テスト計画。
- 適用日ベース管理: 処方日・調剤日・請求月に対応する「当時有効版」を選択できるよう、新旧版を併存保持する(v0.1.7 §3)。

## 監視対象

| # | 対象 | 現在採用版 | 現況調査メモ(未検証) | 監視方法 | 頻度 | 影響先SSOT |
|---|---|---|---|---|---|---|
| 1 | 調剤報酬(点数表・留意事項・疑義解釈) | 未採用【要確認】 | 令和8年度改定(2026年4月適用想定)後の疑義解釈が随時追加される時期 | 厚労省サイト・事務連絡 | 週次(請求月前は随時) | calculation_rules, claim系 |
| 2 | 調剤用記録条件仕様 | 未採用【要確認】 | 【要確認】 | 支払基金サイト | 月次 | electronic_receipt_design |
| 3 | レセプト電算マスターコード | 未採用【要確認】 | 【要確認】 | 診療報酬情報提供サービス | 月次+改定期随時 | master系 |
| 4 | 医薬品・薬価マスター | 未採用【要確認】 | 薬価改定・新収載で随時更新 | 同上 | 月2回目安 | master_update_pipeline |
| 5 | オンライン資格確認 外部IF仕様 | 未採用【要確認】 | ONS未アクセス | ONS | 月次 | online_qualification_boundary |
| 6 | 電子処方箋 技術解説書・記録条件仕様 | 未採用【要確認】 | v0.1.7指定「令和8年7月 2.04版以降」の一次確認未了 | ONS | 月次 | electronic_prescription_boundary |
| 7 | PMH(利用規約・制度関連マスタ・対象自治体) | 未採用【要確認】 | 対象自治体は拡大中とされる【要確認】 | デジタル庁PMHサイト | 月次 | pmh_boundary |
| 8 | JAHIS 2次元シンボル記録条件規約 | 未採用【要確認】 | Ver.1.10(2024-09)公開確認。Ver.1.11は言及のみ | JAHISサイト | 四半期 | prescription 2D symbol 設計 |
| 9 | JAHIS 薬歴連携仕様 / お薬手帳フォーマット | 未採用【要確認】 | 【要確認】 | JAHISサイト | 四半期 | jahis_boundary |
| 10 | NSIPS | 許諾未取得 | — | 日本薬剤師会 | 許諾取得後に設定 | nsips_adapter_policy |
| 11 | 安全管理GL(+Q&A)・事業者向けGL | 未採用【要確認】 | 第6.0版(2023-05)+Q&A(令和7年5月)を確認。第7.0版は未確認 | 厚労省・総務省経産省 | 四半期 | security系SSOT |
| 12 | 個人情報保護法・医療介護ガイダンス | 未採用【要確認】 | 【要確認】 | 個情委・厚労省 | 四半期 | privacy_impact_assessment |
| 13 | オンライン請求(接続方式・証明書・ASP) | 未採用【要確認】 | 【要確認】 | 支払基金・ONS | 月次 | online_claim_boundary |
| 14 | AWSサービス仕様(Blue/Green・Aurora等) | 参照時記録 | — | AWS What's New | 参照時 | aws_architecture |

## 変更検知時の停止条件

- 採用版と現行版の乖離が算定・請求・外部IFに影響すると判定された場合、該当領域の新規実装は SSOT 更新完了まで停止(SSOT_UPDATE_REQUIRED)。
- 適用日をまたぐ請求月処理では、新旧版の適用切替を calculation_coverage_matrix / master_versioning_policy に従って明示する。
