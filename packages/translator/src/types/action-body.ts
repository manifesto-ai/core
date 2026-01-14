/**
 * @fileoverview Action Body AST Types
 *
 * Structural types for action definitions included in IntentBody.input.
 * Aligned with SPEC §12 Action Body Structure.
 *
 * NOTE: These types are intentionally separate from Core's ExprNode/FlowNode.
 * - ActionExprNode: Action declaration language (5 kinds: lit, get, call, sys, var)
 * - Core ExprNode: Pure computation language (40+ operators)
 *
 * The separation allows:
 * 1. Independent evolution of both type systems
 * 2. sys/var expressions only valid in action context
 * 3. ActionBody → FlowNode conversion by separate adapter
 *
 * See FDR-TAPP-030 for design rationale.
 */

// =============================================================================
// Path Types (Action Body specific)
// =============================================================================

/**
 * Path segment - property access or index access
 *
 * NOTE: Different from Core's SemanticPath (string-based).
 * PathNode is structural, SemanticPath is serialized.
 * See FDR-TAPP-031.
 */
export type ActionPathSegment =
  | { readonly kind: "prop"; readonly name: string }
  | { readonly kind: "index"; readonly expr: ActionExprNode };

/**
 * Path node - array of segments
 *
 * Example: [{ kind: 'prop', name: 'data' }, { kind: 'prop', name: 'todos' }]
 * Equivalent to Core SemanticPath: "data.todos"
 */
export type ActionPathNode = readonly ActionPathSegment[];

// =============================================================================
// Expression Nodes (Action Body specific)
// =============================================================================

/**
 * Action expression node types
 * SPEC §12.2
 *
 * NOTE: This is NOT Core's ExprNode. Key differences:
 * - Only 5 kinds (vs 40+ in Core)
 * - 'sys' allowed (forbidden in Core - Core is pure)
 * - 'var' for iteration context ($item, $acc)
 * - No arithmetic/logic/collection operators (handled by Core)
 */
export type ActionExprNode =
  | { readonly kind: "lit"; readonly value: unknown }
  | { readonly kind: "get"; readonly path: ActionPathNode }
  | { readonly kind: "call"; readonly fn: string; readonly args: readonly ActionExprNode[] }
  | { readonly kind: "sys"; readonly path: readonly string[] }
  | { readonly kind: "var"; readonly name: string };

// =============================================================================
// Statement Nodes (Action Body specific)
// =============================================================================

/**
 * Patch statement - state mutation declaration
 *
 * NOTE: Different from Core's PatchFlow:
 * - path: ActionPathNode (structural) vs SemanticPath (string)
 * - value: ActionExprNode vs Core ExprNode
 */
export type ActionPatchStmt = {
  readonly kind: "patch";
  readonly path: ActionPathNode;
  readonly value: ActionExprNode;
};

/**
 * Effect statement - side effect declaration
 *
 * NOTE: Different from Core's EffectFlow:
 * - effectType vs type
 * - args vs params
 * - into for result binding (action-specific)
 */
export type ActionEffectStmt = {
  readonly kind: "effect";
  readonly effectType: string;
  readonly args: Record<string, ActionExprNode>;
  readonly into?: string;
};

/**
 * Nested guarded block (for once+when composition)
 */
export type ActionNestedBlock = {
  readonly kind: "nested";
  readonly block: ActionGuardedBlock;
};

/**
 * Action statement - patch, effect, or nested block
 */
export type ActionStmt = ActionPatchStmt | ActionEffectStmt | ActionNestedBlock;

// =============================================================================
// Guard and Block
// =============================================================================

/**
 * Guard types
 * SPEC §12.1
 *
 * NOTE: Core only has 'if' flow. Action guards are:
 * - when: conditional execution (like if)
 * - once: idempotency marker (action-specific)
 */
export type ActionGuard =
  | { readonly kind: "when"; readonly condition: ActionExprNode }
  | { readonly kind: "once"; readonly marker: string };

/**
 * Guarded block - guard + body statements
 */
export type ActionGuardedBlock = {
  readonly guard: ActionGuard;
  readonly body: readonly ActionStmt[];
};

/**
 * Action body - top-level structure
 * SPEC §12.1 TAPP-AST-1
 */
export type ActionBody = {
  readonly blocks: readonly ActionGuardedBlock[];
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
      readonly actualValue: ActionExprNode;
    }
  | {
      readonly kind: "sys_in_forbidden_context";
      readonly path: string;
      readonly sysPath: readonly string[];
    };

// =============================================================================
// Type Guards
// =============================================================================

export function isPatchStmt(stmt: ActionStmt): stmt is ActionPatchStmt {
  return stmt.kind === "patch";
}

export function isEffectStmt(stmt: ActionStmt): stmt is ActionEffectStmt {
  return stmt.kind === "effect";
}

export function isNestedBlock(stmt: ActionStmt): stmt is ActionNestedBlock {
  return stmt.kind === "nested";
}

export function isWhenGuard(
  guard: ActionGuard
): guard is { kind: "when"; condition: ActionExprNode } {
  return guard.kind === "when";
}

export function isOnceGuard(
  guard: ActionGuard
): guard is { kind: "once"; marker: string } {
  return guard.kind === "once";
}

export function isSysExpr(
  expr: ActionExprNode
): expr is { kind: "sys"; path: readonly string[] } {
  return expr.kind === "sys";
}

/**
 * Check if expression is the required marker value: { kind: 'sys', path: ['meta', 'intentId'] }
 * SPEC §12.3 TAPP-AST-3a
 */
export function isValidMarkerValue(expr: ActionExprNode): boolean {
  return (
    expr.kind === "sys" &&
    expr.path.length === 2 &&
    expr.path[0] === "meta" &&
    expr.path[1] === "intentId"
  );
}

// =============================================================================
// Legacy Aliases (for backward compatibility)
// =============================================================================

/** @deprecated Use ActionExprNode */
export type ExprNode = ActionExprNode;

/** @deprecated Use ActionPathNode */
export type PathNode = ActionPathNode;

/** @deprecated Use ActionPathSegment */
export type PathSegment = ActionPathSegment;

/** @deprecated Use ActionPatchStmt */
export type PatchStmt = ActionPatchStmt;

/** @deprecated Use ActionEffectStmt */
export type EffectStmt = ActionEffectStmt;

/** @deprecated Use ActionNestedBlock */
export type NestedGuardedBlock = ActionNestedBlock;

/** @deprecated Use ActionGuardedBlock */
export type GuardedBlock = ActionGuardedBlock;
