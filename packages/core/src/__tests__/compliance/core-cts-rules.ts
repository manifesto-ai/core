import type { CoreComplianceRule } from "./core-cts-types.js";
import { CORE_SPEC_INVENTORY, getInventoryRuleOrThrow } from "./core-cts-spec-inventory.js";

function registry(
  ruleId: string,
  mode: CoreComplianceRule["mode"],
  notes?: string,
): CoreComplianceRule {
  const inventoryRule = getInventoryRuleOrThrow(ruleId);
  return {
    ...inventoryRule,
    mode,
    notes: notes ?? inventoryRule.notes,
  };
}

function registryMany(
  ruleIds: readonly string[],
  mode: CoreComplianceRule["mode"],
  notes?: string,
): CoreComplianceRule[] {
  return ruleIds.map((ruleId) => registry(ruleId, mode, notes));
}

export const CORE_COMPLIANCE_RULES: readonly CoreComplianceRule[] = [
  ...registryMany(["SCHEMA-RESERVED-1", "SCHEMA-RESERVED-2"], "blocking"),
  ...registryMany(["V-001", "V-002", "V-003", "V-004", "V-005", "V-006", "V-007", "V-008"], "blocking"),
  ...registryMany(["V-009", "V-010", "V-011", "V-012"], "blocking"),
  ...registryMany(["R-001", "R-002", "R-003", "R-004", "R-005", "R-006", "R-007", "R-008"], "blocking"),
  ...registryMany(["TRACE-NS-1", "TRACE-NS-2", "TRACE-NS-3", "TRACE-NS-4"], "blocking"),
  ...registryMany(["NSDELTA-1", "NSDELTA-2", "NSDELTA-3", "NSDELTA-4"], "blocking"),
  ...registryMany(["NSREAD-1", "NSREAD-3", "NSREAD-4"], "blocking"),
  ...registryMany(["NSINIT-1", "NSINIT-2", "NSINIT-3", "NSINIT-4"], "blocking"),
  ...registryMany(["AVAIL-Q-1", "AVAIL-Q-2", "AVAIL-Q-3", "AVAIL-Q-4", "AVAIL-Q-5", "AVAIL-Q-6", "AVAIL-Q-7"], "blocking"),
  ...registryMany(["DISP-Q-1", "DISP-Q-2", "DISP-Q-3", "DISP-Q-4", "DISP-Q-5", "DISP-Q-6"], "blocking"),

  registry("NSDELTA-1a", "informational"),
  registry("NSDELTA-1b", "informational"),
  registry("NSDELTA-2a", "informational"),
  registry("NSREAD-2", "informational"),
  registry("NSINIT-5", "informational"),
] as const;

export function getRuleOrThrow(ruleId: string): CoreComplianceRule {
  const rule = CORE_COMPLIANCE_RULES.find((candidate) => candidate.ruleId === ruleId);
  if (!rule) {
    throw new Error(`Unknown Core compliance rule: ${ruleId}`);
  }
  return rule;
}

export function getRulesBySuite(suite: CoreComplianceRule["suite"]): CoreComplianceRule[] {
  return CORE_COMPLIANCE_RULES.filter((rule) => rule.suite === suite);
}

export const CORE_SPEC_RULE_IDS = CORE_SPEC_INVENTORY.map((rule) => rule.ruleId);
