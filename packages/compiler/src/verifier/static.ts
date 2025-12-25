/**
 * Static Validation - Static analysis rules
 *
 * This module provides static validation rules:
 * 1. Path format validation
 * 2. Type consistency
 * 3. Policy validation (precondition paths)
 * 4. Effect validation (target paths)
 * 5. Action completeness
 * 6. Provenance validation
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type {
  Fragment,
  FragmentId,
  SchemaFragment,
  SourceFragment,
  DerivedFragment,
  ActionFragment,
  PolicyFragment,
  EffectFragment,
} from '../types/fragment.js';
import type { LinkResult, DomainDraft } from '../types/session.js';
import type { Issue } from '../types/issue.js';
import {
  createInvalidPathIssue,
  createInvalidPreconditionPathIssue,
  createActionVerbRequiredIssue,
  createMissingProvenanceIssue,
  createEffectRiskTooHighIssue,
  createInvalidEffectIssue,
  createIssueFromCode,
} from './issue-mapper.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Static validation options
 */
export interface StaticValidationOptions {
  /** Validate path formats (default: true) */
  validatePaths?: boolean;

  /** Validate type consistency (default: true) */
  validateTypes?: boolean;

  /** Validate policies (default: true) */
  validatePolicies?: boolean;

  /** Validate effects (default: true) */
  validateEffects?: boolean;

  /** Validate actions (default: true) */
  validateActions?: boolean;

  /** Validate provenance (default: true) */
  validateProvenance?: boolean;

  /** Maximum allowed effect risk level (default: 'high') */
  maxEffectRisk?: 'low' | 'medium' | 'high' | 'critical';

  /** Require action verb in semantic metadata (default: false) */
  requireActionVerb?: boolean;
}

/**
 * Validation context with all needed data
 */
export interface ValidationContext {
  /** All fragments */
  fragments: Fragment[];

  /** Set of all provided paths */
  providedPaths: Set<string>;

  /** Set of all provided action IDs */
  providedActions: Set<string>;

  /** Domain draft (if built) */
  domain?: DomainDraft;

  /** Options */
  options: Required<StaticValidationOptions>;
}

/**
 * Static validation result
 */
export interface StaticValidationResult {
  /** Whether validation passed */
  isValid: boolean;

  /** All issues found */
  issues: Issue[];

  /** Count of errors */
  errorCount: number;

  /** Count of warnings */
  warningCount: number;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: Required<StaticValidationOptions> = {
  validatePaths: true,
  validateTypes: true,
  validatePolicies: true,
  validateEffects: true,
  validateActions: true,
  validateProvenance: true,
  maxEffectRisk: 'high',
  requireActionVerb: false,
};

// ============================================================================
// Path Validation
// ============================================================================

/** Valid path namespace prefixes */
const VALID_NAMESPACES = ['data', 'state', 'derived', 'async'];

/** Path format regex */
const PATH_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;

/**
 * Validate a single path format
 */
function isValidPathFormat(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }
  return PATH_REGEX.test(path);
}

/**
 * Check if path has valid namespace
 */
function hasValidNamespace(path: string): boolean {
  const parts = path.split('.');
  const namespace = parts[0];
  if (parts.length < 2 || !namespace) {
    return false;
  }
  return VALID_NAMESPACES.includes(namespace);
}

/**
 * Validate paths in fragments
 *
 * @param ctx - Validation context
 * @returns Issues found
 */
export function validatePaths(ctx: ValidationContext): Issue[] {
  const issues: Issue[] = [];

  for (const fragment of ctx.fragments) {
    // Validate provides paths
    for (const provide of fragment.provides) {
      // Skip action: and effect: prefixes
      if (provide.startsWith('action:') || provide.startsWith('effect:')) {
        continue;
      }

      if (!isValidPathFormat(provide)) {
        issues.push(createInvalidPathIssue(provide, 'invalid path format', fragment.id));
      } else if (!hasValidNamespace(provide)) {
        issues.push(
          createInvalidPathIssue(
            provide,
            `missing or invalid namespace (expected: ${VALID_NAMESPACES.join(', ')})`,
            fragment.id
          )
        );
      }
    }

    // Validate requires paths
    for (const require of fragment.requires) {
      // Skip action: and effect: prefixes
      if (require.startsWith('action:') || require.startsWith('effect:')) {
        continue;
      }

      if (!isValidPathFormat(require)) {
        issues.push(createInvalidPathIssue(require, 'invalid path format in requires', fragment.id));
      }
    }
  }

  return issues;
}

// ============================================================================
// Type Validation
// ============================================================================

