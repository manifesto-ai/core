/**
 * @manifesto-ai/compiler v1.1 PassLayer
 *
 * Converts FragmentDraft (untrusted) to Fragment (verified).
 * Per SPEC §11.1: PassLayer is a deterministic lowering pass.
 */

import { nanoid } from "nanoid";
import type {
  FragmentDraft,
  Fragment,
  FragmentContent,
  Provenance,
  Issue,
  SourceInputType,
} from "../domain/types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 Pass Context
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for the PassLayer
 */
export interface PassContext {
  /**
   * Source input ID for provenance
   */
  sourceInputId: string;

  /**
   * Source input type for provenance
   */
  sourceType: SourceInputType;

  /**
   * Plan ID for provenance
   */
  planId: string;

  /**
   * Actor ID for provenance
   */
  actorId: string;

  /**
   * Runtime ID for provenance
   */
  runtimeId: string;

  /**
   * PassLayer version
   */
  passLayerVersion: string;

  /**
   * Linker version (set later, but needed for provenance)
   */
  linkerVersion: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 Pass Result
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of lowering a FragmentDraft to Fragment
 */
export type PassResult =
  | { ok: true; fragment: Fragment }
  | { ok: false; issues: Issue[] };

// ═══════════════════════════════════════════════════════════════════════════════
// §3 Content Validators
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate and extract FragmentContent from raw interpretation
 */
function extractContent(draft: FragmentDraft): { ok: true; content: FragmentContent } | { ok: false; issues: Issue[] } {
  const raw = draft.interpretation.raw as Record<string, unknown>;

  // Check for error marker
  if (raw._error) {
    return {
      ok: false,
      issues: [{
        id: `issue_${nanoid(8)}`,
        code: "GENERATION_ERROR",
        severity: "error",
        message: String(raw._error),
        fragmentId: draft.id,
      }],
    };
  }

  switch (draft.type) {
    case "state":
      return extractStateContent(draft, raw);
    case "computed":
      return extractComputedContent(draft, raw);
    case "action":
      return extractActionContent(draft, raw);
    case "constraint":
      return extractConstraintContent(draft, raw);
    case "effect":
      return extractEffectContent(draft, raw);
    case "flow":
      return extractFlowContent(draft, raw);
    default:
      return {
        ok: false,
        issues: [{
          id: `issue_${nanoid(8)}`,
          code: "UNKNOWN_FRAGMENT_TYPE",
          severity: "error",
          message: `Unknown fragment type: ${draft.type}`,
          fragmentId: draft.id,
        }],
      };
  }
}

function extractStateContent(
  draft: FragmentDraft,
  raw: Record<string, unknown>
): { ok: true; content: FragmentContent } | { ok: false; issues: Issue[] } {
  const issues: Issue[] = [];

  if (!raw.name || typeof raw.name !== "string") {
    issues.push({
      id: `issue_${nanoid(8)}`,
      code: "MISSING_NAME",
      severity: "error",
      message: "State fragment must have a 'name' property",
      fragmentId: draft.id,
      suggestion: "Add a 'name' property to the state definition",
    });
  }

  if (!raw.schema) {
    issues.push({
      id: `issue_${nanoid(8)}`,
      code: "MISSING_SCHEMA",
      severity: "error",
      message: "State fragment must have a 'schema' property",
      fragmentId: draft.id,
      suggestion: "Add a 'schema' property defining the state structure",
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    content: {
      kind: "state",
      name: raw.name as string,
      schema: raw.schema,
      initial: raw.initial,
    },
  };
}

function extractComputedContent(
  draft: FragmentDraft,
  raw: Record<string, unknown>
): { ok: true; content: FragmentContent } | { ok: false; issues: Issue[] } {
  const issues: Issue[] = [];

  if (!raw.name || typeof raw.name !== "string") {
    issues.push({
      id: `issue_${nanoid(8)}`,
      code: "MISSING_NAME",
      severity: "error",
      message: "Computed fragment must have a 'name' property",
      fragmentId: draft.id,
    });
  }

  if (!raw.expression) {
    issues.push({
      id: `issue_${nanoid(8)}`,
      code: "MISSING_EXPRESSION",
      severity: "error",
      message: "Computed fragment must have an 'expression' property",
      fragmentId: draft.id,
    });
  }

  if (!Array.isArray(raw.dependencies)) {
    issues.push({
      id: `issue_${nanoid(8)}`,
      code: "MISSING_DEPENDENCIES",
      severity: "error",
      message: "Computed fragment must have a 'dependencies' array",
      fragmentId: draft.id,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    content: {
      kind: "computed",
      name: raw.name as string,
      expression: raw.expression,
      dependencies: raw.dependencies as string[],
    },
  };
}

function extractActionContent(
  draft: FragmentDraft,
  raw: Record<string, unknown>
): { ok: true; content: FragmentContent } | { ok: false; issues: Issue[] } {
  const issues: Issue[] = [];

  if (!raw.name || typeof raw.name !== "string") {
    issues.push({
      id: `issue_${nanoid(8)}`,
      code: "MISSING_NAME",
      severity: "error",
      message: "Action fragment must have a 'name' property",
      fragmentId: draft.id,
    });
  }

  if (!raw.flow) {
    issues.push({
      id: `issue_${nanoid(8)}`,
      code: "MISSING_FLOW",
      severity: "error",
      message: "Action fragment must have a 'flow' property",
      fragmentId: draft.id,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    content: {
      kind: "action",
      name: raw.name as string,
      input: raw.input,
      available: raw.available,
      flow: raw.flow,
    },
  };
}

function extractConstraintContent(
  draft: FragmentDraft,
  raw: Record<string, unknown>
): { ok: true; content: FragmentContent } | { ok: false; issues: Issue[] } {
  const issues: Issue[] = [];

  if (!raw.name || typeof raw.name !== "string") {
    issues.push({
      id: `issue_${nanoid(8)}`,
      code: "MISSING_NAME",
      severity: "error",
      message: "Constraint fragment must have a 'name' property",
      fragmentId: draft.id,
    });
  }

  if (!raw.expression) {
    issues.push({
      id: `issue_${nanoid(8)}`,
      code: "MISSING_EXPRESSION",
      severity: "error",
      message: "Constraint fragment must have an 'expression' property",
      fragmentId: draft.id,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    content: {
      kind: "constraint",
      name: raw.name as string,
      expression: raw.expression,
      message: raw.message as string | undefined,
    },
  };
}

function extractEffectContent(
  draft: FragmentDraft,
  raw: Record<string, unknown>
): { ok: true; content: FragmentContent } | { ok: false; issues: Issue[] } {
  const issues: Issue[] = [];

  if (!raw.name || typeof raw.name !== "string") {
    issues.push({
      id: `issue_${nanoid(8)}`,
      code: "MISSING_NAME",
      severity: "error",
      message: "Effect fragment must have a 'name' property",
      fragmentId: draft.id,
    });
  }

  if (!raw.effectType || typeof raw.effectType !== "string") {
    issues.push({
      id: `issue_${nanoid(8)}`,
      code: "MISSING_EFFECT_TYPE",
      severity: "error",
      message: "Effect fragment must have an 'effectType' property",
      fragmentId: draft.id,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    content: {
      kind: "effect",
      name: raw.name as string,
      effectType: raw.effectType as string,
      params: (raw.params as Record<string, unknown>) || {},
    },
  };
}

function extractFlowContent(
  draft: FragmentDraft,
  raw: Record<string, unknown>
): { ok: true; content: FragmentContent } | { ok: false; issues: Issue[] } {
  const issues: Issue[] = [];

  if (!raw.name || typeof raw.name !== "string") {
    issues.push({
      id: `issue_${nanoid(8)}`,
      code: "MISSING_NAME",
      severity: "error",
      message: "Flow fragment must have a 'name' property",
      fragmentId: draft.id,
    });
  }

  if (!Array.isArray(raw.steps)) {
    issues.push({
      id: `issue_${nanoid(8)}`,
      code: "MISSING_STEPS",
      severity: "error",
      message: "Flow fragment must have a 'steps' array",
      fragmentId: draft.id,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    content: {
      kind: "flow",
      name: raw.name as string,
      steps: raw.steps as unknown[],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 Dependency Extraction
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract requires from content
 */
function extractRequires(content: FragmentContent): string[] {
  switch (content.kind) {
    case "state":
      return []; // State has no dependencies

    case "computed":
      // Computed depends on its declared dependencies
      return content.dependencies.map((dep) => `state.${dep}`);

    case "action":
      // Actions may depend on state they modify
      // For now, we parse the flow to find referenced state
      return extractReferencesFromFlow(content.flow);

    case "constraint":
      // Constraints depend on state they reference
      return extractReferencesFromExpression(content.expression);

    case "effect":
      // Effects may depend on state they read
      return extractReferencesFromParams(content.params);

    case "flow":
      // Flows depend on actions/effects they reference
      return extractReferencesFromSteps(content.steps);

    default:
      return [];
  }
}

/**
 * Extract provides from content
 */
function extractProvides(content: FragmentContent): string[] {
  return [`${content.kind}.${content.name}`];
}

/**
 * Extract state references from flow definition
 */
function extractReferencesFromFlow(flow: unknown): string[] {
  const refs: Set<string> = new Set();

  function walk(value: unknown): void {
    if (typeof value === "string") {
      // Match $stateName patterns
      const matches = value.match(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g);
      if (matches) {
        for (const match of matches) {
          const name = match.slice(1); // Remove $
          if (!["input", "uuid", "now"].includes(name)) {
            refs.add(`state.${name}`);
          }
        }
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }
    } else if (typeof value === "object" && value !== null) {
      for (const key of Object.values(value)) {
        walk(key);
      }
    }
  }

  walk(flow);
  return Array.from(refs);
}

/**
 * Extract state references from expression
 */
function extractReferencesFromExpression(expression: unknown): string[] {
  return extractReferencesFromFlow(expression);
}

/**
 * Extract state references from params
 */
function extractReferencesFromParams(params: Record<string, unknown>): string[] {
  return extractReferencesFromFlow(params);
}

/**
 * Extract action/effect references from flow steps
 */
function extractReferencesFromSteps(steps: unknown[]): string[] {
  const refs: Set<string> = new Set();

  for (const step of steps) {
    if (typeof step === "object" && step !== null) {
      const s = step as Record<string, unknown>;
      if (s.action && typeof s.action === "string") {
        refs.add(`action.${s.action}`);
      }
      if (s.effect && typeof s.effect === "string") {
        refs.add(`effect.${s.effect}`);
      }
    }
  }

  return Array.from(refs);
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 PassLayer Implementation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PassLayer - converts FragmentDraft to Fragment
 *
 * Per SPEC §11.1: PassLayer is a deterministic lowering pass.
 *
 * Responsibilities:
 * - Validate FragmentDraft.interpretation.raw structure
 * - Extract requires/provides
 * - Generate path
 * - Attach provenance
 */
export interface PassLayer {
  /**
   * Lower a FragmentDraft to a Fragment
   */
  lower(draft: FragmentDraft, context: PassContext): PassResult;
}

/**
 * Create the PassLayer
 */
export function createPassLayer(): PassLayer {
  return {
    lower(draft: FragmentDraft, context: PassContext): PassResult {
      // Step 1: Extract and validate content
      const contentResult = extractContent(draft);
      if (!contentResult.ok) {
        return contentResult;
      }

      const content = contentResult.content;

      // Step 2: Extract requires and provides
      const requires = extractRequires(content);
      const provides = extractProvides(content);

      // Step 3: Generate path
      const path = `${content.kind}.${content.name}`;

      // Step 4: Create provenance
      const provenance: Provenance = {
        source: context.sourceType,
        inputId: context.sourceInputId,
        chunkId: draft.chunkId,
        fragmentDraftId: draft.id,
        actorId: context.actorId,
        runtimeId: context.runtimeId,
        timestamp: Date.now(),
        planId: context.planId,
        passLayerVersion: context.passLayerVersion,
        linkerVersion: context.linkerVersion,
      };

      // Step 5: Create Fragment
      const fragment: Fragment = {
        id: `fragment_${nanoid(8)}`,
        type: draft.type,
        path,
        requires,
        provides,
        content,
        provenance,
      };

      return { ok: true, fragment };
    },
  };
}

/**
 * Default PassLayer version
 */
export const PASS_LAYER_VERSION = "1.1.0";
