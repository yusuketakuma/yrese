import { permissionScope, type PermissionScope } from "@yrese/shared-kernel";

/**
 * 開発用テナントヘッダ(バックエンドの dev stub と対)。
 * Webは development 以外では一切送らない(WP-4038: 本番境界)。API側は
 * YRESE_ALLOW_DEV_TENANT_STUB=trueの完全一致による明示opt-in、development/test、
 * in-memory repository、DATABASE_URLなしの全条件でのみ受理し、unsafeなopt-inは
 * startup時にfail-closedで拒否する(WP-4066 / SEC-006)。
 * 本番認証(OIDC等)は auth SSOT 承認後に置換する。
 *
 * 元は patient-search.tsx 所有だったが、複数画面(受付・監査ログ・患者文脈再取得)が
 * 使うため独立モジュール化。
 */

export const PATIENT_SEARCH_DEV_SCOPES = [
  permissionScope("patient", "read"),
] as const satisfies readonly PermissionScope[];

export function devTenantHeaders(
  scopes: readonly PermissionScope[] = PATIENT_SEARCH_DEV_SCOPES,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): Record<string, string> {
  if (nodeEnv !== "development") {
    return {};
  }
  return {
    "x-dev-tenant": "t-dev",
    "x-dev-pharmacy": "ph-dev",
    "x-dev-actor": "u-dev",
    "x-dev-scopes": scopes.join(","),
  };
}
