import type {
  DecisionRecord,
  ExecutionKey,
  GovernanceService,
  GovernanceStore,
  Intent,
  PreparedGovernanceCommit,
  Proposal,
} from "@manifesto-ai/governance";
import type {
  ArtifactRef,
  LineageService,
  LineageStore,
  PreparedLineageCommit,
  SealGenesisInput,
  SealNextInput,
  Snapshot,
  TerminalStatus,
  WorldId,
} from "@manifesto-ai/lineage";

export interface WorldStoreTransaction {
  commitPrepared(prepared: PreparedLineageCommit): Promise<void>;
  putProposal(proposal: Proposal): Promise<void>;
  putDecisionRecord(record: DecisionRecord): Promise<void>;
}

export interface GovernedWorldStore extends LineageStore, GovernanceStore {
  runInSealTransaction<T>(work: (tx: WorldStoreTransaction) => Promise<T>): Promise<T>;
}

export interface WorldExecutionOptions {
  readonly approvedScope?: unknown;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export interface WorldExecutionResult {
  readonly outcome: "completed" | "failed";
  readonly terminalSnapshot: Snapshot;
  readonly traceRef?: ArtifactRef;
  readonly error?: NonNullable<Snapshot["system"]["lastError"]>;
}

export interface WorldExecutor {
  execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: Intent,
    opts?: WorldExecutionOptions
  ): Promise<WorldExecutionResult>;

  abort?(key: ExecutionKey): void;
}

export interface ExecuteApprovedProposalInput {
  readonly proposal: Proposal;
  readonly completedAt: number;
  readonly executionOptions?: WorldExecutionOptions;
}

export interface ResumeExecutingProposalInput {
  readonly proposal: Proposal;
  readonly resumeSnapshot: Snapshot;
  readonly completedAt: number;
  readonly executionOptions?: WorldExecutionOptions;
}

export interface SealedWorldRuntimeCompletion {
  readonly kind: "sealed";
  readonly proposal: Proposal;
  readonly execution: WorldExecutionResult;
  readonly resultWorld: WorldId;
  readonly terminalStatus: TerminalStatus;
  readonly lineageCommit: PreparedLineageCommit;
  readonly governanceCommit: PreparedGovernanceCommit;
  readonly sealResult: SealResult;
}

export interface RecoveredWorldRuntimeCompletion {
  readonly kind: "recovered";
  readonly proposal: Proposal;
  readonly execution: WorldExecutionResult;
  readonly resultWorld: WorldId;
  readonly terminalStatus: TerminalStatus;
}

export type WorldRuntimeCompletion =
  | SealedWorldRuntimeCompletion
  | RecoveredWorldRuntimeCompletion;

export interface WorldRuntime {
  executeApprovedProposal(
    input: ExecuteApprovedProposalInput
  ): Promise<WorldRuntimeCompletion>;
  resumeExecutingProposal(
    input: ResumeExecutingProposalInput
  ): Promise<WorldRuntimeCompletion>;
}

export interface GovernanceEventDispatcher {
  emitSealCompleted(
    governanceCommit: PreparedGovernanceCommit,
    lineageCommit: PreparedLineageCommit
  ): void;
}

export interface CoordinatorSealNextParams {
  readonly executingProposal: Proposal;
  readonly sealInput: SealNextInput;
  readonly completedAt: number;
}

export type CoordinatorSealGenesisParams =
  | {
      readonly kind: "governed";
      readonly sealInput: SealGenesisInput;
      readonly executingProposal: Proposal;
      readonly completedAt: number;
    }
  | {
      readonly kind: "standalone";
      readonly sealInput: SealGenesisInput;
    };

export interface SealResult {
  readonly kind: "sealed";
  readonly worldId: WorldId;
  readonly terminalStatus: TerminalStatus;
}

export interface WorldCoordinator {
  sealNext(params: CoordinatorSealNextParams): Promise<SealResult>;
  sealGenesis(params: CoordinatorSealGenesisParams): Promise<SealResult>;
}

export interface WorldConfig {
  readonly store: GovernedWorldStore;
  readonly lineage: LineageService;
  readonly governance: GovernanceService;
  readonly eventDispatcher: GovernanceEventDispatcher;
  readonly executor: WorldExecutor;
}

export interface WorldInstance {
  readonly coordinator: WorldCoordinator;
  readonly runtime: WorldRuntime;
  readonly lineage: LineageService;
  readonly governance: GovernanceService;
  readonly store: GovernedWorldStore;
}
