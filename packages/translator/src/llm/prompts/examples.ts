/**
 * @fileoverview Few-Shot Examples
 *
 * Example translations for few-shot prompting.
 */

// =============================================================================
// Types
// =============================================================================

export type TranslationExample = {
  readonly input: string;
  readonly output: string;
};

// =============================================================================
// Examples
// =============================================================================

/**
 * Simple single-intent examples.
 */
export const SIMPLE_EXAMPLES: readonly TranslationExample[] = [
  {
    input: "Create a new project",
    output: JSON.stringify({
      nodes: [
        {
          tempId: "t1",
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {
              THEME: { kind: "entity", entityType: "Project" },
            },
          },
          dependsOnTempIds: [],
          ambiguityIndicators: {
            hasUnresolvedRef: false,
            missingRequiredRoles: [],
            multipleInterpretations: false,
            confidenceScore: 0.95,
          },
        },
      ],
    }),
  },
  {
    input: "Show all tasks",
    output: JSON.stringify({
      nodes: [
        {
          tempId: "t1",
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "SHOW", class: "OBSERVE" },
            args: {
              TARGET: { kind: "entity", entityType: "Task" },
            },
          },
          dependsOnTempIds: [],
          ambiguityIndicators: {
            hasUnresolvedRef: false,
            missingRequiredRoles: [],
            multipleInterpretations: false,
            confidenceScore: 0.9,
          },
        },
      ],
    }),
  },
  {
    input: "Delete the completed items",
    output: JSON.stringify({
      nodes: [
        {
          tempId: "t1",
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "DELETE", class: "CONTROL" },
            args: {
              TARGET: { kind: "entity", entityType: "Item" },
            },
            cond: {
              filter: { field: "status", op: "eq", value: "completed" },
            },
          },
          dependsOnTempIds: [],
          ambiguityIndicators: {
            hasUnresolvedRef: false,
            missingRequiredRoles: [],
            multipleInterpretations: false,
            confidenceScore: 0.85,
          },
        },
      ],
    }),
  },
];

/**
 * Multi-intent examples.
 */
export const MULTI_INTENT_EXAMPLES: readonly TranslationExample[] = [
  {
    input: "Create a project and add three tasks to it",
    output: JSON.stringify({
      nodes: [
        {
          tempId: "t1",
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {
              THEME: { kind: "entity", entityType: "Project" },
            },
          },
          dependsOnTempIds: [],
          ambiguityIndicators: {
            hasUnresolvedRef: false,
            missingRequiredRoles: [],
            multipleInterpretations: false,
            confidenceScore: 0.95,
          },
        },
        {
          tempId: "t2",
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "ADD", class: "TRANSFORM" },
            args: {
              THEME: {
                kind: "value",
                valueType: "number",
                raw: 3,
                shape: { count: 3, entityType: "Task" },
              },
              DEST: {
                kind: "entity",
                entityType: "Project",
                ref: { kind: "that" },
              },
            },
          },
          dependsOnTempIds: ["t1"],
          ambiguityIndicators: {
            hasUnresolvedRef: true,
            missingRequiredRoles: [],
            multipleInterpretations: false,
            confidenceScore: 0.9,
          },
        },
      ],
    }),
  },
  {
    input: "Find the overdue tasks and mark them as urgent",
    output: JSON.stringify({
      nodes: [
        {
          tempId: "t1",
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "FIND", class: "OBSERVE" },
            args: {
              TARGET: { kind: "entity", entityType: "Task" },
            },
            cond: {
              filter: { field: "dueDate", op: "lt", value: "now" },
            },
          },
          dependsOnTempIds: [],
          ambiguityIndicators: {
            hasUnresolvedRef: false,
            missingRequiredRoles: [],
            multipleInterpretations: false,
            confidenceScore: 0.85,
          },
        },
        {
          tempId: "t2",
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {
              TARGET: {
                kind: "entity",
                entityType: "Task",
                ref: { kind: "that" },
              },
              THEME: {
                kind: "value",
                valueType: "string",
                raw: "urgent",
              },
            },
          },
          dependsOnTempIds: ["t1"],
          ambiguityIndicators: {
            hasUnresolvedRef: true,
            missingRequiredRoles: [],
            multipleInterpretations: false,
            confidenceScore: 0.8,
          },
        },
      ],
    }),
  },
];

/**
 * Ambiguous input examples.
 */
export const AMBIGUOUS_EXAMPLES: readonly TranslationExample[] = [
  {
    input: "Update it",
    output: JSON.stringify({
      nodes: [
        {
          tempId: "t1",
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {
              TARGET: {
                kind: "entity",
                entityType: "Unknown",
                ref: { kind: "that" },
              },
            },
          },
          dependsOnTempIds: [],
          ambiguityIndicators: {
            hasUnresolvedRef: true,
            missingRequiredRoles: ["THEME"],
            multipleInterpretations: true,
            confidenceScore: 0.4,
          },
        },
      ],
    }),
  },
  {
    input: "Do something with the tasks",
    output: JSON.stringify({
      nodes: [
        {
          tempId: "t1",
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "PROCESS", class: "CONTROL" },
            args: {
              TARGET: { kind: "entity", entityType: "Task" },
            },
          },
          dependsOnTempIds: [],
          ambiguityIndicators: {
            hasUnresolvedRef: false,
            missingRequiredRoles: [],
            multipleInterpretations: true,
            confidenceScore: 0.3,
          },
        },
      ],
    }),
  },
];

/**
 * Get all examples for few-shot prompting.
 */
export function getAllExamples(): readonly TranslationExample[] {
  return [...SIMPLE_EXAMPLES, ...MULTI_INTENT_EXAMPLES, ...AMBIGUOUS_EXAMPLES];
}

/**
 * Format examples for inclusion in prompt.
 */
export function formatExamplesForPrompt(examples: readonly TranslationExample[]): string {
  return examples
    .map(
      (ex, i) => `Example ${i + 1}:
Input: "${ex.input}"
Output: ${ex.output}`
    )
    .join("\n\n");
}
