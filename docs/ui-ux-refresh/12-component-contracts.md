# 12 — Component Contracts (Phase 7 §12.3)

各共通コンポーネントの契約(責務・props・状態・ARIA・禁止事項・テスト)。
**実装済み**は現行コードの契約、**設計(承認待ち)**はブロック項目の設計入力(実装はしていない=捏造しない。
対応するドメイン enum SSOT / API 契約 / 医療安全・セキュリティ・薬機法レビューの承認後に実装)。

正本参照: 視覚は `visual-status-registry.ts`(§08)、原則は UIX-001、状態は shared-kernel。

## A. 実装済みコンポーネントの契約

### DomainStatusBadge(実装済)
- Purpose: ドメイン状態キー(domain+key)から label/tone/shape/ARIA を Registry 経由で一元表示。
- Props: `query: StatusQuery`(discriminated union)。**自由 label/tone/severity は受けない**(A-01)。
- ARIA: severity=CRITICAL/BLOCKER→role=alert、他→role=status。shape は aria-hidden。
- Prohibited: hex 直指定、任意アイコン、PHI をログ/計測へ。
- Tests: visual-status-registry.test.tsx(網羅・直交・ARIA)。

### StatusBadge(実装済・レガシー互換)
- Purpose: 自由 label+tone の汎用バッジ。**新規はドメイン状態なら DomainStatusBadge を優先**。
- Prohibited: 色のみの状態表現(label 必須)。

### PatientHeader(実装済)
- Purpose: 患者取り違え防止。氏名・カナ・生年月日・年齢・性別・資格確認状態を固定表示(P-09)。
- Props: patientId(branded)/name/kana/birthDate/age/sex/eligibility/eligibilityCheckedAt?。age は呼び出し側責務(`computeAgeYears`, JST)。
- Prohibited: 必要以上の個人情報表示、PHI をログへ。

### PatientContextProvider / PatientContextBar(✅ 全画面横断固定 実装済・R-PATCTX)
- Purpose: 選択中患者を全業務画面で固定表示し取り違えを防ぐ(H-01/H-02)。
- 実装: `patient-context.tsx`。RootLayout 直下に Provider を配置(遷移で再マウントされないため状態維持)、
  `PatientContextBar`(未選択時は非表示)、`PatientContextBarView`(テスト可能な表示部)、`useOptionalPatientContext`。
  患者検索の選択を横断文脈へ委譲、別患者選択で前文脈破棄。
- Prohibited: PHI をログ/計測へ。**残**: 遷移先での再取得鮮度は将来 get-by-id API で強化(任意)。

### Visual Status Registry 追加軸(2026-07-11)
- record-lifecycle(C)/ sync(G)/ prescription-change / session / clinical-ack を追加。各軸 `Record<Enum,...>` で網羅性を型担保。
  clinical alert は「種別 identity(label+形状)」と「severity 駆動のトーン/ARIA」を直交合成。

### SystemModeBadge / ModeCapabilityView / SeverityList / ErrorNotice / BlockerBanner / Empty/LoadingState(実装済)
- 各々 §04/§06 に契約準拠を記載。ErrorNotice は role を重要度別に(A-05)。

## B. 実装済(2026-07-11 — 人間承認により実装レーン拡大)

**注記**: 以下は **UI/ドメイン/表示層を実装**したもの(shared-kernel enum + Registry 軸 + コンポーネント + 単体テスト)。
実装と「本番投入可否」は別で、**判定ロジック・実データ配線・医療安全/セキュリティ/薬機法(SaMD)レビュー・実薬剤師テストは
実装とは独立に依然必要**(§11 各行の「残」参照)。テスト実測は §10。

### RecordStateBadge(✅ 実装済・R-RECLIFE)
- Purpose: 記録ライフサイクル(unsaved/draft/auto-saved-locally/server-saved/pending-review/proxy-entered/
  approval-pending/approved/finalized/amended/superseded)の状態表示。
- 実装: `record-lifecycle.ts` enum(11状態)、Registry 軸C、`record-state-badge.tsx`。確定/訂正のみ確定者・日時・版を Level3 併記。
- 残(実装とは別): 記録編集の実業務導線・実データ配線・医療安全レビュー(R-RECLIFE 行の「残」)。

