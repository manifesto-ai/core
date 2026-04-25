import type { JsonLiteral } from "../annotations.js";
import type { Diagnostic } from "../diagnostics/types.js";
import { compareUnicodeCodePoints } from "../utils/unicode-order.js";
import { editError, validateIdentifierFragment } from "./compile-fragment-validation.js";

const MAX_FRAGMENT_ARRAY_LENGTH = 10_000;

type JsonLiteralSnapshot =
  | { readonly ok: true; readonly value: JsonLiteral; readonly diagnostics: readonly Diagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

type ValueReadResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

type LengthReadResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

type ArrayBrandReadResult =
  | { readonly ok: true; readonly value: readonly unknown[] | null }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

export function validateJsonLiteralFragment(value: unknown, label: string): Diagnostic[] {
  return [...snapshotJsonLiteralFragment(value, label).diagnostics];
}

export function snapshotJsonLiteralFragment(value: unknown, label: string): JsonLiteralSnapshot {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return { ok: true, value, diagnostics: [] };
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { ok: true, value, diagnostics: [] }
      : { ok: false, diagnostics: [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be a finite JSON number.`)] };
  }
  if (typeof value !== "object") {
    return { ok: false, diagnostics: [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be a JSON literal.`)] };
  }

  const array = readArrayBrand(value, `${label} must be inspectable JSON data.`);
  if (!array.ok) return { ok: false, diagnostics: [array.diagnostic] };
  if (array.value !== null) {
    return snapshotJsonArray(array.value, label);
  }
  return snapshotJsonObject(value, label);
}

function snapshotJsonArray(value: readonly unknown[], label: string): JsonLiteralSnapshot {
  const length = readArrayLength(value, `${label} array`);
  if (!length.ok) return { ok: false, diagnostics: [length.diagnostic] };
  const shape = validateArrayShape(value, length.value, `${label} array`);
  if (shape) return { ok: false, diagnostics: [shape] };

  const diagnostics: Diagnostic[] = [];
  const snapshot: JsonLiteral[] = [];
  for (let index = 0; index < length.value; index += 1) {
    const item = readRequiredArrayItem(value, index, `${label} array`);
    if (!item.ok) {
      diagnostics.push(item.diagnostic);
      continue;
    }
    const itemSnapshot = snapshotJsonLiteralFragment(item.value, `${label}[${index}]`);
    diagnostics.push(...itemSnapshot.diagnostics);
    if (itemSnapshot.ok) {
      snapshot.push(itemSnapshot.value);
    }
  }
  return diagnostics.length === 0
    ? { ok: true, value: snapshot, diagnostics }
    : { ok: false, diagnostics };
}

function snapshotJsonObject(value: object, label: string): JsonLiteralSnapshot {
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch {
    return { ok: false, diagnostics: [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} object must be inspectable JSON data.`)] };
  }
  if (prototype !== Object.prototype && prototype !== null) {
    return { ok: false, diagnostics: [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} object must be a plain JSON object.`)] };
  }

  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return { ok: false, diagnostics: [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} object must be inspectable JSON data.`)] };
  }

  const keys: string[] = [];
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key === "symbol") {
      return { ok: false, diagnostics: [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} object keys must be JSON object keys.`)] };
    }
    keys.push(key);
  }

  const diagnostics: Diagnostic[] = [];
  const snapshot = Object.create(null) as { [key: string]: JsonLiteral };
  for (const key of keys.sort(compareUnicodeCodePoints)) {
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor)) {
      diagnostics.push(editError("E_FRAGMENT_SCOPE_VIOLATION", `${label}.${key} must be a JSON data property.`));
      continue;
    }
    if (!descriptor.enumerable) {
      diagnostics.push(editError("E_FRAGMENT_SCOPE_VIOLATION", `${label}.${key} must be enumerable JSON data.`));
      continue;
    }

    const keyDiagnostics = validateIdentifierFragment(key, `${label} object key`);
    diagnostics.push(...keyDiagnostics);
    const property = readRequiredDataProperty(value, key, `${label}.${key}`);
    if (!property.ok) {
      diagnostics.push(property.diagnostic);
      continue;
    }
    const propertySnapshot = snapshotJsonLiteralFragment(property.value, `${label}.${key}`);
    diagnostics.push(...propertySnapshot.diagnostics);
    if (keyDiagnostics.length === 0 && propertySnapshot.ok) {
      snapshot[key] = propertySnapshot.value;
    }
  }

  return diagnostics.length === 0
    ? { ok: true, value: snapshot, diagnostics }
    : { ok: false, diagnostics };
}

function readArrayBrand(value: unknown, message: string): ArrayBrandReadResult {
  try {
    return { ok: true, value: Array.isArray(value) ? value : null };
  } catch {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", message) };
  }
}

function readArrayLength(value: readonly unknown[], label: string): LengthReadResult {
  try {
    return { ok: true, value: value.length };
  } catch {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be inspectable JSON data.`) };
  }
}

function validateArrayShape(value: readonly unknown[], length: number, label: string): Diagnostic | null {
  if (length > MAX_FRAGMENT_ARRAY_LENGTH) {
    return editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must contain at most ${MAX_FRAGMENT_ARRAY_LENGTH} items.`);
  }
  let descriptors: object;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be inspectable JSON data.`);
  }
  let indexCount = 0;
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key === "symbol" || (key !== "length" && !isArrayIndexKey(key, length))) {
      return editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} keys must be JSON array indexes.`);
    }
    if (key === "length") continue;
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      return editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be inspectable JSON data.`);
    }
    if (!descriptor || !("value" in descriptor)) {
      return editError("E_FRAGMENT_SCOPE_VIOLATION", `${label}[${key}] must be a JSON data property.`);
    }
    if (!descriptor.enumerable) {
      return editError("E_FRAGMENT_SCOPE_VIOLATION", `${label}[${key}] must be enumerable JSON data.`);
    }
    indexCount += 1;
  }
  if (indexCount !== length) {
    return editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be dense JSON array data.`);
  }
  return null;
}

function isArrayIndexKey(key: string, length: number): boolean {
  const index = Number(key);
  return Number.isInteger(index) && index >= 0 && index < length && String(index) === key;
}

function readRequiredArrayItem(value: readonly unknown[], index: number, label: string): ValueReadResult {
  try {
    if (!Object.hasOwn(value, index)) {
      return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", `${label}[${index}] must be present JSON data.`) };
    }
  } catch {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be inspectable JSON data.`) };
  }
  return readRequiredDataProperty(value, String(index), `${label}[${index}]`);
}

function readRequiredDataProperty(value: object, key: string, label: string): ValueReadResult {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be inspectable JSON data.`) };
  }
  if (!descriptor) {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be present JSON data.`) };
  }
  if (!("value" in descriptor)) {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be a JSON data property.`) };
  }
  try {
    return { ok: true, value: (value as Record<string, unknown>)[key] };
  } catch {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be inspectable JSON data.`) };
  }
}
