/**
 * Form Context
 *
 * React Context for FormRenderer
 */

import { createContext, useContext } from 'react'
import type { UseFormRuntimeReturn } from '../hooks/useFormRuntime'
import type { IComponentRegistry } from '../types/component'

// ============================================================================
// Context Types
// ============================================================================

export interface FormContextValue {
  runtime: UseFormRuntimeReturn
  registry: IComponentRegistry
  readonly: boolean
}

// ============================================================================
// Context
// ============================================================================

export const FormContext = createContext<FormContextValue | null>(null)

// ============================================================================
// Hook
// ============================================================================

export function useFormContext(): FormContextValue {
  const context = useContext(FormContext)
  if (!context) {
    throw new Error('useFormContext must be used within a FormRenderer')
  }
  return context
}

export function useFormRuntimeContext(): UseFormRuntimeReturn {
  return useFormContext().runtime
}

export function useComponentRegistry(): IComponentRegistry {
  return useFormContext().registry
}

export function useFormReadonly(): boolean {
  return useFormContext().readonly
}
