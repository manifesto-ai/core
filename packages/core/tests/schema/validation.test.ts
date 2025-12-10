import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  zodErrorToValidationResult,
  validateValue,
  validatePartial,
  validateDomainData,
  validateFields,
  validateAsync,
  mergeValidationResults,
  groupValidationByPath,
  filterBySeverity,
  getErrors,
  getWarnings,
  getSuggestions,
} from '../../src/schema/validation.js';
import { defineDomain, defineSource } from '../../src/domain/define.js';
import type { ValidationResult, ValidationIssue } from '../../src/domain/types.js';

describe('schema/validation', () => {
  // ===========================================
  // zodErrorToValidationResult
  // ===========================================
  describe('zodErrorToValidationResult', () => {
    it('should convert Zod error to ValidationResult', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const parseResult = schema.safeParse({ name: 123, age: 'invalid' });

      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const result = zodErrorToValidationResult(parseResult.error, 'data');

        expect(result.valid).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues[0]?.path).toContain('data');
      }
    });

    it('should preserve path suffix', () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            email: z.string().email(),
          }),
        }),
      });
      const parseResult = schema.safeParse({
        user: { profile: { email: 'invalid' } },
      });

      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const result = zodErrorToValidationResult(parseResult.error, 'data');

        expect(result.issues[0]?.path).toBe('data.user.profile.email');
      }
    });

    it('should generate suggested fix for type mismatch (string to number)', () => {
      const schema = z.number();
      const parseResult = schema.safeParse('123');

      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const result = zodErrorToValidationResult(parseResult.error, 'data.value');

        expect(result.issues[0]?.suggestedFix).toBeDefined();
        expect(result.issues[0]?.suggestedFix?.description).toContain('number');
      }
    });

    it('should generate suggested fix for type mismatch (number to string)', () => {
      const schema = z.string();
      const parseResult = schema.safeParse(123);

      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const result = zodErrorToValidationResult(parseResult.error, 'data.value');

        expect(result.issues[0]?.suggestedFix).toBeDefined();
        expect(result.issues[0]?.suggestedFix?.description).toContain('string');
      }
    });

    it('should generate suggested fix for too_small', () => {
      const schema = z.number().min(10);
      const parseResult = schema.safeParse(5);

      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const result = zodErrorToValidationResult(parseResult.error, 'data.value');

        expect(result.issues[0]?.suggestedFix).toBeDefined();
        expect(result.issues[0]?.suggestedFix?.value).toBe(10);
      }
    });

    it('should generate suggested fix for too_big', () => {
      const schema = z.number().max(100);
      const parseResult = schema.safeParse(150);

      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const result = zodErrorToValidationResult(parseResult.error, 'data.value');

        expect(result.issues[0]?.suggestedFix).toBeDefined();
        expect(result.issues[0]?.suggestedFix?.value).toBe(100);
      }
    });

    it('should handle email validation error', () => {
      const schema = z.string().email();
      const parseResult = schema.safeParse('not-an-email');

      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const result = zodErrorToValidationResult(parseResult.error, 'data.email');

        expect(result.issues[0]?.suggestedFix?.description).toContain('email');
      }
    });
  });

  // ===========================================
  // validateValue
  // ===========================================
  describe('validateValue', () => {
    it('should return valid result for valid value', () => {
      const schema = z.string();
      const result = validateValue(schema, 'hello', 'data.name');

      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('should return invalid result for invalid value', () => {
      const schema = z.string();
      const result = validateValue(schema, 123, 'data.name');

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should validate complex schemas', () => {
      const schema = z.object({
        name: z.string().min(1),
        age: z.number().positive(),
      });
      const result = validateValue(schema, { name: '', age: -1 }, 'data');

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBe(2);
    });

    it('should handle null values', () => {
      const schema = z.string();
      const result = validateValue(schema, null, 'data.value');

      expect(result.valid).toBe(false);
    });

    it('should handle optional values', () => {
      const schema = z.string().optional();
      const result = validateValue(schema, undefined, 'data.value');

      expect(result.valid).toBe(true);
    });
  });

  // ===========================================
  // validatePartial
  // ===========================================
  describe('validatePartial', () => {
    const fullSchema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    });

    it('should validate partial data', () => {
      const result = validatePartial(fullSchema, { name: 'John' }, 'data');

      expect(result.valid).toBe(true);
    });

    it('should fail when provided field is invalid', () => {
      const result = validatePartial(fullSchema, { name: 123 as any }, 'data');

      expect(result.valid).toBe(false);
    });

    it('should allow all fields to be missing', () => {
      const result = validatePartial(fullSchema, {}, 'data');

      expect(result.valid).toBe(true);
    });

    it('should validate email format when provided', () => {
      const result = validatePartial(fullSchema, { email: 'invalid' }, 'data');

      expect(result.valid).toBe(false);
    });
  });

  // ===========================================
  // validateDomainData
  // ===========================================
  describe('validateDomainData', () => {
    const testDomain = defineDomain({
      id: 'test',
      name: 'Test',
      description: 'Test domain',
      dataSchema: z.object({
        name: z.string(),
        count: z.number(),
      }),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {
          'data.name': defineSource({
            schema: z.string(),
            semantic: { type: 'input', description: 'Name' },
          }),
          'data.count': defineSource({
            schema: z.number(),
            semantic: { type: 'input', description: 'Count' },
          }),
        },
        derived: {},
        async: {},
      },
      actions: {},
    });

    it('should validate valid domain data', () => {
      const result = validateDomainData(testDomain, { name: 'Test', count: 10 });

      expect(result.valid).toBe(true);
    });

    it('should fail for invalid domain data', () => {
      const result = validateDomainData(testDomain, { name: 123, count: 'bad' } as any);

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBe(2);
    });

    it('should fail for missing fields', () => {
      const result = validateDomainData(testDomain, { name: 'Test' } as any);

      expect(result.valid).toBe(false);
    });
  });

  // ===========================================
  // validateFields
  // ===========================================
  describe('validateFields', () => {
    const testDomain = defineDomain({
      id: 'test',
      name: 'Test',
      description: 'Test domain',
      dataSchema: z.object({
        name: z.string().min(1),
        age: z.number().min(0),
      }),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {
          'data.name': defineSource({
            schema: z.string().min(1),
            semantic: { type: 'input', description: 'Name' },
          }),
          'data.age': defineSource({
            schema: z.number().min(0),
            semantic: { type: 'input', description: 'Age' },
          }),
        },
        derived: {},
        async: {},
      },
      actions: {},
    });

    it('should validate each field individually', () => {
      const results = validateFields(testDomain, { name: 'John', age: 30 });

      expect(results['data.name']?.valid).toBe(true);
      expect(results['data.age']?.valid).toBe(true);
    });

    it('should report invalid fields', () => {
      const results = validateFields(testDomain, { name: '', age: -1 });

      expect(results['data.name']?.valid).toBe(false);
      expect(results['data.age']?.valid).toBe(false);
    });

    it('should handle missing fields', () => {
      const results = validateFields(testDomain, {} as any);

      expect(results['data.name']?.valid).toBe(false);
      expect(results['data.age']?.valid).toBe(false);
    });
  });

  // ===========================================
  // validateAsync
  // ===========================================
  describe('validateAsync', () => {
    it('should return valid for true result', async () => {
      const validator = async () => true;
      const result = await validateAsync('test', 'data.value', validator);

      expect(result.valid).toBe(true);
    });

    it('should return invalid for false result', async () => {
      const validator = async () => false;
      const result = await validateAsync('test', 'data.value', validator);

      expect(result.valid).toBe(false);
      expect(result.issues[0]?.code).toBe('ASYNC_VALIDATION_FAILED');
    });

    it('should use string result as error message', async () => {
      const validator = async () => 'Custom error message';
      const result = await validateAsync('test', 'data.value', validator);

      expect(result.valid).toBe(false);
      expect(result.issues[0]?.message).toBe('Custom error message');
    });

    it('should handle validator throwing error', async () => {
      const validator = async () => {
        throw new Error('Validation failed');
      };
      const result = await validateAsync('test', 'data.value', validator);

      expect(result.valid).toBe(false);
      expect(result.issues[0]?.code).toBe('ASYNC_VALIDATION_ERROR');
      expect(result.issues[0]?.message).toBe('Validation failed');
    });

    it('should handle non-Error throws', async () => {
      const validator = async () => {
        throw 'string error';
      };
      const result = await validateAsync('test', 'data.value', validator);

      expect(result.valid).toBe(false);
      expect(result.issues[0]?.code).toBe('ASYNC_VALIDATION_ERROR');
    });
  });

  // ===========================================
  // mergeValidationResults
  // ===========================================
  describe('mergeValidationResults', () => {
    it('should merge multiple valid results', () => {
      const result1: ValidationResult = { valid: true, issues: [] };
      const result2: ValidationResult = { valid: true, issues: [] };

      const merged = mergeValidationResults(result1, result2);

      expect(merged.valid).toBe(true);
      expect(merged.issues).toEqual([]);
    });

    it('should merge results with issues', () => {
      const result1: ValidationResult = {
        valid: false,
        issues: [{ code: 'E1', message: 'Error 1', path: 'a', severity: 'error' }],
      };
      const result2: ValidationResult = {
        valid: false,
        issues: [{ code: 'E2', message: 'Error 2', path: 'b', severity: 'error' }],
      };

      const merged = mergeValidationResults(result1, result2);

      expect(merged.valid).toBe(false);
      expect(merged.issues).toHaveLength(2);
    });

    it('should be invalid if any error exists', () => {
      const result1: ValidationResult = { valid: true, issues: [] };
      const result2: ValidationResult = {
        valid: false,
        issues: [{ code: 'E1', message: 'Error', path: 'a', severity: 'error' }],
      };

      const merged = mergeValidationResults(result1, result2);

      expect(merged.valid).toBe(false);
    });

    it('should be valid with only warnings', () => {
      const result: ValidationResult = {
        valid: true,
        issues: [{ code: 'W1', message: 'Warning', path: 'a', severity: 'warning' }],
      };

      const merged = mergeValidationResults(result);

      expect(merged.valid).toBe(true);
    });

    it('should handle empty input', () => {
      const merged = mergeValidationResults();

      expect(merged.valid).toBe(true);
      expect(merged.issues).toEqual([]);
    });
  });

  // ===========================================
  // groupValidationByPath
  // ===========================================
  describe('groupValidationByPath', () => {
    it('should group issues by path', () => {
      const result: ValidationResult = {
        valid: false,
        issues: [
          { code: 'E1', message: 'Error 1', path: 'data.name', severity: 'error' },
          { code: 'E2', message: 'Error 2', path: 'data.name', severity: 'error' },
          { code: 'E3', message: 'Error 3', path: 'data.age', severity: 'error' },
        ],
      };

      const grouped = groupValidationByPath(result);

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['data.name']).toHaveLength(2);
      expect(grouped['data.age']).toHaveLength(1);
    });

    it('should handle empty issues', () => {
      const result: ValidationResult = { valid: true, issues: [] };

      const grouped = groupValidationByPath(result);

      expect(Object.keys(grouped)).toHaveLength(0);
    });
  });

  // ===========================================
  // filterBySeverity / getErrors / getWarnings / getSuggestions
  // ===========================================
  describe('severity filters', () => {
    const mixedResult: ValidationResult = {
      valid: false,
      issues: [
        { code: 'E1', message: 'Error', path: 'a', severity: 'error' },
        { code: 'W1', message: 'Warning', path: 'b', severity: 'warning' },
        { code: 'S1', message: 'Suggestion', path: 'c', severity: 'suggestion' },
        { code: 'E2', message: 'Error 2', path: 'd', severity: 'error' },
      ],
    };

    it('should filter by severity', () => {
      const errors = filterBySeverity(mixedResult, 'error');
      const warnings = filterBySeverity(mixedResult, 'warning');
      const suggestions = filterBySeverity(mixedResult, 'suggestion');

      expect(errors).toHaveLength(2);
      expect(warnings).toHaveLength(1);
      expect(suggestions).toHaveLength(1);
    });

    it('should get only errors', () => {
      const errors = getErrors(mixedResult);

      expect(errors).toHaveLength(2);
      expect(errors.every(e => e.severity === 'error')).toBe(true);
    });

    it('should get only warnings', () => {
      const warnings = getWarnings(mixedResult);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.severity).toBe('warning');
    });

    it('should get only suggestions', () => {
      const suggestions = getSuggestions(mixedResult);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]?.severity).toBe('suggestion');
    });

    it('should return empty array when no matches', () => {
      const result: ValidationResult = {
        valid: false,
        issues: [{ code: 'E1', message: 'Error', path: 'a', severity: 'error' }],
      };

      expect(getWarnings(result)).toEqual([]);
      expect(getSuggestions(result)).toEqual([]);
    });
  });
});
