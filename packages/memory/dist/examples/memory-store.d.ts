/**
 * In-Memory Store Implementation
 *
 * A simple in-memory implementation of MemoryStore for testing and development.
 * Uses a Map to store Worlds.
 *
 * NOT for production use - data is lost on restart.
 */
import type { World, WorldId } from "@manifesto-ai/world";
import type { MemoryStore } from "../interfaces/store.js";
/**
 * In-memory implementation of MemoryStore.
 *
 * Features:
 * - Simple Map-based storage
 * - O(1) lookups
 * - Not persistent (data lost on restart)
 *
 * Use cases:
 * - Unit testing
 * - Development/prototyping
 * - Examples and documentation
 */
export declare class InMemoryStore implements MemoryStore {
    private readonly worlds;
    /**
     * Store a World in memory.
     *
     * @param world - The World to store
     */
    put(world: World): void;
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
     * @returns true if the World exists
     */
    exists(worldId: WorldId): Promise<boolean>;
    /**
     * Remove a World from the store.
     *
     * @param worldId - The World identifier to remove
     * @returns true if the World was removed
     */
    delete(worldId: WorldId): boolean;
    /**
     * Clear all Worlds from the store.
     */
    clear(): void;
    /**
     * Get the number of Worlds in the store.
     */
    get size(): number;
    /**
     * Get all World IDs in the store.
     */
    keys(): IterableIterator<WorldId>;
    /**
     * Get all Worlds in the store.
     */
    values(): IterableIterator<World>;
}
/**
 * Factory function to create an InMemoryStore.
 */
export declare function createInMemoryStore(): InMemoryStore;
//# sourceMappingURL=memory-store.d.ts.map