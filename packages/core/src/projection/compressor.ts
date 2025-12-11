import type { Result } from '../effect/result.js';
import { ok, err } from '../effect/result.js';
import type {
  ProjectedSnapshot,
  ProjectionError,
  CompressionStrategy,
  CompressionResult,
} from './types.js';
import { estimateTokens } from './token-estimator.js';

/**
 * 스냅샷 압축 함수
 * 토큰 예산에 맞게 스냅샷을 압축
 *
 * @param projected - 투영된 스냅샷
 * @param budget - 토큰 예산
 * @param strategy - 압축 전략
 * @returns 압축 결과
 */
export function compressSnapshot(
  projected: ProjectedSnapshot,
  budget: number,
  strategy: CompressionStrategy
): Result<CompressionResult, ProjectionError> {
  const currentTokens = estimateTokens(projected);

  // 이미 예산 내라면 압축 불필요
  if (currentTokens <= budget) {
    return ok({
      snapshot: projected,
      tokenCount: currentTokens,
      itemsRemoved: 0,
      success: true,
    });
  }

  switch (strategy) {
    case 'truncate':
      return truncateStrategy(projected, budget);
    case 'prioritize':
      return prioritizeStrategy(projected, budget);
    case 'summarize':
      // summarize는 LLM이 필요하므로 truncate로 fallback
      return truncateStrategy(projected, budget);
    default:
      return truncateStrategy(projected, budget);
  }
}

/**
 * Truncate 전략: 배열 항목을 앞에서부터 잘라냄
 */
function truncateStrategy(
  projected: ProjectedSnapshot,
  budget: number
): Result<CompressionResult, ProjectionError> {
  const compressed = deepClone(projected);
  let itemsRemoved = 0;

  // 각 네임스페이스에서 배열을 찾아 truncate
  const namespaces = ['data', 'state', 'derived'] as const;

  for (const ns of namespaces) {
    const namespace = compressed[ns];
    if (!namespace) continue;

    for (const key of Object.keys(namespace)) {
      const value = namespace[key];
      if (Array.isArray(value) && value.length > 0) {
        const result = truncateArray(value, budget, compressed);
        if (result.removed > 0) {
          namespace[key] = result.array;
          itemsRemoved += result.removed;
        }
      }
    }

    // 중간 체크: 예산 내로 들어왔으면 중단
    if (estimateTokens(compressed) <= budget) {
      break;
    }
  }

  const finalTokens = estimateTokens(compressed);

  if (finalTokens > budget) {
    return err({
      code: 'CANNOT_FIT_BUDGET',
      message: `Cannot compress to ${budget} tokens. Current: ${finalTokens}`,
      details: { currentTokens: finalTokens, budget, itemsRemoved },
    });
  }

  return ok({
    snapshot: compressed,
    tokenCount: finalTokens,
    itemsRemoved,
    success: true,
  });
}

/**
 * Prioritize 전략: 중요도/관련성 점수 기반으로 항목 선택
 * 배열 내 객체에 relevanceScore, importance, priority 등의 필드가 있으면 활용
 */
function prioritizeStrategy(
  projected: ProjectedSnapshot,
  budget: number
): Result<CompressionResult, ProjectionError> {
  const compressed = deepClone(projected);
  let itemsRemoved = 0;

  const namespaces = ['data', 'state', 'derived'] as const;

  for (const ns of namespaces) {
    const namespace = compressed[ns];
    if (!namespace) continue;

    for (const key of Object.keys(namespace)) {
      const value = namespace[key];
      if (Array.isArray(value) && value.length > 0) {
        const result = prioritizeArray(value, budget, compressed);
        if (result.removed > 0) {
          namespace[key] = result.array;
          itemsRemoved += result.removed;
        }
      }
    }

    if (estimateTokens(compressed) <= budget) {
      break;
    }
  }

  const finalTokens = estimateTokens(compressed);

  if (finalTokens > budget) {
    // prioritize가 실패하면 truncate로 fallback
    return truncateStrategy(projected, budget);
  }

  return ok({
    snapshot: compressed,
    tokenCount: finalTokens,
    itemsRemoved,
    success: true,
  });
}

