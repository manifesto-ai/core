/**
 * WorldStore Module
 *
 * @module
 */

export {
  type WorldStore,
  type WorldDelta,
  type CompactOptions,
  type CompactResult,
  type WorldEntry,
  type WorldStoreOptions,
  type RestoreHostContext,
  RESTORE_CONTEXT,
} from "./interface.js";

export {
  InMemoryWorldStore,
  WorldNotFoundError,
  createInMemoryWorldStore,
} from "./in-memory.js";
