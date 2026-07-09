# common_module_inventory — 共通モジュール台帳

```yaml
ssot_id: MOD-001
title: 共通モジュール台帳
domain: modules
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - 構築プロンプト v0.1.7 §0.0.3.1, §0.0.3.2, §0.0.3.6
depends_on:
  - docs/agents/file_ownership_and_lock_policy.md(AGT-009)
  - docs/modules/dependency_direction_policy.md(MOD-003)
open_questions:
  - packages/domain / packages/claim / packages/masters / packages/reports の新設時期(Phase 1 のドメインSSOT承認後)
  - packages/ui の分離時期(第二利用者出現時 — shared肥大化防止の方針による)
blockers: []
```

共通モジュールは、SSOTで確定した仕様を型・状態・エラー・金額・日付・監査・権限・API契約・バリデーション・fixtures として再利用可能にした**実装上の統制単位**である(v0.1.7 §0.0.3)。本台帳にない共通モジュールの新設、および台帳記載モジュールと同じ概念のローカル再実装を禁止する(`COMMON_MODULE_DUPLICATION_BLOCKED`)。

## 1. 実装済み共通モジュール(正本)

| パッケージ | 内容 | owner(AGT-009準拠) | レビュー | 依存(workspace) | 実装状態 |
|---|---|---|---|---|---|
| `@yrese/shared-kernel` | branded ID 11種 / SYSTEM_MODES 5種+ガード3関数 / PROVISIONAL_STATUSES 6種+isClaimable / BLOCKER_TYPES 31種 / ErrorCodeRegistry / PermissionScope+ROLE_NAMES | Codex側Sol | fable5+opus4.8 | なし(依存ゼロ) | 実装済み(9ab039e)テスト15 |
| `@yrese/money` | ScaledDecimal(bigint係数+scale)/ Yen / Points / RoundingMode 7種 | Codex側Sol | opus4.8(高リスク) | なし | 実装済み(533f89a)テスト11 |
| `@yrese/date-time` | CalendarDate / PrescriptionDate / DispensingDate / ReceptionDate / ClaimMonth | Codex側Sol | opus4.8(高リスク) | なし | 実装済み(ab234fe)テスト8 |
| `@yrese/trace` | EvidenceRef / CalculationTrace / LegalTrace(affectsClaim→evidenceRefs≥1 強制) | Codex側Sol | fable5+opus4.8 | shared-kernel | 実装済み(ddc06a1)テスト6 |
| `@yrese/events` | EventEnvelope(PHI≠none→encrypted 必須) | Codex側Sol | opus4.8 | shared-kernel | 実装済み(85bd3aa)テスト7 |
| `@yrese/contracts` | API契約の単一正本(現在は health のみ) | Codex側Sol(生成・更新) | ClaudeCode側 利用側レビュー | zod v4 | 実装済み(7fa369c)テスト3 |
| `@yrese/calculation` | 算定エンジン骨格(具体ルールなし。空ruleset→BLOCKED、複数CALCULATED→SSOT_UPDATE_REQUIRED) | Codex側Sol | fable5+opus4.8+人間候補 | shared-kernel / money / date-time / trace | 骨格のみ(d26424d)テスト4 |

補助ツーリング: `scripts/check-boundaries.mjs`(0213ac0)— import 境界 / workspace 循環 / 重複 const 検査。CI 組込済み(`pnpm check:boundaries`)。

## 2. 今後の候補(v0.1.7 §0.0.3.2 — 新設は本台帳の改版+fable5承認後のみ)

| 候補 | 想定内容 | 新設条件 |
|---|---|---|
| `packages/ui` | UI共通コンポーネント(PatientHeader 等は現在 apps/web 内に所在) | 第二利用者の出現(無秩序な shared 肥大化防止) |
| `packages/domain` | ドメインモデル(患者・保険・処方・調剤) | Phase 1 domain_model SSOT 承認後 |
| `packages/claim` | レセプト中間モデル・電子レセプト生成 | 記録条件仕様の evidence_id 発行後(CLM-002 精読+人間レビュー) |
| `packages/masters` | マスター取込・版管理 | MST-001 承認後 |
| `packages/audit`(仮) | AuditEvent(SEC-007 基底構造) | audit_event_registry(MOD-008)承認後、WP-2003 |
| `packages/api-client` | OpenAPI generated client | generated_code_policy(MOD-014)の生成パイプライン導入時 |
| `packages/fixtures` / `packages/test-utils` | 合成 fixture・テスト補助 | fixture_policy(MOD-013)承認後、WPごとに owner 指定 |

## 3. 運用ルール

- 実装前チェック(v0.1.7 §0.0.3.8): 既存モジュールで実現可能か → 拡張か → 新設か → frontend/backend 固有か真に共有か → 依存方向 → bundle/boundary 影響 → 法令・医療安全概念の重複定義がないか
- 共通モジュールの変更は AGT-009 のロック手順に従う(ClaudeCode側と Codex側の同時編集禁止)
- breaking change は agmsg 合意のみで実施禁止 — SSOT 改版+レビュー+WP 再発行(v0.1.7 §0.0.3.9)
