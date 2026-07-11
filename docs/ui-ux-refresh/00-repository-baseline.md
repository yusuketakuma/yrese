# 00 — Repository and Runtime Baseline (Phase 0)

読み取り専用調査の結果。すべて実測・実ファイル根拠。**想定スタックと実体の差分を最優先で記録する。**

確認日: 2026-07-11 / ブランチ: `main`(origin/main と同期、未コミット変更なし=クリーン)

## 1. 実際の技術スタック(想定との差分)

| 項目 | プロンプト想定 | 実体(実測) | 差分 |
| --- | --- | --- | --- |
| モノレポ | — | pnpm workspace(`apps/*`, `packages/*`)、pnpm@10.33.2、Node >=24 | — |
| フレームワーク | Next.js 16 App Router | **Next.js `^15.3.0`** App Router | ⚠️ 15 系 |
| React | React 19 + React Compiler | React `^19.0.0` / **React Compiler 依存なし** | ⚠️ Compiler 無し |
| 言語 | TypeScript 6 | TypeScript `^5.7.3` | ⚠️ 5 系 |
| フォーム | React Hook Form + Zod | **いずれも web 依存に無し** | ⚠️ 未導入 |
| サーバ状態 | TanStack Query | **無し**(独自 `api-transport.ts`) | ⚠️ 未導入 |
| テーブル | TanStack Table | **無し**(素の `<table>`) | ⚠️ 未導入 |
| クライアント状態 | Zustand | **無し** | ⚠️ 未導入 |
| ORM/DB | Prisma 7 / PostgreSQL | **Prisma 無し**。`apps/api` は生 `pg` プール + 自作 migration runner + PostgreSQL | ⚠️ Prisma 不使用 |
| 認証 | NextAuth + Cognito | **web 依存に NextAuth 無し**。認証実装は未着手(placeholder 段階) | ⚠️ 未実装 |
| SW/オフライン | Serwist service worker | **無し**。オフラインは "system-mode" ドメインモデルで表現(後述) | ⚠️ SW 未導入 |
| ファイル | S3 | web 側に実装無し | 未実装 |
| メール | SES | web 側に実装無し | 未実装 |
| レート制限 | DynamoDB | `apps/api/src/dynamodb/audit-persistence-key-codec.ts` に痕跡。web UI 表現は未 | 部分 |
| テスト | Vitest + Testing Library + Playwright | Vitest `^3` + Testing Library(web で使用中)。**Playwright は未導入** | ⚠️ E2E 無し |
| スタイル | Tailwind/shadcn/MUI 等 | **CSS フレームワーク無し**。単一 `globals.css` + CSS custom properties | 素の CSS |
| build | standalone output | `next.config.ts` に `output: "standalone"` **未設定** | ⚠️ 未設定 |
| デプロイ | ECS / Lightsail | `ops/`, `compose.yaml` あり(詳細未精査) | 資産あり |

**結論**: 本リポジトリは想定の重厚フロントスタックを**意図的に採用していない**早期段階の実装である。
web は依存ライト(next/react のみ + 自作共通モジュール)。この設計判断を尊重し、
本タスクで Zustand/RHF/TanStack/Prisma/NextAuth を**新規導入しない**(プロンプト §3.3 禁止事項とも一致)。

## 2. UI アーキテクチャ

- **App Router**。全画面共通シェル `apps/web/app/layout.tsx` が `<html lang="ja">` 内に
  `app-header`(タイトル + `SystemModeBadge` 常時表示)+ `BusinessNav` + `<main>` を固定。
- ルート(`apps/web/app/nav.tsx` の `NAV_ITEMS` が正):
  `/`(受付) `/patients`(患者) `/prescriptions`(処方入力) `/checkout`(会計)
  `/claim-check`(請求前点検) `/monthly-closing`(月次締め) `/masters`(マスター)
  `/sync-status`(同期状態) `/admin`(管理) — 計 **9 業務ルート** + `error.tsx`(route error)。
- App Router 特殊ファイルの現状: `layout.tsx` ✅ / `error.tsx` ✅ / `page.tsx`(各ルート)✅ /
  `loading.tsx` **無し** / `not-found.tsx` **無し** / `global-error.tsx` **無し** / `template`/route groups/parallel/intercepting **無し**。
- 既存共通コンポーネント(`apps/web/app/components/` ほか):
  `StatusBadge`(tone + **必須ラベル**), `PatientHeader`(`ELIGIBILITY_LABELS` SSOT 内包),
  `SystemModeBadge`(`MODE_LABELS` SSOT), `error-notice`, `severity-list`, `blocker-banner`,
  `empty-state`, `loading-state`, `calculation-trace-view`, `mode-capability-view`, `error-code.ts`。
- 多くのコンポーネントにユニットテストが並置(下記 §8)。

## 3. データ取得方式

- **TanStack Query は無し**。`apps/web/app/api-transport.ts` が独自トランスポート(テスト 36 件あり)。
- 開発時のみ `next.config.ts` の rewrites で `/_yrese-api/*` → `http://127.0.0.1:3001/*`(ローカル API)。
- API 契約は `packages/contracts`(patient-search, reception-queue, calculation-trace, error, health, whoami, openapi)。
- 多くの画面データ取得は「API Contract SSOT 承認後に接続」という **placeholder 状態**(コメントに明示)。

## 4. 状態管理方式(重要 — 既存ドメイン状態モデル)

`packages/shared-kernel/src/` に **状態の正本** が既に存在する。UI の視覚的状態言語はこれへ写像する:

- `system-mode.ts`: `SYSTEM_MODES = NORMAL | EXTERNAL_DEGRADED | CLOUD_DEGRADED | LOCAL_ONLY | RECOVERY_SYNC`。
  能力関数 `canConfirmExternal` / `allowsFinalCalculation` / `allowsClaimFinalization`。
  → オフライン/縮退/復旧同期は「Serwist」ではなく**この system-mode で表現**されている。
