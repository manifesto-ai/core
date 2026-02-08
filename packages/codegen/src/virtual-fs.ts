import type { Diagnostic, FilePatch } from "./types.js";

type FileEntry = {
  content: string;
  source: string; // plugin name that set the file
};

/**
 * Virtual filesystem for composing FilePatch operations.
 *
 * Maintains an in-memory FS and detects collisions per FP-5, FP-6, FP-7.
 * Paths are assumed to be already validated/normalized.
 */
export class VirtualFS {
  private readonly files = new Map<string, FileEntry>();
  private readonly deleted = new Set<string>();

  /**
   * Apply a FilePatch to the virtual FS.
   * Returns a Diagnostic if a collision/warning condition is detected.
   */
  applyPatch(patch: FilePatch, pluginName: string): Diagnostic | undefined {
    if (patch.op === "set") {
      return this.applySet(patch.path, patch.content, pluginName);
    }
    return this.applyDelete(patch.path, pluginName);
  }

  private applySet(path: string, content: string, pluginName: string): Diagnostic | undefined {
    const existing = this.files.get(path);

    if (existing) {
      // FP-5: Duplicate set on same path -> error
      const samePlugin = existing.source === pluginName;
      return {
        level: "error",
        plugin: pluginName,
        message: samePlugin
          ? `Duplicate set on "${path}" within plugin "${pluginName}"`
          : `File "${path}" already set by plugin "${existing.source}", cannot be set again by "${pluginName}"`,
      };
    }

    // delete-then-set is allowed (intentional regeneration)
    this.deleted.delete(path);
    this.files.set(path, { content, source: pluginName });
    return undefined;
  }

  private applyDelete(path: string, pluginName: string): Diagnostic | undefined {
    const existing = this.files.get(path);

    if (!existing && !this.deleted.has(path)) {
      // FP-7: Delete on nonexistent path -> warn
      return {
        level: "warn",
        plugin: pluginName,
        message: `Delete on nonexistent path "${path}"`,
      };
    }

    if (existing) {
      // FP-6: set-then-delete -> allowed with warning
      this.files.delete(path);
      this.deleted.add(path);
      return {
        level: "warn",
        plugin: pluginName,
        message: `File "${path}" set by plugin "${existing.source}" is being deleted by "${pluginName}". Prior work is voided.`,
      };
    }

    // Already deleted - just track it
    this.deleted.add(path);
    return undefined;
  }

  /**
   * Get all files in deterministic (lexicographic) order (DET-5).
   */
  getFiles(): Array<{ path: string; content: string }> {
    const entries = Array.from(this.files.entries());
    entries.sort(([a], [b]) => a.localeCompare(b));
    return entries.map(([path, { content }]) => ({ path, content }));
  }

  has(path: string): boolean {
    return this.files.has(path);
  }
}
