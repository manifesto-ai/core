/**
 * @fileoverview emitForManifesto() Implementation (SPEC Section 10.3, 12)
 *
 * Generate Manifesto-compatible output artifacts from Intent Graph.
 */

import type { Lexicon, IntentBody, lower, ResolvedIntentIR } from "@manifesto-ai/intent-ir";
import type {
  IntentGraph,
  IntentNode,
  IntentNodeId,
  EmitContext,
  ManifestoBundle,
  InvocationPlan,
  InvocationStep,
  MelCandidate,
  BundleMeta,
  DependencyEdge,
  LoweringResult,
  LoweringFailureReason,
} from "../types/index.js";
import { topologicalSort } from "./topological-sort.js";
import { generateMelCandidate } from "./mel-candidate.js";
import { TranslatorError } from "../types/errors.js";

// Type guard for deferred resolution result
type DeferredResult = { readonly deferred: true; readonly reason: string };
function isDeferredResult(
  result: ResolvedIntentIR | DeferredResult
): result is DeferredResult {
  return "deferred" in result && result.deferred === true;
}

// =============================================================================
// emitForManifesto
// =============================================================================

/**
 * Generate Manifesto-compatible output artifacts from Intent Graph.
 *
 * Per SPEC Section 12.1, for each node in topological order:
 * 1. Check resolution.status
 *    - "Abstract" → Skip (not in InvocationPlan)
 *    - "Resolved" | "Ambiguous" → Continue
 * 2. Try to resolve discourse refs
 *    - Success → Continue to lowering
 *    - Needs runtime data → Mark as "deferred"
 * 3. Try to lower IntentIR → IntentBody
 *    - resolveActionType() succeeds → "ready"
 *    - resolveActionType() fails → "failed" + MelCandidate
 *
 * @param graph - The Intent Graph to emit
 * @param ctx - Emit context with Lexicon, Resolver, etc.
 * @returns ManifestoBundle with InvocationPlan and MelCandidates
 */
export function emitForManifesto(
  graph: IntentGraph,
  ctx: EmitContext
): ManifestoBundle {
  const { lexicon, resolver, schemaHash } = ctx;

  // 1. Topological sort
  const sortResult = topologicalSort(graph);
  if (!sortResult.ok) {
    throw new TranslatorError("Cannot emit: graph contains cycles", {
      code: "CYCLE_DETECTED",
    });
  }

  const sortedNodes = sortResult.sorted;

  // 2. Build set of non-Abstract node IDs (nodes that will be in steps[])
  // Per SPEC C-ABS-1, non-Abstract nodes don't depend on Abstract nodes,
  // so we only need to filter by resolution status.
  const stepNodeIds = new Set<IntentNodeId>(
    sortedNodes
      .filter((n) => n.resolution.status !== "Abstract")
      .map((n) => n.id)
  );

  // 3. Build dependency edges (C-EDGES-1 compliant)
  // Per SPEC Section 11.2:
  // - MUST contain only edges where BOTH from and to are nodeIds in steps[]
  // - Convention: from=dependency (must complete first), to=dependent (executes after)
  // - Edge direction: from → to means "from must complete before to"
  const dependencyEdges: DependencyEdge[] = [];
  for (const node of sortedNodes) {
    // Skip if this node won't be in steps
    if (!stepNodeIds.has(node.id)) {
      continue;
    }
    for (const dep of node.dependsOn) {
      // Only include edge if dependency is also in steps (C-EDGES-1)
      if (stepNodeIds.has(dep)) {
        dependencyEdges.push({
          from: dep, // dependency (must complete first)
          to: node.id, // dependent (executes after)
        });
      }
    }
  }

  // 4. Process nodes and build steps
  const steps: InvocationStep[] = [];
  const melCandidates: MelCandidate[] = [];

  // Count statistics
  let resolvedCount = 0;
  let ambiguousCount = 0;
  let abstractCount = 0;
  let deferredCount = 0;

  for (const node of sortedNodes) {
    // Count by resolution status
    switch (node.resolution.status) {
      case "Resolved":
        resolvedCount++;
        break;
      case "Ambiguous":
        ambiguousCount++;
        break;
      case "Abstract":
        abstractCount++;
        break;
    }

    // Skip Abstract nodes (not enough information to execute)
    if (node.resolution.status === "Abstract") {
      continue;
    }

    // Try to resolve and lower
    const { step, melCandidate } = processNode(node, lexicon, resolver, graph);

    steps.push(step);

    if (step.lowering.status === "deferred") {
      deferredCount++;
    }

    if (melCandidate) {
      melCandidates.push(melCandidate);
    }
  }

  // 5. Build InvocationPlan
  const invocationPlan: InvocationPlan = {
    steps,
    dependencyEdges: dependencyEdges.length > 0 ? dependencyEdges : undefined,
  };

  // 6. Build metadata
  const meta: BundleMeta = {
    sourceText: graph.meta?.sourceText ?? "",
    translatedAt: graph.meta?.translatedAt ?? new Date().toISOString(),
    emittedAt: new Date().toISOString(),
    graphNodeCount: graph.nodes.length,
    resolvedCount,
    ambiguousCount,
    abstractCount,
    deferredCount,
  };

  return {
    invocationPlan,
    melCandidates,
    meta,
  };
}

