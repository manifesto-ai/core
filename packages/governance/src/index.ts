/**
 * @manifesto-ai/governance
 *
 * ADR-014 governance compatibility surface.
 *
 * The current repository still implements governance behavior inside
 * `@manifesto-ai/world`. This package exposes a narrow, governance-oriented
 * surface so CTS can be built before the real split lands.
 */

export {
  ActorRegistry,
  createActorRegistry,
  ProposalQueue,
  createProposalQueue,
  isValidTransition,
  getValidTransitions,
  isTerminalProposalStatus,
  createProposal,
  createDecisionRecord,
  createExecutionKey,
  defaultExecutionKeyPolicy,
  createNoopWorldEventSink,
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
} from "@manifesto-ai/world";

export type {
  ActorRef,
  AuthorityRef,
  AuthorityPolicy,
  ActorAuthorityBinding,
  Proposal,
  ProposalId,
  ProposalStatus,
  ProposalTrace,
  DecisionRecord,
  DecisionId,
  FinalDecision,
  IntentInstance,
  IntentScope,
  WorldId,
  ExecutionKey,
  ExecutionKeyContext,
  ExecutionKeyPolicy,
  HostExecutionOptions,
  HostExecutionResult,
  HostExecutor,
  WorldEventType,
  WorldEvent,
  WorldEventSink,
  ProposalSubmittedEvent,
  ProposalEvaluatingEvent,
  ProposalDecidedEvent,
  ProposalSupersededEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
  WorldCreatedEvent,
  WorldForkedEvent,
} from "@manifesto-ai/world";
