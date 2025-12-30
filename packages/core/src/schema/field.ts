import { z } from "zod";

/**
 * Field type definitions
 */
export const PrimitiveFieldType = z.enum([
  "string",
  "number",
  "boolean",
  "null",
  "object",
  "array",
]);
export type PrimitiveFieldType = z.infer<typeof PrimitiveFieldType>;

export const EnumFieldType = z.object({
  enum: z.array(z.unknown()).readonly(),
});
export type EnumFieldType = z.infer<typeof EnumFieldType>;

export const FieldType = z.union([PrimitiveFieldType, EnumFieldType]);
export type FieldType = z.infer<typeof FieldType>;

/**
 * Field specification (recursive for nested objects/arrays)
 */
export type FieldSpec = {
  type: FieldType;
  required: boolean;
  default?: unknown;
  description?: string;
  fields?: Record<string, FieldSpec>; // For object type
  items?: FieldSpec; // For array type
};

export const FieldSpec: z.ZodType<FieldSpec> = z.lazy(() =>
  z.object({
    type: FieldType,
    required: z.boolean(),
    default: z.unknown().optional(),
    description: z.string().optional(),
    fields: z.record(z.string(), FieldSpec).optional(),
    items: FieldSpec.optional(),
  })
);

/**
 * State specification - defines the shape of domain state
 */
export const StateSpec = z.object({
  fields: z.record(z.string(), FieldSpec),
});
export type StateSpec = z.infer<typeof StateSpec>;
