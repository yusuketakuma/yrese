# review_gate_matrix — レビューゲートマトリクス

```yaml
ssot_id: PRC-005
title: レビューゲートマトリクス
domain: process
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs: 構築プロンプト v0.1.7 §0.12, §0.1.3.5
depends_on:
  - AGT-014 agent_review_pairing_policy
open_questions:
  - haiku4.5 の機械的チェック(scan/lint/差分要約)の定常運用開始時期(現状は CI + claude レビューが代替)
```

## 1. レビュー手順(v0.1.7 §0.12)

1. 機械的チェック(CI: typecheck / test / check:boundaries / build。将来: haiku4.5 による scan・差分要約)
2. 通常実装レビュー(実装者の対向レーン: codex実装→claude、claude実装→codex または haiku4.5)
3. 高リスク(R3+)は opus4.8 の専門レビュー
4. fable5 が受入条件とプロジェクト整合性を確認して完了判定

## 2. リスク別レビュー組み合わせ(§0.1.3.5 / AGT-014)

| リスク | 実装者 | 必須レビュー | 追加条件 |
|---|---|---|---|
| R0-R1(低) | sonnet5 / Codex側Sol / haiku4.5 | 対向レーンの差分確認(現運用: claude) | — |
| R2(中) | frontend=sonnet5、backend=Codex側Sol | 対向レーン技術レビュー + fable5 確認 | — |
| R3(高) | 凍結済み仕様の下で frontend=sonnet5、backend=Codex側Sol | opus4.8 必須 + fable5 | golden / regression / audit log 確認必須。実装者≠レビュー者 |
| R4(重大) | 実装禁止 | — | BLOCKER化 → 人間レビュー後に再計画 |

- opus4.8 が限定的参考実装に関与した場合は、fable5+対向レーン技術レビュー+人間レビューを追加する。
- 自分が実装した高リスクコードを自分だけで完了判定してはならない。

## 3. レビュー観点チェックリスト(v0.1.7 §0.12)

- WPの目的に合っているか / 余計な変更がないか
- evidence_id があるか(算定・請求・帳票・法令対応ロジック)
- 法令・医療安全への影響評価
- PHI/PII がログ・テスト・agmsg・コミットに漏れていないか
- オフラインモードで誤認を生まないか / エラー時に安全側に倒れるか
- rollback 可能か / テスト十分か
- UIが医療システムとして相応しいか(UIX-001)/ UX改善が請求正確性・医療安全を損なっていないか
- 共通モジュール再定義がないか(check:boundaries + 目視)
- セキュリティ迂回経路がないか(先例: WP-2002 バイパス除去)

## 4. ゲート種別

| ゲート | タイミング | 判定者 |
|---|---|---|
| Plan ゲート | CODEX_PLAN / 実装方針の承認 | fable5 |
| Handoff ゲート | WP_HANDOFF 受領時のコードレビュー | claude(fable5)、R3+ は opus4.8 追加 |
| コミットゲート | コミット前(テスト再実行) | claude |
| Phase ゲート | Phase 0/1/2 完了時の一括人間レビュー | 人間(薬剤師・請求実務者・法務含む) |
| Go/No-Go | 本番移行前 | 人間(go_no_go_checklist) |
