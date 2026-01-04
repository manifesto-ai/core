/**
 * Memory Store Interface
 *
 * Defines the interface for persisting and retrieving Worlds.
 * Applications MUST implement this interface (M-5).
 *
 * @see SPEC-1.2v §6.1
 */
import type { World, WorldId } from "@manifesto-ai/world";
/**
 * Interface for memory storage operations.
 *
 * Applications MUST provide MemoryStore implementation (M-5).
 *
 * Example implementations:
 * - PostgreSQL database
 * - Redis cache
 * - IPFS content store
 * - In-memory Map (for testing)
 *
 * Module Access:
 * - Actor: ✅ Full access
 * - Projection: ❌ Forbidden
 * - Authority: ❌ Forbidden
 * - Host: ❌ Forbidden
 * - Core: ❌ Forbidden
 */
export interface MemoryStore {
    /**
     * Retrieve a World by its ID.
     *
     * @param worldId - The World identifier to retrieve
     * @returns The World if found, null otherwise
     */
    get(worldId: WorldId): Promise<World | null>;
    /**
     * Check if a World exists in the store.
     *
     * @param worldId - The World identifier to check
     * @returns true if the World exists, false otherwise
     */
    exists(worldId: WorldId): Promise<boolean>;
}
//# sourceMappingURL=store.d.ts.map