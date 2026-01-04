/**
 * Base error class for effect-utils
 */
export class EffectUtilsError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.name = "EffectUtilsError";
        this.code = code;
        this.details = details;
        if ("captureStackTrace" in Error) {
            Error.captureStackTrace(this, EffectUtilsError);
        }
    }
}
/**
 * TimeoutError - operation exceeded time limit
 */
export class TimeoutError extends EffectUtilsError {
    ms;
    constructor(ms, message) {
        super("TIMEOUT_ERROR", message ?? `Operation timed out after ${ms}ms`, { ms });
        this.name = "TimeoutError";
        this.ms = ms;
        if ("captureStackTrace" in Error) {
            Error.captureStackTrace(this, TimeoutError);
        }
    }
}
/**
 * RetryError - all retry attempts exhausted
 */
export class RetryError extends EffectUtilsError {
    attempts;
    lastError;
    constructor(attempts, lastError) {
        super("RETRY_EXHAUSTED", `Failed after ${attempts} attempts: ${lastError.message}`, { attempts, lastErrorMessage: lastError.message });
        this.name = "RetryError";
        this.attempts = attempts;
        this.lastError = lastError;
        if ("captureStackTrace" in Error) {
            Error.captureStackTrace(this, RetryError);
        }
    }
}
/**
 * ValidationError - schema validation failed
 */
export class ValidationError extends EffectUtilsError {
    issues;
    constructor(message, issues) {
        super("VALIDATION_ERROR", message, { issues });
        this.name = "ValidationError";
        this.issues = issues;
        if ("captureStackTrace" in Error) {
            Error.captureStackTrace(this, ValidationError);
        }
    }
}
/**
 * Type guard for TimeoutError
 */
export function isTimeoutError(error) {
    return error instanceof TimeoutError;
}
/**
 * Type guard for RetryError
 */
export function isRetryError(error) {
    return error instanceof RetryError;
}
/**
 * Type guard for ValidationError
 */
export function isValidationError(error) {
    return error instanceof ValidationError;
}
/**
 * Type guard for EffectUtilsError
 */
export function isEffectUtilsError(error) {
    return error instanceof EffectUtilsError;
}
//# sourceMappingURL=errors.js.map