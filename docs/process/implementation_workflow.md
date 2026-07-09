# implementation_workflow — 実装ワークフロー(二系統運用の正式化)

```yaml
ssot_id: PRC-001
title: 実装ワークフロー
domain: process
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.1.7 §0.5, §0.11, §0.1.6.6
depends_on:
  - AGT-001 dual_lane_operating_model
  - AGT-015 agent_handoff_protocol
  - PRC-002 work_package_template
  - PRC-003 definition_of_ready
impacts: 全実装作業
open_questions:
  - 複数Claudeセッション並行時のfile lock台帳の実装方式(AGT-009 参照、Phase 1 で確定)
```

## 1. 基本原則

- fable5(claude セッション)が唯一の実装指揮者である。work package(WP)なしの実装、探索的な本番コード変更を禁止する。
- 実装者は承認済みSSOTとWPのみを根拠に実装する。agmsg・会話ログは根拠にしない(重要決定はSSOT/State.md へ転記)。
- どのステップでも疑義が出た場合は、実装を進めず fable5 に戻す。
- 「ついでの改善」を禁止する。改善は新しいWPとして提案する。

## 2. 二系統フロー(運用実績により正式化)

WP-2001〜WP-2101a で実運用済みのフローを標準とする。

```text
1. fable5 が WP を作成(risk_class / layer / allowed_files / prohibited_scope / output_required を明記)
2. fable5 が agmsg で WP_ASSIGN を送信(Codex側担当の場合)
3. Codex側 Sol が CODEX_PLAN を返す(対象ファイル・手順・テスト計画・リスク・不明点)
4. fable5 が PLAN_APPROVED を返す(修正が要る場合は差し戻し)
5. owner が実装する(allowed_files 外に触れない。git commit/push は claude のみ)
6. owner が typecheck / relevant tests を実行する
7. owner が WP_HANDOFF を投稿(files_changed / tests_run / test_results / open_risks)
8. claude(fable5)がレビューする(コード読解+テスト再実行+仕様適合確認)
9. 指摘がある場合 CHANGES_REQUESTED → owner 修正 → 再 WP_HANDOFF(ステップ8へ)
10. claude が REVIEW_RESULT(APPROVED)を送信し、コミット&プッシュする
11. Plans.md / State.md を更新する(活動単位ごと)
12. 高リスク(R3+)は opus4.8 の追加レビューを経てから完了とする
```

Claude側自身が実装する場合は 2〜4, 7 を省略し、5→6→8(自己レビュー不可の高リスクは opus4.8/人間へ)→10→11 とする。

## 3. 先例(precedent)

| 事例 | 内容 | 教訓 |
|---|---|---|
| WP-2002 レビュー往復 | 本番起動拒否にバイパスオプション(`allowDevTenantContextInProduction`)が実装され、claude が CHANGES_REQUESTED。除去後に再ハンドオフ→grep+テストで除去検証→マージ | セキュリティ規律に関わる仕様逸脱は「デフォルト安全なら可」とせず、経路そのものを除去させる。検証はレビュー者が機械的に行う(grep/テスト再実行) |
| WP-1003 丸め政策値 | 端数処理の政策値をハードコードせず、明示パラメータ+JSDoc(BLOCKED_REGULATORY_REVIEW)で実装 | 「実装はできるが根拠がない」値は API surface として空けておき、evidence_id 確認後に配線する |
| WP-2101a 空ruleset | 算定エンジン骨格は空ルールセットで必ず BLOCKED を返すことをテストで固定 | 根拠不足を正しく検知して止まる挙動そのものをテスト対象にする |

## 4. 実装者の標準手順(v0.1.7 §0.11)

1. WP を読む → 2. 変更対象ファイル確認 → 3. 関連SSOT・テスト確認 → 4. 不明点は agmsg で質問 → 5. テスト方針確認 → 6. 必要ならテスト先行 → 7. 最小差分で実装 → 8. 型・lint・unit test → 9. 高リスクは golden/contract/e2e 追加 → 10. ドキュメント更新 → 11. agmsg 完了ハンドオフ → 12. PR/コミット本文をWPに沿って書く

## 5. 完了判定

fable5 が以下を確認して DONE 判定する: 受入条件充足 / テスト結果 / SSOT整合 / Plans.md・State.md 反映 / 高リスクは追加レビュー証跡。
