import { permissionScope, type PermissionScope } from "@yrese/shared-kernel";

/**
 * 開発用テナントヘッダ(バックエンドの dev stub と対)。
 * development 以外では一切送らない(WP-4038: 本番境界)。バックエンド側も
 * NODE_ENV=production で dev stub 自体が起動拒否されるため二重防御になる。
 * 本番認証(OIDC等)は auth SSOT 承認後に置換する。
 *
 * 元は patient-search.tsx 所有だったが、複数画面(受付・監査ログ・患者文脈再取得)が
 * 使うため独立モジュール化(patient-search からは互換再エクスポート)。
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
