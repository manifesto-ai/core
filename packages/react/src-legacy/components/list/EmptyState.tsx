/**
 * EmptyState - Empty state display for lists
 */

import React from 'react'
import type { EmptyStateConfig } from '@manifesto-ai/schema'

export interface EmptyStateProps {
  config?: EmptyStateConfig
  onAction?: () => void
}

export const EmptyState: React.FC<EmptyStateProps> = ({ config, onAction }) => {
  const title = config?.title ?? 'No data'
  const description = config?.description
  const icon = config?.icon
  const actionLabel = config?.action?.label

  return (
    <div className="list-empty-state">
      {icon && (
        <div className="list-empty-state__icon">
          <span>{icon}</span>
        </div>
      )}
      <div className="list-empty-state__content">
        <h3 className="list-empty-state__title">{title}</h3>
        {description && (
          <p className="list-empty-state__description">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          className="list-empty-state__action"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export default EmptyState
