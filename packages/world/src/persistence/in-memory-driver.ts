import {
  InMemoryGovernanceStore,
} from "@manifesto-ai/governance";
import {
  InMemoryLineageStore,
} from "@manifesto-ai/lineage";
import { wrapSealTransactionError } from "../facade/internal/errors.js";
import type {
  GovernedWorldPersistenceDriver,
  GovernedWorldPersistenceTx,
} from "./types.js";

export interface InMemoryGovernedWorldPersistenceDriverState {
  readonly lineageState: ReturnType<InMemoryLineageStore["snapshotState"]>;
  readonly governanceState: ReturnType<InMemoryGovernanceStore["snapshotState"]>;
}

export class InMemoryGovernedWorldPersistenceDriver
  implements GovernedWorldPersistenceDriver
{
  public readonly lineage: InMemoryLineageStore;
  public readonly governance: InMemoryGovernanceStore;

  public constructor() {
    this.lineage = new InMemoryLineageStore();
    this.governance = new InMemoryGovernanceStore();
  }

  snapshotState(): InMemoryGovernedWorldPersistenceDriverState {
    return {
      lineageState: this.lineage.snapshotState(),
      governanceState: this.governance.snapshotState(),
    };
  }

  restoreState(state: InMemoryGovernedWorldPersistenceDriverState): void {
    this.lineage.restoreState(state.lineageState);
    this.governance.restoreState(state.governanceState);
  }

  async runInSealTransaction<T>(
    work: (tx: GovernedWorldPersistenceTx) => Promise<T>
  ): Promise<T> {
    const state = this.snapshotState();
    const tx: GovernedWorldPersistenceTx = {
      commitPrepared: async (prepared) => {
        await this.lineage.commitPrepared(prepared);
      },
      putProposal: async (proposal) => {
        await this.governance.putProposal(proposal);
      },
      putDecisionRecord: async (record) => {
        await this.governance.putDecisionRecord(record);
      },
    };

    try {
      return await work(tx);
    } catch (error) {
      this.restoreState(state);
      wrapSealTransactionError(error);
    }
  }
}

export function createInMemoryGovernedWorldPersistenceDriver(): InMemoryGovernedWorldPersistenceDriver {
  return new InMemoryGovernedWorldPersistenceDriver();
}
