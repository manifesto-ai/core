import { z } from "zod";

/**
 * HostContext - Explicit host-provided inputs for determinism
 */
export const HostContext = z.object({
  /**
   * Logical time provided by Host
   */
  now: z.number(),

  /**
   * Deterministic random seed provided by Host
   */
  randomSeed: z.string(),

  /**
   * Optional host environment metadata
   */
  env: z.record(z.string(), z.unknown()).optional(),

  /**
   * Optional measured compute duration (ms)
   */
  durationMs: z.number().optional(),
});
export type HostContext = z.infer<typeof HostContext>;
