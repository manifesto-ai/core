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
  if (!Array.isArray(params)) {
    return [editError("E_FRAGMENT_SCOPE_VIOLATION", "action params must be an array.")];
  }
  return params.flatMap((param, index) => {
    if (param === null || typeof param !== "object") {
      return [editError("E_FRAGMENT_SCOPE_VIOLATION", `action parameter ${index} must be an object.`)];
    }
    const candidate = param as { readonly name?: unknown; readonly type?: unknown };
    return [
      ...validateIdentifierFragment(candidate.name, "action parameter name"),
      ...validateTypeFragment(candidate.type),
    ];
  });
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
  if (Array.isArray(value)) {
    try {
      return value.flatMap((item, index) => validateJsonLiteralFragment(item, `${label}[${index}]`));
    } catch {
      return [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label} array must be inspectable JSON data.`)];
    }
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
  return Object.keys(descriptors).sort(compareUnicodeCodePoints).flatMap((key) => {
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor)) {
      return [editError("E_FRAGMENT_SCOPE_VIOLATION", `${label}.${key} must be a JSON data property.`)];
    }
    return [
      ...validateIdentifierFragment(key, `${label} object key`),
      ...validateJsonLiteralFragment(descriptor.value, `${label}.${key}`),
    ];
  });
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
