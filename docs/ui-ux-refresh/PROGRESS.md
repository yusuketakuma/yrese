# PROGRESS — UI/UX Refresh 進捗・証跡台帳

更新: 2026-07-11 / ブランチ: main / 未コミット変更: 本タスクの追加・変更(commit は codex 側で実施予定)

## Phase 進捗

| Phase | Task | Status | Evidence | Files |
| --- | --- | --- | --- | --- |
| 0 | リポジトリ&ランタイム・ベースライン | ✅ Done | web test 9f/99t、package.json/next.config/globals.css/shared-kernel 精読 | `00-repository-baseline.md` |
| 1 | スコープ・利用者・医療文脈 | ✅ Done | code/docs/DB からの確定 + Assumption/Review 分離 | `01-scope-and-users.md` |
| 1 | コンプラ適用性・トレーサビリティ | ✅ Done(確認度付き) | 一次資料調査 + 検証状況明記(一部 NEEDS-CHECK) | `02-compliance-applicability.md` |
| 2 | 競合ベンチマーク | ✅ Done(4/5 カテゴリ) | 公開情報のみ・抽象原則抽出。1カテゴリはロックで未実施 | `03-external-benchmark.md` |
| 3 | 画面・状態棚卸し / SSOT discovery | ✅ Done | 実コード精読・状態マトリクス・ジャーニー実在性 | `04-screen-and-state-inventory.md` |
| 4 | 状態所有権 | ✅ Done | 実スタック接地(TanStack/Zustand 無し) | `05-state-ownership.md` |
| 5 | UI/UX 監査 + リスク登録簿 | ✅ Done | 実ファイル根拠の所見 A/L/S + H-01..12 | `06-ui-ux-audit.md`, `07-use-error-risk-register.md` |
| 6 | 目標方針・視覚的状態言語 | ✅ Done | 既存 enum へ写像した Visual Status Matrix | `08-target-design-direction.md` |
| 7 | SSOT 再構築 | ✅ Done | Registry(executable)+ UIX-001 §4 追記(normative) | `visual-status-registry.ts` / `medical_ui_ux_principles.md` |
| 8 | 実装 | ✅ Done(共通層 vertical slice) | Registry/DomainStatusBadge/4マップ集約/ModeCapability/a11y CSS | `apps/web/**`(§09) |
| 9 | 検証 | ✅ Done | test 107 pass / typecheck 0 / boundaries / deps / build 成功 | `10-verification-evidence.md` |
| — | 残存リスク | ✅ 記載(継続) | R-AUTH/AUDIT/RECLIFE/CLINALERT/SAMD/PATCTX/OFFLINE 他 | `11-remaining-risks.md` |

## 検証サマリ(実測)

- Web Unit/Component: **99 → 120(第1次)→ 171(第2次)tests(全 pass、回帰0)**。shared-kernel **23 → 36**。
- Typecheck: **0**(repo `-r --parallel`)。Boundaries/Deps/SSOT-index(173): **pass**。Build: **成功(12/12 static)**。
- E2E(Playwright)/ 薬剤師シナリオテスト: **Not executed**(未導入/未招集)。相互作用(fireEvent)は @testing-library/react 未導入のため
  純粋関数(computeSessionStatus/highestUnacknowledgedSeverity 等)+ renderToStaticMarkup で検証。

## 追加実装(2026-07-11、非ブロッキング・接地・全 green)

- Registry 実画面ロールアウト: 受付キュー状態セル → DomainStatusBadge。
- 横断状態: loading / not-found / global-error(PHI非出力)。
- a11y: 資格確認にも冗長 shape、forced-colors / reduced-motion CSS。
- L-02: テーブル横スクロール(`.table-scroll`)。
- S-02: 受付一覧の最終取得時刻(鮮度)。
- S-03: 受付日付の URL 状態化(**非PHIのみ**。検索クエリ=氏名は PHI のため URL 非永続)。

## 第2次実装(2026-07-11、人間承認「外部要因を無視して全て実装」により実装レーン拡大)

従来ブロックとしていた設計群を **UI/ドメイン/表示層として実装**(捏造・テスト偽装なし。実測は §10)。

- shared-kernel 追加 enum: `record-lifecycle`(11状態)・`clinical-alert`(種別6/ack4)・`sync-status`(7)・
  `prescription-change`(7)・`session`(4)+ 各 guard/helper。
- Visual Status Registry: 5軸追加(record-lifecycle/sync/prescription-change/session/clinical-ack)+ 臨床アラート種別 identity。
- コンポーネント11種: RecordStateBadge / PrescriptionChangeIndicator / ClinicalAlert+Summary /
  Sync/Offline/SystemHealth/EmergencyMode バナー / SessionExpiryWarning+LoginForm / Confirmation+DestructiveActionDialog /
  FileUploadStatus / Audit+VersionHistory+PermissionState+ReadOnly / PatientContextProvider+Bar(全画面横断固定)。
- 検証実測: **web 120→171、shared-kernel 23→36、全パッケージ pass・回帰0、typecheck 0、build 12/12、boundaries/deps/ssot pass**。

**実装しても本番投入可否とは別 —依然必要(実施済みと記載しない)**: 臨床アラート判定ロジック・医薬品データ精度・
**医療安全レビュー**・**SaMD 該当性評価**、認証の**実プロトコル接続+セキュリティレビュー**、各**実データ配線**、
**実薬剤師テスト(R-PHARMTEST は Not executed)**、G7 逐条・「法令完全準拠」非断定。詳細は §11。

## 画面台帳(サマリ; 詳細は 04)

実装済み本格2画面(受付 SCR-001 / 患者検索 SCR-002)+ 横断部品。残り7ルートは placeholder。
本タスクは状態表現の共通層(Visual Status Registry)を全横断部品へ適用。個別業務画面の本実装は §11 に申し送り。
