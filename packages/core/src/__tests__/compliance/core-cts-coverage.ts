import type {
  CoreComplianceCase,
  CoreComplianceCoverageEntry,
  CoreComplianceSuite,
} from "./core-cts-types.js";

function complianceCase(
  caseId: string,
  suite: CoreComplianceSuite,
  description: string,
): CoreComplianceCase {
  return { caseId, suite, description };
}

function coverMany(ruleIds: readonly string[], caseIds: readonly string[]): CoreComplianceCoverageEntry[] {
  return ruleIds.map((ruleId) => ({ ruleId, caseIds: [...caseIds] }));
}

export const CORE_CTS_CASES = {
  SCHEMA_VALIDATION: "CORE-CTS-SCHEMA-001",
  SCHEMA_RESERVED_AND_RUNTIME_PATHS: "CORE-CTS-SCHEMA-002",
  SNAPSHOT_ONTOLOGY: "CORE-CTS-SNAP-001",
  SNAPSHOT_NAMESPACE_DELTAS: "CORE-CTS-SNAP-002",
  PATCH_DOMAIN_ROOT: "CORE-CTS-PATCH-001",
  SYSTEM_DELTA: "CORE-CTS-PATCH-002",
  COMPUTE_ADMISSION: "CORE-CTS-COMP-001",
  FLOW_EFFECT_AND_ERROR: "CORE-CTS-COMP-002",
  EXPR_TOTALITY: "CORE-CTS-EXPR-001",
  EXPR_NAMESPACE_BOUNDARY: "CORE-CTS-EXPR-002",
  ACTION_QUERIES: "CORE-CTS-QUERY-001",
  TRACE_AND_HASH: "CORE-CTS-TRACE-001",
} as const;

export const CORE_COMPLIANCE_CASES: readonly CoreComplianceCase[] = [
  complianceCase(CORE_CTS_CASES.SCHEMA_VALIDATION, "schema", "Schema validation rule ids and type seams are enforced."),
  complianceCase(CORE_CTS_CASES.SCHEMA_RESERVED_AND_RUNTIME_PATHS, "schema", "Reserved state identifiers and runtime expression boundaries are enforced."),
  complianceCase(CORE_CTS_CASES.SNAPSHOT_ONTOLOGY, "snapshot", "Canonical Snapshot state/namespaces ontology is enforced."),
  complianceCase(CORE_CTS_CASES.SNAPSHOT_NAMESPACE_DELTAS, "snapshot", "NamespaceDelta isolation, root, and validation behavior is enforced."),
  complianceCase(CORE_CTS_CASES.PATCH_DOMAIN_ROOT, "patch-and-system", "Domain patches are rooted at snapshot.state and cannot address platform roots."),
  complianceCase(CORE_CTS_CASES.SYSTEM_DELTA, "patch-and-system", "System changes use SystemDelta rather than domain patches."),
  complianceCase(CORE_CTS_CASES.COMPUTE_ADMISSION, "compute-and-flow", "Intent input and initial availability admission are enforced."),
  complianceCase(CORE_CTS_CASES.FLOW_EFFECT_AND_ERROR, "compute-and-flow", "Flow effect and fail semantics produce Snapshot-visible values."),
  complianceCase(CORE_CTS_CASES.EXPR_TOTALITY, "expr", "Expression edge semantics remain total and deterministic."),
  complianceCase(CORE_CTS_CASES.EXPR_NAMESPACE_BOUNDARY, "expr", "User-authored expressions cannot read platform namespaces."),
  complianceCase(CORE_CTS_CASES.ACTION_QUERIES, "availability-dispatchability", "Availability and dispatchability query contracts are enforced."),
  complianceCase(CORE_CTS_CASES.TRACE_AND_HASH, "trace-and-hash", "Trace surface and canonical hash determinism are enforced."),
] as const;

export const CORE_RULE_COVERAGE: readonly CoreComplianceCoverageEntry[] = [
  ...coverMany(["SCHEMA-RESERVED-1", "V-011"], [CORE_CTS_CASES.SCHEMA_RESERVED_AND_RUNTIME_PATHS]),
  ...coverMany(["SCHEMA-RESERVED-2"], [CORE_CTS_CASES.SNAPSHOT_ONTOLOGY, CORE_CTS_CASES.PATCH_DOMAIN_ROOT]),
  ...coverMany(["V-001", "V-002", "V-003", "V-004", "V-005", "V-007", "V-010"], [CORE_CTS_CASES.SCHEMA_VALIDATION]),
  ...coverMany(["V-006", "V-009"], [CORE_CTS_CASES.COMPUTE_ADMISSION, CORE_CTS_CASES.ACTION_QUERIES]),
  ...coverMany(["V-008"], [CORE_CTS_CASES.TRACE_AND_HASH]),
  ...coverMany(["V-012"], [CORE_CTS_CASES.SCHEMA_RESERVED_AND_RUNTIME_PATHS]),
  ...coverMany(["R-001", "R-002"], [CORE_CTS_CASES.COMPUTE_ADMISSION]),
  ...coverMany(["R-003", "R-004", "R-006", "NSDELTA-2"], [CORE_CTS_CASES.PATCH_DOMAIN_ROOT]),
  ...coverMany(["R-005", "R-007", "R-008", "NSDELTA-1", "NSDELTA-3"], [CORE_CTS_CASES.SNAPSHOT_NAMESPACE_DELTAS]),
  ...coverMany(["NSDELTA-1a", "NSDELTA-1b", "NSDELTA-2a"], [CORE_CTS_CASES.SNAPSHOT_NAMESPACE_DELTAS]),
  ...coverMany(["NSINIT-1", "NSINIT-2", "NSINIT-3", "NSINIT-4", "NSINIT-5"], [CORE_CTS_CASES.SNAPSHOT_ONTOLOGY]),
  ...coverMany(["NSREAD-1"], [CORE_CTS_CASES.EXPR_NAMESPACE_BOUNDARY]),
  ...coverMany(["TRACE-NS-1", "TRACE-NS-2", "TRACE-NS-3", "TRACE-NS-4", "NSDELTA-4", "NSREAD-2", "NSREAD-3", "NSREAD-4"], [CORE_CTS_CASES.TRACE_AND_HASH]),
  ...coverMany(["AVAIL-Q-1", "AVAIL-Q-2", "AVAIL-Q-3", "AVAIL-Q-4", "AVAIL-Q-5", "AVAIL-Q-6", "AVAIL-Q-7"], [CORE_CTS_CASES.ACTION_QUERIES]),
  ...coverMany(["DISP-Q-1", "DISP-Q-2", "DISP-Q-3", "DISP-Q-4", "DISP-Q-5", "DISP-Q-6"], [CORE_CTS_CASES.ACTION_QUERIES]),
] as const;
