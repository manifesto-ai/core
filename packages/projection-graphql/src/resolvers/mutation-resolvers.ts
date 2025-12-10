/**
 * Mutation Resolvers
 *
 * GraphQL mutation resolvers for domain modifications.
 */

import type { ManifestoDomain, SemanticPath } from '@manifesto-ai/core';

import type {
  GraphQLDomainContext,
  GraphQLFieldResolver,
  SetFieldResultResponse,
  ActionResultResponse,
  ActionErrorResponse,
  EffectResultResponse,
} from '../types.js';
import { getDomainChangeTrigger, getFieldChangeTrigger, getActionTrigger } from '../context/graphql-context.js';

// =============================================================================
// Mutation Resolver Factory
// =============================================================================

/**
 * Create mutation resolvers for a domain.
 */
export function createMutationResolvers<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  domainName: string
): Record<string, GraphQLFieldResolver<TData, TState>> {
  const lowerDomainName = domainName.charAt(0).toLowerCase() + domainName.slice(1);

  const resolvers: Record<string, GraphQLFieldResolver<TData, TState>> = {
    // Set a field value
    [`set${domainName}Field`]: createSetFieldResolver(),
  };

  // Add action resolvers
  if (domain.actions) {
    for (const [actionId, actionDef] of Object.entries(domain.actions)) {
      const mutationName = `${lowerDomainName}${capitalize(actionId)}`;
      resolvers[mutationName] = createActionResolver(actionId, actionDef);
    }
  }

  return resolvers;
}

// =============================================================================
// Set Field Resolver
// =============================================================================

/**
 * Create resolver for setting a field value.
 */
