<script setup lang="ts">
/**
 * ToggleInput - 토글 스위치 컴포넌트
 */

interface Props {
  fieldId: string
  modelValue?: boolean
  disabled?: boolean
  readonly?: boolean
  componentProps?: Record<string, unknown>
  hasError?: boolean
}

const props = withDefaults(defineProps<Props>(), {
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

const toggle = () => {
  if (!props.disabled && !props.readonly) {
    emit('update:modelValue', !props.modelValue)
  }
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :id="fieldId"
    :aria-checked="modelValue"
    :disabled="disabled || readonly"
    class="input-toggle"
    :class="{
      'input-toggle--on': modelValue,
      'input-toggle--error': hasError,
      'input-toggle--disabled': disabled,
    }"
    v-bind="componentProps"
    @click="toggle"
    @focus="emit('focus')"
    @blur="emit('blur')"
  >
    <span class="input-toggle__thumb" />
  </button>
</template>

<style>
.input-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 2.75rem;
  height: 1.5rem;
  padding: 0;
  border: none;
  border-radius: 9999px;
  background-color: #d1d5db;
  cursor: pointer;
  transition: background-color 0.2s;
}

.input-toggle:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-toggle--on {
  background-color: #3b82f6;
}

.input-toggle--error {
  background-color: #fca5a5;
}

.input-toggle--error.input-toggle--on {
  background-color: #dc2626;
}

.input-toggle--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-toggle__thumb {
  position: absolute;
  left: 0.125rem;
  width: 1.25rem;
  height: 1.25rem;
  background-color: #fff;
  border-radius: 9999px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.input-toggle--on .input-toggle__thumb {
  transform: translateX(1.25rem);
}
</style>
