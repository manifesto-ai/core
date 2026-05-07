/**
 * Lowering Context Types
 *
 * Defines contexts for expression and patch lowering.
 *
 * @see SPEC v0.4.0 §17.2
 */

/**
 * Allowed dollar path prefixes.
 *
 * Current v5 lowering admits direct input and bound action context/runtime
 * reads. Retired 'meta'/'system' prefixes are rejected before lowering.
 *
 * @see ADR-027
 */
export type AllowedSysPrefix = "input" | "runtime" | "context";

/**
 * Context for single expression lowering.
 *
 * @see SPEC v0.4.0 §17.2
 */
export interface ExprLoweringContext {
  /**
   * Expression context mode.
   * - 'schema': for addComputed, addConstraint, etc.
   * - 'action': for guards, patches, effects
   */
  mode: "schema" | "action";

  /**
   * Allowed dollar path prefixes.
   *
   * @see FDR-MEL-071
   */
  allowSysPaths?: { prefixes: AllowedSysPrefix[] };

  /**
   * Function table version for call lowering.
   */
  fnTableVersion: string;

  /**
   * Action name (for action context).
   */
  actionName?: string;

  /**
   * Whether $item is allowed in this context.
   * Only true for effect.args fields.
   *
   * @see FDR-MEL-068
   */
  allowItem?: boolean;
}

/**
 * Context for patch lowering.
 *
 * NO mode field - Compiler determines context per op-field.
 *
 * @see SPEC v0.4.0 §17.2, AD-COMP-LOW-002
 */
export interface PatchLoweringContext {
  /**
   * Allowed dollar path prefixes.
   *
   * @see FDR-MEL-071
   */
  allowSysPaths?: { prefixes: AllowedSysPrefix[] };

  /**
   * Function table version for call lowering.
   */
  fnTableVersion: string;

  /**
   * Action name (for action-related ops).
   */
  actionName?: string;
}

/**
 * Default expression lowering context for schema mode.
 */
export const DEFAULT_SCHEMA_CONTEXT: ExprLoweringContext = {
  mode: "schema",
  allowSysPaths: { prefixes: [] },
  fnTableVersion: "1.0",
  allowItem: false,
};

/**
 * Default expression lowering context for action mode.
 */
export const DEFAULT_ACTION_CONTEXT: ExprLoweringContext = {
  mode: "action",
  allowSysPaths: { prefixes: ["input", "runtime", "context"] },
  fnTableVersion: "1.0",
  allowItem: false,
};

/**
 * Context for dispatchable expressions (bound-input only).
 */
export const DEFAULT_DISPATCHABLE_CONTEXT: ExprLoweringContext = {
  mode: "action",
  allowSysPaths: { prefixes: [] },
  fnTableVersion: "1.0",
  allowItem: false,
};

/**
 * Context for effect.args (allows $item).
 */
export const EFFECT_ARGS_CONTEXT: ExprLoweringContext = {
  mode: "action",
  allowSysPaths: { prefixes: ["input", "runtime", "context"] },
  fnTableVersion: "1.0",
  allowItem: true,
};

/**
 * Default patch lowering context.
 */
export const DEFAULT_PATCH_CONTEXT: PatchLoweringContext = {
  allowSysPaths: { prefixes: ["input", "runtime", "context"] },
  fnTableVersion: "1.0",
};
