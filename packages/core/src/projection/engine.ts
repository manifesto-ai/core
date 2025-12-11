import type { Result } from '../effect/result.js';
import { ok, err } from '../effect/result.js';
import type {
  ManifestoDomain,
  SemanticPath,
  ProjectionScopeConfig,
  ProjectionScopePath,
} from '../domain/types.js';
import type { DomainSnapshot } from '../runtime/snapshot.js';
import { getValueByPath } from '../runtime/snapshot.js';
import type {
  ProjectedContext,
  ProjectedSnapshot,
  ProjectionError,
  ProjectionEngineConfig,
  CompressionStrategy,
} from './types.js';
import { estimateTokens, setValueByPath as setProjectedValue } from './token-estimator.js';
import { compressSnapshot } from './compressor.js';

/**
 * 기본 토큰 예산
 */
const DEFAULT_TOKEN_BUDGET = 4000;

/**
 * ProjectionEngine: 스냅샷을 LLM 컨텍스트로 투영하는 엔진
 *
 * HSCA의 핵심 메커니즘으로, Action별로 정의된 projectionScope에 따라
 * 전체 스냅샷에서 필요한 부분만 추출하여 토큰 예산 내로 제한합니다.
 *
 * @example
 * ```typescript
 * const engine = new ProjectionEngine(domain);
 * const projected = engine.createLLMContext('analyzeQuery', snapshot);
 *
 * if (projected.ok) {
 *   console.log(`Tokens: ${projected.value.tokenCount}`);
 *   // LLM에게 projected.value.snapshot 전달
 * }
 * ```
 */
export class ProjectionEngine<TData = unknown, TState = unknown> {
  private readonly domain: ManifestoDomain<TData, TState>;
  private readonly config: Required<ProjectionEngineConfig>;

  constructor(
    domain: ManifestoDomain<TData, TState>,
    config: ProjectionEngineConfig = {}
  ) {
    this.domain = domain;
    this.config = {
      defaultTokenBudget: config.defaultTokenBudget ?? DEFAULT_TOKEN_BUDGET,
      tokenEstimator: config.tokenEstimator ?? estimateTokens,
      warnOnMissingScope: config.warnOnMissingScope ?? true,
    };
  }

  /**
   * 액션에 대한 LLM 컨텍스트 생성
   *
   * @param actionId - 액션 ID
   * @param fullSnapshot - 전체 도메인 스냅샷
   * @returns 투영된 컨텍스트 또는 에러
   */
  createLLMContext(
    actionId: string,
    fullSnapshot: DomainSnapshot<TData, TState>
  ): Result<ProjectedContext, ProjectionError> {
    // 1. 액션 찾기
    const action = this.domain.actions[actionId];
    if (!action) {
      return err({
        code: 'UNKNOWN_ACTION',
        message: `Action not found: ${actionId}`,
      });
    }

    // 2. projectionScope 정규화
    const scopeConfig = this.normalizeProjectionScope(action.projectionScope);

    // projectionScope가 비어있으면 경고
    if (scopeConfig.paths.length === 0) {
      if (this.config.warnOnMissingScope) {
        console.warn(
          `[ProjectionEngine] Action "${actionId}" has empty projectionScope. ` +
            `This may result in no context being provided to the LLM.`
        );
      }
      return ok({
        snapshot: {},
        tokenCount: 0,
        actionId,
        projectionScope: [],
      });
    }

    // 3. 스냅샷 투영
    const projected = this.projectSnapshot(fullSnapshot, scopeConfig.paths);

    // 4. 토큰 수 계산
    const tokenCount = this.config.tokenEstimator(projected);
    const budget = scopeConfig.tokenBudget ?? this.config.defaultTokenBudget;

    // 5. 예산 초과 시 압축
    if (tokenCount > budget) {
      const strategy = scopeConfig.compressionStrategy ?? 'truncate';
      const compressionResult = compressSnapshot(projected, budget, strategy);

      if (!compressionResult.ok) {
        return compressionResult;
      }

      return ok({
        snapshot: compressionResult.value.snapshot,
        tokenCount: compressionResult.value.tokenCount,
        actionId,
        projectionScope: scopeConfig.paths,
        compressed: true,
        compressionMetadata: {
          originalTokenCount: tokenCount,
          strategy,
          itemsRemoved: compressionResult.value.itemsRemoved,
        },
      });
    }

    return ok({
      snapshot: projected,
      tokenCount,
      actionId,
      projectionScope: scopeConfig.paths,
    });
  }

  /**
   * 여러 액션에 대한 LLM 컨텍스트 일괄 생성
   *
   * @param actionIds - 액션 ID 목록
   * @param fullSnapshot - 전체 도메인 스냅샷
   * @returns 액션별 투영 결과 맵
   */
  createLLMContextBatch(
    actionIds: string[],
    fullSnapshot: DomainSnapshot<TData, TState>
  ): Map<string, Result<ProjectedContext, ProjectionError>> {
    const results = new Map<string, Result<ProjectedContext, ProjectionError>>();

    for (const actionId of actionIds) {
      results.set(actionId, this.createLLMContext(actionId, fullSnapshot));
    }

    return results;
  }

