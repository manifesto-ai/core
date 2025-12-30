/**
 * World Schema
 *
 * Defines the World type - an immutable snapshot of reality identified by its content hash.
 * WorldId = hash(schemaHash:snapshotHash)
 */
import { z } from "zod";

/**
 * World identifier - deterministic hash of (schemaHash, snapshotHash)
 */
export const WorldId = z.string().brand<"WorldId">();
export type WorldId = z.infer<typeof WorldId>;

/**
 * Proposal identifier - UUID v4 or equivalent
 */
export const ProposalId = z.string().brand<"ProposalId">();
export type ProposalId = z.infer<typeof ProposalId>;

/**
 * Decision identifier
 */
export const DecisionId = z.string().brand<"DecisionId">();
export type DecisionId = z.infer<typeof DecisionId>;

/**
 * Edge identifier
 */
export const EdgeId = z.string().brand<"EdgeId">();
export type EdgeId = z.infer<typeof EdgeId>;

/**
 * Reference to an artifact stored externally (e.g., execution trace)
 */
export const ArtifactRef = z.object({
  /** Location identifier (e.g., "cas://traces/abc123") */
  uri: z.string(),
  /** Content hash for verification */
  hash: z.string(),
});
export type ArtifactRef = z.infer<typeof ArtifactRef>;

/**
 * World - An immutable snapshot of reality
 *
 * Worlds are created when:
 * - Genesis (initial world with no parent)
 * - Proposal approved and executed (success or failure)
 *
 * Worlds are NEVER mutated after creation.
 */
export const World = z.object({
  /** Deterministic identifier: hash(schemaHash:snapshotHash) */
  worldId: WorldId,

  /** Hash of the domain schema */
  schemaHash: z.string(),

  /** Hash of the snapshot (excluding non-deterministic fields) */
  snapshotHash: z.string(),

  /** Timestamp when this world was created */
  createdAt: z.number(),

  /** ProposalId that created this world (null for genesis) */
  createdBy: ProposalId.nullable(),

  /** Optional reference to execution trace for auditability */
  executionTraceRef: ArtifactRef.optional(),
});
export type World = z.infer<typeof World>;

/**
 * Helper to create a WorldId (for type branding)
 */
export function createWorldId(id: string): WorldId {
  return id as WorldId;
}

/**
 * Helper to create a ProposalId (for type branding)
 */
export function createProposalId(id: string): ProposalId {
  return id as ProposalId;
}

/**
 * Helper to create a DecisionId (for type branding)
 */
export function createDecisionId(id: string): DecisionId {
  return id as DecisionId;
}

/**
 * Helper to create an EdgeId (for type branding)
 */
export function createEdgeId(id: string): EdgeId {
  return id as EdgeId;
}
