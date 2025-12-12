/**
 * @manifesto-ai/agent - Projection Provider
 *
 * LLM 컨텍스트 투영 제공자 구현.
 *
 * @version 0.1.x
 */

import type {
  ProjectionProvider,
  ProjectionProviderConfig,
  ProjectionResult,
  ProjectionMetadata,
  CompressionStrategy,
  CreateProjectionProviderOptions,
} from './types.js';

/**
 * 기본 토큰 예산
 */
const DEFAULT_TOKEN_BUDGET = 4000;

/**
 * 기본 압축 전략
 */
const DEFAULT_COMPRESSION_STRATEGY: CompressionStrategy = 'truncate';

/**
 * 간단한 토큰 추정 함수
 * JSON 문자열 길이를 기반으로 대략적인 토큰 수를 추정
 * (실제로는 약 4글자 = 1토큰으로 계산)
 */
function defaultTokenEstimator(obj: unknown): number {
  const jsonStr = JSON.stringify(obj);
  return Math.ceil(jsonStr.length / 4);
}

/**
 * 경로로 값 조회
 */
function getValueByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    const index = parseInt(part, 10);
    if (!isNaN(index) && Array.isArray(current)) {
      current = current[index];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * 경로에 값 설정
 */
function setValueByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in current)) {
      // 다음 부분이 숫자면 배열, 아니면 객체 생성
      const nextPart = parts[i + 1]!;
      const isNextIndex = !isNaN(parseInt(nextPart, 10));
      current[part] = isNextIndex ? [] : {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = value;
}

/**
 * 스냅샷에서 지정된 경로만 추출
 */
function projectSnapshot<S>(
  fullSnapshot: S,
  paths: string[],
  excludePaths: string[] = []
): Partial<S> {
  const projected: Record<string, unknown> = {};

  for (const path of paths) {
    // 제외 경로 확인
    if (excludePaths.some((ep) => path.startsWith(ep))) {
      continue;
    }

    const value = getValueByPath(fullSnapshot, path);
    if (value !== undefined) {
      setValueByPath(projected, path, value);
    }
  }

  return projected as Partial<S>;
}

/**
 * truncate 압축: 배열 항목 수 제한
 */
function truncateSnapshot(
  snapshot: Record<string, unknown>,
  targetTokens: number,
  tokenEstimator: (obj: unknown) => number
): { snapshot: Record<string, unknown>; itemsRemoved: number } {
  let itemsRemoved = 0;
  const truncated = JSON.parse(JSON.stringify(snapshot));

  const truncateArrays = (obj: unknown, maxItems: number = 10): unknown => {
    if (Array.isArray(obj)) {
      if (obj.length > maxItems) {
        itemsRemoved += obj.length - maxItems;
        return obj.slice(0, maxItems);
      }
      return obj.map((item) => truncateArrays(item, maxItems));
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = truncateArrays(value, maxItems);
      }
      return result;
    }
    return obj;
  };

  // 점진적으로 배열 크기 줄이기
  let currentMaxItems = 50;
  let result = truncateArrays(truncated, currentMaxItems);

  while (tokenEstimator(result) > targetTokens && currentMaxItems > 1) {
    currentMaxItems = Math.floor(currentMaxItems / 2);
    result = truncateArrays(truncated, currentMaxItems);
  }

  return {
    snapshot: result as Record<string, unknown>,
    itemsRemoved,
  };
}

/**
 * 단순 경로 기반 ProjectionProvider 생성
 *
 * core 의존 없이 경로 기반 필터링만 제공하는 간단한 Provider.
 *
 * @example
 * ```ts
 * const provider = createSimpleProjectionProvider({
 *   paths: ['data.currentItem', 'state.phase', 'derived.computedValue'],
 *   config: {
 *     tokenBudget: 4000,
 *     compressionStrategy: 'truncate',
 *   },
 * });
 *
 * const result = provider.project(fullSnapshot);
 * console.log(result.metadata.tokenCount);
 * ```
 */
export function createSimpleProjectionProvider<S = unknown>(
  options: CreateProjectionProviderOptions
): ProjectionProvider<S> {
  const { paths, config = {} } = options;
  const {
    tokenBudget = DEFAULT_TOKEN_BUDGET,
    requiredPaths = [],
    excludePaths = [],
    compressionStrategy = DEFAULT_COMPRESSION_STRATEGY,
    tokenEstimator = defaultTokenEstimator,
  } = config;

  // 모든 투영 경로 (required + 지정된 paths)
  const allPaths = [...new Set([...requiredPaths, ...paths])];

  let lastMetadata: ProjectionMetadata | undefined;

  return {
    project(fullSnapshot: S): ProjectionResult<Partial<S>> {
      // 1. 경로 기반 투영
      const projected = projectSnapshot(fullSnapshot, allPaths, excludePaths);

      // 2. 토큰 수 추정
      let tokenCount = tokenEstimator(projected);
      let compressed = false;
      let itemsRemoved = 0;

      // 3. 예산 초과 시 압축 적용
      if (tokenCount > tokenBudget && compressionStrategy === 'truncate') {
        const truncateResult = truncateSnapshot(
          projected as Record<string, unknown>,
          tokenBudget,
          tokenEstimator
        );
        Object.assign(projected, truncateResult.snapshot);
        tokenCount = tokenEstimator(projected);
        compressed = true;
        itemsRemoved = truncateResult.itemsRemoved;
      }

      // 4. 메타데이터 생성
      const metadata: ProjectionMetadata = {
        isProjected: true,
        tokenCount,
        includedPaths: allPaths.filter((p) => !excludePaths.some((ep) => p.startsWith(ep))),
        compressed,
        ...(compressed && { compressionStrategy }),
      };

      lastMetadata = metadata;

      return { snapshot: projected, metadata };
    },

    getMetadata(): ProjectionMetadata | undefined {
      return lastMetadata;
    },

    getConfig(): ProjectionProviderConfig {
      return {
        tokenBudget,
        requiredPaths,
        excludePaths,
        compressionStrategy,
        tokenEstimator,
      };
    },
  };
}

