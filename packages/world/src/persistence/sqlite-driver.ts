import { createRequire } from "node:module";
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

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
type SqliteDatabase = import("node:sqlite").DatabaseSync;

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS worlds (
  world_id TEXT PRIMARY KEY,
  parent_world_id TEXT,
  snapshot_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS snapshots (
  world_id TEXT PRIMARY KEY,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS hash_inputs (
  snapshot_hash TEXT PRIMARY KEY,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS edges (
  edge_id TEXT PRIMARY KEY,
  from_world_id TEXT NOT NULL,
  to_world_id TEXT NOT NULL,
  json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_edges_from_world ON edges(from_world_id);
CREATE INDEX IF NOT EXISTS idx_edges_to_world ON edges(to_world_id);
CREATE TABLE IF NOT EXISTS attempts (
  attempt_id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_world ON attempts(world_id, created_at, attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempts_branch ON attempts(branch_id, created_at, attempt_id);
CREATE TABLE IF NOT EXISTS branches (
  branch_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  head TEXT NOT NULL,
  tip TEXT NOT NULL,
  head_advanced_at INTEGER NOT NULL,
  epoch INTEGER NOT NULL,
  schema_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS world_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS proposals (
  proposal_id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  status TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_proposals_branch ON proposals(branch_id, submitted_at, proposal_id);
CREATE TABLE IF NOT EXISTS decisions (
  decision_id TEXT PRIMARY KEY,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS actor_bindings (
  actor_id TEXT PRIMARY KEY,
  json TEXT NOT NULL
);
`;

function assertLineage(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function encode(value: unknown): string {
  return JSON.stringify(value);
}

function decode<T>(value: string | null): T | null {
  if (value == null) {
    return null;
  }
  return JSON.parse(value) as T;
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

class SqliteContext {
  private savepointCounter = 0;

  public constructor(public readonly db: SqliteDatabase) {
    this.db.exec(SCHEMA_SQL);
  }

  public close(): void {
    this.db.close();
  }

  public async withSavepoint<T>(
    label: string,
    work: () => Promise<T>
  ): Promise<T> {
    const savepointName = `${label.replace(/[^a-z0-9_]/gi, "_")}_${++this.savepointCounter}`;
    this.db.exec(`SAVEPOINT ${savepointName}`);
    try {
      const result = await work();
      this.db.exec(`RELEASE SAVEPOINT ${savepointName}`);
      return result;
    } catch (error) {
      try {
        this.db.exec(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      } finally {
        this.db.exec(`RELEASE SAVEPOINT ${savepointName}`);
      }
      throw error;
    }
  }
}

class SqliteLineageStore implements LineageStore {
  public constructor(private readonly context: SqliteContext) {}

  async putWorld(world: World): Promise<void> {
    this.context.db
      .prepare(
        `INSERT INTO worlds (world_id, parent_world_id, snapshot_hash, created_at, json)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(world_id) DO UPDATE SET
           parent_world_id = excluded.parent_world_id,
           snapshot_hash = excluded.snapshot_hash,
           created_at = excluded.created_at,
           json = excluded.json`
      )
      .run(
        world.worldId,
        world.parentWorldId,
        world.snapshotHash,
        0,
        encode(world)
      );
  }

  async getWorld(worldId: WorldId): Promise<World | null> {
    const row = this.context.db
      .prepare("SELECT json FROM worlds WHERE world_id = ?")
      .get(worldId) as { json: string } | undefined;
    return decode<World>(row?.json ?? null);
  }

  async putSnapshot(worldId: WorldId, snapshot: Snapshot): Promise<void> {
    this.context.db
      .prepare(
        `INSERT INTO snapshots (world_id, json) VALUES (?, ?)
         ON CONFLICT(world_id) DO UPDATE SET json = excluded.json`
      )
      .run(worldId, encode(snapshot));
  }

  async getSnapshot(worldId: WorldId): Promise<Snapshot | null> {
    const row = this.context.db
      .prepare("SELECT json FROM snapshots WHERE world_id = ?")
      .get(worldId) as { json: string } | undefined;
    return decode<Snapshot>(row?.json ?? null);
  }

  async putAttempt(attempt: SealAttempt): Promise<void> {
    this.context.db
      .prepare(
        `INSERT INTO attempts (attempt_id, world_id, branch_id, created_at, json)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(attempt_id) DO UPDATE SET
           world_id = excluded.world_id,
           branch_id = excluded.branch_id,
           created_at = excluded.created_at,
           json = excluded.json`
      )
      .run(
        attempt.attemptId,
        attempt.worldId,
        attempt.branchId,
        attempt.createdAt,
        encode(attempt)
      );
  }

  async getAttempts(worldId: WorldId): Promise<readonly SealAttempt[]> {
    const rows = this.context.db
      .prepare("SELECT json FROM attempts WHERE world_id = ? ORDER BY created_at, attempt_id")
      .all(worldId) as { json: string }[];
    return rows.map((row) => decode<SealAttempt>(row.json)!).sort(compareAttempts);
  }

  async getAttemptsByBranch(branchId: BranchId): Promise<readonly SealAttempt[]> {
    const rows = this.context.db
      .prepare("SELECT json FROM attempts WHERE branch_id = ? ORDER BY created_at, attempt_id")
      .all(branchId) as { json: string }[];
    return rows.map((row) => decode<SealAttempt>(row.json)!).sort(compareAttempts);
  }

  async putHashInput(snapshotHash: string, input: SnapshotHashInput): Promise<void> {
    this.context.db
      .prepare(
        `INSERT INTO hash_inputs (snapshot_hash, json) VALUES (?, ?)
         ON CONFLICT(snapshot_hash) DO UPDATE SET json = excluded.json`
      )
      .run(snapshotHash, encode(input));
  }

  async getHashInput(snapshotHash: string): Promise<SnapshotHashInput | null> {
    const row = this.context.db
      .prepare("SELECT json FROM hash_inputs WHERE snapshot_hash = ?")
      .get(snapshotHash) as { json: string } | undefined;
    return decode<SnapshotHashInput>(row?.json ?? null);
  }

  async putEdge(edge: WorldEdge): Promise<void> {
    this.context.db
      .prepare(
        `INSERT INTO edges (edge_id, from_world_id, to_world_id, json)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(edge_id) DO UPDATE SET
           from_world_id = excluded.from_world_id,
           to_world_id = excluded.to_world_id,
           json = excluded.json`
      )
      .run(edge.edgeId, edge.from, edge.to, encode(edge));
  }

  async getEdges(worldId: WorldId): Promise<readonly WorldEdge[]> {
    const rows = this.context.db
      .prepare(
        `SELECT json FROM edges
         WHERE from_world_id = ? OR to_world_id = ?
         ORDER BY edge_id`
      )
      .all(worldId, worldId) as { json: string }[];
    return rows.map((row) => decode<WorldEdge>(row.json)!);
  }

  async getBranchHead(branchId: BranchId): Promise<WorldId | null> {
    const row = this.context.db
      .prepare("SELECT head FROM branches WHERE branch_id = ?")
      .get(branchId) as { head: WorldId } | undefined;
    return row?.head ?? null;
  }

  async getBranchTip(branchId: BranchId): Promise<WorldId | null> {
    const row = this.context.db
      .prepare("SELECT tip FROM branches WHERE branch_id = ?")
      .get(branchId) as { tip: WorldId } | undefined;
    return row?.tip ?? null;
  }

  async getBranchEpoch(branchId: BranchId): Promise<number> {
    const row = this.context.db
      .prepare("SELECT epoch FROM branches WHERE branch_id = ?")
      .get(branchId) as { epoch: number } | undefined;
    assertLineage(row != null, `LIN-EPOCH-6 violation: unknown branch ${branchId}`);
    return row.epoch;
  }

  async mutateBranch(mutation: PreparedBranchMutation): Promise<void> {
    const current = await this.getStoredBranch(mutation.branchId);
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
    await this.persistBranch({
      ...current,
      head: mutation.nextHead,
      tip: mutation.nextTip,
      headAdvancedAt: mutation.headAdvancedAt ?? current.headAdvancedAt,
      epoch: mutation.nextEpoch,
    });
  }

  async putBranch(branch: PersistedBranchEntry): Promise<void> {
    await this.persistBranch(branch);
  }

  async getBranches(): Promise<readonly PersistedBranchEntry[]> {
    const rows = this.context.db
      .prepare("SELECT json FROM branches ORDER BY created_at, branch_id")
      .all() as { json: string }[];
    return rows.map((row) => decode<PersistedBranchEntry>(row.json)!);
  }

  async getActiveBranchId(): Promise<BranchId | null> {
    const row = this.context.db
      .prepare("SELECT value FROM world_meta WHERE key = 'activeBranchId'")
      .get() as { value: string } | undefined;
    return row?.value ?? null;
  }

  async switchActiveBranch(
    sourceBranchId: BranchId,
    targetBranchId: BranchId
  ): Promise<void> {
    await this.context.withSavepoint("switch_branch", async () => {
      assertLineage(
        sourceBranchId !== targetBranchId,
        "LIN-SWITCH-5 violation: self-switch is not allowed"
      );
      const activeBranchId = await this.getActiveBranchId();
      assertLineage(
        activeBranchId === sourceBranchId,
        "LIN-SWITCH-1 violation: source branch is not active"
      );
      const sourceBranch = await this.getStoredBranch(sourceBranchId);
      const targetBranch = await this.getStoredBranch(targetBranchId);
      assertLineage(
        sourceBranch != null,
        `LIN-SWITCH-3 violation: missing source branch ${sourceBranchId}`
      );
      assertLineage(
        targetBranch != null,
        `LIN-SWITCH-3 violation: missing target branch ${targetBranchId}`
      );
      await this.persistBranch({
        ...sourceBranch,
        epoch: sourceBranch.epoch + 1,
      });
      this.context.db
        .prepare(
          `INSERT INTO world_meta (key, value) VALUES ('activeBranchId', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        )
        .run(targetBranchId);
    });
  }

  async commitPrepared(prepared: PreparedLineageCommit): Promise<void> {
    await this.context.withSavepoint("lineage_commit", async () => {
      if (prepared.branchChange.kind === "bootstrap") {
        const branchCount = this.context.db
          .prepare("SELECT COUNT(*) AS count FROM branches")
          .get() as { count: number };
        assertLineage(
          branchCount.count === 0,
          "LIN-GENESIS-3 violation: genesis requires an empty branch store"
        );
        assertLineage(
          (await this.getActiveBranchId()) == null,
          "LIN-GENESIS-3 violation: active branch must be empty before genesis bootstrap"
        );
        assertLineage(
          (await this.getStoredBranch(prepared.branchChange.branch.id)) == null,
          `LIN-GENESIS-3 violation: branch ${prepared.branchChange.branch.id} already exists`
        );
        await this.persistBranch(prepared.branchChange.branch);
        this.context.db
          .prepare(
            `INSERT INTO world_meta (key, value) VALUES ('activeBranchId', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`
          )
          .run(prepared.branchChange.activeBranchId);
      } else {
        const branch = await this.getStoredBranch(prepared.branchChange.branchId);
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
        await this.persistBranch({
          ...branch,
          head: prepared.branchChange.nextHead,
          tip: prepared.branchChange.nextTip,
          headAdvancedAt:
            prepared.branchChange.headAdvancedAt ?? branch.headAdvancedAt,
          epoch: prepared.branchChange.nextEpoch,
        });
      }

      const existingWorld = await this.getWorld(prepared.worldId);
      const reused = existingWorld != null;

      if (reused) {
        assertLineage(
          existingWorld.parentWorldId === prepared.world.parentWorldId,
          `LIN-STORE-9 violation: world ${prepared.worldId} exists with a different parent`
        );
        if (prepared.kind === "next") {
          const edgeExists = this.context.db
            .prepare("SELECT 1 FROM edges WHERE edge_id = ?")
            .get(prepared.edge.edgeId);
          assertLineage(
            edgeExists != null,
            `LIN-STORE-9 violation: reuse world ${prepared.worldId} is missing edge ${prepared.edge.edgeId}`
          );
        }
      } else {
        await this.putWorld(prepared.world);
        await this.putSnapshot(prepared.worldId, prepared.terminalSnapshot);
        await this.putHashInput?.(prepared.world.snapshotHash, prepared.hashInput);
        if (prepared.kind === "next") {
          await this.putEdge(prepared.edge);
        }
      }

      await this.putAttempt({
        ...prepared.attempt,
        reused,
      });
    });
  }

  private async getStoredBranch(
    branchId: BranchId
  ): Promise<PersistedBranchEntry | null> {
    const row = this.context.db
      .prepare("SELECT json FROM branches WHERE branch_id = ?")
      .get(branchId) as { json: string } | undefined;
    return decode<PersistedBranchEntry>(row?.json ?? null);
  }

  private async persistBranch(branch: PersistedBranchEntry): Promise<void> {
    this.context.db
      .prepare(
        `INSERT INTO branches (
           branch_id, name, head, tip, head_advanced_at, epoch, schema_hash, created_at, json
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(branch_id) DO UPDATE SET
           name = excluded.name,
           head = excluded.head,
           tip = excluded.tip,
           head_advanced_at = excluded.head_advanced_at,
           epoch = excluded.epoch,
           schema_hash = excluded.schema_hash,
           created_at = excluded.created_at,
           json = excluded.json`
      )
      .run(
        branch.id,
        branch.name,
        branch.head,
        branch.tip,
        branch.headAdvancedAt,
        branch.epoch,
        branch.schemaHash,
        branch.createdAt,
        encode(branch)
      );
  }
}

class SqliteGovernanceStore implements GovernanceStore {
  public constructor(private readonly context: SqliteContext) {}

  async putProposal(proposal: Proposal): Promise<void> {
    this.context.db
      .prepare(
        `INSERT INTO proposals (proposal_id, branch_id, status, submitted_at, json)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(proposal_id) DO UPDATE SET
           branch_id = excluded.branch_id,
           status = excluded.status,
           submitted_at = excluded.submitted_at,
           json = excluded.json`
      )
      .run(
        proposal.proposalId,
        proposal.branchId,
        proposal.status,
        proposal.submittedAt,
        encode(proposal)
      );
  }

  async getProposal(proposalId: ProposalId): Promise<Proposal | null> {
    const row = this.context.db
      .prepare("SELECT json FROM proposals WHERE proposal_id = ?")
      .get(proposalId) as { json: string } | undefined;
    return decode<Proposal>(row?.json ?? null);
  }

  async getProposalsByBranch(branchId: BranchId): Promise<readonly Proposal[]> {
    const rows = this.context.db
      .prepare(
        "SELECT json FROM proposals WHERE branch_id = ? ORDER BY submitted_at, proposal_id"
      )
      .all(branchId) as { json: string }[];
    return rows.map((row) => decode<Proposal>(row.json)!);
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
    this.context.db
      .prepare(
        `INSERT INTO decisions (decision_id, json) VALUES (?, ?)
         ON CONFLICT(decision_id) DO UPDATE SET json = excluded.json`
      )
      .run(record.decisionId, encode(record));
  }

  async getDecisionRecord(decisionId: DecisionId): Promise<DecisionRecord | null> {
    const row = this.context.db
      .prepare("SELECT json FROM decisions WHERE decision_id = ?")
      .get(decisionId) as { json: string } | undefined;
    return decode<DecisionRecord>(row?.json ?? null);
  }

  async putActorBinding(binding: ActorAuthorityBinding): Promise<void> {
    this.context.db
      .prepare(
        `INSERT INTO actor_bindings (actor_id, json) VALUES (?, ?)
         ON CONFLICT(actor_id) DO UPDATE SET json = excluded.json`
      )
      .run(binding.actorId, encode(binding));
  }

  async getActorBinding(actorId: ActorId): Promise<ActorAuthorityBinding | null> {
    const row = this.context.db
      .prepare("SELECT json FROM actor_bindings WHERE actor_id = ?")
      .get(actorId) as { json: string } | undefined;
    return decode<ActorAuthorityBinding>(row?.json ?? null);
  }

  async getActorBindings(): Promise<readonly ActorAuthorityBinding[]> {
    const rows = this.context.db
      .prepare("SELECT json FROM actor_bindings ORDER BY actor_id")
      .all() as { json: string }[];
    return rows.map((row) => decode<ActorAuthorityBinding>(row.json)!);
  }
}

export interface SqliteGovernedWorldPersistenceDriverOptions {
  readonly filename?: string;
}

export class SqliteGovernedWorldPersistenceDriver
  implements GovernedWorldPersistenceDriver
{
  public readonly lineage: LineageStore;
  public readonly governance: GovernanceStore;
  private readonly context: SqliteContext;

  public constructor(options?: SqliteGovernedWorldPersistenceDriverOptions) {
    this.context = new SqliteContext(
      new DatabaseSync(options?.filename ?? ":memory:")
    );
    this.lineage = new SqliteLineageStore(this.context);
    this.governance = new SqliteGovernanceStore(this.context);
  }

  public close(): void {
    this.context.close();
  }

  async runInSealTransaction<T>(
    work: (tx: GovernedWorldPersistenceTx) => Promise<T>
  ): Promise<T> {
    try {
      return await this.context.withSavepoint("seal_tx", async () => {
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
        return await work(tx);
      });
    } catch (error) {
      wrapSealTransactionError(error);
    }
  }
}

export function createSqliteGovernedWorldPersistenceDriver(
  options?: SqliteGovernedWorldPersistenceDriverOptions
): SqliteGovernedWorldPersistenceDriver {
  return new SqliteGovernedWorldPersistenceDriver(options);
}
