/**
 * World Lineage DAG
 *
 * Manages the directed acyclic graph of World transitions.
 *
 * Invariants:
 * - LI-1: Lineage MUST be a Directed Acyclic Graph (DAG)
 * - LI-2: Lineage MUST be append-only (no deletions or modifications)
 * - LI-3: Every non-genesis World MUST have exactly one parent (v1.0)
 * - LI-4: Every edge MUST reference valid Worlds
 * - LI-5: Every edge MUST reference valid Proposal and DecisionRecord
 * - LI-6: Cycles MUST be rejected at edge creation
 * - LI-7: Genesis World MUST have zero parents
 */
import type { World, WorldId, ProposalId, DecisionId, EdgeId } from "../schema/world.js";
import type { WorldEdge, LineagePath, CycleCheckResult } from "../schema/lineage.js";
import { createWorldError } from "../errors.js";
import { generateEdgeId } from "../factories.js";

/**
 * World Lineage - manages the DAG of worlds
 */
export class WorldLineage {
  /** All worlds indexed by worldId */
  private worlds: Map<string, World> = new Map();

  /** All edges indexed by edgeId */
  private edges: Map<string, WorldEdge> = new Map();

  /** Parent lookup: childId -> edgeId (for quick parent lookup) */
  private parentEdges: Map<string, string> = new Map();

  /** Children lookup: parentId -> Set<edgeId> (for quick children lookup) */
  private childrenEdges: Map<string, Set<string>> = new Map();

  /** Genesis world ID */
  private genesisId: WorldId | null = null;

  // ==========================================================================
  // Genesis Operations
  // ==========================================================================

  /**
   * Set the genesis world
   *
   * @param world - The genesis world (must have createdBy: null)
   * @throws WorldError if genesis already exists or world has parent
   */
  setGenesis(world: World): void {
    if (this.genesisId !== null) {
      throw createWorldError(
        "GENESIS_ALREADY_EXISTS",
        "Genesis world already exists",
        { existingGenesis: this.genesisId }
      );
    }

    if (world.createdBy !== null) {
      throw createWorldError(
        "INVALID_GENESIS",
        "Genesis world must have createdBy: null",
        { worldId: world.worldId, createdBy: world.createdBy }
      );
    }

    this.worlds.set(world.worldId, world);
    this.genesisId = world.worldId;
  }

  /**
   * Get the genesis world
   */
  getGenesis(): World | null {
    if (this.genesisId === null) return null;
    return this.worlds.get(this.genesisId) ?? null;
  }

  /**
   * Get the genesis world ID
   */
  getGenesisId(): WorldId | null {
    return this.genesisId;
  }

  /**
   * Check if genesis exists
   */
  hasGenesis(): boolean {
    return this.genesisId !== null;
  }

  // ==========================================================================
  // World Operations
  // ==========================================================================

  /**
   * Add a world to the lineage (without edge - use for genesis only)
   *
   * @param world - The world to add
   */
  addWorld(world: World): void {
    if (this.worlds.has(world.worldId)) {
      throw createWorldError(
        "WORLD_ALREADY_EXISTS",
        `World ${world.worldId} already exists in lineage`,
        { worldId: world.worldId }
      );
    }

    this.worlds.set(world.worldId, world);
  }

  /**
   * Add a world with its parent edge
   *
   * @param world - The new world
   * @param parentId - Parent world ID
   * @param proposalId - Proposal that created this world
   * @param decisionId - Decision that approved the proposal
   * @returns The created edge
   */
  addWorldWithEdge(
    world: World,
    parentId: WorldId,
    proposalId: ProposalId,
    decisionId: DecisionId
  ): WorldEdge {
    // Validate parent exists
    if (!this.worlds.has(parentId)) {
      throw createWorldError(
        "PARENT_NOT_FOUND",
        `Parent world ${parentId} not found`,
        { parentId, childId: world.worldId }
      );
    }

    // Check world doesn't already exist
    if (this.worlds.has(world.worldId)) {
      throw createWorldError(
        "WORLD_ALREADY_EXISTS",
        `World ${world.worldId} already exists in lineage`,
        { worldId: world.worldId }
      );
    }

    // Check for cycle (would creating edge from parent to child create a cycle?)
    // Since child is new, no cycle possible - but check anyway for safety
    const cycleCheck = this.wouldCreateCycle(parentId, world.worldId);
    if (cycleCheck.wouldCreateCycle) {
      throw createWorldError(
        "CYCLE_DETECTED",
        "Adding this edge would create a cycle",
        { from: parentId, to: world.worldId }
      );
    }

    // Add world first
    this.worlds.set(world.worldId, world);

    // Create edge
    const edge: WorldEdge = {
      edgeId: generateEdgeId(),
      from: parentId,
      to: world.worldId,
      proposalId,
      decisionId,
      createdAt: Date.now(),
    };

    // Add edge
    this.edges.set(edge.edgeId, edge);

    // Update parent lookup
    this.parentEdges.set(world.worldId, edge.edgeId);

    // Update children lookup
    if (!this.childrenEdges.has(parentId)) {
      this.childrenEdges.set(parentId, new Set());
    }
    this.childrenEdges.get(parentId)!.add(edge.edgeId);

    return edge;
  }

