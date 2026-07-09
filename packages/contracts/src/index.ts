/**
 * @yrese/contracts
 *
 * This package is the single source of API contracts. Frontend code must not
 * assume fields that are absent here. Contract changes require a
 * CONTRACT_CHANGE_REQUEST to fable5 (v0.1.7 §0.0.2.2).
 *
 * TODO(Phase 1): add the OpenAPI YAML generation pipeline from these schemas.
 */

export * from "./health.js";
