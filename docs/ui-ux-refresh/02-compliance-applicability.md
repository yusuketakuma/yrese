# 02 — Compliance Applicability & Traceability Matrix (Phase 1)

## 検証状況について(正直な明示 — 必読)

本書のガイドライン情報は Phase 1 の自動調査(WebSearch/WebFetch)で収集した。
**自動の敵対的検証(verify)段の一部が、本リポジトリ `CLAUDE.md` の「Claude レーン INACTIVE」指示を読んで停止し**、
一部項目を独立検証できずに `UNVERIFIED` とした(特に厚労省GL第7.0版の verify 担当)。
一方、別カテゴリの検証担当は同 第7.0版(令和8年6月29日策定)を裏付けている。
したがって各項目に **確認度(Confidence)** を付す:
- `VERIFIED` = 公式ドメインで版・日付を裏付け済み / `PARTIAL` = 版・日付は裏付くが逐条本文は未確認 /
  `NEEDS-CHECK` = research 段の候補で独立検証が未完(人間/Codex による一次資料確認要)。

**2026-07-11 追記(メインレーン再検証)**: subagent がロックで停止した最優先項目 **G1(厚労省GL第7.0版)を、
メインレーン(ロック解除済み)が公式ページ(mhlw.go.jp)で直接 WebFetch 検証し VERIFIED へ格上げ**した
(第7.0版=確定版、概説/経営管理/システム運用編=令和8年6月・企画管理編=令和8年5月・保守委託機関編=新設、
根拠法にサイバーセキュリティ対策基本法追加)。残る G7 の逐条本文等は依然 PARTIAL(逐条確認は運用実装時)。

**「完全準拠」は断定しない**(§3.3)。本書は適用性・要求・実装・証跡の追跡可能性を管理する。

## 1. ガイドライン一覧(発行主体・版・確認度)

| # | 正式名称 | 発行主体 | 版 | 公表/改定 | 確認度 | 出典(公式) |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | 医療情報システムの安全管理に関するガイドライン | 厚労省 | **第7.0版(確定版)** | 概説/経営管理/システム運用編=令和8年6月、企画管理編=令和8年5月、保守委託機関編=新設。第6.0版(令和5年5月)を全面改定、根拠法にサイバーセキュリティ対策基本法追加 | **VERIFIED(2026-07-11、メインレーンが公式ページで直接確認。確定版・案でない)** | mhlw.go.jp/stf/shingi/0000516275_00006.html |
| G1' | 同 第6.0版(概説編/経営管理編/企画管理編/システム運用編) | 厚労省 | 第6.0版 | 令和5年(2023)5月 | VERIFIED(PDFメタデータ+複数解説) | mhlw.go.jp/content/…001102575.pdf |
| G2 | 医療情報を取り扱う情報システム・サービスの提供事業者における安全管理ガイドライン | 総務省・経産省 共管 | 第2.0版 | 初版 令和2年8月 / 第2.0版 令和7年(2025)3月28日 | VERIFIED(経産省公式PDF表紙で裏付け) | meti.go.jp / soumu.go.jp |
| G3 | 医療機関・薬局におけるサイバーセキュリティ対策チェックリスト(マニュアル) | 厚労省 医政局 | 令和8年度版(薬局明記) | 公表日は**公式ランディングに未掲載**(2026-07-11 メインレーン確認。一次資料自体が明示せず) | VERIFIED(存在・表題・薬局明記=PDF見出し。公表日は原典未掲載のため未確定) | mhlw.go.jp/content/…001716186.pdf |
| G3' | 令和7年度版 医療機関におけるサイバーセキュリティ対策チェックリスト/マニュアル | 厚労省 医政局 | 令和7年度版(表題は「医療機関」) | 令和8年5月22日(意見交換会資料配布時点で存在) | VERIFIED(2026-07-11 メインレーンが公式ページで確認。関連注意喚起: VPN=令和8年3月、AI悪用=令和8年5月18/27日) | mhlw.go.jp …/cyber-security.html |
| G4 | JAHIS 患者安全に関するリスクマネジメントガイド〈解説編〉 | JAHIS | Ver.2.0(技術文書20-102) | 2020-07(初版2010-09) | PARTIAL(版・日付裏付け、逐条本文未確認) | jahis.jp |
| G4' | JAHIS 患者安全ガイド〈内服外用編〉 | JAHIS | Ver.1.0(14-102) | 2014-11 | PARTIAL(調剤に最も直接的) | jahis.jp |
| G5 | WCAG(Web Content Accessibility Guidelines) | W3C/WAI | 2.2 | 2023-10-05 初版勧告 / 2024-12-12 改訂。ISO/IEC 40500:2025 | VERIFIED | w3.org/TR/WCAG22/ |
| G5' | JIS X 8341-3(ウェブコンテンツ) | JIS/JSA(解説WAIC) | 2016(=WCAG2.0 一致規格) | 2016 | VERIFIED(版)/日付PARTIAL | waic.jp |
| G6 | e-文書法 + 電子保存の三基準(真正性・見読性・保存性) | — / 厚労省GLで具体化 | — | G1 概説編で具体化 | PARTIAL | mhlw.go.jp(G1経由) |
| G7 | オンライン資格確認/電子処方箋/レセプト電算(調剤)ベンダ向け技術解説書・運用ガイドライン | 厚労省/支払基金/デジタル庁 等 | 各最新 | — | PARTIAL(存在確認、逐条未) | 各公式 |
| G8 | プログラムの医療機器該当性に関するガイドライン(SaMD) | 厚労省 | 令和3年3月31日発出/令和5年3月31日一部改正 | 事例DB 令和7年7月3日更新 | VERIFIED(非該当典型例をPDF本文で確認) | mhlw.go.jp / pmda.go.jp |
| G9 | 個人情報保護法 | 個人情報保護委員会 | 3年ごと見直し進行中 | — | PARTIAL | ppc.go.jp |

