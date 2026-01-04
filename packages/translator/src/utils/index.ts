/**
 * Translator Utilities
 *
 * Core utility functions for the translator package.
 */

// =============================================================================
// Canonicalization (RFC 8785)
// =============================================================================

export {
  canonicalize,
  validateNoDuplicateKeys,
  parseAndCanonicalize,
} from "./canonicalize.js";

// =============================================================================
// Fragment ID
// =============================================================================

export {
  computeFragmentId,
  verifyFragmentId,
  generateIntentId,
  generateTraceId,
  generateReportId,
  computeInputHash,
} from "./fragment-id.js";

// =============================================================================
// Type Index
// =============================================================================

export {
  deriveTypeIndex,
  getResolvedType,
  hasPath,
  getAllPaths,
  getPathsByPrefix,
} from "./type-index.js";
