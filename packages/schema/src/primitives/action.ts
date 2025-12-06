/**
 * Action Primitives - 액션 스텝 빌더
 *
 * 데이터 흐름과 부수 효과를 선언적으로 정의
 */

import type {
  ActionStep,
  ApiCallStep,
  TransformStep,
  ConditionStep,
  ParallelStep,
  SetStateStep,
  NavigationStep,
  AdapterConfig,
  Expression,
} from '../types'

// ============================================================================
// API Call Builder
// ============================================================================

export interface ApiCallBuilder {
  readonly _step: ApiCallStep
  headers(headers: Record<string, string | Expression>): ApiCallBuilder
  body(body: Record<string, unknown> | Expression): ApiCallBuilder
  adapter(config: AdapterConfig): ApiCallBuilder
  outputAs(key: string): ApiCallBuilder
  build(): ApiCallStep
}

const createApiCallBuilder = (step: ApiCallStep): ApiCallBuilder => ({
  _step: step,

  headers(headers) {
    return createApiCallBuilder({ ...this._step, headers })
  },

  body(body) {
    return createApiCallBuilder({ ...this._step, body })
  },

  adapter(adapter) {
    return createApiCallBuilder({ ...this._step, adapter })
  },

  outputAs(outputKey) {
    return createApiCallBuilder({ ...this._step, outputKey })
  },

  build() {
    return this._step
  },
})

export const api = {
  get(id: string, endpoint: string): ApiCallBuilder {
    return createApiCallBuilder({
      _step: 'apiCall',
      id,
      endpoint,
      method: 'GET',
    })
  },

  post(id: string, endpoint: string): ApiCallBuilder {
    return createApiCallBuilder({
      _step: 'apiCall',
      id,
      endpoint,
      method: 'POST',
    })
  },

  put(id: string, endpoint: string): ApiCallBuilder {
    return createApiCallBuilder({
      _step: 'apiCall',
      id,
      endpoint,
      method: 'PUT',
    })
  },

  patch(id: string, endpoint: string): ApiCallBuilder {
    return createApiCallBuilder({
      _step: 'apiCall',
      id,
      endpoint,
      method: 'PATCH',
    })
  },

  delete(id: string, endpoint: string): ApiCallBuilder {
    return createApiCallBuilder({
      _step: 'apiCall',
      id,
      endpoint,
      method: 'DELETE',
    })
  },
}

// ============================================================================
// Transform Step
// ============================================================================

export const transform = {
  map(id: string, config: Record<string, unknown>): TransformStep {
    return { _step: 'transform', id, operation: 'map', config }
  },

  filter(id: string, config: Record<string, unknown>): TransformStep {
    return { _step: 'transform', id, operation: 'filter', config }
  },

  reduce(id: string, config: Record<string, unknown>): TransformStep {
    return { _step: 'transform', id, operation: 'reduce', config }
  },

  pick(id: string, fields: string[]): TransformStep {
    return { _step: 'transform', id, operation: 'pick', config: { fields } }
  },

  omit(id: string, fields: string[]): TransformStep {
    return { _step: 'transform', id, operation: 'omit', config: { fields } }
  },

  rename(id: string, mapping: Record<string, string>): TransformStep {
    return { _step: 'transform', id, operation: 'rename', config: { mapping } }
  },

  custom(id: string, config: Record<string, unknown>): TransformStep {
    return { _step: 'transform', id, operation: 'custom', config }
  },
}

// ============================================================================
// Condition Step
// ============================================================================

export const condition = (
  id: string,
  expr: Expression,
  thenSteps: ActionStep[],
  elseSteps?: ActionStep[]
): ConditionStep => ({
  _step: 'condition',
  id,
  condition: expr,
  then: thenSteps,
  else: elseSteps,
})

// ============================================================================
// Parallel Step
// ============================================================================

export const parallel = {
  all(id: string, steps: ActionStep[]): ParallelStep {
    return { _step: 'parallel', id, steps, mode: 'all' }
  },

  race(id: string, steps: ActionStep[]): ParallelStep {
    return { _step: 'parallel', id, steps, mode: 'race' }
  },

  allSettled(id: string, steps: ActionStep[]): ParallelStep {
    return { _step: 'parallel', id, steps, mode: 'allSettled' }
  },
}

// ============================================================================
// Set State Step
// ============================================================================

export const setState = (
  id: string,
  updates: Record<string, Expression | unknown>
): SetStateStep => ({
  _step: 'setState',
  id,
  updates,
})

// ============================================================================
// Navigation Step
// ============================================================================

export const navigate = (
  id: string,
  path: string,
  options?: { params?: Record<string, unknown>; replace?: boolean }
): NavigationStep => ({
  _step: 'navigation',
  id,
  path,
  params: options?.params,
  replace: options?.replace,
})

// ============================================================================
// Adapter Helpers
// ============================================================================

export const adapter = {
  legacy(
    requestTransform?: { steps: TransformStep[] },
    responseTransform?: { steps: TransformStep[] }
  ): AdapterConfig {
    return {
      type: 'legacy',
      requestTransform,
      responseTransform,
    }
  },

  graphql(
    requestTransform?: { steps: TransformStep[] },
    responseTransform?: { steps: TransformStep[] }
  ): AdapterConfig {
    return {
      type: 'graphql',
      requestTransform,
      responseTransform,
    }
  },

  soap(
    requestTransform?: { steps: TransformStep[] },
    responseTransform?: { steps: TransformStep[] }
  ): AdapterConfig {
    return {
      type: 'soap',
      requestTransform,
      responseTransform,
    }
  },
}
