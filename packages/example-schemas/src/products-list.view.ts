/**
 * Products List View Schema
 *
 * ListRenderer E2E 테스트용 상품 목록 스키마
 *
 * 테스트 시나리오:
 * 1. 데이터 포맷팅 검증 (숫자, 뱃지, 날짜)
 * 2. 동적 컬럼 제어 (hidden Expression)
 * 3. 서버 상태 동기화 (Pagination, Sort)
 * 4. Bulk Action 워크플로우
 */

import type { ListViewSchema } from '@manifesto-ai/schema'

// ============================================================================
// Products List View Schema
// ============================================================================

export const productsListView: ListViewSchema = {
  id: 'products-list',
  version: '1.0.0',
  name: 'Products List View',
  _type: 'view',
  entityRef: 'product',
  mode: 'list',

  columns: [
    {
      id: 'name',
      entityFieldId: 'name',
      type: 'text',
      label: '상품명',
      sortable: true,
      filterable: true,
    },
    {
      id: 'price',
      entityFieldId: 'price',
      type: 'number',
      label: '가격',
      sortable: true,
      align: 'right',
      format: {
        numberFormat: {
          style: 'currency',
          currency: 'KRW',
          locale: 'ko-KR',
        },
      },
    },
    {
      id: 'status',
      entityFieldId: 'status',
      type: 'badge',
      label: '상태',
      format: {
        badgeMap: {
          active: { label: '판매중', variant: 'success' },
          soldout: { label: '품절', variant: 'error' },
          pending: { label: '대기중', variant: 'warning' },
          discontinued: { label: '판매중지', variant: 'default' },
        },
      },
    },
    {
      id: 'stock',
      entityFieldId: 'stock',
      type: 'number',
      label: '재고',
      sortable: true,
      align: 'right',
    },
    {
      id: 'costPrice',
      entityFieldId: 'costPrice',
      type: 'number',
      label: '원가',
      align: 'right',
      format: {
        numberFormat: {
          style: 'currency',
          currency: 'KRW',
          locale: 'ko-KR',
        },
      },
      // 관리자만 원가 컬럼 표시 (hidden Expression)
      // user.role이 'admin'이 아니면 숨김
      hidden: ['!=', '$user.role', 'admin'],
    },
    {
      id: 'createdAt',
      entityFieldId: 'createdAt',
      type: 'datetime',
      label: '등록일',
      sortable: true,
      format: {
        dateFormat: 'yyyy-MM-dd',
      },
    },
    {
      id: 'category',
      entityFieldId: 'category',
      type: 'text',
      label: '카테고리',
      filterable: true,
    },
  ],

  dataSource: {
    type: 'static',
    static: [], // 초기 데이터는 mock에서 제공
  },

  pagination: {
    enabled: true,
    pageSize: 5,
    pageSizeOptions: [5, 10, 20, 50],
    showTotal: true,
    showPageSize: true,
  },

  sorting: {
    enabled: true,
    defaultSort: {
      field: 'createdAt',
      direction: 'desc',
    },
  },

  selection: {
    enabled: true,
    mode: 'multiple',
  },

  bulkActions: [
    {
      id: 'delete',
      label: '삭제',
      variant: 'danger',
      minSelection: 1,
      action: { type: 'custom', actionId: 'bulk-delete' },
      confirm: {
        title: '삭제 확인',
        message: '선택한 상품을 삭제하시겠습니까?',
        confirmLabel: '삭제',
        cancelLabel: '취소',
      },
    },
    {
      id: 'export',
      label: '내보내기',
      variant: 'secondary',
      minSelection: 1,
      action: { type: 'custom', actionId: 'bulk-export' },
    },
    {
      id: 'changeStatus',
      label: '상태 변경',
      variant: 'primary',
      minSelection: 1,
      action: { type: 'custom', actionId: 'bulk-change-status' },
    },
  ],

  emptyState: {
    title: '상품이 없습니다',
    description: '새 상품을 등록해 주세요.',
    icon: 'package',
  },
}

// ============================================================================
// Mock Products Data
// ============================================================================

export interface MockProduct {
  id: string
  name: string
  price: number
  costPrice: number
  status: 'active' | 'soldout' | 'pending' | 'discontinued'
  stock: number
  category: string
  createdAt: string
}

