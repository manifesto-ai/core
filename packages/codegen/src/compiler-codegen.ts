import type { DomainSchema } from "@manifesto-ai/core";

import { createDomainPlugin } from "./plugins/domain-plugin.js";
import { generate } from "./runner.js";
import type { CodegenPlugin, GenerateResult } from "./types.js";

export interface CompilerCodegenInput {
  readonly schema: DomainSchema;
  readonly sourceId: string;
}

export interface CompilerCodegenOptions {
  readonly outDir?: string;
  readonly plugins?: readonly CodegenPlugin[];
  readonly stamp?: boolean;
}

export interface CompilerCodegenEmitter {
  (input: CompilerCodegenInput): Promise<GenerateResult>;
}

export function createCompilerCodegen(
  options: CompilerCodegenOptions = {}
): CompilerCodegenEmitter {
  const outDir = options.outDir ?? ".";
  const plugins = options.plugins ?? [createDomainPlugin()];

  return async (input: CompilerCodegenInput) => {
    const result = await generate({
      schema: input.schema,
      sourceId: input.sourceId,
      outDir,
      plugins,
      stamp: options.stamp,
    });

    const errors = result.diagnostics.filter((diagnostic) => diagnostic.level === "error");
    if (errors.length > 0) {
      const details = errors
        .map((diagnostic) => `[${diagnostic.plugin}] ${diagnostic.message}`)
        .join("\n");
      throw new Error(`Codegen failed for ${input.sourceId}\n${details}`);
    }

    return result;
  };
}
