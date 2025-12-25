/**
 * useDerived - Subscribe to a derived value
 *
 * This is an alias for useValue, as derived values are accessed the same way.
 * Provided for semantic clarity in components.
 */

import type { SemanticPath } from '@manifesto-ai/core';
import { useValue } from './useValue.js';
import type { UseValueResult } from '../types.js';

/**
 * useDerived - Subscribe to a derived value
 *
 * @param path - Derived path to watch (e.g., 'derived.total')
 * @returns Current value and path
 *
 * @example
 * ```tsx
 * function OrderTotal() {
 *   const { value: total } = useDerived<number>('derived.orderTotal');
 *   return <div>Total: ${total}</div>;
 * }
 * ```
 */
export function useDerived<T = unknown>(path: SemanticPath): UseValueResult<T> {
  return useValue<T>(path);
}
