# audit_worm_and_tenant_isolation_strategy — 監査WORM・テナント分離戦略

```yaml
ssot_id: SEC-008
title: 監査ログの改竄耐性(WORM)とテナント分離の戦略
domain: security
status: APPROVED
approved_at: 2026-07-29
approved_by: direct_user_instruction (human pharmacist/product authority, 2026-07-29); independent_verifier APPROVED; security_auditor APPROVED; data_integrity_reviewer APPROVED; privacy_compliance_reviewer APPROVED; medical_safety_reviewer APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - data_integrity_reviewer
  - api_contract_reviewer
  - security_auditor
  - privacy_compliance_reviewer
  - medical_safety_reviewer
  - human_product_authority
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-29
effective_from: 2026-07-29
effective_to: null
source_refs:
  - docs/spec/construction_prompt_v0.2.0.md §15
  - direct_user_instruction 2026-07-29 (retire the user-facing audit confirmation screen without weakening audit controls)
depends_on:
  - docs/security/audit_log_design.md(SEC-007 — ハッシュチェーンの正本)
  - docs/security/tenant_isolation_design.md(SEC-006)
  - docs/modules/audit_event_registry.md(MOD-008)
  - docs/architecture/claim_finalization_immutability_policy.md(ARC-007)
  - packages/audit(WP-2003 / WP-2010 / WP-5004a / WP-2009 pure core)
impacts:
  - WP-5004b / WP-7001 M3b audit persistence
  - PostgreSQL audit repository and append-only migration
  - production audit deployment and physical WORM controls
related_work_packages: [WP-0047, WP-2003, WP-2010, WP-2009, WP-5004, WP-7001, WP-9001, WP-9007, WP-4254]
related_tests:
  - packages/audit/src/audit.test.ts
  - packages/audit/src/audit-hydration.test.ts
  - apps/api/src/db/audit-repository.test.ts
  - apps/api/src/db/audit-repository.integration.test.ts
  - apps/api/src/db/migration-ddl.test.ts
related_prs: []
evidence_ids: []
change_log:
  - "0.2.0 (2026-07-29): repository実装済みのPostgreSQL adapter・append-only migration・runtime wiringへ事実同期。production deployment、物理WORM、KMS/RLS、retention/export運用の未証明境界は維持"
  - "0.1.2 (2026-07-11): WP-9007 fact/routing freshness amendment finalized after ten role approvals; prior 0.1.1 approval is historical provenance only; privacy/medical conservative clarification applied"
  - "0.1.1 (2026-07-09): approved_by opus4.8 review + fable5; preserved as historical provenance, not current routing authority"
open_questions:
  - 物理 WORM の要否判定に用いる法令・GL 要求の確定(REG-003 と同期)
  - 監査ログの保存期間別ストレージ階層(SEC-007 open_question を継承)
blockers:
  - BLOCKED_SECURITY_REVIEW(物理 WORM・KMS・DB 分離方式の確定はセキュリティレビュー完了後)
  - BLOCKED_SECURITY_REVIEW(production tenant/auth、role mapping、incident-response、support/break-glass運用は未実装)
  - BLOCKED_DATA_INTEGRITY_REVIEW(runtime DB privilege分離、保持・復元・完全出力運用は未証明)
```

## 1. 目的と位置づけ

監査ログの改竄耐性(tamper-evidence / WORM)とテナント分離を、**論理層の規律**と**物理層の候補構成**に分けて確定する。
ハッシュチェーンの技術定義は SEC-007 が正本であり、本書はそれを変更しない。テナント分離の設計正本は SEC-006 であり、本書は監査ログ観点の戦略を追加する。

## 2. 論理層規律(実装可 — インフラ非依存)

1. **append-only**: 監査ログに更新・削除 API を実装しない(実装しようとした時点で CHANGES_REQUESTED)。訂正が必要な場合も新イベントの追記で表現する(ARC-007 と同型)。
2. **tamper-evident**: SEC-007 の `entryHash = H(prevHash ‖ 正規化ペイロード)` を正とする。canonical 化・entryHash 計算・chain 検証は WP-5004a、保存行の strict hydrate / entryHash 再計算照合は WP-2009 で `@yrese/audit` pure core に実装済み。`PostgresAuditRepository`、`migrations/000004_create_audit_events.sql`のUPDATE/DELETE拒否trigger、`main.ts`のPostgreSQL配線もrepository上は実装済みである。これはproduction deployment、runtime DB権限の実効証明、物理 WORM、KMS/RLS、保持・復元・完全出力運用の完了を意味しない。
3. **偽ハッシュ供給の禁止**: `createAuditEvent` は entryHash を内部計算し、`hydrateAuditEvent` は保存 entryHash を再計算照合し、`verifyAuditHashChain` は chain 連続性を検証する。呼び出し側の任意 entryHash、または chain 検証を経ない任意 prevHash を真正性証跡として受け入れる本番配線を作らない。repository実装済みのadapter/migrationだけを根拠に WORM・改竄耐性のproduction運用完了を訴求しない。
4. **tenant-aware**: 全監査イベントに tenant_id / pharmacy_id を必須付帯(SEC-006)。現行repository API contractが証明するのはtrusted exact tenant/pharmacy scopeだけである。テナント越え検索、support、break-glassは未実装の将来運用であり、別のAPPROVED authorization/operations contract、time-bounded authorization、必要性・最小化、利用監査、事後review、applicable human gateなしに有効化しない。

