import type { FieldSemanticNode } from '@manifesto-ai/ui'
import type React from 'react'

/**
 * Props passed to field renderer components from the React adapter.
 */
export interface FieldComponentProps {
  field: FieldSemanticNode
  value: unknown
  disabled: boolean
  readonly?: boolean
  errors: readonly string[]
  liveErrors?: readonly string[]
  onChange: (value: unknown) => void
}

export type FieldRendererComponent = React.ComponentType<FieldComponentProps>

export interface FormActionHandlerContext {
  actionId: string
  runtime: import('@manifesto-ai/engine').FormRuntime
  node: import('@manifesto-ai/ui').ActionSemanticNode
}

export type FormActionHandler = (ctx: FormActionHandlerContext) => void | Promise<void>
