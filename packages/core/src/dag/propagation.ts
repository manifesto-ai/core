import type { SemanticPath } from '../domain/types.js';
import type { DependencyGraph, DagNode } from './graph.js';
import type { Effect } from '../effect/types.js';
import type { Expression, EvaluationContext } from '../expression/types.js';
import { evaluate } from '../expression/evaluator.js';
import { getAffectedOrder } from './topological.js';

/**
 * 전파 결과
 */
export type PropagationResult = {
  /** 변경된 경로와 새 값 */
  changes: Map<SemanticPath, unknown>;

  /** 트리거된 Async Effect들 */
  pendingEffects: Array<{
    path: SemanticPath;
    effect: Effect;
  }>;

  /** 발생한 오류들 */
  errors: Array<{
    path: SemanticPath;
    error: string;
  }>;
};

/**
 * 스냅샷 인터페이스
 */
export type SnapshotLike = {
  get: (path: SemanticPath) => unknown;
  set: (path: SemanticPath, value: unknown) => void;
};

/**
 * 변경 전파
 */
export function propagate(
  graph: DependencyGraph,
  changedPaths: SemanticPath[],
  snapshot: SnapshotLike
): PropagationResult {
  const changes = new Map<SemanticPath, unknown>();
  const pendingEffects: PropagationResult['pendingEffects'] = [];
  const errors: PropagationResult['errors'] = [];

  // 영향받는 경로들을 위상 정렬 순서로 가져옴
  const affectedOrder = getAffectedOrder(graph, changedPaths);

  // 평가 컨텍스트 생성
  const ctx: EvaluationContext = {
    get: (path) => {
      // 이미 변경된 값이 있으면 그것을 반환
      if (changes.has(path)) {
        return changes.get(path);
      }
      return snapshot.get(path);
    },
  };

  // 순서대로 재계산
  for (const path of affectedOrder) {
    const node = graph.nodes.get(path);
    if (!node) continue;

    try {
      switch (node.kind) {
        case 'source':
          // Source는 외부 입력이므로 여기서 계산하지 않음
          // 하지만 변경된 경로에 포함되어 있으면 changes에 기록
          if (changedPaths.includes(path)) {
            changes.set(path, snapshot.get(path));
          }
          break;

        case 'derived':
          // Expression 평가
          const derivedResult = evaluate(node.definition.expr, ctx);
          if (derivedResult.ok) {
            const oldValue = snapshot.get(path);
            const newValue = derivedResult.value;
            if (!deepEqual(oldValue, newValue)) {
              changes.set(path, newValue);
              snapshot.set(path, newValue);
            }
          } else {
            errors.push({ path, error: derivedResult.error });
          }
          break;

        case 'async':
          // 조건 평가
          let shouldTrigger = true;
          if (node.definition.condition) {
            const condResult = evaluate(node.definition.condition, ctx);
            if (condResult.ok) {
              shouldTrigger = Boolean(condResult.value);
            } else {
              errors.push({ path, error: condResult.error });
              shouldTrigger = false;
            }
          }

          if (shouldTrigger) {
            pendingEffects.push({
              path,
              effect: node.definition.effect,
            });
            // 로딩 상태 업데이트
            changes.set(node.definition.loadingPath, true);
            snapshot.set(node.definition.loadingPath, true);
          }
          break;
      }
    } catch (e) {
      errors.push({
        path,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { changes, pendingEffects, errors };
}

/**
 * P0-2 Contract: Async path 규약 검증
 *
 * @param basePath - async 기본 경로 (e.g., 'async.userData')
 * @returns 규약 준수 여부와 상세 정보
 */
export function validateAsyncPathConvention(
  basePath: SemanticPath,
  definition: { resultPath: SemanticPath; loadingPath: SemanticPath; errorPath: SemanticPath }
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // 1. basePath가 async. prefix로 시작하는지 확인
  if (!basePath.startsWith('async.')) {
    issues.push(`Base path '${basePath}' should start with 'async.'`);
  }

  // 2. subpaths가 규약을 따르는지 확인
  const expectedResult = `${basePath}.result`;
  const expectedLoading = `${basePath}.loading`;
  const expectedError = `${basePath}.error`;

  if (definition.resultPath !== expectedResult) {
    issues.push(`resultPath '${definition.resultPath}' should be '${expectedResult}'`);
  }
  if (definition.loadingPath !== expectedLoading) {
    issues.push(`loadingPath '${definition.loadingPath}' should be '${expectedLoading}'`);
  }
  if (definition.errorPath !== expectedError) {
    issues.push(`errorPath '${definition.errorPath}' should be '${expectedError}'`);
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Async Effect 완료 후 결과 전파
 *
 * P0-2 Contract: 규약 불일치 시 경고 로그 출력
 */
export function propagateAsyncResult(
  graph: DependencyGraph,
  asyncPath: SemanticPath,
  result: { ok: true; value: unknown } | { ok: false; error: string },
  snapshot: SnapshotLike
): PropagationResult {
  const node = graph.nodes.get(asyncPath);
  if (!node || node.kind !== 'async') {
    return { changes: new Map(), pendingEffects: [], errors: [] };
  }

  const changes = new Map<SemanticPath, unknown>();
  const definition = node.definition;

  // P0-2: 규약 검증
  const validation = validateAsyncPathConvention(asyncPath, definition);
  if (!validation.valid) {
    console.warn(`[P0-2] Async path convention violation for '${asyncPath}':`, validation.issues);
  }

  // 로딩 상태 해제
  changes.set(definition.loadingPath, false);
  snapshot.set(definition.loadingPath, false);

  if (result.ok) {
    // 결과 저장
    changes.set(definition.resultPath, result.value);
    snapshot.set(definition.resultPath, result.value);
    // 에러 클리어
    changes.set(definition.errorPath, null);
    snapshot.set(definition.errorPath, null);
  } else {
    // 에러 저장
    changes.set(definition.errorPath, result.error);
    snapshot.set(definition.errorPath, result.error);
  }

  // 결과로 인한 추가 전파
  const resultPaths = [definition.resultPath, definition.loadingPath, definition.errorPath];
  const furtherPropagation = propagate(graph, resultPaths, snapshot);

  // 병합
  for (const [path, value] of furtherPropagation.changes) {
    changes.set(path, value);
  }

  return {
    changes,
    pendingEffects: furtherPropagation.pendingEffects,
    errors: furtherPropagation.errors,
  };
}

/**
 * 특정 경로 변경 시 영향 분석
 */
export function analyzeImpact(
  graph: DependencyGraph,
  path: SemanticPath
): {
  affectedPaths: SemanticPath[];
  affectedNodes: DagNode[];
  asyncTriggers: SemanticPath[];
} {
  const affectedOrder = getAffectedOrder(graph, [path]);
  const affectedNodes: DagNode[] = [];
  const asyncTriggers: SemanticPath[] = [];

  for (const affectedPath of affectedOrder) {
    const node = graph.nodes.get(affectedPath);
    if (node) {
      affectedNodes.push(node);
      if (node.kind === 'async') {
        asyncTriggers.push(affectedPath);
      }
    }
  }

  return {
    affectedPaths: affectedOrder,
    affectedNodes,
    asyncTriggers,
  };
}

/**
 * 깊은 동등성 비교 (간단한 구현)
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (Array.isArray(a) || Array.isArray(b)) return false;

  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (
      !deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    ) {
      return false;
    }
  }

  return true;
}

/**
 * 디바운스된 전파를 위한 유틸리티
 */
export function createDebouncedPropagator(
  graph: DependencyGraph,
  snapshot: SnapshotLike,
  debounceMs: number
): {
  queue: (paths: SemanticPath[]) => void;
  flush: () => PropagationResult;
  cancel: () => void;
} {
  let pendingPaths = new Set<SemanticPath>();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastResult: PropagationResult = {
    changes: new Map(),
    pendingEffects: [],
    errors: [],
  };

  return {
    queue(paths: SemanticPath[]): void {
      for (const path of paths) {
        pendingPaths.add(path);
      }

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        this.flush();
      }, debounceMs);
    },

    flush(): PropagationResult {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (pendingPaths.size === 0) {
        return lastResult;
      }

      lastResult = propagate(graph, [...pendingPaths], snapshot);
      pendingPaths = new Set();
      return lastResult;
    },

    cancel(): void {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      pendingPaths = new Set();
    },
  };
}
