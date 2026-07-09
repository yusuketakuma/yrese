# status_registry — ステータスレジストリ

```yaml
ssot_id: MOD-005
title: ステータスレジストリ(システムモード・保留系・BLOCKER)
domain: modules
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - 構築プロンプト v0.1.7 §13, §14, §0.13, §0.0.3.3
depends_on:
  - packages/shared-kernel(9ab039e)
  - docs/architecture/offline_mode_matrix.md(ARC-001)
open_questions:
  - WP status(DRAFT〜CANCELLED、PRC-002 管理)と本レジストリの関係整理(WP status はプロセス側で管理し本レジストリ対象外とする現方針の確認)
blockers: []
```

**現在の正本は `@yrese/shared-kernel` の実装コードである。** ステータスの追加・変更・削除は本SSOT改版 → fable5+opus4.8 レビュー → 実装の順で行う。ローカル(apps/** や他パッケージ)での同名 const 再定義は check-boundaries.mjs が CI で検出する(`COMMON_MODULE_DUPLICATION_BLOCKED`)。

## 1. システムモード(SYSTEM_MODES — 5種)

NORMAL / EXTERNAL_DEGRADED / CLOUD_DEGRADED / LOCAL_ONLY / RECOVERY_SYNC

ガード関数(モード別許可・禁止の単一実装 — ローカル再実装禁止、ARC-001 が業務マトリクスの正):

| 関数 | 意味 | 判定 |
|---|---|---|
| canConfirmExternal | 外部公的システムの新規確認を成功扱いできるか | NORMAL / CLOUD_DEGRADED のみ true |
| allowsFinalCalculation | 確定算定を許可するか | LOCAL_ONLY 以外 true(LOCAL_ONLY は仮算定のみ) |
| allowsClaimFinalization | 請求前点検・月次締め・レセプト確定を許可するか | NORMAL のみ true |

## 2. 保留・仮状態(PROVISIONAL_STATUSES — 6種、v0.1.7 §14)

PROVISIONAL_CALCULATION / PENDING_REVERIFY / PENDING_EXTERNAL_SYNC / PENDING_PMH_REVERIFY / LOCAL_ONLY_UNVERIFIED / MANUAL_REVIEW_REQUIRED

- LOCAL_ONLY で生成された計算・帳票・受付には必ずいずれかを付与する
- 復旧同期競合: `CONFLICT_REQUIRES_HUMAN_REVIEW`(自動補正禁止)
- MVP対象外請求: `UNSUPPORTED_CLAIM_STATUSES` = BLOCKED_UNSUPPORTED_CLAIM / MANUAL_REVIEW_REQUIRED / FUTURE_SCOPE_NOT_CLAIMABLE
- **請求可否の単一判定は `isClaimable(statuses)`**: 保留系・対象外系・競合のいずれか1つでもあれば false。請求データ生成経路はこの関数を必ず通す(迂回実装禁止 — PRD-001)

## 3. BLOCKER 種別(BLOCKER_TYPES — 31種)

実装統率(§0.13): BLOCKED_NOT_READY / BLOCKED_REGULATORY_REVIEW / BLOCKED_LEGAL_REVIEW / BLOCKED_MEDICAL_SAFETY_REVIEW / BLOCKED_OFFICIAL_ADAPTER_SPEC / BLOCKED_CODE_MAPPING_REVIEW / BLOCKED_UNSUPPORTED_CLAIM / BLOCKED_PMH_REVIEW / BLOCKED_NSIPS_LICENSE / BLOCKED_SECURITY_REVIEW / BLOCKED_PERFORMANCE_SLO / BLOCKED_EDGE_SYNC_DESIGN / BLOCKED_UX_SAFETY / CODEX_CAPABILITY_UNVERIFIED / AGMSG_PROTOCOL_UNVERIFIED

法令・品質: BLOCKED_PMDA_SAMD_REVIEW / BLOCKED_QUALITY_REGULATORY_REVIEW

移行(§9.1): BLOCKED_MIGRATION_MAPPING_UNKNOWN / BLOCKED_CUTOVER_ROLLBACK_UNDEFINED / BLOCKED_LEGACY_RETENTION_UNKNOWN

実装所有・契約(§0.0.2.4): IMPLEMENTATION_OWNERSHIP_BLOCKED / API_CONTRACT_BLOCKED

共通モジュール(§0.0.3.12): COMMON_MODULE_BLOCKED / COMMON_MODULE_DUPLICATION_BLOCKED / COMMON_MODULE_DEPENDENCY_VIOLATION / GENERATED_CODE_DRIFT_BLOCKED

実行モード(§0.0.1): CLAUDE_ULTRACODE_UNAVAILABLE / CODEX_ULTRA_MODE_UNAVAILABLE

マスター(§21): PENDING_MASTER_VALIDATION / コードマッピング(§22): CODE_MAPPING_REVIEW_REQUIRED / SSOT(§0.1.6.17): SSOT_UPDATE_REQUIRED

報告形式は `BlockerReport`(blockerType / workPackageId / blockingQuestion / affectedFiles / risk / recommendedNextStep)— 運用は PRC-006(blocker_triage_policy)。

## 4. 使用実績(先例)

- 空ruleset の算定 → BLOCKED_REGULATORY_REVIEW(@yrese/calculation、テスト固定)
- 複数 CALCULATED ルール → SSOT_UPDATE_REQUIRED(同、レビュー往復で追加された安全ガード)
- 本番での dev 認証スタブ登録 → BLOCKED_SECURITY_REVIEW(apps/api tenant-context、起動拒否)
