import type {
  SemanticPath,
  ManifestoDomain,
  ValidationResult,
  SemanticMeta,
  ConditionRef,
} from '../domain/types.js';
import type { Expression, EvaluationContext } from '../expression/types.js';
import type { Effect } from '../effect/types.js';
import type { Result, PropagationError, HandlerError } from '../effect/result.js';
import type { EffectError } from '../effect/result.js';
import type {
  DomainSnapshot,
} from './snapshot.js';
import type {
  SnapshotListener,
  PathListener,
  EventListener,
  Unsubscribe,
} from './subscription.js';
import type { DependencyGraph } from '../dag/graph.js';

import { createSnapshot, getValueByPath, setValueByPath } from './snapshot.js';
import { SubscriptionManager } from './subscription.js';
import { buildDependencyGraph, getAllDependents } from '../dag/graph.js';
import { propagate, propagateAsyncResult, analyzeImpact } from '../dag/propagation.js';
import { runEffect, type EffectHandler } from '../effect/runner.js';
import { ok, err, effectError, handlerError, propagationError } from '../effect/result.js';
import { evaluate } from '../expression/evaluator.js';

/**
 * PreconditionStatus: 전제조건 상태
 */
export type PreconditionStatus = {
  /** 참조 경로 */
  path: SemanticPath;
  /** 기대 값 */
  expect: 'true' | 'false';
  /** 실제 값 */
  actual: boolean;
  /** 충족 여부 */
  satisfied: boolean;
  /** 이유 */
  reason?: string;
};

/**
 * ResolvedFieldPolicy: 해석된 필드 정책
 */
export type ResolvedFieldPolicy = {
  /** 현재 의미있는지 */
  relevant: boolean;
  relevantReason?: string;

  /** 현재 수정 가능한지 */
  editable: boolean;
  editableReason?: string;

  /** 현재 필수인지 */
  required: boolean;
  requiredReason?: string;
};

/**
 * ExplanationTree: AI가 "왜"를 이해하기 위한 구조
 */
export type ExplanationTree = {
  /** 경로 */
  path: SemanticPath;
  /** 현재 값 */
  value: unknown;
  /** Semantic 메타데이터 */
  semantic?: SemanticMeta;
  /** 계산 표현식 (derived인 경우) */
  expression?: Expression;
  /** 의존하는 경로들의 설명 (재귀) */
  dependencies: ExplanationTree[];
  /** 이 값이 왜 이런지 자연어 설명 */
  explanation?: string;
};

/**
 * SetError: set/setMany 메서드의 에러 타입
 *
 * P0-1 Contract: 검증 에러와 전파 에러를 모두 포함
 */
export type SetError = ValidationError | PropagationError;

/**
 * DomainRuntime: 도메인 실행 엔진
 */
export interface DomainRuntime<TData = unknown, TState = unknown> {
  // Domain Info
  /** P0-2: Get the domain ID for validation */
  getDomainId(): string;

  // Snapshot Access
  getSnapshot(): DomainSnapshot<TData, TState>;
  get<T = unknown>(path: SemanticPath): T;
  getMany(paths: SemanticPath[]): Record<SemanticPath, unknown>;

  // Mutations
  /** P0-1 Contract: 검증 에러 또는 전파 에러 반환 */
  set(path: SemanticPath, value: unknown): Result<void, SetError>;
  /** P0-1 Contract: 검증 에러 또는 전파 에러 반환 */
  setMany(updates: Record<SemanticPath, unknown>): Result<void, SetError>;
  execute(actionId: string, input?: unknown): Promise<Result<void, EffectError>>;

  // Policy & Metadata
  getPreconditions(actionId: string): PreconditionStatus[];
  getFieldPolicy(path: SemanticPath): ResolvedFieldPolicy;
  getSemantic(path: SemanticPath): SemanticMeta | undefined;

  // AI Support
  explain(path: SemanticPath): ExplanationTree;
  getImpact(path: SemanticPath): SemanticPath[];

  // Subscription
  subscribe(listener: SnapshotListener<TData, TState>): Unsubscribe;
  subscribePath(path: SemanticPath, listener: PathListener): Unsubscribe;
  subscribeEvents(channel: string, listener: EventListener): Unsubscribe;
}

/**
 * ValidationError
 */
export type ValidationError = {
  _tag: 'ValidationError';
  path: SemanticPath;
  message: string;
  issues: ValidationResult['issues'];
};

/**
 * Runtime 생성 옵션
 */
