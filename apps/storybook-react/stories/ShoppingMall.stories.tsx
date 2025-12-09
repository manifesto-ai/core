/**
 * Shopping Mall Admin Stories
 *
 * 쇼핑몰 관리자 페이지 - ViewSnapshot 아키텍처 데모
 *
 * 시나리오:
 * 1. 주문 관리 - 필터 + 테이블 + Bulk Actions
 * 2. 상품 관리 - 탭 + 테이블 + 모달
 * 3. 고객 관리 - 검색 + 상세보기
 */

import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import {
  ManifestoPage,
  ManifestoForm,
  ManifestoTable,
  ManifestoTabs,
  useOverlay,
  useToast,
} from '@manifesto-ai/react'
import type { FormViewSchema, ListViewSchema, EntitySchema } from '@manifesto-ai/schema'
import type { QueryParams, QueryResult } from '@manifesto-ai/react'

// ============================================================================
// Mock Data
// ============================================================================

const mockOrders = [
  { id: 'ORD-001', customerName: '김민수', productName: 'MacBook Pro 14"', amount: 2890000, status: 'pending', paymentMethod: 'card', createdAt: '2024-01-15T10:30:00' },
  { id: 'ORD-002', customerName: '이서연', productName: 'iPhone 15 Pro', amount: 1550000, status: 'completed', paymentMethod: 'card', createdAt: '2024-01-15T11:20:00' },
  { id: 'ORD-003', customerName: '박지훈', productName: 'AirPods Pro 2', amount: 359000, status: 'shipping', paymentMethod: 'bank', createdAt: '2024-01-15T14:00:00' },
  { id: 'ORD-004', customerName: '최유진', productName: 'iPad Air', amount: 929000, status: 'pending', paymentMethod: 'card', createdAt: '2024-01-16T09:15:00' },
  { id: 'ORD-005', customerName: '정현우', productName: 'Apple Watch Ultra', amount: 1149000, status: 'cancelled', paymentMethod: 'bank', createdAt: '2024-01-16T10:45:00' },
  { id: 'ORD-006', customerName: '강소희', productName: 'Magic Keyboard', amount: 189000, status: 'completed', paymentMethod: 'card', createdAt: '2024-01-16T13:30:00' },
  { id: 'ORD-007', customerName: '윤태호', productName: 'Studio Display', amount: 2199000, status: 'shipping', paymentMethod: 'card', createdAt: '2024-01-17T08:00:00' },
  { id: 'ORD-008', customerName: '임수빈', productName: 'Mac Mini M2', amount: 850000, status: 'pending', paymentMethod: 'bank', createdAt: '2024-01-17T11:00:00' },
]

const mockProducts = [
  { id: 'PRD-001', name: 'MacBook Pro 14"', category: 'laptop', price: 2890000, stock: 45, status: 'active' },
  { id: 'PRD-002', name: 'MacBook Air 13"', category: 'laptop', price: 1590000, stock: 120, status: 'active' },
  { id: 'PRD-003', name: 'iPhone 15 Pro', category: 'phone', price: 1550000, stock: 200, status: 'active' },
  { id: 'PRD-004', name: 'iPhone 15', category: 'phone', price: 1250000, stock: 180, status: 'active' },
  { id: 'PRD-005', name: 'iPad Pro 12.9"', category: 'tablet', price: 1729000, stock: 60, status: 'active' },
  { id: 'PRD-006', name: 'iPad Air', category: 'tablet', price: 929000, stock: 0, status: 'soldout' },
  { id: 'PRD-007', name: 'AirPods Pro 2', category: 'accessory', price: 359000, stock: 500, status: 'active' },
  { id: 'PRD-008', name: 'Apple Watch Ultra', category: 'watch', price: 1149000, stock: 30, status: 'active' },
]

const mockCustomers = [
  { id: 'CUS-001', name: '김민수', email: 'minsu.kim@email.com', phone: '010-1234-5678', totalOrders: 5, totalSpent: 4500000, grade: 'VIP', joinedAt: '2023-05-10' },
  { id: 'CUS-002', name: '이서연', email: 'seoyeon.lee@email.com', phone: '010-2345-6789', totalOrders: 12, totalSpent: 8900000, grade: 'VVIP', joinedAt: '2022-11-20' },
  { id: 'CUS-003', name: '박지훈', email: 'jihoon.park@email.com', phone: '010-3456-7890', totalOrders: 2, totalSpent: 720000, grade: 'NORMAL', joinedAt: '2024-01-05' },
  { id: 'CUS-004', name: '최유진', email: 'yujin.choi@email.com', phone: '010-4567-8901', totalOrders: 8, totalSpent: 3200000, grade: 'VIP', joinedAt: '2023-08-15' },
  { id: 'CUS-005', name: '정현우', email: 'hyunwoo.jung@email.com', phone: '010-5678-9012', totalOrders: 1, totalSpent: 1149000, grade: 'NORMAL', joinedAt: '2024-01-10' },
]