## 3. 物理層は候補構成(確定しない)

コアは特定インフラを前提にしない(ARC-004 と同型の原則)。以下は候補であり、採用確定は BLOCKED_SECURITY_REVIEW の解除後。

| 層 | 候補 | 位置づけ |
|---|---|---|
| WORM ストレージ | S3 Object Lock(compliance mode)等 | 論理 append-only の**追加防御**。論理層規律の代替にしない |
| 鍵管理 | KMS(テナント別キー or キー階層) | PHI 暗号化(MOD-009 の encrypted 不変条件)の鍵運用候補 |
| DB 行レベル分離 | Aurora PostgreSQL RLS 等 | SEC-006 Phase 1 第一候補の追認。現行の正はアプリ層 deny-by-default であり、RLS は多層防御の追加として評価 |

採用確定の前提条件(全て満たすまで確定しない):
1. 法令・GL 上の保存要件の確定(REG-003 / SEC-007 open_question の解消)
2. コスト・運用(リストア演習含む)の評価
3. LOCAL_ONLY / RECOVERY_SYNC 時の Edge 側チェーン維持(SEC-005 #11)との整合確認
4. セキュリティレビュー(BLOCKED_SECURITY_REVIEW 解除)

## 4. break-glass(緊急アクセス)

- 緊急時のテナント越え・権限外アクセス(break-glass)を行う場合も、**監査イベント必須**・**businessReason 必須**(MOD-008 の cancel/void 系と同水準)・**事後レビュー必須**とする。
  `breakglass.used` の businessReason 必須は WP-2010 で MOD-008 / `@yrese/audit` に実装済み。`breakglass.ended` も登録済みだが、correlationId / causationId による関連付けは呼び出し側が供給する値に対する台帳・test上の規律に限られる。pure core は cross-event pairing、break-glass session state、event ordering を強制しない。一般監査のPostgreSQL配線とは別に、break-glassセッション機能・authorization・専用production配線は未実装であり、本規律を根拠に実装開始・production readiness を主張しない。
- break-glass 用の恒常的なバックドア権限を作らない。発動は都度・時限とし、発動自体と終了を監査イベントにする。
- 監査イベントを残せない状態での break-glass は実行しない(fail-closed)。

## 5. 停止条件(fail-closed)

- 監査ログの更新・削除 API の実装 → 実装禁止(レビューで自動 CHANGES_REQUESTED)
- production / external 向けの tamper-evident 訴求 → pure core の entryHash 計算・hydrate 照合・chain 検証 **および** 適用対象の永続層における append-only / chain continuity の実装・検証の双方が完了するまで禁止
- WORM の対外訴求 → 必要な human/security authority により採用承認された論理・物理 control の実装と、保持・復元・改竄検知を含む運用検証が完了するまで禁止
- 呼び出し側の任意 entryHash、または chain 検証を経ない任意 prevHash を真正性証跡として受け入れる本番配線 → 禁止(§2-3)
- tenant_id / pharmacy_id を持たない監査イベント → MOD-008 実行時拒否を維持
- 物理 WORM・KMS・RLS の製品確定 → BLOCKED_SECURITY_REVIEW 解除まで BLOCKED

## 変更履歴

- 0.2.0 (2026-07-29): repository実装済みのPostgreSQL adapter、append-only migration、runtime wiringへ事実同期。production deployment、物理WORM、KMS/RLS、retention/export運用は未証明のまま分離。
- 0.1.2 (2026-07-11): WP-9007 実装状態・routing freshness 改版。WP-5004a/WP-2009/WP-2010 の pure core 実装済み事実へ同期し、永続化・物理 WORM・KMS/RLS・break-glass 本番配線の未完了と human/security gate は不変更。privacy/medical reviewを反映し、production/external訴求の双方証拠要件とcross-event非強制境界を明確化。

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(source_refs を現行 v0.2.0 の実節 §15 へ修正、break-glass businessReason の構造強制経路を MOD-008 改版 = WP-2010 として明記)。
- 0.1.0 (2026-07-09): 初版起草(WP-0047)。SEC-007 を正本としたうえで論理/物理の分離、break-glass 監査必須、偽ハッシュ供給禁止を規律化。
