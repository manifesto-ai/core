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

export const ACTS_SUITES = [
  "base",
  "lineage",
  "governance",
  "types",
  "matrix",
] as const;

export type ActivationComplianceSuite = (typeof ACTS_SUITES)[number];

export type {
  ComplianceStatus,
  RuleLevel,
  RuleLifecycle,
  RuleMode,
};

export type ActivationEvidence = ComplianceEvidence;

export type ActivationComplianceInventoryItem =
  ComplianceInventoryItem<ActivationComplianceSuite>;

export type ActivationComplianceRule =
  ComplianceRule<ActivationComplianceSuite>;

export type ActivationComplianceCase =
  ComplianceCase<ActivationComplianceSuite>;

export type ActivationComplianceCoverageEntry = ComplianceCoverageEntry;

export type ActivationComplianceResult =
  ComplianceResult<ActivationEvidence>;
