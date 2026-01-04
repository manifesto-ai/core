/**
 * Trace Replay
 *
 * Replay Lab traces against a ManifestoWorld.
 * Added in v1.1.
 */
import type { LabTrace, ReplayOptions, ReplayResult, Divergence } from "../types.js";
/**
 * Replay a trace against a world.
 *
 * This re-executes the proposals from the original trace against the
 * provided world and compares the results.
 *
 * @param trace - The trace to replay
 * @param options - Replay options
 * @returns Replay result with comparison
 */
export declare function replay(trace: LabTrace, options: ReplayOptions): Promise<ReplayResult>;
/**
 * Create a partial replay (for debugging).
 *
 * @param trace - The trace to replay
 * @param upToSeq - Stop at this sequence number
 * @param options - Replay options
 * @returns Partial replay result
 */
export declare function replayPartial(trace: LabTrace, upToSeq: number, options: ReplayOptions): Promise<ReplayResult>;
/**
 * Find the first divergence point between two traces via replay.
 *
 * @param trace - The trace to replay
 * @param options - Replay options
 * @returns The first divergence or null if identical
 */
export declare function findFirstDivergence(trace: LabTrace, options: ReplayOptions): Promise<Divergence | null>;
//# sourceMappingURL=replay.d.ts.map