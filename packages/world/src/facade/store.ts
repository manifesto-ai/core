import {
  type ActorAuthorityBinding,
  type ActorId,
  type BranchId,
  type DecisionId,
  type DecisionRecord,
  type GovernanceStore,
  type Proposal,
  type ProposalId,
} from "@manifesto-ai/governance";
import {
  type LineageStore,
  type PersistedBranchEntry,
  type PreparedBranchMutation,
  type SealAttempt,
  type Snapshot,
  type SnapshotHashInput,
  type World,
  type WorldEdge,
  type WorldId,
} from "@manifesto-ai/lineage";
import {
  InMemoryGovernedWorldPersistenceDriver,
} from "../persistence/in-memory-driver.js";
import {
  IndexedDbGovernedWorldPersistenceDriver,
  type IndexedDbGovernedWorldPersistenceDriverOptions,
} from "../persistence/indexeddb-driver.js";
import {
  SqliteGovernedWorldPersistenceDriver,
  type SqliteGovernedWorldPersistenceDriverOptions,
} from "../persistence/sqlite-driver.js";
import type {
  GovernedWorldPersistenceDriver,
} from "../persistence/types.js";
import type {
  GovernedWorldStore,
  WorldStoreTransaction,
} from "./types.js";

class DriverBackedGovernedWorldStore implements GovernedWorldStore {
  protected readonly driver: GovernedWorldPersistenceDriver;

  public constructor(driver: GovernedWorldPersistenceDriver) {
    this.driver = driver;
  }

  async putWorld(world: World): Promise<void> {
    await this.driver.lineage.putWorld(world);
  }

  async getWorld(worldId: WorldId): Promise<World | null> {
    return this.driver.lineage.getWorld(worldId);
  }

  async putSnapshot(worldId: WorldId, snapshot: Snapshot): Promise<void> {
    await this.driver.lineage.putSnapshot(worldId, snapshot);
  }

  async getSnapshot(worldId: WorldId): Promise<Snapshot | null> {
    return this.driver.lineage.getSnapshot(worldId);
  }

  async putAttempt(attempt: SealAttempt): Promise<void> {
    await this.driver.lineage.putAttempt(attempt);
  }

  async getAttempts(worldId: WorldId): Promise<readonly SealAttempt[]> {
    return this.driver.lineage.getAttempts(worldId);
  }

  async getAttemptsByBranch(branchId: BranchId): Promise<readonly SealAttempt[]> {
    return this.driver.lineage.getAttemptsByBranch(branchId);
  }

  async putHashInput(snapshotHash: string, input: SnapshotHashInput): Promise<void> {
    await this.driver.lineage.putHashInput?.(snapshotHash, input);
  }

  async getHashInput(snapshotHash: string): Promise<SnapshotHashInput | null> {
    return (await this.driver.lineage.getHashInput?.(snapshotHash)) ?? null;
  }

  async putEdge(edge: WorldEdge): Promise<void> {
    await this.driver.lineage.putEdge(edge);
  }

  async getEdges(worldId: WorldId): Promise<readonly WorldEdge[]> {
    return this.driver.lineage.getEdges(worldId);
  }

  async getBranchHead(branchId: BranchId): Promise<WorldId | null> {
    return this.driver.lineage.getBranchHead(branchId);
  }

  async getBranchTip(branchId: BranchId): Promise<WorldId | null> {
    return this.driver.lineage.getBranchTip(branchId);
  }

  async getBranchEpoch(branchId: BranchId): Promise<number> {
    return this.driver.lineage.getBranchEpoch(branchId);
  }

  async mutateBranch(mutation: PreparedBranchMutation): Promise<void> {
    await this.driver.lineage.mutateBranch(mutation);
  }

  async putBranch(branch: PersistedBranchEntry): Promise<void> {
    await this.driver.lineage.putBranch(branch);
  }

  async getBranches(): Promise<readonly PersistedBranchEntry[]> {
    return this.driver.lineage.getBranches();
  }

