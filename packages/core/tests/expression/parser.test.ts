import { describe, it, expect } from 'vitest';
import {
  isValidExpression,
  isGetExpr,
  extractPaths,
  stringifyExpression,
  parseExpression,
  expressionToString,
} from '../../src/expression/parser.js';
import type { Expression } from '../../src/expression/types.js';

describe('parser', () => {
  // ===========================================
  // isValidExpression
  // ===========================================
  describe('isValidExpression', () => {
    describe('primitive values', () => {
      it('should accept null as valid', () => {
        expect(isValidExpression(null)).toBe(true);
      });

      it('should accept string as valid', () => {
        expect(isValidExpression('hello')).toBe(true);
        expect(isValidExpression('')).toBe(true);
      });

      it('should accept number as valid', () => {
        expect(isValidExpression(42)).toBe(true);
        expect(isValidExpression(0)).toBe(true);
        expect(isValidExpression(-1.5)).toBe(true);
      });

      it('should accept boolean as valid', () => {
        expect(isValidExpression(true)).toBe(true);
        expect(isValidExpression(false)).toBe(true);
      });
    });

    describe('expression arrays', () => {
      it('should reject non-array objects', () => {
        expect(isValidExpression({ key: 'value' })).toBe(false);
      });

      it('should reject empty arrays', () => {
        expect(isValidExpression([])).toBe(false);
      });

      it('should reject arrays with non-string first element', () => {
        expect(isValidExpression([123, 'arg'])).toBe(false);
        expect(isValidExpression([null, 'arg'])).toBe(false);
      });

      it('should reject arrays with invalid operator', () => {
        expect(isValidExpression(['invalidOp', 'arg'])).toBe(false);
      });
    });

    describe('valid operators', () => {
      it('should accept get operator', () => {
        expect(isValidExpression(['get', 'data.name'])).toBe(true);
      });

      it('should accept comparison operators', () => {
        expect(isValidExpression(['==', 1, 1])).toBe(true);
        expect(isValidExpression(['!=', 1, 2])).toBe(true);
        expect(isValidExpression(['>', 2, 1])).toBe(true);
        expect(isValidExpression(['>=', 2, 1])).toBe(true);
        expect(isValidExpression(['<', 1, 2])).toBe(true);
        expect(isValidExpression(['<=', 1, 2])).toBe(true);
      });

      it('should accept logical operators', () => {
        expect(isValidExpression(['!', true])).toBe(true);
        expect(isValidExpression(['all', true, true])).toBe(true);
        expect(isValidExpression(['any', false, true])).toBe(true);
      });

      it('should accept arithmetic operators', () => {
        expect(isValidExpression(['+', 1, 2])).toBe(true);
        expect(isValidExpression(['-', 5, 3])).toBe(true);
        expect(isValidExpression(['*', 2, 3])).toBe(true);
        expect(isValidExpression(['/', 6, 2])).toBe(true);
        expect(isValidExpression(['%', 7, 3])).toBe(true);
      });

      it('should accept conditional operators', () => {
        expect(isValidExpression(['case', true, 'yes', 'no'])).toBe(true);
        expect(isValidExpression(['match', 'a', 'a', 1, 'b', 2])).toBe(true);
        expect(isValidExpression(['coalesce', null, 'default'])).toBe(true);
      });

      it('should accept string operators', () => {
        expect(isValidExpression(['concat', 'a', 'b'])).toBe(true);
        expect(isValidExpression(['upper', 'hello'])).toBe(true);
        expect(isValidExpression(['lower', 'HELLO'])).toBe(true);
        expect(isValidExpression(['trim', ' hello '])).toBe(true);
        expect(isValidExpression(['slice', 'hello', 0, 2])).toBe(true);
        expect(isValidExpression(['split', 'a,b', ','])).toBe(true);
        expect(isValidExpression(['join', ['a', 'b'], ','])).toBe(true);
        expect(isValidExpression(['matches', 'hello', 'h.*'])).toBe(true);
        expect(isValidExpression(['replace', 'hello', 'l', 'x'])).toBe(true);
      });

      it('should accept array operators', () => {
        expect(isValidExpression(['length', [1, 2, 3]])).toBe(true);
        expect(isValidExpression(['at', [1, 2], 0])).toBe(true);
        expect(isValidExpression(['first', [1, 2]])).toBe(true);
        expect(isValidExpression(['last', [1, 2]])).toBe(true);
        expect(isValidExpression(['includes', [1, 2], 1])).toBe(true);
        expect(isValidExpression(['indexOf', [1, 2], 2])).toBe(true);
        expect(isValidExpression(['map', [1, 2], ['get', '$']])).toBe(true);
        expect(isValidExpression(['filter', [1, 2], ['>', ['get', '$'], 0]])).toBe(true);
        expect(isValidExpression(['every', [1, 2], ['>', ['get', '$'], 0]])).toBe(true);
        expect(isValidExpression(['some', [1, 2], ['>', ['get', '$'], 0]])).toBe(true);
        expect(isValidExpression(['reduce', [1, 2], ['+', ['get', '$acc'], ['get', '$']], 0])).toBe(true);
        expect(isValidExpression(['flatten', [[1], [2]]])).toBe(true);
        expect(isValidExpression(['unique', [1, 1, 2]])).toBe(true);
        expect(isValidExpression(['sort', [3, 1, 2]])).toBe(true);
        expect(isValidExpression(['reverse', [1, 2, 3]])).toBe(true);
      });

      it('should accept number operators', () => {
        expect(isValidExpression(['sum', [1, 2, 3]])).toBe(true);
        expect(isValidExpression(['min', [1, 2, 3]])).toBe(true);
        expect(isValidExpression(['max', [1, 2, 3]])).toBe(true);
        expect(isValidExpression(['avg', [1, 2, 3]])).toBe(true);
        expect(isValidExpression(['count', [1, 2, 3]])).toBe(true);
        expect(isValidExpression(['round', 3.5])).toBe(true);
        expect(isValidExpression(['floor', 3.9])).toBe(true);
        expect(isValidExpression(['ceil', 3.1])).toBe(true);
        expect(isValidExpression(['abs', -5])).toBe(true);
        expect(isValidExpression(['clamp', 5, 0, 10])).toBe(true);
      });

      it('should accept object operators', () => {
        expect(isValidExpression(['has', ['get', 'data.obj'], 'key'])).toBe(true);
        expect(isValidExpression(['keys', ['get', 'data.obj']])).toBe(true);
        expect(isValidExpression(['values', ['get', 'data.obj']])).toBe(true);
        expect(isValidExpression(['entries', ['get', 'data.obj']])).toBe(true);
        expect(isValidExpression(['pick', ['get', 'data.obj'], ['a', 'b']])).toBe(true);
        expect(isValidExpression(['omit', ['get', 'data.obj'], ['c']])).toBe(true);
      });

      it('should accept type operators', () => {
        expect(isValidExpression(['isNull', null])).toBe(true);
        expect(isValidExpression(['isNumber', 42])).toBe(true);
        expect(isValidExpression(['isString', 'hi'])).toBe(true);
        expect(isValidExpression(['isArray', []])).toBe(true);
        expect(isValidExpression(['isObject', ['get', 'data.obj']])).toBe(true);
        expect(isValidExpression(['toNumber', '42'])).toBe(true);
        expect(isValidExpression(['toString', 42])).toBe(true);
      });

      it('should accept date operators', () => {
        expect(isValidExpression(['now'])).toBe(true);
        expect(isValidExpression(['date', '2024-01-01'])).toBe(true);
        expect(isValidExpression(['year', ['now']])).toBe(true);
        expect(isValidExpression(['month', ['now']])).toBe(true);
        expect(isValidExpression(['day', ['now']])).toBe(true);
        expect(isValidExpression(['diff', ['now'], ['now'], 'days'])).toBe(true);
      });
    });
  });

  // ===========================================
  // isGetExpr
  // ===========================================
  describe('isGetExpr', () => {
    it('should return true for get expression', () => {
      expect(isGetExpr(['get', 'data.name'])).toBe(true);
      expect(isGetExpr(['get', 'state.loading'])).toBe(true);
    });

    it('should return false for non-get expressions', () => {
      expect(isGetExpr(['+', 1, 2])).toBe(false);
      expect(isGetExpr(['concat', 'a', 'b'])).toBe(false);
    });

    it('should return false for invalid get expressions', () => {
      expect(isGetExpr(['get'])).toBe(false); // missing path
      expect(isGetExpr(['get', 'a', 'b', 'c'])).toBe(false); // too many args
    });

    it('should return false for primitives', () => {
      expect(isGetExpr('string' as any)).toBe(false);
      expect(isGetExpr(123 as any)).toBe(false);
      expect(isGetExpr(null as any)).toBe(false);
    });
  });

  // ===========================================
  // extractPaths
  // ===========================================
  describe('extractPaths', () => {
    it('should extract single path', () => {
      const expr: Expression = ['get', 'data.name'];
      expect(extractPaths(expr)).toEqual(['data.name']);
    });

    it('should extract multiple paths', () => {
      const expr: Expression = ['+', ['get', 'data.a'], ['get', 'data.b']];
      expect(extractPaths(expr)).toEqual(['data.a', 'data.b']);
    });

    it('should extract nested paths', () => {
      const expr: Expression = [
        'all',
        ['>', ['get', 'data.count'], 0],
        ['==', ['get', 'state.status'], 'active'],
      ];
      expect(extractPaths(expr)).toEqual(['data.count', 'state.status']);
    });

    it('should return empty array for primitive expressions', () => {
      expect(extractPaths(null)).toEqual([]);
      expect(extractPaths('string')).toEqual([]);
      expect(extractPaths(42)).toEqual([]);
      expect(extractPaths(true)).toEqual([]);
    });

    it('should return empty array for expressions without get', () => {
      const expr: Expression = ['+', 1, 2];
      expect(extractPaths(expr)).toEqual([]);
    });

    it('should extract paths from deeply nested expressions', () => {
      const expr: Expression = [
        'case',
        ['>', ['get', 'data.level'], 5],
        ['concat', ['get', 'data.prefix'], 'high'],
        ['concat', ['get', 'data.prefix'], 'low'],
      ];
      expect(extractPaths(expr)).toEqual(['data.level', 'data.prefix', 'data.prefix']);
    });

    it('should handle map/filter with context variables', () => {
      const expr: Expression = [
        'map',
        ['get', 'data.items'],
        ['*', ['get', '$'], 2],
      ];
      const paths = extractPaths(expr);
      expect(paths).toContain('data.items');
      expect(paths).toContain('$');
    });
  });

  // ===========================================
  // stringifyExpression
  // ===========================================
  describe('stringifyExpression', () => {
    it('should convert expression to JSON string', () => {
      const expr: Expression = ['get', 'data.name'];
      expect(stringifyExpression(expr)).toBe('["get","data.name"]');
    });

    it('should handle complex expressions', () => {
      const expr: Expression = ['+', ['get', 'data.a'], 10];
      const result = stringifyExpression(expr);
      expect(JSON.parse(result)).toEqual(expr);
    });

    it('should handle primitives', () => {
      expect(stringifyExpression(null)).toBe('null');
      expect(stringifyExpression('hello')).toBe('"hello"');
      expect(stringifyExpression(42)).toBe('42');
      expect(stringifyExpression(true)).toBe('true');
    });
  });

  // ===========================================
  // parseExpression
  // ===========================================
  describe('parseExpression', () => {
    it('should parse valid JSON to expression', () => {
      const json = '["get", "data.name"]';
      const result = parseExpression(json);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.expression).toEqual(['get', 'data.name']);
      }
    });

    it('should parse complex expressions', () => {
      const json = '["+", ["get", "data.a"], 10]';
      const result = parseExpression(json);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.expression).toEqual(['+', ['get', 'data.a'], 10]);
      }
    });

    it('should parse primitives', () => {
      expect(parseExpression('null')).toEqual({ ok: true, expression: null });
      expect(parseExpression('"hello"')).toEqual({ ok: true, expression: 'hello' });
      expect(parseExpression('42')).toEqual({ ok: true, expression: 42 });
      expect(parseExpression('true')).toEqual({ ok: true, expression: true });
    });

    it('should return error for invalid JSON', () => {
      const result = parseExpression('not valid json');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('JSON parse error');
      }
    });

    it('should return error for invalid expression structure', () => {
      const result = parseExpression('["invalidOp", 1]');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Invalid expression structure');
      }
    });

    it('should return error for empty array', () => {
      const result = parseExpression('[]');

      expect(result.ok).toBe(false);
    });
  });

  // ===========================================
  // expressionToString
  // ===========================================
  describe('expressionToString', () => {
    describe('primitives', () => {
      it('should format null', () => {
        expect(expressionToString(null)).toBe('null');
      });

      it('should format string with quotes', () => {
        expect(expressionToString('hello')).toBe('"hello"');
      });

      it('should format number', () => {
        expect(expressionToString(42)).toBe('42');
        expect(expressionToString(-3.14)).toBe('-3.14');
      });

      it('should format boolean', () => {
        expect(expressionToString(true)).toBe('true');
        expect(expressionToString(false)).toBe('false');
      });
    });

    describe('get expressions', () => {
      it('should format get as $path', () => {
        expect(expressionToString(['get', 'data.name'])).toBe('$data.name');
        expect(expressionToString(['get', 'state.loading'])).toBe('$state.loading');
      });
    });

    describe('comparison and arithmetic', () => {
      it('should format binary operators with infix notation', () => {
        expect(expressionToString(['==', ['get', 'data.a'], 1])).toBe('($data.a == 1)');
        expect(expressionToString(['!=', ['get', 'data.a'], 1])).toBe('($data.a != 1)');
        expect(expressionToString(['>', ['get', 'data.count'], 0])).toBe('($data.count > 0)');
        expect(expressionToString(['>=', 5, 3])).toBe('(5 >= 3)');
        expect(expressionToString(['<', 1, 2])).toBe('(1 < 2)');
        expect(expressionToString(['<=', 1, 1])).toBe('(1 <= 1)');
      });

      it('should format arithmetic operators', () => {
        expect(expressionToString(['+', 1, 2])).toBe('(1 + 2)');
        expect(expressionToString(['-', 5, 3])).toBe('(5 - 3)');
        expect(expressionToString(['*', 2, 3])).toBe('(2 * 3)');
        expect(expressionToString(['/', 6, 2])).toBe('(6 / 2)');
        expect(expressionToString(['%', 7, 3])).toBe('(7 % 3)');
      });
    });

    describe('logical operators', () => {
      it('should format not operator', () => {
        expect(expressionToString(['!', true])).toBe('!true');
        expect(expressionToString(['!', ['get', 'data.active']])).toBe('!$data.active');
      });

      it('should format all with &&', () => {
        expect(expressionToString(['all', true, false])).toBe('(true && false)');
        expect(expressionToString(['all', ['get', 'a'], ['get', 'b'], ['get', 'c']]))
          .toBe('($a && $b && $c)');
      });

      it('should format any with ||', () => {
        expect(expressionToString(['any', true, false])).toBe('(true || false)');
        expect(expressionToString(['any', ['get', 'a'], ['get', 'b']]))
          .toBe('($a || $b)');
      });
    });

    describe('function-style operators', () => {
      it('should format other operators as function calls', () => {
        expect(expressionToString(['concat', 'a', 'b'])).toBe('concat("a", "b")');
        expect(expressionToString(['upper', 'hello'])).toBe('upper("hello")');
        expect(expressionToString(['length', ['get', 'data.items']])).toBe('length($data.items)');
      });

      it('should handle nested function calls', () => {
        expect(expressionToString(['upper', ['concat', 'a', 'b']])).toBe('upper(concat("a", "b"))');
      });

      it('should handle mixed arguments', () => {
        expect(expressionToString(['slice', ['get', 'data.text'], 0, 5]))
          .toBe('slice($data.text, 0, 5)');
      });
    });

    describe('complex nested expressions', () => {
      it('should handle deeply nested expressions', () => {
        const expr: Expression = [
          'all',
          ['>', ['get', 'data.count'], 0],
          ['==', ['get', 'state.status'], 'active'],
        ];
        expect(expressionToString(expr)).toBe('(($data.count > 0) && ($state.status == "active"))');
      });
    });
  });
});
