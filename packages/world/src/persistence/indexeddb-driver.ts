import { isExecutionStageStatus } from "@manifesto-ai/governance";
import type {
  ActorAuthorityBinding,
  ActorId,
  BranchId,
  DecisionId,
  DecisionRecord,
  GovernanceStore,
  Proposal,
  ProposalId,
} from "@manifesto-ai/governance";
import type {
  LineageStore,
  PersistedBranchEntry,
  PreparedBranchMutation,
  PreparedLineageCommit,
  SealAttempt,
  Snapshot,
  SnapshotHashInput,
  World,
  WorldEdge,
  WorldId,
} from "@manifesto-ai/lineage";
import { wrapSealTransactionError } from "../facade/internal/errors.js";
import type {
  GovernedWorldPersistenceDriver,
  GovernedWorldPersistenceTx,
} from "./types.js";

const STORE_NAMES = {
  worlds: "worlds",
  snapshots: "snapshots",
  hashInputs: "hash_inputs",
  edges: "edges",
  attempts: "seal_attempts",
  branches: "branches",
  worldMeta: "world_meta",
  proposals: "proposals",
  decisions: "decisions",
  actorBindings: "actor_bindings",
} as const;

const LINEAGE_STORES = [
  STORE_NAMES.worlds,
  STORE_NAMES.snapshots,
  STORE_NAMES.hashInputs,
  STORE_NAMES.edges,
  STORE_NAMES.attempts,
  STORE_NAMES.branches,
  STORE_NAMES.worldMeta,
] as const;

const GOVERNANCE_STORES = [
  STORE_NAMES.proposals,
  STORE_NAMES.decisions,
  STORE_NAMES.actorBindings,
] as const;

const ALL_STORES = [
  ...LINEAGE_STORES,
  ...GOVERNANCE_STORES,
] as const;

const ACTIVE_BRANCH_KEY = "activeBranchId";

type StoreName = (typeof ALL_STORES)[number];
type StoreSelection = readonly StoreName[];
type IndexedDbRequestSource<T> = IDBObjectStore | IDBIndex;

interface WorldRecord {
  readonly worldId: WorldId;
  readonly parentWorldId: WorldId | null;
  readonly snapshotHash: string;
  readonly value: World;
}

interface SnapshotRecord {
  readonly worldId: WorldId;
  readonly value: Snapshot;
}

interface HashInputRecord {
  readonly snapshotHash: string;
  readonly value: SnapshotHashInput;
}

interface EdgeRecord {
  readonly edgeId: string;
  readonly fromWorldId: WorldId;
  readonly toWorldId: WorldId;
  readonly value: WorldEdge;
}

interface AttemptRecord {
  readonly attemptId: string;
  readonly worldId: WorldId;
  readonly branchId: BranchId;
  readonly createdAt: number;
  readonly value: SealAttempt;
}

interface BranchRecord {
  readonly branchId: BranchId;
  readonly name: string;
  readonly head: WorldId;
  readonly tip: WorldId;
  readonly headAdvancedAt: number;
  readonly epoch: number;
  readonly schemaHash: string;
  readonly createdAt: number;
  readonly value: PersistedBranchEntry;
}

interface WorldMetaRecord {
  readonly key: string;
  readonly value: string;
}

interface ProposalRecord {
  readonly proposalId: ProposalId;
  readonly branchId: BranchId;
  readonly status: Proposal["status"];
  readonly submittedAt: number;
  readonly value: Proposal;
}

interface DecisionRecordRow {
  readonly decisionId: DecisionId;
  readonly value: DecisionRecord;
}

interface ActorBindingRecord {
  readonly actorId: ActorId;
  readonly value: ActorAuthorityBinding;
}

