import type {
  CompilerComplianceInventoryItem,
  CompilerComplianceSuite,
  RuleLevel,
  RuleLifecycle,
} from "./ccts-types.js";

function inventory(
  ruleId: string,
  specSection: string,
  level: RuleLevel,
  suite: CompilerComplianceSuite,
  options?: {
    lifecycle?: RuleLifecycle;
    notes?: string;
  }
): CompilerComplianceInventoryItem {
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
  suite: CompilerComplianceSuite,
  options?: {
    lifecycle?: RuleLifecycle;
    notes?: string;
  }
): CompilerComplianceInventoryItem[] {
  return ruleIds.map((ruleId) => inventory(ruleId, specSection, level, suite, options));
}

export const COMPILER_SPEC_INVENTORY: readonly CompilerComplianceInventoryItem[] = [
  ...inventoryMany(["A1", "A2", "A3", "A4", "A8", "A9", "A11", "A12", "A18", "A35"], "§2.1", "MUST", "determinism"),
  inventory("A5", "§2.1", "MUST", "grammar"),
  inventory("A6", "§2.1", "MUST", "grammar"),
  inventory("A7", "§2.1", "MUST", "actions-and-control"),
  inventory("A10", "§2.1", "MUST", "actions-and-control"),
  inventory("A13", "§2.1 / §7.1", "MUST", "lowering-and-ir"),
  inventory("A14", "§2.1 / §11.6", "MUST", "grammar"),
  inventory("A15", "§2.1", "MUST", "actions-and-control"),
  inventory("A16", "§2.1", "MUST", "lowering-and-ir", {
    lifecycle: "superseded",
    notes: "Superseded by A20 in the current SPEC.",
  }),
  inventory("A17", "§2.1 / §11.6", "MUST", "grammar"),
  ...inventoryMany(["A19", "A20", "A21", "A22", "A23", "A24", "A26", "A27", "A34"], "§2.1", "MUST", "lowering-and-ir"),
  ...inventoryMany(["A25", "A28"], "§2.1", "MUST", "context"),
  ...inventoryMany(["A29", "A30", "A31", "A32"], "§2.1", "MUST", "actions-and-control"),
  inventory("A33", "§2.1 / §4.3", "MUST", "state-and-computed"),

  inventory("ADR-013a", "§4.7.3-§4.7.5 / §13.4", "MUST", "flow-composition"),
  inventory("ADR-013b", "§9.1.10", "MUST", "entity-primitives"),

  ...inventoryMany(["ACTION-INPUT-1", "ACTION-INPUT-2", "ACTION-INPUT-3"], "§4.5.1", "MUST", "state-and-computed"),
  inventory("FLOW-PARAM-1", "§4.7.5", "MUST", "flow-composition"),
  inventory("FLOW-PARAM-2", "§4.7.5", "MUST_NOT", "flow-composition"),
  inventory("FLOW-CALL-1", "§4.7.5", "MUST", "flow-composition"),
  inventory("FLOW-CALL-2", "§4.7.5", "MUST", "flow-composition"),

  ...inventoryMany(["STATE-INIT-1", "STATE-INIT-2", "STATE-INIT-3", "STATE-INIT-4", "STATE-INIT-5"], "§4.3.1", "MUST", "state-and-computed"),
  ...inventoryMany(["COMP-DEP-1", "COMP-DEP-2", "COMP-DEP-3", "COMP-DEP-4", "COMP-DEP-5"], "§4.4.1", "MUST", "state-and-computed"),
  inventory("COMP-DEP-6", "§4.4.1", "SHOULD", "state-and-computed"),

  ...inventoryMany(["TYPE-LOWER-1", "TYPE-LOWER-2", "TYPE-LOWER-3", "TYPE-LOWER-4", "TYPE-LOWER-5"], "§5.6.2", "MUST", "state-and-computed"),
  inventory("TYPE-LOWER-6", "§5.6.2", "MUST", "state-and-computed", {
    notes: "Nullable schema-position types MUST lower through compatibility FieldSpec plus precise TypeDefinition.",
  }),
  inventory("TYPE-LOWER-7", "§5.6.2", "MUST", "state-and-computed", {
    notes: "Record schema-position types MUST lower through compatibility FieldSpec plus precise TypeDefinition.",
  }),
  ...inventoryMany(["TYPE-LOWER-8", "TYPE-LOWER-9"], "§5.6.2", "MUST", "state-and-computed"),
  ...inventoryMany(["SGRAPH-1", "SGRAPH-2", "SGRAPH-3", "SGRAPH-4", "SGRAPH-5", "SGRAPH-6", "SGRAPH-7", "SGRAPH-8", "SGRAPH-9", "SGRAPH-10", "SGRAPH-11", "SGRAPH-12", "SGRAPH-13", "SGRAPH-14"], "SPEC v0.8.0 §6/§7/§8", "MUST", "introspection"),
  inventory("SGRAPH-15", "SPEC v0.8.0 §6", "SHOULD", "introspection"),

  ...inventoryMany(["ENTITY-1", "ENTITY-2", "ENTITY-2a", "ENTITY-2b", "ENTITY-3", "ENTITY-4", "ENTITY-5", "ENTITY-7", "ENTITY-8", "ENTITY-9"], "§9.1.10", "MUST", "entity-primitives"),
  ...inventoryMany(["TRANSFORM-1", "TRANSFORM-2", "TRANSFORM-3", "TRANSFORM-4", "TRANSFORM-5"], "§9.1.10", "MUST", "entity-primitives"),

  ...inventoryMany(["COMPILER-MEL-1", "COMPILER-MEL-2", "COMPILER-MEL-4"], "§21", "MUST", "lowering-and-ir"),
  inventory("COMPILER-MEL-3", "§21", "MUST", "grammar"),
  inventory("COMPILER-MEL-2a", "§21", "MAY", "lowering-and-ir", {
    notes: "Optional lowering strategy equivalent to COMPILER-MEL-2.",
  }),

  ...inventoryMany(["MEL-SUGAR-1", "MEL-SUGAR-2", "MEL-SUGAR-3", "MEL-SUGAR-4"], "§5.1", "MUST", "lowering-and-ir"),

  ...inventoryMany(["META-1", "META-2", "META-3", "META-4", "META-5", "META-6", "META-7", "META-8", "META-9", "META-10"], "§8.2-§8.4", "MUST", "annotations"),
  ...inventoryMany(["INV-META-1", "INV-META-2", "INV-META-3", "INV-META-4", "INV-META-5", "INV-META-6"], "§8.4", "CRITICAL", "annotations"),

  ...inventoryMany(["AD-COMP-LOW-001", "AD-COMP-LOW-002", "AD-COMP-LOW-003"], "§16", "MUST", "lowering-and-ir"),
  inventory("SCHEMA-RESERVED-1", "§17.4 / §21", "MUST", "lowering-and-ir"),

  ...inventoryMany(["E001", "E002"], "§11.6", "MUST", "context"),
  ...inventoryMany(["E003", "E004"], "§11.6", "MUST", "grammar"),
  inventory("E005", "§13.6", "MUST", "context"),
  ...inventoryMany(["E006", "E007", "E008", "E009", "E010", "E011"], "§13.6", "MUST", "actions-and-control"),
  inventory("E012", "§13.6", "MUST", "state-and-computed"),
  ...inventoryMany(["E013", "E014", "E015", "E016", "E017", "E018", "E019", "E020", "E021", "E022", "E023", "E024"], "§13.6", "MUST", "flow-composition"),
  ...inventoryMany(["E030", "E030a", "E030b", "E031", "E032", "E033", "E034", "E035"], "§13.6", "MUST", "entity-primitives"),
  ...inventoryMany(["E040", "E041", "E042", "E043", "E044"], "§13.6", "MUST", "state-and-computed"),
  ...inventoryMany(["E049", "E050", "E051", "E052"], "§13.6", "MUST", "lowering-and-ir"),
  ...inventoryMany(["E053", "E054", "E055", "E056", "E057", "E058"], "§9", "MUST", "annotations"),
  inventory("E045", "§13.6", "MUST", "state-and-computed", {
    lifecycle: "superseded",
    notes: "Superseded when nullable schema-position types became supported through TypeDefinition-backed runtime validation.",
  }),
  inventory("E046", "§13.6", "MUST", "state-and-computed", {
    lifecycle: "superseded",
    notes: "Superseded when Record schema-position types became supported through TypeDefinition-backed runtime validation.",
  }),
] as const;

export function getInventoryRuleOrThrow(ruleId: string): CompilerComplianceInventoryItem {
  const rule = COMPILER_SPEC_INVENTORY.find((candidate) => candidate.ruleId === ruleId);
  if (!rule) {
    throw new Error(`Unknown compiler SPEC inventory rule: ${ruleId}`);
  }
  return rule;
}
