import "zod-openapi";

import { createDocument, type ZodOpenApiObject } from "zod-openapi";

import { dispensingPaths } from './openapi/openapi-paths-dispensing.js';
import { masterPaths } from './openapi/openapi-paths-master.js';
import { operationsPaths } from './openapi/openapi-paths-operations.js';
import { patientPaths } from './openapi/openapi-paths-patient.js';
import { prescriptionPaths } from './openapi/openapi-paths-prescription.js';
import { receptionPaths } from './openapi/openapi-paths-reception.js';
import { systemPaths } from './openapi/openapi-paths-system.js';

const openApiDefinition = {
  openapi: "3.1.0",
  info: {
    title: "yrese Pharmacy Integration API",
    version: "0.0.1",
    description:
      "@yrese/contracts zod schemas are the source of truth for this generated OpenAPI document. " +
      "Error model (WP-9008): domain errors use ErrorResponse ({errorCode, message}); parser 400 / unknown-route 404 / normalized 500 use FrameworkErrorResponse with constant safe messages (no raw detail, no PHI). " +
      "Authorization denial is uniformly 403 AUTH-0003 (deny-by-default). Authentication model: development uses explicit dev-header tenant context only; production authentication and its 401/WWW-Authenticate semantics are a separately gated release surface and are intentionally not declared here. " +
      "PHI-bearing routes send Cache-Control: no-store on every status including errors.",
  },
  paths: {
    ...systemPaths,
    ...patientPaths,
    ...masterPaths,
    ...receptionPaths,
    ...prescriptionPaths,
    ...dispensingPaths,
    ...operationsPaths,
  },
} satisfies ZodOpenApiObject;

export function createYreseOpenApiDocument(): ReturnType<typeof createDocument> {
  return createDocument(openApiDefinition, {
    cycles: "throw",
    reused: "inline",
  });
}
