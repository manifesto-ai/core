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
 * Domain 정의 옵션
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
 * 도메인 정의 헬퍼 함수
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
 * Source 정의 헬퍼
 */
export type DefineSourceOptions = {
  schema: ZodType;
  defaultValue?: unknown;
  policy?: FieldPolicy;
  semantic: SemanticMeta;
};

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
 * Derived 정의 헬퍼
 */
export type DefineDerivedOptions = {
  deps: SemanticPath[];
  expr: Expression;
  semantic: SemanticMeta;
};

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
 * Async 정의 헬퍼
 */
export type DefineAsyncOptions = {
  deps: SemanticPath[];
  condition?: Expression;
  debounce?: number;
  effect: Effect;
  resultPath: SemanticPath;
  loadingPath: SemanticPath;
  errorPath: SemanticPath;
  semantic: SemanticMeta;
};

export function defineAsync(options: DefineAsyncOptions): AsyncDefinition {
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
 * Action 정의 헬퍼
 */
export type DefineActionOptions = {
  deps: SemanticPath[];
  input?: ZodType;
  effect: Effect;
  preconditions?: ConditionRef[];
  semantic: ActionSemanticMeta;
};

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
 * FieldPolicy 빌더
 */
export function fieldPolicy(options: {
  relevantWhen?: ConditionRef[];
  editableWhen?: ConditionRef[];
  requiredWhen?: ConditionRef[];
}): FieldPolicy {
  return options;
}

/**
 * ConditionRef 빌더
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
