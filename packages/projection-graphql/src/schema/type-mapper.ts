/**
 * Type Mapper
 *
 * Maps Zod schemas to GraphQL types.
 */

import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLEnumType,
  GraphQLScalarType,
  GraphQLUnionType,
  Kind,
  type GraphQLOutputType,
  type GraphQLInputType,
  type GraphQLType,
  type GraphQLFieldConfigMap,
  type GraphQLInputFieldConfigMap,
} from 'graphql';
import type { ZodType, ZodTypeDef } from 'zod';

import type { TypeMappingConfig, TypeMappingResult } from '../types.js';

// =============================================================================
// Custom Scalars
// =============================================================================

/**
 * JSON scalar type for arbitrary JSON values.
 */
export const GraphQLJSON = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize(value) {
    return value;
  },
  parseValue(value) {
    return value;
  },
  parseLiteral(ast) {
    return parseLiteralToJSON(ast);
  },
});

/**
 * DateTime scalar type for date values.
 */
export const GraphQLDateTime = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO 8601 date-time string',
  serialize(value) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value).toISOString();
    }
    return null;
  },
  parseValue(value) {
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }
    return null;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    if (ast.kind === Kind.INT) {
      return new Date(parseInt(ast.value, 10));
    }
    return null;
  },
});

/**
 * Parse GraphQL literal to JSON.
 */
function parseLiteralToJSON(ast: any): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
      return parseInt(ast.value, 10);
    case Kind.FLOAT:
      return parseFloat(ast.value);
    case Kind.OBJECT: {
      const result: Record<string, unknown> = {};
      for (const field of ast.fields) {
        result[field.name.value] = parseLiteralToJSON(field.value);
      }
      return result;
    }
    case Kind.LIST:
      return ast.values.map(parseLiteralToJSON);
    case Kind.NULL:
      return null;
    default:
      return null;
  }
}

// =============================================================================
// Type Cache
// =============================================================================

/**
 * Cache for generated types to avoid duplicates.
 */
const typeCache = new Map<string, GraphQLType>();

/**
 * Clear the type cache.
 */
export function clearTypeCache(): void {
  typeCache.clear();
}

// =============================================================================
// Zod Type Detection
// =============================================================================

/**
 * Get the Zod type name from a Zod schema.
 */
export function getZodTypeName(schema: ZodType): string {
  const def = schema._def as ZodTypeDef & { typeName?: string };
  return def.typeName ?? 'ZodUnknown';
}

/**
 * Check if a Zod schema is optional.
 */
export function isZodOptional(schema: ZodType): boolean {
  const typeName = getZodTypeName(schema);
  return typeName === 'ZodOptional' || typeName === 'ZodNullable';
}

/**
 * Unwrap optional/nullable Zod types.
 */
export function unwrapZodType(schema: ZodType): { inner: ZodType; optional: boolean } {
  const typeName = getZodTypeName(schema);

  if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
    const def = schema._def as { innerType?: ZodType };
    if (def.innerType) {
      const result = unwrapZodType(def.innerType);
      return { inner: result.inner, optional: true };
    }
  }

  if (typeName === 'ZodDefault') {
    const def = schema._def as { innerType?: ZodType };
    if (def.innerType) {
      return unwrapZodType(def.innerType);
    }
  }

  return { inner: schema, optional: false };
}

// =============================================================================
// Main Type Mapper
// =============================================================================

/**
 * Map a Zod schema to a GraphQL output type.
 */
export function mapZodToGraphQLOutput(
  schema: ZodType,
  name: string,
  config: TypeMappingConfig = {}
): GraphQLOutputType {
  const { inner, optional } = unwrapZodType(schema);
  const baseType = mapZodToGraphQLOutputBase(inner, name, config);

  return optional ? baseType : new GraphQLNonNull(baseType);
}

/**
 * Map a Zod schema to a GraphQL input type.
 */