function assertLineage(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function compareAttempts(left: SealAttempt, right: SealAttempt): number {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  if (left.attemptId === right.attemptId) {
    return 0;
  }
  return left.attemptId < right.attemptId ? -1 : 1;
}

function compareBranches(
  left: PersistedBranchEntry,
  right: PersistedBranchEntry
): number {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  if (left.id === right.id) {
    return 0;
  }
  return left.id < right.id ? -1 : 1;
}

function compareProposals(left: Proposal, right: Proposal): number {
  if (left.submittedAt !== right.submittedAt) {
    return left.submittedAt - right.submittedAt;
  }
  if (left.proposalId === right.proposalId) {
    return 0;
  }
  return left.proposalId < right.proposalId ? -1 : 1;
}

function ensureIndexedDbFactory(factory?: IDBFactory): IDBFactory {
  const resolved = factory ?? globalThis.indexedDB;
  if (resolved == null) {
    throw new Error("IndexedDB is not available in this environment");
  }
  return resolved;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener(
      "success",
      () => {
        resolve(request.result);
      },
      { once: true }
    );
    request.addEventListener(
      "error",
      () => {
        reject(request.error ?? new Error("IndexedDB request failed"));
      },
      { once: true }
    );
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    const fail = () => {
      reject(tx.error ?? new Error("IndexedDB transaction failed"));
    };
    tx.addEventListener("complete", () => resolve(), { once: true });
    tx.addEventListener("abort", fail, { once: true });
    tx.addEventListener("error", fail, { once: true });
  });
}

async function putRecord(
  store: IDBObjectStore,
  value: unknown
): Promise<void> {
  await requestToPromise(store.put(value));
}

async function getRecord<T>(
  store: IndexedDbRequestSource<T>,
  query: IDBValidKey | IDBKeyRange
): Promise<T | null> {
  const result = await requestToPromise(store.get(query));
  return (result as T | undefined) ?? null;
}

async function getAllRecords<T>(
  store: IndexedDbRequestSource<T>,
  query?: IDBValidKey | IDBKeyRange
): Promise<readonly T[]> {
  const result = query === undefined
    ? await requestToPromise(store.getAll())
    : await requestToPromise(store.getAll(query));
  return result as readonly T[];
}

async function countRecords(
  store: IDBObjectStore,
  query?: IDBValidKey | IDBKeyRange
): Promise<number> {
  return query === undefined
    ? requestToPromise(store.count())
    : requestToPromise(store.count(query));
}

function toWorldRecord(world: World): WorldRecord {
  return {
    worldId: world.worldId,
    parentWorldId: world.parentWorldId,
    snapshotHash: world.snapshotHash,
    value: world,
  };
}

function toSnapshotRecord(worldId: WorldId, snapshot: Snapshot): SnapshotRecord {
  return { worldId, value: snapshot };
}

function toHashInputRecord(
  snapshotHash: string,
  input: SnapshotHashInput
): HashInputRecord {
  return { snapshotHash, value: input };
}

function toEdgeRecord(edge: WorldEdge): EdgeRecord {
  return {
    edgeId: edge.edgeId,
    fromWorldId: edge.from,
    toWorldId: edge.to,
    value: edge,
  };
}

function toAttemptRecord(attempt: SealAttempt): AttemptRecord {
  return {
    attemptId: attempt.attemptId,
    worldId: attempt.worldId,
    branchId: attempt.branchId,
    createdAt: attempt.createdAt,
    value: attempt,
  };
}

function toBranchRecord(branch: PersistedBranchEntry): BranchRecord {
  return {
    branchId: branch.id,
    name: branch.name,
    head: branch.head,
    tip: branch.tip,
    headAdvancedAt: branch.headAdvancedAt,
    epoch: branch.epoch,
    schemaHash: branch.schemaHash,
    createdAt: branch.createdAt,
    value: branch,
  };
}

function toProposalRecord(proposal: Proposal): ProposalRecord {
  return {
    proposalId: proposal.proposalId,
    branchId: proposal.branchId,
    status: proposal.status,
    submittedAt: proposal.submittedAt,
    value: proposal,
  };
}

