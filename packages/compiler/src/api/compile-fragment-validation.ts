import type { DomainModule, LocalTargetKey } from "../annotations.js";
import { createError, type Diagnostic } from "../diagnostics/types.js";
import { tokenize } from "../lexer/index.js";
import { parse, type ProgramNode } from "../parser/index.js";
import { compareUnicodeCodePoints } from "../utils/unicode-order.js";

export const EMPTY_LOCATION = {
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 },
};

export function editError(code: string, message: string, location: ProgramNode["location"] = EMPTY_LOCATION): Diagnostic {
  return createError(code, message, location);
}

export function diagnosticsOf(result: { warnings: readonly Diagnostic[]; errors: readonly Diagnostic[] }): Diagnostic[] {
  return [...result.warnings, ...result.errors];
}

export function parseProgram(source: string): { program: ProgramNode | null; diagnostics: Diagnostic[] } {
  const lexResult = tokenize(source);
  const lexErrors = lexResult.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (lexErrors.length > 0) {
    return { program: null, diagnostics: lexErrors };
  }
  const parseResult = parse(lexResult.tokens);
  const parseErrors = parseResult.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  return { program: parseResult.program, diagnostics: parseErrors };
}

export function validateExpressionFragment(expr: unknown): Diagnostic[] {
  if (typeof expr !== "string") {
    return [editError("E_FRAGMENT_SCOPE_VIOLATION", "expression fragment must be source text.")];
  }
  return mapFragmentDiagnostics(parseFragment(`domain __Fragment { computed __fragment = ${expr} }`), "expression");
}

export function validateTypeFragment(typeSource: unknown): Diagnostic[] {
  if (typeof typeSource !== "string") {
    return [editError("E_FRAGMENT_SCOPE_VIOLATION", "type fragment must be source text.")];
  }
  return mapFragmentDiagnostics(parseFragment(`domain __Fragment { type __FragmentType = ${typeSource} }`), "type");
}

export function validateStateFieldFragment(typeSource: unknown, defaultSource: string): Diagnostic[] {
  if (typeof typeSource !== "string") {
    return [editError("E_FRAGMENT_SCOPE_VIOLATION", "state field type fragment must be source text.")];
  }
  return mapFragmentDiagnostics(
    parseFragment(`domain __Fragment { state { __field: ${typeSource} = ${defaultSource} } }`),
    "state field",
  );
}

export function validateActionBodyFragment(body: unknown): Diagnostic[] {
  if (typeof body !== "string") {
    return [editError("E_FRAGMENT_SCOPE_VIOLATION", "action body fragment must be source text.")];
  }
  const bodyLex = tokenize(body);
  const smuggled = bodyLex.tokens.find((token) =>
    ["DOMAIN", "STATE", "COMPUTED", "ACTION", "TYPE", "IMPORT", "EXPORT"].includes(token.kind));
  if (smuggled) {
    return [editError("E_FRAGMENT_SCOPE_VIOLATION", "Action body fragments cannot contain top-level declarations.", smuggled.location)];
  }
  return mapFragmentDiagnostics(parseFragment(`domain __Fragment { action __fragment() { ${body} } }`), "action body");
}

