/**
 * @fileoverview Conservative Merge Strategy (ADR-003)
 *
 * Merges translated chunks with ID prefixing and
 * optional cross-chunk dependency creation.
 */

import type { IntentGraph, IntentNode, IntentNodeId } from "../../types/index.js";
import { createNodeId } from "../../types/index.js";
import type { MergeOptions, MergeResult } from "../types.js";

/**
 * Conservative merge strategy for translated chunks.
 *
 * Per ADR-003:
 * - Prefixes node IDs to avoid collisions between chunks
 * - Optionally adds cross-chunk dependencies (sequential ordering)
 * - Excludes Abstract nodes from cross-chunk dependency chains
 *
 * This strategy preserves the independence of each chunk while
 * establishing a logical ordering between them.
 *
 * @param chunks - Array of translated Intent Graphs to merge
 * @param options - Merge options
 * @returns Merged result with combined graph
 */
export function conservativeMerge(
  chunks: readonly IntentGraph[],
  options: MergeOptions = {}
): MergeResult {
  const { idPrefix = "chunk", addCrossChunkDeps = true } = options;

  const mergedNodes: IntentNode[] = [];
  const mergedFrom: string[] = [];
  let prevChunkLastNonAbstract: IntentNodeId | null = null;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const prefix = `${idPrefix}_${i}_`;
    mergedFrom.push(`chunk_${i}`);

    // Find first non-Abstract node in this chunk for cross-chunk dependency
    const firstNonAbstract = chunk.nodes.find(
      (n) => n.resolution.status !== "Abstract"
    );

    for (const node of chunk.nodes) {
      const newId = createNodeId(`${prefix}${node.id}`);

      // Remap dependencies within the chunk
      const newDependsOn = node.dependsOn.map((dep) =>
        createNodeId(`${prefix}${dep}`)
      );

      // Add cross-chunk dependency if applicable
      // Only first non-Abstract node of each chunk depends on previous chunk
      if (
        addCrossChunkDeps &&
        prevChunkLastNonAbstract &&
        node === firstNonAbstract
      ) {
        newDependsOn.push(prevChunkLastNonAbstract);
      }

      mergedNodes.push({
        ...node,
        id: newId,
        dependsOn: newDependsOn,
      });
    }

    // Track last non-Abstract node for next chunk's cross-dependency
    const lastNonAbstract = [...chunk.nodes]
      .reverse()
      .find((n) => n.resolution.status !== "Abstract");

    if (lastNonAbstract) {
      prevChunkLastNonAbstract = createNodeId(`${prefix}${lastNonAbstract.id}`);
    }
  }

  // Combine source texts from all chunks
  const sourceTexts = chunks
    .map((c) => c.meta?.sourceText ?? "")
    .filter((t) => t.length > 0);

  return {
    graph: {
      nodes: mergedNodes,
      meta: {
        sourceText: sourceTexts.join(" "),
        translatedAt: new Date().toISOString(),
      },
    },
    mergedFrom,
  };
}