export type CreateRuntimeOptions<TData, TState> = {
  domain: ManifestoDomain<TData, TState>;
  initialData?: Partial<TData>;
  effectHandler?: Partial<EffectHandler>;
};

/**
 * P1-1: async base path 확인 (O(1) 체크)
 *
 * async.{name}이 도메인에 정의된 async 경로의 base path인지 확인합니다.
 * async.{name}.result, async.{name}.loading, async.{name}.error는 값 경로이므로 false 반환.
 */
function isAsyncBasePath(path: string, domain: ManifestoDomain<unknown, unknown>): boolean {
  // async.로 시작하지 않으면 확인 불필요
  if (!path.startsWith('async.')) {
    return false;
  }

  // O(1) 체크: 직접 프로퍼티 존재 확인
  const asyncPaths = domain.paths.async;
  return asyncPaths !== undefined && path in asyncPaths;
}

/**
 * P1-1: warnOnce 패턴 - 이미 경고한 경로는 다시 경고하지 않음
 */
const warnedAsyncPaths = new Set<string>();

function warnAsyncPathOnce(path: string, message: string): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  if (warnedAsyncPaths.has(path)) {
    return;
  }
  warnedAsyncPaths.add(path);
  console.warn(message);
}

/**
 * DomainRuntime 생성
 */
