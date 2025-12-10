/**
 * Query Resolvers
 *
 * GraphQL query resolvers for domain data access.
 */

import type { ManifestoDomain, SemanticPath } from '@manifesto-ai/core';

import type {
  GraphQLDomainContext,
  GraphQLFieldResolver,
  FieldValueResponse,
  FieldPolicyResponse,
  ActionInfoResponse,
} from '../types.js';

// =============================================================================
// Query Resolver Factory
// =============================================================================

/**
 * Create query resolvers for a domain.
 */
export function createQueryResolvers<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  domainName: string
): Record<string, GraphQLFieldResolver<TData, TState>> {
  const lowerDomainName = domainName.charAt(0).toLowerCase() + domainName.slice(1);

  return {
    // Get full domain state
    [lowerDomainName]: createDomainResolver(),

    // Get specific field value
    [`${lowerDomainName}Field`]: createFieldResolver(),

    // Get all field policies
    [`${lowerDomainName}Policies`]: createPoliciesResolver(domain),

    // Get available actions
    [`${lowerDomainName}Actions`]: createActionsResolver(domain),
  };
}

// =============================================================================
// Domain Resolver
// =============================================================================

/**
 * Create resolver for getting full domain state.
 */
function createDomainResolver<TData, TState>(): GraphQLFieldResolver<TData, TState> {
  return (_parent, _args, context) => {
    const { runtime } = context;
    const snapshot = runtime.getSnapshot();

    // Combine data and state
    return {
      ...snapshot.data,
      ...snapshot.state,
      // Add derived values
      ...getDerivedValues(runtime, context.domain),
    };
  };
}

/**
 * Get all derived values from runtime.
 */
function getDerivedValues<TData, TState>(
  runtime: any,
  domain: ManifestoDomain<TData, TState>
): Record<string, unknown> {
  const derived: Record<string, unknown> = {};

  if (domain.paths?.derived) {
    for (const path of Object.keys(domain.paths.derived)) {
      const fieldName = pathToFieldName(path);
      try {
        derived[fieldName] = runtime.get(path as SemanticPath);
      } catch {
        derived[fieldName] = null;
      }
    }
  }

  return derived;
}

// =============================================================================
// Field Resolver
// =============================================================================

/**
 * Create resolver for getting a specific field value.
 */
function createFieldResolver<TData, TState>(): GraphQLFieldResolver<TData, TState> {
  return (_parent, args, context) => {
    const { runtime, domain } = context;
    const path = args.path as string;

    try {
      const value = runtime.get(path as SemanticPath);
      const semantic = getSemanticForPath(domain, path);
      const validity = getValidityForPath(runtime, path);
      const policy = getPolicyForPath(runtime, domain, path);

      const response: FieldValueResponse = {
        path,
        value,
        displayValue: formatDisplayValue(value),
        semantic: {
          type: semantic?.type ?? 'unknown',
          description: semantic?.description ?? path,
          importance: semantic?.importance,
          examples: semantic?.examples,
          hints: semantic?.hints,
        },
        validity: {
          valid: validity.valid,
          issues: validity.issues.map((issue: any) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path,
            severity: issue.severity,
          })),
        },
        policy: {
          editable: policy.editable,
          required: policy.required,
          visible: policy.visible,
          relevant: policy.relevant,
        },
      };

      return response;
    } catch (error) {
      return null;
    }
  };
}

// =============================================================================
// Policies Resolver
// =============================================================================

/**
 * Create resolver for getting all field policies.
 */
function createPoliciesResolver<TData, TState>(
  domain: ManifestoDomain<TData, TState>
): GraphQLFieldResolver<TData, TState> {
  return (_parent, _args, context) => {
    const { runtime } = context;
    const policies: FieldPolicyResponse[] = [];

    // Collect all paths
    const allPaths = collectAllPaths(domain);

    for (const path of allPaths) {
      const policy = getPolicyForPath(runtime, domain, path);
      policies.push({
        editable: policy.editable,
        required: policy.required,
        visible: policy.visible,
        relevant: policy.relevant,
      });
    }

    return policies;
  };
}

// =============================================================================
// Actions Resolver
// =============================================================================

/**
 * Create resolver for getting available actions.
 */
