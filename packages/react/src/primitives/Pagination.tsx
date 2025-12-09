/**
 * Pagination Primitive
 *
 * 페이지네이션 컴포넌트
 */

import React from 'react'
import type { PaginationPrimitiveProps } from '../types/primitives'
import { Button } from './Button'

// ============================================================================
// Pagination Primitive Component
// ============================================================================

/**
 * Pagination Primitive
 *
 * 테이블 페이지네이션 UI
 */
export const Pagination: React.FC<PaginationPrimitiveProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
}) => {
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  // 페이지 번호 범위 계산 (현재 페이지 중심으로 5개)
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = []
    const maxVisible = 5
    const halfVisible = Math.floor(maxVisible / 2)

    let start = Math.max(1, currentPage - halfVisible)
    let end = Math.min(totalPages, currentPage + halfVisible)

    // 시작이 1보다 크면 앞에 더 보여줄 수 있음
    if (end - start < maxVisible - 1) {
      if (start === 1) {
        end = Math.min(totalPages, start + maxVisible - 1)
      } else {
        start = Math.max(1, end - maxVisible + 1)
      }
    }

    // 1 페이지 추가
    if (start > 1) {
      pages.push(1)
      if (start > 2) {
        pages.push('ellipsis')
      }
    }

    // 범위 내 페이지 추가
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    // 마지막 페이지 추가
    if (end < totalPages) {
      if (end < totalPages - 1) {
        pages.push('ellipsis')
      }
      pages.push(totalPages)
    }

    return pages
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  const classNames = ['mfs-pagination', className].filter(Boolean).join(' ')

  return (
    <div className={classNames}>
      {/* 아이템 정보 */}
      <div className="mfs-pagination-info">
        {totalItems > 0 ? (
          <span>
            {startItem}-{endItem} / {totalItems}건
          </span>
        ) : (
          <span>0건</span>
        )}
      </div>

      {/* 페이지 크기 선택 */}
      {onPageSizeChange && (
        <div className="mfs-pagination-size">
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="mfs-pagination-size-select"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}개씩 보기
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 페이지 네비게이션 */}
      <div className="mfs-pagination-nav">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrevious}
          disabled={currentPage <= 1}
        >
          ‹
        </Button>

        {getPageNumbers().map((page, index) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="mfs-pagination-ellipsis">
              …
            </span>
          ) : (
            <Button
              key={page}
              variant={page === currentPage ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          )
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleNext}
          disabled={currentPage >= totalPages}
        >
          ›
        </Button>
      </div>
    </div>
  )
}

export default Pagination
