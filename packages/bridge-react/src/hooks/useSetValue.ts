/**
 * useSetValue - Hook for setting values in the runtime
 */

import { useCallback, useState } from 'react';
import type { SemanticPath, SetError, Result } from '@manifesto-ai/core';
import { isErr } from '@manifesto-ai/core';
import { useRuntime } from '../context.js';
import type { UseSetValueResult } from '../types.js';

/**
 * useSetValue - Hook for setting values in the runtime
 *
 * @returns Object with setValue, setValues, error, and clearError
 *
 * @example
 * ```tsx
 * function UserNameInput() {
 *   const { value: name } = useValue<string>('data.user.name');
 *   const { setValue, error } = useSetValue();
 *
 *   return (
 *     <div>
 *       <input
 *         value={name}
 *         onChange={(e) => setValue('data.user.name', e.target.value)}
 *       />
 *       {error && <span className="error">{error.message}</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSetValue(): UseSetValueResult {
  const runtime = useRuntime();
  const [error, setError] = useState<SetError | null>(null);

  const setValue = useCallback(
    (path: SemanticPath, value: unknown): Result<void, SetError> => {
      const result = runtime.set(path, value);
      if (isErr(result)) {
        setError(result.error);
      } else {
        setError(null);
      }
      return result;
    },
    [runtime]
  );

  const setValues = useCallback(
    (updates: Record<SemanticPath, unknown>): Result<void, SetError> => {
      const result = runtime.setMany(updates);
      if (isErr(result)) {
        setError(result.error);
      } else {
        setError(null);
      }
      return result;
    },
    [runtime]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { setValue, setValues, error, clearError };
}