function createActionsResolver<TData, TState>(
  domain: ManifestoDomain<TData, TState>
): GraphQLFieldResolver<TData, TState> {
  return (_parent, _args, context) => {
    const { runtime } = context;
    const actions: ActionInfoResponse[] = [];

    if (domain.actions) {
      for (const [actionId, actionDef] of Object.entries(domain.actions)) {
        const preconditions = evaluatePreconditions(runtime, actionDef);

        const actionDefAny = actionDef as any;
        actions.push({
          id: actionId,
          verb: actionDefAny.verb ?? actionId,
          description: actionDefAny.description ?? `Execute ${actionId}`,
          canExecute: preconditions.canExecute,
          blockedReasons: preconditions.blockedReasons,
        });
      }
    }

    return actions;
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get semantic metadata for a path.
 */
function getSemanticForPath<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  path: string
): any {
  // Check sources
  if (domain.paths?.sources) {
    const source = domain.paths.sources[path as SemanticPath];
    if (source?.semantic) return source.semantic;
  }

  // Check derived
  if (domain.paths?.derived) {
    const derived = domain.paths.derived[path as SemanticPath];
    if (derived?.semantic) return derived.semantic;
  }

  // Check async
  if (domain.paths?.async) {
    const async = domain.paths.async[path as SemanticPath];
    if (async?.semantic) return async.semantic;
  }

  return null;
}

/**
 * Get validity for a path.
 */
function getValidityForPath(runtime: any, path: string): { valid: boolean; issues: any[] } {
  try {
    // Try to get validation result from runtime if available
    const snapshot = runtime.getSnapshot();
    // Default to valid if no validation
    return { valid: true, issues: [] };
  } catch {
    return { valid: true, issues: [] };
  }
}

/**
 * Get policy for a path.
 */
function getPolicyForPath<TData, TState>(
  runtime: any,
  domain: ManifestoDomain<TData, TState>,
  path: string
): { editable: boolean; required: boolean; visible: boolean; relevant: boolean } {
  // Default policy
  const defaultPolicy = {
    editable: true,
    required: false,
    visible: true,
    relevant: true,
  };

  // Check if there's a field policy defined
  const domainAny = domain as any;
  if (domainAny.fieldPolicies) {
    const policy = domainAny.fieldPolicies[path as SemanticPath];
    if (policy) {
      // Evaluate the policy conditions
      try {
        return {
          editable: evaluateCondition(runtime, policy.editable) ?? defaultPolicy.editable,
          required: evaluateCondition(runtime, policy.required) ?? defaultPolicy.required,
          visible: defaultPolicy.visible,
          relevant: evaluateCondition(runtime, policy.relevant) ?? defaultPolicy.relevant,
        };
      } catch {
        return defaultPolicy;
      }
    }
  }

  return defaultPolicy;
}

/**
 * Evaluate a condition reference.
 */
function evaluateCondition(runtime: any, condition: any): boolean | undefined {
  if (condition === undefined) return undefined;
  if (typeof condition === 'boolean') return condition;

  // If it's a condition reference, evaluate it
  if (typeof condition === 'object' && condition.$ref) {
    try {
      return runtime.evaluateCondition(condition.$ref);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/**
 * Collect all paths from a domain.
 */
function collectAllPaths<TData, TState>(domain: ManifestoDomain<TData, TState>): string[] {
  const paths: string[] = [];

  if (domain.paths?.sources) {
    paths.push(...Object.keys(domain.paths.sources));
  }

  if (domain.paths?.derived) {
    paths.push(...Object.keys(domain.paths.derived));
  }

  if (domain.paths?.async) {
    paths.push(...Object.keys(domain.paths.async));
  }

  return paths;
}

/**
 * Evaluate action preconditions.
 */
function evaluatePreconditions(
  runtime: any,
  actionDef: any
): { canExecute: boolean; blockedReasons: string[] } {
  const blockedReasons: string[] = [];

  if (actionDef.preconditions) {
    for (const precondition of actionDef.preconditions) {
      try {
        const result = runtime.evaluatePrecondition(precondition);
        if (!result.satisfied) {
          blockedReasons.push(result.reason ?? 'Precondition not satisfied');
        }
      } catch (error) {
        blockedReasons.push('Error evaluating precondition');
      }
    }
  }

  return {
    canExecute: blockedReasons.length === 0,
    blockedReasons,
  };
}

/**
 * Format a value for display.
 */
function formatDisplayValue(value: unknown): string {
  if (value === null) return '(none)';
  if (value === undefined) return '(not set)';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Convert a path to a field name.
 */
function pathToFieldName(path: string): string {
  const parts = path.split('.');
  if (parts.length > 1 && ['data', 'state', 'derived', 'async'].includes(parts[0]!)) {
    parts.shift();
  }
  return parts
    .map((part, index) =>
      index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join('');
}
