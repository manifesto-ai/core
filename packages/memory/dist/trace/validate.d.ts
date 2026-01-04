/**
 * Memory Trace Validation Utilities
 *
 * Provides validation functions for MemoryTrace and related types.
 *
 * @see SPEC-1.2v §5.1.5, §8.4
 */
import { type MemoryTrace as MemoryTraceType } from "../schema/trace.js";
import { type SelectedMemory as SelectedMemoryType } from "../schema/selection.js";
/**
 * Result of validation operation.
 */
export type ValidationResult = {
    valid: true;
} | {
    valid: false;
    errors: string[];
};
/**
 * Validate a MemoryTrace.
 *
 * @param trace - Unknown value to validate
 * @returns ValidationResult with errors if invalid
 */
export declare function validateMemoryTrace(trace: unknown): ValidationResult;
/**
 * Validate a SelectedMemory.
 *
 * @param memory - Unknown value to validate
 * @returns ValidationResult with errors if invalid
 */
export declare function validateSelectedMemory(memory: unknown): ValidationResult;
/**
 * Validate a VerificationEvidence.
 *
 * @param evidence - Unknown value to validate
 * @returns ValidationResult with errors if invalid
 */
export declare function validateVerificationEvidence(evidence: unknown): ValidationResult;
/**
 * Check if all memories in a trace have required evidence.
 *
 * "Required evidence" means:
 * - evidence field is present (not undefined)
 * - evidence.method is NOT 'none'
 *
 * This is used for `requireEvidence` constraint validation.
 *
 * @param trace - The MemoryTrace to check
 * @returns true if all memories have required evidence
 */
export declare function hasRequiredEvidence(trace: MemoryTraceType): boolean;
/**
 * Check if all memories in a trace are verified.
 *
 * @param trace - The MemoryTrace to check
 * @returns true if all memories have verified === true
 */
export declare function allVerified(trace: MemoryTraceType): boolean;
/**
 * Filter memories by minimum confidence threshold.
 *
 * @param trace - The MemoryTrace to filter
 * @param minConfidence - Minimum confidence threshold (0-1)
 * @returns Array of memories meeting the threshold
 */
export declare function filterByConfidence(trace: MemoryTraceType, minConfidence: number): SelectedMemoryType[];
/**
 * Check if a trace meets all selection constraints.
 *
 * @param trace - The MemoryTrace to check
 * @param constraints - Selection constraints to verify
 * @returns true if trace meets all constraints
 */
export declare function meetsConstraints(trace: MemoryTraceType, constraints: {
    maxResults?: number;
    minConfidence?: number;
    requireVerified?: boolean;
    requireEvidence?: boolean;
}): boolean;
//# sourceMappingURL=validate.d.ts.map