import { assertLineage } from "./invariants.js";
import {
  computeBranchId,
  computeEdgeId,
  computeSnapshotHash,
  computeWorldId,
  createSnapshotHashInput,
  deriveTerminalStatus,
} from "./hash.js";
import type {
  ArtifactRef,
  BranchId,
  PersistedBranchEntry,
  ProvenanceRef,
  SealGenesisInput,
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
  createdAt: number,
  createdBy: ProvenanceRef | null,
  traceRef?: ArtifactRef
): WorldRecordResult {
  assertLineage(
    schemaHash === terminalSnapshot.meta.schemaHash,
    `LIN-SCHEMA-1 violation: provided schemaHash (${schemaHash}) does not match snapshot.meta.schemaHash (${terminalSnapshot.meta.schemaHash})`
  );

  const terminalStatus = deriveTerminalStatus(terminalSnapshot);
  const hashInput = createSnapshotHashInput(terminalSnapshot);
  const snapshotHash = computeSnapshotHash(terminalSnapshot);
  const worldId = computeWorldId(schemaHash, snapshotHash);

  return {
    worldId,
    hashInput,
    world: {
      worldId,
      schemaHash,
      snapshotHash,
      terminalStatus,
      createdAt,
      createdBy,
      executionTraceRef: traceRef,
    },
  };
}

export function createWorldEdge(
  from: WorldId,
  to: WorldId,
  createdAt: number,
  proposalRef?: ProvenanceRef,
  decisionRef?: ProvenanceRef
): WorldEdge {
  return {
    edgeId: computeEdgeId(from, to),
    from,
    to,
    proposalRef,
    decisionRef,
    createdAt,
  };
}

export function createGenesisBranchEntry(input: SealGenesisInput, worldId: WorldId): PersistedBranchEntry {
  const branchName = input.branchName ?? "main";
  const branchId: BranchId = computeBranchId(branchName, worldId);

  return {
    id: branchId,
    name: branchName,
    head: worldId,
    epoch: 0,
    schemaHash: input.schemaHash,
    createdAt: input.createdAt,
    parentBranch: undefined,
    lineage: [branchId],
  };
}
