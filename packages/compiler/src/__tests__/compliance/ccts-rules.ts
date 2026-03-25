import type { CompilerComplianceRule } from "./ccts-types.js";
import { COMPILER_SPEC_INVENTORY, getInventoryRuleOrThrow } from "./ccts-spec-inventory.js";

function registry(
  ruleId: string,
  mode: CompilerComplianceRule["mode"],
  notes?: string
): CompilerComplianceRule {
  const inventoryRule = getInventoryRuleOrThrow(ruleId);
  return {
    ...inventoryRule,
    mode,
    notes: notes ?? inventoryRule.notes,
  };
}

function registryMany(
  ruleIds: readonly string[],
  mode: CompilerComplianceRule["mode"],
  notes?: string
): CompilerComplianceRule[] {
  return ruleIds.map((ruleId) => registry(ruleId, mode, notes));
}

export const COMPILER_COMPLIANCE_RULES: readonly CompilerComplianceRule[] = [
  ...registryMany(["A1", "A3", "A4", "A8", "A12", "A15", "A18"], "pending", "Broad or newly clarified axioms are tracked with aggregate probes."),
  ...registryMany(["A2", "A5", "A6", "A7", "A9", "A10", "A11", "A14", "A17"], "blocking"),
  registry("A13", "pending", "Current generated schema still uses specialized node kinds."),
  registry("A16", "informational"),
  ...registryMany(["A19", "A20", "A21", "A22", "A23", "A24", "A25", "A27", "A29", "A30", "A32", "A34", "A35"], "blocking"),
  ...registryMany(["A26", "A28", "A31", "A33"], "pending"),

  registry("ADR-013a", "pending"),
  registry("ADR-013b", "pending"),

  ...registryMany(["ACTION-INPUT-1", "ACTION-INPUT-2", "ACTION-INPUT-3"], "blocking"),
  ...registryMany(["FLOW-PARAM-1", "FLOW-PARAM-2", "FLOW-CALL-1", "FLOW-CALL-2"], "pending"),
  ...registryMany(["STATE-INIT-1", "STATE-INIT-2", "STATE-INIT-3", "STATE-INIT-4", "STATE-INIT-5"], "pending"),
  ...registryMany(["COMP-DEP-1", "COMP-DEP-2", "COMP-DEP-3"], "blocking"),
  ...registryMany(["COMP-DEP-4", "COMP-DEP-5", "COMP-DEP-6"], "pending"),
  ...registryMany(["TYPE-LOWER-1", "TYPE-LOWER-2", "TYPE-LOWER-3", "TYPE-LOWER-4", "TYPE-LOWER-5"], "blocking"),
  ...registryMany(["TYPE-LOWER-6", "TYPE-LOWER-7", "TYPE-LOWER-8", "TYPE-LOWER-9"], "pending"),

  ...registryMany(["ENTITY-1", "ENTITY-2", "ENTITY-2a", "ENTITY-2b", "ENTITY-3", "ENTITY-4", "ENTITY-5", "ENTITY-7", "ENTITY-8", "ENTITY-9"], "pending"),
  ...registryMany(["TRANSFORM-1", "TRANSFORM-2", "TRANSFORM-3", "TRANSFORM-4", "TRANSFORM-5"], "pending"),

  ...registryMany(["COMPILER-MEL-1", "COMPILER-MEL-2", "COMPILER-MEL-3"], "blocking"),
  registry("COMPILER-MEL-2a", "informational"),
  registry("COMPILER-MEL-4", "pending"),

  registry("AD-COMP-LOW-001", "blocking"),
  registry("AD-COMP-LOW-002", "pending"),
  registry("AD-COMP-LOW-003", "blocking"),
  registry("SCHEMA-RESERVED-1", "pending"),

  ...registryMany(["E001", "E002", "E003", "E004", "E005", "E009", "E010", "E011"], "blocking"),
  ...registryMany(["E006", "E007", "E008", "E012", "E013", "E014", "E015", "E016", "E017", "E018", "E019", "E020", "E021", "E022", "E023", "E024", "E030", "E030a", "E030b", "E031", "E032", "E033", "E034", "E035", "E040", "E041", "E042", "E043", "E044", "E045", "E046"], "pending"),
] as const;

export function getRuleOrThrow(ruleId: string): CompilerComplianceRule {
  const rule = COMPILER_COMPLIANCE_RULES.find((candidate) => candidate.ruleId === ruleId);
  if (!rule) {
    throw new Error(`Unknown compiler compliance rule: ${ruleId}`);
  }
  return rule;
}

export function getRulesBySuite(suite: CompilerComplianceRule["suite"]): CompilerComplianceRule[] {
  return COMPILER_COMPLIANCE_RULES.filter((rule) => rule.suite === suite);
}

export const COMPILER_SPEC_RULE_IDS = COMPILER_SPEC_INVENTORY.map((rule) => rule.ruleId);
