<script setup lang="ts">
/**
 * FieldWrapper - 필드 래퍼 컴포넌트
 *
 * Label, HelpText, Errors를 포함하는 필드 래퍼
 * Headless 설계로 스타일링은 외부에서 제어
 */
import type { ViewField } from '@manifesto-ai/schema'

interface Props {
  /** 필드 정의 */
  field: ViewField
  /** 에러 메시지 목록 */
  errors: readonly string[]
  /** 필수 필드 표시 */
  required?: boolean
}

withDefaults(defineProps<Props>(), {
  required: false,
})
</script>

<template>
  <div
    class="field-wrapper"
    :class="{
      'field-wrapper--has-error': errors.length > 0,
      'field-wrapper--required': required,
    }"
    :data-field-id="field.id"
  >
    <!-- Label -->
    <label
      v-if="field.label"
      :for="field.id"
      class="field-wrapper__label"
    >
      {{ field.label }}
      <span v-if="required" class="field-wrapper__required">*</span>
    </label>

    <!-- Input (slot) -->
    <div class="field-wrapper__input">
      <slot />
    </div>

    <!-- Help Text (에러 없을 때만 표시) -->
    <p
      v-if="field.helpText && errors.length === 0"
      class="field-wrapper__help"
    >
      {{ field.helpText }}
    </p>

    <!-- Errors -->
    <ul v-if="errors.length > 0" class="field-wrapper__errors">
      <li
        v-for="(error, idx) in errors"
        :key="idx"
        class="field-wrapper__error"
      >
        {{ error }}
      </li>
    </ul>
  </div>
</template>

<style>
/* 기본 스타일 - Headless로 최소한만 제공 */
.field-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-wrapper__label {
  font-weight: 500;
  font-size: 0.875rem;
}

.field-wrapper__required {
  color: #dc2626;
  margin-left: 0.125rem;
}

.field-wrapper__input {
  width: 100%;
}

.field-wrapper__help {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0;
}

.field-wrapper__errors {
  list-style: none;
  padding: 0;
  margin: 0;
}

.field-wrapper__error {
  font-size: 0.75rem;
  color: #dc2626;
}
</style>
