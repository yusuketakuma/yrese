# common_module_boundary — 共通モジュール境界

```yaml
ssot_id: MOD-002
title: 共通モジュール境界
domain: modules
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.2
created_at: 2026-07-09
updated_at: 2026-07-11
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: null
effective_to: null
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W4 metadata-only completion: body/status/version/approval/effective semantics unchanged"
  - 0.1.2 (2026-07-09): WP-4049 実装状態 drift 整備。受付キュー契約・ReceptionId・RECEPTION_STATUSES・RCVエラー・reception scope・reception audit event と最新テスト状態を反映(要件・禁止事項は不変更)。
  - 0.1.1 (2026-07-09): WP-4043 実装状態 drift 整備。contracts と audit の実装済み状態、BLOCKER_TYPES 数、実装済み共通モジュール数を現行 packages/* 実態へ同期(要件・禁止事項は不変更)。
source_refs:
  - 構築プロンプト v0.2.0 §0.0.3.3, §0.0.3.4
depends_on:
  - docs/modules/common_module_inventory.md(MOD-001)
impacts:
  - packages/* shared-module boundaries
  - apps/api shared-module consumers
  - apps/web shared-module consumers
related_work_packages:
  - WP-0012
  - WP-4043
  - WP-4049
  - WP-9002-W4
related_tests:
  - pnpm check:boundaries
related_prs: []
evidence_ids: []
open_questions:
  - UI表示文言モジュールの管理場所(UI/UX SSOTとの整合方法 — packages/ui 新設時に確定)
blockers: []
```

## 1. 共通化すべき概念(v0.2.0 §0.0.3.3)と現在の所在

| 概念 | 所在(正本) | 状態 |
|---|---|---|
| branded ID types(tenant/pharmacy/patient/reception/prescription/dispensing/claim/event/device/user/evidence/work-package) | `@yrese/shared-kernel` branded-ids.ts | 実装済み(WP-3009-BE/93aefa1 で ReceptionId 追加) |
| system mode(NORMAL / EXTERNAL_DEGRADED / CLOUD_DEGRADED / LOCAL_ONLY / RECOVERY_SYNC) | `@yrese/shared-kernel` system-mode.ts | 実装済み |
| 保留系 status(PENDING_* 等6種)+ 請求可否判定 | `@yrese/shared-kernel` status.ts | 実装済み |
| BLOCKER 種別 | `@yrese/shared-kernel` blockers.ts | 実装済み(33種、WP-0052/6f7f91f) |
| 受付キュー状態(RECEPTION_STATUSES 4種) | `@yrese/shared-kernel` status.ts | 実装済み(WP-3009-BE/93aefa1、処方箋ライフサイクル状態とは分離) |
| error code / warning code 構造 | `@yrese/shared-kernel` error-codes.ts | 構造実装済み。AUTH-0003 / PAT-0001 / RCV-0001〜0003 を seed 登録済み(MOD-006) |
| permission scope / role name | `@yrese/shared-kernel` permissions.ts | 実装済み(resource 15種、`reception` 含む) |
| 金額・点数・Decimal helper / 丸め呼び出し境界 | `@yrese/money` | 実装済み(政策値は未配線) |
| 日付・時刻 helper / 請求月・処方日・調剤日・受付日 | `@yrese/date-time` | 実装済み |
| calculation_trace / legal_trace / evidence_id 型 | `@yrese/trace`(EvidenceId 型は shared-kernel) | 実装済み |
| sync event envelope / Outbox・Inbox envelope | `@yrese/events` | 実装済み |
| API DTO schema / validation schema(zod) | `@yrese/contracts` | health / error / patients/search / whoami / reception queue 実装済み、OpenAPI生成済み(WP-1007/7fa369c, WP-2008+2005/bb3d237, WP-4019/3dd1daa, WP-4042/1b1bff5, WP-3009-BE/93aefa1) |
| audit event type | `@yrese/audit` + MOD-008 台帳 | 実装済み(WP-2003/73ffd90, WP-2010/4cf702f, WP-3009-BE/93aefa1 reception.created/cancelled) |
| feature flag key / generated type / fixtures / mock | 将来モジュール(MOD-001 §2) | 未実装 |

UI表示ラベル・警告文テンプレート・アクセシビリティ文言は共通化してよいが境界を明確にする: **バックエンドは UI 表示文言モジュールへ依存してはならない**。現在の実装(SystemModeBadge の MODE_LABELS、PatientHeader の ELIGIBILITY_LABELS)は apps/web 内にあり、UI/UX SSOT(UIX-001)と整合させる。

## 2. 共通化してはならないもの(v0.2.0 §0.0.3.4)

- React / Next.js 依存コードを backend でも使う共通モジュールへ置くこと
- DB client / ORM / AWS SDK 依存コードを frontend でも使う共通モジュールへ置くこと
- UI コンポーネントを backend 共通モジュールへ、backend service を frontend 共通モジュールへ混在させること
- 公式 Adapter 固有のレコード処理を汎用 shared へ混ぜること
- 規制・算定・請求ルールを「便利だから」で UI 側へ複製すること
- 環境変数・secret・credential を共通モジュールへ埋め込むこと
- 本番個人情報を fixtures へ含めること(MOD-013)
- generated code の手編集(MOD-014)

## 3. 設計原則

共通モジュールは **runtime-neutral / dependency-light / testable / tree-shakable** を原則とする。実装済み8パッケージはいずれも外部 runtime 依存を限定している(contracts の zod / zod-openapi のみ例外として承認済み)ため、この水準を維持する。新規依存の追加は WP の `CODEX_PLAN` で事前申告し fable5 承認を要する(WP-1003 で decimal.js を追加せず bigint 自前実装とした先例に従う)。