export function mapZodToGraphQLInput(
  schema: ZodType,
  name: string,
  config: TypeMappingConfig = {}
): GraphQLInputType {
  const { inner, optional } = unwrapZodType(schema);
  const baseType = mapZodToGraphQLInputBase(inner, name, config);

  return optional ? baseType : new GraphQLNonNull(baseType);
}

/**
 * Map Zod schema to base GraphQL output type (without NonNull wrapper).
 */
function mapZodToGraphQLOutputBase(
  schema: ZodType,
  name: string,
  config: TypeMappingConfig
): GraphQLOutputType {
  const typeName = getZodTypeName(schema);

  switch (typeName) {
    case 'ZodString':
      return GraphQLString;

    case 'ZodNumber':
      return isIntegerSchema(schema) ? GraphQLInt : GraphQLFloat;

    case 'ZodBoolean':
      return GraphQLBoolean;

    case 'ZodDate':
      return GraphQLDateTime;

    case 'ZodEnum':
      return mapZodEnumToGraphQL(schema, name);

    case 'ZodNativeEnum':
      return mapZodNativeEnumToGraphQL(schema, name);

    case 'ZodArray':
      return mapZodArrayToGraphQLOutput(schema, name, config);

    case 'ZodObject':
      return mapZodObjectToGraphQLOutput(schema, name, config);

    case 'ZodUnion':
    case 'ZodDiscriminatedUnion':
      return mapZodUnionToGraphQL(schema, name, config);

    case 'ZodLiteral':
      return mapZodLiteralToGraphQL(schema);

    case 'ZodAny':
    case 'ZodUnknown':
      return GraphQLJSON;

    case 'ZodRecord':
      return GraphQLJSON;

    default:
      // Fallback to JSON for unknown types
      return GraphQLJSON;
  }
}

/**
 * Map Zod schema to base GraphQL input type.
 */
function mapZodToGraphQLInputBase(
  schema: ZodType,
  name: string,
  config: TypeMappingConfig
): GraphQLInputType {
  const typeName = getZodTypeName(schema);

  switch (typeName) {
    case 'ZodString':
      return GraphQLString;

    case 'ZodNumber':
      return isIntegerSchema(schema) ? GraphQLInt : GraphQLFloat;

    case 'ZodBoolean':
      return GraphQLBoolean;

    case 'ZodDate':
      return GraphQLDateTime;

    case 'ZodEnum':
      return mapZodEnumToGraphQL(schema, name);

    case 'ZodNativeEnum':
      return mapZodNativeEnumToGraphQL(schema, name);

    case 'ZodArray':
      return mapZodArrayToGraphQLInput(schema, name, config);

    case 'ZodObject':
      return mapZodObjectToGraphQLInput(schema, name, config);

    case 'ZodLiteral':
      return mapZodLiteralToGraphQLInput(schema);

    case 'ZodAny':
    case 'ZodUnknown':
    case 'ZodRecord':
      return GraphQLJSON;

    default:
      return GraphQLJSON;
  }
}

/**
 * Map Zod literal to GraphQL input type.
 */
function mapZodLiteralToGraphQLInput(schema: ZodType): GraphQLInputType {
  const def = schema._def as { value?: unknown };
  const value = def.value;

  if (typeof value === 'string') return GraphQLString;
  if (typeof value === 'number') return Number.isInteger(value) ? GraphQLInt : GraphQLFloat;
  if (typeof value === 'boolean') return GraphQLBoolean;

  return GraphQLJSON;
}

// =============================================================================
// Specific Type Mappers
// =============================================================================

/**
 * Check if a number schema represents an integer.
 */
function isIntegerSchema(schema: ZodType): boolean {
  const def = schema._def as { checks?: Array<{ kind: string }> };
  if (def.checks) {
    return def.checks.some((check) => check.kind === 'int');
  }
  return false;
}

/**
 * Map Zod enum to GraphQL enum type.
 */
