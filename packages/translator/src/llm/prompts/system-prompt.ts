/**
 * @fileoverview System Prompt Builder
 *
 * Generates system prompt for LLM translation.
 */

import type { LLMTranslateRequest } from "../provider.js";

// =============================================================================
// Constants
// =============================================================================

const INTENT_IR_SPEC = `
## IntentIR v0.1 Specification

An IntentIR represents a single semantic intent with the following structure:

\`\`\`typescript
{
  v: "0.1",                    // Version (always "0.1")
  force: Force,                // Illocutionary force
  event: {
    lemma: string,             // Canonical verb form (e.g., "CREATE", "UPDATE")
    class: EventClass          // Event classification
  },
  args: {                      // Theta-role arguments
    TARGET?: Term,             // What is being acted upon
    THEME?: Term,              // What is being created/moved
    SOURCE?: Term,             // Origin of the action
    DEST?: Term,               // Destination
    INSTRUMENT?: Term,         // Tool or means
    BENEFICIARY?: Term         // Who benefits
  },
  cond?: Condition,            // Optional conditions
  temp?: Temporal              // Optional temporal info
}
\`\`\`

### Force Values
- "DO": Directive (request to perform action)
- "ASK": Question (request for information)
- "VERIFY": Confirmation request
- "CONFIRM": Acknowledgment
- "CLARIFY": Request for clarification

### EventClass Values
- "OBSERVE": Reading/viewing (e.g., "show", "list", "find")
- "CREATE": Creation (e.g., "create", "add", "make")
- "TRANSFORM": Modification (e.g., "update", "change", "edit")
- "CONTROL": State/lifecycle management (e.g., "delete", "cancel", "start")
- "DECIDE": Selection/choice (e.g., "select", "choose", "pick")
- "SOLVE": Computation/reasoning (e.g., "calculate", "analyze")

### Term Kinds
- "entity": Reference to a domain entity
  \`{ kind: "entity", entityType: string, ref?: RefMarker }\`
- "value": Literal value
  \`{ kind: "value", valueType: ValueType, shape: {}, raw: any }\`
- "path": Path reference
  \`{ kind: "path", path: string }\`

### ValueType (STRICT - only these 6 values allowed)
- "string": Text values (e.g., names, descriptions, arbitrary text)
- "number": Numeric values (counts, amounts, percentages)
- "boolean": true/false values
- "date": Date/time values (e.g., "next Friday", "2024-01-01")
- "enum": Categorical values from a fixed set (e.g., priority levels, status values, quarters like Q1/Q2/Q3/Q4)
- "id": Identifier references

IMPORTANT: Do NOT invent custom valueTypes. Map concepts to these 6 types:
- Priority levels (high/medium/low) → valueType: "enum", shape: { domain: "priority", value: "high" }
- Quarters (Q4, Q3) → valueType: "enum", shape: { domain: "quarter", value: "Q4" }
- Status values → valueType: "enum", shape: { domain: "status", value: "active" }
- Descriptions/reports → valueType: "string", raw: "the description"
- Counts/amounts → valueType: "number", raw: 42

### RefMarker (for discourse references)
- \`{ kind: "id", id: string }\`: Specific ID reference
- \`{ kind: "that" }\`: "that one" / "it" (anaphoric)
- \`{ kind: "this" }\`: "this one" (deictic)
- \`{ kind: "last" }\`: "the last one"

### Conditions (cond) - AND-only in v0.1
The \`cond\` field is an array of predicates, where ALL predicates must be satisfied (AND logic).
OR and NOT are NOT supported in v0.1.

Each predicate has:
- lhs: Scoped path with prefix (target., theme., source., dest., state., env., computed.)
- op: Operator ("=", "!=", "<", ">", "<=", ">=", "contains", "startsWith", "matches")
- rhs: A Term (usually ValueTerm)

Example:
\`\`\`json
{
  "cond": [
    { "lhs": "target.status", "op": "=", "rhs": { "kind": "value", "valueType": "enum", "shape": { "value": "overdue" }, "raw": "overdue" } },
    { "lhs": "target.priority", "op": "=", "rhs": { "kind": "value", "valueType": "enum", "shape": { "value": "high" }, "raw": "high" } }
  ]
}
\`\`\`

IMPORTANT:
- Do NOT use { type: "FILTER", or: [...], not: {...} } - this is NOT valid in v0.1
- For OR conditions: Create MULTIPLE nodes (one per OR branch) instead
- For complex filters: Put filtering logic in args, not cond
`;

