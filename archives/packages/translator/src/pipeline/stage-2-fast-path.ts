/**
 * Stage 2: Fast Path (Deterministic)
 *
 * Attempts pattern-based, type-guided translation.
 * MUST be no-network and low latency.
 */

import type {
  FastPathResult,
  FastPathCandidate,
  FastPathTrace,
  NormalizationResult,
  TypeIndex,
  PatchFragment,
} from "../domain/index.js";
import type { PipelineState, StageResult } from "./types.js";

/**
 * Pattern definition for fast-path matching
 */
export interface FastPathPattern {
  /** Unique pattern ID */
  patternId: string;
  /** Regex or string pattern to match */
  pattern: RegExp;
  /** Minimum confidence for this pattern */
  minConfidence: number;
  /** Function to generate fragments from match */
  generate: (
    match: RegExpMatchArray,
    typeIndex: TypeIndex,
    intentId: string
  ) => FastPathCandidate | null;
}

/**
 * Built-in patterns for common operations
 */
const BUILTIN_PATTERNS: FastPathPattern[] = [
  // Add field pattern: "add X field to Y"
  {
    patternId: "add-field",
    pattern: /add\s+(?:a\s+)?(?:new\s+)?(\w+)\s+field\s+to\s+(\w+)/i,
    minConfidence: 0.7,
    generate: (match, typeIndex, intentId) => {
      const [, fieldName, targetName] = match;
      if (!fieldName || !targetName) return null;

      // Check if target exists in typeIndex
      const targetPath = findTargetPath(targetName, typeIndex);
      if (!targetPath) return null;

      return createAddFieldCandidate(
        fieldName.toLowerCase(),
        targetPath,
        intentId,
        0.75
      );
    },
  },

  // Add constraint pattern: "add constraint to X"
  {
    patternId: "add-constraint",
    pattern:
      /add\s+(?:a\s+)?constraint\s+(?:to\s+)?(\w+)(?:\s*:\s*(.+))?/i,
    minConfidence: 0.6,
    generate: (match, typeIndex, intentId) => {
      const [, targetName, rule] = match;
      if (!targetName) return null;

      const targetPath = findTargetPath(targetName, typeIndex);
      if (!targetPath) return null;

      return createAddConstraintCandidate(
        targetPath,
        rule || "",
        intentId,
        0.65
      );
    },
  },

  // Add computed pattern: "add computed X = expression"
  {
    patternId: "add-computed",
    pattern:
      /add\s+(?:a\s+)?computed\s+(?:value\s+)?(\w+)(?:\s*=\s*(.+))?/i,
    minConfidence: 0.6,
    generate: (match, _typeIndex, intentId) => {
      const [, name, expr] = match;
      if (!name) return null;

      return createAddComputedCandidate(
        name.toLowerCase(),
        expr || "",
        intentId,
        0.65
      );
    },
  },
];

/**
 * Execute fast-path stage
 */
