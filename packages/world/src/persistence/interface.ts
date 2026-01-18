/**
 * World Store Interface
 *
 * Defines the persistence interface for World Protocol entities.
 *
 * Store Principles:
 * - S-1: Worlds, Edges, Decisions are immutable - store once, never update
 * - S-2: Proposals are mutable during lifecycle - update status only
 * - S-3: Bindings are mutable - can be updated for future proposals
 * - S-4: All operations should be idempotent where possible
 * - S-5: Queries should support common access patterns
 */
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
import type { Snapshot } from "@manifesto-ai/core";

// ============================================================================
// Query Types
// ============================================================================

/**
 * Query options for listing proposals
 */
export interface ProposalQuery {
  /** Filter by status */
  status?: ProposalStatus | ProposalStatus[];

  /** Filter by actor ID */
  actorId?: string;

  /** Filter by base world */
  baseWorld?: WorldId;

  /** Limit results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Query options for listing worlds
 */
export interface WorldQuery {
  /** Filter by schema hash */
  schemaHash?: string;

  /** Filter by created time range */
  createdAfter?: number;
  createdBefore?: number;

  /** Limit results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Query options for listing edges
 */
export interface EdgeQuery {
  /** Filter by source world */
  from?: WorldId;

  /** Filter by target world */
  to?: WorldId;

  /** Filter by proposal */
  proposalId?: ProposalId;

  /** Filter by decision */
  decisionId?: DecisionId;

  /** Limit results */
  limit?: number;
}

// ============================================================================
// Store Result Types
// ============================================================================

/**
 * Result of a store operation
 */
export interface StoreResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Result of a batch operation
 */
export interface BatchResult {
  success: boolean;
  processed: number;
  failed: number;
  errors?: string[];
}

// ============================================================================
// World Store Interface
// ============================================================================

/**
 * World Store - persistence interface for World Protocol
 *
 * Implementations:
 * - MemoryWorldStore: In-memory (for testing)
 * - Future: SQLite, PostgreSQL, etc.
 */
export interface WorldStore {
  // ==========================================================================
  // World Operations
  // ==========================================================================

  /**
   * Save a world (immutable - cannot overwrite)
   */
  saveWorld(world: World): Promise<StoreResult<World>>;

  /**
   * Get a world by ID
   */
  getWorld(worldId: WorldId): Promise<World | null>;

  /**
   * Check if a world exists
   */
  hasWorld(worldId: WorldId): Promise<boolean>;

  /**
   * List worlds matching query
   */
  listWorlds(query?: WorldQuery): Promise<World[]>;

  /**
   * Get the genesis world
   */
  getGenesis(): Promise<World | null>;

  /**
   * Set the genesis world (can only be set once)
   */
  setGenesis(worldId: WorldId): Promise<StoreResult<void>>;

  // ==========================================================================
  // Snapshot Operations
  // ==========================================================================

  /**
   * Save a snapshot associated with a world
   */
  saveSnapshot(worldId: WorldId, snapshot: Snapshot): Promise<StoreResult<void>>;

  /**
   * Get the snapshot for a world
   */
  getSnapshot(worldId: WorldId): Promise<Snapshot | null>;

  // ==========================================================================
  // Edge Operations
  // ==========================================================================

  /**
   * Save an edge (immutable - cannot overwrite)
   */
  saveEdge(edge: WorldEdge): Promise<StoreResult<WorldEdge>>;

  /**
   * Get an edge by ID
   */
  getEdge(edgeId: EdgeId): Promise<WorldEdge | null>;

  /**
   * Get the parent edge for a world (edge where world is the target)
   */
  getParentEdge(worldId: WorldId): Promise<WorldEdge | null>;

  /**
   * Get child edges for a world (edges where world is the source)
   */
  getChildEdges(worldId: WorldId): Promise<WorldEdge[]>;

  /**
   * List edges matching query
   */
  listEdges(query?: EdgeQuery): Promise<WorldEdge[]>;

  // ==========================================================================
  // Proposal Operations
  // ==========================================================================

  /**
   * Save a new proposal
   */
  saveProposal(proposal: Proposal): Promise<StoreResult<Proposal>>;

  /**
   * Update a proposal (status and execution tracking)
   */
  updateProposal(
    proposalId: ProposalId,
    updates: Partial<Pick<Proposal, "status" | "decisionId" | "resultWorld" | "decidedAt" | "completedAt" | "approvedScope">>
  ): Promise<StoreResult<Proposal>>;

  /**
   * Delete a proposal (ingress-stage drop)
   */
  deleteProposal(proposalId: ProposalId): Promise<StoreResult<void>>;

  /**
   * Get a proposal by ID
   */
  getProposal(proposalId: ProposalId): Promise<Proposal | null>;

  /**
   * Check if a proposal exists
   */
  hasProposal(proposalId: ProposalId): Promise<boolean>;

  /**
   * List proposals matching query
   */
  listProposals(query?: ProposalQuery): Promise<Proposal[]>;

  /**
   * Get evaluating proposals (shortcut for listProposals({ status: "evaluating" }))
   */
  getEvaluatingProposals(): Promise<Proposal[]>;

  // ==========================================================================
  // Decision Operations
  // ==========================================================================

  /**
   * Save a decision record (immutable - cannot overwrite)
   */
  saveDecision(decision: DecisionRecord): Promise<StoreResult<DecisionRecord>>;

  /**
   * Get a decision by ID
   */
  getDecision(decisionId: DecisionId): Promise<DecisionRecord | null>;

  /**
   * Get the decision for a proposal
   */
  getDecisionByProposal(proposalId: ProposalId): Promise<DecisionRecord | null>;

  /**
   * Check if a decision exists
   */
  hasDecision(decisionId: DecisionId): Promise<boolean>;

  // ==========================================================================
  // Binding Operations
  // ==========================================================================

  /**
   * Save or update an actor binding
   */
  saveBinding(binding: ActorAuthorityBinding): Promise<StoreResult<ActorAuthorityBinding>>;

  /**
   * Get binding for an actor
   */
  getBinding(actorId: string): Promise<ActorAuthorityBinding | null>;

  /**
   * Remove binding for an actor
   */
  removeBinding(actorId: string): Promise<StoreResult<void>>;

  /**
   * List all bindings
   */
  listBindings(): Promise<ActorAuthorityBinding[]>;

  // ==========================================================================
  // Utility Operations
  // ==========================================================================

  /**
   * Clear all data (for testing)
   */
  clear(): Promise<void>;

  /**
   * Get store statistics
   */
  getStats(): Promise<{
    worlds: number;
    edges: number;
    proposals: number;
    decisions: number;
    bindings: number;
    snapshots: number;
  }>;
}

// ============================================================================
// Store Events (for reactive updates)
// ============================================================================

/**
 * Store event types
 */
export type StoreEventType =
  | "world:saved"
  | "edge:saved"
  | "proposal:saved"
  | "proposal:updated"
  | "proposal:deleted"
  | "decision:saved"
  | "binding:saved"
  | "binding:removed"
  | "genesis:set";

/**
 * Store event payload
 */
export interface StoreEvent<T = unknown> {
  type: StoreEventType;
  timestamp: number;
  data: T;
}

/**
 * Store event listener
 */
export type StoreEventListener<T = unknown> = (event: StoreEvent<T>) => void;

/**
 * Observable store interface (optional extension)
 */
export interface ObservableWorldStore extends WorldStore {
  /**
   * Subscribe to store events
   */
  subscribe(type: StoreEventType, listener: StoreEventListener): () => void;

  /**
   * Subscribe to all events
   */
  subscribeAll(listener: StoreEventListener): () => void;
}
