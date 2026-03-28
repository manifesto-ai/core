export function assertLineage(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
