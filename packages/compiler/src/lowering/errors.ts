/**
 * Lowering Error Types
 *
 * Defines error types for MEL IR → Core IR lowering.
 *
 * @see SPEC v0.4.0 §17.6
 */

/**
 * Lowering error codes.
 *
 * @see SPEC v0.4.0 §17.6
 */
export type LoweringErrorCode =
  /** var in non-effect context, sys in schema */
  | "INVALID_KIND_FOR_CONTEXT"
  /** Unknown function name in call node */
  | "UNKNOWN_CALL_FN"
  /** sys.system in Translator path */
  | "INVALID_SYS_PATH"
  /** get.base is not var(item) */
  | "UNSUPPORTED_BASE"
  /** Malformed node structure */
  | "INVALID_SHAPE"
  /** Unknown node kind */
  | "UNKNOWN_NODE_KIND";

/**
 * Lowering error class.
 *
 * Thrown when MEL IR cannot be lowered to Core IR.
 *
 * @see SPEC v0.4.0 §17.6
 */
export class LoweringError extends Error {
  readonly code: LoweringErrorCode;
  readonly path?: string[];
  readonly details?: Record<string, unknown>;

  constructor(
    code: LoweringErrorCode,
    message: string,
    options?: {
      path?: string[];
      details?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = "LoweringError";
    this.code = code;
    this.path = options?.path;
    this.details = options?.details;
  }
}

/**
 * Create a lowering error for invalid kind in context.
 *
 * @example
 * throw invalidKindForContext("var", "schema");
 */
export function invalidKindForContext(
  kind: string,
  context: string,
  path?: string[]
): LoweringError {
  return new LoweringError(
    "INVALID_KIND_FOR_CONTEXT",
    `Node kind '${kind}' is not allowed in ${context} context`,
    { path, details: { kind, context } }
  );
}

/**
 * Create a lowering error for unknown call function.
 *
 * @example
 * throw unknownCallFn("unknownFunc");
 */
export function unknownCallFn(fn: string, path?: string[]): LoweringError {
  return new LoweringError(
    "UNKNOWN_CALL_FN",
    `Unknown function '${fn}' in call expression`,
    { path, details: { fn } }
  );
}

/**
 * Create a lowering error for invalid sys path.
 *
 * @example
 * throw invalidSysPath(["system", "uuid"]);
 */
export function invalidSysPath(
  sysPath: string[],
  path?: string[]
): LoweringError {
  return new LoweringError(
    "INVALID_SYS_PATH",
    `System path '${sysPath.join(".")}' is not allowed in Translator path`,
    { path, details: { sysPath } }
  );
}

/**
 * Create a lowering error for unsupported base expression.
 *
 * @example
 * throw unsupportedBase("call");
 */
export function unsupportedBase(
  baseKind: string,
  path?: string[]
): LoweringError {
  return new LoweringError(
    "UNSUPPORTED_BASE",
    `Unsupported base expression kind '${baseKind}'. Only var(item) is supported.`,
    { path, details: { baseKind } }
  );
}

/**
 * Create a lowering error for invalid shape.
 *
 * @example
 * throw invalidShape("missing 'value' field");
 */
export function invalidShape(
  description: string,
  path?: string[]
): LoweringError {
  return new LoweringError(
    "INVALID_SHAPE",
    `Invalid node shape: ${description}`,
    { path, details: { description } }
  );
}

/**
 * Create a lowering error for unknown node kind.
 *
 * @example
 * throw unknownNodeKind("foo");
 */
export function unknownNodeKind(
  kind: string,
  path?: string[]
): LoweringError {
  return new LoweringError(
    "UNKNOWN_NODE_KIND",
    `Unknown expression node kind '${kind}'`,
    { path, details: { kind } }
  );
}
