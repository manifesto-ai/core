/**
 * World Protocol Types
 *
 * Hexagonal port interfaces and branded types.
 */

export type {
  ExecutionKey,
  ArtifactRef,
  HostExecutionOptions,
  HostExecutionResult,
  HostExecutor,
  ExecutionKeyPolicy,
} from "./host-executor.js";

export {
  createExecutionKey,
  defaultExecutionKeyPolicy,
} from "./host-executor.js";

export type {
  ErrorSignature,
  TerminalStatusForHash,
  SnapshotHashInput,
  WorldIdInput,
} from "./snapshot-hash.js";
