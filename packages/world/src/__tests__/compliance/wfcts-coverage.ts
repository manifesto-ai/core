import type {
  WorldFacadeComplianceCase,
  WorldFacadeComplianceCoverageEntry,
  WorldFacadeComplianceSuite,
} from "./wfcts-types.js";

function complianceCase(
  caseId: string,
  suite: WorldFacadeComplianceSuite,
  description: string
): WorldFacadeComplianceCase {
  return { caseId, suite, description };
}

function coverMany(ruleIds: readonly string[], caseIds: readonly string[]): WorldFacadeComplianceCoverageEntry[] {
  return ruleIds.map((ruleId) => ({ ruleId, caseIds: [...caseIds] }));
}

export const WFCTS_CASES = {
  REEXPORTS_SMOKE: "WFCTS-REEXP-001",
  FACTORY_SMOKE: "WFCTS-FACT-001",
  COORDINATOR_TRACKING: "WFCTS-COORD-001",
} as const;

export const WORLD_FACADE_COMPLIANCE_CASES: readonly WorldFacadeComplianceCase[] = [
  complianceCase(
    WFCTS_CASES.REEXPORTS_SMOKE,
    "reexports",
    "Legacy world package keeps the current facade-compatible export surface stable."
  ),
  complianceCase(
    WFCTS_CASES.FACTORY_SMOKE,
    "factory",
    "Legacy createManifestoWorld() and createMemoryWorldStore() remain usable as the pre-split compatibility factory surface."
  ),
  complianceCase(
    WFCTS_CASES.COORDINATOR_TRACKING,
    "coordinator",
    "Coordinator ordering and retry rules remain visible as pending CTS entries."
  ),
] as const;

export const WORLD_FACADE_RULE_COVERAGE: readonly WorldFacadeComplianceCoverageEntry[] = [
  ...coverMany(["FACADE-REEXPORT-1", "FACADE-REEXPORT-3"], [WFCTS_CASES.REEXPORTS_SMOKE]),
  ...coverMany(["FACADE-FACTORY-1", "FACADE-FACTORY-4", "FACADE-STORE-7"], [WFCTS_CASES.FACTORY_SMOKE]),
  ...coverMany(["FACADE-COORD-1", "FACADE-COORD-2", "FACADE-COORD-3", "FACADE-COORD-4", "FACADE-COORD-9"], [WFCTS_CASES.COORDINATOR_TRACKING]),
] as const;

export function caseTitle(caseId: string, description: string): string {
  return `${caseId}: ${description}`;
}
