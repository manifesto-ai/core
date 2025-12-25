/**
 * Normalizer - Path Canonicalization and ActionId Separation
 *
 * Implements Principle A: ActionId vs SemanticPath must be separated.
 * - SemanticPaths: data.*, derived.*, state.*, async.*
 * - ActionIds: standalone identifiers (not paths)
 *
 * This module normalizes fragment provides/requires to canonical forms
 * and separates paths from action identifiers for proper conflict detection.
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type {
  Fragment,
  FragmentId,
  ActionFragment,
  DerivedFragment,
  SchemaFragment,
  SourceFragment,
} from '../types/fragment.js';
import type { Issue } from '../types/issue.js';
import { createIssueId } from '../types/issue.js';

// ============================================================================
// Types (Principle A: ActionId vs SemanticPath separation)
// ============================================================================

/**
 * Valid path prefixes for semantic paths
 */
export const VALID_PATH_PREFIXES = ['data.', 'derived.', 'state.', 'async.'] as const;
export type ValidPathPrefix = (typeof VALID_PATH_PREFIXES)[number];

/**
 * Result of normalizing a single path
 */
export interface PathNormalizationResult {
  /** Original string before normalization */
  original: string;
  /** Normalized semantic path */
  normalized: SemanticPath;
  /** Whether the path was modified */
  wasModified: boolean;
  /** Rule that was applied (if modified) */
  appliedRule?: string;
}

/**
 * Normalized provides - separates paths from action IDs (Principle A)
 */
export interface NormalizedProvides {
  /** Semantic paths: data.*, derived.*, state.*, async.* */
  paths: SemanticPath[];
  /** Action IDs (not paths, just identifiers) */
  actions: string[];
}

/**
 * Normalization context for customization
 */
export interface NormalizerContext {
  /** Default namespace for unqualified paths */
  defaultNamespace?: 'data' | 'state';
  /** Custom normalization rules */
  customRules?: PathNormalizationRule[];
  /** Whether to report warnings for ambiguous paths */
  reportWarnings?: boolean;
}

/**
 * Custom path normalization rule
 */
export interface PathNormalizationRule {
  /** Pattern to match */
  pattern: RegExp;
  /** Normalization function */
  normalize: (path: string) => SemanticPath;
  /** Rule name for reporting */
  name: string;
}

/**
 * Result of normalizing all fragments
 */
export interface NormalizationBatchResult {
  /** Normalized fragments (with canonical provides/requires) */
  fragments: Fragment[];
  /** All provided paths (across all fragments) */
  allProvidedPaths: Set<SemanticPath>;
  /** All provided action IDs (across all fragments) */
  allProvidedActions: Set<string>;
  /** All required paths (across all fragments) */
  allRequiredPaths: Set<SemanticPath>;
  /** Normalization issues */
  issues: Issue[];
  /** Map from fragment ID to its normalized provides */
  normalizedProvidesMap: Map<FragmentId, NormalizedProvides>;
}

// ============================================================================
// Path Normalization Functions
// ============================================================================

/**
 * Check if a string is a valid semantic path
 */
