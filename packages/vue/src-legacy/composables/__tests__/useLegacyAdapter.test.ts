/**
 * useLegacyAdapter Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLegacyAdapter } from '../useLegacyAdapter'
import type { AdapterConfig } from '@manifesto-ai/schema'

describe('useLegacyAdapter', () => {
  describe('transformRequest', () => {
    it('should transform request data', () => {
      const { transformRequest } = useLegacyAdapter()

      const config: AdapterConfig = {
        type: 'legacy',
        requestTransform: {
          steps: [
            {
              _step: 'transform',
              id: 'rename',
              operation: 'rename',
              config: {
                renames: {
                  name: 'PROD_NAME',
                  price: 'PROD_PRICE',
                },
              },
            },
          ],
        },
      }

      const result = transformRequest({ name: 'Widget', price: 99.99 }, config)

      expect(result).toEqual({
        PROD_NAME: 'Widget',
        PROD_PRICE: 99.99,
      })
    })

    it('should return original data without transform config', () => {
      const { transformRequest } = useLegacyAdapter()
      const config: AdapterConfig = { type: 'legacy' }
      const data = { name: 'Widget' }

      const result = transformRequest(data, config)

      expect(result).toEqual(data)
    })
  })

  describe('transformResponse', () => {
    it('should transform response data', () => {
      const { transformResponse } = useLegacyAdapter()

      const config: AdapterConfig = {
        type: 'legacy',
        responseTransform: {
          steps: [
            {
              _step: 'transform',
              id: 'rename',
              operation: 'rename',
              config: {
                renames: {
                  PROD_NAME: 'name',
                  PROD_PRICE: 'price',
                },
              },
            },
          ],
        },
      }

      const result = transformResponse({ PROD_NAME: 'Widget', PROD_PRICE: 99.99 }, config)

      expect(result).toEqual({
        name: 'Widget',
        price: 99.99,
      })
    })
  })

  describe('callApi', () => {
    const mockFetch = vi.fn()

    beforeEach(() => {
      mockFetch.mockReset()
    })

    it('should call API with transformed request and response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ RESULT: 'SUCCESS', PROD_ID: 'P001' }),
      })

      const { callApi, isLoading, error } = useLegacyAdapter({
        fetch: mockFetch as unknown as typeof fetch,
        baseUrl: 'https://api.example.com',
      })

      const config: AdapterConfig = {
        type: 'legacy',
        requestTransform: {
          steps: [
            {
              _step: 'transform',
              id: 'rename',
              operation: 'rename',
              config: { renames: { name: 'PROD_NAME' } },
            },
          ],
        },
        responseTransform: {
          steps: [
            {
              _step: 'transform',
              id: 'rename',
              operation: 'rename',
              config: { renames: { PROD_ID: 'productId', RESULT: 'status' } },
            },
          ],
        },
      }

      expect(isLoading.value).toBe(false)

      const result = await callApi('/products', { name: 'Widget' }, config, { method: 'POST' })

      expect(error.value).toBeNull()
      expect(result).toEqual({
        status: 'SUCCESS',
        productId: 'P001',
      })

      // Verify fetch was called with transformed request
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/products',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ PROD_NAME: 'Widget' }),
        })
      )
    })

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      const { callApi, error } = useLegacyAdapter({
        fetch: mockFetch as unknown as typeof fetch,
      })

      const result = await callApi('/test', {}, { type: 'legacy' })

      expect(result).toBeNull()
      expect(error.value).not.toBeNull()
      expect(error.value?.type).toBe('ADAPTER_ERROR')
      expect(error.value?.message).toContain('500')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const { callApi, error } = useLegacyAdapter({
        fetch: mockFetch as unknown as typeof fetch,
      })

      const result = await callApi('/test', {}, { type: 'legacy' })

      expect(result).toBeNull()
      expect(error.value).not.toBeNull()
      expect(error.value?.message).toBe('Network error')
    })

    it('should clear error', async () => {
      mockFetch.mockRejectedValue(new Error('Test error'))

      const { callApi, error, clearError } = useLegacyAdapter({
        fetch: mockFetch as unknown as typeof fetch,
      })

      await callApi('/test', {}, { type: 'legacy' })
      expect(error.value).not.toBeNull()

      clearError()
      expect(error.value).toBeNull()
    })
  })

  describe('loading state', () => {
    it('should track loading state during API call', async () => {
      const loadingStates: boolean[] = []
      let resolvePromise: () => void

      const mockFetch = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = () =>
            resolve({
              ok: true,
              headers: new Map([['content-type', 'application/json']]),
              json: () => Promise.resolve({}),
            })
        })
      )

      const { callApi, isLoading } = useLegacyAdapter({
        fetch: mockFetch as unknown as typeof fetch,
      })

      loadingStates.push(isLoading.value) // false

      const callPromise = callApi('/test', {}, { type: 'legacy' })

      // Loading state is set synchronously after starting the call
      await new Promise((r) => setTimeout(r, 0))
      loadingStates.push(isLoading.value) // true

      resolvePromise!()
      await callPromise

      loadingStates.push(isLoading.value) // false

      expect(loadingStates).toEqual([false, true, false])
    })
  })

  describe('complex scenarios', () => {
    it('should handle ERP legacy response transformation', () => {
      const { transformResponse } = useLegacyAdapter()

      const config: AdapterConfig = {
        type: 'legacy',
        responseTransform: {
          steps: [
            {
              _step: 'transform',
              id: 'map',
              operation: 'map',
              config: {
                mappings: {
                  id: 'ITEM_CD',
                  name: 'ITEM_NM',
                  price: 'UNIT_PRC',
                  stock: 'INV_QTY',
                },
              },
            },
            {
              _step: 'transform',
              id: 'cast',
              operation: 'cast',
              config: {
                casts: {
                  price: 'number',
                  stock: 'number',
                },
              },
            },
          ],
        },
      }

      const legacyData = {
        ITEM_CD: 'PROD001',
        ITEM_NM: 'Premium Widget',
        UNIT_PRC: '149.99',
        INV_QTY: '500',
        LEGACY_FLAG: 'Y',
      }

      const result = transformResponse<{
        id: string
        name: string
        price: number
        stock: number
      }>(legacyData, config)

      expect(result).toEqual({
        id: 'PROD001',
        name: 'Premium Widget',
        price: 149.99,
        stock: 500,
      })
    })
  })
})
