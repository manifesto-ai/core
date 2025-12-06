<script setup lang="ts">
/**
 * FormRenderer - 폼 렌더러 최상위 컴포넌트
 *
 * ViewSchema를 받아 자동으로 폼 UI를 렌더링
 * useFormRuntime과 통합하여 상태 관리
 * ComponentRegistry를 통한 커스텀 컴포넌트 지원
 */
import { provide, computed, toRef, shallowRef, watch } from 'vue'
import type { FormViewSchema, EntitySchema } from '@manifesto-ai/schema'
import type { EvaluationContext, FormRuntimeError, FetchHandler, NavigateHandler, EmitHandler } from '@manifesto-ai/engine'
import { useFormRuntime } from '../../composables/useFormRuntime'
import { getDefaultRegistry } from '../registry/ComponentRegistry'
import type { IComponentRegistry } from '../../types/component'
import {
  FORM_RUNTIME_KEY,
  COMPONENT_REGISTRY_KEY,
  FORM_READONLY_KEY,
} from '../../types/component'
import SectionRenderer from './SectionRenderer.vue'
import DebugPanel from './DebugPanel.vue'

interface Props {
  /** View 스키마 */
  schema: FormViewSchema
  /** 초기값 */
  initialValues?: Record<string, unknown>
  /** 평가 컨텍스트 */
  context?: Partial<EvaluationContext>
  /** Entity 스키마 (검증용) */
  entitySchema?: EntitySchema
  /** 읽기 전용 모드 */
  readonly?: boolean
  /** 커스텀 컴포넌트 레지스트리 */
  componentRegistry?: IComponentRegistry
  /** Fetch 핸들러 (API 호출용) */
  fetchHandler?: FetchHandler
  /** Navigate 핸들러 (라우팅용) */
  navigateHandler?: NavigateHandler
  /** Emit 핸들러 (이벤트 발행용) */
  emitHandler?: EmitHandler
  /** 디버그 모드 */
  debug?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  initialValues: () => ({}),
  readonly: false,
  debug: false,
})

const emit = defineEmits<{
  (e: 'submit', data: Record<string, unknown>): void
  (e: 'change', fieldId: string, value: unknown): void
  (e: 'validate', isValid: boolean): void
  (e: 'error', error: FormRuntimeError): void
}>()

// 스키마를 shallowRef로 감싸서 useFormRuntime에 전달
const schemaRef = shallowRef<FormViewSchema>(props.schema)

// Props 변경 감지
watch(() => props.schema, (newSchema) => {
  schemaRef.value = newSchema
})

// 런타임 초기화
const runtime = useFormRuntime(schemaRef, {
  initialValues: props.initialValues,
  context: props.context,
  entitySchema: props.entitySchema,
  fetchHandler: props.fetchHandler,
  navigateHandler: props.navigateHandler,
  emitHandler: props.emitHandler,
  debug: props.debug,
})

// 레지스트리 결정 (prop 우선, 없으면 기본)
const registry = computed(() => props.componentRegistry ?? getDefaultRegistry())

// Provide to child components
provide(FORM_RUNTIME_KEY, runtime)
provide(COMPONENT_REGISTRY_KEY, registry)
provide(FORM_READONLY_KEY, toRef(() => props.readonly))

// 섹션 목록 (visible 필터링은 SectionRenderer에서 처리)
const sections = computed(() => props.schema.sections ?? [])

// Submit 핸들러
const handleSubmit = async () => {
  runtime.validateAll()

  emit('validate', runtime.isValid.value)

  if (!runtime.isValid.value) {
    return
  }

  const data = await runtime.submit()
  if (data) {
    emit('submit', data)
  }
}

// Reset 핸들러
const handleReset = () => {
  runtime.reset()
}

// 에러 감지 및 emit
watch(
  () => runtime.error.value,
  (error) => {
    if (error) {
      emit('error', error)
    }
  }
)

