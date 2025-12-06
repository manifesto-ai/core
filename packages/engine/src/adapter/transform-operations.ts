/**
 * Transform Operations
 *
 * 데이터 변환을 위한 파이프라인 연산자들
 */

import { ok, err, type Result } from '@manifesto-ai/schema'

// ============================================================================
// Types
// ============================================================================

export type TransformOperation =
  | 'map'
  | 'filter'
  | 'reduce'
  | 'pick'
  | 'omit'
  | 'rename'
  | 'flatten'
  | 'unflatten'
  | 'cast'
  | 'default'
  | 'template'
  | 'custom'

export interface TransformStepConfig {
  readonly operation: TransformOperation
  readonly config: Record<string, unknown>
}

export interface TransformError {
  readonly type: 'TRANSFORM_ERROR'
  readonly operation: TransformOperation
  readonly message: string
  readonly data?: unknown
}

export type TransformFn = (data: unknown, config: Record<string, unknown>) => unknown

// ============================================================================
// Transform Operations Registry
// ============================================================================

const transformOperations: Record<TransformOperation, TransformFn> = {
  /**
   * map - 객체 필드 매핑
   * config: { from: 'source.path', to: 'target.path' }[] 또는 Record<targetKey, sourcePath>
   */
  map: (data, config) => {
    if (!data || typeof data !== 'object') return data

    const mappings = config.mappings as Array<{ from: string; to: string }> | Record<string, string>

    if (Array.isArray(mappings)) {
      const result: Record<string, unknown> = {}
      for (const { from, to } of mappings) {
        const value = getPath(data as Record<string, unknown>, from)
        setPath(result, to, value)
      }
      return result
    }

    if (typeof mappings === 'object') {
      const result: Record<string, unknown> = {}
      for (const [targetKey, sourcePath] of Object.entries(mappings)) {
        const value = getPath(data as Record<string, unknown>, sourcePath)
        setPath(result, targetKey, value)
      }
      return result
    }

    return data
  },

  /**
   * filter - 배열 필터링 또는 객체 필드 필터링
   * config: { predicate: (item) => boolean } 또는 { keys: string[] }
   */
  filter: (data, config) => {
    if (Array.isArray(data) && config.predicate) {
      const predicateFn = config.predicate as (item: unknown) => boolean
      return data.filter(predicateFn)
    }

    if (typeof data === 'object' && data !== null && config.keys) {
      const keys = config.keys as string[]
      const result: Record<string, unknown> = {}
      for (const key of keys) {
        if (key in (data as Record<string, unknown>)) {
          result[key] = (data as Record<string, unknown>)[key]
        }
      }
      return result
    }

    return data
  },

  /**
   * reduce - 배열을 단일 값으로 축소
   * config: { reducer: (acc, item) => newAcc, initial: initialValue }
   */
  reduce: (data, config) => {
    if (!Array.isArray(data)) return data

    const reducer = config.reducer as (acc: unknown, item: unknown) => unknown
    const initial = config.initial

    return data.reduce(reducer, initial)
  },

  /**
   * pick - 특정 필드만 선택
   * config: { keys: ['field1', 'field2'] }
   */
  pick: (data, config) => {
    if (!data || typeof data !== 'object') return data

    const keys = config.keys as string[]
    const result: Record<string, unknown> = {}

    for (const key of keys) {
      if (key in (data as Record<string, unknown>)) {
        result[key] = (data as Record<string, unknown>)[key]
      }
    }

    return result
  },

  /**
   * omit - 특정 필드 제외
   * config: { keys: ['field1', 'field2'] }
   */
  omit: (data, config) => {
    if (!data || typeof data !== 'object') return data

    const keys = new Set(config.keys as string[])
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (!keys.has(key)) {
        result[key] = value
      }
    }

    return result
  },

  /**
   * rename - 필드명 변경
   * config: { renames: { oldName: 'newName' } }
   */
  rename: (data, config) => {
    if (!data || typeof data !== 'object') return data

    const renames = config.renames as Record<string, string>
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const newKey = renames[key] ?? key
      result[newKey] = value
    }

    return result
  },

  /**
   * flatten - 중첩 객체를 평탄화
   * config: { delimiter: '.', depth?: number }
   */
  flatten: (data, config) => {
    if (!data || typeof data !== 'object') return data

    const delimiter = (config.delimiter as string) ?? '.'
    const maxDepth = (config.depth as number) ?? Infinity

    return flattenObject(data as Record<string, unknown>, delimiter, maxDepth)
  },

  /**
   * unflatten - 평탄화된 객체를 중첩 구조로 복원
   * config: { delimiter: '.' }
   */
  unflatten: (data, config) => {
    if (!data || typeof data !== 'object') return data

    const delimiter = (config.delimiter as string) ?? '.'

    return unflattenObject(data as Record<string, unknown>, delimiter)
  },

  /**
   * cast - 타입 변환
   * config: { casts: { fieldName: 'number' | 'string' | 'boolean' | 'date' } }
   */
  cast: (data, config) => {
    if (!data || typeof data !== 'object') return data

    const casts = config.casts as Record<string, string>
    const result = { ...(data as Record<string, unknown>) }

    for (const [field, targetType] of Object.entries(casts)) {
      const value = result[field]
      result[field] = castValue(value, targetType)
    }

    return result
  },

  /**
   * default - 기본값 설정
   * config: { defaults: { fieldName: defaultValue } }
   */
  default: (data, config) => {
    if (!data || typeof data !== 'object') return config.defaults ?? data

    const defaults = config.defaults as Record<string, unknown>
    const result = { ...defaults, ...(data as Record<string, unknown>) }

    // undefined 값만 기본값으로 대체
    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (result[key] === undefined || result[key] === null) {
        result[key] = defaultValue
      }
    }

    return result
  },

  /**
   * template - 템플릿 기반 변환
   * config: { template: { newField: '${field1} - ${field2}' } }
   */
  template: (data, config) => {
    if (!data || typeof data !== 'object') return data

    const template = config.template as Record<string, string>
    const dataObj = data as Record<string, unknown>
    const result: Record<string, unknown> = { ...dataObj }

    for (const [field, templateStr] of Object.entries(template)) {
      result[field] = templateStr.replace(/\$\{(\w+(?:\.\w+)*)\}/g, (_, path) => {
        const value = getPath(dataObj, path)
        return value !== undefined ? String(value) : ''
      })
    }

    return result
  },

  /**
   * custom - 사용자 정의 변환 함수
   * config: { transform: (data) => transformedData }
   */
  custom: (data, config) => {
    const transform = config.transform as ((d: unknown) => unknown) | undefined
    if (typeof transform === 'function') {
      return transform(data)
    }
    return data
  },
}

