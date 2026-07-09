# edge_node_security_design — Pharmacy Edge Node セキュリティ設計

```yaml
ssot_id: SEC-005
title: Pharmacy Edge Node セキュリティ設計
domain: security
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
source_refs:
  - 構築プロンプト v0.1.7 §35(全項目)、§31
depends_on:
  - docs/architecture/recovery_sync_design.md(ARC-002)
  - docs/security/threat_model.md(SEC-003)
impacts:
  - docs/architecture/offline_mode_matrix.md
open_questions:
  - Edge Node のハードウェア/OS 標準(TPM 利用可否・ディスク暗号化方式)は導入形態確定後
  - オフライン認証 TTL の具体値(候補: 業務時間内(≦12h)を上限に人間レビューで確定)
  - break-glass アカウントの発動条件・事後レビュー体制(薬局管理者との分担)
blockers:
  - BLOCKED_SECURITY_REVIEW(本書 APPROVED まで Edge 実装 WP を発行しない)
```

## 設計要求(v0.1.7 §35 対応表)

| # | 要求(§35) | 設計 | 検証方法 |
|---|---|---|---|
| 1 | ローカルDB暗号化 | PostgreSQL local + 保存時暗号化(方式【要確認】: TDE相当 or ファイルシステム層) | restore テストで暗号化状態確認 |
| 2 | ディスク暗号化 | OS 標準フルディスク暗号化を導入要件化(device_compatibility_matrix に記載) | セットアップチェックリスト |
| 3 | ローカル秘密鍵管理 | TPM / OS キーチェーン優先【要確認】。鍵はファイル平文配置禁止 | セットアップ検査 + 自己診断 |
| 4 | 端末証明書 | デバイス登録時に発行、Cloud 側で失効管理 | 失効後接続拒否テスト |
| 5 | mTLS | T1 同期・T2 Integration API とも必須 | contract test |
| 6 | オフライン認証 | ローカル資格情報キャッシュ + **TTL**(値は open_questions)。TTL 超過で LOCAL_ONLY でも要再認証 | TTL 境界テスト |
| 7 | オフライン認証 TTL | 同上。TTL 内の失効未反映リスクを residual risk として明示 | — |
| 8 | 退職者・権限剥奪時 | 失効リストを同期のたび Edge へ配布。オフライン中の失効未達は **復旧後再検証(RECOVERY_SYNC R1)で操作を洗い出し監査** | 失効→オフライン操作→復旧のシナリオテスト |
| 9 | break-glass account | 封筒管理相当の緊急アカウント。使用は全操作監査 + 事後人間レビュー必須 + 自動アラート | 発動訓練 |
| 10 | 操作ログ | 全業務操作をローカル監査ログへ(SEC-007 形式)。オフライン中も欠落させない(§9.3) | 監査証跡テスト |
| 11 | 改ざん検知ログ | ローカル監査ログにハッシュチェーン(tamper-evident)。同期時に Cloud 側で連続性検証 | tamper test(§36) |
| 12 | ローカルバックアップ | 暗号化バックアップを薬局内媒体へ。復旧手順は runbook | restore 訓練 |
| 13 | バックアップ暗号化 | 同上(平文バックアップ禁止) | 検査スクリプト |
| 14 | USB 持ち出し制御 | OS ポリシーで制御(可否は薬局判断だが既定は制限)+ 持ち出し操作の監査 | endpoint_management_policy(WP-0010) |
| 15 | 管理者操作監査 | 管理者・サポートの操作は一般操作より詳細に記録(§9.2) | 監査ログレビュー |
| 16 | 端末紛失・盗難時対応 | リモート失効(証明書・トークン)+ 暗号化により実データ保護 + 届出手順 | 紛失対応訓練 |
| 17 | リストア訓練 | 定期(頻度は運用SSOTで確定)訓練を必須化 | 訓練記録 |
| 18 | Edge 更新ロールバック | A/B update + 署名付きパッケージ + self-test 失敗で自動ロールバック(§31) | 更新失敗注入テスト |
| 19 | 代替機復旧 | バックアップ + Cloud 再同期による代替機構築手順。復旧後は RECOVERY_SYNC 必須 | 代替機構築訓練 |

## オフライン認証と退職者リスク(重点)

v0.1.7 §35 の明示要求: 「クラウド側で失効済みのユーザーが一時的に利用できるリスクを明示し、TTL・復旧後再検証・監査で制御する」

1. **リスクの明示**: オフライン中は失効情報が届かないため、失効済みアカウントが最長 TTL まで操作可能。これは設計上の残余リスクであり、ゼロにはできない。
2. **制御の三層**:
   - TTL: オフライン認証キャッシュは TTL 超過で無効(値は人間レビューで確定)
   - 復旧後再検証: RECOVERY_SYNC の R1 段で「オフライン期間中の全操作 × 当時の有効権限」を突合し、失効後操作があれば MANUAL_REVIEW_REQUIRED として隔離
   - 監査: オフライン操作は actor_id + device_id + ローカル時刻 + logical clock で記録、改ざん検知対象
3. **薬局側運用**: 退職時の即時報告義務を契約・運用手順に明記(SEC-002 分担表)。

## Edge 自己診断(§8.2 / §31)

起動時・定期に: ディスク暗号化有効 / 証明書有効期限 / DB 整合性 / 監査ログチェーン連続性 / バージョン整合(Cloud 要求版との差)/ バックアップ鮮度 を検査し、不合格項目は同期状態画面と Cloud ダッシュボードへ表示。重大不合格(暗号化無効・ログチェーン断絶)は業務開始をブロックし、サポートへエスカレーション。
