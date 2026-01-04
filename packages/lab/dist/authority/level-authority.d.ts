/**
 * Level Authority Factory
 *
 * Creates level-appropriate authority handlers.
 * Per SPEC Section 7.
 */
import type { NecessityLevel, LevelAuthorityHandler, LevelAuthorityOptions } from "../types.js";
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
export declare function createLevelAuthority(level: NecessityLevel, options?: LevelAuthorityOptions): LevelAuthorityHandler;
//# sourceMappingURL=level-authority.d.ts.map