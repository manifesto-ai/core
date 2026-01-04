/**
 * Memory Trace Validation
 *
 * Utilities for validating MemoryTrace objects.
 *
 * @see SPEC-1.2v §12
 */
import { MemoryTrace } from "../schema/trace.js";
/**
 * Validation result with detailed error information.
 */
export interface ValidationResult {
    /** Whether the trace is valid */
    valid: boolean;
    /** Error messages if invalid */
    errors: string[];
}
/**
 * Validate a SelectedMemory object.
 *
 * Checks:
 * - CR-07: reason MUST be non-empty string
 * - CR-08: confidence MUST be in [0, 1] and finite
 * - verified is boolean
 *
 * @param memory - The SelectedMemory to validate
 * @returns ValidationResult
 */
export declare function validateSelectedMemory(memory: unknown): ValidationResult;
/**
 * Validate a MemoryTrace object.
 *
 * Checks all constraints from SPEC-1.2v §5.1.5.
 *
 * @param trace - The value to validate
 * @returns ValidationResult
 */
export declare function validateMemoryTrace(trace: unknown): ValidationResult;
/**
 * Type guard for MemoryTrace.
 *
 * @param trace - The value to check
 * @returns true if the value is a valid MemoryTrace
 */
export declare function isMemoryTrace(trace: unknown): trace is MemoryTrace;
/**
 * Parse and validate a MemoryTrace.
 *
 * @param trace - The value to parse
 * @returns The parsed MemoryTrace or throws on validation failure
 */
export declare function parseMemoryTrace(trace: unknown): MemoryTrace;
/**
 * Safely parse a MemoryTrace.
 *
 * @param trace - The value to parse
 * @returns The parsed MemoryTrace or undefined if invalid
 */
export declare function safeParseMemoryTrace(trace: unknown): MemoryTrace | undefined;
//# sourceMappingURL=validate.d.ts.map