function toDecisionRecord(record: DecisionRecord): DecisionRecordRow {
  return {
    decisionId: record.decisionId,
    value: record,
  };
}

function toActorBindingRecord(
  binding: ActorAuthorityBinding
): ActorBindingRecord {
  return {
    actorId: binding.actorId,
    value: binding,
  };
}

function ensureObjectStore(
  db: IDBDatabase,
  tx: IDBTransaction,
  name: StoreName,
  options: IDBObjectStoreParameters
): IDBObjectStore {
  return db.objectStoreNames.contains(name)
    ? tx.objectStore(name)
    : db.createObjectStore(name, options);
}

function ensureIndex(
  store: IDBObjectStore,
  name: string,
  keyPath: string | string[]
): void {
  if (!store.indexNames.contains(name)) {
    store.createIndex(name, keyPath);
  }
}

function upgradeDatabase(db: IDBDatabase, tx: IDBTransaction): void {
  ensureObjectStore(db, tx, STORE_NAMES.worlds, { keyPath: "worldId" });
  ensureObjectStore(db, tx, STORE_NAMES.snapshots, { keyPath: "worldId" });
  ensureObjectStore(db, tx, STORE_NAMES.hashInputs, { keyPath: "snapshotHash" });

  const edges = ensureObjectStore(db, tx, STORE_NAMES.edges, { keyPath: "edgeId" });
  ensureIndex(edges, "fromWorldId", "fromWorldId");
  ensureIndex(edges, "toWorldId", "toWorldId");

  const attempts = ensureObjectStore(db, tx, STORE_NAMES.attempts, {
    keyPath: "attemptId",
  });
  ensureIndex(attempts, "worldId", "worldId");
  ensureIndex(attempts, "branchId", "branchId");

  ensureObjectStore(db, tx, STORE_NAMES.branches, { keyPath: "branchId" });
  ensureObjectStore(db, tx, STORE_NAMES.worldMeta, { keyPath: "key" });

  const proposals = ensureObjectStore(db, tx, STORE_NAMES.proposals, {
    keyPath: "proposalId",
  });
  ensureIndex(proposals, "branchId", "branchId");

  ensureObjectStore(db, tx, STORE_NAMES.decisions, { keyPath: "decisionId" });
  ensureObjectStore(db, tx, STORE_NAMES.actorBindings, { keyPath: "actorId" });
}

async function openDatabase(
  factory: IDBFactory,
  name: string,
  version: number
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, version);
    request.addEventListener(
      "upgradeneeded",
      () => {
        upgradeDatabase(request.result, request.transaction!);
      },
      { once: true }
    );
    request.addEventListener(
      "blocked",
      () => {
        reject(new Error(`IndexedDB open for ${name} was blocked`));
      },
      { once: true }
    );
    request.addEventListener(
      "success",
      () => {
        resolve(request.result);
      },
      { once: true }
    );
    request.addEventListener(
      "error",
      () => {
        reject(request.error ?? new Error(`Failed to open IndexedDB database ${name}`));
      },
      { once: true }
    );
  });
}

class IndexedDbContext {
  private readonly dbPromise: Promise<IDBDatabase>;

  public constructor(
    factory: IDBFactory,
    name: string,
    version: number
  ) {
    this.dbPromise = openDatabase(factory, name, version);
  }

  public async close(): Promise<void> {
    const db = await this.dbPromise;
    db.close();
  }

  public async withTransaction<T>(
    stores: StoreSelection,
    mode: IDBTransactionMode,
    work: (tx: IDBTransaction) => Promise<T>
  ): Promise<T> {
    const db = await this.dbPromise;
    const tx = db.transaction([...new Set(stores)], mode);
    const completion = transactionDone(tx);

    try {
      const result = await work(tx);
      await completion;
      return result;
    } catch (error) {
      try {
        tx.abort();
      } catch {}
      await completion.catch(() => undefined);
      throw error;
    }
  }
}

