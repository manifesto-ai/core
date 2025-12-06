/**
 * Operator Implementations
 *
 * 각 연산자의 실제 구현 - 샌드박스 환경에서 안전하게 실행
 */

import type { Operator } from '@manifesto-ai/schema'

export type OperatorFn = (args: unknown[], evaluate: (expr: unknown) => unknown) => unknown

// ============================================================================
// Comparison Operators
// ============================================================================

const eq: OperatorFn = (args, evaluate) => {
  const [left, right] = args
  return evaluate(left) === evaluate(right)
}

const neq: OperatorFn = (args, evaluate) => {
  const [left, right] = args
  return evaluate(left) !== evaluate(right)
}

const gt: OperatorFn = (args, evaluate) => {
  const [left, right] = args
  const l = evaluate(left)
  const r = evaluate(right)
  if (typeof l !== 'number' || typeof r !== 'number') return false
  return l > r
}

const gte: OperatorFn = (args, evaluate) => {
  const [left, right] = args
  const l = evaluate(left)
  const r = evaluate(right)
  if (typeof l !== 'number' || typeof r !== 'number') return false
  return l >= r
}

const lt: OperatorFn = (args, evaluate) => {
  const [left, right] = args
  const l = evaluate(left)
  const r = evaluate(right)
  if (typeof l !== 'number' || typeof r !== 'number') return false
  return l < r
}

const lte: OperatorFn = (args, evaluate) => {
  const [left, right] = args
  const l = evaluate(left)
  const r = evaluate(right)
  if (typeof l !== 'number' || typeof r !== 'number') return false
  return l <= r
}

// ============================================================================
// Logical Operators
// ============================================================================

const and: OperatorFn = (args, evaluate) => {
  for (const arg of args) {
    if (!evaluate(arg)) return false
  }
  return true
}

const or: OperatorFn = (args, evaluate) => {
  for (const arg of args) {
    if (evaluate(arg)) return true
  }
  return false
}

const not: OperatorFn = (args, evaluate) => {
  return !evaluate(args[0])
}

// ============================================================================
// Collection Operators
// ============================================================================

const inOp: OperatorFn = (args, evaluate) => {
  const value = evaluate(args[0])
  const list = args[1]
  if (!Array.isArray(list)) return false
  return list.some((item) => evaluate(item) === value)
}

const notInOp: OperatorFn = (args, evaluate) => {
  const value = evaluate(args[0])
  const list = args[1]
  if (!Array.isArray(list)) return true
  return !list.some((item) => evaluate(item) === value)
}

const contains: OperatorFn = (args, evaluate) => {
  const collection = evaluate(args[0])
  const item = evaluate(args[1])

  if (typeof collection === 'string' && typeof item === 'string') {
    return collection.includes(item)
  }
  if (Array.isArray(collection)) {
    return collection.includes(item)
  }
  return false
}

