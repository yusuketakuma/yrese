# 04 — Screen and State Inventory (Phase 3)

既存の正本 `docs/uiux/screen_inventory_draft.md`(UIX-007, 29画面 SCR-001..029)と
`docs/uiux/workflow_map.md`(UIX-006)を**正本として参照**する。本書はそれを重複させず、
(a) App Router 実装との対応、(b) UIX-007 に無い**状態(state)軸マトリクス**、(c) ジャーニー実在性、を補う。

## 1. SSOT Discovery(現在のデザイン資産分類)

### Normative SSOT(人間向け規範・APPROVED)
- `docs/uiux/medical_ui_ux_principles.md`(UIX-001 v0.1.1): 優先順位、原則 P-01..P-20、禁止15項、警告重要度§5。
- `docs/uiux/workflow_map.md`(UIX-006): NORMAL / LOCAL_ONLY / RECOVERY_SYNC 導線、ロール別ホーム。
- `docs/uiux/screen_inventory_draft.md`(UIX-007): 29画面、U0-U4 安全度、権限 scope 仮割当。
- `docs/uiux/experience_quality_baseline.md` / `performance_budget.md` / `stability_slo_policy.md` /
  `usability_acceptance_criteria.md`: 体験品質・性能・安定性・受入基準。

### Executable SSOT(コードとしてUIを制約)
- `packages/shared-kernel/src/`: `system-mode.ts`(5モード+ガード関数)、`status.ts`(PROVISIONAL/ELIGIBILITY/
  RECEPTION/UNSUPPORTED_CLAIM/`isClaimable`)、`error-codes.ts`(ErrorSeverity/ErrorDomain/ErrorCodeRegistry)、
  `blockers.ts`、`permissions.ts`。
- `packages/contracts/src/`: patient-search / reception-queue / calculation-trace / error / health / whoami(zod)。
- `apps/web/app/`: 共通コンポーネント群 + `globals.css` のトークン。

### De facto SSOT(文書化されていないが事実上標準)
- **状態→表示ラベル写像が各所に散在**(統合対象):
  - `ELIGIBILITY_LABELS` … `components/patient-header.tsx`(patient-search が import 再利用)
  - `MODE_LABELS` … `system-mode-badge.tsx`(mode-capability-view が import 再利用)
  - `RECEPTION_STATUS_LABELS` … `reception-dashboard.tsx`
  - `SEVERITY_LABELS` + `SEVERITY_ORDER` … `components/severity-list.tsx`
- `StatusBadge`(tone×自由 label)= 汎用状態表現の事実上標準。ただし後述の構造的弱点あり。
- エラー運搬の事実上標準: `class *Error { message; nextAction; errorCode }` + `toNotice()`(reception/patient で重複実装)。

### 矛盾・負債の候補
- **重複**: `EligibilityDisplayStatus` の import 再利用は良いが、ラベル写像が「どの状態族も個別ファイル所有」で
  横断的な単一 Registry が無い。→ Phase 7 で集約。
- `globals.css` に「旧名称(既存参照互換)」トークン(`--color-mode-*`)が残存 = 命名の二層化(意味的命名へ寄せる余地)。
- UIX-007 の権限 scope に `【要確認】` 多数(permission_scope_registry 未確定)。

## 2. App Router 実装と特殊ファイルの現状

| App Router 機能 | 実在 | 備考 |
| --- | --- | --- |
| `layout.tsx`(root) | ✅ | shell: header(title+SystemModeBadge)+ BusinessNav + main |
| `page.tsx`(各ルート) | ✅ | 9ルート。実装2 / placeholder7 |
| `error.tsx` | ✅ | route error 境界(PHI 非出力、digest のみ) |
| `loading.tsx` | ✗ | **未実装**(全ルート)。Suspense/streaming の共通 loading 体験が無い |
| `not-found.tsx` | ✗ | **未実装**。404/存在しない患者等の共通導線が無い |
| `global-error.tsx` | ✗ | **未実装**。root layout レベルの致命エラー表示が無い |
| `template` / route groups / parallel / intercepting / modal routes | ✗ | 未使用 |
| middleware / instrumentation | ✗ | web に無し(認証境界は未実装 = BLOCKED_SECURITY_REVIEW) |

**Phase 5/8 候補ギャップ(P0-P2)**: `loading.tsx` / `not-found.tsx` / `global-error.tsx` の欠如は、
医療UI原則 P-01/P-19(状態を隠さない・例外時ほど状態明示)に照らし補うべき横断状態。

## 3. 画面×状態マトリクス(UIX-007 に無い state 軸)

凡例: ● 実装で表現済 / ◐ 部分/コンポーネントは存在するが画面未結線 / ○ 設計はあるが未実装 / — 非該当。

