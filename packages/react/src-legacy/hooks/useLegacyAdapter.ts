/**
 * useLegacyAdapter Hook
 *
 * PRD 3.3 - React Legacy Adapter
 * Hook for communicating with legacy APIs
 */

import { useState, useCallback, useRef } from 'react'
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
  /** Default fetch function */
  fetch?: typeof globalThis.fetch
  /** Default Base URL */
  baseUrl?: string
}

export interface UseLegacyAdapterReturn {
  /** Transform request */
  transformRequest: <T = unknown>(data: unknown, config: AdapterConfig) => T | null
  /** Transform response */
  transformResponse: <T = unknown>(data: unknown, config: AdapterConfig) => T | null
  /** API call + transform integrated */
  callApi: <TRequest = unknown, TResponse = unknown>(
    endpoint: string,
    data: TRequest,
    config: AdapterConfig,
    options?: CallApiOptions
  ) => Promise<TResponse | null>
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: AdapterError | null
  /** Clear error */
  clearError: () => void
}

export interface CallApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useLegacyAdapter
 *
 * @example
 * ```tsx
 * import { useLegacyAdapter } from '@manifesto-ai/react'
 *
 * function MyComponent() {
 *   const { callApi, isLoading, error } = useLegacyAdapter({
 *     baseUrl: '/api/legacy'
 *   })
 *
 *   const adapterConfig = {
 *     type: 'legacy',
 *     requestTransform: {
 *       steps: [{ operation: 'rename', config: { renames: { name: 'PROD_NAME' } } }]
 *     },
 *     responseTransform: {
 *       steps: [{ operation: 'rename', config: { renames: { PROD_NAME: 'name' } } }]
 *     }
 *   }
 *
 *   async function saveProduct(product) {
 *     const result = await callApi('/products', product, adapterConfig, { method: 'POST' })
 *     if (result) {
 *       console.log('Saved:', result)
 *     }
 *   }
 *
 *   return <button onClick={() => saveProduct({ name: 'Test' })}>Save</button>
 * }
 * ```
 */
export function useLegacyAdapter(options: UseLegacyAdapterOptions = {}): UseLegacyAdapterReturn {
  const adapterRef = useRef(createLegacyAdapter({
    debug: options.debug,
    xmlParser: options.xmlParser,
    timeout: options.timeout,
  }))

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<AdapterError | null>(null)
  const fetchFn = options.fetch ?? globalThis.fetch
  const baseUrl = options.baseUrl ?? ''

  /**
   * Transform request data
   */
  const transformRequest = useCallback(<T = unknown>(data: unknown, config: AdapterConfig): T | null => {
    const result = adapterRef.current.transformRequest<T>(data, config)

    if (result._tag === 'Err') {
      setError(result.error)
      return null
    }

    return result.value
  }, [])

  /**
   * Transform response data
   */
  const transformResponse = useCallback(<T = unknown>(data: unknown, config: AdapterConfig): T | null => {
    const result = adapterRef.current.transformResponse<T>(data, config)

    if (result._tag === 'Err') {
      setError(result.error)
      return null
    }

    return result.value
  }, [])

  /**
   * API call + bidirectional transform
   */
  const callApi = useCallback(async <TRequest = unknown, TResponse = unknown>(
    endpoint: string,
    data: TRequest,
    config: AdapterConfig,
    callOptions: CallApiOptions = {}
  ): Promise<TResponse | null> => {
    setError(null)
    setIsLoading(true)

    try {
      // 1. Transform request data
      const transformedRequest = transformRequest(data, config)
      if (transformedRequest === null && config.requestTransform) {
        return null
      }

      // 2. API call
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
        setError({
          type: 'ADAPTER_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
          phase: 'response',
        })
        return null
      }

      // 3. Parse response data
      const contentType = response.headers.get('content-type') ?? ''
      let responseData: unknown

      if (contentType.includes('application/json')) {
        responseData = await response.json()
      } else if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
        responseData = await response.text()
      } else {
        responseData = await response.text()
      }

      // 4. Transform response data
      const transformedResponse = transformResponse<TResponse>(responseData, config)
      if (transformedResponse === null && config.responseTransform) {
        return null
      }

      return (transformedResponse ?? responseData) as TResponse
    } catch (e) {
      setError({
        type: 'ADAPTER_ERROR',
        message: e instanceof Error ? e.message : 'Unknown error',
        originalError: e,
      })
      return null
    } finally {
      setIsLoading(false)
    }
  }, [baseUrl, fetchFn, transformRequest, transformResponse])

  const clearError = useCallback((): void => {
    setError(null)
  }, [])

  return {
    transformRequest,
    transformResponse,
    callApi,
    isLoading,
    error,
    clearError,
  }
}
