/**
 * ActionCell - Row action buttons cell
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import type { RowAction } from '@manifesto-ai/schema'

export interface ActionCellProps {
  rowId: string
  row: Record<string, unknown>
  actions: readonly RowAction[]
  onAction: (rowId: string, actionId: string, row: Record<string, unknown>) => void
  renderRowActions?: (row: Record<string, unknown>) => React.ReactNode
}

export const ActionCell: React.FC<ActionCellProps> = ({
  rowId,
  row,
  actions,
  onAction,
  renderRowActions,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Custom render prop takes priority
  if (renderRowActions) {
    const customContent = renderRowActions(row)
    if (customContent !== null) {
      return (
        <td className="list-row__cell list-row__cell--actions">
          {customContent}
        </td>
      )
    }
  }

  // Close menu on outside click
  useEffect(() => {
    if (!isMenuOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen])

  const handleActionClick = useCallback(
    (actionId: string) => {
      onAction(rowId, actionId, row)
      setIsMenuOpen(false)
    },
    [rowId, row, onAction]
  )

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev)
  }, [])

  // No actions
  if (!actions.length) {
    return <td className="list-row__cell list-row__cell--actions" />
  }

  // Inline mode for 1-2 actions
  if (actions.length <= 2) {
    return (
      <td className="list-row__cell list-row__cell--actions">
        <div className="list-action-cell list-action-cell--inline">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={`list-action-cell__btn list-action-cell__btn--${action.variant ?? 'ghost'}`}
              onClick={() => handleActionClick(action.id)}
              title={action.label}
            >
              {action.icon && (
                <span className="list-action-cell__icon">{action.icon}</span>
              )}
              <span className="list-action-cell__label">{action.label}</span>
            </button>
          ))}
        </div>
      </td>
    )
  }

  // Dropdown menu for 3+ actions
  return (
    <td className="list-row__cell list-row__cell--actions">
      <div className="list-action-cell list-action-cell--dropdown" ref={menuRef}>
        <button
          type="button"
          className="list-action-cell__trigger"
          onClick={toggleMenu}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
        >
          <span className="list-action-cell__dots">{'\u22EE'}</span>
        </button>
        {isMenuOpen && (
          <div className="list-action-cell__menu" role="menu">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                className={`list-action-cell__menu-item list-action-cell__menu-item--${action.variant ?? 'ghost'}`}
                onClick={() => handleActionClick(action.id)}
              >
                {action.icon && (
                  <span className="list-action-cell__icon">{action.icon}</span>
                )}
                <span className="list-action-cell__label">{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </td>
  )
}

export default ActionCell
