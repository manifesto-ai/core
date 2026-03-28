import type { LineageComplianceRule } from "./lcts-types.js";
import {
  LINEAGE_SPEC_INVENTORY,
  getInventoryRuleOrThrow,
} from "./lcts-spec-inventory.js";

function registry(
  ruleId: string,
  mode: LineageComplianceRule["mode"],
  notes?: string
): LineageComplianceRule {
  const inventoryRule = getInventoryRuleOrThrow(ruleId);
  return {
    ...inventoryRule,
    mode,
    notes: notes ?? inventoryRule.notes,
  };
}

function registryMany(
  ruleIds: readonly string[],
  mode: LineageComplianceRule["mode"],
  notes?: string
): LineageComplianceRule[] {
  return ruleIds.map((ruleId) => registry(ruleId, mode, notes));
}

export const LINEAGE_COMPLIANCE_RULES: readonly LineageComplianceRule[] = [
  registry("LIN-ID-1", "blocking"),
  ...registryMany(
    ["LIN-HASH-1", "LIN-HASH-4a", "LIN-HASH-4b", "LIN-HASH-5", "LIN-HASH-6", "LIN-HASH-7", "LIN-HASH-10"],
    "blocking"
  ),
  registry("LIN-HASH-9", "informational"),
  ...registryMany(["LIN-SEAL-PURE-1", "LIN-COLLISION-1", "LIN-HEAD-ADV-1"], "pending"),
  registry("LIN-BOUNDARY-1", "blocking"),
  registry("LIN-BOUNDARY-4", "pending"),
  registry("LIN-STORE-3", "pending"),
] as const;

export function getRuleOrThrow(ruleId: string): LineageComplianceRule {
  const rule = LINEAGE_COMPLIANCE_RULES.find((candidate) => candidate.ruleId === ruleId);
  if (!rule) {
    throw new Error(`Unknown lineage compliance rule: ${ruleId}`);
  }
  return rule;
}

export function getRulesBySuite(suite: LineageComplianceRule["suite"]): LineageComplianceRule[] {
  return LINEAGE_COMPLIANCE_RULES.filter((rule) => rule.suite === suite);
}

export const LINEAGE_SPEC_RULE_IDS = LINEAGE_SPEC_INVENTORY.map((rule) => rule.ruleId);
