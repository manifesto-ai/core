/**
 * Executor Pipeline Module
 *
 * @see ADR-004 Phase 3
 * @module
 */

export type {
  PipelineInput,
  PrepareOutput,
  AuthorizeOutput,
  ExecuteOutput,
  PersistOutput,
  PipelineContext,
  StageResult,
  PrepareDeps,
  AuthorizeDeps,
  ExecuteDeps,
  PersistDeps,
  FinalizeDeps,
} from "./types.js";

export { prepare } from "./prepare.js";
export { authorize } from "./authorize.js";
export { executeHost } from "./execute.js";
export { persist } from "./persist.js";
export { finalize } from "./finalize.js";
