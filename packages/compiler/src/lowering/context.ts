/**
 * Lowering Context Types
 *
 * Defines contexts for expression and patch lowering.
 *
 * @see SPEC v0.4.0 §17.2
 */

/**
 * Allowed system path prefixes.
 *
 * In Translator path, only 'meta' and 'input' are allowed.
 * 'system' is forbidden (requires Flow execution).
 *
 * @see FDR-MEL-071
 */
export type AllowedSysPrefix = "meta" | "input";

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
   * Allowed system path prefixes.
   * In Translator path: only ["meta", "input"]
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
   * Allowed system path prefixes.
   * In Translator path: only ["meta", "input"]
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
  allowSysPaths: { prefixes: ["meta", "input"] },
  fnTableVersion: "1.0",
  allowItem: false,
};

/**
 * Default expression lowering context for action mode.
 */
export const DEFAULT_ACTION_CONTEXT: ExprLoweringContext = {
  mode: "action",
  allowSysPaths: { prefixes: ["meta", "input"] },
  fnTableVersion: "1.0",
  allowItem: false,
};

/**
 * Context for effect.args (allows $item).
 */
export const EFFECT_ARGS_CONTEXT: ExprLoweringContext = {
  mode: "action",
  allowSysPaths: { prefixes: ["meta", "input"] },
  fnTableVersion: "1.0",
  allowItem: true,
};

/**
 * Default patch lowering context.
 */
export const DEFAULT_PATCH_CONTEXT: PatchLoweringContext = {
  allowSysPaths: { prefixes: ["meta", "input"] },
  fnTableVersion: "1.0",
};
