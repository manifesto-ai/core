/**
 * Tabs Primitive
 *
 * 탭 네비게이션 컴포넌트
 */

import React from 'react'
import type { TabsPrimitiveProps } from '../types/primitives'

// ============================================================================
// Tabs Primitive Component
// ============================================================================

/**
 * Tabs Primitive
 *
 * 탭 네비게이션 UI
 */
export const Tabs: React.FC<TabsPrimitiveProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  className,
}) => {
  const classNames = ['mfs-tabs', className].filter(Boolean).join(' ')

  return (
    <div className={classNames} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        const tabClassNames = [
          'mfs-tab',
          isActive && 'mfs-tab--active',
          tab.disabled && 'mfs-tab--disabled',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            className={tabClassNames}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default Tabs
