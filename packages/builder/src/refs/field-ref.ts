/**
 * FieldRef<T> - Typed pointer to a state field
 *
 * Replaces string paths with type-safe references (FDR-B001).
 * The phantom type T carries the field's data type for compile-time checking.
 */
export interface FieldRef<T = unknown> {
  readonly __brand: "FieldRef";
  readonly __type?: T; // Phantom type (never used at runtime)
  readonly path: string;
}

/**
 * Create a FieldRef. Internal use only - users get refs from StateAccessor.
 */
export function createFieldRef<T>(path: string): FieldRef<T> {
  return {
    __brand: "FieldRef",
    path,
  } as FieldRef<T>;
}

/**
 * Type guard for FieldRef
 */
export function isFieldRef(value: unknown): value is FieldRef<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as FieldRef<unknown>).__brand === "FieldRef"
  );
}
