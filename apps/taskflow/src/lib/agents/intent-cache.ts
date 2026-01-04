/**
 * Intent Cache
 *
 * Caches LLM-generated intents and effects for similar instructions.
 * Schema version changes invalidate the cache automatically.
 */

import type { AgentEffect } from './types';
import { SCHEMA_VERSION } from './prompts/schema';

/**
 * Normalized intent for caching
 */
export interface NormalizedIntent {
  type: 'create' | 'mutate' | 'view' | 'query' | 'multi';
  slots: {
    viewMode?: 'kanban' | 'table' | 'todo';
    dateFilterType?: 'today' | 'week' | 'month' | 'custom' | 'clear';
    status?: 'todo' | 'in-progress' | 'review' | 'done';
    priority?: 'low' | 'medium' | 'high';
    taskTitle?: string;
    taskRef?: string;
  };
}

/**
 * Cached entry structure
 */
export interface CacheEntry {
  intent: NormalizedIntent;
  effects: AgentEffect[];
  message: string;
  createdAt: number;
  hitCount: number;
  schemaVersion: string;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
  schemaVersion: string;
}

/**
 * In-memory intent cache with schema version support
 */
class IntentCacheImpl {
  private cache: Map<string, CacheEntry> = new Map();
  private hits = 0;
  private misses = 0;
  private currentSchemaVersion = SCHEMA_VERSION;

  /**
   * Generate cache key from intent type and slots
   */
  private getCacheKey(intent: NormalizedIntent): string {
    // Sort slots for consistent key generation
    const sortedSlots = Object.keys(intent.slots)
      .sort()
      .reduce((acc, key) => {
        const k = key as keyof typeof intent.slots;
        if (intent.slots[k] !== undefined) {
          acc[k] = intent.slots[k];
        }
        return acc;
      }, {} as Record<string, unknown>);

    return `${this.currentSchemaVersion}:${intent.type}:${JSON.stringify(sortedSlots)}`;
  }

  /**
   * Normalize an instruction to an intent pattern
   * This is a simplified version - in production, you might use more sophisticated NLP
   */
  normalizeInstruction(instruction: string): NormalizedIntent | null {
    const normalized = instruction.toLowerCase().trim();

    // View mode patterns
    if (/칸반|kanban|board/i.test(normalized)) {
      return {
        type: 'view',
        slots: { viewMode: 'kanban' },
      };
    }
    if (/테이블|table|list/i.test(normalized)) {
      return {
        type: 'view',
        slots: { viewMode: 'table' },
      };
    }
    if (/투두|todo|checklist/i.test(normalized)) {
      return {
        type: 'view',
        slots: { viewMode: 'todo' },
      };
    }

    // Date filter patterns
    if (/오늘|today/i.test(normalized)) {
      return {
        type: 'view',
        slots: { dateFilterType: 'today' },
      };
    }
    if (/이번\s*주|this\s*week/i.test(normalized)) {
      return {
        type: 'view',
        slots: { dateFilterType: 'week' },
      };
    }

    // Clear filter patterns
    if (/모든|all|clear|show\s*all/i.test(normalized)) {
      return {
        type: 'view',
        slots: { dateFilterType: 'clear' },
      };
    }

    // Query patterns
    if (/몇\s*개|how\s*many|count/i.test(normalized)) {
      return {
        type: 'query',
        slots: {},
      };
    }
    if (/요약|summarize|summary/i.test(normalized)) {
      return {
        type: 'query',
        slots: {},
      };
    }

    // Can't normalize - too specific or complex
    return null;
  }

  /**
   * Get a cached entry if it exists and is valid
   */
  get(instruction: string): CacheEntry | null {
    const intent = this.normalizeInstruction(instruction);
    if (!intent) {
      this.misses++;
      return null;
    }

    const key = this.getCacheKey(intent);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check schema version
    if (entry.schemaVersion !== this.currentSchemaVersion) {
      // Invalidate stale entry
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update hit count
    entry.hitCount++;
    this.hits++;
    return entry;
  }

  /**
   * Store an entry in the cache
   */
  set(
    instruction: string,
    effects: AgentEffect[],
    message: string
  ): void {
    const intent = this.normalizeInstruction(instruction);
    if (!intent) {
      // Can't cache non-normalizable instructions
      return;
    }

    const key = this.getCacheKey(intent);
    this.cache.set(key, {
      intent,
      effects,
      message,
      createdAt: Date.now(),
      hitCount: 0,
      schemaVersion: this.currentSchemaVersion,
    });
  }

  /**
   * Clear all entries (useful for testing or schema updates)
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Clear entries matching a specific schema version
   */
  clearVersion(version: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.schemaVersion === version) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      totalEntries: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      schemaVersion: this.currentSchemaVersion,
    };
  }

  /**
   * Update schema version (clears cache)
   */
  updateSchemaVersion(newVersion: string): void {
    if (newVersion !== this.currentSchemaVersion) {
      this.currentSchemaVersion = newVersion;
      this.clear();
    }
  }

  /**
   * Get all entries for debugging
   */
  getEntries(): Map<string, CacheEntry> {
    return new Map(this.cache);
  }
}

/**
 * Singleton intent cache instance
 */
export const intentCache = new IntentCacheImpl();

/**
 * Try to get cached effects for an instruction
 *
 * @param instruction - User's instruction
 * @returns Cached entry if found, null otherwise
 */
export function tryCache(instruction: string): CacheEntry | null {
  return intentCache.get(instruction);
}

/**
 * Store effects in cache for an instruction
 *
 * @param instruction - User's instruction
 * @param effects - Effects generated by the agent
 * @param message - Response message
 */
export function cacheEffects(
  instruction: string,
  effects: AgentEffect[],
  message: string
): void {
  intentCache.set(instruction, effects, message);
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): CacheStats {
  return intentCache.getStats();
}

/**
 * Clear the cache
 */
export function clearCache(): void {
  intentCache.clear();
}
