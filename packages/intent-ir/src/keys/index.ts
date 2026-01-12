/**
 * @fileoverview Key System Module Exports
 *
 * Three key types per SPEC Section 12:
 * - intentKey: Protocol semantic identity
 * - strictKey: Exact reproduction cache
 * - simKey: Similarity search
 */

export { deriveIntentKey, deriveIntentKeySync } from "./intent-key.js";

export {
  deriveStrictKey,
  deriveStrictKeySync,
} from "./strict-key.js";

export { deriveSimKey, simhashDistance } from "./sim-key.js";

export type {
  IntentBody,
  IntentScope,
  Footprint,
  ExecutionContext,
  Snapshot,
} from "./types.js";
