# defect_management_policy — 欠陥管理ポリシー

```yaml
ssot_id: QUA-004
title: 欠陥管理ポリシー
domain: quality
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs: 構築プロンプト v0.2.0 §10
depends_on: [QUA-001, SAF-001, SEC-007, OPS-013]
```

## 目的

欠陥(defect)の分類・優先度・修正・検証・再発防止を統制する(v0.2.0 §10)。

## severity 分類(絶対条件)

| severity | 定義 | 例 | 対応 |
|---|---|---|---|
| critical | 患者安全につながる欠陥 | 患者取り違え、誤investigation調剤誘発、警告欠落 | 即時停止判断+人間レビュー+incident化 |
| high | 請求事故につながる欠陥 | 算定誤り、レセプト記録不正、負担金誤り | 修正までリリース禁止 |
| medium | 業務影響のある欠陥 | 導線不全、性能劣化、表示不整合 | 計画修正 |
| low | 軽微 | 文言・体裁 | バックログ |

## 必須ルール

- critical/high の欠陥は golden test または回帰テストを追加してからクローズする(テストなしクローズ禁止)
- 欠陥修正も Work Package として発行し、実装者とレビュー者を分離する
- 本番データでの再現テストは禁止(合成データ、MOD-013 準拠)
- 欠陥の根本原因が仕様(SSOT)にある場合、コード修正より先に SSOT_UPDATE_REQUIRED を発行する
- 実績先例: WP-1010(isPermissionScope の malformed 受理)は codex 自律スキャンで検出→即日修正+回帰テスト(e51f920)

## 未確定(【要確認】)

- 欠陥台帳の運用場所(GitHub Issues 移行時期)
- SLA と連動した修正期限(OPS-005 確定後)