  /**
   * Get a world by ID
   */
  getWorld(worldId: WorldId): World | null {
    return this.worlds.get(worldId) ?? null;
  }

  /**
   * Check if a world exists
   */
  hasWorld(worldId: WorldId): boolean {
    return this.worlds.has(worldId);
  }

  /**
   * Get all worlds
   */
  getAllWorlds(): World[] {
    return Array.from(this.worlds.values());
  }

  /**
   * Get world count
   */
  getWorldCount(): number {
    return this.worlds.size;
  }

  // ==========================================================================
  // Edge Operations
  // ==========================================================================

  /**
   * Get an edge by ID
   */
  getEdge(edgeId: EdgeId): WorldEdge | null {
    return this.edges.get(edgeId) ?? null;
  }

  /**
   * Get all edges
   */
  getAllEdges(): WorldEdge[] {
    return Array.from(this.edges.values());
  }

  /**
   * Get edge count
   */
  getEdgeCount(): number {
    return this.edges.size;
  }

  /**
   * Get the parent edge for a world
   */
  getParentEdge(worldId: WorldId): WorldEdge | null {
    const edgeId = this.parentEdges.get(worldId);
    if (!edgeId) return null;
    return this.edges.get(edgeId) ?? null;
  }

  /**
   * Get the parent world for a world
   */
  getParent(worldId: WorldId): World | null {
    const edge = this.getParentEdge(worldId);
    if (!edge) return null;
    return this.worlds.get(edge.from) ?? null;
  }

  /**
   * Get children edges for a world
   */
  getChildrenEdges(worldId: WorldId): WorldEdge[] {
    const edgeIds = this.childrenEdges.get(worldId);
    if (!edgeIds) return [];
    return Array.from(edgeIds)
      .map((id) => this.edges.get(id))
      .filter((edge): edge is WorldEdge => edge !== undefined);
  }

  /**
   * Get children worlds for a world
   */
  getChildren(worldId: WorldId): World[] {
    const edges = this.getChildrenEdges(worldId);
    return edges
      .map((edge) => this.worlds.get(edge.to))
      .filter((world): world is World => world !== undefined);
  }

  /**
   * Check if a world has children
   */
  hasChildren(worldId: WorldId): boolean {
    const edgeIds = this.childrenEdges.get(worldId);
    return edgeIds !== undefined && edgeIds.size > 0;
  }

  /**
   * Check if a world is a leaf (no children)
   */
  isLeaf(worldId: WorldId): boolean {
    return !this.hasChildren(worldId);
  }

  // ==========================================================================
  // Lineage Traversal
  // ==========================================================================

  /**
   * Get all ancestors of a world (from immediate parent to genesis)
   */
  getAncestors(worldId: WorldId): World[] {
    const ancestors: World[] = [];
    let current = this.getParent(worldId);

    while (current !== null) {
      ancestors.push(current);
      current = this.getParent(current.worldId);
    }

    return ancestors;
  }

  /**
   * Get all descendants of a world (breadth-first)
   */
  getDescendants(worldId: WorldId): World[] {
    const descendants: World[] = [];
    const queue: WorldId[] = [worldId];
    const visited = new Set<string>([worldId]);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = this.getChildren(currentId);

      for (const child of children) {
        if (!visited.has(child.worldId)) {
          visited.add(child.worldId);
          descendants.push(child);
          queue.push(child.worldId);
        }
      }
    }

