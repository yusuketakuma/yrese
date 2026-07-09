# claim_scope_matrix — 請求スコープマトリクス

```yaml
ssot_id: CLM-001
title: 請求スコープマトリクス(レセプト請求10工程)
domain: claim
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.1.7 §19 / docs/plan/phase0_plan.md §2.1, §10
depends_on:
  - docs/product/mvp_scope.md
  - docs/calculation/calculation_coverage_matrix.md
impacts:
  - WP-2102(電子レセプト生成)
  - docs/adapters/*(未作成)
open_questions:
  - 調剤用記録条件仕様の最新版・適用時期(入手経路含む)
  - 受付・事務点検ASP の利用形態
  - オンライン請求用端末への受け渡し方式(媒体・ネットワーク)
blockers:
  - 工程3〜5, 9, 10 は BLOCKED_REGULATORY_REVIEW(公式仕様未確認)
```

## 原則(v0.1.7 §19)

- 請求は10工程に分離して設計し、各工程の完了条件を独立に検証する。
- 公式仕様外のオンライン請求直接送信・画面自動操作・非公式API送信は実装しない。
- `isClaimable()`(実装済み)が false のデータはいかなる工程にも投入しない。

## 10工程マトリクス

| # | 工程 | MVP範囲 | 根拠として必要な公式資料 | ブロッカー | 検証方法 | 実装レーン |
|---|---|---|---|---|---|---|
| 1 | 算定 | calculation_coverage_matrix の MVP行のみ | 調剤点数表・留意事項・疑義解釈 | CAL-001 全行 BLOCKED | 算定 golden test・既知案件照合 | backend(Codex)+ 期待値レビュー(Claude) |
| 2 | レセプト中間モデル生成 | MVP(算定結果→請求単位の内部モデル) | (内部設計。ただし記録条件仕様の構造を踏まえる) | 工程3の仕様確認前に確定不可(構造が従属) | 中間モデル⇔算定trace の整合テスト | backend |
| 3 | 電子レセプトデータ生成 | MVP | **調剤用記録条件仕様(版・適用日)**・電子レセプト作成手引き | BLOCKED_REGULATORY_REVIEW(仕様未入手) | レセプト golden test(公式サンプル準拠) | backend + opus4.8 レビュー必須 |
| 4 | 記録条件仕様バリデーション | MVP(生成と分離した検証器) | 同上 | 同上 | 違反サンプルの検知率テスト | backend |
| 5 | 標準仕様チェック | MVP | レセプト電算処理システム標準仕様 | BLOCKED_REGULATORY_REVIEW | 同上 | backend |
| 6 | 請求前点検 | MVP(点検リスト・エラー修正導線) | 記載要領・返戻事由の類型 | 一部【要確認】 | 点検リストUIテスト・請求前資格確認テスト | frontend(Claude)+ backend |
| 7 | 請求月締め | MVP | 請求スケジュール関連の公式手順【要確認】 | — | 月次締めワークフローテスト・締め後変更の拒否テスト | backend + frontend |
| 8 | 請求データロック | MVP | (内部統制。e-文書法の保存要件参照) | — | ロック後改変拒否・監査ログテスト(MSR-033) | backend |
| 9 | オンライン請求用端末・公式手順への受け渡し | MVP(公式手順への出力まで。**送信自動化はしない**) | オンライン請求システム関連の公式手順・接続方式 | BLOCKED_REGULATORY_REVIEW | 出力媒体/形式の検証(仕様確認後) | backend + 人間レビュー |
| 10 | 送信結果・受付結果・返戻・再請求管理 | MVP(結果取込・返戻管理・再請求の基本) | 返戻・増減点通知の形式【要確認】 | BLOCKED_REGULATORY_REVIEW(形式未確認) | 返戻→修正→再請求のシナリオテスト | backend + frontend |

## 工程間の停止ゲート

- 工程1→2: calculation_trace の blockers が空であること(evidence 強制は @yrese/trace 実装済み)
- 工程2→3: 対象処方全件が `isClaimable() === true`
- 工程4→6: 記録条件バリデーション全件通過(違反は請求前点検リストへ)
- 工程6→7: 請求前資格確認完了(PENDING_REVERIFY が残る患者はレセプト振替・分割の判断へ【要確認】)
- 工程7→8: 月次締め承認(claim:finalize 権限 + 人間確定操作)
- 工程8以降: ロック済みデータの変更は返戻・再請求フロー(工程10)経由のみ

## 非スコープ(明示)

- 受付・事務点検ASP の自動操作(利用形態確認後に判断【要確認】)
- 支払基金・国保連システムへの直接接続
- 紙レセプト印刷による請求(電子請求を前提。例外運用は人間判断【要確認】)
