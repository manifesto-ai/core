/**
 * Stage 6: Result Assembly
 *
 * Assembles the final translation result:
 * - Validates fragments
 * - Deduplicates by fragmentId
 * - Detects conflicts
 * - Enforces confidence thresholds
 *
 * MUST be deterministic.
 */

import type {
  TranslationResult,
  TranslationTrace,
  PatchFragment,
  AmbiguityReport,
  AmbiguityCandidate,
  AssemblyTrace,
  FastPathResult,
  ProposalResult,
  TranslationError,
} from "../domain/index.js";
import {
  createOptCancelCandidate,
  noFragmentsProduced,
  confidenceTooLow,
  fragmentConflict,
  typeError,
} from "../domain/index.js";
import type { PipelineState, StageResult, PipelineConfig } from "./types.js";
import { computeFragmentId, generateReportId } from "../utils/index.js";

/**
 * Assembly result
 */
export interface AssemblyResult {
  kind: "fragment" | "ambiguity" | "error";
  fragments?: PatchFragment[];
  report?: AmbiguityReport;
  error?: TranslationError;
}

/**
 * Execute assembly stage
 */
export async function executeAssembly(
  source: FastPathResult | ProposalResult,
  state: PipelineState,
  config: PipelineConfig
): Promise<StageResult<AssemblyResult>> {
  const startTime = Date.now();

  try {
    const result = assembleResult(source, state, config);
    const durationMs = Date.now() - startTime;

    return {
      success: true,
      data: result,
      durationMs,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Assemble final result from stage outputs
 */
function assembleResult(
  source: FastPathResult | ProposalResult,
  state: PipelineState,
  config: PipelineConfig
): AssemblyResult {
  // Handle FastPathResult
  if ("matched" in source) {
    return assembleFastPathResult(source, state, config);
  }

  // Handle ProposalResult
  return assembleProposalResult(source, state, config);
}

/**
 * Assemble result from fast-path
 */
function assembleFastPathResult(
  fastPath: FastPathResult,
  _state: PipelineState,
  config: PipelineConfig
): AssemblyResult {
  if (fastPath.matched && fastPath.best) {
    // High-confidence match
    const fragments = validateAndDedupe(fastPath.best.fragments);
    const conflicts = detectConflicts(fragments);

    if (conflicts.length > 0) {
      return {
        kind: "error",
        error: fragmentConflict(
          `Conflicting fragments detected: ${conflicts.join(", ")}`
        ),
      };
    }

    // Check confidence threshold
    const avgConfidence = calculateAverageConfidence(fragments);
    if (avgConfidence < config.rejectThreshold) {
      return {
        kind: "error",
        error: confidenceTooLow(avgConfidence, config.rejectThreshold),
      };
    }

    return {
      kind: "fragment",
      fragments,
    };
  }

  // Fast path miss with candidates → ambiguity
  if (fastPath.candidates.length > 0) {
    return {
      kind: "ambiguity",
      report: createAmbiguityFromCandidates(fastPath.candidates),
    };
  }

  // Fast path miss with no candidates → error
  return {
    kind: "error",
    error: noFragmentsProduced(),
  };
}

/**
 * Assemble result from proposer
 */
function assembleProposalResult(
  proposal: ProposalResult,
  _state: PipelineState,
  config: PipelineConfig
): AssemblyResult {
  switch (proposal.kind) {
    case "fragments": {
      const fragments = validateAndDedupe(proposal.fragments);
      const conflicts = detectConflicts(fragments);

      if (conflicts.length > 0) {
        return {
          kind: "error",
          error: fragmentConflict(
            `Conflicting fragments detected: ${conflicts.join(", ")}`
          ),
        };
      }

      // Check confidence threshold
      const avgConfidence = calculateAverageConfidence(fragments);
      if (avgConfidence < config.rejectThreshold) {
        return {
          kind: "error",
          error: confidenceTooLow(avgConfidence, config.rejectThreshold),
        };
      }

      if (fragments.length === 0) {
        return {
          kind: "error",
          error: noFragmentsProduced(),
        };
      }

      return {
        kind: "fragment",
        fragments,
      };
    }

    case "ambiguity":
      return {
        kind: "ambiguity",
        report: proposal.ambiguity,
      };

    case "empty":
      return {
        kind: "error",
        error: noFragmentsProduced(),
      };
  }
}

/**
 * Validate fragments and remove duplicates
 */
function validateAndDedupe(fragments: PatchFragment[]): PatchFragment[] {
  const seen = new Set<string>();
  const result: PatchFragment[] = [];
  const errors: string[] = [];

  for (const fragment of fragments) {
    // Validate fragmentId
    const expectedId = computeFragmentId(fragment.sourceIntentId, fragment.op);
    if (fragment.fragmentId !== expectedId) {
      // Auto-fix fragmentId
      fragment.fragmentId = expectedId;
    }

    // Validate ExprNode contexts (simplified check)
    const validationError = validateFragment(fragment);
    if (validationError) {
      errors.push(validationError);
      continue;
    }

    // Deduplicate by fragmentId
    if (!seen.has(fragment.fragmentId)) {
      seen.add(fragment.fragmentId);
      result.push(fragment);
    }
  }

  if (errors.length > 0) {
    // Log validation errors but continue with valid fragments
    console.warn("Fragment validation errors:", errors);
  }

  return result;
}

/**
 * Validate a single fragment
 */
function validateFragment(fragment: PatchFragment): string | null {
  const { op } = fragment;

  // Validate based on op kind
  switch (op.kind) {
    case "addComputed":
      // Check expr doesn't use forbidden node kinds
      if (!validateExprContext(op.expr, "computed")) {
        return `Invalid ExprNode in addComputed.expr`;
      }
      break;

    case "addConstraint":
      if (!validateExprContext(op.rule, "constraint")) {
        return `Invalid ExprNode in addConstraint.rule`;
      }
      break;

    case "addActionAvailable":
      if (!validateExprContext(op.expr, "available")) {
        return `Invalid ExprNode in addActionAvailable.expr`;
      }
      break;
  }

  return null;
}

/**
 * Validate ExprNode in context
 */
function validateExprContext(
  expr: unknown,
  context: "computed" | "constraint" | "available"
): boolean {
  if (!expr || typeof expr !== "object") {
    return false;
  }

  const node = expr as { kind?: string };

  // In computed/constraint/available contexts, 'var' and 'sys' are restricted
  if (
    (context === "computed" || context === "constraint") &&
    (node.kind === "var" || node.kind === "sys")
  ) {
    return false;
  }

  return true;
}

/**
 * Detect conflicting fragments
 */
function detectConflicts(fragments: PatchFragment[]): string[] {
  const conflicts: string[] = [];
  const pathOps = new Map<string, PatchFragment[]>();

  for (const fragment of fragments) {
    const path = getFragmentPath(fragment);
    if (!pathOps.has(path)) {
      pathOps.set(path, []);
    }
    pathOps.get(path)!.push(fragment);
  }

  // Check for conflicts on same path
  for (const [path, frags] of pathOps) {
    if (frags.length > 1) {
      // Multiple operations on same path
      const opKinds = frags.map((f) => f.op.kind);
      const uniqueKinds = new Set(opKinds);

      // Same op kind on same path is likely a conflict
      if (uniqueKinds.size < opKinds.length) {
        conflicts.push(`Duplicate ${opKinds[0]} on ${path}`);
      }
    }
  }

  return conflicts;
}

/**
 * Get path from fragment op
 */
function getFragmentPath(fragment: PatchFragment): string {
  const { op } = fragment;

  switch (op.kind) {
    case "defineType":
      return `types.${op.typeName}`;
    case "addField":
    case "addConstraint":
    case "setDefaultValue":
    case "widenFieldType":
    case "addComputed":
      return op.path;
    case "addAction":
    case "addActionParam":
    case "addActionAvailable":
    case "addActionGuard":
      return `actions.${op.actionName}`;
    default:
      return "unknown";
  }
}

/**
 * Calculate average confidence
 */
function calculateAverageConfidence(fragments: PatchFragment[]): number {
  if (fragments.length === 0) return 0;
  const sum = fragments.reduce((acc, f) => acc + f.confidence, 0);
  return sum / fragments.length;
}

/**
 * Create ambiguity report from candidates
 */
function createAmbiguityFromCandidates(
  candidates: { patternId: string; fragments: PatchFragment[]; confidence: number; evidence?: string[] }[]
): AmbiguityReport {
  const ambiguityCandidates: AmbiguityCandidate[] = candidates.map((c, i) => ({
    optionId: `opt-${i}`,
    description: `Apply pattern: ${c.patternId}`,
    fragments: c.fragments,
    confidence: c.confidence,
    evidence: c.evidence,
  }));

  // Always include opt-cancel
  ambiguityCandidates.push(createOptCancelCandidate());

  return {
    reportId: generateReportId(),
    kind: "intent",
    normalizedInput: "",
    candidates: ambiguityCandidates,
    resolutionPrompt: {
      question: "Multiple patterns matched with low confidence. Select one:",
      optionIds: ambiguityCandidates.map((c) => c.optionId),
    },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create assembly trace
 */
export function createAssemblyTrace(
  result: AssemblyResult,
  fragments: PatchFragment[],
  durationMs: number
): AssemblyTrace {
  const avgConfidence = calculateAverageConfidence(fragments);

  return {
    fragmentCount: fragments.length,
    finalConfidence: avgConfidence,
    conflictCount: 0, // Would be set if conflicts were detected
    dedupeCount: 0, // Would track deduplicated count
    resultKind: result.kind,
    durationMs,
  };
}

/**
 * Build final translation result
 */
export function buildTranslationResult(
  assembly: AssemblyResult,
  trace: TranslationTrace
): TranslationResult {
  switch (assembly.kind) {
    case "fragment":
      return {
        kind: "fragment",
        fragments: assembly.fragments!,
        trace,
      };

    case "ambiguity":
      return {
        kind: "ambiguity",
        report: assembly.report!,
        trace,
      };

    case "error":
      return {
        kind: "error",
        error: assembly.error!,
        trace,
      };
  }
}