class IndexedDbLineageStore implements LineageStore {
  public constructor(
    private readonly context: IndexedDbContext,
    private readonly activeTx?: IDBTransaction
  ) {}

  private async withTx<T>(
    stores: StoreSelection,
    mode: IDBTransactionMode,
    work: (tx: IDBTransaction) => Promise<T>
  ): Promise<T> {
    if (this.activeTx != null) {
      return work(this.activeTx);
    }
    return this.context.withTransaction(stores, mode, work);
  }

  private async getStoredBranch(
    tx: IDBTransaction,
    branchId: BranchId
  ): Promise<PersistedBranchEntry | null> {
    const record = await getRecord<BranchRecord>(
      tx.objectStore(STORE_NAMES.branches),
      branchId
    );
    return record?.value ?? null;
  }

  private async getStoredWorld(
    tx: IDBTransaction,
    worldId: WorldId
  ): Promise<World | null> {
    const record = await getRecord<WorldRecord>(
      tx.objectStore(STORE_NAMES.worlds),
      worldId
    );
    return record?.value ?? null;
  }

  private async getStoredActiveBranchId(
    tx: IDBTransaction
  ): Promise<BranchId | null> {
    const record = await getRecord<WorldMetaRecord>(
      tx.objectStore(STORE_NAMES.worldMeta),
      ACTIVE_BRANCH_KEY
    );
    return (record?.value as BranchId | undefined) ?? null;
  }

  private async persistBranch(
    tx: IDBTransaction,
    branch: PersistedBranchEntry
  ): Promise<void> {
    await putRecord(tx.objectStore(STORE_NAMES.branches), toBranchRecord(branch));
  }

  async putWorld(world: World): Promise<void> {
    await this.withTx([STORE_NAMES.worlds], "readwrite", async (tx) => {
      await putRecord(tx.objectStore(STORE_NAMES.worlds), toWorldRecord(world));
    });
  }

  async getWorld(worldId: WorldId): Promise<World | null> {
    return this.withTx([STORE_NAMES.worlds], "readonly", async (tx) => {
      const record = await getRecord<WorldRecord>(
        tx.objectStore(STORE_NAMES.worlds),
        worldId
      );
      return record?.value ?? null;
    });
  }

  async putSnapshot(worldId: WorldId, snapshot: Snapshot): Promise<void> {
    await this.withTx([STORE_NAMES.snapshots], "readwrite", async (tx) => {
      await putRecord(
        tx.objectStore(STORE_NAMES.snapshots),
        toSnapshotRecord(worldId, snapshot)
      );
    });
  }

  async getSnapshot(worldId: WorldId): Promise<Snapshot | null> {
    return this.withTx([STORE_NAMES.snapshots], "readonly", async (tx) => {
      const record = await getRecord<SnapshotRecord>(
        tx.objectStore(STORE_NAMES.snapshots),
        worldId
      );
      return record?.value ?? null;
    });
  }

  async putAttempt(attempt: SealAttempt): Promise<void> {
    await this.withTx([STORE_NAMES.attempts], "readwrite", async (tx) => {
      await putRecord(tx.objectStore(STORE_NAMES.attempts), toAttemptRecord(attempt));
    });
  }

  async getAttempts(worldId: WorldId): Promise<readonly SealAttempt[]> {
    return this.withTx([STORE_NAMES.attempts], "readonly", async (tx) => {
      const rows = await getAllRecords<AttemptRecord>(
        tx.objectStore(STORE_NAMES.attempts).index("worldId"),
        worldId
      );
      return rows.map((row) => row.value).sort(compareAttempts);
    });
  }

  async getAttemptsByBranch(branchId: BranchId): Promise<readonly SealAttempt[]> {
    return this.withTx([STORE_NAMES.attempts], "readonly", async (tx) => {
      const rows = await getAllRecords<AttemptRecord>(
        tx.objectStore(STORE_NAMES.attempts).index("branchId"),
        branchId
      );
      return rows.map((row) => row.value).sort(compareAttempts);
    });
  }

