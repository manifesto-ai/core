<script setup lang="ts">
/**
 * SelectInput - 단일 선택 컴포넌트
 */
import type { OptionItem } from '../../types/component'

interface Props {
  fieldId: string
  modelValue?: string | number | null
  disabled?: boolean
  readonly?: boolean
  placeholder?: string
  componentProps?: Record<string, unknown>
  hasError?: boolean
  options?: readonly OptionItem[]
}

withDefaults(defineProps<Props>(), {
  modelValue: null,
  disabled: false,
  readonly: false,
  hasError: false,
  options: () => [],
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | null): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const value = target.value === '' ? null : target.value
  emit('update:modelValue', value)
}
</script>

<template>
  <select
    :id="fieldId"
    :value="modelValue ?? ''"
    :disabled="disabled || readonly"
    class="input-select"
    :class="{ 'input-select--error': hasError, 'input-select--disabled': disabled }"
    v-bind="componentProps"
    @change="handleChange"
    @focus="emit('focus')"
    @blur="emit('blur')"
  >
    <option v-if="placeholder" value="" disabled>
      {{ placeholder }}
    </option>
    <option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :disabled="option.disabled"
    >
      {{ option.label }}
    </option>
  </select>
</template>

<style>
.input-select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: #fff;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: 2.5rem;
}

.input-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-select--error {
  border-color: #dc2626;
}

.input-select--disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}
</style>
