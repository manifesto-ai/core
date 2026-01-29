/**
 * @fileoverview Dependency Repair Plugin (SPEC Section 8.4)
 *
 * Fixes missing cross-chunk dependencies.
 *
 * Per PLG-*:
 * - PLG-1: Creates run-scope hooks
 * - PLG-3: Transformer must explicitly return modified graph
 * - PLG-4: Pipeline re-validates after modification
 *
 * @module plugins/dependency-repair
 */

import type {
  IntentGraph,
  IntentNode,
  IntentNodeId,
} from "../core/types/intent-graph.js";
import { createNodeId } from "../core/types/intent-graph.js";
import type {
  PipelinePlugin,
  PipelineHooks,
  ReadonlyPipelineContext,
} from "./types.js";

// =============================================================================
// dependencyRepairPlugin
// =============================================================================

/**
 * Fixes missing cross-chunk dependencies.
 *
 * Per SPEC Section 8.4:
 * - Transformer plugin (may modify graph)
 * - Identifies broken references (e.g., "ref": "n1" pointing to wrong chunk)
 * - Repairs dependencies based on semantic analysis
 */
export const dependencyRepairPlugin: PipelinePlugin = {
  name: "dependencyRepair",
  kind: "transformer",

  createRunHooks(): PipelineHooks {
    return {
      afterMerge(ctx: ReadonlyPipelineContext): IntentGraph | void {
        const { merged, diagnostics } = ctx;

        if (!merged) return;

        // Analyze and repair dependencies
        const { repaired, repairs } = repairDependencies(merged);

        // Log repairs
        if (repairs.length > 0) {
          diagnostics.metric("dependency_repairs", repairs.length);

          for (const repair of repairs) {
            diagnostics.info(
              "DEPENDENCY_REPAIRED",
              `Repaired dependency: node "${repair.nodeId}" now depends on "${repair.newDep}" ` +
                `(reason: ${repair.reason})`
            );
          }

          // Return repaired graph (PLG-3)
          return repaired;
        }

        // No repairs needed - return undefined (no modification)
        return undefined;
      },
    };
  },
};

// =============================================================================
// Repair Logic
// =============================================================================

interface DependencyRepair {
  nodeId: IntentNodeId;
  oldDep?: IntentNodeId;
  newDep: IntentNodeId;
  reason: string;
}

interface RepairResult {
  repaired: IntentGraph;
  repairs: DependencyRepair[];
}

/**
 * Analyze and repair dependencies in the graph.
 */
function repairDependencies(graph: IntentGraph): RepairResult {
  const repairs: DependencyRepair[] = [];
  const nodeMap = new Map<IntentNodeId, IntentNode>();

  for (const node of graph.nodes) {
    nodeMap.set(node.id, node);
  }

  // Build entity reference index
  const entityProviders = new Map<string, IntentNodeId[]>(); // entity key -> provider node IDs
  const entityConsumers = new Map<string, IntentNodeId[]>(); // entity key -> consumer node IDs

  for (const node of graph.nodes) {
    // Find what entities this node provides (creates)
    const provided = findProvidedEntities(node);
    for (const entity of provided) {
      const existing = entityProviders.get(entity) ?? [];
      existing.push(node.id);
      entityProviders.set(entity, existing);
    }

    // Find what entities this node consumes (references)
    const consumed = findConsumedEntities(node);
    for (const entity of consumed) {
      const existing = entityConsumers.get(entity) ?? [];
      existing.push(node.id);
      entityConsumers.set(entity, existing);
    }
  }

  // For each consumer, ensure it depends on a provider
  const newNodes: IntentNode[] = [];

  for (const node of graph.nodes) {
    const consumed = findConsumedEntities(node);
    const additionalDeps: IntentNodeId[] = [];

    for (const entity of consumed) {
      const providers = entityProviders.get(entity) ?? [];

      // Find providers that this node doesn't already depend on
      for (const providerId of providers) {
        if (
          providerId !== node.id &&
          !node.dependsOn.includes(providerId) &&
          !additionalDeps.includes(providerId)
        ) {
          // Check if provider should come before consumer (simple heuristic: alphabetically)
          const provider = nodeMap.get(providerId);
          if (provider) {
            // Check C-ABS-1: non-Abstract cannot depend on Abstract
            if (
              node.resolution.status !== "Abstract" &&
              provider.resolution.status === "Abstract"
            ) {
              continue; // Skip - would violate C-ABS-1
            }

            additionalDeps.push(providerId);
            repairs.push({
              nodeId: node.id,
              newDep: providerId,
              reason: `entity reference "${entity}"`,
            });
          }
        }
      }
    }

    if (additionalDeps.length > 0) {
      newNodes.push({
        ...node,
        dependsOn: [...node.dependsOn, ...additionalDeps],
      });
    } else {
      newNodes.push(node);
    }
  }

  return {
    repaired: { nodes: newNodes },
    repairs,
  };
}

/**
 * Find entities provided (created) by a node.
 */
function findProvidedEntities(node: IntentNode): string[] {
  const entities: string[] = [];

  // "create" events typically provide the created entity
  // Check event.lemma for the action verb (IntentIR v0.1 structure)
  const eventLemma = node.ir.event.lemma.toUpperCase();
  if (
    eventLemma === "CREATE" ||
    eventLemma === "ADD" ||
    eventLemma === "NEW"
  ) {
    // Access uppercase theta-role keys
    const target = node.ir.args?.TARGET as Record<string, unknown> | undefined;
    if (target?.entityType) {
      entities.push(`type:${String(target.entityType)}`);
    }
    const theme = node.ir.args?.THEME as Record<string, unknown> | undefined;
    if (theme?.entityType) {
      entities.push(`type:${String(theme.entityType)}`);
    }
  }

  // Any node provides itself as a reference
  entities.push(`nodeId:${node.id}`);

  return entities;
}

/**
 * Find entities consumed (referenced) by a node.
 */
function findConsumedEntities(node: IntentNode): string[] {
  const entities: string[] = [];

  const extractRefs = (value: unknown): void => {
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      // Check for ref.id in EntityRef structure
      if (obj.ref && typeof obj.ref === "object") {
        const refObj = obj.ref as Record<string, unknown>;
        if (refObj.id && typeof refObj.id === "string") {
          entities.push(`nodeId:${refObj.id}`);
        }
      }
      // Recurse
      for (const v of Object.values(obj)) {
        extractRefs(v);
      }
    }
  };

  extractRefs(node.ir.args);

  return entities;
}