  async putHashInput(snapshotHash: string, input: SnapshotHashInput): Promise<void> {
    await this.withTx([STORE_NAMES.hashInputs], "readwrite", async (tx) => {
      await putRecord(
        tx.objectStore(STORE_NAMES.hashInputs),
        toHashInputRecord(snapshotHash, input)
      );
    });
  }

  async getHashInput(snapshotHash: string): Promise<SnapshotHashInput | null> {
    return this.withTx([STORE_NAMES.hashInputs], "readonly", async (tx) => {
      const record = await getRecord<HashInputRecord>(
        tx.objectStore(STORE_NAMES.hashInputs),
        snapshotHash
      );
      return record?.value ?? null;
    });
  }

  async putEdge(edge: WorldEdge): Promise<void> {
    await this.withTx([STORE_NAMES.edges], "readwrite", async (tx) => {
      await putRecord(tx.objectStore(STORE_NAMES.edges), toEdgeRecord(edge));
    });
  }

  async getEdges(worldId: WorldId): Promise<readonly WorldEdge[]> {
    return this.withTx([STORE_NAMES.edges], "readonly", async (tx) => {
      const store = tx.objectStore(STORE_NAMES.edges);
      const from = await getAllRecords<EdgeRecord>(store.index("fromWorldId"), worldId);
      const to = await getAllRecords<EdgeRecord>(store.index("toWorldId"), worldId);
      const deduped = new Map<string, WorldEdge>();
      for (const row of [...from, ...to]) {
        deduped.set(row.edgeId, row.value);
      }
      return [...deduped.values()].sort((left, right) =>
        left.edgeId === right.edgeId ? 0 : left.edgeId < right.edgeId ? -1 : 1
      );
    });
  }

  async getBranchHead(branchId: BranchId): Promise<WorldId | null> {
    return this.withTx([STORE_NAMES.branches], "readonly", async (tx) => {
      const record = await getRecord<BranchRecord>(
        tx.objectStore(STORE_NAMES.branches),
        branchId
      );
      return record?.head ?? null;
    });
  }

  async getBranchTip(branchId: BranchId): Promise<WorldId | null> {
    return this.withTx([STORE_NAMES.branches], "readonly", async (tx) => {
      const record = await getRecord<BranchRecord>(
        tx.objectStore(STORE_NAMES.branches),
        branchId
      );
      return record?.tip ?? null;
    });
  }

  async getBranchEpoch(branchId: BranchId): Promise<number> {
    return this.withTx([STORE_NAMES.branches], "readonly", async (tx) => {
      const record = await getRecord<BranchRecord>(
        tx.objectStore(STORE_NAMES.branches),
        branchId
      );
      assertLineage(record != null, `LIN-EPOCH-6 violation: unknown branch ${branchId}`);
      return record.epoch;
    });
  }

  async mutateBranch(mutation: PreparedBranchMutation): Promise<void> {
    await this.withTx([STORE_NAMES.branches], "readwrite", async (tx) => {
      const current = await this.getStoredBranch(tx, mutation.branchId);
      assertLineage(
        current != null,
        `LIN-STORE-4 violation: unknown branch ${mutation.branchId}`
      );
      assertLineage(
        current.head === mutation.expectedHead &&
          current.tip === mutation.expectedTip &&
          current.epoch === mutation.expectedEpoch,
        `LIN-STORE-4 violation: branch ${mutation.branchId} CAS mismatch`
      );
      await this.persistBranch(tx, {
        ...current,
        head: mutation.nextHead,
        tip: mutation.nextTip,
        headAdvancedAt: mutation.headAdvancedAt ?? current.headAdvancedAt,
        epoch: mutation.nextEpoch,
      });
    });
  }

