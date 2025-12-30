import type { CompilerContext } from "../../../domain/types.js";

/**
 * Normalization prompt template
 *
 * Converts requirement segments into structured NormalizedIntent objects.
 */

export interface NormalizePromptResult {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Create normalization prompt
 *
 * @param segments - Text segments to normalize
 * @param schema - Target schema (for context)
 * @param context - Additional context
 */
export function createNormalizePrompt(
  segments: string[],
  schema: unknown,
  context?: CompilerContext
): NormalizePromptResult {
  const schemaDescription = schema ? describeSchema(schema) : "";
  const contextSection = context ? formatContext(context) : "";

  const systemPrompt = `You are a requirements normalization assistant for the Manifesto domain modeling system.

Your task is to convert requirement segments into structured intents that map to Manifesto domain concepts.

## Intent Kinds

- **state**: A field that stores data (e.g., "user name", "order items", "is active")
- **computed**: A value derived from state (e.g., "total price", "is valid", "user count")
- **action**: An operation that changes state (e.g., "create user", "add item", "complete order")
- **constraint**: A rule that must hold (e.g., "price must be positive", "name is required")

## Output Format

You MUST respond with valid JSON only. No markdown code blocks, no explanations.

{
  "intents": [
    {
      "kind": "state" | "computed" | "action" | "constraint",
      "description": "Clear description of the intent",
      "confidence": 0.0-1.0
    }
  ]
}

## Ambiguity Handling

If you encounter ambiguity that requires clarification, respond with:

{
  "resolution_required": true,
  "reason": "Description of the ambiguity",
  "options": [
    { "id": "option1", "description": "First interpretation", "preview": "What this would mean" },
    { "id": "option2", "description": "Second interpretation", "preview": "What this would mean" }
  ]
}

## Confidence Guidelines

- 1.0: Unambiguous, directly stated requirement
- 0.8-0.9: Clear intent with minor inference
- 0.6-0.7: Reasonable interpretation with some ambiguity
- Below 0.6: Consider requesting resolution

${schemaDescription ? `## Target Schema Structure\n\n${schemaDescription}` : ""}
${contextSection}`;

  const userPrompt = `Normalize these requirement segments into structured intents:

${segments.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Respond with JSON only.`;

  return { systemPrompt, userPrompt };
}

/**
 * Format context for prompt
 */
function formatContext(context: CompilerContext): string {
  const parts: string[] = [];

  if (context.domainName) {
    parts.push(`Domain: ${context.domainName}`);
  }

  if (context.existingActions?.length) {
    parts.push(`Existing Actions: ${context.existingActions.join(", ")}`);
  }

  if (context.glossary && Object.keys(context.glossary).length > 0) {
    parts.push("Glossary:");
    for (const [term, definition] of Object.entries(context.glossary)) {
      parts.push(`  - ${term}: ${definition}`);
    }
  }

  return parts.length > 0 ? `\n## Context\n\n${parts.join("\n")}` : "";
}

/**
 * Describe schema for prompt context
 */
function describeSchema(schema: unknown): string {
  if (!schema || typeof schema !== "object") {
    return "";
  }

  try {
    return `Target schema structure:\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``;
  } catch {
    return "";
  }
}