function mapZodEnumToGraphQL(schema: ZodType, name: string): GraphQLEnumType {
  const cacheKey = `enum:${name}`;
  const cached = typeCache.get(cacheKey);
  if (cached) return cached as GraphQLEnumType;

  const def = schema._def as { values?: string[] };
  const values = def.values ?? [];

  const enumType = new GraphQLEnumType({
    name: sanitizeTypeName(name),
    values: Object.fromEntries(
      values.map((val) => [
        sanitizeEnumValue(val),
        { value: val },
      ])
    ),
  });

  typeCache.set(cacheKey, enumType);
  return enumType;
}

/**
 * Map native enum to GraphQL enum type.
 */
function mapZodNativeEnumToGraphQL(schema: ZodType, name: string): GraphQLEnumType {
  const cacheKey = `nativeEnum:${name}`;
  const cached = typeCache.get(cacheKey);
  if (cached) return cached as GraphQLEnumType;

  const def = schema._def as { values?: Record<string, string | number> };
  const enumObj = def.values ?? {};

  // Filter to get only string values (skip reverse mappings for numeric enums)
  const entries = Object.entries(enumObj).filter(
    ([key, value]) => typeof value === 'string' || (typeof value === 'number' && isNaN(Number(key)))
  );

  const enumType = new GraphQLEnumType({
    name: sanitizeTypeName(name),
    values: Object.fromEntries(
      entries.map(([key, value]) => [
        sanitizeEnumValue(key),
        { value },
      ])
    ),
  });

  typeCache.set(cacheKey, enumType);
  return enumType;
}

/**
 * Map Zod array to GraphQL list output type.
 */
function mapZodArrayToGraphQLOutput(
  schema: ZodType,
  name: string,
  config: TypeMappingConfig
): GraphQLOutputType {
  const def = schema._def as { type?: ZodType };
  const elementType = def.type;

  if (!elementType) {
    return new GraphQLList(GraphQLJSON);
  }

  const itemName = `${name}Item`;
  const itemType = mapZodToGraphQLOutput(elementType, itemName, config);

  return new GraphQLList(itemType);
}

/**
 * Map Zod array to GraphQL list input type.
 */
function mapZodArrayToGraphQLInput(
  schema: ZodType,
  name: string,
  config: TypeMappingConfig
): GraphQLInputType {
  const def = schema._def as { type?: ZodType };
  const elementType = def.type;

  if (!elementType) {
    return new GraphQLList(GraphQLJSON);
  }

  const itemName = `${name}Item`;
  const itemType = mapZodToGraphQLInput(elementType, itemName, config);

  return new GraphQLList(itemType);
}

/**
 * Map Zod object to GraphQL object type.
 */
function mapZodObjectToGraphQLOutput(
  schema: ZodType,
  name: string,
  config: TypeMappingConfig
): GraphQLObjectType {
  const cacheKey = `object:${name}`;
  const cached = typeCache.get(cacheKey);
  if (cached) return cached as GraphQLObjectType;

  const def = schema._def as { shape?: () => Record<string, ZodType> };
  const shapeFunc = def.shape;

  if (!shapeFunc) {
    // Return a placeholder type for empty objects
    return new GraphQLObjectType({
      name: sanitizeTypeName(name),
      fields: {
        _empty: { type: GraphQLBoolean },
      },
    });
  }

  const objectType = new GraphQLObjectType({
    name: sanitizeTypeName(name),
    fields: () => {
      const shape = shapeFunc();
      const fields: GraphQLFieldConfigMap<unknown, unknown> = {};

      for (const [key, fieldSchema] of Object.entries(shape)) {
        const fieldName = `${name}_${key}`;
        fields[sanitizeFieldName(key)] = {
          type: mapZodToGraphQLOutput(fieldSchema, fieldName, config),
          description: getZodDescription(fieldSchema),
        };
      }

      return fields;
    },
  });

  typeCache.set(cacheKey, objectType);
  return objectType;
}