/** Valid schema field types */
const VALID_FIELD_TYPES = [
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'null',
  'unknown',
  'any',
];

/**
 * Validate type consistency in fragments
 *
 * @param ctx - Validation context
 * @returns Issues found
 */
export function validateTypes(ctx: ValidationContext): Issue[] {
  const issues: Issue[] = [];

  // Check for type consistency across fragments
  const typeByPath = new Map<string, { type: string; fragmentId: string }>();

  for (const fragment of ctx.fragments) {
    if (fragment.kind === 'SchemaFragment') {
      const schemaFrag = fragment as SchemaFragment;
      for (const field of schemaFrag.fields) {
        // Check if field type is valid
        const fieldType = field.type?.toLowerCase() ?? 'unknown';
        if (!VALID_FIELD_TYPES.includes(fieldType)) {
          issues.push(
            createIssueFromCode(
              'SCHEMA_MISMATCH',
              `Unknown field type "${field.type}" at path "${field.path}"`,
              {
                path: field.path as SemanticPath,
                relatedFragments: [fragment.id],
                context: { fieldType: field.type },
                severity: 'warning',
              }
            )
          );
        }

        // Check for type conflicts
        const existing = typeByPath.get(field.path);
        if (existing && existing.type !== fieldType) {
          issues.push(
            createIssueFromCode(
              'SCHEMA_MISMATCH',
              `Type conflict at "${field.path}": "${existing.type}" (from ${existing.fragmentId}) vs "${fieldType}" (from ${fragment.id})`,
              {
                path: field.path as SemanticPath,
                relatedFragments: [existing.fragmentId, fragment.id],
              }
            )
          );
        } else {
          typeByPath.set(field.path, { type: fieldType, fragmentId: fragment.id });
        }
      }
    }

    if (fragment.kind === 'SourceFragment') {
      const sourceFrag = fragment as SourceFragment;
      const fieldType = (sourceFrag.schema?.type ?? sourceFrag.semantic.type ?? 'unknown').toLowerCase();
      if (!VALID_FIELD_TYPES.includes(fieldType)) {
        issues.push(
          createIssueFromCode(
            'SCHEMA_MISMATCH',
            `Unknown source type "${sourceFrag.schema?.type ?? sourceFrag.semantic.type}" at path "${sourceFrag.path}"`,
            {
              path: sourceFrag.path as SemanticPath,
              relatedFragments: [fragment.id],
              severity: 'warning',
            }
          )
        );
      }
    }
  }

  return issues;
}

// ============================================================================
// Policy Validation
// ============================================================================

/**
 * Validate policies in fragments
 *
 * @param ctx - Validation context
 * @returns Issues found
 */
export function validatePolicies(ctx: ValidationContext): Issue[] {
  const issues: Issue[] = [];

  for (const fragment of ctx.fragments) {
    if (fragment.kind === 'PolicyFragment') {
      const policyFrag = fragment as PolicyFragment;

      // Validate precondition paths exist
      if (policyFrag.preconditions) {
        for (const precond of policyFrag.preconditions) {
          if (precond.path && !ctx.providedPaths.has(precond.path)) {
            const targetId =
              policyFrag.target.kind === 'action'
                ? policyFrag.target.actionId
                : policyFrag.target.path;

            issues.push(
              createInvalidPreconditionPathIssue(
                targetId as string,
                precond.path as SemanticPath,
                fragment.id
              )
            );
          }
        }
      }

      // Validate field policy paths
      if (policyFrag.fieldPolicy) {
        const fp = policyFrag.fieldPolicy;

        // Check relevantWhen paths
        if (fp.relevantWhen) {
          for (const cond of fp.relevantWhen) {
            if (cond.path && !ctx.providedPaths.has(cond.path)) {
              issues.push(
                createInvalidPreconditionPathIssue(
                  `field:${policyFrag.target}`,
                  cond.path as SemanticPath,
                  fragment.id
                )
              );
            }
          }
        }

        // Check editableWhen paths
        if (fp.editableWhen) {
          for (const cond of fp.editableWhen) {
            if (cond.path && !ctx.providedPaths.has(cond.path)) {
              issues.push(
                createInvalidPreconditionPathIssue(
                  `field:${policyFrag.target}`,
                  cond.path as SemanticPath,
                  fragment.id
                )
              );
            }
          }
        }
      }
    }

    // Validate action preconditions
    if (fragment.kind === 'ActionFragment') {
      const actionFrag = fragment as ActionFragment;

      if (actionFrag.preconditions) {
        for (const precond of actionFrag.preconditions) {
          if (precond.path && !ctx.providedPaths.has(precond.path)) {
            issues.push(
              createInvalidPreconditionPathIssue(
                actionFrag.actionId,
                precond.path as SemanticPath,
                fragment.id
              )
            );
          }
        }
      }
    }
  }

  return issues;
}