  async putBranch(branch: PersistedBranchEntry): Promise<void> {
    await this.withTx([STORE_NAMES.branches], "readwrite", async (tx) => {
      await this.persistBranch(tx, branch);
    });
  }

  async getBranches(): Promise<readonly PersistedBranchEntry[]> {
    return this.withTx([STORE_NAMES.branches], "readonly", async (tx) => {
      const rows = await getAllRecords<BranchRecord>(tx.objectStore(STORE_NAMES.branches));
      return rows.map((row) => row.value).sort(compareBranches);
    });
  }

  async getActiveBranchId(): Promise<BranchId | null> {
    return this.withTx([STORE_NAMES.worldMeta], "readonly", async (tx) => {
      const record = await getRecord<WorldMetaRecord>(
        tx.objectStore(STORE_NAMES.worldMeta),
        ACTIVE_BRANCH_KEY
      );
      return (record?.value as BranchId | undefined) ?? null;
    });
  }

  async switchActiveBranch(
    sourceBranchId: BranchId,
    targetBranchId: BranchId
  ): Promise<void> {
    await this.withTx(
      [STORE_NAMES.branches, STORE_NAMES.worldMeta],
      "readwrite",
      async (tx) => {
        assertLineage(
          sourceBranchId !== targetBranchId,
          "LIN-SWITCH-5 violation: self-switch is not allowed"
        );
        const activeBranchId = await this.getStoredActiveBranchId(tx);
        assertLineage(
          activeBranchId === sourceBranchId,
          "LIN-SWITCH-1 violation: source branch is not active"
        );
        const sourceBranch = await this.getStoredBranch(tx, sourceBranchId);
        const targetBranch = await this.getStoredBranch(tx, targetBranchId);
        assertLineage(
          sourceBranch != null,
          `LIN-SWITCH-3 violation: missing source branch ${sourceBranchId}`
        );
        assertLineage(
          targetBranch != null,
          `LIN-SWITCH-3 violation: missing target branch ${targetBranchId}`
        );
        await this.persistBranch(tx, {
          ...sourceBranch,
          epoch: sourceBranch.epoch + 1,
        });
        await putRecord(tx.objectStore(STORE_NAMES.worldMeta), {
          key: ACTIVE_BRANCH_KEY,
          value: targetBranchId,
        } satisfies WorldMetaRecord);
      }
    );
  }

