import { FieldRendererRegistry } from '@manifesto-ai/ui'
import type { FieldRendererComponent } from '../types'

const registerDefaults = (registry: FieldRendererRegistry<FieldRendererComponent>): void => {
  registry.register('text-input', { lazy: () => import('../components/fields/TextField') })
  registry.register('textarea', { lazy: () => import('../components/fields/TextareaField') })
  registry.register('number-input', { lazy: () => import('../components/fields/NumberField') })
  registry.register('checkbox', { lazy: () => import('../components/fields/CheckboxField') })
  registry.register('toggle', { lazy: () => import('../components/fields/ToggleField') })
  registry.register('select', { lazy: () => import('../components/fields/SelectField') })
  registry.register('multi-select', { lazy: () => import('../components/fields/MultiSelectField') })
  registry.register('radio', { lazy: () => import('../components/fields/RadioField') })
  registry.register('date-picker', { lazy: () => import('../components/fields/DateField') })
  registry.register('datetime-picker', { lazy: () => import('../components/fields/DatetimeField') })
  registry.register('slider', { lazy: () => import('../components/fields/SliderField') })
  registry.register('color-picker', { lazy: () => import('../components/fields/ColorField') })
  registry.register('rich-editor', { lazy: () => import('../components/fields/RichTextField') })
  registry.register('file-upload', { lazy: () => import('../components/fields/FileField') })
  registry.register('image-upload', { lazy: () => import('../components/fields/ImageField') })
  registry.register('autocomplete', { lazy: () => import('../components/fields/AutocompleteField') })
  registry.register('custom', { lazy: () => import('../components/fields/CustomField') })
}

let _defaultRegistry: FieldRendererRegistry<FieldRendererComponent> | null = null

export const getDefaultFieldRegistry = (): FieldRendererRegistry<FieldRendererComponent> => {
  if (!_defaultRegistry) {
    _defaultRegistry = new FieldRendererRegistry<FieldRendererComponent>()
    registerDefaults(_defaultRegistry)
  }
  return _defaultRegistry
}

export const createFieldRegistry = (
  includeDefaults = true
): FieldRendererRegistry<FieldRendererComponent> => {
  const registry = new FieldRendererRegistry<FieldRendererComponent>()
  if (includeDefaults) {
    registerDefaults(registry)
  }
  return registry
}
