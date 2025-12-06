import { describe, test, expect } from 'vitest'
import { operatorRegistry, type OperatorFn } from '../operators'

describe('Operator Implementations', () => {
  // Helper to create a simple evaluate function
  const identity = (x: unknown) => x

  describe('Comparison Operators', () => {
    test('== returns true for equal values', () => {
      expect(operatorRegistry['==']([1, 1], identity)).toBe(true)
      expect(operatorRegistry['=='](['hello', 'hello'], identity)).toBe(true)
      expect(operatorRegistry['==']([true, true], identity)).toBe(true)
      expect(operatorRegistry['==']([null, null], identity)).toBe(true)
    })

    test('== returns false for unequal values', () => {
      expect(operatorRegistry['==']([1, 2], identity)).toBe(false)
      expect(operatorRegistry['=='](['hello', 'world'], identity)).toBe(false)
      expect(operatorRegistry['==']([true, false], identity)).toBe(false)
    })

    test('!= returns true for unequal values', () => {
      expect(operatorRegistry['!=']([1, 2], identity)).toBe(true)
      expect(operatorRegistry['!='](['hello', 'world'], identity)).toBe(true)
    })

    test('!= returns false for equal values', () => {
      expect(operatorRegistry['!=']([1, 1], identity)).toBe(false)
      expect(operatorRegistry['!='](['same', 'same'], identity)).toBe(false)
    })

    test('> compares numbers', () => {
      expect(operatorRegistry['>']([5, 3], identity)).toBe(true)
      expect(operatorRegistry['>']([3, 5], identity)).toBe(false)
      expect(operatorRegistry['>']([3, 3], identity)).toBe(false)
    })

    test('> returns false for non-numbers', () => {
      expect(operatorRegistry['>'](['a', 'b'], identity)).toBe(false)
      expect(operatorRegistry['>']([null, 5], identity)).toBe(false)
    })

    test('>= compares numbers', () => {
      expect(operatorRegistry['>=']([5, 3], identity)).toBe(true)
      expect(operatorRegistry['>=']([3, 3], identity)).toBe(true)
      expect(operatorRegistry['>=']([3, 5], identity)).toBe(false)
    })

    test('< compares numbers', () => {
      expect(operatorRegistry['<']([3, 5], identity)).toBe(true)
      expect(operatorRegistry['<']([5, 3], identity)).toBe(false)
      expect(operatorRegistry['<']([3, 3], identity)).toBe(false)
    })

    test('<= compares numbers', () => {
      expect(operatorRegistry['<=']([3, 5], identity)).toBe(true)
      expect(operatorRegistry['<=']([3, 3], identity)).toBe(true)
      expect(operatorRegistry['<=']([5, 3], identity)).toBe(false)
    })
  })

  describe('Logical Operators', () => {
    test('AND returns true when all args are truthy', () => {
      expect(operatorRegistry['AND']([true, true], identity)).toBe(true)
      expect(operatorRegistry['AND']([true, true, true], identity)).toBe(true)
      expect(operatorRegistry['AND']([1, 'yes', true], identity)).toBe(true)
    })

    test('AND returns false when any arg is falsy', () => {
      expect(operatorRegistry['AND']([true, false], identity)).toBe(false)
      expect(operatorRegistry['AND']([false, false], identity)).toBe(false)
      expect(operatorRegistry['AND']([true, 0, true], identity)).toBe(false)
    })

    test('OR returns true when any arg is truthy', () => {
      expect(operatorRegistry['OR']([true, false], identity)).toBe(true)
      expect(operatorRegistry['OR']([false, true], identity)).toBe(true)
      expect(operatorRegistry['OR']([false, false, true], identity)).toBe(true)
    })

    test('OR returns false when all args are falsy', () => {
      expect(operatorRegistry['OR']([false, false], identity)).toBe(false)
      expect(operatorRegistry['OR']([0, '', null], identity)).toBe(false)
    })

    test('NOT negates value', () => {
      expect(operatorRegistry['NOT']([true], identity)).toBe(false)
      expect(operatorRegistry['NOT']([false], identity)).toBe(true)
      expect(operatorRegistry['NOT']([1], identity)).toBe(false)
      expect(operatorRegistry['NOT']([0], identity)).toBe(true)
    })
  })

  describe('Collection Operators', () => {
    test('IN checks if value is in list', () => {
      expect(operatorRegistry['IN']([1, [1, 2, 3]], identity)).toBe(true)
      expect(operatorRegistry['IN'](['a', ['a', 'b', 'c']], identity)).toBe(true)
      expect(operatorRegistry['IN']([4, [1, 2, 3]], identity)).toBe(false)
    })

    test('IN returns false for non-array', () => {
      expect(operatorRegistry['IN']([1, 'not-array'], identity)).toBe(false)
    })

    test('NOT_IN checks if value is not in list', () => {
      expect(operatorRegistry['NOT_IN']([4, [1, 2, 3]], identity)).toBe(true)
      expect(operatorRegistry['NOT_IN']([1, [1, 2, 3]], identity)).toBe(false)
    })

    test('NOT_IN returns true for non-array', () => {
      expect(operatorRegistry['NOT_IN']([1, 'not-array'], identity)).toBe(true)
    })

    test('CONTAINS checks string contains', () => {
      expect(operatorRegistry['CONTAINS'](['hello world', 'world'], identity)).toBe(true)
      expect(operatorRegistry['CONTAINS'](['hello', 'world'], identity)).toBe(false)
    })

    test('CONTAINS checks array includes', () => {
      expect(operatorRegistry['CONTAINS']([[1, 2, 3], 2], identity)).toBe(true)
      expect(operatorRegistry['CONTAINS']([['a', 'b'], 'a'], identity)).toBe(true)
      expect(operatorRegistry['CONTAINS']([[1, 2, 3], 4], identity)).toBe(false)
    })

    test('CONTAINS returns false for non-collection', () => {
      expect(operatorRegistry['CONTAINS']([123, 2], identity)).toBe(false)
    })

    test('IS_EMPTY checks empty values', () => {
      expect(operatorRegistry['IS_EMPTY']([null], identity)).toBe(true)
      expect(operatorRegistry['IS_EMPTY']([undefined], identity)).toBe(true)
      expect(operatorRegistry['IS_EMPTY']([''], identity)).toBe(true)
      expect(operatorRegistry['IS_EMPTY']([[]], identity)).toBe(true)
      expect(operatorRegistry['IS_EMPTY']([{}], identity)).toBe(true)
    })

    test('IS_EMPTY returns false for non-empty values', () => {
      expect(operatorRegistry['IS_EMPTY'](['hello'], identity)).toBe(false)
      expect(operatorRegistry['IS_EMPTY']([[1, 2]], identity)).toBe(false)
      expect(operatorRegistry['IS_EMPTY']([{ a: 1 }], identity)).toBe(false)
      expect(operatorRegistry['IS_EMPTY']([0], identity)).toBe(false)
    })

    test('LENGTH returns length of string', () => {
      expect(operatorRegistry['LENGTH'](['hello'], identity)).toBe(5)
      expect(operatorRegistry['LENGTH']([''], identity)).toBe(0)
    })

    test('LENGTH returns length of array', () => {
      expect(operatorRegistry['LENGTH']([[1, 2, 3]], identity)).toBe(3)
      expect(operatorRegistry['LENGTH']([[]], identity)).toBe(0)
    })

    test('LENGTH returns object key count', () => {
      expect(operatorRegistry['LENGTH']([{ a: 1, b: 2 }], identity)).toBe(2)
    })

    test('LENGTH returns 0 for non-collection', () => {
      expect(operatorRegistry['LENGTH']([123], identity)).toBe(0)
      expect(operatorRegistry['LENGTH']([null], identity)).toBe(0)
    })
  })

  describe('String Operators', () => {
    test('CONCAT joins strings', () => {
      expect(operatorRegistry['CONCAT'](['Hello', ' ', 'World'], identity)).toBe('Hello World')
      expect(operatorRegistry['CONCAT'](['a', 'b', 'c'], identity)).toBe('abc')
    })

    test('CONCAT handles null/undefined', () => {
      expect(operatorRegistry['CONCAT'](['Hello', null, 'World'], identity)).toBe('HelloWorld')
    })

    test('CONCAT converts numbers to strings', () => {
      expect(operatorRegistry['CONCAT'](['Count: ', 42], identity)).toBe('Count: 42')
    })

    test('UPPER converts to uppercase', () => {
      expect(operatorRegistry['UPPER'](['hello'], identity)).toBe('HELLO')
      expect(operatorRegistry['UPPER'](['Hello World'], identity)).toBe('HELLO WORLD')
    })

    test('UPPER returns empty string for non-string', () => {
      expect(operatorRegistry['UPPER']([123], identity)).toBe('')
    })

    test('LOWER converts to lowercase', () => {
      expect(operatorRegistry['LOWER'](['HELLO'], identity)).toBe('hello')
      expect(operatorRegistry['LOWER'](['Hello World'], identity)).toBe('hello world')
    })

    test('TRIM removes whitespace', () => {
      expect(operatorRegistry['TRIM'](['  hello  '], identity)).toBe('hello')
      expect(operatorRegistry['TRIM'](['\n\tspaces\t\n'], identity)).toBe('spaces')
    })

    test('STARTS_WITH checks prefix', () => {
      expect(operatorRegistry['STARTS_WITH'](['hello world', 'hello'], identity)).toBe(true)
      expect(operatorRegistry['STARTS_WITH'](['hello world', 'world'], identity)).toBe(false)
    })

    test('ENDS_WITH checks suffix', () => {
      expect(operatorRegistry['ENDS_WITH'](['hello world', 'world'], identity)).toBe(true)
      expect(operatorRegistry['ENDS_WITH'](['hello world', 'hello'], identity)).toBe(false)
    })

    test('MATCH tests regex pattern', () => {
      expect(operatorRegistry['MATCH'](['test@example.com', '^[a-z]+@[a-z]+\\.[a-z]+$'], identity)).toBe(true)
      expect(operatorRegistry['MATCH'](['invalid', '^[a-z]+@[a-z]+\\.[a-z]+$'], identity)).toBe(false)
    })

    test('MATCH returns false for invalid pattern', () => {
      expect(operatorRegistry['MATCH'](['test', '[invalid'], identity)).toBe(false)
    })
  })

  describe('Numeric Operators', () => {
    test('+ adds numbers', () => {
      expect(operatorRegistry['+']([1, 2], identity)).toBe(3)
      expect(operatorRegistry['+']([10, -5], identity)).toBe(5)
      expect(operatorRegistry['+']([1.5, 2.5], identity)).toBe(4)
    })

    test('+ returns 0 for non-numbers', () => {
      expect(operatorRegistry['+'](["1", 2], identity)).toBe(0)
    })

    test('- subtracts numbers', () => {
      expect(operatorRegistry['-']([5, 3], identity)).toBe(2)
      expect(operatorRegistry['-']([3, 5], identity)).toBe(-2)
    })

    test('* multiplies numbers', () => {
      expect(operatorRegistry['*']([3, 4], identity)).toBe(12)
      expect(operatorRegistry['*']([2.5, 4], identity)).toBe(10)
    })

    test('/ divides numbers', () => {
      expect(operatorRegistry['/']([10, 2], identity)).toBe(5)
      expect(operatorRegistry['/']([7, 2], identity)).toBe(3.5)
    })

    test('/ returns 0 for division by zero', () => {
      expect(operatorRegistry['/']([10, 0], identity)).toBe(0)
    })

    test('% returns modulo', () => {
      expect(operatorRegistry['%']([10, 3], identity)).toBe(1)
      expect(operatorRegistry['%']([7, 2], identity)).toBe(1)
    })

    test('% returns 0 for modulo by zero', () => {
      expect(operatorRegistry['%']([10, 0], identity)).toBe(0)
    })

    test('ABS returns absolute value', () => {
      expect(operatorRegistry['ABS']([-5], identity)).toBe(5)
      expect(operatorRegistry['ABS']([5], identity)).toBe(5)
      expect(operatorRegistry['ABS']([0], identity)).toBe(0)
    })

    test('ROUND rounds to nearest integer', () => {
      expect(operatorRegistry['ROUND']([3.4], identity)).toBe(3)
      expect(operatorRegistry['ROUND']([3.5], identity)).toBe(4)
      expect(operatorRegistry['ROUND']([3.7], identity)).toBe(4)
    })

    test('ROUND rounds to specified decimals', () => {
      expect(operatorRegistry['ROUND']([3.14159, 2], identity)).toBe(3.14)
      expect(operatorRegistry['ROUND']([3.145, 2], identity)).toBe(3.15)
    })

    test('FLOOR rounds down', () => {
      expect(operatorRegistry['FLOOR']([3.9], identity)).toBe(3)
      expect(operatorRegistry['FLOOR']([3.1], identity)).toBe(3)
      expect(operatorRegistry['FLOOR']([-3.1], identity)).toBe(-4)
    })

    test('CEIL rounds up', () => {
      expect(operatorRegistry['CEIL']([3.1], identity)).toBe(4)
      expect(operatorRegistry['CEIL']([3.9], identity)).toBe(4)
      expect(operatorRegistry['CEIL']([-3.9], identity)).toBe(-3)
    })

    test('MIN returns minimum value', () => {
      expect(operatorRegistry['MIN']([1, 2, 3], identity)).toBe(1)
      expect(operatorRegistry['MIN']([5, 3, 8, 1], identity)).toBe(1)
      expect(operatorRegistry['MIN']([-1, -5, 2], identity)).toBe(-5)
    })

    test('MIN returns 0 for empty or non-numbers', () => {
      expect(operatorRegistry['MIN']([], identity)).toBe(0)
      expect(operatorRegistry['MIN'](['a', 'b'], identity)).toBe(0)
    })

    test('MAX returns maximum value', () => {
      expect(operatorRegistry['MAX']([1, 2, 3], identity)).toBe(3)
      expect(operatorRegistry['MAX']([5, 3, 8, 1], identity)).toBe(8)
      expect(operatorRegistry['MAX']([-1, -5, 2], identity)).toBe(2)
    })
  })

  describe('Conditional Operators', () => {
    test('IF returns then value when condition is true', () => {
      expect(operatorRegistry['IF']([true, 'yes', 'no'], identity)).toBe('yes')
      expect(operatorRegistry['IF']([1, 'truthy', 'falsy'], identity)).toBe('truthy')
    })

    test('IF returns else value when condition is false', () => {
      expect(operatorRegistry['IF']([false, 'yes', 'no'], identity)).toBe('no')
      expect(operatorRegistry['IF']([0, 'truthy', 'falsy'], identity)).toBe('falsy')
    })

    test('CASE returns matching value', () => {
      // CASE args: [cond1, val1, cond2, val2, ..., default]
      expect(operatorRegistry['CASE']([true, 'first', 'default'], identity)).toBe('first')
      expect(operatorRegistry['CASE']([false, 'first', true, 'second', 'default'], identity)).toBe('second')
    })

    test('CASE returns default when no match', () => {
      expect(operatorRegistry['CASE']([false, 'first', false, 'second', 'default'], identity)).toBe('default')
    })

    test('COALESCE returns first non-null value', () => {
      expect(operatorRegistry['COALESCE']([null, undefined, 'value'], identity)).toBe('value')
      expect(operatorRegistry['COALESCE'](['first', 'second'], identity)).toBe('first')
      expect(operatorRegistry['COALESCE']([null, null, null], identity)).toBe(null)
    })

    test('COALESCE considers 0 and empty string as valid', () => {
      expect(operatorRegistry['COALESCE']([0, 'fallback'], identity)).toBe(0)
      expect(operatorRegistry['COALESCE'](['', 'fallback'], identity)).toBe('')
    })
  })

  describe('Type Checking Operators', () => {
    test('IS_NULL returns true for null/undefined', () => {
      expect(operatorRegistry['IS_NULL']([null], identity)).toBe(true)
      expect(operatorRegistry['IS_NULL']([undefined], identity)).toBe(true)
    })

    test('IS_NULL returns false for other values', () => {
      expect(operatorRegistry['IS_NULL']([0], identity)).toBe(false)
      expect(operatorRegistry['IS_NULL']([''], identity)).toBe(false)
      expect(operatorRegistry['IS_NULL']([false], identity)).toBe(false)
    })

    test('IS_NOT_NULL returns true for non-null values', () => {
      expect(operatorRegistry['IS_NOT_NULL']([0], identity)).toBe(true)
      expect(operatorRegistry['IS_NOT_NULL']([''], identity)).toBe(true)
      expect(operatorRegistry['IS_NOT_NULL']([false], identity)).toBe(true)
    })

    test('IS_NOT_NULL returns false for null/undefined', () => {
      expect(operatorRegistry['IS_NOT_NULL']([null], identity)).toBe(false)
      expect(operatorRegistry['IS_NOT_NULL']([undefined], identity)).toBe(false)
    })

    test('TYPE_OF returns correct types', () => {
      expect(operatorRegistry['TYPE_OF'](['hello'], identity)).toBe('string')
      expect(operatorRegistry['TYPE_OF']([42], identity)).toBe('number')
      expect(operatorRegistry['TYPE_OF']([true], identity)).toBe('boolean')
      expect(operatorRegistry['TYPE_OF']([null], identity)).toBe('null')
      expect(operatorRegistry['TYPE_OF']([[1, 2]], identity)).toBe('array')
      expect(operatorRegistry['TYPE_OF']([{ a: 1 }], identity)).toBe('object')
    })
  })

  describe('Object Access Operators', () => {
    test('GET retrieves object property', () => {
      expect(operatorRegistry['GET']([{ name: 'John' }, 'name'], identity)).toBe('John')
      expect(operatorRegistry['GET']([{ a: { b: 1 } }, 'a'], identity)).toEqual({ b: 1 })
    })

    test('GET returns undefined for missing key', () => {
      expect(operatorRegistry['GET']([{ name: 'John' }, 'age'], identity)).toBeUndefined()
    })

    test('GET returns undefined for non-object', () => {
      expect(operatorRegistry['GET']([null, 'key'], identity)).toBeUndefined()
      expect(operatorRegistry['GET'](['string', 'key'], identity)).toBeUndefined()
    })

    test('GET_PATH retrieves nested property', () => {
      const obj = { user: { profile: { name: 'John' } } }
      expect(operatorRegistry['GET_PATH']([obj, 'user.profile.name'], identity)).toBe('John')
    })

    test('GET_PATH returns undefined for missing path', () => {
      const obj = { user: { name: 'John' } }
      expect(operatorRegistry['GET_PATH']([obj, 'user.profile.name'], identity)).toBeUndefined()
    })
  })

  describe('Date Operators', () => {
    test('NOW returns ISO string', () => {
      const result = operatorRegistry['NOW']([], identity) as string
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    test('TODAY returns date string', () => {
      const result = operatorRegistry['TODAY']([], identity) as string
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    test('DATE_DIFF calculates difference in days', () => {
      const result = operatorRegistry['DATE_DIFF'](
        ['2024-01-15', '2024-01-10', 'days'],
        identity
      )
      expect(result).toBe(5)
    })

    test('DATE_DIFF calculates difference in hours', () => {
      const result = operatorRegistry['DATE_DIFF'](
        ['2024-01-10T12:00:00Z', '2024-01-10T00:00:00Z', 'hours'],
        identity
      )
      expect(result).toBe(12)
    })

    test('DATE_ADD adds days', () => {
      const result = operatorRegistry['DATE_ADD'](
        ['2024-01-10T00:00:00Z', 5, 'days'],
        identity
      ) as string
      expect(result).toContain('2024-01-15')
    })

    test('FORMAT_DATE formats date', () => {
      const result = operatorRegistry['FORMAT_DATE'](
        ['2024-01-15T14:30:00Z', 'YYYY-MM-DD'],
        identity
      )
      expect(result).toBe('2024-01-15')
    })

    test('FORMAT_DATE with time', () => {
      const result = operatorRegistry['FORMAT_DATE'](
        ['2024-01-15T14:30:45Z', 'YYYY-MM-DD HH:mm:ss'],
        identity
      )
      // Note: Time will be in local timezone, so we just check it contains expected parts
      expect(result).toContain('2024-01-15')
    })
  })

  describe('Operator Registry', () => {
    test('contains all expected operators', () => {
      const expectedOperators = [
        '==', '!=', '>', '>=', '<', '<=',
        'AND', 'OR', 'NOT',
        'IN', 'NOT_IN', 'CONTAINS', 'IS_EMPTY', 'LENGTH',
        'CONCAT', 'UPPER', 'LOWER', 'TRIM', 'STARTS_WITH', 'ENDS_WITH', 'MATCH',
        '+', '-', '*', '/', '%', 'ABS', 'ROUND', 'FLOOR', 'CEIL', 'MIN', 'MAX',
        'IF', 'CASE', 'COALESCE',
        'IS_NULL', 'IS_NOT_NULL', 'TYPE_OF',
        'GET', 'GET_PATH',
        'NOW', 'TODAY', 'DATE_DIFF', 'DATE_ADD', 'FORMAT_DATE',
      ]

      for (const op of expectedOperators) {
        expect(operatorRegistry[op as keyof typeof operatorRegistry]).toBeDefined()
      }
    })
  })
})
