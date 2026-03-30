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
  LIFECYCLE_OUTCOME_CROSSCHECK: "GCTS-LIFE-004",
  LIFECYCLE_ATTEMPT_PROVENANCE: "GCTS-LIFE-005",
  EVENTS_DISPATCHER_SURFACE: "GCTS-EVT-001",
  EVENTS_POST_COMMIT_OUTCOMES: "GCTS-EVT-002",
  EVENTS_FAILED_PAYLOAD: "GCTS-EVT-003",
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
    "Seal finalization stays pure on the current finalize() path."
  ),
  complianceCase(
    GCTS_CASES.LIFECYCLE_OUTCOME_CROSSCHECK,
    "lifecycle",
    "finalize() cross-checks derived outcome against lineage terminalStatus before producing a governance commit."
  ),
  complianceCase(
    GCTS_CASES.LIFECYCLE_ATTEMPT_PROVENANCE,
    "lifecycle",
    "Governance-active seals preserve proposal provenance through lineage SealAttempt records."
  ),
  complianceCase(
    GCTS_CASES.EVENTS_DISPATCHER_SURFACE,
    "events",
    "Governance exports a facade-compatible dispatcher factory whose public surface is emitSealCompleted() only."
  ),
  complianceCase(
    GCTS_CASES.EVENTS_POST_COMMIT_OUTCOMES,
    "events",
    "Governance emits execution outcome events only through the explicit post-commit dispatcher path."
  ),
  complianceCase(
    GCTS_CASES.EVENTS_FAILED_PAYLOAD,
    "events",
    "execution:failed payloads expose currentError and pendingRequirements without accumulated error history."
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
  ...coverMany(["GOV-SEAL-1"], [GCTS_CASES.LIFECYCLE_OUTCOME_CROSSCHECK]),
  ...coverMany(["INV-G12"], [GCTS_CASES.LIFECYCLE_ATTEMPT_PROVENANCE]),
  ...coverMany(["GOV-EVT-DISP-1", "GOV-EVT-DISP-2"], [GCTS_CASES.EVENTS_DISPATCHER_SURFACE]),
  ...coverMany(
    ["GOV-EVT-DISP-3", "GOV-EXEC-EVT-1", "GOV-EXEC-EVT-2", "GOV-EXEC-EVT-3", "GOV-EXEC-EVT-4"],
    [GCTS_CASES.EVENTS_POST_COMMIT_OUTCOMES]
  ),
  ...coverMany(["GOV-EXEC-EVT-5"], [GCTS_CASES.EVENTS_FAILED_PAYLOAD]),
  ...coverMany(["GOV-BOUNDARY-5", "GOV-DEP-1", "GOV-STORE-3", "GOV-STORE-4"], [GCTS_CASES.SEAMS_NATIVE_SURFACE]),
] as const;

export function caseTitle(caseId: string, description: string): string {
  return `${caseId}: ${description}`;
}
