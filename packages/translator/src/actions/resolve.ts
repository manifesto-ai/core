/**
 * @fileoverview Resolve Action
 *
 * Handles user responses to ambiguous translations.
 * Supports select, provide, and cancel operations.
 * Aligned with SPEC §6.3.
 */

import type { IntentBody } from "@manifesto-ai/intent-ir";
import {
  type ResolveInput,
  type ResolveOutput,
  type TranslatorState,
  type TranslateRequest,
  type AmbiguityCandidate,
  createError,
  isSelectResolution,
  isProvideResolution,
  isCancelResolution,
} from "../types/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Resolve action context
 */
export type ResolveContext = {
  /** Current translator state */
  readonly state: TranslatorState;
};

// =============================================================================
// Action Implementation
// =============================================================================

/**
 * Execute resolve action
 *
 * Processes user choice for ambiguous translation.
 *
 * @param input - Resolve action input
 * @param context - Action context with state
 * @returns ResolveOutput
 */
export function resolve(
  input: ResolveInput,
  context: ResolveContext
): ResolveOutput {
  const { state } = context;

  // Find the request by ID
  const request = state.requests.find(
    (r) => r.requestId === input.requestId
  );

  if (!request) {
    return {
      kind: "error",
      error: createError(
        "REFERENCE_UNRESOLVED",
        `No request found for requestId: ${input.requestId}`,
        { stage: "resolve", recoverable: true }
      ),
    };
  }

  // Check if request is ambiguous
  if (request.result?.kind !== "ambiguous") {
    return {
      kind: "error",
      error: createError(
        "INTERNAL_ERROR",
        `Request ${input.requestId} is not ambiguous`,
        { stage: "resolve", recoverable: true }
      ),
    };
  }

  const candidates = request.result.candidates;

  if (isSelectResolution(input.resolution)) {
    return handleSelect(input.resolution.index, candidates);
  }

  if (isProvideResolution(input.resolution)) {
    return handleProvide(input.resolution.role, input.resolution.value, request);
  }

  if (isCancelResolution(input.resolution)) {
    return handleCancel();
  }

  return {
    kind: "error",
    error: createError(
      "INTERNAL_ERROR",
      `Unknown resolution kind`,
      { stage: "resolve", recoverable: false }
    ),
  };
}

// =============================================================================
// Choice Handlers
// =============================================================================

/**
 * Handle select choice - user chose from candidates
 */
function handleSelect(
  index: number,
  candidates: readonly AmbiguityCandidate[]
): ResolveOutput {
  // Validate candidate index
  if (index < 0 || index >= candidates.length) {
    return {
      kind: "error",
      error: createError(
        "INVALID_SELECTION",
        `Invalid candidate index: ${index} (${candidates.length} available)`,
        { stage: "resolve", recoverable: true }
      ),
    };
  }

  const selected = candidates[index];

  return {
    kind: "success",
    body: selected.body,
    intentKey: generateIntentKey(selected.body),
  };
}

/**
 * Handle provide choice - user provided additional information
 */
function handleProvide(
  role: string,
  value: unknown,
  request: TranslateRequest
): ResolveOutput {
  // For provide resolution, we would need to re-run lowering
  // with the additional information. For now, return still_unresolved.
  return {
    kind: "still_unresolved",
    partial: {},
    missing: [{
      kind: "required_role",
      detail: `Provide resolution not fully implemented`,
      suggestion: `Please use select resolution`,
    }],
  };
}

/**
 * Handle cancel choice - user cancelled resolution
 */
function handleCancel(): ResolveOutput {
  return {
    kind: "cancelled",
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate intent key from IntentBody (simplified)
 */
function generateIntentKey(body: IntentBody): string {
  // In a real implementation, this would use deriveIntentKeySync
  return `ik_${JSON.stringify(body).slice(0, 32)}`;
}

/**
 * Find request by ID
 */
export function findRequest(
  state: TranslatorState,
  requestId: string
): TranslateRequest | undefined {
  return state.requests.find((r) => r.requestId === requestId);
}

/**
 * Find ambiguous requests
 */
export function findAmbiguousRequests(
  state: TranslatorState
): readonly TranslateRequest[] {
  return state.requests.filter((r) => r.result?.kind === "ambiguous");
}

/**
 * Find unresolved requests
 */
export function findUnresolvedRequests(
  state: TranslatorState
): readonly TranslateRequest[] {
  return state.requests.filter((r) => r.result?.kind === "unresolved");
}
