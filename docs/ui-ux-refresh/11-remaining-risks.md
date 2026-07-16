# 11 — Remaining Risks & Required Reviews

未解決・未実施を正直に列挙する。**実施していない専門家レビュー・ユーザテストを実施済みと記載しない。**

## 2026-07-11 追記 — 実装レーン拡大(人間承認により外部承認待ちを解除)

人間の明示指示「外部要因を無視して全て実装」により、従来 BLOCKED としていた設計群を **UI/ドメイン/表示層として実装**した
(shared-kernel に record-lifecycle / clinical-alert / sync-status / prescription-change / session の各 enum を追加、
Visual Status Registry に5軸を追加、対応コンポーネント11種と単体テストを実装)。検証実測: **web 171 tests / shared-kernel 36 tests /
リポジトリ全パッケージ緑・回帰ゼロ、typecheck 0、build 12/12、boundaries/deps/ssot-index パス**(§10)。

**ただし実装と「本番投入可否」は別である。以下は実装とは独立に依然必要であり、実施済みと記載しない**:
- 臨床アラート(相互作用/禁忌/用量)の**判定ロジック・医薬品データの正確性**と**医療安全レビュー**、機能単位の **SaMD 該当性評価**(R-SAMD)。
- 認証の**実プロトコル接続(OIDC/Cognito)とセキュリティレビュー**(実装は UI 状態と契約シームまで)。
- 記録ライフサイクル/同期/患者 get-by-id 等の**実データ接続(API 契約の実配線)**。
- **実薬剤師によるシナリオ妥当性確認(R-PHARMTEST)は依然 Not executed**。
- **「法令完全準拠」は引き続き断定しない**(§3.3 / 下記「断定しないこと」)。

