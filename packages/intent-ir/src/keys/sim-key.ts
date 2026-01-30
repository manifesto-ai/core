/**
 * @fileoverview SimKey Derivation (SPEC Section 12.4)
 *
 * simKey is for similarity search using SimHash.
 * Tokens extracted from semantic-canonicalized IR.
 */

import type { IntentIR, Term, Pred } from "../schema/index.js";
import { canonicalizeSemantic } from "../canonical/index.js";

/**
 * Derive simKey for similarity search.
 *
 * Uses SimHash algorithm on tokens extracted from semantic-canonicalized IR.
 *
 * @example
 * const key = deriveSimKey(ir);
 * // Use for finding similar intents, clustering, recommendations
 */
export function deriveSimKey(ir: IntentIR): bigint {
  const canonicalIR = canonicalizeSemantic(ir);
  const tokens = extractTokens(canonicalIR);
  return simhash(tokens);
}

/**
 * Extract tokens from IntentIR for SimHash.
 *
 * Tokens include:
 * - force
 * - event.lemma
 * - event.class
 * - Each arg role and its term tokens
 * - Each condition predicate tokens
 * - modality, time, verify, output specs
 */
function extractTokens(ir: IntentIR): string[] {
  const tokens: string[] = [];

  // Force
  tokens.push(`force:${ir.force}`);

  // Event
  tokens.push(`lemma:${ir.event.lemma}`);
  tokens.push(`class:${ir.event.class}`);

  // Args
  for (const [role, term] of Object.entries(ir.args)) {
    if (term) {
      tokens.push(`role:${role}`);
      tokens.push(...extractTermTokens(term, role));
    }
  }

  // Conditions
  if (ir.cond) {
    for (const pred of ir.cond) {
      tokens.push(...extractPredTokens(pred));
    }
  }

  // Modality
  if (ir.mod) {
    tokens.push(`mod:${ir.mod}`);
  }

  // Time
  if (ir.time) {
    tokens.push(`time:${ir.time.kind}`);
  }

  // Verify
  if (ir.verify) {
    tokens.push(`verify:${ir.verify.mode}`);
  }

  // Output
  if (ir.out) {
    tokens.push(`out:${ir.out.type}`);
    if (ir.out.format) {
      tokens.push(`outfmt:${ir.out.format}`);
    }
  }

  return tokens;
}

/**
 * Extract tokens from a Term.
 */
function extractTermTokens(term: Term, prefix: string): string[] {
  const tokens: string[] = [];

  tokens.push(`${prefix}.kind:${term.kind}`);

  switch (term.kind) {
    case "entity":
      tokens.push(`${prefix}.entityType:${term.entityType}`);
      if (term.ref) {
        tokens.push(`${prefix}.refKind:${term.ref.kind}`);
      }
      break;

    case "path":
      tokens.push(`${prefix}.path:${term.path}`);
      break;

    case "artifact":
      tokens.push(`${prefix}.artifactType:${term.artifactType}`);
      break;

    case "value":
      tokens.push(`${prefix}.valueType:${term.valueType}`);
      // Extract shape keys as tokens
      for (const [key, value] of Object.entries(term.shape)) {
        tokens.push(`${prefix}.shape.${key}:${String(value)}`);
      }
      break;

    case "expr":
      tokens.push(`${prefix}.exprType:${term.exprType}`);
      break;

    case "list": {
      if (term.ordered === true) {
        tokens.push(`${prefix}.ordered:true`);
      }
      term.items.forEach((item, index) => {
        const itemPrefix =
          term.ordered === true ? `${prefix}.item${index}` : `${prefix}.item`;
        tokens.push(...extractTermTokens(item, itemPrefix));
      });
      break;
    }
  }

  return tokens;
}

/**
 * Extract tokens from a Predicate.
 */
function extractPredTokens(pred: Pred): string[] {
  const tokens: string[] = [];

  tokens.push(`cond.lhs:${pred.lhs}`);
  tokens.push(`cond.op:${pred.op}`);
  tokens.push(...extractTermTokens(pred.rhs, "cond.rhs"));

  return tokens;
}

// =============================================================================
// SimHash Implementation
// =============================================================================

/**
 * Compute SimHash from tokens.
 *
 * SimHash is a locality-sensitive hash that produces similar hashes
 * for similar inputs. Useful for near-duplicate detection.
 *
 * Algorithm:
 * 1. Hash each token to 64-bit value
 * 2. For each bit position, accumulate +1 or -1 based on bit value
 * 3. Final hash: 1 if accumulator > 0, else 0
 */
function simhash(tokens: string[]): bigint {
  const HASH_BITS = 64;
  const accumulators = new Array<number>(HASH_BITS).fill(0);

  for (const token of tokens) {
    const hash = hashToken(token);

    for (let i = 0; i < HASH_BITS; i++) {
      // Check bit i of hash
      if ((hash >> BigInt(i)) & 1n) {
        accumulators[i] += 1;
      } else {
        accumulators[i] -= 1;
      }
    }
  }

  // Build final hash
  let result = 0n;
  for (let i = 0; i < HASH_BITS; i++) {
    if (accumulators[i] > 0) {
      result |= 1n << BigInt(i);
    }
  }

  return result;
}

/**
 * Hash a token to 64-bit value using FNV-1a algorithm.
 */
function hashToken(token: string): bigint {
  // FNV-1a parameters for 64-bit
  const FNV_PRIME = 0x100000001b3n;
  const FNV_OFFSET = 0xcbf29ce484222325n;

  let hash = FNV_OFFSET;

  for (let i = 0; i < token.length; i++) {
    hash ^= BigInt(token.charCodeAt(i));
    hash = (hash * FNV_PRIME) & 0xffffffffffffffffn; // Keep 64 bits
  }

  return hash;
}

/**
 * Compute Hamming distance between two SimHash values.
 *
 * Lower distance = more similar.
 */
export function simhashDistance(a: bigint, b: bigint): number {
  const xor = a ^ b;
  let count = 0;

  // Count set bits (popcount)
  let x = xor;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }

  return count;
}