// ============================================================================
// Transform Pipeline
// ============================================================================

/**
 * 변환 파이프라인 실행
 */
export const executeTransformPipeline = (
  data: unknown,
  steps: readonly TransformStepConfig[]
): Result<unknown, TransformError> => {
  let result = data

  for (const step of steps) {
    const operation = transformOperations[step.operation]
    if (!operation) {
      return err({
        type: 'TRANSFORM_ERROR',
        operation: step.operation,
        message: `Unknown transform operation: ${step.operation}`,
        data: result,
      })
    }

    try {
      result = operation(result, step.config)
    } catch (e) {
      return err({
        type: 'TRANSFORM_ERROR',
        operation: step.operation,
        message: e instanceof Error ? e.message : 'Transform failed',
        data: result,
      })
    }
  }

  return ok(result)
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 점 표기법으로 객체 경로에서 값 가져오기
 */
export const getPath = (obj: Record<string, unknown>, path: string): unknown => {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * 점 표기법으로 객체 경로에 값 설정
 */
export const setPath = (obj: Record<string, unknown>, path: string, value: unknown): void => {
  const parts = path.split('.')
  let current = obj

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }

  const lastPart = parts[parts.length - 1]
  if (lastPart !== undefined) {
    current[lastPart] = value
  }
}

/**
 * 객체 평탄화
 */
const flattenObject = (
  obj: Record<string, unknown>,
  delimiter: string,
  maxDepth: number,
  prefix = '',
  depth = 0
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}${delimiter}${key}` : key

    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      depth < maxDepth
    ) {
      Object.assign(
        result,
        flattenObject(value as Record<string, unknown>, delimiter, maxDepth, newKey, depth + 1)
      )
    } else {
      result[newKey] = value
    }
  }

  return result
}

/**
 * 평탄화된 객체 복원
 */
const unflattenObject = (
  obj: Record<string, unknown>,
  delimiter: string
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    setPath(result, key.split(delimiter).join('.'), value)
  }

  return result
}

/**
 * 값 타입 변환
 */
const castValue = (value: unknown, targetType: string): unknown => {
  if (value === null || value === undefined) return value

  switch (targetType) {
    case 'number':
      return Number(value)
    case 'string':
      return String(value)
    case 'boolean':
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1'
      }
      return Boolean(value)
    case 'date':
      return new Date(value as string | number)
    case 'array':
      return Array.isArray(value) ? value : [value]
    default:
      return value
  }
}
