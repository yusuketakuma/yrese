# recovery_sync_design — RECOVERY_SYNC 設計

```yaml
ssot_id: ARC-002
title: RECOVERY_SYNC(復旧後再検証・同期)設計
domain: architecture
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
  - 構築プロンプト v0.2.0 §16, §32
  - docs/architecture/offline_mode_matrix.md
depends_on:
  - docs/adapters/external_system_boundary.md
impacts:
  - packages/events(実装済み EventEnvelope を使用)
  - apps/api(同期エンジン — 未実装)
open_questions:
  - 競合解決の人間承認 UI の詳細導線(UI/UX SSOT 側)
  - clock drift 許容閾値の具体値(性能・運用データ取得後に確定)
  - 資格再確認・電子処方箋再取得の API 仕様(外部IF確認後)
blockers:
  - 同期エンジン実装は Edge Node アーキテクチャ確定(Phase 1)まで WP 発行しない
```

## 1. 原則

- 復旧後同期は「自動でデータを直す」工程ではなく「**再検証し、人間が承認すべき差分を人間に出す**」工程である。
- 不一致は自動補正せず `CONFLICT_REQUIRES_HUMAN_REVIEW`(@yrese/shared-kernel 実装済み)とする(v0.2.0 §16)。
- RECOVERY_SYNC 完了(未解決タスク 0 + 承認完了)まで、請求前点検・月次締め・レセプト確定は解禁しない(offline_mode_matrix #18-21)。

## 2. 工程分解(v0.2.0 §16 の必須項目を工程化)

### Stage R1: 前提検証

| 工程 | 内容 | 失敗時 |
|---|---|---|
| R1-1 ローカルイベント順序検証 | EventEnvelope の sequenceNumber(aggregate 単位の単調性)・logicalClock を検証 | 欠番・逆転は対象 aggregate を隔離し MANUAL_REVIEW_REQUIRED |
| R1-2 clock drift 検出 | wallClock と Cloud 基準時刻の乖離を測定(閾値【要確認】) | 閾値超過はイベントに drift フラグ、時刻依存判断を人間レビューへ |
| R1-3 監査ログ完全性検証 | ローカル監査ログの改ざん検知(ハッシュ連鎖)・欠落検査 | 欠落・改ざん疑いは BLOCKED_SECURITY_REVIEW + incident 起票 |
| R1-4 Edge/Cloud バージョン整合 | スキーマ版・マスター版・アプリ版の不整合検出 | 不整合は同期開始前に更新または隔離 |

### Stage R2: 同期実行

| 工程 | 内容 | 失敗時 |
|---|---|---|
| R2-1 同期キュー再送 | Outbox の pending/failed を再送(retryCount 管理) | 上限超過は dead_letter + deadLetterReason 必須 |
| R2-2 冪等性チェック | idempotencyKey で二重適用防止 | 重複検出は適用スキップ+ログ |
| R2-3 重複排除 | 同一業務イベントの重複(二重受付等)検出 | 重複候補は自動削除せず人間確認リストへ |

### Stage R3: 競合検出(自動解決禁止)

対象: 患者 / 処方 / 調剤 / 請求 / 帳票データ。
Cloud 確定データとローカル変更が衝突した場合、両版のスナップショット・変更者・時刻・根拠を並記した競合レコードを生成し `CONFLICT_REQUIRES_HUMAN_REVIEW` を付与する。
承認権限: 業務データ=薬剤師または管理者、請求データ=請求実務者権限(claim:finalize)。承認は監査ログに記録する。

### Stage R4: 外部再検証

| 工程 | 内容 | 未完了時のステータス |
|---|---|---|
| R4-1 資格再確認 | LOCAL_ONLY 中の受付患者を一括再確認(外部IF確認後に実装) | PENDING_REVERIFY 維持 |
| R4-2 PMH 再確認 | 助成対象患者の再確認 | PENDING_PMH_REVERIFY 維持 |
| R4-3 電子処方箋再取得・再照合 | 引換番号による正式データ照合、差異検出 | PENDING_EXTERNAL_SYNC 維持 |
| R4-4 調剤結果送信 | 未送信キューの送信 | PENDING_EXTERNAL_SYNC 維持 |

### Stage R5: 再計算・差分検証

| 工程 | 内容 |
|---|---|
| R5-1 算定再計算 | 仮算定(PROVISIONAL_CALCULATION)を確定マスター版・確定資格情報で再計算(純粋関数のため同一入力同一出力) |
| R5-2 差額検出 | 仮算定と確定算定の差額一覧を生成(患者負担差額は返金・追徴導線へ) |
| R5-3 請求前再点検 | isClaimable が true になったデータのみ請求前点検対象へ |

### Stage R6: 承認・証跡

| 工程 | 内容 |
|---|---|
| R6-1 人間承認 | 薬剤師または請求実務者が競合解決・差額・再検証結果を承認 |
| R6-2 同期結果レポート | 処理件数・未同期・失敗・要確認の一覧を生成(未解決タスクが一目で分かる — v0.2.0 §8.4) |
| R6-3 Cloud 確定反映 | 承認済みデータのみ Cloud Core の確定データへ反映 |
| R6-4 整合性証跡保存 | ローカル/クラウド双方に検証結果・承認者・時刻をハッシュ付き保存 |

## 3. モード遷移

```text
LOCAL_ONLY/CLOUD_DEGRADED → (接続回復検知) → RECOVERY_SYNC
RECOVERY_SYNC → (R1-R6 完了 + 未解決タスク0) → NORMAL
RECOVERY_SYNC → (外部の一部のみ復旧) → EXTERNAL_DEGRADED(残タスク持ち越し)
RECOVERY_SYNC 中の新規受付: 許可(ただし LOCAL_ONLY 相当の PENDING 付与判断は接続状態に従う)
```

## 4. テスト要件(test_strategy へ反映)

- 順序逆転・欠番・重複・部分同期・二重送信の再現テスト
- 競合自動解決が「存在しない」ことのテスト(競合時に必ず人間レビューステータスになる)
- 差額検出の golden test(算定エンジン実装後)
- RECOVERY_SYNC 未完了時に月次締めが拒否されることのテスト(allowsClaimFinalization + 未解決タスクガード)
