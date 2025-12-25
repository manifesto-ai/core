/**
 * LLM Prompts - Prompt templates for fragment generation
 *
 * Provides system prompts and user prompt builders for LLM adapters.
 *
 * AGENT_README Invariant #2: LLM은 비신뢰 제안자 (FragmentDraft만 생성)
 */

import type { LLMContext } from '../types/session.js';
import type { FragmentDraft } from '../types/fragment-draft.js';
import { formatContext, truncateText } from './utils.js';

// ============================================================================
// System Prompts
// ============================================================================

/**
 * Core system prompt for fragment generation
 *
 * Explains the Manifesto philosophy and FragmentDraft format.
 */
export const SYSTEM_PROMPT_CORE = `You are a Manifesto compiler assistant that generates FragmentDrafts from natural language requirements.

# Manifesto Philosophy

Manifesto is a declarative framework where:
- All data and state have semantic paths (e.g., "data.user.name", "state.isLoading")
- Logic is expressed as pure expressions
- Side effects are described, never executed
- Everything is traceable and explainable

# FragmentDraft Types

You generate drafts that will be validated and converted to Fragments:

1. **SchemaDraft** - Data/state schema definitions
   - namespace: "data" (persistent) or "state" (ephemeral)
   - fields: Array of field definitions with path, type, optional, defaultValue

2. **SourceDraft** - Source values (entry points)
   - path: Semantic path (e.g., "data.user.id")
   - semantic: Description of the value

3. **DerivedDraft** - Computed values
   - path: Semantic path (e.g., "derived.totalPrice")
   - rawExpr: Expression to compute the value
   - Example expression: { "op": "add", "args": [{ "get": "data.price" }, { "get": "data.tax" }] }

4. **ActionDraft** - User actions
   - actionId: Unique action identifier
   - rawPreconditions: Conditions that must be true
   - rawEffect: Side effect description

5. **PolicyDraft** - Field or action policies
   - target: What the policy applies to
   - rawPreconditions: When the policy applies

6. **EffectDraft** - Side effect descriptions
   - rawEffect: Effect type and parameters
   - risk: "low" | "medium" | "high" | "critical"

# Expression DSL

Use this format for expressions:
- Get value: { "get": "path.to.value" }
- Literal: { "lit": 42 } or { "lit": "string" }
- Operations: { "op": "add", "args": [...] }
- Conditionals: { "if": condition, "then": expr, "else": expr }
- Comparisons: { "op": "eq", "args": [...] }, { "op": "gt", "args": [...] }

# Output Format

Return a JSON array of FragmentDrafts:
\`\`\`json
[
  {
    "kind": "SchemaDraft" | "SourceDraft" | "DerivedDraft" | ...,
    "provisionalRequires": ["path1", "path2"],
    "provisionalProvides": ["path3"],
    "status": "raw",
    "origin": {
      "artifactId": "nl-input",
      "location": { "kind": "llm" }
    },
    "confidence": 0.0 to 1.0,
    "reasoning": "Why this draft was created",
    // ... kind-specific fields
  }
]
\`\`\`

# Important Rules

1. Set confidence based on clarity of requirements (0.5-0.9 typical)
2. Always include reasoning explaining your interpretation
3. Use descriptive semantic paths (data.user.email, not data.x)
4. Keep provisionalRequires and provisionalProvides accurate
5. Expressions should be valid JSON, not code strings
`;

/**
 * Additional context for schema generation
 */
export const SYSTEM_PROMPT_SCHEMA = `
# Schema Generation Guidelines

When generating SchemaDrafts:
- Use "data" namespace for persistent business data
- Use "state" namespace for UI state and ephemeral values
- Choose appropriate types: "string", "number", "boolean", "array", "object"
- Include semantic descriptions for clarity
- Set optional: true for nullable fields
- Provide defaultValue when sensible

Example SchemaDraft:
\`\`\`json
{
  "kind": "SchemaFragment",
  "namespace": "data",
  "fields": [
    { "path": "user.name", "type": "string", "semantic": { "description": "User's display name" } },
    { "path": "user.email", "type": "string", "semantic": { "description": "User's email address" } },
    { "path": "user.age", "type": "number", "optional": true }
  ],
  "provisionalRequires": [],
  "provisionalProvides": ["data.user.name", "data.user.email", "data.user.age"],
  "status": "raw",
  "origin": { "artifactId": "nl-input", "location": { "kind": "llm" } },
  "confidence": 0.85,
  "reasoning": "User entity with standard profile fields"
}
\`\`\`
`;

/**
 * Additional context for derived value generation
 */
export const SYSTEM_PROMPT_DERIVED = `
# Derived Value Guidelines

When generating DerivedDrafts:
- rawExpr must be a valid expression object
- provisionalRequires should list all paths used in the expression
- Use descriptive path names under "derived." namespace

Expression Examples:
- Sum: { "op": "add", "args": [{ "get": "data.a" }, { "get": "data.b" }] }
- Multiply: { "op": "mul", "args": [{ "get": "data.price" }, { "get": "data.quantity" }] }
- Conditional: { "if": { "op": "gt", "args": [{ "get": "data.count" }, { "lit": 0 }] }, "then": { "lit": true }, "else": { "lit": false } }
- String concat: { "op": "concat", "args": [{ "get": "data.firstName" }, { "lit": " " }, { "get": "data.lastName" }] }

Example DerivedDraft:
\`\`\`json
{
  "kind": "DerivedFragment",
  "path": "derived.totalPrice",
  "rawExpr": {
    "op": "mul",
    "args": [
      { "get": "data.price" },
      { "get": "data.quantity" }
    ]
  },
  "provisionalRequires": ["data.price", "data.quantity"],
  "provisionalProvides": ["derived.totalPrice"],
  "status": "raw",
  "origin": { "artifactId": "nl-input", "location": { "kind": "llm" } },
  "confidence": 0.9,
  "reasoning": "Total price calculated from unit price and quantity"
}
\`\`\`
`;