function createSetFieldResolver<TData, TState>(): GraphQLFieldResolver<TData, TState> {
  return async (_parent, args, context) => {
    const { runtime, domain, pubsub } = context;
    const path = args.path as string;
    const newValue = args.value;

    try {
      // Get previous value
      let previousValue: unknown;
      try {
        previousValue = runtime.get(path as SemanticPath);
      } catch {
        previousValue = undefined;
      }

      // Set the new value
      runtime.set(path as SemanticPath, newValue);

      const result: SetFieldResultResponse = {
        success: true,
        path,
        previousValue,
        newValue,
      };

      // Publish change event if pubsub available
      if (pubsub) {
        await pubsub.publish(getDomainChangeTrigger(domain.id), {
          type: 'DATA_CHANGED',
          timestamp: Date.now(),
          paths: [path],
          snapshot: runtime.getSnapshot(),
        });

        await pubsub.publish(getFieldChangeTrigger(domain.id, path), {
          path,
          previousValue,
          newValue,
          timestamp: Date.now(),
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        path,
        previousValue: null,
        newValue: null,
        errors: [
          {
            code: 'SET_FIELD_ERROR',
            message: errorMessage,
            path,
          },
        ],
      };
    }
  };
}

// =============================================================================
// Action Resolver
// =============================================================================

/**
 * Create resolver for executing a domain action.
 */
function createActionResolver<TData, TState>(
  actionId: string,
  actionDef: any
): GraphQLFieldResolver<TData, TState> {
  return async (_parent, args, context) => {
    const { runtime, domain, pubsub } = context;
    const input = args.input;

    try {
      // Check preconditions
      const preconditions = evaluatePreconditions(runtime, actionDef);
      if (!preconditions.canExecute) {
        return {
          success: false,
          errors: preconditions.blockedReasons.map((reason) => ({
            code: 'PRECONDITION_FAILED',
            message: reason,
          })),
        };
      }

      // Execute the action effect
      const effects: EffectResultResponse[] = [];
      const errors: ActionErrorResponse[] = [];

      if (actionDef.effect) {
        try {
          // Run the effect
          const effectResult = await executeEffect(runtime, actionDef.effect, input);

          if (effectResult.success) {
            effects.push(...effectResult.effects);
          } else {
            errors.push(...effectResult.errors);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({
            code: 'EFFECT_ERROR',
            message: errorMessage,
          });
        }
      }

      const success = errors.length === 0;

      const result: ActionResultResponse = {
        success,
        errors: errors.length > 0 ? errors : undefined,
        effects: effects.length > 0 ? effects : undefined,
      };

      // Publish action event if pubsub available and successful
      if (pubsub && success) {
        await pubsub.publish(getDomainChangeTrigger(domain.id), {
          type: 'ACTION_EXECUTED',
          timestamp: Date.now(),
          paths: [],
          snapshot: runtime.getSnapshot(),
        });

        await pubsub.publish(getActionTrigger(domain.id, actionId), {
          actionId,
          input,
          result,
          timestamp: Date.now(),
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        errors: [
          {
            code: 'ACTION_ERROR',
            message: errorMessage,
          },
        ],
      };
    }
  };
}

// =============================================================================
// Effect Execution
// =============================================================================

/**
 * Execute an effect and return the result.
 */
async function executeEffect(
  runtime: any,
  effect: any,
  input: unknown
): Promise<{
  success: boolean;
  effects: EffectResultResponse[];
  errors: ActionErrorResponse[];
}> {
  const effects: EffectResultResponse[] = [];
  const errors: ActionErrorResponse[] = [];

  try {
    // Handle different effect types
    if (effect._tag === 'SetValue') {
      const path = effect.path;
      const value = typeof effect.value === 'function' ? effect.value(input) : effect.value;
      runtime.set(path, value);

      effects.push({
        type: 'SetValue',
        path,
        description: `Set ${path} to ${formatValue(value)}`,
      });
    } else if (effect._tag === 'Sequence') {
      for (const childEffect of effect.effects) {
        const childResult = await executeEffect(runtime, childEffect, input);
        effects.push(...childResult.effects);
        errors.push(...childResult.errors);
        if (!childResult.success) break;
      }
    } else if (effect._tag === 'Parallel') {
      const results = await Promise.all(
        effect.effects.map((e: any) => executeEffect(runtime, e, input))
      );
      for (const result of results) {
        effects.push(...result.effects);
        errors.push(...result.errors);
      }
    } else if (effect._tag === 'Conditional') {
      // Evaluate condition and execute appropriate branch
      const condition = runtime.evaluateCondition(effect.condition);
      const branch = condition ? effect.then : effect.else;
      if (branch) {
        const branchResult = await executeEffect(runtime, branch, input);
        effects.push(...branchResult.effects);
        errors.push(...branchResult.errors);
      }
    } else if (effect._tag === 'Custom') {
      // Execute custom effect handler
      if (typeof effect.handler === 'function') {
        await effect.handler(runtime, input);
        effects.push({
          type: 'Custom',
          description: effect.description ?? 'Custom effect executed',
        });
      }
    } else {
      // Unknown effect type - try to run it if runtime supports it
      if (typeof runtime.runEffect === 'function') {
        await runtime.runEffect(effect, { input });
        effects.push({
          type: effect._tag ?? 'Unknown',
          description: `Effect executed`,
        });
      }
    }

    return {
      success: errors.length === 0,
      effects,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push({
      code: 'EFFECT_EXECUTION_ERROR',
      message: errorMessage,
    });

    return {
      success: false,
      effects,
      errors,
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

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
        // Handle different precondition formats
        let satisfied = false;
        let reason = 'Precondition not satisfied';

        if (typeof precondition === 'object' && precondition.$ref) {
          satisfied = runtime.evaluateCondition(precondition.$ref);
          reason = precondition.reason ?? reason;
        } else if (typeof precondition === 'function') {
          satisfied = precondition(runtime.getSnapshot());
        } else if (typeof runtime.evaluatePrecondition === 'function') {
          const result = runtime.evaluatePrecondition(precondition);
          satisfied = result.satisfied;
          reason = result.reason ?? reason;
        }

        if (!satisfied) {
          blockedReasons.push(reason);
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
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[array of ${value.length}]`;
  if (typeof value === 'object') return '[object]';
  return String(value);
}

/**
 * Capitalize the first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