// ============================================================================
// Entity Schemas - 폼 필드 옵션 정의
// ============================================================================

const orderFilterEntitySchema: EntitySchema = {
  _type: 'entity',
  id: 'order-filter-entity',
  name: '주문 필터 엔티티',
  fields: [
    { id: 'search', dataType: 'string' },
    {
      id: 'status',
      dataType: 'enum',
      enumValues: [
        { value: '', label: '전체' },
        { value: 'pending', label: '대기중' },
        { value: 'completed', label: '완료' },
        { value: 'shipping', label: '배송중' },
        { value: 'cancelled', label: '취소' },
      ],
    },
    {
      id: 'paymentMethod',
      dataType: 'enum',
      enumValues: [
        { value: '', label: '전체' },
        { value: 'card', label: '카드' },
        { value: 'bank', label: '계좌이체' },
      ],
    },
    { id: 'dateRange', dataType: 'string' },
  ],
}

const customerFilterEntitySchema: EntitySchema = {
  _type: 'entity',
  id: 'customer-filter-entity',
  name: '고객 필터 엔티티',
  fields: [
    { id: 'search', dataType: 'string' },
    {
      id: 'grade',
      dataType: 'enum',
      enumValues: [
        { value: '', label: '전체' },
        { value: 'NORMAL', label: '일반' },
        { value: 'VIP', label: 'VIP' },
        { value: 'VVIP', label: 'VVIP' },
      ],
    },
  ],
}

// ============================================================================
// Schemas - 주문 관리
// ============================================================================

const orderFilterSchema: FormViewSchema = {
  _type: 'view',
  id: 'order-filter',
  version: '1.0.0',
  name: '주문 필터',
  entityRef: 'orders',
  mode: 'create',
  layout: { type: 'form', columns: 4 },
  sections: [
    {
      id: 'filter-section',
      layout: { type: 'form', columns: 4 },
      fields: [
        { id: 'search', entityFieldId: 'search', component: 'text-input', label: '검색', placeholder: '주문번호, 고객명, 상품명' },
        { id: 'status', entityFieldId: 'status', component: 'select', label: '주문상태' },
        { id: 'paymentMethod', entityFieldId: 'paymentMethod', component: 'select', label: '결제수단' },
        { id: 'dateRange', entityFieldId: 'dateRange', component: 'text-input', label: '주문일', placeholder: 'YYYY-MM-DD ~ YYYY-MM-DD' },
      ],
    },
  ],
}

const orderTableSchema: ListViewSchema = {
  _type: 'view',
  id: 'order-table',
  version: '1.0.0',
  name: '주문 목록',
  entityRef: 'orders',
  mode: 'list',
  dataSource: {
    type: 'api',
    api: { endpoint: '/api/orders' },
  },
  columns: [
    { id: 'id', entityFieldId: 'id', type: 'text', label: '주문번호', sortable: true },
    { id: 'customerName', entityFieldId: 'customerName', type: 'text', label: '고객명', sortable: true },
    { id: 'productName', entityFieldId: 'productName', type: 'text', label: '상품명' },
    { id: 'amount', entityFieldId: 'amount', type: 'number', label: '금액', sortable: true, format: { numberFormat: { style: 'currency', currency: 'KRW' } } },
    {
      id: 'status',
      entityFieldId: 'status',
      type: 'enum',
      label: '상태',
      format: {
        badgeMap: {
          pending: { label: '결제대기', variant: 'warning' },
          completed: { label: '결제완료', variant: 'success' },
          shipping: { label: '배송중', variant: 'info' },
          cancelled: { label: '취소됨', variant: 'error' },
        },
      },
    },
    { id: 'paymentMethod', entityFieldId: 'paymentMethod', type: 'enum', label: '결제수단', format: { enumMap: { card: '카드', bank: '계좌이체' } } },
    { id: 'createdAt', entityFieldId: 'createdAt', type: 'datetime', label: '주문일시', sortable: true, format: { dateFormat: 'yyyy-MM-dd HH:mm' } },
  ],
  selection: { enabled: true, mode: 'multiple' },
  pagination: { enabled: true, pageSize: 5, pageSizeOptions: [5, 10, 20] },
  bulkActions: [
    { id: 'export', label: '엑셀 다운로드', icon: 'download', action: { type: 'custom', actionId: 'export' } },
    { id: 'bulkCancel', label: '일괄 취소', icon: 'x', variant: 'danger', action: { type: 'custom', actionId: 'bulkCancel' } },
  ],
}