// 값 변경 감지 및 emit
watch(
  () => runtime.values,
  (values, oldValues) => {
    if (!oldValues) return
    for (const key of Object.keys(values)) {
      if (values[key] !== oldValues[key]) {
        emit('change', key, values[key])
      }
    }
  },
  { deep: true }
)

// Expose to parent component
defineExpose({
  /** 런타임 인스턴스 */
  runtime,
  /** 폼 제출 */
  submit: handleSubmit,
  /** 폼 리셋 */
  reset: handleReset,
  /** 전체 검증 */
  validate: runtime.validateAll,
  /** 폼 값들 */
  values: runtime.values,
  /** 유효성 상태 */
  isValid: runtime.isValid,
  /** 변경 상태 */
  isDirty: runtime.isDirty,
})
</script>

<template>
  <form
    class="form-renderer"
    :class="{
      'form-renderer--readonly': readonly,
      'form-renderer--loading': !runtime.isInitialized.value,
      'form-renderer--error': runtime.error.value,
    }"
    @submit.prevent="handleSubmit"
  >
    <!-- Header Slot -->
    <header v-if="$slots.header" class="form-renderer__header">
      <slot name="header" />
    </header>

    <!-- Loading State -->
    <div v-if="!runtime.isInitialized.value" class="form-renderer__loading">
      <slot name="loading">
        <span>Loading...</span>
      </slot>
    </div>

    <!-- Error State -->
    <div v-else-if="runtime.error.value" class="form-renderer__error">
      <slot name="error" :error="runtime.error.value">
        <span class="form-renderer__error-message">
          {{ 'message' in runtime.error.value ? runtime.error.value.message : runtime.error.value.type }}
        </span>
      </slot>
    </div>

    <!-- Form Content -->
    <div v-else class="form-renderer__content">
      <SectionRenderer
        v-for="section in sections"
        :key="section.id"
        :section="section"
      >
        <!-- Section Header Slot 전달 -->
        <template #header>
          <slot :name="`section-${section.id}-header`" :section="section" />
        </template>

        <!-- Section Footer Slot 전달 -->
        <template #footer>
          <slot :name="`section-${section.id}-footer`" :section="section" />
        </template>

        <!-- Field Slots 전달 -->
        <template
          v-for="field in section.fields"
          :key="`slot-${field.id}`"
          #[`field-${field.id}`]
        >
          <slot
            :name="`field-${field.id}`"
            :field="field"
            :meta="runtime.getField(field.id)"
            :value="runtime.values[field.id]"
            :set-value="(v: unknown) => runtime.setFieldValue(field.id, v)"
            :errors="runtime.getFieldErrors(field.id)"
            :disabled="runtime.isFieldDisabled(field.id)"
            :hidden="runtime.isFieldHidden(field.id)"
          >
            <!-- 기본 렌더링은 SectionRenderer에서 처리 -->
          </slot>
        </template>
      </SectionRenderer>
    </div>

    <!-- Footer Slot -->
    <footer v-if="$slots.footer" class="form-renderer__footer">
      <slot
        name="footer"
        :submit="handleSubmit"
        :reset="handleReset"
        :is-valid="runtime.isValid.value"
        :is-dirty="runtime.isDirty.value"
        :is-submitting="runtime.isSubmitting.value"
      />
    </footer>

    <!-- Debug Panel -->
    <DebugPanel
      v-if="debug && runtime.isInitialized.value"
      :runtime="runtime"
      :schema="schema"
    />
  </form>
</template>

<style>
.form-renderer {
  /* 기본 스타일 */
}

.form-renderer__header {
  margin-bottom: 1.5rem;
}

.form-renderer__loading {
  padding: 2rem;
  text-align: center;
  color: #6b7280;
}

.form-renderer__error {
  padding: 1rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  color: #dc2626;
}

.form-renderer__error-message {
  font-size: 0.875rem;
}

.form-renderer__content {
  /* Sections container */
}

.form-renderer__footer {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}
</style>
