/**
 * Memory World Store
 *
 * In-memory implementation of WorldStore for testing and development.
 *
 * Features:
 * - Full WorldStore interface implementation
 * - Observable events for reactive updates
 * - Thread-safe (single-threaded JS)
 * - Serialization support for debugging
 */
import type { Snapshot } from "@manifesto-ai/core";
import type {
  World,
  WorldId,
  WorldEdge,
  EdgeId,
  Proposal,
  ProposalId,
  DecisionRecord,
  DecisionId,
  ActorAuthorityBinding,
  ProposalStatus,
} from "../schema/index.js";
import type {
  WorldStore,
  ObservableWorldStore,
  ProposalQuery,
  WorldQuery,
  EdgeQuery,
  StoreResult,
  StoreEventType,
  StoreEvent,
  StoreEventListener,
} from "./interface.js";
import { createWorldError } from "../errors.js";

// ============================================================================
// Memory World Store Implementation
// ============================================================================

/**
 * In-memory implementation of WorldStore
 */
export class MemoryWorldStore implements ObservableWorldStore {
  // Internal storage
  private worlds: Map<string, World> = new Map();
  private snapshots: Map<string, Snapshot> = new Map();
  private edges: Map<string, WorldEdge> = new Map();
  private proposals: Map<string, Proposal> = new Map();
  private decisions: Map<string, DecisionRecord> = new Map();
  private bindings: Map<string, ActorAuthorityBinding> = new Map();

  // Indexes for efficient queries
  private edgesBySource: Map<string, Set<string>> = new Map();
  private edgesByTarget: Map<string, Set<string>> = new Map();
  private decisionsByProposal: Map<string, string> = new Map();

  // Genesis tracking
  private genesisId: WorldId | null = null;

  // Event listeners
  private listeners: Map<StoreEventType | "*", Set<StoreEventListener>> = new Map();

  // ==========================================================================
  // World Operations
  // ==========================================================================

  async saveWorld(world: World): Promise<StoreResult<World>> {
    const id = world.worldId as string;

    if (this.worlds.has(id)) {
      return {
        success: false,
        error: `World '${id}' already exists (worlds are immutable)`,
      };
    }

    this.worlds.set(id, world);
    this.emit("world:saved", world);

    return { success: true, data: world };
  }

  async getWorld(worldId: WorldId): Promise<World | null> {
    return this.worlds.get(worldId as string) ?? null;
  }

  async hasWorld(worldId: WorldId): Promise<boolean> {
    return this.worlds.has(worldId as string);
  }

  async listWorlds(query?: WorldQuery): Promise<World[]> {
    let results = Array.from(this.worlds.values());

    if (query) {
      if (query.schemaHash) {
        results = results.filter((w) => w.schemaHash === query.schemaHash);
      }
      if (query.createdAfter !== undefined) {
        results = results.filter((w) => w.createdAt >= query.createdAfter!);
      }
      if (query.createdBefore !== undefined) {
        results = results.filter((w) => w.createdAt <= query.createdBefore!);
      }

      // Sort by createdAt descending (newest first)
      results.sort((a, b) => b.createdAt - a.createdAt);

      if (query.offset) {
        results = results.slice(query.offset);
      }
      if (query.limit) {
        results = results.slice(0, query.limit);
      }
    }

    return results;
  }

  async getGenesis(): Promise<World | null> {
    if (!this.genesisId) return null;
    return this.getWorld(this.genesisId);
  }

  async setGenesis(worldId: WorldId): Promise<StoreResult<void>> {
    if (this.genesisId !== null) {
      return {
        success: false,
        error: `Genesis already set to '${this.genesisId}'`,
      };
    }

    if (!this.worlds.has(worldId as string)) {
      return {
        success: false,
        error: `World '${worldId}' does not exist`,
      };
    }

    this.genesisId = worldId;
    this.emit("genesis:set", { worldId });

    return { success: true };
  }

  // ==========================================================================
  // Snapshot Operations
  // ==========================================================================

