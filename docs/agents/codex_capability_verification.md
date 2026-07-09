# codex_capability_verification — Codex側能力検証記録

```yaml
ssot_id: AGT-017
title: Codex側能力検証記録
domain: agents
status: PROPOSED
owner: fable5
reviewers:
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.1.7 §0.7
open_questions:
  - actual_model_id / ultraモード相当設定の実体
  - Codex Cloud 利用可否・並列実行・データ送信範囲
  - sandbox / approval モードの標準設定値
blockers:
  - CODEX_CAPABILITY_UNVERIFIED(モデルID・Cloud関連のみ継続。実装能力・agmsg連携は検証完了)
```

## 検証ログ(2026-07-09)

| # | 検証項目 | 方法 | 結果 |
|---|---|---|---|
| 1 | CLI 存在 | `which codex` | `/Users/yusuke/.agents/bin/codex` |
| 2 | バージョン | `codex --version` | codex-cli 0.143.0 |
| 3 | 認証 | `codex login status` | Logged in using ChatGPT |
| 4 | actual_model_id | — | **未確認**(「GPT-5.6 sol max」はユーザー指定呼称) |
| 5 | agmsg 参加 | `team.sh yrese` | codex メンバー確認(ユーザーが起動・join) |
| 6 | agmsg 双方向通信 | 実運用 | 送受信・heartbeat・truncation なし動作 |
| 7 | WPフロー遵守 | WP-2001 | WP_ASSIGN→CODEX_PLAN→承認→実装→WP_HANDOFF を完走 |
| 8 | 実装品質 | WP-2001 レビュー | 仕様一致・typecheck/テストパス・副作用なし設計 |
| 9 | 実装品質(R2) | WP-1003 レビュー | bigint丸めロジック正当・政策値ハードコードなし・11テストパス |
| 10 | スコープ遵守 | WP-2001/1003 | allowed_files 外の編集なし・docs/agents 不可侵・git commit せず |
| 11 | ファイル競合回避 | 並行作業実測 | claude(shared-kernel/web)と同時作業で競合ゼロ |

## 運用上の取り決め(検証済みで有効)

- Codex は WP_ASSIGN なしに実装しない(heartbeat で待機することを確認)
- Codex は git commit / push しない。claude がレビュー後にコミット(pnpm-lock.yaml 含む)
- 共有ファイルは事前ロック宣言後のみ(AGT-009)
- PHI/PII・本番データ・秘密情報は agmsg・Codex 入力に含めない(AGT-010)

## 未検証・条件付き事項

1. **actual_model_id**: codex CLI の設定確認(`~/.codex/config.toml` 等)は Codex 側の同意を得て実施予定。確認まで R3 実装の単独割当は不可(現行どおり R0-R2 + レビュー必須で運用)
2. **Codex Cloud**: 利用しない(未検証のため)。利用が必要になった場合は本書を更新し人間レビューを経る
3. **ultraモード**: 公式機能名ではなく運用モード名として扱う(v0.1.7 §0.7)。実体は codex CLI セッション + 本プロジェクトの実行規律(AGT-004)
