import type {
  PreparedGovernanceCommit,
  GovernanceService,
} from "@manifesto-ai/governance";
import type {
  LineageService,
  PreparedLineageCommit,
} from "@manifesto-ai/lineage";
import {
  FacadeCasMismatchError,
  isFacadeCasMismatchError,
} from "./internal/errors.js";
import type {
  CoordinatorSealGenesisParams,
  CoordinatorSealNextParams,
  GovernedWorldStore,
  GovernanceEventDispatcher,
  SealResult,
  WorldCoordinator,
} from "./types.js";

const MAX_CAS_RETRIES = 3;

function isLineageSealBaseMismatchError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("LIN-BRANCH-SEAL-2 violation");
}

export interface DefaultWorldCoordinatorOptions {
  readonly store: GovernedWorldStore;
  readonly lineage: LineageService;
  readonly governance: GovernanceService;
  readonly eventDispatcher: GovernanceEventDispatcher;
}

export interface GovernedSealCompletion {
  readonly lineageCommit: PreparedLineageCommit;
  readonly governanceCommit: PreparedGovernanceCommit;
  readonly sealResult: SealResult;
}

export function sealGovernedNext(
  options: DefaultWorldCoordinatorOptions,
  params: CoordinatorSealNextParams
): Promise<GovernedSealCompletion> {
  return sealGovernedNextAsync(options, params);
}

async function sealGovernedNextAsync(
  options: DefaultWorldCoordinatorOptions,
  params: CoordinatorSealNextParams
): Promise<GovernedSealCompletion> {
  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt += 1) {
    try {
      const lineageCommit = await options.lineage.prepareSealNext(params.sealInput);
      const governanceCommit = await options.governance.finalize(
        params.executingProposal,
        lineageCommit,
        params.completedAt
      );
      await options.store.runInSealTransaction(async (tx) => {
        await tx.commitPrepared(lineageCommit);
        await tx.putProposal(governanceCommit.proposal);
        await tx.putDecisionRecord(governanceCommit.decisionRecord);
      });
      options.eventDispatcher.emitSealCompleted(governanceCommit, lineageCommit);

      return {
        lineageCommit,
        governanceCommit,
        sealResult: {
          kind: "sealed",
          worldId: lineageCommit.worldId,
          terminalStatus: lineageCommit.terminalStatus,
        },
      };
    } catch (error) {
      if (isFacadeCasMismatchError(error)) {
        if (attempt < MAX_CAS_RETRIES - 1) {
          continue;
        }
      }

      if (isLineageSealBaseMismatchError(error)) {
        throw new FacadeCasMismatchError(
          "FACADE-COORD-9 violation: branch head advanced after a competing seal won the CAS race",
          error
        );
      }

      throw error;
    }
  }

  throw new Error("FACADE-COORD-10 violation: sealNext exceeded bounded retry limit");
}

export class DefaultWorldCoordinator implements WorldCoordinator {
  public constructor(private readonly options: DefaultWorldCoordinatorOptions) {}

  async sealNext(params: CoordinatorSealNextParams): Promise<SealResult> {
    return (await sealGovernedNext(this.options, params)).sealResult;
  }

  async sealGenesis(params: CoordinatorSealGenesisParams): Promise<SealResult> {
    if (params.kind === "standalone") {
      const lineageCommit = await this.options.lineage.prepareSealGenesis(params.sealInput);
      await this.options.lineage.commitPrepared(lineageCommit);
      return {
        kind: "sealed",
        worldId: lineageCommit.worldId,
        terminalStatus: lineageCommit.terminalStatus,
      };
    }

    const lineageCommit = await this.options.lineage.prepareSealGenesis(params.sealInput);
    const governanceCommit = await this.options.governance.finalize(
      params.executingProposal,
      lineageCommit,
      params.completedAt
    );
    await this.options.store.runInSealTransaction(async (tx) => {
      await tx.commitPrepared(lineageCommit);
      await tx.putProposal(governanceCommit.proposal);
      await tx.putDecisionRecord(governanceCommit.decisionRecord);
    });
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
