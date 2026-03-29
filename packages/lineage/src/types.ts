import type { Patch, Snapshot } from "@manifesto-ai/core";

export type { Patch, Snapshot } from "@manifesto-ai/core";

export type WorldId = string;
export type BranchId = string;
export type SchemaHash = string;
export type ProvenanceRef = string;

export interface ArtifactRef {
  readonly uri: string;
  readonly hash: string;
}

export type TerminalStatus = "completed" | "failed";

export interface ErrorSignature {
  readonly code: string;
  readonly source: {
    readonly actionId: string;
    readonly nodePath: string;
  };
  readonly context?: Record<string, unknown>;
}

export interface SnapshotHashInput {
  readonly data: Record<string, unknown>;
  readonly system: {
    readonly terminalStatus: TerminalStatus;
    readonly errors: readonly ErrorSignature[];
    readonly pendingDigest: string;
  };
}

export interface World {
  readonly worldId: WorldId;
  readonly schemaHash: SchemaHash;
  readonly snapshotHash: string;
  readonly terminalStatus: TerminalStatus;
  readonly createdAt: number;
  readonly createdBy: ProvenanceRef | null;
  readonly executionTraceRef?: ArtifactRef;
}

export interface WorldEdge {
  readonly edgeId: string;
  readonly from: WorldId;
  readonly to: WorldId;
  readonly proposalRef?: ProvenanceRef;
  readonly decisionRef?: ProvenanceRef;
  readonly createdAt: number;
}

export interface WorldLineage {
  readonly genesis: WorldId;
  readonly worlds: ReadonlyMap<WorldId, World>;
  readonly edges: ReadonlyMap<string, WorldEdge>;
}

export interface PersistedPatchDeltaV2 {
  readonly _patchFormat: 2;
  readonly patches: readonly Patch[];
}

export interface SealGenesisInput {
  readonly schemaHash: SchemaHash;
  readonly terminalSnapshot: Snapshot;
  readonly createdAt: number;
  readonly branchName?: string;
  readonly proposalRef?: ProvenanceRef;
  readonly traceRef?: ArtifactRef;
}

export interface SealNextInput {
  readonly schemaHash: SchemaHash;
  readonly baseWorldId: WorldId;
  readonly branchId: BranchId;
  readonly terminalSnapshot: Snapshot;
  readonly createdAt: number;
  readonly patchDelta?: PersistedPatchDeltaV2;
  readonly proposalRef?: ProvenanceRef;
  readonly decisionRef?: ProvenanceRef;
  readonly traceRef?: ArtifactRef;
}

export interface BranchInfo {
  readonly id: BranchId;
  readonly name: string;
  readonly head: WorldId;
  readonly epoch: number;
  readonly schemaHash: SchemaHash;
  readonly createdAt: number;
}

export interface PersistedBranchEntry {
  readonly id: BranchId;
  readonly name: string;
  readonly head: WorldId;
  readonly epoch: number;
  readonly schemaHash: SchemaHash;
  readonly createdAt: number;
  readonly parentBranch?: BranchId;
  readonly lineage: readonly string[];
}

export interface PersistedBranchState {
  readonly branches: readonly PersistedBranchEntry[];
  readonly activeBranchId: BranchId;
}

export interface WorldHead {
  readonly worldId: WorldId;
  readonly branchId: BranchId;
  readonly branchName: string;
  readonly createdAt: number;
  readonly schemaHash: SchemaHash;
}

export interface BranchSwitchResult {
  readonly previousBranchId: BranchId;
  readonly targetBranchId: BranchId;
  readonly sourceBranchEpochAfter: number;
}

export interface PreparedBranchMutation {
  readonly kind: "advance";
  readonly branchId: BranchId;
  readonly expectedHead: WorldId;
  readonly nextHead: WorldId;
  readonly headAdvanced: boolean;
  readonly expectedEpoch: number;
  readonly nextEpoch: number;
}

export interface PreparedBranchBootstrap {
  readonly kind: "bootstrap";
  readonly branch: PersistedBranchEntry;
  readonly activeBranchId: BranchId;
}

export type PreparedBranchChange = PreparedBranchMutation | PreparedBranchBootstrap;

export interface PreparedLineageRecords {
  readonly worldId: WorldId;
  readonly world: World;
  readonly terminalSnapshot: Snapshot;
  readonly hashInput: SnapshotHashInput;
}

export interface PreparedGenesisCommit extends PreparedLineageRecords {
  readonly kind: "genesis";
  readonly branchId: BranchId;
  readonly terminalStatus: "completed";
  readonly edge: null;
  readonly patchDelta: null;
  readonly branchChange: PreparedBranchBootstrap;
}

export interface PreparedNextCommit extends PreparedLineageRecords {
  readonly kind: "next";
  readonly branchId: BranchId;
  readonly terminalStatus: TerminalStatus;
  readonly edge: WorldEdge;
  readonly patchDelta: PersistedPatchDeltaV2 | null;
  readonly forkCreated: boolean;
  readonly branchChange: PreparedBranchMutation;
}

export type PreparedLineageCommit = PreparedGenesisCommit | PreparedNextCommit;

export interface LineageStore {
  putWorld(world: World): void;
  getWorld(worldId: WorldId): World | null;
  putSnapshot(worldId: WorldId, snapshot: Snapshot): void;
  getSnapshot(worldId: WorldId): Snapshot | null;
  putPatchDelta(from: WorldId, to: WorldId, delta: PersistedPatchDeltaV2): void;
  getPatchDelta(from: WorldId, to: WorldId): PersistedPatchDeltaV2 | null;
  putHashInput?(snapshotHash: string, input: SnapshotHashInput): void;
  getHashInput?(snapshotHash: string): SnapshotHashInput | null;
  putEdge(edge: WorldEdge): void;
  getEdges(worldId: WorldId): readonly WorldEdge[];
  getBranchHead(branchId: BranchId): WorldId | null;
  getBranchEpoch(branchId: BranchId): number;
  mutateBranch(mutation: PreparedBranchMutation): void;
  putBranch(branch: PersistedBranchEntry): void;
  getBranches(): readonly PersistedBranchEntry[];
  getActiveBranchId(): BranchId | null;
  switchActiveBranch(sourceBranchId: BranchId, targetBranchId: BranchId): void;
  commitPrepared(prepared: PreparedLineageCommit): void;
}

export interface LineageService {
  prepareSealGenesis(input: SealGenesisInput): PreparedGenesisCommit;
  prepareSealNext(input: SealNextInput): PreparedNextCommit;
  commitPrepared(prepared: PreparedLineageCommit): void;
  createBranch(name: string, headWorldId: WorldId): BranchId;
  getBranch(branchId: BranchId): BranchInfo | null;
  getBranches(): readonly BranchInfo[];
  getActiveBranch(): BranchInfo;
  switchActiveBranch(targetBranchId: BranchId): BranchSwitchResult;
  getWorld(worldId: WorldId): World | null;
  getSnapshot(worldId: WorldId): Snapshot | null;
  getLineage(): WorldLineage;
  getHeads(): readonly WorldHead[];
  getLatestHead(): WorldHead | null;
  restore(worldId: WorldId): Snapshot;
}
