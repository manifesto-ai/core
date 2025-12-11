/**
 * @manifesto-ai/agent - Invariant Validation Tests
 *
 * 테스트 내용:
 * - invariant 위반 처리
 */

import { describe, it, expect } from 'vitest';
import {
  validateInvariant,
  validateInvariants,
  requiredFieldInvariant,
  rangeInvariant,
  arrayLengthInvariant,
  customInvariant,
} from '../../src/validation/invariant.js';
import { createDefaultConstraints, addInvariant } from '../../src/types/constraints.js';

describe('Invariant Validation', () => {
  describe('validateInvariant', () => {
    it('should pass when check function returns true', () => {
      const invariant = {
        id: 'test',
        description: 'Test invariant',
        check: () => true,
      };
      const result = validateInvariant(invariant, {}, 'eff_1');
      expect(result.ok).toBe(true);
    });

    it('should fail when check function returns false', () => {
      const invariant = {
        id: 'test',
        description: 'Value must be positive',
        check: () => false,
      };
      const result = validateInvariant(invariant, {}, 'eff_2');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.issue).toBe('Invariant violated');
        expect(result.error.advice).toContain('positive');
      }
    });

    it('should pass when no check function exists', () => {
      const invariant = {
        id: 'test',
        description: 'Description only',
      };
      const result = validateInvariant(invariant, {}, 'eff_3');
      expect(result.ok).toBe(true);
    });

    it('should handle check function errors', () => {
      const invariant = {
        id: 'test',
        description: 'Buggy invariant',
        check: () => {
          throw new Error('Check failed');
        },
      };
      const result = validateInvariant(invariant, {}, 'eff_4');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.got).toBe('Check failed');
      }
    });
  });

  describe('validateInvariants', () => {
    it('should pass when all invariants pass', () => {
      const constraints = createDefaultConstraints();
      constraints.invariants = [
        { id: 'inv1', description: 'First', check: () => true },
        { id: 'inv2', description: 'Second', check: () => true },
      ];

      const result = validateInvariants(constraints, {}, 'eff_5');
      expect(result.ok).toBe(true);
    });

    it('should fail on first failing invariant', () => {
      const constraints = createDefaultConstraints();
      constraints.invariants = [
        { id: 'inv1', description: 'First', check: () => true },
        { id: 'inv2', description: 'Second', check: () => false },
        { id: 'inv3', description: 'Third', check: () => false },
      ];

      const result = validateInvariants(constraints, {}, 'eff_6');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.at).toBe('invariant:inv2');
      }
    });
  });

  describe('Invariant helpers', () => {
    describe('requiredFieldInvariant', () => {
      it('should pass when field exists', () => {
        const inv = requiredFieldInvariant('required_name', 'data.name');
        const snapshot = { data: { name: 'Test' } };
        expect(inv.check!(snapshot)).toBe(true);
      });

      it('should fail when field is null', () => {
        const inv = requiredFieldInvariant('required_name', 'data.name');
        const snapshot = { data: { name: null } };
        expect(inv.check!(snapshot)).toBe(false);
      });

      it('should fail when field is undefined', () => {
        const inv = requiredFieldInvariant('required_name', 'data.name');
        const snapshot = { data: {} };
        expect(inv.check!(snapshot)).toBe(false);
      });
    });

    describe('rangeInvariant', () => {
      it('should pass when value is in range', () => {
        const inv = rangeInvariant('age_range', 'data.age', 0, 120);
        const snapshot = { data: { age: 25 } };
        expect(inv.check!(snapshot)).toBe(true);
      });

      it('should pass when value is at boundary', () => {
        const inv = rangeInvariant('age_range', 'data.age', 0, 120);
        expect(inv.check!({ data: { age: 0 } })).toBe(true);
        expect(inv.check!({ data: { age: 120 } })).toBe(true);
      });

      it('should fail when value is below range', () => {
        const inv = rangeInvariant('age_range', 'data.age', 0, 120);
        const snapshot = { data: { age: -1 } };
        expect(inv.check!(snapshot)).toBe(false);
      });

      it('should fail when value is above range', () => {
        const inv = rangeInvariant('age_range', 'data.age', 0, 120);
        const snapshot = { data: { age: 121 } };
        expect(inv.check!(snapshot)).toBe(false);
      });

      it('should fail when value is not a number', () => {
        const inv = rangeInvariant('age_range', 'data.age', 0, 120);
        const snapshot = { data: { age: 'twenty' } };
        expect(inv.check!(snapshot)).toBe(false);
      });
    });

    describe('arrayLengthInvariant', () => {
      it('should pass when array has minimum length', () => {
        const inv = arrayLengthInvariant('min_items', 'data.items', 1);
        const snapshot = { data: { items: ['a'] } };
        expect(inv.check!(snapshot)).toBe(true);
      });

      it('should fail when array is too short', () => {
        const inv = arrayLengthInvariant('min_items', 'data.items', 2);
        const snapshot = { data: { items: ['a'] } };
        expect(inv.check!(snapshot)).toBe(false);
      });

      it('should fail when array is too long', () => {
        const inv = arrayLengthInvariant('max_items', 'data.items', 1, 3);
        const snapshot = { data: { items: ['a', 'b', 'c', 'd'] } };
        expect(inv.check!(snapshot)).toBe(false);
      });

      it('should fail when value is not an array', () => {
        const inv = arrayLengthInvariant('items', 'data.items', 1);
        const snapshot = { data: { items: 'not an array' } };
        expect(inv.check!(snapshot)).toBe(false);
      });
    });

    describe('customInvariant', () => {
      it('should use custom check function', () => {
        const inv = customInvariant(
          'even_count',
          'Count must be even',
          (snapshot: any) => snapshot.data.count % 2 === 0
        );

        expect(inv.check!({ data: { count: 4 } })).toBe(true);
        expect(inv.check!({ data: { count: 5 } })).toBe(false);
      });
    });
  });
});
