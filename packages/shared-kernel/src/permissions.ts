/**
 * 権限スコープの型基盤。
 *
 * 根拠: 構築プロンプト v0.2.0 §0.0.3.3(permission scope / role name は共通モジュールで管理)、
 * §7(UIだけで権限制御せず、API側でも制御する)。
 * 具体的なスコープ・ロールの追加は permission_scope_registry.md SSOT(APPROVED)を根拠とする。
 */

export const PERMISSION_ACTIONS = ["read", "write", "confirm", "finalize", "admin"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_RESOURCES = [
  "patient",
  "insurance",
  "public-expense",
  "prescription",
  "dispensing",
  "calculation",
  "claim",
  "report",
  "master",
  "audit-log",
  "tenant",
  "user",
  "device",
  "sync",
] as const;
export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];

/** 例: "prescription:write", "claim:finalize" */
export type PermissionScope = `${PermissionResource}:${PermissionAction}`;

export function permissionScope(
  resource: PermissionResource,
  action: PermissionAction,
): PermissionScope {
  return `${resource}:${action}`;
}

export function isPermissionScope(value: string): value is PermissionScope {
  const parts = value.split(":");
  if (parts.length !== 2) {
    return false;
  }

  const [resource, action] = parts;
  if (resource === undefined || action === undefined) {
    return false;
  }

  return (
    (PERMISSION_RESOURCES as readonly string[]).includes(resource) &&
    (PERMISSION_ACTIONS as readonly string[]).includes(action)
  );
}

/**
 * 初期ロール名(v0.2.0 §9.9 のロール別導線に対応する最小セット)。
 * 確定は permission_scope_registry SSOT で行う。
 */
export const ROLE_NAMES = ["pharmacist", "clerk", "admin", "support"] as const;
export type RoleName = (typeof ROLE_NAMES)[number];
