# receipt_numbering_policy — 領収証番号体系ポリシー

```yaml
ssot_id: RCP-002
title: 領収証番号体系ポリシー
domain: receipt
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: opus4.8レビュー(APPROVE_WITH_CHANGES)全指摘反映後、fable5承認(人間の包括承認範囲内)
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
- **device_seq の一意性保証(opus4.8 指摘反映)**: `device_seq`(ローカル採番の端末識別)は、**端末登録時に Cloud Core から事前払い出しされる端末固有値**とする。オフラインでの動的取得・端末の自己申告による採番は禁止する(複数端末が同一 L 番号を生成するオフライン重複採番=真正性崩壊の防止)。未払い出し端末は LOCAL_ONLY 中の領収証発行不可(手書き代替手順は OPS-007 の代替手順に従う)。
- ローカル採番の領収証は「ローカル採番」であることを文書面または管理画面で識別可能にする(未同期の誤認防止)。
- ReceiptDocument には `numbering_source: central | local`、`sync_status`、`revalidation_status` を保持する。

## 3. RECOVERY_SYNC 後の整合

- 復旧後、ローカル採番の領収証は中央台帳へ登録し、**ローカル番号は永続的に有効なまま**とする(発行済み文書の番号を後から書き換えない — 真正性)。
- 中央番号への「振替」は行わない。対応付け(local番号 ↔ 中央台帳ID)を台帳に記録する。
- 重複検出(同一 idempotency key / 同一入金への二重発行)は CONFLICT_REQUIRES_HUMAN_REVIEW とし、自動補正しない。

## 4. 共通モジュール

- 採番ユーティリティは共通モジュール(receipt numbering utilities)として実装し、frontend/backend での重複実装を禁止する(v0.1.8 §0.0.4.15、MOD-001 台帳へ追加)。

## 5. 変更履歴

- 0.2.0 (2026-07-09): device_seq は端末登録時に中央から事前払い出し(オフライン動的取得・自己申告禁止)。APPROVED 化。
- 0.1.0 (2026-07-09): 初版(WP-0034)。
