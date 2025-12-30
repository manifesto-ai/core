/**
 * ComputedRef<T> - Typed pointer to a computed value
 *
 * Path format: "computed.<name>" (FDR-B002)
 * Enables meaningful explain paths for explainability.
 */
export interface ComputedRef<T = unknown> {
  readonly __brand: "ComputedRef";
  readonly __type?: T; // Phantom type (never used at runtime)
  readonly path: `computed.${string}`;
  readonly name: string;
}

/**
 * Create a ComputedRef. Internal use - users get refs from computed.define().
 */
export function createComputedRef<T>(name: string): ComputedRef<T> {
  return {
    __brand: "ComputedRef",
    path: `computed.${name}`,
    name,
  } as ComputedRef<T>;
}

/**
 * Type guard for ComputedRef
 */
export function isComputedRef(value: unknown): value is ComputedRef<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ComputedRef<unknown>).__brand === "ComputedRef"
  );
}
