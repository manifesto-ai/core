/**
 * ExprNode to MEL Renderer
 *
 * Converts ExprNode AST to MEL expression syntax.
 *
 * @example
 * // { kind: "lit", value: 5 } -> "5"
 * // { kind: "get", path: "count" } -> "count"
 * // { kind: "add", left: { kind: "get", path: "x" }, right: { kind: "lit", value: 1 } } -> "add(x, 1)"
 * // { kind: "gt", left: { kind: "get", path: "count" }, right: { kind: "lit", value: 0 } } -> "gt(count, 0)"
 */

/**
 * ExprNode type (subset from core package)
 */
export type ExprNode =
  // Literals
  | { kind: "lit"; value: unknown }
  | { kind: "get"; path: string }
  // Comparison
  | { kind: "eq"; left: ExprNode; right: ExprNode }
  | { kind: "neq"; left: ExprNode; right: ExprNode }
  | { kind: "gt"; left: ExprNode; right: ExprNode }
  | { kind: "gte"; left: ExprNode; right: ExprNode }
  | { kind: "lt"; left: ExprNode; right: ExprNode }
  | { kind: "lte"; left: ExprNode; right: ExprNode }
  // Logical
  | { kind: "and"; args: ExprNode[] }
  | { kind: "or"; args: ExprNode[] }
  | { kind: "not"; arg: ExprNode }
  // Conditional
  | { kind: "if"; cond: ExprNode; then: ExprNode; else: ExprNode }
  // Arithmetic
  | { kind: "add"; left: ExprNode; right: ExprNode }
  | { kind: "sub"; left: ExprNode; right: ExprNode }
  | { kind: "mul"; left: ExprNode; right: ExprNode }
  | { kind: "div"; left: ExprNode; right: ExprNode }
  | { kind: "mod"; left: ExprNode; right: ExprNode }
  // String
  | { kind: "concat"; args: ExprNode[] }
  | { kind: "substring"; str: ExprNode; start: ExprNode; end?: ExprNode }
  | { kind: "trim"; str: ExprNode }
  // Collection
  | { kind: "len"; arg: ExprNode }
  | { kind: "at"; array: ExprNode; index: ExprNode }
  | { kind: "first"; array: ExprNode }
  | { kind: "last"; array: ExprNode }
  | { kind: "slice"; array: ExprNode; start: ExprNode; end?: ExprNode }
  | { kind: "includes"; array: ExprNode; item: ExprNode }
  | { kind: "filter"; array: ExprNode; predicate: ExprNode }
  | { kind: "map"; array: ExprNode; mapper: ExprNode }
  | { kind: "find"; array: ExprNode; predicate: ExprNode }
  | { kind: "every"; array: ExprNode; predicate: ExprNode }
  | { kind: "some"; array: ExprNode; predicate: ExprNode }
  | { kind: "append"; array: ExprNode; items: ExprNode[] }
  // Object
  | { kind: "object"; fields: Record<string, ExprNode> }
  | { kind: "field"; object: ExprNode; property: string }
  | { kind: "keys"; obj: ExprNode }
  | { kind: "values"; obj: ExprNode }
  | { kind: "entries"; obj: ExprNode }
  | { kind: "merge"; objects: ExprNode[] }
  // Type
  | { kind: "typeof"; arg: ExprNode }
  | { kind: "isNull"; arg: ExprNode }
  | { kind: "coalesce"; args: ExprNode[] };

/**
 * Renders an ExprNode to MEL expression syntax string.
 *
 * @param expr - The ExprNode to render
 * @returns MEL expression syntax string
 */
