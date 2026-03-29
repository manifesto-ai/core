import type {
  GovernanceComplianceCase,
  GovernanceComplianceCoverageEntry,
  GovernanceComplianceSuite,
} from "./gcts-types.js";

function complianceCase(
  caseId: string,
  suite: GovernanceComplianceSuite,
  description: string
): GovernanceComplianceCase {
  return { caseId, suite, description };
}

function coverMany(ruleIds: readonly string[], caseIds: readonly string[]): GovernanceComplianceCoverageEntry[] {
  return ruleIds.map((ruleId) => ({ ruleId, caseIds: [...caseIds] }));
}

export const GCTS_CASES = {
  LIFECYCLE_STATE_MACHINE: "GCTS-LIFE-001",
  LIFECYCLE_BRANCH_GATES: "GCTS-LIFE-002",
  LIFECYCLE_FINALIZE_PURITY: "GCTS-LIFE-003",
  SEAMS_NATIVE_SURFACE: "GCTS-SEAM-001",
} as const;

export const GOVERNANCE_COMPLIANCE_CASES: readonly GovernanceComplianceCase[] = [
  complianceCase(
    GCTS_CASES.LIFECYCLE_STATE_MACHINE,
    "lifecycle",
    "Native governance implements monotonic transitions including ingress-terminal superseded."
  ),
  complianceCase(
    GCTS_CASES.LIFECYCLE_BRANCH_GATES,
    "lifecycle",
    "Native governance enforces branch identity, gate occupancy, stale head invalidation, and stale-result discard."
  ),
  complianceCase(
    GCTS_CASES.LIFECYCLE_FINALIZE_PURITY,
    "lifecycle",
    "Seal finalization stays pure for both normal and seal-rejection paths."
  ),
  complianceCase(
    GCTS_CASES.SEAMS_NATIVE_SURFACE,
    "seams",
    "Governance package exposes native store/service exports without world or host internals."
  ),
] as const;

export const GOVERNANCE_RULE_COVERAGE: readonly GovernanceComplianceCoverageEntry[] = [
  ...coverMany(
    ["GOV-TRANS-1", "GOV-STAGE-7", "GOV-TRANS-3", "GOV-TRANS-4", "GOV-BRANCH-1"],
    [GCTS_CASES.LIFECYCLE_STATE_MACHINE]
  ),
  ...coverMany(
    ["GOV-BRANCH-GATE-1", "GOV-BRANCH-GATE-5", "GOV-BRANCH-GATE-6", "GOV-BRANCH-GATE-7"],
    [GCTS_CASES.LIFECYCLE_BRANCH_GATES]
  ),
  ...coverMany(["GOV-SEAL-2"], [GCTS_CASES.LIFECYCLE_FINALIZE_PURITY]),
  ...coverMany(["GOV-BOUNDARY-5", "GOV-DEP-1", "GOV-STORE-3", "GOV-STORE-4"], [GCTS_CASES.SEAMS_NATIVE_SURFACE]),
] as const;

export function caseTitle(caseId: string, description: string): string {
  return `${caseId}: ${description}`;
}
