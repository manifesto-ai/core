/**
 * V8 specific ErrorConstructor extension
 */
interface ErrorConstructorWithCapture extends ErrorConstructor {
  captureStackTrace(targetObject: object, constructorOpt?: Function): void;
}

/**
 * Host error codes
 */
export type HostErrorCode =
  | "UNKNOWN_EFFECT_TYPE"
  | "EFFECT_TIMEOUT"
  | "EFFECT_EXECUTION_FAILED"
  | "EFFECT_HANDLER_ERROR"
  | "STORE_ERROR"
  | "LOOP_MAX_ITERATIONS"
  | "INVALID_STATE"
  | "HOST_NOT_INITIALIZED"
  // v1.1: Translator integration
  | "TRANSLATOR_LOWERING_ERROR"
  | "TRANSLATOR_AMBIGUOUS";

/**
 * Host error class
 */
export class HostError extends Error {
  readonly code: HostErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: HostErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "HostError";
    this.code = code;
    this.details = details;

    // Maintain proper stack trace for V8
    if ("captureStackTrace" in Error && typeof (Error as ErrorConstructorWithCapture).captureStackTrace === "function") {
      (Error as ErrorConstructorWithCapture).captureStackTrace(this, HostError);
    }
  }
}

/**
 * Create a host error
 */
export function createHostError(
  code: HostErrorCode,
  message: string,
  details?: Record<string, unknown>
): HostError {
  return new HostError(code, message, details);
}

/**
 * Type guard for HostError
 */
export function isHostError(error: unknown): error is HostError {
  return error instanceof HostError;
}
