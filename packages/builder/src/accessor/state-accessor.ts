import type { z } from "zod";
import type { FieldRef } from "../refs/field-ref.js";

/**
 * RecordAccessor - Special accessor for z.record() types
 *
 * Per FDR-B008, record-by-ID is the recommended pattern for mutable collections.
 * This provides type-safe byId() access without array indexing.
 */
export interface RecordAccessor<T> extends FieldRef<Record<string, T>> {
  /**
   * Get a FieldRef for a specific record entry by ID.
   * The returned ref can be used in expressions and patches.
   */
  byId(id: string): FieldRef<T | undefined>;
}

/**
 * ArrayAccessor - Special accessor for z.array() types
 *
 * Arrays are treated as atomic values in v1.0 (no index paths per FDR-B008).
 * Future versions may add array expression helpers.
 */
export interface ArrayAccessor<T> extends FieldRef<T[]> {
  /**
   * Phantom type marker for array item type (for future array helpers)
   */
  readonly __arrayItem?: T;
}

/**
 * Helper type to unwrap Zod wrapper types
 */
type UnwrapZod<T> = T extends z.ZodOptional<infer Inner>
  ? UnwrapZod<Inner>
  : T extends z.ZodNullable<infer Inner>
    ? UnwrapZod<Inner>
    : T extends z.ZodDefault<infer Inner>
      ? UnwrapZod<Inner>
      : T;

/**
 * ObjectAccessor<T, Shape> - Intersection type for nested objects
 *
 * Objects are both:
 * - FieldRef<T> - can be used in patch(state.user)
 * - Children object - can access state.user.name
 */
export type ObjectAccessor<T, Shape extends z.ZodRawShape> = FieldRef<T> & {
  readonly [K in keyof Shape]: StateAccessor<Shape[K]>;
};

/**
 * StateAccessor<T> - Type-level transformation from Zod schema to FieldRef tree
 *
 * Recursively transforms a Zod schema type into a tree of FieldRefs:
 * - Primitives → FieldRef<T>
 * - Objects → ObjectAccessor (FieldRef & children) - allows both patch and dot access
 * - Arrays → ArrayAccessor<T> (atomic, no index access)
 * - Records → RecordAccessor<T> (with byId method)
 * - Optionals/Nullables → unwrapped accessor
 */
export type StateAccessor<T> = T extends z.ZodObject<infer Shape>
  ? ObjectAccessor<z.infer<T>, Shape>
  : T extends z.ZodRecord<z.ZodString, infer V>
    ? RecordAccessor<z.infer<V>>
    : T extends z.ZodArray<infer Item>
      ? ArrayAccessor<z.infer<Item>>
      : T extends z.ZodOptional<infer Inner>
        ? StateAccessor<Inner>
        : T extends z.ZodNullable<infer Inner>
          ? StateAccessor<Inner>
          : T extends z.ZodDefault<infer Inner>
            ? StateAccessor<Inner>
            : T extends z.ZodEnum<infer U extends Readonly<Record<string, string>>>
              ? FieldRef<U[keyof U]>
              : T extends z.ZodUnion<infer Options>
                ? Options extends readonly z.ZodTypeAny[]
                  ? FieldRef<z.infer<Options[number]>>
                  : FieldRef<z.infer<T>>
                : FieldRef<z.infer<T>>;
