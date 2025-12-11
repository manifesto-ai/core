/**
 * @manifesto-ai/agent - Constraints Types
 *
 * Schema에서 컴파일된 런타임 규칙.
 * JIT 주입되어 LLM의 행동을 제어.
 */

/**
 * Type rules for path validation
 */
export type TypeRule = {
  path: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
};

/**
 * Invariant - phase별 불변 조건
 */
export type Invariant = {
  id: string;
  /** LLM용 자연어 설명 */
  description: string;
  /** 검증 함수 (런타임에서 사용) */
  check?: (snapshot: unknown) => boolean;
};

/**
 * Constraints - Schema에서 컴파일된 런타임 규칙
 *
 * JIT 주입 원칙:
 * - System prompt: 불변 프로토콜만 (Iron Laws)
 * - Per-step: 현재 phase Constraints + 스냅샷 핵심 + 최근 오류
 */
export type Constraints = {
  /** 현재 phase 이름 */
  phase: string;

  /**
   * 쓰기 가능한 경로 접두사
   * 예: ["data.", "state."]
   * derived.* 는 절대 포함되면 안됨
   */
  writablePathPrefixes: string[];

  /**
   * 경로별 기대 타입 규칙
   */
  typeRules: TypeRule[];

  /**
   * phase별 불변 조건
   */
  invariants: Invariant[];
};

/**
 * 기본 Constraints 생성
 */
export function createDefaultConstraints(phase: string = 'default'): Constraints {
  return {
    phase,
    writablePathPrefixes: ['data.', 'state.'],
    typeRules: [],
    invariants: [],
  };
}

/**
 * Constraints에 type rule 추가
 */
export function addTypeRule(
  constraints: Constraints,
  path: string,
  type: TypeRule['type']
): Constraints {
  return {
    ...constraints,
    typeRules: [...constraints.typeRules, { path, type }],
  };
}

/**
 * Constraints에 invariant 추가
 */
export function addInvariant(
  constraints: Constraints,
  id: string,
  description: string,
  check?: (snapshot: unknown) => boolean
): Constraints {
  return {
    ...constraints,
    invariants: [...constraints.invariants, { id, description, check }],
  };
}

/**
 * Constraints 병합
 */
export function mergeConstraints(base: Constraints, override: Partial<Constraints>): Constraints {
  return {
    phase: override.phase ?? base.phase,
    writablePathPrefixes: override.writablePathPrefixes ?? base.writablePathPrefixes,
    typeRules: override.typeRules ?? base.typeRules,
    invariants: override.invariants ?? base.invariants,
  };
}
