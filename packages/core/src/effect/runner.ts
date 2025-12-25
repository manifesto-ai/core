import type {
  Effect,
  SetValueEffect,
  SetStateEffect,
  ApiCallEffect,
  NavigateEffect,
  DelayEffect,
  SequenceEffect,
  ParallelEffect,
  ConditionalEffect,
  CatchEffect,
  EmitEventEffect,
} from './types.js';
import type { Result, HandlerError } from './result.js';
import type { EvaluationContext, Expression } from '../expression/types.js';
import type { SemanticPath } from '../domain/types.js';
import { ok, err, effectError } from './result.js';
import { evaluate } from '../expression/evaluator.js';

/**
 * API 호출 요청 타입
 */
export type ApiCallRequest = {
  endpoint: string;
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  timeout?: number;
};

/**
 * Effect 실행 핸들러
 *
 * P0-1 Contract: 모든 메서드가 Result 패턴을 따릅니다.
 * - 동기 메서드: Result<T, HandlerError> 반환
 * - 비동기 메서드: Promise<Result<T, HandlerError>> 반환
 *
 * 실패 시 에러가 침묵되지 않고 명시적으로 전파됩니다.
 */
export type EffectHandler = {
  /** 데이터 값 설정 - 실패 시 HandlerError 반환 */
  setValue: (path: SemanticPath, value: unknown) => Result<void, HandlerError>;

  /** 상태 값 설정 - 실패 시 HandlerError 반환 */
  setState: (path: SemanticPath, value: unknown) => Result<void, HandlerError>;

  /**
   * API 호출 - 실패 시 HandlerError 반환
   *
   * P0-1 Contract: Promise<Result<unknown, HandlerError>> 반환.
   * 기존 throw 기반 핸들러는 resultFrom() 헬퍼로 래핑하세요.
   *
   * @example
   * ```typescript
   * // Result 패턴 직접 구현
   * apiCall: async (req) => {
   *   try {
   *     const res = await fetch(req.endpoint);
   *     if (!res.ok) return err(handlerError('apiCall', new Error(res.statusText)));
   *     return ok(await res.json());
   *   } catch (e) {
   *     return err(handlerError('apiCall', e instanceof Error ? e : new Error(String(e))));
   *   }
   * }
   *
   * // 또는 resultFrom 헬퍼 사용 (마이그레이션 용이)
   * apiCall: (req) => resultFrom(async () => {
   *   const res = await fetch(req.endpoint);
   *   if (!res.ok) throw new Error(res.statusText);
   *   return res.json();
   * })
   * ```
   */
  apiCall: (request: ApiCallRequest) => Promise<Result<unknown, HandlerError>>;

  /** 네비게이션 - 실패 시 HandlerError 반환 */
  navigate: (to: string, mode?: 'push' | 'replace') => Result<void, HandlerError>;

  /** 이벤트 발행 - 실패 시 HandlerError 반환 */
  emitEvent: (channel: string, payload: unknown) => Result<void, HandlerError>;
};

/**
 * Effect Runner 설정
 */
export type EffectRunnerConfig = {
  handler: EffectHandler;
  context: EvaluationContext;
};

/**
 * Effect 실행 결과
 */
export type EffectResult = Result<unknown, import('./result.js').EffectError>;

/**
 * Effect 실행
 */
export async function runEffect(
  effect: Effect,
  config: EffectRunnerConfig
): Promise<EffectResult> {
  const { handler, context } = config;

  try {
    switch (effect._tag) {
      case 'SetValue':
        return await runSetValue(effect, handler, context);

      case 'SetState':
        return await runSetState(effect, handler, context);

      case 'ApiCall':
        return await runApiCall(effect, handler, context);

      case 'Navigate':
        return await runNavigate(effect, handler, context);

      case 'Delay':
        return await runDelay(effect);

      case 'Sequence':
        return await runSequence(effect, config);

      case 'Parallel':
        return await runParallel(effect, config);

      case 'Conditional':
        return await runConditional(effect, config);

      case 'Catch':
        return await runCatch(effect, config);

      case 'EmitEvent':
        return await runEmitEvent(effect, handler);

      default:
        return err(
          effectError(effect, new Error(`Unknown effect type: ${(effect as Effect)._tag}`))
        );
    }
  } catch (e) {
    return err(
      effectError(effect, e instanceof Error ? e : new Error(String(e)), { context })
    );
  }
}

/**
 * SetValue 실행
 *
 * P0-1 Contract: handler.setValue의 Result를 확인하고 에러 전파
 */
async function runSetValue(
  effect: SetValueEffect,
  handler: EffectHandler,
  context: EvaluationContext
): Promise<EffectResult> {
  const valueResult = evaluate(effect.value, context);
  if (!valueResult.ok) {
    return err(effectError(effect, new Error(valueResult.error)));
  }

  const handlerResult = handler.setValue(effect.path, valueResult.value);
  if (!handlerResult.ok) {
    return err(
      effectError(effect, handlerResult.error.cause, {
        code: handlerResult.error.code ?? 'HANDLER_ERROR',
        context,
      })
    );
  }

  return ok(undefined);
}