  async saveSnapshot(worldId: WorldId, snapshot: Snapshot): Promise<StoreResult<void>> {
    const id = worldId as string;

    if (!this.worlds.has(id)) {
      return {
        success: false,
        error: `World '${id}' does not exist`,
      };
    }

    this.snapshots.set(id, snapshot);
    return { success: true };
  }

  async getSnapshot(worldId: WorldId): Promise<Snapshot | null> {
    return this.snapshots.get(worldId as string) ?? null;
  }

  // ==========================================================================
  // Edge Operations
  // ==========================================================================

  async saveEdge(edge: WorldEdge): Promise<StoreResult<WorldEdge>> {
    const id = edge.edgeId as string;

    if (this.edges.has(id)) {
      return {
        success: false,
        error: `Edge '${id}' already exists (edges are immutable)`,
      };
    }

    // Validate referenced worlds exist
    if (!this.worlds.has(edge.from as string)) {
      return {
        success: false,
        error: `Source world '${edge.from}' does not exist`,
      };
    }
    if (!this.worlds.has(edge.to as string)) {
      return {
        success: false,
        error: `Target world '${edge.to}' does not exist`,
      };
    }

    // Save edge
    this.edges.set(id, edge);

    // Update indexes
    const fromId = edge.from as string;
    const toId = edge.to as string;

    if (!this.edgesBySource.has(fromId)) {
      this.edgesBySource.set(fromId, new Set());
    }
    this.edgesBySource.get(fromId)!.add(id);

    if (!this.edgesByTarget.has(toId)) {
      this.edgesByTarget.set(toId, new Set());
    }
    this.edgesByTarget.get(toId)!.add(id);

    this.emit("edge:saved", edge);

    return { success: true, data: edge };
  }

  async getEdge(edgeId: EdgeId): Promise<WorldEdge | null> {
    return this.edges.get(edgeId as string) ?? null;
  }

  async getParentEdge(worldId: WorldId): Promise<WorldEdge | null> {
    const edgeIds = this.edgesByTarget.get(worldId as string);
    if (!edgeIds || edgeIds.size === 0) return null;

    // In v1.0 fork-only model, there should be at most one parent edge
    const firstId = edgeIds.values().next().value;
    return firstId ? this.edges.get(firstId) ?? null : null;
  }

  async getChildEdges(worldId: WorldId): Promise<WorldEdge[]> {
    const edgeIds = this.edgesBySource.get(worldId as string);
    if (!edgeIds) return [];

    return Array.from(edgeIds)
      .map((id) => this.edges.get(id)!)
      .filter(Boolean);
  }

  async listEdges(query?: EdgeQuery): Promise<WorldEdge[]> {
    let results = Array.from(this.edges.values());

    if (query) {
      if (query.from) {
        results = results.filter((e) => e.from === query.from);
      }
      if (query.to) {
        results = results.filter((e) => e.to === query.to);
      }
      if (query.proposalId) {
        results = results.filter((e) => e.proposalId === query.proposalId);
      }
      if (query.decisionId) {
        results = results.filter((e) => e.decisionId === query.decisionId);
      }

      // Sort by createdAt ascending (oldest first)
      results.sort((a, b) => a.createdAt - b.createdAt);

      if (query.limit) {
        results = results.slice(0, query.limit);
      }
    }

    return results;
  }

  // ==========================================================================
  // Proposal Operations
  // ==========================================================================

  async saveProposal(proposal: Proposal): Promise<StoreResult<Proposal>> {
    const id = proposal.proposalId as string;

    if (this.proposals.has(id)) {
      return {
        success: false,
        error: `Proposal '${id}' already exists`,
      };
    }

    this.proposals.set(id, proposal);
    this.emit("proposal:saved", proposal);

    return { success: true, data: proposal };
  }

  async updateProposal(
    proposalId: ProposalId,
    updates: Partial<Pick<Proposal, "status" | "decisionId" | "resultWorld" | "decidedAt" | "completedAt">>
  ): Promise<StoreResult<Proposal>> {
    const id = proposalId as string;
    const existing = this.proposals.get(id);

    if (!existing) {
      return {
        success: false,
        error: `Proposal '${id}' not found`,
      };
    }

    const updated: Proposal = {
      ...existing,
      ...updates,
    };

    this.proposals.set(id, updated);
    this.emit("proposal:updated", updated);

    return { success: true, data: updated };
  }

