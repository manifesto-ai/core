import type { ZodType } from 'zod';
import type {
  ManifestoDomain,
  PathDefinitions,
  ActionDefinition,
  DomainMeta,
  SourceDefinition,
  DerivedDefinition,
  AsyncDefinition,
  SemanticPath,
  SemanticMeta,
  FieldPolicy,
  ConditionRef,
  ActionSemanticMeta,
} from './types.js';
import type { Expression } from '../expression/types.js';
import type { Effect } from '../effect/types.js';

/**
 * Options for defining a Manifesto domain.
 *
 * @typeParam TData - Type of domain data (persisted state)
 * @typeParam TState - Type of domain state (UI/transient state)
 */
export type DefineDomainOptions<TData, TState> = {
  id: string;
  name: string;
  description: string;
  dataSchema: ZodType<TData>;
  stateSchema: ZodType<TState>;
  initialState: TState;
  paths?: Partial<PathDefinitions<TData, TState>>;
  actions?: Record<string, ActionDefinition>;
  meta?: DomainMeta;
};

/**
 * Adds namespace prefix to keys if not already present.
 * Supports nested paths (e.g., 'user.name' → 'data.user.name').
 */
function prefixKeys<T>(
  record: Record<string, T> | undefined,
  prefix: string
): Record<string, T> {
  if (!record) return {} as Record<string, T>;

  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) {
    const prefixedKey = key.startsWith(`${prefix}.`) ? key : `${prefix}.${key}`;
    result[prefixedKey] = value;
  }
  return result;
}

/**
 * Creates a Manifesto domain definition.
 *
 * A domain is the central configuration that describes your application's
 * data model, computed values, async operations, and actions.
 *
 * @typeParam TData - Type of domain data (persisted state)
 * @typeParam TState - Type of domain state (UI/transient state)
 * @param options - Domain configuration options
 * @returns A complete ManifestoDomain instance
 *
 * @example
 * ```typescript
 * const counterDomain = defineDomain<CounterData, CounterState>({
 *   id: 'counter',
 *   name: 'Counter',
 *   description: 'A simple counter domain',
 *   dataSchema: z.object({ count: z.number() }),
 *   stateSchema: z.object({ step: z.number() }),
 *   initialState: { step: 1 },
 *   paths: {
 *     sources: {
 *       'data.count': { schema: z.number(), semantic: { type: 'quantity' } },
 *     },
 *     derived: {
 *       'derived.doubled': {
 *         deps: ['data.count'],
 *         expr: ['*', ['get', 'data.count'], 2],
 *       },
 *     },
 *   },
 *   actions: {
 *     increment: {
 *       deps: ['data.count'],
 *       effect: ['setValue', 'data.count', ['+', ['get', 'data.count'], 1]],
 *       semantic: { verb: 'increment', object: 'counter' },
 *     },
 *   },
 * });
 * ```
 */
export function defineDomain<TData, TState>(
  options: DefineDomainOptions<TData, TState>
): ManifestoDomain<TData, TState> {
  return {
    id: options.id,
    name: options.name,
    description: options.description,
    dataSchema: options.dataSchema,
    stateSchema: options.stateSchema,
    initialState: options.initialState,
    paths: {
      sources: prefixKeys(options.paths?.sources, 'data'),
      derived: prefixKeys(options.paths?.derived, 'derived'),
      async: prefixKeys(options.paths?.async, 'async'),
    },
    actions: options.actions ?? {},
    meta: options.meta,
  };
}

/**
 * Options for defining a source path.
 *
 * Source paths represent raw data that can be read and written.
 */
export type DefineSourceOptions = {
  schema: ZodType;
  defaultValue?: unknown;
  policy?: FieldPolicy;
  semantic: SemanticMeta;
};

/**
 * Creates a source path definition.
 *
 * @param options - Source path configuration
 * @returns A SourceDefinition for use in domain paths
 *
 * @example
 * ```typescript
 * defineSource({
 *   schema: z.string(),
 *   defaultValue: '',
 *   semantic: { type: 'text', description: 'User name' },
 * });
 * ```
 */
