import type {
  GovernanceComplianceInventoryItem,
  GovernanceComplianceSuite,
  RuleLevel,
  RuleLifecycle,
} from "./gcts-types.js";

function inventory(
  ruleId: string,
  specSection: string,
  level: RuleLevel,
  suite: GovernanceComplianceSuite,
  options?: {
    lifecycle?: RuleLifecycle;
    notes?: string;
  }
): GovernanceComplianceInventoryItem {
  return {
    ruleId,
    specSection,
    level,
    suite,
    lifecycle: options?.lifecycle ?? "active",
    notes: options?.notes,
  };
}

function inventoryMany(
  ruleIds: readonly string[],
  specSection: string,
  level: RuleLevel,
  suite: GovernanceComplianceSuite,
  options?: {
    lifecycle?: RuleLifecycle;
    notes?: string;
  }
): GovernanceComplianceInventoryItem[] {
  return ruleIds.map((ruleId) => inventory(ruleId, specSection, level, suite, options));
}

export const GOVERNANCE_SPEC_INVENTORY: readonly GovernanceComplianceInventoryItem[] = [
  inventory("GOV-TRANS-1", "§6.6", "MUST", "lifecycle"),
  ...inventoryMany(["GOV-STAGE-7", "GOV-TRANS-3", "GOV-TRANS-4"], "§6.4 / §6.6", "MUST", "lifecycle", {
    notes: "Tracked ahead of the split; legacy world state machine has not adopted superseded yet.",
  }),
  ...inventoryMany(["GOV-BRANCH-1", "GOV-BRANCH-GATE-1"], "§7.1-§7.3", "MUST", "lifecycle", {
    notes: "Branch-aware governance semantics remain CTS-tracked while the implementation is world-backed.",
  }),
  inventory("GOV-SEAL-2", "§9.2", "MUST", "lifecycle", {
    notes: "Pure finalize semantics are tracked but not implemented in the legacy adapter yet.",
  }),
  inventory("GOV-BOUNDARY-5", "§4.1", "MUST_NOT", "seams", {
    notes: "Seam check only; package split has not severed runtime implementation yet.",
  }),
  inventory("GOV-DEP-1", "§4.2", "MAY", "seams", {
    notes: "Dependency posture remains advisory until governance owns its own implementation.",
  }),
  inventory("GOV-STORE-3", "§11.2", "MUST", "seams", {
    notes: "In-memory GovernanceStore is staged behind the legacy world-backed adapter.",
  }),
] as const;

export function getInventoryRuleOrThrow(ruleId: string): GovernanceComplianceInventoryItem {
  const rule = GOVERNANCE_SPEC_INVENTORY.find((candidate) => candidate.ruleId === ruleId);
  if (!rule) {
    throw new Error(`Unknown governance SPEC inventory rule: ${ruleId}`);
  }
  return rule;
}