  async getProposal(proposalId: ProposalId): Promise<Proposal | null> {
    return this.proposals.get(proposalId as string) ?? null;
  }

  async hasProposal(proposalId: ProposalId): Promise<boolean> {
    return this.proposals.has(proposalId as string);
  }

  async listProposals(query?: ProposalQuery): Promise<Proposal[]> {
    let results = Array.from(this.proposals.values());

    if (query) {
      if (query.status) {
        const statuses = Array.isArray(query.status) ? query.status : [query.status];
        results = results.filter((p) => statuses.includes(p.status));
      }
      if (query.actorId) {
        results = results.filter((p) => p.actor.actorId === query.actorId);
      }
      if (query.baseWorld) {
        results = results.filter((p) => p.baseWorld === query.baseWorld);
      }

      // Sort by submittedAt descending (newest first)
      results.sort((a, b) => b.submittedAt - a.submittedAt);

      if (query.offset) {
        results = results.slice(query.offset);
      }
      if (query.limit) {
        results = results.slice(0, query.limit);
      }
    }

    return results;
  }

  async getPendingProposals(): Promise<Proposal[]> {
    return this.listProposals({ status: "pending" });
  }

  // ==========================================================================
  // Decision Operations
  // ==========================================================================

  async saveDecision(decision: DecisionRecord): Promise<StoreResult<DecisionRecord>> {
    const id = decision.decisionId as string;

    if (this.decisions.has(id)) {
      return {
        success: false,
        error: `Decision '${id}' already exists (decisions are immutable)`,
      };
    }

    // Check if proposal already has a decision
    const proposalId = decision.proposalId as string;
    if (this.decisionsByProposal.has(proposalId)) {
      return {
        success: false,
        error: `Proposal '${proposalId}' already has a decision`,
      };
    }

    this.decisions.set(id, decision);
    this.decisionsByProposal.set(proposalId, id);
    this.emit("decision:saved", decision);

    return { success: true, data: decision };
  }

  async getDecision(decisionId: DecisionId): Promise<DecisionRecord | null> {
    return this.decisions.get(decisionId as string) ?? null;
  }

  async getDecisionByProposal(proposalId: ProposalId): Promise<DecisionRecord | null> {
    const decisionId = this.decisionsByProposal.get(proposalId as string);
    if (!decisionId) return null;
    return this.decisions.get(decisionId) ?? null;
  }

  async hasDecision(decisionId: DecisionId): Promise<boolean> {
    return this.decisions.has(decisionId as string);
  }

  // ==========================================================================
  // Binding Operations
  // ==========================================================================

  async saveBinding(binding: ActorAuthorityBinding): Promise<StoreResult<ActorAuthorityBinding>> {
    const id = binding.actor.actorId;
    this.bindings.set(id, binding);
    this.emit("binding:saved", binding);
    return { success: true, data: binding };
  }

  async getBinding(actorId: string): Promise<ActorAuthorityBinding | null> {
    return this.bindings.get(actorId) ?? null;
  }

  async removeBinding(actorId: string): Promise<StoreResult<void>> {
    if (!this.bindings.has(actorId)) {
      return {
        success: false,
        error: `Binding for actor '${actorId}' not found`,
      };
    }

    const binding = this.bindings.get(actorId);
    this.bindings.delete(actorId);
    this.emit("binding:removed", { actorId, binding });

    return { success: true };
  }

  async listBindings(): Promise<ActorAuthorityBinding[]> {
    return Array.from(this.bindings.values());
  }

  // ==========================================================================
  // Utility Operations
  // ==========================================================================

  async clear(): Promise<void> {
    this.worlds.clear();
    this.snapshots.clear();
    this.edges.clear();
    this.proposals.clear();
    this.decisions.clear();
    this.bindings.clear();
    this.edgesBySource.clear();
    this.edgesByTarget.clear();
    this.decisionsByProposal.clear();
    this.genesisId = null;
  }

