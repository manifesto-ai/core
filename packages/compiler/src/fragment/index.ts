/**
 * Fragment Module
 *
 * Exports fragment creation helpers and stable ID generation.
 */

// Stable ID generation
export {
  generateStableFragmentId,
  generateRandomFragmentId,
  generateOriginHash,
  fragmentIdMatchesKind,
  extractKindFromFragmentId,
  regenerateFragmentIdIfNeeded,
  // 2단계 정체성 모델
  generateFragmentIdentity,
  extractStructuralShape,
  extractEffectStructuralShape,
  calculateSimilarity,
  findBestMatch,
  type FragmentIdentity,
  type SimilarityMatch,
} from './stable-id.js';

// Base fragment creation
export {
  COMPILER_VERSION,
  type CreateFragmentOptions,
  type CreateSchemaFragmentOptions,
  type CreateSourceFragmentOptions,
  type CreateExpressionFragmentOptions,
  type CreateDerivedFragmentOptions,
  type CreatePolicyFragmentOptions,
  type CreateEffectFragmentOptions,
  type CreateActionFragmentOptions,
  type CreateStatementFragmentOptions,
  createSchemaFragment,
  createSourceFragment,
  createExpressionFragment,
  createDerivedFragment,
  createPolicyFragment,
  createEffectFragment,
  createActionFragment,
  createStatementFragment,
  cloneFragment,
  updateFragmentRequires,
  addEvidence,
  setConfidence,
} from './base.js';
