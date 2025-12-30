/**
 * World Persistence exports
 */

// Interface
export type {
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
} from "./interface.js";

// Memory implementation
export { MemoryWorldStore, createMemoryWorldStore } from "./memory.js";
