# レビューペアリングポリシー

```yaml
ssot_id: AGT-014
title: レビューペアリングポリシー
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
  - 構築プロンプト v0.2.0 §0.1.3.5, §0.1.6.13, §0.12
depends_on:
  - docs/agents/cross_lane_review_policy.md
  - docs/agents/agent_routing_policy.md
impacts:
  - docs/agents/agent_handoff_protocol.md
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

## 1. ペアリング原則

1. **実装者 ≠ レビュー者**(全リスクレベル共通。R3+ は絶対禁止)
2. 高リスク(R3+)は opus4.8 をレビュー者に必ず含める
3. opus4.8 が限定的参考実装・ペア実装に関与した場合、そのコードのレビューには fable5 + 反対レーン技術レビュー + 人間レビューを追加する
4. haiku4.5 は機械的チェック(scan / lint / typecheck / 差分要約 / 整合性)の一次レビュアーだが、**完了判定者にはなれない**
5. Codex側セルフレビューは必須の事前工程だが、それだけで完了扱いにしない
6. 人間レビュー(薬剤師 / 請求実務者 / セキュリティ)が必要な領域は `human_review_checklist.md` に登録し、完了判定を保留する

## 2. リスク別標準ペア

| risk | Implementer | 一次レビュー | 二次レビュー | 最終ゲート |
|---|---|---|---|---|
| R0 | sonnet5 / Sol / haiku4.5 | haiku4.5 or 反対レーン | — | fable5(サンプリング可) |
| R1 | frontend=sonnet5 / backend=Sol | haiku4.5 or 反対レーン | — | fable5 |
| R2 | frontend=sonnet5 / backend=Sol | 反対レーン技術レビュー | fable5 確認 | fable5 |
| R3 | frontend=sonnet5 / backend=Sol(SSOT凍結後) | 反対レーン技術レビュー | opus4.8 必須 | fable5(+人間レビュー候補) |
| R4 | 実装禁止 | — | — | 人間レビュー後に再計画 |

## 3. 領域別の必須人間レビュー候補

| 領域 | 人間レビュー |
|---|---|
| 算定エンジン(仕様・期待値・golden test) | 薬剤師 + 請求実務者 |
| 電子レセプト・請求前点検・月次締め | 請求実務者 |
| 医療安全UI(患者取り違え防止・薬剤師確認・警告) | 薬剤師 |
| 法令適合性マトリクス・SaMD該当性 | 法令担当(人間) |
| セキュリティ重大変更・本番移行 | セキュリティ担当(人間) |

## 4. レビュー手順(標準4段)

1. haiku4.5: 機械的チェック(lint / typecheck / scan / WP-PR整合 / execution_mode整合 / PHI混入)
2. 通常実装レビュー: sonnet5 または Codex(反対レーン優先)
3. (高リスク時)opus4.8: 専門レビュー(法令・医療安全・算定・請求・セキュリティ・アーキテクチャ)
4. fable5: 受入条件・プロジェクト整合性・SSOT整合性の確認、DONE判定

## 5. 逸脱の扱い

- レビュー者不在・未割当のWPは READY にできない(BLOCKED_NOT_READY)
- レビュー省略の完了報告は無効。fable5 は DONE 判定を取り消し、REVIEW_REQUESTED へ差し戻す
- opus4.8 指摘の却下には fable5 裁定 + 記録(ADR)が必要。医療安全・法令関連の却下は人間レビュー必須
