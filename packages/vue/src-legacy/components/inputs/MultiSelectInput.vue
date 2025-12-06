<script setup lang="ts">
/**
 * MultiSelectInput - 다중 선택 컴포넌트
 */
import { ref, computed } from 'vue'
import type { OptionItem } from '../../types/component'

interface Props {
  fieldId: string
  modelValue?: (string | number)[]
  disabled?: boolean
  readonly?: boolean
  placeholder?: string
  componentProps?: Record<string, unknown>
  hasError?: boolean
  options?: readonly OptionItem[]
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  disabled: false,
  readonly: false,
  hasError: false,
  options: () => [],
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: (string | number)[]): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const isOpen = ref(false)
const searchQuery = ref('')

const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options
  const query = searchQuery.value.toLowerCase()
  return props.options.filter((opt) =>
    opt.label.toLowerCase().includes(query)
  )
})

const selectedLabels = computed(() => {
  return props.options
    .filter((opt) => props.modelValue?.includes(opt.value))
    .map((opt) => opt.label)
})

const toggleOption = (value: string | number) => {
  if (props.disabled || props.readonly) return

  const current = props.modelValue ?? []
  const index = current.indexOf(value)

  if (index === -1) {
    emit('update:modelValue', [...current, value])
  } else {
    emit('update:modelValue', current.filter((v) => v !== value))
  }
}

const removeTag = (value: string | number) => {
  if (props.disabled || props.readonly) return
  emit('update:modelValue', (props.modelValue ?? []).filter((v) => v !== value))
}

const handleFocus = () => {
  isOpen.value = true
  emit('focus')
}

const handleBlur = (event: FocusEvent) => {
  // 드롭다운 내부로 포커스가 이동하면 닫지 않음
  const relatedTarget = event.relatedTarget as HTMLElement
  if (relatedTarget?.closest('.input-multiselect__dropdown')) {
    return
  }
  isOpen.value = false
  searchQuery.value = ''
  emit('blur')
}

const isSelected = (value: string | number) => {
  return props.modelValue?.includes(value) ?? false
}
</script>

<template>
  <div
    class="input-multiselect"
    :class="{
      'input-multiselect--open': isOpen,
      'input-multiselect--error': hasError,
      'input-multiselect--disabled': disabled,
    }"
  >
    <!-- Selected Tags -->
    <div class="input-multiselect__control" @click="handleFocus">
      <div class="input-multiselect__tags">
        <span
          v-for="(label, index) in selectedLabels"
          :key="index"
          class="input-multiselect__tag"
        >
          {{ label }}
          <button
            type="button"
            class="input-multiselect__tag-remove"
            :disabled="disabled || readonly"
            @click.stop="() => { const v = modelValue?.[index]; if (v !== undefined) removeTag(v) }"
          >
            ×
          </button>
        </span>
        <input
          :id="fieldId"
          v-model="searchQuery"
          type="text"
          class="input-multiselect__input"
          :placeholder="selectedLabels.length === 0 ? placeholder : ''"
          :disabled="disabled || readonly"
          @focus="handleFocus"
          @blur="handleBlur"
        />
      </div>
      <span class="input-multiselect__arrow">▼</span>
    </div>

    <!-- Dropdown -->
    <div v-show="isOpen" class="input-multiselect__dropdown" tabindex="-1">
      <div
        v-if="filteredOptions.length === 0"
        class="input-multiselect__no-options"
      >
        No options available
      </div>
      <div
        v-for="option in filteredOptions"
        :key="option.value"
        class="input-multiselect__option"
        :class="{
          'input-multiselect__option--selected': isSelected(option.value),
          'input-multiselect__option--disabled': option.disabled,
        }"
        @mousedown.prevent="toggleOption(option.value)"
      >
        <span class="input-multiselect__checkbox">
          {{ isSelected(option.value) ? '☑' : '☐' }}
        </span>
        {{ option.label }}
      </div>
    </div>
  </div>
</template>

<style>
.input-multiselect {
  position: relative;
  width: 100%;
}

.input-multiselect__control {
  display: flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: #fff;
  cursor: pointer;
}

.input-multiselect--error .input-multiselect__control {
  border-color: #dc2626;
}

.input-multiselect--disabled .input-multiselect__control {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

.input-multiselect__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  flex: 1;
}

.input-multiselect__tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  background-color: #e5e7eb;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.input-multiselect__tag-remove {
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  color: #6b7280;
}

.input-multiselect__tag-remove:hover {
  color: #dc2626;
}

.input-multiselect__input {
  flex: 1;
  min-width: 60px;
  padding: 0.25rem;
  border: none;
  outline: none;
  font-size: 1rem;
  background: transparent;
}

.input-multiselect__arrow {
  font-size: 0.625rem;
  color: #6b7280;
  transition: transform 0.2s;
}

.input-multiselect--open .input-multiselect__arrow {
  transform: rotate(180deg);
}

.input-multiselect__dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 50;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 0.25rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: #fff;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.input-multiselect__option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
}

.input-multiselect__option:hover {
  background-color: #f3f4f6;
}

.input-multiselect__option--selected {
  background-color: #eff6ff;
}

.input-multiselect__option--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-multiselect__checkbox {
  font-size: 1rem;
  color: #3b82f6;
}

.input-multiselect__no-options {
  padding: 0.75rem;
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
}
</style>
