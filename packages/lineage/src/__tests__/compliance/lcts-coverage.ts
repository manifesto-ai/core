import type {
  LineageComplianceCase,
  LineageComplianceCoverageEntry,
  LineageComplianceSuite,
} from "./lcts-types.js";

function complianceCase(
  caseId: string,
  suite: LineageComplianceSuite,
  description: string
): LineageComplianceCase {
  return { caseId, suite, description };
}

function coverMany(ruleIds: readonly string[], caseIds: readonly string[]): LineageComplianceCoverageEntry[] {
  return ruleIds.map((ruleId) => ({ ruleId, caseIds: [...caseIds] }));
}

export const LCTS_CASES = {
  HASH_DETERMINISM: "LCTS-ID-001",
  CURRENT_ERROR_IDENTITY: "LCTS-ID-002",
  POSITIONAL_WORLD_ID: "LCTS-ID-003",
  REPEATED_FAILURE_IDENTITY: "LCTS-ID-004",
  PREPARE_PURITY: "LCTS-BRANCH-001",
  BRANCH_CAS: "LCTS-BRANCH-002",
  HEAD_TIP_SEMANTICS: "LCTS-BRANCH-003",
  LATEST_HEAD_SELECTION: "LCTS-BRANCH-004",
  ATTEMPT_PERSISTENCE: "LCTS-ATTEMPT-001",
  IDEMPOTENT_REUSE: "LCTS-ATTEMPT-002",
  RESTORE_NORMALIZATION: "LCTS-RESTORE-001",
  SEAMS_SURFACE: "LCTS-SEAM-001",
} as const;

export const LINEAGE_COMPLIANCE_CASES: readonly LineageComplianceCase[] = [
  complianceCase(
    LCTS_CASES.HASH_DETERMINISM,
    "identity",
    "Snapshot hash stays stable across platform/meta-only changes and tracks hash-visible fields only."
  ),
  complianceCase(
    LCTS_CASES.CURRENT_ERROR_IDENTITY,
    "identity",
    "Current error identity uses only lastError.code and source, not error history or non-hash fields."
  ),
  complianceCase(
    LCTS_CASES.POSITIONAL_WORLD_ID,
    "identity",
    "WorldId is positional and changes when parentWorldId changes."
  ),
  complianceCase(
    LCTS_CASES.REPEATED_FAILURE_IDENTITY,
    "identity",
    "Repeated identical failures on the same branch produce distinct Worlds because tip changes."
  ),
  complianceCase(
    LCTS_CASES.PREPARE_PURITY,
    "branch",
    "prepareSealGenesis() and prepareSealNext() are deterministic read-only preparations."
  ),
  complianceCase(
    LCTS_CASES.BRANCH_CAS,
    "branch",
    "Branch CAS guards head, tip, and epoch together and rejects stale prepared commits atomically."
  ),
  complianceCase(
    LCTS_CASES.HEAD_TIP_SEMANTICS,
    "branch",
    "Completed seals advance head and tip; failed seals advance tip only."
  ),
  complianceCase(
    LCTS_CASES.LATEST_HEAD_SELECTION,
    "branch",
    "Latest head selection follows branch headAdvancedAt chronology."
  ),
  complianceCase(
    LCTS_CASES.ATTEMPT_PERSISTENCE,
    "attempts",
    "Every successful seal persists exactly one SealAttempt and exposes attempt chronology by world and branch."
  ),
  complianceCase(
    LCTS_CASES.IDEMPOTENT_REUSE,
    "attempts",
    "Same-parent same-snapshot seals reuse the existing world while preserving first-written substrate."
  ),
  complianceCase(
    LCTS_CASES.RESTORE_NORMALIZATION,
    "restore",
    "restore() resets non-hash runtime fields while preserving semantic snapshot content."
  ),
  complianceCase(
    LCTS_CASES.SEAMS_SURFACE,
    "seams",
    "Lineage stays governance-free and exposes branch-plus-attempt store seams."
  ),
] as const;

export const LINEAGE_RULE_COVERAGE: readonly LineageComplianceCoverageEntry[] = [
  ...coverMany(
    ["LIN-HASH-1", "LIN-HASH-4a", "LIN-HASH-4b", "LIN-HASH-5", "LIN-HASH-6", "LIN-HASH-7", "LIN-HASH-10", "LIN-HASH-11"],
    [LCTS_CASES.HASH_DETERMINISM]
  ),
  ...coverMany(["LIN-HASH-3a", "LIN-HASH-3c", "LIN-HASH-3d"], [LCTS_CASES.CURRENT_ERROR_IDENTITY]),
  ...coverMany(["LIN-ID-1", "LIN-ID-2", "LIN-ID-3", "LIN-ID-4"], [LCTS_CASES.POSITIONAL_WORLD_ID, LCTS_CASES.REPEATED_FAILURE_IDENTITY]),
  ...coverMany(["LIN-SEAL-PURE-1"], [LCTS_CASES.PREPARE_PURITY]),
  ...coverMany(["LIN-STORE-4"], [LCTS_CASES.BRANCH_CAS]),
  ...coverMany(["LIN-HEAD-ADV-1", "MRKL-TIP-1", "MRKL-TIP-2"], [LCTS_CASES.HEAD_TIP_SEMANTICS]),
  ...coverMany(["MRKL-HEAD-5"], [LCTS_CASES.LATEST_HEAD_SELECTION]),
  ...coverMany(["MRKL-ATTEMPT-2"], [LCTS_CASES.ATTEMPT_PERSISTENCE]),
  ...coverMany(["MRKL-REUSE-1", "MRKL-REUSE-2", "MRKL-STORE-4"], [LCTS_CASES.IDEMPOTENT_REUSE]),
  ...coverMany(["MRKL-RESTORE-1", "MRKL-RESTORE-2", "MRKL-RESTORE-3", "MRKL-RESTORE-3a", "MRKL-RESTORE-4"], [LCTS_CASES.RESTORE_NORMALIZATION]),
  ...coverMany(["LIN-BOUNDARY-1", "LIN-BOUNDARY-4", "LIN-STORE-3"], [LCTS_CASES.SEAMS_SURFACE]),
] as const;

export function caseTitle(caseId: string, description: string): string {
  return `${caseId}: ${description}`;
}
