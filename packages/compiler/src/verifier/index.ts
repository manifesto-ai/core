/**
 * Verifier Module - Main Entry Point
 *
 * Orchestrates all verification phases:
 * 1. DAG validation (cycles, missing dependencies)
 * 2. Static validation (paths, types, policies, effects, actions, provenance)
 * 3. Core validation (integration with @manifesto-ai/core validateDomain)
 *
 * All operations are deterministic (Principle E).
 */

import { validateDomain as coreValidateDomain } from '@manifesto-ai/core';
import type { LinkResult } from '../types/session.js';
import type { Issue } from '../types/issue.js';
import type { Fragment } from '../types/fragment.js';
import { sortIssues } from './issue-mapper.js';
import { convertDomainDraftToManifesto } from './domain-converter.js';

// Re-export all sub-modules
// Note: Explicitly export from issue-mapper to avoid conflict with linker's sortIssues/getBlockingIssues
export {
  type ValidationError,
  type CoreValidationIssue,
  type IssueOptions,
  classifySeverity,
  createIssueFromCode,
  mapValidationError,
  mapValidationErrors,
  mapCoreValidationIssue,
  mapCoreValidationIssues,
  createMissingDependencyIssue,
  createCyclicDependencyIssue,
  createInvalidPathIssue,
  createDuplicateProvidesIssue,
  createInvalidPreconditionPathIssue,
  createActionVerbRequiredIssue,
  createMissingProvenanceIssue,
  createEffectRiskTooHighIssue,
  createUnknownSchemaTypeIssue,
  createInvalidExpressionIssue,
  createInvalidEffectIssue,
  hasBlockingIssues,
  // Note: sortIssues and getBlockingIssues omitted - use linker's versions
  groupIssuesByCode,
  getIssueSummary,
} from './issue-mapper.js';
export * from './dag.js';
export * from './static.js';
export * from './domain-converter.js';

// Import for internal use
import {
  validateDag,
  hasCycles,
  hasAllDependencies,
  type DagValidationResult,
} from './dag.js';
import {
  validateStatic,
  type StaticValidationOptions,
  type StaticValidationResult,
} from './static.js';
import {
  hasBlockingIssues,
  getBlockingIssues,
  getIssueSummary,
  mapCoreValidationIssues,
} from './issue-mapper.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Verify options
 */
export interface VerifyOptions {
  /** Check for cycles (default: true) */
  checkCycles?: boolean;

  /** Check for missing dependencies (default: true) */
  checkDependencies?: boolean;

  /** Check type consistency (default: true) */
  checkTypes?: boolean;

  /** Check policies (default: true) */
  checkPolicies?: boolean;

  /** Check effects (default: true) */
  checkEffects?: boolean;

  /** Check actions (default: true) */
  checkActions?: boolean;

  /** Check provenance (default: true) */
  checkProvenance?: boolean;

  /** Check path formats (default: true) */
  checkPaths?: boolean;

  /** Use @manifesto-ai/core validateDomain (default: false) */
  useCoreValidation?: boolean;

  /** Treat warnings as errors (default: false) */
  treatWarningsAsErrors?: boolean;

  /** Maximum allowed effect risk (default: 'high') */
  maxEffectRisk?: 'low' | 'medium' | 'high' | 'critical';

  /** Require action verb in semantic metadata (default: false) */
  requireActionVerb?: boolean;

  /** Sort results for determinism (Principle E, default: true) */
  sortResults?: boolean;
}

/**
 * Verify result
 */
export interface VerifyResult {
  /** Whether verification passed (no blocking issues) */
  isValid: boolean;

  /** All issues found */
  issues: Issue[];

  /** Count of errors */
  errorCount: number;

  /** Count of warnings */
  warningCount: number;

  /** DAG validation result (if enabled) */
  dagResult?: DagValidationResult;

  /** Static validation result (if enabled) */
  staticResult?: StaticValidationResult;

