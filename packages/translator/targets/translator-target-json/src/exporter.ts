/**
 * @fileoverview JSON target exporter.
 */

import { buildExecutionPlan, type ExportInput, type TargetExporter } from "@manifesto-ai/translator";
import type { JsonOutput } from "./types.js";

export const jsonExporter: TargetExporter<JsonOutput, void> = {
  id: "json",

  async export(input: ExportInput): Promise<JsonOutput> {
    const plan = buildExecutionPlan(input.graph);

    return {
      nodes: plan.steps.map((step) => ({
        id: step.nodeId,
        event: step.ir.event,
        resolution: step.resolution.status,
        dependencies:
          input.graph.nodes.find((node) => node.id === step.nodeId)?.dependsOn ?? [],
      })),
      edges: plan.dependencyEdges.map((edge) => ({
        from: edge.from,
        to: edge.to,
      })),
    };
  },
};
