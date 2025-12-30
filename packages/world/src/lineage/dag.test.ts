/**
 * World Lineage DAG Tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { WorldLineage, createWorldLineage } from "./dag.js";
import type { World } from "../schema/world.js";
import {
  createWorldId,
  createProposalId,
  createDecisionId,
  type WorldId,
  type ProposalId,
  type DecisionId,
} from "../schema/world.js";

// ============================================================================
// Test Helpers
// ============================================================================

let worldCounter = 0;

function createTestWorld(overrides?: Partial<World>): World {
  worldCounter++;
  return {
    worldId: createWorldId(`world-${worldCounter}`),
    schemaHash: "schema-abc123",
    snapshotHash: `snapshot-${worldCounter}`,
    createdAt: Date.now(),
    createdBy: overrides?.createdBy ?? createProposalId(`proposal-${worldCounter}`),
    ...overrides,
  };
}

function createGenesisTestWorld(): World {
  return createTestWorld({ createdBy: null });
}

// ============================================================================
// Genesis Tests
// ============================================================================

describe("WorldLineage", () => {
  let lineage: WorldLineage;

  beforeEach(() => {
    lineage = createWorldLineage();
    worldCounter = 0;
  });

  describe("genesis operations", () => {
    it("should create lineage via factory", () => {
      expect(lineage).toBeInstanceOf(WorldLineage);
    });

    it("should not have genesis initially", () => {
      expect(lineage.hasGenesis()).toBe(false);
      expect(lineage.getGenesis()).toBeNull();
      expect(lineage.getGenesisId()).toBeNull();
    });

    it("should set genesis world", () => {
      const genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      expect(lineage.hasGenesis()).toBe(true);
      expect(lineage.getGenesis()).toEqual(genesis);
      expect(lineage.getGenesisId()).toBe(genesis.worldId);
    });

    it("should throw when setting genesis twice", () => {
      const genesis1 = createGenesisTestWorld();
      const genesis2 = createGenesisTestWorld();

      lineage.setGenesis(genesis1);

      expect(() => lineage.setGenesis(genesis2)).toThrow("Genesis world already exists");
    });

    it("should throw when genesis has createdBy", () => {
      const invalidGenesis = createTestWorld(); // has createdBy

      expect(() => lineage.setGenesis(invalidGenesis)).toThrow("must have createdBy: null");
    });
  });

  // ==========================================================================
  // World Operations Tests
  // ==========================================================================

  describe("world operations", () => {
    it("should add world directly", () => {
      const world = createTestWorld();
      lineage.addWorld(world);

      expect(lineage.hasWorld(world.worldId)).toBe(true);
      expect(lineage.getWorld(world.worldId)).toEqual(world);
    });

    it("should throw when adding duplicate world", () => {
      const world = createTestWorld();
      lineage.addWorld(world);

      expect(() => lineage.addWorld(world)).toThrow("already exists in lineage");
    });

    it("should get all worlds", () => {
      const genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      expect(lineage.getAllWorlds()).toHaveLength(1);
      expect(lineage.getWorldCount()).toBe(1);
    });

    it("should return null for non-existent world", () => {
      expect(lineage.getWorld(createWorldId("non-existent"))).toBeNull();
      expect(lineage.hasWorld(createWorldId("non-existent"))).toBe(false);
    });

    it("should add world with edge", () => {
      const genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      const child = createTestWorld();
      const proposalId = createProposalId("prop-1");
      const decisionId = createDecisionId("dec-1");

      const edge = lineage.addWorldWithEdge(child, genesis.worldId, proposalId, decisionId);

      expect(edge).toBeDefined();
      expect(edge.from).toBe(genesis.worldId);
      expect(edge.to).toBe(child.worldId);
      expect(edge.proposalId).toBe(proposalId);
      expect(edge.decisionId).toBe(decisionId);

      expect(lineage.getWorldCount()).toBe(2);
      expect(lineage.getEdgeCount()).toBe(1);
    });

    it("should throw when adding world with non-existent parent", () => {
      const child = createTestWorld();
      const proposalId = createProposalId("prop-1");
      const decisionId = createDecisionId("dec-1");

      expect(() =>
        lineage.addWorldWithEdge(
          child,
          createWorldId("non-existent"),
          proposalId,
          decisionId
        )
      ).toThrow("Parent world");
    });

    it("should throw when adding duplicate world with edge", () => {
      const genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      const child = createTestWorld();
      const proposalId = createProposalId("prop-1");
      const decisionId = createDecisionId("dec-1");

      lineage.addWorldWithEdge(child, genesis.worldId, proposalId, decisionId);

      expect(() =>
        lineage.addWorldWithEdge(child, genesis.worldId, proposalId, decisionId)
      ).toThrow("already exists in lineage");
    });
  });

  // ==========================================================================
  // Edge Operations Tests
  // ==========================================================================

  describe("edge operations", () => {
    let genesis: World;
    let child1: World;
    let child2: World;

    beforeEach(() => {
      genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      child1 = createTestWorld();
      child2 = createTestWorld();

      lineage.addWorldWithEdge(
        child1,
        genesis.worldId,
        createProposalId("p1"),
        createDecisionId("d1")
      );
      lineage.addWorldWithEdge(
        child2,
        genesis.worldId,
        createProposalId("p2"),
        createDecisionId("d2")
      );
    });

    it("should get edge by id", () => {
      const edges = lineage.getAllEdges();
      const edge = lineage.getEdge(edges[0].edgeId);

      expect(edge).toBeDefined();
      expect(edge?.from).toBe(genesis.worldId);
    });

    it("should return null for non-existent edge", () => {
      expect(lineage.getEdge(createWorldId("non-existent") as any)).toBeNull();
    });

    it("should get all edges", () => {
      expect(lineage.getAllEdges()).toHaveLength(2);
      expect(lineage.getEdgeCount()).toBe(2);
    });

    it("should get parent edge", () => {
      const parentEdge = lineage.getParentEdge(child1.worldId);

      expect(parentEdge).toBeDefined();
      expect(parentEdge?.from).toBe(genesis.worldId);
      expect(parentEdge?.to).toBe(child1.worldId);
    });

    it("should return null parent edge for genesis", () => {
      expect(lineage.getParentEdge(genesis.worldId)).toBeNull();
    });

    it("should get parent world", () => {
      const parent = lineage.getParent(child1.worldId);

      expect(parent).toEqual(genesis);
    });

    it("should return null parent for genesis", () => {
      expect(lineage.getParent(genesis.worldId)).toBeNull();
    });

    it("should get children edges", () => {
      const childrenEdges = lineage.getChildrenEdges(genesis.worldId);

      expect(childrenEdges).toHaveLength(2);
    });

    it("should get children worlds", () => {
      const children = lineage.getChildren(genesis.worldId);

      expect(children).toHaveLength(2);
      expect(children.map((w) => w.worldId)).toContain(child1.worldId);
      expect(children.map((w) => w.worldId)).toContain(child2.worldId);
    });

    it("should return empty array for children of leaf", () => {
      expect(lineage.getChildren(child1.worldId)).toHaveLength(0);
      expect(lineage.getChildrenEdges(child1.worldId)).toHaveLength(0);
    });

    it("should check if world has children", () => {
      expect(lineage.hasChildren(genesis.worldId)).toBe(true);
      expect(lineage.hasChildren(child1.worldId)).toBe(false);
    });

    it("should check if world is leaf", () => {
      expect(lineage.isLeaf(genesis.worldId)).toBe(false);
      expect(lineage.isLeaf(child1.worldId)).toBe(true);
    });
  });

  // ==========================================================================
  // Lineage Traversal Tests
  // ==========================================================================

  describe("lineage traversal", () => {
    let genesis: World;
    let child1: World;
    let grandchild1: World;
    let grandchild2: World;
    let greatGrandchild: World;

    beforeEach(() => {
      // Build a tree:
      //        genesis
      //           |
      //        child1
      //        /    \
      //   grandchild1  grandchild2
      //       |
      //  greatGrandchild

      genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      child1 = createTestWorld();
      lineage.addWorldWithEdge(
        child1,
        genesis.worldId,
        createProposalId("p1"),
        createDecisionId("d1")
      );

      grandchild1 = createTestWorld();
      lineage.addWorldWithEdge(
        grandchild1,
        child1.worldId,
        createProposalId("p2"),
        createDecisionId("d2")
      );

      grandchild2 = createTestWorld();
      lineage.addWorldWithEdge(
        grandchild2,
        child1.worldId,
        createProposalId("p3"),
        createDecisionId("d3")
      );

      greatGrandchild = createTestWorld();
      lineage.addWorldWithEdge(
        greatGrandchild,
        grandchild1.worldId,
        createProposalId("p4"),
        createDecisionId("d4")
      );
    });

    it("should get ancestors", () => {
      const ancestors = lineage.getAncestors(greatGrandchild.worldId);

      expect(ancestors).toHaveLength(3);
      expect(ancestors[0].worldId).toBe(grandchild1.worldId);
      expect(ancestors[1].worldId).toBe(child1.worldId);
      expect(ancestors[2].worldId).toBe(genesis.worldId);
    });

    it("should return empty ancestors for genesis", () => {
      expect(lineage.getAncestors(genesis.worldId)).toHaveLength(0);
    });

    it("should get descendants", () => {
      const descendants = lineage.getDescendants(genesis.worldId);

      expect(descendants).toHaveLength(4);
    });

    it("should return empty descendants for leaf", () => {
      expect(lineage.getDescendants(greatGrandchild.worldId)).toHaveLength(0);
    });

    it("should get all leaves", () => {
      const leaves = lineage.getLeaves();

      expect(leaves).toHaveLength(2);
      expect(leaves.map((w) => w.worldId)).toContain(grandchild2.worldId);
      expect(leaves.map((w) => w.worldId)).toContain(greatGrandchild.worldId);
    });

    it("should get depth", () => {
      expect(lineage.getDepth(genesis.worldId)).toBe(0);
      expect(lineage.getDepth(child1.worldId)).toBe(1);
      expect(lineage.getDepth(grandchild1.worldId)).toBe(2);
      expect(lineage.getDepth(greatGrandchild.worldId)).toBe(3);
    });

    it("should get max depth", () => {
      expect(lineage.getMaxDepth()).toBe(3);
    });

    it("should get width at depth", () => {
      expect(lineage.getWidthAtDepth(0)).toBe(1); // genesis
      expect(lineage.getWidthAtDepth(1)).toBe(1); // child1
      expect(lineage.getWidthAtDepth(2)).toBe(2); // grandchild1, grandchild2
      expect(lineage.getWidthAtDepth(3)).toBe(1); // greatGrandchild
    });

    it("should get worlds at depth", () => {
      const worldsAtDepth2 = lineage.getWorldsAtDepth(2);

      expect(worldsAtDepth2).toHaveLength(2);
      expect(worldsAtDepth2.map((w) => w.worldId)).toContain(grandchild1.worldId);
      expect(worldsAtDepth2.map((w) => w.worldId)).toContain(grandchild2.worldId);
    });
  });

  // ==========================================================================
  // Path Finding Tests
  // ==========================================================================

  describe("path finding", () => {
    let genesis: World;
    let child1: World;
    let child2: World;
    let grandchild1: World;

    beforeEach(() => {
      // Build a tree:
      //      genesis
      //      /     \
      //   child1  child2
      //     |
      //  grandchild1

      genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      child1 = createTestWorld();
      lineage.addWorldWithEdge(
        child1,
        genesis.worldId,
        createProposalId("p1"),
        createDecisionId("d1")
      );

      child2 = createTestWorld();
      lineage.addWorldWithEdge(
        child2,
        genesis.worldId,
        createProposalId("p2"),
        createDecisionId("d2")
      );

      grandchild1 = createTestWorld();
      lineage.addWorldWithEdge(
        grandchild1,
        child1.worldId,
        createProposalId("p3"),
        createDecisionId("d3")
      );
    });

    it("should find path from parent to child", () => {
      const path = lineage.findPath(genesis.worldId, child1.worldId);

      expect(path).not.toBeNull();
      expect(path?.from).toBe(genesis.worldId);
      expect(path?.to).toBe(child1.worldId);
      expect(path?.edges).toHaveLength(1);
    });

    it("should find path from ancestor to descendant", () => {
      const path = lineage.findPath(genesis.worldId, grandchild1.worldId);

      expect(path).not.toBeNull();
      expect(path?.edges).toHaveLength(2);
    });

    it("should find path from child to parent (ascending)", () => {
      const path = lineage.findPath(grandchild1.worldId, genesis.worldId);

      expect(path).not.toBeNull();
      expect(path?.edges).toHaveLength(2);
    });

    it("should return empty path for same world", () => {
      const path = lineage.findPath(genesis.worldId, genesis.worldId);

      expect(path).not.toBeNull();
      expect(path?.edges).toHaveLength(0);
    });

    it("should find path between siblings via common ancestor", () => {
      const path = lineage.findPath(child1.worldId, child2.worldId);

      expect(path).not.toBeNull();
      expect(path?.edges).toHaveLength(2);
    });

    it("should find path between cousin branches", () => {
      const path = lineage.findPath(grandchild1.worldId, child2.worldId);

      expect(path).not.toBeNull();
    });

    it("should return null for non-existent worlds", () => {
      expect(
        lineage.findPath(createWorldId("non-existent"), genesis.worldId)
      ).toBeNull();
    });
  });

  // ==========================================================================
  // Common Ancestor Tests
  // ==========================================================================

  describe("common ancestor", () => {
    let genesis: World;
    let child1: World;
    let child2: World;
    let grandchild1: World;
    let grandchild2: World;

    beforeEach(() => {
      // Build a tree:
      //         genesis
      //         /     \
      //      child1  child2
      //        |       |
      //   grandchild1 grandchild2

      genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      child1 = createTestWorld();
      lineage.addWorldWithEdge(
        child1,
        genesis.worldId,
        createProposalId("p1"),
        createDecisionId("d1")
      );

      child2 = createTestWorld();
      lineage.addWorldWithEdge(
        child2,
        genesis.worldId,
        createProposalId("p2"),
        createDecisionId("d2")
      );

      grandchild1 = createTestWorld();
      lineage.addWorldWithEdge(
        grandchild1,
        child1.worldId,
        createProposalId("p3"),
        createDecisionId("d3")
      );

      grandchild2 = createTestWorld();
      lineage.addWorldWithEdge(
        grandchild2,
        child2.worldId,
        createProposalId("p4"),
        createDecisionId("d4")
      );
    });

    it("should find common ancestor of direct descendants", () => {
      const ancestor = lineage.findCommonAncestor(grandchild1.worldId, child1.worldId);
      expect(ancestor).toBe(child1.worldId);
    });

    it("should find common ancestor of siblings", () => {
      const ancestor = lineage.findCommonAncestor(child1.worldId, child2.worldId);
      expect(ancestor).toBe(genesis.worldId);
    });

    it("should find common ancestor of cousins", () => {
      const ancestor = lineage.findCommonAncestor(grandchild1.worldId, grandchild2.worldId);
      expect(ancestor).toBe(genesis.worldId);
    });

    it("should return same world if one is ancestor of other", () => {
      const ancestor = lineage.findCommonAncestor(genesis.worldId, grandchild1.worldId);
      expect(ancestor).toBe(genesis.worldId);
    });

    it("should return null for non-existent world", () => {
      expect(
        lineage.findCommonAncestor(createWorldId("non-existent"), genesis.worldId)
      ).toBeNull();
    });
  });

  // ==========================================================================
  // Ancestor/Descendant Checks
  // ==========================================================================

  describe("ancestor/descendant checks", () => {
    let genesis: World;
    let child1: World;
    let grandchild1: World;

    beforeEach(() => {
      genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      child1 = createTestWorld();
      lineage.addWorldWithEdge(
        child1,
        genesis.worldId,
        createProposalId("p1"),
        createDecisionId("d1")
      );

      grandchild1 = createTestWorld();
      lineage.addWorldWithEdge(
        grandchild1,
        child1.worldId,
        createProposalId("p2"),
        createDecisionId("d2")
      );
    });

    it("should check isAncestor correctly", () => {
      expect(lineage.isAncestor(genesis.worldId, grandchild1.worldId)).toBe(true);
      expect(lineage.isAncestor(genesis.worldId, child1.worldId)).toBe(true);
      expect(lineage.isAncestor(child1.worldId, grandchild1.worldId)).toBe(true);
      expect(lineage.isAncestor(grandchild1.worldId, genesis.worldId)).toBe(false);
      expect(lineage.isAncestor(child1.worldId, genesis.worldId)).toBe(false);
    });

    it("should check isDescendant correctly", () => {
      expect(lineage.isDescendant(grandchild1.worldId, genesis.worldId)).toBe(true);
      expect(lineage.isDescendant(child1.worldId, genesis.worldId)).toBe(true);
      expect(lineage.isDescendant(grandchild1.worldId, child1.worldId)).toBe(true);
      expect(lineage.isDescendant(genesis.worldId, grandchild1.worldId)).toBe(false);
    });
  });

  // ==========================================================================
  // Cycle Detection Tests
  // ==========================================================================

  describe("cycle detection", () => {
    let genesis: World;
    let child1: World;
    let grandchild1: World;

    beforeEach(() => {
      genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      child1 = createTestWorld();
      lineage.addWorldWithEdge(
        child1,
        genesis.worldId,
        createProposalId("p1"),
        createDecisionId("d1")
      );

      grandchild1 = createTestWorld();
      lineage.addWorldWithEdge(
        grandchild1,
        child1.worldId,
        createProposalId("p2"),
        createDecisionId("d2")
      );
    });

    it("should detect self-loop", () => {
      const result = lineage.wouldCreateCycle(genesis.worldId, genesis.worldId);
      expect(result.wouldCreateCycle).toBe(true);
    });

    it("should detect cycle back to ancestor", () => {
      // grandchild1 -> genesis would create cycle
      const result = lineage.wouldCreateCycle(grandchild1.worldId, genesis.worldId);
      expect(result.wouldCreateCycle).toBe(true);
      expect(result.existingPath).toBeDefined();
    });

    it("should detect cycle back to parent", () => {
      const result = lineage.wouldCreateCycle(grandchild1.worldId, child1.worldId);
      expect(result.wouldCreateCycle).toBe(true);
    });

    it("should allow valid edge (no cycle)", () => {
      const result = lineage.wouldCreateCycle(genesis.worldId, createWorldId("new-world"));
      expect(result.wouldCreateCycle).toBe(false);
    });
  });

  // ==========================================================================
  // Query Tests
  // ==========================================================================

  describe("queries", () => {
    let genesis: World;
    let child1: World;
    let child2: World;
    const proposalId1 = createProposalId("p1");
    const proposalId2 = createProposalId("p2");
    const decisionId1 = createDecisionId("d1");
    const decisionId2 = createDecisionId("d2");

    beforeEach(() => {
      genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      child1 = createTestWorld({ createdBy: proposalId1 });
      lineage.addWorldWithEdge(child1, genesis.worldId, proposalId1, decisionId1);

      child2 = createTestWorld({ createdBy: proposalId2 });
      lineage.addWorldWithEdge(child2, genesis.worldId, proposalId2, decisionId2);
    });

    it("should get worlds by proposal", () => {
      const worlds = lineage.getWorldsByProposal(proposalId1);
      expect(worlds).toHaveLength(1);
      expect(worlds[0].worldId).toBe(child1.worldId);
    });

    it("should get edges by proposal", () => {
      const edges = lineage.getEdgesByProposal(proposalId1);
      expect(edges).toHaveLength(1);
      expect(edges[0].proposalId).toBe(proposalId1);
    });

    it("should get edges by decision", () => {
      const edges = lineage.getEdgesByDecision(decisionId2);
      expect(edges).toHaveLength(1);
      expect(edges[0].decisionId).toBe(decisionId2);
    });

    it("should return empty for non-matching proposal", () => {
      expect(lineage.getWorldsByProposal(createProposalId("unknown"))).toHaveLength(0);
      expect(lineage.getEdgesByProposal(createProposalId("unknown"))).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================

  describe("validation", () => {
    it("should validate empty lineage", () => {
      const result = lineage.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate valid lineage", () => {
      const genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      const child = createTestWorld();
      lineage.addWorldWithEdge(
        child,
        genesis.worldId,
        createProposalId("p1"),
        createDecisionId("d1")
      );

      const result = lineage.validate();
      expect(result.valid).toBe(true);
    });

    it("should detect orphan world (no parent, not genesis)", () => {
      const genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      // Add orphan directly (bypassing addWorldWithEdge)
      const orphan = createTestWorld();
      lineage.addWorld(orphan);

      const result = lineage.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("LI-3"))).toBe(true);
    });
  });

  // ==========================================================================
  // Serialization Tests
  // ==========================================================================

  describe("serialization", () => {
    it("should export to JSON", () => {
      const genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      const child = createTestWorld();
      lineage.addWorldWithEdge(
        child,
        genesis.worldId,
        createProposalId("p1"),
        createDecisionId("d1")
      );

      const json = lineage.toJSON();

      expect(json.worlds).toHaveLength(2);
      expect(json.edges).toHaveLength(1);
      expect(json.genesis).toBe(genesis.worldId);
    });

    it("should import from JSON", () => {
      const genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      const child = createTestWorld();
      lineage.addWorldWithEdge(
        child,
        genesis.worldId,
        createProposalId("p1"),
        createDecisionId("d1")
      );

      const json = lineage.toJSON();
      const restored = WorldLineage.fromJSON(json);

      expect(restored.getWorldCount()).toBe(2);
      expect(restored.getEdgeCount()).toBe(1);
      expect(restored.getGenesisId()).toBe(genesis.worldId);
      expect(restored.getParent(child.worldId)?.worldId).toBe(genesis.worldId);
    });

    it("should clear lineage", () => {
      const genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      const child = createTestWorld();
      lineage.addWorldWithEdge(
        child,
        genesis.worldId,
        createProposalId("p1"),
        createDecisionId("d1")
      );

      lineage.clear();

      expect(lineage.getWorldCount()).toBe(0);
      expect(lineage.getEdgeCount()).toBe(0);
      expect(lineage.hasGenesis()).toBe(false);
    });
  });

  // ==========================================================================
  // Complex Scenarios
  // ==========================================================================

  describe("complex scenarios", () => {
    it("should handle deep lineage", () => {
      const genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      let current = genesis;
      for (let i = 0; i < 10; i++) {
        const next = createTestWorld();
        lineage.addWorldWithEdge(
          next,
          current.worldId,
          createProposalId(`p${i}`),
          createDecisionId(`d${i}`)
        );
        current = next;
      }

      expect(lineage.getWorldCount()).toBe(11);
      expect(lineage.getDepth(current.worldId)).toBe(10);
      expect(lineage.getMaxDepth()).toBe(10);
    });

    it("should handle wide lineage (many children)", () => {
      const genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      for (let i = 0; i < 10; i++) {
        const child = createTestWorld();
        lineage.addWorldWithEdge(
          child,
          genesis.worldId,
          createProposalId(`p${i}`),
          createDecisionId(`d${i}`)
        );
      }

      expect(lineage.getWorldCount()).toBe(11);
      expect(lineage.getChildren(genesis.worldId)).toHaveLength(10);
      expect(lineage.getWidthAtDepth(1)).toBe(10);
    });

    it("should handle branching lineage", () => {
      // Build tree:
      //         genesis
      //        /   |   \
      //       A    B    C
      //      / \   |
      //     D   E  F

      const genesis = createGenesisTestWorld();
      lineage.setGenesis(genesis);

      const worldA = createTestWorld();
      const worldB = createTestWorld();
      const worldC = createTestWorld();
      const worldD = createTestWorld();
      const worldE = createTestWorld();
      const worldF = createTestWorld();

      lineage.addWorldWithEdge(worldA, genesis.worldId, createProposalId("p1"), createDecisionId("d1"));
      lineage.addWorldWithEdge(worldB, genesis.worldId, createProposalId("p2"), createDecisionId("d2"));
      lineage.addWorldWithEdge(worldC, genesis.worldId, createProposalId("p3"), createDecisionId("d3"));
      lineage.addWorldWithEdge(worldD, worldA.worldId, createProposalId("p4"), createDecisionId("d4"));
      lineage.addWorldWithEdge(worldE, worldA.worldId, createProposalId("p5"), createDecisionId("d5"));
      lineage.addWorldWithEdge(worldF, worldB.worldId, createProposalId("p6"), createDecisionId("d6"));

      expect(lineage.getWorldCount()).toBe(7);
      expect(lineage.getWidthAtDepth(1)).toBe(3);
      expect(lineage.getWidthAtDepth(2)).toBe(3);
      expect(lineage.getLeaves()).toHaveLength(4); // C, D, E, F

      // Common ancestor tests
      expect(lineage.findCommonAncestor(worldD.worldId, worldE.worldId)).toBe(worldA.worldId);
      expect(lineage.findCommonAncestor(worldD.worldId, worldF.worldId)).toBe(genesis.worldId);
    });
  });
});