    return descendants;
  }

  /**
   * Get all leaf worlds (worlds with no children)
   */
  getLeaves(): World[] {
    return this.getAllWorlds().filter((world) => this.isLeaf(world.worldId));
  }

  /**
   * Get the depth of a world (distance from genesis)
   */
  getDepth(worldId: WorldId): number {
    let depth = 0;
    let current = this.getParent(worldId);

    while (current !== null) {
      depth++;
      current = this.getParent(current.worldId);
    }

    return depth;
  }

  /**
   * Find path from one world to another
   * Returns null if no path exists (not in same lineage branch)
   */
  findPath(fromId: WorldId, toId: WorldId): LineagePath | null {
    // Check both worlds exist
    if (!this.hasWorld(fromId) || !this.hasWorld(toId)) {
      return null;
    }

    // Same world - empty path
    if (fromId === toId) {
      return { from: fromId, to: toId, edges: [] };
    }

    // Try from -> to (descending path)
    const descendingPath = this.findDescendingPath(fromId, toId);
    if (descendingPath) {
      return { from: fromId, to: toId, edges: descendingPath };
    }

    // Try to -> from (ascending path, then reverse)
    const ascendingPath = this.findDescendingPath(toId, fromId);
    if (ascendingPath) {
      return { from: fromId, to: toId, edges: ascendingPath.reverse() };
    }

    // No direct path - find common ancestor
    return this.findPathViaCommonAncestor(fromId, toId);
  }

  /**
   * Find descending path (parent to child direction)
   */
  private findDescendingPath(fromId: WorldId, toId: WorldId): WorldEdge[] | null {
    const queue: { worldId: WorldId; path: WorldEdge[] }[] = [
      { worldId: fromId, path: [] },
    ];
    const visited = new Set<string>([fromId]);

    while (queue.length > 0) {
      const { worldId, path } = queue.shift()!;

      const childEdges = this.getChildrenEdges(worldId);
      for (const edge of childEdges) {
        if (edge.to === toId) {
          return [...path, edge];
        }

        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push({ worldId: edge.to, path: [...path, edge] });
        }
      }
    }

    return null;
  }

  /**
   * Find path via common ancestor
   */
  private findPathViaCommonAncestor(fromId: WorldId, toId: WorldId): LineagePath | null {
    const commonAncestor = this.findCommonAncestor(fromId, toId);
    if (!commonAncestor) return null;

    // Path from common ancestor to 'from'
    const pathToFrom = this.findDescendingPath(commonAncestor, fromId);
    // Path from common ancestor to 'to'
    const pathToTo = this.findDescendingPath(commonAncestor, toId);

    if (!pathToFrom || !pathToTo) return null;

    // Combine: reverse pathToFrom + pathToTo
    const edges = [...pathToFrom.reverse(), ...pathToTo];
    return { from: fromId, to: toId, edges };
  }

  /**
   * Find common ancestor of two worlds
   */
  findCommonAncestor(worldId1: WorldId, worldId2: WorldId): WorldId | null {
    // Get all ancestors of world1 (including itself)
    const ancestors1 = new Set<string>([worldId1]);
    let current = this.getParent(worldId1);
    while (current !== null) {
      ancestors1.add(current.worldId);
      current = this.getParent(current.worldId);
    }

    // Walk up from world2 and find first match
    if (ancestors1.has(worldId2)) return worldId2;
    current = this.getParent(worldId2);
    while (current !== null) {
      if (ancestors1.has(current.worldId)) {
        return current.worldId;
      }
      current = this.getParent(current.worldId);
    }

    return null;
  }

  /**
   * Check if world1 is an ancestor of world2
   */
  isAncestor(ancestorId: WorldId, descendantId: WorldId): boolean {
    let current = this.getParent(descendantId);
    while (current !== null) {
      if (current.worldId === ancestorId) return true;
      current = this.getParent(current.worldId);
    }
    return false;
  }

  /**
   * Check if world1 is a descendant of world2
   */
  isDescendant(descendantId: WorldId, ancestorId: WorldId): boolean {
    return this.isAncestor(ancestorId, descendantId);
  }

  // ==========================================================================
  // Cycle Detection
  // ==========================================================================

  /**
   * Check if adding an edge would create a cycle
   */
  wouldCreateCycle(fromId: WorldId, toId: WorldId): CycleCheckResult {
    // If 'from' is reachable from 'to', adding edge to->from would create cycle
    // But we're adding from->to, so we need to check if 'from' is reachable from 'to'
    // i.e., if 'to' is an ancestor of 'from'

    if (fromId === toId) {
      return { wouldCreateCycle: true };
    }

    // Check if toId is an ancestor of fromId
    const path: WorldEdge[] = [];
    let current = fromId;
    let parentEdge = this.getParentEdge(current);

    while (parentEdge !== null) {
      path.push(parentEdge);
      if (parentEdge.from === toId) {
        return { wouldCreateCycle: true, existingPath: path };
      }
      current = parentEdge.from;
      parentEdge = this.getParentEdge(current);
    }

    return { wouldCreateCycle: false };
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  /**
   * Get all worlds created by a specific proposal
   */
  getWorldsByProposal(proposalId: ProposalId): World[] {
    return this.getAllWorlds().filter(
      (world) => world.createdBy === proposalId
    );
  }

  /**
   * Get edges for a specific proposal
   */
  getEdgesByProposal(proposalId: ProposalId): WorldEdge[] {
    return this.getAllEdges().filter((edge) => edge.proposalId === proposalId);
  }

  /**
   * Get edges for a specific decision
   */
  getEdgesByDecision(decisionId: DecisionId): WorldEdge[] {
    return this.getAllEdges().filter((edge) => edge.decisionId === decisionId);
  }

  /**
   * Get the lineage depth (maximum depth of any world)
   */
  getMaxDepth(): number {
    let maxDepth = 0;
    for (const world of this.getAllWorlds()) {
      const depth = this.getDepth(world.worldId);
      if (depth > maxDepth) maxDepth = depth;
    }
    return maxDepth;
  }

  /**
   * Get the lineage width at a specific depth
   */
  getWidthAtDepth(depth: number): number {
    return this.getAllWorlds().filter(
      (world) => this.getDepth(world.worldId) === depth
    ).length;
  }

  /**
   * Get worlds at a specific depth
   */
  getWorldsAtDepth(depth: number): World[] {
    return this.getAllWorlds().filter(
      (world) => this.getDepth(world.worldId) === depth
    );
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate the lineage invariants
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // LI-7: Genesis must have zero parents
    if (this.genesisId !== null) {
      const genesisParent = this.getParent(this.genesisId);
      if (genesisParent !== null) {
        errors.push(`LI-7: Genesis ${this.genesisId} has a parent`);
      }
    }

    // LI-3: Every non-genesis world must have exactly one parent
    for (const world of this.getAllWorlds()) {
      if (world.worldId === this.genesisId) continue;

      const parentEdge = this.getParentEdge(world.worldId);
      if (parentEdge === null) {
        errors.push(`LI-3: World ${world.worldId} has no parent (not genesis)`);
      }
    }

    // LI-4: Every edge must reference valid worlds
    for (const edge of this.getAllEdges()) {
      if (!this.hasWorld(edge.from)) {
        errors.push(`LI-4: Edge ${edge.edgeId} references invalid from: ${edge.from}`);
      }
      if (!this.hasWorld(edge.to)) {
        errors.push(`LI-4: Edge ${edge.edgeId} references invalid to: ${edge.to}`);
      }
    }

    // LI-1: Check for cycles (should never happen if we validate on add)
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const hasCycle = (worldId: string): boolean => {
      if (inStack.has(worldId)) return true;
      if (visited.has(worldId)) return false;

      visited.add(worldId);
      inStack.add(worldId);

      for (const child of this.getChildren(worldId as WorldId)) {
        if (hasCycle(child.worldId)) return true;
      }

      inStack.delete(worldId);
      return false;
    };

    if (this.genesisId !== null && hasCycle(this.genesisId)) {
      errors.push("LI-1: Cycle detected in lineage");
    }

    return { valid: errors.length === 0, errors };
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  /**
   * Export lineage state for persistence
   */
  toJSON(): {
    worlds: World[];
    edges: WorldEdge[];
    genesis: WorldId | null;
  } {
    return {
      worlds: this.getAllWorlds(),
      edges: this.getAllEdges(),
      genesis: this.genesisId,
    };
  }

  /**
   * Import lineage state from persistence
   */
  static fromJSON(data: {
    worlds: World[];
    edges: WorldEdge[];
    genesis: WorldId | null;
  }): WorldLineage {
    const lineage = new WorldLineage();

    // Add all worlds first
    for (const world of data.worlds) {
      lineage.worlds.set(world.worldId, world);
    }

    // Set genesis
    lineage.genesisId = data.genesis;

    // Add all edges and rebuild lookup tables
    for (const edge of data.edges) {
      lineage.edges.set(edge.edgeId, edge);
      lineage.parentEdges.set(edge.to, edge.edgeId);

      if (!lineage.childrenEdges.has(edge.from)) {
        lineage.childrenEdges.set(edge.from, new Set());
      }
      lineage.childrenEdges.get(edge.from)!.add(edge.edgeId);
    }

    return lineage;
  }

  /**
   * Clear the lineage (for testing)
   */
  clear(): void {
    this.worlds.clear();
    this.edges.clear();
    this.parentEdges.clear();
    this.childrenEdges.clear();
    this.genesisId = null;
  }
}

/**
 * Create a new WorldLineage instance
 */
export function createWorldLineage(): WorldLineage {
  return new WorldLineage();
}
