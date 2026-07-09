# State.md — 活動ログ

調剤用レセプトコンピューター MVP(構築プロンプト v0.1.7)の活動記録。新しいエントリを上に追記する。

---

## 2026-07-09

### 15:00 — agmsg 連携確立(Claude側⇄Codex側)

- チーム `yrese` を作成し `claude`(このセッション)が join。配信モード monitor(リアルタイム受信)
- Codex側 `codex` が join 済みを確認。挨拶メッセージ受信
- 連携プロトコルを送信: レーン分担(claude=仕様/SSOT/frontend、codex=backend)、WP_ASSIGN→CODEX_PLAN→実装→WP_HANDOFF、共有ファイルのロック、R3+高リスク領域のBLOCKED維持
- ユーザー指示: 「codexはclaudeと連携しながら動作。可能なら常に連絡を取り合い、タスクのやりとりをする。お互いを尊重して動作」

### 14:5x — セッション開始〜Phase 0 承認〜実装開始指示

- GitHub 公開リポジトリ作成: https://github.com/yusuketakuma/yrese(main、.claude/.omc/.harness-mem は gitignore)
- Phase 0 計画案 `docs/plan/phase0_plan.md` をコミット(d24ecac)。人間レビューで承認(「次に進む」)
- **能力検証(WP-0002)完了**:
  - Codex側: codex-cli 0.143.0(~/.agents/bin/codex)、ChatGPTログイン済み。モデル名「GPT-5.6 sol max」は【要確認】
  - agmsg: ~/.agents/skills/agmsg/scripts/ 稼働確認
  - Claude側 /ultracode: 本環境のマルチエージェントオーケストレーション(fork/Workflow)として利用可能
- WP-0003 起動: 二系統運用SSOT 15文書を fork で並列作成中(docs/agents/ 配下のみ、完了待ち)
- ユーザー指示により実装開始承認。Plans.md / State.md 運用開始、活動単位ごとにコミット&プッシュ
- 方針: R3+ 高リスク領域(算定点数の具体値・レセプト記録条件・Official Adapter)は公式根拠 evidence_id 確認まで BLOCKED。R0-R2 の基盤(scaffold・共通モジュール)から実装

### 次アクション

- WP-1001 monorepo scaffold(claude)
- WP-2001 apps/api scaffold を codex へ WP_ASSIGN(scaffold 完了後)
- WP-0003 フォーク成果(docs/agents/)の受領・コミット