  /** Summary message */
  summary: string;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: Required<VerifyOptions> = {
  checkCycles: true,
  checkDependencies: true,
  checkTypes: true,
  checkPolicies: true,
  checkEffects: true,
  checkActions: true,
  checkProvenance: true,
  checkPaths: true,
  useCoreValidation: false,
  treatWarningsAsErrors: false,
  maxEffectRisk: 'high',
  requireActionVerb: false,
  sortResults: true,
};

// ============================================================================
// Main Verify Function
// ============================================================================

/**
 * Verify a link result
 *
 * This function performs comprehensive verification of a linked result:
 * 1. DAG validation (cycles, missing dependencies)
 * 2. Static validation (paths, types, policies, effects, actions, provenance)
 * 3. Optionally integrates with @manifesto-ai/core validateDomain
 *
 * All operations are deterministic - same input yields same output (Principle E).
 *
 * @param linkResult - Link result to verify
 * @param options - Verify options
 * @returns VerifyResult
 */
export function verify(
  linkResult: LinkResult,
  options: VerifyOptions = {}
): VerifyResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allIssues: Issue[] = [];

  // Include any issues from the link result
  allIssues.push(...linkResult.issues);

  // Step 1: DAG Validation
  let dagResult: DagValidationResult | undefined;
  if (opts.checkCycles || opts.checkDependencies) {
    dagResult = validateDag(linkResult);
    allIssues.push(...dagResult.issues);
  }

  // Step 2: Static Validation
  let staticResult: StaticValidationResult | undefined;
  const staticOpts: StaticValidationOptions = {
    validatePaths: opts.checkPaths,
    validateTypes: opts.checkTypes,
    validatePolicies: opts.checkPolicies,
    validateEffects: opts.checkEffects,
    validateActions: opts.checkActions,
    validateProvenance: opts.checkProvenance,
    maxEffectRisk: opts.maxEffectRisk,
    requireActionVerb: opts.requireActionVerb,
  };

  staticResult = validateStatic(linkResult, staticOpts);
  allIssues.push(...staticResult.issues);

