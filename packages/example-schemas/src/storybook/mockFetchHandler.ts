/**
 * Shared Mock Fetch Handler for Stories
 *
 * 스토리에서 사용하는 공통 API mock 핸들러
 */

import type { FetchHandler } from '@manifesto-ai/engine'
import { subCategoriesByCategory } from '../product-create.view'
import { variantsByProduct } from '../schedule.view'
import { createProductsApiResponse, type ProductsApiParams } from '../products-list.view'

/**
 * Mock Fetch Handler 옵션
 */
export interface MockFetchHandlerOptions {
  /** 모든 요청에 에러 응답 반환 */
  simulateErrors?: boolean
  /** 특정 엔드포인트만 에러 반환 (문자열 포함 여부로 매칭) */
  failEndpoints?: string[]
  /** 응답 지연 시간 (ms) */
  latency?: number
  /** 에러 상태 코드 */
  errorStatusCode?: number
  /** 에러 메시지 */
  errorMessage?: string
  /** 네트워크 에러 시뮬레이션 */
  simulateNetworkError?: boolean
}

/**
 * 에러 응답 생성
 */
const createErrorResponse = (
  options: MockFetchHandlerOptions,
  endpoint: string
): { error: string; statusCode: number } => {
  return {
    error: options.errorMessage ?? `서버 에러가 발생했습니다: ${endpoint}`,
    statusCode: options.errorStatusCode ?? 500,
  }
}

/**
 * 엔드포인트가 실패 대상인지 확인
 */
const shouldFail = (endpoint: string, options: MockFetchHandlerOptions): boolean => {
  if (options.simulateErrors) return true
  if (options.failEndpoints?.some((pattern) => endpoint.includes(pattern))) {
    return true
  }
  return false
}

export const createMockFetchHandler = (options: MockFetchHandlerOptions = {}): FetchHandler => {
  return async (endpoint, _options) => {
    // 네트워크 에러 시뮬레이션
    if (options.simulateNetworkError) {
      throw new Error('Network Error: Failed to fetch')
    }

    // 커스텀 latency 적용
    const baseLatency = options.latency ?? 0

    // 에러 시뮬레이션 체크
    if (shouldFail(endpoint, options)) {
      if (baseLatency > 0) {
        await new Promise((resolve) => setTimeout(resolve, baseLatency))
      }
      return createErrorResponse(options, endpoint)
    }
    // SKU 중복 체크
    if (endpoint.startsWith('/api/sku-check')) {
      const url = new URL(endpoint, 'http://localhost')
      const sku = url.searchParams.get('sku') ?? ''
      await new Promise((resolve) => setTimeout(resolve, baseLatency || 250))
      const takenSkus = ['SKU-001', 'SKU-123', 'DUP-001']
      const exists = takenSkus.includes(sku.toUpperCase())
      return { message: exists ? '이미 사용 중인 SKU입니다' : '사용 가능한 SKU입니다' }
    }

    // 서브카테고리 조회
    if (endpoint.startsWith('/api/subcategories')) {
      const url = new URL(endpoint, 'http://localhost')
      const categoryId = url.searchParams.get('categoryId') ?? ''
      await new Promise((resolve) => setTimeout(resolve, baseLatency || 200))
      const subcategories = subCategoriesByCategory[categoryId] ?? []
      return {
        data: subcategories.map((item) => ({ id: item.value, name: item.label })),
      }
    }

    // 상품 목록 조회 (List View 용)
    if (endpoint.startsWith('/api/products-list')) {
      const url = new URL(endpoint, 'http://localhost')
      await new Promise((resolve) => setTimeout(resolve, baseLatency || 150))

      const params: ProductsApiParams = {
        page: parseInt(url.searchParams.get('page') ?? '1', 10),
        pageSize: parseInt(url.searchParams.get('pageSize') ?? '10', 10),
        sortField: url.searchParams.get('sortField') ?? undefined,
        sortDirection: (url.searchParams.get('sortDirection') as 'asc' | 'desc') ?? undefined,
        search: url.searchParams.get('search') ?? undefined,
        category: url.searchParams.get('category') ?? undefined,
        status: url.searchParams.get('status') ?? undefined,
      }

      return createProductsApiResponse(params)
    }

    // 상품 목록 조회 (기존 - Form용)
    if (endpoint.startsWith('/api/products')) {
      await new Promise((resolve) => setTimeout(resolve, baseLatency || 200))
      return {
        data: [
          { id: 'prd-1', name: '무선 이어폰' },
          { id: 'prd-2', name: '프리미엄 커피원두' },
          { id: 'prd-3', name: '모던 소파 세트' },
        ],
      }
    }

    // 상품 옵션(variants) 조회
    if (endpoint.startsWith('/api/variants')) {
      const url = new URL(endpoint, 'http://localhost')
      const productId = url.searchParams.get('productId')
      await new Promise((resolve) => setTimeout(resolve, baseLatency || 250))
      if (productId && variantsByProduct[productId]) {
        return {
          data: variantsByProduct[productId].map((option) => ({
            id: option.value,
            name: option.label,
          })),
        }
      }
      return { data: [] }
    }

    return { data: [] }
  }
}

/**
 * 에러 테스트 전용 핸들러 생성
 * 모든 요청에 에러 응답 반환
 */
export const createErrorFetchHandler = (
  statusCode = 500,
  message = '서버 에러가 발생했습니다'
): FetchHandler => {
  return createMockFetchHandler({
    simulateErrors: true,
    errorStatusCode: statusCode,
    errorMessage: message,
  })
}

/**
 * 네트워크 에러 테스트 전용 핸들러
 */
export const createNetworkErrorFetchHandler = (): FetchHandler => {
  return createMockFetchHandler({
    simulateNetworkError: true,
  })
}

/**
 * 특정 엔드포인트만 실패하는 핸들러 생성
 */
export const createPartialErrorFetchHandler = (
  failPatterns: string[],
  statusCode = 500
): FetchHandler => {
  return createMockFetchHandler({
    failEndpoints: failPatterns,
    errorStatusCode: statusCode,
  })
}
