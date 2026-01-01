/**
 * Fast Path Matcher
 * Matches canonical text against patterns to generate fragments
 */

import type {
  Token,
  TypeIndex,
  FastPathResult,
  PatchFragment,
  FragmentConstraint,
} from "../types/index.js";
import { selectPatterns, type PatternMatchResult } from "./patterns.js";

/** Generate a unique fragment ID */
function generateFragmentId(): string {
  return `frag-fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Extract anchor from tokens
 */
function extractAnchor(tokens: Token[]): string | null {
  if (tokens.length === 0) return null;
  const firstToken = tokens[0].normalized;
  // Check if it looks like a path
  if (/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(firstToken)) {
    return firstToken;
  }
  return null;
}

/**
 * Build a PatchFragment from a pattern match result
 */
function buildFragment(
  match: PatternMatchResult,
  canonical: string
): PatchFragment {
  const change: FragmentConstraint = {
    kind: "constraint",
    path: match.anchor!,
    expr: match.expr!,
  };

  return {
    id: generateFragmentId(),
    description: match.description || `Constraint on ${match.anchor}`,
    changes: [change],
    metadata: {
      source: "fast-path",
      confidence: 1.0,
      createdAt: Date.now(),
    },
  };
}

/**
 * Match canonical text against fast path patterns
 *
 * @param canonical - Canonical English text
 * @param tokens - Tokenized form
 * @param typeIndex - Type information for anchors
 * @returns Fast path result
 */
export function matchFastPath(
  canonical: string,
  tokens: Token[],
  typeIndex: TypeIndex
): FastPathResult {
  // 1. Extract anchor from tokens
  const anchor = extractAnchor(tokens);
  if (!anchor) {
    return { matched: false, pattern: null, fragment: null, confidence: 0 };
  }

  // 2. Get type info for anchor
  const resolvedType = typeIndex[anchor];
  const baseKind = resolvedType?.baseKind;

  // 3. Select applicable patterns
  const patterns = selectPatterns(baseKind);

  // 4. Try each pattern
  for (const pattern of patterns) {
    const match = pattern.match(canonical, tokens);
    if (match.matched && match.anchor && match.expr) {
      return {
        matched: true,
        pattern: pattern.name,
        fragment: buildFragment(match, canonical),
        confidence: 1.0,
      };
    }
  }

  // No pattern matched
  return { matched: false, pattern: null, fragment: null, confidence: 0 };
}