## 2. Compliance Traceability Matrix(UI/UX・患者安全に効く要求 → 本システム)

Applicability: Mandatory / Applicable / Conditionally / N-A / Requires-{legal,clinical,security}-review。

| Source | Section/要求 | Applicability | 根拠 | 患者安全/セキュリティリスク | UX implication | SSOT rule | Component/pattern | 実装 | Test | Residual | Review |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G1/G1' | 識別・認証(将来 二要素) | Applicable(令和9年度〜実質必須) | 薬局は医療機関等 | なりすまし・不正アクセス | ログイン UX に MFA 前提を織込む | 認証 SSOT / SessionStatus | SessionExpiryWarning / LoginForm(骨格) | ◐ UI/状態実装(H-10 事前警告・下書き保全)。**実接続・MFA・セキュリティレビュー 残** | auth-session tests | 高 | security |
| G1/G1' | 職種別アクセス制御(最小権限) | Mandatory | RBAC 要求 | 権限外操作 | 権限状態を UI でも明示 | permissions.ts / P-14 | requirePermission(API)+403 UI | ◐ API deny-by-default | patient/reception tests | 中 | security |
| G1/G1' | 監査ログ(who/when/what)+定期確認 | Mandatory | 改ざん検知 | 証跡欠落 | 監査ビュー(SCR-028) | audit-log:read | ✗ 未実装 | — | 高 | security+clinical |
| G1/G6 | 電子保存 3基準(真正性・見読性・保存性) | Mandatory | 調剤録は法定記録準拠 | 記録の信頼性 | 確定/下書き/訂正履歴/確定者・日時の状態表示 | UIX-001 P-06,P-07,P-12 / RecordLifecycle | RecordStateBadge / VersionHistoryIndicator / AuditMetadata | ◐ 表示層実装(確定前後の識別・訂正履歴・確定者/日時/版)。**実記録データ配線・医療安全レビュー 残** | record/audit tests | 高 | clinical+legal |
| G1 | 非常時の見読性(障害/災害) | Applicable | Edge/オフライン | 情報アクセス不能 | LOCAL_ONLY で可読・復旧手順明示 | UIX-001 P-19 / workflow_map §2 | ModeCapabilityView / EmergencyModeBanner | ◐ 可否+理由+復旧手順表示(EmergencyModeBanner 実装) | mode-capability / sync-indicator tests | 中 | clinical |
| G2 | 責任分界・SLA・リスクコミュニケーション | Applicable(提供事業者) | Cloud+Edge 提供 | 障害通知漏れ | 障害/メンテ/インシデント通知 UI | SystemHealthBanner(設計) | SystemModeBadge(部分) | ◐ mode 固定 | — | 中 | security |
| G2/G1 | 同期時の完全性・重複排除・競合 | Applicable | LOCAL_ONLY→同期 | データ損失/二重 | 同期状態・競合を明示、自動補正禁止 | SyncStatus / status CONFLICT / P-02 | SyncIndicator / OfflineBanner / idempotency | ◐ 冪等キー + 同期/競合の表示層実装(QUEUEDをSYNCEDと別表現 H-03、競合は alert)。**永続層・競合解決の実配線 残** | reception / sync-indicator tests | 中 | clinical |
| G3/G3' | ロール別責務・BCP・バックアップ・インシデント連絡 | Applicable(薬局義務) | 薬機法施行規則(令和5年4月施行) | 事業継続 | 管理者向けセキュリティ/点検状態 | 管理画面(SCR-029) | ✗ 未実装 | — | 中 | security |
| G4/G4' | JIS T 14971 リスク管理 + IEC 62366-1 使用エラー低減 + 用量/重複/相互作用/剤形取り違え防止 | Applicable(自主的) | 患者安全直結 | 誤調剤 | use-error 設計、アラート重大度制御、剤形/単位取り違え防止 | UIX-001 P-08,P-10 / §07 risk register / ClinicalAlertType | ClinicalAlert / ClinicalAlertSummary / PrescriptionChangeIndicator | ◐ 表示層実装(種別別デザイン・CRITICAL温存・増減の色非依存・警告過多防止・最重大の未確認強調)。**判定ロジック・医薬品データ・医療安全レビュー 残** | clinical-alert / prescription tests | 高 | clinical |
| G5/G5' | WCAG2.2 AA(コントラスト/キーボード/フォーカス/ターゲット24px/Status Messages/認証負荷軽減) | Applicable(実務目標) | 業務UI長時間利用 | 誤操作・判読不能 | 色非依存・focus可視・aria-live・target size | UIX-001 P-20 / §08 §11.4 | Visual Status Registry / globals.css | ◐ 一部(focus/label) | 99 RTL | 中 | a11y |
| G7 | オン資/電子処方箋/レセプト(調剤)運用要求 | Conditionally(連携実装時) | 外部連携 | 資格/請求誤り | PENDING_* 状態の可視化・請求 fail-closed | status.ts / isClaimable / P-02,P-04 | PatientHeader/ModeCapability | ◐ 状態表示部品 | tests | 中 | clinical+legal |
| G8 | SaMD 該当性(機能単位評価) | **中核=N-A / 臨床支援追加時=Requires-clinical+legal-review** | 非該当典型例(院内業務支援) | 未評価での臨床機能実装 | clinical alert の**判定エンジン接続前**に該当性確定 | §01 §3 / R-SAMD | ClinicalAlert(表示層) | ◐ 表示骨格のみ実装(判定ロジック非搭載)。**該当性評価は判定エンジン接続の前提として残**(表示のみでは判断支援を提供しない設計) | — | 高 | legal+clinical |
| G9 | 個人情報 適正管理・PHI 非出力 | Mandatory | PHI 取扱 | 情報漏えい | PHI をログ/計測/画面エラーに出さない | 各コンポーネント規律 | error.tsx/error-notice/patient-header | ● 実装+規律 | tests | 低 | security |

## 3. 結論

- 本 MVP は **G1/G2/G3(薬局サイバーセキュリティ)・G4(患者安全)・G5(WCAG)・G8(SaMD)** が中核適用。
- 実装済みで整合が高いのは **PHI 非出力・fail-closed 請求・権限 deny-by-default・状態の色非依存表示**。
- **2026-07-11 第2次実装**: 認証UI・記録ライフサイクル・臨床アラート/処方差分・同期/オフライン・非常時・監査/権限/閲覧専用の
  **表示層を実装**(§10 で test/typecheck/build 実測緑)。ただし **Residual は「高→中」に下がっただけで解消ではない**:
  認証実接続・監査ログ実データ・臨床アラートの判定ロジックと医療安全レビュー・SaMD 該当性評価は**依然必要**(§11)。
- 版・日付の一部(特に G1 第7.0版の逐条、G3 公表日、G7 逐条)は **NEEDS-CHECK**。人間による一次資料確認を推奨。