  // Step 3: Core Validation (if enabled and domain exists)
  if (opts.useCoreValidation && linkResult.domain) {
    try {
      // Convert DomainDraft to ManifestoDomain for Core validation
      const manifestoDomain = convertDomainDraftToManifesto(linkResult.domain, {
        defaultId: 'compiler-domain',
        defaultName: 'Compiler Generated Domain',
        defaultDescription: 'Domain generated by @manifesto-ai/compiler',
      });

      // Run Core validation
      const coreResult = coreValidateDomain(manifestoDomain, {
        checkCycles: opts.checkCycles,
        checkMissingDeps: opts.checkDependencies,
      });

      // Map Core validation issues to compiler Issue format
      if (!coreResult.valid && coreResult.issues.length > 0) {
        const mappedIssues = mapCoreValidationIssues(
          coreResult.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            severity: issue.severity,
            path: issue.path,
          }))
        );
        allIssues.push(...mappedIssues);
      }
    } catch (error) {
      // If Core validation fails unexpectedly, record as warning
      allIssues.push({
        id: `core-validation-error-${Date.now()}`,
        code: 'CORE_VALIDATION_ERROR',
        severity: 'warning',
        message: `Core validation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  // Deduplicate issues by ID
  const seenIds = new Set<string>();
  const uniqueIssues: Issue[] = [];
  for (const issue of allIssues) {
    if (!seenIds.has(issue.id)) {
      seenIds.add(issue.id);
      uniqueIssues.push(issue);
    }
  }

  // Sort for determinism (Principle E)
  let finalIssues = uniqueIssues;
  if (opts.sortResults) {
    finalIssues = sortIssues(uniqueIssues);
  }

  // Count errors and warnings
  let errorCount = 0;
  let warningCount = 0;
  for (const issue of finalIssues) {
    if (issue.severity === 'error') {
      errorCount++;
    } else if (issue.severity === 'warning') {
      if (opts.treatWarningsAsErrors) {
        errorCount++;
      } else {
        warningCount++;
      }
    }
  }

  // Determine validity
  const isValid = errorCount === 0 && linkResult.conflicts.length === 0;

  // Build summary
  const summary = buildSummary(isValid, errorCount, warningCount, linkResult.conflicts.length);

  return {
    isValid,
    issues: finalIssues,
    errorCount,
    warningCount,
    dagResult,
    staticResult,
    summary,
  };
}

/**
 * Build summary message
 */
function buildSummary(
  isValid: boolean,
  errorCount: number,
  warningCount: number,
  conflictCount: number
): string {
  if (isValid) {
    if (warningCount > 0) {
      return `Verification passed with ${warningCount} warning(s)`;
    }
    return 'Verification passed';
  }

  const parts: string[] = [];
  if (errorCount > 0) {
    parts.push(`${errorCount} error(s)`);
  }
  if (conflictCount > 0) {
    parts.push(`${conflictCount} conflict(s)`);
  }
  if (warningCount > 0) {
    parts.push(`${warningCount} warning(s)`);
  }

  return `Verification failed: ${parts.join(', ')}`;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick verify - just check if valid (runs verification)
 *
 * Note: Use linker's isLinkResultValid() if you only want to check existing issues.
 * This function runs actual verification.
 */
export function quickVerifyIsValid(linkResult: LinkResult): boolean {
  const result = verify(linkResult, {
    checkCycles: true,
    checkDependencies: true,
    checkTypes: false,
    checkPolicies: false,
    checkEffects: false,
    checkActions: false,
    checkProvenance: false,
    checkPaths: false,
  });
  return result.isValid;
}

/**
 * Full verify - check everything
 */
export function verifyFull(linkResult: LinkResult): VerifyResult {
  return verify(linkResult, {
    checkCycles: true,
    checkDependencies: true,
    checkTypes: true,
    checkPolicies: true,
    checkEffects: true,
    checkActions: true,
    checkProvenance: true,
    checkPaths: true,
  });
}

/**
 * Verify fragments directly (without link result)
 */
export function verifyFragments(
  fragments: Fragment[],
  options: VerifyOptions = {}
): VerifyResult {
  const linkResult: LinkResult = {
    fragments,
    conflicts: [],
    issues: [],
    version: 'verify-fragments',
  };
  return verify(linkResult, options);
}

/**
 * Get all blocking issues from a verify result
 */
export function getVerifyBlockingIssues(result: VerifyResult): Issue[] {
  return result.issues.filter((i) => i.severity === 'error');
}

/**
 * Check if verify result has blocking issues
 */
export function hasVerifyBlockingIssues(result: VerifyResult): boolean {
  return result.errorCount > 0;
}

/**
 * Get verify result summary
 */
export function getVerifyResultSummary(result: VerifyResult): {
  total: number;
  errors: number;
  warnings: number;
  isValid: boolean;
} {
  return {
    total: result.issues.length,
    errors: result.errorCount,
    warnings: result.warningCount,
    isValid: result.isValid,
  };
}

// ============================================================================
// Re-export commonly used functions
// ============================================================================
// Note: sortIssues, getBlockingIssues are NOT re-exported to avoid conflict with linker/index.ts
// Use them directly from verifier/issue-mapper.ts if needed with Issue[] signature
// Note: hasBlockingIssues and getIssueSummary are already exported above from issue-mapper.js

export { hasCycles, hasAllDependencies };

export default {
  verify,
  verifyFull,
  verifyFragments,
  quickVerifyIsValid,
  getVerifyBlockingIssues,
  hasVerifyBlockingIssues,
  getVerifyResultSummary,
  hasBlockingIssues,
  getBlockingIssues,
  getIssueSummary,
  hasCycles,
  hasAllDependencies,
  sortIssues,
};
