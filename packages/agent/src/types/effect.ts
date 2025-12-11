/**
 * @manifesto-ai/agent - Effect Types
 *
 * Effect는 LLM이 선언하는 의도. 실행은 Runtime이 담당.
 * v0.1에서는 tool.call, snapshot.patch, log.emit 3가지만 지원.
 */

/**
 * PatchOp - Snapshot을 수정하는 연산
 *
 * Path 규칙:
 * - dot-separated: 객체 경로는 점으로 구분 (예: "data.plan.items")
 * - 배열 인덱스 허용: 숫자는 배열 인덱스로 해석 (예: "data.items.0.status")
 * - 0-based indexing: 인덱스는 0부터 시작
 * - Bounds check: 0 <= idx < length 위반 시 ValidationError
 *
 * 삭제 의미론 (v0.1):
 * - set(path, null): 값을 null로 설정 (삭제 아님)
 * - 배열 항목 제거: 전체 배열 교체로 대체
 * - 객체 필드 삭제: v0.1 미지원
 *
 * 금지 연산: delete, move, replace, copy
 */
export type PatchOp =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'append'; path: string; value: unknown };

/**
 * Tool call effect - 도구 실행 의도
 */
export type ToolCallEffect = {
  type: 'tool.call';
  id: string;
  tool: string;
  input: unknown;
};

/**
 * Snapshot patch effect - 스냅샷 수정 의도
 */
export type SnapshotPatchEffect = {
  type: 'snapshot.patch';
  id: string;
  ops: PatchOp[];
  reason?: string;
};

/**
 * Log emit effect - 로그 출력 의도
 */
export type LogEmitEffect = {
  type: 'log.emit';
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
};

/**
 * Human ask effect - 사용자 질의 의도
 * Note: v0.1에서 타입만 정의, 런타임 지원은 v0.2로 이관
 */
export type HumanAskEffect = {
  type: 'human.ask';
  id: string;
  question: string;
  options?: string[];
};

/**
 * Effect - LLM이 선언하는 모든 의도의 유니온 타입
 * v0.1에서는 human.ask를 제외한 3가지만 런타임 지원
 */
export type Effect =
  | ToolCallEffect
  | SnapshotPatchEffect
  | LogEmitEffect;
// Note: HumanAskEffect는 v0.2에서 추가 예정

/**
 * Effect 타입 가드
 */
export function isToolCallEffect(effect: Effect): effect is ToolCallEffect {
  return effect.type === 'tool.call';
}

export function isSnapshotPatchEffect(effect: Effect): effect is SnapshotPatchEffect {
  return effect.type === 'snapshot.patch';
}

export function isLogEmitEffect(effect: Effect): effect is LogEmitEffect {
  return effect.type === 'log.emit';
}

/**
 * Effect ID 생성 유틸리티
 */
export function generateEffectId(): string {
  return `eff_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
