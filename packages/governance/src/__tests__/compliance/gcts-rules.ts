import type { GovernanceComplianceRule } from "./gcts-types.js";
import {
  GOVERNANCE_SPEC_INVENTORY,
  getInventoryRuleOrThrow,
} from "./gcts-spec-inventory.js";

function registry(
  ruleId: string,
  mode: GovernanceComplianceRule["mode"],
  notes?: string
): GovernanceComplianceRule {
  const inventoryRule = getInventoryRuleOrThrow(ruleId);
  return {
    ...inventoryRule,
    mode,
    notes: notes ?? inventoryRule.notes,
  };
}

function registryMany(
  ruleIds: readonly string[],
  mode: GovernanceComplianceRule["mode"],
  notes?: string
): GovernanceComplianceRule[] {
  return ruleIds.map((ruleId) => registry(ruleId, mode, notes));
}

export const GOVERNANCE_COMPLIANCE_RULES: readonly GovernanceComplianceRule[] = [
  registry("GOV-TRANS-1", "blocking"),
  ...registryMany(
    ["GOV-STAGE-7", "GOV-TRANS-3", "GOV-TRANS-4", "GOV-BRANCH-1", "GOV-BRANCH-GATE-1", "GOV-SEAL-2"],
    "pending"
  ),
  registry("GOV-BOUNDARY-5", "blocking"),
  registry("GOV-DEP-1", "informational"),
  registry("GOV-STORE-3", "pending"),
] as const;

export function getRuleOrThrow(ruleId: string): GovernanceComplianceRule {
  const rule = GOVERNANCE_COMPLIANCE_RULES.find((candidate) => candidate.ruleId === ruleId);
  if (!rule) {
    throw new Error(`Unknown governance compliance rule: ${ruleId}`);
  }
  return rule;
}

export function getRulesBySuite(suite: GovernanceComplianceRule["suite"]): GovernanceComplianceRule[] {
  return GOVERNANCE_COMPLIANCE_RULES.filter((rule) => rule.suite === suite);
}

export const GOVERNANCE_SPEC_RULE_IDS = GOVERNANCE_SPEC_INVENTORY.map((rule) => rule.ruleId);
