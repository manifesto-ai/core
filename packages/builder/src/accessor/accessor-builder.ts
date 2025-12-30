import { z } from "zod";
import { createFieldRef, type FieldRef } from "../refs/field-ref.js";
import type { StateAccessor, RecordAccessor, ArrayAccessor, ObjectAccessor } from "./state-accessor.js";

// Type check helpers for Zod v4
function isZodObject(schema: z.ZodTypeAny): schema is z.ZodObject<z.ZodRawShape> {
  return "shape" in schema && typeof (schema as z.ZodObject<z.ZodRawShape>).shape === "object";
}

function isZodRecord(schema: z.ZodTypeAny): boolean {
  // Check for record-like structure
  const def = (schema as unknown as { _zod?: { def?: { type?: string } } })._zod?.def;
  return def?.type === "record";
}

function isZodArray(schema: z.ZodTypeAny): schema is z.ZodArray<z.ZodTypeAny> {
  return "element" in schema;
}

function isZodOptional(schema: z.ZodTypeAny): schema is z.ZodOptional<z.ZodTypeAny> {
  return "unwrap" in schema && !("removeDefault" in schema) && !isZodNullable(schema);
}

function isZodNullable(schema: z.ZodTypeAny): schema is z.ZodNullable<z.ZodTypeAny> {
  const def = (schema as unknown as { _zod?: { def?: { type?: string } } })._zod?.def;
  return def?.type === "nullable";
}

function isZodDefault(schema: z.ZodTypeAny): schema is z.ZodDefault<z.ZodTypeAny> {
  return "removeDefault" in schema;
}

/**
 * Build a StateAccessor from a Zod schema at runtime.
 *
 * This creates the actual FieldRef objects with correct paths.
 * The resulting object mirrors the schema shape with FieldRefs at leaves.
 *
 * For objects, returns an ObjectAccessor that is both:
 * - FieldRef<T> (with path, __brand) - can use patch(state.user)
 * - Children object - can access state.user.name
 */
export function buildAccessor<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  basePath: string = ""
): StateAccessor<z.ZodObject<T>> {
  const shape = schema.shape;

  // Create the base FieldRef for this object
  const baseRef = createFieldRef<z.infer<z.ZodObject<T>>>(basePath);

  // Build children accessors
  const children: Record<string, unknown> = {};
  for (const [key, fieldSchema] of Object.entries(shape)) {
    const path = basePath ? `${basePath}.${key}` : key;
    children[key] = buildFieldAccessor(fieldSchema as z.ZodTypeAny, path);
  }

  // Combine FieldRef properties with children (intersection)
  return Object.assign(children, baseRef) as StateAccessor<z.ZodObject<T>>;
}

/**
 * Build accessor for a single field
 */
function buildFieldAccessor(schema: z.ZodTypeAny, path: string): unknown {
  // Unwrap optional/nullable/default
  const unwrapped = unwrapSchema(schema);

  if (isZodObject(unwrapped)) {
    // Create ObjectAccessor: FieldRef + children (intersection)
    return buildObjectAccessor(unwrapped as z.ZodObject<z.ZodRawShape>, path);
  }

  if (isZodRecord(unwrapped)) {
    // Create RecordAccessor with byId method
    return createRecordAccessor(path);
  }

  if (isZodArray(unwrapped)) {
    // Create ArrayAccessor (atomic)
    return createArrayAccessor(path);
  }

  // All other types (primitives, enums, unions, etc.) -> FieldRef
  return createFieldRef(path);
}

/**
 * Build ObjectAccessor for nested objects
 * Returns an intersection of FieldRef and children accessors
 */
function buildObjectAccessor<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  path: string
): ObjectAccessor<z.infer<z.ZodObject<T>>, T> {
  const shape = schema.shape;

  // Create the base FieldRef for this object
  const baseRef = createFieldRef<z.infer<z.ZodObject<T>>>(path);

  // Build children accessors
  const children: Record<string, unknown> = {};
  for (const [key, fieldSchema] of Object.entries(shape)) {
    const childPath = `${path}.${key}`;
    children[key] = buildFieldAccessor(fieldSchema as z.ZodTypeAny, childPath);
  }

  // Combine FieldRef properties with children (intersection)
  return Object.assign(children, baseRef) as ObjectAccessor<z.infer<z.ZodObject<T>>, T>;
}

/**
 * Create a RecordAccessor with byId method
 */
function createRecordAccessor<T>(path: string): RecordAccessor<T> {
  const ref = createFieldRef<Record<string, T>>(path);

  return Object.assign(ref, {
    byId(id: string): FieldRef<T | undefined> {
      return createFieldRef<T | undefined>(`${path}.${id}`);
    },
  }) as RecordAccessor<T>;
}

/**
 * Create an ArrayAccessor (atomic array reference)
 */
function createArrayAccessor<T>(path: string): ArrayAccessor<T> {
  return createFieldRef<T[]>(path) as ArrayAccessor<T>;
}

/**
 * Unwrap wrapper schemas (optional, nullable, default) to get the inner schema
 */
function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (isZodOptional(schema)) {
    return unwrapSchema(schema.unwrap());
  }
  if (isZodNullable(schema)) {
    return unwrapSchema(schema.unwrap());
  }
  if (isZodDefault(schema)) {
    return unwrapSchema(schema.removeDefault());
  }
  return schema;
}
