import { z } from "zod";
import type { FieldSpec, StateSpec, FieldType } from "@manifesto-ai/core";

// Type check helpers for Zod v4 (duck typing)
function isZodObject(schema: z.ZodTypeAny): schema is z.ZodObject<z.ZodRawShape> {
  return "shape" in schema && typeof (schema as z.ZodObject<z.ZodRawShape>).shape === "object";
}

function isZodArray(schema: z.ZodTypeAny): schema is z.ZodArray<z.ZodTypeAny> {
  return "element" in schema;
}

function isZodRecord(schema: z.ZodTypeAny): boolean {
  const def = (schema as unknown as { _zod?: { def?: { type?: string } } })._zod?.def;
  return def?.type === "record";
}

function isZodEnum(schema: z.ZodTypeAny): boolean {
  return "options" in schema && Array.isArray((schema as { options?: unknown[] }).options);
}

function getEnumOptions(schema: z.ZodTypeAny): unknown[] {
  return (schema as { options?: unknown[] }).options ?? [];
}

function isZodLiteral(schema: z.ZodTypeAny): boolean {
  return "value" in schema && !("options" in schema) && !("shape" in schema);
}

function getLiteralValue(schema: z.ZodTypeAny): unknown {
  return (schema as { value?: unknown }).value;
}

function isZodUnion(schema: z.ZodTypeAny): boolean {
  const def = (schema as unknown as { _zod?: { def?: { type?: string } } })._zod?.def;
  return def?.type === "union";
}

function isZodOptional(schema: z.ZodTypeAny): schema is z.ZodOptional<z.ZodTypeAny> {
  const def = (schema as unknown as { _zod?: { def?: { type?: string } } })._zod?.def;
  return def?.type === "optional";
}

function isZodNullable(schema: z.ZodTypeAny): schema is z.ZodNullable<z.ZodTypeAny> {
  const def = (schema as unknown as { _zod?: { def?: { type?: string } } })._zod?.def;
  return def?.type === "nullable";
}

function isZodDefault(schema: z.ZodTypeAny): schema is z.ZodDefault<z.ZodTypeAny> {
  return "removeDefault" in schema;
}

function isZodString(schema: z.ZodTypeAny): boolean {
  const def = (schema as unknown as { _zod?: { def?: { type?: string } } })._zod?.def;
  return def?.type === "string";
}

function isZodNumber(schema: z.ZodTypeAny): boolean {
  const def = (schema as unknown as { _zod?: { def?: { type?: string } } })._zod?.def;
  return def?.type === "number" || def?.type === "int" || def?.type === "float";
}

function isZodBoolean(schema: z.ZodTypeAny): boolean {
  const def = (schema as unknown as { _zod?: { def?: { type?: string } } })._zod?.def;
  return def?.type === "boolean";
}

function isZodNull(schema: z.ZodTypeAny): boolean {
  const def = (schema as unknown as { _zod?: { def?: { type?: string } } })._zod?.def;
  return def?.type === "null";
}

function getUnionOptions(schema: z.ZodTypeAny): z.ZodTypeAny[] {
  const def = (schema as unknown as { _zod?: { def?: { options?: unknown[] } } })._zod?.def;
  return (def?.options as z.ZodTypeAny[]) ?? [];
}

/**
 * Convert a Zod schema to FieldSpec for Core
 */
