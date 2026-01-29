/**
 * @fileoverview AggressiveMerger (SPEC Section 6.3)
 *
 * Maximum linking, semantic matching.
 *
 * Per M-INV-*:
 * - M-INV-1: Result graph is a valid DAG
 * - M-INV-2: C-ABS-1 is preserved
 * - M-INV-3: prefixNodeIds=true => no ID collisions
 * - M-INV-4: Overlap input triggers semantic deduplication
 * - M-INV-5: Result graph node IDs are globally unique
 *
 * @module strategies/merge/aggressive
 */

import type {
  IntentGraph,
  IntentNode,
  IntentNodeId,
} from "../../core/types/intent-graph.js";
import { createNodeId } from "../../core/types/intent-graph.js";
import type { MergeStrategy, MergeOptions } from "../../core/interfaces/merger.js";

// =============================================================================
// AggressiveMerger
// =============================================================================

/**
 * Maximum linking, semantic matching.
 *
 * Per SPEC Section 6.3:
 * - Uses aggressive cross-chunk linking
 * - Performs semantic matching for deduplication
 * - Links related entities across chunks
 */
export class AggressiveMerger implements MergeStrategy {
  readonly name = "AggressiveMerger";

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

    // Step 1: Collect and rename nodes (M-INV-5)
    const allNodes: IntentNode[] = [];
    const idMapping = new Map<string, IntentNodeId>();
    let globalCounter = 1;

