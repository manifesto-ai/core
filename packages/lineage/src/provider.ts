export type {
  AttemptId,
  BranchId,
  BranchInfo,
  BranchSwitchResult,
  ComputeEnvelope,
  LineageService,
  LineageStore,
  PersistedPatchDeltaV2,
  PreparedBranchBootstrap,
  PreparedBranchChange,
  PreparedBranchMutation,
  PreparedGenesisCommit,
  PreparedLineageCommit,
  PreparedLineageRecords,
  PreparedNextCommit,
  ProvenanceRef,
  SealAttempt,
  SealGenesisInput,
  SealNextInput,
  SnapshotHashInput,
  WorldRecord,
  WorldEdge,
  WorldHead,
  WorldId,
  WorldLineage,
} from "./types.js";
export type {
  LineageDecoration,
  LineageRuntimeController,
  ResolvedLineageConfig,
  SealedIntentResult,
  SealIntentOptions,
} from "./internal.js";
export {
  attachLineageDecoration,
  createLineageRuntimeController,
  getLineageDecoration,
} from "./internal.js";
export {
  DefaultLineageService,
  createLineageService,
} from "./service/lineage-service.js";
// Mirrors createBaseRuntimeInstance on the SDK provider seam: decorator and
// provider authors can compose a lineage runtime around a pre-built kernel
// (#491 — the declaration shipped in dist types without a JS export).
export { createLineageRuntimeInstance } from "./lineage-runtime.js";
export {
  InMemoryLineageStore,
  createInMemoryLineageStore,
} from "./store/in-memory-lineage-store.js";
