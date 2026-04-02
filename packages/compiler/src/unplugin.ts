/**
 * Unified MEL plugin via unplugin.
 *
 * Single implementation that targets Vite, Webpack, Rollup, esbuild, and Rspack.
 */

import { createHash } from "node:crypto";
import * as nodePath from "node:path";
import { createUnplugin } from "unplugin";
import type { DomainSchema } from "@manifesto-ai/core";
import { compileMelDomain } from "./api/index.js";
import { formatDiagnostic } from "./mel-module.js";

export type MelCodegenArtifact = {
  readonly schema: DomainSchema;
  readonly sourceId: string;
};

export type MelCodegenEmitter = (
  artifact: MelCodegenArtifact
) => unknown | Promise<unknown>;

export type MelCodegenOptions = {
  readonly emit: MelCodegenEmitter;
};

export type MelPluginOptions = {
  readonly include?: RegExp;
  readonly codegen?: MelCodegenEmitter | MelCodegenOptions | false;
};

function normalizeId(id: string): string {
  return id.split("?", 1)[0];
}

function testRegex(regex: RegExp, value: string): boolean {
  regex.lastIndex = 0;
  return regex.test(value);
}

function normalizeArtifactSourceId(sourceId: string): string {
  const normalized = normalizeId(sourceId).replace(/\\/g, "/");
  if (!normalized) {
    return "domain.mel";
  }

  if (!nodePath.isAbsolute(sourceId)) {
    return normalized.replace(/^\.\//, "");
  }

  const relative = nodePath.relative(process.cwd(), sourceId);
  if (!relative || relative.startsWith("..") || nodePath.isAbsolute(relative)) {
    return createExternalArtifactSourceId(normalized);
  }

  return relative.split(nodePath.sep).join("/");
}

function createExternalArtifactSourceId(sourceId: string): string {
  const basename = nodePath.posix.basename(sourceId) || "domain.mel";
  const extension = nodePath.posix.extname(basename);
  const stem = basename.slice(0, basename.length - extension.length) || "domain";
  const hash = createHash("sha256").update(sourceId).digest("hex").slice(0, 12);
  const safeStem = sanitizePathSegment(stem);
  return `external/${safeStem}--${hash}${extension}`;
}

function sanitizePathSegment(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "domain";
}

function resolveCodegenEmitter(
  codegen: MelPluginOptions["codegen"]
): MelCodegenEmitter | null {
  if (!codegen) {
    return null;
  }

  if (typeof codegen === "function") {
    return codegen;
  }

  if (typeof codegen === "object" && typeof codegen.emit === "function") {
    return codegen.emit;
  }

  throw new TypeError(
    "manifesto:mel codegen must be a function or an object with a callable emit field"
  );
}

export const unpluginMel = createUnplugin((options: MelPluginOptions = {}) => {
  const include = options.include ?? /\.mel$/;
  const compiledSchemas = new Map<string, DomainSchema>();
  const codegenEmitter = resolveCodegenEmitter(options.codegen);

  return {
    name: "manifesto:mel",
    enforce: "pre" as const,

    transformInclude(id: string) {
      return testRegex(include, normalizeId(id));
    },

    transform(source: string, id: string) {
      const sourceId = normalizeId(id);
      const result = compileMelDomain(source, { mode: "domain" });

      if (result.errors.length > 0) {
        const details = result.errors.map(formatDiagnostic).join("\n");
        throw new Error(`MEL compilation failed for ${sourceId}\n${details}`);
      }

      if (!result.schema) {
        throw new Error(`MEL compilation produced no schema for ${sourceId}`);
      }

      if (codegenEmitter) {
        compiledSchemas.set(normalizeArtifactSourceId(sourceId), result.schema);
      }

      const serializedSchema = JSON.stringify(result.schema, null, 2);
      return `export default ${serializedSchema};\n`;
    },

    async buildEnd() {
      if (!codegenEmitter || compiledSchemas.size === 0) {
        return;
      }

      for (const [sourceId, schema] of compiledSchemas) {
        await codegenEmitter({ schema, sourceId });
      }
    },
  };
});
