# receipt_numbering_policy — 領収証番号体系ポリシー

```yaml
ssot_id: RCP-002
title: 領収証番号体系ポリシー
domain: receipt
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: [構築プロンプト v0.1.8 §0.0.4.4, §0.0.4.5]
depends_on: [RCP-001, ARC-002(recovery_sync_design)]
impacts: [WP-2202, 共通モジュール(receipt numbering utilities — v0.1.8 §0.0.4.15)]
open_questions:
  - 番号の法定要件有無【要確認】(法令上の様式要求がなければ本設計は内部統制要件)
  - 年度切替の基準日(暦年 or 会計年度 or 4月)【要確認: 実務レビュー】
blockers: []
```

## 1. 番号体系(候補設計)

領収証番号は**テナント・薬局単位で一意**とし、以下の形式を第一候補とする。

```text
<pharmacy_code>-<年度4桁>-<連番8桁>          例: PH001-2026-00001234
LOCAL_ONLY時:
<pharmacy_code>-<年度4桁>-L<device_seq>-<ローカル連番6桁>   例: PH001-2026-L03-000042
```

原則:

- 番号は**採番後に再利用しない**(取消・差替でも欠番として保持し、欠番理由を監査証跡に残す)。
- 番号だけから患者を特定できる情報を含めない(PHI最小化)。
- 採番は会計台帳(append-only)の発行イベントと同一トランザクション境界で行い、二重採番・採番飛びを検知可能にする。

## 2. LOCAL_ONLY 時のローカル採番

- Cloud Core 不通時は **ローカル領収番号**(`L` プレフィックス+デバイス識別)で採番する。中央連番の先取り・推測採番は禁止(重複リスク)。
- ローカル採番の領収証は「ローカル採番」であることを文書面または管理画面で識別可能にする(未同期の誤認防止)。
- ReceiptDocument には `numbering_source: central | local`、`sync_status`、`revalidation_status` を保持する。

## 3. RECOVERY_SYNC 後の整合

- 復旧後、ローカル採番の領収証は中央台帳へ登録し、**ローカル番号は永続的に有効なまま**とする(発行済み文書の番号を後から書き換えない — 真正性)。
- 中央番号への「振替」は行わない。対応付け(local番号 ↔ 中央台帳ID)を台帳に記録する。
- 重複検出(同一 idempotency key / 同一入金への二重発行)は CONFLICT_REQUIRES_HUMAN_REVIEW とし、自動補正しない。

## 4. 共通モジュール

- 採番ユーティリティは共通モジュール(receipt numbering utilities)として実装し、frontend/backend での重複実装を禁止する(v0.1.8 §0.0.4.15、MOD-001 台帳へ追加)。

## 5. 変更履歴

- 0.1.0 (2026-07-09): 初版(WP-0034)。
