/**
 * @fileoverview Strict Key Derivation (SPEC Section 12.3)
 *
 * strictKey is for exact reproduction caching.
 * MUST be computed from ResolvedIntentIR (after reference resolution).
 */

import { sha256, sha256Sync, toJcs } from "@manifesto-ai/core";
import type { ResolvedIntentIR } from "../schema/index.js";
import { canonicalizeStrict } from "../canonical/index.js";
import type { ExecutionContext, Footprint, Snapshot } from "./types.js";

/**
 * Derive strictKey from ResolvedIntentIR (async).
 *
 * CRITICAL: Must use ResolvedIntentIR (after reference resolution).
 * Same resolved IR + same relevant state + same context = same result.
 *
 * @example
 * const key = await deriveStrictKey(resolvedIR, footprint, snapshot, context);
 */
export async function deriveStrictKey(
  resolvedIR: ResolvedIntentIR,
  footprint: Footprint,
  snapshot: Snapshot,
  context: ExecutionContext
): Promise<string> {
  const input = buildStrictKeyInput(resolvedIR, footprint, snapshot, context);
  return sha256(toJcs(input));
}

/**
 * Derive strictKey from ResolvedIntentIR (sync).
 */
export function deriveStrictKeySync(
  resolvedIR: ResolvedIntentIR,
  footprint: Footprint,
  snapshot: Snapshot,
  context: ExecutionContext
): string {
  const input = buildStrictKeyInput(resolvedIR, footprint, snapshot, context);
  return sha256Sync(toJcs(input));
}

/**
 * Build the input object for strictKey derivation.
 *
 * MUST include (for reproducibility):
 * - schemaHash: Domain schema fingerprint
 * - constitutionFP: Constitution/rules fingerprint
 * - invariantFP: Invariant constraints fingerprint
 * - ir: Strict-canonicalized resolved IR
 * - subsnapshot: State closure (reads ∪ depends ∪ verify ∪ policy)
 * - context: Environment, tenant, permissions, focus/discourse fingerprints
 */
function buildStrictKeyInput(
  resolvedIR: ResolvedIntentIR,
  footprint: Footprint,
  snapshot: Snapshot,
  context: ExecutionContext
): Record<string, unknown> {
  const canonicalIR = canonicalizeStrict(resolvedIR);

  // Full closure: reads + depends + verify + policy footprints
  const footprintClosure = new Set<string>([
    ...footprint.reads,
    ...footprint.depends,
    ...(footprint.verify ?? []),
    ...(footprint.policy ?? []),
  ]);

  const subsnapshot = extractSubsnapshot(snapshot, footprintClosure);

  // Set-semantic arrays MUST be sorted (NORMATIVE)
  const sortedPermissions = context.permissions
    ? [...context.permissions].sort()
    : undefined;

  return {
    schemaHash: context.schemaHash,
    constitutionFP: context.constitutionFingerprint ?? null,
    invariantFP: context.invariantFingerprint ?? null,
    ir: canonicalIR,
    subsnapshot,
    context: {
      env: context.env ?? null,
      tenant: context.tenant ?? null,
      permissions: sortedPermissions ?? null,
      focusFingerprint: context.focusFingerprint ?? null,
      discourseFingerprint: context.discourseFingerprint ?? null,
    },
  };
}

/**
 * Extract subsnapshot containing only the paths in the footprint closure.
 */
function extractSubsnapshot(
  snapshot: Snapshot,
  paths: Set<string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const path of paths) {
    const value = getValueAtPath(snapshot, path);
    if (value !== undefined) {
      result[path] = value;
    }
  }

  // Sort keys for determinism
  const sortedResult: Record<string, unknown> = {};
  for (const key of Object.keys(result).sort()) {
    sortedResult[key] = result[key];
  }

  return sortedResult;
}

/**
 * Get value at a dotted path from snapshot.
 */
function getValueAtPath(snapshot: Snapshot, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = snapshot;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
