<script setup lang="ts">
/**
 * TextInput - 텍스트 입력 컴포넌트
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

withDefaults(defineProps<Props>(), {
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
</script>

<template>
  <input
    type="text"
    :id="fieldId"
    :value="modelValue"
    :disabled="disabled"
    :readonly="readonly"
    :placeholder="placeholder"
    class="input-text"
    :class="{ 'input-text--error': hasError, 'input-text--disabled': disabled }"
    v-bind="componentProps"
    @input="handleInput"
    @focus="emit('focus')"
    @blur="emit('blur')"
  />
</template>

<style>
.input-text {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: #fff;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input-text:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-text--error {
  border-color: #dc2626;
}

.input-text--error:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}

.input-text--disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}
</style>
