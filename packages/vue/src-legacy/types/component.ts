/**
 * Component Types for FormRenderer
 *
 * Headless + Component Registry 패턴을 위한 타입 정의
 */

import type { Component, VNode } from 'vue'
import type { ViewSchema, ViewField, ViewSection, EntitySchema } from '@manifesto-ai/schema'
import type { EvaluationContext, FieldMeta, FormRuntimeError } from '@manifesto-ai/engine'

// ============================================================================
// Input Component Types
// ============================================================================

/**
 * 모든 입력 컴포넌트가 받는 공통 Props
 */
export interface InputComponentProps {
  /** 필드 ID */
  fieldId: string
  /** 현재 값 (v-model) */
  modelValue: unknown
  /** 비활성화 상태 */
  disabled: boolean
  /** 읽기 전용 상태 */
  readonly?: boolean
  /** placeholder 텍스트 */
  placeholder?: string
  /** 컴포넌트별 커스텀 props (스키마의 field.props) */
  componentProps?: Record<string, unknown>
  /** 에러 존재 여부 */
  hasError?: boolean
  /** select, radio, multi-select 등의 옵션 */
  options?: readonly OptionItem[]
}

/**
 * 옵션 아이템 (select, radio 등)
 */
export interface OptionItem {
  readonly value: string | number
  readonly label: string
  readonly disabled?: boolean
}

/**
 * 입력 컴포넌트 Emits
 */
export interface InputComponentEmits {
  (e: 'update:modelValue', value: unknown): void
  (e: 'focus'): void
  (e: 'blur'): void
}

// ============================================================================
// Component Registry Types
// ============================================================================

/**
 * 컴포넌트 등록 정보
 */
export interface ComponentRegistration {
  /** Vue 컴포넌트 */
  component: Component
  /** 기본 props (선택) */
  defaultProps?: Record<string, unknown>
}

/**
 * 컴포넌트 레지스트리 인터페이스
 */
export interface IComponentRegistry {
  /** 컴포넌트 등록 */
  register(type: string, registration: ComponentRegistration | Component): void
  /** 컴포넌트 조회 */
  get(type: string): ComponentRegistration | undefined
  /** 등록 여부 확인 */
  has(type: string): boolean
  /** 전체 등록된 타입 목록 */
  getTypes(): string[]
  /** 레지스트리 복제 (확장용) */
  clone(): IComponentRegistry
}

// ============================================================================
// FormRenderer Types
// ============================================================================

/**
 * FormRenderer Props
 */
export interface FormRendererProps {
  /** View 스키마 */
  schema: ViewSchema
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
  /** 디버그 모드 */
  debug?: boolean
}

/**
 * FormRenderer Emits
 */
export interface FormRendererEmits {
  (e: 'submit', data: Record<string, unknown>): void
  (e: 'change', fieldId: string, value: unknown): void
  (e: 'validate', isValid: boolean): void
  (e: 'error', error: FormRuntimeError): void
}

/**
 * FormRenderer Slots
 */
export interface FormRendererSlots {
  /** 헤더 슬롯 */
  header?: () => VNode
  /** 로딩 슬롯 */
  loading?: () => VNode
  /** 에러 슬롯 */
  error?: (props: { error: FormRuntimeError }) => VNode
  /** 푸터 슬롯 */
  footer?: (props: FormRendererFooterSlotProps) => VNode
  /** 섹션 헤더 슬롯 */
  'section-header'?: (props: { section: ViewSection }) => VNode
  /** 섹션 푸터 슬롯 */
  'section-footer'?: (props: { section: ViewSection }) => VNode
  /** 특정 필드 커스터마이징 - field-{fieldId} */
  [key: `field-${string}`]: (props: FieldSlotProps) => VNode
}

/**
 * Footer 슬롯 props
 */
export interface FormRendererFooterSlotProps {
  submit: () => void
  reset: () => void
  isValid: boolean
  isDirty: boolean
  isSubmitting: boolean
}

/**
 * Field 슬롯 props
 */
export interface FieldSlotProps {
  field: ViewField
  meta: FieldMeta | undefined
  value: unknown
  setValue: (value: unknown) => void
  errors: readonly string[]
  disabled: boolean
  hidden: boolean
}

// ============================================================================
// SectionRenderer Types
// ============================================================================

/**
 * SectionRenderer Props
 */
export interface SectionRendererProps {
  /** 섹션 정의 */
  section: ViewSection
}

// ============================================================================
// FieldRenderer Types
// ============================================================================

/**
 * FieldRenderer Props
 */
export interface FieldRendererProps {
  /** 필드 정의 */
  field: ViewField
}

// ============================================================================
// FieldWrapper Types
// ============================================================================

/**
 * FieldWrapper Props
 */
export interface FieldWrapperProps {
  /** 필드 정의 */
  field: ViewField
  /** 에러 메시지 목록 */
  errors: readonly string[]
}

// ============================================================================
// Injection Keys
// ============================================================================

import type { InjectionKey, Ref, ComputedRef } from 'vue'
import type { UseFormRuntimeReturn } from '../composables/useFormRuntime'

/** FormRuntime injection key */
export const FORM_RUNTIME_KEY: InjectionKey<UseFormRuntimeReturn> = Symbol('formRuntime')

/** ComponentRegistry injection key */
export const COMPONENT_REGISTRY_KEY: InjectionKey<ComputedRef<IComponentRegistry>> = Symbol('componentRegistry')

/** Form readonly state injection key */
export const FORM_READONLY_KEY: InjectionKey<Ref<boolean>> = Symbol('formReadonly')
