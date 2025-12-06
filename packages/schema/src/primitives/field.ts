/**
 * Field Primitives - 아토믹한 필드 빌더
 *
 * 각 필드 타입은 독립적인 원자 단위로 정의되며,
 * 체이닝을 통해 제약조건과 메타데이터를 추가할 수 있음
 */

import type { DataType, EntityField, Constraint, EnumValue, ReferenceConfig } from '../types'

// ============================================================================
// Field Builder - Fluent API
// ============================================================================

export interface FieldBuilder<T extends DataType = DataType> {
  readonly _field: EntityField
  label(label: string): FieldBuilder<T>
  description(desc: string): FieldBuilder<T>
  defaultValue(value: unknown): FieldBuilder<T>
  required(message?: string): FieldBuilder<T>
  min(value: number, message?: string): FieldBuilder<T>
  max(value: number, message?: string): FieldBuilder<T>
  pattern(regex: string, message?: string): FieldBuilder<T>
  constraint(constraint: Constraint): FieldBuilder<T>
  build(): EntityField
}

const createFieldBuilder = <T extends DataType>(field: EntityField): FieldBuilder<T> => ({
  _field: field,

  label(label: string) {
    return createFieldBuilder<T>({ ...this._field, label })
  },

  description(description: string) {
    return createFieldBuilder<T>({ ...this._field, description })
  },

  defaultValue(defaultValue: unknown) {
    return createFieldBuilder<T>({ ...this._field, defaultValue })
  },

  required(message = 'This field is required') {
    const constraint: Constraint = { type: 'required', message }
    return createFieldBuilder<T>({
      ...this._field,
      constraints: [...(this._field.constraints ?? []), constraint],
    })
  },

  min(value: number, message?: string) {
    const constraint: Constraint = {
      type: 'min',
      value,
      message: message ?? `Minimum value is ${value}`,
    }
    return createFieldBuilder<T>({
      ...this._field,
      constraints: [...(this._field.constraints ?? []), constraint],
    })
  },

  max(value: number, message?: string) {
    const constraint: Constraint = {
      type: 'max',
      value,
      message: message ?? `Maximum value is ${value}`,
    }
    return createFieldBuilder<T>({
      ...this._field,
      constraints: [...(this._field.constraints ?? []), constraint],
    })
  },

  pattern(regex: string, message?: string) {
    const constraint: Constraint = {
      type: 'pattern',
      value: regex,
      message: message ?? 'Invalid format',
    }
    return createFieldBuilder<T>({
      ...this._field,
      constraints: [...(this._field.constraints ?? []), constraint],
    })
  },

  constraint(constraint: Constraint) {
    return createFieldBuilder<T>({
      ...this._field,
      constraints: [...(this._field.constraints ?? []), constraint],
    })
  },

  build() {
    return this._field
  },
})

// ============================================================================
// Primitive Field Constructors
// ============================================================================

export const field = {
  /**
   * 문자열 필드
   */
  string(id: string, label: string): FieldBuilder<'string'> {
    return createFieldBuilder<'string'>({
      id,
      dataType: 'string',
      label,
    })
  },

  /**
   * 숫자 필드
   */
  number(id: string, label: string): FieldBuilder<'number'> {
    return createFieldBuilder<'number'>({
      id,
      dataType: 'number',
      label,
    })
  },

  /**
   * 불리언 필드
   */
  boolean(id: string, label: string): FieldBuilder<'boolean'> {
    return createFieldBuilder<'boolean'>({
      id,
      dataType: 'boolean',
      label,
    })
  },

  /**
   * 날짜 필드 (날짜만)
   */
  date(id: string, label: string): FieldBuilder<'date'> {
    return createFieldBuilder<'date'>({
      id,
      dataType: 'date',
      label,
    })
  },

  /**
   * 날짜시간 필드
   */
  datetime(id: string, label: string): FieldBuilder<'datetime'> {
    return createFieldBuilder<'datetime'>({
      id,
      dataType: 'datetime',
      label,
    })
  },

  /**
   * 열거형 필드
   */
  enum(id: string, label: string, values: readonly EnumValue[]): FieldBuilder<'enum'> {
    return createFieldBuilder<'enum'>({
      id,
      dataType: 'enum',
      label,
      enumValues: values,
    })
  },

  /**
   * 참조 필드 (관계)
   */
  reference(id: string, label: string, config: ReferenceConfig): FieldBuilder<'reference'> {
    return createFieldBuilder<'reference'>({
      id,
      dataType: 'reference',
      label,
      reference: config,
    })
  },

  /**
   * 배열 필드
   */
  array(id: string, label: string, itemType: DataType): FieldBuilder<'array'> {
    return createFieldBuilder<'array'>({
      id,
      dataType: 'array',
      label,
      arrayItemType: itemType,
    })
  },

  /**
   * 객체 필드 (중첩)
   */
  object(id: string, label: string, fields: readonly EntityField[]): FieldBuilder<'object'> {
    return createFieldBuilder<'object'>({
      id,
      dataType: 'object',
      label,
      objectFields: fields,
    })
  },
}

// ============================================================================
// Enum Value Helper
// ============================================================================

export const enumValue = (
  value: string | number,
  label: string,
  options?: { description?: string; disabled?: boolean }
): EnumValue => {
  const result: EnumValue = { value, label }
  if (options?.description !== undefined) {
    (result as { description: string }).description = options.description
  }
  if (options?.disabled !== undefined) {
    (result as { disabled: boolean }).disabled = options.disabled
  }
  return result
}

export const enumValues = (
  values: Record<string, string>
): readonly EnumValue[] =>
  Object.entries(values).map(([value, label]) => ({ value, label }))
