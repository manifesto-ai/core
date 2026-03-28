/**
 * World Protocol Factories
 *
 * Helper functions for creating World Protocol entities.
 *
 * Per Intent & Projection Specification v1.0:
 * - createProposal takes IntentInstance (not simple Intent)
 * - createDecisionRecord includes approvedScope
 * - createIntentInstance is re-exported from schema/intent.ts
 *
 * Phase 2 split note:
 * - world keeps legacy async factory signatures for compatibility
 * - snapshot/world identity is delegated to @manifesto-ai/lineage
 */
import { v4 as uuidv4 } from "uuid";
import type { Snapshot } from "@manifesto-ai/core";
import {
  computeSnapshotHash as computeLineageSnapshotHash,
  computeWorldId as computeLineageWorldId,
} from "@manifesto-ai/lineage";
import {
  type World,
  type WorldId,
  type ProposalId,
  type DecisionId,
  type EdgeId,
  createWorldId,
  createProposalId,
  createDecisionId,
  createEdgeId,
} from "./schema/world.js";
import type { Proposal, ProposalTrace } from "./schema/proposal.js";
import type { ActorRef } from "./schema/actor.js";
import type { DecisionRecord, FinalDecision } from "./schema/decision.js";
import type { AuthorityRef } from "./schema/authority.js";
import type { WorldEdge } from "./schema/lineage.js";
import type { IntentInstance, IntentScope } from "./schema/intent.js";
import type { ExecutionKey } from "./types/index.js";

// Re-export intent factory functions
export {
  createIntentInstance,
  createIntentInstanceSync,
  computeIntentKey,
  toHostIntent,
  type CreateIntentInstanceOptions,
} from "./schema/intent.js";

// ============================================================================
// ID Generators
// ============================================================================

/**
 * Generate a new unique ProposalId
 */
export function generateProposalId(): ProposalId {
  return createProposalId(`prop-${uuidv4()}`);
}

/**
 * Generate a new unique DecisionId
 */
export function generateDecisionId(): DecisionId {
  return createDecisionId(`dec-${uuidv4()}`);
}

/**
 * Generate a new unique EdgeId
 */
export function generateEdgeId(): EdgeId {
  return createEdgeId(`edge-${uuidv4()}`);
}

/**
 * Compute snapshotHash per WORLD-HASH-* rules
 *
 * world keeps the legacy async signature, but the canonical implementation
 * now lives in @manifesto-ai/lineage.
 */
export async function computeSnapshotHash(snapshot: Snapshot): Promise<string> {
  return computeLineageSnapshotHash(snapshot);
}

/**
 * Compute WorldId from schemaHash and snapshotHash
 *
 * world keeps the legacy async signature, but the canonical implementation
 * now lives in @manifesto-ai/lineage.
 */
export async function computeWorldId(
  schemaHash: string,
  snapshotHash: string
): Promise<WorldId> {
  return createWorldId(computeLineageWorldId(schemaHash, snapshotHash));
}

// ============================================================================
// Entity Factories
// ============================================================================

/**
 * Create a genesis World
 *
 * Per WORLD-SCHEMA-1: Validates schemaHash consistency
 */
export async function createGenesisWorld(
  schemaHash: string,
  snapshot: Snapshot
): Promise<World> {
  // WORLD-SCHEMA-1: Validate schemaHash consistency
  if (snapshot.meta?.schemaHash && schemaHash !== snapshot.meta.schemaHash) {
    throw new Error(
      `WORLD-SCHEMA-1 violation: provided schemaHash (${schemaHash}) ` +
        `does not match snapshot.meta.schemaHash (${snapshot.meta.schemaHash})`
    );
  }

  const snapshotHash = await computeSnapshotHash(snapshot);
  const worldId = await computeWorldId(schemaHash, snapshotHash);

  return {
    worldId,
    schemaHash,
    snapshotHash,
    createdAt: Date.now(),
    createdBy: null, // Genesis has no parent proposal
  };
}

/**
 * Create a World from proposal execution
 *
 * Per WORLD-SCHEMA-1: Validates schemaHash consistency
 */
export async function createWorldFromExecution(
  schemaHash: string,
  snapshot: Snapshot,
  proposalId: ProposalId
): Promise<World> {
  // WORLD-SCHEMA-1: Validate schemaHash consistency
  if (snapshot.meta?.schemaHash && schemaHash !== snapshot.meta.schemaHash) {
    throw new Error(
      `WORLD-SCHEMA-1 violation: provided schemaHash (${schemaHash}) ` +
        `does not match snapshot.meta.schemaHash (${snapshot.meta.schemaHash})`
    );
  }

  const snapshotHash = await computeSnapshotHash(snapshot);
  const worldId = await computeWorldId(schemaHash, snapshotHash);

  return {
    worldId,
    schemaHash,
    snapshotHash,
    createdAt: Date.now(),
    createdBy: proposalId,
  };
}

/**
 * Create a new Proposal
 *
 * Per spec: Proposal.intent is IntentInstance
 * Per EPOCH-1: Proposal carries epoch at submission
 */
export interface CreateProposalOptions {
  readonly executionKey: ExecutionKey;
  readonly proposalId?: ProposalId;
  readonly trace?: ProposalTrace;
  readonly epoch?: number;
}

export function createProposal(
  actor: ActorRef,
  intent: IntentInstance,
  baseWorld: WorldId,
  options: CreateProposalOptions
): Proposal {
  const proposalId = options.proposalId ?? generateProposalId();
  return {
    proposalId,
    actor,
    intent,
    baseWorld,
    status: "submitted",
    epoch: options.epoch ?? 0,
    executionKey: options.executionKey,
    trace: options.trace,
    submittedAt: Date.now(),
  };
}

/**
 * Create a DecisionRecord
 *
 * Per spec: approvedScope MUST be set if decision is approved
 *
 * @param proposalId - The proposal being decided
 * @param authority - The authority making the decision
 * @param decision - The final decision
 * @param approvedScope - The approved scope (required if approved, null = no restriction)
 * @param reasoning - Optional reasoning
 */
export function createDecisionRecord(
  proposalId: ProposalId,
  authority: AuthorityRef,
  decision: FinalDecision,
  approvedScope?: IntentScope | null,
  reasoning?: string
): DecisionRecord {
  return {
    decisionId: generateDecisionId(),
    proposalId,
    authority,
    decision,
    approvedScope,
    reasoning,
    decidedAt: Date.now(),
  };
}

/**
 * Create a WorldEdge
 */
export function createWorldEdge(
  from: WorldId,
  to: WorldId,
  proposalId: ProposalId,
  decisionId: DecisionId
): WorldEdge {
  return {
    edgeId: generateEdgeId(),
    from,
    to,
    proposalId,
    decisionId,
    createdAt: Date.now(),
  };
}
