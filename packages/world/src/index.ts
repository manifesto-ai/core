/**
 * @manifesto-ai/world
 *
 * Manifesto World Protocol - Governance, Authority, and Lineage layer
 *
 * The World Protocol operates above Manifesto Core and Host:
 *
 * | Layer         | Responsibility                           |
 * |---------------|------------------------------------------|
 * | Core          | Computes semantic truth                  |
 * | Host          | Executes effects, applies patches        |
 * | World Protocol| Governs legitimacy, authority, lineage   |
 *
 * @packageDocumentation
 */

// Schema exports
export * from "./schema/index.js";

// Error exports
export { WorldError, createWorldError, isWorldError } from "./errors.js";
export type { WorldErrorCode } from "./errors.js";
export * from "./errors.js";

// Factory exports
export {
  generateProposalId,
  generateDecisionId,
  generateEdgeId,
  computeSnapshotHash,
  computeWorldId,
  createGenesisWorld,
  createWorldFromExecution,
  createProposal,
  createDecisionRecord,
  createWorldEdge,
  // Intent factory functions
  createIntentInstance,
  createIntentInstanceSync,
  computeIntentKey,
  toHostIntent,
} from "./factories.js";

// Registry exports
export { ActorRegistry, createActorRegistry } from "./registry/index.js";

// Proposal exports
export { ProposalQueue, createProposalQueue } from "./proposal/index.js";
export { isValidTransition, isTerminalStatus as isTerminalProposalStatus, getValidTransitions } from "./proposal/state-machine.js";

// Authority exports
export {
  AutoApproveHandler,
  createAutoApproveHandler,
  PolicyRulesHandler,
  createPolicyRulesHandler,
  HITLHandler,
  createHITLHandler,
  TribunalHandler,
  createTribunalHandler,
  AuthorityEvaluator,
  createAuthorityEvaluator,
} from "./authority/index.js";
export type {
  AuthorityHandler,
  HITLDecisionCallback,
  HITLPendingState,
  HITLNotificationCallback,
  TribunalNotificationCallback,
  CustomConditionEvaluator,
} from "./authority/index.js";

// Lineage exports
export { WorldLineage, createWorldLineage } from "./lineage/index.js";

// Ingress exports (Epoch management)
export { createIngressContext, type IngressContext } from "./ingress/index.js";

// Persistence exports
export { MemoryWorldStore, createMemoryWorldStore } from "./persistence/index.js";
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
} from "./persistence/index.js";

// World Orchestrator exports
export { ManifestoWorld, createManifestoWorld } from "./world.js";
export type {
  ProposalResult,
  ManifestoWorldConfig,
} from "./world.js";

// Types exports (hexagonal ports)
export type {
  ExecutionKey,
  ArtifactRef,
  HostExecutionOptions,
  HostExecutionResult,
  HostExecutor,
  ExecutionKeyPolicy,
  ErrorSignature,
  TerminalStatusForHash,
  SnapshotHashInput,
  WorldIdInput,
} from "./types/index.js";

export {
  createExecutionKey,
  defaultExecutionKeyPolicy,
} from "./types/index.js";

// Event Types (World Protocol governance events)
export type {
  WorldEventType,
  WorldEvent,
  ErrorInfo,
  AuthorityDecision,
  WorldEventSink,
  // Individual event types (governance events only)
  ProposalSubmittedEvent,
  ProposalEvaluatingEvent,
  ProposalDecidedEvent,
  ProposalSupersededEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
  WorldCreatedEvent,
  WorldForkedEvent,
} from "./events/index.js";

export { createNoopWorldEventSink } from "./events/index.js";

// Re-export core types for convenience
export {
  createIntent,
  createSnapshot,
  type Intent,
  type Snapshot,
  type DomainSchema,
  type Patch,
} from "@manifesto-ai/core";
