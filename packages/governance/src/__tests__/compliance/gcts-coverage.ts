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
  LIFECYCLE_MONOTONIC: "GCTS-LIFE-001",
  LIFECYCLE_SPLIT_TRACKING: "GCTS-LIFE-002",
  SEAMS_SMOKE: "GCTS-SEAM-001",
} as const;

export const GOVERNANCE_COMPLIANCE_CASES: readonly GovernanceComplianceCase[] = [
  complianceCase(
    GCTS_CASES.LIFECYCLE_MONOTONIC,
    "lifecycle",
    "Legacy world-backed governance preserves the current monotonic proposal state machine."
  ),
  complianceCase(
    GCTS_CASES.LIFECYCLE_SPLIT_TRACKING,
    "lifecycle",
    "Split-only governance rules remain visible as pending CTS entries."
  ),
  complianceCase(
    GCTS_CASES.SEAMS_SMOKE,
    "seams",
    "Governance package exposes a narrow compatibility surface without lineage hash helpers."
  ),
] as const;

export const GOVERNANCE_RULE_COVERAGE: readonly GovernanceComplianceCoverageEntry[] = [
  ...coverMany(["GOV-TRANS-1"], [GCTS_CASES.LIFECYCLE_MONOTONIC]),
  ...coverMany(
    ["GOV-STAGE-7", "GOV-TRANS-3", "GOV-TRANS-4", "GOV-BRANCH-1", "GOV-BRANCH-GATE-1", "GOV-SEAL-2"],
    [GCTS_CASES.LIFECYCLE_SPLIT_TRACKING]
  ),
  ...coverMany(["GOV-BOUNDARY-5", "GOV-DEP-1", "GOV-STORE-3"], [GCTS_CASES.SEAMS_SMOKE]),
] as const;

export function caseTitle(caseId: string, description: string): string {
  return `${caseId}: ${description}`;
}
