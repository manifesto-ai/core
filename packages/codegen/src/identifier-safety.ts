// Identifier safety helpers for generated TypeScript output.
//
// Schema keys are arbitrary strings. Generated TypeScript must stay valid for
// every legal schema key, so emission sites use these helpers to:
// - quote property keys that are not valid identifier names
// - sanitize binding positions (parameter names, declaration names)
// - allocate deterministic collision-free aliases for sanitized names
//
// Original schema keys are always preserved at the property-key level via
// quoting; sanitized aliases are only used where TypeScript syntactically
// requires an identifier.

/** ECMAScript IdentifierName syntax (reserved words allowed). */
const IDENTIFIER_NAME_PATTERN = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u;
const IDENTIFIER_START_PATTERN = /^[$_\p{ID_Start}]$/u;
const IDENTIFIER_PART_PATTERN = /^[$\u200C\u200D\p{ID_Continue}]$/u;

/** Reserved words (including strict-mode reserved words) that cannot be binding identifiers. */
const RESERVED_WORDS = new Set([
  "arguments", "await", "break", "case", "catch", "class", "const",
  "continue", "debugger", "default", "delete", "do", "else", "enum",
  "eval", "export", "extends", "false", "finally", "for", "function",
  "if", "implements", "import", "in", "instanceof", "interface", "let",
  "new", "null", "package", "private", "protected", "public", "return",
  "static", "super", "switch", "this", "throw", "true", "try", "typeof",
  "var", "void", "while", "with", "yield",
]);

/** Predefined type names that TypeScript rejects as declaration names. */
const FORBIDDEN_TYPE_DECLARATION_NAMES = new Set([
  "any", "bigint", "boolean", "never", "number", "object",
  "string", "symbol", "undefined", "unknown",
]);

/**
 * True when `name` is a valid ECMAScript IdentifierName and may be emitted
 * unquoted in property-key position (reserved words are allowed there).
 */
export function isIdentifierName(name: string): boolean {
  return IDENTIFIER_NAME_PATTERN.test(name);
}

/**
 * True when `name` may be emitted in a binding position
 * (parameter name, variable name).
 */
export function isBindingIdentifier(name: string): boolean {
  return isIdentifierName(name) && !RESERVED_WORDS.has(name);
}

/**
 * True when `name` may be emitted as a type/interface declaration name.
 */
export function isTypeDeclarationName(name: string): boolean {
  return isBindingIdentifier(name) && !FORBIDDEN_TYPE_DECLARATION_NAMES.has(name);
}

/**
 * Render a schema key in property-key position. Keys that are not valid
 * identifier names are emitted as quoted string properties, preserving the
 * original key for runtime lookup.
 */
export function renderPropertyKey(name: string): string {
  return isIdentifierName(name) ? name : JSON.stringify(name);
}

/**
 * Deterministically rewrite `name` into a valid binding identifier:
 * invalid characters become "_", a leading character that cannot start an
 * identifier is prefixed with "_", and reserved words are prefixed with "_".
 */
export function sanitizeIdentifier(name: string): string {
  const chars = Array.from(name);
  let base = chars
    .map((ch) => (IDENTIFIER_PART_PATTERN.test(ch) ? ch : "_"))
    .join("");
  const first = Array.from(base)[0];
  if (first === undefined || !IDENTIFIER_START_PATTERN.test(first)) {
    base = `_${base}`;
  }
  if (RESERVED_WORDS.has(base)) {
    base = `_${base}`;
  }
  return base;
}

export type IdentifierAliasMap = ReadonlyMap<string, string>;

/**
 * Build a deterministic alias map for type declaration names.
 *
 * Valid names map to themselves. Invalid names are sanitized; sanitized
 * aliases never collide with valid original names, `reserved` names, or each
 * other — collisions are resolved with deterministic `_2`, `_3`, ... suffixes
 * in lexicographic key order.
 */
export function createTypeNameAliasMap(
  names: readonly string[],
  reserved: readonly string[] = []
): IdentifierAliasMap {
  const sorted = [...names].sort();
  const used = new Set(reserved);
  const aliases = new Map<string, string>();

  for (const name of sorted) {
    if (isTypeDeclarationName(name)) {
      aliases.set(name, name);
      used.add(name);
    }
  }

  for (const name of sorted) {
    if (aliases.has(name)) {
      continue;
    }
    let base = sanitizeIdentifier(name);
    while (!isTypeDeclarationName(base)) {
      base = `_${base}`;
    }
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    aliases.set(name, candidate);
  }

  return aliases;
}

/**
 * Deterministically rewrite an ordered parameter-name list so every entry is
 * a valid binding identifier. Sanitized names never collide with valid
 * original names or earlier sanitized names.
 */
export function sanitizeParameterNames(params: readonly string[]): string[] {
  const used = new Set(params.filter((name) => isBindingIdentifier(name)));
  return params.map((name) => {
    if (isBindingIdentifier(name)) {
      return name;
    }
    const base = sanitizeIdentifier(name);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    return candidate;
  });
}
