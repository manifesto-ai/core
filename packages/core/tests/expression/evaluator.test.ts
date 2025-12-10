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
});
