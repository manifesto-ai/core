import React from 'react'
import type { ActionSemanticNode } from '@manifesto-ai/ui'
import type { ActionHandlerRegistry } from '@manifesto-ai/ui'
import type { FormActionHandler } from '../../types'

interface ActionButtonsProps {
  actions: readonly ActionSemanticNode[]
  registry: ActionHandlerRegistry<FormActionHandler>
  runtime: import('@manifesto-ai/engine').FormRuntime | null
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({ actions, registry, runtime }) => {
  const handleClick = (action: ActionSemanticNode) => {
    const handler = registry.get(action.actionId)
    if (handler && runtime) {
      handler({ actionId: action.actionId, runtime, node: action })
    }
  }

  if (!actions.length) return null

  return (
    <div className="mfs-actions">
      {actions.map((action) => (
        <button key={action.id} type="button" onClick={() => handleClick(action)}>
          {action.label}
        </button>
      ))}
    </div>
  )
}
