/**
 * Memory Trace Validation Utilities
 *
 * Provides validation functions for MemoryTrace and related types.
 *
 * @see SPEC-1.2v §5.1.5, §8.4
 */
import { MemoryTrace } from "../schema/trace.js";
import { SelectedMemory, } from "../schema/selection.js";
import { VerificationEvidence, } from "../schema/proof.js";
/**
 * Validate a MemoryTrace.
 *
 * @param trace - Unknown value to validate
 * @returns ValidationResult with errors if invalid
 */
export function validateMemoryTrace(trace) {
    const result = MemoryTrace.safeParse(trace);
    if (result.success) {
        return { valid: true };
    }
    return {
        valid: false,
        errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
}
/**
 * Validate a SelectedMemory.
 *
 * @param memory - Unknown value to validate
 * @returns ValidationResult with errors if invalid
 */
export function validateSelectedMemory(memory) {
    const result = SelectedMemory.safeParse(memory);
    if (result.success) {
        return { valid: true };
    }
    return {
        valid: false,
        errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
}
/**
 * Validate a VerificationEvidence.
 *
 * @param evidence - Unknown value to validate
 * @returns ValidationResult with errors if invalid
 */
export function validateVerificationEvidence(evidence) {
    const result = VerificationEvidence.safeParse(evidence);
    if (result.success) {
        return { valid: true };
    }
    return {
        valid: false,
        errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
}
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
export function hasRequiredEvidence(trace) {
    return trace.selected.every((memory) => memory.evidence !== undefined && memory.evidence.method !== "none");
}
/**
 * Check if all memories in a trace are verified.
 *
 * @param trace - The MemoryTrace to check
 * @returns true if all memories have verified === true
 */
export function allVerified(trace) {
    return trace.selected.every((memory) => memory.verified === true);
}
/**
 * Filter memories by minimum confidence threshold.
 *
 * @param trace - The MemoryTrace to filter
 * @param minConfidence - Minimum confidence threshold (0-1)
 * @returns Array of memories meeting the threshold
 */
export function filterByConfidence(trace, minConfidence) {
    return trace.selected.filter((memory) => memory.confidence >= minConfidence);
}
/**
 * Check if a trace meets all selection constraints.
 *
 * @param trace - The MemoryTrace to check
 * @param constraints - Selection constraints to verify
 * @returns true if trace meets all constraints
 */
export function meetsConstraints(trace, constraints) {
    const { maxResults, minConfidence, requireVerified, requireEvidence } = constraints;
    // Check maxResults
    if (maxResults !== undefined && trace.selected.length > maxResults) {
        return false;
    }
    // Check minConfidence
    if (minConfidence !== undefined) {
        if (!trace.selected.every((m) => m.confidence >= minConfidence)) {
            return false;
        }
    }
    // Check requireVerified
    if (requireVerified === true) {
        if (!allVerified(trace)) {
            return false;
        }
    }
    // Check requireEvidence
    if (requireEvidence === true) {
        if (!hasRequiredEvidence(trace)) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=validate.js.map