  async getStats(): Promise<{
    worlds: number;
    edges: number;
    proposals: number;
    decisions: number;
    bindings: number;
    snapshots: number;
  }> {
    return {
      worlds: this.worlds.size,
      edges: this.edges.size,
      proposals: this.proposals.size,
      decisions: this.decisions.size,
      bindings: this.bindings.size,
      snapshots: this.snapshots.size,
    };
  }

  // ==========================================================================
  // Observable Implementation
  // ==========================================================================

  subscribe(type: StoreEventType, listener: StoreEventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  subscribeAll(listener: StoreEventListener): () => void {
    if (!this.listeners.has("*")) {
      this.listeners.set("*", new Set());
    }
    this.listeners.get("*")!.add(listener);

    return () => {
      this.listeners.get("*")?.delete(listener);
    };
  }

  private emit<T>(type: StoreEventType, data: T): void {
    const event: StoreEvent<T> = {
      type,
      timestamp: Date.now(),
      data,
    };

    // Notify specific listeners
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        try {
          listener(event);
        } catch {
          // Ignore listener errors
        }
      }
    }

    // Notify wildcard listeners
    const allListeners = this.listeners.get("*");
    if (allListeners) {
      for (const listener of allListeners) {
        try {
          listener(event);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }

  // ==========================================================================
  // Serialization (for debugging)
  // ==========================================================================

  /**
   * Export store state to JSON-serializable object
   */
  toJSON(): {
    worlds: World[];
    snapshots: { worldId: string; snapshot: Snapshot }[];
    edges: WorldEdge[];
    proposals: Proposal[];
    decisions: DecisionRecord[];
    bindings: ActorAuthorityBinding[];
    genesisId: string | null;
  } {
    return {
      worlds: Array.from(this.worlds.values()),
      snapshots: Array.from(this.snapshots.entries()).map(([worldId, snapshot]) => ({
        worldId,
        snapshot,
      })),
      edges: Array.from(this.edges.values()),
      proposals: Array.from(this.proposals.values()),
      decisions: Array.from(this.decisions.values()),
      bindings: Array.from(this.bindings.values()),
      genesisId: this.genesisId as string | null,
    };
  }

  /**
   * Import store state from JSON object
   */
  static fromJSON(data: {
    worlds: World[];
    snapshots?: { worldId: string; snapshot: Snapshot }[];
    edges: WorldEdge[];
    proposals: Proposal[];
    decisions: DecisionRecord[];
    bindings: ActorAuthorityBinding[];
    genesisId: string | null;
  }): MemoryWorldStore {
    const store = new MemoryWorldStore();

    // Restore worlds
    for (const world of data.worlds) {
      store.worlds.set(world.worldId as string, world);
    }

    // Restore snapshots
    if (data.snapshots) {
      for (const { worldId, snapshot } of data.snapshots) {
        store.snapshots.set(worldId, snapshot);
      }
    }

    // Restore edges and rebuild indexes
    for (const edge of data.edges) {
      store.edges.set(edge.edgeId as string, edge);

      const fromId = edge.from as string;
      const toId = edge.to as string;

      if (!store.edgesBySource.has(fromId)) {
        store.edgesBySource.set(fromId, new Set());
      }
      store.edgesBySource.get(fromId)!.add(edge.edgeId as string);

      if (!store.edgesByTarget.has(toId)) {
        store.edgesByTarget.set(toId, new Set());
      }
      store.edgesByTarget.get(toId)!.add(edge.edgeId as string);
    }

    // Restore proposals
    for (const proposal of data.proposals) {
      store.proposals.set(proposal.proposalId as string, proposal);
    }

    // Restore decisions and rebuild index
    for (const decision of data.decisions) {
      store.decisions.set(decision.decisionId as string, decision);
      store.decisionsByProposal.set(
        decision.proposalId as string,
        decision.decisionId as string
      );
    }

    // Restore bindings
    for (const binding of data.bindings) {
      store.bindings.set(binding.actor.actorId, binding);
    }

    // Restore genesis
    if (data.genesisId) {
      store.genesisId = data.genesisId as WorldId;
    }

    return store;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new MemoryWorldStore
 */
export function createMemoryWorldStore(): MemoryWorldStore {
  return new MemoryWorldStore();
}
