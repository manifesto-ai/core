/**
 * withLab - Main Lab Wrapper
 *
 * Wraps a ManifestoWorld with Lab capabilities for observation,
 * tracing, HITL intervention, and projection.
 *
 * Per FDR-N009: withLab higher-order function pattern.
 * Per FDR-N010: World Events as observation channel.
 * Per FDR-N011: Lab as Observer, Not Participant.
 */
import type { ManifestoWorld } from "@manifesto-ai/world";
import type { LabOptions, LabWorld } from "../types.js";
/**
 * Wrap a ManifestoWorld with Lab capabilities.
 *
 * @param world - The ManifestoWorld to wrap
 * @param options - Lab configuration options
 * @returns A LabWorld with observation and tracing capabilities
 *
 * @example
 * ```typescript
 * const world = createManifestoWorld({ schemaHash, host });
 *
 * const labWorld = withLab(world, {
 *   runId: 'exp-001',
 *   necessityLevel: 1,
 *   outputPath: './traces',
 *   projection: { enabled: true, mode: 'interactive' },
 *   hitl: { enabled: true, timeout: 300000 },
 * });
 *
 * await labWorld.submitProposal(...);
 * const trace = labWorld.trace();
 * ```
 */
export declare function withLab(world: ManifestoWorld, options: LabOptions): LabWorld;
//# sourceMappingURL=with-lab.d.ts.map