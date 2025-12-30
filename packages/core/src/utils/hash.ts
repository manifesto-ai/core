import { toCanonical } from "./canonical.js";
import type { DomainSchema } from "../schema/domain.js";

/**
 * SHA-256 hash using Web Crypto API
 * Works in both browser and Node.js
 */
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);

  // Use Web Crypto API
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash a schema in canonical form
 */
export async function hashSchema(schema: Omit<DomainSchema, "hash">): Promise<string> {
  // Create canonical form without the hash field
  const canonical = toCanonical(schema);
  return sha256(canonical);
}

/**
 * Generate deterministic requirement ID
 * Based on: schemaHash, intentId, actionId, flowNodePath
 */
export async function generateRequirementId(
  schemaHash: string,
  intentId: string,
  actionId: string,
  flowNodePath: string
): Promise<string> {
  const input = `${schemaHash}:${intentId}:${actionId}:${flowNodePath}`;
  const hash = await sha256(input);
  // Return first 16 characters for brevity
  return `req-${hash.slice(0, 16)}`;
}

/**
 * Generate a trace node ID
 */
export function generateTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
