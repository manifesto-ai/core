/**
 * @fileoverview Task enumeration repair plugin.
 *
 * Extracts task names from input text and resolves ambiguous task nodes.
 */

import type { PipelinePlugin, ReadonlyPipelineContext } from "./types.js";
import type { IntentGraph, IntentNode } from "../core/types/intent-graph.js";
import { ROLE_VALUES } from "@manifesto-ai/intent-ir";

const EXT_NAMESPACE = "manifesto.ai/translator";

export const taskEnumerationPlugin: PipelinePlugin = {
  name: "task-enumeration",
  kind: "transformer",
  createRunHooks() {
    return {
      afterMerge(ctx: ReadonlyPipelineContext) {
        if (!ctx.merged) return;
        const taskNames = extractTaskNames(ctx.input);
        if (taskNames.length === 0) return;

        let changed = false;
        const nextNodes = ctx.merged.nodes.map((node) => {
          const update = applyTaskNames(node, taskNames);
          if (!update) {
            return node;
          }
          changed = true;
          return update;
        });

        return changed ? { ...ctx.merged, nodes: nextNodes } : undefined;
      },
    };
  },
};

function applyTaskNames(node: IntentNode, taskNames: string[]): IntentNode | null {
  if (!shouldAnnotateNode(node)) return null;

  const ext = (node.ir.ext ?? {}) as Record<string, unknown>;
  const existingNamespace = (ext[EXT_NAMESPACE] ?? {}) as Record<string, unknown>;
  const nextExt = {
    ...ext,
    [EXT_NAMESPACE]: {
      ...existingNamespace,
      taskNames,
    },
  };

  const missing = node.resolution.missing ?? [];
  const filteredMissing = missing.filter((role) => isKnownRole(role));
  const nextResolution = {
    ...node.resolution,
    missing: filteredMissing.length > 0 ? filteredMissing : undefined,
    ...(filteredMissing.length === 0 && {
      status: "Resolved" as const,
      ambiguityScore: 0,
    }),
  };

  return {
    ...node,
    ir: {
      ...node.ir,
      ext: nextExt,
    },
    resolution: nextResolution,
  };
}

function shouldAnnotateNode(node: IntentNode): boolean {
  if (node.resolution.status !== "Ambiguous") return false;
  const missing = node.resolution.missing ?? [];
  const hasTaskNameMissing = missing.some(
    (role) => !isKnownRole(role) && String(role).toLowerCase().includes("task")
  );
  if (!hasTaskNameMissing) return false;

  const theme = node.ir.args?.THEME as unknown;
  const target = node.ir.args?.TARGET as unknown;
  return isTaskEntity(theme) || isTaskEntity(target);
}

function isKnownRole(role: unknown): boolean {
  return ROLE_VALUES.includes(role as (typeof ROLE_VALUES)[number]);
}

function isTaskEntity(term: unknown): boolean {
  if (!term || typeof term !== "object") return false;
  const record = term as Record<string, unknown>;
  if (record.kind !== "entity") return false;
  const entityType = String(record.entityType ?? "").toLowerCase();
  return entityType.includes("task");
}

function extractTaskNames(input: string): string[] {
  const match =
    input.match(/tasks?\s+(?:for|named|called)\s+([^.,]+)/i) ??
    input.match(/tasks?\s*:\s*([^.,]+)/i);

  if (!match) return [];

  const segment = match[1];
  return segment
    .split(/,| and | & /i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => part.replace(/^the\s+/i, ""))
    .filter((part) => part.length > 0);
}
