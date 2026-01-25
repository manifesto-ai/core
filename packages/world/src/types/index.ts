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
  ExecutionKeyContext,
  ExecutionKeyPolicy,
} from "./host-executor.js";

export {
  ExecutionKeySchema,
  createExecutionKey,
  defaultExecutionKeyPolicy,
} from "./host-executor.js";

export type {
  ErrorSignature,
  TerminalStatusForHash,
  SnapshotHashInput,
  WorldIdInput,
} from "./snapshot-hash.js";
