/**
 * Level Authority Factory
 *
 * Creates level-appropriate authority handlers.
 * Per SPEC Section 7.
 */

import type { NecessityLevel, LevelAuthorityHandler, LevelAuthorityOptions } from "../types.js";
import { createDeterministicAuthority } from "./deterministic.js";
import { createConsistencyAuthority } from "./consistency.js";
import { createSemanticAuditAuthority } from "./semantic-audit.js";
import { createConfirmationAuthority } from "./confirmation.js";

/**
 * Create a level-appropriate authority handler.
 *
 * @param level - The necessity level (0-3)
 * @param options - Authority options
 * @returns A LevelAuthorityHandler appropriate for the level
 *
 * @example
 * ```typescript
 * const authority = createLevelAuthority(1, {
 *   hitlController: labWorld.hitl,
 *   confidenceThreshold: 0.8,
 * });
 *
 * world.bindAuthority('llm-actor', 'level-1-authority', authority);
 * ```
 */
export function createLevelAuthority(
  level: NecessityLevel,
  options?: LevelAuthorityOptions
): LevelAuthorityHandler {
  switch (level) {
    case 0:
      return createDeterministicAuthority(options);
    case 1:
      return createConsistencyAuthority(options);
    case 2:
      return createSemanticAuditAuthority(options);
    case 3:
      return createConfirmationAuthority(options);
    default:
      // Type guard - should never happen
      throw new Error(`Invalid necessity level: ${level}`);
  }
}
