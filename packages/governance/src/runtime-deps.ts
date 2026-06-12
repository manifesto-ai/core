import type { ManifestoDomainShape } from "@manifesto-ai/sdk";
import type { GovernanceRuntimeKernel } from "@manifesto-ai/sdk/provider";
import type {
  LineageRuntimeController,
  LineageService,
} from "@manifesto-ai/lineage/provider";

import type { AuthorityEvaluator } from "./authority/evaluator.js";
import type { GovernanceConfig } from "./runtime-types.js";
import type {
  ActorAuthorityBinding,
  GovernanceEventDispatcher,
  GovernanceService,
  GovernanceStore,
  ProposalId,
} from "./types.js";

/**
 * Shared runtime collaborators for the governance activation modules.
 *
 * `activateGovernanceRuntime()` builds this once and hands it to the
 * settlement, submission, recovery, and observation factories so the
 * extracted closures keep operating on the exact same shared state
 * (`proposalSubmissionBindings`, `activeSettlementTasks`) and services.
 */
export interface GovernanceRuntimeDeps<T extends ManifestoDomainShape> {
  readonly kernel: GovernanceRuntimeKernel<T>;
  readonly lineage: LineageRuntimeController<T>;
  readonly lineageService: LineageService;
  readonly config: GovernanceConfig<T>;
  readonly governanceService: GovernanceService;
  readonly governanceStore: GovernanceStore;
  readonly evaluator: AuthorityEvaluator;
  readonly eventDispatcher: GovernanceEventDispatcher;
  readonly getCurrentTimestamp: () => number;
  readonly ensureReady: () => Promise<void>;
  readonly proposalSubmissionBindings: Map<ProposalId, ActorAuthorityBinding>;
  readonly activeSettlementTasks: Set<ProposalId>;
}
