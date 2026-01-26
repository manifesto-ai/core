/**
 * @fileoverview LLM Output Schema Validation
 *
 * Validates and parses LLM output into structured intent nodes.
 */

import type { IntentIR, Role } from "@manifesto-ai/intent-ir";
import type { LLMIntentNode, AmbiguityIndicators } from "./provider.js";

// =============================================================================
// Types for Raw LLM Output
// =============================================================================

/**
 * Raw LLM output structure (before validation).
 */
export type RawLLMOutput = {
  nodes?: unknown[];
  error?: string;
};

/**
 * Raw node from LLM output.
 */
type RawLLMNode = {
  tempId?: unknown;
  ir?: unknown;
  dependsOnTempIds?: unknown;
  ambiguityIndicators?: unknown;
};

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Check if value is a valid Role.
 */
const VALID_ROLES: readonly Role[] = [
  "TARGET",
  "THEME",
  "SOURCE",
  "DEST",
  "INSTRUMENT",
  "BENEFICIARY",
];

function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && VALID_ROLES.includes(value as Role);
}

/**
 * Check if value is a valid event class.
 */
const VALID_EVENT_CLASSES = [
  "OBSERVE",
  "CREATE",
  "TRANSFORM",
  "CONTROL",
  "DECIDE",
  "SOLVE",
] as const;

function isValidEventClass(value: unknown): value is typeof VALID_EVENT_CLASSES[number] {
  return typeof value === "string" && VALID_EVENT_CLASSES.includes(value as any);
}

/**
 * Check if value is a valid force.
 */
const VALID_FORCES = ["DO", "ASK", "VERIFY", "CONFIRM", "CLARIFY"] as const;

function isValidForce(value: unknown): value is typeof VALID_FORCES[number] {
  return typeof value === "string" && VALID_FORCES.includes(value as any);
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate and parse ambiguity indicators.
 */
function parseAmbiguityIndicators(raw: unknown): AmbiguityIndicators {
  const defaults: AmbiguityIndicators = {
    hasUnresolvedRef: false,
    missingRequiredRoles: [],
    multipleInterpretations: false,
    confidenceScore: 0.5,
  };

  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const obj = raw as Record<string, unknown>;

  return {
    hasUnresolvedRef: typeof obj.hasUnresolvedRef === "boolean" ? obj.hasUnresolvedRef : false,
    missingRequiredRoles: Array.isArray(obj.missingRequiredRoles)
      ? obj.missingRequiredRoles.filter(isValidRole)
      : [],
    multipleInterpretations:
      typeof obj.multipleInterpretations === "boolean" ? obj.multipleInterpretations : false,
    confidenceScore:
      typeof obj.confidenceScore === "number" &&
      obj.confidenceScore >= 0 &&
      obj.confidenceScore <= 1
        ? obj.confidenceScore
        : 0.5,
  };
}

/**
 * Validate and parse a term.
 */
function parseTerm(raw: unknown): IntentIR["args"][Role] | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const obj = raw as Record<string, unknown>;
  const kind = obj.kind;

  if (kind === "entity") {
    if (typeof obj.entityType !== "string") {
      return undefined;
    }
    const term: any = {
      kind: "entity",
      entityType: obj.entityType,
    };
    if (obj.ref && typeof obj.ref === "object") {
      term.ref = obj.ref;
    }
    return term;
  }

  if (kind === "value") {
    if (typeof obj.valueType !== "string") {
      return undefined;
    }
    return {
      kind: "value",
      valueType: obj.valueType as any,
      shape: typeof obj.shape === "object" && obj.shape !== null ? obj.shape : {},
      raw: obj.raw,
    } as any;
  }

  if (kind === "path") {
    if (typeof obj.path !== "string") {
      return undefined;
    }
    return {
      kind: "path",
      path: obj.path,
    } as any;
  }

  if (kind === "artifact") {
    return {
      kind: "artifact",
      format: typeof obj.format === "string" ? obj.format : "unknown",
      content: obj.content,
    } as any;
  }

  if (kind === "expr") {
    return {
      kind: "expr",
      formula: typeof obj.formula === "string" ? obj.formula : "",
    } as any;
  }

  return undefined;
}

/**
 * Validate and parse args.
 */
function parseArgs(raw: unknown): IntentIR["args"] {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const obj = raw as Record<string, unknown>;
  const args: IntentIR["args"] = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isValidRole(key)) {
      const term = parseTerm(value);
      if (term) {
        args[key] = term;
      }
    }
  }

  return args;
}

/**
 * Validate and parse IntentIR.
 */
function parseIntentIR(raw: unknown): IntentIR | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // Check required fields
  if (obj.v !== "0.1") {
    return null;
  }

  if (!isValidForce(obj.force)) {
    return null;
  }

  const event = obj.event;
  if (!event || typeof event !== "object") {
    return null;
  }

  const eventObj = event as Record<string, unknown>;
  if (typeof eventObj.lemma !== "string" || !isValidEventClass(eventObj.class)) {
    return null;
  }

  const ir: IntentIR = {
    v: "0.1",
    force: obj.force as any,
    event: {
      lemma: eventObj.lemma,
      class: eventObj.class as any,
    },
    args: parseArgs(obj.args),
  };

  // Optional fields
  if (obj.cond && typeof obj.cond === "object") {
    (ir as any).cond = obj.cond;
  }

  if (obj.temp && typeof obj.temp === "object") {
    (ir as any).temp = obj.temp;
  }

  return ir;
}

/**
 * Validate and parse a single LLM node.
 */
function parseLLMNode(raw: unknown): LLMIntentNode | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const obj = raw as RawLLMNode;

  // Validate tempId
  if (typeof obj.tempId !== "string" || !obj.tempId) {
    return null;
  }

  // Validate IR
  const ir = parseIntentIR(obj.ir);
  if (!ir) {
    return null;
  }

  // Parse dependencies
  const dependsOnTempIds: string[] = [];
  if (Array.isArray(obj.dependsOnTempIds)) {
    for (const dep of obj.dependsOnTempIds) {
      if (typeof dep === "string") {
        dependsOnTempIds.push(dep);
      }
    }
  }

  return {
    tempId: obj.tempId,
    ir,
    dependsOnTempIds,
    ambiguityIndicators: parseAmbiguityIndicators(obj.ambiguityIndicators),
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Parse LLM output JSON string.
 */
export function parseLLMOutput(jsonString: string): {
  nodes: LLMIntentNode[];
  error?: string;
} {
  try {
    const raw = JSON.parse(jsonString) as RawLLMOutput;

    if (raw.error) {
      return { nodes: [], error: raw.error };
    }

    if (!Array.isArray(raw.nodes)) {
      return { nodes: [], error: "Invalid output: nodes must be an array" };
    }

    const nodes: LLMIntentNode[] = [];
    for (const rawNode of raw.nodes) {
      const node = parseLLMNode(rawNode);
      if (node) {
        nodes.push(node);
      }
    }

    return { nodes };
  } catch (error) {
    return {
      nodes: [],
      error: `Failed to parse LLM output: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate that all node dependencies reference existing nodes.
 */
export function validateNodeDependencies(nodes: readonly LLMIntentNode[]): {
  valid: boolean;
  error?: string;
} {
  const nodeIds = new Set(nodes.map((n) => n.tempId));

  for (const node of nodes) {
    for (const depId of node.dependsOnTempIds) {
      if (!nodeIds.has(depId)) {
        return {
          valid: false,
          error: `Node ${node.tempId} depends on non-existent node ${depId}`,
        };
      }
    }
  }

  return { valid: true };
}
