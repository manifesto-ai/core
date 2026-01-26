/**
 * @fileoverview LLM-based Translation
 *
 * Core logic for translating natural language using LLM.
 */

import type { LLMProvider, LLMIntentNode } from "../llm/provider.js";
import type {
  IntentGraph,
  IntentNode,
  IntentNodeId,
  TranslateOptions,
  TranslateResult,
  TranslateWarning,
} from "../types/index.js";
import { createNodeId } from "../types/node.js";
import { validateStructural } from "../validate/structural.js";
import { validateWithLexicon } from "../validate/lexicon.js";
import { TranslatorError } from "../types/errors.js";
import {
  calculateAmbiguityScore,
  determineResolutionStatus,
  generateClarifyingQuestions,
} from "./ambiguity-scorer.js";

// =============================================================================
// translateWithLLM
// =============================================================================

/**
 * Translate natural language to Intent Graph using LLM.
 *
 * @param text - Natural language input
 * @param provider - LLM provider to use
 * @param options - Translation options
 * @returns TranslateResult with graph and warnings
 */
export async function translateWithLLM(
  text: string,
  provider: LLMProvider,
  options?: TranslateOptions
): Promise<TranslateResult> {
  const warnings: TranslateWarning[] = [];

  // Make LLM request
  const response = await provider.translate({
    input: text,
    language: options?.language,
    domainHint: options?.domainHint,
    maxNodes: options?.maxNodes,
    temperature: options?.llm?.temperature,
  });

  // Convert LLM nodes to IntentNodes
  const { nodes, nodeWarnings } = convertLLMNodes(response.nodes);
  warnings.push(...nodeWarnings);

  // Build graph
  const graph: IntentGraph = {
    nodes,
    meta: {
      sourceText: text,
      translatedAt: new Date().toISOString(),
    },
  };

  // Validate structural (always)
  const structuralResult = validateStructural(graph);
  if (!structuralResult.result.valid) {
    throw new TranslatorError(
      `Structural validation failed: ${structuralResult.result.details ?? structuralResult.result.error}`,
      {
        code: structuralResult.result.error,
        nodeId: structuralResult.result.nodeId,
      }
    );
  }

  // Add structural warnings
  for (const warning of structuralResult.warnings) {
    warnings.push({
      code: "STRUCTURAL_WARNING",
      message: warning,
    });
  }

  // Validate with Lexicon if provided
  if (options?.validateWith) {
    const lexiconResult = validateWithLexicon(graph, {
      lexicon: options.validateWith,
    });
    if (!lexiconResult.valid) {
      throw new TranslatorError(
        `Lexicon validation failed: ${lexiconResult.details ?? lexiconResult.error}`,
        {
          code: lexiconResult.error,
          nodeId: lexiconResult.nodeId,
        }
      );
    }
  }

  return {
    graph,
    warnings,
  };
}

// =============================================================================
// Node Conversion
// =============================================================================

/**
 * Convert LLM nodes to IntentNodes.
 */
function convertLLMNodes(llmNodes: readonly LLMIntentNode[]): {
  nodes: IntentNode[];
  nodeWarnings: TranslateWarning[];
} {
  const warnings: TranslateWarning[] = [];
  const nodes: IntentNode[] = [];

  // Create mapping from tempId to nodeId
  const idMap = new Map<string, IntentNodeId>();
  for (let i = 0; i < llmNodes.length; i++) {
    const llmNode = llmNodes[i];
    const nodeId = createNodeId(`n${i + 1}`);
    idMap.set(llmNode.tempId, nodeId);
  }

  // Convert each node
  for (const llmNode of llmNodes) {
    const nodeId = idMap.get(llmNode.tempId)!;

    // Convert dependencies
    const dependsOn: IntentNodeId[] = [];
    for (const depTempId of llmNode.dependsOnTempIds) {
      const depNodeId = idMap.get(depTempId);
      if (depNodeId) {
        dependsOn.push(depNodeId);
      } else {
        warnings.push({
          code: "INVALID_DEPENDENCY",
          message: `Node ${llmNode.tempId} references unknown dependency ${depTempId}`,
          nodeId,
        });
      }
    }

    // Calculate ambiguity score and status
    const ambiguityScore = calculateAmbiguityScore(llmNode.ambiguityIndicators);
    const status = determineResolutionStatus(ambiguityScore, llmNode.ambiguityIndicators);

    // Generate clarifying questions if ambiguous
    const questions =
      status === "Ambiguous" || status === "Abstract"
        ? generateClarifyingQuestions(
            llmNode.ir.event.lemma,
            llmNode.ambiguityIndicators
          )
        : undefined;

    // Build IntentNode
    const node: IntentNode = {
      id: nodeId,
      ir: llmNode.ir,
      dependsOn,
      resolution: {
        status,
        ambiguityScore,
        missing:
          llmNode.ambiguityIndicators.missingRequiredRoles.length > 0
            ? llmNode.ambiguityIndicators.missingRequiredRoles
            : undefined,
        questions: questions && questions.length > 0 ? questions : undefined,
      },
    };

    nodes.push(node);
  }

  return { nodes, nodeWarnings: warnings };
}
