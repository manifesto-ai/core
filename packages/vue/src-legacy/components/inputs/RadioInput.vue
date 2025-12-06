<script setup lang="ts">
/**
 * RadioInput - 라디오 버튼 그룹 컴포넌트
 */
import type { OptionItem } from '../../types/component'

interface Props {
  fieldId: string
  modelValue?: string | number
  disabled?: boolean
  readonly?: boolean
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
  (e: 'update:modelValue', value: string | number): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const handleChange = (value: string | number) => {
  if (!props.disabled && !props.readonly) {
    emit('update:modelValue', value)
  }
}

// 레이아웃 방향 (horizontal | vertical)
const direction = (props.componentProps?.direction as string) ?? 'vertical'
</script>

<template>
  <div
    class="input-radio-group"
    :class="{
      'input-radio-group--horizontal': direction === 'horizontal',
      'input-radio-group--error': hasError,
      'input-radio-group--disabled': disabled,
    }"
    role="radiogroup"
    :aria-labelledby="`${fieldId}-label`"
  >
    <label
      v-for="option in options"
      :key="option.value"
      class="input-radio"
      :class="{
        'input-radio--checked': modelValue === option.value,
        'input-radio--disabled': disabled || option.disabled,
      }"
    >
      <input
        type="radio"
        :name="fieldId"
        :value="option.value"
        :checked="modelValue === option.value"
        :disabled="disabled || readonly || option.disabled"
        class="input-radio__input"
        @change="handleChange(option.value)"
        @focus="emit('focus')"
        @blur="emit('blur')"
      />
      <span class="input-radio__indicator" />
      <span class="input-radio__label">{{ option.label }}</span>
    </label>
  </div>
</template>

<style>
.input-radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-radio-group--horizontal {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 1rem;
}

.input-radio {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.input-radio--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.input-radio__input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.input-radio__indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid #d1d5db;
  border-radius: 50%;
  background-color: #fff;
  transition: border-color 0.15s, background-color 0.15s;
}

.input-radio__input:focus + .input-radio__indicator {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-radio--checked .input-radio__indicator {
  border-color: #3b82f6;
}

.input-radio--checked .input-radio__indicator::after {
  content: '';
  width: 0.5rem;
  height: 0.5rem;
  background-color: #3b82f6;
  border-radius: 50%;
}

.input-radio-group--error .input-radio__indicator {
  border-color: #dc2626;
}

.input-radio-group--error .input-radio--checked .input-radio__indicator {
  border-color: #dc2626;
}

.input-radio-group--error .input-radio--checked .input-radio__indicator::after {
  background-color: #dc2626;
}

.input-radio__label {
  font-size: 0.875rem;
  color: #374151;
}
</style>
