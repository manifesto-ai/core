/**
 * Translator Integration
 *
 * Processes Translator output through Compiler lowering and evaluation.
 *
 * @see Host SPEC v1.1 §4.3, §17
 */

import {
  lowerPatchFragments,
  evaluateConditionalPatchOps,
  evaluateExpr,
  LoweringError,
  type PatchLoweringContext,
  type EvaluationContext,
  type ConditionalPatchOp,
  type MelPatchFragment,
  type EvaluatedPatch,
} from "@manifesto-ai/compiler";
import type { Snapshot, Intent, ExprNode } from "@manifesto-ai/core";
import { createHostError, type HostError } from "./errors.js";

// ============ Types ============

/**
 * Translator output structure.
 *
 * Matches the output from @manifesto-ai/translator.
 */
export interface TranslatorOutput {
  /**
   * Patch fragments with MEL IR expressions.
   */
  fragments: MelPatchFragment[];

  /**
   * Action name from translation.
   */
  actionName?: string;

  /**
   * Extracted parameters from natural language.
   */
  params?: Record<string, unknown>;

  /**
   * Ambiguity information if translation was ambiguous.
   */
  ambiguity?: unknown;
}

/**
 * Options for processing translator output.
 */
export interface ProcessTranslatorOptions {
  /**
   * Intent ID for evaluation and compute loop.
   *
   * CRITICAL: This MUST be the same ID used in the subsequent compute loop.
   *
   * @see FDR-H014
   */
  intentId: string;

  /**
   * Action name override (defaults to translator output).
   */
  actionName?: string;
}

/**
 * Concrete patch ready for core.apply().
 *
 * This is the evaluated form with no expressions.
 */
export interface ConcretePatch {
  op: "set" | "unset" | "merge";
  path: string;
  value?: unknown;
}

/**
 * Result of processing translator output.
 */
export interface ProcessTranslatorResult {
  /**
   * Concrete patches ready for core.apply().
   *
   * @see FDR-H013
   */
  patches: ConcretePatch[];

  /**
   * Lowered operations (for debugging/tracing).
   */
  lowered: ConditionalPatchOp[];

  /**
   * Evaluated patches (for debugging/tracing).
   */
  evaluated: EvaluatedPatch[];

  /**
   * Intent to use in compute loop (same intentId).
   *
   * @see FDR-H014
   */
  intent: Intent;

  /**
   * Patches that were skipped due to conditions.
   */
  skipped: Array<{
    fragmentId: string;
    reason: "false" | "null" | "non-boolean";
  }>;
}

// ============ Main Processing Function ============

/**
 * Process Translator output through lowering and evaluation.
 *
 * Implements the two-step processing required by Host SPEC v1.1:
 * 1. Lower MEL IR → Core IR (preserves conditions)
 * 2. Evaluate Core IR → concrete values (applies conditions)
 *
 * @param output - Translator output with MEL IR fragments
 * @param snapshot - Current snapshot for expression evaluation
 * @param options - Processing options (intentId is REQUIRED)
 * @returns Processing result with concrete patches
 *
 * @throws {HostError} With code TRANSLATOR_LOWERING_ERROR if lowering fails
 *
 * @see Host SPEC v1.1 §4.3
 */
export function processTranslatorOutput(
  output: TranslatorOutput,
  snapshot: Snapshot,
  options: ProcessTranslatorOptions
): ProcessTranslatorResult {
  const actionName = options.actionName ?? output.actionName ?? "translated";

  // Step 1: Lower MEL IR → Core IR
  // FDR-H015: NO system prefix — forbidden in Translator path
  const loweringCtx: PatchLoweringContext = {
    allowSysPaths: { prefixes: ["meta", "input"] },
    fnTableVersion: "1.0",
    actionName,
  };

  let lowered: ConditionalPatchOp[];
  try {
    lowered = lowerPatchFragments(output.fragments, loweringCtx);
  } catch (e: unknown) {
    if (e instanceof LoweringError) {
      throw createHostError(
        "TRANSLATOR_LOWERING_ERROR",
        `Failed to lower translator output: ${e.message}`,
        {
          code: e.code,
          path: e.path,
          details: e.details,
        }
      );
    }
    throw e;
  }

  // Step 2: Evaluate Core IR → concrete values
  // FDR-H016: Use snapshot.data (not snapshot.state)
  const evalCtx: EvaluationContext = {
    snapshot: {
      data: snapshot.data,
      computed: snapshot.computed,
    },
    meta: { intentId: options.intentId },
    input: output.params ?? {},
  };

  const evalResult = evaluateConditionalPatchOps(lowered, evalCtx);

  // Step 3: Build intent for compute loop (SAME intentId)
  // FDR-H014: Single intentId throughout
  const intent: Intent = {
    type: actionName,
    input: output.params,
    intentId: options.intentId,
  };

  // Step 4: Extract concrete patches from evaluated results
  // Evaluate value expressions to concrete values
  const patches = extractConcretePatches(evalResult.patches, evalCtx);

  return {
    patches,
    lowered,
    evaluated: evalResult.patches,
    intent,
    skipped: evalResult.skipped,
  };
}

/**
 * Extract concrete patches from evaluated patch operations.
 *
 * Evaluates value expressions to concrete values using the evaluation context.
 * Schema operations (addType, addField, etc.) are skipped as they don't
 * apply to runtime state.
 */
function extractConcretePatches(
  evaluated: EvaluatedPatch[],
  ctx: EvaluationContext
): ConcretePatch[] {
  const patches: ConcretePatch[] = [];

  for (const evalPatch of evaluated) {
    const op = evalPatch.op;

    switch (op.kind) {
      case "setDefaultValue":
        // Evaluate the value expression to a concrete value
        // The value is a Core ExprNode from lowering
        const concreteValue = evaluateExpr(op.value as ExprNode, ctx);
        patches.push({
          op: "set",
          path: op.path,
          value: concreteValue,
        });
        break;

      case "addType":
      case "addField":
      case "setFieldType":
      case "addComputed":
      case "addConstraint":
      case "addActionAvailable":
        // Schema operations are applied to schema, not snapshot
        // These are typically used during schema compilation, not runtime
        // For now, we skip them in the concrete patch extraction
        // The caller should handle schema ops separately if needed
        break;
    }
  }

  return patches;
}

// ============ Utility Functions ============

/**
 * Check if translator output has ambiguity.
 */
export function hasAmbiguity(output: TranslatorOutput): boolean {
  return output.ambiguity !== undefined && output.ambiguity !== null;
}

/**
 * Create an intent ID for translator processing.
 *
 * Use this to generate a single intentId that should be passed to
 * both processTranslatorOutput and the subsequent compute loop.
 */
export function createTranslatorIntentId(): string {
  return crypto.randomUUID();
}
