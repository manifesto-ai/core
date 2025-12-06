<script setup lang="ts">
/**
 * DatetimePickerInput - 날짜/시간 선택 컴포넌트
 *
 * 네이티브 input[type="datetime-local"] 사용
 * 커스텀 UI가 필요하면 레지스트리에서 교체
 */

interface Props {
  fieldId: string
  modelValue?: string
  disabled?: boolean
  readonly?: boolean
  placeholder?: string
  componentProps?: Record<string, unknown>
  hasError?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
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

// min/max 날짜 제한
const minDate = props.componentProps?.min as string | undefined
const maxDate = props.componentProps?.max as string | undefined
// step (초 단위, 기본 60 = 1분)
const step = props.componentProps?.step as number | undefined
</script>

<template>
  <input
    type="datetime-local"
    :id="fieldId"
    :value="modelValue"
    :disabled="disabled"
    :readonly="readonly"
    :min="minDate"
    :max="maxDate"
    :step="step"
    class="input-datetime"
    :class="{
      'input-datetime--error': hasError,
      'input-datetime--disabled': disabled,
    }"
    v-bind="componentProps"
    @input="handleInput"
    @focus="emit('focus')"
    @blur="emit('blur')"
  />
</template>

<style>
.input-datetime {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: #fff;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input-datetime:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-datetime--error {
  border-color: #dc2626;
}

.input-datetime--disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}
</style>
