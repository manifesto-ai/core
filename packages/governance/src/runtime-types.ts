import type {
  BaseLaws,
  ComposableManifesto,
  GovernanceLaws,
  LineageLaws,
  ManifestoDomainShape,
} from "@manifesto-ai/sdk";
import type { Intent as CoreIntent } from "@manifesto-ai/core";
import type {
  BranchId,
  LineageConfig,
  LineageInstance,
  LineageService,
  LineageStore,
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

export type GovernanceLineageConfig =
  | {
      readonly service: LineageService;
      readonly store?: LineageStore;
      readonly branchId?: BranchId;
    }
  | {
      readonly store: LineageStore;
      readonly service?: LineageService;
      readonly branchId?: BranchId;
    };

export type GovernanceExecutionConfig = {
  readonly projectionId: string;
  readonly deriveActor: (intent: CoreIntent) => ActorRef;
  readonly deriveSource: (intent: CoreIntent) => SourceRef;
};

export type GovernanceConfig<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
> = {
  readonly bindings: readonly ActorAuthorityBinding[];
  readonly governanceStore?: GovernanceStore;
  readonly evaluator?: AuthorityEvaluator;
  readonly eventSink?: GovernanceEventSink;
  readonly now?: () => number;
  readonly execution: GovernanceExecutionConfig;
} & (Laws extends LineageLaws
  ? { readonly lineage?: GovernanceLineageConfig | LineageConfig }
  : { readonly lineage: GovernanceLineageConfig });

export type GovernanceInstance<T extends ManifestoDomainShape> =
  Omit<LineageInstance<T>, "dispatchAsync"> & {
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
  Laws extends BaseLaws,
> = Omit<
  ComposableManifesto<T, Laws & LineageLaws & GovernanceLaws>,
  "activate"
> & {
  activate(): GovernanceInstance<T>;
};
