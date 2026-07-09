# endpoint_management_policy — 端末・エンドポイント管理ポリシー

```yaml
ssot_id: OPS-008
title: 端末・エンドポイント管理ポリシー
domain: operations
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs: 構築プロンプト v0.2.0 §9.4, §35 / docs/plan/phase0_plan.md §8
depends_on:
  - SEC-005 (edge_node_security_design)
  - OPS-007 (device_compatibility_matrix)
open_questions:
  - 業務端末の推奨仕様(OS・ブラウザの対応マトリクス具体値)【要確認 — Phase 1】
  - MDM 導入の要否(薬局規模による)【要確認 — 経営レビュー】
  - 端末台帳の管理主体(薬局 or 当社)の契約整理【要確認】
```

## 1. 対象

- 業務端末(受付・調剤・会計で使う PC/タブレット)
- Pharmacy Edge Node 本体
- 周辺デバイス(OPS-007 の18種)
- 薬局内 LAN 機器

## 2. 端末管理要件

| 項目 | 要件 |
|---|---|
| 端末台帳 | device_id(@yrese/shared-kernel DeviceId)で登録。未登録端末からの業務アクセスを拒否【Phase 1 実装】 |
| 端末認証 | 端末証明書+mTLS(SEC-005)。共有端末はユーザー認証と分離 |
| OS/ブラウザ | サポートマトリクス【要確認】を公開し、対象外は起動時警告+サポート対象外明示 |
| パッチ管理 | OS・ブラウザの重大脆弱性は薬局へ更新依頼を通知(既知障害ページと同枠) |
| スクリーンロック | 離席ロック必須(候補値: 5分)— 調剤室・受付の実務と両立する値を人間レビュー |
| 端末紛失・盗難 | 端末証明書失効+セッション失効+監査ログ調査(SEC-005 の手順) |
| 持ち出し制御 | 業務端末の院外持ち出しは原則禁止。在宅業務用は別プロファイル【非MVP・要確認】 |
| USB 制御 | Edge Node 本体は USB ストレージ無効化を既定(SEC-005)。業務端末は薬局ポリシー選択制 |
| 廃棄 | 端末・Edge・バックアップ媒体の廃棄はデータ消去証跡を残す(OPS-010 と同期) |

## 3. Edge Node の配置・更新

- 設置: 薬局内の施錠可能な場所を推奨(物理アクセス統制 — SEC-005)
- 更新: 署名付きパッケージ+A/B update+self-test(v0.2.0 §31)。更新失敗時は自動ロールバックし業務継続
- 監視: Edge health(自己診断・ディスク・同期 backlog)を OPS-009 のダッシュボードへ
- 予備機: 故障時の代替機復旧手順(ローカルバックアップからのリストア+Cloud 再同期)を Runbook 化(SEC-005 §リストア訓練と同期)

## 4. 禁止事項

- 未登録端末・失効端末からの業務利用
- 端末台帳・失効状態の管理なしでのオフライン認証運用(退職者リスク — SEC-005)
- サポート対象外環境での本番利用を「動くから」と黙認すること(明示警告+記録)