/**
 * SetState 실행
 *
 * P0-1 Contract: handler.setState의 Result를 확인하고 에러 전파
 */
async function runSetState(
  effect: SetStateEffect,
  handler: EffectHandler,
  context: EvaluationContext
): Promise<EffectResult> {
  const valueResult = evaluate(effect.value, context);
  if (!valueResult.ok) {
    return err(effectError(effect, new Error(valueResult.error)));
  }

  const handlerResult = handler.setState(effect.path, valueResult.value);
  if (!handlerResult.ok) {
    return err(
      effectError(effect, handlerResult.error.cause, {
        code: handlerResult.error.code ?? 'HANDLER_ERROR',
        context,
      })
    );
  }

  return ok(undefined);
}

/**
 * ApiCall 실행
 *
 * P0-1 Contract: handler.apiCall의 Result를 확인하고 에러 전파
 */
async function runApiCall(
  effect: ApiCallEffect,
  handler: EffectHandler,
  context: EvaluationContext
): Promise<EffectResult> {
  // 엔드포인트 평가
  let endpoint: string;
  if (typeof effect.endpoint === 'string') {
    endpoint = effect.endpoint;
  } else {
    const endpointResult = evaluate(effect.endpoint, context);
    if (!endpointResult.ok) {
      return err(effectError(effect, new Error(endpointResult.error)));
    }
    endpoint = String(endpointResult.value);
  }

  // body 평가
  let body: unknown = undefined;
  if (effect.body) {
    const evaluatedBody: Record<string, unknown> = {};
    for (const [key, expr] of Object.entries(effect.body)) {
      const result = evaluate(expr, context);
      if (!result.ok) {
        return err(effectError(effect, new Error(result.error)));
      }
      evaluatedBody[key] = result.value;
    }
    body = evaluatedBody;
  }

  // query 평가
  let query: Record<string, unknown> | undefined = undefined;
  if (effect.query) {
    query = {};
    for (const [key, expr] of Object.entries(effect.query)) {
      const result = evaluate(expr, context);
      if (!result.ok) {
        return err(effectError(effect, new Error(result.error)));
      }
      query[key] = result.value;
    }
  }

  // P0-1: handler.apiCall은 이제 Promise<Result<unknown, HandlerError>> 반환
  const handlerResult = await handler.apiCall({
    endpoint,
    method: effect.method,
    body,
    headers: effect.headers,
    query,
    timeout: effect.timeout,
  });

  if (!handlerResult.ok) {
    return err(
      effectError(effect, handlerResult.error.cause, {
        code: handlerResult.error.code ?? 'API_CALL_FAILED',
        context,
      })
    );
  }

  return ok(handlerResult.value);
}

/**
 * Navigate 실행
 *
 * P0-1 Contract: handler.navigate의 Result를 확인하고 에러 전파
 */
async function runNavigate(
  effect: NavigateEffect,
  handler: EffectHandler,
  context: EvaluationContext
): Promise<EffectResult> {
  let to: string;
  if (typeof effect.to === 'string') {
    to = effect.to;
  } else {
    const toResult = evaluate(effect.to, context);
    if (!toResult.ok) {
      return err(effectError(effect, new Error(toResult.error)));
    }
    to = String(toResult.value);
  }

  const handlerResult = handler.navigate(to, effect.mode);
  if (!handlerResult.ok) {
    return err(
      effectError(effect, handlerResult.error.cause, {
        code: handlerResult.error.code ?? 'NAVIGATE_ERROR',
        context,
      })
    );
  }

  return ok(undefined);
}

/**
 * Delay 실행
 */
async function runDelay(effect: DelayEffect): Promise<EffectResult> {
  await new Promise((resolve) => setTimeout(resolve, effect.ms));
  return ok(undefined);
}

/**
 * Sequence 실행
 */
async function runSequence(
  effect: SequenceEffect,
  config: EffectRunnerConfig
): Promise<EffectResult> {
  let lastResult: unknown = undefined;

  for (const childEffect of effect.effects) {
    const result = await runEffect(childEffect, config);
    if (!result.ok) {
      return result;
    }
    lastResult = result.value;
  }

  return ok(lastResult);
}

/**
 * Parallel 실행
 */
async function runParallel(
  effect: ParallelEffect,
  config: EffectRunnerConfig
): Promise<EffectResult> {
  const promises = effect.effects.map((e) => runEffect(e, config));

  if (effect.waitAll !== false) {
    const results = await Promise.all(promises);
    const values: unknown[] = [];

    for (const result of results) {
      if (!result.ok) {
        return result;
      }
      values.push(result.value);
    }

    return ok(values);
  } else {
    // 하나라도 완료되면 반환
    const result = await Promise.race(promises);
    return result;
  }
}

