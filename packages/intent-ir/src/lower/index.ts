/**
 * @fileoverview Lowering Module Exports
 *
 * IntentIR -> IntentBody via Lexicon and Resolver.
 */

export {
  lower,
  lowerOrThrow,
  type LowerResult,
  type LoweringError,
} from "./lower.js";
