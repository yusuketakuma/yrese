import {
  isPermissionScope,
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  type PermissionScope,
} from "@yrese/shared-kernel";
import { z } from "zod";

import { actorIdWireSchema, pharmacyIdWireSchema, tenantIdWireSchema } from "./wire-id.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const permissionScopePattern = new RegExp(
  `^(?:${PERMISSION_RESOURCES.map(escapeRegExp).join("|")}):(?:${PERMISSION_ACTIONS.map(escapeRegExp).join("|")})$`,
);

export const whoamiPermissionScopeSchema = z
  .string()
  .regex(permissionScopePattern, {
    message: "scope must use a registered resource:action permission scope",
  })
  .refine((value): value is PermissionScope => isPermissionScope(value), {
    message: "scope must use a registered resource:action permission scope",
  });

export const whoamiResponseSchema = z.object({
  tenantId: tenantIdWireSchema,
  pharmacyId: pharmacyIdWireSchema,
  actorId: actorIdWireSchema,
  scopes: z.array(whoamiPermissionScopeSchema),
});

export type WhoamiResponse = z.infer<typeof whoamiResponseSchema>;
