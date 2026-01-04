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
export class InMemoryStore {
    worlds = new Map();
    /**
     * Store a World in memory.
     *
     * @param world - The World to store
     */
    put(world) {
        this.worlds.set(world.worldId, world);
    }
    /**
     * Retrieve a World by its ID.
     *
     * @param worldId - The World identifier to retrieve
     * @returns The World if found, null otherwise
     */
    async get(worldId) {
        return this.worlds.get(worldId) ?? null;
    }
    /**
     * Check if a World exists in the store.
     *
     * @param worldId - The World identifier to check
     * @returns true if the World exists
     */
    async exists(worldId) {
        return this.worlds.has(worldId);
    }
    /**
     * Remove a World from the store.
     *
     * @param worldId - The World identifier to remove
     * @returns true if the World was removed
     */
    delete(worldId) {
        return this.worlds.delete(worldId);
    }
    /**
     * Clear all Worlds from the store.
     */
    clear() {
        this.worlds.clear();
    }
    /**
     * Get the number of Worlds in the store.
     */
    get size() {
        return this.worlds.size;
    }
    /**
     * Get all World IDs in the store.
     */
    keys() {
        return this.worlds.keys();
    }
    /**
     * Get all Worlds in the store.
     */
    values() {
        return this.worlds.values();
    }
}
/**
 * Factory function to create an InMemoryStore.
 */
export function createInMemoryStore() {
    return new InMemoryStore();
}
//# sourceMappingURL=memory-store.js.map