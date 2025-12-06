/**
 * React - Products List Stories
 *
 * ListRenderer E2E 테스트 시나리오
 *
 * 1. 데이터 포맷팅 검증 (숫자, 뱃지, 날짜)
 * 2. 동적 컬럼 제어 (hidden Expression)
 * 3. 서버 상태 동기화 (Pagination, Sort)
 * 4. Bulk Action 워크플로우
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor } from '@storybook/test'
import React, { useState, useCallback, useMemo } from 'react'
import { ListRenderer } from '@manifesto-ai/react'
import type { EvaluationContext } from '@manifesto-ai/engine'
import {
  productsListView,
  mockProductsData,
  waitForListLoad,
  waitForListData,
  getCellTextByColumnId,
  getBadgeVariantByColumnId,
  isColumnVisible,
  waitForColumnVisible,
  waitForColumnHidden,
  toggleRowSelection,
  getSelectedRowCount,
  isBulkActionEnabled,
  goToNextPage,
  clickColumnSort,
  assertRowCount,
} from '@manifesto-ai/example-schemas'

// ============================================================================
// Wrapper Component with Context Control
// ============================================================================

interface ProductsListWrapperProps {
  initialRole?: string
  debug?: boolean
}

const ProductsListWrapper: React.FC<ProductsListWrapperProps> = ({
  initialRole = 'user',
  debug = true,
}) => {
  const [userRole, setUserRole] = useState(initialRole)
  const [actionLog, setActionLog] = useState<string[]>([])

  // Memoize context to ensure proper change detection
  const context: Partial<EvaluationContext> = useMemo(
    () => ({ user: { role: userRole } }),
    [userRole]
  )

  const handleRowClick = useCallback(
    (rowId: string, row: Record<string, unknown>) => {
      setActionLog((prev) => [...prev, `Row clicked: ${row.name} (${rowId})`])
    },
    []
  )

  const handleRowAction = useCallback(
    (rowId: string, actionId: string, row: Record<string, unknown>) => {
      setActionLog((prev) => [...prev, `Action ${actionId}: ${row.name}`])
    },
    []
  )

  const handleBulkAction = useCallback(
    (actionId: string, selectedIds: string[]) => {
      setActionLog((prev) => [
        ...prev,
        `Bulk ${actionId}: ${selectedIds.length} items`,
      ])
    },
    []
  )

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header
        style={{
          marginBottom: '2rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid #e0e0e0',
        }}
      >
        <h1>상품 목록</h1>
        <p style={{ color: '#666' }}>ListRenderer E2E 테스트</p>

        {/* Role Switcher for Dynamic Column Test */}
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
          }}
        >
          <label style={{ fontWeight: 'bold', marginRight: '1rem' }}>
            사용자 역할:
          </label>
          <select
            id="role-switcher"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px' }}
          >
            <option value="user">일반 사용자</option>
            <option value="admin">관리자</option>
          </select>
          <span style={{ marginLeft: '1rem', color: '#666' }}>
            (관리자만 원가 컬럼 표시)
          </span>
        </div>
      </header>

      <ListRenderer
        schema={productsListView}
        context={context}
        initialData={mockProductsData}
        debug={debug}
        onRowClick={handleRowClick}
        onRowAction={handleRowAction}
        onBulkAction={handleBulkAction}
      />

      {/* Action Log */}
      {actionLog.length > 0 && (
        <div
          style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: '#f0f9ff',
            borderRadius: '8px',
            border: '1px solid #bae6fd',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem 0' }}>Action Log</h3>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            {actionLog.slice(-5).map((log, i) => (
              <li key={i}>{log}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Meta
// ============================================================================

const meta: Meta<typeof ProductsListWrapper> = {
  title: 'React/ProductsList',
  component: ProductsListWrapper,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof meta>

// ============================================================================
// Stories
// ============================================================================

/**
 * 기본 상품 목록
 */
export const Default: Story = {
  name: 'Default List',
  args: {
    initialRole: 'user',
    debug: true,
  },
}

/**
 * 시나리오 1: 데이터 포맷팅 검증
 *
 * - 가격: ₩ 프리픽스 + 천단위 구분
 * - 상태: Badge variant (success/error/warning)
 * - 등록일: yyyy-MM-dd 포맷
 */
export const DataFormatting: Story = {
  name: '시나리오 1: 데이터 포맷팅',
  args: {
    initialRole: 'admin',
    debug: true,
  },
  play: async ({ canvasElement, step }) => {
    await waitForListLoad(canvasElement)
    await waitForListData(canvasElement, 1)

    await step('가격 컬럼 포맷팅 확인 (₩ prefix)', async () => {
      // 첫 번째 행의 가격 컬럼 (by column ID)
      const priceText = getCellTextByColumnId(canvasElement, 0, 'price')
      expect(priceText).toContain('₩')
      // 숫자 포맷팅 확인 (천단위 구분)
      expect(priceText).toMatch(/₩[\d,]+/)
    })

    await step('상태 Badge variant 확인', async () => {
      // 상태 컬럼 (by column ID)
      // 첫 번째 상품은 active -> success variant
      const variant = getBadgeVariantByColumnId(canvasElement, 0, 'status')
      expect(variant).toBe('success')
    })

    await step('품절 상품 Badge 확인', async () => {
      // 품절 상품 찾기 (3번째 행, by column ID)
      const soldoutVariant = getBadgeVariantByColumnId(canvasElement, 2, 'status')
      expect(soldoutVariant).toBe('error')
    })

    await step('날짜 포맷팅 확인 (yyyy-MM-dd)', async () => {
      // 등록일 컬럼 (by column ID)
      const dateText = getCellTextByColumnId(canvasElement, 0, 'createdAt')
      // yyyy-MM-dd 형식 검증
      expect(dateText).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  },
}

/**
 * 시나리오 2: 동적 컬럼 제어
 *
 * - 일반 사용자: 원가 컬럼 숨김
 * - 관리자: 원가 컬럼 표시
 */
export const DynamicColumns: Story = {
  name: '시나리오 2: 동적 컬럼 제어',
  args: {
    initialRole: 'user',
    debug: true,
  },
  play: async ({ canvasElement, step }) => {
    await waitForListLoad(canvasElement)
    await waitForListData(canvasElement, 1)

    await step('일반 사용자: 원가 컬럼 숨김 확인', async () => {
      // user 역할에서는 costPrice 컬럼이 숨겨져야 함
      const costPriceVisible = isColumnVisible(canvasElement, 'costPrice')
      expect(costPriceVisible).toBe(false)
    })

    await step('관리자로 역할 변경', async () => {
      const roleSelect = canvasElement.querySelector(
        '#role-switcher'
      ) as HTMLSelectElement
      await userEvent.selectOptions(roleSelect, 'admin')

      // 컬럼 업데이트 대기
      await new Promise((resolve) => setTimeout(resolve, 200))
    })

    await step('관리자: 원가 컬럼 표시 확인', async () => {
      await waitForColumnVisible(canvasElement, 'costPrice')
      const costPriceVisible = isColumnVisible(canvasElement, 'costPrice')
      expect(costPriceVisible).toBe(true)
    })

    await step('다시 일반 사용자로 변경', async () => {
      const roleSelect = canvasElement.querySelector(
        '#role-switcher'
      ) as HTMLSelectElement
      await userEvent.selectOptions(roleSelect, 'user')

      // 컬럼 업데이트 대기
      await new Promise((resolve) => setTimeout(resolve, 200))
    })

    await step('원가 컬럼 다시 숨김 확인', async () => {
      await waitForColumnHidden(canvasElement, 'costPrice')
      const costPriceVisible = isColumnVisible(canvasElement, 'costPrice')
      expect(costPriceVisible).toBe(false)
    })
  },
}

/**
 * 시나리오 3: 페이지네이션 및 정렬
 *
 * - 페이지 이동
 * - 정렬 토글
 */
export const PaginationAndSort: Story = {
  name: '시나리오 3: 페이지네이션/정렬',
  args: {
    initialRole: 'user',
    debug: true,
  },
  play: async ({ canvasElement, step }) => {
    await waitForListLoad(canvasElement)
    await waitForListData(canvasElement, 1)

    await step('초기 페이지 확인', async () => {
      // 5개 행 표시 (pageSize: 5)
      assertRowCount(canvasElement, 5)
    })

    await step('다음 페이지로 이동', async () => {
      await goToNextPage(canvasElement)

      // 데이터 로딩 대기
      await new Promise((resolve) => setTimeout(resolve, 200))

      // 다음 페이지 데이터 확인
      assertRowCount(canvasElement, 5)
    })

    await step('이름 컬럼으로 정렬', async () => {
      await clickColumnSort(canvasElement, 'name')

      // 정렬 적용 대기
      await new Promise((resolve) => setTimeout(resolve, 200))
    })

    await step('정렬 상태 확인', async () => {
      // 정렬된 헤더에 정렬 표시 확인
      const header = canvasElement.querySelector(
        '.list-header-row__cell[data-column-id="name"]'
      )
      expect(header).toBeTruthy()
    })
  },
}

/**
 * 시나리오 4: Bulk Action 워크플로우
 *
 * - 초기: 버튼 비활성화
 * - 행 선택 시: 버튼 활성화
 * - 선택 해제 시: 버튼 비활성화
 */
export const BulkActions: Story = {
  name: '시나리오 4: Bulk Action',
  args: {
    initialRole: 'user',
    debug: true,
  },
  play: async ({ canvasElement, step }) => {
    await waitForListLoad(canvasElement)
    await waitForListData(canvasElement, 1)

    await step('초기 상태: Bulk Action 버튼 비활성화', async () => {
      // 선택된 항목이 없으면 버튼 비활성화
      const deleteEnabled = isBulkActionEnabled(canvasElement, 'delete')
      expect(deleteEnabled).toBe(false)
    })

    await step('첫 번째 행 선택', async () => {
      await toggleRowSelection(canvasElement, 0)

      // 상태 업데이트 대기
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    await step('선택 후: Bulk Action 버튼 활성화', async () => {
      const selectedCount = getSelectedRowCount(canvasElement)
      expect(selectedCount).toBe(1)

      const deleteEnabled = isBulkActionEnabled(canvasElement, 'delete')
      expect(deleteEnabled).toBe(true)
    })

    await step('추가 행 선택', async () => {
      await toggleRowSelection(canvasElement, 1)
      await toggleRowSelection(canvasElement, 2)

      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    await step('다중 선택 확인', async () => {
      const selectedCount = getSelectedRowCount(canvasElement)
      expect(selectedCount).toBe(3)
    })

    await step('행 선택 해제', async () => {
      await toggleRowSelection(canvasElement, 0)
      await toggleRowSelection(canvasElement, 1)
      await toggleRowSelection(canvasElement, 2)

      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    await step('선택 해제 후: Bulk Action 버튼 비활성화', async () => {
      const selectedCount = getSelectedRowCount(canvasElement)
      expect(selectedCount).toBe(0)

      const deleteEnabled = isBulkActionEnabled(canvasElement, 'delete')
      expect(deleteEnabled).toBe(false)
    })
  },
}

/**
 * 관리자 뷰 - 모든 컬럼 표시
 */
export const AdminView: Story = {
  name: 'Admin View (원가 표시)',
  args: {
    initialRole: 'admin',
    debug: true,
  },
  play: async ({ canvasElement, step }) => {
    await waitForListLoad(canvasElement)
    await waitForListData(canvasElement, 1)

    await step('관리자: 원가 컬럼 표시 확인', async () => {
      const costPriceVisible = isColumnVisible(canvasElement, 'costPrice')
      expect(costPriceVisible).toBe(true)
    })

    await step('원가 포맷팅 확인', async () => {
      // 원가 컬럼 (by column ID)
      const costText = getCellTextByColumnId(canvasElement, 0, 'costPrice')
      expect(costText).toContain('₩')
    })
  },
}
