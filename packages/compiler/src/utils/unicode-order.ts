export function compareUnicodeCodePoints(a: string, b: string): number {
  const aPoints = Array.from(a);
  const bPoints = Array.from(b);
  const length = Math.min(aPoints.length, bPoints.length);

  for (let index = 0; index < length; index += 1) {
    const aCode = aPoints[index].codePointAt(0) ?? 0;
    const bCode = bPoints[index].codePointAt(0) ?? 0;
    if (aCode !== bCode) {
      return aCode - bCode;
    }
  }

  return aPoints.length - bPoints.length;
}

export function sortKeysByUnicodeCodePoint(keys: readonly string[]): string[] {
  return [...keys].sort(compareUnicodeCodePoints);
}

export function stableSortByUnicodeObjectKey<T extends { key: string }>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const keyOrder = compareUnicodeCodePoints(left.item.key, right.item.key);
      return keyOrder !== 0 ? keyOrder : left.index - right.index;
    })
    .map(({ item }) => item);
}
