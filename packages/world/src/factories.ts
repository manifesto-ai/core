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
 * Per World SPEC v2.0.2 (WORLD-HASH-*):
 * - computeSnapshotHash excludes $host namespace
 * - computeSnapshotHash normalizes terminalStatus
 * - computeSnapshotHash excludes error message/timestamp
 * - computeWorldId uses JCS object hash (not string concat)
 */
import { v4 as uuidv4 } from "uuid";
import type { Snapshot, ErrorValue, Requirement } from "@manifesto-ai/core";
import { sha256, toJcs } from "@manifesto-ai/core";
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
import type {
  ErrorSignature,
  TerminalStatusForHash,
  SnapshotHashInput,
  WorldIdInput,
} from "./types/index.js";

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
// Hash Computation (WORLD-HASH-*)
// ============================================================================

/**
 * Strip $host namespace from data
 *
 * Per WORLD-HASH-1:
 * - data.$host contains Host-managed state (intent slots, etc.)
 * - This is execution context, not semantic state
 * - MUST be excluded from snapshot hash
 */
function stripHostNamespace(
  data: Record<string, unknown>
): Record<string, unknown> {
  if (data === undefined || data === null) {
    return {};
  }
  if (!("$host" in data)) {
    return data as Record<string, unknown>;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $host, ...rest } = data;
  return rest;
}

/**
 * Derive terminal status for hashing
 *
 * Per WORLD-HASH-2:
 * - Normalize to 'completed' or 'failed'
 * - 'failed' if lastError exists or pendingRequirements non-empty
 * - 'completed' otherwise
 */
function deriveTerminalStatusForHash(snapshot: Snapshot): TerminalStatusForHash {
  if (snapshot.system.lastError != null) {
    return "failed";
  }
  if (snapshot.system.pendingRequirements.length > 0) {
    return "failed";
  }
  return "completed";
}

/**
 * Convert ErrorValue to ErrorSignature
 *
 * Per WORLD-HASH-3:
 * - Include: code, source
 * - Exclude: message (non-deterministic wording), timestamp, context
 */
function toErrorSignature(error: ErrorValue): ErrorSignature {
  return {
    code: error.code,
    source: {
      actionId: error.source.actionId,
      nodePath: error.source.nodePath,
    },
  };
}

/**
 * Sort error signatures by their hash
 *
 * Per WORLD-HASH-4:
 * - Sort for deterministic ordering
 * - Use hash of signature as sort key
 */
async function sortErrorSignatures(
  signatures: ErrorSignature[]
): Promise<ErrorSignature[]> {
  if (signatures.length <= 1) {
    return signatures;
  }

  // Compute hashes for all signatures
  const withHashes = await Promise.all(
    signatures.map(async (sig) => ({
      sig,
      hash: await sha256(toJcs(sig)),
    }))
  );

  // Sort by hash (ASCII hex comparison)
  withHashes.sort((a, b) => {
    if (a.hash < b.hash) {
      return -1;
    }
    if (a.hash > b.hash) {
      return 1;
    }
    return 0;
  });

  return withHashes.map((item) => item.sig);
}

/**
 * Compute digest of pending requirements
 *
 * Per WORLD-HASH-5:
 * - JCS hash of sorted pending requirement IDs
 * - Constant digest if no pending requirements
 */
async function computePendingDigest(
  pendingRequirements: readonly Requirement[]
): Promise<string> {
  if (pendingRequirements.length === 0) {
    return "empty";
  }
  const sortedIds = pendingRequirements.map((req) => req.id).sort();
  return sha256(toJcs({ pendingIds: sortedIds }));
}

/**
 * Build normalized SnapshotHashInput
 *
 * This applies all WORLD-HASH-* transformations.
 */
async function buildSnapshotHashInput(
  snapshot: Snapshot
): Promise<SnapshotHashInput> {
  // WORLD-HASH-1: Strip $host namespace
  const data = stripHostNamespace(snapshot.data as Record<string, unknown>);

  // WORLD-HASH-2: Derive terminal status
  const terminalStatus = deriveTerminalStatusForHash(snapshot);

  // WORLD-HASH-3 & WORLD-HASH-4: Convert and sort error signatures
  const errorValues = snapshot.system.errors ?? [];
  const rawSignatures = errorValues.map(toErrorSignature);
  const errors = await sortErrorSignatures(rawSignatures);

  // WORLD-HASH-5: Compute pending digest
  const pendingDigest = await computePendingDigest(
    snapshot.system.pendingRequirements ?? []
  );

  return {
    data,
    system: {
      terminalStatus,
      errors,
      pendingDigest,
    },
  };
}

/**
 * Compute snapshotHash per WORLD-HASH-* rules
 *
 * Per World SPEC v2.0.2:
 * - WORLD-HASH-1: Exclude $host namespace from data
 * - WORLD-HASH-2: Normalize terminalStatus to 'completed' | 'failed'
 * - WORLD-HASH-3: Error signatures exclude message and timestamp
 * - WORLD-HASH-4: Sort error signatures by their hash
 * - WORLD-HASH-5: Compute pendingDigest as JCS hash of pending requirement IDs
 *
 * Exclude (non-deterministic or derived):
 * - snapshot.meta.version (local counter)
 * - snapshot.meta.timestamp (non-deterministic)
 * - snapshot.meta.schemaHash (already in WorldId)
 * - snapshot.computed (derived, can be recomputed)
 * - snapshot.input (transient)
 */
export async function computeSnapshotHash(snapshot: Snapshot): Promise<string> {
  const hashInput = await buildSnapshotHashInput(snapshot);
  return sha256(toJcs(hashInput));
}

/**
 * Compute WorldId from schemaHash and snapshotHash
 *
 * Per WORLD-ID-*:
 * - worldId = computeHash(JCS({ schemaHash, snapshotHash }))
 * - Uses JCS object hash, NOT string concatenation
 */
export async function computeWorldId(
  schemaHash: string,
  snapshotHash: string
): Promise<WorldId> {
  const input: WorldIdInput = { schemaHash, snapshotHash };
  const hash = await sha256(toJcs(input));
  return createWorldId(hash);
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
export function createProposal(
  actor: ActorRef,
  intent: IntentInstance,
  baseWorld: WorldId,
  trace?: ProposalTrace,
  epoch = 0
): Proposal {
  return {
    proposalId: generateProposalId(),
    actor,
    intent,
    baseWorld,
    status: "submitted",
    epoch,
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