export function zodToFieldSpec(schema: z.ZodTypeAny): FieldSpec {
  // Unwrap wrappers
  const unwrapped = unwrapZodSchema(schema);

  // Handle object
  if (isZodObject(unwrapped)) {
    const fields: Record<string, FieldSpec> = {};
    const shape = unwrapped.shape;

    for (const [key, fieldSchema] of Object.entries(shape)) {
      fields[key] = zodToFieldSpec(fieldSchema as z.ZodTypeAny);
    }

    return {
      type: "object",
      required: !isOptional(schema),
      fields,
    };
  }

  // Handle array
  if (isZodArray(unwrapped)) {
    return {
      type: "array",
      required: !isOptional(schema),
      items: zodToFieldSpec(unwrapped.element),
    };
  }

  // Handle record as object
  if (isZodRecord(unwrapped)) {
    return {
      type: "object",
      required: !isOptional(schema),
      // Records don't have predefined fields - they're dynamic
    };
  }

  // Handle enum
  if (isZodEnum(unwrapped)) {
    return {
      type: { enum: getEnumOptions(unwrapped) as readonly unknown[] },
      required: !isOptional(schema),
    };
  }

  // Handle literal
  if (isZodLiteral(unwrapped)) {
    return {
      type: { enum: [getLiteralValue(unwrapped)] },
      required: !isOptional(schema),
    };
  }

  // Handle union
  if (isZodUnion(unwrapped)) {
    const options = getUnionOptions(unwrapped);

    // Try to extract enum values if all options are literals
    const allLiterals = options.every((opt) => {
      const u = unwrapZodSchema(opt);
      return isZodLiteral(u);
    });

    if (allLiterals) {
      const values = options.map((opt) => {
        const u = unwrapZodSchema(opt);
        return getLiteralValue(u);
      });
      return {
        type: { enum: values },
        required: !isOptional(schema),
      };
    }

    // Otherwise, treat as generic - pick first non-null type
    const firstNonNull = options.find((opt) => {
      const u = unwrapZodSchema(opt);
      return !isZodNull(u);
    });

    if (firstNonNull) {
      return zodToFieldSpec(firstNonNull);
    }

    return {
      type: "null",
      required: false,
    };
  }

  // Handle primitives
  const primitiveType = getPrimitiveType(unwrapped);
  return {
    type: primitiveType,
    required: !isOptional(schema),
    default: getDefault(schema),
  };
}

/**
 * Get primitive type from Zod schema
 */
function getPrimitiveType(schema: z.ZodTypeAny): FieldType {
  if (isZodString(schema)) return "string";
  if (isZodNumber(schema)) return "number";
  if (isZodBoolean(schema)) return "boolean";
  if (isZodNull(schema)) return "null";

  // Fallback for unknown types
  return "string";
}

/**
 * Check if schema is optional (has optional wrapper or nullable)
 */
function isOptional(schema: z.ZodTypeAny): boolean {
  if (isZodOptional(schema)) return true;
  if (isZodNullable(schema)) return true;
  if (isZodDefault(schema)) return true;
  return false;
}

/**
 * Get default value if specified
 */
function getDefault(schema: z.ZodTypeAny): unknown | undefined {
  if (isZodDefault(schema)) {
    // Zod v4 - try different access patterns
    const def = schema as unknown as { _zod?: { def?: { defaultValue?: () => unknown } } };
    if (typeof def._zod?.def?.defaultValue === "function") {
      return def._zod.def.defaultValue();
    }
    // Fallback - try direct property
    if ("_def" in schema && typeof (schema as { _def?: { defaultValue?: () => unknown } })._def?.defaultValue === "function") {
      return (schema as { _def: { defaultValue: () => unknown } })._def.defaultValue();
    }
  }
  return undefined;
}

/**
 * Unwrap optional/nullable/default wrappers
 */
function unwrapZodSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (isZodOptional(schema)) {
    return unwrapZodSchema(schema.unwrap());
  }
  if (isZodNullable(schema)) {
    return unwrapZodSchema(schema.unwrap());
  }
  if (isZodDefault(schema)) {
    return unwrapZodSchema(schema.removeDefault());
  }
  return schema;
}

/**
 * Convert Zod object schema to StateSpec
 */
export function zodToStateSpec(schema: z.ZodObject<z.ZodRawShape>): StateSpec {
  const fields: Record<string, FieldSpec> = {};
  const shape = schema.shape;

  for (const [key, fieldSchema] of Object.entries(shape)) {
    fields[key] = zodToFieldSpec(fieldSchema as z.ZodTypeAny);
  }

  return { fields };
}
