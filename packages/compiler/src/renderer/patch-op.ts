/**
 * PatchOp to MEL Renderer
 *
 * Converts PatchOp AST to MEL syntax snippets.
 *
 * Note: These are fragments, not complete domain definitions.
 * The caller is responsible for assembling fragments into a valid MEL domain.
 */

import { renderTypeExpr, renderTypeField, renderValue, TypeExpr, TypeField } from "./type-expr.js";
import { renderExprNode, ExprNode } from "./expr-node.js";

// ============ PatchOp Types ============

export type AddTypeOp = {
  kind: "addType";
  typeName: string;
  typeExpr: TypeExpr;
};

export type AddFieldOp = {
  kind: "addField";
  typeName: string;
  field: TypeField & { defaultValue?: unknown };
};

export type SetFieldTypeOp = {
  kind: "setFieldType";
  path: string;
  typeExpr: TypeExpr;
};

export type SetDefaultValueOp = {
  kind: "setDefaultValue";
  path: string;
  value: unknown;
};

export type AddConstraintOp = {
  kind: "addConstraint";
  targetPath: string;
  rule: ExprNode;
  message?: string;
};

export type AddComputedOp = {
  kind: "addComputed";
  name: string;
  expr: ExprNode;
  deps?: string[];
};

export type AddActionAvailableOp = {
  kind: "addActionAvailable";
  actionName: string;
  expr: ExprNode;
};

export type PatchOp =
  | AddTypeOp
  | AddFieldOp
  | SetFieldTypeOp
  | SetDefaultValueOp
  | AddConstraintOp
  | AddComputedOp
  | AddActionAvailableOp;

// ============ Renderer Options ============

export interface RenderOptions {
  /**
   * Indentation string (default: "  ")
   */
  indent?: string;

  /**
   * Include comments with metadata
   */
  includeComments?: boolean;

  /**
   * Comment prefix for metadata
   */
  commentPrefix?: string;
}

const DEFAULT_OPTIONS: Required<RenderOptions> = {
  indent: "  ",
  includeComments: false,
  commentPrefix: "// ",
};

// ============ PatchOp Renderers ============

/**
 * Renders a PatchOp to MEL syntax string.
 *
 * @param op - The PatchOp to render
 * @param options - Rendering options
 * @returns MEL syntax string
 */
export function renderPatchOp(op: PatchOp, options?: RenderOptions): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  switch (op.kind) {
    case "addType":
      return renderAddType(op, opts);
    case "addField":
      return renderAddField(op, opts);
    case "setFieldType":
      return renderSetFieldType(op, opts);
    case "setDefaultValue":
      return renderSetDefaultValue(op, opts);
    case "addConstraint":
      return renderAddConstraint(op, opts);
    case "addComputed":
      return renderAddComputed(op, opts);
    case "addActionAvailable":
      return renderAddActionAvailable(op, opts);
    default:
      return `// Unknown operation: ${JSON.stringify(op)}`;
  }
}

/**
 * Renders an addType operation.
 *
 * @example
 * // Input: { kind: "addType", typeName: "Todo", typeExpr: { kind: "object", fields: [...] } }
 * // Output:
 * // type Todo {
 * //   id: string
 * //   title: string
 * //   completed: boolean
 * // }
 */
function renderAddType(op: AddTypeOp, opts: Required<RenderOptions>): string {
  const { indent } = opts;

  if (op.typeExpr.kind === "object") {
    const fields = op.typeExpr.fields
      .map((field) => `${indent}${renderTypeField(field)}`)
      .join("\n");

    return `type ${op.typeName} {\n${fields}\n}`;
  }

  // For non-object types (aliases)
  return `type ${op.typeName} = ${renderTypeExpr(op.typeExpr)}`;
}

/**
 * Renders an addField operation.
 *
 * @example
 * // Input: { kind: "addField", typeName: "Todo", field: { name: "priority", type: { kind: "primitive", name: "number" }, optional: true } }
 * // Output: priority?: number
 *
 * // With default value:
 * // Input: { field: { name: "status", type: {...}, optional: false }, defaultValue: "active" }
 * // Output: status: "idle" | "active" | "done" = "active"
 */
function renderAddField(op: AddFieldOp, _opts: Required<RenderOptions>): string {
  const field = op.field;

  if ("defaultValue" in field && field.defaultValue !== undefined) {
    return renderTypeField(field, field.defaultValue);
  }

  return renderTypeField(field);
}

