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
  STORE_ATOMICITY: "WFCTS-FACT-002",
  COORDINATOR_NORMAL: "WFCTS-COORD-001",
  COORDINATOR_CURRENT_SURFACE: "WFCTS-COORD-002",
  COORDINATOR_GENESIS: "WFCTS-COORD-003",
  COORDINATOR_RETRY: "WFCTS-COORD-004",
  RUNTIME_HAPPY_PATH: "WFCTS-RUNTIME-001",
  RUNTIME_FAILED_PATH: "WFCTS-RUNTIME-002",
  RUNTIME_EXECUTING_GUARD: "WFCTS-RUNTIME-003",
  RUNTIME_OUTCOME_GUARD: "WFCTS-RUNTIME-004",
  RUNTIME_TERMINAL_RESUME: "WFCTS-RUNTIME-005",
  RUNTIME_REPLAY_RECOVERY: "WFCTS-RUNTIME-006",
  RUNTIME_NON_TERMINAL_RESUME: "WFCTS-RUNTIME-007",
  RUNTIME_STALE_GUARD: "WFCTS-RUNTIME-008",
  RUNTIME_RACE_RECOVERY: "WFCTS-RUNTIME-009",
  RUNTIME_ABORT_FORWARD: "WFCTS-RUNTIME-010",
  RUNTIME_DISPATCH_FAILURE: "WFCTS-RUNTIME-011",
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
    "createWorld() and dedicated adapter subpaths provide the split-native assembly surface, including the seal transaction seam."
  ),
  complianceCase(
    WFCTS_CASES.STORE_ATOMICITY,
    "factory",
    "runInSealTransaction() is all-or-nothing and does not leave partial lineage writes behind on governance write failure."
  ),
  complianceCase(
    WFCTS_CASES.COORDINATOR_NORMAL,
    "coordinator",
    "Coordinator normal path preserves prepare -> finalize -> transaction -> dispatch ordering."
  ),
  complianceCase(
    WFCTS_CASES.COORDINATOR_CURRENT_SURFACE,
    "coordinator",
    "Coordinator current typed surface persists both lineage and governance writes through the transaction seam."
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
    WFCTS_CASES.RUNTIME_HAPPY_PATH,
    "runtime",
    "WorldRuntime loads the base snapshot from lineage, forwards execution inputs losslessly, and seals completed outcomes atomically."
  ),
  complianceCase(
    WFCTS_CASES.RUNTIME_FAILED_PATH,
    "runtime",
    "WorldRuntime seals failed terminal snapshots through the same governed transaction path and preserves failure events."
  ),
  complianceCase(
    WFCTS_CASES.RUNTIME_EXECUTING_GUARD,
    "runtime",
    "WorldRuntime rejects proposals that are not already executing before calling the executor."
  ),
  complianceCase(
    WFCTS_CASES.RUNTIME_OUTCOME_GUARD,
    "runtime",
    "WorldRuntime rejects executor outcomes that disagree with the terminal snapshot outcome."
  ),
  complianceCase(
    WFCTS_CASES.RUNTIME_TERMINAL_RESUME,
    "runtime",
    "WorldRuntime exposes explicit resume and seals already-terminal resume snapshots without re-invoking the executor."
  ),
  complianceCase(
    WFCTS_CASES.RUNTIME_REPLAY_RECOVERY,
    "runtime",
    "WorldRuntime converges replayed terminal proposals to recovered completions without duplicate execution or duplicate events."
  ),
  complianceCase(
    WFCTS_CASES.RUNTIME_NON_TERMINAL_RESUME,
    "runtime",
    "WorldRuntime resumes non-terminal snapshots from the supplied resumeSnapshot rather than proposal.baseWorld."
  ),
  complianceCase(
    WFCTS_CASES.RUNTIME_STALE_GUARD,
    "runtime",
    "WorldRuntime rejects stale executing proposals whose branch head or epoch moved past proposal.baseWorld."
  ),
  complianceCase(
    WFCTS_CASES.RUNTIME_RACE_RECOVERY,
    "runtime",
    "WorldRuntime converges seal races to recovered completions when another writer commits the proposal first."
  ),
  complianceCase(
    WFCTS_CASES.RUNTIME_ABORT_FORWARD,
    "runtime",
    "WorldRuntime forwards abort signals to WorldExecutor.abort() while execution is in flight."
  ),
  complianceCase(
    WFCTS_CASES.RUNTIME_DISPATCH_FAILURE,
    "runtime",
    "WorldRuntime surfaces post-commit event dispatch failures instead of converting them to recovered completions."
  ),
  complianceCase(
    WFCTS_CASES.SDK_ALIGNMENT,
    "matrix",
    "Factory caller preconditions, top-level orchestration exports, and adapter subpath hard-cut alignment are enforced as blocking facade rules."
  ),
] as const;

