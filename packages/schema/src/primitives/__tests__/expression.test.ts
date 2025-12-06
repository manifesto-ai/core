import { describe, test, expect } from 'vitest'
import {
  $,
  eq,
  neq,
  gt,
  gte,
  lt,
  lte,
  and,
  or,
  not,
  isIn,
  notIn,
  contains,
  isEmpty,
  length,
  concat,
  upper,
  lower,
  trim,
  startsWith,
  endsWith,
  match,
  add,
  sub,
  mul,
  div,
  mod,
  abs,
  round,
  floor,
  ceil,
  min,
  max,
  when,
  caseOf,
  coalesce,
  isNull,
  isNotNull,
  typeOf,
  get,
  getPath,
  now,
  today,
  dateDiff,
  dateAdd,
  formatDate,
  fieldEquals,
  fieldIsEmpty,
  fieldIn,
} from '../expression'

describe('Expression Primitives', () => {
  describe('Context References ($)', () => {
    test('$.state() creates $state reference', () => {
      expect($.state('name')).toBe('$state.name')
    })

    test('$.context() creates $context reference', () => {
      expect($.context('brandId')).toBe('$context.brandId')
    })

    test('$.user() creates $user reference', () => {
      expect($.user('id')).toBe('$user.id')
    })

    test('$.params() creates $params reference', () => {
      expect($.params('id')).toBe('$params.id')
    })

    test('$.result() creates $result reference', () => {
      expect($.result('data')).toBe('$result.data')
    })

    test('$.env() creates $env reference', () => {
      expect($.env('API_URL')).toBe('$env.API_URL')
    })

    test('supports nested paths', () => {
      expect($.state('user.profile.name')).toBe('$state.user.profile.name')
      expect($.user('permissions.admin')).toBe('$user.permissions.admin')
    })
  })

  describe('Comparison Operators', () => {
    test('eq() creates == expression', () => {
      expect(eq(1, 2)).toEqual(['==', 1, 2])
      expect(eq('$state.x', 5)).toEqual(['==', '$state.x', 5])
    })

    test('neq() creates != expression', () => {
      expect(neq(1, 2)).toEqual(['!=', 1, 2])
    })

    test('gt() creates > expression', () => {
      expect(gt('$state.count', 0)).toEqual(['>', '$state.count', 0])
    })

    test('gte() creates >= expression', () => {
      expect(gte('$state.count', 0)).toEqual(['>=', '$state.count', 0])
    })

    test('lt() creates < expression', () => {
      expect(lt('$state.count', 100)).toEqual(['<', '$state.count', 100])
    })

    test('lte() creates <= expression', () => {
      expect(lte('$state.count', 100)).toEqual(['<=', '$state.count', 100])
    })
  })

  describe('Logical Operators', () => {
    test('and() creates AND expression with multiple args', () => {
      expect(and(true, false)).toEqual(['AND', true, false])
      expect(and(true, true, true)).toEqual(['AND', true, true, true])
    })

    test('or() creates OR expression with multiple args', () => {
      expect(or(true, false)).toEqual(['OR', true, false])
      expect(or(false, false, true)).toEqual(['OR', false, false, true])
    })

    test('not() creates NOT expression', () => {
      expect(not(true)).toEqual(['NOT', true])
      expect(not(['==', 1, 2])).toEqual(['NOT', ['==', 1, 2]])
    })

    test('nested logical expressions', () => {
      const expr = and(
        gt('$state.x', 0),
        or(eq('$state.y', 1), eq('$state.y', 2))
      )
      expect(expr[0]).toBe('AND')
      expect(expr[2][0]).toBe('OR')
    })
  })

  describe('Collection Operators', () => {
    test('isIn() creates IN expression', () => {
      expect(isIn('$state.status', ['ACTIVE', 'PENDING'])).toEqual([
        'IN', '$state.status', ['ACTIVE', 'PENDING']
      ])
    })

    test('notIn() creates NOT_IN expression', () => {
      expect(notIn('$state.status', ['DELETED'])).toEqual([
        'NOT_IN', '$state.status', ['DELETED']
      ])
    })

    test('contains() creates CONTAINS expression', () => {
      expect(contains('$state.tags', 'important')).toEqual([
        'CONTAINS', '$state.tags', 'important'
      ])
    })

    test('isEmpty() creates IS_EMPTY expression', () => {
      expect(isEmpty('$state.items')).toEqual(['IS_EMPTY', '$state.items'])
    })

    test('length() creates LENGTH expression', () => {
      expect(length('$state.items')).toEqual(['LENGTH', '$state.items'])
    })
  })

  describe('String Operators', () => {
    test('concat() creates CONCAT expression', () => {
      expect(concat('Hello, ', '$state.name')).toEqual([
        'CONCAT', 'Hello, ', '$state.name'
      ])
      expect(concat('a', 'b', 'c')).toEqual(['CONCAT', 'a', 'b', 'c'])
    })

    test('upper() creates UPPER expression', () => {
      expect(upper('$state.name')).toEqual(['UPPER', '$state.name'])
    })

    test('lower() creates LOWER expression', () => {
      expect(lower('$state.name')).toEqual(['LOWER', '$state.name'])
    })

    test('trim() creates TRIM expression', () => {
      expect(trim('$state.input')).toEqual(['TRIM', '$state.input'])
    })

    test('startsWith() creates STARTS_WITH expression', () => {
      expect(startsWith('$state.code', 'PRE-')).toEqual([
        'STARTS_WITH', '$state.code', 'PRE-'
      ])
    })

    test('endsWith() creates ENDS_WITH expression', () => {
      expect(endsWith('$state.file', '.pdf')).toEqual([
        'ENDS_WITH', '$state.file', '.pdf'
      ])
    })

    test('match() creates MATCH expression with pattern', () => {
      expect(match('$state.email', '^[a-z]+@[a-z]+$')).toEqual([
        'MATCH', '$state.email', '^[a-z]+@[a-z]+$'
      ])
    })
  })

  describe('Numeric Operators', () => {
    test('add() creates + expression', () => {
      expect(add(1, 2)).toEqual(['+', 1, 2])
      expect(add('$state.a', '$state.b')).toEqual(['+', '$state.a', '$state.b'])
    })

    test('sub() creates - expression', () => {
      expect(sub(10, 5)).toEqual(['-', 10, 5])
    })

    test('mul() creates * expression', () => {
      expect(mul(3, 4)).toEqual(['*', 3, 4])
    })

    test('div() creates / expression', () => {
      expect(div(10, 2)).toEqual(['/', 10, 2])
    })

    test('mod() creates % expression', () => {
      expect(mod(10, 3)).toEqual(['%', 10, 3])
    })

    test('abs() creates ABS expression', () => {
      expect(abs('$state.value')).toEqual(['ABS', '$state.value'])
    })

    test('round() creates ROUND expression with optional decimals', () => {
      expect(round('$state.price')).toEqual(['ROUND', '$state.price'])
      expect(round('$state.price', 2)).toEqual(['ROUND', '$state.price', 2])
    })

    test('floor() creates FLOOR expression', () => {
      expect(floor('$state.value')).toEqual(['FLOOR', '$state.value'])
    })

    test('ceil() creates CEIL expression', () => {
      expect(ceil('$state.value')).toEqual(['CEIL', '$state.value'])
    })

    test('min() creates MIN expression', () => {
      expect(min(1, 2, 3)).toEqual(['MIN', 1, 2, 3])
    })

    test('max() creates MAX expression', () => {
      expect(max(1, 2, 3)).toEqual(['MAX', 1, 2, 3])
    })
  })

  describe('Conditional Operators', () => {
    test('when() creates IF expression', () => {
      expect(when(true, 'yes', 'no')).toEqual(['IF', true, 'yes', 'no'])
    })

    test('caseOf() creates CASE expression', () => {
      const expr = caseOf([
        [eq('$state.x', 1), 'one'],
        [eq('$state.x', 2), 'two'],
      ], 'other')
      expect(expr[0]).toBe('CASE')
      expect(expr[expr.length - 1]).toBe('other')
    })

    test('coalesce() creates COALESCE expression', () => {
      expect(coalesce('$state.a', '$state.b', 'default')).toEqual([
        'COALESCE', '$state.a', '$state.b', 'default'
      ])
    })
  })

  describe('Type Operators', () => {
    test('isNull() creates IS_NULL expression', () => {
      expect(isNull('$state.value')).toEqual(['IS_NULL', '$state.value'])
    })

    test('isNotNull() creates IS_NOT_NULL expression', () => {
      expect(isNotNull('$state.value')).toEqual(['IS_NOT_NULL', '$state.value'])
    })

    test('typeOf() creates TYPE_OF expression', () => {
      expect(typeOf('$state.value')).toEqual(['TYPE_OF', '$state.value'])
    })
  })

  describe('Access Operators', () => {
    test('get() creates GET expression', () => {
      expect(get('$state.user', 'name')).toEqual(['GET', '$state.user', 'name'])
    })

    test('getPath() creates GET_PATH expression', () => {
      expect(getPath('$state.data', 'user.profile.name')).toEqual([
        'GET_PATH', '$state.data', 'user.profile.name'
      ])
    })
  })

  describe('Date Operators', () => {
    test('now() creates NOW expression', () => {
      expect(now()).toEqual(['NOW'])
    })

    test('today() creates TODAY expression', () => {
      expect(today()).toEqual(['TODAY'])
    })

    test('dateDiff() creates DATE_DIFF expression', () => {
      expect(dateDiff('$state.start', '$state.end', 'days')).toEqual([
        'DATE_DIFF', '$state.start', '$state.end', 'days'
      ])
    })

    test('dateAdd() creates DATE_ADD expression', () => {
      expect(dateAdd('$state.date', 7, 'days')).toEqual([
        'DATE_ADD', '$state.date', 7, 'days'
      ])
    })

    test('formatDate() creates FORMAT_DATE expression', () => {
      expect(formatDate('$state.date', 'YYYY-MM-DD')).toEqual([
        'FORMAT_DATE', '$state.date', 'YYYY-MM-DD'
      ])
    })
  })

  describe('Convenience Aliases', () => {
    test('fieldEquals() creates field equality check', () => {
      expect(fieldEquals('status', 'ACTIVE')).toEqual([
        '==', '$state.status', 'ACTIVE'
      ])
    })

    test('fieldIsEmpty() creates field empty check with OR expression', () => {
      // Note: The actual implementation uses OR(IS_NULL, EQ(..., ''))
      const result = fieldIsEmpty('items')
      expect(result[0]).toBe('OR')
      expect(result[1]).toEqual(['IS_NULL', '$state.items'])
      expect(result[2]).toEqual(['==', '$state.items', ''])
    })

    test('fieldIn() creates field in list check', () => {
      expect(fieldIn('status', ['A', 'B'])).toEqual([
        'IN', '$state.status', ['A', 'B']
      ])
    })
  })

  describe('Complex Expression Composition', () => {
    test('composes multiple operators', () => {
      const expr = and(
        gt('$state.age', 18),
        or(
          eq('$state.role', 'admin'),
          eq('$state.role', 'manager')
        ),
        not(isEmpty('$state.permissions'))
      )
      expect(expr[0]).toBe('AND')
      expect(expr).toHaveLength(4)
    })

    test('creates complex arithmetic expression', () => {
      const expr = round(
        mul(
          div('$state.price', 100),
          sub(100, '$state.discount')
        ),
        2
      )
      expect(expr[0]).toBe('ROUND')
    })

    test('creates conditional with nested expressions', () => {
      const expr = when(
        gt('$state.total', 100),
        mul('$state.total', 0.9),
        '$state.total'
      )
      expect(expr[0]).toBe('IF')
      expect(expr[2][0]).toBe('*')
    })
  })
})
