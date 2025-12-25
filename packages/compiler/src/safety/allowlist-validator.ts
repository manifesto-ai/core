/**
 * Allowlist Validator - Effect and Endpoint Allowlist Enforcement
 *
 * Implements EffectPolicy allowlist enforcement:
 * - allowedEndpoints: Restrict which API endpoints can be called
 * - allowedEffectTypes: Restrict which effect types can be used
 *
 * CRITICAL: Violations are always blocking errors.
 */

import type { Fragment, EffectFragment, ActionFragment } from '../types/fragment.js';
import type { EffectPolicy } from '../types/session.js';
import type { Issue } from '../types/issue.js';
import { isEffectFragment, isActionFragment } from '../types/fragment.js';
import { endpointNotAllowedIssue, effectTypeNotAllowedIssue } from '../types/issue.js';

/**
 * Allowlist violation details
 */
export interface AllowlistViolation {
  /** Fragment that violated the allowlist */
  fragmentId: string;
  /** Type of violation */
  violationType: 'endpoint' | 'effectType';
  /** The value that was not allowed */
  value: string;
  /** The allowed values */
  allowedValues: string[];
}

/**
 * Extract effect type from an Effect AST node
 */
function extractEffectType(effect: unknown): string | undefined {
  if (!Array.isArray(effect) || effect.length === 0) {
    return undefined;
  }

  const [op] = effect;
  if (typeof op === 'string') {
    return op;
  }

  return undefined;
}

/**
 * Extract endpoint from an apiCall Effect
 */
function extractEndpoint(effect: unknown): string | undefined {
  if (!Array.isArray(effect) || effect.length < 2) {
    return undefined;
  }

  const [op, endpoint] = effect;
  if (op === 'apiCall' && typeof endpoint === 'string') {
    return endpoint;
  }

  // Check nested effects (e.g., sequence)
  if (op === 'sequence' && Array.isArray(effect[1])) {
    for (const nested of effect[1] as unknown[]) {
      const endpoint = extractEndpoint(nested);
      if (endpoint) {
        return endpoint;
      }
    }
  }

  return undefined;
}

/**
 * Extract all endpoints from an Effect AST (recursively)
 */
function extractAllEndpoints(effect: unknown): string[] {
  const endpoints: string[] = [];

  if (!Array.isArray(effect) || effect.length === 0) {
    return endpoints;
  }

  const [op] = effect;

  if (op === 'apiCall' && typeof effect[1] === 'string') {
    endpoints.push(effect[1]);
  }

  // Recurse into nested effects
  if (op === 'sequence' && Array.isArray(effect[1])) {
    for (const nested of effect[1] as unknown[]) {
      endpoints.push(...extractAllEndpoints(nested));
    }
  }

  if (op === 'parallel' && Array.isArray(effect[1])) {
    for (const nested of effect[1] as unknown[]) {
      endpoints.push(...extractAllEndpoints(nested));
    }
  }

  if (op === 'conditional' && Array.isArray(effect)) {
    // [conditional, condition, thenEffect, elseEffect]
    if (effect[2]) endpoints.push(...extractAllEndpoints(effect[2]));
    if (effect[3]) endpoints.push(...extractAllEndpoints(effect[3]));
  }

  return endpoints;
}

/**
 * Extract all effect types from an Effect AST (recursively)
 */
function extractAllEffectTypes(effect: unknown): string[] {
  const types: string[] = [];

  if (!Array.isArray(effect) || effect.length === 0) {
    return types;
  }

  const [op] = effect;
  if (typeof op === 'string') {
    types.push(op);
  }

  // Recurse into nested effects
  if (op === 'sequence' && Array.isArray(effect[1])) {
    for (const nested of effect[1] as unknown[]) {
      types.push(...extractAllEffectTypes(nested));
    }
  }

  if (op === 'parallel' && Array.isArray(effect[1])) {
    for (const nested of effect[1] as unknown[]) {
      types.push(...extractAllEffectTypes(nested));
    }
  }

  if (op === 'conditional' && Array.isArray(effect)) {
    if (effect[2]) types.push(...extractAllEffectTypes(effect[2]));
    if (effect[3]) types.push(...extractAllEffectTypes(effect[3]));
  }

  return types;
}

/**
 * Validate a single fragment against the allowlist policy
 */
function validateFragmentAllowlist(
  fragment: Fragment,
  policy: EffectPolicy
): AllowlistViolation[] {
  const violations: AllowlistViolation[] = [];

  let effect: unknown;

  if (isEffectFragment(fragment)) {
    effect = fragment.effect;
  } else if (isActionFragment(fragment)) {
    effect = fragment.effect;
  } else {
    return violations;
  }

  if (!effect) {
    return violations;
  }

  // Check endpoint allowlist
  if (policy.allowedEndpoints && policy.allowedEndpoints.length > 0) {
    const endpoints = extractAllEndpoints(effect);
    for (const endpoint of endpoints) {
      if (!policy.allowedEndpoints.includes(endpoint)) {
        violations.push({
          fragmentId: fragment.id,
          violationType: 'endpoint',
          value: endpoint,
          allowedValues: policy.allowedEndpoints,
        });
      }
    }
  }

  // Check effect type allowlist
  if (policy.allowedEffectTypes && policy.allowedEffectTypes.length > 0) {
    const types = extractAllEffectTypes(effect);
    for (const type of types) {
      if (!policy.allowedEffectTypes.includes(type)) {
        violations.push({
          fragmentId: fragment.id,
          violationType: 'effectType',
          value: type,
          allowedValues: policy.allowedEffectTypes,
        });
      }
    }
  }

  return violations;
}

/**
 * Validate all fragments against the allowlist policy
 */
export function validateAllowlist(
  fragments: Fragment[],
  policy: EffectPolicy
): AllowlistViolation[] {
  const violations: AllowlistViolation[] = [];

  // Skip if no allowlist is configured
  if (!policy.allowedEndpoints && !policy.allowedEffectTypes) {
    return violations;
  }

  for (const fragment of fragments) {
    violations.push(...validateFragmentAllowlist(fragment, policy));
  }

  return violations;
}

/**
 * Generate issues from allowlist violations
 */
export function generateAllowlistIssues(
  fragments: Fragment[],
  policy: EffectPolicy
): Issue[] {
  const violations = validateAllowlist(fragments, policy);
  const issues: Issue[] = [];

  for (const violation of violations) {
    if (violation.violationType === 'endpoint') {
      issues.push(
        endpointNotAllowedIssue(
          violation.fragmentId,
          violation.value,
          violation.allowedValues
        )
      );
    } else if (violation.violationType === 'effectType') {
      issues.push(
        effectTypeNotAllowedIssue(
          violation.fragmentId,
          violation.value,
          violation.allowedValues
        )
      );
    }
  }

  return issues;
}

/**
 * Check if any fragments violate the allowlist
 */
export function hasAllowlistViolations(
  fragments: Fragment[],
  policy: EffectPolicy
): boolean {
  return validateAllowlist(fragments, policy).length > 0;
}