### ClinicalAlert / ClinicalAlertSummary(◐ 表示層実装済・R-CLINALERT / R-SAMD)
- Purpose: severity/alert type/対象患者/対象薬剤/検出理由/情報源/評価日時/推奨確認/blocking・override/監査。
- 実装: `clinical-alert.ts` enum(種別6・ack4)、Registry(種別 identity + ack 軸)、`clinical-alert.tsx`
  (`ClinicalAlert`/`ClinicalAlertSummary`/`highestUnacknowledgedSeverity`)。種別別形状、severity 駆動のトーン/ARIA、
  CRITICAL のみ assertive、未確認を解決済みに見せない、override は理由記録前提、集約で最重大の未確認を先頭強調。
- 残(実装とは別・必須): **判定ロジック・医薬品データの正確性・医療安全レビュー・機能単位の SaMD 該当性評価**。
  表示は実装したが、**判定エンジン接続前にレビューと該当性評価を行う**(未登録医療機器化を避ける)。

### PrescriptionChangeIndicator(✅ 実装済・軸B)
- Purpose: 前回/今回差分(unchanged/new/resumed/changed/increased/decreased/discontinued/dosage/strength/route)。
- 実装: `prescription-change.ts` enum、Registry 軸、`prescription-change-indicator.tsx`。増減は矢印(↑/↓)で色非依存、
  変更前→後を併記、臨床警告と別クラス/中立表示で視覚分離(§11.7)。
- 残: 処方データモデル・算定/処方エンジンとの実配線。

### SyncIndicator / OfflineBanner / SystemHealthBanner / EmergencyModeBanner(◐ 表示層実装済・R-OFFLINE)
- Purpose: online/unstable/offline/local-only/queued/syncing/synchronized/stale/retry/failed/conflict を明示。
  **ローカル保存済みにサーバ保存済みと同じ✓を使わない**(H-03)。conflict は自動補正禁止・人間承認。
- 実装: `sync-status.ts` enum、Registry 軸G、`sync-indicator.tsx`(4コンポーネント)。QUEUED/CONFLICT を SYNCED と別表現、
  失敗/競合は alert、EmergencyModeBanner は可否+復旧手順(P-19)。
- 残: 実オフライン永続層・同期キュー・競合解決の実配線(Serwist 等の採否含む)。

### ConfirmationDialog / DestructiveActionDialog(✅ 実装済)
- Purpose: 破壊的・確定・承認操作の二段階確認 + 対象患者・影響の再提示(P-11)。focus trap/復帰/Escape。
- 実装: `confirmation-dialog.tsx`。role=dialog / alertdialog、aria-modal、対象患者ラベル再提示、明示的な確定/取消ボタン
  (ワンクリック実行なし)、破壊的は severity トーン+影響明示。**残(client 相互作用)**: focus trap/Escape/フォーカス復帰は
  呼び出し側 client で装着(表示骨格は実装済)。

### FileUploadStatus(✅ 実装済・S3導線)
- Purpose: selected/validating/uploading/processing/completed/rejected/retryable-error/cancelled。
  **完了前に「保存済み」と誤認させない**。
- 実装: `file-upload-status.tsx`(UI/転送の関心事のためローカル型)。COMPLETED のみ durable=true、拒否/再試行可は alert。
- 残: 実 S3 導線・アップロード contract の実配線。

### AuditMetadata / VersionHistoryIndicator / PermissionState / ReadOnlyIndicator(✅ 実装済)
- Purpose: 監査情報(who/when/what)・版履歴・権限状態・閲覧専用理由の明示。
- 実装: `audit-metadata.tsx`。版>1 で訂正履歴を明示、権限は deny-by-default 可視化、閲覧専用は理由併記。
- 残: 監査ログ API(R-AUDIT)・権限 SSOT の実データ配線(本コンポーネントはその表示投影)。

## C. Governance

- **2026-07-11 更新**: 人間承認により B 群を表示層として実装。ただし各「残」の実データ配線・判定ロジック・
  医療安全/セキュリティ/薬機法(SaMD)レビュー・実薬剤師テストは**実装とは独立に依然必要**(§11)。
- 実装順: 本契約 → Registry 追加(必要なら)→ コンポーネント → テスト → §10 検証(実施済)。
- 本書は「設計入力+実装記録」であり、後続のレビューを代替・省略しない。
