/**
 * ListToolbar - Search, filters, and bulk actions toolbar
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import type { BulkAction, FilterConfig } from '@manifesto-ai/schema'

export interface ListToolbarProps {
  searchTerm: string
  filters: Readonly<Record<string, unknown>>
  filterConfig?: FilterConfig
  selectedCount: number
  bulkActions?: readonly BulkAction[]
  onSearch: (term: string) => void
  onFilter?: (fieldId: string, value: unknown) => void
  onResetFilters: () => void
  onBulkAction: (actionId: string) => void
  renderToolbar?: () => React.ReactNode
}

export const ListToolbar: React.FC<ListToolbarProps> = ({
  searchTerm,
  filters,
  filterConfig,
  selectedCount,
  bulkActions = [],
  onSearch,
  onFilter: _onFilter,
  onResetFilters,
  onBulkAction,
  renderToolbar,
}) => {
  // Note: _onFilter is available for future filter UI implementation
  void _onFilter
  // Custom render prop takes priority
  if (renderToolbar) {
    return <div className="list-toolbar">{renderToolbar()}</div>
  }

  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local search term with prop
  useEffect(() => {
    setLocalSearchTerm(searchTerm)
  }, [searchTerm])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setLocalSearchTerm(value)

      // Debounce search
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
      searchDebounceRef.current = setTimeout(() => {
        onSearch(value)
      }, 300)
    },
    [onSearch]
  )

  const handleSearchClear = useCallback(() => {
    setLocalSearchTerm('')
    onSearch('')
  }, [onSearch])

  const handleBulkActionClick = useCallback(
    (actionId: string) => {
      onBulkAction(actionId)
    },
    [onBulkAction]
  )

  const handleResetFilters = useCallback(() => {
    onResetFilters()
  }, [onResetFilters])

  // Check if search is enabled
  const searchEnabled = filterConfig?.searchable !== false

  // Check if any filters are active
  const hasActiveFilters = Object.keys(filters).length > 0 || searchTerm.length > 0

  // Filter bulk actions by min selection
  const availableBulkActions = bulkActions.filter((action) => {
    const minSelection = action.minSelection ?? 1
    return selectedCount >= minSelection
  })

  return (
    <div className="list-toolbar">
      {/* Left section: Search and filters */}
      <div className="list-toolbar__left">
        {/* Search input */}
        {searchEnabled && (
          <div className="list-toolbar__search">
            <input
              type="text"
              className="list-toolbar__search-input"
              placeholder={filterConfig?.searchPlaceholder ?? 'Search...'}
              value={localSearchTerm}
              onChange={handleSearchChange}
              aria-label="Search"
            />
            {localSearchTerm && (
              <button
                type="button"
                className="list-toolbar__search-clear"
                onClick={handleSearchClear}
                aria-label="Clear search"
              >
                {'\u2715'}
              </button>
            )}
          </div>
        )}

        {/* Reset filters button */}
        {hasActiveFilters && (
          <button
            type="button"
            className="list-toolbar__reset"
            onClick={handleResetFilters}
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Right section: Bulk actions */}
      <div className="list-toolbar__right">
        {/* Selection info */}
        {selectedCount > 0 && (
          <span className="list-toolbar__selection-info">
            {selectedCount} selected
          </span>
        )}

        {/* Bulk action buttons */}
        {availableBulkActions.length > 0 && (
          <div className="list-toolbar__bulk-actions">
            {availableBulkActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={`list-toolbar__bulk-btn list-toolbar__bulk-btn--${action.variant ?? 'secondary'}`}
                data-action-id={action.id}
                onClick={() => handleBulkActionClick(action.id)}
              >
                {action.icon && (
                  <span className="list-toolbar__bulk-icon">{action.icon}</span>
                )}
                <span className="list-toolbar__bulk-label">{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ListToolbar
