/**
 * useLegacyAdapter Composable
 *
 * PRD 3.3 - Vue 통합 레거시 어댑터
 * 레거시 API와의 통신을 위한 Vue Composable
 */

import { ref, readonly, type Ref } from 'vue'
import {
  createLegacyAdapter,
  type LegacyAdapterOptions,
  type AdapterError,
} from '@manifesto-ai/engine'
import type { AdapterConfig } from '@manifesto-ai/schema'

// ============================================================================
// Types
// ============================================================================

export interface UseLegacyAdapterOptions extends LegacyAdapterOptions {
  /** 기본 API 호출 함수 */
  fetch?: typeof globalThis.fetch
  /** 기본 Base URL */
  baseUrl?: string
}

export interface UseLegacyAdapterReturn {
  /** 요청 변환 */
  transformRequest: <T = unknown>(data: unknown, config: AdapterConfig) => T | null
  /** 응답 변환 */
  transformResponse: <T = unknown>(data: unknown, config: AdapterConfig) => T | null
  /** API 호출 + 변환 통합 */
  callApi: <TRequest = unknown, TResponse = unknown>(
    endpoint: string,
    data: TRequest,
    config: AdapterConfig,
    options?: CallApiOptions
  ) => Promise<TResponse | null>
  /** 로딩 상태 */
  isLoading: Readonly<Ref<boolean>>
  /** 에러 상태 */
  error: Readonly<Ref<AdapterError | null>>
  /** 에러 클리어 */
  clearError: () => void
}

export interface CallApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
}

// ============================================================================
// Composable
// ============================================================================

/**
 * useLegacyAdapter
 *
 * @example
 * ```vue
 * <script setup>
 * import { useLegacyAdapter } from '@manifesto-ai/vue'
 *
 * const { callApi, isLoading, error } = useLegacyAdapter({
 *   baseUrl: '/api/legacy'
 * })
 *
 * const adapterConfig = {
 *   type: 'legacy',
 *   requestTransform: {
 *     steps: [{ operation: 'rename', config: { renames: { name: 'PROD_NAME' } } }]
 *   },
 *   responseTransform: {
 *     steps: [{ operation: 'rename', config: { renames: { PROD_NAME: 'name' } } }]
 *   }
 * }
 *
 * async function saveProduct(product) {
 *   const result = await callApi('/products', product, adapterConfig, { method: 'POST' })
 *   if (result) {
 *     console.log('Saved:', result)
 *   }
 * }
 * </script>
 * ```
 */
export function useLegacyAdapter(options: UseLegacyAdapterOptions = {}): UseLegacyAdapterReturn {
  const adapter = createLegacyAdapter({
    debug: options.debug,
    xmlParser: options.xmlParser,
    timeout: options.timeout,
  })

  const isLoading = ref(false)
  const error = ref<AdapterError | null>(null)
  const fetchFn = options.fetch ?? globalThis.fetch
  const baseUrl = options.baseUrl ?? ''

  /**
   * 요청 데이터 변환
   */
  function transformRequest<T = unknown>(data: unknown, config: AdapterConfig): T | null {
    const result = adapter.transformRequest<T>(data, config)

    if (result._tag === 'Err') {
      error.value = result.error
      return null
    }

    return result.value
  }

  /**
   * 응답 데이터 변환
   */
  function transformResponse<T = unknown>(data: unknown, config: AdapterConfig): T | null {
    const result = adapter.transformResponse<T>(data, config)

    if (result._tag === 'Err') {
      error.value = result.error
      return null
    }

    return result.value
  }

  /**
   * API 호출 + 양방향 변환
   */
  async function callApi<TRequest = unknown, TResponse = unknown>(
    endpoint: string,
    data: TRequest,
    config: AdapterConfig,
    callOptions: CallApiOptions = {}
  ): Promise<TResponse | null> {
    error.value = null
    isLoading.value = true

    try {
      // 1. 요청 데이터 변환
      const transformedRequest = transformRequest(data, config)
      if (transformedRequest === null && config.requestTransform) {
        return null
      }

      // 2. API 호출
      const method = callOptions.method ?? 'POST'
      const url = `${baseUrl}${endpoint}`

      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...callOptions.headers,
        },
      }

      if (method !== 'GET' && transformedRequest !== undefined) {
        fetchOptions.body = JSON.stringify(transformedRequest ?? data)
      }

      const response = await fetchFn(url, fetchOptions)

      if (!response.ok) {
        error.value = {
          type: 'ADAPTER_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
          phase: 'response',
        }
        return null
      }

      // 3. 응답 데이터 파싱
      const contentType = response.headers.get('content-type') ?? ''
      let responseData: unknown

      if (contentType.includes('application/json')) {
        responseData = await response.json()
      } else if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
        responseData = await response.text()
      } else {
        responseData = await response.text()
      }

      // 4. 응답 데이터 변환
      const transformedResponse = transformResponse<TResponse>(responseData, config)
      if (transformedResponse === null && config.responseTransform) {
        return null
      }

      return (transformedResponse ?? responseData) as TResponse
    } catch (e) {
      error.value = {
        type: 'ADAPTER_ERROR',
        message: e instanceof Error ? e.message : 'Unknown error',
        originalError: e,
      }
      return null
    } finally {
      isLoading.value = false
    }
  }

  function clearError(): void {
    error.value = null
  }

  return {
    transformRequest,
    transformResponse,
    callApi,
    isLoading: readonly(isLoading),
    error: readonly(error),
    clearError,
  }
}
