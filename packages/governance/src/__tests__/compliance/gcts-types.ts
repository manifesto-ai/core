import type { ProposalStatus } from "../../index.js";
import type { DefaultGovernanceService, InMemoryGovernanceStore } from "../../index.js";

export const GCTS_SUITES = [
  "lifecycle",
  "seams",
  "matrix",
] as const;

export type GovernanceComplianceSuite = (typeof GCTS_SUITES)[number];

export type ComplianceStatus = "PASS" | "FAIL" | "SKIP" | "WARN";

export type RuleMode = "blocking" | "pending" | "informational";

export type RuleLevel = "MUST" | "SHOULD" | "MUST_NOT" | "MAY" | "CRITICAL";

export type RuleLifecycle = "active" | "superseded";

export interface GovernanceEvidence {
  kind: "note";
  summary: string;
  details?: unknown;
}

export interface GovernanceComplianceInventoryItem {
  ruleId: string;
  specSection: string;
  level: RuleLevel;
  suite: GovernanceComplianceSuite;
  lifecycle: RuleLifecycle;
  notes?: string;
}

export interface GovernanceComplianceRule extends GovernanceComplianceInventoryItem {
  mode: RuleMode;
}

export interface GovernanceComplianceCase {
  caseId: string;
  suite: GovernanceComplianceSuite;
  description: string;
}

export interface GovernanceComplianceCoverageEntry {
  ruleId: string;
  caseIds: string[];
}

export interface GovernanceComplianceResult {
  ruleId: string;
  specSection: string;
  mode: RuleMode;
  status: ComplianceStatus;
  message?: string;
  evidence?: GovernanceEvidence[];
}

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
