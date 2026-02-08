import * as fs from "node:fs/promises";
import * as nodePath from "node:path";

import type {
  CodegenContext,
  CodegenPlugin,
  Diagnostic,
  GenerateOptions,
  GenerateResult,
} from "./types.js";
import { VirtualFS } from "./virtual-fs.js";
import { validatePath } from "./path-safety.js";
import { stableHash } from "./stable-hash.js";
import { generateHeader } from "./header.js";

/**
 * Generate typed artifacts from a DomainSchema using plugins.
 *
 * This is the sole entry point for codegen. It orchestrates:
 * - Plugin name uniqueness validation (GEN-2)
 * - Sequential plugin execution (GEN-3, GEN-7)
 * - FilePatch composition with collision detection
 * - Error gating (GEN-5, GEN-8)
 * - outDir clean + file flush (GEN-1)
 */
export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const diagnostics: Diagnostic[] = [];
  const allArtifacts: Record<string, unknown> = {};
  const vfs = new VirtualFS();

  // GEN-2: Validate plugin name uniqueness
  const nameError = validatePluginNames(opts.plugins);
  if (nameError) {
    return {
      files: [],
      artifacts: {},
      diagnostics: [nameError],
    };
  }

  // GEN-3, GEN-7: Execute plugins sequentially in array order
  for (const plugin of opts.plugins) {
    const ctx: CodegenContext = {
      schema: opts.schema,
      sourceId: opts.sourceId,
      outDir: opts.outDir,
      artifacts: Object.freeze({ ...allArtifacts }), // PLG-9: frozen snapshot
      helpers: { stableHash },
    };

    let output;
    try {
      output = await plugin.generate(ctx);
    } catch (err) {
      // Convert plugin exceptions to error diagnostics (errors as values)
      diagnostics.push({
        level: "error",
        plugin: plugin.name,
        message: `Plugin threw: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    // GEN-4: Merge plugin diagnostics
    if (output.diagnostics) {
      diagnostics.push(...output.diagnostics);
    }

    // Validate and apply patches
    for (const patch of output.patches) {
      const validation = validatePath(patch.path);
      if (!validation.valid) {
        diagnostics.push({
          level: "error",
          plugin: plugin.name,
          message: `Invalid path "${patch.path}": ${validation.reason}`,
        });
        continue;
      }

      // Apply with normalized path
      const normalizedPatch =
        patch.op === "set"
          ? { op: "set" as const, path: validation.normalized, content: patch.content }
          : { op: "delete" as const, path: validation.normalized };

      const collision = vfs.applyPatch(normalizedPatch, plugin.name);
      if (collision) {
        diagnostics.push(collision);
      }
    }

    // PLG-8: Store artifacts at allArtifacts[plugin.name]
    if (output.artifacts) {
      allArtifacts[plugin.name] = output.artifacts;
    }
  }

  // Collect files from VFS
  const files = vfs.getFiles();

  // GEN-5, GEN-8: Error gate — no disk mutation on error
  const hasErrors = diagnostics.some((d) => d.level === "error");
  if (hasErrors) {
    return { files, artifacts: allArtifacts, diagnostics };
  }

  // GEN-1: Clean outDir before write
  await fs.rm(opts.outDir, { recursive: true, force: true });

  // Build header
  const header = generateHeader({
    sourceId: opts.sourceId,
    schemaHash: opts.schema.hash,
    stamp: opts.stamp,
  });

  // Flush files to disk (GEN-6: OS path conversion only at write time)
  for (const file of files) {
    const absPath = nodePath.join(opts.outDir, ...file.path.split("/"));
    const dir = nodePath.dirname(absPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(absPath, header + file.content, "utf-8");
  }

  return { files, artifacts: allArtifacts, diagnostics };
}

function validatePluginNames(
  plugins: readonly CodegenPlugin[]
): Diagnostic | undefined {
  const seen = new Set<string>();
  for (const plugin of plugins) {
    if (!plugin.name) {
      return {
        level: "error",
        plugin: "",
        message: "Plugin name must not be empty (PLG-1)",
      };
    }
    if (seen.has(plugin.name)) {
      return {
        level: "error",
        plugin: plugin.name,
        message: `Duplicate plugin name "${plugin.name}" (GEN-2)`,
      };
    }
    seen.add(plugin.name);
  }
  return undefined;
}