export function isSemanticPath(value: string): boolean {
  return VALID_PATH_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/**
 * Check if a string looks like an action ID (not a path)
 *
 * Action IDs are simple identifiers without dots or with action: prefix
 */
export function isActionId(value: string): boolean {
  // Explicit action: prefix
  if (value.startsWith('action:')) {
    return true;
  }

  // Effect reference
  if (value.startsWith('effect:')) {
    return true;
  }

  // Simple identifier without dots (likely action ID)
  if (!value.includes('.')) {
    return true;
  }

  // Has dots but doesn't start with valid path prefix (likely not a semantic path)
  return !isSemanticPath(value);
}

/**
 * Normalize a single path to canonical form
 *
 * @param path - The path to normalize
 * @param context - Normalization context
 * @returns PathNormalizationResult
 */
export function normalizePath(
  path: string,
  context: NormalizerContext = {}
): PathNormalizationResult {
  const { defaultNamespace = 'data', customRules = [] } = context;
  const trimmed = path.trim();

  // Already canonical
  if (isSemanticPath(trimmed)) {
    return {
      original: path,
      normalized: trimmed as SemanticPath,
      wasModified: trimmed !== path,
      appliedRule: trimmed !== path ? 'trim' : undefined,
    };
  }

  // Apply custom rules first
  for (const rule of customRules) {
    if (rule.pattern.test(trimmed)) {
      const normalized = rule.normalize(trimmed);
      return {
        original: path,
        normalized,
        wasModified: true,
        appliedRule: rule.name,
      };
    }
  }

  // Default: add namespace prefix
  const normalized = `${defaultNamespace}.${trimmed}` as SemanticPath;
  return {
    original: path,
    normalized,
    wasModified: true,
    appliedRule: `add_${defaultNamespace}_prefix`,
  };
}

/**
 * Extract action ID from a provides string
 *
 * Strips the 'action:' prefix if present
 */
export function extractActionId(value: string): string {
  if (value.startsWith('action:')) {
    return value.slice(7);
  }
  return value;
}

/**
 * Separate and normalize a fragment's provides array (Principle A)
 *
 * @param fragment - The fragment to process
 * @param context - Normalization context
 * @returns NormalizedProvides
 */
export function normalizeFragmentProvides(
  fragment: Fragment,
  context: NormalizerContext = {}
): NormalizedProvides {
  const paths: SemanticPath[] = [];
  const actions: string[] = [];

  for (const provide of fragment.provides) {
    // ActionFragment provides are always action IDs
    if (fragment.kind === 'ActionFragment') {
      // ActionFragment provides its actionId
      const actionFrag = fragment as ActionFragment;
      if (provide === actionFrag.actionId || provide === `action:${actionFrag.actionId}`) {
        actions.push(extractActionId(provide));
      } else if (isSemanticPath(provide)) {
        // Some actions may also provide paths
        paths.push(provide as SemanticPath);
      } else {
        actions.push(extractActionId(provide));
      }
      continue;
    }

    // DerivedFragment provides are always paths (derived.*)
    if (fragment.kind === 'DerivedFragment') {
      const derivedFrag = fragment as DerivedFragment;
      // Ensure derived prefix
      if (provide === derivedFrag.path) {
        if (!provide.startsWith('derived.')) {
          paths.push(`derived.${provide}` as SemanticPath);
        } else {
          paths.push(provide as SemanticPath);
        }
      } else {
        const result = normalizePath(provide, { ...context, defaultNamespace: 'data' });
        if (isSemanticPath(result.normalized)) {
          paths.push(result.normalized);
        }
      }
      continue;
    }

    // SchemaFragment provides are data/state paths
    if (fragment.kind === 'SchemaFragment') {
      const schemaFrag = fragment as SchemaFragment;
      const namespace = schemaFrag.namespace;
      if (isSemanticPath(provide)) {
        paths.push(provide as SemanticPath);
      } else {
        paths.push(`${namespace}.${provide}` as SemanticPath);
      }
      continue;
    }

    // SourceFragment provides are data paths
    if (fragment.kind === 'SourceFragment') {
      const sourceFrag = fragment as SourceFragment;
      if (isSemanticPath(provide)) {
        paths.push(provide as SemanticPath);
      } else if (provide === sourceFrag.path) {
        if (!sourceFrag.path.startsWith('data.')) {
          paths.push(`data.${sourceFrag.path}` as SemanticPath);
        } else {
          paths.push(sourceFrag.path as SemanticPath);
        }
      } else {
        const result = normalizePath(provide, context);
        paths.push(result.normalized);
      }
      continue;
    }

    // EffectFragment provides are effect: references
    if (fragment.kind === 'EffectFragment') {
      if (provide.startsWith('effect:') || !provide.includes('.')) {
        // Effect reference, not a path - skip for now (effects don't "provide" in the DAG sense)
        continue;
      }
      // Effect may provide paths through SetValue targets
      if (isSemanticPath(provide)) {
        paths.push(provide as SemanticPath);
      }
      continue;
    }

    // PolicyFragment provides policy targets
    if (fragment.kind === 'PolicyFragment') {
      // Policies don't provide paths, they reference them
      continue;
    }

    // ExpressionFragment provides expression references
    if (fragment.kind === 'ExpressionFragment') {
      // Expressions can be referenced by name but don't provide semantic paths
      continue;
    }

    // StatementFragment
    if (fragment.kind === 'StatementFragment') {
      // Statements don't provide paths directly
      continue;
    }

    // Default: try to classify
    if (isSemanticPath(provide)) {
      paths.push(provide as SemanticPath);
    } else if (isActionId(provide)) {
      actions.push(extractActionId(provide));
    } else {
      // Assume it's a path that needs normalization
      const result = normalizePath(provide, context);
      paths.push(result.normalized);
    }
  }

  return { paths, actions };
}

/**
 * Normalize a fragment's requires array
 *
 * @param fragment - The fragment to process
 * @param context - Normalization context
 * @returns Normalized requires paths
 */
export function normalizeFragmentRequires(
  fragment: Fragment,
  context: NormalizerContext = {}
): SemanticPath[] {
  return fragment.requires.map((req) => {
    if (isSemanticPath(req)) {
      return req as SemanticPath;
    }
    const result = normalizePath(req, context);
    return result.normalized;
  });
}

// ============================================================================
// Batch Normalization (Principle E: Deterministic)
// ============================================================================

/**
 * Sort fragments by stableId for deterministic processing (Principle E)
 */
export function sortFragmentsByStableId(fragments: Fragment[]): Fragment[] {
  return [...fragments].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Normalize all fragments in a batch
 *
 * This is the main entry point for normalization.
 * - Sorts fragments by stableId for determinism (Principle E)
 * - Separates paths from actions (Principle A)
 * - Collects all provided/required paths
 *
 * @param fragments - Fragments to normalize
 * @param context - Normalization context
 * @returns NormalizationBatchResult
 */
export function normalizeAllFragments(
  fragments: Fragment[],
  context: NormalizerContext = {}
): NormalizationBatchResult {
  const issues: Issue[] = [];
  const allProvidedPaths = new Set<SemanticPath>();
  const allProvidedActions = new Set<string>();
  const allRequiredPaths = new Set<SemanticPath>();
  const normalizedProvidesMap = new Map<FragmentId, NormalizedProvides>();

  // Sort for determinism (Principle E)
  const sortedFragments = sortFragmentsByStableId(fragments);

  // Process each fragment
  const normalizedFragments = sortedFragments.map((fragment) => {
    // Normalize provides (Principle A: separate paths from actions)
    const normalizedProvides = normalizeFragmentProvides(fragment, context);
    normalizedProvidesMap.set(fragment.id, normalizedProvides);

    // Collect all provided paths and actions
    for (const path of normalizedProvides.paths) {
      allProvidedPaths.add(path);
    }
    for (const actionId of normalizedProvides.actions) {
      allProvidedActions.add(actionId);
    }

    // Normalize requires
    const normalizedRequires = normalizeFragmentRequires(fragment, context);
    for (const path of normalizedRequires) {
      allRequiredPaths.add(path);
    }

    // Create normalized fragment with updated provides/requires
    // Note: We rebuild the provides array from normalized components
    const newProvides: string[] = [
      ...normalizedProvides.paths,
      ...normalizedProvides.actions.map((a) => `action:${a}`),
    ];

    return {
      ...fragment,
      provides: newProvides,
      requires: normalizedRequires,
    } as Fragment;
  });

  // Check for invalid paths and create warnings
  if (context.reportWarnings) {
    for (const fragment of normalizedFragments) {
      for (const provide of fragment.provides) {
        if (!isSemanticPath(provide) && !provide.startsWith('action:')) {
          issues.push({
            id: createIssueId(),
            code: 'INVALID_PATH',
            severity: 'warning',
            message: `Fragment "${fragment.id}" provides non-standard path "${provide}"`,
            relatedFragments: [fragment.id],
            context: { provide },
          });
        }
      }
    }
  }

  return {
    fragments: normalizedFragments,
    allProvidedPaths,
    allProvidedActions,
    allRequiredPaths,
    issues,
    normalizedProvidesMap,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the namespace from a semantic path
 */
export function getPathNamespace(path: SemanticPath): string {
  const dotIndex = path.indexOf('.');
  return dotIndex > 0 ? path.slice(0, dotIndex) : 'data';
}

/**
 * Get the local name from a semantic path (without namespace)
 */
export function getPathLocalName(path: SemanticPath): string {
  const dotIndex = path.indexOf('.');
  return dotIndex > 0 ? path.slice(dotIndex + 1) : path;
}

/**
 * Build a semantic path from namespace and local name
 */
export function buildSemanticPath(namespace: string, localName: string): SemanticPath {
  return `${namespace}.${localName}` as SemanticPath;
}

/**
 * Check if a path is in the data namespace
 */
export function isDataPath(path: SemanticPath): boolean {
  return path.startsWith('data.');
}

/**
 * Check if a path is in the derived namespace
 */
export function isDerivedPath(path: SemanticPath): boolean {
  return path.startsWith('derived.');
}

/**
 * Check if a path is in the state namespace
 */
export function isStatePath(path: SemanticPath): boolean {
  return path.startsWith('state.');
}

/**
 * Check if a path is in the async namespace
 */
export function isAsyncPath(path: SemanticPath): boolean {
  return path.startsWith('async.');
}

export default {
  normalizePath,
  normalizeFragmentProvides,
  normalizeFragmentRequires,
  normalizeAllFragments,
  sortFragmentsByStableId,
  isSemanticPath,
  isActionId,
  extractActionId,
  getPathNamespace,
  getPathLocalName,
  buildSemanticPath,
  isDataPath,
  isDerivedPath,
  isStatePath,
  isAsyncPath,
};
