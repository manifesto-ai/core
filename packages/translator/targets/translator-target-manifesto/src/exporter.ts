/**
 * @fileoverview Manifesto target exporter.
 */

import type { IntentBody } from "@manifesto-ai/intent-ir";
import {
  buildExecutionPlan,
  type ExportInput,
  type TargetExporter,
  type ExtensionCandidate,
  type IntentGraph,
  type ExecutionStep,
  type DependencyEdge,
  type IntentNodeId,
} from "@manifesto-ai/translator";
import type {
  ManifestoBundle,
  ManifestoExportContext,
  InvocationPlan,
  InvocationStep,
  LoweringFailure,
  LoweringResult,
} from "./types.js";
import { generateMelCandidate, type MelCandidate } from "./mel-candidate.js";

// =============================================================================
// manifestoExporter
// =============================================================================

export const manifestoExporter: TargetExporter<ManifestoBundle, ManifestoExportContext> = {
  id: "manifesto",

  async export(input: ExportInput, ctx: ManifestoExportContext): Promise<ManifestoBundle> {
    const executionPlan = buildExecutionPlan(input.graph);

    const { invocationPlan, extensionCandidates, meta } = lowerWithContext(
      executionPlan.steps,
      executionPlan.dependencyEdges,
      executionPlan.abstractNodes,
      input.graph,
      ctx
    );

    return {
      invocationPlan,
      extensionCandidates,
      meta,
    };
  },
};

// =============================================================================
// Lowering
// =============================================================================
function lowerWithContext(
  steps: readonly ExecutionStep[],
  dependencyEdges: readonly DependencyEdge[],
  abstractNodes: readonly IntentNodeId[],
  graph: IntentGraph,
  ctx: ManifestoExportContext
): {
  invocationPlan: InvocationPlan;
  extensionCandidates: readonly ExtensionCandidate[];
  meta: ManifestoBundle["meta"];
} {
  const invocationSteps: InvocationStep[] = [];
  const extensionCandidates: ExtensionCandidate[] = [];

  let readyCount = 0;
  let deferredCount = 0;
  let failedCount = 0;

  for (const step of steps) {
    const result = lowerStep(step.nodeId, step.ir, step.resolution, graph, ctx);
    invocationSteps.push(result.step);

    switch (result.step.lowering.status) {
      case "ready":
        readyCount++;
        break;
      case "deferred":
        deferredCount++;
        break;
      case "failed":
        failedCount++;
        break;
    }

    if (result.extensionCandidate) {
      extensionCandidates.push(result.extensionCandidate);
    }
  }

  const invocationPlan: InvocationPlan = {
    steps: invocationSteps,
    dependencyEdges,
    abstractNodes,
  };

  return {
    invocationPlan,
    extensionCandidates,
    meta: {
      nodeCount: invocationSteps.length,
      readyCount,
      deferredCount,
      failedCount,
    },
  };
}

function lowerStep(
  nodeId: IntentNodeId,
  ir: ExecutionStep["ir"],
  resolution: ExecutionStep["resolution"],
  graph: IntentGraph,
  ctx: ManifestoExportContext
): {
  step: InvocationStep;
  extensionCandidate: ExtensionCandidate | null;
} {
  let resolved: ReturnType<ManifestoExportContext["resolver"]["resolveReferences"]>;

  try {
    resolved = ctx.resolver.resolveReferences(ir);
  } catch (error) {
    const failure: LoweringFailure = {
      kind: "INTERNAL_ERROR",
      details: error instanceof Error ? error.message : String(error),
    };

    const candidate = generateMelCandidate(nodeId, ir, failure, graph);

    return {
      step: {
        nodeId,
        ir,
        resolution,
        lowering: { status: "failed", failure },
      },
      extensionCandidate: toExtensionCandidate(candidate),
    };
  }

  if (resolution.status !== "Resolved") {
    const reason = resolution.missing?.length
      ? `Missing roles: ${resolution.missing.join(", ")}`
      : `Resolution status is "${resolution.status}"`;

    return {
      step: {
        nodeId,
        ir,
        resolution,
        lowering: { status: "deferred", reason },
      },
      extensionCandidate: null,
    };
  }

  const actionType = ctx.lexicon.resolveActionType(ir.event.lemma);
  if (!actionType) {
    const failure: LoweringFailure = {
      kind: "UNSUPPORTED_EVENT",
      details: `No action type found for lemma "${ir.event.lemma}"`,
    };

    const candidate = generateMelCandidate(nodeId, ir, failure, graph);

    return {
      step: {
        nodeId,
        ir,
        resolution,
        lowering: { status: "failed", failure },
      },
      extensionCandidate: toExtensionCandidate(candidate),
    };
  }

  try {
    const input = ctx.lexicon.mapArgsToInput(resolved.args, resolved.cond);
    const scopeProposal = ctx.lexicon.deriveScopeProposal?.(resolved);

    const intentBody: IntentBody = {
      type: actionType,
      ...(input !== undefined && { input }),
      ...(scopeProposal !== undefined && { scopeProposal }),
    };

    const lowering: LoweringResult = {
      status: "ready",
      intentBody,
    };

    return {
      step: {
        nodeId,
        ir,
        resolution,
        lowering,
      },
      extensionCandidate: null,
    };
  } catch (error) {
    const failure: LoweringFailure = {
      kind: "INVALID_ARGS",
      details: error instanceof Error ? error.message : String(error),
    };

    const candidate = generateMelCandidate(nodeId, ir, failure, graph);

    return {
      step: {
        nodeId,
        ir,
        resolution,
        lowering: { status: "failed", failure },
      },
      extensionCandidate: toExtensionCandidate(candidate),
    };
  }
}

function toExtensionCandidate(candidate: MelCandidate): ExtensionCandidate {
  return {
    nodeId: candidate.nodeId,
    kind: "mel",
    payload: {
      template: candidate.template,
      reason: candidate.reason,
    },
    wouldEnable: candidate.wouldEnable,
  };
}