export const WORLD_FACADE_RULE_COVERAGE: readonly WorldFacadeComplianceCoverageEntry[] = [
  ...coverMany(["FACADE-REEXPORT-1", "FACADE-REEXPORT-3", "FACADE-EVT-3"], [WFCTS_CASES.REEXPORTS_FACADE]),
  ...coverMany(["FACADE-FACTORY-1", "FACADE-FACTORY-2", "FACADE-FACTORY-4", "FACADE-STORE-1", "FACADE-STORE-3", "FACADE-STORE-7"], [WFCTS_CASES.FACTORY_ASSEMBLY]),
  ...coverMany(["FACADE-STORE-2"], [WFCTS_CASES.STORE_ATOMICITY]),
  ...coverMany(["FACADE-COORD-1", "FACADE-COORD-2", "FACADE-COORD-3", "FACADE-COORD-5", "FACADE-COORD-11", "FACADE-EVT-1", "FACADE-EVT-2", "FACADE-EVT-5"], [WFCTS_CASES.COORDINATOR_NORMAL]),
  ...coverMany(["FACADE-STORE-3"], [WFCTS_CASES.COORDINATOR_CURRENT_SURFACE]),
  ...coverMany(["FACADE-COORD-6", "FACADE-COORD-7", "FACADE-COORD-8"], [WFCTS_CASES.COORDINATOR_GENESIS]),
  ...coverMany(["FACADE-COORD-9"], [WFCTS_CASES.COORDINATOR_RETRY]),
  ...coverMany(["FACADE-RUNTIME-1", "FACADE-RUNTIME-2", "FACADE-RUNTIME-3"], [WFCTS_CASES.RUNTIME_HAPPY_PATH]),
  ...coverMany(["FACADE-RUNTIME-3"], [WFCTS_CASES.RUNTIME_FAILED_PATH]),
  ...coverMany(["FACADE-RUNTIME-4"], [WFCTS_CASES.RUNTIME_EXECUTING_GUARD]),
  ...coverMany(["FACADE-RUNTIME-5"], [WFCTS_CASES.RUNTIME_OUTCOME_GUARD]),
  ...coverMany(["FACADE-RUNTIME-6", "FACADE-RUNTIME-7"], [WFCTS_CASES.RUNTIME_TERMINAL_RESUME]),
  ...coverMany(["FACADE-RUNTIME-8"], [WFCTS_CASES.RUNTIME_REPLAY_RECOVERY]),
  ...coverMany(["FACADE-RUNTIME-9"], [WFCTS_CASES.RUNTIME_NON_TERMINAL_RESUME]),
  ...coverMany(["FACADE-RUNTIME-10"], [WFCTS_CASES.RUNTIME_STALE_GUARD]),
  ...coverMany(["FACADE-RUNTIME-11"], [WFCTS_CASES.RUNTIME_RACE_RECOVERY]),
  ...coverMany(["FACADE-RUNTIME-12"], [WFCTS_CASES.RUNTIME_ABORT_FORWARD]),
  ...coverMany(["FACADE-RUNTIME-13"], [WFCTS_CASES.RUNTIME_DISPATCH_FAILURE]),
  ...coverMany(["FACADE-FACTORY-3", "FACADE-SDK-1", "FACADE-SDK-2"], [WFCTS_CASES.SDK_ALIGNMENT]),
] as const;

export function caseTitle(caseId: string, description: string): string {
  return `${caseId}: ${description}`;
}
