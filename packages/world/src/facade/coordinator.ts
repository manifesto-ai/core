import type {
  GovernanceService,
  PreparedGovernanceCommit,
  PreparedLineageCommit,
} from "@manifesto-ai/governance";
import type { LineageService } from "@manifesto-ai/lineage";
import {
  isFacadeCasMismatchError,
} from "./internal/errors.js";
import type {
  CommitCapableWorldStore,
  CoordinatorSealGenesisParams,
  CoordinatorSealNextParams,
  GovernanceEventDispatcher,
  SealResult,
  WorldCoordinator,
  WriteSet,
} from "./types.js";

const MAX_CAS_RETRIES = 3;

export interface DefaultWorldCoordinatorOptions {
  readonly store: CommitCapableWorldStore;
  readonly lineage: LineageService;
  readonly governance: GovernanceService;
  readonly eventDispatcher: GovernanceEventDispatcher;
}

function toWriteSet(
  lineageCommit: PreparedLineageCommit,
  governanceCommit: PreparedGovernanceCommit
): WriteSet {
  return {
    lineage: lineageCommit,
    governance: governanceCommit,
  };
}

export class DefaultWorldCoordinator implements WorldCoordinator {
  public constructor(private readonly options: DefaultWorldCoordinatorOptions) {}

  sealNext(params: CoordinatorSealNextParams): SealResult {
    for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt += 1) {
      try {
        const lineageCommit = this.options.lineage.prepareSealNext(params.sealInput);
        const governanceCommit = this.options.governance.finalize(
          params.executingProposal,
          lineageCommit,
          params.completedAt
        );
        this.options.store.commitSeal(toWriteSet(lineageCommit, governanceCommit));
        this.options.eventDispatcher.emitSealCompleted(governanceCommit, lineageCommit);

        return {
          kind: "sealed",
          worldId: lineageCommit.worldId,
          terminalStatus: lineageCommit.terminalStatus,
        };
      } catch (error) {
        if (isFacadeCasMismatchError(error) && attempt < MAX_CAS_RETRIES - 1) {
          continue;
        }

        throw error;
      }
    }

    throw new Error("FACADE-COORD-10 violation: sealNext exceeded bounded retry limit");
  }

  sealGenesis(params: CoordinatorSealGenesisParams): SealResult {
    if (params.kind === "standalone") {
      const lineageCommit = this.options.lineage.prepareSealGenesis(params.sealInput);
      this.options.lineage.commitPrepared(lineageCommit);
      return {
        kind: "sealed",
        worldId: lineageCommit.worldId,
        terminalStatus: lineageCommit.terminalStatus,
      };
    }

    const lineageCommit = this.options.lineage.prepareSealGenesis(params.sealInput);
    const governanceCommit = this.options.governance.finalize(
      params.executingProposal,
      lineageCommit,
      params.completedAt
    );
    this.options.store.commitSeal(toWriteSet(lineageCommit, governanceCommit));
    this.options.eventDispatcher.emitSealCompleted(governanceCommit, lineageCommit);

    return {
      kind: "sealed",
      worldId: lineageCommit.worldId,
      terminalStatus: lineageCommit.terminalStatus,
    };
  }
}

export function createWorldCoordinator(
  options: DefaultWorldCoordinatorOptions
): WorldCoordinator {
  return new DefaultWorldCoordinator(options);
}
