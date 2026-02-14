/**
 * Branch Module
 *
 * @see SPEC §9 Branch Management
 * @see SPEC v2.0.0 §12 (Schema Compatibility)
 * @module
 */

export { BranchImpl, generateBranchId, generateWorldId } from "./branch.js";
export type { BranchCallbacks } from "./branch.js";

export { BranchManager } from "./manager.js";
export type { BranchManagerConfig } from "./manager.js";

// v2.0.0 Schema Compatibility
export {
  validateSchemaCompatibility,
  validateSchemaCompatibilityWithEffects,
  extractEffectTypes,
  SchemaIncompatibleError,
} from "./schema-compatibility.js";
