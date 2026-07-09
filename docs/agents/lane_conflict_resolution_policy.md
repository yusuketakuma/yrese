# 二系統衝突・不一致解決ポリシー

```yaml
ssot_id: AGT-008
title: 二系統衝突・不一致解決ポリシー
domain: agents
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
effective_from: 承認後
effective_to: null
source_refs:
  - 構築プロンプト v0.1.7 §0.1.6.11, §0.9
depends_on:
  - docs/agents/dual_lane_operating_model.md
impacts:
  - docs/agents/file_ownership_and_lock_policy.md
related_work_packages: []
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - 0.1.0 初版作成(Phase 0 作業#1)
open_questions: []
blockers: []
```

## 1. 判断衝突の処理優先順位

Claude側とCodex側の判断が衝突した場合、以下の順で処理する。**上位4つはいずれも即時停止事由である。**

1. 法令・通知・公式仕様に反する実装は停止
2. 医療安全リスクがある実装は停止
3. 請求事故につながる実装は停止
4. PHI/PII漏えいリスクがある実装は停止
5. fable5 が `DECISION_REQUIRED` を発行する
6. opus4.8 が高リスク観点でレビューする
7. Codex側Sol は技術的根拠、再現ログ、diff、テスト結果を提示する
8. fable5 が裁定案を出す
9. 必要なら人間レビューへ回す
10. 裁定結果を ADR または該当ドキュメントへ転記する

**衝突が解決するまで、該当PRを merge してはならない。**

## 2. DECISION_REQUIRED フロー

```text
検知者 → agmsg blockers へ BLOCKER投稿
→ fable5 が DECISION_REQUIRED 発行(争点・選択肢・影響・期限を明記)
→ 両レーンが根拠提出(Codex側: 技術根拠・再現ログ / Claude側: 仕様・法令・安全根拠)
→ (R3+または安全関連)opus4.8 レビュー
→ fable5 裁定案 → (必要時)人間レビュー
→ ADR転記 → WP再発行または再開
```

## 3. 衝突の類型と一次裁定基準

| 類型 | 一次裁定基準 |
|---|---|
| 仕様解釈の不一致 | 承認済みSSOTが正。SSOT自体が曖昧なら `SSOT_UPDATE_REQUIRED` とし fable5 が更新 |
| API契約の不一致 | openapi.yaml + API Contract SSOT が正。変更は `CONTRACT_CHANGE_REQUEST` 経由のみ |
| 技術方式の不一致(同等安全) | 実装ownerの提案を優先しつつ、性能・保守性根拠で fable5 裁定 |
| 安全性 vs 速度・体験 | 常に安全側(医療安全・請求正確性・法令適合性)を優先 |
| 公式資料の解釈不一致 | Priority A>B>C、適用日の新しい公式仕様優先。解決不能は `BLOCKED_REGULATORY_REVIEW` |
| レビュー verdict の不一致 | 高リスクは opus4.8 の指摘を却下する場合 fable5+人間レビュー必須 |

## 4. ファイル競合(同時編集)の処理

1. 作業者は即座に agmsg `blockers` へ報告する
2. fable5 が双方の変更意図を確認する
3. 高リスク領域なら opus4.8 が影響を確認する
4. fable5 が採用差分、再実装、分割、rebase 方針を決定する
5. 決定内容をPRまたはADRへ残す

**競合を自動解決して本番ロジックへ反映してはならない。** 予防策は [file_ownership_and_lock_policy](file_ownership_and_lock_policy.md) を正とする。

## 5. エスカレーション期限

- BLOCKER投稿から fable5 の triage まで: 当該セッション内(長期化する場合は blockers ルームに状態を残す)
- DECISION_REQUIRED から裁定案まで: 根拠が揃い次第。公式資料未確認が原因の場合は `BLOCKED_REGULATORY_REVIEW` として人間レビュー待ちに切替
- 人間レビュー待ちの間、該当WPは status=BLOCKED とし、依存WPの着手可否を fable5 が個別判断する