export function validateIdentifierFragment(value: unknown, label: string): Diagnostic[] {
  if (typeof value !== "string") {
    return [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be source text.`)];
  }
  const lexResult = tokenize(value);
  const lexErrors = lexResult.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const tokens = lexResult.tokens.filter((token) => token.kind !== "EOF");
  if (
    lexErrors.length > 0
    || tokens.length !== 1
    || tokens[0]?.kind !== "IDENTIFIER"
    || tokens[0].lexeme !== value
  ) {
    return [
      editError(
        "E_FRAGMENT_SCOPE_VIOLATION",
        `${label} must be one MEL identifier and cannot contain raw source syntax.`,
        tokens[0]?.location ?? EMPTY_LOCATION,
      ),
    ];
  }
  return [];
}

export function validateParamsFragment(params: unknown): Diagnostic[] {
  const array = readArrayBrand(params, "action params must be inspectable JSON data.");
  if (!array.ok) {
    return [array.diagnostic];
  }
  if (array.value === null) {
    return [editError("E_FRAGMENT_SCOPE_VIOLATION", "action params must be an array.")];
  }
  const length = readArrayLength(array.value, "action params");
  if (!length.ok) {
    return [length.diagnostic];
  }
  const diagnostics: Diagnostic[] = [];
  for (let index = 0; index < length.value; index += 1) {
    const item = readRequiredArrayItem(array.value, index, "action params");
    if (!item.ok) {
      diagnostics.push(item.diagnostic);
      continue;
    }
    const param = item.value;
    if (param === null || typeof param !== "object") {
      diagnostics.push(editError("E_FRAGMENT_SCOPE_VIOLATION", `action parameter ${index} must be an object.`));
      continue;
    }
    const name = readOptionalDataProperty(param, "name", `action parameter ${index}.name`);
    const type = readOptionalDataProperty(param, "type", `action parameter ${index}.type`);
    if (!name.ok) {
      diagnostics.push(name.diagnostic);
    } else {
      diagnostics.push(...validateIdentifierFragment(name.value, "action parameter name"));
    }
    if (!type.ok) {
      diagnostics.push(type.diagnostic);
    } else {
      diagnostics.push(...validateTypeFragment(type.value));
    }
  }
  return diagnostics;
}

type EditOperationKindRead =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

export function readEditOperationKind(value: unknown): EditOperationKindRead {
  if (value === null || typeof value !== "object") {
    return {
      ok: false,
      diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", "compileFragmentInContext() requires one object edit operation."),
    };
  }
  const array = readArrayBrand(value, "Source edit operation must be inspectable.");
  if (!array.ok) {
    return { ok: false, diagnostic: array.diagnostic };
  }
  if (array.value !== null) {
    return {
      ok: false,
      diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", "compileFragmentInContext() accepts exactly one edit operation."),
    };
  }
  let kind: unknown;
  try {
    kind = (value as { readonly kind?: unknown }).kind;
  } catch {
    return {
      ok: false,
      diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", "Source edit operation kind must be inspectable."),
    };
  }
  if (typeof kind !== "string") {
    return {
      ok: false,
      diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", "Source edit operation kind must be source text."),
    };
  }
  return { ok: true, value: kind };
}

export function validateJsonLiteralFragment(value: unknown, label: string): Diagnostic[] {
  if (value === null) {
    return [];
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return [];
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? []
      : [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be a finite JSON number.`)];
  }
  if (value === null || typeof value !== "object") {
    return [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be a JSON literal.`)];
  }
  const array = readArrayBrand(value, `${label} must be inspectable JSON data.`);
  if (!array.ok) {
    return [array.diagnostic];
  }
  if (array.value !== null) {
    const length = readArrayLength(array.value, `${label} array`);
    if (!length.ok) {
      return [length.diagnostic];
    }
    const ownProperties = validateArrayOwnProperties(array.value, length.value, `${label} array`);
    if (ownProperties) {
      return [ownProperties];
    }
    const diagnostics: Diagnostic[] = [];
    for (let index = 0; index < length.value; index += 1) {
      const item = readRequiredArrayItem(array.value, index, `${label} array`);
      if (!item.ok) {
        diagnostics.push(item.diagnostic);
      } else {
        diagnostics.push(...validateJsonLiteralFragment(item.value, `${label}[${index}]`));
      }
    }
    return diagnostics;
  }
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch {
    return [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} object must be inspectable JSON data.`)];
  }
  if (prototype !== Object.prototype && prototype !== null) {
    return [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} object must be a plain JSON object.`)];
  }

  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} object must be inspectable JSON data.`)];
  }
  const keys: string[] = [];
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key === "symbol") {
      return [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} object keys must be JSON object keys.`)];
    }
    keys.push(key);
  }
  return keys.sort(compareUnicodeCodePoints).flatMap((key) => {
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor)) {
      return [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label}.${key} must be a JSON data property.`)];
    }
    if (!descriptor.enumerable) {
      return [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label}.${key} must be enumerable JSON data.`)];
    }
    const property = readRequiredDataProperty(value, key, `${label}.${key}`);
    if (!property.ok) {
      return [property.diagnostic];
    }
    return [
      ...validateIdentifierFragment(key, `${label} object key`),
      ...validateJsonLiteralFragment(property.value, `${label}.${key}`),
    ];
  });
}

type ValueReadResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

type LengthReadResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

type ArrayBrandReadResult =
  | { readonly ok: true; readonly value: readonly unknown[] | null }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

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

function validateArrayOwnProperties(
  value: readonly unknown[],
  length: number,
  label: string,
): Diagnostic | null {
  let descriptors: object;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be inspectable JSON data.`);
  }
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key === "symbol" || (key !== "length" && !isArrayIndexKey(key, length))) {
      return editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} keys must be JSON array indexes.`);
    }
  }
  return null;
}

function isArrayIndexKey(key: string, length: number): boolean {
  const index = Number(key);
  return Number.isInteger(index)
    && index >= 0
    && index < length
    && String(index) === key;
}

function readRequiredArrayItem(value: readonly unknown[], index: number, label: string): ValueReadResult {
  try {
    if (!Object.hasOwn(value, index)) {
      return {
        ok: false,
        diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", `${label}[${index}] must be present JSON data.`),
      };
    }
  } catch {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be inspectable JSON data.`) };
  }
  return readRequiredDataProperty(value, String(index), `${label}[${index}]`);
}

function readOptionalDataProperty(value: object, key: string, label: string): ValueReadResult {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    return { ok: false, diagnostic: editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} must be inspectable JSON data.`) };
  }
  if (!descriptor) {
    return { ok: true, value: undefined };
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

export function validateTarget(
  baseModule: DomainModule,
  target: unknown,
  allowedKinds: readonly string[],
): Diagnostic | null {
  if (typeof target !== "string") {
    return editError("E_FRAGMENT_SCOPE_VIOLATION", "Target must be a source-map target key.");
  }
  if (!Object.hasOwn(baseModule.sourceMap.entries, target)) {
    return targetNotFound(target as LocalTargetKey);
  }
  const kind = targetKind(target);
  if (!kind || !allowedKinds.includes(kind)) {
    return editError("E_TARGET_KIND_MISMATCH", `Target ${target} is not valid for this operation.`);
  }
  return null;
}

export function targetNotFound(target: LocalTargetKey): Diagnostic {
  return editError("E_TARGET_NOT_FOUND", `Target ${target} does not exist.`);
}

export function targetKind(target: string): string | null {
  const separator = target.indexOf(":");
  return separator > 0 ? target.slice(0, separator) : null;
}

function parseFragment(source: string): readonly Diagnostic[] {
  const lexResult = tokenize(source);
  const lexErrors = lexResult.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (lexErrors.length > 0) {
    return lexErrors;
  }

  const parseResult = parse(lexResult.tokens);
  return parseResult.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
}

function mapFragmentDiagnostics(diagnostics: readonly Diagnostic[], label: string): Diagnostic[] {
  return diagnostics.map((diagnostic) =>
    editError("E_FRAGMENT_PARSE_FAILED", `Invalid ${label} fragment: ${diagnostic.message}`, diagnostic.location));
}
