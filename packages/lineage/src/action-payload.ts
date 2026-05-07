import {
  ManifestoError,
} from "@manifesto-ai/sdk";

export function cloneAndFreezeActionPayload<T>(value: T): T {
  let cloned: T;
  try {
    cloned = structuredClone(value);
  } catch (error) {
    throw new ManifestoError(
      "INVALID_INPUT",
      `Action input must be structured-cloneable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return deepFreeze(cloned);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }

  const objectValue = value as Record<PropertyKey, unknown>;
  if (seen.has(objectValue) || Object.isFrozen(value)) {
    return value;
  }

  seen.add(objectValue);
  for (const key of Reflect.ownKeys(objectValue)) {
    deepFreeze(objectValue[key], seen);
  }

  return Object.freeze(value);
}
