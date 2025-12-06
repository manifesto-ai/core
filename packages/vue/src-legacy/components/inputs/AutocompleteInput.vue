<script setup lang="ts">
/**
 * AutocompleteInput - 자동완성 입력 컴포넌트
 *
 * 검색어 기반 옵션 필터링 및 선택
 */
import { ref, computed, watch } from 'vue'
import type { OptionItem } from '../../types/component'

interface Props {
  fieldId: string
  modelValue?: string | number
  disabled?: boolean
  readonly?: boolean
  placeholder?: string
  componentProps?: Record<string, unknown>
  hasError?: boolean
  options?: readonly OptionItem[]
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  readonly: false,
  hasError: false,
  options: () => [],
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | undefined): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const isOpen = ref(false)
const inputValue = ref('')
const highlightIndex = ref(-1)

// 선택된 값의 라벨 찾기
const selectedLabel = computed(() => {
  const selected = props.options.find((opt) => opt.value === props.modelValue)
  return selected?.label ?? ''
})

// 입력값 초기화
watch(
  () => props.modelValue,
  () => {
    inputValue.value = selectedLabel.value
  },
  { immediate: true }
)

// 필터링된 옵션
const filteredOptions = computed(() => {
  if (!inputValue.value) return props.options
  const query = inputValue.value.toLowerCase()
  return props.options.filter((opt) =>
    opt.label.toLowerCase().includes(query)
  )
})

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  inputValue.value = target.value
  isOpen.value = true
  highlightIndex.value = 0
}

const selectOption = (option: OptionItem) => {
  if (option.disabled) return
  inputValue.value = option.label
  emit('update:modelValue', option.value)
  isOpen.value = false
}

const handleFocus = () => {
  isOpen.value = true
  emit('focus')
}

const handleBlur = (event: FocusEvent) => {
  const relatedTarget = event.relatedTarget as HTMLElement
  if (relatedTarget?.closest('.input-autocomplete__dropdown')) {
    return
  }
  isOpen.value = false
  // 선택된 값이 없으면 입력 초기화
  if (!props.options.some((opt) => opt.label === inputValue.value)) {
    inputValue.value = selectedLabel.value
  }
  emit('blur')
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!isOpen.value) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      isOpen.value = true
      event.preventDefault()
    }
    return
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      highlightIndex.value = Math.min(
        highlightIndex.value + 1,
        filteredOptions.value.length - 1
      )
      break
    case 'ArrowUp':
      event.preventDefault()
      highlightIndex.value = Math.max(highlightIndex.value - 1, 0)
      break
    case 'Enter':
      event.preventDefault()
      const option = filteredOptions.value[highlightIndex.value]
      if (highlightIndex.value >= 0 && option) {
        selectOption(option)
      }
      break
    case 'Escape':
      isOpen.value = false
      break
  }
}

const clearValue = () => {
  inputValue.value = ''
  emit('update:modelValue', undefined)
}
</script>

<template>
  <div
    class="input-autocomplete"
    :class="{
      'input-autocomplete--open': isOpen,
      'input-autocomplete--error': hasError,
      'input-autocomplete--disabled': disabled,
    }"
  >
    <div class="input-autocomplete__control">
      <input
        type="text"
        :id="fieldId"
        :value="inputValue"
        :disabled="disabled"
        :readonly="readonly"
        :placeholder="placeholder"
        class="input-autocomplete__input"
        autocomplete="off"
        v-bind="componentProps"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
      />
      <button
        v-if="modelValue && !disabled && !readonly"
        type="button"
        class="input-autocomplete__clear"
        tabindex="-1"
        @mousedown.prevent="clearValue"
      >
        ×
      </button>
    </div>

    <div v-show="isOpen && filteredOptions.length > 0" class="input-autocomplete__dropdown">
      <div
        v-for="(option, index) in filteredOptions"
        :key="option.value"
        class="input-autocomplete__option"
        :class="{
          'input-autocomplete__option--highlighted': index === highlightIndex,
          'input-autocomplete__option--selected': option.value === modelValue,
          'input-autocomplete__option--disabled': option.disabled,
        }"
        @mousedown.prevent="selectOption(option)"
        @mouseover="highlightIndex = index"
      >
        {{ option.label }}
      </div>
    </div>

    <div
      v-show="isOpen && inputValue && filteredOptions.length === 0"
      class="input-autocomplete__dropdown"
    >
      <div class="input-autocomplete__no-results">
        No results found
      </div>
    </div>
  </div>
</template>

<style>
.input-autocomplete {
  position: relative;
  width: 100%;
}

.input-autocomplete__control {
  position: relative;
  display: flex;
  align-items: center;
}

.input-autocomplete__input {
  width: 100%;
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: #fff;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input-autocomplete__input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-autocomplete--error .input-autocomplete__input {
  border-color: #dc2626;
}

.input-autocomplete--disabled .input-autocomplete__input {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

.input-autocomplete__clear {
  position: absolute;
  right: 0.5rem;
  padding: 0.25rem;
  border: none;
  background: none;
  font-size: 1.25rem;
  line-height: 1;
  color: #6b7280;
  cursor: pointer;
}

.input-autocomplete__clear:hover {
  color: #374151;
}

.input-autocomplete__dropdown {
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

.input-autocomplete__option {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
}

.input-autocomplete__option:hover,
.input-autocomplete__option--highlighted {
  background-color: #f3f4f6;
}

.input-autocomplete__option--selected {
  background-color: #eff6ff;
  font-weight: 500;
}

.input-autocomplete__option--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-autocomplete__no-results {
  padding: 0.75rem;
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
}
</style>