  async getActiveBranchId(): Promise<BranchId | null> {
    return this.driver.lineage.getActiveBranchId();
  }

  async switchActiveBranch(
    sourceBranchId: BranchId,
    targetBranchId: BranchId
  ): Promise<void> {
    await this.driver.lineage.switchActiveBranch(sourceBranchId, targetBranchId);
  }

  async commitPrepared(
    prepared: Parameters<LineageStore["commitPrepared"]>[0]
  ): Promise<void> {
    await this.driver.lineage.commitPrepared(prepared);
  }

  async putProposal(proposal: Proposal): Promise<void> {
    await this.driver.governance.putProposal(proposal);
  }

  async getProposal(proposalId: ProposalId): Promise<Proposal | null> {
    return this.driver.governance.getProposal(proposalId);
  }

  async getProposalsByBranch(branchId: BranchId): Promise<readonly Proposal[]> {
    return this.driver.governance.getProposalsByBranch(branchId);
  }

  async getExecutionStageProposal(branchId: BranchId): Promise<Proposal | null> {
    return this.driver.governance.getExecutionStageProposal(branchId);
  }

  async putDecisionRecord(record: DecisionRecord): Promise<void> {
    await this.driver.governance.putDecisionRecord(record);
  }

  async getDecisionRecord(decisionId: DecisionId): Promise<DecisionRecord | null> {
    return this.driver.governance.getDecisionRecord(decisionId);
  }

  async putActorBinding(binding: ActorAuthorityBinding): Promise<void> {
    await this.driver.governance.putActorBinding(binding);
  }

  async getActorBinding(actorId: ActorId): Promise<ActorAuthorityBinding | null> {
    return this.driver.governance.getActorBinding(actorId);
  }

  async getActorBindings(): Promise<readonly ActorAuthorityBinding[]> {
    return this.driver.governance.getActorBindings();
  }

  async runInSealTransaction<T>(
    work: (tx: WorldStoreTransaction) => Promise<T>
  ): Promise<T> {
    return this.driver.runInSealTransaction(work);
  }
}

export class InMemoryGovernedWorldStore extends DriverBackedGovernedWorldStore {
  public constructor() {
    super(new InMemoryGovernedWorldPersistenceDriver());
  }
}

export interface IndexedDbWorldStoreOptions
  extends IndexedDbGovernedWorldPersistenceDriverOptions {}

export class IndexedDbGovernedWorldStore extends DriverBackedGovernedWorldStore {
  private readonly indexedDbDriver: IndexedDbGovernedWorldPersistenceDriver;

  public constructor(options?: IndexedDbWorldStoreOptions) {
    const indexedDbDriver = new IndexedDbGovernedWorldPersistenceDriver(options);
    super(indexedDbDriver);
    this.indexedDbDriver = indexedDbDriver;
  }

  public async close(): Promise<void> {
    await this.indexedDbDriver.close();
  }
}

export interface SqliteWorldStoreOptions
  extends SqliteGovernedWorldPersistenceDriverOptions {}

export class SqliteGovernedWorldStore extends DriverBackedGovernedWorldStore {
  private readonly sqliteDriver: SqliteGovernedWorldPersistenceDriver;

  public constructor(options?: SqliteWorldStoreOptions) {
    const sqliteDriver = new SqliteGovernedWorldPersistenceDriver(options);
    super(sqliteDriver);
    this.sqliteDriver = sqliteDriver;
  }

  public close(): void {
    this.sqliteDriver.close();
  }
}

export function createInMemoryWorldStore(): GovernedWorldStore {
  return new InMemoryGovernedWorldStore();
}

export function createIndexedDbWorldStore(
  options?: IndexedDbWorldStoreOptions
): IndexedDbGovernedWorldStore {
  return new IndexedDbGovernedWorldStore(options);
}

export function createSqliteWorldStore(
  options?: SqliteWorldStoreOptions
): SqliteGovernedWorldStore {
  return new SqliteGovernedWorldStore(options);
}
