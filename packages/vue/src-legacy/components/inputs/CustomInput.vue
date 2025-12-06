<script setup lang="ts">
/**
 * CustomInput - 커스텀 렌더링을 위한 Fallback 컴포넌트
 *
 * 등록되지 않은 ComponentType이나 완전 커스텀 렌더링이 필요할 때 사용
 * 기본적으로 텍스트 입력처럼 동작
 */

interface Props {
  fieldId: string
  modelValue?: unknown
  disabled?: boolean
  readonly?: boolean
  placeholder?: string
  componentProps?: Record<string, unknown>
  hasError?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  readonly: false,
  hasError: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

// 표시할 값 (문자열로 변환)
const displayValue = String(props.modelValue ?? '')
</script>

<template>
  <div
    class="input-custom"
    :class="{
      'input-custom--error': hasError,
      'input-custom--disabled': disabled,
    }"
  >
    <!-- 기본 렌더링: 텍스트 입력 -->
    <input
      type="text"
      :id="fieldId"
      :value="displayValue"
      :disabled="disabled"
      :readonly="readonly"
      :placeholder="placeholder"
      class="input-custom__input"
      v-bind="componentProps"
      @input="handleInput"
      @focus="emit('focus')"
      @blur="emit('blur')"
    />

    <!-- 개발 모드 안내 -->
    <p class="input-custom__hint">
      This is a custom field. Register a component for specialized rendering.
    </p>
  </div>
</template>

<style>
.input-custom {
  width: 100%;
}

.input-custom__input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: #fff;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input-custom__input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-custom--error .input-custom__input {
  border-color: #dc2626;
}

.input-custom--disabled .input-custom__input {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

.input-custom__hint {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: #9ca3af;
  font-style: italic;
}
</style>
