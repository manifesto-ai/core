import type {
  CompilerComplianceCase,
  CompilerComplianceCoverageEntry,
  CompilerComplianceSuite,
} from "./ccts-types.js";

function complianceCase(
  caseId: string,
  suite: CompilerComplianceSuite,
  description: string
): CompilerComplianceCase {
  return { caseId, suite, description };
}

function coverMany(ruleIds: readonly string[], caseIds: readonly string[]): CompilerComplianceCoverageEntry[] {
  return ruleIds.map((ruleId) => ({ ruleId, caseIds: [...caseIds] }));
}

export const CCTS_CASES = {
  GRAMMAR_RESERVED_IDENTIFIERS: "CCTS-GRAM-001",
  GRAMMAR_CANONICAL_SURFACE: "CCTS-GRAM-002",
  GRAMMAR_INVALID_SYSTEM_REF: "CCTS-GRAM-003",
  GRAMMAR_ONCE_INTENT_CONTEXTUAL: "CCTS-GRAM-004",

  CONTEXT_COMPUTED_SYSTEM: "CCTS-CTX-001",
  CONTEXT_STATE_INIT_SYSTEM: "CCTS-CTX-002",
  CONTEXT_AVAILABLE_PURITY: "CCTS-CTX-003",

  STATE_INLINE_OBJECTS: "CCTS-STATE-001",
  STATE_ACTION_INPUT_FIELDS: "CCTS-STATE-002",
  STATE_ACTION_INPUT_OMISSION: "CCTS-STATE-003",
  STATE_CONSTANT_DEFAULTS: "CCTS-STATE-004",
  STATE_COMPUTED_DEPS: "CCTS-STATE-005",
  STATE_SCHEMA_REFS: "CCTS-STATE-006",
  STATE_UNSUPPORTED_TYPES: "CCTS-STATE-007",

  ACTIONS_GUARDED_BODY: "CCTS-ACT-001",
  ACTIONS_ONCE_DESUGARING: "CCTS-ACT-002",
  ACTIONS_ONCE_INTENT_DESUGARING: "CCTS-ACT-003",
  ACTIONS_FAIL_STOP_LOWERING: "CCTS-ACT-004",
  ACTIONS_FAIL_STOP_DIAGNOSTICS: "CCTS-ACT-005",
  ACTIONS_AGGREGATION: "CCTS-ACT-006",

  IR_CALL_ONLY: "CCTS-IR-001",
  IR_INDEX_AND_NEQ: "CCTS-IR-002",
  IR_SYSTEM_LOWERING: "CCTS-IR-003",
  IR_PLATFORM_NAMESPACE: "CCTS-IR-004",
  IR_TOTAL_EVALUATION: "CCTS-IR-005",
  IR_EXPR_CLOSURE: "CCTS-IR-006",
  IR_PURITY_SNAPSHOT_BOUNDARY: "CCTS-IR-007",
  IR_EVALUATION_ORDER: "CCTS-IR-008",
  IR_PRIMITIVE_EQUALITY: "CCTS-IR-009",

  FLOW_COMPOSITION: "CCTS-FLOW-001",
  FLOW_VALIDATION: "CCTS-FLOW-002",

  ENTITY_SURFACE: "CCTS-ENTITY-001",
  ENTITY_TRANSFORM_PLACEMENT: "CCTS-ENTITY-002",
  ENTITY_TYPING: "CCTS-ENTITY-003",

  INTROSPECTION_GRAPH_SURFACE: "CCTS-INT-001",
  INTROSPECTION_FEEDS_UNLOCKS: "CCTS-INT-002",
  INTROSPECTION_MUTATIONS: "CCTS-INT-003",
  INTROSPECTION_PROJECTION: "CCTS-INT-004",

  DETERMINISM_COMPILE: "CCTS-DET-001",
  DETERMINISM_LOWER: "CCTS-DET-002",
} as const;