/**
 * Renders a setFieldType operation.
 *
 * @example
 * // Input: { kind: "setFieldType", path: "Todo.status", typeExpr: { kind: "union", members: [...] } }
 * // Output: // Change Todo.status type to: "idle" | "active" | "done"
 * //         status: "idle" | "active" | "done"
 */
function renderSetFieldType(op: SetFieldTypeOp, opts: Required<RenderOptions>): string {
  const typeStr = renderTypeExpr(op.typeExpr);
  const fieldName = extractFieldName(op.path);

  const lines: string[] = [];
  if (opts.includeComments) {
    lines.push(`${opts.commentPrefix}Change ${op.path} type to: ${typeStr}`);
  }
  lines.push(`${fieldName}: ${typeStr}`);

  return lines.join("\n");
}

/**
 * Renders a setDefaultValue operation.
 *
 * @example
 * // Input: { kind: "setDefaultValue", path: "Todo.completed", value: false }
 * // Output: completed: boolean = false
 */
function renderSetDefaultValue(op: SetDefaultValueOp, opts: Required<RenderOptions>): string {
  const fieldName = extractFieldName(op.path);
  const valueStr = renderValue(op.value);

  const lines: string[] = [];
  if (opts.includeComments) {
    lines.push(`${opts.commentPrefix}Set default value for ${op.path}`);
  }
  lines.push(`${fieldName} = ${valueStr}`);

  return lines.join("\n");
}

/**
 * Renders an addConstraint operation.
 *
 * Note: MEL constraints are typically expressed as validation rules or invariants.
 * Since MEL v0.3.3 doesn't have explicit constraint syntax in the examples,
 * we render as a comment with the constraint expression.
 *
 * @example
 * // Input: { kind: "addConstraint", targetPath: "User.age", rule: { kind: "gte", ... }, message: "Must be adult" }
 * // Output: // Constraint on User.age: gte(age, 18) - "Must be adult"
 */
function renderAddConstraint(op: AddConstraintOp, opts: Required<RenderOptions>): string {
  const exprStr = renderExprNode(op.rule);
  const messageStr = op.message ? ` - "${op.message}"` : "";

  // Constraints are rendered as comments since MEL v0.3.3 doesn't have explicit constraint syntax
  // The actual validation would be done via when guards in actions
  return `${opts.commentPrefix}Constraint on ${op.targetPath}: ${exprStr}${messageStr}`;
}

/**
 * Renders an addComputed operation.
 *
 * @example
 * // Input: { kind: "addComputed", name: "totalPrice", expr: { kind: "mul", left: {...}, right: {...} } }
 * // Output: computed totalPrice = mul(price, quantity)
 */
function renderAddComputed(op: AddComputedOp, opts: Required<RenderOptions>): string {
  const exprStr = renderExprNode(op.expr);

  const lines: string[] = [];
  if (opts.includeComments && op.deps && op.deps.length > 0) {
    lines.push(`${opts.commentPrefix}Dependencies: ${op.deps.join(", ")}`);
  }
  lines.push(`computed ${op.name} = ${exprStr}`);

  return lines.join("\n");
}

/**
 * Renders an addActionAvailable operation.
 *
 * @example
 * // Input: { kind: "addActionAvailable", actionName: "submit", expr: { kind: "and", args: [...] } }
 * // Output: action submit() available when and(isValid, not(isSubmitting)) {
 * //           // action body...
 * //         }
 */
function renderAddActionAvailable(op: AddActionAvailableOp, opts: Required<RenderOptions>): string {
  const exprStr = renderExprNode(op.expr);

  const lines: string[] = [];
  if (opts.includeComments) {
    lines.push(`${opts.commentPrefix}Add availability condition to ${op.actionName}`);
  }
  lines.push(`action ${op.actionName}() available when ${exprStr} {`);
  lines.push(`${opts.indent}// action body...`);
  lines.push(`}`);

  return lines.join("\n");
}

// ============ Utility Functions ============

/**
 * Extracts the field name from a semantic path.
 *
 * @example
 * // "Todo.title" -> "title"
 * // "User.address.city" -> "city"
 * // "count" -> "count"
 */
function extractFieldName(path: string): string {
  const parts = path.split(".");
  return parts[parts.length - 1];
}

/**
 * Gets the type name from a semantic path.
 *
 * @example
 * // "Todo.title" -> "Todo"
 * // "User.address.city" -> "User"
 * // "count" -> undefined
 */
export function extractTypeName(path: string): string | undefined {
  const parts = path.split(".");
  if (parts.length >= 2) {
    return parts[0];
  }
  return undefined;
}
