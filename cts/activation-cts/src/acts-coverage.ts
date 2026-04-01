import type {
  ActivationComplianceCase,
  ActivationComplianceCoverageEntry,
  ActivationComplianceSuite,
} from "./acts-types.js";

function complianceCase(
  caseId: string,
  suite: ActivationComplianceSuite,
  description: string,
): ActivationComplianceCase {
  return { caseId, suite, description };
}

function coverMany(
  ruleIds: readonly string[],
  caseIds: readonly string[],
): ActivationComplianceCoverageEntry[] {
  return ruleIds.map((ruleId) => ({ ruleId, caseIds: [...caseIds] }));
}

export const ACTS_CASES = {
  BASE_COMPOSABLE_SURFACE: "ACTS-BASE-001",
  BASE_ACTIVATION_CHAIN: "ACTS-BASE-002",
  BASE_DEQUEUE_AVAILABILITY: "ACTS-BASE-003",
  BASE_MUTATION_SAFETY: "ACTS-BASE-004",
  LINEAGE_COMPOSABLE_SURFACE: "ACTS-LIN-001",
  LINEAGE_SEAL_PUBLICATION: "ACTS-LIN-002",
  GOVERNANCE_COMPOSABLE_SURFACE: "ACTS-GOV-001",
  GOVERNANCE_AUTO_LINEAGE: "ACTS-GOV-002",
  GOVERNANCE_EXPLICIT_PRECEDENCE: "ACTS-GOV-003",
  TYPES_PRE_ACTIVATION: "ACTS-TYPE-001",
  TYPES_GOVERNED_RUNTIME: "ACTS-TYPE-002",
  TYPES_LINEAGE_CONFIG: "ACTS-TYPE-003",
} as const;

export const ACTIVATION_COMPLIANCE_CASES: readonly ActivationComplianceCase[] = [
  complianceCase(
    ACTS_CASES.BASE_COMPOSABLE_SURFACE,
    "base",
    "Base createManifesto() returns a composable object with no runtime verbs and one-shot activation.",
  ),
  complianceCase(
    ACTS_CASES.BASE_ACTIVATION_CHAIN,
    "base",
    "Base activation chain creates typed intents and executes dispatchAsync successfully.",
  ),
  complianceCase(
    ACTS_CASES.BASE_DEQUEUE_AVAILABILITY,
    "base",
    "Queued intents are evaluated for availability at dequeue time, not enqueue time.",
  ),
  complianceCase(
    ACTS_CASES.BASE_MUTATION_SAFETY,
    "base",
    "Visible snapshot reads are mutation-safe and do not leak external changes back in.",
  ),
  complianceCase(
    ACTS_CASES.LINEAGE_COMPOSABLE_SURFACE,
    "lineage",
    "withLineage() stays pre-activation and one-shot until runtime opens.",
  ),
  complianceCase(
    ACTS_CASES.LINEAGE_SEAL_PUBLICATION,
    "lineage",
    "Lineage commit publishes only after seal commit succeeds and does not publish on commit failure.",
  ),
  complianceCase(
    ACTS_CASES.GOVERNANCE_COMPOSABLE_SURFACE,
    "governance",
    "withGovernance() stays pre-activation and one-shot until runtime opens.",
  ),
  complianceCase(
    ACTS_CASES.GOVERNANCE_AUTO_LINEAGE,
    "governance",
    "Governance requires explicit lineage composition and removes direct dispatchAsync and commitAsync from the governed runtime.",
  ),
  complianceCase(
    ACTS_CASES.GOVERNANCE_EXPLICIT_PRECEDENCE,
    "governance",
    "Governance reuses the explicitly composed lineage service.",
  ),
  complianceCase(
    ACTS_CASES.TYPES_PRE_ACTIVATION,
    "types",
    "Pre-activation base, lineage, and governance composables reject runtime verbs at compile time.",
  ),
  complianceCase(
    ACTS_CASES.TYPES_GOVERNED_RUNTIME,
    "types",
    "Lineage and governed runtimes reject superseded verbs at compile time while exposing commitAsync or proposeAsync as appropriate.",
  ),
  complianceCase(
    ACTS_CASES.TYPES_LINEAGE_CONFIG,
    "types",
    "withGovernance() requires explicit lineage composition, withLineage() requires a non-empty config, and governed composables cannot be downgraded.",
  ),
] as const;

export const ACTIVATION_RULE_COVERAGE: readonly ActivationComplianceCoverageEntry[] = [
  ...coverMany(
    ["ACTS-BASE-1", "ACTS-BASE-2"],
    [ACTS_CASES.BASE_COMPOSABLE_SURFACE],
  ),
  ...coverMany(
    ["ACTS-BASE-3"],
    [ACTS_CASES.BASE_ACTIVATION_CHAIN],
  ),
  ...coverMany(
    ["ACTS-BASE-4"],
    [ACTS_CASES.BASE_DEQUEUE_AVAILABILITY],
  ),
  ...coverMany(
    ["ACTS-BASE-5"],
    [ACTS_CASES.BASE_MUTATION_SAFETY],
  ),
  ...coverMany(
    ["ACTS-LIN-1", "ACTS-LIN-3"],
    [ACTS_CASES.LINEAGE_COMPOSABLE_SURFACE],
  ),
  ...coverMany(
    ["ACTS-LIN-2"],
    [ACTS_CASES.LINEAGE_SEAL_PUBLICATION],
  ),
  ...coverMany(
    ["ACTS-GOV-1", "ACTS-GOV-5"],
    [ACTS_CASES.GOVERNANCE_COMPOSABLE_SURFACE],
  ),
  ...coverMany(
    ["ACTS-GOV-2", "ACTS-GOV-3"],
    [ACTS_CASES.GOVERNANCE_AUTO_LINEAGE],
  ),
  ...coverMany(
    ["ACTS-GOV-4"],
    [ACTS_CASES.GOVERNANCE_EXPLICIT_PRECEDENCE],
  ),
  ...coverMany(
    ["ACTS-TYPE-1"],
    [ACTS_CASES.TYPES_PRE_ACTIVATION],
  ),
  ...coverMany(
    ["ACTS-TYPE-2"],
    [ACTS_CASES.TYPES_GOVERNED_RUNTIME],
  ),
  ...coverMany(
    ["ACTS-TYPE-3"],
    [ACTS_CASES.TYPES_LINEAGE_CONFIG],
  ),
] as const;

export function caseTitle(caseId: string, description: string): string {
  return `${caseId}: ${description}`;
}
