/**
 * Runtime Module - Compiler Runtime for Observability
 *
 * Exports the compiler domain and related utilities for
 * observable compilation via Manifesto Runtime.
 *
 * PRD 6.8: Compiler Runtime 투명성
 */

export {
  compilerDomain,
  getInitialCompilerData,
  getInitialCompilerState,
  type CompilerData,
  type CompilerState,
} from './domain.js';

// Explain Helpers (P1-A: Runtime-aided Verification)
export {
  findFragmentsForPath,
  findFragmentsRequiringPath,
  getFragmentById,
  generatePathSummary,
  generateStepExplanation,
  estimateStepImpact,
  generateBlockerExplanation,
  generateBlockerResolutions,
  computeFragmentImpact,
  findAffectedConflicts,
  analyzeIssueImpact,
  buildIssueExplanation,
  buildConflictExplanation,
  computeFragmentSummary,
  estimateContextTokens,
} from './explain-helpers.js';
