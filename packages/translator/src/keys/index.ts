/**
 * @fileoverview Keys Module Exports
 *
 * Key derivation and serialization utilities.
 */

export {
  type SimKey,
  serializeSimKey,
  deserializeSimKey,
  isValidSimKeyHex,
  ZERO_SIM_KEY,
  ZERO_SIM_KEY_HEX,
} from "./sim-key-hex.js";

// Re-export key derivation functions from intent-ir
export { deriveSimKey, deriveIntentKey, deriveIntentKeySync } from "@manifesto-ai/intent-ir";
