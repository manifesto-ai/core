/**
 * Type Compatibility Matrix
 *
 * DataType 전환 시 호환성 판단 및 권장 컴포넌트 제안
 */

import type { DataType, ComponentType, ColumnType } from '../../types'
import type { TypeCompatibility, CompatibilityLevel } from '../types'

// ============================================================================
// Compatibility Matrix
// ============================================================================

type CompatibilityEntry = {
  readonly level: CompatibilityLevel
  readonly suggestedComponent?: ComponentType
  readonly suggestedColumnType?: ColumnType
  readonly warning?: string
}

/**
 * DataType 전환 호환성 매트릭스
 *
 * 행: oldType, 열: newType
 */
const COMPATIBILITY_MATRIX: Record<DataType, Record<DataType, CompatibilityEntry>> = {
  string: {
    string: { level: 'compatible' },
    number: {
      level: 'requires-component-change',
      suggestedComponent: 'number-input',
      suggestedColumnType: 'number',
      warning: 'String values may not parse to numbers',
    },
    boolean: {
      level: 'requires-component-change',
      suggestedComponent: 'checkbox',
      suggestedColumnType: 'boolean',
      warning: 'String values will need boolean mapping',
    },
    date: {
      level: 'requires-component-change',
      suggestedComponent: 'date-picker',
      suggestedColumnType: 'date',
      warning: 'String values must be valid date format',
    },
    datetime: {
      level: 'requires-component-change',
      suggestedComponent: 'datetime-picker',
      suggestedColumnType: 'datetime',
      warning: 'String values must be valid datetime format',
    },
    array: { level: 'incompatible', warning: 'Cannot convert string to array' },
    object: { level: 'incompatible', warning: 'Cannot convert string to object' },
    enum: {
      level: 'requires-component-change',
      suggestedComponent: 'select',
      suggestedColumnType: 'enum',
    },
    reference: {
      level: 'requires-component-change',
      suggestedComponent: 'autocomplete',
      warning: 'String values need reference lookup',
    },
  },

  number: {
    string: {
      level: 'compatible',
      suggestedComponent: 'text-input',
      suggestedColumnType: 'text',
    },
    number: { level: 'compatible' },
    boolean: {
      level: 'requires-component-change',
      suggestedComponent: 'checkbox',
      suggestedColumnType: 'boolean',
      warning: 'Numbers will be treated as truthy/falsy',
    },
    date: { level: 'incompatible', warning: 'Cannot convert number to date' },
    datetime: { level: 'incompatible', warning: 'Cannot convert number to datetime' },
    array: { level: 'incompatible', warning: 'Cannot convert number to array' },
    object: { level: 'incompatible', warning: 'Cannot convert number to object' },
    enum: {
      level: 'requires-component-change',
      suggestedComponent: 'select',
      suggestedColumnType: 'enum',
      warning: 'Number must match enum values',
    },
    reference: { level: 'incompatible', warning: 'Cannot convert number to reference' },
  },

  boolean: {
    string: {
      level: 'compatible',
      suggestedComponent: 'text-input',
      suggestedColumnType: 'text',
    },
    number: {
      level: 'requires-component-change',
      suggestedComponent: 'number-input',
      suggestedColumnType: 'number',
      warning: 'Boolean will be converted to 0/1',
    },
    boolean: { level: 'compatible' },
    date: { level: 'incompatible', warning: 'Cannot convert boolean to date' },
    datetime: { level: 'incompatible', warning: 'Cannot convert boolean to datetime' },
    array: { level: 'incompatible', warning: 'Cannot convert boolean to array' },
    object: { level: 'incompatible', warning: 'Cannot convert boolean to object' },
    enum: {
      level: 'requires-component-change',
      suggestedComponent: 'select',
      suggestedColumnType: 'enum',
      warning: 'Boolean must match enum values',
    },
    reference: { level: 'incompatible', warning: 'Cannot convert boolean to reference' },
  },

  date: {
    string: {
      level: 'compatible',
      suggestedComponent: 'text-input',
      suggestedColumnType: 'text',
    },
    number: { level: 'incompatible', warning: 'Cannot convert date to number' },
    boolean: { level: 'incompatible', warning: 'Cannot convert date to boolean' },
    date: { level: 'compatible' },
    datetime: {
      level: 'compatible',
      suggestedComponent: 'datetime-picker',
      suggestedColumnType: 'datetime',
    },
    array: { level: 'incompatible', warning: 'Cannot convert date to array' },
    object: { level: 'incompatible', warning: 'Cannot convert date to object' },
    enum: { level: 'incompatible', warning: 'Cannot convert date to enum' },
    reference: { level: 'incompatible', warning: 'Cannot convert date to reference' },
  },

  datetime: {
    string: {
      level: 'compatible',
      suggestedComponent: 'text-input',
      suggestedColumnType: 'text',
    },
    number: { level: 'incompatible', warning: 'Cannot convert datetime to number' },
    boolean: { level: 'incompatible', warning: 'Cannot convert datetime to boolean' },
    date: {
      level: 'compatible',
      suggestedComponent: 'date-picker',
      suggestedColumnType: 'date',
      warning: 'Time information will be lost',
    },
    datetime: { level: 'compatible' },
    array: { level: 'incompatible', warning: 'Cannot convert datetime to array' },
    object: { level: 'incompatible', warning: 'Cannot convert datetime to object' },
    enum: { level: 'incompatible', warning: 'Cannot convert datetime to enum' },
    reference: { level: 'incompatible', warning: 'Cannot convert datetime to reference' },
  },

  array: {
    string: {
      level: 'requires-component-change',
      suggestedComponent: 'textarea',
      suggestedColumnType: 'text',
      warning: 'Array will be serialized to string',
    },
    number: { level: 'incompatible', warning: 'Cannot convert array to number' },
    boolean: { level: 'incompatible', warning: 'Cannot convert array to boolean' },
    date: { level: 'incompatible', warning: 'Cannot convert array to date' },
    datetime: { level: 'incompatible', warning: 'Cannot convert array to datetime' },
    array: { level: 'compatible' },
    object: { level: 'incompatible', warning: 'Cannot convert array to object' },
    enum: { level: 'incompatible', warning: 'Cannot convert array to enum' },
    reference: { level: 'incompatible', warning: 'Cannot convert array to reference' },
  },

  object: {
    string: {
      level: 'requires-component-change',
      suggestedComponent: 'textarea',
      suggestedColumnType: 'text',
      warning: 'Object will be serialized to JSON string',
    },
    number: { level: 'incompatible', warning: 'Cannot convert object to number' },
    boolean: { level: 'incompatible', warning: 'Cannot convert object to boolean' },
    date: { level: 'incompatible', warning: 'Cannot convert object to date' },
    datetime: { level: 'incompatible', warning: 'Cannot convert object to datetime' },
    array: { level: 'incompatible', warning: 'Cannot convert object to array' },
    object: { level: 'compatible' },
    enum: { level: 'incompatible', warning: 'Cannot convert object to enum' },
    reference: { level: 'incompatible', warning: 'Cannot convert object to reference' },
  },

  enum: {
    string: {
      level: 'compatible',
      suggestedComponent: 'text-input',
      suggestedColumnType: 'text',
    },
    number: {
      level: 'requires-component-change',
      suggestedComponent: 'number-input',
      suggestedColumnType: 'number',
      warning: 'Enum values must be numeric',
    },
    boolean: {
      level: 'requires-component-change',
      suggestedComponent: 'checkbox',
      suggestedColumnType: 'boolean',
      warning: 'Enum values must be boolean-like',
    },
    date: { level: 'incompatible', warning: 'Cannot convert enum to date' },
    datetime: { level: 'incompatible', warning: 'Cannot convert enum to datetime' },
    array: { level: 'incompatible', warning: 'Cannot convert enum to array' },
    object: { level: 'incompatible', warning: 'Cannot convert enum to object' },
    enum: { level: 'compatible' },
    reference: { level: 'incompatible', warning: 'Cannot convert enum to reference' },
  },

  reference: {
    string: {
      level: 'requires-component-change',
      suggestedComponent: 'text-input',
      suggestedColumnType: 'text',
      warning: 'Reference will be flattened to display value',
    },
    number: { level: 'incompatible', warning: 'Cannot convert reference to number' },
    boolean: { level: 'incompatible', warning: 'Cannot convert reference to boolean' },
    date: { level: 'incompatible', warning: 'Cannot convert reference to date' },
    datetime: { level: 'incompatible', warning: 'Cannot convert reference to datetime' },
    array: { level: 'incompatible', warning: 'Cannot convert reference to array' },
    object: { level: 'incompatible', warning: 'Cannot convert reference to object' },
    enum: { level: 'incompatible', warning: 'Cannot convert reference to enum' },
    reference: { level: 'compatible' },
  },
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 두 DataType 간의 호환성 확인
 */
export const getTypeCompatibility = (
  oldType: DataType,
  newType: DataType
): TypeCompatibility => {
  const entry = COMPATIBILITY_MATRIX[oldType]?.[newType]

  if (!entry) {
    return {
      level: 'incompatible',
      warning: `Unknown type transition: ${oldType} → ${newType}`,
    }
  }

  return {
    level: entry.level,
    suggestedComponent: entry.suggestedComponent,
    suggestedColumnType: entry.suggestedColumnType,
    warning: entry.warning,
  }
}

/**
 * DataType에 따른 기본 ComponentType 반환
 */
export const getDefaultComponent = (dataType: DataType): ComponentType => {
  const defaults: Record<DataType, ComponentType> = {
    string: 'text-input',
    number: 'number-input',
    boolean: 'checkbox',
    date: 'date-picker',
    datetime: 'datetime-picker',
    array: 'multi-select',
    object: 'textarea',
    enum: 'select',
    reference: 'autocomplete',
  }

  return defaults[dataType] ?? 'text-input'
}

/**
 * DataType에 따른 기본 ColumnType 반환
 */
export const getDefaultColumnType = (dataType: DataType): ColumnType => {
  const defaults: Record<DataType, ColumnType> = {
    string: 'text',
    number: 'number',
    boolean: 'boolean',
    date: 'date',
    datetime: 'datetime',
    array: 'text',
    object: 'text',
    enum: 'enum',
    reference: 'text',
  }

  return defaults[dataType] ?? 'text'
}

/**
 * 타입 전환이 호환 가능한지 확인
 */
export const isTypeCompatible = (oldType: DataType, newType: DataType): boolean => {
  const compat = getTypeCompatibility(oldType, newType)
  return compat.level !== 'incompatible'
}

/**
 * 타입 전환이 컴포넌트 변경을 필요로 하는지 확인
 */
export const requiresComponentChange = (oldType: DataType, newType: DataType): boolean => {
  const compat = getTypeCompatibility(oldType, newType)
  return compat.level === 'requires-component-change'
}
