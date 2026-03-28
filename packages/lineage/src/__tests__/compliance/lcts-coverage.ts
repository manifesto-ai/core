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
  WORLD_ID_DETERMINISM: "LCTS-ID-002",
  SEAMS_SURFACE: "LCTS-SEAM-001",
  STAGED_RULES: "LCTS-SEAM-002",
} as const;

export const LINEAGE_COMPLIANCE_CASES: readonly LineageComplianceCase[] = [
  complianceCase(
    LCTS_CASES.HASH_DETERMINISM,
    "identity",
    "Snapshot hash stays stable across platform/meta-only changes and changes when semantic data changes."
  ),
  complianceCase(
    LCTS_CASES.WORLD_ID_DETERMINISM,
    "identity",
    "WorldId derivation is deterministic for the same schemaHash and snapshotHash."
  ),
  complianceCase(
    LCTS_CASES.SEAMS_SURFACE,
    "seams",
    "Lineage package exposes lineage helpers without governance lifecycle/event exports."
  ),
  complianceCase(
    LCTS_CASES.STAGED_RULES,
    "seams",
    "Split-only lineage prepare/store rules remain visible as pending CTS entries."
  ),
] as const;

export const LINEAGE_RULE_COVERAGE: readonly LineageComplianceCoverageEntry[] = [
  ...coverMany(
    ["LIN-HASH-1", "LIN-HASH-4a", "LIN-HASH-4b", "LIN-HASH-5", "LIN-HASH-6", "LIN-HASH-7", "LIN-HASH-9", "LIN-HASH-10"],
    [LCTS_CASES.HASH_DETERMINISM]
  ),
  ...coverMany(["LIN-ID-1"], [LCTS_CASES.WORLD_ID_DETERMINISM]),
  ...coverMany(["LIN-BOUNDARY-1", "LIN-BOUNDARY-4"], [LCTS_CASES.SEAMS_SURFACE]),
  ...coverMany(["LIN-SEAL-PURE-1", "LIN-COLLISION-1", "LIN-HEAD-ADV-1", "LIN-STORE-3"], [LCTS_CASES.STAGED_RULES]),
] as const;

export function caseTitle(caseId: string, description: string): string {
  return `${caseId}: ${description}`;
}
