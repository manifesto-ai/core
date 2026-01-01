/**
 * @manifesto-ai/compiler v1.1 LLM Response Parser
 *
 * Parses and validates LLM responses for Plan and FragmentDraft.
 */

import type { FragmentType, PlanStrategy } from "../../domain/types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 Parse Result Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse result
 */
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Ambiguity detected in LLM response
 */
export interface AmbiguityInfo<T> {
  reason: string;
  alternatives: T[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 JSON Extraction
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse JSON from LLM response
 *
 * Handles various response formats:
 * - Raw JSON
 * - JSON in markdown code blocks
 * - JSON with extra whitespace
 *
 * @param content - Raw LLM response content
 * @returns Parsed JSON or error
 */
export function parseJSONResponse<T>(content: string): ParseResult<T> {
  // Step 1: Extract JSON from response (handle markdown code blocks)
  const jsonString = extractJSON(content);
  if (!jsonString) {
    return {
      ok: false,
      error: `No valid JSON found in response. Content starts with: "${content.slice(0, 100)}..."`,
    };
  }

  // Step 2: Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Invalid JSON: ${error}. Content: "${jsonString.slice(0, 200)}..."`,
    };
  }

  // Step 3: Validate it's an object
  if (typeof parsed !== "object" || parsed === null) {
    return {
      ok: false,
      error: "Response must be a JSON object",
    };
  }

  return { ok: true, data: parsed as T };
}

/**
 * Extract JSON from potentially formatted response
 *
 * Handles:
 * - Raw JSON: { ... }
 * - Markdown code blocks: ```json { ... } ```
 * - JSON with leading/trailing text
 */
