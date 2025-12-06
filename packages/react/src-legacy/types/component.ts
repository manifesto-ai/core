/**
 * Component Types for FormRenderer
 *
 * Headless + Component Registry pattern type definitions
 */

import type { ComponentType } from 'react'

// ============================================================================
// Input Component Types
// ============================================================================

/**
 * Common props for all input components
 */
export interface InputComponentProps {
  /** Field ID */
  fieldId: string
  /** Current value */
  value: unknown
  /** Value change handler */
  onChange: (value: unknown) => void
  /** Disabled state */
  disabled: boolean
  /** Readonly state */
  readonly?: boolean
  /** Placeholder text */
  placeholder?: string
  /** Component-specific custom props (from field.props) */
  componentProps?: Record<string, unknown>
  /** Has error */
  hasError?: boolean
  /** Options for select, radio, multi-select, etc. */
  options?: readonly OptionItem[]
  /** Focus handler */
  onFocus?: () => void
  /** Blur handler */
  onBlur?: () => void
}

/**
 * Option item (select, radio, etc.)
 */
export interface OptionItem {
  readonly value: string | number
  readonly label: string
  readonly disabled?: boolean
}

// ============================================================================
// Component Registry Types
// ============================================================================

/**
 * Component registration info
 */
export interface ComponentRegistration {
  /** React component */
  component: ComponentType<InputComponentProps> | (() => Promise<{ default: ComponentType<InputComponentProps> }>)
  /** Default props (optional) */
  defaultProps?: Record<string, unknown>
}

/**
 * Component registry interface
 */
export interface IComponentRegistry {
  /** Register component */
  register(type: string, registration: ComponentRegistration | ComponentType<InputComponentProps>): void
  /** Get component */
  get(type: string): ComponentRegistration | undefined
  /** Check if registered */
  has(type: string): boolean
  /** Get all registered types */
  getTypes(): string[]
  /** Clone registry (for extension) */
  clone(): IComponentRegistry
}

// Form component types are exported from their respective component files
// to avoid duplicate export errors. See:
// - components/form/FormRenderer.tsx
// - components/form/SectionRenderer.tsx
// - components/form/FieldRenderer.tsx
// - components/form/FieldWrapper.tsx
