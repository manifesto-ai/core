/**
 * @fileoverview S7: Validate Action Body Stage
 *
 * Validates Action Body structural constraints.
 * Deterministic stage, executes only for Action-related types.
 * Aligned with SPEC §5.1 S7 and §12.
 */

import {
  type ActionBody,
  type ActionBodyViolation,
  type GuardedBlock,
  type ActionStmt,
  type ExprNode,
  isOnceGuard,
  isPatchStmt,
  isNestedBlock,
  isValidMarkerValue,
  isSysExpr,
} from "../types/index.js";
import { createError, type TranslatorError } from "../types/errors.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Validate action body stage result
 */
export type ValidateActionBodyResult =
  | { readonly ok: true; readonly violations: readonly [] }
  | { readonly ok: false; readonly violations: readonly ActionBodyViolation[]; readonly error: TranslatorError };

/**
 * Validate action body trace output
 */
export type ValidateActionBodyTrace = {
  readonly performed: boolean;
  readonly violations: readonly ActionBodyViolation[];
  readonly result: "pass" | "fail";
};

// =============================================================================
// Action Type Detection
// =============================================================================

/**
 * Action-related lemmas that require body validation
 */
const ACTION_LEMMAS = new Set([
  "ADD_ACTION",
  "ADD_ACTION_GUARD",
  "ADD_ACTION_EFFECT",
]);

/**
 * Check if a lemma is action-related and requires body validation
 */
export function isActionRelatedLemma(lemma: string): boolean {
  return ACTION_LEMMAS.has(lemma.toUpperCase());
}

// =============================================================================
// Validation Rules
// =============================================================================

/**
 * Validate a single guarded block
 * TAPP-AST-2, TAPP-AST-3, TAPP-AST-3a
 */
function validateBlock(
  block: GuardedBlock,
  blockIndex: number,
  path: string
): ActionBodyViolation[] {
  const violations: ActionBodyViolation[] = [];

  // TAPP-AST-3: once guard requires marker patch as first statement
  if (isOnceGuard(block.guard)) {
    if (block.body.length === 0) {
      violations.push({
        kind: "missing_marker_patch",
        blockIndex,
      });
    } else {
      const firstStmt = block.body[0];

      // Check first statement is a patch
      if (!isPatchStmt(firstStmt)) {
        violations.push({
          kind: "missing_marker_patch",
          blockIndex,
        });
      } else {
        // TAPP-AST-3a: marker patch value must be { kind: 'sys', path: ['meta', 'intentId'] }
        if (!isValidMarkerValue(firstStmt.value)) {
          violations.push({
            kind: "invalid_marker_value",
            blockIndex,
            actualValue: firstStmt.value,
          });
        }
      }
    }
  }

  // Validate nested blocks
  for (let i = 0; i < block.body.length; i++) {
    const stmt = block.body[i];
    if (isNestedBlock(stmt)) {
      violations.push(
        ...validateBlock(stmt.block, blockIndex, `${path}.body[${i}].block`)
      );
    }

    // TAPP-AST-4: Check $system usage restrictions
    violations.push(...validateSysUsage(stmt, `${path}.body[${i}]`, blockIndex));
  }

  // TAPP-AST-4: Check guard condition sys usage
  if (block.guard.kind === "when") {
    violations.push(
      ...validateGuardConditionSys(block.guard.condition, `${path}.guard.condition`)
    );
  }

  return violations;
}

/**
 * Validate $system usage in a statement
 * TAPP-AST-4
 */
function validateSysUsage(
  stmt: ActionStmt,
  path: string,
  blockIndex: number
): ActionBodyViolation[] {
  const violations: ActionBodyViolation[] = [];

  // $system is allowed in patch value and effect args (body context)
  // No additional validation needed for patch/effect in body

  return violations;
}

/**
 * Validate $system usage in guard condition
 * TAPP-AST-4: $system.* is NOT allowed in guard condition, only $meta.* and $input.*
 */
function validateGuardConditionSys(
  expr: ExprNode,
  path: string
): ActionBodyViolation[] {
  const violations: ActionBodyViolation[] = [];

  if (isSysExpr(expr)) {
    // Check if path starts with 'system' (forbidden in guard condition)
    if (expr.path.length > 0 && expr.path[0] === "system") {
      violations.push({
        kind: "sys_in_forbidden_context",
        path,
        sysPath: expr.path,
      });
    }
  }

  // Recursively check nested expressions
  if (expr.kind === "call") {
    for (let i = 0; i < expr.args.length; i++) {
      violations.push(
        ...validateGuardConditionSys(expr.args[i], `${path}.args[${i}]`)
      );
    }
  }

  return violations;
}

// =============================================================================
// Stage Implementation
// =============================================================================

/**
 * S7: Validate Action Body structural constraints
 *
 * TAPP-PIPE-1: This stage is deterministic.
 * TAPP-PIPE-4: Executes only when IntentBody.type is Action-related.
 *
 * @param actionBody - ActionBody from IntentBody.input
 * @returns ValidateActionBodyResult
 */
export function validateActionBody(
  actionBody: ActionBody
): ValidateActionBodyResult {
  const violations: ActionBodyViolation[] = [];

  // Validate each top-level block
  for (let i = 0; i < actionBody.blocks.length; i++) {
    const block = actionBody.blocks[i];
    violations.push(...validateBlock(block, i, `blocks[${i}]`));
  }

  if (violations.length > 0) {
    return {
      ok: false,
      violations,
      error: createError(
        "ACTION_BODY_INVALID",
        `Action body has ${violations.length} structural violation(s)`,
        { stage: "validate_action_body", detail: violations, recoverable: false }
      ),
    };
  }

  return {
    ok: true,
    violations: [],
  };
}

/**
 * Extract ActionBody from IntentBody input (if present)
 */
export function extractActionBody(input: unknown): ActionBody | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const obj = input as Record<string, unknown>;

  // Check for body or blocks property
  if ("body" in obj && typeof obj.body === "object") {
    return obj.body as ActionBody;
  }

  if ("blocks" in obj && Array.isArray(obj.blocks)) {
    return input as ActionBody;
  }

  return undefined;
}

/**
 * Create validate action body trace
 */
export function createValidateActionBodyTrace(
  performed: boolean,
  result?: ValidateActionBodyResult
): ValidateActionBodyTrace {
  if (!performed || !result) {
    return {
      performed: false,
      violations: [],
      result: "pass",
    };
  }

  return {
    performed: true,
    violations: result.violations,
    result: result.ok ? "pass" : "fail",
  };
}
