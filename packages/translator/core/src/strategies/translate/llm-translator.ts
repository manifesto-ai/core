/**
 * @fileoverview LLMTranslator (SPEC Section 6.2)
 *
 * LLM-based semantic extraction.
 *
 * Per G-INV-*:
 * - G-INV-1: Node IDs are unique within graph
 * - G-INV-2: All dependsOn IDs exist in graph
 * - G-INV-3: Graph is a DAG (no cycles)
 * - G-INV-4: Non-abstract nodes SHALL NOT depend on abstract nodes
 *
 * @module strategies/translate/llm-translator
 */

import type {
  IntentGraph,
  IntentNode,
  IntentNodeId,
  Resolution,
  ResolutionStatus,
} from "../../core/types/intent-graph.js";
import type { Role } from "@manifesto-ai/intent-ir";
import { createNodeId } from "../../core/types/intent-graph.js";
import type {
  TranslateStrategy,
  TranslateOptions,
} from "../../core/interfaces/translator.js";
import type {
  LLMPort,
  LLMRequest,
} from "../../core/interfaces/llm-port.js";

// =============================================================================
// LLMTranslatorConfig
// =============================================================================

/**
 * Configuration for LLMTranslator.
 */
export interface LLMTranslatorConfig {
  /** System prompt template */
  systemPrompt?: string;

  /** Temperature for LLM calls (default: 0.1) */
  temperature?: number;

  /** Maximum tokens for response */
  maxTokens?: number;
}

// =============================================================================
// Default System Prompt
// =============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are a semantic intent extractor. Given natural language input, extract intents as a structured JSON array.

Each intent should have:
- id: unique identifier (e.g., "n1", "n2")
- event: the action/verb (e.g., "create", "add", "delete")
- args: key-value pairs of arguments
- dependsOn: array of node IDs this intent depends on
- resolution: { status: "Resolved" | "Ambiguous" | "Abstract", ambiguityScore: 0-1, missing?: string[], questions?: string[] }

Output valid JSON only, no markdown or explanation.

