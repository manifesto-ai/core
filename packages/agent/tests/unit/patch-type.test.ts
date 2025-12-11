/**
 * @manifesto-ai/agent - Type Validation Tests
 *
 * 테스트 내용:
 * - 타입 불일치 에러 생성
 */

import { describe, it, expect } from 'vitest';
import {
  getValueType,
  validateType,
  validateTypeRule,
  validateTypeRules,
  matchPathPattern,
} from '../../src/validation/type-rules.js';
import { createDefaultConstraints, addTypeRule } from '../../src/types/constraints.js';

describe('Type Validation', () => {
  describe('getValueType', () => {
    it('should detect string type', () => {
      expect(getValueType('hello')).toBe('string');
    });

    it('should detect number type', () => {
      expect(getValueType(42)).toBe('number');
      expect(getValueType(3.14)).toBe('number');
    });

    it('should detect boolean type', () => {
      expect(getValueType(true)).toBe('boolean');
      expect(getValueType(false)).toBe('boolean');
    });

    it('should detect null type', () => {
      expect(getValueType(null)).toBe('null');
    });

    it('should detect array type', () => {
      expect(getValueType([])).toBe('array');
      expect(getValueType([1, 2, 3])).toBe('array');
    });

    it('should detect object type', () => {
      expect(getValueType({})).toBe('object');
      expect(getValueType({ a: 1 })).toBe('object');
    });

    it('should return unknown for undefined', () => {
      expect(getValueType(undefined)).toBe('unknown');
    });
  });

  describe('validateType', () => {
    it('should pass when types match', () => {
      expect(validateType('data.name', 'hello', 'string', 'eff_1').ok).toBe(true);
      expect(validateType('data.count', 42, 'number', 'eff_2').ok).toBe(true);
      expect(validateType('data.active', true, 'boolean', 'eff_3').ok).toBe(true);
    });

    it('should fail when types mismatch', () => {
      const result = validateType('data.name', 42, 'string', 'eff_4');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.issue).toBe('Type mismatch');
        expect(result.error.expected).toBe('string');
        expect(result.error.got).toBe('number');
      }
    });

    it('should allow null for any type', () => {
      expect(validateType('data.name', null, 'string', 'eff_5').ok).toBe(true);
      expect(validateType('data.count', null, 'number', 'eff_6').ok).toBe(true);
    });

    it('should include advice in error', () => {
      const result = validateType('data.name', 123, 'string', 'eff_7');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.advice).toContain('Use string');
      }
    });
  });

  describe('validateTypeRule', () => {
    it('should pass when no rule exists', () => {
      const constraints = createDefaultConstraints();
      const result = validateTypeRule('data.anything', 'value', constraints, 'eff_8');
      expect(result.ok).toBe(true);
    });

    it('should validate against defined rule', () => {
      const constraints = addTypeRule(createDefaultConstraints(), 'data.count', 'number');

      const result1 = validateTypeRule('data.count', 42, constraints, 'eff_9');
      expect(result1.ok).toBe(true);

      const result2 = validateTypeRule('data.count', 'not a number', constraints, 'eff_10');
      expect(result2.ok).toBe(false);
    });
  });

  describe('validateTypeRules', () => {
    it('should validate multiple updates', () => {
      let constraints = createDefaultConstraints();
      constraints = addTypeRule(constraints, 'data.name', 'string');
      constraints = addTypeRule(constraints, 'data.count', 'number');

      const result = validateTypeRules(
        [
          { path: 'data.name', value: 'test' },
          { path: 'data.count', value: 42 },
        ],
        constraints,
        'eff_11'
      );
      expect(result.ok).toBe(true);
    });

    it('should fail on first type mismatch', () => {
      let constraints = createDefaultConstraints();
      constraints = addTypeRule(constraints, 'data.name', 'string');
      constraints = addTypeRule(constraints, 'data.count', 'number');

      const result = validateTypeRules(
        [
          { path: 'data.name', value: 123 },
          { path: 'data.count', value: 'bad' },
        ],
        constraints,
        'eff_12'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.at).toBe('data.name');
      }
    });
  });

  describe('matchPathPattern', () => {
    it('should match exact paths', () => {
      expect(matchPathPattern('data.user.name', 'data.user.name')).toBe(true);
      expect(matchPathPattern('data.user.name', 'data.user.email')).toBe(false);
    });

    it('should match with wildcard', () => {
      expect(matchPathPattern('data.items.*', 'data.items.0')).toBe(true);
      expect(matchPathPattern('data.items.*', 'data.items.name')).toBe(true);
      expect(matchPathPattern('data.items.*', 'data.items.0.name')).toBe(false);
    });

    it('should match with double wildcard', () => {
      expect(matchPathPattern('data.**', 'data.items.0.name')).toBe(true);
      expect(matchPathPattern('data.**', 'data.anything')).toBe(true);
    });
  });
});