const isEmpty: OperatorFn = (args, evaluate) => {
  const value = evaluate(args[0])
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

const length: OperatorFn = (args, evaluate) => {
  const value = evaluate(args[0])
  if (typeof value === 'string') return value.length
  if (Array.isArray(value)) return value.length
  if (typeof value === 'object' && value !== null) return Object.keys(value).length
  return 0
}

// ============================================================================
// String Operators
// ============================================================================

const concat: OperatorFn = (args, evaluate) => {
  return args.map((arg) => String(evaluate(arg) ?? '')).join('')
}

const upper: OperatorFn = (args, evaluate) => {
  const value = evaluate(args[0])
  return typeof value === 'string' ? value.toUpperCase() : ''
}

const lower: OperatorFn = (args, evaluate) => {
  const value = evaluate(args[0])
  return typeof value === 'string' ? value.toLowerCase() : ''
}

const trim: OperatorFn = (args, evaluate) => {
  const value = evaluate(args[0])
  return typeof value === 'string' ? value.trim() : ''
}

const startsWith: OperatorFn = (args, evaluate) => {
  const str = evaluate(args[0])
  const prefix = evaluate(args[1])
  if (typeof str !== 'string' || typeof prefix !== 'string') return false
  return str.startsWith(prefix)
}

const endsWith: OperatorFn = (args, evaluate) => {
  const str = evaluate(args[0])
  const suffix = evaluate(args[1])
  if (typeof str !== 'string' || typeof suffix !== 'string') return false
  return str.endsWith(suffix)
}

const match: OperatorFn = (args, evaluate) => {
  const str = evaluate(args[0])
  const pattern = args[1] // 패턴은 평가하지 않음 (문자열 리터럴)
  if (typeof str !== 'string' || typeof pattern !== 'string') return false
  try {
    return new RegExp(pattern).test(str)
  } catch {
    return false
  }
}

// ============================================================================
// Numeric Operators
// ============================================================================

const add: OperatorFn = (args, evaluate) => {
  const l = evaluate(args[0])
  const r = evaluate(args[1])
  if (typeof l !== 'number' || typeof r !== 'number') return 0
  return l + r
}

const sub: OperatorFn = (args, evaluate) => {
  const l = evaluate(args[0])
  const r = evaluate(args[1])
  if (typeof l !== 'number' || typeof r !== 'number') return 0
  return l - r
}

const mul: OperatorFn = (args, evaluate) => {
  const l = evaluate(args[0])
  const r = evaluate(args[1])
  if (typeof l !== 'number' || typeof r !== 'number') return 0
  return l * r
}

const div: OperatorFn = (args, evaluate) => {
  const l = evaluate(args[0])
  const r = evaluate(args[1])
  if (typeof l !== 'number' || typeof r !== 'number' || r === 0) return 0
  return l / r
}

const mod: OperatorFn = (args, evaluate) => {
  const l = evaluate(args[0])
  const r = evaluate(args[1])
  if (typeof l !== 'number' || typeof r !== 'number' || r === 0) return 0
  return l % r
}

const abs: OperatorFn = (args, evaluate) => {
  const value = evaluate(args[0])
  return typeof value === 'number' ? Math.abs(value) : 0
}

const round: OperatorFn = (args, evaluate) => {
  const value = evaluate(args[0])
  const decimals = args[1] !== undefined ? evaluate(args[1]) : 0
  if (typeof value !== 'number') return 0
  if (typeof decimals !== 'number') return Math.round(value)
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

const floor: OperatorFn = (args, evaluate) => {
  const value = evaluate(args[0])
  return typeof value === 'number' ? Math.floor(value) : 0
}

const ceil: OperatorFn = (args, evaluate) => {
  const value = evaluate(args[0])
  return typeof value === 'number' ? Math.ceil(value) : 0
}

const min: OperatorFn = (args, evaluate) => {
  const nums = args.map(evaluate).filter((v): v is number => typeof v === 'number')
  if (nums.length === 0) return 0
  return Math.min(...nums)
}

const max: OperatorFn = (args, evaluate) => {
  const nums = args.map(evaluate).filter((v): v is number => typeof v === 'number')
  if (nums.length === 0) return 0
  return Math.max(...nums)
}

// ============================================================================
// Conditional Operators
// ============================================================================

const ifOp: OperatorFn = (args, evaluate) => {
  const [condition, thenExpr, elseExpr] = args
  return evaluate(condition) ? evaluate(thenExpr) : evaluate(elseExpr)
}

const caseOp: OperatorFn = (args, evaluate) => {
  // 마지막은 default, 나머지는 [condition, value] 쌍
  for (let i = 0; i < args.length - 1; i += 2) {
    const condition = args[i]
    const value = args[i + 1]
    if (evaluate(condition)) {
      return evaluate(value)
    }
  }
  // default value
  return evaluate(args[args.length - 1])
}

const coalesce: OperatorFn = (args, evaluate) => {
  for (const arg of args) {
    const value = evaluate(arg)
    if (value !== null && value !== undefined) {
      return value
    }
  }
  return null
}

// ============================================================================
// Type Checking Operators
// ============================================================================

const isNull: OperatorFn = (args, evaluate) => {
  const value = evaluate(args[0])
  return value === null || value === undefined
}

const isNotNull: OperatorFn = (args, evaluate) => {
  const value = evaluate(args[0])
  return value !== null && value !== undefined
}

const typeOf: OperatorFn = (args, evaluate) => {
  const value = evaluate(args[0])
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

// ============================================================================
// Object Access Operators
// ============================================================================

const get: OperatorFn = (args, evaluate) => {
  const obj = evaluate(args[0])
  const key = args[1] // key는 문자열 리터럴
  if (typeof obj !== 'object' || obj === null || typeof key !== 'string') {
    return undefined
  }
  return (obj as Record<string, unknown>)[key]
}

const getPath: OperatorFn = (args, evaluate) => {
  const obj = evaluate(args[0])
  const path = args[1] // path는 문자열 리터럴
  if (typeof obj !== 'object' || obj === null || typeof path !== 'string') {
    return undefined
  }

  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

// ============================================================================
// Date Operators
// ============================================================================

const now: OperatorFn = () => new Date().toISOString()

const today: OperatorFn = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const dateDiff: OperatorFn = (args, evaluate) => {
  const date1 = evaluate(args[0])
  const date2 = evaluate(args[1])
  const unit = args[2] as 'days' | 'hours' | 'minutes'

  if (typeof date1 !== 'string' || typeof date2 !== 'string') return 0

  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffMs = d1.getTime() - d2.getTime()

  switch (unit) {
    case 'days':
      return Math.floor(diffMs / (1000 * 60 * 60 * 24))
    case 'hours':
      return Math.floor(diffMs / (1000 * 60 * 60))
    case 'minutes':
      return Math.floor(diffMs / (1000 * 60))
    default:
      return 0
  }
}

const dateAdd: OperatorFn = (args, evaluate) => {
  const date = evaluate(args[0])
  const amount = args[1] as number
  const unit = args[2] as 'days' | 'hours' | 'minutes'

  if (typeof date !== 'string' || typeof amount !== 'number') return ''

  const d = new Date(date)

  switch (unit) {
    case 'days':
      d.setDate(d.getDate() + amount)
      break
    case 'hours':
      d.setHours(d.getHours() + amount)
      break
    case 'minutes':
      d.setMinutes(d.getMinutes() + amount)
      break
  }

  return d.toISOString()
}

const formatDate: OperatorFn = (args, evaluate) => {
  const date = evaluate(args[0])
  const format = args[1] as string

  if (typeof date !== 'string' || typeof format !== 'string') return ''

  const d = new Date(date)
  if (isNaN(d.getTime())) return ''

  // 간단한 포맷 지원
  return format
    .replace('YYYY', String(d.getFullYear()))
    .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
    .replace('DD', String(d.getDate()).padStart(2, '0'))
    .replace('HH', String(d.getHours()).padStart(2, '0'))
    .replace('mm', String(d.getMinutes()).padStart(2, '0'))
    .replace('ss', String(d.getSeconds()).padStart(2, '0'))
}

// ============================================================================
// Operator Registry
// ============================================================================

export const operatorRegistry: Record<Operator, OperatorFn> = {
  // Comparison
  '==': eq,
  '!=': neq,
  '>': gt,
  '>=': gte,
  '<': lt,
  '<=': lte,

  // Logical
  AND: and,
  OR: or,
  NOT: not,

  // Collection
  IN: inOp,
  NOT_IN: notInOp,
  CONTAINS: contains,
  IS_EMPTY: isEmpty,
  LENGTH: length,

  // String
  CONCAT: concat,
  UPPER: upper,
  LOWER: lower,
  TRIM: trim,
  STARTS_WITH: startsWith,
  ENDS_WITH: endsWith,
  MATCH: match,

  // Numeric
  '+': add,
  '-': sub,
  '*': mul,
  '/': div,
  '%': mod,
  ABS: abs,
  ROUND: round,
  FLOOR: floor,
  CEIL: ceil,
  MIN: min,
  MAX: max,

  // Conditional
  IF: ifOp,
  CASE: caseOp,
  COALESCE: coalesce,

  // Type
  IS_NULL: isNull,
  IS_NOT_NULL: isNotNull,
  TYPE_OF: typeOf,

  // Access
  GET: get,
  GET_PATH: getPath,

  // Date
  NOW: now,
  TODAY: today,
  DATE_DIFF: dateDiff,
  DATE_ADD: dateAdd,
  FORMAT_DATE: formatDate,
}
