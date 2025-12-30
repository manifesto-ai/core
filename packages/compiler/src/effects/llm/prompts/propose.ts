import type {
  CompilerContext,
  NormalizedIntent,
  AttemptRecord,
  CompilerDiagnostics,
} from "../../../domain/types.js";

/**
 * Proposal prompt template
 *
 * Generates DomainDraft JSON from normalized intents.
 */

export interface ProposePromptResult {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Create proposal prompt
 *
 * @param schema - Target schema structure
 * @param intents - Normalized intents to implement
 * @param history - Previous failed attempts
 * @param context - Additional context
 * @param resolution - Resolution selection (if any)
 */
export function createProposePrompt(
  schema: unknown,
  intents: NormalizedIntent[],
  history: AttemptRecord[],
  context?: CompilerContext,
  resolution?: string
): ProposePromptResult {
  const historySection = formatAttemptHistory(history);
  const resolutionSection = resolution
    ? `\n## Resolution Applied\n\nThe user selected: "${resolution}"\nApply this decision in your proposal.\n`
    : "";

  const systemPrompt = `You are a DomainSchema proposal assistant for the Manifesto domain modeling system.

Your task is to generate a valid DomainSchema JSON structure from structured intents.

## CRITICAL RULES

1. Output MUST be valid JSON conforming to the DomainSchema structure below
2. Do NOT output TypeScript code - output JSON data only
3. All expressions use the ExprNode format (e.g., {"kind": "get", "path": "state.fieldName"})
4. All flows use the FlowNode format (e.g., {"kind": "patch", "op": "set", "path": "state.x", "value": {...}})
5. Paths must use dot notation: "state.fieldName", "computed.derivedValue"

## DomainSchema Structure

${getDomainSchemaStructure()}

## ExprNode Examples

Literal value:
{"kind": "lit", "value": 42}

Get state field:
{"kind": "get", "path": "state.userName"}

Comparison:
{"kind": "eq", "left": {"kind": "get", "path": "state.status"}, "right": {"kind": "lit", "value": "active"}}

Logical AND:
{"kind": "and", "args": [{"kind": "get", "path": "computed.isValid"}, {"kind": "get", "path": "computed.hasPermission"}]}

## FlowNode Examples

Set a field:
{"kind": "patch", "op": "set", "path": "state.name", "value": {"kind": "get", "path": "input.name"}}

Conditional:
{"kind": "if", "cond": {...}, "then": {...}, "else": {...}}

Sequence:
{"kind": "seq", "steps": [{...}, {...}]}

Effect (external operation):
{"kind": "effect", "type": "http:fetch", "params": {"url": {"kind": "lit", "value": "https://api.example.com"}}}

## Output Format

{
  "draft": {
    "id": "domain-unique-id",
    "version": "1.0.0",
    "hash": "",
    "state": {
      "fields": {
        "fieldName": {
          "type": "string",
          "required": true,
          "description": "..."
        }
      }
    },
    "computed": {
      "fields": {
        "computed.derivedValue": {
          "deps": ["state.fieldName"],
          "expr": {"kind": "get", "path": "state.fieldName"},
          "description": "..."
        }
      }
    },
    "actions": {
      "actionName": {
        "flow": {"kind": "seq", "steps": [...]},
        "input": {...},
        "available": {...},
        "description": "..."
      }
    }
  }
}

## Ambiguity Handling

If you need clarification, respond with:
{
  "resolution_required": true,
  "reason": "Why clarification is needed",
  "options": [
    {"id": "opt1", "description": "Option 1", "preview": "Result preview"},
    {"id": "opt2", "description": "Option 2", "preview": "Result preview"}
  ]
}

${historySection}
${resolutionSection}`;

  const userPrompt = `Generate a DomainSchema draft from these intents:

${intents
  .map(
    (intent, i) =>
      `${i + 1}. [${intent.kind}] ${intent.description} (confidence: ${intent.confidence})`
  )
  .join("\n")}

${context?.domainName ? `Domain Name: ${context.domainName}` : ""}

Respond with JSON only. The response must be a valid JSON object with a "draft" key.`;

  return { systemPrompt, userPrompt };
}

/**
 * Get DomainSchema structure documentation
 */
function getDomainSchemaStructure(): string {
  return `The DomainSchema must conform to this structure:

{
  "id": "string (unique identifier, URI or UUID)",
  "version": "string (semantic version, e.g., '1.0.0')",
  "hash": "string (leave empty, will be computed)",
  "state": {
    "fields": {
      "<fieldName>": {
        "type": "string | number | boolean | null | object | array | { enum: [...] }",
        "required": "boolean",
        "default": "any (optional)",
        "description": "string (optional)",
        "fields": "Record<string, FieldSpec> (for object type)",
        "items": "FieldSpec (for array type)"
      }
    }
  },
  "computed": {
    "fields": {
      "computed.<name>": {
        "deps": ["state.field1", "state.field2", ...],
        "expr": "ExprNode",
        "description": "string (optional)"
      }
    }
  },
  "actions": {
    "<actionName>": {
      "flow": "FlowNode",
      "input": "FieldSpec (optional)",
      "available": "ExprNode (optional, must return boolean)",
      "description": "string (optional)"
    }
  },
  "meta": {
    "name": "string (optional)",
    "description": "string (optional)",
    "authors": ["string"] (optional)
  }
}

## Type Reference

### FieldSpec types
- "string": Text value
- "number": Numeric value
- "boolean": true/false
- "null": Null value
- "object": Nested object (requires "fields")
- "array": Array (requires "items")
- {"enum": ["value1", "value2"]}: Enumerated values

### ExprNode kinds
- lit: Literal value {"kind": "lit", "value": <any>}
- get: Get value {"kind": "get", "path": "<semantic.path>"}
- eq/neq/gt/gte/lt/lte: Comparisons
- and/or/not: Logical operators
- add/sub/mul/div/mod: Arithmetic
- concat/substring: String operations
- len/at/first/last/slice/includes/filter/map/find/every/some: Array operations
- keys/values/entries/merge: Object operations
- typeof/isNull/coalesce: Type operations
- if: Conditional {"kind": "if", "cond": <expr>, "then": <expr>, "else": <expr>}

### FlowNode kinds
- seq: Sequence {"kind": "seq", "steps": [<flow>, ...]}
- if: Conditional {"kind": "if", "cond": <expr>, "then": <flow>, "else": <flow>?}
- patch: State mutation {"kind": "patch", "op": "set|unset|merge", "path": "<path>", "value": <expr>?}
- effect: External operation {"kind": "effect", "type": "<type>", "params": {<key>: <expr>}}
- call: Call flow {"kind": "call", "flow": "<flowName>"}
- halt: Stop normally {"kind": "halt", "reason": "<string>?"}
- fail: Stop with error {"kind": "fail", "code": "<code>", "message": <expr>?}`;
}

/**
 * Format attempt history for retry prompts
 */
function formatAttemptHistory(history: AttemptRecord[]): string {
  if (history.length === 0) {
    return "";
  }

  const formatted = history
    .map((attempt) => {
      const diagnosticsText = attempt.diagnostics
        ? formatDiagnosticsForPrompt(attempt.diagnostics)
        : "No diagnostics available";

      return `### Attempt ${attempt.attemptNumber + 1}
Hash: ${attempt.draftHash}
${diagnosticsText}`;
    })
    .join("\n\n");

  return `
## Previous Failed Attempts

IMPORTANT: Review these failed attempts and their diagnostics carefully.
Do NOT repeat the same mistakes. Address each error mentioned.

${formatted}
`;
}

/**
 * Format diagnostics for inclusion in prompts
 */
function formatDiagnosticsForPrompt(diagnostics: CompilerDiagnostics): string {
  const sections: string[] = [];

  if (diagnostics.errors.length > 0) {
    sections.push("**ERRORS (must fix):**");
    sections.push(
      diagnostics.errors
        .map((d) => {
          const parts = [`- [${d.code}] ${d.message}`];
          if (d.path) parts.push(`  Location: ${d.path}`);
          if (d.suggestion) parts.push(`  Suggestion: ${d.suggestion}`);
          return parts.join("\n");
        })
        .join("\n")
    );
  }

  if (diagnostics.warnings.length > 0) {
    sections.push("**WARNINGS (should fix):**");
    sections.push(
      diagnostics.warnings
        .map((d) => {
          const parts = [`- [${d.code}] ${d.message}`];
          if (d.path) parts.push(`  Location: ${d.path}`);
          if (d.suggestion) parts.push(`  Suggestion: ${d.suggestion}`);
          return parts.join("\n");
        })
        .join("\n")
    );
  }

  return sections.length > 0 ? sections.join("\n\n") : "No specific diagnostics available.";
}