// ============================================================================
// Schemas - 상품 관리
// ============================================================================

const productTableSchema: ListViewSchema = {
  _type: 'view',
  id: 'product-table',
  version: '1.0.0',
  name: '상품 목록',
  entityRef: 'products',
  mode: 'list',
  dataSource: {
    type: 'api',
    api: { endpoint: '/api/products' },
  },
  columns: [
    { id: 'id', entityFieldId: 'id', type: 'text', label: '상품코드', sortable: true },
    { id: 'name', entityFieldId: 'name', type: 'text', label: '상품명', sortable: true },
    { id: 'category', entityFieldId: 'category', type: 'enum', label: '카테고리', format: { enumMap: { laptop: '노트북', phone: '스마트폰', tablet: '태블릿', accessory: '액세서리', watch: '워치' } } },
    { id: 'price', entityFieldId: 'price', type: 'number', label: '가격', sortable: true, format: { numberFormat: { style: 'currency', currency: 'KRW' } } },
    { id: 'stock', entityFieldId: 'stock', type: 'number', label: '재고', sortable: true },
    { id: 'status', entityFieldId: 'status', type: 'enum', label: '상태', format: { badgeMap: { active: { label: '판매중', variant: 'success' }, soldout: { label: '품절', variant: 'error' } } } },
  ],
  selection: { enabled: true, mode: 'multiple' },
  pagination: { enabled: true, pageSize: 5 },
  bulkActions: [
    { id: 'bulkEdit', label: '일괄 수정', icon: 'edit', action: { type: 'custom', actionId: 'bulkEdit' } },
    { id: 'bulkDelete', label: '일괄 삭제', icon: 'trash', variant: 'danger', action: { type: 'custom', actionId: 'bulkDelete' } },
  ],
}

// ============================================================================
// Schemas - 고객 관리
// ============================================================================

const customerFilterSchema: FormViewSchema = {
  _type: 'view',
  id: 'customer-filter',
  version: '1.0.0',
  name: '고객 필터',
  entityRef: 'customers',
  mode: 'create',
  layout: { type: 'form', columns: 3 },
  sections: [
    {
      id: 'filter-section',
      layout: { type: 'form', columns: 3 },
      fields: [
        { id: 'search', entityFieldId: 'search', component: 'text-input', label: '검색', placeholder: '고객명, 이메일, 전화번호' },
        { id: 'grade', entityFieldId: 'grade', component: 'select', label: '등급' },
      ],
    },
  ],
}

const customerTableSchema: ListViewSchema = {
  _type: 'view',
  id: 'customer-table',
  version: '1.0.0',
  name: '고객 목록',
  entityRef: 'customers',
  mode: 'list',
  dataSource: {
    type: 'api',
    api: { endpoint: '/api/customers' },
  },
  columns: [
    { id: 'id', entityFieldId: 'id', type: 'text', label: '고객번호' },
    { id: 'name', entityFieldId: 'name', type: 'text', label: '이름', sortable: true },
    { id: 'email', entityFieldId: 'email', type: 'text', label: '이메일' },
    { id: 'phone', entityFieldId: 'phone', type: 'text', label: '전화번호' },
    { id: 'totalOrders', entityFieldId: 'totalOrders', type: 'number', label: '주문수', sortable: true },
    { id: 'totalSpent', entityFieldId: 'totalSpent', type: 'number', label: '총 구매액', sortable: true, format: { numberFormat: { style: 'currency', currency: 'KRW' } } },
    { id: 'grade', entityFieldId: 'grade', type: 'enum', label: '등급', format: { badgeMap: { VVIP: { label: 'VVIP', variant: 'info' }, VIP: { label: 'VIP', variant: 'success' }, NORMAL: { label: '일반', variant: 'default' } } } },
    { id: 'joinedAt', entityFieldId: 'joinedAt', type: 'date', label: '가입일', format: { dateFormat: 'yyyy-MM-dd' } },
  ],
  selection: { enabled: false, mode: 'single' },
  pagination: { enabled: true, pageSize: 5 },
}

