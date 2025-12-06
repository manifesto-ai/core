<script setup lang="ts">
/**
 * ColorPickerInput - 색상 선택 컴포넌트
 *
 * 네이티브 input[type="color"] 사용
 * 커스텀 UI가 필요하면 레지스트리에서 교체
 */
import { computed } from 'vue'

interface Props {
  fieldId: string
  modelValue?: string
  disabled?: boolean
  readonly?: boolean
  componentProps?: Record<string, unknown>
  hasError?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '#000000',
  disabled: false,
  readonly: false,
  hasError: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

// 값 표시 여부
const showValue = computed(() => (props.componentProps?.showValue as boolean) ?? true)
</script>

<template>
  <div
    class="input-color"
    :class="{
      'input-color--error': hasError,
      'input-color--disabled': disabled,
    }"
  >
    <input
      type="color"
      :id="fieldId"
      :value="modelValue"
      :disabled="disabled || readonly"
      class="input-color__picker"
      v-bind="componentProps"
      @input="handleInput"
      @focus="emit('focus')"
      @blur="emit('blur')"
    />
    <span v-if="showValue" class="input-color__value">
      {{ modelValue }}
    </span>
  </div>
</template>

<style>
.input-color {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.input-color__picker {
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: none;
  cursor: pointer;
}

.input-color__picker::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.input-color__picker::-webkit-color-swatch {
  border: none;
  border-radius: 0.25rem;
}

.input-color__picker::-moz-color-swatch {
  border: none;
  border-radius: 0.25rem;
}

.input-color__picker:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-color--error .input-color__picker {
  border-color: #dc2626;
}

.input-color--disabled .input-color__picker {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-color__value {
  font-size: 0.875rem;
  font-family: monospace;
  color: #374151;
  text-transform: uppercase;
}
</style>
