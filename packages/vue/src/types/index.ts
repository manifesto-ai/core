import type { FieldSemanticNode } from '@manifesto-ai/ui'
import type { Component } from 'vue'

export interface FieldComponentProps {
  field: FieldSemanticNode
  value: unknown
  disabled: boolean
  readonly?: boolean
  errors: readonly string[]
  liveErrors?: readonly string[]
  onChange: (value: unknown) => void
}

// Use Component type for flexibility with Vue's complex generic types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FieldRendererComponent = Component<any>

export interface FormActionHandlerContext {
  actionId: string
  runtime: import('@manifesto-ai/engine').FormRuntime
  node: import('@manifesto-ai/ui').ActionSemanticNode
}

export type FormActionHandler = (ctx: FormActionHandlerContext) => void | Promise<void>
