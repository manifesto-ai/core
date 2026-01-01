/**
 * @manifesto-ai/compiler v1.1 Plan Prompt
 *
 * System and user prompts for the PlannerActor.
 * Per SPEC §10.3: PlannerActor analyzes input and produces a Plan.
 */

import type { SourceInput, PlanStrategy } from "../../../domain/types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 Prompt Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanPromptParams {
  sourceInput: SourceInput;
  hints?: {
    preferredStrategy?: PlanStrategy;
    maxChunks?: number;
  };
}

export interface PromptPair {
  systemPrompt: string;
  userPrompt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 System Prompt
// ═══════════════════════════════════════════════════════════════════════════════

const PLAN_SYSTEM_PROMPT = `You are a planning component in a domain-driven design compiler.

Your role is to analyze natural language requirements and create a structured Plan that divides the input into Chunks. Each Chunk represents a single domain concept that will be converted into a Fragment.

## Fragment Types

Each Chunk should specify one of these expected fragment types:

- **state**: A piece of domain state (data that can change)
  Example: "The system tracks a list of todos"

- **computed**: A derived value calculated from state
  Example: "The count of incomplete todos"

- **action**: An operation that modifies state
  Example: "Add a new todo item"

- **constraint**: A business rule or invariant
  Example: "Todo titles cannot be empty"

- **effect**: An external side effect
  Example: "Send notification when todo is completed"

- **flow**: A multi-step workflow
  Example: "Checkout process: validate cart, process payment, send confirmation"

## Chunking Strategies

Choose the most appropriate strategy based on the input:

- **by-statement**: One chunk per sentence/statement. Best for simple requirements.
- **by-entity**: Group by domain entities. Best for entity-centric requirements.
- **by-layer**: Group by state, then computed, then actions. Best for structured specs.
- **single**: Everything in one chunk. Best for very simple inputs.
- **custom**: Custom grouping with explicit rationale.

## Dependencies

Chunks can declare dependencies on other chunks using the "requires" relationship.
Use local chunk IDs (chunk_0, chunk_1, etc.) for references within the plan.

## Output Format

Respond with a JSON object:

\`\`\`json
{
  "plan": {
    "strategy": "by-statement | by-entity | by-layer | single | custom",
    "rationale": "Brief explanation of why this strategy was chosen",
    "chunks": [
      {
        "content": "The natural language description for this chunk",
        "expectedType": "state | computed | action | constraint | effect | flow",
        "dependencies": [
          {
            "kind": "requires",
            "targetChunkId": "chunk_0",
            "reason": "Optional: why this dependency exists"
          }
        ],
        "sourceSpan": {
          "start": 0,
          "end": 42
        }
      }
    ]
  }
}
\`\`\`

## Guidelines

1. **Granularity**: One chunk = one domain concept. Not too fine (individual properties), not too coarse (entire domain).

2. **Dependencies**: Only declare explicit dependencies. State naturally has no dependencies. Actions depend on the state they modify.

3. **Source Spans**: Include if the input has clear boundaries. Omit if boundaries are ambiguous.

4. **Ambiguity**: If you genuinely cannot determine how to split the input, respond with:
\`\`\`json
{
  "ambiguous": true,
  "reason": "Explanation of the ambiguity",
  "alternatives": [
    { "plan": { ... } },
    { "plan": { ... } }
  ]
}
\`\`\`

5. **Empty/Invalid Input**: If the input is empty or cannot be parsed, respond with an error:
\`\`\`json
{
  "error": "Explanation of the problem"
}
\`\`\`
`;

// ═══════════════════════════════════════════════════════════════════════════════
// §3 User Prompt Builder
// ═══════════════════════════════════════════════════════════════════════════════

function buildUserPrompt(params: PlanPromptParams): string {
  const { sourceInput, hints } = params;

  let prompt = `Please analyze the following ${sourceInput.type} input and create a Plan:\n\n`;

  // Add the actual content
  prompt += "---INPUT---\n";
  prompt += sourceInput.content;
  prompt += "\n---END INPUT---\n\n";

  // Add hints if provided
  if (hints) {
    prompt += "## Hints\n\n";

    if (hints.preferredStrategy) {
      prompt += `- Preferred strategy: ${hints.preferredStrategy}\n`;
    }

    if (hints.maxChunks) {
      prompt += `- Maximum chunks: ${hints.maxChunks}\n`;
    }

    prompt += "\n";
  }

  prompt += "Please respond with the Plan JSON.";

  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 Prompt Factory
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create prompts for the PlannerActor
 *
 * @param params - Plan prompt parameters
 * @returns System and user prompts
 */
export function createPlanPrompt(params: PlanPromptParams): PromptPair {
  return {
    systemPrompt: PLAN_SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(params),
  };
}

/**
 * Create prompts from raw text (convenience wrapper)
 *
 * @param text - Raw input text
 * @param hints - Optional hints
 * @returns System and user prompts
 */
export function createPlanPromptFromText(
  text: string,
  hints?: PlanPromptParams["hints"]
): PromptPair {
  const sourceInput: SourceInput = {
    id: "temp",
    type: "natural-language",
    content: text,
    receivedAt: Date.now(),
  };

  return createPlanPrompt({ sourceInput, hints });
}