export function defineSource(options: DefineSourceOptions): SourceDefinition {
  return {
    schema: options.schema,
    defaultValue: options.defaultValue,
    policy: options.policy,
    semantic: {
      readable: true,
      writable: true,
      ...options.semantic,
    },
  };
}

/**
 * Options for defining a derived path.
 *
 * Derived paths are computed values that automatically update
 * when their dependencies change.
 */
export type DefineDerivedOptions = {
  deps: SemanticPath[];
  expr: Expression;
  semantic: SemanticMeta;
};

/**
 * Creates a derived path definition.
 *
 * @param options - Derived path configuration
 * @returns A DerivedDefinition for use in domain paths
 *
 * @example
 * ```typescript
 * defineDerived({
 *   deps: ['data.price', 'data.quantity'],
 *   expr: ['*', ['get', 'data.price'], ['get', 'data.quantity']],
 *   semantic: { type: 'computed', description: 'Total price' },
 * });
 * ```
 */
export function defineDerived(options: DefineDerivedOptions): DerivedDefinition {
  return {
    deps: options.deps,
    expr: options.expr,
    semantic: {
      readable: true,
      writable: false,
      ...options.semantic,
    },
  };
}

/**
 * Options for defining an async path.
 *
 * Async paths handle asynchronous operations like API calls.
 * They automatically generate sub-paths for result, loading, and error states.
 *
 * Contract: Async paths follow the pattern `async.{name}`.
 * Sub-paths are auto-generated: `async.{name}.result`, `async.{name}.loading`, `async.{name}.error`
 */
export type DefineAsyncOptions = {
  deps: SemanticPath[];
  condition?: Expression;
  debounce?: number;
  effect: Effect;
  semantic: SemanticMeta;
  /**
   * @deprecated P0-2: 명시적 경로 대신 basePath 사용 권장
   * resultPath/loadingPath/errorPath는 basePath에서 자동 생성됩니다.
   */
  resultPath?: SemanticPath;
  /**
   * @deprecated P0-2: 명시적 경로 대신 basePath 사용 권장
   */
  loadingPath?: SemanticPath;
  /**
   * @deprecated P0-2: 명시적 경로 대신 basePath 사용 권장
   */
  errorPath?: SemanticPath;
};

/**
 * Creates an async path definition.
 *
 * Recommended: Use the basePath parameter to auto-generate sub-paths.
 * Legacy: Explicit resultPath/loadingPath/errorPath (deprecated)
 *
 * @example
 * ```typescript
 * // 권장: basePath 사용 (P0-2)
 * defineAsync('async.userData', {
 *   deps: ['data.userId'],
 *   effect: apiCall(...),
 *   semantic: { type: 'async', description: 'User data' },
 * });
 * // → resultPath: 'async.userData.result'
 * // → loadingPath: 'async.userData.loading'
 * // → errorPath: 'async.userData.error'
 *
 * // Deprecated: 명시적 경로
 * defineAsync({
 *   deps: ['data.userId'],
 *   effect: apiCall(...),
 *   resultPath: 'async.userData.result',
 *   loadingPath: 'async.userData.loading',
 *   errorPath: 'async.userData.error',
 *   semantic: { type: 'async', description: 'User data' },
 * });
 * ```
 */
