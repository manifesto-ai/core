/**
 * World Lineage Schema
 *
 * Defines WorldEdge and lineage-related types.
 *
 * v1.0 Lineage Model: Fork-Only
 * - Every World (except genesis) has exactly one parent
 * - Multiple children are allowed (branching/forking)
 * - Merge operations are NOT supported in v1.0
 *
 * Lineage Invariants (MUST):
 * - LI-1: Lineage MUST be a Directed Acyclic Graph (DAG)
 * - LI-2: Lineage MUST be append-only (no deletions or modifications)
 * - LI-3: Every non-genesis World MUST have exactly one parent (v1.0)
 * - LI-4: Every edge MUST reference valid Worlds
 * - LI-5: Every edge MUST reference valid Proposal and DecisionRecord
 * - LI-6: Cycles MUST be rejected at edge creation
 * - LI-7: Genesis World MUST have zero parents
 */
import { z } from "zod";
import { WorldId, ProposalId, DecisionId, EdgeId } from "./world.js";

/**
 * World Edge - connects two worlds in the lineage DAG
 *
 * Each edge represents a transition from one world to another,
 * caused by the execution of a proposal.
 */
export const WorldEdge = z.object({
  /** Unique edge identifier */
  edgeId: EdgeId,

  /** Source world (parent) */
  from: WorldId,

  /** Target world (child) */
  to: WorldId,

  /** Proposal that caused this transition */
  proposalId: ProposalId,

  /** Decision that approved the proposal */
  decisionId: DecisionId,

  /** When this edge was created */
  createdAt: z.number(),
});
export type WorldEdge = z.infer<typeof WorldEdge>;

/**
 * World Lineage state - all worlds and edges
 */
export const WorldLineageState = z.object({
  /** All worlds in the lineage */
  worlds: z.map(WorldId, z.lazy(() => z.object({
    worldId: WorldId,
    schemaHash: z.string(),
    snapshotHash: z.string(),
    createdAt: z.number(),
    createdBy: ProposalId.nullable(),
  }))),

  /** All edges in the lineage */
  edges: z.map(EdgeId, WorldEdge),

  /** Genesis world ID */
  genesis: WorldId.nullable(),
});
export type WorldLineageState = z.infer<typeof WorldLineageState>;

/**
 * Lineage query result for path between worlds
 */
export const LineagePath = z.object({
  /** Starting world */
  from: WorldId,

  /** Ending world */
  to: WorldId,

  /** Edges along the path (ordered from → to) */
  edges: z.array(WorldEdge),
});
export type LineagePath = z.infer<typeof LineagePath>;

/**
 * Helper to validate edge would not create a cycle
 * This is a schema-level type, actual validation is in lineage/dag.ts
 */
export interface CycleCheckResult {
  wouldCreateCycle: boolean;
  existingPath?: WorldEdge[];
}
