/**
 * Component Registry
 *
 * Component type → React component mapping registry
 * Headless pattern for UI library independence
 */

import type { ComponentType } from 'react'
import type { IComponentRegistry, ComponentRegistration, InputComponentProps } from '../../types/component'

/**
 * ComponentRegistry implementation
 */
export class ComponentRegistry implements IComponentRegistry {
  private registry = new Map<string, ComponentRegistration>()

  /**
   * Register component
   * @param type Component type (e.g., 'text-input', 'select')
   * @param registration Component or registration info
   */
  register(type: string, registration: ComponentRegistration | ComponentType<InputComponentProps>): void {
    if (this.isComponent(registration)) {
      this.registry.set(type, { component: registration })
    } else {
      this.registry.set(type, registration)
    }
  }

  /**
   * Get component
   */
  get(type: string): ComponentRegistration | undefined {
    return this.registry.get(type)
  }

  /**
   * Check if registered
   */
  has(type: string): boolean {
    return this.registry.has(type)
  }

  /**
   * Get all registered types
   */
  getTypes(): string[] {
    return Array.from(this.registry.keys())
  }

  /**
   * Clone registry (for extension)
   */
  clone(): IComponentRegistry {
    const cloned = new ComponentRegistry()
    for (const [type, registration] of this.registry) {
      cloned.register(type, registration)
    }
    return cloned
  }

  /**
   * Component type guard
   */
  private isComponent(value: ComponentRegistration | ComponentType<InputComponentProps>): value is ComponentType<InputComponentProps> {
    return typeof value === 'function' || (typeof value === 'object' && !('component' in value))
  }
}

/**
 * Default registry instance (lazy initialization)
 */
let _defaultRegistry: ComponentRegistry | null = null

/**
 * Get default registry
 * Default components are registered on first call
 */
export function getDefaultRegistry(): IComponentRegistry {
  if (!_defaultRegistry) {
    _defaultRegistry = new ComponentRegistry()
    registerDefaultComponents(_defaultRegistry)
  }
  return _defaultRegistry
}

/**
 * Create new registry
 * @param includeDefaults Include default components (default: true)
 */
export function createComponentRegistry(includeDefaults = true): IComponentRegistry {
  const registry = new ComponentRegistry()
  if (includeDefaults) {
    registerDefaultComponents(registry)
  }
  return registry
}

/**
 * Register default components
 * Dynamic import for lazy loading
 */
function registerDefaultComponents(registry: ComponentRegistry): void {
  // Basic inputs (6)
  registry.register('text-input', {
    component: () => import('../inputs/TextInput'),
  })
  registry.register('number-input', {
    component: () => import('../inputs/NumberInput'),
  })
  registry.register('select', {
    component: () => import('../inputs/SelectInput'),
  })
  registry.register('checkbox', {
    component: () => import('../inputs/CheckboxInput'),
  })
  registry.register('textarea', {
    component: () => import('../inputs/TextareaInput'),
  })
  registry.register('toggle', {
    component: () => import('../inputs/ToggleInput'),
  })

  // Medium difficulty (6)
  registry.register('radio', {
    component: () => import('../inputs/RadioInput'),
  })
  registry.register('multi-select', {
    component: () => import('../inputs/MultiSelectInput'),
  })
  registry.register('date-picker', {
    component: () => import('../inputs/DatePickerInput'),
  })
  registry.register('datetime-picker', {
    component: () => import('../inputs/DatetimePickerInput'),
  })
  registry.register('slider', {
    component: () => import('../inputs/SliderInput'),
  })
  registry.register('color-picker', {
    component: () => import('../inputs/ColorPickerInput'),
  })

  // Advanced (4)
  registry.register('autocomplete', {
    component: () => import('../inputs/AutocompleteInput'),
  })
  registry.register('rich-editor', {
    component: () => import('../inputs/RichEditorInput'),
  })
  registry.register('file-upload', {
    component: () => import('../inputs/FileUploadInput'),
  })
  registry.register('image-upload', {
    component: () => import('../inputs/ImageUploadInput'),
  })

  // Custom (1)
  registry.register('custom', {
    component: () => import('../inputs/CustomInput'),
  })
}
