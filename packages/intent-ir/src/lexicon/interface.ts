/**
 * @fileoverview Lexicon Interface (SPEC Section 14.1)
 *
 * Lexicon is the single interface for both feature checking and lowering.
 */

import type {
  EventClass,
  Role,
  Term,
  IntentIR,
  ValueType,
} from "../schema/index.js";
import type { IntentBody, IntentScope } from "../keys/types.js";

// =============================================================================
// SelectionalRestriction
// =============================================================================

/**
 * Selectional restriction for a theta-role argument.
 *
 * Defines what kinds of terms and entity types are valid for a role.
 */
export type SelectionalRestriction = {
  /** Valid term kinds for this role */
  readonly termKinds: readonly Term["kind"][];
  /** Valid entity types (for entity terms) */
  readonly entityTypes?: readonly string[];
  /** Valid value types (for value terms) */
  readonly valueTypes?: readonly ValueType[];
};

// =============================================================================
// ThetaFrame
// =============================================================================

/**
 * Theta-frame defines the argument structure for an event.
 *
 * Invariant: For each role in (required ∪ optional), restrictions[role] MUST exist.
 */
export type ThetaFrame = {
  /** Roles that MUST be present */
  readonly required: readonly Role[];
  /** Roles that MAY be present */
  readonly optional: readonly Role[];
  /** Selectional restrictions per role */
  readonly restrictions: Partial<Record<Role, SelectionalRestriction>>;
};

// =============================================================================
// Footprint
// =============================================================================

/**
 * Footprint defines which paths are accessed during computation.
 */
export type Footprint = {
  /** Paths read during computation */
  readonly reads: readonly string[];
  /** Paths written during computation */
  readonly writes: readonly string[];
  /** Paths that affect computed values */
  readonly depends: readonly string[];
  /** Paths for verification */
  readonly verify?: readonly string[];
  /** Paths for policy check */
  readonly policy?: readonly string[];
};

// =============================================================================
// PolicyHints
// =============================================================================

/**
 * Policy hints for governance decisions.
 */
export type PolicyHints = {
  /** Operation is destructive (requires confirmation) */
  readonly destructive?: boolean;
  /** Operation is production-sensitive */
  readonly prodSensitive?: boolean;
  /** Operation requires authentication */
  readonly requiresAuth?: boolean;
};

// =============================================================================
// EventEntry
// =============================================================================

/**
 * Lexicon entry for an event/action.
 */
export type EventEntry = {
  /** Event class for this lemma (for CLASS_MISMATCH check) */
  readonly eventClass: EventClass;
  /** Theta-frame: which roles are required and their type constraints */
  readonly thetaFrame: ThetaFrame;
  /** Read/write/depends paths (for effect analysis) */
  readonly footprint?: Footprint;
  /** Policy hints (destructive, prod-sensitive, etc.) */
  readonly policyHints?: PolicyHints;
};

// =============================================================================
// EntitySpec
// =============================================================================

/**
 * Lexicon entry for an entity type.
 */
export type EntitySpec = {
  /** Field definitions */
  readonly fields: Record<string, unknown>;
};

// =============================================================================
// Lexicon Interface
// =============================================================================

/**
 * Lexicon interface for feature checking and lowering.
 *
 * Lexicon is the arbiter of validity (FDR-INT-001).
 * Structure is meaning; Lexicon defines what structures are valid.
 */
export interface Lexicon {
  // === Feature Checking ===

  /**
   * Resolve event entry by lemma.
   * Returns undefined if lemma is unknown.
   */
  resolveEvent(lemma: string): EventEntry | undefined;

  /**
   * Get entity specification by type.
   * Returns undefined if entity type is unknown.
   */
  resolveEntity(entityType: string): EntitySpec | undefined;

  // === Lowering ===

  /**
   * Resolve action type for IntentBody.
   * Maps IR lemma to protocol action type.
   */
  resolveActionType(lemma: string): string | undefined;

  /**
   * Map IR args + cond to domain input.
   * Cond becomes filter in input.
   */
  mapArgsToInput(
    args: IntentIR["args"],
    cond?: IntentIR["cond"]
  ): unknown;

  /**
   * Derive scope proposal for write operations (optional).
   */
  deriveScopeProposal?(ir: IntentIR): IntentScope | undefined;
}
