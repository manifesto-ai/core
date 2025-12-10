/**
 * @manifesto-ai/bridge-react-hook-form
 *
 * React Hook Form integration for Manifesto AI Bridge.
 *
 * @example
 * ```tsx
 * import { useForm } from 'react-hook-form';
 * import { createRuntime } from '@manifesto-ai/core';
 * import {
 *   createReactHookFormAdapter,
 *   createReactHookFormActuator,
 *   useManifestoBridge,
 * } from '@manifesto-ai/bridge-react-hook-form';
 *
 * function MyForm() {
 *   const form = useForm();
 *   const runtime = useMemo(() => createRuntime({ domain }), []);
 *   const bridge = useManifestoBridge(form, runtime);
 *
 *   return (
 *     <form onSubmit={form.handleSubmit(async () => {
 *       await bridge.execute({ type: 'EXECUTE_ACTION', actionId: 'submit' });
 *     })}>
 *       <input {...form.register('name')} />
 *       <button disabled={!bridge.isActionAvailable('submit')}>
 *         Submit
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 */

import { useEffect, useMemo, useRef } from 'react';
import type {
  UseFormReturn,
  FieldValues,
  Path,
  PathValue,
} from 'react-hook-form';
import type { DomainRuntime, SemanticPath, ValidationResult } from '@manifesto-ai/core';
import type { Adapter, Actuator, Bridge } from '@manifesto-ai/bridge';
import { createBridge, flattenObject } from '@manifesto-ai/bridge';

// =============================================================================
// React Hook Form Adapter
// =============================================================================

/**
 * Create an Adapter that reads from React Hook Form.
 *
 * @param form - The UseFormReturn from react-hook-form
 * @returns Adapter that reads form values and validation state
 */
export function createReactHookFormAdapter<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>
): Adapter<TFieldValues, unknown> {
  const listeners = new Set<(paths: SemanticPath[]) => void>();
  let watchSubscription: { unsubscribe: () => void } | undefined;

  return {
    getData(path: SemanticPath): unknown {
      // Convert semantic path to field path (remove "data." prefix)
      const fieldPath = path.startsWith('data.') ? path.slice(5) : path;
      return form.getValues(fieldPath as Path<TFieldValues>);
    },

    getState(_path: SemanticPath): unknown {
      // React Hook Form doesn't manage state - return undefined
      return undefined;
    },

    getValidity(path: SemanticPath): ValidationResult | undefined {
      const fieldPath = path.startsWith('data.') ? path.slice(5) : path;

      // Navigate to nested error if needed
      const pathParts = fieldPath.split('.');
      let error: unknown = form.formState.errors;

      for (const part of pathParts) {
        if (error && typeof error === 'object') {
          error = (error as Record<string, unknown>)[part];
        } else {
          error = undefined;
          break;
        }
      }

      if (!error) {
        return { valid: true, issues: [] };
      }

      // Convert RHF error to ValidationResult
      const errorObj = error as { message?: string; type?: string };
      return {
        valid: false,
        issues: [
          {
            code: errorObj.type ?? 'validation',
            message: errorObj.message ?? 'Invalid value',
            path,
            severity: 'error',
          },
        ],
      };
    },

    subscribe(listener: (paths: SemanticPath[]) => void): () => void {
      listeners.add(listener);

      // Set up form watch if not already done
      if (!watchSubscription) {
        watchSubscription = form.watch((value, { name }) => {
          if (name) {
            const paths = [`data.${name}`];
            for (const l of listeners) {
              l(paths);
            }
          }
        });
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && watchSubscription) {
          watchSubscription.unsubscribe();
          watchSubscription = undefined;
        }
      };
    },

    captureData(): Record<SemanticPath, unknown> {
      const values = form.getValues();
      return flattenObject(values, 'data');
    },

    captureState(): Record<SemanticPath, unknown> {
      // RHF doesn't manage state
      return {};
    },
  };
}

