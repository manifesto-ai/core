export const areValuesEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false
  }

  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}
