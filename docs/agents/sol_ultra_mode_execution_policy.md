# Sol ultraモード実行ポリシー

```yaml
ssot_id: AGT-004
title: Sol ultraモード実行ポリシー
domain: agents
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: 承認後
effective_to: null
source_refs:
  - 構築プロンプト v0.2.0 §0.1.6.4
  - docs/agents/codex_side_ultra_mode_charter.md
depends_on:
  - docs/agents/codex_side_ultra_mode_charter.md
impacts:
  - docs/agents/agent_handoff_protocol.md
related_work_packages: []
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - 0.1.0 初版作成(Phase 0 作業#1)
open_questions:
  - codex CLI 実行時の sandbox / approval 設定(--full-auto 等)の標準値【要確認】
blockers: []
```

## 1. 定義

`ultraモード` は単なる高速実装モードではない。以下の実行規律を満たす、高密度・高検証・並列可能な実装モードである(本プロジェクト内の運用モード名。公式機能名として扱わない)。

## 2. 基本動作(12の規律)

1. fable5 から agmsg で明示された work package のみ着手する
2. 着手前に `CODEX_PLAN` を返す
3. 対象ファイル、変更予定、テスト予定、リスク、未確認事項を列挙する
4. 仕様不明点があれば実装せず `CODEX_BLOCKED` を返す
5. 実装前に既存テスト、lint、typecheck、関連ドキュメント(承認済みSSOT)を確認する
6. 変更は小さな差分単位に分ける
7. 可能な限りテストファーストまたは再現テスト先行で進める
8. 実装後に関連テストを実行する
9. CI失敗時は原因、再現手順、影響範囲、修正案をまとめる
10. 完了時に `WP_HANDOFF` を agmsg へ投稿する
11. PRまたはdiffに、変更目的、変更範囲、テスト結果、残リスク、レビュー要点を添える
12. 高リスク領域では opus4.8 レビューが終わるまで完了扱いにしない

`CODEX_PLAN` / 実装差分 / テスト結果 / `WP_HANDOFF` の4点が揃うまで、いかなる作業も完了扱いにしない。

## 3. ultraモードで優先する作業

大規模コード読解 / 実装面の探索 / 型安全性向上 / テストカバレッジ拡充 / CI安定化 / E2E失敗再現 / 性能測定 / DB migration影響調査 / OpenAPI差分検出 / contract test作成 / リファクタリング候補抽出 / 技術的負債の棚卸し

## 4. ultraモードで禁止する作業

- 仕様未凍結領域の先行実装
- 医療安全上の警告を弱める実装
- 算定根拠なしの計算ロジック追加
- evidence_id なしの請求・算定・帳票ロジック追加
- 高リスク領域の一括大規模書き換え
- agmsg上の断片的会話だけを根拠にした実装
- PHI / PII / 本番データ / 未マスク医療情報の利用
- Cloud環境への機微情報の持ち出し

## 5. 実装ワークフロー(標準)

```text
WP_ASSIGN受領 → WP_ACK → 承認済みSSOT読込(status=APPROVED確認)
→ CODEX_PLAN提出 → (必要時)fable5/opus4.8のplan承認
→ ブランチ作成(codex-sol/<wp-id>-<short-name>)
→ テスト先行 → 最小差分実装 → typecheck/lint/関連テスト実行
→ セルフレビュー → WP_HANDOFF投稿 → レビュー対応
→ (高リスク)opus4.8レビュー → fable5完了判定
```

## 6. 品質ゲート(Codex側セルフチェック)

- [ ] ssot_refs のSSOTがすべて APPROVED である
- [ ] allowed_files 外のファイルに触れていない
- [ ] 契約(OpenAPI / API SSOT)にない項目・状態・エラーコードを追加していない
- [ ] 共通モジュールの重複再実装をしていない(shared_type_registry / status_registry / error_code_registry 確認)
- [ ] generated code を手編集していない
- [ ] 金額・点数に floating point を使っていない
- [ ] テスト結果を WP_HANDOFF に添付した
- [ ] 残リスク・未完了事項を明記した
