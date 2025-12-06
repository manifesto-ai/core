<script setup lang="ts">
/**
 * FieldRenderer - 필드 렌더러 컴포넌트
 *
 * ComponentType에 따라 적절한 입력 컴포넌트를 렌더링
 * ComponentRegistry에서 컴포넌트를 조회하여 동적으로 렌더링
 */
import { inject, computed, defineAsyncComponent, type Component } from 'vue'
import type { ViewField } from '@manifesto-ai/schema'
import type { UseFormRuntimeReturn } from '../../composables/useFormRuntime'
import {
  FORM_RUNTIME_KEY,
  COMPONENT_REGISTRY_KEY,
  FORM_READONLY_KEY,
} from '../../types/component'
import FieldWrapper from './FieldWrapper.vue'

interface Props {
  /** 필드 정의 */
  field: ViewField
}

const props = defineProps<Props>()

// Inject dependencies
const runtime = inject<UseFormRuntimeReturn>(FORM_RUNTIME_KEY)
const registryRef = inject(COMPONENT_REGISTRY_KEY)
const formReadonlyRef = inject(FORM_READONLY_KEY)

// 필드 메타 정보
const fieldMeta = computed(() => runtime?.getField(props.field.id))

// 컴포넌트 레지스트리에서 컴포넌트 조회
const InputComponent = computed<Component | null>(() => {
  if (!registryRef?.value) return null

  const registration = registryRef.value.get(props.field.component)
  if (!registration) return null

  // 동적 import인 경우 AsyncComponent로 래핑
  if (typeof registration.component === 'function') {
    return defineAsyncComponent(registration.component as () => Promise<Component>)
  }

  return registration.component as Component
})

// 현재 값 (v-model)
const modelValue = computed({
  get: () => runtime?.values[props.field.id],
  set: (value) => runtime?.setFieldValue(props.field.id, value),
})

// 비활성화 상태
const isDisabled = computed(() => {
  return fieldMeta.value?.disabled ?? false
})

// 읽기 전용
const isReadonly = computed(() => {
  return formReadonlyRef?.value ?? false
})

// 에러 목록
const errors = computed(() => {
  return runtime?.getFieldErrors(props.field.id) ?? []
})

// 필드 옵션 (select, radio 등)
const options = computed(() => {
  return runtime?.getFieldOptions(props.field.id) ?? []
})

// Grid span 스타일
const spanStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.field.colSpan) {
    style.gridColumn = `span ${props.field.colSpan}`
  }
  if (props.field.rowSpan) {
    style.gridRow = `span ${props.field.rowSpan}`
  }
  return style
})

// 이벤트 핸들러
const handleFocus = () => {
  runtime?.focusField(props.field.id)
}

const handleBlur = () => {
  runtime?.blurField(props.field.id)
}

// 필수 필드 여부 (Entity 스키마에서 확인 필요하지만 일단 label 기반)
const isRequired = computed(() => {
  // TODO: EntitySchema에서 required 확인
  return props.field.label?.includes('*') ?? false
})
</script>

<template>
  <FieldWrapper
    :field="field"
    :errors="errors"
    :required="isRequired"
    :style="spanStyle"
    class="field-renderer"
  >
    <component
      v-if="InputComponent"
      :is="InputComponent"
      v-model="modelValue"
      :field-id="field.id"
      :disabled="isDisabled"
      :readonly="isReadonly"
      :placeholder="field.placeholder"
      :component-props="field.props"
      :has-error="errors.length > 0"
      :options="options"
      @focus="handleFocus"
      @blur="handleBlur"
    />
    <div v-else class="field-renderer__unknown">
      <span>Unknown component type: {{ field.component }}</span>
    </div>
  </FieldWrapper>
</template>

<style>
.field-renderer__unknown {
  padding: 0.5rem;
  background-color: #fef2f2;
  border: 1px dashed #dc2626;
  border-radius: 0.375rem;
  color: #dc2626;
  font-size: 0.875rem;
}
</style>