export async function executeFastPath(
  normalization: NormalizationResult,
  state: PipelineState,
  patterns: FastPathPattern[] = BUILTIN_PATTERNS
): Promise<StageResult<FastPathResult>> {
  const startTime = Date.now();

  try {
    const result = matchPatterns(
      normalization.canonical,
      state.context.typeIndex,
      state.context.intentId,
      patterns
    );
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
 * Match patterns against normalized text
 */
function matchPatterns(
  text: string,
  typeIndex: TypeIndex,
  intentId: string,
  patterns: FastPathPattern[]
): FastPathResult {
  const candidates: FastPathCandidate[] = [];

  for (const pattern of patterns) {
    const match = text.match(pattern.pattern);
    if (match) {
      const candidate = pattern.generate(match, typeIndex, intentId);
      if (candidate && candidate.confidence >= pattern.minConfidence) {
        candidates.push(candidate);
      }
    }
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  const best = candidates.length > 0 ? candidates[0] : null;
  const matched = best !== null && best.confidence >= 0.8;

  return {
    matched,
    best,
    candidates,
  };
}

/**
 * Find target path in typeIndex
 */
function findTargetPath(
  targetName: string,
  typeIndex: TypeIndex
): string | null {
  const normalized = targetName.toLowerCase();

  // Check state fields
  const statePath = `state.${normalized}`;
  if (statePath in typeIndex) {
    return statePath;
  }

  // Check for partial match in state fields
  for (const path of Object.keys(typeIndex)) {
    if (path.startsWith("state.") && path.toLowerCase().includes(normalized)) {
      return path;
    }
  }

  // Check types
  for (const path of Object.keys(typeIndex)) {
    if (path.startsWith("types.") && path.toLowerCase().includes(normalized)) {
      return path;
    }
  }

  return null;
}

/**
 * Create add-field candidate
 */
function createAddFieldCandidate(
  fieldName: string,
  targetPath: string,
  intentId: string,
  confidence: number
): FastPathCandidate {
  const fragment: PatchFragment = {
    fragmentId: `fp-${intentId}-${fieldName}`,
    sourceIntentId: intentId,
    op: {
      kind: "addField",
      path: `${targetPath}.${fieldName}`,
      fieldType: { kind: "primitive", name: "string" },
    },
    confidence,
    evidence: [`Pattern match: add ${fieldName} to ${targetPath}`],
    createdAt: new Date().toISOString(),
  };

  return {
    patternId: "add-field",
    fragments: [fragment],
    confidence,
    evidence: [`Matched pattern: add field "${fieldName}" to "${targetPath}"`],
  };
}

/**
 * Create add-constraint candidate
 */
function createAddConstraintCandidate(
  targetPath: string,
  _rule: string,
  intentId: string,
  confidence: number
): FastPathCandidate {
  const fragment: PatchFragment = {
    fragmentId: `fp-${intentId}-constraint`,
    sourceIntentId: intentId,
    op: {
      kind: "addConstraint",
      path: targetPath,
      constraintId: `constraint-${Date.now()}`,
      rule: { kind: "lit", value: true }, // Placeholder
      message: "Constraint added via fast path",
    },
    confidence,
    evidence: [`Pattern match: add constraint to ${targetPath}`],
    createdAt: new Date().toISOString(),
  };

  return {
    patternId: "add-constraint",
    fragments: [fragment],
    confidence,
    evidence: [`Matched pattern: add constraint to "${targetPath}"`],
  };
}

/**
 * Create add-computed candidate
 */
function createAddComputedCandidate(
  name: string,
  _expr: string,
  intentId: string,
  confidence: number
): FastPathCandidate {
  const fragment: PatchFragment = {
    fragmentId: `fp-${intentId}-computed-${name}`,
    sourceIntentId: intentId,
    op: {
      kind: "addComputed",
      path: `computed.${name}`,
      expr: { kind: "lit", value: null }, // Placeholder
    },
    confidence,
    evidence: [`Pattern match: add computed ${name}`],
    createdAt: new Date().toISOString(),
  };

  return {
    patternId: "add-computed",
    fragments: [fragment],
    confidence,
    evidence: [`Matched pattern: add computed "${name}"`],
  };
}

/**
 * Create fast-path trace
 */
export function createFastPathTrace(
  result: FastPathResult,
  durationMs: number
): FastPathTrace {
  return {
    attempted: true,
    matched: result.matched,
    candidateCount: result.candidates.length,
    bestConfidence: result.best?.confidence,
    durationMs,
  };
}

/**
 * Register custom patterns
 */
export function createPatternRegistry(): {
  patterns: FastPathPattern[];
  register: (pattern: FastPathPattern) => void;
  unregister: (patternId: string) => void;
} {
  const patterns = [...BUILTIN_PATTERNS];

  return {
    patterns,
    register(pattern: FastPathPattern) {
      // Remove existing pattern with same ID
      const index = patterns.findIndex((p) => p.patternId === pattern.patternId);
      if (index >= 0) {
        patterns.splice(index, 1);
      }
      patterns.push(pattern);
    },
    unregister(patternId: string) {
      const index = patterns.findIndex((p) => p.patternId === patternId);
      if (index >= 0) {
        patterns.splice(index, 1);
      }
    },
  };
}
