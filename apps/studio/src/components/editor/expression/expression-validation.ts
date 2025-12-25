/**
 * Expression Validation
 *
 * Pure validation functions for Expression DSL.
 * Validates structure, operator arity, and path references.
 */

import { OPERATORS } from "./operators";
import { isLiteral, isOperatorExpr, getOperator, getArgs } from "./types";
import type { OperatorMeta } from "./types";

/**
 * Context for expression validation
 */
export interface ValidationContext {
  /** Available semantic paths for get expressions */
  availablePaths: string[];
}

/**
 * Individual validation issue
 */
export interface ExpressionIssue {
  /** Issue code for programmatic handling */
  code: string;
  /** Human-readable message */
  message: string;
  /** Path to the issue location in expression tree (indices) */
  path: number[];
  /** Severity level */
  severity: "error" | "warning";
}

/**
 * Validation result
 */
export interface ExpressionValidationResult {
  /** Whether the expression is valid (no errors) */
  valid: boolean;
  /** List of issues found */
  issues: ExpressionIssue[];
}

/**
 * Context variables that are always valid
 */
const CONTEXT_VARIABLES = ["$", "$index", "$acc"];

/**
 * Check if a path is a context variable
 */
function isContextVariable(path: string): boolean {
  // Exact matches
  if (CONTEXT_VARIABLES.includes(path)) return true;
  // Nested paths like $.field
  if (path.startsWith("$.")) return true;
  return false;
}

/**
 * Validate a get expression's path
 */
function validatePath(
  path: string,
  availablePaths: string[],
  exprPath: number[]
): ExpressionIssue | null {
  // Context variables are always valid
  if (isContextVariable(path)) {
    return null;
  }

  // Check if path exists in available paths
  if (!availablePaths.includes(path)) {
    return {
      code: "UNDEFINED_PATH",
      message: `Path '${path}' is not defined`,
      path: exprPath,
      severity: "error",
    };
  }

  return null;
}

/**
 * Validate operator arity
 */
function validateArity(
  op: string,
  meta: OperatorMeta,
  argCount: number,
  exprPath: number[]
): ExpressionIssue | null {
  const { arity, minArgs } = meta;

  if (typeof arity === "number") {
    // Fixed arity
    if (argCount !== arity) {
      return {
        code: "ARITY_MISMATCH",
        message: `Operator '${op}' expects ${arity} argument(s), got ${argCount}`,
        path: exprPath,
        severity: "error",
      };
    }
  } else if (arity === "variadic") {
    // Variadic: at least minArgs
    const min = minArgs ?? 1;
    if (argCount < min) {
      return {
        code: "ARITY_MISMATCH",
        message: `Operator '${op}' requires at least ${min} argument(s), got ${argCount}`,
        path: exprPath,
        severity: "error",
      };
    }
  } else if (arity === "special") {
    // Special operators have custom validation
    if (op === "case") {
      // case requires exactly 3 args: condition, then, else
      if (argCount !== 3) {
        return {
          code: "ARITY_MISMATCH",
          message: `Operator 'case' expects 3 arguments (condition, then, else), got ${argCount}`,
          path: exprPath,
          severity: "error",
        };
      }
    }
    // match: target, then pairs (pattern, result), then default
    // Minimum: target + pattern + result + default = 4
    // Even number of middle args (pairs) + 2 (target + default) = at least 4
    if (op === "match") {
      if (argCount < 4) {
        return {
          code: "ARITY_MISMATCH",
          message: `Operator 'match' requires at least 4 arguments, got ${argCount}`,
          path: exprPath,
          severity: "error",
        };
      }
    }
  }

  return null;
}

/**
 * Recursively validate an expression
 */
function validateExpressionRecursive(
  expr: unknown,
  context: ValidationContext,
  path: number[]
): ExpressionIssue[] {
  const issues: ExpressionIssue[] = [];

  // Handle undefined
  if (expr === undefined) {
    issues.push({
      code: "INVALID_EXPRESSION",
      message: "Expression is undefined",
      path,
      severity: "error",
    });
    return issues;
  }

  // Handle null and literals - they're always valid
  if (isLiteral(expr)) {
    return issues;
  }

  // Handle non-array objects
  if (typeof expr === "object" && !Array.isArray(expr)) {
    issues.push({
      code: "INVALID_EXPRESSION",
      message: "Expression must be a literal or an array",
      path,
      severity: "error",
    });
    return issues;
  }

  // Must be an array at this point
  if (!Array.isArray(expr)) {
    issues.push({
      code: "INVALID_EXPRESSION",
      message: "Expression must be a literal or an array",
      path,
      severity: "error",
    });
    return issues;
  }

  // Empty array is invalid
  if (expr.length === 0) {
    issues.push({
      code: "INVALID_EXPRESSION",
      message: "Empty expression array",
      path,
      severity: "error",
    });
    return issues;
  }

  // First element must be a string (operator)
  if (typeof expr[0] !== "string") {
    issues.push({
      code: "INVALID_EXPRESSION",
      message: "First element of expression must be an operator string",
      path,
      severity: "error",
    });
    return issues;
  }

  const op = expr[0];
  const args = expr.slice(1);

  // Check if operator exists
  const meta = OPERATORS[op];
  if (!meta) {
    issues.push({
      code: "UNKNOWN_OPERATOR",
      message: `Unknown operator '${op}'`,
      path,
      severity: "error",
    });
    // Continue to validate args even if operator is unknown
  }

  // Validate arity if operator is known
  if (meta) {
    const arityIssue = validateArity(op, meta, args.length, path);
    if (arityIssue) {
      issues.push(arityIssue);
    }
  }

  // Special handling for 'get' operator - validate path
  if (op === "get" && args.length >= 1 && typeof args[0] === "string") {
    const pathIssue = validatePath(args[0], context.availablePaths, path);
    if (pathIssue) {
      issues.push(pathIssue);
    }
    return issues; // get doesn't have nested expressions
  }

  // Recursively validate arguments
  for (let i = 0; i < args.length; i++) {
    const argIssues = validateExpressionRecursive(
      args[i],
      context,
      [...path, i + 1] // +1 because index 0 is the operator
    );
    issues.push(...argIssues);
  }

  return issues;
}

/**
 * Validate an expression
 *
 * @param expr - The expression to validate
 * @param context - Validation context with available paths
 * @returns Validation result with issues
 */
export function validateExpression(
  expr: unknown,
  context: ValidationContext
): ExpressionValidationResult {
  const issues = validateExpressionRecursive(expr, context, []);

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}
