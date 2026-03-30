import type { WorldFacadeComplianceRule } from "./wfcts-types.js";
import {
  WORLD_FACADE_SPEC_INVENTORY,
  getInventoryRuleOrThrow,
} from "./wfcts-spec-inventory.js";

function registry(
  ruleId: string,
  mode: WorldFacadeComplianceRule["mode"],
  notes?: string
): WorldFacadeComplianceRule {
  const inventoryRule = getInventoryRuleOrThrow(ruleId);
  return {
    ...inventoryRule,
    mode,
    notes: notes ?? inventoryRule.notes,
  };
}

function registryMany(
  ruleIds: readonly string[],
  mode: WorldFacadeComplianceRule["mode"],
  notes?: string
): WorldFacadeComplianceRule[] {
  return ruleIds.map((ruleId) => registry(ruleId, mode, notes));
}

export const WORLD_FACADE_COMPLIANCE_RULES: readonly WorldFacadeComplianceRule[] = [
  registry("FACADE-REEXPORT-1", "blocking"),
  registry("FACADE-REEXPORT-3", "blocking"),
  registry("FACADE-EVT-3", "blocking"),
  registry("FACADE-FACTORY-1", "blocking"),
  registry("FACADE-FACTORY-2", "blocking"),
  registry("FACADE-FACTORY-4", "blocking"),
  registry("FACADE-STORE-1", "blocking"),
  registry("FACADE-STORE-2", "blocking"),
  registry("FACADE-STORE-3", "blocking"),
  registry("FACADE-STORE-7", "blocking"),
  ...registryMany(["FACADE-COORD-1", "FACADE-COORD-2", "FACADE-COORD-3", "FACADE-COORD-5", "FACADE-COORD-6", "FACADE-COORD-7", "FACADE-COORD-8", "FACADE-COORD-9", "FACADE-COORD-11"], "blocking"),
  ...registryMany(["FACADE-RUNTIME-1", "FACADE-RUNTIME-2", "FACADE-RUNTIME-3", "FACADE-RUNTIME-4", "FACADE-RUNTIME-5", "FACADE-RUNTIME-6", "FACADE-RUNTIME-7", "FACADE-RUNTIME-8", "FACADE-RUNTIME-9", "FACADE-RUNTIME-10", "FACADE-RUNTIME-11", "FACADE-RUNTIME-12", "FACADE-RUNTIME-13"], "blocking"),
  registry("FACADE-EVT-1", "blocking"),
  registry("FACADE-EVT-2", "blocking"),
  registry("FACADE-EVT-5", "blocking"),
  registry("FACADE-FACTORY-3", "blocking"),
  registry("FACADE-SDK-1", "blocking"),
  registry("FACADE-SDK-2", "blocking"),
] as const;

export function getRuleOrThrow(ruleId: string): WorldFacadeComplianceRule {
  const rule = WORLD_FACADE_COMPLIANCE_RULES.find((candidate) => candidate.ruleId === ruleId);
  if (!rule) {
    throw new Error(`Unknown world-facade compliance rule: ${ruleId}`);
  }
  return rule;
}

export function getRulesBySuite(suite: WorldFacadeComplianceRule["suite"]): WorldFacadeComplianceRule[] {
  return WORLD_FACADE_COMPLIANCE_RULES.filter((rule) => rule.suite === suite);
}

export const WORLD_FACADE_SPEC_RULE_IDS = WORLD_FACADE_SPEC_INVENTORY.map((rule) => rule.ruleId);