- `status.ts`: `PROVISIONAL_STATUSES`(LOCAL_ONLY 生成物への必須付与)、`ELIGIBILITY_STATUSES`、
  `RECEPTION_STATUSES`、`CONFLICT_REQUIRES_HUMAN_REVIEW`(自動補正禁止)、`UNSUPPORTED_CLAIM_STATUSES`、
  **fail-closed** な `CLAIMABLE_SAFE_STATUSES`(空=既定は請求不可)+ `isClaimable()`。
- `blockers.ts`: 30+ の `BLOCKER_TYPES`(規制/法務/医療安全/セキュリティ/移行/共通モジュール等)。
- `permissions.ts`: `PermissionScope = ` `${resource}:${action}` の literal 型、`ROLE_NAMES = pharmacist|clerk|admin|support`。

クライアント一時 UI 状態のストア(Zustand 等)は無し。URL/searchParams の体系的利用も現状ほぼ無し(要精査)。

## 5. 認証・オフライン・ファイル方式

- 認証: 未実装。`SystemModeBadge` は「モード検知バックエンド未実装のため NORMAL 固定」と明示。
- オフライン: ネットワーク層の SW ではなく、**業務モデル上の LOCAL_ONLY / RECOVERY_SYNC モード**として設計。
  `workflow_map.md` に「LOCAL_ONLY 分岐(仮受付導線)」「RECOVERY_SYNC 分岐(再検証導線)」が既に規定済み。
- ファイル/メール/レート制限の UI: web 側未実装。

## 6. スタイリング方式

- 単一 `apps/web/app/globals.css`。`:root` に CSS custom properties(=デザイントークン):
  色(`--color-bg/fg/border/surface/accent/danger-border`、状態色 `--color-status-{ok,pending,blocked,neutral}-bg`)、
  タイポ(`--font-size-{sm,base,lg}`)、余白(`--space-1..4`)、`--focus-ring`。
- 原則がコメントに明記:「装飾・アニメーションより視認性・状態明示を優先」「状態バッジは必ずテキストラベルを伴う」
  「`:focus-visible` を常に明示」。フォントは日本語優先(Hiragino / BIZ UDGothic / Meiryo)。
- **既にトークン基盤は存在**するが、意味的命名は色トーン中心で、臨床重要度/記録ライフサイクル/同期軸への
  意味的トークン(color.feedback.highRisk 等)は未整備 → Phase 6/7 の拡張余地。

## 7. デプロイ制約

- `output: "standalone"` 未設定。standalone 化は本タスクのスコープでは**設定変更を要する**ため、
  勝手に有効化せず Phase 7 で検討事項として扱う(build 検証は現行設定で行う)。
- ルート scripts に境界チェック群(`check:boundaries`, `check:calculation-purity`, `check:deps`,
  `check:openapi`, `check:sbom`, `check:secrets`, `check:ssot-index`)= モジュール境界/SSOT 整合の CI ゲート。
- CI: `.github/workflows/ci.yml`(1 本)。

## 8. 現在のテスト・build 基準(実測)

- **web ユニットテスト: 9 files / 99 tests 全 pass**(`pnpm --filter @yrese/web test`, vitest 3.2.7, 738ms)。
  対象: next-config, api-transport(36), calculation-trace-view(10), state-components(4), error-notice(5),
  mode-capability-view(7), patient-search(12), shell-smoke(10), reception-dashboard(11)。
- ルート scripts: `typecheck`(`tsc --noEmit` 各パッケージ), `test`(`pnpm -r test`), `lint`(`--if-present`),
  `build`(`pnpm -r build`)。**この時点で typecheck/lint/build のフル実行は未計測**(Phase 9 で実測記録)。

## 9. 既存 SSOT 候補(Phase 3 で正式分類)

- Normative(人間向け): `docs/uiux/*.md`(7 本)、`docs/agents/*`、`docs/plan/phase0_plan.md`、
  `docs/domain/*`、`docs/safety/*`、`docs/regulatory/*`、`docs/security/*`。
- Executable(コード): `packages/shared-kernel`(status/system-mode/blockers/permissions)、
  `packages/contracts`、`apps/web` 共通コンポーネント + `globals.css` トークン、並置テスト。
- De facto: `StatusBadge` / `PatientHeader` / `SystemModeBadge` の tone×label パターン、severity-list の重要度表現。

## 10. 外部研究・ブラウザ検証の可否

- WebSearch/WebFetch 利用可(Phase 1 ガイドライン確認・Phase 2 ベンチマークに使用)。
- ブラウザ(claude-in-chrome)利用可だが、**PHI/実患者情報は一切使用しない**。ローカル起動での目視確認は
  API 未接続の placeholder 画面が多く、限定的。E2E(Playwright)は未導入のため導入是非は Phase 9 で判断。

## 11. 既存の未コミット変更

- `git status`: クリーン(未コミット変更なし)。他セッション(Codex)が過去に触れた履歴あり
  (`CLAUDE.md`, `Plans.md`, `docs/plan/phase0_plan.md`, `docs/agents/*`)。**破棄・上書きしない。**

## Phase 0 判断・仮定・未解決

- 仮定: web が依存ライトなのは意図的設計 → 新規 UI ライブラリを導入しない(Evidence: package.json / globals.css)。
- 仮定: オフライン/同期は system-mode ドメインモデルが正 → 視覚的状態言語はこれへ写像(Evidence: system-mode.ts / workflow_map.md)。
- 未解決: standalone 化・認証(Cognito)・E2E 導入は現状スコープ外の意思決定を要する → 破壊的変更せず提案に留める。
