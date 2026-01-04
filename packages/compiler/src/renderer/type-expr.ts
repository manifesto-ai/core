/**
 * TypeExpr to MEL Renderer
 *
 * Converts TypeExpr AST to MEL type syntax.
 *
 * @example
 * // { kind: "primitive", name: "string" } -> "string"
 * // { kind: "array", element: { kind: "ref", name: "Todo" } } -> "Array<Todo>"
 * // { kind: "union", members: [...] } -> "string | number | null"
 */

/**
 * TypeExpr type from translator package
 */
export type TypeExpr =
  | { kind: "primitive"; name: "string" | "number" | "boolean" | "null" }
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "ref"; name: string }
  | { kind: "array"; element: TypeExpr }
  | { kind: "record"; key: TypeExpr; value: TypeExpr }
  | { kind: "union"; members: TypeExpr[] }
  | { kind: "object"; fields: TypeField[] };

export type TypeField = {
  readonly name: string;
  readonly optional: boolean;
  readonly type: TypeExpr;
};

/**
 * Renders a TypeExpr to MEL type syntax string.
 *
 * @param typeExpr - The TypeExpr to render
 * @returns MEL type syntax string
 */
export function renderTypeExpr(typeExpr: TypeExpr): string {
  switch (typeExpr.kind) {
    case "primitive":
      return typeExpr.name;

    case "literal":
      return renderLiteralValue(typeExpr.value);

    case "ref":
      return typeExpr.name;

    case "array":
      return `Array<${renderTypeExpr(typeExpr.element)}>`;

    case "record":
      return `Record<${renderTypeExpr(typeExpr.key)}, ${renderTypeExpr(typeExpr.value)}>`;

    case "union":
      return renderUnion(typeExpr.members);

    case "object":
      return renderObjectType(typeExpr.fields);
  }
}

/**
 * Renders a literal value for type syntax.
 */
function renderLiteralValue(value: string | number | boolean | null): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return `"${escapeString(value)}"`;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

/**
 * Renders a union type.
 */
function renderUnion(members: TypeExpr[]): string {
  if (members.length === 0) {
    return "never";
  }
  return members.map(renderTypeExpr).join(" | ");
}

/**
 * Renders an object type with fields.
 */
function renderObjectType(fields: TypeField[]): string {
  if (fields.length === 0) {
    return "{}";
  }

  const fieldStrings = fields.map((field) => {
    const optional = field.optional ? "?" : "";
    return `${field.name}${optional}: ${renderTypeExpr(field.type)}`;
  });

  return `{ ${fieldStrings.join(", ")} }`;
}

/**
 * Renders a TypeField with optional default value.
 *
 * @param field - The TypeField to render
 * @param defaultValue - Optional default value
 * @returns MEL field declaration string
 */
export function renderTypeField(
  field: TypeField,
  defaultValue?: unknown
): string {
  const typeStr = renderTypeExpr(field.type);

  if (defaultValue !== undefined) {
    return `${field.name}: ${typeStr} = ${renderValue(defaultValue)}`;
  }

  if (field.optional) {
    return `${field.name}?: ${typeStr}`;
  }

  return `${field.name}: ${typeStr}`;
}

/**
 * Renders a JavaScript value to MEL syntax.
 */
export function renderValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return `"${escapeString(value)}"`;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    const items = value.map(renderValue).join(", ");
    return `[${items}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .map(([k, v]) => `${k}: ${renderValue(v)}`)
      .join(", ");
    return `{ ${entries} }`;
  }
  return String(value);
}

/**
 * Escapes a string for MEL syntax.
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}
