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

export const CORE_CTS_SUITES = [
  "schema",
  "snapshot",
  "patch-and-system",
  "compute-and-flow",
  "expr",
  "availability-dispatchability",
  "trace-and-hash",
  "matrix",
] as const;

export type CoreComplianceSuite = (typeof CORE_CTS_SUITES)[number];

export type {
  ComplianceStatus,
  RuleLevel,
  RuleLifecycle,
  RuleMode,
};

export type CoreEvidence = ComplianceEvidence;

export type CoreComplianceInventoryItem = ComplianceInventoryItem<CoreComplianceSuite>;

export type CoreComplianceRule = ComplianceRule<CoreComplianceSuite>;

export type CoreComplianceCase = ComplianceCase<CoreComplianceSuite>;

export type CoreComplianceCoverageEntry = ComplianceCoverageEntry;

export type CoreComplianceResult = ComplianceResult<CoreEvidence>;
