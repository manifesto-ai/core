/**
 * @fileoverview DeterministicTranslator (SPEC Section 6.2)
 *
 * Rule-based extraction for testing.
 *
 * Per G-INV-*:
 * - G-INV-1: Node IDs are unique within graph
 * - G-INV-2: All dependsOn IDs exist in graph
 * - G-INV-3: Graph is a DAG (no cycles)
 * - G-INV-4: Non-abstract nodes SHALL NOT depend on abstract nodes
 *
 * @module strategies/translate/deterministic
 */

import type {
  IntentGraph,
  IntentNode,
  IntentNodeId,
  Resolution,
} from "../../core/types/intent-graph.js";
import { createNodeId } from "../../core/types/intent-graph.js";
import type {
  TranslateStrategy,
  TranslateOptions,
} from "../../core/interfaces/translator.js";

// =============================================================================
// DeterministicTranslatorConfig
// =============================================================================

/**
 * Configuration for DeterministicTranslator.
 */
export interface DeterministicTranslatorConfig {
  /** Custom pattern extractors */
  patterns?: PatternExtractor[];
}

/**
 * Pattern extractor for deterministic translation.
 */
export interface PatternExtractor {
  /** Pattern to match */
  pattern: RegExp;

  /** Extract intent from match */
  extract: (match: RegExpMatchArray, text: string) => Partial<IntentNode> | null;
}

// =============================================================================
// Default Patterns
// =============================================================================

const DEFAULT_PATTERNS: PatternExtractor[] = [
  {
    // "create X" pattern
    pattern: /\bcreate\s+(?:a\s+)?(\w+)/gi,
    extract: (match) => ({
      ir: {
        v: "0.1" as const,
        force: "DO" as const,
        event: { lemma: "CREATE", class: "CREATE" as const },
        args: {
          TARGET: { kind: "entity" as const, entityType: match[1].toLowerCase() },
        },
      },
      resolution: {
        status: "Resolved",
        ambiguityScore: 0,
      },
    }),
  },
  {
    // "add X to Y" pattern
    pattern: /\badd\s+(?:a\s+)?(\w+)\s+to\s+(?:the\s+)?(\w+)/gi,
    extract: (match) => ({
      ir: {
        v: "0.1" as const,
        force: "DO" as const,
        event: { lemma: "ADD", class: "CREATE" as const },
        args: {
          THEME: { kind: "entity" as const, entityType: match[1].toLowerCase() },
          TARGET: { kind: "entity" as const, entityType: match[2].toLowerCase() },
        },
      },
      resolution: {
        status: "Ambiguous",
        ambiguityScore: 0.3,
        questions: [`Which ${match[2]} should receive the ${match[1]}?`],
      },
    }),
  },
  {
    // "delete X" pattern
    pattern: /\bdelete\s+(?:the\s+)?(\w+)/gi,
    extract: (match) => ({
      ir: {
        v: "0.1" as const,
        force: "DO" as const,
        event: { lemma: "DELETE", class: "CONTROL" as const },
        args: {
          TARGET: { kind: "entity" as const, entityType: match[1].toLowerCase() },
        },
      },
      resolution: {
        status: "Ambiguous",
        ambiguityScore: 0.5,
        missing: ["TARGET"] as const,
        questions: [`Which ${match[1]} should be deleted?`],
      },
    }),
  },
  {
    // "update X" pattern
    pattern: /\bupdate\s+(?:the\s+)?(\w+)/gi,
    extract: (match) => ({
      ir: {
        v: "0.1" as const,
        force: "DO" as const,
        event: { lemma: "UPDATE", class: "TRANSFORM" as const },
        args: {
          TARGET: { kind: "entity" as const, entityType: match[1].toLowerCase() },
        },
      },
      resolution: {
        status: "Ambiguous",
        ambiguityScore: 0.6,
        missing: ["TARGET", "THEME"] as const,
        questions: [
          `Which ${match[1]} should be updated?`,
          "What changes should be made?",
        ],
      },
    }),
  },
];

// =============================================================================
// DeterministicTranslator
// =============================================================================

/**
 * Rule-based extraction for testing.
 *
 * Per SPEC Section 6.2:
 * - Uses pattern matching for intent extraction
 * - Deterministic output for testing
 * - No LLM dependency
 */
export class DeterministicTranslator implements TranslateStrategy {
  readonly name = "DeterministicTranslator";

  private readonly patterns: PatternExtractor[];

  constructor(config?: DeterministicTranslatorConfig) {
    this.patterns = config?.patterns ?? DEFAULT_PATTERNS;
  }

  async translate(
    text: string,
    options?: TranslateOptions
  ): Promise<IntentGraph> {
    const nodes: IntentNode[] = [];
    const nodeIds = new Set<IntentNodeId>();
    let nodeCounter = 1;

    // Extract intents using patterns
    for (const { pattern, extract } of this.patterns) {
      // Reset pattern state
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const partial = extract(match, text);
        if (partial) {
          // Generate unique ID
          const id = createNodeId(`n${nodeCounter++}`);

          // Build full node
          const node: IntentNode = {
            id,
            ir: partial.ir ?? {
              v: "0.1" as const,
              force: "CLARIFY" as const,
              event: { lemma: "UNKNOWN", class: "OBSERVE" as const },
              args: {},
            },
            dependsOn: (partial.dependsOn ?? []) as IntentNodeId[],
            resolution: partial.resolution ?? {
              status: "Ambiguous",
              ambiguityScore: 0.5,
            },
          };

          // G-INV-1: Ensure unique ID
          if (!nodeIds.has(id)) {
            nodeIds.add(id);
            nodes.push(node);
          }

          // Respect maxNodes limit
          if (options?.maxNodes && nodes.length >= options.maxNodes) {
            return { nodes };
          }
        }
      }
    }

    // If no intents found, create a single abstract node
    if (nodes.length === 0) {
      nodes.push({
        id: createNodeId("n1"),
        ir: {
          v: "0.1" as const,
          force: "CLARIFY" as const,
          event: { lemma: "UNKNOWN", class: "OBSERVE" as const },
          args: {},
          ext: { source: text },
        },
        dependsOn: [],
        resolution: {
          status: "Abstract",
          ambiguityScore: 1.0,
          questions: ["What action should be performed?"],
        },
      });
    }

    // Add dependencies based on order (simple heuristic)
    // Each node depends on the previous non-Abstract node
    let lastNonAbstractId: IntentNodeId | null = null;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.resolution.status !== "Abstract") {
        if (lastNonAbstractId && !node.dependsOn.includes(lastNonAbstractId)) {
          // Create new node with dependency
          nodes[i] = {
            ...node,
            dependsOn: [...node.dependsOn, lastNonAbstractId],
          };
        }
        lastNonAbstractId = node.id;
      }
    }

    return { nodes };
  }
}
