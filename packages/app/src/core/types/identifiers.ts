/**
 * Manifesto App — Base Identifiers & Re-exports
 *
 * Leaf module: no internal type imports.
 *
 * @see SPEC v2.0.0 §5.1
 * @see ADR-004 Phase 1
 * @module
 */

import type { Patch, Requirement, Snapshot } from "@manifesto-ai/core";

// Re-export Patch, Requirement, and Snapshot from core
export type { Patch, Requirement, Snapshot };

import type {
  World,
  WorldId,
  WorldHead,
} from "@manifesto-ai/world";

// Re-export World, WorldId, and WorldHead from world
export type { World, WorldId, WorldHead };

// =============================================================================
// Base Types
// =============================================================================

/**
 * App lifecycle status.
 *
 * Lifecycle transitions:
 * created → initializing → ready → disposing → disposed
 *
 * @see SPEC v2.0.0 §7.1
 * @see FDR-APP-RUNTIME-001 §2.3
 */
export type AppStatus =
  | "created" // Instance created, not yet initialized
  | "initializing" // Internal binding in progress (v2.0.0)
  | "ready" // External contract usable
  | "disposing" // Cleanup in progress, new ingress rejected
  | "disposed"; // Terminal state

// =============================================================================
// v2.0.0 Core Identifiers
// =============================================================================

/**
 * Execution key for mailbox routing.
 *
 * @see SPEC v2.0.0 §5.1
 */
export type ExecutionKey = string;

/**
 * Schema hash for referential identity.
 */
export type SchemaHash = string;

/**
 * Branch identifier.
 */
export type BranchId = string;

/**
 * Memory identifier.
 */
export type MemoryId = string;

/**
 * Proposal identifier.
 */
export type ProposalId = string;

/**
 * Actor identifier.
 */
export type ActorId = string;

/**
 * Opaque reference to Host-owned artifact.
 * World/App MAY store this reference but MUST NOT interpret its contents.
 * Only Host knows how to resolve ArtifactRef → actual data.
 *
 * Structure follows World SPEC v2.0.2 for cross-boundary compatibility.
 *
 * @see SPEC v2.0.0 §5.1
 */
export type ArtifactRef = {
  readonly uri: string;
  readonly hash: string;
};

/**
 * Proposal status.
 *
 * @see SPEC v2.0.0 §5.3
 */
export type ProposalStatus =
  | "submitted"
  | "evaluating"
  | "approved"
  | "rejected"
  | "executing"
  | "completed"
  | "failed";

/**
 * World outcome.
 *
 * @see SPEC v2.0.0 §5.5
 */
export type WorldOutcome = "completed" | "failed";

/**
 * Runtime kind indicator.
 *
 * @see SPEC Appendix A.1
 */
export type RuntimeKind = "domain" | "system";

/**
 * Unsubscribe function returned by subscribe methods.
 */
export type Unsubscribe = () => void;

/**
 * MEL text (string) or compiled DomainSchema.
 */
export type MelText = string;
