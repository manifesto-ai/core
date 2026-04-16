/**
 * Compile API
 *
 * MEL text ingest functions.
 *
 * @see SPEC v0.4.0 §19
 */

export type {
  Annotation,
  AnnotationIndex,
  CompileTrace,
  CompileMelDomainOptions,
  CompileMelDomainResult,
  CompileMelModuleOptions,
  CompileMelModuleResult,
  CompileMelPatchOptions,
  CompileMelPatchResult,
  DomainModule,
  JsonLiteral,
  LocalTargetKey,
  SourceMapEmissionContext,
  SourceMapEntry,
  SourceMapIndex,
  SourceMapPath,
  SourcePoint,
  SourceSpan,
} from "./compile-mel.js";

export { compileMelDomain, compileMelModule, compileMelPatch } from "./compile-mel.js";
