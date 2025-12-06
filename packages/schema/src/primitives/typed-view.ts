/**
 * Typed View Builder
 *
 * Form state 타입(TSchema)을 주입하여
 * - 필드 ID 오타 방지
 * - entityFieldId 자동 매핑
 * - 액션 대상/값 타입 검증
 * 을 지원하는 View 필드/액션 팩토리.
 */

import type { DataSource, Expression, ReactionAction } from '../types'
import type { ViewFieldBuilder } from './view'
import { viewField, actions } from './view'

type FieldKey<T> = keyof T & string
type KeysMatching<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T]

interface TypedFieldFactory {
  textInput(label?: string): ViewFieldBuilder
  numberInput(label?: string): ViewFieldBuilder
  select(label?: string): ViewFieldBuilder
  multiSelect(label?: string): ViewFieldBuilder
  checkbox(label?: string): ViewFieldBuilder
  radio(label?: string): ViewFieldBuilder
  datePicker(label?: string): ViewFieldBuilder
  datetimePicker(label?: string): ViewFieldBuilder
  textarea(label?: string): ViewFieldBuilder
  richEditor(label?: string): ViewFieldBuilder
  fileUpload(label?: string): ViewFieldBuilder
  imageUpload(label?: string): ViewFieldBuilder
  autocomplete(label?: string): ViewFieldBuilder
  toggle(label?: string): ViewFieldBuilder
  slider(label?: string): ViewFieldBuilder
  colorPicker(label?: string): ViewFieldBuilder
  custom(component: string, label?: string): ViewFieldBuilder
}

export interface TypedActions<TSchema> {
  setValue<K extends FieldKey<TSchema>>(
    field: K,
    value: TSchema[K] | Expression | DataSource | unknown
  ): ReactionAction
  setOptions<K extends FieldKey<TSchema>>(field: K, source: DataSource): ReactionAction
  updateProp<K extends FieldKey<TSchema>>(
    field: K,
    prop: 'hidden' | 'disabled' | 'readonly',
    value: boolean | Expression
  ): ReactionAction
  toggle<K extends KeysMatching<TSchema, boolean>>(field: K): ReactionAction
}

const withOptionalLabel = (builder: ViewFieldBuilder, label?: string): ViewFieldBuilder =>
  label ? builder.label(label) : builder

export const createTypedView = <TSchema>() => {
  const buildField = (id: string, entityFieldId?: string): TypedFieldFactory => {
    const entityId = entityFieldId ?? id
    return {
      textInput(label) {
        return withOptionalLabel(viewField.textInput(id, entityId), label)
      },
      numberInput(label) {
        return withOptionalLabel(viewField.numberInput(id, entityId), label)
      },
      select(label) {
        return withOptionalLabel(viewField.select(id, entityId), label)
      },
      multiSelect(label) {
        return withOptionalLabel(viewField.multiSelect(id, entityId), label)
      },
      checkbox(label) {
        return withOptionalLabel(viewField.checkbox(id, entityId), label)
      },
      radio(label) {
        return withOptionalLabel(viewField.radio(id, entityId), label)
      },
      datePicker(label) {
        return withOptionalLabel(viewField.datePicker(id, entityId), label)
      },
      datetimePicker(label) {
        return withOptionalLabel(viewField.datetimePicker(id, entityId), label)
      },
      textarea(label) {
        return withOptionalLabel(viewField.textarea(id, entityId), label)
      },
      richEditor(label) {
        return withOptionalLabel(viewField.richEditor(id, entityId), label)
      },
      fileUpload(label) {
        return withOptionalLabel(viewField.fileUpload(id, entityId), label)
      },
      imageUpload(label) {
        return withOptionalLabel(viewField.imageUpload(id, entityId), label)
      },
      autocomplete(label) {
        return withOptionalLabel(viewField.autocomplete(id, entityId), label)
      },
      toggle(label) {
        return withOptionalLabel(viewField.toggle(id, entityId), label)
      },
      slider(label) {
        return withOptionalLabel(viewField.slider(id, entityId), label)
      },
      colorPicker(label) {
        return withOptionalLabel(viewField.colorPicker(id, entityId), label)
      },
      custom(component, label) {
        return withOptionalLabel(viewField.custom(id, entityId, component), label)
      },
    }
  }

  const typedActions: TypedActions<TSchema> = {
    setValue(field, value) {
      return actions.setValue(String(field), value as Expression)
    },
    setOptions(field, source) {
      return actions.setOptions(String(field), source)
    },
    updateProp(field, prop, value) {
      return actions.updateProp(String(field), prop, value as Expression)
    },
    toggle(field) {
      return actions.setValue(String(field), ['NOT', `$state.${String(field)}`])
    },
  }

  return {
    field<K extends FieldKey<TSchema>>(id: K, entityFieldId?: string): TypedFieldFactory {
      return buildField(String(id), entityFieldId)
    },
    actions: typedActions,
  }
}

export type { TypedFieldFactory }
