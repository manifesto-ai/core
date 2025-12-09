/**
 * ManifestoTable
 *
 * 선언적 테이블 등록 컴포넌트 (High-Level DX)
 *
 * ManifestoPage 내에서 사용하여 ListRuntime을 자동으로 생성하고
 * Engine에 등록합니다.
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react'
import type { ListViewSchema } from '@manifesto-ai/schema'
import type { FormSnapshot } from '@manifesto-ai/view-snapshot'
import { ListRuntime, type ListRuntimeOptions } from '@manifesto-ai/engine'
import { useEngine, useSnapshot } from '../composition/ManifestoContext'

// ============================================================================
// Types
// ============================================================================

/**
 * queryFn에 전달되는 파라미터
 */
export interface QueryParams {
  page: number
  pageSize: number
  sortField?: string
  sortDirection?: 'asc' | 'desc'
  filters?: Record<string, unknown>
  search?: string
}

/**
 * queryFn의 반환 타입
 */
export interface QueryResult {
  rows: Record<string, unknown>[]
  total: number
}

// ============================================================================
// Props
// ============================================================================

export interface ManifestoTableProps {
  /** 노드 ID */
  nodeId: string
  /** 리스트 스키마 */
  schema: ListViewSchema
  /** 필터 소스 노드 ID (선택적) */
  filterSource?: string
  /** 데이터 조회 함수 */
  queryFn?: (params: QueryParams) => Promise<QueryResult>
  /** 초기 데이터 */
  initialData?: Record<string, unknown>[]
  /** 행 선택 핸들러 */
  onRowSelect?: (selectedIds: string[]) => void
  /** 행 클릭 핸들러 */
  onRowClick?: (row: Record<string, unknown>) => void
  /** 액션 핸들러 */
  onAction?: (action: string, context: { selectedRows: Record<string, unknown>[] }) => void
  /** 에러 핸들러 */
  onError?: (error: unknown) => void
}

// ============================================================================
// ManifestoTable Component
// ============================================================================

/**
 * ManifestoTable
 *
 * ManifestoPage 내에서 사용하여 테이블을 선언적으로 등록합니다.
 * 이 컴포넌트 자체는 아무것도 렌더링하지 않습니다.
 * 실제 렌더링은 PageRenderer가 담당합니다.
 *
 * @example
 * ```tsx
 * <ManifestoPage pageId="orders" title="주문 관리">
 *   <ManifestoTable
 *     nodeId="order-table"
 *     schema={tableSchema}
 *     filterSource="order-filter"
 *     queryFn={fetchOrders}
 *     onAction={(action, ctx) => {
 *       if (action === 'viewDetail') {
 *         overlay.open('order-detail-modal', {
 *           orderId: ctx.selectedRows[0].id
 *         })
 *       }
 *     }}
 *   />
 * </ManifestoPage>
 * ```
 */
