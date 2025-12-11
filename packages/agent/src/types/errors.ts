/**
 * @manifesto-ai/agent - Error Types
 *
 * 모든 실패는 상태가 된다 — 예외로 crash하지 않음.
 * 에러는 다음 step에서 LLM에게 전달되어 스스로 교정 유도.
 */

/**
 * Patch Validation Error State
 *
 * patch 검증 실패 시 생성되는 에러 상태.
 * 다음 step에서 LLM에게 전달되어 교정 유도.
 */
export type PatchErrorState = {
  kind: 'patch_validation_error';
  /** 문제 발생 path */
  at: string;
  /** 에러 유형 */
  issue:
    | 'Type mismatch'
    | 'Forbidden path'
    | 'Index out of bounds'
    | 'Invariant violated'
    | 'Invalid operation'
    | 'Invalid path format';
  /** 기대했던 값 */
  expected?: unknown;
  /** 실제로 받은 값 */
  got?: unknown;
  /** LLM을 위한 교정 조언 */
  advice?: string;
  /** 원인이 된 effect ID */
  effectId: string;
  /** 발생 시각 */
  ts: number;
};

/**
 * Effect Validation Error State
 *
 * effect 구조 검증 실패 시 생성되는 에러 상태.
 */
export type EffectErrorState = {
  kind: 'effect_validation_error';
  /** 원인이 된 effect ID */
  effectId: string;
  /** 에러 상세 */
  issue: string;
  /** 발생 시각 */
  ts: number;
};

/**
 * Handler Execution Error State
 *
 * effect 실행 중 발생한 런타임 에러.
 */
export type HandlerErrorState = {
  kind: 'handler_execution_error';
  /** 원인이 된 effect ID */
  effectId: string;
  /** 에러 상세 */
  issue: string;
  /** 발생 시각 */
  ts: number;
};

/**
 * 모든 에러 상태의 유니온 타입
 */
export type ErrorState = PatchErrorState | EffectErrorState | HandlerErrorState;

/**
 * 에러 상태 타입 가드
 */
export function isPatchErrorState(error: ErrorState): error is PatchErrorState {
  return error.kind === 'patch_validation_error';
}

export function isEffectErrorState(error: ErrorState): error is EffectErrorState {
  return error.kind === 'effect_validation_error';
}

export function isHandlerErrorState(error: ErrorState): error is HandlerErrorState {
  return error.kind === 'handler_execution_error';
}

/**
 * PatchErrorState 생성 헬퍼
 */
export function createPatchError(
  effectId: string,
  at: string,
  issue: PatchErrorState['issue'],
  options?: {
    expected?: unknown;
    got?: unknown;
    advice?: string;
  }
): PatchErrorState {
  return {
    kind: 'patch_validation_error',
    at,
    issue,
    effectId,
    ts: Date.now(),
    ...options,
  };
}

/**
 * EffectErrorState 생성 헬퍼
 */
export function createEffectError(effectId: string, issue: string): EffectErrorState {
  return {
    kind: 'effect_validation_error',
    effectId,
    issue,
    ts: Date.now(),
  };
}

/**
 * HandlerErrorState 생성 헬퍼
 */
export function createHandlerError(effectId: string, issue: string): HandlerErrorState {
  return {
    kind: 'handler_execution_error',
    effectId,
    issue,
    ts: Date.now(),
  };
}

/**
 * 에러 상태를 LLM 친화적 문자열로 변환
 */
export function formatErrorForLLM(error: ErrorState): string {
  if (isPatchErrorState(error)) {
    let msg = `[PATCH ERROR] at "${error.at}": ${error.issue}`;
    if (error.expected !== undefined) {
      msg += ` (expected: ${JSON.stringify(error.expected)})`;
    }
    if (error.got !== undefined) {
      msg += ` (got: ${JSON.stringify(error.got)})`;
    }
    if (error.advice) {
      msg += ` - Advice: ${error.advice}`;
    }
    return msg;
  }

  if (isEffectErrorState(error)) {
    return `[EFFECT ERROR] effect ${error.effectId}: ${error.issue}`;
  }

  if (isHandlerErrorState(error)) {
    return `[HANDLER ERROR] effect ${error.effectId}: ${error.issue}`;
  }

  return `[UNKNOWN ERROR] ${JSON.stringify(error)}`;
}
