/**
 * Segmentation prompt template
 *
 * Segments natural language requirements into atomic requirement statements.
 */

export interface SegmentPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Create segmentation prompt
 *
 * @param text - Natural language text to segment
 */
export function createSegmentPrompt(text: string): SegmentPromptResult {
  const systemPrompt = `You are a requirements segmentation assistant for the Manifesto domain modeling system.

Your task is to decompose natural language requirements into discrete, atomic requirement segments.

## Rules

1. Each segment should describe ONE requirement (state field, computed value, action, or constraint)
2. Preserve the original meaning - do not infer or add requirements
3. Split compound sentences into separate segments
4. Remove filler words and normalize language
5. Keep technical terms and domain-specific vocabulary intact

## Output Format

You MUST respond with valid JSON only. No markdown code blocks, no explanations.

{
  "segments": [
    "First requirement segment",
    "Second requirement segment"
  ]
}

## Example

Input: "The system should track user names and emails. When a user registers, send a welcome email. The total user count should be displayed."

Output:
{
  "segments": [
    "Track user name as a string field",
    "Track user email as a string field",
    "When user registers, send welcome email",
    "Display total user count as computed value"
  ]
}`;

  const userPrompt = `Segment the following requirements into atomic segments:

---
${text}
---

Respond with JSON only.`;

  return { systemPrompt, userPrompt };
}
