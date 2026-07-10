# offline_mode_matrix — モード別許可・禁止操作マトリクス

```yaml
ssot_id: ARC-001
title: モード別許可・禁止操作マトリクス
domain: architecture
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-11
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: null
effective_to: null
source_refs:
  - 構築プロンプト v0.2.0 §13, §14, §15
  - docs/plan/phase0_plan.md §9.3
depends_on:
  - docs/adapters/external_system_boundary.md
impacts:
  - apps/api(モードガード実装)
  - apps/web(モード別UI)
related_tests:
  - packages/shared-kernel/src/kernel.test.ts(モードガード関数の単体テスト — 実装済み)
related_work_packages: [WP-3010a, WP-3010b, WP-9002-W5B]
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5B metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions:
  - LOCAL_ONLY での操作範囲の最終確定は薬剤師実務レビュー・請求実務レビュー後(v0.2.0 §14)
  - 災害時モード(オン資公式の障害時運用)との整合は外部IF仕様確認後
blockers: []
```

## 1. モード定義(v0.2.0 §13)

| モード | Cloud Core | 外部公的システム | Edge Node | 概要 |
|---|---|---|---|---|
| NORMAL | ○ | ○ | ○ | 全機能 |
| EXTERNAL_DEGRADED | ○ | ×(一部または全部) | ○ | 外部公的システム障害 |
| CLOUD_DEGRADED | × | △(可否混在) | ○ | Cloud 停止。同期・横断管理・集中バックアップ保留 |
| LOCAL_ONLY | × | × | ○ | Edge 単独業務継続 |
| RECOVERY_SYNC | 復旧中 | 復旧中 | ○ | 再検証・同期・競合解決 |

実装済みガード(@yrese/shared-kernel、コミット 9ab039e):
`canConfirmExternal`(NORMAL/CLOUD_DEGRADED のみ true)/ `allowsFinalCalculation`(LOCAL_ONLY のみ false)/ `allowsClaimFinalization`(NORMAL のみ true)/ `isClaimable`(PENDING系・対象外・競合ステータスが1つでもあれば false)。
バックエンド実装時は必ずこれらの共通関数を使用し、ローカル再実装を禁止する(COMMON_MODULE_DUPLICATION_BLOCKED)。

## 2. 操作×モード マトリクス

記号: ○=許可 / △=条件付き許可(必須ステータス付与) / ×=禁止

