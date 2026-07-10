# daily_cash_closing_policy — 日計・レジ締めポリシー

```yaml
ssot_id: ACC-007
title: 日計・レジ締めポリシー
domain: accounting
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-11
approved_at: 2026-07-09
approved_by: opus4.8レビュー(APPROVE_WITH_CHANGES)全指摘反映後、fable5承認(人間の包括承認範囲内)
effective_from: null
effective_to: null
source_refs: 構築プロンプト v0.2.0 §0.0.4.6
depends_on: [ACC-001, ACC-003, ACC-008]
impacts: [future Accounting daily-close and CashDrawerSession implementation, future LOCAL_ONLY / RECOVERY_SYNC daily-report projection]
related_work_packages: [WP-0033, WP-0037, WP-0038, WP-9002-W7B]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文 §5の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W7B metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions:
  - 仕訳データ出力形式・会計システム連携先(派生機能調査 WP-0037 後)
  - 本部集計の要件(多店舗は Phase 2 以降)
  - OTC・物販との同時会計境界(POS 境界 ACC-009 と併せて実務レビュー)
blockers: []
```

## 1. 日計(MVP対象)

日次で以下を集計・保存する(append-only、確定後の再集計は新版として記録):

- 支払方法別集計(ACC-008 の registry 単位)
- 患者負担金集計
- 未収発生集計 / 未収入金集計
- 返金集計
- 取消・調整集計
- 会計日報(出力・再出力履歴付き)

## 2. レジ締め(CashDrawerSession)

- レジ現金は CashDrawerSession(開設→取引→締め)で管理する。
- 締め時に理論残高と実残高を照合し、**現金過不足は隠さず記録**する(過不足の無断調整禁止)。
- 締め済みセッションへの追記は禁止。訂正は翌営業日の Adjustment として記録する。
- 締め操作は監査イベント必須(ACC-011)。

## 3. LOCAL_ONLY 時

- 日計・レジ締めはローカルで実行可能(現金業務の継続性)。ただし同期前である旨を日報に明示し、RECOVERY_SYNC 後に確定版を再出力する。

## 4. MVP境界

- 日計・レジ締め・現金過不足・支払方法別集計: **MVP対象**。
- 仕訳データ出力・本部集計・入金結果リアルタイム連携: 境界設計のみ(Phase 2 以降、WP-0037 の調査で確定)。

## 5. 変更履歴

- 0.2.0 (2026-07-09): opus4.8 レビュー通過(本書への個別指摘なし)に伴う承認化。APPROVED 化。
- 0.1.0 (2026-07-09): 初版。
