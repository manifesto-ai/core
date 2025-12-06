<script setup lang="ts">
/**
 * TextareaInput - 텍스트에어리어 컴포넌트
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
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}

// rows 기본값
const rows = (props.componentProps?.rows as number) ?? 3
</script>

<template>
  <textarea
    :id="fieldId"
    :value="modelValue"
    :disabled="disabled"
    :readonly="readonly"
    :placeholder="placeholder"
    :rows="rows"
    class="input-textarea"
    :class="{ 'input-textarea--error': hasError, 'input-textarea--disabled': disabled }"
    v-bind="componentProps"
    @input="handleInput"
    @focus="emit('focus')"
    @blur="emit('blur')"
  />
</template>

<style>
.input-textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: #fff;
  resize: vertical;
  transition: border-color 0.15s, box-shadow 0.15s;
  font-family: inherit;
}

.input-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-textarea--error {
  border-color: #dc2626;
}

.input-textarea--disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}
</style>
