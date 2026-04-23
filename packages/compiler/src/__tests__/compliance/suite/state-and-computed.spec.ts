import { describe, it } from "vitest";
import { createCompilerComplianceAdapter } from "../ccts-adapter.js";
import {
  diagnosticEvidence,
  evaluateRule,
  expectAllCompliance,
  hasDiagnosticCode,
  noteEvidence,
} from "../ccts-assertions.js";
import { CCTS_CASES, caseTitle } from "../ccts-coverage.js";
import { getRuleOrThrow } from "../ccts-rules.js";

const adapter = createCompilerComplianceAdapter();

describe("CCTS State and Computed Suite", () => {
  it(caseTitle(CCTS_CASES.STATE_INLINE_OBJECTS, "(A33/E012/TYPE-LOWER-5) inline object state fields stay visible to compliance"), () => {
    const result = adapter.compile(`
      domain Demo {
        state {
          meta: { title: string } = { title: "" }
        }
      }
    `);

    const field = result.value?.state.fields["meta"];
    const hasInlineObjectSignal = hasDiagnosticCode(result.diagnostics, ["E012", "W012"]);
    const lowersToObject =
      result.success &&
      field?.type === "object" &&
      field.fields?.title?.type === "string";

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A33"), hasInlineObjectSignal, {
        passMessage: "Anonymous object types in state are surfaced to the user.",
        failMessage: "Anonymous object types in state are still silently accepted.",
        evidence: [
          noteEvidence("Observed state field", field),
          ...diagnosticEvidence(result.diagnostics),
        ],
      }),
      evaluateRule(getRuleOrThrow("E012"), hasInlineObjectSignal, {
        passMessage: "Anonymous object types emit an explicit signal.",
        failMessage: "Expected E012/W012-style signal for an anonymous state object type.",
        evidence: diagnosticEvidence(result.diagnostics),
      }),
      evaluateRule(getRuleOrThrow("TYPE-LOWER-5"), lowersToObject, {
        passMessage: "Inline object types lower to object FieldSpec fields.",
        failMessage: "Inline object types did not lower to object FieldSpec fields.",
        evidence: [noteEvidence("Observed state field", field)],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.STATE_ACTION_INPUT_FIELDS, "(ACTION-INPUT-1/2, TYPE-LOWER-1..4) action parameters lower to FieldSpec objects"), () => {
    const result = adapter.compile(`
      domain Demo {
        type Meta = { retries: number }
        action create(
          title: string,
          status: "open" | "done",
          tags: Array<string>,
          meta: Meta
        ) {
          when true {
            stop "ok"
          }
        }
      }
    `);

    const input = result.value?.actions["create"]?.input;
    const titleField = input?.fields?.title;
    const statusField = input?.fields?.status;
    const tagsField = input?.fields?.tags;
    const metaField = input?.fields?.meta;

    const hasObjectInput =
      result.success &&
      input?.type === "object" &&
      titleField?.type === "string" &&
      titleField.required === true;
    const hasRequiredFields =
      hasObjectInput &&
      statusField?.required === true &&
      tagsField?.required === true &&
      metaField?.required === true;
    const lowersPrimitiveEnumArrayAndNamedObject =
      hasObjectInput &&
      typeof statusField?.type === "object" &&
      Array.isArray((statusField?.type as { enum?: unknown[] }).enum) &&
      tagsField?.type === "array" &&
      tagsField.items?.type === "string" &&
      metaField?.type === "object" &&
      metaField.fields?.retries?.type === "number";

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("ACTION-INPUT-1"), hasObjectInput, {
        passMessage: "Action parameters lower to ActionSpec.input FieldSpec objects.",
        failMessage: "Action parameters did not lower to ActionSpec.input FieldSpec objects.",
        evidence: [noteEvidence("Observed action input", input)],
      }),
      evaluateRule(getRuleOrThrow("ACTION-INPUT-2"), hasRequiredFields, {
        passMessage: "Each action parameter becomes a required field in input.fields.",
        failMessage: "Action parameters were not emitted as required input.fields entries.",
        evidence: [noteEvidence("Observed action input", input)],
      }),
      evaluateRule(getRuleOrThrow("TYPE-LOWER-1"), titleField?.type === "string", {
        passMessage: "Primitive parameter types lower directly.",
        failMessage: "Primitive parameter types did not lower directly.",
        evidence: [noteEvidence("Observed title field", titleField)],
      }),
      evaluateRule(getRuleOrThrow("TYPE-LOWER-2"), typeof statusField?.type === "object", {
        passMessage: "Literal unions lower to enum FieldSpec types.",
        failMessage: "Literal unions did not lower to enum FieldSpec types.",
        evidence: [noteEvidence("Observed status field", statusField)],
      }),
      evaluateRule(getRuleOrThrow("TYPE-LOWER-3"), tagsField?.type === "array" && tagsField.items?.type === "string", {
        passMessage: "Array parameter types lower to array FieldSpec with items.",
        failMessage: "Array parameter types did not lower to array FieldSpec with items.",
        evidence: [noteEvidence("Observed tags field", tagsField)],
      }),
      evaluateRule(getRuleOrThrow("TYPE-LOWER-4"), lowersPrimitiveEnumArrayAndNamedObject, {
        passMessage: "Named object types inline into nested FieldSpec fields.",
        failMessage: "Named object types did not inline into nested FieldSpec fields.",
        evidence: [noteEvidence("Observed meta field", metaField)],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.STATE_ACTION_INPUT_OMISSION, "(ACTION-INPUT-3) actions without params omit ActionSpec.input"), () => {
    const result = adapter.compile(`
      domain Demo {
        action ping() {
          when true {
            stop "ok"
          }
        }
      }
    `);

    const input = result.value?.actions["ping"]?.input;

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("ACTION-INPUT-3"), result.success && input === undefined, {
        passMessage: "Parameterless actions omit ActionSpec.input entirely.",
        failMessage: "Parameterless actions still emitted ActionSpec.input.",
        evidence: [noteEvidence("Observed action input", input)],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.STATE_CONSTANT_DEFAULTS, "(STATE-INIT-1/4/5) constant defaults lower to concrete values"), () => {
    const result = adapter.compile(`
      domain Demo {
        type Settings = { enabled: boolean }
        state {
          count: number = 0
          items: Array<number> = [1, 2]
          settings: Settings = { enabled: true }
        }
      }
    `);

    const countField = result.value?.state.fields["count"];
    const itemsField = result.value?.state.fields["items"];
    const settingsField = result.value?.state.fields["settings"];
    const defaultsLowered =
      result.success &&
      countField?.default === 0 &&
      Array.isArray(itemsField?.default) &&
      (itemsField?.default as unknown[]).length === 2 &&
      typeof settingsField?.default === "object" &&
      settingsField?.required === true;

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("STATE-INIT-1"), defaultsLowered, {
        passMessage: "Compile-time constant state initializers lower successfully.",
        failMessage: "Compile-time constant state initializers did not lower to concrete defaults.",
        evidence: [
          noteEvidence("Observed count field", countField),
          noteEvidence("Observed items field", itemsField),
          noteEvidence("Observed settings field", settingsField),
        ],
      }),
      evaluateRule(getRuleOrThrow("STATE-INIT-4"), defaultsLowered, {
        passMessage: "State initializer expressions emit concrete JSON defaults.",
        failMessage: "State initializer expressions did not emit concrete JSON defaults.",
        evidence: [noteEvidence("Observed settings default", settingsField?.default)],
      }),
      evaluateRule(getRuleOrThrow("STATE-INIT-5"), defaultsLowered, {
        passMessage: "State defaults do not force fields to become optional.",
        failMessage: "State defaults broke the required/default contract.",
        evidence: [
          noteEvidence("Observed count required", countField?.required),
          noteEvidence("Observed settings required", settingsField?.required),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.STATE_COMPUTED_DEPS, "(COMP-DEP-1..6) computed deps stay extractable and ordered"), () => {
    const result = adapter.compile(`
      domain Demo {
        state { count: number = 0 }
        computed final = add(total, 1)
        computed total = add(count, 1)
      }
    `);

    const total = result.value?.computed.fields["total"];
    const finalValue = result.value?.computed.fields["final"];
    const computedKeys = result.value?.computed.fields
      ? Object.keys(result.value.computed.fields)
      : [];
    const hasDeps =
      result.success &&
      total?.deps.includes("count") === true &&
      finalValue?.deps.includes("total") === true;
    const topoOrdered = JSON.stringify(computedKeys) === JSON.stringify(["total", "final"]);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("COMP-DEP-1"), hasDeps, {
        passMessage: "Compiler extracts deps from referenced get paths.",
        failMessage: "Compiler did not extract deps from referenced get paths.",
        evidence: [
          noteEvidence("Observed total deps", total?.deps ?? []),
          noteEvidence("Observed final deps", finalValue?.deps ?? []),
        ],
      }),
      evaluateRule(getRuleOrThrow("COMP-DEP-2"), hasDeps, {
        passMessage: "Deps include the root segment of referenced paths.",
        failMessage: "Deps did not include the root segment of referenced paths.",
        evidence: [noteEvidence("Observed total deps", total?.deps ?? [])],
      }),
      evaluateRule(getRuleOrThrow("COMP-DEP-3"), hasDeps, {
        passMessage: "Deps reflect all referenced schema paths.",
        failMessage: "Deps did not reflect all referenced schema paths.",
        evidence: [noteEvidence("Observed final deps", finalValue?.deps ?? [])],
      }),
      evaluateRule(getRuleOrThrow("COMP-DEP-4"), result.success && finalValue?.deps.includes("total") === true, {
        passMessage: "Computed-to-computed references remain representable in deps.",
        failMessage: "Computed-to-computed references were not represented in deps.",
        evidence: [noteEvidence("Observed final deps", finalValue?.deps ?? [])],
      }),
      evaluateRule(getRuleOrThrow("COMP-DEP-6"), topoOrdered, {
        passMessage: "Computed fields emit in topological order.",
        failMessage: "Computed fields are not yet emitted in topological order.",
        evidence: [noteEvidence("Observed computed field order", computedKeys)],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.STATE_SCHEMA_REFS, "(STATE-INIT-2/3, COMP-DEP-5, E040/E041/E042) schema-position references stay checked"), () => {
    const cycleResult = adapter.compile(`
      domain Demo {
        state { count: number = 0 }
        computed a = add(b, 1)
        computed b = add(a, 1)
      }
    `);
    const undefinedResult = adapter.compile(`
      domain Demo {
        computed total = add(missingValue, 1)
      }
    `);
    const stateRefResult = adapter.compile(`
      domain Demo {
        state {
          base: number = 1
          derived: number = add(base, 1)
        }
      }
    `);
    const metaRefResult = adapter.compile(`
      domain Demo {
        state {
          traceId: string = $meta.intentId
        }
      }
    `);

    const hasE042 =
      hasDiagnosticCode(stateRefResult.errors, "E042") ||
      hasDiagnosticCode(metaRefResult.errors, "E042");

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("COMP-DEP-5"), hasDiagnosticCode(cycleResult.errors, "E040"), {
        passMessage: "Computed dependency cycles are rejected.",
        failMessage: "Computed dependency cycles are not yet rejected.",
        evidence: diagnosticEvidence(cycleResult.errors),
      }),
      evaluateRule(getRuleOrThrow("STATE-INIT-2"), hasDiagnosticCode(stateRefResult.errors, "E042"), {
        passMessage: "State initializers reject references to other state fields.",
        failMessage: "State initializers still accept references to other state fields.",
        evidence: diagnosticEvidence(stateRefResult.errors),
      }),
      evaluateRule(getRuleOrThrow("STATE-INIT-3"), hasE042, {
        passMessage: "State initializers reject runtime-dependent schema references.",
        failMessage: "State initializers still accept runtime-dependent schema references.",
        evidence: [
          ...diagnosticEvidence(stateRefResult.errors),
          ...diagnosticEvidence(metaRefResult.errors),
        ],
      }),
      evaluateRule(getRuleOrThrow("E040"), hasDiagnosticCode(cycleResult.errors, "E040"), {
        passMessage: "Circular computed dependencies are diagnosed as E040.",
        failMessage: "Circular computed dependencies are not yet diagnosed as E040.",
        evidence: diagnosticEvidence(cycleResult.errors),
      }),
      evaluateRule(getRuleOrThrow("E041"), hasDiagnosticCode(undefinedResult.errors, ["E041", "E_UNDEFINED"]), {
        passMessage: "Undefined computed references remain visible to diagnostics.",
        failMessage: "Undefined computed references were accepted silently.",
        evidence: diagnosticEvidence(undefinedResult.errors),
      }),
      evaluateRule(getRuleOrThrow("E042"), hasE042, {
        passMessage: "Schema-position runtime references are diagnosed as E042.",
        failMessage: "Schema-position runtime references are not yet diagnosed as E042.",
        evidence: [
          ...diagnosticEvidence(stateRefResult.errors),
          ...diagnosticEvidence(metaRefResult.errors),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.STATE_UNSUPPORTED_TYPES, "(TYPE-LOWER-6..9, E043/E044) rich schema shapes lower via TypeDefinition while unsupported unions remain rejected"), () => {
    const nullableResult = adapter.compile(`
      domain Demo {
        state { value: string | null = null }
      }
    `);
    const recordResult = adapter.compile(`
      domain Demo {
        type Entry = { id: string }
        state { entries: Record<string, Entry> = {} }
      }
    `);
    const unionResult = adapter.compile(`
      domain Demo {
        action process(value: string | number) {
          when true {
            stop "ok"
          }
        }
      }
    `);
    const recursiveResult = adapter.compile(`
      domain Demo {
        type Tree = { children: Array<Tree> }
        state { root: Tree = { children: [] } }
      }
    `);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("TYPE-LOWER-6"), nullableResult.success, {
        passMessage: "Nullable schema-position types compile through the TypeDefinition seam.",
        failMessage: "Nullable schema-position types do not yet compile through the TypeDefinition seam.",
        evidence: [
          noteEvidence("Observed nullable FieldSpec", nullableResult.value?.state.fields["value"]),
          noteEvidence("Observed nullable fieldType", nullableResult.value?.state.fieldTypes?.["value"]),
          ...diagnosticEvidence(nullableResult.errors),
        ],
      }),
      evaluateRule(
        getRuleOrThrow("TYPE-LOWER-7"),
        recordResult.success
          && recordResult.value?.state.fields["entries"]?.type === "object"
          && recordResult.value?.state.fieldTypes?.["entries"]?.kind === "record",
        {
        passMessage: "Record schema-position types compile with compatibility FieldSpec plus precise TypeDefinition.",
        failMessage: "Record schema-position types do not yet lower through the split runtime seam.",
        evidence: [
          noteEvidence("Observed record FieldSpec", recordResult.value?.state.fields["entries"]),
          noteEvidence("Observed record fieldType", recordResult.value?.state.fieldTypes?.["entries"]),
          ...diagnosticEvidence(recordResult.errors),
        ],
      }),
      evaluateRule(getRuleOrThrow("TYPE-LOWER-8"), hasDiagnosticCode(unionResult.errors, "E043"), {
        passMessage: "Non-trivial unions in schema positions are rejected.",
        failMessage: "Non-trivial unions in schema positions are not yet rejected.",
        evidence: [
          noteEvidence("Observed action input", unionResult.value?.actions["process"]?.input),
          ...diagnosticEvidence(unionResult.errors),
        ],
      }),
      evaluateRule(getRuleOrThrow("E043"), hasDiagnosticCode(unionResult.errors, "E043"), {
        passMessage: "Non-trivial unions emit E043.",
        failMessage: "Non-trivial unions do not yet emit E043.",
        evidence: diagnosticEvidence(unionResult.errors),
      }),
      evaluateRule(getRuleOrThrow("TYPE-LOWER-9"), hasDiagnosticCode(recursiveResult.errors, "E044"), {
        passMessage: "Recursive named types in schema positions are rejected.",
        failMessage: "Recursive named types are not yet rejected in schema positions.",
        evidence: diagnosticEvidence(recursiveResult.errors),
      }),
      evaluateRule(getRuleOrThrow("E044"), hasDiagnosticCode(recursiveResult.errors, "E044"), {
        passMessage: "Recursive named types emit E044.",
        failMessage: "Recursive named types do not yet emit E044.",
        evidence: diagnosticEvidence(recursiveResult.errors),
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.STATE_PATCH_MERGE, "(PATCH-MERGE-1) patch merge remains a shallow partial-object operation"), () => {
    const partialResult = adapter.compile(`
      domain Demo {
        type User = { name: string, age: number }

        state {
          user: User = { name: "a", age: 1 }
        }

        action rename() {
          when true {
            patch user merge { name: "b" }
          }
        }
      }
    `);
    const invalidResult = adapter.compile(`
      domain Demo {
        type User = { name: string, age: number }

        state {
          user: User = { name: "a", age: 1 }
        }

        action rename() {
          when true {
            patch user merge { age: "oops" }
          }
        }
      }
    `);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("PATCH-MERGE-1"), partialResult.success && hasDiagnosticCode(invalidResult.errors, "E_TYPE_MISMATCH"), {
        passMessage: "patch merge accepts partial object payloads while preserving field-level type checks.",
        failMessage: "patch merge no longer behaves as a shallow partial-object operation.",
        evidence: [
          ...diagnosticEvidence(partialResult.errors),
          ...diagnosticEvidence(invalidResult.errors),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.STATE_COALESCE_NARROWING, "(COALESCE-1) coalesce narrows compatible nullable branches for downstream typing"), () => {
    const numericResult = adapter.compile(`
      domain Demo {
        state { count: number = 1 }
        computed maybe = idiv(count, 2)
        computed safe = clamp(coalesce(maybe, 0), 0, 10)
      }
    `);
    const selectorResult = adapter.compile(`
      domain Demo {
        state { mode: "ship" | "pickup" = "ship" }

        computed carrier = argmax(
          ["pickup", eq(mode, "pickup"), 100],
          ["ship", eq(mode, "ship"), 80],
          "first"
        )

        computed tier = match(
          coalesce(carrier, "manual"),
          ["pickup", "pickup"],
          ["ship", "ship"],
          "manual"
        )
      }
    `);
    const invalidResult = adapter.compile(`
      domain Demo {
        state {
          primary: string | null = null
          secondary: string | null = null
          chosen: string = ""
        }

        action copy() {
          when true {
            patch chosen = coalesce(primary, secondary)
          }
        }
      }
    `);

    expectAllCompliance([
      evaluateRule(
        getRuleOrThrow("COALESCE-1"),
        numericResult.success
          && selectorResult.success
          && hasDiagnosticCode(invalidResult.errors, "E_TYPE_MISMATCH"),
        {
        passMessage: "coalesce narrows only when a non-null fallback is guaranteed and preserves nullable results otherwise.",
        failMessage: "coalesce still leaks nullable result types into guaranteed fallback paths or over-narrows all-nullable paths.",
        evidence: [
          ...diagnosticEvidence(numericResult.errors),
          ...diagnosticEvidence(selectorResult.errors),
          ...diagnosticEvidence(invalidResult.errors),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.STATE_VALUES_RECORD_TYPING, "(COLLECT-VALUES-1) values(record) preserves typed collection flows"), () => {
    const typedResult = adapter.compile(`
      domain Demo {
        type Item = { id: string, qty: number }
        type Line = { id: string, qty: number }

        state {
          items: Record<string, Item> = {}
          lines: Array<Line> = []
        }

        action copy() {
          when true {
            patch lines = map(values(items), { id: $item.id, qty: $item.qty })
          }
        }
      }
    `);
    const invalidResult = adapter.compile(`
      domain Demo {
        type Item = { id: string, qty: number }
        type Line = { id: string, qty: number }

        state {
          items: Record<string, Item> = {}
          lines: Array<Line> = []
        }

        action copy() {
          when true {
            patch lines = map(values(items), { id: 1, qty: "x" })
          }
        }
      }
    `);
    const nestedResult = adapter.compile(`
      domain Demo {
        type Item = { id: string, qty: number }
        type Line = { id: string, qty: number }
        type Order = { id: string, lines: Array<Line> }

        state {
          items: Record<string, Item> = {}
          orders: Record<string, Order> = {}
        }

        action submit(orderId: string) {
          when true {
            patch orders[orderId] = {
              id: orderId,
              lines: map(values(items), { id: $item.id, qty: $item.qty })
            }
          }
        }
      }
    `);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("COLLECT-VALUES-1"), typedResult.success && nestedResult.success && hasDiagnosticCode(invalidResult.errors, "E_TYPE_MISMATCH"), {
        passMessage: "values(record) keeps typed collection flows visible to semantic checking.",
        failMessage: "values(record) still loses typing or bypasses downstream validation.",
        evidence: [
          ...diagnosticEvidence(typedResult.errors),
          ...diagnosticEvidence(invalidResult.errors),
          ...diagnosticEvidence(nestedResult.errors),
          noteEvidence("Observed nested order field", nestedResult.value?.state.fields["orders"]),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.STATE_ARG_SELECTION_COVERAGE, "(MEL-SUGAR-4) argmax()/argmin() narrow away null only when eligibility is exhaustively covered"), () => {
    const coveredResult = adapter.compile(`
      domain Demo {
        state {
          mode: "ship" | "pickup" = "ship"
          note: string = ""
        }

        computed carrier = argmax(
          ["pickup", eq(mode, "pickup"), 100],
          ["ship", eq(mode, "ship"), 80],
          "first"
        )

        computed tier = match(
          carrier,
          ["pickup", "pickup"],
          ["ship", "ship"],
          "manual"
        )

        action remember() {
          when true {
            patch note = carrier
          }
        }
      }
    `);
    const coveredMinResult = adapter.compile(`
      domain Demo {
        state {
          mode: "ship" | "pickup" = "ship"
          note: string = ""
        }

        computed carrier = argmin(
          ["pickup", eq(mode, "pickup"), 100],
          ["ship", eq(mode, "ship"), 80],
          "first"
        )

        computed tier = match(
          carrier,
          ["pickup", "pickup"],
          ["ship", "ship"],
          "manual"
        )

        action remember() {
          when true {
            patch note = carrier
          }
        }
      }
    `);
    const uncoveredResult = adapter.compile(`
      domain Demo {
        state {
          flag: boolean = false
          note: string = ""
        }

        computed carrier = argmax(
          ["a", flag, 1],
          ["b", false, 0],
          "first"
        )

        computed tier = match(
          carrier,
          ["a", "A"],
          ["b", "B"],
          "manual"
        )

        action remember() {
          when true {
            patch note = carrier
          }
        }
      }
    `);
    const literalGapResult = adapter.compile(`
      domain Demo {
        state {
          mode: "ship" | "pickup" | "digital" = "ship"
          note: string = ""
        }

        computed carrier = argmax(
          ["pickup", eq(mode, "pickup"), 100],
          ["ship", eq(mode, "ship"), 80],
          "first"
        )

        computed tier = match(
          carrier,
          ["pickup", "pickup"],
          ["ship", "ship"],
          "manual"
        )

        action remember() {
          when true {
            patch note = carrier
          }
        }
      }
    `);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("MEL-SUGAR-4"), coveredResult.success && coveredMinResult.success && hasDiagnosticCode(uncoveredResult.errors, "E_TYPE_MISMATCH") && hasDiagnosticCode(literalGapResult.errors, "E_TYPE_MISMATCH"), {
        passMessage: "argmax()/argmin() preserve non-null label typing only when candidate eligibility coverage is statically exhaustive.",
        failMessage: "argmax()/argmin() nullability narrowing is either too weak for exhaustive coverage or too loose for uncovered cases.",
        evidence: [
          ...diagnosticEvidence(coveredResult.errors),
          ...diagnosticEvidence(coveredMinResult.errors),
          ...diagnosticEvidence(uncoveredResult.errors),
          ...diagnosticEvidence(literalGapResult.errors),
        ],
      }),
    ]);
  });
});