// ============================================================================
// Effect Validation
// ============================================================================

/** Risk level ordering */
const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

/**
 * Get risk level value for comparison
 */
function getRiskValue(risk: string): number {
  const idx = RISK_LEVELS.indexOf(risk.toLowerCase());
  return idx === -1 ? 0 : idx;
}

/**
 * Validate effects in fragments
 *
 * @param ctx - Validation context
 * @returns Issues found
 */
export function validateEffects(ctx: ValidationContext): Issue[] {
  const issues: Issue[] = [];
  const maxRiskValue = getRiskValue(ctx.options.maxEffectRisk);

  for (const fragment of ctx.fragments) {
    if (fragment.kind === 'EffectFragment') {
      const effectFrag = fragment as EffectFragment;

      // Check risk level
      if (effectFrag.risk) {
        const riskValue = getRiskValue(effectFrag.risk);
        if (riskValue > maxRiskValue) {
          issues.push(
            createEffectRiskTooHighIssue(
              fragment.id,
              effectFrag.risk,
              ctx.options.maxEffectRisk
            )
          );
        }
      }

      // Validate effect structure
      if (effectFrag.effect) {
        const effectIssues = validateEffectStructure(effectFrag.effect, fragment.id, ctx);
        issues.push(...effectIssues);
      }
    }

    // Also check effects in ActionFragments
    if (fragment.kind === 'ActionFragment') {
      const actionFrag = fragment as ActionFragment;

      if (actionFrag.effect) {
        const effectIssues = validateEffectStructure(actionFrag.effect, fragment.id, ctx);
        issues.push(...effectIssues);
      }

      // Check risk level
      if (actionFrag.risk) {
        const riskValue = getRiskValue(actionFrag.risk);
        if (riskValue > maxRiskValue) {
          issues.push(
            createEffectRiskTooHighIssue(
              fragment.id,
              actionFrag.risk,
              ctx.options.maxEffectRisk
            )
          );
        }
      }
    }
  }

  return issues;
}

/**
 * Validate effect structure recursively
 */
function validateEffectStructure(
  effect: any,
  fragmentId: FragmentId,
  ctx: ValidationContext
): Issue[] {
  const issues: Issue[] = [];

  if (!effect || typeof effect !== 'object') {
    return issues;
  }

  const tag = effect._tag;

  switch (tag) {
    case 'SetValue':
    case 'SetState':
      // Validate target path exists
      if (effect.path && !ctx.providedPaths.has(effect.path)) {
        issues.push(
          createIssueFromCode(
            'INVALID_EFFECT',
            `Effect targets undefined path "${effect.path}"`,
            {
              path: effect.path as SemanticPath,
              relatedFragments: [fragmentId],
            }
          )
        );
      }
      break;

    case 'Sequence':
    case 'Parallel':
      // Validate child effects
      if (Array.isArray(effect.effects)) {
        for (const childEffect of effect.effects) {
          const childIssues = validateEffectStructure(childEffect, fragmentId, ctx);
          issues.push(...childIssues);
        }
      }
      break;

    case 'Conditional':
      // Validate then/else branches
      if (effect.then) {
        const thenIssues = validateEffectStructure(effect.then, fragmentId, ctx);
        issues.push(...thenIssues);
      }
      if (effect.else) {
        const elseIssues = validateEffectStructure(effect.else, fragmentId, ctx);
        issues.push(...elseIssues);
      }
      break;

    case 'Catch':
      // Validate try/catch branches
      if (effect.try) {
        const tryIssues = validateEffectStructure(effect.try, fragmentId, ctx);
        issues.push(...tryIssues);
      }
      if (effect.catch) {
        const catchIssues = validateEffectStructure(effect.catch, fragmentId, ctx);
        issues.push(...catchIssues);
      }
      break;
  }

  return issues;
}

// ============================================================================
// Action Validation
// ============================================================================

/**
 * Validate actions in fragments
 *
 * @param ctx - Validation context
 * @returns Issues found
 */
