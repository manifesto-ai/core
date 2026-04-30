export type {
  ArtifactRef,
  BranchId,
  BranchInfo,
  BranchSwitchResult,
  World,
  WorldHead,
  WorldId,
  WorldLineage,
} from "./types.js";
export type {
  LineageContinuitySurface,
  LineageConfig,
  LineageInstance,
} from "./runtime-types.js";
export { InMemoryLineageStore, createInMemoryLineageStore } from "./store/in-memory-lineage-store.js";
export { withLineage } from "./with-lineage.js";
