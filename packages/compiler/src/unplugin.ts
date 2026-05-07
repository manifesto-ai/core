/**
 * Unified MEL plugin via unplugin.
 *
 * Single implementation that targets Vite, Webpack, Rollup, esbuild, and Rspack.
 */

import { createHash } from "node:crypto";
import * as nodePath from "node:path";
import { createUnplugin } from "unplugin";
import { compileMelDomain } from "./api/index.js";
import type { DomainSchema } from "./generator/ir.js";
import { formatDiagnostic, renderSchemaModuleCode } from "./mel-module.js";

export type MelCodegenArtifact = {
  readonly schema: DomainSchema;
  readonly sourceId: string;
};

export type MelCodegenEmitter = (
  artifact: MelCodegenArtifact
) => unknown | Promise<unknown>;

export type MelCodegenTiming = "transform" | "build" | "both";

export type MelCodegenOptions = {
  readonly emit: MelCodegenEmitter;
  readonly timing?: MelCodegenTiming;
};

export type MelPluginOptions = {
  readonly include?: RegExp;
  readonly codegen?: MelCodegenEmitter | MelCodegenOptions | false;
};

const VALID_CODEGEN_TIMINGS = new Set<MelCodegenTiming>(["transform", "build", "both"]);

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

function resolveCodegenOptions(
  codegen: MelPluginOptions["codegen"]
): MelCodegenOptions | null {
  if (!codegen) {
    return null;
  }

  if (typeof codegen === "function") {
    return { emit: codegen, timing: "transform" };
  }

  if (typeof codegen === "object" && typeof codegen.emit === "function") {
    const timing = codegen.timing ?? "transform";
    if (!VALID_CODEGEN_TIMINGS.has(timing)) {
      throw new TypeError(
        `manifesto:mel codegen timing must be one of "transform", "build", or "both" (received ${JSON.stringify(timing)})`
      );
    }

    return {
      emit: codegen.emit,
      timing,
    };
  }

  throw new TypeError(
    "manifesto:mel codegen must be a function or an object with a callable emit field"
  );
}

export const unpluginMel = createUnplugin((options: MelPluginOptions = {}) => {
  const include = options.include ?? /\.mel$/;
  const compiledSchemas = new Map<string, DomainSchema>();
  const codegen = resolveCodegenOptions(options.codegen);

  return {
    name: "manifesto:mel",
    enforce: "pre" as const,

    transformInclude(id: string) {
      return testRegex(include, normalizeId(id));
    },

    async transform(source: string, id: string) {
      const sourceId = normalizeId(id);
      const result = compileMelDomain(source, { mode: "domain" });

      if (result.errors.length > 0) {
        const details = result.errors.map(formatDiagnostic).join("\n");
        throw new Error(`MEL compilation failed for ${sourceId}\n${details}`);
      }

      if (!result.schema) {
        throw new Error(`MEL compilation produced no schema for ${sourceId}`);
      }

      const artifactSourceId = normalizeArtifactSourceId(sourceId);

      if (codegen) {
        if (codegen.timing === "transform" || codegen.timing === "both") {
          await codegen.emit({ schema: result.schema, sourceId: artifactSourceId });
        }

        if (codegen.timing === "build" || codegen.timing === "both") {
          compiledSchemas.set(artifactSourceId, result.schema);
        }
      }

      return renderSchemaModuleCode(result.schema);
    },

    async buildEnd() {
      if (!codegen || compiledSchemas.size === 0) {
        return;
      }

      for (const [sourceId, schema] of compiledSchemas) {
        await codegen.emit({ schema, sourceId });
      }
    },
  };
});
