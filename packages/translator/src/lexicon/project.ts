/**
 * @fileoverview Project Lexicon
 *
 * Derives a Lexicon from DomainSchema.
 * Maps domain actions to event entries.
 * Aligned with SPEC §7.3.
 */

import {
  createLexicon,
  type Lexicon,
  type EventEntry,
  type EventClass,
  type ThetaFrame,
  type IntentIR,
} from "@manifesto-ai/intent-ir";

// =============================================================================
// Types
// =============================================================================

/**
 * Simplified DomainSchema type for lexicon derivation
 * (Avoids direct core dependency)
 */
export type DomainSchemaLike = {
  readonly id: string;
  readonly version: string;
  readonly hash: string;
  readonly actions: Readonly<Record<string, ActionSpecLike>>;
  readonly state?: unknown;
  readonly types?: unknown;
  readonly computed?: unknown;
};

/**
 * Simplified ActionSpec type
 */
export type ActionSpecLike = {
  readonly flow: unknown;
  readonly input?: FieldSpecLike;
  readonly available?: unknown;
  readonly description?: string;
};

/**
 * Simplified FieldSpec type
 * Note: type can be string or object (for enum types)
 * Note: required can be boolean or string array depending on schema version
 */
export type FieldSpecLike = {
  readonly type?: string | { enum: readonly unknown[] } | unknown;
  readonly fields?: Readonly<Record<string, FieldSpecLike>>;
  readonly required?: boolean | readonly string[];
  readonly optional?: boolean;
};

// =============================================================================
// Event Class Inference
// =============================================================================

/**
 * Infer event class from action name and spec
 * Simple heuristic for v0.1
 */
function inferEventClass(actionName: string, _spec: ActionSpecLike): EventClass {
  const name = actionName.toLowerCase();

  // CREATE patterns
  if (
    name.startsWith("create") ||
    name.startsWith("add") ||
    name.startsWith("new") ||
    name.startsWith("define")
  ) {
    return "CREATE";
  }

  // CONTROL patterns
  if (
    name.startsWith("cancel") ||
    name.startsWith("stop") ||
    name.startsWith("pause") ||
    name.startsWith("resume") ||
    name.startsWith("start")
  ) {
    return "CONTROL";
  }

  // OBSERVE patterns
  if (
    name.startsWith("get") ||
    name.startsWith("fetch") ||
    name.startsWith("load") ||
    name.startsWith("read") ||
    name.startsWith("list")
  ) {
    return "OBSERVE";
  }

  // DECIDE patterns
  if (
    name.startsWith("approve") ||
    name.startsWith("reject") ||
    name.startsWith("confirm") ||
    name.startsWith("deny")
  ) {
    return "DECIDE";
  }

  // Default to TRANSFORM (most common)
  return "TRANSFORM";
}

// =============================================================================
// ThetaFrame Derivation
// =============================================================================

/**
 * Derive theta-frame from action input spec
 * Maps input fields to theta roles
 */
function deriveThetaFrame(spec: ActionSpecLike): ThetaFrame {
  const required: string[] = [];
  const optional: string[] = [];

  if (spec.input?.fields) {
    // Handle required as either boolean or string array
    const inputRequired = spec.input.required;
    const requiredFields: Set<string> =
      typeof inputRequired === "boolean"
        ? new Set() // If boolean, treat as field-level required
        : new Set(inputRequired ?? []);

    for (const fieldName of Object.keys(spec.input.fields)) {
      // Map common field names to roles
      const role = mapFieldToRole(fieldName);
      if (role) {
        // Check field-level required
        const fieldSpec = spec.input.fields[fieldName];
        const isRequired =
          requiredFields.has(fieldName) ||
          (typeof fieldSpec?.required === "boolean" && fieldSpec.required);

        if (isRequired) {
          required.push(role);
        } else {
          optional.push(role);
        }
      }
    }
  }

  // Default TARGET if no fields found
  if (required.length === 0 && optional.length === 0) {
    optional.push("TARGET");
  }

  return {
    required: required as ThetaFrame["required"],
    optional: optional as ThetaFrame["optional"],
    restrictions: {},
  };
}

/**
 * Map field name to theta role (heuristic)
 */
function mapFieldToRole(fieldName: string): string | undefined {
  const name = fieldName.toLowerCase();

  // TARGET patterns
  if (
    name === "target" ||
    name === "id" ||
    name === "name" ||
    name === "key"
  ) {
    return "TARGET";
  }

  // THEME patterns
  if (
    name === "content" ||
    name === "body" ||
    name === "data" ||
    name === "value" ||
    name === "text"
  ) {
    return "THEME";
  }

  // SOURCE patterns
  if (name === "source" || name === "from" || name === "origin") {
    return "SOURCE";
  }

  // DEST patterns
  if (name === "dest" || name === "to" || name === "destination") {
    return "DEST";
  }

  // INSTRUMENT patterns
  if (name === "options" || name === "params" || name === "config") {
    return "INSTRUMENT";
  }

  // BENEFICIARY patterns
  if (name === "user" || name === "owner" || name === "assignee") {
    return "BENEFICIARY";
  }

  return undefined;
}

// =============================================================================
// Project Lexicon Factory
// =============================================================================

/**
 * Derive Project Lexicon from DomainSchema
 *
 * @param schema - Domain schema from app.getDomainSchema()
 * @returns Lexicon with entries for each action
 */
export function deriveProjectLexicon(schema: DomainSchemaLike | null): Lexicon {
  if (!schema) {
    // Empty lexicon if no schema
    return createLexicon({
      events: {},
      entities: {},
    });
  }

  const events: Record<string, EventEntry> = {};
  const actionTypes: Record<string, string> = {};

  for (const [actionName, actionSpec] of Object.entries(schema.actions ?? {})) {
    const lemma = actionName.toUpperCase();

    events[lemma] = {
      eventClass: inferEventClass(actionName, actionSpec),
      thetaFrame: deriveThetaFrame(actionSpec),
    };

    // Action type is the original action name (camelCase or as defined)
    actionTypes[lemma] = actionName;
  }

  return createLexicon({
    events,
    entities: {},
    actionTypes,
    mapArgsToInput: defaultMapArgsToInput,
  });
}

/**
 * Default args to input mapper for project lexicon
 */
function defaultMapArgsToInput(
  args: IntentIR["args"],
  cond?: IntentIR["cond"]
): unknown {
  const input: Record<string, unknown> = {};

  // Map roles to field names
  for (const [role, term] of Object.entries(args as Record<string, unknown>)) {
    if (term === undefined) continue;

    const fieldName = roleToFieldName(role);
    input[fieldName] = extractTermValue(term);
  }

  // Add conditions as filter if present
  if (cond && cond.length > 0) {
    input["filter"] = cond.map((pred) => ({
      field: pred.lhs,
      op: pred.op,
      value: extractTermValue(pred.rhs as unknown),
    }));
  }

  return input;
}

/**
 * Map role to field name
 */
function roleToFieldName(role: string): string {
  return role.toLowerCase();
}

/**
 * Extract value from term
 */
function extractTermValue(term: unknown): unknown {
  if (!term || typeof term !== "object") {
    return term;
  }

  const t = term as { kind?: string; [key: string]: unknown };

  switch (t.kind) {
    case "value":
      return t.raw ?? t.shape;
    case "entity":
      return (t.ref as { id?: string })?.id ?? t.entityType;
    case "path":
      return t.path;
    case "artifact": {
      const ref = t.ref as { kind?: string; id?: string };
      return ref?.kind === "inline" ? t.content : ref?.id;
    }
    case "expr":
      return t.expr;
    default:
      return undefined;
  }
}