| # | 操作 | NORMAL | EXTERNAL_DEGRADED | CLOUD_DEGRADED | LOCAL_ONLY | RECOVERY_SYNC |
|---|---|---|---|---|---|---|
| 1 | ローカル保存済み患者・保険情報の参照 | ○ | ○ | ○ | ○ | ○ |
| 2 | 最終資格確認スナップショットの参照 | ○ | ○(最終確認日時・確認方法・再確認要否を必ず表示) | ○(同左) | ○(同左) | ○ |
| 3 | 新規オンライン資格確認 | ○ | ×(PENDING_REVERIFY) | △(外部可なら○) | ×(成功扱い禁止) | △(再確認として実行) |
| 4 | 紙処方箋の仮受付 | ○ | ○ | ○ | ○(LOCAL_ONLY_UNVERIFIED) | 再検証対象 |
| 5 | JAHIS 2次元シンボル仮取込 | ○ | ○ | ○ | ○(仮取込のみ・原本照合必須) | 再検証対象 |
| 6 | 手入力補正 | ○ | ○ | ○ | ○ | ○(履歴保持) |
| 7 | 電子処方箋の処方情報取得 | ○(実装後) | ×(PENDING_EXTERNAL_SYNC) | △ | × | 再取得・再照合 |
| 8 | 電子処方箋の調剤結果送信 | ○(実装後) | ×(PENDING_EXTERNAL_SYNC) | △ | × | 再送 |
| 9 | 重複投薬等チェック完了扱い | ○(外部結果転記のみ) | × | △ | ×(完了扱い禁止) | 再実施 |
| 10 | PMH 医療費助成確認 | ○(実装後) | ×(PENDING_PMH_REVERIFY) | △ | × | 再確認 |
| 11 | 薬剤師確認(人間) | ○ | ○ | ○ | ○(必須 — 確認なしの確定禁止) | ○(復旧承認) |
| 12 | 疑義照会記録 | ○ | ○ | ○ | ○ | ○ |
| 13 | 算定(確定) | ○ | △(資格未確認分は仮) | ○(ローカルマスター版明示) | ×(仮算定のみ) | 再計算・差額検出 |
| 14 | 仮算定(PROVISIONAL_CALCULATION) | ○ | ○ | ○ | ○(必須付与) | ○ |
| 15 | 会計(一部負担金収受) | ○ | △(仮額表示明示) | ○ | △(仮額であることを患者に明示) | 差額精算導線 |
| 16 | 帳票出力(領収証・明細・薬袋等) | ○ | △(状態表示付き) | ○ | △(仮帳票の明示・PROVISIONAL) | ○(確定後再出力) |
| 17 | 調剤録・監査ログ記録 | ○ | ○ | ○ | ○(ローカル監査ログ必須) | ○(完全性検証) |
| 18 | 請求前点検 | ○ | ×(資格再確認まで不可) | × | × | 完了後に可 |
| 19 | 月次締め・請求データロック | ○ | × | × | × | 完了後に可 |
| 20 | レセプト確定・出力 | ○ | × | × | × | 完了後に可 |
| 21 | オンライン請求用端末への受け渡し | ○(公式手順) | × | × | × | 点検完了後に可 |
| 22 | マスター本番反映 | ○(24段パイプライン通過後) | ○(同左) | ×(PENDING_MASTER_VALIDATION で保留) | ×(旧版で継続) | 版整合確認後 |
| 23 | マスター版の明示表示 | ○ | ○ | ○(最終更新日時表示) | ○(最終同期・最終マスター更新日時表示) | ○ |
| 24 | 薬局内 Partner 連携(薬歴等) | ○ | ○ | ○ | ○(薬局内LANのみ) | ○ |
| 25 | Cloud 横断管理・集中バックアップ | ○ | ○ | 保留 | 保留 | 再開・整合確認 |
| 26 | ユーザー認証 | ○(オンライン) | ○ | △(オフライン認証 TTL 内) | △(オフライン認証 TTL 内・失効者リスク統制) | ○(権限再検証) |
| 27 | 権限変更・ユーザー管理 | ○ | ○ | × | × | ○(Cloud 復旧後) |
| 28 | 破壊的操作(取消・訂正・返金) | ○(二段階確認) | ○(同左) | △ | △(履歴+復旧後再検証) | ○(履歴必須) |

## 3. LOCAL_ONLY の必須ステータス付与(v0.2.0 §14)

LOCAL_ONLY での計算・帳票・受付には以下のいずれかを必ず付与する(@yrese/shared-kernel PROVISIONAL_STATUSES として実装済み):
PROVISIONAL_CALCULATION / PENDING_REVERIFY / PENDING_EXTERNAL_SYNC / PENDING_PMH_REVERIFY / LOCAL_ONLY_UNVERIFIED / MANUAL_REVIEW_REQUIRED

## 4. LOCAL_ONLY の絶対禁止事項(v0.2.0 §15 全項目)

1. 新規オンライン資格確認の成功扱い
2. 電子処方箋管理サービスからの新規処方情報取得扱い
3. 調剤結果送信の成功扱い
4. 重複投薬等チェックの完了扱い
5. 併用禁忌チェックの外部確認済み扱い
6. PMH 医療費助成確認の成功扱い
7. オンライン請求送信の実行済み扱い
8. 請求データの最終送信済み化
9. 古いマスターの最新版扱い
10. 外部同期失敗の握りつぶし
11. ローカルデータによる Cloud 確定データの無条件上書き
12. 薬剤師確認なしの処方・調剤・疑義照会結果の確定
13. オフライン処理のオンライン確認済み表示
14. 送信必要イベントの送信済み扱い
15. 請求不可データの請求可能扱い
16. 記録条件未検証データの本番請求データ扱い

## 5. UI 要件

- 全画面にシステムモードを常時表示(実装済み: SystemModeBadge — 色非依存・日本語ラベル)
- モード遷移時は「できること/できないこと/復旧後に必要なこと」を明示(v0.2.0 §8)
- PENDING_* を目立たない場所に隠すことを禁止(v0.2.0 §7)
