/**
 * @fileoverview Validation Module Exports
 *
 * Two-phase validation per SPEC Section 9.1:
 * - Structural: Always runs, no Lexicon required
 * - Lexicon-Verified: Requires explicit validate() call with Lexicon
 */

// Structural validation
export {
  validateStructural,
  isStructurallyValid,
  type StructuralValidationResult,
} from "./structural.js";

// Lexicon-verified validation
export { validateWithLexicon } from "./lexicon.js";
