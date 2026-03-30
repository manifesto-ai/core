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
import type {
  GovernedWorldPersistenceDriver,
} from "../persistence/types.js";
import type {
  GovernedWorldStore,
  WorldStoreTransaction,
} from "./types.js";

class DriverBackedGovernedWorldStore implements GovernedWorldStore {
  private readonly driverPromise: Promise<GovernedWorldPersistenceDriver>;

  public constructor(
    driver: GovernedWorldPersistenceDriver | Promise<GovernedWorldPersistenceDriver>
  ) {
    this.driverPromise = Promise.resolve(driver);
  }

  protected async resolveDriver(): Promise<GovernedWorldPersistenceDriver> {
    return this.driverPromise;
  }

  async putWorld(world: World): Promise<void> {
    const driver = await this.resolveDriver();
    await driver.lineage.putWorld(world);
  }

  async getWorld(worldId: WorldId): Promise<World | null> {
    const driver = await this.resolveDriver();
    return driver.lineage.getWorld(worldId);
  }

  async putSnapshot(worldId: WorldId, snapshot: Snapshot): Promise<void> {
    const driver = await this.resolveDriver();
    await driver.lineage.putSnapshot(worldId, snapshot);
  }

  async getSnapshot(worldId: WorldId): Promise<Snapshot | null> {
    const driver = await this.resolveDriver();
    return driver.lineage.getSnapshot(worldId);
  }

  async putAttempt(attempt: SealAttempt): Promise<void> {
    const driver = await this.resolveDriver();
    await driver.lineage.putAttempt(attempt);
  }

  async getAttempts(worldId: WorldId): Promise<readonly SealAttempt[]> {
    const driver = await this.resolveDriver();
    return driver.lineage.getAttempts(worldId);
  }

  async getAttemptsByBranch(branchId: BranchId): Promise<readonly SealAttempt[]> {
    const driver = await this.resolveDriver();
    return driver.lineage.getAttemptsByBranch(branchId);
  }

  async putHashInput(snapshotHash: string, input: SnapshotHashInput): Promise<void> {
    const driver = await this.resolveDriver();
    await driver.lineage.putHashInput?.(snapshotHash, input);
  }

  async getHashInput(snapshotHash: string): Promise<SnapshotHashInput | null> {
    const driver = await this.resolveDriver();
    return (await driver.lineage.getHashInput?.(snapshotHash)) ?? null;
  }

  async putEdge(edge: WorldEdge): Promise<void> {
    const driver = await this.resolveDriver();
    await driver.lineage.putEdge(edge);
  }

  async getEdges(worldId: WorldId): Promise<readonly WorldEdge[]> {
    const driver = await this.resolveDriver();
    return driver.lineage.getEdges(worldId);
  }

  async getBranchHead(branchId: BranchId): Promise<WorldId | null> {
    const driver = await this.resolveDriver();
    return driver.lineage.getBranchHead(branchId);
  }

  async getBranchTip(branchId: BranchId): Promise<WorldId | null> {
    const driver = await this.resolveDriver();
    return driver.lineage.getBranchTip(branchId);
  }

  async getBranchEpoch(branchId: BranchId): Promise<number> {
    const driver = await this.resolveDriver();
    return driver.lineage.getBranchEpoch(branchId);
  }

  async mutateBranch(mutation: PreparedBranchMutation): Promise<void> {
    const driver = await this.resolveDriver();
    await driver.lineage.mutateBranch(mutation);
  }

  async putBranch(branch: PersistedBranchEntry): Promise<void> {
    const driver = await this.resolveDriver();
    await driver.lineage.putBranch(branch);
  }

  async getBranches(): Promise<readonly PersistedBranchEntry[]> {
    const driver = await this.resolveDriver();
    return driver.lineage.getBranches();
  }

  async getActiveBranchId(): Promise<BranchId | null> {
    const driver = await this.resolveDriver();
    return driver.lineage.getActiveBranchId();
  }

  async switchActiveBranch(
    sourceBranchId: BranchId,
    targetBranchId: BranchId
  ): Promise<void> {
    const driver = await this.resolveDriver();
    await driver.lineage.switchActiveBranch(sourceBranchId, targetBranchId);
  }

  async commitPrepared(
    prepared: Parameters<LineageStore["commitPrepared"]>[0]
  ): Promise<void> {
    const driver = await this.resolveDriver();
    await driver.lineage.commitPrepared(prepared);
  }

  async putProposal(proposal: Proposal): Promise<void> {
    const driver = await this.resolveDriver();
    await driver.governance.putProposal(proposal);
  }

  async getProposal(proposalId: ProposalId): Promise<Proposal | null> {
    const driver = await this.resolveDriver();
    return driver.governance.getProposal(proposalId);
  }

  async getProposalsByBranch(branchId: BranchId): Promise<readonly Proposal[]> {
    const driver = await this.resolveDriver();
    return driver.governance.getProposalsByBranch(branchId);
  }

  async getExecutionStageProposal(branchId: BranchId): Promise<Proposal | null> {
    const driver = await this.resolveDriver();
    return driver.governance.getExecutionStageProposal(branchId);
  }

  async putDecisionRecord(record: DecisionRecord): Promise<void> {
    const driver = await this.resolveDriver();
    await driver.governance.putDecisionRecord(record);
  }

  async getDecisionRecord(decisionId: DecisionId): Promise<DecisionRecord | null> {
    const driver = await this.resolveDriver();
    return driver.governance.getDecisionRecord(decisionId);
  }

  async putActorBinding(binding: ActorAuthorityBinding): Promise<void> {
    const driver = await this.resolveDriver();
    await driver.governance.putActorBinding(binding);
  }

  async getActorBinding(actorId: ActorId): Promise<ActorAuthorityBinding | null> {
    const driver = await this.resolveDriver();
    return driver.governance.getActorBinding(actorId);
  }

  async getActorBindings(): Promise<readonly ActorAuthorityBinding[]> {
    const driver = await this.resolveDriver();
    return driver.governance.getActorBindings();
  }

  async runInSealTransaction<T>(
    work: (tx: WorldStoreTransaction) => Promise<T>
  ): Promise<T> {
    const driver = await this.resolveDriver();
    return driver.runInSealTransaction(work);
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

export interface SqliteWorldStoreOptions {
  readonly filename?: string;
}

type SqlitePersistenceDriver = GovernedWorldPersistenceDriver & {
  close(): void | Promise<void>;
};

async function createSqlitePersistenceDriver(
  options?: SqliteWorldStoreOptions
): Promise<SqlitePersistenceDriver> {
  const { SqliteGovernedWorldPersistenceDriver } = await import(
    "../persistence/sqlite-driver.js"
  );
  return new SqliteGovernedWorldPersistenceDriver(options);
}

export class SqliteGovernedWorldStore extends DriverBackedGovernedWorldStore {
  private readonly sqliteDriverPromise: Promise<SqlitePersistenceDriver>;

  public constructor(options?: SqliteWorldStoreOptions) {
    const sqliteDriverPromise = createSqlitePersistenceDriver(options);
    super(sqliteDriverPromise);
    this.sqliteDriverPromise = sqliteDriverPromise;
  }

  public async close(): Promise<void> {
    const sqliteDriver = await this.sqliteDriverPromise;
    await sqliteDriver.close();
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
