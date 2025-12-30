import type { ResolutionOption } from "../../domain/types.js";

/**
 * Parse result
 */
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Resolution request extracted from LLM response
 */
export interface ResolutionRequest {
  reason: string;
  options: ResolutionOption[];
}

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

/**
 * Extract resolution request from LLM response
 *
 * Per FDR-C004: ITL-agnostic resolution.
 * LLM can request resolution when it encounters ambiguity.
 *
 * @param content - Raw LLM response content
 * @returns Resolution request or null if not a resolution response
 */
export function extractResolutionRequest(content: string): ResolutionRequest | null {
  const jsonString = extractJSON(content);
  if (!jsonString) return null;

  try {
    const parsed = JSON.parse(jsonString);

    // Check for resolution request format
    if (
      parsed.resolution_required === true &&
      typeof parsed.reason === "string" &&
      Array.isArray(parsed.options)
    ) {
      return {
        reason: parsed.reason,
        options: parsed.options.map((opt: unknown) => {
          const o = opt as Record<string, unknown>;
          return {
            id: String(o.id ?? ""),
            description: String(o.description ?? ""),
            preview: o.preview ? String(o.preview) : undefined,
          };
        }),
      };
    }
  } catch {
    // Not a valid JSON or not a resolution request
  }

  return null;
}

/**
 * Validate segments response
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
 * Validate intents response
 */
export function validateIntentsResponse(
  data: unknown
): ParseResult<{
  intents: Array<{ kind: string; description: string; confidence: number }>;
}> {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Response must be an object" };
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.intents)) {
    return { ok: false, error: "Response must have 'intents' array" };
  }

  const intents = obj.intents as unknown[];
  const validKinds = ["state", "computed", "action", "constraint"];

  for (let i = 0; i < intents.length; i++) {
    const intent = intents[i] as Record<string, unknown>;

    if (typeof intent !== "object" || intent === null) {
      return { ok: false, error: `intents[${i}] must be an object` };
    }

    if (!validKinds.includes(intent.kind as string)) {
      return {
        ok: false,
        error: `intents[${i}].kind must be one of: ${validKinds.join(", ")}`,
      };
    }

    if (typeof intent.description !== "string") {
      return { ok: false, error: `intents[${i}].description must be a string` };
    }

    if (typeof intent.confidence !== "number" || intent.confidence < 0 || intent.confidence > 1) {
      return {
        ok: false,
        error: `intents[${i}].confidence must be a number between 0 and 1`,
      };
    }
  }

  return {
    ok: true,
    data: {
      intents: intents as Array<{ kind: string; description: string; confidence: number }>,
    },
  };
}

/**
 * Validate draft response
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
