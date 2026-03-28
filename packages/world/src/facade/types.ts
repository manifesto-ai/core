import type {
  GovernanceService,
  GovernanceStore,
  PreparedGovernanceCommit,
  Proposal,
  SealRejectionReason,
} from "@manifesto-ai/governance";
import type {
  LineageService,
  LineageStore,
  PreparedLineageCommit,
  SealGenesisInput,
  SealNextInput,
  TerminalStatus,
  WorldId,
} from "@manifesto-ai/lineage";

export interface CommitCapableWorldStore extends LineageStore, GovernanceStore {
  commitSeal(writeSet: WriteSet): void;
}

export type WriteSet =
  | {
      readonly kind: "full";
      readonly lineage: PreparedLineageCommit;
      readonly governance: PreparedGovernanceCommit;
    }
  | {
      readonly kind: "govOnly";
      readonly governance: PreparedGovernanceCommit;
    };

export interface GovernanceEventDispatcher {
  emitSealCompleted(
    governanceCommit: PreparedGovernanceCommit,
    lineageCommit: PreparedLineageCommit
  ): void;

  emitSealRejected(
    governanceCommit: PreparedGovernanceCommit,
    rejection: SealRejectionReason
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

export type SealResult =
  | {
      readonly kind: "sealed";
      readonly worldId: WorldId;
      readonly terminalStatus: TerminalStatus;
    }
  | {
      readonly kind: "sealRejected";
      readonly rejection: SealRejectionReason;
    };

export interface WorldCoordinator {
  sealNext(params: CoordinatorSealNextParams): SealResult;
  sealGenesis(params: CoordinatorSealGenesisParams): SealResult;
}

export interface WorldConfig {
  readonly store: CommitCapableWorldStore;
  readonly lineage: LineageService;
  readonly governance: GovernanceService;
  readonly eventDispatcher: GovernanceEventDispatcher;
}

export interface WorldInstance {
  readonly coordinator: WorldCoordinator;
  readonly lineage: LineageService;
  readonly governance: GovernanceService;
  readonly store: CommitCapableWorldStore;
}
