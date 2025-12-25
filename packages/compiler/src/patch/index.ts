/**
 * Patch Module
 *
 * Provides patch system functionality including:
 * - Codebook CRUD operations for semantic path aliasing
 * - Path similarity analysis for alias suggestions
 * - Hint generation (NO AUTO-APPLY)
 * - Patch application logic
 *
 * CRITICAL INVARIANTS:
 * - All suggestions are HINTS ONLY - never auto-applied
 * - All mutations return NEW instances (immutable)
 * - All operations are deterministic (Principle E)
 */

// ============================================================================
// Codebook Operations
// ============================================================================

export {
  // Query operations
  getAliasById,
  getAliasForPath,
  resolveToCanonical,
  resolveAllToCanonical,
  getAliasesForCanonical,
  getAliasesByStatus,
  getPendingAliases,
  getAppliedAliases,
  getRejectedAliases,
  hasAliasForPath,
  getAllCanonicalPaths,
  // Mutation operations (immutable - return new codebook)
  addAliasSuggestion,
  addAliasSuggestions,
  applyAlias,
  rejectAlias,
  removeAlias,
  addUserAlias,
  clearRejectedAliases,
  clearPendingAliases,
  // Validation
  wouldAliasConflict,
  getAliasConflicts,
  validateCodebook,
  // Sorting
  sortCodebookEntries,
  sortAliasesByConfidence,
  // Statistics
  getCodebookStats,
} from './codebook.js';

// ============================================================================
// Similarity Analysis
// ============================================================================

export {
  // String similarity
  levenshteinDistance,
  stringSimilarity,
  jaccardSimilarity,
  tokenize,
  // Path similarity
  pathNameSimilarity,
  pathTokenSimilarity,
  sameNamespace,
  combinedPathSimilarity,
  // Path analysis
  findSimilarPaths,
  findSimilarExpressions,
  expressionSimilarity,
  // Frequency analysis
  findFrequentPaths,
  getAllPaths,
  // Clustering
  clusterSimilarPaths,
  clusterByExpression,
  // Duplicate detection
  detectDuplicatePaths,
  // Types
  type PathSimilarity,
  type PathFrequency,
  type PathCluster,
} from './similarity.js';

// ============================================================================
// Hint Generator (NO AUTO-APPLY)
// ============================================================================

export {
  // Main analysis - SUGGESTION ONLY
  analyzeForAliases,
  // PatchHint generation
  generateAliasHints,
  // Path-specific suggestions
  suggestAliasesForPath,
  suggestCanonicalFor,
  // Duplicate detection
  getDuplicatePathSuggestions,
  generateSuggestionsFromDuplicates,
  // Summary
  getAnalysisSummary,
} from './hint-generator.js';

// ============================================================================
// Patch Applier
// ============================================================================

export {
  // Apply functions
  applyPatch,
  applyPatchOp,
  applyPatches,
  // Preview
  previewPatch,
  // Types
  type PatchOpResult,
  type ApplyPatchResultWithCodebook,
  type PatchPreviewResult,
} from './applier.js';

// ============================================================================
// Individual Operation Handlers (Advanced)
// ============================================================================

export {
  // Fragment operation handlers
  applyReplaceExpr,
  applyAddDep,
  applyRemoveDep,
  applyRenamePath,
  applyRemoveFragment,
  applyChooseConflict,
  applyUpdateSchemaField,
  applyAddFragment,
  applyUpdateFragmentMeta,
  applyReplaceEvidence,
  // Types
  type PatchOpSuccess,
} from './ops/fragment-ops.js';

export {
  // Alias operation handlers (suffixed to avoid conflict with PatchOp helpers in types/patch.ts)
  applyAliasOp as applyAliasHandler,
  rejectAliasOp as rejectAliasHandler,
  addAliasOp as addAliasHandler,
  removeAliasOp as removeAliasHandler,
} from './ops/alias-ops.js';

// ============================================================================
// Re-export Types from types/
// ============================================================================

export type {
  // Codebook types
  CodebookId,
  AliasId,
  AliasStatus,
  AliasEntry,
  Codebook,
  AliasSuggestion,
  SimilarityType,
  CodebookAnalysisResult,
  CodebookAnalysisStats,
  AliasHintConfig,
} from '../types/codebook.js';

export {
  // Codebook factory functions
  createCodebookId,
  createAliasId,
  createCodebook,
  createAliasEntry,
  createAliasSuggestion,
  DEFAULT_ALIAS_HINT_CONFIG,
} from '../types/codebook.js';

export type {
  // Patch types
  PatchId,
  PatchOp,
  Patch,
  PatchHint,
  ApplyPatchResult,
} from '../types/patch.js';

export {
  // Patch factory functions
  createPatchId,
  createPatch,
  replaceExprOp,
  addDepOp,
  removeFragmentOp,
  chooseConflictOp,
  renamePathOp,
  addFragmentOp,
  createPatchHint,
  // Alias PatchOp helpers
  applyAliasOp,
  rejectAliasOp,
  addAliasOp,
  removeAliasOp,
} from '../types/patch.js';