  async commitPrepared(prepared: PreparedLineageCommit): Promise<void> {
    await this.withTx(LINEAGE_STORES, "readwrite", async (tx) => {
      if (prepared.branchChange.kind === "bootstrap") {
        const branchCount = await countRecords(tx.objectStore(STORE_NAMES.branches));
        assertLineage(
          branchCount === 0,
          "LIN-GENESIS-3 violation: genesis requires an empty branch store"
        );
        assertLineage(
          (await this.getStoredActiveBranchId(tx)) == null,
          "LIN-GENESIS-3 violation: active branch must be empty before genesis bootstrap"
        );
        assertLineage(
          (await this.getStoredBranch(tx, prepared.branchChange.branch.id)) == null,
          `LIN-GENESIS-3 violation: branch ${prepared.branchChange.branch.id} already exists`
        );
        await this.persistBranch(tx, prepared.branchChange.branch);
        await putRecord(tx.objectStore(STORE_NAMES.worldMeta), {
          key: ACTIVE_BRANCH_KEY,
          value: prepared.branchChange.activeBranchId,
        } satisfies WorldMetaRecord);
      } else {
        const branch = await this.getStoredBranch(tx, prepared.branchChange.branchId);
        assertLineage(
          branch != null,
          `LIN-STORE-7 violation: missing branch ${prepared.branchChange.branchId} for prepared commit`
        );
        assertLineage(
          branch.head === prepared.branchChange.expectedHead &&
            branch.tip === prepared.branchChange.expectedTip &&
            branch.epoch === prepared.branchChange.expectedEpoch,
          `LIN-STORE-4 violation: branch ${prepared.branchChange.branchId} CAS mismatch`
        );
        await this.persistBranch(tx, {
          ...branch,
          head: prepared.branchChange.nextHead,
          tip: prepared.branchChange.nextTip,
          headAdvancedAt:
            prepared.branchChange.headAdvancedAt ?? branch.headAdvancedAt,
          epoch: prepared.branchChange.nextEpoch,
        });
      }

      const existingWorld = await this.getStoredWorld(tx, prepared.worldId);
      const reused = existingWorld != null;

      if (reused) {
        assertLineage(
          existingWorld.parentWorldId === prepared.world.parentWorldId,
          `LIN-STORE-9 violation: world ${prepared.worldId} exists with a different parent`
        );
        if (prepared.kind === "next") {
          const edgeExists = await getRecord<EdgeRecord>(
            tx.objectStore(STORE_NAMES.edges),
            prepared.edge.edgeId
          );
          assertLineage(
            edgeExists != null,
            `LIN-STORE-9 violation: reuse world ${prepared.worldId} is missing edge ${prepared.edge.edgeId}`
          );
        }
      } else {
        await putRecord(tx.objectStore(STORE_NAMES.worlds), toWorldRecord(prepared.world));
        await putRecord(
          tx.objectStore(STORE_NAMES.snapshots),
          toSnapshotRecord(prepared.worldId, prepared.terminalSnapshot)
        );
        await putRecord(
          tx.objectStore(STORE_NAMES.hashInputs),
          toHashInputRecord(prepared.world.snapshotHash, prepared.hashInput)
        );
        if (prepared.kind === "next") {
          await putRecord(tx.objectStore(STORE_NAMES.edges), toEdgeRecord(prepared.edge));
        }
      }

      await putRecord(tx.objectStore(STORE_NAMES.attempts), toAttemptRecord({
        ...prepared.attempt,
        reused,
      }));
    });
  }
}

class IndexedDbGovernanceStore implements GovernanceStore {
  public constructor(
    private readonly context: IndexedDbContext,
    private readonly activeTx?: IDBTransaction
  ) {}

  private async withTx<T>(
    stores: StoreSelection,
    mode: IDBTransactionMode,
    work: (tx: IDBTransaction) => Promise<T>
  ): Promise<T> {
    if (this.activeTx != null) {
      return work(this.activeTx);
    }
    return this.context.withTransaction(stores, mode, work);
  }

  async putProposal(proposal: Proposal): Promise<void> {
    await this.withTx([STORE_NAMES.proposals], "readwrite", async (tx) => {
      await putRecord(tx.objectStore(STORE_NAMES.proposals), toProposalRecord(proposal));
    });
  }

  async getProposal(proposalId: ProposalId): Promise<Proposal | null> {
    return this.withTx([STORE_NAMES.proposals], "readonly", async (tx) => {
      const record = await getRecord<ProposalRecord>(
        tx.objectStore(STORE_NAMES.proposals),
        proposalId
      );
      return record?.value ?? null;
    });
  }

  async getProposalsByBranch(branchId: BranchId): Promise<readonly Proposal[]> {
    return this.withTx([STORE_NAMES.proposals], "readonly", async (tx) => {
      const rows = await getAllRecords<ProposalRecord>(
        tx.objectStore(STORE_NAMES.proposals).index("branchId"),
        branchId
      );
      return rows.map((row) => row.value).sort(compareProposals);
    });
  }

  async getExecutionStageProposal(branchId: BranchId): Promise<Proposal | null> {
    const matches = (await this.getProposalsByBranch(branchId)).filter((proposal) =>
      isExecutionStageStatus(proposal.status)
    );
    if (matches.length > 1) {
      throw new Error(
        `GOV-STORE-4 violation: multiple execution-stage proposals found for branch ${branchId}`
      );
    }
    return matches[0] ?? null;
  }