export const ManifestoTable: React.FC<ManifestoTableProps> = ({
  nodeId,
  schema,
  filterSource,
  queryFn,
  initialData,
  onRowSelect,
  onRowClick,
  onAction,
  onError,
}) => {
  const engine = useEngine()
  const snapshot = useSnapshot()
  const runtimeRef = useRef<ListRuntime | null>(null)

  // Stable callback refs
  const queryFnRef = useRef(queryFn)
  const onRowSelectRef = useRef(onRowSelect)
  const onRowClickRef = useRef(onRowClick)
  const onActionRef = useRef(onAction)
  const onErrorRef = useRef(onError)

  // Stable refs for objects to avoid infinite loops
  const schemaRef = useRef(schema)
  const initialDataRef = useRef(initialData)

  useEffect(() => {
    queryFnRef.current = queryFn
    onRowSelectRef.current = onRowSelect
    onRowClickRef.current = onRowClick
    onActionRef.current = onAction
    onErrorRef.current = onError
    schemaRef.current = schema
    initialDataRef.current = initialData
  })

  // ========================================================================
  // Filter Source Integration
  // ========================================================================

  /**
   * filterSource로 지정된 Form 노드에서 필터 값을 추출
   */
  const filterValues = useMemo(() => {
    if (!filterSource) return undefined

    // 스냅샷에서 filterSource에 해당하는 Form 노드 찾기
    const formNode = snapshot.children.find(
      (child) => child.kind === 'form' && child.nodeId === filterSource
    ) as FormSnapshot | undefined

    if (!formNode) return undefined

    // Form의 필드 값을 Record로 변환
    const filters: Record<string, unknown> = {}
    for (const field of formNode.fields) {
      if (field.value !== undefined && field.value !== null && field.value !== '') {
        filters[field.id] = field.value
      }
    }

    return Object.keys(filters).length > 0 ? filters : undefined
  }, [filterSource, snapshot])

  // filterValues를 ref로 유지 (fetchHandler에서 참조)
  const filterValuesRef = useRef(filterValues)
  useEffect(() => {
    filterValuesRef.current = filterValues
  }, [filterValues])

  // ========================================================================
  // Create fetchHandler from queryFn
  // ========================================================================

  const fetchHandler = useCallback(async (
    endpoint: string,
    options: { method?: string; body?: unknown; headers?: Record<string, string> }
  ): Promise<unknown> => {
    if (!queryFnRef.current) {
      throw new Error('queryFn is not provided')
    }

    // endpoint에서 쿼리 파라미터 추출 또는 body에서 추출
    const baseParams: QueryParams = options.body
      ? (options.body as QueryParams)
      : parseQueryParams(endpoint)

    // filterSource에서 추출한 필터 값 병합
    const params: QueryParams = {
      ...baseParams,
      filters: {
        ...baseParams.filters,
        ...filterValuesRef.current,
      },
    }

    try {
      const result = await queryFnRef.current(params)
      return {
        data: result.rows,
        total: result.total,
      }
    } catch (error) {
      onErrorRef.current?.(error)
      throw error
    }
  }, [])

  // ========================================================================
  // Create actionHandler for row/bulk actions
  // ========================================================================

  const actionHandler = useCallback(async (
    actionId: string,
    context: {
      row?: Record<string, unknown>
      rows?: readonly Record<string, unknown>[]
      selectedIds?: readonly string[]
    }
  ): Promise<void> => {
    // Row click 처리
    if (actionId === 'row-click' && context.row) {
      onRowClickRef.current?.(context.row)
      return
    }

    // Action 처리
    const selectedRows = context.rows ?? (context.row ? [context.row] : [])
    onActionRef.current?.(actionId, { selectedRows: [...selectedRows] })
  }, [])

  // ========================================================================
  // Runtime Registration
  // ========================================================================

  useEffect(() => {
    const currentSchema = schemaRef.current
    // ListRuntime 설정
    const options: ListRuntimeOptions = {
      initialData: initialDataRef.current ?? [],
      fetchHandler: queryFnRef.current ? fetchHandler : undefined,
      actionHandler: (onRowClickRef.current || onActionRef.current) ? actionHandler : undefined,
    }

    // ListRuntime 생성
    const runtime = new ListRuntime(currentSchema, options)

    // 초기화
    runtime.initialize()

    runtimeRef.current = runtime

    // Engine에 등록
    engine.registerListRuntime(nodeId, runtime, currentSchema)

    // 상태 변경 구독
    const unsubscribe = runtime.subscribe((state) => {
      // 선택 변경 알림
      onRowSelectRef.current?.(Array.from(state.selectedIds))
    })

    // 초기 데이터 로드 (API 데이터 소스인 경우)
    if (queryFnRef.current && currentSchema.dataSource.type === 'api') {
      console.log('[ManifestoTable] Dispatching LOAD for', nodeId)
      runtime.dispatch({ type: 'LOAD' }).then(() => {
        console.log('[ManifestoTable] LOAD completed for', nodeId, 'rows:', runtime.getState().rows.length)
      }).catch((err) => {
        console.error('[ManifestoTable] LOAD failed for', nodeId, err)
      })
    }

    // Cleanup
    return () => {
      unsubscribe()
      runtime.dispose()
      engine.unregisterRuntime(nodeId)
      runtimeRef.current = null
    }
    // Only re-run when nodeId or engine changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, engine, fetchHandler, actionHandler])

  // ========================================================================
  // Filter Change Detection
  // ========================================================================

  // 이전 필터 값 추적
  const prevFilterValuesRef = useRef<string | null>(null)

  useEffect(() => {
    if (!filterSource || !queryFn || !runtimeRef.current) return

    // 필터 값을 문자열로 직렬화하여 비교
    const currentFilterStr = filterValues ? JSON.stringify(filterValues) : null

    // 초기화 후 필터 변경 시에만 리로드
    if (prevFilterValuesRef.current !== null && prevFilterValuesRef.current !== currentFilterStr) {
      // 첫 페이지로 이동하면서 다시 로드
      runtimeRef.current.dispatch({ type: 'PAGE_CHANGE', page: 1 })
      runtimeRef.current.dispatch({ type: 'LOAD' })
    }

    prevFilterValuesRef.current = currentFilterStr
  }, [filterSource, filterValues, queryFn])

  // ========================================================================
  // Render
  // ========================================================================

  // 이 컴포넌트는 아무것도 렌더링하지 않음
  // 실제 테이블 UI는 PageRenderer가 TableRenderer를 통해 렌더링함
  return null
}

export default ManifestoTable

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * endpoint URL에서 쿼리 파라미터 추출
 */
function parseQueryParams(endpoint: string): QueryParams {
  try {
    const url = new URL(endpoint, 'http://localhost')
    return {
      page: parseInt(url.searchParams.get('page') ?? '1', 10),
      pageSize: parseInt(url.searchParams.get('pageSize') ?? '20', 10),
      sortField: url.searchParams.get('sortField') ?? undefined,
      sortDirection: (url.searchParams.get('sortDirection') as 'asc' | 'desc') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
    }
  } catch {
    return { page: 1, pageSize: 20 }
  }
}
