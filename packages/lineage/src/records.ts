import { assertLineage } from "./invariants.js";
import {
  computeBranchId,
  computeEdgeId,
  computeHash,
  computeSnapshotHash,
  computeWorldId,
  createSnapshotHashInput,
  deriveTerminalStatus,
} from "./hash.js";
import type {
  BranchId,
  PersistedBranchEntry,
  SealAttempt,
  SealGenesisInput,
  SealNextInput,
  Snapshot,
  SnapshotHashInput,
  World,
  WorldEdge,
  WorldId,
} from "./types.js";

export interface WorldRecordResult {
  readonly world: World;
  readonly hashInput: SnapshotHashInput;
  readonly worldId: WorldId;
}

export function createWorldRecord(
  schemaHash: string,
  terminalSnapshot: Snapshot,
  parentWorldId: WorldId | null
): WorldRecordResult {
  assertLineage(
    schemaHash === terminalSnapshot.meta.schemaHash,
    `LIN-SCHEMA-1 violation: provided schemaHash (${schemaHash}) does not match snapshot.meta.schemaHash (${terminalSnapshot.meta.schemaHash})`
  );

  const terminalStatus = deriveTerminalStatus(terminalSnapshot);
  const hashInput = createSnapshotHashInput(terminalSnapshot);
  const snapshotHash = computeSnapshotHash(terminalSnapshot);
  const worldId = computeWorldId(schemaHash, snapshotHash, parentWorldId);

  return {
    worldId,
    hashInput,
    world: {
      worldId,
      schemaHash,
      snapshotHash,
      parentWorldId,
      terminalStatus,
    },
  };
}

export function createWorldEdge(from: WorldId, to: WorldId): WorldEdge {
  return {
    edgeId: computeEdgeId(from, to),
    from,
    to,
  };
}

export function createGenesisBranchEntry(input: SealGenesisInput, worldId: WorldId): PersistedBranchEntry {
  const branchName = input.branchName ?? "main";
  const branchId: BranchId = computeBranchId(branchName, worldId);

  return {
    id: branchId,
    name: branchName,
    head: worldId,
    tip: worldId,
    headAdvancedAt: input.createdAt,
    epoch: 0,
    schemaHash: input.schemaHash,
    createdAt: input.createdAt,
  };
}

export function createSealGenesisAttempt(
  branchId: BranchId,
  worldId: WorldId,
  input: SealGenesisInput
): SealAttempt {
  return {
    attemptId: computeHash({ worldId, branchId, createdAt: input.createdAt }),
    worldId,
    branchId,
    baseWorldId: null,
    parentWorldId: null,
    proposalRef: input.proposalRef,
    createdAt: input.createdAt,
    traceRef: input.traceRef,
    reused: false,
  };
}

export function createSealNextAttempt(
  branchId: BranchId,
  worldId: WorldId,
  parentWorldId: WorldId,
  input: SealNextInput
): SealAttempt {
  return {
    attemptId: computeHash({ worldId, branchId, createdAt: input.createdAt }),
    worldId,
    branchId,
    baseWorldId: input.baseWorldId,
    parentWorldId,
    proposalRef: input.proposalRef,
    decisionRef: input.decisionRef,
    createdAt: input.createdAt,
    traceRef: input.traceRef,
    patchDelta: input.patchDelta,
    reused: false,
  };
}