function extractJSON(content: string): string | null {
  const trimmed = content.trim();

  // Try to find JSON in markdown code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find raw JSON object (greedy match for nested braces)
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 Ambiguity Detection
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if LLM response indicates ambiguity
 *
 * Per SPEC §10.2: LLM can indicate ambiguity with alternatives.
 */
export function extractAmbiguity<T>(data: unknown): AmbiguityInfo<T> | null {
  if (typeof data !== "object" || data === null) return null;

  const obj = data as Record<string, unknown>;

  // Check for ambiguity marker
  if (obj.ambiguous === true && typeof obj.reason === "string" && Array.isArray(obj.alternatives)) {
    return {
      reason: obj.reason,
      alternatives: obj.alternatives as T[],
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 Plan Validation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Raw plan from LLM (before ID assignment)
 */
export interface RawPlan {
  strategy: PlanStrategy;
  chunks: RawChunk[];
  rationale?: string;
}

/**
 * Raw chunk from LLM
 */
export interface RawChunk {
  content: string;
  expectedType: FragmentType;
  dependencies: RawChunkDependency[];
  sourceSpan?: { start: number; end: number };
}

/**
 * Raw chunk dependency
 */
export interface RawChunkDependency {
  kind: "requires";
  targetChunkId: string;
  reason?: string;
}

const VALID_STRATEGIES: PlanStrategy[] = ["by-statement", "by-entity", "by-layer", "single", "custom"];
const VALID_FRAGMENT_TYPES: FragmentType[] = ["state", "computed", "action", "constraint", "effect", "flow"];

/**
 * Validate plan response from LLM
 */
export function validatePlanResponse(data: unknown): ParseResult<{ plan: RawPlan }> {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Response must be an object" };
  }

  const obj = data as Record<string, unknown>;

  // Check for plan wrapper
  const planData = obj.plan ?? obj;
  if (typeof planData !== "object" || planData === null) {
    return { ok: false, error: "Response must contain a 'plan' object" };
  }

  const plan = planData as Record<string, unknown>;

  // Validate strategy
  if (!VALID_STRATEGIES.includes(plan.strategy as PlanStrategy)) {
    return {
      ok: false,
      error: `plan.strategy must be one of: ${VALID_STRATEGIES.join(", ")}`,
    };
  }

  // Validate chunks
  if (!Array.isArray(plan.chunks)) {
    return { ok: false, error: "plan.chunks must be an array" };
  }

  const chunks: RawChunk[] = [];
  for (let i = 0; i < plan.chunks.length; i++) {
    const chunkResult = validateChunk(plan.chunks[i], i);
    if (!chunkResult.ok) {
      return { ok: false, error: chunkResult.error };
    }
    chunks.push(chunkResult.data);
  }

  // Validate rationale (optional)
  if (plan.rationale !== undefined && typeof plan.rationale !== "string") {
    return { ok: false, error: "plan.rationale must be a string" };
  }

  return {
    ok: true,
    data: {
      plan: {
        strategy: plan.strategy as PlanStrategy,
        chunks,
        rationale: plan.rationale as string | undefined,
      },
    },
  };
}

/**
 * Validate a single chunk
 */
function validateChunk(chunk: unknown, index: number): ParseResult<RawChunk> {
  if (typeof chunk !== "object" || chunk === null) {
    return { ok: false, error: `chunks[${index}] must be an object` };
  }

  const c = chunk as Record<string, unknown>;

  // Validate content
  if (typeof c.content !== "string" || c.content.trim() === "") {
    return { ok: false, error: `chunks[${index}].content must be a non-empty string` };
  }

  // Validate expectedType
  if (!VALID_FRAGMENT_TYPES.includes(c.expectedType as FragmentType)) {
    return {
      ok: false,
      error: `chunks[${index}].expectedType must be one of: ${VALID_FRAGMENT_TYPES.join(", ")}`,
    };
  }

  // Validate dependencies (default to empty array if missing)
  const rawDeps = c.dependencies ?? [];
  if (!Array.isArray(rawDeps)) {
    return { ok: false, error: `chunks[${index}].dependencies must be an array` };
  }

  const dependencies: RawChunkDependency[] = [];
  for (let j = 0; j < rawDeps.length; j++) {
    const depResult = validateChunkDependency(rawDeps[j], index, j);
    if (!depResult.ok) {
      return { ok: false, error: depResult.error };
    }
    dependencies.push(depResult.data);
  }

  // Validate sourceSpan (optional - ignore if malformed)
  let sourceSpan: { start: number; end: number } | undefined;
  if (c.sourceSpan !== undefined && c.sourceSpan !== null) {
    const span = c.sourceSpan as Record<string, unknown>;
    if (
      typeof span === "object" &&
      typeof span.start === "number" &&
      typeof span.end === "number"
    ) {
      sourceSpan = { start: span.start, end: span.end };
    }
    // If sourceSpan is malformed, just ignore it (it's optional)
  }

  return {
    ok: true,
    data: {
      content: c.content as string,
      expectedType: c.expectedType as FragmentType,
      dependencies,
      sourceSpan,
    },
  };
}

/**
 * Validate chunk dependency
 */
function validateChunkDependency(
  dep: unknown,
  chunkIndex: number,
  depIndex: number
): ParseResult<RawChunkDependency> {
  if (typeof dep !== "object" || dep === null) {
    return { ok: false, error: `chunks[${chunkIndex}].dependencies[${depIndex}] must be an object` };
  }

  const d = dep as Record<string, unknown>;

  if (d.kind !== "requires") {
    return { ok: false, error: `chunks[${chunkIndex}].dependencies[${depIndex}].kind must be 'requires'` };
  }

  if (typeof d.targetChunkId !== "string") {
    return {
      ok: false,
      error: `chunks[${chunkIndex}].dependencies[${depIndex}].targetChunkId must be a string`,
    };
  }

  if (d.reason !== undefined && typeof d.reason !== "string") {
    return { ok: false, error: `chunks[${chunkIndex}].dependencies[${depIndex}].reason must be a string` };
  }

  return {
    ok: true,
    data: {
      kind: "requires",
      targetChunkId: d.targetChunkId as string,
      reason: d.reason as string | undefined,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 FragmentDraft Validation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Raw fragment draft from LLM (before ID assignment)
 */
export interface RawFragmentDraft {
  type: FragmentType;
  interpretation: RawFragmentInterpretation;
  confidence?: number;
  alternatives?: RawFragmentInterpretation[];
}

/**
 * Raw fragment interpretation
 */
export interface RawFragmentInterpretation {
  raw: unknown;
  description?: string;
}

/**
 * Validate fragment draft response from LLM
 */
export function validateFragmentDraftResponse(data: unknown): ParseResult<{ draft: RawFragmentDraft }> {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Response must be an object" };
  }

  const obj = data as Record<string, unknown>;

  // Check for draft wrapper
  const draftData = obj.draft ?? obj;
  if (typeof draftData !== "object" || draftData === null) {
    return { ok: false, error: "Response must contain a 'draft' object" };
  }

  const draft = draftData as Record<string, unknown>;

  // Validate type
  if (!VALID_FRAGMENT_TYPES.includes(draft.type as FragmentType)) {
    return {
      ok: false,
      error: `draft.type must be one of: ${VALID_FRAGMENT_TYPES.join(", ")}`,
    };
  }

  // Validate interpretation
  const interpResult = validateInterpretation(draft.interpretation, "interpretation");
  if (!interpResult.ok) {
    return { ok: false, error: `draft.${interpResult.error}` };
  }

  // Validate confidence (optional)
  if (draft.confidence !== undefined) {
    if (typeof draft.confidence !== "number" || draft.confidence < 0 || draft.confidence > 1) {
      return { ok: false, error: "draft.confidence must be a number between 0 and 1" };
    }
  }

  // Validate alternatives (optional)
  let alternatives: RawFragmentInterpretation[] | undefined;
  if (draft.alternatives !== undefined) {
    if (!Array.isArray(draft.alternatives)) {
      return { ok: false, error: "draft.alternatives must be an array" };
    }

    alternatives = [];
    for (let i = 0; i < draft.alternatives.length; i++) {
      const altResult = validateInterpretation(draft.alternatives[i], `alternatives[${i}]`);
      if (!altResult.ok) {
        return { ok: false, error: `draft.${altResult.error}` };
      }
      alternatives.push(altResult.data);
    }
  }

  return {
    ok: true,
    data: {
      draft: {
        type: draft.type as FragmentType,
        interpretation: interpResult.data,
        confidence: draft.confidence as number | undefined,
        alternatives,
      },
    },
  };
}

/**
 * Validate interpretation object
 */
function validateInterpretation(
  interp: unknown,
  path: string
): ParseResult<RawFragmentInterpretation> {
  if (typeof interp !== "object" || interp === null) {
    return { ok: false, error: `${path} must be an object` };
  }

  const i = interp as Record<string, unknown>;

  // raw is required
  if (!("raw" in i)) {
    return { ok: false, error: `${path}.raw is required` };
  }

  // description is optional but must be string if present
  if (i.description !== undefined && typeof i.description !== "string") {
    return { ok: false, error: `${path}.description must be a string` };
  }

  return {
    ok: true,
    data: {
      raw: i.raw,
      description: i.description as string | undefined,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §6 Legacy Validators (kept for compatibility during migration)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use validatePlanResponse for v1.1
 */
export function validateSegmentsResponse(data: unknown): ParseResult<{ segments: string[] }> {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Response must be an object" };
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.segments)) {
    return { ok: false, error: "Response must have 'segments' array" };
  }

  const segments = obj.segments as unknown[];
  for (let i = 0; i < segments.length; i++) {
    if (typeof segments[i] !== "string") {
      return { ok: false, error: `segments[${i}] must be a string` };
    }
  }

  return { ok: true, data: { segments: segments as string[] } };
}

/**
 * @deprecated Use validateFragmentDraftResponse for v1.1
 */
export function validateDraftResponse(data: unknown): ParseResult<{ draft: unknown }> {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Response must be an object" };
  }

  const obj = data as Record<string, unknown>;

  if (!("draft" in obj)) {
    return { ok: false, error: "Response must have 'draft' key" };
  }

  if (typeof obj.draft !== "object" || obj.draft === null) {
    return { ok: false, error: "'draft' must be an object" };
  }

  return { ok: true, data: { draft: obj.draft } };
}
