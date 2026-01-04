/**
 * Action Catalog Types
 *
 * Per Intent & Projection Specification v1.1 (§3.4, §7.4)
 *
 * Action Catalog is a projection output used by UIs and LLM runtimes to enumerate
 * which actions are currently relevant and/or callable.
 *
 * IMPORTANT: Action Catalog is NOT a security boundary.
 * Final enforcement remains the responsibility of World Protocol (Authority)
 * and Core runtime validation. See FDR-IP015 for rationale.
 */
import type { ExprNode } from "@manifesto-ai/core";
import type { ActorRef } from "@manifesto-ai/world";
import type { SnapshotView } from "../schema/snapshot-view.js";

// ============================================================================
// Expression IR
// ============================================================================

/**
 * ExpressionIR: Opaque Intermediate Representation for availability predicates.
 *
 * When MEL is used, this is the compiler output ExprNode.
 * See manifesto-ai-compiler SPEC §7 (IR Mapping).
 *
 * Constraints:
 * - MUST be JSON-serializable (for cross-system transport)
 * - MUST be deterministic (same inputs → same output)
 * - MUST yield boolean result
 */
export type ExpressionIR = ExprNode;

// ============================================================================
// Availability Context & Predicate
// ============================================================================

/**
 * AvailabilityContext: Input for availability evaluation.
 *
 * Per FDR-IP016: Availability predicates MUST be pure functions of:
 * - snapshot.data
 * - snapshot.computed
 * - actor
 *
 * MUST NOT depend on: $input, $system, time, randomness, network
 */
export type AvailabilityContext = Readonly<{
  data: unknown;
  computed: Record<string, unknown>;
  actor: ActorRef;
}>;

/**
 * AvailabilityPredicate: What ActionDescriptor.available can hold.
 *
 * - ExpressionIR: Portable, MEL-compiled expression (preferred)
 * - fn: Non-portable extension for local runtimes only (not cross-system)
 * - null/undefined: Always available
 */
export type AvailabilityPredicate =
  | ExpressionIR
  | { readonly kind: "fn"; readonly evaluate: (ctx: AvailabilityContext) => boolean }
  | null;

// ============================================================================
// Action Descriptor
// ============================================================================

/**
 * ActionDescriptor: Source action definition.
 *
 * Describes an action that may be available for invocation.
 */
export type ActionDescriptor = Readonly<{
  /** Stable action identifier (e.g., "todo.create") */
  type: string;
  /** Optional UI label */
  label?: string;
  /** Optional description for LLM context */
  description?: string;
  /** JSON-serializable schema for tool/UI input */
  inputSchema?: unknown;
  /** Optional availability predicate (pure) */
  available?: AvailabilityPredicate;
}>;

// ============================================================================
// Availability Status
// ============================================================================

/**
 * AvailabilityStatus: Result of availability evaluation.
 *
 * Per FDR-IP018: Unknown status MUST NOT be treated as unavailable.
 * Core runtime performs full evaluation at execution time.
 */
export type AvailabilityStatus =
  | { readonly status: "available" }
  | { readonly status: "unavailable"; readonly reason?: string }
  | {
      readonly status: "unknown";
      readonly reason: "missing_context" | "indeterminate";
    };

// ============================================================================
// Projected Action
// ============================================================================

/**
 * ProjectedAction: Action after availability evaluation.
 */
export type ProjectedAction = Readonly<{
  type: string;
  label?: string;
  description?: string;
  inputSchema?: unknown;
  availability: AvailabilityStatus;
}>;

// ============================================================================
// Action Catalog
// ============================================================================

/**
 * ActionCatalog: Final output of Action Catalog Projection.
 *
 * Per §7.4: This is a read-only selection & shaping operation that enumerates
 * currently relevant actions. It does NOT produce Intents and does NOT interact
 * with World Protocol.
 */
export type ActionCatalog = Readonly<{
  kind: "action_catalog";
  /** Schema hash for context */
  schemaHash: string;
  /** Deterministic hash of actions + pruning options (see §7.4.4) */
  catalogHash: string;
  /** Projected actions after evaluation and pruning */
  actions: readonly ProjectedAction[];
}>;

// ============================================================================
// Pruning Options
// ============================================================================

/**
 * PruningOptions: Configuration for action filtering.
 *
 * Defaults (when omitted):
 * - policy: 'drop_unavailable'
 * - includeUnknown: true
 * - sort: 'type_lex'
 */
export type PruningOptions = Readonly<{
  /**
   * Pruning policy:
   * - 'drop_unavailable': Remove actions where availability.status === 'unavailable'
   * - 'mark_only': Keep all actions, but set availability accordingly (debug tooling)
   */
  policy?: "drop_unavailable" | "mark_only";
  /**
   * Whether to include actions with unknown availability status.
   * Default: true (per FDR-IP018 - honest uncertainty)
   */
  includeUnknown?: boolean;
  /**
   * Maximum number of actions to return.
   * Applied after sorting.
   */
  maxActions?: number;
  /**
   * Sort order:
   * - 'type_lex': Lexicographic sort by action.type (deterministic, interoperable)
   * - 'schema_order': Preserve the order of input actions
   */
  sort?: "type_lex" | "schema_order";
}>;

/**
 * AppliedPruningOptions: Effective pruning configuration after applying defaults.
 */
export type AppliedPruningOptions = {
  policy: "drop_unavailable" | "mark_only";
  includeUnknown: boolean;
  sort: "type_lex" | "schema_order";
  maxActions: number | null;
};

// ============================================================================
// Projection Request
// ============================================================================

/**
 * ActionCatalogProjectionRequest: Input for Action Catalog Projection.
 */
export type ActionCatalogProjectionRequest = Readonly<{
  /** Schema hash for catalogHash computation */
  schemaHash: string;
  /** Read-only snapshot view (data + computed) */
  snapshot: SnapshotView;
  /** Acting actor (for meta/roles in availability evaluation) */
  actor: ActorRef;
  /** Source catalog (typically from schema) */
  actions: readonly ActionDescriptor[];
  /**
   * Output mode:
   * - 'llm': Include description for LLM context
   * - 'ui': Include label for UI rendering
   * - 'debug': Include all fields
   */
  mode?: "llm" | "ui" | "debug";
  /** Pruning configuration */
  pruning?: PruningOptions;
}>;

// ============================================================================
// Projector Interface
// ============================================================================

/**
 * ActionCatalogProjector: Interface for Action Catalog Projection.
 *
 * Invariants (§16.5):
 * - INV-AC1: MUST be deterministic
 * - INV-AC2: catalogHash MUST use §7.4.4 algorithm
 * - INV-AC3: NOT a security boundary
 * - INV-AC4: Availability predicates MUST be pure
 * - INV-AC5: Unknown status MUST NOT be treated as unavailable
 */
export interface ActionCatalogProjector {
  projectActionCatalog(
    req: ActionCatalogProjectionRequest
  ): Promise<ActionCatalog>;
}
