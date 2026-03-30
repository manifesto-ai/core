import type { Patch, Snapshot } from "@manifesto-ai/core";

export type { Patch, Snapshot } from "@manifesto-ai/core";

export type WorldId = string;
export type BranchId = string;
export type SchemaHash = string;
export type ProvenanceRef = string;
export type AttemptId = string;

export interface ArtifactRef {
  readonly uri: string;
  readonly hash: string;
}

export type TerminalStatus = "completed" | "failed";

export interface CurrentErrorSignature {
  readonly code: string;
  readonly source: {
    readonly actionId: string;
    readonly nodePath: string;
  };
}

export interface SnapshotHashInput {
  readonly data: Record<string, unknown>;
  readonly system: {
    readonly terminalStatus: TerminalStatus;
    readonly currentError: CurrentErrorSignature | null;
    readonly pendingDigest: string;
  };
}

export interface World {
  readonly worldId: WorldId;
  readonly schemaHash: SchemaHash;
  readonly snapshotHash: string;
  readonly parentWorldId: WorldId | null;
  readonly terminalStatus: TerminalStatus;
}

export interface WorldEdge {
  readonly edgeId: string;
  readonly from: WorldId;
  readonly to: WorldId;
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
  readonly tip: WorldId;
  readonly headAdvancedAt: number;
  readonly epoch: number;
  readonly schemaHash: SchemaHash;
  readonly createdAt: number;
}

export interface PersistedBranchEntry {
  readonly id: BranchId;
  readonly name: string;
  readonly head: WorldId;
  readonly tip: WorldId;
  readonly headAdvancedAt: number;
  readonly epoch: number;
  readonly schemaHash: SchemaHash;
  readonly createdAt: number;
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
  readonly expectedTip: WorldId;
  readonly nextTip: WorldId;
  readonly headAdvancedAt: number | null;
  readonly expectedEpoch: number;
  readonly nextEpoch: number;
}

export interface PreparedBranchBootstrap {
  readonly kind: "bootstrap";
  readonly branch: PersistedBranchEntry;
  readonly activeBranchId: BranchId;
}

export type PreparedBranchChange = PreparedBranchMutation | PreparedBranchBootstrap;

export interface SealAttempt {
  readonly attemptId: AttemptId;
  readonly worldId: WorldId;
  readonly branchId: BranchId;
  readonly baseWorldId: WorldId | null;
  readonly parentWorldId: WorldId | null;
  readonly proposalRef?: ProvenanceRef;
  readonly decisionRef?: ProvenanceRef;
  readonly createdAt: number;
  readonly traceRef?: ArtifactRef;
  readonly patchDelta?: PersistedPatchDeltaV2;
  readonly reused: boolean;
}

export interface PreparedLineageRecords {
  readonly worldId: WorldId;
  readonly world: World;
  readonly terminalSnapshot: Snapshot;
  readonly hashInput: SnapshotHashInput;
  readonly attempt: SealAttempt;
}

export interface PreparedGenesisCommit extends PreparedLineageRecords {
  readonly kind: "genesis";
  readonly branchId: BranchId;
  readonly terminalStatus: "completed";
  readonly edge: null;
  readonly branchChange: PreparedBranchBootstrap;
}

export interface PreparedNextCommit extends PreparedLineageRecords {
  readonly kind: "next";
  readonly branchId: BranchId;
  readonly terminalStatus: TerminalStatus;
  readonly edge: WorldEdge;
  readonly forkCreated: boolean;
  readonly branchChange: PreparedBranchMutation;
}

export type PreparedLineageCommit = PreparedGenesisCommit | PreparedNextCommit;

export interface LineageStore {
  putWorld(world: World): Promise<void>;
  getWorld(worldId: WorldId): Promise<World | null>;
  putSnapshot(worldId: WorldId, snapshot: Snapshot): Promise<void>;
  getSnapshot(worldId: WorldId): Promise<Snapshot | null>;
  putAttempt(attempt: SealAttempt): Promise<void>;
  getAttempts(worldId: WorldId): Promise<readonly SealAttempt[]>;
  getAttemptsByBranch(branchId: BranchId): Promise<readonly SealAttempt[]>;
  putHashInput?(snapshotHash: string, input: SnapshotHashInput): Promise<void>;
  getHashInput?(snapshotHash: string): Promise<SnapshotHashInput | null>;
  putEdge(edge: WorldEdge): Promise<void>;
  getEdges(worldId: WorldId): Promise<readonly WorldEdge[]>;
  getBranchHead(branchId: BranchId): Promise<WorldId | null>;
  getBranchTip(branchId: BranchId): Promise<WorldId | null>;
  getBranchEpoch(branchId: BranchId): Promise<number>;
  mutateBranch(mutation: PreparedBranchMutation): Promise<void>;
  putBranch(branch: PersistedBranchEntry): Promise<void>;
  getBranches(): Promise<readonly PersistedBranchEntry[]>;
  getActiveBranchId(): Promise<BranchId | null>;
  switchActiveBranch(sourceBranchId: BranchId, targetBranchId: BranchId): Promise<void>;
  commitPrepared(prepared: PreparedLineageCommit): Promise<void>;
}

export interface LineageService {
  prepareSealGenesis(input: SealGenesisInput): Promise<PreparedGenesisCommit>;
  prepareSealNext(input: SealNextInput): Promise<PreparedNextCommit>;
  commitPrepared(prepared: PreparedLineageCommit): Promise<void>;
  createBranch(name: string, headWorldId: WorldId): Promise<BranchId>;
  getBranch(branchId: BranchId): Promise<BranchInfo | null>;
  getBranches(): Promise<readonly BranchInfo[]>;
  getActiveBranch(): Promise<BranchInfo>;
  switchActiveBranch(targetBranchId: BranchId): Promise<BranchSwitchResult>;
  getWorld(worldId: WorldId): Promise<World | null>;
  getSnapshot(worldId: WorldId): Promise<Snapshot | null>;
  getAttempts(worldId: WorldId): Promise<readonly SealAttempt[]>;
  getAttemptsByBranch(branchId: BranchId): Promise<readonly SealAttempt[]>;
  getLineage(): Promise<WorldLineage>;
  getHeads(): Promise<readonly WorldHead[]>;
  getLatestHead(): Promise<WorldHead | null>;
  restore(worldId: WorldId): Promise<Snapshot>;
}