export const COMPILER_COMPLIANCE_CASES: readonly CompilerComplianceCase[] = [
  complianceCase(CCTS_CASES.GRAMMAR_RESERVED_IDENTIFIERS, "grammar", "Reserved namespaces and reserved user identifiers are rejected."),
  complianceCase(CCTS_CASES.GRAMMAR_CANONICAL_SURFACE, "grammar", "Non-canonical surface syntax is rejected."),
  complianceCase(CCTS_CASES.GRAMMAR_INVALID_SYSTEM_REF, "grammar", "Invalid system references are diagnosed."),
  complianceCase(CCTS_CASES.GRAMMAR_ONCE_INTENT_CONTEXTUAL, "grammar", "onceIntent is parsed contextually."),

  complianceCase(CCTS_CASES.CONTEXT_COMPUTED_SYSTEM, "context", "$system is rejected in computed expressions."),
  complianceCase(CCTS_CASES.CONTEXT_STATE_INIT_SYSTEM, "context", "$system is rejected in state initializers."),
  complianceCase(CCTS_CASES.CONTEXT_AVAILABLE_PURITY, "context", "available when stays schema-pure."),

  complianceCase(CCTS_CASES.STATE_INLINE_OBJECTS, "state-and-computed", "Inline object types in schema positions are tracked."),
  complianceCase(CCTS_CASES.STATE_ACTION_INPUT_FIELDS, "state-and-computed", "Action inputs lower to FieldSpec object fields."),
  complianceCase(CCTS_CASES.STATE_ACTION_INPUT_OMISSION, "state-and-computed", "Actions without params omit ActionSpec.input."),
  complianceCase(CCTS_CASES.STATE_CONSTANT_DEFAULTS, "state-and-computed", "Constant state initializers lower to concrete defaults."),
  complianceCase(CCTS_CASES.STATE_COMPUTED_DEPS, "state-and-computed", "Computed deps are extracted and ordered."),
  complianceCase(CCTS_CASES.STATE_SCHEMA_REFS, "state-and-computed", "Schema-position references and computed cycles are diagnosed."),
  complianceCase(CCTS_CASES.STATE_UNSUPPORTED_TYPES, "state-and-computed", "Unsupported FieldSpec-lowering types are tracked."),

  complianceCase(CCTS_CASES.ACTIONS_GUARDED_BODY, "actions-and-control", "Action mutations remain guarded."),
  complianceCase(CCTS_CASES.ACTIONS_ONCE_DESUGARING, "actions-and-control", "once() desugars to intent-guarded marker writes."),
  complianceCase(CCTS_CASES.ACTIONS_ONCE_INTENT_DESUGARING, "actions-and-control", "onceIntent lowers to map-level guard merges."),
  complianceCase(CCTS_CASES.ACTIONS_FAIL_STOP_LOWERING, "actions-and-control", "fail/stop lower to flow-control nodes."),
  complianceCase(CCTS_CASES.ACTIONS_FAIL_STOP_DIAGNOSTICS, "actions-and-control", "Guard requirements for fail/stop remain visible."),
  complianceCase(CCTS_CASES.ACTIONS_AGGREGATION, "actions-and-control", "Aggregation rules stay constrained."),

  complianceCase(CCTS_CASES.IR_CALL_ONLY, "lowering-and-ir", "Canonical IR shape is tracked."),
  complianceCase(CCTS_CASES.IR_INDEX_AND_NEQ, "lowering-and-ir", "Index access and neq semantics are normalized."),
  complianceCase(CCTS_CASES.IR_SYSTEM_LOWERING, "lowering-and-ir", "Compiler-owned system lowering inserts explicit effects."),
  complianceCase(CCTS_CASES.IR_PLATFORM_NAMESPACE, "lowering-and-ir", "Platform-owned lowering namespace is tracked."),
  complianceCase(CCTS_CASES.IR_TOTAL_EVALUATION, "lowering-and-ir", "Expression evaluation stays total."),
  complianceCase(CCTS_CASES.IR_EXPR_CLOSURE, "lowering-and-ir", "Expression trees remain closed, finite, and flow-free."),
  complianceCase(CCTS_CASES.IR_PURITY_SNAPSHOT_BOUNDARY, "lowering-and-ir", "Expression roots stay explicit and snapshot-bounded."),
  complianceCase(CCTS_CASES.IR_EVALUATION_ORDER, "lowering-and-ir", "Expression evaluation order stays left-to-right and key-sorted."),
  complianceCase(CCTS_CASES.IR_PRIMITIVE_EQUALITY, "lowering-and-ir", "eq/neq stay limited to primitive operands."),

  complianceCase(CCTS_CASES.FLOW_COMPOSITION, "flow-composition", "flow/include remains compile-time composition only."),
  complianceCase(CCTS_CASES.FLOW_VALIDATION, "flow-composition", "Flow declaration and include contracts are tracked."),

  complianceCase(CCTS_CASES.ENTITY_SURFACE, "entity-primitives", "Entity primitive surface and IR shape are tracked."),
  complianceCase(CCTS_CASES.ENTITY_TRANSFORM_PLACEMENT, "entity-primitives", "Transform primitive placement remains constrained."),
  complianceCase(CCTS_CASES.ENTITY_TYPING, "entity-primitives", "Entity typing and uniqueness rules are tracked."),

  complianceCase(CCTS_CASES.INTROSPECTION_GRAPH_SURFACE, "introspection", "SchemaGraph emits projected nodes with kind-prefixed ids and deterministic ordering."),
  complianceCase(CCTS_CASES.INTROSPECTION_FEEDS_UNLOCKS, "introspection", "SchemaGraph extracts feeds and unlocks relations from computed deps and availability." ),
  complianceCase(CCTS_CASES.INTROSPECTION_MUTATIONS, "introspection", "SchemaGraph extracts mutates relations from patches and effect into roots."),
  complianceCase(CCTS_CASES.INTROSPECTION_PROJECTION, "introspection", "SchemaGraph excludes $*-owned substrate and tainted computed nodes."),

  complianceCase(CCTS_CASES.DETERMINISM_COMPILE, "determinism", "Compilation remains deterministic."),
  complianceCase(CCTS_CASES.DETERMINISM_LOWER, "determinism", "Lowering remains deterministic."),
] as const;

