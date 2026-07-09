/**
 * @yrese/contracts
 *
 * This package is the single source of API contracts. Frontend code must not
 * assume fields that are absent here. Contract changes require a
 * CONTRACT_CHANGE_REQUEST to fable5 (v0.2.0 §0.0.2.2).
 *
 * OpenAPI YAML is generated from these schemas by `pnpm generate:openapi`;
 * `pnpm check:openapi` fails on generated artifact drift.
 */

export * from "./error.js";
export * from "./health.js";
export * from "./openapi.js";
export * from "./patient-search.js";
export * from "./reception-queue.js";
export * from "./whoami.js";
