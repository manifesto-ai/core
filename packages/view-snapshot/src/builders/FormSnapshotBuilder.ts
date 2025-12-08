/**
 * FormSnapshotBuilder
 *
 * FormRuntime + FormViewSchema => FormSnapshot 변환
 */

import type { FormRuntime, FormState } from '@manifesto-ai/engine'
import type { FormViewSchema, EntitySchema, ComponentType } from '@manifesto-ai/schema'
import type {
  FormSnapshot,
  FieldSnapshot,
  FieldType,
  FieldOption,
  ViewAction,
} from '../types'

// ============================================================================
// Type Mapping
// ============================================================================

/**
 * ComponentType -> FieldType 매핑
 */
const COMPONENT_TO_FIELD_TYPE: Record<ComponentType, FieldType> = {
  'text-input': 'text',
  'number-input': 'number',
  'select': 'select',
  'multi-select': 'multiselect',
  'checkbox': 'checkbox',
  'radio': 'radio',
  'date-picker': 'datepicker',
  'datetime-picker': 'datepicker',
  'textarea': 'textarea',
  'rich-editor': 'textarea',
  'file-upload': 'file',
  'image-upload': 'file',
  'autocomplete': 'select',
  'toggle': 'checkbox',
  'slider': 'number',
  'color-picker': 'text',
  'custom': 'text',
}

/**
 * ComponentType을 FieldType으로 변환
 */
export const mapComponentToFieldType = (component: ComponentType): FieldType => {
  return COMPONENT_TO_FIELD_TYPE[component] ?? 'text'
}

// ============================================================================
// Builder Options
// ============================================================================

export interface FormSnapshotBuilderOptions {
  /** Entity 스키마 (required 판단용) */
  entitySchema?: EntitySchema
  /** 추가 액션 */
  additionalActions?: readonly ViewAction[]
}

// ============================================================================
// Builder
// ============================================================================

/**
 * FormRuntime 상태에서 필드가 required인지 판단
 */
const isFieldRequired = (
  _fieldId: string,
  entityFieldId: string,
  entitySchema?: EntitySchema
): boolean => {
  if (!entitySchema) return false

  const entityField = entitySchema.fields.find(f => f.id === entityFieldId)
  if (!entityField?.constraints) return false

  return entityField.constraints.some(c => c.type === 'required')
}

/**
 * FormState에서 FieldSnapshot 목록 생성
 */
const buildFieldSnapshots = (
  schema: FormViewSchema,
  state: FormState,
  entitySchema?: EntitySchema
): FieldSnapshot[] => {
  const fields: FieldSnapshot[] = []

  for (const section of schema.sections) {
    // 섹션이 숨겨진 경우 스킵
    const sectionMeta = state.sections.get(section.id)
    if (sectionMeta?.hidden) continue

    for (const viewField of section.fields) {
      const meta = state.fields.get(viewField.id)
      const options = state.fieldOptions.get(viewField.id)

      // 숨겨진 필드는 포함하지 않음 (Signal over Noise)
      if (meta?.hidden) continue

      const fieldSnapshot: FieldSnapshot = {
        id: viewField.id,
        type: mapComponentToFieldType(viewField.component),
        label: viewField.label ?? viewField.id,
        value: state.values[viewField.id],
        disabled: meta?.disabled,
        required: isFieldRequired(viewField.id, viewField.entityFieldId, entitySchema),
        errors: meta?.errors && meta.errors.length > 0 ? [...meta.errors] : undefined,
        options: options?.map((o): FieldOption => ({
          value: o.value,
          label: o.label,
          disabled: o.disabled,
        })),
      }

      fields.push(fieldSnapshot)
    }
  }

  return fields
}

/**
 * 폼 액션 생성
 */
const buildFormActions = (schema: FormViewSchema): ViewAction[] => {
  const actions: ViewAction[] = []

  // 기본 폼 액션
  actions.push({
    type: 'submit',
    label: '저장',
    condition: {
      requiredFields: schema.sections
        .flatMap(s => s.fields)
        .filter(f => typeof f.hidden !== 'boolean' || !f.hidden)
        .map(f => f.id),
    },
  })

  actions.push({
    type: 'reset',
    label: '초기화',
  })

  // 스키마에 정의된 footer 액션 추가
  if (schema.footer?.actions) {
    for (const action of schema.footer.actions) {
      actions.push({
        type: action.action.type,
        label: action.label,
      })
    }
  }

  return actions
}

/**
 * FormSnapshot 빌더
 */
export const buildFormSnapshot = (
  nodeId: string,
  runtime: FormRuntime,
  schema: FormViewSchema,
  options: FormSnapshotBuilderOptions = {}
): FormSnapshot => {
  const state = runtime.getState()

  const fields = buildFieldSnapshots(schema, state, options.entitySchema)
  const actions = buildFormActions(schema)

  if (options.additionalActions) {
    actions.push(...options.additionalActions)
  }

  return {
    nodeId,
    kind: 'form',
    label: schema.name,
    fields,
    isValid: state.isValid,
    isDirty: state.isDirty,
    isSubmitting: state.isSubmitting,
    actions,
  }
}

/**
 * FormState에서 직접 FormSnapshot 빌더 (Runtime 없이)
 */
export const buildFormSnapshotFromState = (
  nodeId: string,
  state: FormState,
  schema: FormViewSchema,
  options: FormSnapshotBuilderOptions = {}
): FormSnapshot => {
  const fields = buildFieldSnapshots(schema, state, options.entitySchema)
  const actions = buildFormActions(schema)

  if (options.additionalActions) {
    actions.push(...options.additionalActions)
  }

  return {
    nodeId,
    kind: 'form',
    label: schema.name,
    fields,
    isValid: state.isValid,
    isDirty: state.isDirty,
    isSubmitting: state.isSubmitting,
    actions,
  }
}
