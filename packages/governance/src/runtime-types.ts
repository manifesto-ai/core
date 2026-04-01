import type {
  ComposableManifesto,
  BaseLaws,
  GovernanceLaws,
  LineageLaws,
  ManifestoDomainShape,
} from "@manifesto-ai/sdk";
import type { Intent as CoreIntent } from "@manifesto-ai/core";
import type {
  BranchId,
  LineageInstance,
} from "@manifesto-ai/lineage";

import type { AuthorityEvaluator } from "./authority/evaluator.js";
import type {
  ActorAuthorityBinding,
  ActorId,
  ActorRef,
  DecisionId,
  DecisionRecord,
  GovernanceEventSink,
  GovernanceStore,
  IntentScope,
  Proposal,
  ProposalId,
  SourceRef,
} from "./types.js";

export type GovernanceExecutionConfig = {
  readonly projectionId: string;
  readonly deriveActor: (intent: CoreIntent) => ActorRef;
  readonly deriveSource: (intent: CoreIntent) => SourceRef;
};

export type GovernanceConfig = {
  readonly bindings: readonly ActorAuthorityBinding[];
  readonly governanceStore?: GovernanceStore;
  readonly evaluator?: AuthorityEvaluator;
  readonly eventSink?: GovernanceEventSink;
  readonly now?: () => number;
  readonly execution: GovernanceExecutionConfig;
};

export type LineageComposableLaws = BaseLaws & LineageLaws & {
  readonly __governanceLaws?: never;
};

export type GovernedComposableLaws = BaseLaws & LineageLaws & GovernanceLaws;

export type GovernanceInstance<T extends ManifestoDomainShape> =
  Omit<LineageInstance<T>, "commitAsync"> & {
    readonly proposeAsync: (intent: CoreIntent) => Promise<Proposal>;
    readonly approve: (
      proposalId: ProposalId,
      approvedScope?: IntentScope | null,
    ) => Promise<Proposal>;
    readonly reject: (proposalId: ProposalId, reason?: string) => Promise<Proposal>;
    readonly getProposal: (proposalId: ProposalId) => Promise<Proposal | null>;
    readonly getProposals: (branchId?: BranchId) => Promise<readonly Proposal[]>;
    readonly bindActor: (binding: ActorAuthorityBinding) => Promise<void>;
    readonly getActorBinding: (actorId: ActorId) => Promise<ActorAuthorityBinding | null>;
    readonly getDecisionRecord: (
      decisionId: DecisionId,
    ) => Promise<DecisionRecord | null>;
  };

export type GovernanceComposableManifesto<
  T extends ManifestoDomainShape,
> = Omit<
  ComposableManifesto<T, GovernedComposableLaws>,
  "activate"
> & {
  activate(): GovernanceInstance<T>;
};

declare module "@manifesto-ai/sdk" {
  interface ManifestoDecoratedRuntimeByLaws<T extends ManifestoDomainShape> {
    readonly governance: GovernanceInstance<T>;
  }
}

export type LineageComposableManifestoInput<
  T extends ManifestoDomainShape,
> = ComposableManifesto<T, LineageComposableLaws>;