// ============================================================================
// Story Components
// ============================================================================

/**
 * 주문 관리 - 내부 컨텐츠 (Provider 내부에서 hook 사용)
 */
const OrderManagementContent: React.FC = () => {
  const overlay = useOverlay()
  const toast = useToast()

  const queryOrders = async (params: QueryParams): Promise<QueryResult> => {
    await new Promise((r) => setTimeout(r, 300))

    let filtered = [...mockOrders]

    if (params.filters?.status) {
      filtered = filtered.filter((o) => o.status === params.filters?.status)
    }
    if (params.filters?.paymentMethod) {
      filtered = filtered.filter((o) => o.paymentMethod === params.filters?.paymentMethod)
    }
    if (params.search) {
      const s = params.search.toLowerCase()
      filtered = filtered.filter(
        (o) => o.id.toLowerCase().includes(s) || o.customerName.includes(s) || o.productName.toLowerCase().includes(s)
      )
    }
    if (params.sortField) {
      filtered.sort((a, b) => {
        const aVal = a[params.sortField as keyof typeof a]
        const bVal = b[params.sortField as keyof typeof b]
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        return params.sortDirection === 'desc' ? -cmp : cmp
      })
    }

    return { rows: filtered, total: filtered.length }
  }

  const handleAction = async (action: string, ctx: { selectedRows: Record<string, unknown>[] }) => {
    if (action === 'view') {
      const order = ctx.selectedRows[0]
      toast.info(`주문 상세: ${order.id}`)
    } else if (action === 'cancel' || action === 'bulkCancel') {
      const confirmed = await overlay.confirm({
        title: '주문 취소',
        message: `${ctx.selectedRows.length}건의 주문을 취소하시겠습니까?`,
        confirmLabel: '취소 처리',
        cancelLabel: '닫기',
      })
      if (confirmed) {
        toast.success(`${ctx.selectedRows.length}건의 주문이 취소되었습니다.`)
      }
    } else if (action === 'export') {
      toast.info(`${ctx.selectedRows.length}건 엑셀 다운로드 중...`)
    }
  }

  const handleFilterSubmit = (values: Record<string, unknown>) => {
    console.log('[OrderManagement] Filter submitted:', values)
    toast.success('필터가 적용되었습니다.')
  }

  return (
    <>
      <ManifestoForm
        nodeId="order-filter"
        schema={orderFilterSchema}
        entitySchema={orderFilterEntitySchema}
        onSubmit={handleFilterSubmit}
      />
      <ManifestoTable
        nodeId="order-table"
        schema={orderTableSchema}
        filterSource="order-filter"
        queryFn={queryOrders}
        onRowClick={(row) => toast.info(`선택: ${row.id}`)}
        onAction={handleAction}
      />
    </>
  )
}

/**
 * 주문 관리 페이지
 */
const OrderManagement: React.FC = () => {
  return (
    <ManifestoPage pageId="order-management" title="주문 관리">
      <OrderManagementContent />
    </ManifestoPage>
  )
}

/**
 * 상품 관리 - 내부 컨텐츠
 */
