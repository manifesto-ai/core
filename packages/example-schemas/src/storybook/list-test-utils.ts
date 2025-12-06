/**
 * List Test Utilities for Stories
 *
 * React와 Vue Storybook E2E 테스트에서 사용하는 List 컴포넌트 전용 유틸리티
 * DOM 기반으로 프레임워크에 독립적임
 */

// waitFor 타입 정의 (Storybook test에서 주입)
type WaitForOptions = { timeout?: number }
type WaitForFn = <T>(
  callback: () => T | Promise<T>,
  options?: WaitForOptions
) => Promise<T>

// 기본 waitFor 구현 (폴링 기반)
const defaultWaitFor: WaitForFn = async (callback, options = {}) => {
  const { timeout = 5000 } = options
  const startTime = Date.now()
  const interval = 50

  while (Date.now() - startTime < timeout) {
    try {
      const result = await callback()
      return result
    } catch {
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
  }

  // 마지막 시도
  return callback()
}

// Storybook test에서 주입할 수 있는 waitFor
let waitFor: WaitForFn = defaultWaitFor

/**
 * Storybook test의 waitFor를 주입
 */
export const setListWaitFor = (fn: WaitForFn) => {
  waitFor = fn
}

// ============================================================================
// 리스트 로딩 상태 헬퍼
// ============================================================================

/**
 * 리스트 로딩 완료 대기
 */
export const waitForListLoad = async (canvasElement: HTMLElement): Promise<void> => {
  // 초기 렌더링 안정화를 위한 짧은 대기
  await new Promise((resolve) => setTimeout(resolve, 100))

  await waitFor(
    () => {
      // list-renderer--loading 클래스가 없어질 때까지 대기
      const listRenderer = canvasElement.querySelector('.list-renderer')
      if (!listRenderer) throw new Error('List renderer not found')
      if (listRenderer.classList.contains('list-renderer--loading')) {
        throw new Error('List still loading')
      }
      return true
    },
    { timeout: 15000 }
  )
}

/**
 * 리스트 데이터 로딩 대기 (최소 행 수 확인)
 */
export const waitForListData = async (
  canvasElement: HTMLElement,
  minRows = 1
): Promise<void> => {
  await waitForListLoad(canvasElement)

  await waitFor(
    () => {
      const rows = canvasElement.querySelectorAll('.list-row')
      if (rows.length < minRows) {
        throw new Error(`Expected at least ${minRows} rows, found ${rows.length}`)
      }
      return true
    },
    { timeout: 10000 }
  )
}

// ============================================================================
// 셀 접근 헬퍼
// ============================================================================

/**
 * 특정 행과 열의 셀 요소 가져오기
 * @param rowIndex 0-based row index
 * @param colIndex 0-based column index
 */
export const getListCell = (
  canvasElement: HTMLElement,
  rowIndex: number,
  colIndex: number
): HTMLElement | null => {
  const rows = canvasElement.querySelectorAll('.list-row')
  if (rowIndex >= rows.length) return null

  const row = rows[rowIndex]
  if (!row) return null
  const cells = row.querySelectorAll('.list-row__cell')
  if (colIndex >= cells.length) return null

  return cells[colIndex] as HTMLElement
}

/**
 * 특정 행과 열의 셀 텍스트 가져오기
 */
export const getCellText = (
  canvasElement: HTMLElement,
  rowIndex: number,
  colIndex: number
): string => {
  const cell = getListCell(canvasElement, rowIndex, colIndex)
  return cell?.textContent?.trim() ?? ''
}

/**
 * 특정 컬럼 ID로 셀 가져오기
 */
export const getCellByColumnId = (
  canvasElement: HTMLElement,
  rowIndex: number,
  columnId: string
): HTMLElement | null => {
  const rows = canvasElement.querySelectorAll('.list-row')
  if (rowIndex >= rows.length) return null

  const row = rows[rowIndex]
  if (!row) return null
  return row.querySelector(`[data-column-id="${columnId}"]`) as HTMLElement | null
}

/**
 * 특정 컬럼 ID로 셀 텍스트 가져오기
 */
export const getCellTextByColumnId = (
  canvasElement: HTMLElement,
  rowIndex: number,
  columnId: string
): string => {
  const cell = getCellByColumnId(canvasElement, rowIndex, columnId)
  return cell?.textContent?.trim() ?? ''
}

/**
 * 특정 컬럼 ID로 Badge variant 가져오기
 */
export const getBadgeVariantByColumnId = (
  canvasElement: HTMLElement,
  rowIndex: number,
  columnId: string
): string | null => {
  const cell = getCellByColumnId(canvasElement, rowIndex, columnId)
  if (!cell) return null

  const badge = cell.querySelector('.list-cell__badge')
  if (!badge) return null

  // list-cell__badge--{variant} 클래스에서 variant 추출
  const classes = Array.from(badge.classList)
  for (const cls of classes) {
    const match = cls.match(/^list-cell__badge--(\w+)$/)
    if (match && match[1] && match[1] !== 'badge') {
      return match[1]
    }
  }
  return null
}

/**
 * 셀 내의 Badge variant 클래스 확인
 */
export const getBadgeVariant = (
  canvasElement: HTMLElement,
  rowIndex: number,
  colIndex: number
): string | null => {
  const cell = getListCell(canvasElement, rowIndex, colIndex)
  if (!cell) return null

  const badge = cell.querySelector('.list-cell__badge')
  if (!badge) return null

  // list-cell__badge--{variant} 클래스에서 variant 추출
  const classes = Array.from(badge.classList)
  for (const cls of classes) {
    const match = cls.match(/^list-cell__badge--(\w+)$/)
    if (match && match[1] && match[1] !== 'badge') {
      return match[1]
    }
  }
  return null
}

/**
 * 셀이 특정 variant의 Badge를 포함하는지 확인
 */
export const hasBadgeVariant = (
  canvasElement: HTMLElement,
  rowIndex: number,
  colIndex: number,
  expectedVariant: string
): boolean => {
  return getBadgeVariant(canvasElement, rowIndex, colIndex) === expectedVariant
}

// ============================================================================
// 컬럼 헬퍼
// ============================================================================

/**
 * 컬럼 헤더 요소 가져오기
 */
export const getColumnHeader = (
  canvasElement: HTMLElement,
  columnId: string
): HTMLElement | null => {
  return canvasElement.querySelector(
    `.list-header-row__cell[data-column-id="${columnId}"], th[data-column-id="${columnId}"]`
  ) as HTMLElement | null
}

/**
 * 컬럼이 표시되어 있는지 확인
 */
export const isColumnVisible = (
  canvasElement: HTMLElement,
  columnId: string
): boolean => {
  return getColumnHeader(canvasElement, columnId) !== null
}

/**
 * 컬럼이 나타날 때까지 대기
 */
export const waitForColumnVisible = async (
  canvasElement: HTMLElement,
  columnId: string,
  timeout = 10000
): Promise<void> => {
  await waitFor(
    () => {
      if (!isColumnVisible(canvasElement, columnId)) {
        throw new Error(`Column ${columnId} not visible`)
      }
      return true
    },
    { timeout }
  )
}

/**
 * 컬럼이 숨겨질 때까지 대기
 */
export const waitForColumnHidden = async (
  canvasElement: HTMLElement,
  columnId: string,
  timeout = 10000
): Promise<void> => {
  await waitFor(
    () => {
      if (isColumnVisible(canvasElement, columnId)) {
        throw new Error(`Column ${columnId} still visible`)
      }
      return true
    },
    { timeout }
  )
}

/**
 * 모든 표시된 컬럼 ID 목록 가져오기
 */
export const getVisibleColumnIds = (canvasElement: HTMLElement): string[] => {
  const headers = canvasElement.querySelectorAll(
    '.list-header-row__cell[data-column-id], th[data-column-id]'
  )
  return Array.from(headers).map(
    (header) => header.getAttribute('data-column-id') ?? ''
  )
}

// ============================================================================
// 정렬 헬퍼
// ============================================================================

/**
 * 컬럼 정렬 클릭
 */
export const clickColumnSort = async (
  canvasElement: HTMLElement,
  columnId: string
): Promise<void> => {
  const header = getColumnHeader(canvasElement, columnId)
  if (!header) throw new Error(`Column ${columnId} not found`)

  const sortButton = header.querySelector('.list-header__sort, button, [role="button"]')
  if (sortButton) {
    ;(sortButton as HTMLElement).click()
  } else {
    header.click()
  }

  // 정렬 적용 대기
  await new Promise((resolve) => setTimeout(resolve, 100))
}

/**
 * 현재 정렬 상태 가져오기
 */
export const getSortState = (
  canvasElement: HTMLElement
): { field: string | null; direction: 'asc' | 'desc' | null } => {
  const sortedHeader = canvasElement.querySelector(
    '.list-header-row__cell--sorted-asc, .list-header-row__cell--sorted-desc, [aria-sort="ascending"], [aria-sort="descending"]'
  )

  if (!sortedHeader) {
    return { field: null, direction: null }
  }

  const field = sortedHeader.getAttribute('data-column-id')
  const isAsc =
    sortedHeader.classList.contains('list-header-row__cell--sorted-asc') ||
    sortedHeader.getAttribute('aria-sort') === 'ascending'

  return { field, direction: isAsc ? 'asc' : 'desc' }
}

// ============================================================================
// 선택 헬퍼
// ============================================================================

/**
 * 행 선택 토글
 */
export const toggleRowSelection = async (
  canvasElement: HTMLElement,
  rowIndex: number
): Promise<void> => {
  const rows = canvasElement.querySelectorAll('.list-row')
  const row = rows[rowIndex]
  if (!row) throw new Error(`Row ${rowIndex} not found`)

  const checkbox = row.querySelector(
    'input[type="checkbox"], .list-row__checkbox'
  ) as HTMLInputElement | null

  if (checkbox) {
    checkbox.click()
  } else {
    // checkbox가 없으면 행 클릭
    ;(row as HTMLElement).click()
  }

  await new Promise((resolve) => setTimeout(resolve, 50))
}

/**
 * 전체 선택 토글
 */
export const toggleSelectAll = async (canvasElement: HTMLElement): Promise<void> => {
  const selectAllCheckbox = canvasElement.querySelector(
    '.list-header__select-all input[type="checkbox"], thead input[type="checkbox"]'
  ) as HTMLInputElement | null

  if (!selectAllCheckbox) throw new Error('Select all checkbox not found')

  selectAllCheckbox.click()
  await new Promise((resolve) => setTimeout(resolve, 50))
}

/**
 * 선택된 행 수 가져오기
 */
export const getSelectedRowCount = (canvasElement: HTMLElement): number => {
  const selectedRows = canvasElement.querySelectorAll(
    '.list-row--selected, tr.selected, tr[aria-selected="true"]'
  )
  return selectedRows.length
}

/**
 * 특정 행이 선택되어 있는지 확인
 */
export const isRowSelected = (
  canvasElement: HTMLElement,
  rowIndex: number
): boolean => {
  const rows = canvasElement.querySelectorAll('.list-row')
  const row = rows[rowIndex]
  if (!row) return false

  return (
    row.classList.contains('list-row--selected') ||
    row.getAttribute('aria-selected') === 'true'
  )
}

// ============================================================================
// 페이지네이션 헬퍼
// ============================================================================

/**
 * 특정 페이지로 이동
 */
export const goToPage = async (
  canvasElement: HTMLElement,
  page: number
): Promise<void> => {
  // 페이지 번호 버튼 직접 찾기
  const allPageButtons = canvasElement.querySelectorAll('.list-pagination__page')
  for (const btn of allPageButtons) {
    if (btn.textContent?.trim() === String(page)) {
      ;(btn as HTMLButtonElement).click()
      await new Promise((resolve) => setTimeout(resolve, 100))
      return
    }
  }

  throw new Error(`Page ${page} button not found`)
}

/**
 * 다음 페이지로 이동
 */
export const goToNextPage = async (canvasElement: HTMLElement): Promise<void> => {
  const nextButton = canvasElement.querySelector(
    '.list-pagination__btn--next'
  ) as HTMLButtonElement | null

  if (!nextButton || nextButton.disabled) {
    throw new Error('Next page button not available')
  }

  nextButton.click()
  await new Promise((resolve) => setTimeout(resolve, 100))
}

/**
 * 이전 페이지로 이동
 */
export const goToPrevPage = async (canvasElement: HTMLElement): Promise<void> => {
  const prevButton = canvasElement.querySelector(
    '.list-pagination__btn--prev'
  ) as HTMLButtonElement | null

  if (!prevButton || prevButton.disabled) {
    throw new Error('Previous page button not available')
  }

  prevButton.click()
  await new Promise((resolve) => setTimeout(resolve, 100))
}

/**
 * 페이지 크기 변경
 */
export const changePageSize = async (
  canvasElement: HTMLElement,
  size: number
): Promise<void> => {
  const pageSizeSelect = canvasElement.querySelector(
    '.list-pagination__page-size select, #page-size'
  ) as HTMLSelectElement | null

  if (!pageSizeSelect) throw new Error('Page size select not found')

  pageSizeSelect.value = String(size)
  pageSizeSelect.dispatchEvent(new Event('change', { bubbles: true }))

  await new Promise((resolve) => setTimeout(resolve, 100))
}

/**
 * 현재 페이지 정보 가져오기
 */
export const getPageInfo = (
  canvasElement: HTMLElement
): { currentPage: number; totalPages: number; pageSize: number } => {
  const activePageButton = canvasElement.querySelector(
    '.list-pagination__page--active'
  )
  const currentPage = activePageButton
    ? parseInt(activePageButton.textContent ?? '1', 10)
    : 1

  const pageButtons = canvasElement.querySelectorAll('.list-pagination__page')
  const lastButton = pageButtons[pageButtons.length - 1]
  const totalPages = lastButton
    ? parseInt(lastButton.textContent ?? '1', 10)
    : 1

  const pageSizeSelect = canvasElement.querySelector(
    '.list-pagination__page-size select, #page-size'
  ) as HTMLSelectElement | null
  const pageSize = pageSizeSelect ? parseInt(pageSizeSelect.value, 10) : 10

  return { currentPage, totalPages, pageSize }
}

// ============================================================================
// Bulk Action 헬퍼
// ============================================================================

/**
 * Bulk Action 버튼 가져오기
 */
export const getBulkActionButton = (
  canvasElement: HTMLElement,
  actionId: string
): HTMLButtonElement | null => {
  return canvasElement.querySelector(
    `.list-toolbar__bulk-btn[data-action-id="${actionId}"], button[data-action-id="${actionId}"]`
  ) as HTMLButtonElement | null
}

/**
 * Bulk Action 버튼 클릭
 */
export const clickBulkAction = async (
  canvasElement: HTMLElement,
  actionId: string
): Promise<void> => {
  const button = getBulkActionButton(canvasElement, actionId)
  if (!button) throw new Error(`Bulk action button ${actionId} not found`)

  button.click()
  await new Promise((resolve) => setTimeout(resolve, 100))
}

/**
 * Bulk Action 버튼 활성화 여부 확인
 */
export const isBulkActionEnabled = (
  canvasElement: HTMLElement,
  actionId: string
): boolean => {
  const button = getBulkActionButton(canvasElement, actionId)
  return button !== null && !button.disabled
}

/**
 * Bulk Action 버튼이 활성화될 때까지 대기
 */
export const waitForBulkActionEnabled = async (
  canvasElement: HTMLElement,
  actionId: string,
  timeout = 5000
): Promise<void> => {
  await waitFor(
    () => {
      if (!isBulkActionEnabled(canvasElement, actionId)) {
        throw new Error(`Bulk action ${actionId} still disabled`)
      }
      return true
    },
    { timeout }
  )
}

/**
 * Bulk Action 버튼이 비활성화될 때까지 대기
 */
export const waitForBulkActionDisabled = async (
  canvasElement: HTMLElement,
  actionId: string,
  timeout = 5000
): Promise<void> => {
  await waitFor(
    () => {
      if (isBulkActionEnabled(canvasElement, actionId)) {
        throw new Error(`Bulk action ${actionId} still enabled`)
      }
      return true
    },
    { timeout }
  )
}

// ============================================================================
// 검색/필터 헬퍼
// ============================================================================

/**
 * 검색어 입력
 */
export const setSearchTerm = async (
  canvasElement: HTMLElement,
  term: string
): Promise<void> => {
  const searchInput = canvasElement.querySelector(
    '.list-toolbar__search input, input[type="search"], input[placeholder*="검색"]'
  ) as HTMLInputElement | null

  if (!searchInput) throw new Error('Search input not found')

  searchInput.value = term
  searchInput.dispatchEvent(new Event('input', { bubbles: true }))
  searchInput.dispatchEvent(new Event('change', { bubbles: true }))

  await new Promise((resolve) => setTimeout(resolve, 300)) // 디바운스 대기
}

/**
 * 필터 값 설정
 */
export const setFilterValue = async (
  canvasElement: HTMLElement,
  filterId: string,
  value: string
): Promise<void> => {
  const filterSelect = canvasElement.querySelector(
    `.list-toolbar__filter[data-filter-id="${filterId}"] select, select[data-filter="${filterId}"]`
  ) as HTMLSelectElement | null

  if (!filterSelect) throw new Error(`Filter ${filterId} not found`)

  filterSelect.value = value
  filterSelect.dispatchEvent(new Event('change', { bubbles: true }))

  await new Promise((resolve) => setTimeout(resolve, 100))
}

/**
 * 필터 초기화
 */
export const resetFilters = async (canvasElement: HTMLElement): Promise<void> => {
  const resetButton = canvasElement.querySelector(
    '.list-toolbar__reset, button[data-action="reset-filters"]'
  ) as HTMLButtonElement | null

  if (!resetButton) throw new Error('Reset filters button not found')

  resetButton.click()
  await new Promise((resolve) => setTimeout(resolve, 100))
}

// ============================================================================
// 디버그 헬퍼
// ============================================================================

/**
 * 디버그 패널에서 리스트 상태 가져오기
 */
export const getDebugListState = (canvasElement: HTMLElement): unknown | null => {
  const debugPanel = canvasElement.querySelector('.list-renderer__debug pre')
  if (debugPanel?.textContent) {
    try {
      return JSON.parse(debugPanel.textContent)
    } catch {
      return null
    }
  }
  return null
}

// ============================================================================
// 어설션 헬퍼
// ============================================================================

/**
 * 셀 값 검증
 */
export const assertCellValue = (
  canvasElement: HTMLElement,
  rowIndex: number,
  colIndex: number,
  expectedValue: string
): void => {
  const actualValue = getCellText(canvasElement, rowIndex, colIndex)
  if (actualValue !== expectedValue) {
    throw new Error(
      `Expected cell (${rowIndex}, ${colIndex}) to have value "${expectedValue}", but got "${actualValue}"`
    )
  }
}

/**
 * 셀 값에 특정 문자열이 포함되어 있는지 검증
 */
export const assertCellContains = (
  canvasElement: HTMLElement,
  rowIndex: number,
  colIndex: number,
  expectedSubstring: string
): void => {
  const actualValue = getCellText(canvasElement, rowIndex, colIndex)
  if (!actualValue.includes(expectedSubstring)) {
    throw new Error(
      `Expected cell (${rowIndex}, ${colIndex}) to contain "${expectedSubstring}", but got "${actualValue}"`
    )
  }
}

/**
 * Badge variant 검증
 */
export const assertBadgeVariant = (
  canvasElement: HTMLElement,
  rowIndex: number,
  colIndex: number,
  expectedVariant: string
): void => {
  const actualVariant = getBadgeVariant(canvasElement, rowIndex, colIndex)
  if (actualVariant !== expectedVariant) {
    throw new Error(
      `Expected badge at (${rowIndex}, ${colIndex}) to have variant "${expectedVariant}", but got "${actualVariant}"`
    )
  }
}

/**
 * 행 수 검증
 */
export const assertRowCount = (
  canvasElement: HTMLElement,
  expectedCount: number
): void => {
  const rows = canvasElement.querySelectorAll('.list-row')
  if (rows.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} rows, but found ${rows.length}`
    )
  }
}

/**
 * 컬럼 표시 여부 검증
 */
export const assertColumnVisible = (
  canvasElement: HTMLElement,
  columnId: string
): void => {
  if (!isColumnVisible(canvasElement, columnId)) {
    throw new Error(`Expected column "${columnId}" to be visible`)
  }
}

/**
 * 컬럼 숨김 여부 검증
 */
export const assertColumnHidden = (
  canvasElement: HTMLElement,
  columnId: string
): void => {
  if (isColumnVisible(canvasElement, columnId)) {
    throw new Error(`Expected column "${columnId}" to be hidden`)
  }
}
