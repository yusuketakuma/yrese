/**
 * @yrese/shared-kernel
 *
 * 共通カーネル(runtime-neutral / dependency-light)。
 * ここに定義された概念を apps/** やその他 packages/** で再定義してはならない
 * (COMMON_MODULE_DUPLICATION_BLOCKED — 構築プロンプト v0.2.0 §0.0.3.12)。
 */

export * from "./branded-ids.js";
export * from "./system-mode.js";
export * from "./status.js";
export * from "./blockers.js";
export * from "./error-codes.js";
export * from "./permissions.js";
export * from "./record-lifecycle.js";
export * from "./clinical-alert.js";
export * from "./sync-status.js";
export * from "./prescription-change.js";
export * from "./session.js";