export function createRuntime<TData, TState>(
  options: CreateRuntimeOptions<TData, TState>
): DomainRuntime<TData, TState> {
  const { domain } = options;

  // 스냅샷 초기화
  let snapshot = createSnapshot<TData, TState>(
    (options.initialData ?? {}) as TData,
    domain.initialState
  );

  // 의존성 그래프 구축
  const graph = buildDependencyGraph(domain);

  // 구독 관리자
  const subscriptionManager = new SubscriptionManager<TData, TState>();

  // Effect 핸들러 (기본값 + 사용자 제공)
  // P0-1 Contract: 모든 핸들러가 Result를 반환
  const effectHandler: EffectHandler = {
    setValue: (path, value) => {
      try {
        snapshot = setValueByPath(snapshot, path, value);
        return ok(undefined);
      } catch (e) {
        return err(
          handlerError(path, e instanceof Error ? e : new Error(String(e)), 'SET_VALUE_FAILED')
        );
      }
    },
    setState: (path, value) => {
      try {
        snapshot = setValueByPath(snapshot, path, value);
        return ok(undefined);
      } catch (e) {
        return err(
          handlerError(path, e instanceof Error ? e : new Error(String(e)), 'SET_STATE_FAILED')
        );
      }
    },
    apiCall: options.effectHandler?.apiCall ?? (async () => {
      return err(
        handlerError(
          'apiCall' as SemanticPath,
          new Error('apiCall handler not provided'),
          'API_CALL_NOT_PROVIDED'
        )
      );
    }),
    navigate: options.effectHandler?.navigate ?? ((to, mode) => {
      console.warn('navigate handler not provided');
      return ok(undefined);
    }),
    emitEvent: (channel, payload) => {
      try {
        subscriptionManager.emitEvent(channel, payload);
        return ok(undefined);
      } catch (e) {
        return err(
          handlerError(
            `event:${channel}` as SemanticPath,
            e instanceof Error ? e : new Error(String(e)),
            'EMIT_EVENT_FAILED'
          )
        );
      }
    },
  };

  // 평가 컨텍스트 생성
  const createContext = (): EvaluationContext => ({
    get: (path) => getValueByPath(snapshot, path),
  });

  // 초기 derived 값 계산
  const initialPropagation = propagate(
    graph,
    Object.keys(domain.paths.sources),
    {
      get: (path) => getValueByPath(snapshot, path),
      set: (path, value) => {
        snapshot = setValueByPath(snapshot, path, value);
      },
    }
  );

  // 초기 변경 적용
  for (const [path, value] of initialPropagation.changes) {
    snapshot = setValueByPath(snapshot, path, value);
  }

  return {
    // Domain Info
    getDomainId(): string {
      return domain.id;
    },

    // Snapshot Access
    getSnapshot(): DomainSnapshot<TData, TState> {
      return snapshot;
    },

    get<T = unknown>(path: SemanticPath): T {
      // P1-1: async base path 가드 - async.{name}은 프로세스 식별자이며 값 경로가 아님
      if (isAsyncBasePath(path, domain)) {
        const asyncDef = domain.paths.async?.[path];
        const resultPath = asyncDef?.resultPath ?? (`${path}.result` as SemanticPath);
        // warnOnce 패턴: 동일 경로에 대해 한 번만 경고
        warnAsyncPathOnce(
          path,
          `[manifesto] "${path}" is an async process path, not a value path. ` +
          `Use "${resultPath}", "${asyncDef?.loadingPath ?? `${path}.loading`}", or "${asyncDef?.errorPath ?? `${path}.error`}" instead.`
        );
        // v0.3.x: backwards compatibility - fallback to resultPath
        return getValueByPath(snapshot, resultPath) as T;
      }
      return getValueByPath(snapshot, path) as T;
    },

    getMany(paths: SemanticPath[]): Record<SemanticPath, unknown> {
      const result: Record<SemanticPath, unknown> = {};
      for (const path of paths) {
        result[path] = getValueByPath(snapshot, path);
      }
      return result;
    },

    // Mutations
    /**
     * P0-1 Contract: 검증 에러 또는 전파 에러 반환
     */
    set(path: SemanticPath, value: unknown): Result<void, SetError> {
      // Zod 스키마 검증 (간략화)
      const source = domain.paths.sources[path];
      if (source) {
        const parseResult = source.schema.safeParse(value);
        if (!parseResult.success) {
          return err({
            _tag: 'ValidationError',
            path,
            message: parseResult.error.message,
            issues: parseResult.error.issues.map((i) => ({
              code: i.code,
              message: i.message,
              path,
              severity: 'error' as const,
            })),
          });
        }
      }

      // 값 설정
      snapshot = setValueByPath(snapshot, path, value);

      // 전파
      const result = propagate(graph, [path], {
        get: (p) => getValueByPath(snapshot, p),
        set: (p, v) => {
          snapshot = setValueByPath(snapshot, p, v);
        },
      });

      // P0-1 Contract: 전파 에러가 있으면 반환
      if (result.errors.length > 0) {
        return err(propagationError(result.errors));
      }

      // 구독자 알림
      subscriptionManager.notifySnapshotChange(snapshot, [path, ...result.changes.keys()]);

      return ok(undefined);
    },

    /**
     * P0-1 Contract: 검증 에러 또는 전파 에러 반환
     */
    setMany(updates: Record<SemanticPath, unknown>): Result<void, SetError> {
      const paths = Object.keys(updates);

      // 모든 값 검증
      for (const path of paths) {
        const source = domain.paths.sources[path];
        if (source) {
          const parseResult = source.schema.safeParse(updates[path]);
          if (!parseResult.success) {
            return err({
              _tag: 'ValidationError',
              path,
              message: parseResult.error.message,
              issues: parseResult.error.issues.map((i) => ({
                code: i.code,
                message: i.message,
                path,
                severity: 'error' as const,
              })),
            });
          }
        }
      }

      // 모든 값 설정
      for (const path of paths) {
        snapshot = setValueByPath(snapshot, path, updates[path]);
      }

      // 전파
      const result = propagate(graph, paths, {
        get: (p) => getValueByPath(snapshot, p),
        set: (p, v) => {
          snapshot = setValueByPath(snapshot, p, v);
        },
      });

      // P0-1 Contract: 전파 에러가 있으면 반환
      if (result.errors.length > 0) {
        return err(propagationError(result.errors));
      }

      // 구독자 알림
      subscriptionManager.notifySnapshotChange(snapshot, [...paths, ...result.changes.keys()]);

      return ok(undefined);
    },

    async execute(actionId: string, input?: unknown): Promise<Result<void, EffectError>> {
      const action = domain.actions[actionId];
      if (!action) {
        return err(
          effectError(
            { _tag: 'Sequence', effects: [], description: '' },
            new Error(`Action not found: ${actionId}`)
          )
        );
      }

      // Preconditions 확인
      const preconditions = this.getPreconditions(actionId);
      const unsatisfied = preconditions.filter((p) => !p.satisfied);
      if (unsatisfied.length > 0) {
        const reasons = unsatisfied.map((p) => p.reason ?? p.path).join(', ');
        return err(
          effectError(action.effect, new Error(`Preconditions not met: ${reasons}`), {
            code: 'PRECONDITION_FAILED',
          })
        );
      }

      // 입력 검증
      if (action.input && input !== undefined) {
        const parseResult = action.input.safeParse(input);
        if (!parseResult.success) {
          return err(
            effectError(action.effect, new Error(parseResult.error.message), {
              code: 'INVALID_INPUT',
            })
          );
        }
      }

      // Effect 실행
      const result = await runEffect(action.effect, {
        handler: effectHandler,
        context: createContext(),
      });

      if (result.ok) {
        // 전파
        const propagationResult = propagate(graph, action.deps, {
          get: (p) => getValueByPath(snapshot, p),
          set: (p, v) => {
            snapshot = setValueByPath(snapshot, p, v);
          },
        });

        // 구독자 알림
        subscriptionManager.notifySnapshotChange(snapshot, [
          ...action.deps,
          ...propagationResult.changes.keys(),
        ]);
      }

      return result.ok ? ok(undefined) : result;
    },

    // Policy & Metadata
    getPreconditions(actionId: string): PreconditionStatus[] {
      const action = domain.actions[actionId];
      if (!action || !action.preconditions) {
        return [];
      }

      return action.preconditions.map((cond) => {
        const value = getValueByPath(snapshot, cond.path);
        const actual = Boolean(value);
        const expected = cond.expect !== 'false';
        return {
          path: cond.path,
          expect: cond.expect ?? 'true',
          actual,
          satisfied: actual === expected,
          reason: cond.reason,
        };
      });
    },

    getFieldPolicy(path: SemanticPath): ResolvedFieldPolicy {
      const source = domain.paths.sources[path];
      if (!source || !source.policy) {
        return { relevant: true, editable: true, required: false };
      }

      const policy = source.policy;

      const resolveConditions = (
        conditions: ConditionRef[] | undefined,
        defaultValue: boolean
      ): { value: boolean; reason?: string } => {
        if (!conditions || conditions.length === 0) {
          return { value: defaultValue };
        }

        for (const cond of conditions) {
          const value = getValueByPath(snapshot, cond.path);
          const actual = Boolean(value);
          const expected = cond.expect !== 'false';
          if (actual !== expected) {
            return { value: false, reason: cond.reason };
          }
        }

        return { value: true };
      };

      const relevantResult = resolveConditions(policy.relevantWhen, true);
      const editableResult = resolveConditions(policy.editableWhen, true);
      const requiredResult = resolveConditions(policy.requiredWhen, false);

      return {
        relevant: relevantResult.value,
        relevantReason: relevantResult.reason,
        editable: editableResult.value,
        editableReason: editableResult.reason,
        required: requiredResult.value,
        requiredReason: requiredResult.reason,
      };
    },

    getSemantic(path: SemanticPath): SemanticMeta | undefined {
      const source = domain.paths.sources[path];
      if (source) return source.semantic;

      const derived = domain.paths.derived[path];
      if (derived) return derived.semantic;

      const async = domain.paths.async[path];
      if (async) return async.semantic;

      return undefined;
    },

    // AI Support
    explain(path: SemanticPath): ExplanationTree {
      const value = getValueByPath(snapshot, path);
      const semantic = this.getSemantic(path);
      const node = graph.nodes.get(path);

      const tree: ExplanationTree = {
        path,
        value,
        semantic,
        dependencies: [],
      };

      if (node?.kind === 'derived') {
        tree.expression = node.definition.expr;

        // 의존성 트리 구축
        for (const dep of node.definition.deps) {
          tree.dependencies.push(this.explain(dep));
        }

        // 설명 생성
        tree.explanation = generateExplanation(tree);
      }

      return tree;
    },

    getImpact(path: SemanticPath): SemanticPath[] {
      return getAllDependents(graph, path);
    },

    // Subscription
    subscribe(listener: SnapshotListener<TData, TState>): Unsubscribe {
      return subscriptionManager.subscribe(listener);
    },

    subscribePath(path: SemanticPath, listener: PathListener): Unsubscribe {
      return subscriptionManager.subscribePath(path, listener);
    },

    subscribeEvents(channel: string, listener: EventListener): Unsubscribe {
      return subscriptionManager.subscribeEvents(channel, listener);
    },
  };
}

/**
 * 설명 생성 헬퍼
 */
function generateExplanation(tree: ExplanationTree): string {
  const { path, value, dependencies } = tree;

  if (dependencies.length === 0) {
    return `${path} = ${JSON.stringify(value)}`;
  }

  const depExplanations = dependencies
    .map((d) => `  - ${d.path} = ${JSON.stringify(d.value)}`)
    .join('\n');

  return `${path} = ${JSON.stringify(value)}\n의존성:\n${depExplanations}`;
}
