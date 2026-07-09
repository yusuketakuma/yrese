# common_module_inventory — 共通モジュール台帳

```yaml
ssot_id: MOD-001
title: 共通モジュール台帳
domain: modules
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.3
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
change_log:
  - 0.1.3 (2026-07-09): WP-4046 — `@yrese/contracts` の ID wire field 共通 refine 追加と contract test 数を同期。要件・境界は不変更。
  - 0.1.2 (2026-07-09): WP-4049 実装状態 drift 整備。WP-3009-BE/93aefa1 の受付キュー契約・shared-kernel 実装、WP-4028/12f1bb7 の calculation purity gate、最新テスト数を現行 packages/* 実態へ同期(要件・境界は不変更)。
  - 0.1.1 (2026-07-09): WP-4043 実装状態 drift 整備。`@yrese/audit`、`@yrese/contracts`、各実装済み共通モジュールの現行実装状態を packages/* の実態へ同期(要件・境界は不変更)。
source_refs:
  - 構築プロンプト v0.2.0 §0.0.3.1, §0.0.3.2, §0.0.3.6
depends_on:
  - docs/agents/file_ownership_and_lock_policy.md(AGT-009)
  - docs/modules/dependency_direction_policy.md(MOD-003)
open_questions:
  - packages/domain / packages/claim / packages/masters / packages/reports の新設時期(Phase 1 のドメインSSOT承認後)
  - packages/ui の分離時期(第二利用者出現時 — shared肥大化防止の方針による)
blockers: []
```

共通モジュールは、SSOTで確定した仕様を型・状態・エラー・金額・日付・監査・権限・API契約・バリデーション・fixtures として再利用可能にした**実装上の統制単位**である(v0.2.0 §0.0.3)。本台帳にない共通モジュールの新設、および台帳記載モジュールと同じ概念のローカル再実装を禁止する(`COMMON_MODULE_DUPLICATION_BLOCKED`)。

## 1. 実装済み共通モジュール(正本)

| パッケージ | 内容 | owner(AGT-009準拠) | レビュー | 依存(workspace) | 実装状態 |
|---|---|---|---|---|---|
| `@yrese/shared-kernel` | branded ID 12種(ReceptionId含む) / SYSTEM_MODES 5種+ガード3関数 / PROVISIONAL_STATUSES 6種+isClaimable / RECEPTION_STATUSES 4種 / BLOCKER_TYPES 33種 / ErrorCodeRegistry(seed 5件) / PermissionScope(resource 15種)+ROLE_NAMES | Codex側Sol | fable5+opus4.8 | なし(依存ゼロ) | 実装済み(WP-1002/9ab039e, WP-1012/41d5113, WP-0052/6f7f91f, WP-3009-BE/93aefa1)テスト23 |
| `@yrese/money` | ScaledDecimal(bigint係数+scale)/ Yen / Points / RoundingMode 7種 | Codex側Sol | opus4.8(高リスク) | なし | 実装済み(WP-1003/533f89a, WP-4033/ef978d4, WP-4040/a30cfc5)テスト15 |
| `@yrese/date-time` | CalendarDate / PrescriptionDate / DispensingDate / ReceptionDate / ClaimMonth | Codex側Sol | opus4.8(高リスク) | なし | 実装済み(WP-1004/ab234fe, WP-4022/6f04722)テスト8 |
| `@yrese/trace` | EvidenceRef / CalculationTrace / LegalTrace(affectsClaim→evidenceRefs≥1 強制、CAL-008拡張フィールド、enum/kind runtime guard) | Codex側Sol | fable5+opus4.8 | shared-kernel | 実装済み(WP-1005/ddc06a1, WP-4031/8d0bf80, WP-4039/e3892a5)テスト14 |
| `@yrese/events` | EventEnvelope(PHI≠none→encrypted 必須、runtime enum/ID guard) | Codex側Sol | opus4.8 | shared-kernel | 実装済み(WP-1006/85bd3aa, WP-4032/d665c06)テスト11 |
| `@yrese/contracts` | API契約の単一正本(health / error / patients/search / whoami / reception queue) + OpenAPI 3.1生成 | Codex側Sol(生成・更新) | ClaudeCode側 利用側レビュー | shared-kernel / zod v4 / zod-openapi | 実装済み(WP-1007/7fa369c, WP-2008+2005/bb3d237, WP-4019/3dd1daa, WP-4042/1b1bff5, WP-3009-BE/93aefa1, WP-4046)テスト66 |
| `@yrese/audit` | AuditEvent registry / grammar / outcome / businessReason / hash fields(EventEnvelope 不変条件継承、reception.created/cancelled 登録) | Codex側Sol | fable5+opus4.8 | events / shared-kernel | 実装済み(WP-2003/73ffd90, WP-2010/4cf702f, WP-3009-BE/93aefa1)テスト32 |
| `@yrese/calculation` | 算定エンジン骨格+初期 evidence-backed ルール(具体ルールは承認済み範囲のみ。空ruleset→BLOCKED、形状不一致→SSOT_UPDATE_REQUIRED、pure function static gate) | Codex側Sol | fable5+opus4.8+人間候補 | shared-kernel / money / date-time / trace | 実装済み(WP-2101a/d26424d, WP-2101b/76da0d6, WP-4034/871a2f3, WP-4039/e3892a5, WP-4028/12f1bb7)テスト20 |

補助ツーリング: `scripts/check-boundaries.mjs`(0213ac0, WP-4035/d1d37a2)— import 境界 / workspace 循環 / 重複 const 検査。`scripts/check-calculation-purity.mjs`(WP-4028/12f1bb7)— CAL-010 の算定純粋性禁止パターン検査。どちらも CI 組込済み。

## 2. 今後の候補(v0.2.0 §0.0.3.2 — 新設は本台帳の改版+fable5承認後のみ)

| 候補 | 想定内容 | 新設条件 |
|---|---|---|
| `packages/ui` | UI共通コンポーネント(PatientHeader 等は現在 apps/web 内に所在) | 第二利用者の出現(無秩序な shared 肥大化防止) |
| `packages/domain` | ドメインモデル(患者・保険・処方・調剤) | Phase 1 domain_model SSOT 承認後 |
| `packages/claim` | レセプト中間モデル・電子レセプト生成 | 記録条件仕様の evidence_id 発行後(CLM-002 精読+人間レビュー) |
| `packages/masters` | マスター取込・版管理 | MST-001 承認後 |
| `packages/api-client` | OpenAPI generated client | generated client 導入WP発行時(MOD-014 の手編集禁止・drift check 規律を適用) |
| `packages/fixtures` / `packages/test-utils` | 合成 fixture・テスト補助 | fixture_policy(MOD-013)承認後、WPごとに owner 指定 |

## 3. 運用ルール

- 実装前チェック(v0.2.0 §0.0.3.8): 既存モジュールで実現可能か → 拡張か → 新設か → frontend/backend 固有か真に共有か → 依存方向 → bundle/boundary 影響 → 法令・医療安全概念の重複定義がないか
- 共通モジュールの変更は AGT-009 のロック手順に従う(ClaudeCode側と Codex側の同時編集禁止)
- breaking change は agmsg 合意のみで実施禁止 — SSOT 改版+レビュー+WP 再発行(v0.2.0 §0.0.3.9)