/**
 * Identity ProjectionProvider (투영 없음)
 *
 * 전체 스냅샷을 그대로 반환하는 Provider.
 * 하위 호환성 유지 및 테스트용.
 *
 * @example
 * ```ts
 * const provider = createIdentityProjectionProvider();
 * const result = provider.project(fullSnapshot);
 * // result.snapshot === fullSnapshot
 * ```
 */
export function createIdentityProjectionProvider<S = unknown>(
  config?: Pick<ProjectionProviderConfig, 'tokenEstimator'>
): ProjectionProvider<S> {
  const tokenEstimator = config?.tokenEstimator ?? defaultTokenEstimator;
  let lastMetadata: ProjectionMetadata | undefined;

  return {
    project(fullSnapshot: S): ProjectionResult<Partial<S>> {
      const tokenCount = tokenEstimator(fullSnapshot);

      const metadata: ProjectionMetadata = {
        isProjected: false,
        tokenCount,
        includedPaths: [],
        compressed: false,
      };

      lastMetadata = metadata;

      return { snapshot: fullSnapshot as Partial<S>, metadata };
    },

    getMetadata(): ProjectionMetadata | undefined {
      return lastMetadata;
    },

    getConfig(): ProjectionProviderConfig {
      return { tokenEstimator };
    },
  };
}

/**
 * 동적 경로 ProjectionProvider 생성
 *
 * 스냅샷 상태에 따라 동적으로 경로를 결정하는 Provider.
 *
 * @example
 * ```ts
 * const provider = createDynamicProjectionProvider({
 *   pathResolver: (snapshot) => {
 *     const paths = ['state.phase'];
 *     if (snapshot.state.phase === 'editing') {
 *       paths.push('data.currentItem');
 *     }
 *     return paths;
 *   },
 *   config: { tokenBudget: 4000 },
 * });
 * ```
 */
export function createDynamicProjectionProvider<S = unknown>(options: {
  /** 스냅샷에서 투영할 경로를 결정하는 함수 */
  pathResolver: (snapshot: S) => string[];
  /** Provider 설정 */
  config?: ProjectionProviderConfig;
}): ProjectionProvider<S> {
  const { pathResolver, config = {} } = options;
  const {
    tokenBudget = DEFAULT_TOKEN_BUDGET,
    requiredPaths = [],
    excludePaths = [],
    compressionStrategy = DEFAULT_COMPRESSION_STRATEGY,
    tokenEstimator = defaultTokenEstimator,
  } = config;

  let lastMetadata: ProjectionMetadata | undefined;

  return {
    project(fullSnapshot: S): ProjectionResult<Partial<S>> {
      // 1. 동적 경로 결정
      const dynamicPaths = pathResolver(fullSnapshot);
      const allPaths = [...new Set([...requiredPaths, ...dynamicPaths])];

      // 2. 경로 기반 투영
      const projected = projectSnapshot(fullSnapshot, allPaths, excludePaths);

      // 3. 토큰 수 추정
      let tokenCount = tokenEstimator(projected);
      let compressed = false;

      // 4. 예산 초과 시 압축 적용
      if (tokenCount > tokenBudget && compressionStrategy === 'truncate') {
        const truncateResult = truncateSnapshot(
          projected as Record<string, unknown>,
          tokenBudget,
          tokenEstimator
        );
        Object.assign(projected, truncateResult.snapshot);
        tokenCount = tokenEstimator(projected);
        compressed = true;
      }

      // 5. 메타데이터 생성
      const metadata: ProjectionMetadata = {
        isProjected: true,
        tokenCount,
        includedPaths: allPaths.filter((p) => !excludePaths.some((ep) => p.startsWith(ep))),
        compressed,
        ...(compressed && { compressionStrategy }),
      };

      lastMetadata = metadata;

      return { snapshot: projected, metadata };
    },

    getMetadata(): ProjectionMetadata | undefined {
      return lastMetadata;
    },

    getConfig(): ProjectionProviderConfig {
      return {
        tokenBudget,
        requiredPaths,
        excludePaths,
        compressionStrategy,
        tokenEstimator,
      };
    },
  };
}
