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
  ...registryMany(["A1", "A3", "A4", "A8", "A18"], "blocking"),
  registry("A15", "blocking"),
  ...registryMany(["A2", "A5", "A6", "A7", "A9", "A10", "A11", "A14", "A17"], "blocking"),
  ...registryMany(["A12", "A13"], "blocking"),
  registry("A16", "informational"),
  ...registryMany(["A19", "A20", "A21", "A22", "A23", "A24", "A25", "A27", "A29", "A30", "A32", "A34", "A35"], "blocking"),
  ...registryMany(["A26", "A28", "A31", "A33"], "blocking"),

  registry("ADR-013a", "blocking"),
  registry("ADR-013b", "blocking"),

  ...registryMany(["ACTION-INPUT-1", "ACTION-INPUT-2", "ACTION-INPUT-3"], "blocking"),
  ...registryMany(["FLOW-PARAM-1", "FLOW-PARAM-2", "FLOW-CALL-1", "FLOW-CALL-2"], "blocking"),
  ...registryMany(["STATE-INIT-1", "STATE-INIT-2", "STATE-INIT-3", "STATE-INIT-4", "STATE-INIT-5"], "blocking"),
  ...registryMany(["COMP-DEP-1", "COMP-DEP-2", "COMP-DEP-3"], "blocking"),
  registry("COMP-DEP-4", "blocking"),
  ...registryMany(["COMP-DEP-5", "COMP-DEP-6"], "blocking"),
  ...registryMany(["TYPE-LOWER-1", "TYPE-LOWER-2", "TYPE-LOWER-3", "TYPE-LOWER-4", "TYPE-LOWER-5"], "blocking"),
  ...registryMany(["TYPE-LOWER-6", "TYPE-LOWER-7", "TYPE-LOWER-8", "TYPE-LOWER-9"], "blocking"),
  ...registryMany(["SGRAPH-1", "SGRAPH-2", "SGRAPH-3", "SGRAPH-4", "SGRAPH-5", "SGRAPH-6", "SGRAPH-7", "SGRAPH-8", "SGRAPH-9", "SGRAPH-10", "SGRAPH-11", "SGRAPH-12", "SGRAPH-13", "SGRAPH-14", "SGRAPH-15"], "blocking"),

  ...registryMany(["ENTITY-1", "ENTITY-2", "ENTITY-2a", "ENTITY-2b", "ENTITY-3", "ENTITY-4", "ENTITY-5", "ENTITY-7", "ENTITY-8", "ENTITY-9"], "blocking"),
  ...registryMany(["TRANSFORM-1", "TRANSFORM-2", "TRANSFORM-3", "TRANSFORM-4", "TRANSFORM-5"], "blocking"),

  ...registryMany(["COMPILER-MEL-1", "COMPILER-MEL-2", "COMPILER-MEL-3"], "blocking"),
  registry("COMPILER-MEL-2a", "informational"),
  registry("COMPILER-MEL-4", "blocking"),
  ...registryMany(["MEL-SUGAR-1", "MEL-SUGAR-2", "MEL-SUGAR-3", "MEL-SUGAR-4"], "blocking"),

  ...registryMany(["META-1", "META-2", "META-3", "META-4", "META-5", "META-6", "META-7", "META-8", "META-9", "META-10"], "blocking"),
  ...registryMany(["INV-META-1", "INV-META-2", "INV-META-3", "INV-META-4", "INV-META-5", "INV-META-6"], "blocking"),

  registry("AD-COMP-LOW-001", "blocking"),
  registry("AD-COMP-LOW-002", "blocking"),
  registry("AD-COMP-LOW-003", "blocking"),
  registry("SCHEMA-RESERVED-1", "blocking"),

  ...registryMany(["E001", "E002", "E003", "E004", "E005", "E009", "E010", "E011"], "blocking"),
  ...registryMany(["E006", "E007", "E008"], "blocking"),
  ...registryMany(["E012", "E013", "E014", "E015", "E016", "E017", "E018", "E019", "E020", "E021", "E022", "E023", "E024", "E030", "E030a", "E030b", "E031", "E032", "E033", "E034", "E035", "E041", "E042", "E043", "E044", "E049", "E050", "E051", "E052"], "blocking"),
  ...registryMany(["E053", "E054", "E055", "E056", "E057"], "blocking"),
  registry("E045", "informational"),
  registry("E046", "informational"),
  registry("E040", "blocking"),
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
