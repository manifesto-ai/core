/**
 * @fileoverview S5: Resolve References Stage
 *
 * Resolves discourse references (this/that/last) to concrete IDs.
 * Deterministic stage.
 * Aligned with SPEC §5.1 S5 and §10.
 */

import type { IntentIR, EntityRef, Term } from "@manifesto-ai/intent-ir";
import type { TranslateRequest, ResolutionRecord } from "../types/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Resolve references stage output
 * SPEC §10.2
 */
export type ResolveStageOutput = {
  /** Pure IntentIR (ref.kind replaced with 'id') */
  readonly ir: IntentIR;
  /** Resolution records (separate, not injected into IR) */
  readonly resolutions: readonly ResolutionRecord[];
};

/**
 * Resolution context from recent requests
 */
export type ResolutionContext = {
  /** Recent requests to reference */
  readonly recentRequests: readonly TranslateRequest[];
  /** Maximum depth */
  readonly depth: number;
};

/**
 * Resolve stage trace output
 */
export type ResolveStageTrace = {
  readonly referencesFound: number;
  readonly resolved: number;
  readonly unresolved: readonly string[];
  readonly resolutions: readonly ResolutionRecord[];
};

// =============================================================================
// Context Building
// =============================================================================

/**
 * Build resolution context from recent requests
 */
export function buildResolutionContext(
  requests: readonly TranslateRequest[],
  depth: number
): ResolutionContext {
  // Take the most recent N requests
  const recentRequests = requests.slice(-depth);

  return {
    recentRequests,
    depth,
  };
}

// =============================================================================
// Reference Resolution
// =============================================================================

/**
 * Check if a term is an entity reference term that needs resolution
 */
function needsResolution(term: Term | undefined): boolean {
  if (!term) return false;
  if (term.kind !== "entity") return false;
  if (!term.ref) return false;
  return term.ref.kind !== "id";
}

/**
 * Find concrete ID for a symbolic reference
 */
function findConcreteRef(
  ref: EntityRef,
  entityType: string,
  context: ResolutionContext
): EntityRef | undefined {
  const { recentRequests } = context;

  switch (ref.kind) {
    case "this":
      // Current context - look for most recent entity of same type
      return findMostRecentEntity(entityType, recentRequests, 0);

    case "that":
      // Previously mentioned - look for entity mentioned before current
      return findMostRecentEntity(entityType, recentRequests, 1);

    case "last":
      // Most recent - look for most recent entity of that type
      return findMostRecentEntity(entityType, recentRequests, 0);

    case "id":
      // Already concrete
      return ref;

    default:
      return undefined;
  }
}

/**
 * Find most recent entity of a given type in request history
 */
function findMostRecentEntity(
  entityType: string,
  requests: readonly TranslateRequest[],
  skipCount: number
): EntityRef | undefined {
  let found = 0;

  // Search from most recent to oldest
  for (let i = requests.length - 1; i >= 0; i--) {
    const request = requests[i];
    if (!request.intentIR) continue;

    // Search args for entity of matching type
    const entityId = findEntityInArgs(request.intentIR.args, entityType);
    if (entityId) {
      if (found >= skipCount) {
        return { kind: "id", id: entityId };
      }
      found++;
    }
  }

  return undefined;
}

/**
 * Find entity ID in args that matches type
 */
function findEntityInArgs(
  args: IntentIR["args"],
  entityType: string
): string | undefined {
  for (const term of Object.values(args)) {
    if (!term) continue;
    if (term.kind === "entity") {
      if (term.entityType === entityType || entityType === "*") {
        if (term.ref?.kind === "id" && term.ref.id) {
          return term.ref.id;
        }
      }
    }
  }
  return undefined;
}

// =============================================================================
// Stage Implementation
// =============================================================================

/**
 * S5: Resolve discourse references (this/that/last → id)
 *
 * TAPP-PIPE-1: This stage is deterministic.
 * TAPP-RES-3: Resolution is deterministic with same context.
 * TAPP-RES-4: Resolution records are managed separately, not injected into IR.
 *
 * @param ir - IntentIR from S4 (feature check)
 * @param context - Resolution context from recent requests
 * @returns ResolveStageOutput
 */
export function resolveReferences(
  ir: IntentIR,
  context: ResolutionContext
): ResolveStageOutput {
  const resolutions: ResolutionRecord[] = [];

  // Deep clone IR to avoid mutation
  const resolvedIR: IntentIR = JSON.parse(JSON.stringify(ir));

  // Resolve args
  const args = resolvedIR.args as Record<string, Term | undefined>;
  for (const [role, term] of Object.entries(args)) {
    if (!term || term.kind !== "entity" || !term.ref) continue;

    if (needsResolution(term)) {
      const original = term.ref;
      const resolved = findConcreteRef(original, term.entityType, context);

      if (resolved) {
        // Update the ref in the cloned IR
        (term as { ref: EntityRef }).ref = resolved;

        // Record the resolution
        resolutions.push({
          path: `args.${role}.ref`,
          original,
          resolved,
        });
      }
    }
  }

  // Resolve cond (if present)
  if (resolvedIR.cond) {
    for (let i = 0; i < resolvedIR.cond.length; i++) {
      const pred = resolvedIR.cond[i];
      const rhs = pred.rhs;

      if (rhs && rhs.kind === "entity" && rhs.ref && needsResolution(rhs)) {
        const original = rhs.ref;
        const resolved = findConcreteRef(original, rhs.entityType, context);

        if (resolved) {
          // Update the ref in the cloned IR
          (rhs as { ref: EntityRef }).ref = resolved;

          // Record the resolution
          resolutions.push({
            path: `cond[${i}].rhs.ref`,
            original,
            resolved,
          });
        }
      }
    }
  }

  return {
    ir: resolvedIR,
    resolutions,
  };
}

/**
 * Create resolve stage trace from output
 */
export function createResolveStageTrace(
  output: ResolveStageOutput,
  unresolvedPaths: readonly string[] = []
): ResolveStageTrace {
  return {
    referencesFound: output.resolutions.length + unresolvedPaths.length,
    resolved: output.resolutions.length,
    unresolved: unresolvedPaths,
    resolutions: output.resolutions,
  };
}

/**
 * Count symbolic references that need resolution in an IR
 */
export function countSymbolicRefs(ir: IntentIR): number {
  let count = 0;

  // Count in args
  for (const term of Object.values(ir.args)) {
    if (needsResolution(term as Term | undefined)) {
      count++;
    }
  }

  // Count in cond
  if (ir.cond) {
    for (const pred of ir.cond) {
      if (needsResolution(pred.rhs)) {
        count++;
      }
    }
  }

  return count;
}
