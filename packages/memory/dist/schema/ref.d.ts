/**
 * Memory Reference Schema
 *
 * Defines the MemoryRef type - a reference to a past World.
 * WorldId is OPAQUE. This specification does not define its format.
 *
 * @see SPEC-1.2v §5.1.1
 */
import { z } from "zod";
/**
 * Reference to a past World.
 *
 * Constraints:
 * - worldId MUST be a valid WorldId as defined in World Protocol
 * - This specification makes NO assumptions about WorldId internal structure
 * - WorldId MUST NOT be parsed or decomposed by Memory implementations
 */
export declare const MemoryRef: z.ZodObject<{
    worldId: z.core.$ZodBranded<z.ZodString, "WorldId">;
}, z.core.$strip>;
export type MemoryRef = z.infer<typeof MemoryRef>;
/**
 * Helper to create a MemoryRef
 */
export declare function createMemoryRef(worldId: string): MemoryRef;
//# sourceMappingURL=ref.d.ts.map