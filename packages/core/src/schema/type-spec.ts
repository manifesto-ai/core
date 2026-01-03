import { z } from "zod";

export type TypeDefinition =
  | { kind: "primitive"; type: string }
  | { kind: "array"; element: TypeDefinition }
  | { kind: "record"; key: TypeDefinition; value: TypeDefinition }
  | { kind: "object"; fields: Record<string, { type: TypeDefinition; optional: boolean }> }
  | { kind: "union"; types: TypeDefinition[] }
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "ref"; name: string };

export const TypeDefinition: z.ZodType<TypeDefinition> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("primitive"),
      type: z.string(),
    }),
    z.object({
      kind: z.literal("array"),
      element: TypeDefinition,
    }),
    z.object({
      kind: z.literal("record"),
      key: TypeDefinition,
      value: TypeDefinition,
    }),
    z.object({
      kind: z.literal("object"),
      fields: z.record(
        z.string(),
        z.object({
          type: TypeDefinition,
          optional: z.boolean(),
        })
      ),
    }),
    z.object({
      kind: z.literal("union"),
      types: z.array(TypeDefinition).min(1),
    }),
    z.object({
      kind: z.literal("literal"),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    }),
    z.object({
      kind: z.literal("ref"),
      name: z.string(),
    }),
  ])
);

export const TypeSpec = z.object({
  name: z.string(),
  definition: TypeDefinition,
});
export type TypeSpec = z.infer<typeof TypeSpec>;
