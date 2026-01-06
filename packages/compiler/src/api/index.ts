/**
 * Compile API
 *
 * MEL text ingest functions.
 *
 * @see SPEC v0.4.0 §19
 */

export type {
  CompileTrace,
  CompileMelDomainOptions,
  CompileMelDomainResult,
  CompileMelPatchOptions,
  CompileMelPatchResult,
} from "./compile-mel.js";

export { compileMelDomain, compileMelPatch } from "./compile-mel.js";