export function defineAsync(basePath: SemanticPath, options: Omit<DefineAsyncOptions, 'resultPath' | 'loadingPath' | 'errorPath'>): AsyncDefinition;
export function defineAsync(options: DefineAsyncOptions & { resultPath: SemanticPath; loadingPath: SemanticPath; errorPath: SemanticPath }): AsyncDefinition;
export function defineAsync(
  basePathOrOptions: SemanticPath | DefineAsyncOptions,
  maybeOptions?: Omit<DefineAsyncOptions, 'resultPath' | 'loadingPath' | 'errorPath'>
): AsyncDefinition {
  // New API: basePath-based auto-generation
  if (typeof basePathOrOptions === 'string') {
    const basePath = basePathOrOptions;
    const options = maybeOptions!;

    // Add async. prefix if not already present
    const normalizedBase = basePath.startsWith('async.') ? basePath : `async.${basePath}`;

    return {
      deps: options.deps,
      condition: options.condition,
      debounce: options.debounce,
      effect: options.effect,
      resultPath: `${normalizedBase}.result` as SemanticPath,
      loadingPath: `${normalizedBase}.loading` as SemanticPath,
      errorPath: `${normalizedBase}.error` as SemanticPath,
      semantic: {
        readable: true,
        writable: false,
        ...options.semantic,
      },
    };
  }

  // Legacy API (deprecated)
  const options = basePathOrOptions as DefineAsyncOptions & { resultPath: SemanticPath; loadingPath: SemanticPath; errorPath: SemanticPath };

  // Validate explicit paths follow async.{name}.{result|loading|error} pattern
  const validateAsyncPath = (path: SemanticPath, suffix: 'result' | 'loading' | 'error'): void => {
    if (!path.endsWith(`.${suffix}`)) {
      console.warn(`[P0-2 Deprecation] Async path '${path}' should end with '.${suffix}'. Consider using the new basePath API.`);
    }
  };

  validateAsyncPath(options.resultPath, 'result');
  validateAsyncPath(options.loadingPath, 'loading');
  validateAsyncPath(options.errorPath, 'error');

  return {
    deps: options.deps,
    condition: options.condition,
    debounce: options.debounce,
    effect: options.effect,
    resultPath: options.resultPath,
    loadingPath: options.loadingPath,
    errorPath: options.errorPath,
    semantic: {
      readable: true,
      writable: false,
      ...options.semantic,
    },
  };
}

/**
 * Options for defining an action.
 *
 * Actions are user-triggered operations that modify state.
 */
export type DefineActionOptions = {
  deps: SemanticPath[];
  input?: ZodType;
  effect: Effect;
  preconditions?: ConditionRef[];
  semantic: ActionSemanticMeta;
};

/**
 * Creates an action definition.
 *
 * @param options - Action configuration
 * @returns An ActionDefinition for use in domain actions
 *
 * @example
 * ```typescript
 * defineAction({
 *   deps: ['data.count'],
 *   effect: ['setValue', 'data.count', ['+', ['get', 'data.count'], 1]],
 *   semantic: { verb: 'increment', object: 'counter' },
 * });
 * ```
 */
export function defineAction(options: DefineActionOptions): ActionDefinition {
  return {
    deps: options.deps,
    input: options.input,
    effect: options.effect,
    preconditions: options.preconditions,
    semantic: {
      readable: true,
      writable: false,
      risk: 'none',
      reversible: false,
      ...options.semantic,
    },
  };
}

/**
 * Creates a field policy configuration.
 *
 * Field policies control visibility, editability, and requirements
 * for form fields based on conditions.
 *
 * @example
 * ```typescript
 * fieldPolicy({
 *   relevantWhen: [condition('state.showAdvanced')],
 *   editableWhen: [condition('state.isEditing')],
 *   requiredWhen: [condition('data.type', { expect: 'true' })],
 * });
 * ```
 */
export function fieldPolicy(options: {
  relevantWhen?: ConditionRef[];
  editableWhen?: ConditionRef[];
  requiredWhen?: ConditionRef[];
}): FieldPolicy {
  return options;
}

/**
 * Creates a condition reference for policies.
 *
 * @param path - The semantic path to check
 * @param options - Optional expectation and reason
 * @returns A ConditionRef for use in field policies
 *
 * @example
 * ```typescript
 * condition('state.isAdmin', { expect: 'true', reason: 'Admin access required' })
 * ```
 */
export function condition(
  path: SemanticPath,
  options?: { expect?: 'true' | 'false'; reason?: string }
): ConditionRef {
  return {
    path,
    expect: options?.expect ?? 'true',
    reason: options?.reason,
  };
}