export const COMPILER_RULE_COVERAGE: readonly CompilerComplianceCoverageEntry[] = [
  ...coverMany(["A1"], [CCTS_CASES.IR_EXPR_CLOSURE]),
  ...coverMany(["A2"], [CCTS_CASES.DETERMINISM_COMPILE, CCTS_CASES.DETERMINISM_LOWER]),
  ...coverMany(["A3", "A35", "AD-COMP-LOW-003"], [CCTS_CASES.IR_TOTAL_EVALUATION]),
  ...coverMany(["A4", "A8"], [CCTS_CASES.IR_PURITY_SNAPSHOT_BOUNDARY]),
  ...coverMany(["A5", "A6"], [CCTS_CASES.GRAMMAR_CANONICAL_SURFACE]),
  ...coverMany(["A7"], [CCTS_CASES.ACTIONS_GUARDED_BODY]),
  ...coverMany(["A9"], [CCTS_CASES.DETERMINISM_COMPILE, CCTS_CASES.DETERMINISM_LOWER]),
  ...coverMany(["A10", "COMPILER-MEL-2", "COMPILER-MEL-2a"], [CCTS_CASES.ACTIONS_ONCE_DESUGARING]),
  ...coverMany(["A11"], [CCTS_CASES.IR_INDEX_AND_NEQ]),
  ...coverMany(["A12", "A13"], [CCTS_CASES.IR_CALL_ONLY, CCTS_CASES.IR_INDEX_AND_NEQ]),
  ...coverMany(["A14", "A17", "E004"], [CCTS_CASES.GRAMMAR_RESERVED_IDENTIFIERS]),
  ...coverMany(["A15"], [CCTS_CASES.IR_PRIMITIVE_EQUALITY]),
  ...coverMany(["A18"], [CCTS_CASES.IR_EVALUATION_ORDER]),
  ...coverMany(["A19"], [CCTS_CASES.IR_INDEX_AND_NEQ]),
  ...coverMany(["A20", "A21", "A22", "A23", "A24", "A27", "A34", "AD-COMP-LOW-001"], [CCTS_CASES.IR_SYSTEM_LOWERING]),
  ...coverMany(["A25", "E001", "E002"], [CCTS_CASES.CONTEXT_COMPUTED_SYSTEM, CCTS_CASES.CONTEXT_STATE_INIT_SYSTEM]),
  ...coverMany(["A26", "COMPILER-MEL-4", "SCHEMA-RESERVED-1"], [CCTS_CASES.IR_PLATFORM_NAMESPACE]),
  ...coverMany(["A28", "E005", "AD-COMP-LOW-002"], [CCTS_CASES.CONTEXT_AVAILABLE_PURITY]),
  ...coverMany(["A29", "A30"], [CCTS_CASES.ACTIONS_FAIL_STOP_LOWERING]),
  ...coverMany(["A31", "ADR-013a"], [CCTS_CASES.FLOW_COMPOSITION]),
  ...coverMany(["A32", "E009", "E010", "E011"], [CCTS_CASES.ACTIONS_AGGREGATION]),
  ...coverMany(["A33", "E012", "TYPE-LOWER-5"], [CCTS_CASES.STATE_INLINE_OBJECTS]),

  ...coverMany(["ACTION-INPUT-1", "ACTION-INPUT-2", "TYPE-LOWER-1", "TYPE-LOWER-2", "TYPE-LOWER-3", "TYPE-LOWER-4"], [CCTS_CASES.STATE_ACTION_INPUT_FIELDS]),
  ...coverMany(["ACTION-INPUT-3"], [CCTS_CASES.STATE_ACTION_INPUT_OMISSION]),
  ...coverMany(["STATE-INIT-1", "STATE-INIT-4", "STATE-INIT-5"], [CCTS_CASES.STATE_CONSTANT_DEFAULTS]),
  ...coverMany(["STATE-INIT-2", "STATE-INIT-3", "E040", "E041", "E042"], [CCTS_CASES.STATE_SCHEMA_REFS]),
  ...coverMany(["COMP-DEP-1", "COMP-DEP-2", "COMP-DEP-3", "COMP-DEP-4", "COMP-DEP-5", "COMP-DEP-6"], [CCTS_CASES.STATE_COMPUTED_DEPS, CCTS_CASES.STATE_SCHEMA_REFS]),
  ...coverMany(["TYPE-LOWER-6", "TYPE-LOWER-7", "TYPE-LOWER-8", "TYPE-LOWER-9", "E043", "E044", "E045", "E046"], [CCTS_CASES.STATE_UNSUPPORTED_TYPES]),

  ...coverMany(["COMPILER-MEL-1"], [CCTS_CASES.ACTIONS_ONCE_INTENT_DESUGARING]),
  ...coverMany(["COMPILER-MEL-3"], [CCTS_CASES.GRAMMAR_ONCE_INTENT_CONTEXTUAL]),

  ...coverMany(["FLOW-PARAM-1", "FLOW-PARAM-2", "FLOW-CALL-1", "FLOW-CALL-2", "E013", "E014", "E015", "E016", "E017", "E018", "E019", "E020", "E021", "E022", "E023", "E024"], [CCTS_CASES.FLOW_VALIDATION]),

  ...coverMany(["ADR-013b", "ENTITY-1", "ENTITY-3", "ENTITY-4", "ENTITY-5", "ENTITY-7", "ENTITY-8", "ENTITY-9"], [CCTS_CASES.ENTITY_SURFACE]),
  ...coverMany(["ENTITY-2", "ENTITY-2a", "ENTITY-2b", "E030", "E030a", "E030b"], [CCTS_CASES.ENTITY_TYPING]),
  ...coverMany(["TRANSFORM-1", "TRANSFORM-2", "TRANSFORM-3", "TRANSFORM-4", "TRANSFORM-5", "E031", "E032", "E033", "E034", "E035"], [CCTS_CASES.ENTITY_TRANSFORM_PLACEMENT]),
  ...coverMany(["SGRAPH-1", "SGRAPH-2", "SGRAPH-3", "SGRAPH-4", "SGRAPH-14", "SGRAPH-15"], [CCTS_CASES.INTROSPECTION_GRAPH_SURFACE]),
  ...coverMany(["SGRAPH-5", "SGRAPH-6", "SGRAPH-10", "SGRAPH-11"], [CCTS_CASES.INTROSPECTION_FEEDS_UNLOCKS]),
  ...coverMany(["SGRAPH-7", "SGRAPH-8", "SGRAPH-9"], [CCTS_CASES.INTROSPECTION_MUTATIONS]),
  ...coverMany(["SGRAPH-12", "SGRAPH-13"], [CCTS_CASES.INTROSPECTION_PROJECTION]),

  ...coverMany(["E003"], [CCTS_CASES.GRAMMAR_INVALID_SYSTEM_REF]),
  ...coverMany(["E006", "E007", "E008"], [CCTS_CASES.ACTIONS_FAIL_STOP_DIAGNOSTICS]),
];

export function caseTitle(caseId: string, description: string): string {
  return `${caseId}: ${description}`;
}
