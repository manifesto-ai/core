/**
 * @fileoverview S6: Lower Stage
 *
 * Lowers IntentIR to IntentBody and derives intentKey.
 * Deterministic stage.
 * Aligned with SPEC §5.1 S6 and §11.
 */

import {
  deriveIntentKeySync,
  type IntentIR,
  type IntentBody,
  type Lexicon,
} from "@manifesto-ai/intent-ir";
import {
  type LoweringResult,
  type ResolvedResult,
  type UnresolvedResult,
  type LoweringEvidence,
  type MissingInfo,
  type LexiconSource,
  type FieldMapping,
  type ResolutionRecord,
} from "../types/index.js";
import { determineLexiconSource } from "../lexicon/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Lower stage result with intentKey
 */
export type LowerStageResult = {
  readonly loweringResult: LoweringResult;
  readonly intentKey: string | undefined;
};

/**
 * Lower trace output
 */
export type LowerTrace = {
  readonly originalLemma: string;
  readonly resolvedLemma: string;
  readonly mappings: readonly FieldMapping[];
  readonly result: LoweringResult["kind"];
  readonly intentKey?: string;
};

// =============================================================================
// Stage Implementation
// =============================================================================

/**
 * S6: Lower IntentIR to IntentBody and derive intentKey
 *
 * TAPP-PIPE-1: This stage is deterministic.
 * TAPP-KEY-9: intentKey derived via deriveIntentKey().
 * TAPP-LEX-10: IntentBody.type is resolved canonical lemma.
 *
 * @param ir - IntentIR from S5 (resolve refs)
 * @param lexicon - Composite lexicon
 * @param learned - Learned lexicon (for source determination)
 * @param project - Project lexicon (for source determination)
 * @param builtin - Builtin lexicon (for source determination)
 * @param schemaHash - Current schema hash
 * @param resolutions - Resolution records from S5
 * @returns LowerStageResult
 */
export function lowerIR(
  ir: IntentIR,
  lexicon: Lexicon,
  learned: Lexicon,
  project: Lexicon,
  builtin: Lexicon,
  schemaHash: string,
  resolutions?: readonly ResolutionRecord[]
): LowerStageResult {
  const lemma = ir.event.lemma;

  // Resolve action type (canonical lemma)
  const actionType = lexicon.resolveActionType(lemma);

  if (!actionType) {
    // No matching action type - return provisional IntentBody
    const result = createUnresolvedResult(ir, lemma);
    return {
      loweringResult: result,
      intentKey: undefined,
    };
  }

  // Determine lexicon source
  const source = determineLexiconSource(learned, project, builtin, lemma) ?? "builtin";

  // Map args to input
  const input = lexicon.mapArgsToInput(ir.args, ir.cond);

  // Derive scope proposal (if available)
  const scopeProposal = lexicon.deriveScopeProposal?.(ir);

  // Build IntentBody
  const body: IntentBody = {
    type: actionType,
    ...(input !== undefined && { input }),
    ...(scopeProposal && { scopeProposal }),
  };

  // Derive intentKey
  const intentKey = deriveIntentKeySync(body, schemaHash);

  // Build evidence
  const evidence: LoweringEvidence = {
    lexiconSource: source,
    originalLemma: lemma,
    resolvedLemma: actionType,
    mappedFields: buildFieldMappings(ir),
    resolutions,
    intentKey,
  };

  const result: ResolvedResult = {
    kind: "resolved",
    body,
    evidence,
  };

  return {
    loweringResult: result,
    intentKey,
  };
}

/**
 * Create unresolved result for cold start / unknown lemma
 */
function createUnresolvedResult(ir: IntentIR, lemma: string): UnresolvedResult {
  const partial: Partial<IntentBody> = {
    type: lemma, // Use lemma as-is
    input: {
      args: ir.args,
      cond: ir.cond,
      ext: ir.ext,
    },
  };

  const missing: MissingInfo[] = [
    {
      kind: "action_type",
      detail: `No matching Lexicon entry for: ${lemma}`,
      suggestion: `Add a mapping for "${lemma}" via learn action`,
    },
  ];

  return {
    kind: "unresolved",
    partial,
    missing,
  };
}

/**
 * Build field mappings from IR args
 */
function buildFieldMappings(ir: IntentIR): FieldMapping[] {
  const mappings: FieldMapping[] = [];

  for (const [role, term] of Object.entries(ir.args)) {
    if (term === undefined) continue;

    mappings.push({
      from: {
        role,
        path: `args.${role}`,
      },
      to: {
        field: role.toLowerCase(),
      },
    });
  }

  return mappings;
}

/**
 * Create lower trace from result
 */
export function createLowerTrace(
  ir: IntentIR,
  result: LowerStageResult
): LowerTrace {
  const lemma = ir.event.lemma;

  if (result.loweringResult.kind === "resolved") {
    return {
      originalLemma: lemma,
      resolvedLemma: result.loweringResult.body.type,
      mappings: result.loweringResult.evidence.mappedFields,
      result: "resolved",
      intentKey: result.intentKey,
    };
  }

  return {
    originalLemma: lemma,
    resolvedLemma: lemma, // Same as original for unresolved
    mappings: [],
    result: result.loweringResult.kind,
  };
}

/**
 * Check if a lowering result is resolved
 */
export function isResolved(result: LoweringResult): result is ResolvedResult {
  return result.kind === "resolved";
}
