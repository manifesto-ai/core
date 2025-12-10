import { describe, it, expect } from 'vitest';
import {
  analyzeExpression,
  isPureExpression,
  isConstantExpression,
  areExpressionsEqual,
  optimizeExpression,
  substitutePathWithValue,
} from '../../src/expression/analyzer.js';
import type { Expression } from '../../src/expression/types.js';

describe('analyzer', () => {
  // ===========================================
  // analyzeExpression
  // ===========================================
  describe('analyzeExpression', () => {
    describe('directDeps', () => {
      it('should extract direct dependencies', () => {
        const expr: Expression = ['get', 'data.name'];
        const analysis = analyzeExpression(expr);

        expect(analysis.directDeps).toEqual(['data.name']);
      });

      it('should extract multiple dependencies', () => {
        const expr: Expression = ['+', ['get', 'data.a'], ['get', 'data.b']];
        const analysis = analyzeExpression(expr);

        expect(analysis.directDeps).toEqual(['data.a', 'data.b']);
      });

      it('should return empty array for no dependencies', () => {
        const expr: Expression = ['+', 1, 2];
        const analysis = analyzeExpression(expr);

        expect(analysis.directDeps).toEqual([]);
      });
    });

    describe('operators', () => {
      it('should collect single operator', () => {
        const expr: Expression = ['get', 'data.name'];
        const analysis = analyzeExpression(expr);

        expect(analysis.operators).toEqual(['get']);
      });

      it('should collect multiple operators', () => {
        const expr: Expression = ['+', ['get', 'data.a'], ['*', ['get', 'data.b'], 2]];
        const analysis = analyzeExpression(expr);

        expect(analysis.operators).toContain('+');
        expect(analysis.operators).toContain('get');
        expect(analysis.operators).toContain('*');
      });

      it('should deduplicate operators', () => {
        const expr: Expression = ['+', ['get', 'data.a'], ['get', 'data.b']];
        const analysis = analyzeExpression(expr);

        // Two get operations but only one in the set
        const getCount = analysis.operators.filter(op => op === 'get').length;
        expect(getCount).toBe(1);
      });
    });

    describe('complexity', () => {
      it('should count primitive as 1', () => {
        const analysis = analyzeExpression('hello');
        expect(analysis.complexity).toBe(1);
      });

      it('should count null as 1', () => {
        const analysis = analyzeExpression(null);
        expect(analysis.complexity).toBe(1);
      });

      it('should count simple expression nodes', () => {
        const expr: Expression = ['get', 'data.name'];
        const analysis = analyzeExpression(expr);

        // ['get', 'data.name'] = 1 for array, 'data.name' = 1 for string arg
        expect(analysis.complexity).toBe(2);
      });

      it('should count nested nodes', () => {
        const expr: Expression = ['+', ['get', 'data.a'], ['get', 'data.b']];
        const analysis = analyzeExpression(expr);

        // ['+', ...] = 1, ['get', 'a'] = 1 + 1, ['get', 'b'] = 1 + 1
        expect(analysis.complexity).toBe(5);
      });

      it('should handle deep nesting', () => {
        const expr: Expression = [
          'all',
          ['>', ['get', 'data.x'], 0],
          ['<', ['get', 'data.y'], 100],
          ['!', ['get', 'data.disabled']],
        ];
        const analysis = analyzeExpression(expr);

        // all(1) > >(1) > get(1), <(1) > get(1), !(1) > get(1) = 7
        expect(analysis.complexity).toBeGreaterThan(5);
      });
    });

    describe('usesContext', () => {
      it('should detect context variable $', () => {
        const expr: Expression = ['map', ['get', 'data.items'], ['*', ['get', '$'], 2]];
        const analysis = analyzeExpression(expr);

        expect(analysis.usesContext).toBe(true);
      });

      it('should detect context variable $index', () => {
        const expr: Expression = ['map', ['get', 'data.items'], ['get', '$index']];
        const analysis = analyzeExpression(expr);

        expect(analysis.usesContext).toBe(true);
      });

      it('should detect context variable $acc', () => {
        const expr: Expression = ['reduce', ['get', 'data.nums'], ['+', ['get', '$acc'], ['get', '$']], 0];
        const analysis = analyzeExpression(expr);

        expect(analysis.usesContext).toBe(true);
      });

      it('should return false when no context variables', () => {
        const expr: Expression = ['+', ['get', 'data.a'], ['get', 'data.b']];
        const analysis = analyzeExpression(expr);

        expect(analysis.usesContext).toBe(false);
      });
    });
  });

  // ===========================================
  // isPureExpression
  // ===========================================
  describe('isPureExpression', () => {
    it('should return true for valid expressions', () => {
      expect(isPureExpression(['get', 'data.name'])).toBe(true);
      expect(isPureExpression(['+', 1, 2])).toBe(true);
      expect(isPureExpression(['concat', 'a', 'b'])).toBe(true);
    });

    it('should return true for primitives', () => {
      expect(isPureExpression(null)).toBe(true);
      expect(isPureExpression('string')).toBe(true);
      expect(isPureExpression(42)).toBe(true);
      expect(isPureExpression(true)).toBe(true);
    });

    it('should return false for invalid expressions', () => {
      expect(isPureExpression(['invalidOp', 1])).toBe(false);
      expect(isPureExpression([])).toBe(false);
    });
  });

  // ===========================================
  // isConstantExpression
  // ===========================================
  describe('isConstantExpression', () => {
    it('should return true for literals', () => {
      expect(isConstantExpression(null)).toBe(true);
      expect(isConstantExpression('hello')).toBe(true);
      expect(isConstantExpression(42)).toBe(true);
      expect(isConstantExpression(true)).toBe(true);
    });

    it('should return true for expressions without dependencies', () => {
      expect(isConstantExpression(['+', 1, 2])).toBe(true);
      expect(isConstantExpression(['concat', 'a', 'b'])).toBe(true);
      expect(isConstantExpression(['upper', 'hello'])).toBe(true);
    });

    it('should return false for expressions with dependencies', () => {
      expect(isConstantExpression(['get', 'data.name'])).toBe(false);
      expect(isConstantExpression(['+', ['get', 'data.a'], 1])).toBe(false);
    });

    it('should return false for expressions with context variables', () => {
      expect(isConstantExpression(['*', ['get', '$'], 2])).toBe(false);
    });
  });

  // ===========================================
  // areExpressionsEqual
  // ===========================================
  describe('areExpressionsEqual', () => {
    describe('primitives', () => {
      it('should compare null values', () => {
        expect(areExpressionsEqual(null, null)).toBe(true);
        expect(areExpressionsEqual(null, 'null')).toBe(false);
      });

      it('should compare strings', () => {
        expect(areExpressionsEqual('hello', 'hello')).toBe(true);
        expect(areExpressionsEqual('hello', 'world')).toBe(false);
      });

      it('should compare numbers', () => {
        expect(areExpressionsEqual(42, 42)).toBe(true);
        expect(areExpressionsEqual(42, 43)).toBe(false);
      });

      it('should compare booleans', () => {
        expect(areExpressionsEqual(true, true)).toBe(true);
        expect(areExpressionsEqual(true, false)).toBe(false);
      });

      it('should compare different types', () => {
        expect(areExpressionsEqual('42', 42)).toBe(false);
        expect(areExpressionsEqual(1, true)).toBe(false);
      });
    });

    describe('arrays', () => {
      it('should compare identical arrays', () => {
        expect(areExpressionsEqual(['get', 'data.name'], ['get', 'data.name'])).toBe(true);
      });

      it('should detect different operators', () => {
        expect(areExpressionsEqual(['get', 'data.name'], ['length', 'data.name'])).toBe(false);
      });

      it('should detect different arguments', () => {
        expect(areExpressionsEqual(['get', 'data.a'], ['get', 'data.b'])).toBe(false);
      });

      it('should detect different lengths', () => {
        expect(areExpressionsEqual(['+', 1, 2], ['+', 1, 2, 3])).toBe(false);
      });

      it('should compare nested expressions', () => {
        const a: Expression = ['+', ['get', 'data.x'], ['*', ['get', 'data.y'], 2]];
        const b: Expression = ['+', ['get', 'data.x'], ['*', ['get', 'data.y'], 2]];
        const c: Expression = ['+', ['get', 'data.x'], ['*', ['get', 'data.y'], 3]];

        expect(areExpressionsEqual(a, b)).toBe(true);
        expect(areExpressionsEqual(a, c)).toBe(false);
      });
    });

    describe('same reference', () => {
      it('should return true for same reference', () => {
        const expr: Expression = ['get', 'data.name'];
        expect(areExpressionsEqual(expr, expr)).toBe(true);
      });
    });
  });

  // ===========================================
  // optimizeExpression
  // ===========================================
  describe('optimizeExpression', () => {
    describe('primitives', () => {
      it('should return primitives unchanged', () => {
        expect(optimizeExpression(null)).toBe(null);
        expect(optimizeExpression('hello')).toBe('hello');
        expect(optimizeExpression(42)).toBe(42);
        expect(optimizeExpression(true)).toBe(true);
      });
    });

    describe('all optimization', () => {
      it('should short-circuit all with false literal', () => {
        const expr: Expression = ['all', true, false, ['get', 'data.x']];
        expect(optimizeExpression(expr)).toBe(false);
      });

      it('should simplify all with all true literals', () => {
        const expr: Expression = ['all', true, true, true];
        expect(optimizeExpression(expr)).toBe(true);
      });

      it('should preserve all with mixed values', () => {
        const expr: Expression = ['all', true, ['get', 'data.x']];
        const result = optimizeExpression(expr);

        expect(Array.isArray(result)).toBe(true);
        if (Array.isArray(result)) {
          expect(result[0]).toBe('all');
        }
      });
    });

    describe('any optimization', () => {
      it('should short-circuit any with true literal', () => {
        const expr: Expression = ['any', false, true, ['get', 'data.x']];
        expect(optimizeExpression(expr)).toBe(true);
      });

      it('should simplify any with all false literals', () => {
        const expr: Expression = ['any', false, false, false];
        expect(optimizeExpression(expr)).toBe(false);
      });

      it('should preserve any with mixed values', () => {
        const expr: Expression = ['any', false, ['get', 'data.x']];
        const result = optimizeExpression(expr);

        expect(Array.isArray(result)).toBe(true);
        if (Array.isArray(result)) {
          expect(result[0]).toBe('any');
        }
      });
    });

    describe('recursive optimization', () => {
      it('should optimize nested expressions', () => {
        const expr: Expression = ['!', ['all', false, true]];
        const result = optimizeExpression(expr);

        // Inner all(false, true) becomes false, result is ['!', false]
        expect(Array.isArray(result)).toBe(true);
        if (Array.isArray(result)) {
          expect(result[0]).toBe('!');
          expect(result[1]).toBe(false);
        }
      });

      it('should optimize deeply nested all/any', () => {
        const expr: Expression = ['all', ['any', true, false], ['any', false, false]];
        const result = optimizeExpression(expr);

        // First any becomes true, second becomes false
        // all(true, false) becomes false
        expect(result).toBe(false);
      });
    });

    describe('preserves structure', () => {
      it('should preserve expressions that cannot be optimized', () => {
        const expr: Expression = ['+', ['get', 'data.a'], ['get', 'data.b']];
        const result = optimizeExpression(expr);

        expect(result).toEqual(expr);
      });
    });
  });

  // ===========================================
  // substitutePathWithValue
  // ===========================================
  describe('substitutePathWithValue', () => {
    it('should substitute matching path', () => {
      const expr: Expression = ['get', 'data.name'];
      const result = substitutePathWithValue(expr, 'data.name', 'John');

      expect(result).toBe('John');
    });

    it('should not substitute non-matching path', () => {
      const expr: Expression = ['get', 'data.name'];
      const result = substitutePathWithValue(expr, 'data.other', 'value');

      expect(result).toEqual(['get', 'data.name']);
    });

    it('should substitute in nested expression', () => {
      const expr: Expression = ['+', ['get', 'data.a'], ['get', 'data.b']];
      const result = substitutePathWithValue(expr, 'data.a', 10);

      expect(result).toEqual(['+', 10, ['get', 'data.b']]);
    });

    it('should substitute multiple occurrences', () => {
      const expr: Expression = ['*', ['get', 'data.x'], ['get', 'data.x']];
      const result = substitutePathWithValue(expr, 'data.x', 5);

      expect(result).toEqual(['*', 5, 5]);
    });

    it('should handle deeply nested substitution', () => {
      const expr: Expression = [
        'case',
        ['>', ['get', 'data.value'], 0],
        ['+', ['get', 'data.value'], 1],
        ['get', 'data.value'],
      ];
      const result = substitutePathWithValue(expr, 'data.value', 100);

      expect(result).toEqual([
        'case',
        ['>', 100, 0],
        ['+', 100, 1],
        100,
      ]);
    });

    it('should return primitive unchanged', () => {
      expect(substitutePathWithValue(null, 'any.path', 'value')).toBe(null);
      expect(substitutePathWithValue('string', 'any.path', 'value')).toBe('string');
      expect(substitutePathWithValue(42, 'any.path', 'value')).toBe(42);
    });

    it('should substitute with expression value', () => {
      const expr: Expression = ['+', ['get', 'data.a'], 1];
      const substitution: Expression = ['*', ['get', 'data.b'], 2];
      const result = substitutePathWithValue(expr, 'data.a', substitution);

      expect(result).toEqual(['+', ['*', ['get', 'data.b'], 2], 1]);
    });
  });
});
