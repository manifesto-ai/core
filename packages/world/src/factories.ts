/**
 * World Protocol Factories
 *
 * Helper functions for creating World Protocol entities.
 *
 * Per Intent & Projection Specification v1.0:
 * - createProposal takes IntentInstance (not simple Intent)
 * - createDecisionRecord includes approvedScope
 * - createIntentInstance is re-exported from schema/intent.ts
 */
import { v4 as uuidv4 } from "uuid";
import type { Snapshot } from "@manifesto-ai/core";
import { sha256, toCanonical } from "@manifesto-ai/core";
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

// ============================================================================
// Hash Computation (INV-W7)
// ============================================================================

/**
 * Compute snapshotHash excluding non-deterministic fields
 *
 * Include:
 * - snapshot.data (domain state)
 * - snapshot.system.status
 * - snapshot.system.lastError
 * - snapshot.system.errors
 * - snapshot.system.pendingRequirements
 *
 * Exclude:
 * - snapshot.meta.version (local counter)
 * - snapshot.meta.timestamp (non-deterministic)
 * - snapshot.meta.schemaHash (already in WorldId)
 * - snapshot.computed (derived, can be recomputed)
 * - snapshot.input (transient)
 */
export async function computeSnapshotHash(snapshot: Snapshot): Promise<string> {
  const hashInput = {
    data: snapshot.data,
    system: {
      status: snapshot.system.status,
      lastError: snapshot.system.lastError,
      errors: snapshot.system.errors,
      pendingRequirements: snapshot.system.pendingRequirements,
    },
  };
  return sha256(toCanonical(hashInput));
}

/**
 * Compute WorldId from schemaHash and snapshotHash
 *
 * worldId = hash(schemaHash + ':' + snapshotHash)
 */
export async function computeWorldId(
  schemaHash: string,
  snapshotHash: string
): Promise<WorldId> {
  const hash = await sha256(`${schemaHash}:${snapshotHash}`);
  return createWorldId(hash);
}

// ============================================================================
// Entity Factories
// ============================================================================

/**
 * Create a genesis World
 */
export async function createGenesisWorld(
  schemaHash: string,
  snapshot: Snapshot
): Promise<World> {
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
 */
export async function createWorldFromExecution(
  schemaHash: string,
  snapshot: Snapshot,
  proposalId: ProposalId
): Promise<World> {
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
 */
export function createProposal(
  actor: ActorRef,
  intent: IntentInstance,
  baseWorld: WorldId,
  trace?: ProposalTrace
): Proposal {
  return {
    proposalId: generateProposalId(),
    actor,
    intent,
    baseWorld,
    status: "submitted",
    trace,
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
