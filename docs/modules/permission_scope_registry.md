# permission_scope_registry — 権限スコープレジストリ

```yaml
ssot_id: MOD-007
title: 権限スコープレジストリ
domain: modules
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-11
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: null
effective_to: null
source_refs:
  - 構築プロンプト v0.2.0 §0.0.3.3, §7(UIだけで権限制御せずAPI側でも制御), §9.9
depends_on:
  - packages/shared-kernel permissions.ts(9ab039e)
  - apps/api tenant-context(40a2512)
impacts:
  - packages/shared-kernel permission scope registry
  - apps/api tenant-context authorization and protected routes
  - apps/web development-only least-privilege scope headers
  - packages/contracts/OpenAPI required-scope declarations
related_work_packages:
  - WP-0012
  - WP-2002
  - WP-3009-BE
  - WP-4042
  - WP-4065
  - WP-9002-W3
related_tests:
  - packages/shared-kernel/src/kernel.test.ts
  - packages/contracts/src/whoami.test.ts
  - apps/api/src/server.test.ts
  - apps/web/app/patients/patient-search.test.tsx
  - apps/web/app/reception-dashboard.test.tsx
  - pnpm check:openapi
related_prs: []
evidence_ids: []
open_questions:
  - 疑義照会・会計(返金/差額)・RECOVERY_SYNC承認の専用 scope 要否(UIX-007 の指摘 — 画面実装WPの DoR までに確定)
  - ロール→scope の既定割当表(pharmacist/clerk/admin/support)— auth 設計SSOTと同時に確定
  - break-glass アカウントの scope 表現(SEC-005)
blockers: []
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W3 metadata-only completion: body/status/version/approval/effective semantics unchanged"
  - 0.1.1 (2026-07-09): WP-3009-BE / API-006 v0.2.0 に基づき、受付キュー API 用 resource `reception` を追加(`reception:read` / `reception:write`)。GET/POST は patient:read 併須。
```

**現在の正本は `@yrese/shared-kernel` permissions.ts の実装である。** resource / action / role の追加は本SSOT改版 → fable5+opus4.8 レビュー → 実装の順で行う。

## 1. 構造(実装済み)

- scope 形式: `${resource}:${action}`(テンプレートリテラル型 PermissionScope)。permissionScope() で構築、isPermissionScope() で検証
- **deny-by-default**: apps/api の requirePermission(scope) は tenantContext 不在または scope 不足で 403(AUTH-0003)。UIだけの制御は禁止(API側必須 — 実装済み)

## 2. resource(15種)

patient / reception / insurance / public-expense / prescription / dispensing / calculation / claim / report / master / audit-log / tenant / user / device / sync

## 3. action(5種)

| action | 意味 |
|---|---|
| read | 参照 |
| write | 作成・更新(仮保存を含む) |
| confirm | 専門職確認(薬剤師確認等 — 人間責任の明示) |
| finalize | 確定操作(請求確定・月次締め等の不可逆操作) |
| admin | 管理操作(設定・権限付与等) |

高リスク操作の対応例: 月次締め・請求データロック = `claim:finalize`(CLM-001 の工程ゲートと連動)/ 薬剤師確認 = `dispensing:confirm` / マスター本番適用 = `master:admin`【要確認 — apply を admin と finalize のどちらに割るかは MST-001 承認フロー確定時】

## 4. role(4種 — 初期セット)

pharmacist / clerk / admin / support(v0.2.0 §9.9 のロール別導線に対応)。ロール→scope 既定割当は auth 設計SSOT(BLOCKED_SECURITY_REVIEW 解除後)で確定する。それまで dev スタブでは scope をヘッダで明示指定する(本番起動拒否は実装済み)。

## 5. 変更手順

1. 画面・API実装WPの DoR で「必要 scope が本台帳に存在すること」を要求
2. 不足時は本SSOT改版(resource/action の追加は影響大のため opus4.8 レビュー必須)
3. 実装(permissions.ts 更新+check-boundaries の重複検査対象追加を検討)
4. 監査: scope 変更・権限付与操作自体が監査イベント(MOD-008: permission.changed)
