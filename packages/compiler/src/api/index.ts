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
export type {
  CompileFragmentInContextOptions,
  MelEditAddActionOp,
  MelEditAddAvailableOp,
  MelEditAddComputedOp,
  MelEditAddDispatchableOp,
  MelEditAddStateFieldOp,
  MelEditAddTypeOp,
  MelEditOp,
  MelEditRemoveDeclarationOp,
  MelEditRenameDeclarationOp,
  MelEditReplaceActionBodyOp,
  MelEditReplaceAvailableOp,
  MelEditReplaceComputedExprOp,
  MelEditReplaceDispatchableOp,
  MelEditReplaceStateDefaultOp,
  MelEditReplaceTypeFieldOp,
  MelEditResult,
  MelParamSource,
  MelTextEdit,
  SchemaDiff,
  SchemaModifiedTarget,
} from "./compile-fragment-in-context.js";

export { compileMelDomain, compileMelModule, compileMelPatch } from "./compile-mel.js";
export { compileFragmentInContext } from "./compile-fragment-in-context.js";
