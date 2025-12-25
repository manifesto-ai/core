import { describe, it, expect } from 'vitest';
import { evaluate } from '../../src/expression/evaluator.js';
import type { Expression, EvaluationContext } from '../../src/expression/types.js';

describe('Expression Evaluator', () => {
  const createContext = (values: Record<string, unknown>): EvaluationContext => ({
    get: (path) => values[path],
  });

  describe('Literals', () => {
    it('should evaluate string literals', () => {
      const result = evaluate('hello', createContext({}));
      expect(result).toEqual({ ok: true, value: 'hello' });
    });

    it('should evaluate number literals', () => {
      const result = evaluate(42, createContext({}));
      expect(result).toEqual({ ok: true, value: 42 });
    });

    it('should evaluate boolean literals', () => {
      expect(evaluate(true, createContext({}))).toEqual({ ok: true, value: true });
      expect(evaluate(false, createContext({}))).toEqual({ ok: true, value: false });
    });

    it('should evaluate null literals', () => {
      const result = evaluate(null, createContext({}));
      expect(result).toEqual({ ok: true, value: null });
    });
  });

  describe('Get Expression', () => {
    it('should get value from context', () => {
      const ctx = createContext({ 'data.name': 'John' });
      const result = evaluate(['get', 'data.name'], ctx);
      expect(result).toEqual({ ok: true, value: 'John' });
    });

    it('should return undefined for missing path', () => {
      const ctx = createContext({});
      const result = evaluate(['get', 'data.missing'], ctx);
      expect(result).toEqual({ ok: true, value: undefined });
    });

    it('should get current context value with $', () => {
      const ctx: EvaluationContext = {
        get: () => undefined,
        current: { name: 'John', age: 30 },
      };
      const result = evaluate(['get', '$'], ctx);
      expect(result).toEqual({ ok: true, value: { name: 'John', age: 30 } });
    });

    it('should get nested value from current context', () => {
      const ctx: EvaluationContext = {
        get: () => undefined,
        current: { name: 'John', age: 30 },
      };
      const result = evaluate(['get', '$.name'], ctx);
      expect(result).toEqual({ ok: true, value: 'John' });
    });
  });

  describe('Comparison Operators', () => {
    it('should evaluate equality', () => {
      const ctx = createContext({ 'data.a': 5, 'data.b': 5 });
      const result = evaluate(['==', ['get', 'data.a'], ['get', 'data.b']], ctx);
      expect(result).toEqual({ ok: true, value: true });
    });

    it('should evaluate inequality', () => {
      const ctx = createContext({ 'data.a': 5, 'data.b': 3 });
      const result = evaluate(['!=', ['get', 'data.a'], ['get', 'data.b']], ctx);
      expect(result).toEqual({ ok: true, value: true });
    });

    it('should evaluate greater than', () => {
      const ctx = createContext({ 'data.a': 5, 'data.b': 3 });
      const result = evaluate(['>', ['get', 'data.a'], ['get', 'data.b']], ctx);
      expect(result).toEqual({ ok: true, value: true });
    });

    it('should evaluate less than', () => {
      const ctx = createContext({ 'data.a': 3, 'data.b': 5 });
      const result = evaluate(['<', ['get', 'data.a'], ['get', 'data.b']], ctx);
      expect(result).toEqual({ ok: true, value: true });
    });
  });

  describe('Logical Operators', () => {
    it('should evaluate NOT', () => {
      const result = evaluate(['!', true], createContext({}));
      expect(result).toEqual({ ok: true, value: false });
    });

    it('should evaluate ALL (AND)', () => {
      const result = evaluate(['all', true, true, true], createContext({}));
      expect(result).toEqual({ ok: true, value: true });

      const result2 = evaluate(['all', true, false, true], createContext({}));
      expect(result2).toEqual({ ok: true, value: false });
    });

    it('should evaluate ANY (OR)', () => {
      const result = evaluate(['any', false, false, true], createContext({}));
      expect(result).toEqual({ ok: true, value: true });

      const result2 = evaluate(['any', false, false, false], createContext({}));
      expect(result2).toEqual({ ok: true, value: false });
    });
  });

  describe('Arithmetic Operators', () => {
    it('should add numbers', () => {
      const result = evaluate(['+', 2, 3], createContext({}));
      expect(result).toEqual({ ok: true, value: 5 });
    });

    it('should subtract numbers', () => {
      const result = evaluate(['-', 5, 3], createContext({}));
      expect(result).toEqual({ ok: true, value: 2 });
    });

    it('should multiply numbers', () => {
      const result = evaluate(['*', 4, 3], createContext({}));
      expect(result).toEqual({ ok: true, value: 12 });
    });

    it('should divide numbers', () => {
      const result = evaluate(['/', 10, 2], createContext({}));
      expect(result).toEqual({ ok: true, value: 5 });
    });

    it('should calculate modulo', () => {
      const result = evaluate(['%', 10, 3], createContext({}));
      expect(result).toEqual({ ok: true, value: 1 });
    });
  });

  describe('String Functions', () => {
    it('should concatenate strings', () => {
      const result = evaluate(['concat', 'Hello', ' ', 'World'], createContext({}));
      expect(result).toEqual({ ok: true, value: 'Hello World' });
    });

    it('should convert to uppercase', () => {
      const result = evaluate(['upper', 'hello'], createContext({}));
      expect(result).toEqual({ ok: true, value: 'HELLO' });
    });

    it('should convert to lowercase', () => {
      const result = evaluate(['lower', 'HELLO'], createContext({}));
      expect(result).toEqual({ ok: true, value: 'hello' });
    });

    it('should trim whitespace', () => {
      const result = evaluate(['trim', '  hello  '], createContext({}));
      expect(result).toEqual({ ok: true, value: 'hello' });
    });
  });

  describe('Array Functions', () => {
    it('should get array length', () => {
      const ctx = createContext({ 'data.arr': [1, 2, 3, 4, 5] });
      const result = evaluate(['length', ['get', 'data.arr']], ctx);
      expect(result).toEqual({ ok: true, value: 5 });
    });

    it('should get element at index', () => {
      const ctx = createContext({ 'data.arr': ['a', 'b', 'c'] });
      const result = evaluate(['at', ['get', 'data.arr'], 1], ctx);
      expect(result).toEqual({ ok: true, value: 'b' });
    });

    it('should map over array', () => {
      const ctx = createContext({ 'data.arr': [1, 2, 3] });
      const result = evaluate(
        ['map', ['get', 'data.arr'], ['*', ['get', '$'], 2]],
        ctx
      );
      expect(result).toEqual({ ok: true, value: [2, 4, 6] });
    });

    it('should filter array', () => {
      const ctx = createContext({ 'data.arr': [1, 2, 3, 4, 5] });
      const result = evaluate(
        ['filter', ['get', 'data.arr'], ['>', ['get', '$'], 2]],
        ctx
      );
      expect(result).toEqual({ ok: true, value: [3, 4, 5] });
    });

    it('should check every element', () => {
      const ctx = createContext({ 'data.arr': [2, 4, 6] });
      const result = evaluate(
        ['every', ['get', 'data.arr'], ['==', ['%', ['get', '$'], 2], 0]],
        ctx
      );
      expect(result).toEqual({ ok: true, value: true });
    });

    it('should check some elements', () => {
      const ctx = createContext({ 'data.arr': [1, 2, 3] });
      const result = evaluate(
        ['some', ['get', 'data.arr'], ['>', ['get', '$'], 2]],
        ctx
      );
      expect(result).toEqual({ ok: true, value: true });
    });
  });

  describe('Number Functions', () => {
    it('should sum array', () => {
      const ctx = createContext({ 'data.arr': [1, 2, 3, 4, 5] });
      const result = evaluate(['sum', ['get', 'data.arr']], ctx);
      expect(result).toEqual({ ok: true, value: 15 });
    });

    it('should find min', () => {
      const ctx = createContext({ 'data.arr': [3, 1, 4, 1, 5] });
      const result = evaluate(['min', ['get', 'data.arr']], ctx);
      expect(result).toEqual({ ok: true, value: 1 });
    });

    it('should find max', () => {
      const ctx = createContext({ 'data.arr': [3, 1, 4, 1, 5] });
      const result = evaluate(['max', ['get', 'data.arr']], ctx);
      expect(result).toEqual({ ok: true, value: 5 });
    });

    it('should round number', () => {
      const result = evaluate(['round', 3.7], createContext({}));
      expect(result).toEqual({ ok: true, value: 4 });
    });

    it('should clamp number', () => {
      const result = evaluate(['clamp', 15, 0, 10], createContext({}));
      expect(result).toEqual({ ok: true, value: 10 });
    });
  });

  describe('Conditional Expressions', () => {
    it('should evaluate case expression', () => {
      const ctx = createContext({ 'data.score': 85 });
      const expr: Expression = [
        'case',
        ['>=', ['get', 'data.score'], 90],
        'A',
        ['>=', ['get', 'data.score'], 80],
        'B',
        ['>=', ['get', 'data.score'], 70],
        'C',
        'F',
      ];
      const result = evaluate(expr, ctx);
      expect(result).toEqual({ ok: true, value: 'B' });
    });

    it('should evaluate match expression', () => {
      const ctx = createContext({ 'data.status': 'pending' });
      const expr: Expression = [
        'match',
        ['get', 'data.status'],
        'pending',
        'Waiting',
        'processing',
        'In Progress',
        'completed',
        'Done',
        'Unknown',
      ];
      const result = evaluate(expr, ctx);
      expect(result).toEqual({ ok: true, value: 'Waiting' });
    });

    it('should evaluate coalesce expression', () => {
      const ctx = createContext({ 'data.a': null, 'data.b': undefined, 'data.c': 'value' });
      const expr: Expression = [
        'coalesce',
        ['get', 'data.a'],
        ['get', 'data.b'],
        ['get', 'data.c'],
      ];
      const result = evaluate(expr, ctx);
      expect(result).toEqual({ ok: true, value: 'value' });
    });
  });

  describe('Polymorphic Operators (String & Array)', () => {
    describe('concat', () => {
      it('should concatenate strings', () => {
        const result = evaluate(['concat', 'Hello', ' ', 'World'], createContext({}));
        expect(result).toEqual({ ok: true, value: 'Hello World' });
      });

      it('should concatenate arrays when first arg is array', () => {
        const ctx = createContext({ 'arr1': [1, 2], 'arr2': [3, 4], 'arr3': [5] });
        const result = evaluate(['concat', ['get', 'arr1'], ['get', 'arr2'], ['get', 'arr3']], ctx);
        expect(result).toEqual({ ok: true, value: [1, 2, 3, 4, 5] });
      });

      it('should handle empty array concat', () => {
        const ctx = createContext({ 'arr1': [], 'arr2': [1, 2], 'arr3': [] });
        const result = evaluate(['concat', ['get', 'arr1'], ['get', 'arr2'], ['get', 'arr3']], ctx);
        expect(result).toEqual({ ok: true, value: [1, 2] });
      });

      it('should return empty string for no args', () => {
        const result = evaluate(['concat'], createContext({}));
        expect(result).toEqual({ ok: true, value: '' });
      });
    });

    describe('length', () => {
      it('should get string length', () => {
        const result = evaluate(['length', 'hello'], createContext({}));
        expect(result).toEqual({ ok: true, value: 5 });
      });

      it('should get array length', () => {
        const ctx = createContext({ 'arr': [1, 2, 3] });
        const result = evaluate(['length', ['get', 'arr']], ctx);
        expect(result).toEqual({ ok: true, value: 3 });
      });

      it('should return 0 for empty string', () => {
        const result = evaluate(['length', ''], createContext({}));
        expect(result).toEqual({ ok: true, value: 0 });
      });

      it('should return 0 for empty array', () => {
        const ctx = createContext({ 'arr': [] });
        const result = evaluate(['length', ['get', 'arr']], ctx);
        expect(result).toEqual({ ok: true, value: 0 });
      });

      it('should return 0 for non-string/array', () => {
        const result = evaluate(['length', 123], createContext({}));
        expect(result).toEqual({ ok: true, value: 0 });
      });
    });

    describe('slice', () => {
      it('should slice string', () => {
        const result = evaluate(['slice', 'hello world', 0, 5], createContext({}));
        expect(result).toEqual({ ok: true, value: 'hello' });
      });

      it('should slice array', () => {
        const ctx = createContext({ 'arr': [1, 2, 3, 4, 5] });
        const result = evaluate(['slice', ['get', 'arr'], 1, 4], ctx);
        expect(result).toEqual({ ok: true, value: [2, 3, 4] });
      });

      it('should handle negative indices for string', () => {
        const result = evaluate(['slice', 'hello', -2], createContext({}));
        expect(result).toEqual({ ok: true, value: 'lo' });
      });

      it('should handle negative indices for array', () => {
        const ctx = createContext({ 'arr': [1, 2, 3, 4, 5] });
        const result = evaluate(['slice', ['get', 'arr'], -2], ctx);
        expect(result).toEqual({ ok: true, value: [4, 5] });
      });
    });

    describe('includes', () => {
      it('should check string includes', () => {
        const result = evaluate(['includes', 'hello world', 'world'], createContext({}));
        expect(result).toEqual({ ok: true, value: true });
      });

      it('should check array includes', () => {
        const ctx = createContext({ 'arr': [1, 2, 3] });
        const result = evaluate(['includes', ['get', 'arr'], 2], ctx);
        expect(result).toEqual({ ok: true, value: true });
      });

      it('should return false for string not included', () => {
        const result = evaluate(['includes', 'hello', 'world'], createContext({}));
        expect(result).toEqual({ ok: true, value: false });
      });

      it('should return false for element not in array', () => {
        const ctx = createContext({ 'arr': [1, 2, 3] });
        const result = evaluate(['includes', ['get', 'arr'], 4], ctx);
        expect(result).toEqual({ ok: true, value: false });
      });
    });

    describe('indexOf', () => {
      it('should find index in string', () => {
        const result = evaluate(['indexOf', 'hello world', 'world'], createContext({}));
        expect(result).toEqual({ ok: true, value: 6 });
      });

      it('should find index in array', () => {
        const ctx = createContext({ 'arr': ['a', 'b', 'c'] });
        const result = evaluate(['indexOf', ['get', 'arr'], 'b'], ctx);
        expect(result).toEqual({ ok: true, value: 1 });
      });

      it('should return -1 for string not found', () => {
        const result = evaluate(['indexOf', 'hello', 'world'], createContext({}));
        expect(result).toEqual({ ok: true, value: -1 });
      });

      it('should return -1 for element not in array', () => {
        const ctx = createContext({ 'arr': [1, 2, 3] });
        const result = evaluate(['indexOf', ['get', 'arr'], 4], ctx);
        expect(result).toEqual({ ok: true, value: -1 });
      });
    });

    describe('at', () => {
      it('should get character at index in string', () => {
        const result = evaluate(['at', 'hello', 1], createContext({}));
        expect(result).toEqual({ ok: true, value: 'e' });
      });

      it('should get element at index in array', () => {
        const ctx = createContext({ 'arr': ['a', 'b', 'c'] });
        const result = evaluate(['at', ['get', 'arr'], 2], ctx);
        expect(result).toEqual({ ok: true, value: 'c' });
      });

      it('should handle negative index for string', () => {
        const result = evaluate(['at', 'hello', -1], createContext({}));
        expect(result).toEqual({ ok: true, value: 'o' });
      });

      it('should handle negative index for array', () => {
        const ctx = createContext({ 'arr': [1, 2, 3] });
        const result = evaluate(['at', ['get', 'arr'], -1], ctx);
        expect(result).toEqual({ ok: true, value: 3 });
      });

      it('should return null for out of bounds string', () => {
        const result = evaluate(['at', 'hi', 10], createContext({}));
        expect(result).toEqual({ ok: true, value: null });
      });

      it('should return null for out of bounds array', () => {
        const ctx = createContext({ 'arr': [1, 2] });
        const result = evaluate(['at', ['get', 'arr'], 10], ctx);
        expect(result).toEqual({ ok: true, value: null });
      });
    });

    describe('isEmpty', () => {
      it('should return true for empty string', () => {
        const result = evaluate(['isEmpty', ''], createContext({}));
        expect(result).toEqual({ ok: true, value: true });
      });

      it('should return false for non-empty string', () => {
        const result = evaluate(['isEmpty', 'hello'], createContext({}));
        expect(result).toEqual({ ok: true, value: false });
      });

      it('should return true for empty array', () => {
        const ctx = createContext({ 'arr': [] });
        const result = evaluate(['isEmpty', ['get', 'arr']], ctx);
        expect(result).toEqual({ ok: true, value: true });
      });

      it('should return false for non-empty array', () => {
        const ctx = createContext({ 'arr': [1, 2, 3] });
        const result = evaluate(['isEmpty', ['get', 'arr']], ctx);
        expect(result).toEqual({ ok: true, value: false });
      });

      it('should return true for null', () => {
        const result = evaluate(['isEmpty', null], createContext({}));
        expect(result).toEqual({ ok: true, value: true });
      });
    });
  });

  describe('Tier 1: Array Manipulation', () => {
    it('should append element to array', () => {
      const ctx = createContext({ 'arr': [1, 2, 3] });
      const result = evaluate(['append', ['get', 'arr'], 4], ctx);
      expect(result).toEqual({ ok: true, value: [1, 2, 3, 4] });
    });

    it('should prepend element to array', () => {
      const ctx = createContext({ 'arr': [1, 2, 3] });
      const result = evaluate(['prepend', ['get', 'arr'], 0], ctx);
      expect(result).toEqual({ ok: true, value: [0, 1, 2, 3] });
    });
  });

  describe('Tier 2: FP Patterns', () => {
    it('should take first n elements', () => {
      const ctx = createContext({ 'arr': [1, 2, 3, 4, 5] });
      const result = evaluate(['take', ['get', 'arr'], 3], ctx);
      expect(result).toEqual({ ok: true, value: [1, 2, 3] });
    });

    it('should handle take with n > length', () => {
      const ctx = createContext({ 'arr': [1, 2] });
      const result = evaluate(['take', ['get', 'arr'], 5], ctx);
      expect(result).toEqual({ ok: true, value: [1, 2] });
    });

    it('should drop first n elements', () => {
      const ctx = createContext({ 'arr': [1, 2, 3, 4, 5] });
      const result = evaluate(['drop', ['get', 'arr'], 2], ctx);
      expect(result).toEqual({ ok: true, value: [3, 4, 5] });
    });

    it('should find first matching element', () => {
      const ctx = createContext({ 'arr': [1, 2, 3, 4, 5] });
      const result = evaluate(['find', ['get', 'arr'], ['>', ['get', '$'], 3]], ctx);
      expect(result).toEqual({ ok: true, value: 4 });
    });

    it('should return undefined when find has no match', () => {
      const ctx = createContext({ 'arr': [1, 2, 3] });
      const result = evaluate(['find', ['get', 'arr'], ['>', ['get', '$'], 10]], ctx);
      expect(result).toEqual({ ok: true, value: undefined });
    });

    it('should findIndex of first matching element', () => {
      const ctx = createContext({ 'arr': [1, 2, 3, 4, 5] });
      const result = evaluate(['findIndex', ['get', 'arr'], ['>', ['get', '$'], 3]], ctx);
      expect(result).toEqual({ ok: true, value: 3 });
    });

    it('should return -1 when findIndex has no match', () => {
      const ctx = createContext({ 'arr': [1, 2, 3] });
      const result = evaluate(['findIndex', ['get', 'arr'], ['>', ['get', '$'], 10]], ctx);
      expect(result).toEqual({ ok: true, value: -1 });
    });

    it('should generate range', () => {
      const result = evaluate(['range', 1, 5], createContext({}));
      expect(result).toEqual({ ok: true, value: [1, 2, 3, 4, 5] });
    });

    it('should return empty array for invalid range', () => {
      const result = evaluate(['range', 5, 1], createContext({}));
      expect(result).toEqual({ ok: true, value: [] });
    });
  });

  describe('Tier 3: Advanced Transformations', () => {
    it('should zip two arrays', () => {
      const ctx = createContext({ 'arr1': [1, 2, 3], 'arr2': ['a', 'b', 'c'] });
      const result = evaluate(['zip', ['get', 'arr1'], ['get', 'arr2']], ctx);
      expect(result).toEqual({ ok: true, value: [[1, 'a'], [2, 'b'], [3, 'c']] });
    });

    it('should zip arrays of different lengths (shorter wins)', () => {
      const ctx = createContext({ 'arr1': [1, 2], 'arr2': ['a', 'b', 'c'] });
      const result = evaluate(['zip', ['get', 'arr1'], ['get', 'arr2']], ctx);
      expect(result).toEqual({ ok: true, value: [[1, 'a'], [2, 'b']] });
    });

    it('should partition array by predicate', () => {
      const ctx = createContext({ 'arr': [1, 2, 3, 4, 5] });
      const result = evaluate(['partition', ['get', 'arr'], ['>', ['get', '$'], 3]], ctx);
      expect(result).toEqual({ ok: true, value: [[4, 5], [1, 2, 3]] });
    });

    it('should group by key expression', () => {
      const ctx = createContext({
        'arr': [{ type: 'a', val: 1 }, { type: 'b', val: 2 }, { type: 'a', val: 3 }],
      });
      const result = evaluate(['groupBy', ['get', 'arr'], ['get', '$.type']], ctx);
      expect(result).toEqual({
        ok: true,
        value: {
          a: [{ type: 'a', val: 1 }, { type: 'a', val: 3 }],
          b: [{ type: 'b', val: 2 }],
        },
      });
    });

    it('should chunk array', () => {
      const ctx = createContext({ 'arr': [1, 2, 3, 4, 5] });
      const result = evaluate(['chunk', ['get', 'arr'], 2], ctx);
      expect(result).toEqual({ ok: true, value: [[1, 2], [3, 4], [5]] });
    });

    it('should compact array (remove falsy values)', () => {
      const ctx = createContext({ 'arr': [1, 0, 2, null, 3, '', false, 4] });
      const result = evaluate(['compact', ['get', 'arr']], ctx);
      expect(result).toEqual({ ok: true, value: [1, 2, 3, 4] });
    });
  });

  describe('Complex Expressions', () => {
    it('should evaluate PRD example: canBulkShip', () => {
      const ctx = createContext({
        'data.selectedIds': ['1', '2', '3'],
        'derived.selectedStatuses': ['pending', 'pending', 'pending'],
      });

      const expr: Expression = [
        'all',
        ['>', ['length', ['get', 'data.selectedIds']], 0],
        ['every', ['get', 'derived.selectedStatuses'], ['==', ['get', '$'], 'pending']],
      ];

      const result = evaluate(expr, ctx);
      expect(result).toEqual({ ok: true, value: true });
    });

    it('should evaluate PRD example: canBulkShip (false case)', () => {
      const ctx = createContext({
        'data.selectedIds': ['1', '2', '3'],
        'derived.selectedStatuses': ['pending', 'processing', 'pending'],
      });

      const expr: Expression = [
        'all',
        ['>', ['length', ['get', 'data.selectedIds']], 0],
        ['every', ['get', 'derived.selectedStatuses'], ['==', ['get', '$'], 'pending']],
      ];

      const result = evaluate(expr, ctx);
      expect(result).toEqual({ ok: true, value: false });
    });
  });

  describe('Object Manipulation Operators', () => {
    it('should add new key with assoc', () => {
      const ctx = createContext({ 'obj': { a: 1, b: 2 } });
      const result = evaluate(['assoc', ['get', 'obj'], 'c', 3], ctx);
      expect(result).toEqual({ ok: true, value: { a: 1, b: 2, c: 3 } });
    });

    it('should update existing key with assoc', () => {
      const ctx = createContext({ 'obj': { a: 1, b: 2 } });
      const result = evaluate(['assoc', ['get', 'obj'], 'a', 100], ctx);
      expect(result).toEqual({ ok: true, value: { a: 100, b: 2 } });
    });

    it('should use evaluated value with assoc', () => {
      const ctx = createContext({ 'obj': { count: 5 } });
      const result = evaluate(['assoc', ['get', 'obj'], 'doubled', ['*', ['get', '$.count'], 2]], {
        ...ctx,
        current: ctx.get('obj'),
      });
      expect(result).toEqual({ ok: true, value: { count: 5, doubled: 10 } });
    });

    it('should remove key with dissoc', () => {
      const ctx = createContext({ 'obj': { a: 1, b: 2, c: 3 } });
      const result = evaluate(['dissoc', ['get', 'obj'], 'b'], ctx);
      expect(result).toEqual({ ok: true, value: { a: 1, c: 3 } });
    });

    it('should handle non-existent key with dissoc', () => {
      const ctx = createContext({ 'obj': { a: 1, b: 2 } });
      const result = evaluate(['dissoc', ['get', 'obj'], 'z'], ctx);
      expect(result).toEqual({ ok: true, value: { a: 1, b: 2 } });
    });

    it('should merge two objects', () => {
      const ctx = createContext({ 'obj1': { a: 1 }, 'obj2': { b: 2 } });
      const result = evaluate(['merge', ['get', 'obj1'], ['get', 'obj2']], ctx);
      expect(result).toEqual({ ok: true, value: { a: 1, b: 2 } });
    });

    it('should merge multiple objects', () => {
      const ctx = createContext({ 'obj1': { a: 1 }, 'obj2': { b: 2 }, 'obj3': { c: 3 } });
      const result = evaluate(['merge', ['get', 'obj1'], ['get', 'obj2'], ['get', 'obj3']], ctx);
      expect(result).toEqual({ ok: true, value: { a: 1, b: 2, c: 3 } });
    });

    it('should override earlier keys with later ones in merge', () => {
      const ctx = createContext({ 'obj1': { a: 1, b: 2 }, 'obj2': { b: 100, c: 3 } });
      const result = evaluate(['merge', ['get', 'obj1'], ['get', 'obj2']], ctx);
      expect(result).toEqual({ ok: true, value: { a: 1, b: 100, c: 3 } });
    });

    it('should merge empty object', () => {
      const ctx = createContext({ 'obj1': { a: 1 }, 'obj2': {} });
      const result = evaluate(['merge', ['get', 'obj1'], ['get', 'obj2']], ctx);
      expect(result).toEqual({ ok: true, value: { a: 1 } });
    });
  });

  describe('Utility Operators', () => {
    it('should generate UUID', () => {
      const result = evaluate(['uuid'], createContext({}));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(typeof result.value).toBe('string');
        // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        expect(result.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      }
    });

    it('should generate unique UUIDs', () => {
      const result1 = evaluate(['uuid'], createContext({}));
      const result2 = evaluate(['uuid'], createContext({}));
      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      if (result1.ok && result2.ok) {
        expect(result1.value).not.toBe(result2.value);
      }
    });
  });

  describe('Object manipulation in map context', () => {
    it('should use assoc inside map to update items', () => {
      const ctx = createContext({
        'items': [
          { id: '1', active: false },
          { id: '2', active: false },
        ],
      });
      const result = evaluate(
        ['map', ['get', 'items'], ['assoc', ['get', '$'], 'active', true]],
        ctx
      );
      expect(result).toEqual({
        ok: true,
        value: [
          { id: '1', active: true },
          { id: '2', active: true },
        ],
      });
    });

    it('should conditionally update with case and assoc', () => {
      const ctx = createContext({
        'items': [
          { id: '1', count: 5 },
          { id: '2', count: 10 },
        ],
        'targetId': '1',
      });
      const result = evaluate(
        ['map', ['get', 'items'],
          ['case',
            ['==', ['get', '$.id'], ['get', 'targetId']],
            ['assoc', ['get', '$'], 'count', ['+', ['get', '$.count'], 1]],
            ['get', '$']
          ]
        ],
        ctx
      );
      expect(result).toEqual({
        ok: true,
        value: [
          { id: '1', count: 6 },
          { id: '2', count: 10 },
        ],
      });
    });
  });
});