| ID | Issue | Reason unresolved | User/患者安全影響 | Temporary mitigation | Recommended next action | Owner | Review | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-AUTH | 認証 UI(セッション失効事前警告・サインイン骨格・下書き保全文言) | ◐ **UI/状態実装済(2026-07-11)**: `SessionStatus` enum、`computeSessionStatus`(純粋)、`SessionExpiryWarning`(EXPIRING_SOON=延長導線 / EXPIRED=再認証・未保存保全 H-10)、`LoginForm`(認証情報を error に出さない)。test 7。**残**: 実プロトコル接続(OIDC/Cognito)+セキュリティレビュー+MFA 導線 | セッション切れで入力消失(H-10)、なりすまし | dev tenant header は development 限定 | 実認証基盤接続 → セキュリティレビュー → MFA | security | security | P1(実接続 残) |
| R-AUDIT | 監査ログ閲覧(SCR-028) | ✅ **実装済(2026-07-11)**: contracts(表示投影・ID のみ・PHI 氏名非含有)+ API `GET /audit/events`(audit-log:read、no-store、**全保存イベントの hash chain 検証**、閲覧自体を audit.viewed で監査、reception 作成が reception.created を発行)+ web 管理画面ビュー(**chain 破断を CRITICAL alert で明示** — 正常に見せない、who/when/what 表、空/エラー/権限状態)。test: api+7 / contracts+9 / web+5。**永続層 実装済(2026-07-11 第5次)**: `migrations/000004_create_audit_events.sql`(append-only trigger で UPDATE/DELETE 拒否=真正性)+ `PostgresAuditRepository`(advisory xact lock で chain 追記を直列化、読み出しで hydrateAuditEvent 再検証、破損行は隠さず chain 破断として報告)+ main.ts postgres モード配線。**統合テスト4件は作成済みだが本環境に Postgres/Docker が無く Not executed**(既存 postgres 統合テストと同じ skip 条件)。**残**: 実DB環境での統合テスト実行・実認証 actor 接続・セキュリティレビュー | 証跡不足(G1 必須) | InMemory+Postgres 実装、改ざん検知表示 実装済 | 実DBで統合テスト実行 + セキュリティレビュー | admin | security+clinical | P2(実行環境待ち) |
| R-RECLIFE | 記録ライフサイクル(下書き/確定/訂正/版)UI | ✅ **実装済(2026-07-11)**: `RecordLifecycleStatus` enum(11状態)+ `isFinalizedRecord`/`isAtRiskOfLoss`、Registry 軸C、`RecordStateBadge`(確定/訂正のみ確定者・日時・版を Level3 併記、ローカル自動保存を確定と別トーン H-03/H-05)。test 4+shared-kernel。**残**: 記録編集の実業務導線・実データ接続 | 確認前を確定と誤認(H-05)、真正性(G1/G6) | RecordStateBadge 実装済 | 実記録データ配線 + 医療安全レビュー | clinical | clinical+legal | P1(実配線 残) |
| R-CLINALERT | 臨床アラート(相互作用/禁忌/重複/ハイリスク/用量)表示 | ◐ **表示層実装済(2026-07-11)**: `ClinicalAlertType`/`ClinicalAlertAckStatus` enum、Registry(種別 identity + ack 軸、severity 駆動のトーン/ARIA)、`ClinicalAlert`(種別別形状・CRITICAL は assertive・未確認を解決済みに見せない・override は理由記録前提)、`ClinicalAlertSummary`(最重大の未確認を先頭強調 H-08)。test 10。**残(実装とは別・必須)**: 判定ロジック・医薬品データの正確性・**医療安全レビュー**・**SaMD 該当性評価**(R-SAMD) | 重大警告見落とし(H-08) | 表示骨格・warning fatigue 方針・severity 温存は実装+文書化済 | 判定エンジン接続前に医療安全レビュー+SaMD 評価 | clinical | clinical | P1(判定/レビュー 残) |
| R-SAMD | 臨床判断支援機能追加時の SaMD 該当性 | 機能未実装 | 未評価での薬機法上の医療機器該当リスク | **中核=非該当を一次資料で実証(2026-07-11 メインレーン確認)**: 該当性GL(令和3年発出/令和5年改正)の非該当典型例(2)①健康記録閲覧・②受付/会計等院内業務支援にレセコン中核が該当。参照: PMDA「薬事開発・承認申請の手引き(令和7年4月更新)」、事例DB | clinical alert(相互作用/用量/処方監査)等の臨床判断支援を追加する WP の前提に、機能単位の SaMD 該当性評価(グレー時は厚労省/PMDA 該当性相談)を組込む | legal+clinical | legal+clinical | P1 |
| R-PATCTX | 患者文脈(PatientHeader)全画面横断固定+鮮度 | ✅ **完了(2026-07-11)**: 横断固定(`PatientContextProvider`/`PatientContextBar`、別患者選択で前文脈破棄 H-02)に加え、**get-by-id 契約 + 遷移時再取得を実装** — `GET /patients/:patientId`(API-001 拡張、PAT-0002、検索と同一射影、テナント越し 404)+ 画面遷移ごとに選択患者を再取得。404=選択解除+alert 通知(取り違え防止)、通信失敗=選択維持+「情報が古い可能性」明示(古い表示を最新に見せない)。test: api+4 / web+6 | 患者取り違え(H-01/H-02) | 横断固定+鮮度 実装済 | 実認証接続後に実データで再確認 | frontend | clinical | 済 |
| R-OFFLINE | オフライン/同期の表示層(同期状態/オフライン/稼働/非常時) | ◐ **表示層実装済(2026-07-11)**: `SyncStatus` enum + `isDurablySynced`/`requiresHumanAttention`、Registry 軸G、`SyncIndicator`(QUEUED を SYNCED と別表現 H-03)、`OfflineBanner`(外部確認不可を明示)、`SystemHealthBanner`(G2 通知)、`EmergencyModeBanner`(P-19 可否+復旧手順、alert)。test 9。**残**: 実オフライン永続層(ドラフト/同期キュー/競合解決の実配線・Serwist 等の採否) | ローカル保存をサーバ保存と誤認(H-03) | 表示層+ModeCapabilityView 実装済 | 永続層・同期キューの実装(採否判断含む) | frontend | clinical | P1(永続層 残) |
| R-URLSTATE | 業務日付が URL 非共有 | ✅ **解決(2026-07-16 follow-up)** | — | 受付日付だけを`?date=`へ反映/復元。患者検索クエリ(氏名=PHI)はURL非永続。WP-4163でhydration failure時もformをPOST `/patients`へ固定しnamed query controlを除去、native URL/body serializationをfail-closedで防止。focused44 / Web337 / independent privacy review PASS | frontend | privacy | 済(cursor・通常API GET request-targetは別scope) |
| R-RESPONSIVE | テーブルのモバイル/タブレット | ◐ **一部対応(2026-07-16)** | 現場端末で切れ | `.table-scroll`で患者識別を保持。患者検索の選択操作は右sticky化し、375/768/1280 browser確認済み | table全体の列優先/カード化と実端末確認は残 | frontend | a11y | P2 |
| R-STALE(S-02) | 一覧の鮮度不明 | ✅ **解決(2026-07-11)** | — | 受付一覧に最終取得時刻(JST)を表示。古い一覧の最新誤認を防ぐ(H-03隣接) | — | — | 済 |
| ~~R-CROSSSTATE~~ | ~~not-found/global-error/loading 特殊ファイル欠如~~ | ✅ **解決(2026-07-11)** | — | loading.tsx / not-found.tsx / global-error.tsx を追加(PHI非出力・次アクション明示)。web test 110 pass / build 12/12 | frontend | — | 済 |
| R-BENCH-GAP | 競合ベンチマークの1カテゴリ(統合型/クラウド型)未調査 | 調査 subagent が CLAUDE.md ロックで停止 | 研究網羅性 | 他4カテゴリで主要原則は抽出済 | 必要時に当該カテゴリのみ再調査 | — | — | P3 |
| R-COMPLIANCE-VERIFY | ガイドライン版・日付の一部が NEEDS-CHECK | verify subagent の一部がロックで停止 | 準拠主張の根拠精度 | §02 に確認度を明記、「完全準拠」は非断定 | ◐ **一部解決(2026-07-11)**: 最優先の G1(厚労省GL第7.0版)をメインレーンが公式ページで直接検証し VERIFIED 化。残る **G7 の逐条本文**は運用実装時に逐条確認 | codex/human | legal | P2(G7逐条 残) |
| R-PHARMTEST | 薬剤師シナリオ妥当性確認(§14.5)**Not executed** | 実参加者未招集 | リスク見積りが未検証 | 計画・受入基準は下記に定義 | 下記プロトコルで実施し H-01..12 の P/D を更新 | 薬剤師 | clinical | P1 |