export function validateActions(ctx: ValidationContext): Issue[] {
  const issues: Issue[] = [];

  for (const fragment of ctx.fragments) {
    if (fragment.kind === 'ActionFragment') {
      const actionFrag = fragment as ActionFragment;

      // Check for action verb in semantic metadata
      if (ctx.options.requireActionVerb) {
        if (!actionFrag.semantic?.verb) {
          issues.push(createActionVerbRequiredIssue(actionFrag.actionId, fragment.id));
        }
      }

      // Check that action has either effect or effectRef
      if (!actionFrag.effect && !actionFrag.effectRef) {
        issues.push(
          createInvalidEffectIssue(
            actionFrag.actionId,
            'Action must have either effect or effectRef',
            fragment.id
          )
        );
      }

      // Check effectRef points to valid effect
      if (actionFrag.effectRef) {
        const effectProvide = `effect:${actionFrag.effectRef}`;
        const hasEffect = ctx.fragments.some((f) => f.provides.includes(effectProvide));
        if (!hasEffect) {
          issues.push(
            createIssueFromCode(
              'UNRESOLVED_REFERENCE',
              `Action "${actionFrag.actionId}" references undefined effect "${actionFrag.effectRef}"`,
              {
                relatedFragments: [fragment.id],
                context: { effectRef: actionFrag.effectRef },
              }
            )
          );
        }
      }
    }
  }

  return issues;
}

// ============================================================================
// Provenance Validation
// ============================================================================

/**
 * Validate provenance in fragments
 *
 * @param fragments - Fragments to validate
 * @returns Issues found
 */
export function validateProvenance(fragments: Fragment[]): Issue[] {
  const issues: Issue[] = [];

  for (const fragment of fragments) {
    // Check that origin exists
    if (!fragment.origin) {
      issues.push(createMissingProvenanceIssue(fragment.id));
      continue;
    }

    // Check that origin has location
    if (!fragment.origin.location) {
      issues.push(
        createIssueFromCode(
          'INVALID_PROVENANCE',
          `Fragment "${fragment.id}" has origin without location`,
          {
            relatedFragments: [fragment.id],
          }
        )
      );
    }

    // Check that origin has artifactId
    if (!fragment.origin.artifactId) {
      issues.push(
        createIssueFromCode(
          'INVALID_PROVENANCE',
          `Fragment "${fragment.id}" has origin without artifactId`,
          {
            relatedFragments: [fragment.id],
          }
        )
      );
    }
  }

  return issues;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Build validation context
 */
function buildValidationContext(
  linkResult: LinkResult,
  options: StaticValidationOptions
): ValidationContext {
  const providedPaths = new Set<string>();
  const providedActions = new Set<string>();

  for (const fragment of linkResult.fragments) {
    for (const provide of fragment.provides) {
      if (provide.startsWith('action:')) {
        providedActions.add(provide.slice(7));
      } else if (!provide.startsWith('effect:')) {
        providedPaths.add(provide);
      }
    }
  }

  return {
    fragments: linkResult.fragments,
    providedPaths,
    providedActions,
    domain: linkResult.domain,
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

/**
 * Run static validation on a link result
 *
 * @param linkResult - Link result to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validateStatic(
  linkResult: LinkResult,
  options: StaticValidationOptions = {}
): StaticValidationResult {
  const ctx = buildValidationContext(linkResult, options);
  const issues: Issue[] = [];

  // Run enabled validations
  if (ctx.options.validatePaths) {
    issues.push(...validatePaths(ctx));
  }

  if (ctx.options.validateTypes) {
    issues.push(...validateTypes(ctx));
  }

  if (ctx.options.validatePolicies) {
    issues.push(...validatePolicies(ctx));
  }

  if (ctx.options.validateEffects) {
    issues.push(...validateEffects(ctx));
  }

  if (ctx.options.validateActions) {
    issues.push(...validateActions(ctx));
  }

  if (ctx.options.validateProvenance) {
    issues.push(...validateProvenance(ctx.fragments));
  }

  // Count errors and warnings
  let errorCount = 0;
  let warningCount = 0;

  for (const issue of issues) {
    if (issue.severity === 'error') {
      errorCount++;
    } else if (issue.severity === 'warning') {
      warningCount++;
    }
  }

  return {
    isValid: errorCount === 0,
    issues,
    errorCount,
    warningCount,
  };
}

/**
 * Validate fragments directly (without LinkResult)
 */
export function validateFragmentsStatic(
  fragments: Fragment[],
  options: StaticValidationOptions = {}
): StaticValidationResult {
  const linkResult: LinkResult = {
    fragments,
    conflicts: [],
    issues: [],
    version: 'static-validation',
  };

  return validateStatic(linkResult, options);
}

export default {
  validatePaths,
  validateTypes,
  validatePolicies,
  validateEffects,
  validateActions,
  validateProvenance,
  validateStatic,
  validateFragmentsStatic,
};
