/**
 * Error codes for effect-utils
 */
export type EffectUtilsErrorCode = "TIMEOUT_ERROR" | "RETRY_EXHAUSTED" | "VALIDATION_ERROR" | "EFFECT_ERROR" | "ABORT_ERROR" | "UNKNOWN_ERROR";
/**
 * Base error class for effect-utils
 */
export declare class EffectUtilsError extends Error {
    readonly code: EffectUtilsErrorCode;
    readonly details?: Record<string, unknown>;
    constructor(code: EffectUtilsErrorCode, message: string, details?: Record<string, unknown>);
}
/**
 * TimeoutError - operation exceeded time limit
 */
export declare class TimeoutError extends EffectUtilsError {
    readonly ms: number;
    constructor(ms: number, message?: string);
}
/**
 * RetryError - all retry attempts exhausted
 */
export declare class RetryError extends EffectUtilsError {
    readonly attempts: number;
    readonly lastError: Error;
    constructor(attempts: number, lastError: Error);
}
/**
 * ValidationError - schema validation failed
 */
export declare class ValidationError extends EffectUtilsError {
    readonly issues: unknown[];
    constructor(message: string, issues: unknown[]);
}
/**
 * Type guard for TimeoutError
 */
export declare function isTimeoutError(error: unknown): error is TimeoutError;
/**
 * Type guard for RetryError
 */
export declare function isRetryError(error: unknown): error is RetryError;
/**
 * Type guard for ValidationError
 */
export declare function isValidationError(error: unknown): error is ValidationError;
/**
 * Type guard for EffectUtilsError
 */
export declare function isEffectUtilsError(error: unknown): error is EffectUtilsError;
//# sourceMappingURL=errors.d.ts.map