// =============================================================================
// processNode
// =============================================================================

/**
 * Process a single node for emission.
 */
function processNode(
  node: IntentNode,
  lexicon: Lexicon,
  resolver: EmitContext["resolver"],
  graph: IntentGraph
): {
  step: InvocationStep;
  melCandidate: MelCandidate | null;
} {
  // 1. Try to resolve discourse references
  let resolveResult: ReturnType<typeof resolver.resolveReferences>;
  try {
    resolveResult = resolver.resolveReferences(node.ir);
  } catch (error) {
    throw new TranslatorError(
      `Resolver failed for node ${node.id}: ${error instanceof Error ? error.message : String(error)}`,
      { code: "RESOLVER_ERROR", nodeId: node.id }
    );
  }

  // Check if resolution is deferred
  if (isDeferredResult(resolveResult)) {
    return {
      step: {
        nodeId: node.id,
        ir: node.ir,
        lowering: {
          status: "deferred",
          reason: resolveResult.reason,
        },
        resolution: {
          status: node.resolution.status,
          ambiguityScore: node.resolution.ambiguityScore,
          missing: node.resolution.missing,
        },
      },
      melCandidate: null,
    };
  }

  // 2. Resolution succeeded - try to lower
  // Type guard narrows resolveResult to ResolvedIntentIR
  const resolvedIR: ResolvedIntentIR = resolveResult;

  // Check if action type exists
  const actionType = lexicon.resolveActionType(node.ir.event.lemma);

  if (!actionType) {
    // Lowering failed - action not found
    const reason: LoweringFailureReason = {
      kind: "action_not_found",
      details: `No action type found for lemma "${node.ir.event.lemma}"`,
    };

    return {
      step: {
        nodeId: node.id,
        ir: node.ir,
        lowering: {
          status: "failed",
          reason,
        },
        resolution: {
          status: node.resolution.status,
          ambiguityScore: node.resolution.ambiguityScore,
          missing: node.resolution.missing,
        },
      },
      melCandidate: generateMelCandidate(node.id, node.ir, reason, graph),
    };
  }

  // 3. Action type found - build IntentBody
  const input = lexicon.mapArgsToInput(resolvedIR.args, resolvedIR.cond);
  const scopeProposal = lexicon.deriveScopeProposal?.(resolvedIR);

  const intentBody: IntentBody = {
    type: actionType,
    ...(input !== undefined && { input }),
    ...(scopeProposal && { scopeProposal }),
  };

  return {
    step: {
      nodeId: node.id,
      ir: node.ir,
      lowering: {
        status: "ready",
        intentBody,
        resolvedIR,
      },
      resolution: {
        status: node.resolution.status,
        ambiguityScore: node.resolution.ambiguityScore,
        missing: node.resolution.missing,
      },
    },
    melCandidate: null,
  };
}
