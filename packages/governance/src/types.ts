import type { ErrorValue, Intent as HostIntent, Snapshot } from "@manifesto-ai/core";
import type { ArtifactRef, BranchId, PreparedLineageCommit, World, WorldId } from "@manifesto-ai/lineage";

export type { Snapshot } from "@manifesto-ai/core";
export type {
  ArtifactRef,
  BranchId,
  PreparedLineageCommit,
  World,
  WorldId,
} from "@manifesto-ai/lineage";

export type ProposalId = string;
export type DecisionId = string;
export type ActorId = string;
export type AuthorityId = string;
export type ExecutionKey = string;

export type ActorKind = "human" | "agent" | "system";
export type AuthorityKind = "auto" | "human" | "policy" | "tribunal";
export type ProposalStatus =
  | "submitted"
  | "evaluating"
  | "approved"
  | "rejected"
  | "executing"
  | "completed"
  | "failed"
  | "superseded";

export type SupersedeReason =
  | "branch_switch"
  | "head_advance"
  | "manual_cancel";

export interface ActorRef {
  readonly actorId: ActorId;
  readonly kind: ActorKind;
  readonly name?: string;
  readonly meta?: Record<string, unknown>;
}

export interface AuthorityRef {
  readonly authorityId: AuthorityId;
  readonly kind: AuthorityKind;
  readonly name?: string;
}

export interface IntentScope {
  readonly allowedPaths?: readonly string[];
  readonly note?: string;
}

export interface Intent {
  readonly type: string;
  readonly intentId: string;
  readonly input?: unknown;
  readonly scopeProposal?: IntentScope;
}

export interface ExecutionKeyContext {
  readonly proposalId: ProposalId;
  readonly actorId: ActorId;
  readonly baseWorld: WorldId;
  readonly branchId: BranchId;
  readonly attempt: number;
}

export type ExecutionKeyPolicy = (context: ExecutionKeyContext) => ExecutionKey;

export interface HostExecutionOptions {
  readonly approvedScope?: unknown;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export interface HostExecutionResult {
  readonly outcome: "completed" | "failed";
  readonly terminalSnapshot: Snapshot;
  readonly traceRef?: ArtifactRef;
  readonly error?: ErrorValue;
}

export interface HostExecutor {
  execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: HostIntent,
    opts?: HostExecutionOptions
  ): Promise<HostExecutionResult>;

  abort?(key: ExecutionKey): void;
}

export interface Proposal {
  readonly proposalId: ProposalId;
  readonly baseWorld: WorldId;
  readonly branchId: BranchId;
  readonly actorId: ActorId;
  readonly authorityId: AuthorityId;
  readonly intent: Intent;
  readonly status: ProposalStatus;
  readonly executionKey: ExecutionKey;
  readonly submittedAt: number;
  readonly decidedAt?: number;
  readonly completedAt?: number;
  readonly decisionId?: DecisionId;
  readonly epoch: number;
  readonly resultWorld?: WorldId;
  readonly supersededReason?: SupersedeReason;
  readonly approvedScope?: unknown;
}

export type FinalDecision =
  | { readonly kind: "approved" }
  | { readonly kind: "rejected"; readonly reason?: string };

export interface DecisionRecord {
  readonly decisionId: DecisionId;
  readonly proposalId: ProposalId;
  readonly authorityId: AuthorityId;
  readonly decision: FinalDecision;
  readonly decidedAt: number;
}

export type AuthorityPolicy =
  | { readonly mode: "auto_approve"; readonly reason?: string }
  | {
      readonly mode: "hitl";
      readonly delegate: ActorRef;
      readonly timeout?: number;
      readonly onTimeout?: "approve" | "reject";
    }
  | {
      readonly mode: "policy_rules";
      readonly rules: readonly PolicyRule[];
      readonly defaultDecision: "approve" | "reject" | "escalate";
      readonly escalateTo?: AuthorityRef;
    }
  | {
      readonly mode: "tribunal";
      readonly members: readonly ActorRef[];
      readonly quorum: QuorumRule;
      readonly timeout?: number;
      readonly onTimeout?: "approve" | "reject";
    };

export interface ActorAuthorityBinding {
  readonly actorId: ActorId;
  readonly authorityId: AuthorityId;
  readonly policy: AuthorityPolicy;
}