const OUTPUT_FORMAT = `
## Output Format

Return a JSON object with the following structure:

\`\`\`json
{
  "nodes": [
    {
      "tempId": "t1",
      "ir": { /* IntentIR object */ },
      "dependsOnTempIds": [],
      "ambiguityIndicators": {
        "hasUnresolvedRef": false,
        "missingRequiredRoles": [],
        "multipleInterpretations": false,
        "confidenceScore": 0.9
      }
    }
  ]
}
\`\`\`

### Ambiguity Indicators
- \`hasUnresolvedRef\`: true if the intent contains discourse refs (that/this/last)
- \`missingRequiredRoles\`: Array of roles that seem necessary but weren't specified
- \`multipleInterpretations\`: true if the input is genuinely ambiguous
- \`confidenceScore\`: 0-1, how confident you are in this interpretation

### Dependencies
Use \`dependsOnTempIds\` to express logical dependencies:
- "Create a project and add tasks to it" → task node depends on project node
- "Delete all completed items" → no dependencies (single action)
`;

const TRANSLATION_RULES = `
## Translation Rules

1. **One Intent Per Sentence Clause**
   - "Create a project and add 3 tasks" → 2 nodes (CREATE project, ADD tasks)
   - "Show all active tasks" → 1 node (OBSERVE tasks)

2. **Preserve Discourse References**
   - "update it" → TARGET with ref: { kind: "that" }
   - "add to the last project" → DEST with ref: { kind: "last" }

3. **Infer Reasonable Defaults**
   - "create task" → THEME: { kind: "entity", entityType: "Task" }
   - Don't infer values that require user confirmation

4. **Express Ambiguity, Don't Guess**
   - If multiple interpretations exist, pick the most likely and set multipleInterpretations: true
   - If roles are unclear, list them in missingRequiredRoles

5. **Lemma Normalization**
   - Use uppercase canonical forms: "CREATE", "UPDATE", "DELETE", "SHOW", "ADD"
   - Map synonyms: "make" → "CREATE", "edit" → "UPDATE", "remove" → "DELETE"
`;

// =============================================================================
// System Prompt Builder
// =============================================================================

/**
 * Build system prompt for translation.
 */
export function buildSystemPrompt(request: LLMTranslateRequest): string {
  const parts: string[] = [
    "You are an expert semantic parser that converts natural language into structured IntentIR representations.",
    "",
    "Your task is to analyze user input and produce a JSON array of intent nodes that accurately capture the user's intentions.",
    "",
    INTENT_IR_SPEC,
    OUTPUT_FORMAT,
    TRANSLATION_RULES,
  ];

  if (request.domainHint) {
    parts.push(`
## Domain Context
You are working in the "${request.domainHint}" domain. Use domain-appropriate entity types and interpretations.
`);
  }

  if (request.language && request.language !== "en") {
    parts.push(`
## Language
The input is in ${request.language}. Parse it and output IntentIR with English lemmas and role names.
`);
  }

  if (request.maxNodes) {
    parts.push(`
## Constraints
Generate at most ${request.maxNodes} nodes. If the input implies more intents, prioritize the most important ones.
`);
  }

  return parts.join("\n");
}

/**
 * Build user prompt for translation.
 */
export function buildUserPrompt(input: string): string {
  return `Translate the following natural language input into IntentIR nodes:

"${input}"

Return only valid JSON matching the specified output format. Do not include any explanation or markdown formatting.`;
}
