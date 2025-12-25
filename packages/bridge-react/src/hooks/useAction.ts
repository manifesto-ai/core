/**
 * useAction - Hook for executing domain actions
 */

import { useCallback, useState, useMemo } from 'react';
import type { EffectError, Result, PreconditionStatus } from '@manifesto-ai/core';
import { isErr } from '@manifesto-ai/core';
import { useRuntime } from '../context.js';
import type { UseActionResult } from '../types.js';

/**
 * useAction - Hook for executing domain actions
 *
 * @param actionId - ID of the action to execute
 * @returns Object with execute, isExecuting, error, clearError, isAvailable, preconditions
 *
 * @example
 * ```tsx
 * function SubmitButton() {
 *   const { execute, isExecuting, isAvailable, error } = useAction('submitOrder');
 *
 *   return (
 *     <button
 *       onClick={() => execute()}
 *       disabled={!isAvailable || isExecuting}
 *     >
 *       {isExecuting ? 'Submitting...' : 'Submit Order'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useAction(actionId: string): UseActionResult {
  const runtime = useRuntime();
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<EffectError | null>(null);

  const preconditions = useMemo<PreconditionStatus[]>(() => {
    return runtime.getPreconditions(actionId);
  }, [runtime, actionId]);

  const isAvailable = useMemo(() => {
    return preconditions.every((p) => p.satisfied);
  }, [preconditions]);

  const execute = useCallback(
    async (input?: unknown): Promise<Result<void, EffectError>> => {
      setIsExecuting(true);
      setError(null);

      try {
        const result = await runtime.execute(actionId, input);
        if (isErr(result)) {
          setError(result.error);
        }
        return result;
      } finally {
        setIsExecuting(false);
      }
    },
    [runtime, actionId]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    execute,
    isExecuting,
    error,
    clearError,
    isAvailable,
    preconditions,
  };
}
