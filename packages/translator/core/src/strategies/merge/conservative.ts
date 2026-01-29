/**
 * @fileoverview ConservativeMerger (SPEC Section 6.3)
 *
 * Minimal linking, safe deduplication.
 *
 * Per M-INV-*:
 * - M-INV-1: Result graph is a valid DAG
 * - M-INV-2: C-ABS-1 is preserved
 * - M-INV-3: prefixNodeIds=true => no ID collisions
 * - M-INV-4: Overlap input triggers semantic deduplication
 * - M-INV-5: Result graph node IDs are globally unique
 *
 * @module strategies/merge/conservative
 */

import type {
  IntentGraph,
  IntentNode,
  IntentNodeId,
} from "../../core/types/intent-graph.js";
import { createNodeId } from "../../core/types/intent-graph.js";
import type { MergeStrategy, MergeOptions } from "../../core/interfaces/merger.js";

// =============================================================================
// ConservativeMerger
// =============================================================================

/**
 * Minimal linking, safe deduplication.
 *
 * Per SPEC Section 6.3:
 * - Uses prefix-based ID collision prevention by default
 * - Adds conservative cross-chunk dependencies
 * - Simple semantic deduplication (exact match)
 */
export class ConservativeMerger implements MergeStrategy {
  readonly name = "ConservativeMerger";

  merge(
    graphs: readonly IntentGraph[],
    options?: MergeOptions
  ): IntentGraph {
    if (graphs.length === 0) {
      return { nodes: [] };
    }

    if (graphs.length === 1) {
      return graphs[0];
    }

    const prefixNodeIds = options?.prefixNodeIds ?? true;
    const deduplicate = options?.deduplicate ?? false;
    const linkStrategy = options?.linkStrategy ?? "conservative";

    // Step 1: Collect and rename nodes (M-INV-5)
    const allNodes: IntentNode[] = [];
    const idMapping = new Map<string, IntentNodeId>(); // oldId -> newId per chunk
    let globalCounter = 1;

    for (let chunkIndex = 0; chunkIndex < graphs.length; chunkIndex++) {
      const graph = graphs[chunkIndex];
      const chunkMapping = new Map<string, IntentNodeId>();

      for (const node of graph.nodes) {
        // Generate new ID (M-INV-5: global uniqueness)
        let newId: IntentNodeId;
        if (prefixNodeIds) {
          newId = createNodeId(`c${chunkIndex}_${node.id}`);
        } else {
          newId = createNodeId(`n${globalCounter++}`);
        }

        chunkMapping.set(node.id, newId);

        // Create node with new ID and updated dependencies
        const newNode: IntentNode = {
          ...node,
          id: newId,
          dependsOn: [], // Will be updated after all mappings are known
        };

        allNodes.push(newNode);
      }

      // Store mappings for this chunk
      for (const [oldId, newId] of chunkMapping) {
        idMapping.set(`${chunkIndex}:${oldId}`, newId);
      }
    }

    // Step 2: Update dependencies within each chunk
    let nodeIndex = 0;
    for (let chunkIndex = 0; chunkIndex < graphs.length; chunkIndex++) {
      const graph = graphs[chunkIndex];

      for (const originalNode of graph.nodes) {
        const node = allNodes[nodeIndex];
        const newDependsOn: IntentNodeId[] = [];

        for (const depId of originalNode.dependsOn) {
          const newDepId = idMapping.get(`${chunkIndex}:${depId}`);
          if (newDepId) {
            newDependsOn.push(newDepId);
          }
        }

        // Update node in place
        allNodes[nodeIndex] = {
          ...node,
          dependsOn: newDependsOn,
        };

        nodeIndex++;
      }
    }

    // Step 3: Add cross-chunk dependencies (conservative linking)
    if (linkStrategy === "conservative" || linkStrategy === "aggressive") {
      this.addCrossChunkDependencies(allNodes, graphs, idMapping, linkStrategy);
    }

    // Step 4: Deduplicate if enabled (M-INV-4)
    let finalNodes = allNodes;
    if (deduplicate) {
      finalNodes = this.deduplicateNodes(allNodes);
    }

    return { nodes: finalNodes };
  }

  /**
   * Add cross-chunk dependencies.
   * Conservative: First non-Abstract of chunk N depends on last non-Abstract of chunk N-1
   */
  private addCrossChunkDependencies(
    allNodes: IntentNode[],
    graphs: readonly IntentGraph[],
    _idMapping: Map<string, IntentNodeId>,
    _linkStrategy: "conservative" | "aggressive"
  ): void {
    let nodeOffset = 0;
    let lastChunkLastNonAbstractId: IntentNodeId | null = null;

    for (let chunkIndex = 0; chunkIndex < graphs.length; chunkIndex++) {
      const graph = graphs[chunkIndex];
      const chunkNodeCount = graph.nodes.length;

      // Find first non-Abstract node in this chunk
      let firstNonAbstractIdx: number | null = null;
      for (let i = 0; i < chunkNodeCount; i++) {
        const globalIdx = nodeOffset + i;
        if (allNodes[globalIdx].resolution.status !== "Abstract") {
          firstNonAbstractIdx = globalIdx;
          break;
        }
      }

      // Find last non-Abstract node in this chunk
      let lastNonAbstractIdx: number | null = null;
      for (let i = chunkNodeCount - 1; i >= 0; i--) {
        const globalIdx = nodeOffset + i;
        if (allNodes[globalIdx].resolution.status !== "Abstract") {
          lastNonAbstractIdx = globalIdx;
          break;
        }
      }

      // Add dependency from first non-Abstract to previous chunk's last non-Abstract
      if (
        firstNonAbstractIdx !== null &&
        lastChunkLastNonAbstractId !== null
      ) {
        const node = allNodes[firstNonAbstractIdx];
        if (!node.dependsOn.includes(lastChunkLastNonAbstractId)) {
          allNodes[firstNonAbstractIdx] = {
            ...node,
            dependsOn: [...node.dependsOn, lastChunkLastNonAbstractId],
          };
        }
      }

      // Update last non-Abstract ID
      if (lastNonAbstractIdx !== null) {
        lastChunkLastNonAbstractId = allNodes[lastNonAbstractIdx].id;
      }

      nodeOffset += chunkNodeCount;
    }
  }

  /**
   * Deduplicate nodes based on semantic similarity.
   * Conservative: Only exact event + args match.
   */
  private deduplicateNodes(nodes: IntentNode[]): IntentNode[] {
    const seen = new Map<string, IntentNode>();
    const idRemapping = new Map<IntentNodeId, IntentNodeId>(); // duplicateId -> originalId

    for (const node of nodes) {
      const key = this.getNodeKey(node);
      const existing = seen.get(key);

      if (existing) {
        // Mark as duplicate
        idRemapping.set(node.id, existing.id);
      } else {
        seen.set(key, node);
      }
    }

    // If no duplicates, return as-is
    if (idRemapping.size === 0) {
      return nodes;
    }

    // Filter out duplicates and update dependencies
    const result: IntentNode[] = [];
    for (const node of nodes) {
      if (idRemapping.has(node.id)) {
        continue; // Skip duplicate
      }

      // Update dependencies to point to original instead of duplicate
      const newDependsOn = node.dependsOn.map(
        (depId) => idRemapping.get(depId) ?? depId
      );

      result.push({
        ...node,
        dependsOn: newDependsOn,
      });
    }

    return result;
  }

  /**
   * Generate a key for deduplication.
   */
  private getNodeKey(node: IntentNode): string {
    return JSON.stringify({
      event: node.ir.event,
      args: node.ir.args,
    });
  }
}
