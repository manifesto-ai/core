/**
 * V8 specific ErrorConstructor extension
 */
interface ErrorConstructorWithCapture extends ErrorConstructor {
  captureStackTrace(targetObject: object, constructorOpt?: Function): void;
}

/**
 * Error codes for effect-utils
 */
export type EffectUtilsErrorCode =
  | "TIMEOUT_ERROR"
  | "RETRY_EXHAUSTED"
  | "VALIDATION_ERROR"
  | "EFFECT_ERROR"
  | "ABORT_ERROR"
  | "UNKNOWN_ERROR";

/**
 * Base error class for effect-utils
 */
export class EffectUtilsError extends Error {
  readonly code: EffectUtilsErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: EffectUtilsErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "EffectUtilsError";
    this.code = code;
    this.details = details;

    if ("captureStackTrace" in Error) {
      (Error as ErrorConstructorWithCapture).captureStackTrace(
        this,
        EffectUtilsError
      );
    }
  }
}

/**
 * TimeoutError - operation exceeded time limit
 */
export class TimeoutError extends EffectUtilsError {
  readonly ms: number;

  constructor(ms: number, message?: string) {
    super(
      "TIMEOUT_ERROR",
      message ?? `Operation timed out after ${ms}ms`,
      { ms }
    );
    this.name = "TimeoutError";
    this.ms = ms;

    if ("captureStackTrace" in Error) {
      (Error as ErrorConstructorWithCapture).captureStackTrace(
        this,
        TimeoutError
      );
    }
  }
}

/**
 * RetryError - all retry attempts exhausted
 */
export class RetryError extends EffectUtilsError {
  readonly attempts: number;
  readonly lastError: Error;

  constructor(attempts: number, lastError: Error) {
    super(
      "RETRY_EXHAUSTED",
      `Failed after ${attempts} attempts: ${lastError.message}`,
      { attempts, lastErrorMessage: lastError.message }
    );
    this.name = "RetryError";
    this.attempts = attempts;
    this.lastError = lastError;

    if ("captureStackTrace" in Error) {
      (Error as ErrorConstructorWithCapture).captureStackTrace(
        this,
        RetryError
      );
    }
  }
}

/**
 * ValidationError - schema validation failed
 */
export class ValidationError extends EffectUtilsError {
  readonly issues: unknown[];

  constructor(message: string, issues: unknown[]) {
    super("VALIDATION_ERROR", message, { issues });
    this.name = "ValidationError";
    this.issues = issues;

    if ("captureStackTrace" in Error) {
      (Error as ErrorConstructorWithCapture).captureStackTrace(
        this,
        ValidationError
      );
    }
  }
}

/**
 * Type guard for TimeoutError
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Type guard for RetryError
 */
export function isRetryError(error: unknown): error is RetryError {
  return error instanceof RetryError;
}

/**
 * Type guard for ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard for EffectUtilsError
 */
export function isEffectUtilsError(error: unknown): error is EffectUtilsError {
  return error instanceof EffectUtilsError;
}
