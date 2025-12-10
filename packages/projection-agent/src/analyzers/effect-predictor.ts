/**
 * Effect Predictor
 *
 * Predicts what an Effect will do when executed.
 * Converts Effects to natural language descriptions.
 */

import type { Effect, SemanticPath } from '@manifesto-ai/core';
import type { EffectPrediction } from '../types.js';

// =============================================================================
// Effect Description
// =============================================================================

/**
 * Describe an effect in natural language.
 *
 * @param effect - Effect to describe
 * @returns Human-readable description
 */
export function describeEffect(effect: Effect): string {
  switch (effect._tag) {
    case 'SetValue':
      return effect.description ?? `Set ${effect.path} to a new value`;

    case 'SetState':
      return effect.description ?? `Update state at ${effect.path}`;

    case 'ApiCall':
      return (
        effect.description ??
        `Make API call to ${String(effect.endpoint)}`
      );

    case 'Navigate':
      return (
        effect.description ??
        `Navigate to ${effect.to}${effect.mode === 'replace' ? ' (replacing current page)' : ''}`
      );

    case 'Delay':
      return effect.description ?? `Wait for ${effect.ms}ms`;

    case 'EmitEvent':
      return (
        effect.description ??
        `Emit "${effect.payload.type}" event on ${effect.channel} channel`
      );

    case 'Sequence':
      return (
        effect.description ??
        `Execute ${effect.effects.length} steps in order`
      );

    case 'Parallel':
      return (
        effect.description ??
        `Execute ${effect.effects.length} operations in parallel`
      );

    case 'Conditional':
      return effect.description ?? 'Execute conditionally based on expression';

    case 'Catch':
      return effect.description ?? 'Execute with error handling';

    default:
      return 'Unknown effect';
  }
}

/**
 * Describe a composite effect with all its parts.
 */
export function describeCompositeEffect(effect: Effect): string[] {
  const descriptions: string[] = [];

  function collect(e: Effect, depth = 0): void {
    const indent = '  '.repeat(depth);
    const desc = describeEffect(e);
    descriptions.push(`${indent}${desc}`);

    // Recurse into composite effects
    if (e._tag === 'Sequence' || e._tag === 'Parallel') {
      for (const child of e.effects) {
        collect(child, depth + 1);
      }
    } else if (e._tag === 'Conditional') {
      descriptions.push(`${indent}  Then:`);
      collect(e.then, depth + 2);
      if (e.else) {
        descriptions.push(`${indent}  Else:`);
        collect(e.else, depth + 2);
      }
    } else if (e._tag === 'Catch') {
      collect(e.try, depth + 1);
      if (e.catch) {
        descriptions.push(`${indent}  On error:`);
        collect(e.catch, depth + 2);
      }
    }
  }

  collect(effect);
  return descriptions;
}

// =============================================================================
// Effect Prediction
// =============================================================================

/**
 * Predict what an effect will do.
 *
 * @param effect - Effect to predict
 * @returns Array of predictions
 */
export function predictEffect(effect: Effect): EffectPrediction[] {
  const predictions: EffectPrediction[] = [];

  function predict(e: Effect): void {
    switch (e._tag) {
      case 'SetValue':
        predictions.push({
          description: describeEffect(e),
          affectedPaths: [e.path],
          sideEffectType: 'data',
        });
        break;

      case 'SetState':
        predictions.push({
          description: describeEffect(e),
          affectedPaths: [e.path],
          sideEffectType: 'state',
        });
        break;

      case 'ApiCall':
        predictions.push({
          description: describeEffect(e),
          affectedPaths: [],
          sideEffectType: 'api',
        });
        break;

      case 'Navigate':
        predictions.push({
          description: describeEffect(e),
          affectedPaths: [],
          sideEffectType: 'navigation',
        });
        break;

      case 'EmitEvent':
        predictions.push({
          description: describeEffect(e),
          affectedPaths: [],
          sideEffectType: 'event',
        });
        break;

      case 'Delay':
        // Delay doesn't change anything
        break;

      case 'Sequence':
      case 'Parallel':
        for (const child of e.effects) {
          predict(child);
        }
        break;

      case 'Conditional':
        // Predict both branches
        predict(e.then);
        if (e.else) {
          predict(e.else);
        }
        break;

      case 'Catch':
        predict(e.try);
        if (e.catch) {
          predict(e.catch);
        }
        break;
    }
  }

  predict(effect);
  return predictions;
}

/**
 * Extract all affected paths from an effect.
 */
export function extractAffectedPaths(effect: Effect): SemanticPath[] {
  const paths = new Set<SemanticPath>();

  function extract(e: Effect): void {
    if (e._tag === 'SetValue' || e._tag === 'SetState') {
      paths.add(e.path);
    } else if (e._tag === 'Sequence' || e._tag === 'Parallel') {
      for (const child of e.effects) {
        extract(child);
      }
    } else if (e._tag === 'Conditional') {
      extract(e.then);
      if (e.else) {
        extract(e.else);
      }
    } else if (e._tag === 'Catch') {
      extract(e.try);
      if (e.catch) {
        extract(e.catch);
      }
    }
  }

  extract(effect);
  return Array.from(paths);
}

/**
 * Count the number of side effects.
 */
export function countSideEffects(effect: Effect): number {
  let count = 0;

  function count_(e: Effect): void {
    if (
      e._tag === 'SetValue' ||
      e._tag === 'SetState' ||
      e._tag === 'ApiCall' ||
      e._tag === 'Navigate' ||
      e._tag === 'EmitEvent'
    ) {
      count++;
    } else if (e._tag === 'Sequence' || e._tag === 'Parallel') {
      for (const child of e.effects) {
        count_(child);
      }
    } else if (e._tag === 'Conditional') {
      count_(e.then);
      if (e.else) {
        count_(e.else);
      }
    } else if (e._tag === 'Catch') {
      count_(e.try);
      if (e.catch) {
        count_(e.catch);
      }
    }
  }

  count_(effect);
  return count;
}

/**
 * Check if effect has API calls.
 */
export function hasApiCall(effect: Effect): boolean {
  if (effect._tag === 'ApiCall') return true;

  if (effect._tag === 'Sequence' || effect._tag === 'Parallel') {
    return effect.effects.some(hasApiCall);
  }

  if (effect._tag === 'Conditional') {
    return hasApiCall(effect.then) || (effect.else ? hasApiCall(effect.else) : false);
  }

  if (effect._tag === 'Catch') {
    return hasApiCall(effect.try) || (effect.catch ? hasApiCall(effect.catch) : false);
  }

  return false;
}

/**
 * Check if effect has navigation.
 */
export function hasNavigation(effect: Effect): boolean {
  if (effect._tag === 'Navigate') return true;

  if (effect._tag === 'Sequence' || effect._tag === 'Parallel') {
    return effect.effects.some(hasNavigation);
  }

  if (effect._tag === 'Conditional') {
    return hasNavigation(effect.then) || (effect.else ? hasNavigation(effect.else) : false);
  }

  if (effect._tag === 'Catch') {
    return hasNavigation(effect.try) || (effect.catch ? hasNavigation(effect.catch) : false);
  }

  return false;
}
