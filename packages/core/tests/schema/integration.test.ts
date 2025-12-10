import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  schemaToSource,
  CommonSchemas,
  SchemaUtils,
  getSchemaDefault,
  getSchemaMetadata,
  toJsonSchema,
} from '../../src/schema/integration.js';

describe('schema/integration', () => {
  // ===========================================
  // schemaToSource
  // ===========================================
  describe('schemaToSource', () => {
    it('should create source definition from schema', () => {
      const source = schemaToSource(z.string(), {
        type: 'input',
        description: 'Name input',
      });

      expect(source.schema).toBeDefined();
      expect(source.semantic.type).toBe('input');
      expect(source.semantic.description).toBe('Name input');
    });

    it('should set readable and writable defaults', () => {
      const source = schemaToSource(z.number(), {
        type: 'number',
        description: 'Quantity',
      });

      expect(source.semantic.readable).toBe(true);
      expect(source.semantic.writable).toBe(true);
    });

    it('should include default value when provided', () => {
      const source = schemaToSource(
        z.number(),
        { type: 'number', description: 'Count' },
        { defaultValue: 10 }
      );

      expect(source.defaultValue).toBe(10);
    });

    it('should allow override of readable/writable', () => {
      const source = schemaToSource(z.string(), {
        type: 'display',
        description: 'Read-only field',
        readable: true,
        writable: false,
      });

      expect(source.semantic.readable).toBe(true);
      expect(source.semantic.writable).toBe(false);
    });
  });

  // ===========================================
  // CommonSchemas
  // ===========================================
  describe('CommonSchemas', () => {
    describe('email', () => {
      it('should validate valid email', () => {
        const schema = CommonSchemas.email();
        expect(schema.safeParse('test@example.com').success).toBe(true);
      });

      it('should reject invalid email', () => {
        const schema = CommonSchemas.email();
        expect(schema.safeParse('not-an-email').success).toBe(false);
      });
    });

    describe('url', () => {
      it('should validate valid URL', () => {
        const schema = CommonSchemas.url();
        expect(schema.safeParse('https://example.com').success).toBe(true);
      });

      it('should reject invalid URL', () => {
        const schema = CommonSchemas.url();
        expect(schema.safeParse('not-a-url').success).toBe(false);
      });
    });

    describe('phoneKR', () => {
      it('should validate Korean phone numbers', () => {
        const schema = CommonSchemas.phoneKR();
        expect(schema.safeParse('010-1234-5678').success).toBe(true);
        expect(schema.safeParse('01012345678').success).toBe(true);
      });

      it('should reject invalid phone numbers', () => {
        const schema = CommonSchemas.phoneKR();
        expect(schema.safeParse('123-456-7890').success).toBe(false);
      });
    });

    describe('businessNumber', () => {
      it('should validate Korean business numbers', () => {
        const schema = CommonSchemas.businessNumber();
        expect(schema.safeParse('123-45-67890').success).toBe(true);
        expect(schema.safeParse('1234567890').success).toBe(true);
      });

      it('should reject invalid business numbers', () => {
        const schema = CommonSchemas.businessNumber();
        expect(schema.safeParse('12-345-67890').success).toBe(false);
      });
    });

    describe('positiveInt', () => {
      it('should validate positive integers', () => {
        const schema = CommonSchemas.positiveInt();
        expect(schema.safeParse(1).success).toBe(true);
        expect(schema.safeParse(100).success).toBe(true);
      });

      it('should reject zero and negative', () => {
        const schema = CommonSchemas.positiveInt();
        expect(schema.safeParse(0).success).toBe(false);
        expect(schema.safeParse(-1).success).toBe(false);
      });

      it('should reject floats', () => {
        const schema = CommonSchemas.positiveInt();
        expect(schema.safeParse(1.5).success).toBe(false);
      });
    });

    describe('nonNegativeInt', () => {
      it('should validate non-negative integers', () => {
        const schema = CommonSchemas.nonNegativeInt();
        expect(schema.safeParse(0).success).toBe(true);
        expect(schema.safeParse(100).success).toBe(true);
      });

      it('should reject negative numbers', () => {
        const schema = CommonSchemas.nonNegativeInt();
        expect(schema.safeParse(-1).success).toBe(false);
      });
    });

    describe('money', () => {
      it('should validate non-negative numbers', () => {
        const schema = CommonSchemas.money();
        expect(schema.safeParse(0).success).toBe(true);
        expect(schema.safeParse(99.99).success).toBe(true);
      });

      it('should reject negative amounts', () => {
        const schema = CommonSchemas.money();
        expect(schema.safeParse(-10).success).toBe(false);
      });
    });

    describe('percent', () => {
      it('should validate 0-100 range', () => {
        const schema = CommonSchemas.percent();
        expect(schema.safeParse(0).success).toBe(true);
        expect(schema.safeParse(50).success).toBe(true);
        expect(schema.safeParse(100).success).toBe(true);
      });

      it('should reject out of range', () => {
        const schema = CommonSchemas.percent();
        expect(schema.safeParse(-1).success).toBe(false);
        expect(schema.safeParse(101).success).toBe(false);
      });
    });

    describe('dateString', () => {
      it('should validate ISO date strings', () => {
        const schema = CommonSchemas.dateString();
        expect(schema.safeParse('2024-01-15T10:30:00Z').success).toBe(true);
      });

      it('should reject invalid dates', () => {
        const schema = CommonSchemas.dateString();
        expect(schema.safeParse('not-a-date').success).toBe(false);
      });
    });

    describe('id', () => {
      it('should validate non-empty strings', () => {
        const schema = CommonSchemas.id();
        expect(schema.safeParse('abc123').success).toBe(true);
      });

      it('should reject empty strings', () => {
        const schema = CommonSchemas.id();
        expect(schema.safeParse('').success).toBe(false);
      });
    });

    describe('selectOption', () => {
      it('should validate enum values', () => {
        const schema = CommonSchemas.selectOption(['a', 'b', 'c'] as const);
        expect(schema.safeParse('a').success).toBe(true);
        expect(schema.safeParse('b').success).toBe(true);
      });

      it('should reject invalid options', () => {
        const schema = CommonSchemas.selectOption(['a', 'b', 'c'] as const);
        expect(schema.safeParse('d').success).toBe(false);
      });
    });

    describe('nullable', () => {
      it('should allow null', () => {
        const schema = CommonSchemas.nullable(z.string());
        expect(schema.safeParse(null).success).toBe(true);
        expect(schema.safeParse('hello').success).toBe(true);
      });
    });

    describe('optional', () => {
      it('should allow undefined', () => {
        const schema = CommonSchemas.optional(z.string());
        expect(schema.safeParse(undefined).success).toBe(true);
        expect(schema.safeParse('hello').success).toBe(true);
      });
    });

    describe('array', () => {
      it('should validate arrays', () => {
        const schema = CommonSchemas.array(z.number());
        expect(schema.safeParse([1, 2, 3]).success).toBe(true);
      });

      it('should reject invalid array items', () => {
        const schema = CommonSchemas.array(z.number());
        expect(schema.safeParse([1, 'two', 3]).success).toBe(false);
      });
    });

    describe('record', () => {
      it('should validate records', () => {
        const schema = CommonSchemas.record(z.number());
        expect(schema.safeParse({ a: 1, b: 2 }).success).toBe(true);
      });

      it('should reject invalid record values', () => {
        const schema = CommonSchemas.record(z.number());
        expect(schema.safeParse({ a: 'one' }).success).toBe(false);
      });
    });
  });

  // ===========================================
  // SchemaUtils
  // ===========================================
  describe('SchemaUtils', () => {
    describe('eitherRequired', () => {
      it('should pass when at least one field is present', () => {
        const schema = SchemaUtils.eitherRequired(z.string(), z.number());
        expect(schema.safeParse({ field1: 'hello' }).success).toBe(true);
        expect(schema.safeParse({ field2: 42 }).success).toBe(true);
        expect(schema.safeParse({ field1: 'hello', field2: 42 }).success).toBe(true);
      });

      it('should fail when both fields are missing', () => {
        const schema = SchemaUtils.eitherRequired(z.string(), z.number());
        expect(schema.safeParse({}).success).toBe(false);
      });
    });

    describe('range', () => {
      it('should validate numbers in range', () => {
        const schema = SchemaUtils.range(0, 100);
        expect(schema.safeParse(50).success).toBe(true);
        expect(schema.safeParse(0).success).toBe(true);
        expect(schema.safeParse(100).success).toBe(true);
      });

      it('should reject numbers out of range', () => {
        const schema = SchemaUtils.range(0, 100);
        expect(schema.safeParse(-1).success).toBe(false);
        expect(schema.safeParse(101).success).toBe(false);
      });
    });

    describe('stringLength', () => {
      it('should validate string length', () => {
        const schema = SchemaUtils.stringLength(2, 5);
        expect(schema.safeParse('ab').success).toBe(true);
        expect(schema.safeParse('abcde').success).toBe(true);
      });

      it('should reject strings too short or long', () => {
        const schema = SchemaUtils.stringLength(2, 5);
        expect(schema.safeParse('a').success).toBe(false);
        expect(schema.safeParse('abcdef').success).toBe(false);
      });
    });

    describe('enumUnion', () => {
      it('should validate enum values', () => {
        const schema = SchemaUtils.enumUnion('red', 'green', 'blue');
        expect(schema.safeParse('red').success).toBe(true);
        expect(schema.safeParse('green').success).toBe(true);
      });

      it('should reject invalid values', () => {
        const schema = SchemaUtils.enumUnion('red', 'green', 'blue');
        expect(schema.safeParse('yellow').success).toBe(false);
      });

      it('should throw for empty values', () => {
        expect(() => SchemaUtils.enumUnion()).toThrow('At least one value is required');
      });
    });
  });

  // ===========================================
  // getSchemaDefault
  // ===========================================
  describe('getSchemaDefault', () => {
    it('should extract default value from schema', () => {
      const schema = z.string().default('hello');
      const defaultVal = getSchemaDefault(schema);

      expect(defaultVal).toBe('hello');
    });

    it('should return undefined when no default', () => {
      const schema = z.string();
      const defaultVal = getSchemaDefault(schema);

      expect(defaultVal).toBeUndefined();
    });

    it('should handle number default', () => {
      const schema = z.number().default(42);
      const defaultVal = getSchemaDefault(schema);

      expect(defaultVal).toBe(42);
    });
  });

  // ===========================================
  // getSchemaMetadata
  // ===========================================
  describe('getSchemaMetadata', () => {
    it('should extract type from schema', () => {
      const meta = getSchemaMetadata(z.string());
      expect(meta.type).toBe('ZodString');
    });

    it('should detect optional schema', () => {
      const meta = getSchemaMetadata(z.string().optional());
      expect(meta.isOptional).toBe(true);
    });

    it('should detect nullable schema', () => {
      const meta = getSchemaMetadata(z.string().nullable());
      expect(meta.isNullable).toBe(true);
    });

    it('should handle nested optional/nullable', () => {
      const meta = getSchemaMetadata(z.string().nullable().optional());
      expect(meta.isOptional).toBe(true);
      expect(meta.isNullable).toBe(true);
    });

    it('should extract description', () => {
      const schema = z.string().describe('A description');
      const meta = getSchemaMetadata(schema);
      expect(meta.description).toBe('A description');
    });

    it('should handle number type', () => {
      const meta = getSchemaMetadata(z.number());
      expect(meta.type).toBe('ZodNumber');
    });

    it('should handle boolean type', () => {
      const meta = getSchemaMetadata(z.boolean());
      expect(meta.type).toBe('ZodBoolean');
    });

    it('should handle array type', () => {
      const meta = getSchemaMetadata(z.array(z.string()));
      expect(meta.type).toBe('ZodArray');
    });

    it('should handle object type', () => {
      const meta = getSchemaMetadata(z.object({ name: z.string() }));
      expect(meta.type).toBe('ZodObject');
    });
  });

  // ===========================================
  // toJsonSchema
  // ===========================================
  describe('toJsonSchema', () => {
    it('should convert string schema', () => {
      const jsonSchema = toJsonSchema(z.string());
      expect(jsonSchema.type).toBe('string');
    });

    it('should convert number schema', () => {
      const jsonSchema = toJsonSchema(z.number());
      expect(jsonSchema.type).toBe('number');
    });

    it('should convert boolean schema', () => {
      const jsonSchema = toJsonSchema(z.boolean());
      expect(jsonSchema.type).toBe('boolean');
    });

    it('should convert array schema', () => {
      const jsonSchema = toJsonSchema(z.array(z.string()));
      expect(jsonSchema.type).toBe('array');
    });

    it('should convert object schema', () => {
      const jsonSchema = toJsonSchema(z.object({ name: z.string() }));
      expect(jsonSchema.type).toBe('object');
    });

    it('should include description', () => {
      const jsonSchema = toJsonSchema(z.string().describe('A name field'));
      expect(jsonSchema.description).toBe('A name field');
    });

    it('should mark nullable schemas', () => {
      const jsonSchema = toJsonSchema(z.string().nullable());
      expect(jsonSchema.nullable).toBe(true);
    });

    it('should handle null type', () => {
      const jsonSchema = toJsonSchema(z.null());
      expect(jsonSchema.type).toBe('null');
    });
  });
});