/**
 * Additional context for action generation
 */
export const SYSTEM_PROMPT_ACTION = `
# Action Generation Guidelines

When generating ActionDrafts:
- actionId should be a descriptive verb phrase (e.g., "createUser", "updateProfile")
- rawPreconditions define when the action can be executed
- rawEffect describes what happens (never execute, only describe)

Effect Types:
- setState: { "type": "setState", "path": "...", "value": ... }
- apiCall: { "type": "apiCall", "endpoint": "...", "method": "...", "body": ... }
- navigate: { "type": "navigate", "to": "..." }

Example ActionDraft:
\`\`\`json
{
  "kind": "ActionFragment",
  "actionId": "submitOrder",
  "rawPreconditions": [
    { "path": "state.cart.items", "expect": "notEmpty", "reason": "Cart must have items" },
    { "path": "data.user.isLoggedIn", "expect": "true", "reason": "User must be logged in" }
  ],
  "rawEffect": {
    "type": "apiCall",
    "endpoint": "/api/orders",
    "method": "POST",
    "body": { "items": { "get": "state.cart.items" } }
  },
  "semantic": {
    "verb": "submit",
    "description": "Submit the current cart as an order"
  },
  "risk": "medium",
  "provisionalRequires": ["state.cart.items", "data.user.isLoggedIn"],
  "provisionalProvides": [],
  "status": "raw",
  "origin": { "artifactId": "nl-input", "location": { "kind": "llm" } },
  "confidence": 0.8,
  "reasoning": "Order submission action with cart and auth preconditions"
}
\`\`\`
`;

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build the full system prompt based on context
 */
export function buildSystemPrompt(context?: LLMContext): string {
  let prompt = SYSTEM_PROMPT_CORE;

  // Add specialized sections based on hints
  if (context?.hints?.includeSchema !== false) {
    prompt += '\n' + SYSTEM_PROMPT_SCHEMA;
  }
  if (context?.hints?.includeDerived !== false) {
    prompt += '\n' + SYSTEM_PROMPT_DERIVED;
  }
  if (context?.hints?.includeActions !== false) {
    prompt += '\n' + SYSTEM_PROMPT_ACTION;
  }

  return prompt;
}

/**
 * Build the user prompt from natural language input
 */
export function buildUserPrompt(input: string, context?: LLMContext): string {
  const parts: string[] = [];

  parts.push('# Requirements\n\n' + input);

  if (context) {
    // Add existing paths
    if (context.existingPaths && context.existingPaths.length > 0) {
      parts.push(
        '\n\n# Existing Paths (for reference)\n\n' +
        context.existingPaths.slice(0, 50).join('\n') +
        (context.existingPaths.length > 50 ? '\n... and more' : '')
      );
    }

    // Add existing fragment kinds
    if (context.existingFragmentKinds && context.existingFragmentKinds.length > 0) {
      parts.push(
        '\n\n# Existing Fragment Kinds\n\n' +
        context.existingFragmentKinds.join(', ')
      );
    }

    // Add domain description
    if (context.domainDescription) {
      parts.push(
        '\n\n# Domain Context\n\n' +
        truncateText(context.domainDescription, 2000)
      );
    }

    // Add custom hints
    if (context.hints) {
      const formattedHints = formatContext(context.hints);
      if (formattedHints) {
        parts.push('\n\n# Additional Context\n\n' + formattedHints);
      }
    }
  }

  parts.push(
    '\n\n# Instructions\n\n' +
    'Generate FragmentDrafts based on the requirements above. ' +
    'Return a JSON array of drafts. ' +
    'Set appropriate confidence levels and include reasoning.'
  );

  return parts.join('');
}

/**
 * Build messages for chat-based API (Anthropic/OpenAI format)
 */
export function buildMessages(
  input: string,
  context?: LLMContext
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  return [
    { role: 'system', content: buildSystemPrompt(context) },
    { role: 'user', content: buildUserPrompt(input, context) },
  ];
}

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Validate a parsed FragmentDraft
 */
export function validateDraftStructure(draft: unknown): draft is Partial<FragmentDraft> {
  if (!draft || typeof draft !== 'object') {
    return false;
  }

  const d = draft as Record<string, unknown>;

  // Must have kind
  if (typeof d.kind !== 'string') {
    return false;
  }

  // Must have status
  if (d.status !== 'raw' && d.status !== 'validated' && d.status !== 'lowered') {
    return false;
  }

  // Must have confidence
  if (typeof d.confidence !== 'number' || d.confidence < 0 || d.confidence > 1) {
    return false;
  }

  return true;
}

/**
 * Normalize a parsed draft to ensure required fields
 */
export function normalizeDraft(
  draft: Partial<FragmentDraft>,
  modelId: string,
  promptHash: string
): FragmentDraft {
  const base = {
    status: 'raw' as const,
    provisionalRequires: [],
    provisionalProvides: [],
    confidence: draft.confidence ?? 0.5,
    reasoning: draft.reasoning ?? 'Generated by LLM',
    origin: {
      artifactId: 'nl-input',
      location: {
        kind: 'llm' as const,
        model: modelId,
        promptHash,
      },
    },
  };

  // Merge base with draft, keeping draft values where they exist
  return {
    ...base,
    ...draft,
    origin: {
      ...base.origin,
      ...(draft.origin || {}),
      location: {
        ...base.origin.location,
        ...((draft.origin?.location as Record<string, unknown>) || {}),
      },
    },
  } as FragmentDraft;
}