/**
 * Map Zod object to GraphQL input object type.
 */
function mapZodObjectToGraphQLInput(
  schema: ZodType,
  name: string,
  config: TypeMappingConfig
): GraphQLInputObjectType {
  const inputName = `${name}Input`;
  const cacheKey = `inputObject:${inputName}`;
  const cached = typeCache.get(cacheKey);
  if (cached) return cached as GraphQLInputObjectType;

  const def = schema._def as { shape?: () => Record<string, ZodType> };
  const shapeFunc = def.shape;

  if (!shapeFunc) {
    return new GraphQLInputObjectType({
      name: sanitizeTypeName(inputName),
      fields: {
        _empty: { type: GraphQLBoolean },
      },
    });
  }

  const inputType = new GraphQLInputObjectType({
    name: sanitizeTypeName(inputName),
    fields: () => {
      const shape = shapeFunc();
      const fields: GraphQLInputFieldConfigMap = {};

      for (const [key, fieldSchema] of Object.entries(shape)) {
        const fieldName = `${inputName}_${key}`;
        fields[sanitizeFieldName(key)] = {
          type: mapZodToGraphQLInput(fieldSchema, fieldName, config),
          description: getZodDescription(fieldSchema),
        };
      }

      return fields;
    },
  });

  typeCache.set(cacheKey, inputType);
  return inputType;
}

/**
 * Map Zod union to GraphQL union type.
 */
function mapZodUnionToGraphQL(
  schema: ZodType,
  name: string,
  config: TypeMappingConfig
): GraphQLOutputType {
  const def = schema._def as { options?: ZodType[] };
  const options = def.options ?? [];

  // If all options are primitives of the same type, return that type
  const primitiveTypes = options.map((opt) => {
    const { inner } = unwrapZodType(opt);
    return getZodTypeName(inner);
  });

  const uniqueTypes = [...new Set(primitiveTypes)];

  if (uniqueTypes.length === 1) {
    const { inner } = unwrapZodType(options[0]!);
    return mapZodToGraphQLOutputBase(inner, name, config);
  }

  // For mixed types, return JSON
  return GraphQLJSON;
}

/**
 * Map Zod literal to GraphQL type.
 */
function mapZodLiteralToGraphQL(schema: ZodType): GraphQLOutputType {
  const def = schema._def as { value?: unknown };
  const value = def.value;

  if (typeof value === 'string') return GraphQLString;
  if (typeof value === 'number') return Number.isInteger(value) ? GraphQLInt : GraphQLFloat;
  if (typeof value === 'boolean') return GraphQLBoolean;

  return GraphQLJSON;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get description from Zod schema.
 */
function getZodDescription(schema: ZodType): string | undefined {
  const def = schema._def as { description?: string };
  return def.description;
}

/**
 * Sanitize a type name to be valid in GraphQL.
 */
export function sanitizeTypeName(name: string): string {
  // Replace dots and special chars with underscores
  let sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');

  // Ensure it starts with a letter
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }

  // PascalCase
  return sanitized
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Sanitize a field name to be valid in GraphQL.
 */
export function sanitizeFieldName(name: string): string {
  // Replace special chars with underscores
  let sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');

  // Ensure it starts with a letter or underscore
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }

  // camelCase
  return sanitized.charAt(0).toLowerCase() + sanitized.slice(1);
}

/**
 * Sanitize an enum value to be valid in GraphQL.
 */
export function sanitizeEnumValue(value: string): string {
  // Replace special chars with underscores and uppercase
  return value.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
}

/**
 * Create a mapping result object.
 */
export function createMappingResult(
  type: GraphQLOutputType | GraphQLInputType,
  nullable: boolean = false,
  isList: boolean = false
): TypeMappingResult {
  return {
    type,
    nullable,
    isList,
  };
}
