/**
 * Memory Trace Validation
 *
 * Utilities for validating MemoryTrace objects.
 *
 * @see SPEC-1.2v §12
 */
import { MemoryTrace } from "../schema/trace.js";
import { SelectedMemory } from "../schema/selection.js";

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
export function validateSelectedMemory(memory: unknown): ValidationResult {
  const errors: string[] = [];

  if (!memory || typeof memory !== "object") {
    return { valid: false, errors: ["SelectedMemory must be an object"] };
  }

  const m = memory as Record<string, unknown>;

  // Check ref
  if (!m.ref || typeof m.ref !== "object") {
    errors.push("ref must be an object");
  } else {
    const ref = m.ref as Record<string, unknown>;
    if (typeof ref.worldId !== "string") {
      errors.push("ref.worldId must be a string");
    }
  }

  // Check reason (CR-07)
  if (typeof m.reason !== "string" || m.reason.length === 0) {
    errors.push("reason must be a non-empty string (CR-07)");
  }

  // Check confidence (CR-08)
  if (typeof m.confidence !== "number") {
    errors.push("confidence must be a number (CR-08)");
  } else if (m.confidence < 0 || m.confidence > 1) {
    errors.push("confidence must be in range [0, 1] (CR-08)");
  } else if (!Number.isFinite(m.confidence)) {
    errors.push("confidence must be finite, not NaN or Infinity (CR-08)");
  }

  // Check verified
  if (typeof m.verified !== "boolean") {
    errors.push("verified must be a boolean");
  }

  // Check evidence (optional)
  if (m.evidence !== undefined) {
    if (typeof m.evidence !== "object" || m.evidence === null) {
      errors.push("evidence must be an object if present");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a MemoryTrace object.
 *
 * Checks all constraints from SPEC-1.2v §5.1.5.
 *
 * @param trace - The value to validate
 * @returns ValidationResult
 */
export function validateMemoryTrace(trace: unknown): ValidationResult {
  const errors: string[] = [];

  if (!trace || typeof trace !== "object") {
    return { valid: false, errors: ["MemoryTrace must be an object"] };
  }

  const t = trace as Record<string, unknown>;

  // Check selector
  if (!t.selector || typeof t.selector !== "object") {
    errors.push("selector must be an object (ActorRef)");
  } else {
    const selector = t.selector as Record<string, unknown>;
    if (typeof selector.actorId !== "string") {
      errors.push("selector.actorId must be a string");
    }
    if (typeof selector.kind !== "string") {
      errors.push("selector.kind must be a string");
    }
  }

  // Check query
  if (typeof t.query !== "string" || t.query.length === 0) {
    errors.push("query must be a non-empty string");
  }

  // Check selectedAt
  if (typeof t.selectedAt !== "number" || t.selectedAt <= 0) {
    errors.push("selectedAt must be a positive integer");
  }

  // Check atWorldId
  if (typeof t.atWorldId !== "string") {
    errors.push("atWorldId must be a string (WorldId)");
  }

  // Check selected array
  if (!Array.isArray(t.selected)) {
    errors.push("selected must be an array");
  } else {
    for (let i = 0; i < t.selected.length; i++) {
      const memoryResult = validateSelectedMemory(t.selected[i]);
      if (!memoryResult.valid) {
        errors.push(`selected[${i}]: ${memoryResult.errors.join(", ")}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Type guard for MemoryTrace.
 *
 * @param trace - The value to check
 * @returns true if the value is a valid MemoryTrace
 */
export function isMemoryTrace(trace: unknown): trace is MemoryTrace {
  const result = MemoryTrace.safeParse(trace);
  return result.success;
}

/**
 * Parse and validate a MemoryTrace.
 *
 * @param trace - The value to parse
 * @returns The parsed MemoryTrace or throws on validation failure
 */
export function parseMemoryTrace(trace: unknown): MemoryTrace {
  return MemoryTrace.parse(trace);
}

/**
 * Safely parse a MemoryTrace.
 *
 * @param trace - The value to parse
 * @returns The parsed MemoryTrace or undefined if invalid
 */
export function safeParseMemoryTrace(trace: unknown): MemoryTrace | undefined {
  const result = MemoryTrace.safeParse(trace);
  return result.success ? result.data : undefined;
}