const ProductManagementContent: React.FC<{ activeCategory: string; onTabChange: (tabId: string) => void }> = ({
  activeCategory,
  onTabChange,
}) => {
  const overlay = useOverlay()
  const toast = useToast()

  const queryProducts = async (params: QueryParams): Promise<QueryResult> => {
    await new Promise((r) => setTimeout(r, 300))

    let filtered = [...mockProducts]

    // 탭에 따른 카테고리 필터
    if (activeCategory !== 'all') {
      filtered = filtered.filter((p) => p.category === activeCategory)
    }

    if (params.search) {
      const s = params.search.toLowerCase()
      filtered = filtered.filter((p) => p.id.toLowerCase().includes(s) || p.name.toLowerCase().includes(s))
    }

    return { rows: filtered, total: filtered.length }
  }

  const handleAction = async (action: string, ctx: { selectedRows: Record<string, unknown>[] }) => {
    if (action === 'edit') {
      toast.info(`상품 수정: ${ctx.selectedRows[0].name}`)
    } else if (action === 'delete' || action === 'bulkDelete') {
      const confirmed = await overlay.confirm({
        title: '상품 삭제',
        message: `${ctx.selectedRows.length}개 상품을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
        confirmLabel: '삭제',
        cancelLabel: '취소',
      })
      if (confirmed) {
        toast.success(`${ctx.selectedRows.length}개 상품이 삭제되었습니다.`)
      }
    }
  }

  return (
    <>
      <ManifestoTabs
        nodeId="product-tabs"
        tabs={[
          { id: 'all', label: '전체' },
          { id: 'laptop', label: '노트북' },
          { id: 'phone', label: '스마트폰' },
          { id: 'tablet', label: '태블릿' },
          { id: 'accessory', label: '액세서리' },
          { id: 'watch', label: '워치' },
        ]}
        defaultActiveTab="all"
        onTabChange={onTabChange}
      />
      <ManifestoTable
        nodeId="product-table"
        schema={productTableSchema}
        queryFn={queryProducts}
        onAction={handleAction}
      />
    </>
  )
}

/**
 * 상품 관리 페이지 (탭 포함)
 */
const ProductManagement: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all')

  return (
    <ManifestoPage pageId="product-management" title="상품 관리">
      <ProductManagementContent activeCategory={activeCategory} onTabChange={setActiveCategory} />
    </ManifestoPage>
  )
}

/**
 * 고객 관리 - 내부 컨텐츠
 */
const CustomerManagementContent: React.FC = () => {
  const toast = useToast()

  const queryCustomers = async (params: QueryParams): Promise<QueryResult> => {
    await new Promise((r) => setTimeout(r, 300))

    let filtered = [...mockCustomers]

    if (params.filters?.grade) {
      filtered = filtered.filter((c) => c.grade === params.filters?.grade)
    }
    if (params.search) {
      const s = params.search.toLowerCase()
      filtered = filtered.filter(
        (c) => c.name.includes(s) || c.email.toLowerCase().includes(s) || c.phone.includes(s)
      )
    }

    return { rows: filtered, total: filtered.length }
  }

  const handleAction = (action: string, ctx: { selectedRows: Record<string, unknown>[] }) => {
    const customer = ctx.selectedRows[0]
    if (action === 'view') {
      toast.info(`고객 상세: ${customer.name} (${customer.email})`)
    } else if (action === 'sendMessage') {
      toast.success(`${customer.name}님에게 메시지 발송`)
    }
  }

  const handleFilterSubmit = (values: Record<string, unknown>) => {
    console.log('[CustomerManagement] Filter submitted:', values)
    toast.success('필터가 적용되었습니다.')
  }

  return (
    <>
      <ManifestoForm
        nodeId="customer-filter"
        schema={customerFilterSchema}
        entitySchema={customerFilterEntitySchema}
        onSubmit={handleFilterSubmit}
      />
      <ManifestoTable
        nodeId="customer-table"
        schema={customerTableSchema}
        filterSource="customer-filter"
        queryFn={queryCustomers}
        onAction={handleAction}
      />
    </>
  )
}

/**
 * 고객 관리 페이지
 */
const CustomerManagement: React.FC = () => {
  return (
    <ManifestoPage pageId="customer-management" title="고객 관리">
      <CustomerManagementContent />
    </ManifestoPage>
  )
}

// ============================================================================
// Meta & Stories
// ============================================================================

const meta: Meta = {
  title: 'ShoppingMall',
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj

/**
 * 주문 관리 페이지
 *
 * - 필터 폼 (검색, 상태, 결제수단, 기간)
 * - 주문 테이블 (정렬, 페이지네이션, 선택)
 * - 행 액션 (상세보기, 취소)
 * - 일괄 액션 (엑셀 다운로드, 일괄 취소)
 */
export const Orders: Story = {
  name: '주문 관리',
  render: () => <OrderManagement />,
}

/**
 * 상품 관리 페이지
 *
 * - 카테고리 탭 네비게이션
 * - 상품 테이블 (카테고리별 필터링)
 * - 행 액션 (수정, 삭제)
 * - 일괄 액션 (일괄 수정, 일괄 삭제)
 */
export const Products: Story = {
  name: '상품 관리',
  render: () => <ProductManagement />,
}

/**
 * 고객 관리 페이지
 *
 * - 검색 필터 (이름, 이메일, 등급)
 * - 고객 테이블 (등급별 뱃지)
 * - 행 액션 (상세보기, 메시지 발송)
 */
export const Customers: Story = {
  name: '고객 관리',
  render: () => <CustomerManagement />,
}
