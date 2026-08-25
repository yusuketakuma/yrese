import {
  healthResponseSchema,
  whoamiResponseSchema,
  type HealthResponse,
  type WhoamiResponse,
} from "@yrese/contracts";
import {
  permissionScope,
  type PermissionScope,
} from "@yrese/shared-kernel";

import { resolveWebApiUrl } from "../api-transport";
import { devTenantHeaders } from "../dev-tenant";

export const ADMIN_DASHBOARD_REQUIRED_SCOPES = [
  permissionScope("user", "admin"),
  permissionScope("tenant", "admin"),
] as const satisfies readonly PermissionScope[];

/**
 * Development-only tenant context for this route.
 * Production never receives these headers; the existing authenticated tenant context remains
 * authoritative. The explicit list is limited to the scopes required by SCR-029 plus whoami.
 */
const ADMIN_DASHBOARD_DEV_SCOPES = [
  permissionScope("tenant", "read"),
  ...ADMIN_DASHBOARD_REQUIRED_SCOPES,
] as const satisfies readonly PermissionScope[];

export type AdminDataErrorKind =
  | "UNAUTHENTICATED"
  | "PERMISSION_DENIED"
  | "UNAVAILABLE"
  | "INVALID_RESPONSE";

export class AdminDataError extends Error {
  constructor(
    readonly kind: AdminDataErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AdminDataError";
  }
}

export type AdminDataSection<T> =
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "error"; readonly error: AdminDataError };

export interface AdminDashboardSnapshot {
  readonly identity: AdminDataSection<WhoamiResponse>;
  readonly health: AdminDataSection<HealthResponse>;
  readonly loadedAt: string;
}

function classifyHttpFailure(status: number, subject: string): AdminDataError {
  if (status === 401) {
    return new AdminDataError(
      "UNAUTHENTICATED",
      `${subject}を取得するための認証セッションを確認できません。`,
      status,
    );
  }
  if (status === 403) {
    return new AdminDataError(
      "PERMISSION_DENIED",
      `${subject}を参照する権限がありません。`,
      status,
    );
  }
  return new AdminDataError(
    "UNAVAILABLE",
    `${subject}を取得できませんでした。`,
    status,
  );
}

function unavailableFromUnknown(error: unknown, subject: string): AdminDataError {
  if (error instanceof AdminDataError) return error;
  return new AdminDataError(
    "UNAVAILABLE",
    `${subject}を取得できませんでした。`,
  );
}

export async function fetchAdminIdentity(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<WhoamiResponse> {
  let response: Response;
  try {
    response = await fetchImpl(resolveWebApiUrl("/whoami"), {
      headers: devTenantHeaders(ADMIN_DASHBOARD_DEV_SCOPES),
      cache: "no-store",
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    throw unavailableFromUnknown(error, "認証・権限情報");
  }

  if (!response.ok) {
    throw classifyHttpFailure(response.status, "認証・権限情報");
  }

  try {
    return whoamiResponseSchema.parse(await response.json());
  } catch {
    throw new AdminDataError(
      "INVALID_RESPONSE",
      "認証・権限情報の応答形式を検証できませんでした。",
    );
  }
}

export async function fetchAdminHealth(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<HealthResponse> {
  let response: Response;
  try {
    response = await fetchImpl(resolveWebApiUrl("/health"), {
      cache: "no-store",
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    throw unavailableFromUnknown(error, "API稼働状態");
  }

  if (!response.ok) {
    throw classifyHttpFailure(response.status, "API稼働状態");
  }

  try {
    return healthResponseSchema.parse(await response.json());
  } catch {
    throw new AdminDataError(
      "INVALID_RESPONSE",
      "API稼働状態の応答形式を検証できませんでした。",
    );
  }
}

function settledSection<T>(
  result: PromiseSettledResult<T>,
  subject: string,
): AdminDataSection<T> {
  return result.status === "fulfilled"
    ? { status: "ready", data: result.value }
    : { status: "error", error: unavailableFromUnknown(result.reason, subject) };
}

/**
 * Compose independent sections without turning a health failure into an identity failure.
 * No response is cached globally, so tenant or actor data cannot leak across sessions.
 */
export async function loadAdminDashboardSnapshot(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
  now: () => Date = () => new Date(),
): Promise<AdminDashboardSnapshot> {
  const [identity, health] = await Promise.allSettled([
    fetchAdminIdentity(fetchImpl, signal),
    fetchAdminHealth(fetchImpl, signal),
  ]);

  return {
    identity: settledSection(identity, "認証・権限情報"),
    health: settledSection(health, "API稼働状態"),
    loadedAt: now().toISOString(),
  };
}

export function hasRequiredAdminScopes(identity: WhoamiResponse): boolean {
  const granted = new Set<PermissionScope>(identity.scopes);
  return ADMIN_DASHBOARD_REQUIRED_SCOPES.every((scope) => granted.has(scope));
}

export function countAdminScopes(identity: WhoamiResponse): number {
  return identity.scopes.filter((scope) => scope.endsWith(":admin")).length;
}