export type PolicyCondition =
  | { readonly kind: "intent_type"; readonly types: readonly string[] }
  | { readonly kind: "scope_pattern"; readonly pattern: string }
  | { readonly kind: "custom"; readonly evaluator: string };

export interface PolicyRule {
  readonly condition: PolicyCondition;
  readonly decision: "approve" | "reject" | "escalate";
  readonly reason?: string;
}

export type QuorumRule =
  | { readonly kind: "unanimous" }
  | { readonly kind: "majority" }
  | { readonly kind: "threshold"; readonly count: number };

export type WaitingFor =
  | { readonly kind: "human"; readonly delegate: ActorRef }
  | { readonly kind: "tribunal"; readonly members: readonly ActorRef[] }
  | { readonly kind: "timeout"; readonly until: number };

export type AuthorityResponse =
  | { readonly kind: "approved"; readonly approvedScope: IntentScope | null }
  | { readonly kind: "rejected"; readonly reason?: string }
  | { readonly kind: "pending"; readonly waitingFor: WaitingFor };

export interface Vote {
  readonly voter: ActorRef;
  readonly decision: "approve" | "reject" | "abstain";
  readonly reasoning?: string;
  readonly votedAt: number;
}

export type GovernanceEventType =
  | "proposal:submitted"
  | "proposal:evaluating"
  | "proposal:decided"
  | "proposal:superseded"
  | "execution:completed"
  | "execution:failed"
  | "execution:seal_rejected"
  | "world:created"
  | "world:forked";

export interface BaseGovernanceEvent<T extends GovernanceEventType> {
  readonly type: T;
  readonly timestamp: number;
}

export interface ErrorInfo {
  readonly summary: string;
  readonly details?: readonly ErrorValue[];
  readonly pendingRequirements?: readonly string[];
}

export interface ProposalSubmittedEvent
  extends BaseGovernanceEvent<"proposal:submitted"> {
  readonly proposalId: ProposalId;
  readonly actorId: ActorId;
  readonly baseWorld: WorldId;
  readonly branchId: BranchId;
  readonly intent: {
    readonly type: string;
    readonly intentId: string;
    readonly input?: unknown;
  };
  readonly executionKey: ExecutionKey;
  readonly epoch: number;
}

export interface ProposalEvaluatingEvent
  extends BaseGovernanceEvent<"proposal:evaluating"> {
  readonly proposalId: ProposalId;
}

export interface ProposalDecidedEvent
  extends BaseGovernanceEvent<"proposal:decided"> {
  readonly proposalId: ProposalId;
  readonly decisionId: DecisionId;
  readonly decision: "approved" | "rejected";
  readonly reason?: string;
}

export interface ProposalSupersededEvent
  extends BaseGovernanceEvent<"proposal:superseded"> {
  readonly proposalId: ProposalId;
  readonly currentEpoch: number;
  readonly proposalEpoch: number;
  readonly reason: SupersedeReason;
}

export interface ExecutionCompletedEvent
  extends BaseGovernanceEvent<"execution:completed"> {
  readonly proposalId: ProposalId;
  readonly executionKey: ExecutionKey;
  readonly resultWorld: WorldId;
}

export interface ExecutionFailedEvent
  extends BaseGovernanceEvent<"execution:failed"> {
  readonly proposalId: ProposalId;
  readonly executionKey: ExecutionKey;
  readonly resultWorld: WorldId;
  readonly error: ErrorInfo;
}

export interface SealRejectionReason {
  readonly kind: "worldId_collision" | "self_loop";
  readonly computedWorldId: WorldId;
  readonly message: string;
}

export interface ExecutionSealRejectedEvent
  extends BaseGovernanceEvent<"execution:seal_rejected"> {
  readonly proposalId: ProposalId;
  readonly executionKey: ExecutionKey;
  readonly rejection: SealRejectionReason;
}

export interface WorldCreatedEvent
  extends BaseGovernanceEvent<"world:created"> {
  readonly world: World;
  readonly from: WorldId;
  readonly proposalId: ProposalId;
  readonly outcome: "completed" | "failed";
}

export interface WorldForkedEvent
  extends BaseGovernanceEvent<"world:forked"> {
  readonly branchId: BranchId;
  readonly forkPoint: WorldId;
}

export type GovernanceEvent =
  | ProposalSubmittedEvent
  | ProposalEvaluatingEvent
  | ProposalDecidedEvent
  | ProposalSupersededEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | ExecutionSealRejectedEvent
  | WorldCreatedEvent
  | WorldForkedEvent;

