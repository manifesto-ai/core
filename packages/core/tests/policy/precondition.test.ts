import { describe, it, expect } from 'vitest';
import {
  evaluatePrecondition,
  evaluateAllPreconditions,
  checkActionAvailability,
  extractPreconditionDependencies,
  analyzePreconditionRequirements,
  type PreconditionEvaluationResult,
} from '../../src/policy/precondition.js';
import type { ConditionRef, ActionDefinition } from '../../src/domain/types.js';
import type { EvaluationContext } from '../../src/expression/types.js';

describe('precondition', () => {
  // Helper to create evaluation context
  const createContext = (values: Record<string, unknown>): EvaluationContext => ({
    get: (path) => values[path],
  });

  // ===========================================
  // evaluatePrecondition
  // ===========================================
  describe('evaluatePrecondition', () => {
    it('should return satisfied when condition is met (expect true, value true)', () => {
      const condition: ConditionRef = {
        path: 'derived.isValid',
        expect: 'true',
        reason: 'Form must be valid',
      };
      const ctx = createContext({ 'derived.isValid': true });

      const result = evaluatePrecondition(condition, ctx);

      expect(result.satisfied).toBe(true);
      expect(result.actualValue).toBe(true);
      expect(result.condition).toBe(condition);
    });

    it('should return unsatisfied when condition is not met (expect true, value false)', () => {
      const condition: ConditionRef = {
        path: 'derived.isValid',
        expect: 'true',
        reason: 'Form must be valid',
      };
      const ctx = createContext({ 'derived.isValid': false });

      const result = evaluatePrecondition(condition, ctx);

      expect(result.satisfied).toBe(false);
      expect(result.actualValue).toBe(false);
    });

    it('should return satisfied when expecting false and value is false', () => {
      const condition: ConditionRef = {
        path: 'derived.hasError',
        expect: 'false',
        reason: 'No errors allowed',
      };
      const ctx = createContext({ 'derived.hasError': false });

      const result = evaluatePrecondition(condition, ctx);

      expect(result.satisfied).toBe(true);
    });

    it('should return unsatisfied when expecting false but value is true', () => {
      const condition: ConditionRef = {
        path: 'derived.hasError',
        expect: 'false',
        reason: 'No errors allowed',
      };
      const ctx = createContext({ 'derived.hasError': true });

      const result = evaluatePrecondition(condition, ctx);

      expect(result.satisfied).toBe(false);
    });

    it('should default to expect true when expect is undefined', () => {
      const condition: ConditionRef = {
        path: 'derived.isReady',
        // no expect - defaults to 'true'
      };
      const ctx = createContext({ 'derived.isReady': true });

      const result = evaluatePrecondition(condition, ctx);

      expect(result.satisfied).toBe(true);
    });

    it('should coerce truthy values to true', () => {
      const condition: ConditionRef = {
        path: 'derived.count',
        expect: 'true',
      };
      const ctx = createContext({ 'derived.count': 5 }); // truthy number

      const result = evaluatePrecondition(condition, ctx);

      expect(result.satisfied).toBe(true);
      expect(result.actualValue).toBe(5);
    });

    it('should coerce falsy values to false', () => {
      const condition: ConditionRef = {
        path: 'derived.count',
        expect: 'true',
      };
      const ctx = createContext({ 'derived.count': 0 }); // falsy number

      const result = evaluatePrecondition(condition, ctx);

      expect(result.satisfied).toBe(false);
      expect(result.actualValue).toBe(0);
    });

    it('should handle undefined values as false', () => {
      const condition: ConditionRef = {
        path: 'derived.missing',
        expect: 'true',
      };
      const ctx = createContext({}); // path doesn't exist

      const result = evaluatePrecondition(condition, ctx);

      expect(result.satisfied).toBe(false);
      expect(result.actualValue).toBeUndefined();
    });

    it('should handle null values as false', () => {
      const condition: ConditionRef = {
        path: 'derived.nullable',
        expect: 'true',
      };
      const ctx = createContext({ 'derived.nullable': null });

      const result = evaluatePrecondition(condition, ctx);

      expect(result.satisfied).toBe(false);
    });

    it('should include debug information', () => {
      const condition: ConditionRef = {
        path: 'derived.test',
        expect: 'true',
      };
      const ctx = createContext({ 'derived.test': false });

      const result = evaluatePrecondition(condition, ctx);

      expect(result.debug).toEqual({
        path: 'derived.test',
        expectedBoolean: true,
        actualBoolean: false,
      });
    });

    it('should handle empty string as falsy', () => {
      const condition: ConditionRef = {
        path: 'data.name',
        expect: 'true',
      };
      const ctx = createContext({ 'data.name': '' });

      const result = evaluatePrecondition(condition, ctx);

      expect(result.satisfied).toBe(false);
    });

    it('should handle non-empty string as truthy', () => {
      const condition: ConditionRef = {
        path: 'data.name',
        expect: 'true',
      };
      const ctx = createContext({ 'data.name': 'John' });

      const result = evaluatePrecondition(condition, ctx);

      expect(result.satisfied).toBe(true);
    });
  });

  // ===========================================
  // evaluateAllPreconditions
  // ===========================================
  describe('evaluateAllPreconditions', () => {
    it('should evaluate multiple conditions', () => {
      const conditions: ConditionRef[] = [
        { path: 'derived.a', expect: 'true' },
        { path: 'derived.b', expect: 'false' },
        { path: 'derived.c', expect: 'true' },
      ];
      const ctx = createContext({
        'derived.a': true,
        'derived.b': false,
        'derived.c': true,
      });

      const results = evaluateAllPreconditions(conditions, ctx);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.satisfied)).toBe(true);
    });

    it('should return empty array for no conditions', () => {
      const results = evaluateAllPreconditions([], createContext({}));

      expect(results).toEqual([]);
    });

    it('should identify which conditions are unsatisfied', () => {
      const conditions: ConditionRef[] = [
        { path: 'derived.pass', expect: 'true' },
        { path: 'derived.fail', expect: 'true' },
      ];
      const ctx = createContext({
        'derived.pass': true,
        'derived.fail': false,
      });

      const results = evaluateAllPreconditions(conditions, ctx);

      expect(results[0]?.satisfied).toBe(true);
      expect(results[1]?.satisfied).toBe(false);
    });
  });

  // ===========================================
  // checkActionAvailability
  // ===========================================
  describe('checkActionAvailability', () => {
    const createAction = (
      verb: string,
      preconditions?: ConditionRef[]
    ): ActionDefinition => ({
      deps: [],
      effect: {
        _tag: 'SetValue',
        path: 'data.test',
        value: '',
        description: 'Test',
      },
      preconditions,
      semantic: {
        verb,
        type: 'action',
        description: 'Test action',
      },
    });

    it('should return available when no preconditions', () => {
      const action = createAction('submit');
      const ctx = createContext({});

      const result = checkActionAvailability(action, ctx);

      expect(result.available).toBe(true);
      expect(result.unsatisfiedConditions).toEqual([]);
      expect(result.reasons).toEqual([]);
      expect(result.explanation).toContain('submit');
      expect(result.explanation).toContain('no preconditions');
    });

    it('should return available when empty preconditions array', () => {
      const action = createAction('submit', []);
      const ctx = createContext({});

      const result = checkActionAvailability(action, ctx);

      expect(result.available).toBe(true);
    });

    it('should return available when all preconditions are satisfied', () => {
      const action = createAction('submit', [
        { path: 'derived.isValid', expect: 'true', reason: 'Form valid' },
        { path: 'derived.hasData', expect: 'true', reason: 'Has data' },
      ]);
      const ctx = createContext({
        'derived.isValid': true,
        'derived.hasData': true,
      });

      const result = checkActionAvailability(action, ctx);

      expect(result.available).toBe(true);
      expect(result.unsatisfiedConditions).toEqual([]);
      expect(result.explanation).toContain('All 2 preconditions are satisfied');
    });

    it('should return unavailable when any precondition fails', () => {
      const action = createAction('submit', [
        { path: 'derived.isValid', expect: 'true', reason: 'Form must be valid' },
        { path: 'derived.hasData', expect: 'true', reason: 'Must have data' },
      ]);
      const ctx = createContext({
        'derived.isValid': false,
        'derived.hasData': true,
      });

      const result = checkActionAvailability(action, ctx);

      expect(result.available).toBe(false);
      expect(result.unsatisfiedConditions).toHaveLength(1);
      expect(result.reasons).toContain('Form must be valid');
    });

    it('should return all unsatisfied conditions', () => {
      const action = createAction('submit', [
        { path: 'derived.a', expect: 'true', reason: 'A required' },
        { path: 'derived.b', expect: 'true', reason: 'B required' },
        { path: 'derived.c', expect: 'true', reason: 'C required' },
      ]);
      const ctx = createContext({
        'derived.a': false,
        'derived.b': true,
        'derived.c': false,
      });

      const result = checkActionAvailability(action, ctx);

      expect(result.available).toBe(false);
      expect(result.unsatisfiedConditions).toHaveLength(2);
      expect(result.reasons).toContain('A required');
      expect(result.reasons).toContain('C required');
      expect(result.reasons).not.toContain('B required');
    });

    it('should generate default reason when no reason provided', () => {
      const action = createAction('submit', [
        { path: 'derived.isValid', expect: 'true' }, // no reason
      ]);
      const ctx = createContext({
        'derived.isValid': false,
      });

      const result = checkActionAvailability(action, ctx);

      expect(result.reasons[0]).toContain('derived.isValid');
      expect(result.reasons[0]).toContain('should be true');
      expect(result.reasons[0]).toContain('is false');
    });

    it('should generate appropriate reason for expect:false condition', () => {
      const action = createAction('submit', [
        { path: 'derived.hasError', expect: 'false' }, // expect false, actual true
      ]);
      const ctx = createContext({
        'derived.hasError': true,
      });

      const result = checkActionAvailability(action, ctx);

      expect(result.reasons[0]).toContain('should be false');
      expect(result.reasons[0]).toContain('is true');
    });

    it('should include detailed explanation', () => {
      const action = createAction('submit', [
        { path: 'derived.isValid', expect: 'true', reason: 'Validation failed' },
      ]);
      const ctx = createContext({
        'derived.isValid': false,
      });

      const result = checkActionAvailability(action, ctx);

      expect(result.explanation).toContain('NOT available');
      expect(result.explanation).toContain('Unsatisfied preconditions');
      expect(result.explanation).toContain('derived.isValid');
      expect(result.explanation).toContain('Expected: true');
      expect(result.explanation).toContain('Actual: false');
      expect(result.explanation).toContain('Validation failed');
      expect(result.explanation).toContain('To enable this action');
    });
  });

  // ===========================================
  // extractPreconditionDependencies
  // ===========================================
  describe('extractPreconditionDependencies', () => {
    it('should extract all paths from conditions', () => {
      const conditions: ConditionRef[] = [
        { path: 'derived.a', expect: 'true' },
        { path: 'derived.b', expect: 'false' },
        { path: 'data.value', expect: 'true' },
      ];

      const deps = extractPreconditionDependencies(conditions);

      expect(deps).toEqual(['derived.a', 'derived.b', 'data.value']);
    });

    it('should return empty array for empty conditions', () => {
      const deps = extractPreconditionDependencies([]);

      expect(deps).toEqual([]);
    });
  });

  // ===========================================
  // analyzePreconditionRequirements
  // ===========================================
  describe('analyzePreconditionRequirements', () => {
    it('should analyze unsatisfied conditions', () => {
      const unsatisfied: PreconditionEvaluationResult[] = [
        {
          condition: { path: 'derived.a', expect: 'true', reason: 'A must be true' },
          actualValue: false,
          satisfied: false,
        },
        {
          condition: { path: 'derived.b', expect: 'false', reason: 'B must be false' },
          actualValue: true,
          satisfied: false,
        },
      ];

      const requirements = analyzePreconditionRequirements(unsatisfied);

      expect(requirements).toHaveLength(2);
      expect(requirements[0]).toEqual({
        path: 'derived.a',
        currentValue: false,
        requiredValue: true,
        reason: 'A must be true',
      });
      expect(requirements[1]).toEqual({
        path: 'derived.b',
        currentValue: true,
        requiredValue: false,
        reason: 'B must be false',
      });
    });

    it('should handle conditions without reason', () => {
      const unsatisfied: PreconditionEvaluationResult[] = [
        {
          condition: { path: 'derived.test' }, // no expect, no reason
          actualValue: 0,
          satisfied: false,
        },
      ];

      const requirements = analyzePreconditionRequirements(unsatisfied);

      expect(requirements[0]?.requiredValue).toBe(true); // default expect is true
      expect(requirements[0]?.reason).toBeUndefined();
    });

    it('should return empty array for empty input', () => {
      const requirements = analyzePreconditionRequirements([]);

      expect(requirements).toEqual([]);
    });

    it('should preserve original value types', () => {
      const unsatisfied: PreconditionEvaluationResult[] = [
        {
          condition: { path: 'derived.count', expect: 'true' },
          actualValue: 0, // number
          satisfied: false,
        },
        {
          condition: { path: 'derived.name', expect: 'true' },
          actualValue: '', // string
          satisfied: false,
        },
        {
          condition: { path: 'derived.data', expect: 'true' },
          actualValue: null,
          satisfied: false,
        },
      ];

      const requirements = analyzePreconditionRequirements(unsatisfied);

      expect(requirements[0]?.currentValue).toBe(0);
      expect(requirements[1]?.currentValue).toBe('');
      expect(requirements[2]?.currentValue).toBeNull();
    });
  });
});
