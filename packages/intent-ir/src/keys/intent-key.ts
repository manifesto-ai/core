/**
 * @fileoverview Intent Key Derivation (SPEC Section 12.2)
 *
 * intentKey is the protocol semantic identity.
 * Derived from IntentBody + schemaHash.
 */

import { sha256, sha256Sync, toJcs } from "@manifesto-ai/core";
import type { IntentBody } from "./types.js";

/**
 * Derive intentKey from IntentBody (async).
 *
 * Uses JCS array format to avoid delimiter collision risk.
 * Array format: [schemaHash, type, input, scopeProposal]
 *
 * @example
 * const key = await deriveIntentKey(body, schemaHash);
 */
export async function deriveIntentKey(
  body: IntentBody,
  schemaHash: string
): Promise<string> {
  const preimage = buildIntentKeyPreimage(body, schemaHash);
  return sha256(toJcs(preimage));
}

/**
 * Derive intentKey from IntentBody (sync).
 *
 * @example
 * const key = deriveIntentKeySync(body, schemaHash);
 */
export function deriveIntentKeySync(
  body: IntentBody,
  schemaHash: string
): string {
  const preimage = buildIntentKeyPreimage(body, schemaHash);
  return sha256Sync(toJcs(preimage));
}

/**
 * Build the preimage array for intentKey.
 *
 * MUST NOT include:
 * - origin (meta, not semantic)
 * - intentId (attempt identity, not semantic)
 * - Snapshot data (execution-time binding)
 */
function buildIntentKeyPreimage(
  body: IntentBody,
  schemaHash: string
): unknown[] {
  return [
    schemaHash,
    body.type,
    body.input ?? null,
    body.scopeProposal ?? null,
  ];
}
