/**
 * Level 0: Deterministic Authority
 *
 * For tasks solvable without LLM.
 * Verification is deterministic: can prove correct AND incorrect.
 * Per SPEC Section 7.1.
 */
import type { LevelAuthorityHandler, LevelAuthorityOptions } from "../types.js";
/**
 * Create a Level 0 deterministic authority.
 *
 * @returns LevelAuthorityHandler for Level 0
 */
export declare function createDeterministicAuthority(_options?: LevelAuthorityOptions): LevelAuthorityHandler;
//# sourceMappingURL=deterministic.d.ts.map