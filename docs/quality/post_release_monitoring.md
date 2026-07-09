# post_release_monitoring — リリース後監視ポリシー

```yaml
ssot_id: QUA-006
title: リリース後監視ポリシー
domain: quality
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.1.7 §10
depends_on: [QUA-001, SAF-001, SEC-007, OPS-013]
```

## 目的

リリース後の異常検知と即時ロールバック可能性を保証する(v0.1.7 §10: 「リリース後に監視し、異常時は即時ロールバック可能にする」)。

## 必須監視(リリース直後の強化ウィンドウ)

- エラー率・p95 レイテンシ(UIX-003 予算との比較)
- 算定 BLOCKED 率の急変(ルール配線事故の兆候)
- isClaimable=false 件数の急変(請求経路の異常)
- 同期バックログ・dead_letter 発生(MOD-009)
- 監査ログ書き込み成功率(欠落=リリース停止条件)
- crash-free sessions(UIX-005)

## 必須ルール

- Blue/Green + auto rollback(v0.1.7 §30)を前提とし、ロールバック手順のリハーサルなしにリリースしない
- マスター更新のリリースは MST-001 の24段パイプライン+ロールバックポイント作成に従う
- 監視ダッシュボードは OPS-009 の9種を正本とする
- リリースノート・変更点説明(§9.9)を薬局向けに公開する

## 未確定(【要確認】)

- 強化ウィンドウの長さ(候補: 請求期を1回跨ぐまで)
- 自動ロールバックのトリガー閾値(Phase 1 実測後)
