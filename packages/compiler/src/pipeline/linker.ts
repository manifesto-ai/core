/**
 * @manifesto-ai/compiler v1.1 Linker
 *
 * Assembles Fragments into a DomainDraft with DAG structure.
 * Per SPEC §11.2: Linker detects structural conflicts.
 */

import { nanoid } from "nanoid";
import type {
  Fragment,
  DomainDraft,
  DependencyGraph,
  DependencyEdge,
  Conflict,
  ConflictType,
  ResolutionOption,
} from "../domain/types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 Link Context
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for the Linker
 */
export interface LinkContext {
  /**
   * Source input ID
   */
  sourceInputId: string;

  /**
   * Plan ID
   */
  planId: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 Link Result
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of linking fragments
 */
export type LinkResult =
  | { ok: true; domainDraft: DomainDraft }
  | { ok: "conflict"; conflicts: Conflict[]; options: ResolutionOption[] };

// ═══════════════════════════════════════════════════════════════════════════════
// §3 Conflict Detection
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect duplicate path conflicts
 *
 * Two fragments providing the same path is a conflict.
 */
function detectDuplicatePaths(fragments: Fragment[]): Conflict[] {
  const pathMap = new Map<string, Fragment[]>();

  for (const fragment of fragments) {
    for (const path of fragment.provides) {
      const existing = pathMap.get(path) || [];
      existing.push(fragment);
      pathMap.set(path, existing);
    }
  }

  const conflicts: Conflict[] = [];
  for (const [path, providers] of pathMap) {
    if (providers.length > 1) {
      conflicts.push({
        id: `conflict_${nanoid(8)}`,
        type: "duplicate_path",
        message: `Multiple fragments provide path '${path}'`,
        fragmentIds: providers.map((f) => f.id),
        path,
        details: {
          providers: providers.map((f) => ({
            fragmentId: f.id,
            type: f.type,
            name: f.content.name,
          })),
        },
      });
    }
  }

  return conflicts;
}

/**
 * Detect missing dependency conflicts
 *
 * A fragment requiring a path that no fragment provides is a conflict.
 */
function detectMissingDependencies(fragments: Fragment[]): Conflict[] {
  const providedPaths = new Set<string>();
  for (const fragment of fragments) {
    for (const path of fragment.provides) {
      providedPaths.add(path);
    }
  }

  const conflicts: Conflict[] = [];
  for (const fragment of fragments) {
    for (const required of fragment.requires) {
      if (!providedPaths.has(required)) {
        conflicts.push({
          id: `conflict_${nanoid(8)}`,
          type: "missing_dependency",
          message: `Fragment '${fragment.content.name}' requires '${required}' but no fragment provides it`,
          fragmentIds: [fragment.id],
          path: required,
          details: {
            requiredBy: fragment.id,
            requiredPath: required,
          },
        });
      }
    }
  }

  return conflicts;
}

/**
 * Detect circular dependency conflicts
 *
 * Uses Kahn's algorithm to detect cycles.
 */
function detectCircularDependencies(fragments: Fragment[]): Conflict[] {
  // Build adjacency map
  const pathToFragment = new Map<string, Fragment>();
  for (const fragment of fragments) {
    for (const path of fragment.provides) {
      pathToFragment.set(path, fragment);
    }
  }

  // Build edge list
  const edges: Array<{ from: string; to: string }> = [];
  const inDegree = new Map<string, number>();

  for (const fragment of fragments) {
    inDegree.set(fragment.id, 0);
  }

  for (const fragment of fragments) {
    for (const required of fragment.requires) {
      const provider = pathToFragment.get(required);
      if (provider && provider.id !== fragment.id) {
        edges.push({ from: provider.id, to: fragment.id });
        inDegree.set(fragment.id, (inDegree.get(fragment.id) || 0) + 1);
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const edge of edges) {
      if (edge.from === current) {
        const newDegree = (inDegree.get(edge.to) || 0) - 1;
        inDegree.set(edge.to, newDegree);
        if (newDegree === 0) {
          queue.push(edge.to);
        }
      }
    }
  }

  // If not all nodes were sorted, there's a cycle
  if (sorted.length < fragments.length) {
    const cycleNodes = fragments.filter((f) => !sorted.includes(f.id));

    return [
      {
        id: `conflict_${nanoid(8)}`,
        type: "circular_dependency",
        message: `Circular dependency detected involving ${cycleNodes.length} fragments`,
        fragmentIds: cycleNodes.map((f) => f.id),
        details: {
          cycleFragments: cycleNodes.map((f) => ({
            fragmentId: f.id,
            name: f.content.name,
            requires: f.requires,
            provides: f.provides,
          })),
        },
      },
    ];
  }

  return [];
}

/**
 * Detect type mismatch conflicts
 *
 * If a fragment requires a path of one type but it's provided with another type.
 * (Currently basic - just checks if path exists with right prefix)
 */
function detectTypeMismatches(fragments: Fragment[]): Conflict[] {
  // For now, type mismatches are caught during dependency resolution
  // since paths include the type prefix (state.X, action.Y, etc.)
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 DAG Construction
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build dependency graph from fragments
 */
function buildDependencyGraph(fragments: Fragment[]): DependencyGraph {
  // Build path to fragment map
  const pathToFragment = new Map<string, Fragment>();
  for (const fragment of fragments) {
    for (const path of fragment.provides) {
      pathToFragment.set(path, fragment);
    }
  }

  // Build nodes and edges
  const nodes: string[] = fragments.map((f) => f.id);
  const edges: DependencyEdge[] = [];

  for (const fragment of fragments) {
    for (const required of fragment.requires) {
      const provider = pathToFragment.get(required);
      if (provider && provider.id !== fragment.id) {
        edges.push({
          from: provider.id,
          to: fragment.id,
          kind: "requires",
        });
      }
    }
  }

  // Topological sort
  const inDegree = new Map<string, number>();
  for (const node of nodes) {
    inDegree.set(node, 0);
  }

  for (const edge of edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const topologicalOrder: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    topologicalOrder.push(current);

    for (const edge of edges) {
      if (edge.from === current) {
        const newDegree = (inDegree.get(edge.to) || 0) - 1;
        inDegree.set(edge.to, newDegree);
        if (newDegree === 0) {
          queue.push(edge.to);
        }
      }
    }
  }

  return {
    nodes,
    edges,
    topologicalOrder,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 Domain Assembly
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Assemble fragments into domain structure
 */
function assembleFragments(fragments: Fragment[]): DomainDraft["assembled"] {
  const state: Record<string, unknown> = {};
  const computed: Record<string, unknown> = {};
  const actions: Record<string, unknown> = {};
  const constraints: unknown[] = [];

  for (const fragment of fragments) {
    const content = fragment.content;

    switch (content.kind) {
      case "state":
        state[content.name] = {
          schema: content.schema,
          initial: content.initial,
        };
        break;

      case "computed":
        computed[content.name] = {
          expression: content.expression,
          dependencies: content.dependencies,
        };
        break;

      case "action":
        actions[content.name] = {
          input: content.input,
          available: content.available,
          flow: content.flow,
        };
        break;

      case "constraint":
        constraints.push({
          name: content.name,
          expression: content.expression,
          message: content.message,
        });
        break;

      case "effect":
        // Effects are stored with actions for now
        actions[`effect:${content.name}`] = {
          effectType: content.effectType,
          params: content.params,
        };
        break;

      case "flow":
        // Flows are stored with actions
        actions[`flow:${content.name}`] = {
          steps: content.steps,
        };
        break;
    }
  }

  return { state, computed, actions, constraints };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §6 Resolution Options Generation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate resolution options for conflicts
 */
function generateResolutionOptions(conflicts: Conflict[]): ResolutionOption[] {
  const options: ResolutionOption[] = [];

  for (const conflict of conflicts) {
    switch (conflict.type) {
      case "duplicate_path":
        // For duplicate paths, offer to select one
        const providers = (conflict.details as { providers: Array<{ fragmentId: string; name: string }> }).providers;
        for (const provider of providers) {
          options.push({
            id: `select_${provider.fragmentId}`,
            description: `Keep '${provider.name}' and discard others`,
            preview: `Select fragment ${provider.fragmentId}`,
            impact: {
              kind: "select_fragment",
              fragmentId: provider.fragmentId,
              rejectIds: providers.filter((p) => p.fragmentId !== provider.fragmentId).map((p) => p.fragmentId),
            },
          });
        }
        break;

      case "missing_dependency":
        // For missing dependencies, offer to remove the requiring fragment
        options.push({
          id: `remove_${conflict.fragmentIds[0]}`,
          description: `Remove fragment that requires missing '${conflict.path}'`,
          impact: {
            kind: "reject_draft",
            draftId: conflict.fragmentIds[0],
            reason: `Missing dependency: ${conflict.path}`,
          },
        });
        break;

      case "circular_dependency":
        // For circular dependencies, list involved fragments
        const cycleFragments = (conflict.details as { cycleFragments: Array<{ fragmentId: string; name: string }> }).cycleFragments;
        for (const frag of cycleFragments) {
          options.push({
            id: `break_cycle_${frag.fragmentId}`,
            description: `Remove '${frag.name}' to break cycle`,
            impact: {
              kind: "reject_draft",
              draftId: frag.fragmentId,
              reason: "Breaking circular dependency",
            },
          });
        }
        break;
    }
  }

  return options;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7 Linker Implementation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Linker - assembles fragments into DomainDraft
 *
 * Per SPEC §11.2: Linker detects structural conflicts.
 *
 * Responsibilities:
 * - Build dependency DAG
 * - Detect conflicts (duplicate_path, missing_dependency, circular_dependency)
 * - Assemble fragments into DomainDraft
 */
export interface Linker {
  /**
   * Link fragments into a DomainDraft
   */
  link(fragments: Fragment[], context: LinkContext): LinkResult;
}

/**
 * Create the Linker
 */
export function createLinker(): Linker {
  return {
    link(fragments: Fragment[], context: LinkContext): LinkResult {
      // Step 1: Detect conflicts
      const duplicateConflicts = detectDuplicatePaths(fragments);
      const missingConflicts = detectMissingDependencies(fragments);
      const circularConflicts = detectCircularDependencies(fragments);
      const typeConflicts = detectTypeMismatches(fragments);

      const allConflicts = [
        ...duplicateConflicts,
        ...missingConflicts,
        ...circularConflicts,
        ...typeConflicts,
      ];

      // Step 2: If conflicts, return for resolution
      if (allConflicts.length > 0) {
        const options = generateResolutionOptions(allConflicts);
        return {
          ok: "conflict",
          conflicts: allConflicts,
          options,
        };
      }

      // Step 3: Build dependency graph
      const dependencyGraph = buildDependencyGraph(fragments);

      // Step 4: Assemble fragments
      const assembled = assembleFragments(fragments);

      // Step 5: Create DomainDraft
      const domainDraft: DomainDraft = {
        id: `draft_${nanoid(8)}`,
        fragments,
        assembled,
        dependencyGraph,
        sourceInputId: context.sourceInputId,
        planId: context.planId,
      };

      return { ok: true, domainDraft };
    },
  };
}

/**
 * Linker version
 */
export const LINKER_VERSION = "1.1.0";
