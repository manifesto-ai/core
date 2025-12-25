/**
 * Expression Editor Types
 *
 * Types for the visual expression tree editor.
 */

// Re-export Expression type from core
export type { Expression } from "@manifesto-ai/core";

/**
 * Literal values that can appear in expressions
 */
export type LiteralValue = string | number | boolean | null;

/**
 * Operator categories for grouping in UI
 */
export type OperatorCategory =
  | "access"
  | "comparison"
  | "logic"
  | "arithmetic"
  | "string"
  | "array"
  | "object"
  | "conditional"
  | "type"
  | "number"
  | "date"
  | "utility";

/**
 * Arity specification for operators
 */
export type Arity = number | "variadic" | "special";

/**
 * Metadata for an operator
 */
export type OperatorMeta = {
  /** Display name */
  name: string;
  /** Category for grouping */
  category: OperatorCategory;
  /** Number of arguments: fixed number, 'variadic' for n args, 'special' for complex patterns */
  arity: Arity;
  /** Minimum args for variadic operators */
  minArgs?: number;
  /** Argument labels for UI */
  argLabels?: string[];
  /** Description for tooltip */
  description: string;
  /** Example expression */
  example: unknown;
};

/**
 * Node path in expression tree (indices from root)
 * e.g., [1, 2] means root[1][2]
 */
export type NodePath = number[];

/**
 * Props for ExpressionNode component
 */
export type ExpressionNodeProps = {
  /** The expression to render */
  expr: unknown;
  /** Path from root to this node */
  nodePath: NodePath;
  /** Callback when expression changes */
  onChange: (newExpr: unknown) => void;
  /** Callback to delete this node */
  onDelete?: () => void;
  /** Available paths for get expressions */
  availablePaths: string[];
  /** Nesting depth for styling */
  depth: number;
};

/**
 * Props for ExpressionEditor component
 */
export type ExpressionEditorProps = {
  /** Current expression value */
  value: unknown;
  /** Callback when expression changes */
  onChange: (expr: unknown) => void;
  /** Available semantic paths */
  availablePaths: string[];
  /** External error message */
  error?: string | null;
  /** Placeholder when empty */
  placeholder?: string;
};

/**
 * Props for LiteralInput component
 */
export type LiteralInputProps = {
  /** Current value */
  value: LiteralValue;
  /** Callback when value changes */
  onChange: (value: LiteralValue) => void;
  /** Optional class name */
  className?: string;
};

/**
 * Props for PathSelector component
 */
export type PathSelectorProps = {
  /** Current path value */
  value: string;
  /** Callback when path changes */
  onChange: (path: string) => void;
  /** Available paths to select from */
  availablePaths: string[];
  /** Placeholder text */
  placeholder?: string;
  /** Optional class name */
  className?: string;
  /** Whether current value is a context variable */
  isContextVar?: boolean;
};

/**
 * Props for NodeTypeSelector component
 */
export type NodeTypeSelectorProps = {
  /** Callback when type is selected */
  onSelect: (expr: unknown) => void;
  /** Available paths for get expressions */
  availablePaths: string[];
  /** Trigger element */
  children: React.ReactNode;
};

/**
 * Helper to check if value is a literal
 */
export function isLiteral(value: unknown): value is LiteralValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Helper to check if value is a get expression
 */
export function isGetExpr(value: unknown): value is ["get", string] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value[0] === "get" &&
    typeof value[1] === "string"
  );
}

/**
 * Helper to check if value is an operator expression
 */
export function isOperatorExpr(value: unknown): value is [string, ...unknown[]] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    typeof value[0] === "string"
  );
}

/**
 * Get operator from expression
 */
export function getOperator(expr: unknown): string | null {
  if (isOperatorExpr(expr)) {
    return expr[0];
  }
  return null;
}

/**
 * Get arguments from operator expression
 */
export function getArgs(expr: unknown): unknown[] {
  if (isOperatorExpr(expr)) {
    return expr.slice(1);
  }
  return [];
}
