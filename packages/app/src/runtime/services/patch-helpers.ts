/**
 * Patch Helpers Implementation
 *
 * Provides convenient methods for creating Patch objects.
 *
 * @see SPEC §13.2
 * @module
 */

import type { Patch, PatchHelpers } from "../../core/types/index.js";

/**
 * Create a PatchHelpers instance.
 */
export function createPatchHelpers(): PatchHelpers {
  return {
    /**
     * Create a set patch.
     */
    set(path: string, value: unknown): Patch {
      return { op: "set", path, value };
    },

    /**
     * Create a merge patch.
     */
    merge(path: string, value: Record<string, unknown>): Patch {
      return { op: "merge", path, value };
    },

    /**
     * Create an unset patch.
     */
    unset(path: string): Patch {
      return { op: "unset", path };
    },

    /**
     * Combine multiple patches into a flat array.
     */
    many(...patches: readonly (Patch | readonly Patch[])[]): Patch[] {
      const result: Patch[] = [];
      for (const p of patches) {
        if (Array.isArray(p)) {
          result.push(...p);
        } else {
          result.push(p as Patch);
        }
      }
      return result;
    },

    /**
     * Create patches from a record.
     */
    from(
      record: Record<string, unknown>,
      opts?: { basePath?: string }
    ): Patch[] {
      const basePath = opts?.basePath ?? "";
      const patches: Patch[] = [];

      for (const [key, value] of Object.entries(record)) {
        const path = basePath ? `${basePath}.${key}` : key;
        patches.push({ op: "set", path, value });
      }

      return patches;
    },
  };
}