export interface GovernanceEventSink {
  emit(event: GovernanceEvent): void;
}

export interface PreparedGovernanceCommit {
  readonly proposal: Proposal;
  readonly decisionRecord: DecisionRecord;
  readonly hasLineageRecords: boolean;
}

export interface GovernanceStore {
  putProposal(proposal: Proposal): void;
  getProposal(proposalId: ProposalId): Proposal | null;
  getProposalsByBranch(branchId: BranchId): readonly Proposal[];
  getExecutionStageProposal(branchId: BranchId): Proposal | null;
  putDecisionRecord(record: DecisionRecord): void;
  getDecisionRecord(decisionId: DecisionId): DecisionRecord | null;
  putActorBinding(binding: ActorAuthorityBinding): void;
  getActorBinding(actorId: ActorId): ActorAuthorityBinding | null;
  getActorBindings(): readonly ActorAuthorityBinding[];
}

export interface CreateProposalInput {
  readonly proposalId?: ProposalId;
  readonly baseWorld: WorldId;
  readonly branchId: BranchId;
  readonly actorId: ActorId;
  readonly authorityId: AuthorityId;
  readonly intent: Intent;
  readonly executionKey: ExecutionKey;
  readonly submittedAt: number;
  readonly epoch: number;
}

export interface PrepareAuthorityResultOptions {
  readonly currentEpoch?: number;
  readonly currentBranchHead?: WorldId;
  readonly decisionId?: DecisionId;
  readonly decidedAt: number;
}

export interface PreparedAuthorityResult {
  readonly proposal: Proposal;
  readonly decisionRecord?: DecisionRecord;
  readonly discarded: boolean;
}

export interface GovernanceService {
  createProposal(input: CreateProposalInput): Proposal;
  prepareAuthorityResult(
    proposal: Proposal,
    response: Extract<AuthorityResponse, { kind: "approved" | "rejected" }>,
    options: PrepareAuthorityResultOptions
  ): PreparedAuthorityResult;
  prepareSupersede(proposal: Proposal, reason: SupersedeReason): Proposal;
  invalidateStaleIngress(branchId: BranchId, currentEpoch?: number): readonly Proposal[];
  shouldDiscardAuthorityResult(proposal: Proposal, currentEpoch: number): boolean;
  deriveOutcome(terminalSnapshot: Snapshot): "completed" | "failed";
  finalize(
    executingProposal: Proposal,
    lineageCommit: PreparedLineageCommit,
    completedAt: number
  ): PreparedGovernanceCommit;
  finalizeOnSealRejection(
    executingProposal: Proposal,
    rejection: SealRejectionReason,
    completedAt: number
  ): PreparedGovernanceCommit;
  createProposalSubmittedEvent(
    proposal: Proposal,
    timestamp?: number
  ): ProposalSubmittedEvent;
  createProposalEvaluatingEvent(
    proposal: Proposal,
    timestamp?: number
  ): ProposalEvaluatingEvent;
  createProposalDecidedEvent(
    proposal: Proposal,
    decisionRecord: DecisionRecord,
    timestamp?: number
  ): ProposalDecidedEvent;
  createProposalSupersededEvent(
    proposal: Proposal,
    currentEpoch: number,
    timestamp?: number
  ): ProposalSupersededEvent;
  createExecutionSealRejectedEvent(
    proposal: Proposal,
    rejection: SealRejectionReason,
    timestamp?: number
  ): ExecutionSealRejectedEvent;
}

export function createProposalId(value?: string): ProposalId {
  return value ?? `prop-${crypto.randomUUID()}`;
}

export function createDecisionId(value?: string): DecisionId {
  return value ?? `dec-${crypto.randomUUID()}`;
}

export function createExecutionKey(proposalId: ProposalId, attempt = 1): ExecutionKey {
  return `${proposalId}:${attempt}`;
}

export const defaultExecutionKeyPolicy: ExecutionKeyPolicy = ({
  proposalId,
  attempt,
}) => createExecutionKey(proposalId, attempt);

export function createNoopGovernanceEventSink(): GovernanceEventSink {
  return {
    emit(): void {
      // no-op
    },
  };
}

export function toHostIntent(intent: Intent): HostIntent {
  return {
    type: intent.type,
    input: intent.input,
    intentId: intent.intentId,
  };
}
