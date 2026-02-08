// @manifesto-ai/codegen
// Plugin-based code generation from DomainSchema
//
// See: docs/SPEC-v0.1.1.md for specification
// See: docs/ADR-CODEGEN-001.md for architecture decisions

// Core types
export type {
  Diagnostic,
  FilePatch,
  CodegenPlugin,
  CodegenContext,
  CodegenOutput,
  CodegenHelpers,
  GenerateOptions,
  GenerateResult,
} from "./types.js";

// Runner
export { generate } from "./runner.js";

// Plugins
export { createTsPlugin, createZodPlugin } from "./plugins/index.js";
export type { TsPluginOptions, TsPluginArtifacts, ZodPluginOptions } from "./plugins/index.js";

// Utilities (for custom plugin authors)
export { validatePath } from "./path-safety.js";
export type { PathValidationResult } from "./path-safety.js";
export { stableHash } from "./stable-hash.js";
export { generateHeader } from "./header.js";
export type { HeaderOptions } from "./header.js";