    for (let chunkIndex = 0; chunkIndex < graphs.length; chunkIndex++) {
      const graph = graphs[chunkIndex];
      const chunkMapping = new Map<string, IntentNodeId>();

      for (const node of graph.nodes) {
        let newId: IntentNodeId;
        if (prefixNodeIds) {
          newId = createNodeId(`c${chunkIndex}_${node.id}`);
        } else {
          newId = createNodeId(`n${globalCounter++}`);
        }

        chunkMapping.set(node.id, newId);

        const newNode: IntentNode = {
          ...node,
          id: newId,
          dependsOn: [],
        };

        allNodes.push(newNode);
      }

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

        allNodes[nodeIndex] = {
          ...node,
          dependsOn: newDependsOn,
        };

        nodeIndex++;
      }
    }

    // Step 3: Aggressive cross-chunk linking
    this.addAggressiveCrossChunkLinks(allNodes, graphs, idMapping);

    // Step 4: Semantic deduplication
    let finalNodes = allNodes;
    if (deduplicate) {
      finalNodes = this.semanticDeduplicate(allNodes);
    }

    return { nodes: finalNodes };
  }

  /**
   * Add aggressive cross-chunk links.
   * Links nodes that reference similar entities.
   */
  private addAggressiveCrossChunkLinks(
    allNodes: IntentNode[],
    graphs: readonly IntentGraph[],
    _idMapping: Map<string, IntentNodeId>
  ): void {
    // Build entity index: entity key -> node IDs that reference it
    const entityIndex = new Map<string, IntentNodeId[]>();

    for (const node of allNodes) {
      const entities = this.extractEntities(node);
      for (const entity of entities) {
        const existing = entityIndex.get(entity) ?? [];
        existing.push(node.id);
        entityIndex.set(entity, existing);
      }
    }

    // For each entity referenced by multiple nodes, create dependency chain
    let nodeOffset = 0;
    let lastChunkLastNonAbstractId: IntentNodeId | null = null;

    for (let chunkIndex = 0; chunkIndex < graphs.length; chunkIndex++) {
      const graph = graphs[chunkIndex];
      const chunkNodeCount = graph.nodes.length;

      // Find first and last non-Abstract
      let firstNonAbstractIdx: number | null = null;
      let lastNonAbstractIdx: number | null = null;

      for (let i = 0; i < chunkNodeCount; i++) {
        const globalIdx = nodeOffset + i;
        if (allNodes[globalIdx].resolution.status !== "Abstract") {
          if (firstNonAbstractIdx === null) {
            firstNonAbstractIdx = globalIdx;
          }
          lastNonAbstractIdx = globalIdx;
        }
      }

      // Link first to previous chunk's last
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

      // Update tracker
      if (lastNonAbstractIdx !== null) {
        lastChunkLastNonAbstractId = allNodes[lastNonAbstractIdx].id;
      }

      nodeOffset += chunkNodeCount;
    }

    // Add links based on shared entities (aggressive)
    for (const [, nodeIds] of entityIndex) {
      if (nodeIds.length > 1) {
        // Link nodes that share this entity (later nodes depend on earlier)
        for (let i = 1; i < nodeIds.length; i++) {
          const laterNode = allNodes.find((n) => n.id === nodeIds[i]);
          const earlierNodeId = nodeIds[i - 1];

          if (laterNode && !laterNode.dependsOn.includes(earlierNodeId)) {
            // Check if this would violate C-ABS-1
            const earlierNode = allNodes.find((n) => n.id === earlierNodeId);
            if (
              earlierNode &&
              earlierNode.resolution.status === "Abstract" &&
              laterNode.resolution.status !== "Abstract"
            ) {
              // Skip - would violate C-ABS-1
              continue;
            }

            const idx = allNodes.findIndex((n) => n.id === nodeIds[i]);
            if (idx >= 0) {
              allNodes[idx] = {
                ...allNodes[idx],
                dependsOn: [...allNodes[idx].dependsOn, earlierNodeId],
              };
            }
          }
        }
      }
    }
  }

  /**
   * Extract entity references from a node.
   */
  private extractEntities(node: IntentNode): string[] {
    const entities: string[] = [];

    const extractFromValue = (value: unknown): void => {
      if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        if (obj.type && typeof obj.type === "string") {
          entities.push(`type:${obj.type}`);
        }
        if (obj.name && typeof obj.name === "string") {
          entities.push(`name:${obj.name}`);
        }
        if (obj.ref && typeof obj.ref === "string") {
          entities.push(`ref:${obj.ref}`);
        }
        // Recurse
        for (const v of Object.values(obj)) {
          extractFromValue(v);
        }
      }
    };

    extractFromValue(node.ir.args);

    return entities;
  }

  /**
   * Semantic deduplication with fuzzy matching.
   */
  private semanticDeduplicate(nodes: IntentNode[]): IntentNode[] {
    const seen = new Map<string, IntentNode>();
    const idRemapping = new Map<IntentNodeId, IntentNodeId>();

    for (const node of nodes) {
      const key = this.getSemanticKey(node);
      const existing = seen.get(key);

      if (existing) {
        // Merge: keep the one with lower ambiguity
        if (
          node.resolution.ambiguityScore < existing.resolution.ambiguityScore
        ) {
          // Replace existing with this node
          idRemapping.set(existing.id, node.id);
          seen.set(key, node);
        } else {
          idRemapping.set(node.id, existing.id);
        }
      } else {
        seen.set(key, node);
      }
    }

    if (idRemapping.size === 0) {
      return nodes;
    }

    const result: IntentNode[] = [];
    for (const node of nodes) {
      if (idRemapping.has(node.id)) {
        continue;
      }

      const newDependsOn = node.dependsOn.map(
        (depId) => idRemapping.get(depId) ?? depId
      );

      result.push({
        ...node,
        dependsOn: [...new Set(newDependsOn)], // Remove duplicates
      });
    }

    return result;
  }

  /**
   * Generate semantic key for fuzzy matching.
   */
  private getSemanticKey(node: IntentNode): string {
    // Normalize for semantic matching
    // IntentIR v0.1: event is { lemma: string, class: EventClass }
    return JSON.stringify({
      event: node.ir.event.lemma.toLowerCase(),
      eventClass: node.ir.event.class,
      args: this.normalizeArgs(node.ir.args),
    });
  }

  /**
   * Normalize args for comparison.
   */
  private normalizeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        // Skip ref fields (they're context-dependent)
        const { ref, ...rest } = obj;
        if (Object.keys(rest).length > 0) {
          normalized[key] = this.normalizeArgs(rest as Record<string, unknown>);
        }
      } else if (typeof value === "string") {
        normalized[key] = value.toLowerCase();
      } else {
        normalized[key] = value;
      }
    }

    return normalized;
  }
}