| SCR / Route | Loading | Empty | Error | 認証未 | 権限拒否 | Offline(LOCAL_ONLY) | 同期/競合 | 仮/確定 | 患者文脈 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SCR-001 `/`(受付) | ● LoadingState | ● EmptyState | ● ErrorNotice(403/400/HTTP) | ○(dev header 前提) | ● 403→next action | ◐ Badge表示のみ | — | — | ◐(受付は患者確定前) |
| SCR-002 `/patients` | ● 検索中 | ● 0件 | ● ErrorNotice | ○ | ● 403 | ◐ | — | — | ● 同姓同名/カナ/資格 |
| SCR-003 PatientHeader(横断) | — | — | — | — | — | ◐ eligibility=LOCAL_ONLY_UNVERIFIED | — | — | ● 常時固定表示部品 |
| SCR-004 `/prescriptions` | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | placeholder |
| SCR-012 calc-trace | ◐ viewer あり(fixture) | ◐ | ◐ | ○ | ○ | ○ | ○ | ○ 仮/確定 | ○ | live 未結線 |
| SCR-016 `/checkout` | ○ | ○ | ○ | ○ | ○ | ○ 仮精算 | ○ | ○ | ○ | placeholder |
| SCR-019 `/claim-check` | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | — | placeholder |
| SCR-020 `/monthly-closing` | ○ | ○ | ○ | ○ | ○ | ● NORMAL のみ許可(guard) | ○ | ○ | — | placeholder |
| SCR-023 `/masters` | ○ | ○ | ○ | ○ | ○ | ○ | ○ PENDING_MASTER_VALIDATION | ○ | — | placeholder |
| SCR-025/026 `/sync-status` | ◐ ModeCapabilityView | ○ | ◐ | ○ | ○ | ● 可否+理由+仮状態 | ◐ 件数未 | ◐ | — | ModeCapabilityView(mode 供給は未結線) |
| SCR-029 `/admin` | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | — | placeholder |

**横断的欠落状態(全画面共通で未整備)**: `Session expiring/expired`(認証未実装)、`Rate limited`(DynamoDB 由来だが UI 表現無し)、
`Optimistic update/rollback`(受付登録は楽観 UI ではなく同期 await)、`Stale data / last-updated`表示、
`Upload pending/uploading/failed`(ファイル機能未)、`Reduced motion / forced-colors`(CSS 未対応)、`Conflict`(RECOVERY_SYNC 画面未)。

## 4. ユーザージャーニー(実在性の判定)

| Journey(§8.4) | 実在状況 | 根拠 |
| --- | --- | --- |
| 患者検索→選択→対象確認 | ◐ 検索は実在。「選択→患者文脈確定(PatientHeader へ受け渡し)」の結線は未 | patient-search.tsx / patient-header.tsx |
| 一覧→検索→(フィルタ/ソート)→詳細 | ◐ 検索+cursor ページングは実在。フィルタ/ソート/詳細遷移は未 | patient-search.tsx(nextCursor) |
| 新規作成→入力→検証→保存→確定 | ◐ 受付登録(冪等・409)は実在。「確定」ライフサイクルは未 | reception-dashboard.tsx |
| 前回処方→今回処方 差分 | ○ 設計(workflow_map)あり・画面未実装 | UIX-006/007 SCR-004,010 |
| 下書き→レビュー→承認→確定 | ○ 設計あり・未実装 | SCR-014 |
| オフライン編集→ローカル保存→復帰→同期 | ◐ モデル(LOCAL_ONLY/RECOVERY_SYNC)と可否表示基盤あり・データ経路未 | system-mode.ts / mode-capability-view.tsx / UIX-006 |
| 同期競合→差分→解決 | ○ CONFLICT_REQUIRES_HUMAN_REVIEW 定義あり・SCR-027 画面未 | status.ts / UIX-006 §3 |
| サインイン→Cognito→callback→復帰 | ✗ **未実装**(認証は BLOCKED_SECURITY_REVIEW)。**捏造しない** | patient-search.tsx コメント |
| ファイル選択→検証→アップロード→完了 | ✗ 未実装。捏造しない | — |
| レート制限→待機→再試行 | ✗ UI 未実装 | — |

**結論**: 実在フローは「受付」「患者検索」の2本のみ本格実装。他は設計 SSOT はあるが placeholder。
本タスクの実装は**この2本 + 横断部品(状態表現・loading/not-found/global-error)**に集中し、
未実装業務フローは SSOT 拡張(設計)に留める(捏造実装をしない)。

## 5. 実画面のブラウザ確認方針

- API 未接続の placeholder が多く、dev 実起動には API(:3001)と dev tenant header が必要。
- 目視/スクリーンショットは Phase 9 で、**テストデータのみ**・PHI 不使用で限定実施(または unit/RTL で状態を再現)。
- 現状は RTL テスト(99件)が主要状態(loading/empty/error/同姓同名/モード可否)を既にカバー = 一次証跡として活用。