// =============================================================================
// React Hook Form Actuator
// =============================================================================

/**
 * Create an Actuator that writes to React Hook Form.
 *
 * @param form - The UseFormReturn from react-hook-form
 * @returns Actuator that sets form values
 */
export function createReactHookFormActuator<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>
): Actuator<TFieldValues, unknown> {
  return {
    setData(path: SemanticPath, value: unknown): void {
      const fieldPath = path.startsWith('data.') ? path.slice(5) : path;
      form.setValue(
        fieldPath as Path<TFieldValues>,
        value as PathValue<TFieldValues, Path<TFieldValues>>,
        {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true,
        }
      );
    },

    setState(_path: SemanticPath, _value: unknown): void {
      // RHF doesn't manage state - no-op
    },

    setManyData(updates: Record<SemanticPath, unknown>): void {
      for (const [path, value] of Object.entries(updates)) {
        this.setData(path, value);
      }
    },

    setManyState(_updates: Record<SemanticPath, unknown>): void {
      // RHF doesn't manage state - no-op
    },

    focus(path: SemanticPath): void {
      const fieldPath = path.startsWith('data.') ? path.slice(5) : path;
      form.setFocus(fieldPath as Path<TFieldValues>);
    },
  };
}

// =============================================================================
// useManifestoBridge Hook
// =============================================================================

/**
 * Options for useManifestoBridge hook.
 */
export interface UseManifestoBridgeOptions {
  /**
   * Sync mode: 'push', 'pull', or 'bidirectional' (default).
   */
  syncMode?: 'push' | 'pull' | 'bidirectional';

  /**
   * Auto-sync on runtime changes (default: true).
   */
  autoSync?: boolean;

  /**
   * Debounce sync in milliseconds (default: 0).
   */
  debounceMs?: number;
}

/**
 * React hook that creates and manages a Manifesto Bridge with React Hook Form.
 *
 * @param form - The UseFormReturn from react-hook-form
 * @param runtime - The Manifesto domain runtime
 * @param options - Optional configuration
 * @returns The Bridge instance
 *
 * @example
 * ```tsx
 * function MyForm() {
 *   const form = useForm();
 *   const runtime = useMemo(() => createRuntime({ domain }), []);
 *   const bridge = useManifestoBridge(form, runtime);
 *
 *   const handleSubmit = async () => {
 *     if (bridge.isActionAvailable('submit')) {
 *       await bridge.execute({ type: 'EXECUTE_ACTION', actionId: 'submit' });
 *     }
 *   };
 *
 *   return <form onSubmit={form.handleSubmit(handleSubmit)}>...</form>;
 * }
 * ```
 */
export function useManifestoBridge<TData extends FieldValues, TState>(
  form: UseFormReturn<TData>,
  runtime: DomainRuntime<TData, TState>,
  options: UseManifestoBridgeOptions = {}
): Bridge<TData, TState> {
  const { syncMode = 'bidirectional', autoSync = true, debounceMs = 0 } = options;

  // Create adapter and actuator
  const adapter = useMemo(
    () => createReactHookFormAdapter(form),
    [form]
  );

  const actuator = useMemo(
    () => createReactHookFormActuator(form),
    [form]
  );

  // Create bridge
  const bridge = useMemo(
    () =>
      createBridge<TData, TState>({
        runtime,
        adapter,
        actuator,
        syncMode,
        autoSync,
        debounceMs,
      }),
    [runtime, adapter, actuator, syncMode, autoSync, debounceMs]
  );

  // Use ref to track the current bridge for cleanup
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      bridgeRef.current.dispose();
    };
  }, [bridge]);

  return bridge;
}

// =============================================================================
// Re-exports
// =============================================================================

export type { Adapter, Actuator, Bridge, Command, BridgeError } from '@manifesto-ai/bridge';
export { createBridge, setValue, setMany, executeAction } from '@manifesto-ai/bridge';
