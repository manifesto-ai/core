/**
 * Level 1: Posterior Consistency Authority
 *
 * For tasks with hidden state requiring belief.
 * Verification is consistency-based: can prove incorrect but NOT correct.
 * Per SPEC Section 7.1.
 */
import type { LevelAuthorityHandler, LevelAuthorityOptions } from "../types.js";
/**
 * Create a Level 1 consistency authority.
 *
 * @param options - Authority options
 * @returns LevelAuthorityHandler for Level 1
 */
export declare function createConsistencyAuthority(options?: LevelAuthorityOptions): LevelAuthorityHandler;
//# sourceMappingURL=consistency.d.ts.map