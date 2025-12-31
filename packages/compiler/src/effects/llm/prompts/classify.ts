/**
 * @manifesto-ai/compiler v1.1 Classify Prompt
 *
 * Simplified prompt for parallel classification of statements.
 * Used in the 2-phase planning architecture.
 */

import type { Segment } from "../splitter.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ClassifyPromptParams {
  segments: Segment[];
}

export interface PromptPair {
  systemPrompt: string;
  userPrompt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 System Prompt
// ═══════════════════════════════════════════════════════════════════════════════

const CLASSIFY_SYSTEM_PROMPT = `You are a domain classifier. Classify each statement into exactly one fragment type.

## Fragment Types

- **state**: Data that can change over time (e.g., "The system tracks user count", "Account status can be active or inactive")
- **computed**: Value derived from state (e.g., "Total price is sum of item prices", "Display name is first + last name")
- **action**: Operation that modifies state (e.g., "User can register", "Admin activates account")
- **constraint**: Business rule or validation (e.g., "Email must be verified within 24 hours", "Cannot exceed 3 failed attempts")
- **effect**: External side effect (e.g., "Send email notification", "Log to audit system")
- **flow**: Multi-step process (e.g., "Checkout process: verify cart, charge payment, send confirmation")

## Output Format

Respond with a JSON array. Each item must have:
- "index": The 0-based index of the statement
- "type": One of "state", "computed", "action", "constraint", "effect", "flow"

Example:
\`\`\`json
[
  { "index": 0, "type": "action" },
  { "index": 1, "type": "state" },
  { "index": 2, "type": "constraint" }
]
\`\`\`

## Guidelines

1. Choose the MOST specific type that fits
2. If a statement describes initial/default data → "state"
3. If a statement describes what can happen → "action"
4. If a statement describes a rule or condition → "constraint"
5. When in doubt between "action" and "flow", prefer "action" unless multiple steps are explicitly described`;

// ═══════════════════════════════════════════════════════════════════════════════
// §3 User Prompt Builder
// ═══════════════════════════════════════════════════════════════════════════════

function buildUserPrompt(params: ClassifyPromptParams): string {
  const { segments } = params;

  let prompt = "Classify the following statements:\n\n";

  for (const seg of segments) {
    prompt += `[${seg.index}] ${seg.content}\n`;
  }

  prompt += "\nRespond with JSON array only.";

  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 Prompt Factory
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create prompts for parallel classification
 *
 * @param params - Classify prompt parameters
 * @returns System and user prompts
 */
export function createClassifyPrompt(params: ClassifyPromptParams): PromptPair {
  return {
    systemPrompt: CLASSIFY_SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(params),
  };
}
