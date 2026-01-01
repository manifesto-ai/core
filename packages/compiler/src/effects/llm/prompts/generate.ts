/**
 * @manifesto-ai/compiler v1.1 Generate Prompt
 *
 * System and user prompts for the GeneratorActor.
 * Per SPEC §10.4: GeneratorActor produces FragmentDraft from Chunk.
 */

import type { Chunk, Plan, Fragment, FragmentDraft, Issue } from "../../../domain/types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 Prompt Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface GeneratePromptParams {
  chunk: Chunk;
  plan: Plan;
  existingFragments: Fragment[];
  retryContext?: {
    previousDraft: FragmentDraft;
    issues: Issue[];
    attemptNumber: number;
  };
}

export interface PromptPair {
  systemPrompt: string;
  userPrompt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 System Prompt
// ═══════════════════════════════════════════════════════════════════════════════

const GENERATE_SYSTEM_PROMPT = `You are a code generation component in a domain-driven design compiler.

Your role is to convert a single Chunk (natural language requirement) into a FragmentDraft (structured domain definition).

## Fragment Types and Their Structures

### state
Defines domain state (data that can change):
\`\`\`json
{
  "kind": "state",
  "name": "todos",
  "schema": { "type": "array", "items": { "type": "object", "properties": {...} } },
  "initial": []
}
\`\`\`

### computed
Defines derived values:
\`\`\`json
{
  "kind": "computed",
  "name": "incompleteTodoCount",
  "expression": { "$count": { "$filter": ["$todos", { "$eq": ["$.completed", false] }] } },
  "dependencies": ["todos"]
}
\`\`\`

### action
Defines operations that modify state:
\`\`\`json
{
  "kind": "action",
  "name": "addTodo",
  "input": { "type": "object", "properties": { "title": { "type": "string" } } },
  "available": { "$not": { "$isEmpty": "$input.title" } },
  "flow": [
    { "set": { "todos": { "$append": ["$todos", { "id": "$uuid()", "title": "$input.title", "completed": false }] } } }
  ]
}
\`\`\`

### constraint
Defines business rules:
\`\`\`json
{
  "kind": "constraint",
  "name": "todoTitleRequired",
  "expression": { "$all": ["$todos", { "$not": { "$isEmpty": "$.title" } }] },
  "message": "Todo titles cannot be empty"
}
\`\`\`

### effect
Defines side effects:
\`\`\`json
{
  "kind": "effect",
  "name": "notifyOnComplete",
  "effectType": "notification",
  "params": { "message": "Todo completed!" }
}
\`\`\`

### flow
Defines multi-step workflows:
\`\`\`json
{
  "kind": "flow",
  "name": "checkout",
  "steps": [
    { "action": "validateCart" },
    { "action": "processPayment" },
    { "effect": "sendConfirmation" }
  ]
}
\`\`\`

## Output Format

Respond with a JSON object containing a FragmentDraft:

\`\`\`json
{
  "draft": {
    "type": "state | computed | action | constraint | effect | flow",
    "interpretation": {
      "raw": { /* The structured fragment content as shown above */ },
      "description": "Brief explanation of how the chunk was interpreted"
    },
    "confidence": 0.95,
    "alternatives": [
      {
        "raw": { /* Alternative interpretation */ },
        "description": "Why this alternative might be valid"
      }
    ]
  }
}
\`\`\`

## Guidelines

1. **Type Matching**: The type should match the chunk's expectedType. If you believe a different type is more appropriate, include it as an alternative.

2. **Naming**: Use camelCase for names. Names should be descriptive and match domain terminology.

3. **Confidence**: Rate your confidence (0.0 - 1.0):
   - 0.9+: Clear, unambiguous interpretation
   - 0.7-0.9: Good interpretation with minor assumptions
   - 0.5-0.7: Multiple valid interpretations possible
   - <0.5: Significant ambiguity, provide alternatives

4. **Alternatives**: Include alternatives when:
   - Multiple valid interpretations exist
   - The expectedType might be incorrect
   - Schema design could go multiple ways

5. **Context Awareness**: Consider existing fragments to avoid conflicts:
   - Don't redefine existing state
   - Reference existing state/computed in expressions
   - Follow established naming conventions

6. **Retry Context**: If this is a retry, carefully read the previous issues and fix them:
   - Address each issue specifically
   - Don't introduce new problems
   - Explain what was fixed

7. **Ambiguity**: If you cannot determine the interpretation, respond:
\`\`\`json
{
  "ambiguous": true,
  "reason": "Explanation of the ambiguity",
  "alternatives": [
    { "draft": { ... } },
    { "draft": { ... } }
  ]
}
\`\`\`

8. **Error**: If the chunk is invalid or cannot be processed:
\`\`\`json
{
  "error": "Explanation of the problem"
}
\`\`\`
`;

// ═══════════════════════════════════════════════════════════════════════════════
// §3 User Prompt Builder
// ═══════════════════════════════════════════════════════════════════════════════

function buildUserPrompt(params: GeneratePromptParams): string {
  const { chunk, plan, existingFragments, retryContext } = params;

  let prompt = "";

  // Add plan context
  prompt += "## Plan Context\n\n";
  prompt += `Strategy: ${plan.strategy}\n`;
  if (plan.rationale) {
    prompt += `Rationale: ${plan.rationale}\n`;
  }
  prompt += `Total chunks: ${plan.chunks.length}\n\n`;

  // Add existing fragments context
  if (existingFragments.length > 0) {
    prompt += "## Existing Fragments\n\n";
    prompt += "The following fragments have already been defined:\n\n";
    for (const fragment of existingFragments) {
      prompt += `- **${fragment.content.kind}** \`${fragment.content.name}\` (provides: ${fragment.provides.join(", ") || "none"})\n`;
    }
    prompt += "\n";
  }

  // Add the chunk to process
  prompt += "## Chunk to Process\n\n";
  prompt += `**Expected Type:** ${chunk.expectedType}\n`;
  prompt += `**Content:**\n\n`;
  prompt += "---CHUNK---\n";
  prompt += chunk.content;
  prompt += "\n---END CHUNK---\n\n";

  // Add dependencies
  if (chunk.dependencies.length > 0) {
    prompt += "**Dependencies:**\n";
    for (const dep of chunk.dependencies) {
      prompt += `- Requires: ${dep.targetChunkId}`;
      if (dep.reason) {
        prompt += ` (${dep.reason})`;
      }
      prompt += "\n";
    }
    prompt += "\n";
  }

  // Add retry context if present
  if (retryContext) {
    prompt += "## Retry Context (IMPORTANT)\n\n";
    prompt += `This is attempt #${retryContext.attemptNumber + 1}. The previous draft had issues:\n\n`;

    for (const issue of retryContext.issues) {
      prompt += `- **${issue.severity.toUpperCase()}** [${issue.code}]: ${issue.message}\n`;
      if (issue.suggestion) {
        prompt += `  Suggestion: ${issue.suggestion}\n`;
      }
    }

    prompt += "\nPlease fix these issues in your response.\n\n";

    prompt += "Previous draft interpretation:\n";
    prompt += "```json\n";
    prompt += JSON.stringify(retryContext.previousDraft.interpretation.raw, null, 2);
    prompt += "\n```\n\n";
  }

  prompt += "Please respond with the FragmentDraft JSON.";

  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 Prompt Factory
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create prompts for the GeneratorActor
 *
 * @param params - Generate prompt parameters
 * @returns System and user prompts
 */
export function createGeneratePrompt(params: GeneratePromptParams): PromptPair {
  return {
    systemPrompt: GENERATE_SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(params),
  };
}
