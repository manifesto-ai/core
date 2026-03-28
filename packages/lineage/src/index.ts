/**
 * @manifesto-ai/lineage
 *
 * ADR-014 lineage compatibility surface.
 *
 * The current repository still implements lineage behavior inside
 * `@manifesto-ai/world`. This package exposes a narrow, lineage-oriented
 * surface so CTS can be built before the real split lands.
 */

export {
  computeSnapshotHash,
  computeWorldId,
  createGenesisWorld,
  createWorldFromExecution,
  createWorldEdge,
  WorldLineage,
  createWorldLineage,
  MemoryWorldStore,
  createMemoryWorldStore,
} from "@manifesto-ai/world";

export type {
  Snapshot,
  World,
  WorldId,
  WorldEdge,
  EdgeId,
  SnapshotHashInput,
  WorldIdInput,
  WorldStore,
  ObservableWorldStore,
  ProposalQuery,
  WorldQuery,
  EdgeQuery,
  StoreResult,
  BatchResult,
  StoreEventType,
  StoreEvent,
  StoreEventListener,
} from "@manifesto-ai/world";
