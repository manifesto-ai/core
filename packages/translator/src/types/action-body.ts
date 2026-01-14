/**
 * @fileoverview Action Body AST Types
 *
 * Structural types for action definitions included in IntentBody.input.
 * Aligned with SPEC §12 Action Body Structure.
 */

// =============================================================================
// Expression Nodes
// =============================================================================

/**
 * Path segment - property access or index access
 */
export type PathSegment =
  | { readonly kind: "prop"; readonly name: string }
  | { readonly kind: "index"; readonly expr: ExprNode };

/**
 * Path node - array of segments
 */
export type PathNode = readonly PathSegment[];

/**
 * Expression node types
 * SPEC §12.2
 */
export type ExprNode =
  | { readonly kind: "lit"; readonly value: unknown }
  | { readonly kind: "get"; readonly path: PathNode }
  | { readonly kind: "call"; readonly fn: string; readonly args: readonly ExprNode[] }
  | { readonly kind: "sys"; readonly path: readonly string[] }
  | { readonly kind: "var"; readonly name: string };

// =============================================================================
// Statement Nodes
// =============================================================================

/**
 * Patch statement - state mutation
 */
export type PatchStmt = {
  readonly kind: "patch";
  readonly path: PathNode;
  readonly value: ExprNode;
};

/**
 * Effect statement - side effect declaration
 */
export type EffectStmt = {
  readonly kind: "effect";
  readonly effectType: string;
  readonly args: Record<string, ExprNode>;
  readonly into?: string;
};

/**
 * Nested guarded block (for once+when composition)
 */
export type NestedGuardedBlock = {
  readonly kind: "nested";
  readonly block: GuardedBlock;
};

/**
 * Action statement - patch, effect, or nested block
 */
export type ActionStmt = PatchStmt | EffectStmt | NestedGuardedBlock;

// =============================================================================
// Guard and Block
// =============================================================================

/**
 * Guard types
 * SPEC §12.1
 */
export type ActionGuard =
  | { readonly kind: "when"; readonly condition: ExprNode }
  | { readonly kind: "once"; readonly marker: string };

/**
 * Guarded block - guard + body statements
 */
export type GuardedBlock = {
  readonly guard: ActionGuard;
  readonly body: readonly ActionStmt[];
};

/**
 * Action body - top-level structure
 * SPEC §12.1 TAPP-AST-1
 */
export type ActionBody = {
  readonly blocks: readonly GuardedBlock[];
};

// =============================================================================
// Validation Error Types
// =============================================================================

/**
 * Action body validation violation types
 * SPEC §12.7
 */
export type ActionBodyViolation =
  | { readonly kind: "top_level_stmt"; readonly path: string }
  | { readonly kind: "missing_marker_patch"; readonly blockIndex: number }
  | {
      readonly kind: "marker_patch_not_first";
      readonly blockIndex: number;
      readonly actualIndex: number;
    }
  | {
      readonly kind: "invalid_marker_value";
      readonly blockIndex: number;
      readonly actualValue: ExprNode;
    }
  | {
      readonly kind: "sys_in_forbidden_context";
      readonly path: string;
      readonly sysPath: readonly string[];
    };

// =============================================================================
// Type Guards
// =============================================================================

export function isPatchStmt(stmt: ActionStmt): stmt is PatchStmt {
  return stmt.kind === "patch";
}

export function isEffectStmt(stmt: ActionStmt): stmt is EffectStmt {
  return stmt.kind === "effect";
}

export function isNestedBlock(stmt: ActionStmt): stmt is NestedGuardedBlock {
  return stmt.kind === "nested";
}

export function isWhenGuard(
  guard: ActionGuard
): guard is { kind: "when"; condition: ExprNode } {
  return guard.kind === "when";
}

export function isOnceGuard(
  guard: ActionGuard
): guard is { kind: "once"; marker: string } {
  return guard.kind === "once";
}

export function isSysExpr(
  expr: ExprNode
): expr is { kind: "sys"; path: readonly string[] } {
  return expr.kind === "sys";
}

/**
 * Check if expression is the required marker value: { kind: 'sys', path: ['meta', 'intentId'] }
 * SPEC §12.3 TAPP-AST-3a
 */
export function isValidMarkerValue(expr: ExprNode): boolean {
  return (
    expr.kind === "sys" &&
    expr.path.length === 2 &&
    expr.path[0] === "meta" &&
    expr.path[1] === "intentId"
  );
}
