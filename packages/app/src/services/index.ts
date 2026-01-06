/**
 * Services Module
 *
 * Effect handler management and execution.
 *
 * @see SPEC §13
 * @module
 */

export { ServiceRegistry, createServiceRegistry } from "./registry.js";
export type {
  ServiceValidationMode,
  ExecuteServiceOptions,
  ServiceExecutionResult,
} from "./registry.js";

export { createServiceContext } from "./context.js";
export type { CreateServiceContextOptions } from "./context.js";

export { createPatchHelpers } from "./patch-helpers.js";

export {
  executeSystemGet,
  createSystemGetHandler,
} from "./system-get.js";
export type { SystemGetParams, SystemGetResult } from "./system-get.js";
