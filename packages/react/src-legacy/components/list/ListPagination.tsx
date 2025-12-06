/**
 * ListPagination - Pagination controls component
 */

import React, { useCallback, useMemo } from 'react'
import type { PaginationConfig } from '@manifesto-ai/schema'

export interface ListPaginationProps {
  currentPage: number
  pageSize: number
  totalPages: number
  totalCount: number
  config?: PaginationConfig
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export const ListPagination: React.FC<ListPaginationProps> = ({
  currentPage,
  pageSize,
  totalPages,
  totalCount,
  config,
  onPageChange,
  onPageSizeChange,
}) => {
  // Check if pagination is disabled
  if (config?.enabled === false) {
    return null
  }

  const pageSizeOptions = config?.pageSizeOptions ?? [10, 20, 50, 100]
  const showTotal = config?.showTotal !== false
  const showPageSize = config?.showPageSize !== false
  const showQuickJumper = config?.showQuickJumper ?? false

  const canGoPrev = currentPage > 1
  const canGoNext = currentPage < totalPages

  const handleFirstPage = useCallback(() => {
    if (canGoPrev) onPageChange(1)
  }, [canGoPrev, onPageChange])

  const handlePrevPage = useCallback(() => {
    if (canGoPrev) onPageChange(currentPage - 1)
  }, [currentPage, canGoPrev, onPageChange])

  const handleNextPage = useCallback(() => {
    if (canGoNext) onPageChange(currentPage + 1)
  }, [currentPage, canGoNext, onPageChange])

  const handleLastPage = useCallback(() => {
    if (canGoNext) onPageChange(totalPages)
  }, [canGoNext, totalPages, onPageChange])

  const handlePageSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newSize = Number(e.target.value)
      onPageSizeChange(newSize)
    },
    [onPageSizeChange]
  )

  const handleQuickJump = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const page = Number(e.target.value)
      if (page >= 1 && page <= totalPages) {
        onPageChange(page)
      }
    },
    [totalPages, onPageChange]
  )

  // Calculate visible page range
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalCount)

  // Generate page buttons (max 5 visible)
  const pageButtons = useMemo(() => {
    const buttons: number[] = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }

    for (let i = start; i <= end; i++) {
      buttons.push(i)
    }
    return buttons
  }, [currentPage, totalPages])

  return (
    <div className="list-pagination">
      {/* Total info */}
      {showTotal && (
        <div className="list-pagination__info">
          <span>
            {startItem}-{endItem} of {totalCount}
          </span>
        </div>
      )}

      {/* Page size selector */}
      {showPageSize && (
        <div className="list-pagination__page-size">
          <label htmlFor="page-size">Rows per page:</label>
          <select
            id="page-size"
            value={pageSize}
            onChange={handlePageSizeChange}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Page navigation */}
      <div className="list-pagination__controls">
        {/* First page */}
        <button
          type="button"
          className="list-pagination__btn list-pagination__btn--first"
          onClick={handleFirstPage}
          disabled={!canGoPrev}
          aria-label="First page"
        >
          {'\u00AB'}
        </button>

        {/* Previous page */}
        <button
          type="button"
          className="list-pagination__btn list-pagination__btn--prev"
          onClick={handlePrevPage}
          disabled={!canGoPrev}
          aria-label="Previous page"
        >
          {'\u2039'}
        </button>

        {/* Page numbers */}
        <div className="list-pagination__pages">
          {pageButtons.length > 0 && pageButtons[0]! > 1 && (
            <>
              <button
                type="button"
                className="list-pagination__page"
                onClick={() => onPageChange(1)}
              >
                1
              </button>
              {pageButtons[0]! > 2 && (
                <span className="list-pagination__ellipsis">{'\u2026'}</span>
              )}
            </>
          )}
          {pageButtons.map((page) => (
            <button
              key={page}
              type="button"
              className={`list-pagination__page ${
                page === currentPage ? 'list-pagination__page--active' : ''
              }`}
              onClick={() => onPageChange(page)}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </button>
          ))}
          {pageButtons.length > 0 && pageButtons[pageButtons.length - 1]! < totalPages && (
            <>
              {pageButtons[pageButtons.length - 1]! < totalPages - 1 && (
                <span className="list-pagination__ellipsis">{'\u2026'}</span>
              )}
              <button
                type="button"
                className="list-pagination__page"
                onClick={() => onPageChange(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        {/* Next page */}
        <button
          type="button"
          className="list-pagination__btn list-pagination__btn--next"
          onClick={handleNextPage}
          disabled={!canGoNext}
          aria-label="Next page"
        >
          {'\u203A'}
        </button>

        {/* Last page */}
        <button
          type="button"
          className="list-pagination__btn list-pagination__btn--last"
          onClick={handleLastPage}
          disabled={!canGoNext}
          aria-label="Last page"
        >
          {'\u00BB'}
        </button>
      </div>

      {/* Quick jumper */}
      {showQuickJumper && (
        <div className="list-pagination__jumper">
          <label htmlFor="quick-jump">Go to:</label>
          <input
            id="quick-jump"
            type="number"
            min={1}
            max={totalPages}
            defaultValue={currentPage}
            onBlur={handleQuickJump}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleQuickJump(e as unknown as React.ChangeEvent<HTMLInputElement>)
              }
            }}
          />
        </div>
      )}
    </div>
  )
}

export default ListPagination