export const mockProductsData: MockProduct[] = [
  {
    id: 'prd-001',
    name: '무선 블루투스 이어폰',
    price: 89000,
    costPrice: 45000,
    status: 'active',
    stock: 150,
    category: '전자기기',
    createdAt: '2024-11-15T10:30:00Z',
  },
  {
    id: 'prd-002',
    name: '프리미엄 원두 커피',
    price: 25000,
    costPrice: 12000,
    status: 'active',
    stock: 80,
    category: '식품',
    createdAt: '2024-11-14T14:20:00Z',
  },
  {
    id: 'prd-003',
    name: '에르고노믹 키보드',
    price: 159000,
    costPrice: 85000,
    status: 'soldout',
    stock: 0,
    category: '전자기기',
    createdAt: '2024-11-13T09:15:00Z',
  },
  {
    id: 'prd-004',
    name: '스마트 워치 프로',
    price: 349000,
    costPrice: 180000,
    status: 'active',
    stock: 45,
    category: '전자기기',
    createdAt: '2024-11-12T16:45:00Z',
  },
  {
    id: 'prd-005',
    name: '유기농 녹차',
    price: 18000,
    costPrice: 8000,
    status: 'pending',
    stock: 200,
    category: '식품',
    createdAt: '2024-11-11T11:00:00Z',
  },
  {
    id: 'prd-006',
    name: '노이즈 캔슬링 헤드폰',
    price: 299000,
    costPrice: 150000,
    status: 'active',
    stock: 30,
    category: '전자기기',
    createdAt: '2024-11-10T08:30:00Z',
  },
  {
    id: 'prd-007',
    name: '수제 초콜릿 세트',
    price: 45000,
    costPrice: 22000,
    status: 'active',
    stock: 60,
    category: '식품',
    createdAt: '2024-11-09T13:20:00Z',
  },
  {
    id: 'prd-008',
    name: '무선 충전 패드',
    price: 39000,
    costPrice: 18000,
    status: 'discontinued',
    stock: 5,
    category: '전자기기',
    createdAt: '2024-11-08T15:10:00Z',
  },
  {
    id: 'prd-009',
    name: '아로마 디퓨저',
    price: 65000,
    costPrice: 32000,
    status: 'active',
    stock: 75,
    category: '생활용품',
    createdAt: '2024-11-07T10:00:00Z',
  },
  {
    id: 'prd-010',
    name: '기계식 키보드',
    price: 129000,
    costPrice: 65000,
    status: 'active',
    stock: 40,
    category: '전자기기',
    createdAt: '2024-11-06T17:30:00Z',
  },
  {
    id: 'prd-011',
    name: '고급 올리브 오일',
    price: 35000,
    costPrice: 17000,
    status: 'active',
    stock: 90,
    category: '식품',
    createdAt: '2024-11-05T09:45:00Z',
  },
  {
    id: 'prd-012',
    name: 'USB-C 허브',
    price: 55000,
    costPrice: 28000,
    status: 'soldout',
    stock: 0,
    category: '전자기기',
    createdAt: '2024-11-04T14:00:00Z',
  },
]

// ============================================================================
// API Response Mock Helper
// ============================================================================

export interface ProductsApiParams {
  page?: number
  pageSize?: number
  sortField?: string
  sortDirection?: 'asc' | 'desc'
  search?: string
  category?: string
  status?: string
}

export interface ProductsApiResponse {
  data: MockProduct[]
  total: number
  page: number
  pageSize: number
}

/**
 * Mock API 응답 생성 (클라이언트 사이드 페이지네이션/정렬/필터 시뮬레이션)
 */
export const createProductsApiResponse = (
  params: ProductsApiParams
): ProductsApiResponse => {
  const {
    page = 1,
    pageSize = 10,
    sortField = 'createdAt',
    sortDirection = 'desc',
    search,
    category,
    status,
  } = params

  let filtered = [...mockProductsData]

  // 검색 필터
  if (search) {
    const term = search.toLowerCase()
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
    )
  }

  // 카테고리 필터
  if (category) {
    filtered = filtered.filter((p) => p.category === category)
  }

  // 상태 필터
  if (status) {
    filtered = filtered.filter((p) => p.status === status)
  }

  // 정렬
  if (sortField) {
    filtered.sort((a, b) => {
      const aVal = a[sortField as keyof MockProduct]
      const bVal = b[sortField as keyof MockProduct]

      let comparison = 0
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal)
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      return sortDirection === 'desc' ? -comparison : comparison
    })
  }

  const total = filtered.length

  // 페이지네이션
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const data = filtered.slice(start, end)

  return {
    data,
    total,
    page,
    pageSize,
  }
}
