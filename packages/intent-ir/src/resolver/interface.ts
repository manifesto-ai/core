/**
 * @fileoverview Resolver Interface (SPEC Section 8.2)
 *
 * Resolver handles discourse reference resolution.
 * Resolution is DETERMINISTIC (no LLM involved).
 */

import type {
  IntentIR,
  ResolvedIntentIR,
  Term,
  ResolvedTerm,
  EntityRefTerm,
  ResolvedEntityRefTerm,
  Args,
  ResolvedArgs,
  ResolvedNonListTerm,
} from "../schema/index.js";

// =============================================================================
// ResolutionContext
// =============================================================================

/**
 * Context for reference resolution.
 */
export type ResolutionContext = {
  /** Currently focused entity (for "this") */
  readonly focus?: FocusEntry;
  /** Discourse history for "that" and "last" */
  readonly discourse: readonly DiscourseEntry[];
};

/**
 * Focus entry representing the currently focused entity.
 */
export type FocusEntry = {
  readonly entityType: string;
  readonly id: string;
};

/**
 * Discourse entry for reference resolution.
 */
export type DiscourseEntry = {
  readonly entityType: string;
  readonly id: string;
  /** Timestamp or sequence number for ordering */
  readonly mentionedAt: number;
};

// =============================================================================
// Resolver Interface
// =============================================================================

/**
 * Resolver interface for discourse reference resolution.
 *
 * Resolution is DETERMINISTIC (no LLM involved).
 * Given same context, same IR -> same resolved IR.
 *
 * Resolution rules:
 * - this -> context.focus.id (if entityType matches)
 * - that -> most recent in discourse of different type from focus
 * - last -> most recent of same entityType
 * - id -> pass through
 * - absent ref (collection scope) -> preserve
 */
export interface Resolver {
  /**
   * Resolve symbolic references (this/that/last) to concrete IDs.
   * Collection scope (ref absent) is preserved.
   *
   * @throws Error if resolution fails (e.g., "this" with no focus)
   */
  resolveReferences(ir: IntentIR, context?: ResolutionContext): ResolvedIntentIR;
}

// =============================================================================
// createResolver
// =============================================================================

/**
 * Create a default Resolver implementation.
 *
 * @example
 * const resolver = createResolver();
 * const resolved = resolver.resolveReferences(ir, {
 *   focus: { entityType: "Order", id: "123" },
 *   discourse: [
 *     { entityType: "Order", id: "456", mentionedAt: 1 },
 *     { entityType: "User", id: "789", mentionedAt: 2 }
 *   ]
 * });
 */
export function createResolver(): Resolver {
  return {
    resolveReferences(ir: IntentIR, context?: ResolutionContext): ResolvedIntentIR {
      const resolvedArgs = resolveArgs(ir.args, context);

      // Also resolve references in conditions if present
      const resolvedCond = ir.cond?.map((pred) => ({
        ...pred,
        rhs: resolveTerm(pred.rhs, context),
      }));

      return {
        ...ir,
        args: resolvedArgs,
        ...(resolvedCond && { cond: resolvedCond }),
      };
    },
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Resolve all terms in args.
 */
function resolveArgs(args: Args, context?: ResolutionContext): ResolvedArgs {
  const result: Record<string, ResolvedTerm> = {};

  for (const [role, term] of Object.entries(args)) {
    if (term !== undefined) {
      result[role] = resolveTerm(term, context);
    }
  }

  return result as ResolvedArgs;
}

/**
 * Resolve a single term.
 */
function resolveTerm(term: Term, context?: ResolutionContext): ResolvedTerm {
  if (term.kind === "list") {
    return {
      kind: "list",
      items: term.items.map(
        (item) => resolveTerm(item as Term, context) as ResolvedNonListTerm
      ),
      ...(term.ordered !== undefined ? { ordered: term.ordered } : null),
      ...(term.ext !== undefined ? { ext: term.ext } : null),
    };
  }

  if (term.kind !== "entity") {
    // Non-entity terms pass through unchanged
    return term;
  }

  return resolveEntityRefTerm(term, context);
}

/**
 * Resolve an EntityRefTerm to ResolvedEntityRefTerm.
 */
function resolveEntityRefTerm(
  term: EntityRefTerm,
  context?: ResolutionContext
): ResolvedEntityRefTerm {
  // Collection scope: preserve absence
  if (!term.ref) {
    return {
      kind: "entity",
      entityType: term.entityType,
      ...(term.quant ? { quant: term.quant } : null),
      ...(term.orderBy ? { orderBy: term.orderBy } : null),
      ...(term.orderDir ? { orderDir: term.orderDir } : null),
      ...(term.ext ? { ext: term.ext } : null),
    };
  }

  // Already resolved (id kind): pass through
  if (term.ref.kind === "id") {
    return {
      kind: "entity",
      entityType: term.entityType,
      ref: { kind: "id", id: term.ref.id! },
      ...(term.quant ? { quant: term.quant } : null),
      ...(term.orderBy ? { orderBy: term.orderBy } : null),
      ...(term.orderDir ? { orderDir: term.orderDir } : null),
      ...(term.ext ? { ext: term.ext } : null),
    };
  }

  // Symbolic reference: resolve
  const resolvedId = resolveSymbolicRef(term.ref.kind, term.entityType, context);

  return {
    kind: "entity",
    entityType: term.entityType,
    ref: { kind: "id", id: resolvedId },
    ...(term.quant ? { quant: term.quant } : null),
    ...(term.orderBy ? { orderBy: term.orderBy } : null),
    ...(term.orderDir ? { orderDir: term.orderDir } : null),
    ...(term.ext ? { ext: term.ext } : null),
  };
}

/**
 * Resolve a symbolic reference (this/that/last) to a concrete ID.
 */
function resolveSymbolicRef(
  refKind: "this" | "that" | "last",
  entityType: string,
  context?: ResolutionContext
): string {
  if (!context) {
    throw new Error(`Cannot resolve "${refKind}" reference: no context provided`);
  }

  switch (refKind) {
    case "this": {
      // "this" resolves to the currently focused entity
      if (!context.focus) {
        throw new Error(`Cannot resolve "this": no focus in context`);
      }
      if (context.focus.entityType !== entityType) {
        throw new Error(
          `Cannot resolve "this": focus is ${context.focus.entityType}, expected ${entityType}`
        );
      }
      return context.focus.id;
    }

    case "that": {
      // "that" resolves to the most recent entity that is NOT the focus
      const candidates = context.discourse
        .filter((e) => {
          // Exclude focus if present
          if (context.focus && e.id === context.focus.id) {
            return false;
          }
          return true;
        })
        .sort((a, b) => b.mentionedAt - a.mentionedAt);

      if (candidates.length === 0) {
        throw new Error(`Cannot resolve "that": no matching entity in discourse`);
      }

      // If entityType is specified, filter by it
      const ofType = candidates.filter((e) => e.entityType === entityType);
      if (ofType.length > 0) {
        return ofType[0].id;
      }

      // If no exact type match, use most recent
      return candidates[0].id;
    }

    case "last": {
      // "last" resolves to the most recent entity of the same type
      const candidates = context.discourse
        .filter((e) => e.entityType === entityType)
        .sort((a, b) => b.mentionedAt - a.mentionedAt);

      if (candidates.length === 0) {
        throw new Error(
          `Cannot resolve "last": no ${entityType} in discourse history`
        );
      }

      return candidates[0].id;
    }
  }
}