## Pharmacist Scenario Validation Plan(Not executed — 計画のみ)

**状態: Not executed.** 実参加者テストは未実施。以下はプロトコルと受入基準の定義であり、実施結果ではない。

- 対象シナリオ(§14.5): 同姓同名の識別・切替 / 前回処方からの増減量・中止の発見 / 複数アラートからの critical 特定 /
  下書き薬歴の確定 / 代理入力の承認 / 確定後修正 / オフライン入力 / 復帰後同期 / 同期競合解決 /
  セッション失効復帰 / 閲覧専用の理解 / 非常時機能 / アップロード失敗復帰。
- 測定: task completion / time-to-recognize-state / missed-critical / misinterpreted-state / unintended-action /
  recovery-success / subjective-confidence / observed-hesitation / participant-comment。
- 受入基準(例): critical 状態の missed = 0、患者取り違え未遂 = 0、主要状態の誤認率 < 5%。
- PHI・実患者情報は使用せず、匿名化/テストデータのみ。
- **重大な誤認が生じた場合は説明文追加で済ませず、形状・配置・状態分類・操作フローを再設計する**(§14.5)。

## 断定しないこと

- 「法令完全準拠」「問題なし」「全画面完了」は**断定しない**。本タスクは監査・SSOT 再構築・共通層(Visual Status
  Registry)の実装と検証までを完了し、多数の業務画面・認証・オフライン・ファイル・臨床アラートは**未実装のまま**である。
