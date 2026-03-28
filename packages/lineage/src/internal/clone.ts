export function cloneValue<T>(value: T): T {
  return structuredClone(value);
}