  async putDecisionRecord(record: DecisionRecord): Promise<void> {
    await this.withTx([STORE_NAMES.decisions], "readwrite", async (tx) => {
      await putRecord(
        tx.objectStore(STORE_NAMES.decisions),
        toDecisionRecord(record)
      );
    });
  }

  async getDecisionRecord(decisionId: DecisionId): Promise<DecisionRecord | null> {
    return this.withTx([STORE_NAMES.decisions], "readonly", async (tx) => {
      const record = await getRecord<DecisionRecordRow>(
        tx.objectStore(STORE_NAMES.decisions),
        decisionId
      );
      return record?.value ?? null;
    });
  }

  async putActorBinding(binding: ActorAuthorityBinding): Promise<void> {
    await this.withTx([STORE_NAMES.actorBindings], "readwrite", async (tx) => {
      await putRecord(
        tx.objectStore(STORE_NAMES.actorBindings),
        toActorBindingRecord(binding)
      );
    });
  }

  async getActorBinding(actorId: ActorId): Promise<ActorAuthorityBinding | null> {
    return this.withTx([STORE_NAMES.actorBindings], "readonly", async (tx) => {
      const record = await getRecord<ActorBindingRecord>(
        tx.objectStore(STORE_NAMES.actorBindings),
        actorId
      );
      return record?.value ?? null;
    });
  }

  async getActorBindings(): Promise<readonly ActorAuthorityBinding[]> {
    return this.withTx([STORE_NAMES.actorBindings], "readonly", async (tx) => {
      const rows = await getAllRecords<ActorBindingRecord>(
        tx.objectStore(STORE_NAMES.actorBindings)
      );
      return rows
        .map((row) => row.value)
        .sort((left, right) =>
          left.actorId === right.actorId ? 0 : left.actorId < right.actorId ? -1 : 1
        );
    });
  }
}

export interface IndexedDbGovernedWorldPersistenceDriverOptions {
  readonly name?: string;
  readonly version?: number;
  readonly indexedDB?: IDBFactory;
}

export class IndexedDbGovernedWorldPersistenceDriver
  implements GovernedWorldPersistenceDriver
{
  public readonly lineage: LineageStore;
  public readonly governance: GovernanceStore;
  private readonly context: IndexedDbContext;

  public constructor(options?: IndexedDbGovernedWorldPersistenceDriverOptions) {
    this.context = new IndexedDbContext(
      ensureIndexedDbFactory(options?.indexedDB),
      options?.name ?? "manifesto-world",
      options?.version ?? 1
    );
    this.lineage = new IndexedDbLineageStore(this.context);
    this.governance = new IndexedDbGovernanceStore(this.context);
  }

  public async close(): Promise<void> {
    await this.context.close();
  }

  async runInSealTransaction<T>(
    work: (tx: GovernedWorldPersistenceTx) => Promise<T>
  ): Promise<T> {
    try {
      return await this.context.withTransaction(ALL_STORES, "readwrite", async (tx) => {
        const lineage = new IndexedDbLineageStore(this.context, tx);
        const governance = new IndexedDbGovernanceStore(this.context, tx);
        const persistenceTx: GovernedWorldPersistenceTx = {
          commitPrepared: async (prepared) => {
            await lineage.commitPrepared(prepared);
          },
          putProposal: async (proposal) => {
            await governance.putProposal(proposal);
          },
          putDecisionRecord: async (record) => {
            await governance.putDecisionRecord(record);
          },
        };
        return work(persistenceTx);
      });
    } catch (error) {
      wrapSealTransactionError(error);
    }
  }
}

export function createIndexedDbGovernedWorldPersistenceDriver(
  options?: IndexedDbGovernedWorldPersistenceDriverOptions
): IndexedDbGovernedWorldPersistenceDriver {
  return new IndexedDbGovernedWorldPersistenceDriver(options);
}
