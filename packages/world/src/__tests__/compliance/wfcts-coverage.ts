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
  REEXPORTS_FACADE: "WFCTS-REEXP-001",
  FACTORY_ASSEMBLY: "WFCTS-FACT-001",
  COORDINATOR_NORMAL: "WFCTS-COORD-001",
  COORDINATOR_REJECTION: "WFCTS-COORD-002",
  COORDINATOR_GENESIS: "WFCTS-COORD-003",
  COORDINATOR_RETRY: "WFCTS-COORD-004",
  SDK_ALIGNMENT: "WFCTS-MATRIX-001",
} as const;

export const WORLD_FACADE_COMPLIANCE_CASES: readonly WorldFacadeComplianceCase[] = [
  complianceCase(
    WFCTS_CASES.REEXPORTS_FACADE,
    "reexports",
    "Top-level world is the canonical facade surface and preserves split-native pass-through identity."
  ),
  complianceCase(
    WFCTS_CASES.FACTORY_ASSEMBLY,
    "factory",
    "createWorld() and createInMemoryWorldStore() provide the split-native assembly surface."
  ),
  complianceCase(
    WFCTS_CASES.COORDINATOR_NORMAL,
    "coordinator",
    "Coordinator normal path preserves prepare -> finalize -> commit -> dispatch ordering."
  ),
  complianceCase(
    WFCTS_CASES.COORDINATOR_REJECTION,
    "coordinator",
    "Coordinator rejection path routes through finalizeOnSealRejection and governance-only commit."
  ),
  complianceCase(
    WFCTS_CASES.COORDINATOR_GENESIS,
    "coordinator",
    "Coordinator distinguishes standalone genesis from governed genesis."
  ),
  complianceCase(
    WFCTS_CASES.COORDINATOR_RETRY,
    "coordinator",
    "Coordinator retries from prepare on CAS mismatch."
  ),
  complianceCase(
    WFCTS_CASES.SDK_ALIGNMENT,
    "matrix",
    "Factory caller preconditions and SDK hard-cut alignment are enforced as blocking facade rules."
  ),
] as const;

export const WORLD_FACADE_RULE_COVERAGE: readonly WorldFacadeComplianceCoverageEntry[] = [
  ...coverMany(["FACADE-REEXPORT-1", "FACADE-REEXPORT-3"], [WFCTS_CASES.REEXPORTS_FACADE]),
  ...coverMany(["FACADE-FACTORY-1", "FACADE-FACTORY-2", "FACADE-FACTORY-4", "FACADE-STORE-7", "FACADE-WS-1", "FACADE-WS-2", "FACADE-WS-3"], [WFCTS_CASES.FACTORY_ASSEMBLY]),
  ...coverMany(["FACADE-COORD-1", "FACADE-COORD-2", "FACADE-COORD-3", "FACADE-COORD-11"], [WFCTS_CASES.COORDINATOR_NORMAL]),
  ...coverMany(["FACADE-COORD-4"], [WFCTS_CASES.COORDINATOR_REJECTION]),
  ...coverMany(["FACADE-COORD-6", "FACADE-COORD-7", "FACADE-COORD-8"], [WFCTS_CASES.COORDINATOR_GENESIS]),
  ...coverMany(["FACADE-COORD-9"], [WFCTS_CASES.COORDINATOR_RETRY]),
  ...coverMany(["FACADE-FACTORY-3", "FACADE-SDK-1", "FACADE-SDK-2"], [WFCTS_CASES.SDK_ALIGNMENT]),
] as const;

export function caseTitle(caseId: string, description: string): string {
  return `${caseId}: ${description}`;
}