export function renderExprNode(expr: ExprNode): string {
  switch (expr.kind) {
    // Literals
    case "lit":
      return renderLiteral(expr.value);

    case "get":
      return renderPath(expr.path);

    // Comparison (binary)
    case "eq":
      return `eq(${renderExprNode(expr.left)}, ${renderExprNode(expr.right)})`;
    case "neq":
      return `neq(${renderExprNode(expr.left)}, ${renderExprNode(expr.right)})`;
    case "gt":
      return `gt(${renderExprNode(expr.left)}, ${renderExprNode(expr.right)})`;
    case "gte":
      return `gte(${renderExprNode(expr.left)}, ${renderExprNode(expr.right)})`;
    case "lt":
      return `lt(${renderExprNode(expr.left)}, ${renderExprNode(expr.right)})`;
    case "lte":
      return `lte(${renderExprNode(expr.left)}, ${renderExprNode(expr.right)})`;

    // Logical
    case "and":
      if (!expr.args || !Array.isArray(expr.args)) {
        return `and(/* malformed: args undefined */)`;
      }
      return `and(${expr.args.map(renderExprNode).join(", ")})`;
    case "or":
      if (!expr.args || !Array.isArray(expr.args)) {
        return `or(/* malformed: args undefined */)`;
      }
      return `or(${expr.args.map(renderExprNode).join(", ")})`;
    case "not":
      if (!expr.arg) {
        return `not(/* malformed: arg undefined */)`;
      }
      return `not(${renderExprNode(expr.arg)})`;

    // Conditional
    case "if":
      return `if(${renderExprNode(expr.cond)}, ${renderExprNode(expr.then)}, ${renderExprNode(expr.else)})`;

    // Arithmetic
    case "add":
      return `add(${renderExprNode(expr.left)}, ${renderExprNode(expr.right)})`;
    case "sub":
      return `sub(${renderExprNode(expr.left)}, ${renderExprNode(expr.right)})`;
    case "mul":
      return `mul(${renderExprNode(expr.left)}, ${renderExprNode(expr.right)})`;
    case "div":
      return `div(${renderExprNode(expr.left)}, ${renderExprNode(expr.right)})`;
    case "mod":
      return `mod(${renderExprNode(expr.left)}, ${renderExprNode(expr.right)})`;

    // String
    case "concat":
      if (!expr.args || !Array.isArray(expr.args)) {
        return `concat(/* malformed: args undefined */)`;
      }
      return `concat(${expr.args.map(renderExprNode).join(", ")})`;
    case "substring":
      if (expr.end !== undefined) {
        return `substring(${renderExprNode(expr.str)}, ${renderExprNode(expr.start)}, ${renderExprNode(expr.end)})`;
      }
      return `substring(${renderExprNode(expr.str)}, ${renderExprNode(expr.start)})`;
    case "trim":
      return `trim(${renderExprNode(expr.str)})`;

    // Collection
    case "len":
      return `len(${renderExprNode(expr.arg)})`;
    case "at":
      return `at(${renderExprNode(expr.array)}, ${renderExprNode(expr.index)})`;
    case "first":
      return `first(${renderExprNode(expr.array)})`;
    case "last":
      return `last(${renderExprNode(expr.array)})`;
    case "slice":
      if (expr.end !== undefined) {
        return `slice(${renderExprNode(expr.array)}, ${renderExprNode(expr.start)}, ${renderExprNode(expr.end)})`;
      }
      return `slice(${renderExprNode(expr.array)}, ${renderExprNode(expr.start)})`;
    case "includes":
      return `includes(${renderExprNode(expr.array)}, ${renderExprNode(expr.item)})`;
    case "filter":
      return `filter(${renderExprNode(expr.array)}, ${renderExprNode(expr.predicate)})`;
    case "map":
      return `map(${renderExprNode(expr.array)}, ${renderExprNode(expr.mapper)})`;
    case "find":
      return `find(${renderExprNode(expr.array)}, ${renderExprNode(expr.predicate)})`;
    case "every":
      return `every(${renderExprNode(expr.array)}, ${renderExprNode(expr.predicate)})`;
    case "some":
      return `some(${renderExprNode(expr.array)}, ${renderExprNode(expr.predicate)})`;
    case "append":
      if (!expr.items || !Array.isArray(expr.items)) {
        return `append(${renderExprNode(expr.array)}, /* malformed: items undefined */)`;
      }
      return `append(${renderExprNode(expr.array)}, ${expr.items.map(renderExprNode).join(", ")})`;

    // Object
    case "object":
      return renderObjectExpr(expr.fields);
    case "field":
      return `${renderExprNode(expr.object)}.${expr.property}`;
    case "keys":
      return `keys(${renderExprNode(expr.obj)})`;
    case "values":
      return `values(${renderExprNode(expr.obj)})`;
    case "entries":
      return `entries(${renderExprNode(expr.obj)})`;
    case "merge":
      if (!expr.objects || !Array.isArray(expr.objects)) {
        return `merge(/* malformed: objects undefined */)`;
      }
      return `merge(${expr.objects.map(renderExprNode).join(", ")})`;

    // Type
    case "typeof":
      return `typeof(${renderExprNode(expr.arg)})`;
    case "isNull":
      return `isNull(${renderExprNode(expr.arg)})`;
    case "coalesce":
      if (!expr.args || !Array.isArray(expr.args)) {
        return `coalesce(/* malformed: args undefined */)`;
      }
      return `coalesce(${expr.args.map(renderExprNode).join(", ")})`;

    default:
      // Handle unknown expression kinds gracefully
      return `/* unknown: ${JSON.stringify(expr)} */`;
  }
}

/**
 * Renders a literal value.
 */
function renderLiteral(value: unknown): string {
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
    const items = value.map(renderLiteral).join(", ");
    return `[${items}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .map(([k, v]) => `${k}: ${renderLiteral(v)}`)
      .join(", ");
    return `{ ${entries} }`;
  }
  return String(value);
}

/**
 * Renders a semantic path.
 * Converts path like "data.user.name" to just the field reference.
 */
function renderPath(path: string): string {
  // Handle special paths
  if (path.startsWith("$meta.")) {
    return path;
  }
  if (path.startsWith("$system.")) {
    return path;
  }
  if (path.startsWith("$input.")) {
    return path;
  }

  // For data paths, render as field reference
  if (path.startsWith("data.")) {
    return path.slice(5);
  }
  if (path.startsWith("computed.")) {
    return path.slice(9);
  }

  return path;
}

/**
 * Renders an object expression.
 */
function renderObjectExpr(fields: Record<string, ExprNode>): string {
  const entries = Object.entries(fields)
    .map(([key, value]) => `${key}: ${renderExprNode(value)}`)
    .join(", ");
  return `{ ${entries} }`;
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
