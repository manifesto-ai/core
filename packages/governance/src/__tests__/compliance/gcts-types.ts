import type {
  ComplianceCase,
  ComplianceCoverageEntry,
  ComplianceEvidence,
  ComplianceInventoryItem,
  ComplianceResult,
  ComplianceRule,
  ComplianceStatus,
  RuleLevel,
  RuleLifecycle,
  RuleMode,
} from "@manifesto-ai/cts-kit";
import type { ProposalStatus } from "../../index.js";
import type { DefaultGovernanceService, InMemoryGovernanceStore } from "../../index.js";

export const GCTS_SUITES = [
  "lifecycle",
  "events",
  "seams",
  "matrix",
] as const;

export type GovernanceComplianceSuite = (typeof GCTS_SUITES)[number];

export type {
  ComplianceStatus,
  RuleLevel,
  RuleLifecycle,
  RuleMode,
};

export type GovernanceEvidence = ComplianceEvidence;

export type GovernanceComplianceInventoryItem = ComplianceInventoryItem<GovernanceComplianceSuite>;

export type GovernanceComplianceRule = ComplianceRule<GovernanceComplianceSuite>;

export type GovernanceComplianceCase = ComplianceCase<GovernanceComplianceSuite>;

export type GovernanceComplianceCoverageEntry = ComplianceCoverageEntry;

export type GovernanceComplianceResult = ComplianceResult<GovernanceEvidence>;

export interface GovernanceComplianceAdapter {
  isValidTransition(from: ProposalStatus, to: ProposalStatus): boolean;
  getValidTransitions(status: ProposalStatus): ProposalStatus[];
  createStore(): InMemoryGovernanceStore;
  createService(
    store: InMemoryGovernanceStore,
    options?: ConstructorParameters<typeof DefaultGovernanceService>[1]
  ): DefaultGovernanceService;
  exports(): Record<string, unknown>;
}
