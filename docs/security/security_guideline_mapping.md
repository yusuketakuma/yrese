# security_guideline_mapping — 医療情報システム安全管理ガイドライン対応表

```yaml
ssot_id: SEC-001
title: 医療情報システムの安全管理に関するガイドライン(第7.0版)対応マッピング
domain: security
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs:
  - 構築プロンプト v0.2.0 §34
  - docs/regulatory/evidence_verification_log.md(REG-007: 第7.0版〈令和8年6月〉実在確認)
depends_on:
  - docs/regulatory/source_registry.md
impacts:
  - docs/security/edge_node_security_design.md
  - docs/security/audit_log_design.md
open_questions:
  - 第7.0版本文の全文精読が未了(evidence_id 未発行)。管理策カテゴリの正確な章立て・要求水準は精読後に本表を改版する
  - 薬局(医療機関等側)としての遵守事項と、システム提供事業者側の分担線引き(SEC-002 と往復確認)
blockers:
  - BLOCKED_SECURITY_REVIEW(本表 APPROVED まで認証・監査・バックアップ等の本実装は開始しない)
change_log:
  - 0.1.1 (2026-07-09): WP-4048 実装状態 drift 整備。脆弱性・パッチ管理行の secret scan / dependency scan / SBOM CI 実装状態を WP-4009/a90df35・WP-4012/b0ecf84+702c2f5 に同期(第7.0版精読待ち・管理策判断は不変更)。
```

## 前提

- 対象ガイドライン: **医療情報システムの安全管理に関するガイドライン 第7.0版(令和8年6月)**。REG-007 で実在を一次確認済み。ただし**本文の全文精読は未了**であり、本表の「GL要求(想定)」列は第6.0版までの公知の構成と v0.2.0 の要求キーワードに基づく骨格である。精読後(WP-0015 後続)に各行を確定し evidence_id を付す。
- 本表は「経営管理編/企画管理編/システム運用編」の区分が第7.0版でも維持されているかを含めて【要精読】。

## 管理策マッピング(骨格)

| # | 管理策カテゴリ | GL要求(想定・【要精読】) | 本システムの設計対応 | 運用対応 | 実装状態 |
|---|---|---|---|---|---|
| 1 | アクセス制御 | 利用者識別・最小権限・職種別権限 | RBAC + PermissionScope(`@yrese/shared-kernel` permissions、deny-by-default)。UIとAPI両方で制御(v0.2.0 §7) | 権限台帳・棚卸し手順(Phase 1) | 骨格実装中(WP-2002 tenant-context / requirePermission) |
| 2 | 認証 | 二要素認証の明確化(第7.0版で強化と情報あり【要精読】) | 本番認証(OIDC/mTLS/HPKI 連携)は auth 設計SSOT承認まで BLOCKED_SECURITY_REVIEW。開発スタブは本番起動拒否 | MFA 運用手順(Phase 1) | BLOCKED(設計待ち) |
| 3 | 監査ログ(証跡) | 操作記録・真正性・保存 | audit_log_design(SEC-007)。tamper-evident、PHI classification 分離 | ログレビュー手順・保存期間管理【要確認】 | 設計中 |
| 4 | バックアップ | 定期取得・復元試験 | AWS Backup + Edge ローカルバックアップ(暗号化)。PITR | リストア訓練(§36 backup restore test) | 未実装(Phase 2) |
| 5 | BCP / 非常時対応 | サイバー攻撃を想定したBCP・非常時運用 | LOCAL_ONLY / RECOVERY_SYNC 設計(ARC-001/002)が業務継続の中核 | BCP確認表対応・訓練(§9 LOCAL_ONLY訓練) | モードガード実装済み(shared-kernel)、同期未実装 |
| 6 | 委託・外部保存 | 外部保存通知・委託先管理・責任分界 | Cloud Core(AWS東京)外部保存。データ処理契約・再委託管理(§9.8) | 契約・委託先監査(人間対応) | 未着手(契約論点) |
| 7 | ネットワークセキュリティ | 回線・暗号化・接続先制限 | TLS/mTLS、VPC、private connectivity、公的網は公式接続方式のみ(T3) | 接続構成の文書化 | 未実装 |
| 8 | 端末・媒体管理 | 端末管理・持ち出し制御 | Edge Node セキュリティ設計(SEC-005: ディスク暗号化・USB制御) | 端末台帳・紛失時手順 | 設計中 |
| 9 | 脆弱性・パッチ管理 | 既知脆弱性への対応 | dependency scan / secret scan(haiku4.5 常時検査)、SBOM | 定期スキャン運用 | CI一部稼働中: `check:secrets`(WP-4009/a90df35)、`check:deps` + `check:sbom`(WP-4012/b0ecf84+702c2f5)。追加SAST/DAST・定期スキャン運用は未着手 |
| 10 | 医療機関等との責任分界 | 提供事業者ガイドラインとの整合 | SEC-002(provider mapping)で分担を定義 | 契約書ひな形(人間対応) | 設計中 |

## 精読後に確定すべき事項(【要精読】リスト)

1. 第7.0版の章立て・管理策番号(本表の行を GL 管理策番号へ紐付けて evidence_id を発行)
2. 二要素認証の適用範囲・経過措置
3. 保守委託機関編(REG-007 調査メモで新設と示唆)の要求事項 — リモートサポート監査(§9.2)への影響
4. 外部保存・クラウド利用の届出/通知要件の現行運用
5. ランサムウェア対策・オフラインバックアップの具体要求
