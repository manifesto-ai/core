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
import type { GovernanceEvent } from "@manifesto-ai/governance";
import type {
  GovernedWorldStore,
  WorldInstance,
} from "../../index.js";

export const WFCTS_SUITES = [
  "reexports",
  "factory",
  "coordinator",
  "runtime",
  "matrix",
] as const;

export type WorldFacadeComplianceSuite = (typeof WFCTS_SUITES)[number];

export type {
  ComplianceStatus,
  RuleLevel,
  RuleLifecycle,
  RuleMode,
};

export type WorldFacadeEvidence = ComplianceEvidence;

export type WorldFacadeComplianceInventoryItem = ComplianceInventoryItem<WorldFacadeComplianceSuite>;

export type WorldFacadeComplianceRule = ComplianceRule<WorldFacadeComplianceSuite>;

export type WorldFacadeComplianceCase = ComplianceCase<WorldFacadeComplianceSuite>;

export type WorldFacadeComplianceCoverageEntry = ComplianceCoverageEntry;

export type WorldFacadeComplianceResult = ComplianceResult<WorldFacadeEvidence>;

export interface WorldFacadeComplianceAdapter {
  createWorld(): WorldInstance;
  createStore(): GovernedWorldStore;
  topLevelExports(): Record<string, unknown>;
  eventLog(): GovernanceEvent[];
}
