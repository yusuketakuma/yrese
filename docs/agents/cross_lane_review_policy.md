# 相互レビューポリシー

```yaml
ssot_id: AGT-007
title: 相互レビューポリシー
domain: agents
status: SUPERSEDED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-10
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: 承認後
effective_to: 2026-07-10
superseded_by: AGT-018
source_refs:
  - 構築プロンプト v0.2.0 §0.1.6.13, §0.1.3.5, §0.12
depends_on:
  - docs/agents/dual_lane_raci_matrix.md
impacts:
  - docs/agents/agent_review_pairing_policy.md
related_work_packages: []
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - 0.1.0 初版作成(Phase 0 作業#1)
  - 0.2.0 2026-07-10 AGT-018のAPPROVED化に伴いmetadata-onlyでSUPERSEDED (WP-9001)
open_questions: []
blockers: []
```

## 1. 大原則

- **レビュー者は実装者と分離する。** 自分が実装した高リスクコードを自分だけで完了判定してはならない。
- レビューは「haiku4.5 機械的チェック → 通常実装レビュー(反対レーン含む)→(高リスク)opus4.8 専門レビュー → fable5 受入確認」の順で行う。
- 高リスクPRは opus4.8 承認なしに merge してはならない。

## 2. Claude側が実装したもののレビュー

| 領域 | レビュー |
|---|---|
| 通常領域(R0〜R2) | haiku4.5 または Codex側が差分確認 |
| UI/UX領域 | fable5 が方針確認、必要に応じて opus4.8 が医療安全確認 |
| 高リスク領域(R3+) | opus4.8 レビュー必須。Codex側は技術レビュー補助 |

## 3. Codex側が実装したもののレビュー

| 領域 | レビュー |
|---|---|
| 通常領域(R0〜R2) | sonnet5 または haiku4.5 がレビュー |
| 大規模実装(S3+) | fable5 が設計整合性を確認 |
| 高リスク領域(R3+) | opus4.8 レビュー必須 |
| UI領域(例外承認時) | fable5 が医療UI/UX方針との整合性を確認 |
| migration / sync / performance / CI | Codex側セルフレビュー + Claude側レビュー |

## 4. リスク別レビュー組み合わせ(v0.2.0 §0.1.3.5)

### 低リスク(R0〜R1)
- Implementer: frontend=sonnet5 / backend=Codex側Sol / 軽量検査=haiku4.5
- Reviewer: haiku4.5 または反対レーンレビュアー

### 中リスク(R2)
- Implementer: frontend=sonnet5 / backend=Codex側Sol
- Reviewer: 反対レーン技術レビュー + fable5 確認

### 高リスク(R3)
- Owner: fable5
- Implementer: frontend=sonnet5 / backend=Codex側Sol(仕様凍結済みSSOTのみ根拠)。opus4.8 は設計・レビュー・限定的参考実装
- Reviewer: opus4.8 必須。opus4.8 が限定的参考実装に関与した場合は fable5 + 反対レーン技術レビュー + 人間レビューを追加
- Required: golden test / regression test / audit log check

### 重大リスク(R4)
- 実装禁止。BLOCKER化し、人間レビュー後に再計画

## 5. レビュー観点チェックリスト

- [ ] WPの目的に合っているか / 余計な変更(ついでの改善)がないか
- [ ] evidence_id があるか(または不要理由が明記されているか)
- [ ] 法令・医療安全への影響が評価されているか
- [ ] PHI/PII がログ・テスト・agmsg・PRに漏れていないか
- [ ] オフラインモード(LOCAL_ONLY / RECOVERY_SYNC)で誤認を生まないか
- [ ] エラー時に安全側に倒れるか / rollback 可能か
- [ ] テストが十分か(golden / contract / E2E の要否判断含む)
- [ ] UIが医療システムとして相応しいか / UX改善が請求正確性・医療安全を損なっていないか
- [ ] 共通モジュール重複定義・依存方向違反・generated code 手編集がないか
- [ ] ssot_refs / ssot_versions がPR本文に記載されているか

## 6. レビュー結果の記録

- レビュー結果は `REVIEW_RESULT` として agmsg `cross-review` へ投稿し、PR本文へ転記する。
- 変更要求は WP status を CHANGES_REQUESTED にし、owner が修正後に再ハンドオフする。
- 衝突(レビュー不一致)は [lane_conflict_resolution_policy](lane_conflict_resolution_policy.md) に従う。