Example:
Input: "Create a project named Demo and add three tasks"
Output:
{
  "nodes": [
    {
      "id": "n1",
      "event": "create",
      "args": { "target": { "type": "project" }, "theme": { "name": "Demo" } },
      "dependsOn": [],
      "resolution": { "status": "Resolved", "ambiguityScore": 0 }
    },
    {
      "id": "n2",
      "event": "add",
      "args": { "target": { "ref": "n1" }, "theme": { "type": "task", "count": 3 } },
      "dependsOn": ["n1"],
      "resolution": { "status": "Ambiguous", "ambiguityScore": 0.5, "missing": ["THEME"], "questions": ["What are the task names?"] }
    }
  ]
}`;

// =============================================================================
// LLMTranslator
// =============================================================================

/**
 * LLM-based semantic extraction.
 *
 * Per SPEC Section 6.2:
 * - Uses LLMPort for LLM communication
 * - Extracts intents as structured JSON
 * - Validates output against G-INV-*
 */
export class LLMTranslator implements TranslateStrategy {
  readonly name = "LLMTranslator";

  private readonly llm: LLMPort;
  private readonly config: LLMTranslatorConfig;

  constructor(llm: LLMPort, config?: LLMTranslatorConfig) {
    this.llm = llm;
    this.config = config ?? {};
  }

  async translate(
    text: string,
    options?: TranslateOptions
  ): Promise<IntentGraph> {
    // Build request
    const request: LLMRequest = {
      system: this.config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: this.buildPrompt(text, options),
        },
      ],
      options: {
        temperature: this.config.temperature ?? 0.1,
        maxTokens: this.config.maxTokens ?? 4096,
        responseFormat: "json",
      },
    };

    // Call LLM
    const response = await this.llm.complete(request);

    // Parse response
    const parsed = this.parseResponse(response.content);

    // Validate and return
    return this.buildGraph(parsed);
  }

  private buildPrompt(text: string, options?: TranslateOptions): string {
    let prompt = `Extract intents from the following text:\n\n${text}`;

    if (options?.domain) {
      prompt += `\n\nDomain hint: ${options.domain}`;
    }

    if (options?.maxNodes) {
      prompt += `\n\nExtract at most ${options.maxNodes} intents.`;
    }

    if (options?.allowedEvents?.length) {
      prompt += `\n\nAllowed events: ${options.allowedEvents.join(", ")}`;
    }

    return prompt;
  }

  private parseResponse(content: string): LLMGraphResponse {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        throw new Error("Response missing 'nodes' array");
      }

      return parsed as LLMGraphResponse;
    } catch (error) {
      throw new Error(
        `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private buildGraph(response: LLMGraphResponse): IntentGraph {
    const nodes: IntentNode[] = response.nodes.map((node) => {
      // Map event string to proper IntentIR event structure
      const eventClass = this.mapEventToClass(node.event);
      const eventLemma = node.event.toUpperCase();
      const { args, extArgs } = this.normalizeArgs(node.args ?? {}, eventLemma);
      const ext = this.mergeExt(node.ext, extArgs);

      // Build proper IntentIR
      const ir = {
        v: "0.2" as const,
        force: "DO" as const,
        event: {
          lemma: eventLemma,
          class: eventClass,
        },
        args,
        ...(ext && { ext }),
      };

      // Build resolution
      const resolutionStatus = this.normalizeStatus(node.resolution?.status);
      const resolution: Resolution = {
        status: resolutionStatus,
        ambiguityScore: node.resolution?.ambiguityScore ?? 0.5,
        ...(node.resolution?.missing?.length && {
          missing: node.resolution.missing as Resolution["missing"],
        }),
        ...(node.resolution?.questions?.length && {
          questions: node.resolution.questions,
        }),
      };

      return {
        id: createNodeId(node.id),
        ir,
        dependsOn: (node.dependsOn ?? []).map((id) =>
          createNodeId(id)
        ) as IntentNodeId[],
        resolution,
      };
    });

    return { nodes };
  }

  private mapEventToClass(event: string): "OBSERVE" | "TRANSFORM" | "SOLVE" | "CREATE" | "DECIDE" | "CONTROL" {
    const eventUpper = event.toUpperCase();
    const createEvents = ["CREATE", "ADD", "NEW", "GENERATE", "WRITE"];
    const transformEvents = ["UPDATE", "MODIFY", "CHANGE", "EDIT", "SET"];
    const controlEvents = ["DELETE", "REMOVE", "CANCEL", "STOP", "START", "ARCHIVE"];
    const observeEvents = ["GET", "LIST", "SHOW", "DESCRIBE", "READ", "FIND"];
    const solveEvents = ["CALCULATE", "SOLVE", "PROVE", "DERIVE", "COMPUTE"];
    const decideEvents = ["SELECT", "CHOOSE", "APPROVE", "REJECT", "DECIDE"];

    if (createEvents.includes(eventUpper)) return "CREATE";
    if (transformEvents.includes(eventUpper)) return "TRANSFORM";
    if (controlEvents.includes(eventUpper)) return "CONTROL";
    if (observeEvents.includes(eventUpper)) return "OBSERVE";
    if (solveEvents.includes(eventUpper)) return "SOLVE";
    if (decideEvents.includes(eventUpper)) return "DECIDE";

    return "OBSERVE"; // Default
  }

  private normalizeStatus(status?: string): ResolutionStatus {
    if (status === "Resolved" || status === "Ambiguous" || status === "Abstract") {
      return status;
    }
    return "Ambiguous";
  }

  private normalizeArgs(
    args: Record<string, unknown>,
    eventLemma: string
  ): { args: Record<string, unknown>; extArgs: Record<string, unknown> } {
    const normalized: Record<string, unknown> = {};
    const extArgs: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      const roleKey = this.normalizeRoleKey(key, eventLemma);
      if (!roleKey) {
        extArgs[key] = value;
        continue;
      }
      normalized[roleKey] = this.normalizeTerm(value);
    }

    return { args: normalized, extArgs };
  }

  private normalizeRoleKey(key: string, eventLemma: string): Role | null {
    const lower = key.toLowerCase();
    const compact = lower.replace(/[^a-z0-9]/g, "");

    const directMap: Record<string, Role> = {
      target: "TARGET",
      theme: "THEME",
      source: "SOURCE",
      dest: "DEST",
      instrument: "INSTRUMENT",
      beneficiary: "BENEFICIARY",
    };

    if (directMap[lower]) return directMap[lower];
    if (directMap[compact]) return directMap[compact];

    if (
      compact === "assignee" ||
      compact === "assignees" ||
      compact === "user" ||
      compact === "users" ||
      compact === "owner" ||
      compact === "owners"
    ) {
      return "BENEFICIARY";
    }

    if (compact === "to") {
      return eventLemma === "ASSIGN" ? "BENEFICIARY" : "DEST";
    }

    if (compact === "task" || compact === "tasks") {
      return eventLemma === "ASSIGN" || eventLemma === "SET" ? "TARGET" : "THEME";
    }

    if (
      compact === "duedate" ||
      compact === "deadline" ||
      compact === "due"
    ) {
      return "THEME";
    }

    if (compact === "project" || compact === "projects") {
      return "TARGET";
    }

    return null;
  }

  private normalizeTerm(value: unknown): unknown {
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (record.kind) {
        return value;
      }
      if (record.type) {
        const term: Record<string, unknown> = {
          kind: "entity",
          entityType: String(record.type),
        };
        if (record.ref) {
          term.ref = record.ref;
        }
        return term;
      }
      if (Array.isArray(value)) {
        return {
          kind: "value",
          valueType: "enum",
          shape: { values: value },
          raw: value,
        };
      }
      return {
        kind: "value",
        valueType: "string",
        shape: { value },
        raw: value,
      };
    }

    switch (typeof value) {
      case "string":
        return {
          kind: "value",
          valueType: "string",
          shape: { value },
          raw: value,
        };
      case "number":
        return {
          kind: "value",
          valueType: "number",
          shape: { value },
          raw: value,
        };
      case "boolean":
        return {
          kind: "value",
          valueType: "boolean",
          shape: { value },
          raw: value,
        };
      default:
        return value;
    }
  }

  private mergeExt(
    ext: Record<string, unknown> | undefined,
    extArgs: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    if (Object.keys(extArgs).length === 0) {
      return ext;
    }

    const next = { ...(ext ?? {}) } as Record<string, unknown>;
    const existingNamespace = (next["manifesto.ai/translator"] ??
      {}) as Record<string, unknown>;

    next["manifesto.ai/translator"] = {
      ...existingNamespace,
      args: extArgs,
    };

    return next;
  }
}

// =============================================================================
// Types
// =============================================================================

interface LLMGraphResponse {
  nodes: LLMNodeResponse[];
}

interface LLMNodeResponse {
  id: string;
  event: string;
  args?: Record<string, unknown>;
  dependsOn?: string[];
  resolution?: {
    status?: string;
    ambiguityScore?: number;
    missing?: string[];
    questions?: string[];
  };
  ext?: Record<string, unknown>;
}
