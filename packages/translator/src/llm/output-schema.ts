/**
 * @fileoverview LLM Output Schema Validation
 *
 * Validates and parses LLM output into structured intent nodes.
 * Includes normalization for v0.1 spec compliance.
 */

import type { IntentIR, Role } from "@manifesto-ai/intent-ir";
import type { LLMIntentNode, AmbiguityIndicators } from "./provider.js";

// =============================================================================
// Normalization Types & Constants
// =============================================================================

/**
 * Valid ValueTypes per Intent IR v0.1 spec.
 */
const VALID_VALUE_TYPES = ["string", "number", "boolean", "date", "enum", "id"] as const;
type ValidValueType = (typeof VALID_VALUE_TYPES)[number];

/**
 * Normalization warning for tracking fixes.
 */
export type NormalizationWarning = {
  nodeId: string;
  field: string;
  original: unknown;
  normalized: unknown;
  reason: string;
};

// Collected warnings during parse
let currentNodeId = "";
let warnings: NormalizationWarning[] = [];

function addWarning(field: string, original: unknown, normalized: unknown, reason: string): void {
  warnings.push({ nodeId: currentNodeId, field, original, normalized, reason });
}

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

function isValidForce(value: unknown): value is (typeof VALID_FORCES)[number] {
  return typeof value === "string" && VALID_FORCES.includes(value as any);
}

// =============================================================================
// ValueType Normalization
// =============================================================================

/**
 * Normalize arbitrary valueType to v0.1 spec-compliant value.
 */
function normalizeValueType(rawType: string): ValidValueType {
  const lower = rawType.toLowerCase().trim();

  // Direct matches
  if (VALID_VALUE_TYPES.includes(lower as ValidValueType)) {
    return lower as ValidValueType;
  }

  // Known mappings for enum-like types
  const enumPatterns = [
    "priority",
    "status",
    "level",
    "quarter",
    "q1",
    "q2",
    "q3",
    "q4",
    "category",
    "type",
    "state",
    "mode",
    "kind",
    "phase",
    "stage",
    "grade",
    "rank",
    "tier",
    "improvement",
    "report",
  ];
  if (enumPatterns.some((p) => lower.includes(p) || lower === p)) {
    return "enum";
  }

  // Date/time patterns
  const datePatterns = ["time", "date", "deadline", "timestamp", "duration", "period", "schedule"];
  if (datePatterns.some((p) => lower.includes(p))) {
    return "date";
  }

  // Number patterns
  const numberPatterns = [
    "count",
    "amount",
    "quantity",
    "size",
    "total",
    "average",
    "sum",
    "percent",
    "rate",
    "score",
  ];
  if (numberPatterns.some((p) => lower.includes(p))) {
    return "number";
  }

  // Boolean patterns
  const booleanPatterns = ["flag", "enabled", "disabled", "active", "inactive", "completed"];
  if (booleanPatterns.some((p) => lower === p)) {
    return "boolean";
  }

  // Default to string for unknown types
  return "string";
}

// =============================================================================
// Cond Normalization
// =============================================================================

/**
 * Valid predicate operators per v0.1 spec.
 */
const VALID_PRED_OPS = ["=", "!=", "<", ">", "<=", ">=", "contains", "startsWith", "matches"];

/**
 * Scoped path regex for LHS validation.
 */
const SCOPED_PATH_REGEX = /^(target|theme|source|dest|state|env|computed)\.[A-Za-z0-9_.]+$/;

/**
 * Check if value is a valid predicate per v0.1 spec.
 */
function isValidPred(pred: unknown): boolean {
  if (!pred || typeof pred !== "object") return false;
  const p = pred as Record<string, unknown>;

  // Must have lhs (string), op (string), rhs (object)
  if (typeof p.lhs !== "string") return false;
  if (typeof p.op !== "string") return false;
  if (!p.rhs || typeof p.rhs !== "object") return false;

  // lhs must be scoped path
  if (!SCOPED_PATH_REGEX.test(p.lhs)) return false;

  // op must be valid
  if (!VALID_PRED_OPS.includes(p.op)) return false;

  return true;
}

/**
 * Normalize cond to v0.1 spec-compliant Pred[] or undefined.
 */
function normalizeCond(rawCond: unknown): unknown[] | undefined {
  // If already valid Pred[]
  if (Array.isArray(rawCond)) {
    const validPreds = rawCond.filter(isValidPred);
    if (validPreds.length > 0) {
      return validPreds;
    }
    // If no valid preds, add warning and return undefined
    if (rawCond.length > 0) {
      addWarning("cond", rawCond, undefined, "No valid predicates found in cond array");
    }
    return undefined;
  }

  // If invalid structure (object with type/or/not), skip it
  if (rawCond && typeof rawCond === "object" && !Array.isArray(rawCond)) {
    const obj = rawCond as Record<string, unknown>;
    // Detect common invalid patterns
    if (obj.type === "FILTER" || obj.or || obj.not || obj.and) {
      addWarning(
        "cond",
        rawCond,
        undefined,
        "Complex filter structure (type/or/not/and) not supported in v0.1, use Pred[] only"
      );
    }
    return undefined;
  }

  return undefined;
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
    const rawValueType = typeof obj.valueType === "string" ? obj.valueType : "string";
    const normalizedType = normalizeValueType(rawValueType);

    // Build shape, preserving original
    const shape: Record<string, unknown> =
      typeof obj.shape === "object" && obj.shape !== null
        ? { ...(obj.shape as Record<string, unknown>) }
        : {};

    // If type was normalized, track for debugging
    if (rawValueType !== normalizedType) {
      shape.originalType = rawValueType;
      addWarning("valueType", rawValueType, normalizedType, `Normalized from "${rawValueType}" to "${normalizedType}"`);
    }

    return {
      kind: "value",
      valueType: normalizedType,
      shape,
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
  if (obj.cond !== undefined) {
    const normalizedCond = normalizeCond(obj.cond);
    if (normalizedCond) {
      (ir as any).cond = normalizedCond;
    }
    // If cond was invalid, it's simply omitted (no error, warning already added)
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

  // Set current node ID for warning tracking
  currentNodeId = obj.tempId;

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
 * Includes normalization to ensure v0.1 spec compliance.
 */
export function parseLLMOutput(jsonString: string): {
  nodes: LLMIntentNode[];
  warnings: NormalizationWarning[];
  error?: string;
} {
  // Reset warnings for this parse
  warnings = [];
  currentNodeId = "";

  try {
    const raw = JSON.parse(jsonString) as RawLLMOutput;

    if (raw.error) {
      return { nodes: [], warnings: [], error: raw.error };
    }

    if (!Array.isArray(raw.nodes)) {
      return { nodes: [], warnings: [], error: "Invalid output: nodes must be an array" };
    }

    const nodes: LLMIntentNode[] = [];
    for (const rawNode of raw.nodes) {
      const node = parseLLMNode(rawNode);
      if (node) {
        nodes.push(node);
      }
    }

    // Return collected warnings
    return { nodes, warnings: [...warnings] };
  } catch (error) {
    return {
      nodes: [],
      warnings: [...warnings],
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
