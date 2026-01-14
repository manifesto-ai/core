/**
 * @fileoverview S3: Canonicalize Stage
 *
 * Canonicalizes IntentIR and derives simKey (SimHash).
 * Deterministic stage.
 * Aligned with SPEC §5.3 and §6.3.
 */

import {
  canonicalizeSemantic,
  deriveSimKey,
  toSemanticCanonicalString,
  type IntentIR,
} from "@manifesto-ai/intent-ir";
import { serializeSimKey, type SimKey } from "../keys/index.js";
import type { SimKeyHex } from "../types/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Canonicalize stage result
 */
export type CanonicalizeResult = {
  /** Canonicalized IntentIR */
  readonly canonical: IntentIR;
  /** SimKey as bigint */
  readonly simKey: SimKey;
  /** SimKey as hex string */
  readonly simKeyHex: SimKeyHex;
  /** Hash before canonicalization */
  readonly beforeHash: string;
  /** Hash after canonicalization */
  readonly afterHash: string;
};

/**
 * Canonicalize trace output
 */
export type CanonicalizeTrace = {
  readonly beforeHash: string;
  readonly afterHash: string;
  readonly simKey: SimKeyHex;
};

// =============================================================================
// Hash Computation
// =============================================================================

/**
 * Compute hash of IntentIR using canonical string representation
 */
function hashIR(ir: IntentIR): string {
  const canonical = toSemanticCanonicalString(ir);
  return simpleHash(canonical);
}

/**
 * Simple string hash (FNV-1a style)
 * Not cryptographic, just for comparison
 */
function simpleHash(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// =============================================================================
// Stage Implementation
// =============================================================================

/**
 * S3: Canonicalize IntentIR and derive simKey
 *
 * TAPP-PIPE-1: This stage is deterministic.
 * TAPP-KEY-5: simKey derived via deriveSimKey().
 *
 * @param ir - IntentIR from S2 (propose stage)
 * @returns CanonicalizeResult
 */
export function canonicalize(ir: IntentIR): CanonicalizeResult {
  // Compute hash before canonicalization
  const beforeHash = hashIR(ir);

  // Canonicalize using Intent IR SPEC rules
  const canonical = canonicalizeSemantic(ir);

  // Compute hash after canonicalization
  const afterHash = hashIR(canonical);

  // Derive simKey (SimHash for semantic proximity)
  const simKey = deriveSimKey(canonical);
  const simKeyHex = serializeSimKey(simKey);

  return {
    canonical,
    simKey,
    simKeyHex,
    beforeHash,
    afterHash,
  };
}

/**
 * Create canonicalize trace from result
 */
export function createCanonicalizeTrace(
  result: CanonicalizeResult
): CanonicalizeTrace {
  return {
    beforeHash: result.beforeHash,
    afterHash: result.afterHash,
    simKey: result.simKeyHex,
  };
}

/**
 * Check if two IntentIRs are semantically equivalent
 * (Same canonical form)
 */
export function areSemanticallySame(ir1: IntentIR, ir2: IntentIR): boolean {
  const canonical1 = toSemanticCanonicalString(canonicalizeSemantic(ir1));
  const canonical2 = toSemanticCanonicalString(canonicalizeSemantic(ir2));
  return canonical1 === canonical2;
}
