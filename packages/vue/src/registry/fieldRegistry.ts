import { FieldRendererRegistry } from '@manifesto-ai/ui'
import type { FieldRendererComponent } from '../types'
import { markRaw } from 'vue'

const registerDefaults = (registry: FieldRendererRegistry<FieldRendererComponent>): void => {
  registry.register('text-input', { lazy: () => import('../components/fields/TextField.vue') })
  registry.register('textarea', { lazy: () => import('../components/fields/TextareaField.vue') })
  registry.register('number-input', { lazy: () => import('../components/fields/NumberField.vue') })
  registry.register('checkbox', { lazy: () => import('../components/fields/CheckboxField.vue') })
  registry.register('toggle', { lazy: () => import('../components/fields/ToggleField.vue') })
  registry.register('select', { lazy: () => import('../components/fields/SelectField.vue') })
  registry.register('multi-select', { lazy: () => import('../components/fields/MultiSelectField.vue') })
  registry.register('radio', { lazy: () => import('../components/fields/RadioField.vue') })
  registry.register('date-picker', { lazy: () => import('../components/fields/DateField.vue') })
  registry.register('datetime-picker', { lazy: () => import('../components/fields/DatetimeField.vue') })
  registry.register('slider', { lazy: () => import('../components/fields/SliderField.vue') })
  registry.register('color-picker', { lazy: () => import('../components/fields/ColorField.vue') })
  registry.register('rich-editor', { lazy: () => import('../components/fields/RichTextField.vue') })
  registry.register('file-upload', { lazy: () => import('../components/fields/FileField.vue') })
  registry.register('image-upload', { lazy: () => import('../components/fields/ImageField.vue') })
  registry.register('autocomplete', { lazy: () => import('../components/fields/AutocompleteField.vue') })
  registry.register('custom', { lazy: () => import('../components/fields/CustomField.vue') })
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

export const registerComponent = (
  registry: FieldRendererRegistry<FieldRendererComponent>,
  type: string,
  component: FieldRendererComponent
) => {
  registry.register(type, markRaw(component))
}
