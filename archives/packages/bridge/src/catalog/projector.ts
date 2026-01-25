/**
 * Action Catalog Projector
 *
 * Per Intent & Projection Specification v1.1 (§7.4)
 *
 * This projection does NOT produce Intents and does NOT interact with World Protocol.
 * It is a read-only selection & shaping operation that enumerates currently relevant actions.
 *
 * IMPORTANT: Action Catalog is NOT a security boundary.
 * Final enforcement is Authority governance + Core runtime validation.
 */
import {
  classifyCondition,
  createEvaluationContext,
} from "@manifesto-ai/compiler";
import type { ExprNode } from "@manifesto-ai/core";
import type {
  ActionCatalogProjector,
  ActionCatalogProjectionRequest,
  ActionCatalog,
  ActionDescriptor,
  ProjectedAction,
  AvailabilityStatus,
  AvailabilityPredicate,
  AvailabilityContext,
  AppliedPruningOptions,
} from "./types.js";
import { computeCatalogHash, getAppliedPruningOptions } from "./hash.js";

/**
 * Default implementation of ActionCatalogProjector.
 *
 * Invariants (§16.5):
 * - INV-AC1: MUST be deterministic
 * - INV-AC2: catalogHash uses §7.4.4 algorithm
 * - INV-AC3: NOT a security boundary
 * - INV-AC4: Availability predicates are pure (empty input in context)
 * - INV-AC5: Unknown status NOT treated as unavailable
 */
export class DefaultActionCatalogProjector implements ActionCatalogProjector {
  async projectActionCatalog(
    req: ActionCatalogProjectionRequest
  ): Promise<ActionCatalog> {
    const appliedPruning = getAppliedPruningOptions(req.pruning);

    // 1. Evaluate availability for each action
    const projectedActions = req.actions.map((action) =>
      this.projectAction(action, req)
    );

    // 2. Apply pruning policy
    let filtered = this.applyPruning(projectedActions, appliedPruning);

    // 3. Sort
    filtered = this.sortActions(filtered, appliedPruning.sort);

    // 4. Apply maxActions limit (after sorting per §7.4.3)
    if (appliedPruning.maxActions !== null) {
      filtered = filtered.slice(0, appliedPruning.maxActions);
    }

    // 5. Compute catalogHash
    const catalogHash = await computeCatalogHash(
      req.schemaHash,
      filtered,
      appliedPruning
    );

    return {
      kind: "action_catalog",
      schemaHash: req.schemaHash,
      catalogHash,
      actions: filtered,
    };
  }

  /**
   * Project a single action, evaluating its availability.
   */
  private projectAction(
    action: ActionDescriptor,
    req: ActionCatalogProjectionRequest
  ): ProjectedAction {
    const availability = this.evaluateAvailability(action.available, req);

    return {
      type: action.type,
      label: action.label,
      description: action.description,
      inputSchema: action.inputSchema,
      availability,
    };
  }

  /**
   * Evaluate availability predicate.
   *
   * Per §7.4.2:
   * - null/undefined → available
   * - fn predicate → call with context
   * - ExprNode → use compiler's classifyCondition
   *
   * Per FDR-IP016: Evaluation MUST NOT depend on $input.
   */
  private evaluateAvailability(
    predicate: AvailabilityPredicate | undefined,
    req: ActionCatalogProjectionRequest
  ): AvailabilityStatus {
    // null/undefined → always available
    if (predicate === null || predicate === undefined) {
      return { status: "available" };
    }

    // fn predicate → call directly with AvailabilityContext
    if (this.isFnPredicate(predicate)) {
      const ctx: AvailabilityContext = {
        data: req.snapshot.data,
        computed: req.snapshot.computed,
        actor: req.actor,
      };
      try {
        const result = predicate.evaluate(ctx);
        return result
          ? { status: "available" }
          : { status: "unavailable" };
      } catch {
        return { status: "unknown", reason: "indeterminate" };
      }
    }

    // ExprNode → use compiler's classifyCondition
    const exprNode = predicate as ExprNode;

    // Create evaluation context per SPEC - empty input for purity
    const evalCtx = createEvaluationContext({
      snapshot: {
        data: req.snapshot.data,
        computed: req.snapshot.computed,
      },
      meta: {
        intentId: "", // Not relevant for availability
        actor: req.actor
          ? { type: req.actor.kind, id: req.actor.actorId }
          : undefined,
      },
      input: {}, // MUST be empty per FDR-IP016
    });

    const classification = classifyCondition(exprNode, evalCtx);

    // Map classification to AvailabilityStatus
    switch (classification.reason) {
      case "no-condition":
      case "true":
        return { status: "available" };
      case "false":
        return { status: "unavailable" };
      case "null":
        // null result indicates missing context
        return { status: "unknown", reason: "missing_context" };
      case "non-boolean":
        // Non-boolean result indicates indeterminate
        return { status: "unknown", reason: "indeterminate" };
      default:
        return { status: "unknown", reason: "indeterminate" };
    }
  }

  /**
   * Type guard for fn predicate.
   */
  private isFnPredicate(
    predicate: AvailabilityPredicate
  ): predicate is {
    readonly kind: "fn";
    readonly evaluate: (ctx: AvailabilityContext) => boolean;
  } {
    return (
      predicate !== null &&
      typeof predicate === "object" &&
      "kind" in predicate &&
      predicate.kind === "fn"
    );
  }

  /**
   * Apply pruning policy.
   *
   * Per §7.4.3:
   * - drop_unavailable: remove unavailable actions
   * - mark_only: keep all actions
   * - includeUnknown: controls unknown status handling
   */
  private applyPruning(
    actions: ProjectedAction[],
    options: AppliedPruningOptions
  ): ProjectedAction[] {
    return actions.filter((action) => {
      if (action.availability.status === "available") {
        return true;
      }
      if (action.availability.status === "unknown") {
        return options.includeUnknown;
      }
      // unavailable
      return options.policy === "mark_only";
    });
  }

  /**
   * Sort actions.
   *
   * Per §7.4.3:
   * - type_lex: Lexicographic sort by type (deterministic, interoperable)
   * - schema_order: Preserve input order
   */
  private sortActions(
    actions: ProjectedAction[],
    sort: "type_lex" | "schema_order"
  ): ProjectedAction[] {
    if (sort === "schema_order") {
      return actions;
    }
    // type_lex: lexicographic sort
    return [...actions].sort((a, b) => a.type.localeCompare(b.type));
  }
}

/**
 * Factory function for ActionCatalogProjector.
 */
export function createActionCatalogProjector(): ActionCatalogProjector {
  return new DefaultActionCatalogProjector();
}
