import type {
  GovernanceService,
  PreparedGovernanceCommit,
  PreparedLineageCommit,
} from "@manifesto-ai/governance";
import type { LineageService } from "@manifesto-ai/lineage";
import {
  isFacadeCasMismatchError,
  toSealRejectionReason,
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
  if (!governanceCommit.hasLineageRecords) {
    throw new Error("FACADE-WS-2 violation: full write set requires governance.hasLineageRecords=true");
  }

  return {
    kind: "full",
    lineage: lineageCommit,
    governance: governanceCommit,
  };
}

function toGovOnlyWriteSet(governanceCommit: PreparedGovernanceCommit): WriteSet {
  if (governanceCommit.hasLineageRecords) {
    throw new Error("FACADE-WS-3 violation: govOnly write set requires governance.hasLineageRecords=false");
  }

  return {
    kind: "govOnly",
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
        const rejection = toSealRejectionReason(error);
        if (rejection) {
          const governanceCommit = this.options.governance.finalizeOnSealRejection(
            params.executingProposal,
            rejection,
            params.completedAt
          );
          this.options.store.commitSeal(toGovOnlyWriteSet(governanceCommit));
          this.options.eventDispatcher.emitSealRejected(governanceCommit, rejection);
          return {
            kind: "sealRejected",
            rejection,
          };
        }

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
