# State.md — 活動ログ

調剤用レセプトコンピューター MVP(構築プロンプト v0.1.7)の活動記録。新しいエントリを上に追記する。

---

## 2026-07-09

### 15:30〜 — ユーザー指示: fable5 全権コントロール・公式資料検索許可・完了まで継続

- ユーザー指示(原文趣旨): fable5 は全体コントロール役。必要に応じて公式資料をインターネット検索して最新情報を取得し、計画を修正して実装完了まで動き続ける。タスクの追加・削除・修正権限を持つ
- 運用への反映:
  - 公式資料(厚労省・支払基金・診療報酬情報提供サービス・デジタル庁等)のWeb調査を evidence_id 発行の正規手段として使用する(Priority A/B のみ実装根拠化、Priority C は補助)
  - BLOCKED_REGULATORY_REVIEW の解除は「公式ソースの版・適用日を source_registry に記録 → evidence_id 発行 → 該当SSOT APPROVED」の手順で行う
  - Plans.md のタスクは fable5 判断で随時追加・削除・修正する
- WP-1006 完了: @yrese/events(EventEnvelope、PHI≠none→encrypted必須、sha-256形式検証、bigint clock)codex実装・claudeレビュー、7テストパス、85bd3aa
- WP-1007 発行: @yrese/contracts(contract-first の器、healthスキーマ移設)→ codex
- フォーク2系統実行中: WP-0005 規制・法令SSOT / WP-0006 医療安全・スコープSSOT

### 15:20〜15:30 — 実装第2波: date-time / trace / CI / 患者ヘッダー

- WP-1004 完了: @yrese/date-time(CalendarDate 実カレンダー検証・うるう年、処方日/調剤日/受付日、ClaimMonth、現在時刻への暗黙依存なし)codex実装・claudeレビュー、8テストパス、ab234fe。レビューノート: 日付ラッパー3種が構造的に同型のため異種間compareが可能 → 算定エンジン接続時にnominal brand追加予定
- WP-1005 完了: @yrese/trace(CalculationTrace/LegalTrace/EvidenceRef。affectsClaim=trueのstepはevidenceRef必須=「evidence_idのない算定ロジック禁止」を型・実行時で強制。inputsSummaryは型設計でPHI排除。URLはコード禁止=source_registry管理)codex実装・claudeレビュー、6テストパス、ddc06a1
- WP-0004 完了: llm_capability_registry + codex_capability_verification(AGMSG_PROTOCOL_UNVERIFIED を実測により解除。CODEX_CAPABILITY_UNVERIFIED はモデルID・Cloud関連のみ継続)aa904f9
- WP-4001 完了: GitHub Actions CI(typecheck/test/build)初回グリーン49秒、2116587
- WP-3002 完了: PatientHeader(カナ併記・生年月日+年齢・資格確認状態のテキストラベル表示、PENDING_REVERIFY/LOCAL_ONLY可視化)1acfa3f
- WP-1006 進行中: @yrese/events(sync event envelope、PHI未暗号化拒否の不変条件)を codex へ WP_ASSIGN
- 二系統WPフロー4周目。競合ゼロ、レビュー指摘は軽微のみ

### 15:05〜15:20 — 実装第1波: scaffold + 共通モジュール + 両アプリ骨格

- WP-0003 完了: 二系統運用SSOT 15文書(docs/agents/、status PROPOSED)コミット 8d47d70。フォークの open_questions(Codexモデル名、agmsgルーム機能なし→[room]タグ代替等)は llm_capability_registry 作成時に反映予定
- WP-1001 完了: monorepo scaffold(pnpm workspaces + strict TS base)c81d6ca
- WP-1002 完了: @yrese/shared-kernel(branded ID / SystemMode / PENDING系status / BLOCKER種別 / エラーコード・権限スコープ基盤)テスト15件パス、9ab039e
- WP-2001 完了: @yrese/api scaffold(Fastify 5 + zod /health)— **codex実装・claudeレビュー承認**、58411c0。二系統WPフロー(WP_ASSIGN→CODEX_PLAN→承認→実装→WP_HANDOFF→レビュー→コミット)が一巡目から正常動作
- WP-3001 完了: @yrese/web scaffold(Next.js 15、全画面共通SystemModeBadge=色非依存の状態表示、フォーカスリング、受付ダッシュボードプレースホルダー)build+typecheckパス、12a5ac2
- WP-1003 完了: @yrese/money(bigint ScaledDecimal / Yen / Points、丸め政策値の配線はBLOCKED_REGULATORY_REVIEW明記)— codex実装・claudeレビュー(丸めロジックのbigint truncated-division整合を確認)、11テストパス、533f89a
- WP-1004 進行中: @yrese/date-time を codex へ WP_ASSIGN、CODEX_PLAN 承認済み
- 運用メモ: pnpm-lock.yaml は claude が一括コミット(codexはcommit禁止の取り決めが機能)

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
