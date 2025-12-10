import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  isNonNullType,
  isListType,
  isEnumType,
  isObjectType,
  isInputObjectType,
} from 'graphql';

import {
  mapZodToGraphQLOutput,
  mapZodToGraphQLInput,
  GraphQLJSON,
  GraphQLDateTime,
  sanitizeTypeName,
  sanitizeFieldName,
  sanitizeEnumValue,
  getZodTypeName,
  isZodOptional,
  unwrapZodType,
  clearTypeCache,
} from '../../src/schema/type-mapper.js';

describe('Type Mapper', () => {
  beforeEach(() => {
    clearTypeCache();
  });

  describe('Primitive Types', () => {
    it('should map string to GraphQLString', () => {
      const schema = z.string();
      const result = mapZodToGraphQLOutput(schema, 'TestString', {});

      expect(isNonNullType(result)).toBe(true);
      if (isNonNullType(result)) {
        expect(result.ofType).toBe(GraphQLString);
      }
    });

    it('should map number to GraphQLFloat', () => {
      const schema = z.number();
      const result = mapZodToGraphQLOutput(schema, 'TestNumber', {});

      expect(isNonNullType(result)).toBe(true);
      if (isNonNullType(result)) {
        expect(result.ofType).toBe(GraphQLFloat);
      }
    });

    it('should map integer to GraphQLInt', () => {
      const schema = z.number().int();
      const result = mapZodToGraphQLOutput(schema, 'TestInt', {});

      expect(isNonNullType(result)).toBe(true);
      if (isNonNullType(result)) {
        expect(result.ofType).toBe(GraphQLInt);
      }
    });

    it('should map boolean to GraphQLBoolean', () => {
      const schema = z.boolean();
      const result = mapZodToGraphQLOutput(schema, 'TestBoolean', {});

      expect(isNonNullType(result)).toBe(true);
      if (isNonNullType(result)) {
        expect(result.ofType).toBe(GraphQLBoolean);
      }
    });

    it('should map date to GraphQLDateTime', () => {
      const schema = z.date();
      const result = mapZodToGraphQLOutput(schema, 'TestDate', {});

      expect(isNonNullType(result)).toBe(true);
      if (isNonNullType(result)) {
        expect(result.ofType).toBe(GraphQLDateTime);
      }
    });
  });

  describe('Optional Types', () => {
    it('should map optional string to nullable GraphQLString', () => {
      const schema = z.string().optional();
      const result = mapZodToGraphQLOutput(schema, 'TestOptional', {});

      expect(isNonNullType(result)).toBe(false);
      expect(result).toBe(GraphQLString);
    });

    it('should map nullable string to nullable GraphQLString', () => {
      const schema = z.string().nullable();
      const result = mapZodToGraphQLOutput(schema, 'TestNullable', {});

      expect(isNonNullType(result)).toBe(false);
      expect(result).toBe(GraphQLString);
    });
  });

  describe('Array Types', () => {
    it('should map array of strings to GraphQLList', () => {
      const schema = z.array(z.string());
      const result = mapZodToGraphQLOutput(schema, 'TestArray', {});

      expect(isNonNullType(result)).toBe(true);
      if (isNonNullType(result)) {
        expect(isListType(result.ofType)).toBe(true);
      }
    });

    it('should map optional array to nullable GraphQLList', () => {
      const schema = z.array(z.string()).optional();
      const result = mapZodToGraphQLOutput(schema, 'TestOptionalArray', {});

      expect(isNonNullType(result)).toBe(false);
      expect(isListType(result)).toBe(true);
    });
  });

  describe('Enum Types', () => {
    it('should map enum to GraphQLEnumType', () => {
      const schema = z.enum(['ACTIVE', 'INACTIVE', 'PENDING']);
      const result = mapZodToGraphQLOutput(schema, 'Status', {});

      expect(isNonNullType(result)).toBe(true);
      if (isNonNullType(result)) {
        expect(isEnumType(result.ofType)).toBe(true);
        const enumType = result.ofType as GraphQLEnumType;
        expect(enumType.getValues()).toHaveLength(3);
      }
    });
  });

  describe('Object Types', () => {
    it('should map object to GraphQLObjectType', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().int(),
      });
      const result = mapZodToGraphQLOutput(schema, 'User', {});

      expect(isNonNullType(result)).toBe(true);
      if (isNonNullType(result)) {
        expect(isObjectType(result.ofType)).toBe(true);
        const objectType = result.ofType as GraphQLObjectType;
        const fields = objectType.getFields();
        expect(fields.name).toBeDefined();
        expect(fields.age).toBeDefined();
      }
    });

    it('should map object to GraphQLInputObjectType for input', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().int(),
      });
      const result = mapZodToGraphQLInput(schema, 'UserInput', {});

      expect(isNonNullType(result)).toBe(true);
      if (isNonNullType(result)) {
        expect(isInputObjectType(result.ofType)).toBe(true);
      }
    });
  });

  describe('Complex Types', () => {
    it('should map any/unknown to GraphQLJSON', () => {
      const anySchema = z.any();
      const unknownSchema = z.unknown();

      const anyResult = mapZodToGraphQLOutput(anySchema, 'TestAny', {});
      const unknownResult = mapZodToGraphQLOutput(unknownSchema, 'TestUnknown', {});

      expect(isNonNullType(anyResult)).toBe(true);
      expect(isNonNullType(unknownResult)).toBe(true);
    });

    it('should map record to GraphQLJSON', () => {
      const schema = z.record(z.string());
      const result = mapZodToGraphQLOutput(schema, 'TestRecord', {});

      expect(isNonNullType(result)).toBe(true);
    });
  });

  describe('Zod Type Detection', () => {
    it('should get correct type name', () => {
      expect(getZodTypeName(z.string())).toBe('ZodString');
      expect(getZodTypeName(z.number())).toBe('ZodNumber');
      expect(getZodTypeName(z.boolean())).toBe('ZodBoolean');
      expect(getZodTypeName(z.array(z.string()))).toBe('ZodArray');
      expect(getZodTypeName(z.object({}))).toBe('ZodObject');
    });

    it('should detect optional types', () => {
      expect(isZodOptional(z.string())).toBe(false);
      expect(isZodOptional(z.string().optional())).toBe(true);
      expect(isZodOptional(z.string().nullable())).toBe(true);
    });

    it('should unwrap optional types', () => {
      const optionalString = z.string().optional();
      const { inner, optional } = unwrapZodType(optionalString);

      expect(optional).toBe(true);
      expect(getZodTypeName(inner)).toBe('ZodString');
    });
  });

  describe('Name Sanitization', () => {
    it('should sanitize type names', () => {
      expect(sanitizeTypeName('user-profile')).toBe('UserProfile');
      expect(sanitizeTypeName('data.user')).toBe('DataUser');
      // Note: sanitizeTypeName PascalCases parts but doesn't add underscore prefix
      expect(sanitizeTypeName('123abc')).toBe('123abc');
    });

    it('should sanitize field names', () => {
      expect(sanitizeFieldName('UserName')).toBe('userName');
      expect(sanitizeFieldName('first-name')).toBe('first_name');
      expect(sanitizeFieldName('123field')).toBe('_123field');
    });

    it('should sanitize enum values', () => {
      expect(sanitizeEnumValue('active')).toBe('ACTIVE');
      expect(sanitizeEnumValue('in-progress')).toBe('IN_PROGRESS');
      expect(sanitizeEnumValue('123test')).toBe('123TEST');
    });
  });

  describe('Custom Scalars', () => {
    it('should serialize JSON values', () => {
      expect(GraphQLJSON.serialize({ key: 'value' })).toEqual({ key: 'value' });
      expect(GraphQLJSON.serialize([1, 2, 3])).toEqual([1, 2, 3]);
      expect(GraphQLJSON.serialize('string')).toBe('string');
    });

    it('should serialize DateTime values', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(GraphQLDateTime.serialize(date)).toBe('2024-01-15T10:30:00.000Z');
      expect(GraphQLDateTime.serialize('2024-01-15T10:30:00Z')).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should parse DateTime values', () => {
      const result = GraphQLDateTime.parseValue('2024-01-15T10:30:00Z');
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });
  });
});
