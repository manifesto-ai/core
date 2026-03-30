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
  ...registryMany(
    [
      "LIN-ID-1",
      "LIN-ID-2",
      "LIN-ID-3",
      "LIN-ID-4",
      "LIN-HASH-1",
      "LIN-HASH-3a",
      "LIN-HASH-3c",
      "LIN-HASH-3d",
      "LIN-HASH-4a",
      "LIN-HASH-4b",
      "LIN-HASH-5",
      "LIN-HASH-6",
      "LIN-HASH-7",
      "LIN-HASH-10",
      "LIN-HASH-11",
      "LIN-SEAL-PURE-1",
      "LIN-STORE-4",
      "LIN-HEAD-ADV-1",
      "MRKL-TIP-1",
      "MRKL-TIP-2",
      "MRKL-HEAD-5",
      "MRKL-ATTEMPT-2",
      "MRKL-REUSE-1",
      "MRKL-REUSE-2",
      "MRKL-STORE-4",
      "MRKL-RESTORE-1",
      "MRKL-RESTORE-2",
      "MRKL-RESTORE-3",
      "MRKL-RESTORE-3a",
      "MRKL-RESTORE-4",
      "LIN-BOUNDARY-1",
      "LIN-BOUNDARY-4",
      "LIN-STORE-3",
    ],
    "blocking"
  ),
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
