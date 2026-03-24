/**
 * Unified MEL plugin via unplugin.
 *
 * Single implementation that targets Vite, Webpack, Rollup, esbuild, and Rspack.
 */

import { createUnplugin } from "unplugin";
import type { DomainSchema } from "@manifesto-ai/core";
import { compileMelDomain } from "./api/index.js";
import { formatDiagnostic } from "./mel-module.js";

export type MelCodegenOptions = {
  readonly outDir: string;
  readonly plugins?: readonly import("@manifesto-ai/codegen").CodegenPlugin[];
};

export type MelPluginOptions = {
  readonly include?: RegExp;
  readonly codegen?: MelCodegenOptions | false;
};

function normalizeId(id: string): string {
  return id.split("?", 1)[0];
}

function testRegex(regex: RegExp, value: string): boolean {
  regex.lastIndex = 0;
  return regex.test(value);
}

export const unpluginMel = createUnplugin((options: MelPluginOptions = {}) => {
  const include = options.include ?? /\.mel$/;
  const compiledSchemas = new Map<string, DomainSchema>();

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

      if (options.codegen) {
        compiledSchemas.set(sourceId, result.schema);
      }

      const serializedSchema = JSON.stringify(result.schema, null, 2);
      return `export default ${serializedSchema};\n`;
    },

    async buildEnd() {
      if (!options.codegen || compiledSchemas.size === 0) return;

      let codegen: typeof import("@manifesto-ai/codegen");
      try {
        codegen = await import("@manifesto-ai/codegen");
      } catch {
        console.warn(
          "[manifesto:mel] codegen option is enabled but @manifesto-ai/codegen is not installed. Skipping."
        );
        return;
      }

      const plugins = options.codegen.plugins ?? [
        codegen.createTsPlugin(),
        codegen.createZodPlugin(),
      ];

      for (const [sourceId, schema] of compiledSchemas) {
        await codegen.generate({
          schema,
          outDir: options.codegen.outDir,
          plugins,
          sourceId,
        });
      }
    },
  };
});
