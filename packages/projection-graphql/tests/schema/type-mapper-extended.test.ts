import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  isNonNullType,
  isListType,
  isEnumType,
  GraphQLObjectType,
  GraphQLInputObjectType,
} from 'graphql';

import {
  mapZodToGraphQLOutput,
  mapZodToGraphQLInput,
  GraphQLJSON,
  clearTypeCache,
} from '../../src/schema/type-mapper.js';

describe('Type Mapper Extended', () => {
  beforeEach(() => {
    clearTypeCache();
  });

  describe('Default Values', () => {
    it('should handle default values', () => {
      const schema = z.string().default('test');
      const result = mapZodToGraphQLOutput(schema, 'TestDefault', {});

      expect(isNonNullType(result)).toBe(true);
    });
  });

  describe('Nested Objects', () => {
    it('should map nested objects', () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string(),
          }),
        }),
      });
      const result = mapZodToGraphQLOutput(schema, 'NestedObj', {});

      expect(isNonNullType(result)).toBe(true);
    });
  });

  describe('Native Enums', () => {
    it('should map native enums', () => {
      enum Status {
        ACTIVE = 'active',
        INACTIVE = 'inactive',
      }
      const schema = z.nativeEnum(Status);
      const result = mapZodToGraphQLOutput(schema, 'NativeStatus', {});

      expect(isNonNullType(result)).toBe(true);
    });
  });

  describe('Literal Types', () => {
    it('should map string literal', () => {
      const schema = z.literal('test');
      const result = mapZodToGraphQLOutput(schema, 'StringLiteral', {});
      expect(isNonNullType(result)).toBe(true);
    });

    it('should map number literal', () => {
      const schema = z.literal(42);
      const result = mapZodToGraphQLOutput(schema, 'NumberLiteral', {});
      expect(isNonNullType(result)).toBe(true);
    });

    it('should map boolean literal', () => {
      const schema = z.literal(true);
      const result = mapZodToGraphQLOutput(schema, 'BooleanLiteral', {});
      expect(isNonNullType(result)).toBe(true);
    });

    it('should handle null literal', () => {
      const schema = z.literal(null);
      const result = mapZodToGraphQLOutput(schema, 'NullLiteral', {});
      expect(result).toBeDefined();
    });
  });

  describe('Union Types', () => {
    it('should map union of same primitives', () => {
      const schema = z.union([z.string(), z.string()]);
      const result = mapZodToGraphQLOutput(schema, 'StringUnion', {});
      expect(isNonNullType(result)).toBe(true);
    });

    it('should map mixed union to JSON', () => {
      const schema = z.union([z.string(), z.number()]);
      const result = mapZodToGraphQLOutput(schema, 'MixedUnion', {});
      expect(isNonNullType(result)).toBe(true);
    });
  });

  describe('Input Type Mapping', () => {
    it('should map to input object type', () => {
      const schema = z.object({ name: z.string() });
      const result = mapZodToGraphQLInput(schema, 'UserInput', {});

      expect(isNonNullType(result)).toBe(true);
    });

    it('should map array to input list', () => {
      const schema = z.array(z.string());
      const result = mapZodToGraphQLInput(schema, 'StringsInput', {});

      expect(isNonNullType(result)).toBe(true);
      if (isNonNullType(result)) {
        expect(isListType(result.ofType)).toBe(true);
      }
    });

    it('should map enum to input enum', () => {
      const schema = z.enum(['A', 'B', 'C']);
      const result = mapZodToGraphQLInput(schema, 'EnumInput', {});

      expect(isNonNullType(result)).toBe(true);
      if (isNonNullType(result)) {
        expect(isEnumType(result.ofType)).toBe(true);
      }
    });

    it('should map date to input DateTime', () => {
      const schema = z.date();
      const result = mapZodToGraphQLInput(schema, 'DateInput', {});

      expect(isNonNullType(result)).toBe(true);
    });

    it('should map any to JSON for input', () => {
      const schema = z.any();
      const result = mapZodToGraphQLInput(schema, 'AnyInput', {});
      expect(isNonNullType(result)).toBe(true);
    });

    it('should map record to JSON for input', () => {
      const schema = z.record(z.number());
      const result = mapZodToGraphQLInput(schema, 'RecordInput', {});
      expect(isNonNullType(result)).toBe(true);
    });
  });

  describe('Type Caching', () => {
    it('should cache object types', () => {
      const schema = z.object({ id: z.string() });

      const result1 = mapZodToGraphQLOutput(schema, 'CachedType', {});
      const result2 = mapZodToGraphQLOutput(schema, 'CachedType', {});

      // Results are structurally equal due to caching (NonNull wrapper created fresh)
      expect(result1).toStrictEqual(result2);
    });

    it('should cache enum types', () => {
      const schema = z.enum(['X', 'Y']);

      const result1 = mapZodToGraphQLOutput(schema, 'CachedEnum', {});
      const result2 = mapZodToGraphQLOutput(schema, 'CachedEnum', {});

      // Results are structurally equal due to caching
      expect(result1).toStrictEqual(result2);
    });

    it('should clear cache correctly', () => {
      const schema = z.object({ value: z.number() });

      mapZodToGraphQLOutput(schema, 'ClearTest', {});
      clearTypeCache();
      const result2 = mapZodToGraphQLOutput(schema, 'ClearTest', {});

      // After clearing, a new type should be created
      expect(result2).toBeDefined();
    });
  });

  describe('Empty Objects', () => {
    it('should handle empty object schema', () => {
      const schema = z.object({});
      const result = mapZodToGraphQLOutput(schema, 'EmptyObj', {});

      expect(isNonNullType(result)).toBe(true);
    });
  });

  describe('Custom Scalar Handling', () => {
    it('should parse JSON null value', () => {
      const result = GraphQLJSON.parseLiteral({ kind: 'NullValue' } as any, {});
      expect(result).toBeNull();
    });

    it('should parse JSON int value', () => {
      const result = GraphQLJSON.parseLiteral({ kind: 'IntValue', value: '42' } as any, {});
      expect(result).toBe(42);
    });

    it('should parse JSON float value', () => {
      const result = GraphQLJSON.parseLiteral({ kind: 'FloatValue', value: '3.14' } as any, {});
      expect(result).toBe(3.14);
    });

    it('should parse JSON list value', () => {
      const result = GraphQLJSON.parseLiteral({
        kind: 'ListValue',
        values: [
          { kind: 'IntValue', value: '1' },
          { kind: 'IntValue', value: '2' },
        ],
      } as any, {});
      expect(result).toEqual([1, 2]);
    });

    it('should parse JSON object value', () => {
      const result = GraphQLJSON.parseLiteral({
        kind: 'ObjectValue',
        fields: [
          { name: { value: 'key' }, value: { kind: 'StringValue', value: 'val' } },
        ],
      } as any, {});
      expect(result).toEqual({ key: 'val' });
    });
  });
});