  /**
   * 특정 경로들만 투영 (액션 없이 직접 사용)
   *
   * @param fullSnapshot - 전체 도메인 스냅샷
   * @param paths - 투영할 경로 목록
   * @param tokenBudget - 토큰 예산 (선택)
   * @returns 투영 결과
   */
  projectPaths(
    fullSnapshot: DomainSnapshot<TData, TState>,
    paths: SemanticPath[],
    tokenBudget?: number
  ): Result<ProjectedContext, ProjectionError> {
    if (paths.length === 0) {
      return err({
        code: 'EMPTY_PROJECTION',
        message: 'No paths specified for projection',
      });
    }

    const projected = this.projectSnapshot(fullSnapshot, paths);
    const tokenCount = this.config.tokenEstimator(projected);
    const budget = tokenBudget ?? this.config.defaultTokenBudget;

    if (tokenCount > budget) {
      const compressionResult = compressSnapshot(projected, budget, 'truncate');

      if (!compressionResult.ok) {
        return compressionResult;
      }

      return ok({
        snapshot: compressionResult.value.snapshot,
        tokenCount: compressionResult.value.tokenCount,
        actionId: '__direct__',
        projectionScope: paths,
        compressed: true,
        compressionMetadata: {
          originalTokenCount: tokenCount,
          strategy: 'truncate',
          itemsRemoved: compressionResult.value.itemsRemoved,
        },
      });
    }

    return ok({
      snapshot: projected,
      tokenCount,
      actionId: '__direct__',
      projectionScope: paths,
    });
  }

  /**
   * projectionScope 정규화
   * 배열 또는 객체 형태의 scope를 ProjectionScopeConfig로 변환
   */
  private normalizeProjectionScope(
    scope: ProjectionScopeConfig | ProjectionScopePath[] | undefined
  ): ProjectionScopeConfig {
    if (!scope) {
      return { paths: [] };
    }

    if (Array.isArray(scope)) {
      return { paths: scope };
    }

    return scope;
  }

  /**
   * 스냅샷에서 지정된 경로만 추출
   */
  private projectSnapshot(
    fullSnapshot: DomainSnapshot<TData, TState>,
    paths: SemanticPath[]
  ): ProjectedSnapshot {
    const projected: ProjectedSnapshot = {};

    for (const path of paths) {
      const value = getValueByPath(fullSnapshot, path);

      if (value !== undefined) {
        setProjectedValue(projected as Record<string, unknown>, path, value);
      }
    }

    return projected;
  }

  /**
   * 액션의 예상 토큰 수 계산
   * 실제 스냅샷 없이 projectionScope 기반으로 추정
   *
   * @param actionId - 액션 ID
   * @param sampleSnapshot - 샘플 스냅샷 (선택)
   * @returns 예상 토큰 수 또는 -1 (계산 불가)
   */
  estimateActionTokens(
    actionId: string,
    sampleSnapshot?: DomainSnapshot<TData, TState>
  ): number {
    const action = this.domain.actions[actionId];
    if (!action) {
      return -1;
    }

    const scopeConfig = this.normalizeProjectionScope(action.projectionScope);

    if (scopeConfig.paths.length === 0) {
      return 0;
    }

    if (!sampleSnapshot) {
      // 경로 수 기반 대략적 추정 (경로당 평균 100토큰)
      return scopeConfig.paths.length * 100;
    }

    const projected = this.projectSnapshot(sampleSnapshot, scopeConfig.paths);
    return this.config.tokenEstimator(projected);
  }

  /**
   * 모든 액션의 projectionScope 검증
   *
   * @returns 검증 결과
   */
  validateAllScopes(): {
    valid: boolean;
    issues: Array<{ actionId: string; issue: string }>;
  } {
    const issues: Array<{ actionId: string; issue: string }> = [];

    for (const [actionId, action] of Object.entries(this.domain.actions)) {
      const scopeConfig = this.normalizeProjectionScope(action.projectionScope);

      if (scopeConfig.paths.length === 0) {
        issues.push({
          actionId,
          issue: 'Empty projectionScope - LLM will receive no context',
        });
      }

      // deps에 있지만 projectionScope에 없는 경로 확인
      const missingPaths = action.deps.filter(
        (dep) => !scopeConfig.paths.some((p) => p === dep || dep.startsWith(p + '.'))
      );

      if (missingPaths.length > 0) {
        issues.push({
          actionId,
          issue: `deps paths not in projectionScope: ${missingPaths.join(', ')}`,
        });
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

/**
 * ProjectionEngine 생성 헬퍼
 */
export function createProjectionEngine<TData = unknown, TState = unknown>(
  domain: ManifestoDomain<TData, TState>,
  config?: ProjectionEngineConfig
): ProjectionEngine<TData, TState> {
  return new ProjectionEngine(domain, config);
}