/**
 * 배열 truncate 헬퍼
 */
function truncateArray(
  array: unknown[],
  budget: number,
  fullSnapshot: ProjectedSnapshot
): { array: unknown[]; removed: number } {
  if (array.length === 0) {
    return { array, removed: 0 };
  }

  // 배열 길이를 절반씩 줄여가며 예산에 맞추기
  let currentArray = [...array];
  let removed = 0;
  const maxIterations = 20; // 무한 루프 방지
  let iteration = 0;

  while (currentArray.length > 1 && iteration < maxIterations) {
    iteration++;

    // 임시 스냅샷으로 토큰 수 계산
    const tempSnapshot = deepClone(fullSnapshot);
    updateArrayInSnapshot(tempSnapshot, array, currentArray);

    if (estimateTokens(tempSnapshot) <= budget) {
      break;
    }

    // 배열 크기 절반으로 줄이기
    const newLength = Math.max(1, Math.floor(currentArray.length / 2));
    removed += currentArray.length - newLength;
    currentArray = currentArray.slice(0, newLength);
  }

  return { array: currentArray, removed };
}

/**
 * 배열 prioritize 헬퍼
 * 객체 배열의 경우 우선순위 기반 정렬 후 상위 항목만 유지
 */
function prioritizeArray(
  array: unknown[],
  budget: number,
  fullSnapshot: ProjectedSnapshot
): { array: unknown[]; removed: number } {
  if (array.length === 0) {
    return { array, removed: 0 };
  }

  // 객체 배열인 경우 우선순위 기반 정렬
  if (typeof array[0] === 'object' && array[0] !== null) {
    const scored = array.map((item, index) => ({
      item,
      score: getItemPriority(item as Record<string, unknown>, index),
    }));

    // 점수 내림차순 정렬
    scored.sort((a, b) => b.score - a.score);

    // 상위 항목부터 예산 내에서 선택
    const selected: unknown[] = [];
    for (const { item } of scored) {
      const testSnapshot = deepClone(fullSnapshot);
      updateArrayInSnapshot(testSnapshot, array, [...selected, item]);

      if (estimateTokens(testSnapshot) <= budget) {
        selected.push(item);
      } else if (selected.length === 0) {
        // 최소 1개는 포함
        selected.push(item);
        break;
      } else {
        break;
      }
    }

    return {
      array: selected,
      removed: array.length - selected.length,
    };
  }

  // 객체가 아니면 truncate와 동일하게 처리
  return truncateArray(array, budget, fullSnapshot);
}

/**
 * 항목 우선순위 계산
 */
function getItemPriority(item: Record<string, unknown>, index: number): number {
  // 다양한 우선순위 필드 지원
  const priorityFields = [
    'relevanceScore',
    'relevance',
    'priority',
    'importance',
    'score',
    'weight',
  ];

  for (const field of priorityFields) {
    const value = item[field];
    if (typeof value === 'number') {
      return value;
    }
  }

  // 우선순위 필드가 없으면 인덱스 기반 (최근 항목 우선)
  return 1 / (index + 1);
}

/**
 * 스냅샷 내 배열 참조 업데이트 (비교용)
 */
function updateArrayInSnapshot(
  snapshot: ProjectedSnapshot,
  originalArray: unknown[],
  newArray: unknown[]
): void {
  const namespaces = ['data', 'state', 'derived'] as const;

  for (const ns of namespaces) {
    const namespace = snapshot[ns];
    if (!namespace) continue;

    for (const key of Object.keys(namespace)) {
      if (namespace[key] === originalArray) {
        namespace[key] = newArray;
        return;
      }
    }
  }
}

/**
 * 깊은 복사 헬퍼
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
