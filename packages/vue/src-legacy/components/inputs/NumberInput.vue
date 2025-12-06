<script setup lang="ts">
/**
 * NumberInput - 숫자 입력 컴포넌트
 */

interface Props {
  fieldId: string
  modelValue?: number | null
  disabled?: boolean
  readonly?: boolean
  placeholder?: string
  componentProps?: Record<string, unknown>
  hasError?: boolean
}

withDefaults(defineProps<Props>(), {
  modelValue: null,
  disabled: false,
  readonly: false,
  hasError: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | null): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const value = target.value === '' ? null : parseFloat(target.value)
  emit('update:modelValue', isNaN(value as number) ? null : value)
}
</script>

<template>
  <input
    type="number"
    :id="fieldId"
    :value="modelValue ?? ''"
    :disabled="disabled"
    :readonly="readonly"
    :placeholder="placeholder"
    class="input-number"
    :class="{ 'input-number--error': hasError, 'input-number--disabled': disabled }"
    v-bind="componentProps"
    @input="handleInput"
    @focus="emit('focus')"
    @blur="emit('blur')"
  />
</template>

<style>
.input-number {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: #fff;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input-number:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-number--error {
  border-color: #dc2626;
}

.input-number--disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

/* Hide spinner buttons */
.input-number::-webkit-outer-spin-button,
.input-number::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.input-number[type=number] {
  -moz-appearance: textfield;
}
</style>
