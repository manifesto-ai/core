import type {
  DecisionRecord,
  GovernanceStore,
  Proposal,
} from "@manifesto-ai/governance";
import type {
  LineageStore,
  PreparedLineageCommit,
} from "@manifesto-ai/lineage";

export interface GovernedWorldPersistenceTx {
  commitPrepared(prepared: PreparedLineageCommit): Promise<void>;
  putProposal(proposal: Proposal): Promise<void>;
  putDecisionRecord(record: DecisionRecord): Promise<void>;
}

export interface GovernedWorldPersistenceDriver {
  readonly lineage: LineageStore;
  readonly governance: GovernanceStore;
  runInSealTransaction<T>(work: (tx: GovernedWorldPersistenceTx) => Promise<T>): Promise<T>;
}
