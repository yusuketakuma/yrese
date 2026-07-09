# State.md — 活動ログ

調剤用レセプトコンピューター MVP(構築プロンプト v0.1.7)の活動記録。新しいエントリを上に追記する。

---

## 2026-07-09(続き)

### 17:00〜17:10 — マイルストーン: 初の evidence 裏付け算定コード(WP-2101b)

- **Phase 0 ゲート通過**(人間承認)→ 98 SSOT 一括 APPROVED(5fa3f14)
- WP-0017: evidence 71件正式採番、算定16行 EVIDENCE_ISSUED 化(8cf3f10)
- CAL-004 算定エンジン設計: fable5起案 → opus4.8 レビュー(APPROVE_WITH_CHANGES)→ 全指摘反映+register照合訂正(EVD-CAL-0021=3剤分まで)で v0.2.1 APPROVED(24adf71)
- **WP-2101b マージ(76da0d6)**: 5ルール(調剤基本料1=47点/内服薬剤調製料=24点上限3/調剤管理料2=10点/服薬管理指導料3=45点/夜間・休日等加算=40点)、POINTS_ONLY_COPAY_BLOCKED(claimable:false型強制)、適用日ガード(2026-06-01 inclusive)、重複・上限検知、golden 16テスト。opus4.8事後レビュー(APPROVE_WITH_CHANGES→境界通過側テスト2件+canonical golden 166点を追加して解消)
- copay(一部負担金)は evidence 未発行のため BLOCKED_REGULATORY_REVIEW 維持(点→円換算・負担割合・端数処理の根拠が必要)
- WP-1101 ドメイン設計SSOT 4文書(PROPOSED、Phase 1ゲート対象)f817dc2
- codex後続: WP-4011(スクリプト回帰ハーネス)→ WP-4013(重複レジストリスキャン拡充)を発行済み

## 2026-07-09

### 16:00〜16:35 — 第4〜5波: Phase 0 文書完成・算定骨格・codex自律スキャン・ゲート報告

- SSOT完成: WP-0008(UI/UX 7)4aa6595 / WP-0009(セキュリティ 7)bcdf89f / WP-0010(運用 14)ff145ae / WP-0011(プロセス・品質 11)008baec / WP-0012(共通モジュール 14)a257598 / WP-0013(ssot_index 97文書+品質3補完+ゲート報告)79edf9a
- WP-2101a 完了: @yrese/calculation 骨格(空ruleset→BLOCKED、複数CALCULATED→SSOT_UPDATE_REQUIRED ガードをレビュー往復で追加)d26424d
- WP-0015 完了: 一次資料精読(記録条件仕様R8.6 レコード体系一式+点数表約45項目、人間ダブルチェック待ち)0ef7ab3
- codex 自律スキャン運用開始(ユーザーがcodex側へ直接指示): バックログ5+2+1件提案 → WP-1008(dead-letter不変条件)/WP-4005(CI全build)/WP-4004(lint整合)5729ea7、WP-1010(**権限スコープ検証の実バグ修正**)/WP-4006(dist衛生)e51f920、WP-2006(認可回帰テスト)/WP-1009(エラーコードシード)b5e4f22 — すべてレビュー承認済み
- kernel.test.ts のリテラル制御文字混入(codex発見・WP-1011)を修正
- **Phase 0 ゲート報告を提出(docs/plan/phase0_gate_report.md)— 人間レビュー待ち。新規 WP_ASSIGN は一時停止、codex はバックログ提案のみ継続**
- 現時点: コミット40件超、テスト66+件全パス、CI グリーン、二系統WPフロー13件完走(CHANGES_REQUESTED 2件はいずれも安全側修正)

### 15:40〜15:55 — 実装第3波: 契約基盤・境界検査・SSOT量産・公式資料確定

- WP-1007 完了: @yrese/contracts(contract-first の器。health スキーマ移設、zod v4 z.iso.datetime)codex実装・claudeレビュー、7fa369c
- WP-3004 完了: 業務ルーティングシェル(業務順ナビ+8ルート、各プレースホルダーに解除条件明記)2b195b5
- WP-0005 完了: 規制・法令SSOT 6文書 c1fbad8 / WP-0006 完了: 医療安全・スコープSSOT 7文書 ae24ae6 / WP-0007 完了: 外部境界・マスターSSOT 6文書 50f988e
- WP-4003 完了: check-boundaries(依存方向・循環・重複const検査をCIへ。違反注入検出を実証)codex実装・claudeレビュー、0213ac0
- **WP-0014 完了(重要)**: 公式資料検証 — 全10項目 CONFIRMED。令和8年度改定実在(施行R8.6.1)、記録条件仕様(調剤)R8.6版が公開中、安全管理GL第7.0版・JAHIS Ver.1.11 実在(v0.1.7 の記載が正確、f2の旧情報を訂正)。オン資外部IF・電子処方箋記録条件は ONS 限定 → WP-0016(人間作業)f166bee
- WP-2002: codex実装 → claudeレビューで CHANGES_REQUESTED(本番起動拒否のバイパスオプション allowDevTenantContextInProduction の除去を要求 — セキュリティ規律)
- 進行中フォーク: f6=WP-0015(記録条件仕様・点数表の一次精読)、f7=WP-0008(UI/UX SSOT)、f8=WP-0009(セキュリティSSOT)

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
