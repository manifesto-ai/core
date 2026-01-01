/**
 * Fast Path Pattern Definitions
 * Based on SPEC v2.0 Section 8
 */

import type {
  Token,
  ResolvedType,
  ExprNode,
  FastPathPatternName,
  PatchFragment,
  FragmentConstraint,
} from "../types/index.js";

/** Pattern match result */
export interface PatternMatchResult {
  matched: boolean;
  anchor?: string;
  expr?: ExprNode;
  description?: string;
}

/** Pattern definition */
export interface Pattern {
  name: FastPathPatternName;
  /** Base kinds this pattern applies to (empty = all types) */
  applicableKinds: ReadonlyArray<ResolvedType["baseKind"]> | "all";
  /** Match the canonical text and tokens */
  match(canonical: string, tokens: Token[]): PatternMatchResult;
}

// ============ Helper Functions ============

function extractAnchorFromTokens(tokens: Token[]): string | null {
  if (tokens.length === 0) return null;
  // First token is typically the anchor (e.g., "User.age")
  const firstToken = tokens[0].normalized;
  // Check if it looks like a path (contains a dot or is a valid identifier)
  if (/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(firstToken)) {
    return firstToken;
  }
  return null;
}

function parseNumber(str: string): number | null {
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function createExprCall(fn: string, args: ExprNode[]): ExprNode {
  return { kind: "call", fn, args };
}

function createExprGet(path: string): ExprNode {
  return { kind: "get", path: { kind: "name", name: path } };
}

function createExprLit(value: unknown): ExprNode {
  return { kind: "lit", value: value as null | boolean | number | string };
}

// ============ Pattern Implementations ============

/**
 * Comparator Pattern: <anchor> <op> <number>
 * Operators: gte, lte, gt, lt, eq, neq
 */
export const COMPARATOR_PATTERN: Pattern = {
  name: "comparator",
  applicableKinds: ["number"],
  match(canonical: string, tokens: Token[]): PatternMatchResult {
    // Pattern: anchor op number
    if (tokens.length < 3) return { matched: false };

    const anchor = extractAnchorFromTokens(tokens);
    if (!anchor) return { matched: false };

    const opToken = tokens[1]?.normalized?.toLowerCase();
    const validOps = ["gte", "lte", "gt", "lt", "eq", "neq", ">=", "<=", ">", "<", "==", "!="];
    if (!validOps.includes(opToken)) return { matched: false };

    const numStr = tokens[2]?.normalized;
    const num = parseNumber(numStr);
    if (num === null) return { matched: false };

    // Normalize operator
    const opMap: Record<string, string> = {
      ">=": "gte",
      "<=": "lte",
      ">": "gt",
      "<": "lt",
      "==": "eq",
      "!=": "neq",
    };
    const normalizedOp = opMap[opToken] || opToken;

    const expr = createExprCall(normalizedOp, [
      createExprGet(anchor),
      createExprLit(num),
    ]);

    return {
      matched: true,
      anchor,
      expr,
      description: `${anchor} ${normalizedOp} ${num}`,
    };
  },
};

/**
 * Range Pattern: <anchor> between <min> and <max>
 */
export const RANGE_PATTERN: Pattern = {
  name: "range",
  applicableKinds: ["number"],
  match(canonical: string, tokens: Token[]): PatternMatchResult {
    // Pattern: anchor between min and max
    if (tokens.length < 5) return { matched: false };

    const anchor = extractAnchorFromTokens(tokens);
    if (!anchor) return { matched: false };

    if (tokens[1]?.normalized?.toLowerCase() !== "between") return { matched: false };

    const minStr = tokens[2]?.normalized;
    const min = parseNumber(minStr);
    if (min === null) return { matched: false };

    if (tokens[3]?.normalized?.toLowerCase() !== "and") return { matched: false };

    const maxStr = tokens[4]?.normalized;
    const max = parseNumber(maxStr);
    if (max === null) return { matched: false };

    // Validate min <= max
    if (min > max) return { matched: false };

    // between is: and(gte(x, min), lte(x, max))
    const expr = createExprCall("and", [
      createExprCall("gte", [createExprGet(anchor), createExprLit(min)]),
      createExprCall("lte", [createExprGet(anchor), createExprLit(max)]),
    ]);

    return {
      matched: true,
      anchor,
      expr,
      description: `${anchor} between ${min} and ${max}`,
    };
  },
};

/**
 * Length Pattern: <anchor> minLen/maxLen <number>
 */
export const LENGTH_PATTERN: Pattern = {
  name: "length",
  applicableKinds: ["string", "array"],
  match(canonical: string, tokens: Token[]): PatternMatchResult {
    // Pattern: anchor minLen/maxLen number
    if (tokens.length < 3) return { matched: false };

    const anchor = extractAnchorFromTokens(tokens);
    if (!anchor) return { matched: false };

    const opToken = tokens[1]?.normalized?.toLowerCase();
    if (opToken !== "minlen" && opToken !== "maxlen") return { matched: false };

    const numStr = tokens[2]?.normalized;
    const num = parseNumber(numStr);
    if (num === null || num < 0) return { matched: false };

    // minLen -> gte(len(x), n), maxLen -> lte(len(x), n)
    const compareOp = opToken === "minlen" ? "gte" : "lte";
    const expr = createExprCall(compareOp, [
      createExprCall("len", [createExprGet(anchor)]),
      createExprLit(num),
    ]);

    return {
      matched: true,
      anchor,
      expr,
      description: `${anchor} ${opToken} ${num}`,
    };
  },
};

/**
 * Inclusion Pattern: <anchor> in/notIn [<values>]
 */
export const INCLUSION_PATTERN: Pattern = {
  name: "inclusion",
  applicableKinds: "all",
  match(canonical: string, tokens: Token[]): PatternMatchResult {
    // Pattern: anchor in/notIn [values]
    if (tokens.length < 3) return { matched: false };

    const anchor = extractAnchorFromTokens(tokens);
    if (!anchor) return { matched: false };

    const opToken = tokens[1]?.normalized?.toLowerCase();
    if (opToken !== "in" && opToken !== "notin") return { matched: false };

    // Extract values from remaining tokens
    // They may be formatted as "[val1,", "val2,", "val3]" or "[val1, val2, val3]"
    const valuesText = tokens.slice(2).map((t) => t.normalized).join(" ");
    const valuesMatch = valuesText.match(/\[(.*?)\]/);
    if (!valuesMatch) return { matched: false };

    const valuesStr = valuesMatch[1];
    const values = valuesStr
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .map((v) => {
        // Try to parse as number, otherwise keep as string
        const num = parseNumber(v);
        return num !== null ? num : v;
      });

    if (values.length === 0) return { matched: false };

    // in -> includes(values, x), notIn -> not(includes(values, x))
    const valuesExpr: ExprNode = { kind: "arr", elements: values.map((v) => createExprLit(v)) };
    const includesExpr = createExprCall("includes", [valuesExpr, createExprGet(anchor)]);
    const expr = opToken === "notin" ? createExprCall("not", [includesExpr]) : includesExpr;

    return {
      matched: true,
      anchor,
      expr,
      description: `${anchor} ${opToken} [${values.join(", ")}]`,
    };
  },
};

/**
 * Required Pattern: <anchor> required/optional
 */
export const REQUIRED_PATTERN: Pattern = {
  name: "required",
  applicableKinds: "all",
  match(canonical: string, tokens: Token[]): PatternMatchResult {
    // Pattern: anchor required/optional
    if (tokens.length < 2) return { matched: false };

    const anchor = extractAnchorFromTokens(tokens);
    if (!anchor) return { matched: false };

    const opToken = tokens[1]?.normalized?.toLowerCase();
    if (opToken !== "required" && opToken !== "optional") return { matched: false };

    // required -> isNotNull(x), optional -> or(isNull(x), isNotNull(x)) (always true, but marks field as optional)
    const expr =
      opToken === "required"
        ? createExprCall("not", [createExprCall("isNull", [createExprGet(anchor)])])
        : createExprLit(true); // optional is just a marker

    return {
      matched: true,
      anchor,
      expr,
      description: `${anchor} ${opToken}`,
    };
  },
};

/**
 * Boolean Pattern: <anchor> must be true/false
 */
export const BOOLEAN_PATTERN: Pattern = {
  name: "boolean",
  applicableKinds: ["boolean"],
  match(canonical: string, tokens: Token[]): PatternMatchResult {
    // Pattern: anchor must be true/false
    if (tokens.length < 4) return { matched: false };

    const anchor = extractAnchorFromTokens(tokens);
    if (!anchor) return { matched: false };

    if (tokens[1]?.normalized?.toLowerCase() !== "must") return { matched: false };
    if (tokens[2]?.normalized?.toLowerCase() !== "be") return { matched: false };

    const valueToken = tokens[3]?.normalized?.toLowerCase();
    if (valueToken !== "true" && valueToken !== "false") return { matched: false };

    const boolValue = valueToken === "true";

    // must be true -> eq(x, true), must be false -> eq(x, false)
    const expr = createExprCall("eq", [createExprGet(anchor), createExprLit(boolValue)]);

    return {
      matched: true,
      anchor,
      expr,
      description: `${anchor} must be ${valueToken}`,
    };
  },
};

/** All patterns in priority order */
export const ALL_PATTERNS: readonly Pattern[] = [
  COMPARATOR_PATTERN,
  RANGE_PATTERN,
  LENGTH_PATTERN,
  INCLUSION_PATTERN,
  REQUIRED_PATTERN,
  BOOLEAN_PATTERN,
];

/** Select applicable patterns for a given base kind */
export function selectPatterns(baseKind: ResolvedType["baseKind"] | undefined): Pattern[] {
  return ALL_PATTERNS.filter((pattern) => {
    if (pattern.applicableKinds === "all") return true;
    if (!baseKind) return false; // Unknown type - only allow "all" patterns
    return pattern.applicableKinds.includes(baseKind);
  });
}
