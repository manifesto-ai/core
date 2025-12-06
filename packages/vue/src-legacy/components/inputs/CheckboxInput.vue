<script setup lang="ts">
/**
 * CheckboxInput - 체크박스 컴포넌트
 */

interface Props {
  fieldId: string
  modelValue?: boolean
  disabled?: boolean
  readonly?: boolean
  componentProps?: Record<string, unknown>
  hasError?: boolean
}

withDefaults(defineProps<Props>(), {
  modelValue: false,
  disabled: false,
  readonly: false,
  hasError: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const handleChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}
</script>

<template>
  <input
    type="checkbox"
    :id="fieldId"
    :checked="modelValue"
    :disabled="disabled || readonly"
    class="input-checkbox"
    :class="{ 'input-checkbox--error': hasError, 'input-checkbox--disabled': disabled }"
    v-bind="componentProps"
    @change="handleChange"
    @focus="emit('focus')"
    @blur="emit('blur')"
  />
</template>

<style>
.input-checkbox {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  accent-color: #3b82f6;
}

.input-checkbox:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-checkbox--error {
  border-color: #dc2626;
}

.input-checkbox--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