/**
 * Conditional 실행
 */
async function runConditional(
  effect: ConditionalEffect,
  config: EffectRunnerConfig
): Promise<EffectResult> {
  const conditionResult = evaluate(effect.condition, config.context);
  if (!conditionResult.ok) {
    return err(effectError(effect, new Error(conditionResult.error)));
  }

  if (conditionResult.value) {
    return runEffect(effect.then, config);
  } else if (effect.else) {
    return runEffect(effect.else, config);
  }

  return ok(undefined);
}

/**
 * Catch 실행
 */
async function runCatch(
  effect: CatchEffect,
  config: EffectRunnerConfig
): Promise<EffectResult> {
  let result: EffectResult;

  try {
    result = await runEffect(effect.try, config);
  } catch (e) {
    result = err(effectError(effect.try, e instanceof Error ? e : new Error(String(e))));
  }

  // 에러 발생 시 catch 실행
  if (!result.ok) {
    result = await runEffect(effect.catch, config);
  }

  // finally 항상 실행
  if (effect.finally) {
    await runEffect(effect.finally, config);
  }

  return result;
}

/**
 * EmitEvent 실행
 *
 * P0-1 Contract: handler.emitEvent의 Result를 확인하고 에러 전파
 */
async function runEmitEvent(
  effect: EmitEventEffect,
  handler: EffectHandler
): Promise<EffectResult> {
  const handlerResult = handler.emitEvent(effect.channel, effect.payload);
  if (!handlerResult.ok) {
    return err(
      effectError(effect, handlerResult.error.cause, {
        code: handlerResult.error.code ?? 'EMIT_EVENT_ERROR',
      })
    );
  }
  return ok(undefined);
}

// =============================================================================
// Effect Builders
// =============================================================================

/**
 * SetValue Effect 생성
 */
export function setValue(
  path: SemanticPath,
  value: Expression,
  description: string
): SetValueEffect {
  return { _tag: 'SetValue', path, value, description };
}

/**
 * SetState Effect 생성
 */
export function setState(
  path: SemanticPath,
  value: Expression,
  description: string
): SetStateEffect {
  return { _tag: 'SetState', path, value, description };
}

/**
 * ApiCall Effect 생성
 */
export function apiCall(options: Omit<ApiCallEffect, '_tag'>): ApiCallEffect {
  return { _tag: 'ApiCall', ...options };
}

/**
 * Navigate Effect 생성
 */
export function navigate(
  to: string | Expression,
  options?: { mode?: 'push' | 'replace'; description?: string }
): NavigateEffect {
  return {
    _tag: 'Navigate',
    to,
    mode: options?.mode,
    description: options?.description ?? `Navigate to ${typeof to === 'string' ? to : 'computed path'}`,
  };
}

/**
 * Delay Effect 생성
 */
export function delay(ms: number, description?: string): DelayEffect {
  return {
    _tag: 'Delay',
    ms,
    description: description ?? `Wait ${ms}ms`,
  };
}

/**
 * Sequence Effect 생성
 */
export function sequence(effects: Effect[], description?: string): SequenceEffect {
  return {
    _tag: 'Sequence',
    effects,
    description: description ?? `Sequence of ${effects.length} effects`,
  };
}

/**
 * Parallel Effect 생성
 */
export function parallel(
  effects: Effect[],
  options?: { waitAll?: boolean; description?: string }
): ParallelEffect {
  return {
    _tag: 'Parallel',
    effects,
    waitAll: options?.waitAll,
    description: options?.description ?? `Parallel execution of ${effects.length} effects`,
  };
}

/**
 * Conditional Effect 생성
 */
export function conditional(options: {
  condition: Expression;
  then: Effect;
  else?: Effect;
  description?: string;
}): ConditionalEffect {
  return {
    _tag: 'Conditional',
    condition: options.condition,
    then: options.then,
    else: options.else,
    description: options.description ?? 'Conditional effect',
  };
}

/**
 * Catch Effect 생성
 */
export function catchEffect(options: {
  try: Effect;
  catch: Effect;
  finally?: Effect;
  description?: string;
}): CatchEffect {
  return {
    _tag: 'Catch',
    try: options.try,
    catch: options.catch,
    finally: options.finally,
    description: options.description ?? 'Try-catch effect',
  };
}

/**
 * EmitEvent Effect 생성
 */
export function emitEvent(
  channel: 'ui' | 'domain' | 'analytics',
  payload: EmitEventEffect['payload'],
  description?: string
): EmitEventEffect {
  return {
    _tag: 'EmitEvent',
    channel,
    payload,
    description: description ?? `Emit ${payload.type} event`,
  };
}
