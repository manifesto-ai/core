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
import { tokenize } from "../../../lexer/index.js";
import { parse } from "../../../parser/index.js";
import { analyzeScope } from "../../../analyzer/scope.js";
import { validateSemantics } from "../../../analyzer/validator.js";
import { validateAndExpandFlows } from "../../../analyzer/flow-composition.js";
import { generateCanonical } from "../../../generator/ir.js";

const adapter = createCompilerComplianceAdapter();

function compileCanonical(source: string) {
  const lexed = tokenize(source);
  const lexErrors = lexed.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (lexErrors.length > 0) {
    return { success: false, value: null, errors: lexErrors };
  }

  const parsed = parse(lexed.tokens);
  const parseErrors = parsed.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (parseErrors.length > 0 || !parsed.program) {
    return { success: false, value: null, errors: parseErrors };
  }

  const flowResult = validateAndExpandFlows(parsed.program);
  const scopeResult = analyzeScope(flowResult.program);
  const semanticResult = validateSemantics(flowResult.program);
  const diagnostics = [
    ...flowResult.diagnostics,
    ...scopeResult.diagnostics,
    ...semanticResult.diagnostics,
  ];
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length > 0) {
    return { success: false, value: null, errors };
  }

  const generated = generateCanonical(flowResult.program);
  const generationErrors = generated.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error"
  );

  return {
    success: generationErrors.length === 0 && generated.schema !== null,
    value: generated.schema,
    errors: generationErrors,
  };
}

describe("CCTS Entity Primitive Suite", () => {
  it(caseTitle(CCTS_CASES.ENTITY_SURFACE, "(ADR-013b, ENTITY-1/3/4/5/7/8/9) entity primitives remain explicit compiler surface"), () => {
    const source = `
      domain Demo {
        type Task = { id: string, title: string, done: boolean }
        state {
          tasks: Array<Task> = []
          selectedId: string = ""
        }
        computed selected = findById(tasks, null)
        computed hasSelected = existsById(tasks, selectedId)
        action updateOne(id: string) {
          when true {
            patch tasks = updateById(tasks, id, { done: true })
          }
        }
        action removeOne(id: string) {
          when true {
            patch tasks = removeById(tasks, id)
          }
        }
      }
    `;
    const canonical = compileCanonical(source);
    const compiled = adapter.compile(source);
    const rendered = JSON.stringify(canonical.value);
    const canonicalCallsSatisfied =
      canonical.success &&
      rendered.includes("\"fn\":\"findById\"") &&
      rendered.includes("\"fn\":\"existsById\"") &&
      rendered.includes("\"fn\":\"updateById\"") &&
      rendered.includes("\"fn\":\"removeById\"");
    const lowered = adapter.lower(source);
    const loweredRendered = JSON.stringify(lowered.value);
    const loweringSatisfied =
      lowered.success &&
      !loweredRendered.includes("findById") &&
      !loweredRendered.includes("existsById") &&
      !loweredRendered.includes("updateById") &&
      !loweredRendered.includes("removeById");

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("ADR-013b"), canonicalCallsSatisfied, {
        passMessage: "Entity primitives are accepted as explicit MEL surface forms.",
        failMessage: "Entity primitives are not preserved as explicit MEL surface forms.",
        evidence: [
          noteEvidence("Compiled schema excerpt", rendered.slice(0, 400)),
          ...diagnosticEvidence(canonical.errors),
        ],
      }),
      evaluateRule(getRuleOrThrow("ENTITY-1"), canonicalCallsSatisfied, {
        passMessage: "Entity primitives preserve fixed-key entity semantics on the compiler surface.",
        failMessage: "Entity primitive surface no longer preserves fixed-key entity semantics.",
        evidence: [noteEvidence("Compiled schema excerpt", rendered.slice(0, 400))],
      }),
      evaluateRule(getRuleOrThrow("ENTITY-3"), canonicalCallsSatisfied, {
        passMessage: "Entity primitives preserve hidden caller-side matching semantics.",
        failMessage: "Entity primitive surface no longer preserves hidden caller-side matching semantics.",
        evidence: [noteEvidence("Compiled schema excerpt", rendered.slice(0, 400))],
      }),
      evaluateRule(getRuleOrThrow("ENTITY-4"), loweringSatisfied, {
        passMessage: "Entity primitive lowering uses existing Core IR kinds only.",
        failMessage: "Entity primitive lowering is not yet confined to existing Core IR kinds.",
        evidence: [noteEvidence("Lowered schema excerpt", loweredRendered.slice(0, 400))],
      }),
      evaluateRule(getRuleOrThrow("ENTITY-5"), loweringSatisfied, {
        passMessage: "Entity primitive lowering expands into existing Core expression nodes.",
        failMessage: "Entity primitive lowering is not yet expressed in existing Core expression nodes.",
        evidence: [noteEvidence("Lowered schema excerpt", loweredRendered.slice(0, 400))],
      }),
      evaluateRule(getRuleOrThrow("ENTITY-7"), canonicalCallsSatisfied, {
        passMessage: "Entity primitives remain a distinct MEL surface instead of generic effect shorthands.",
        failMessage: "Entity primitives are no longer exposed as a distinct MEL surface.",
        evidence: [noteEvidence("Compiled schema excerpt", rendered.slice(0, 400))],
      }),
      evaluateRule(getRuleOrThrow("ENTITY-8"), compiled.success, {
        passMessage: "null id arguments are accepted by the compiler surface.",
        failMessage: "null id arguments are not accepted by the compiler surface.",
        evidence: [
          noteEvidence("Canonical schema excerpt", rendered.slice(0, 400)),
          ...diagnosticEvidence(compiled.errors),
        ],
      }),
      evaluateRule(getRuleOrThrow("ENTITY-9"), canonicalCallsSatisfied, {
        passMessage: "Entity primitives remain as MEL call nodes until the lowering boundary.",
        failMessage: "Entity primitives no longer remain as MEL call nodes until the lowering boundary.",
        evidence: [noteEvidence("Compiled schema excerpt", rendered.slice(0, 400))],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.ENTITY_TRANSFORM_PLACEMENT, "(TRANSFORM-1..5, E031..E035) transform primitives stay placement-constrained"), () => {
    const computedMisuse = adapter.compile(`
      domain Demo {
        type Task = { id: string, title: string }
        state { tasks: Array<Task> = [] }
        computed invalid = updateById(tasks, "task-1", { title: "Done" })
      }
    `);
    const nestedMisuse = adapter.compile(`
      domain Demo {
        type Task = { id: string, title: string }
        state { tasks: Array<Task> = [] }
        action remove(id: string) {
          when true {
            patch tasks = updateById(removeById(tasks, id), id, { title: "Done" })
          }
        }
      }
    `);
    const computedPathMisuse = adapter.compile(`
      domain Demo {
        type Task = { id: string, title: string }
        state { tasks: Array<Task> = [] }
        computed activeTasks = tasks
        action remove(id: string) {
          when true {
            patch tasks = updateById(activeTasks, id, { title: "Done" })
          }
        }
      }
    `);
    const guardMisuse = adapter.compile(`
      domain Demo {
        type Task = { id: string, title: string }
        state { tasks: Array<Task> = [] }
        action remove(id: string) {
          when eq(len(updateById(tasks, id, { title: "Done" })), len(tasks)) {
            stop "Already processed"
          }
        }
      }
    `);
    const availableMisuse = adapter.compile(`
      domain Demo {
        type Task = { id: string, title: string }
        state { tasks: Array<Task> = [] }
        action remove() available when eq(len(removeById(tasks, "task-1")), len(tasks)) {
          when true {
            stop "Already processed"
          }
        }
      }
    `);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("TRANSFORM-1"), hasDiagnosticCode(computedMisuse.errors, "E031"), {
        passMessage: "Transform primitives remain forbidden outside patch RHS.",
        failMessage: "Transform primitives are no longer restricted to patch RHS.",
        evidence: diagnosticEvidence(computedMisuse.errors),
      }),
      evaluateRule(getRuleOrThrow("TRANSFORM-2"), hasDiagnosticCode(nestedMisuse.errors, "E032"), {
        passMessage: "Nested transform primitives remain forbidden.",
        failMessage: "Nested transform primitives are no longer rejected.",
        evidence: diagnosticEvidence(nestedMisuse.errors),
      }),
      evaluateRule(getRuleOrThrow("TRANSFORM-3"), hasDiagnosticCode(computedPathMisuse.errors, "E033"), {
        passMessage: "Transform primitive collections must resolve to a state path.",
        failMessage: "Transform primitive collections are no longer constrained to state paths.",
        evidence: diagnosticEvidence(computedPathMisuse.errors),
      }),
      evaluateRule(getRuleOrThrow("TRANSFORM-4"), hasDiagnosticCode(guardMisuse.errors, "E034"), {
        passMessage: "Transform primitives remain forbidden in guard conditions.",
        failMessage: "Transform primitives are no longer rejected in guard conditions.",
        evidence: diagnosticEvidence(guardMisuse.errors),
      }),
      evaluateRule(getRuleOrThrow("TRANSFORM-5"), hasDiagnosticCode(availableMisuse.errors, "E035"), {
        passMessage: "Transform primitives remain forbidden in available conditions.",
        failMessage: "Transform primitives are no longer rejected in available conditions.",
        evidence: diagnosticEvidence(availableMisuse.errors),
      }),
      evaluateRule(getRuleOrThrow("E031"), hasDiagnosticCode(computedMisuse.errors, "E031"), {
        passMessage: "E031 diagnoses transform use outside patch RHS.",
        failMessage: "E031 is not emitted for transform use outside patch RHS.",
        evidence: diagnosticEvidence(computedMisuse.errors),
      }),
      evaluateRule(getRuleOrThrow("E032"), hasDiagnosticCode(nestedMisuse.errors, "E032"), {
        passMessage: "E032 diagnoses nested transform primitives.",
        failMessage: "E032 is not emitted for nested transform primitives.",
        evidence: diagnosticEvidence(nestedMisuse.errors),
      }),
      evaluateRule(getRuleOrThrow("E033"), hasDiagnosticCode(computedPathMisuse.errors, "E033"), {
        passMessage: "E033 diagnoses non-state-path transform collections.",
        failMessage: "E033 is not emitted for non-state-path transform collections.",
        evidence: diagnosticEvidence(computedPathMisuse.errors),
      }),
      evaluateRule(getRuleOrThrow("E034"), hasDiagnosticCode(guardMisuse.errors, "E034"), {
        passMessage: "E034 diagnoses transform primitives inside guards.",
        failMessage: "E034 is not emitted for transform primitives inside guards.",
        evidence: diagnosticEvidence(guardMisuse.errors),
      }),
      evaluateRule(getRuleOrThrow("E035"), hasDiagnosticCode(availableMisuse.errors, "E035"), {
        passMessage: "E035 diagnoses transform primitives inside available conditions.",
        failMessage: "E035 is not emitted for transform primitives inside available conditions.",
        evidence: diagnosticEvidence(availableMisuse.errors),
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.ENTITY_TYPING, "(ENTITY-2/2a/2b, E030/E030a/E030b) entity typing and uniqueness remain explicit"), () => {
    const missingId = adapter.compile(`
      domain Demo {
        type Task = { title: string }
        state { tasks: Array<Task> = [] }
        computed selected = findById(tasks, "task-1")
      }
    `);
    const nonPrimitiveId = adapter.compile(`
      domain Demo {
        type Task = { id: { value: string }, title: string }
        state { tasks: Array<Task> = [] }
        computed selected = findById(tasks, "task-1")
      }
    `);
    const duplicateInitializer = adapter.compile(`
      domain Demo {
        type Task = { id: string, title: string }
        state {
          tasks: Array<Task> = [
            { id: "task-1", title: "A" },
            { id: "task-1", title: "B" }
          ]
        }
        computed selected = findById(tasks, "task-1")
      }
    `);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("ENTITY-2"), hasDiagnosticCode(missingId.errors, "E030"), {
        passMessage: "Collections without .id remain invalid for entity primitives.",
        failMessage: "Collections without .id are no longer rejected for entity primitives.",
        evidence: diagnosticEvidence(missingId.errors),
      }),
      evaluateRule(getRuleOrThrow("ENTITY-2a"), hasDiagnosticCode(nonPrimitiveId.errors, "E030a"), {
        passMessage: "Non-primitive .id fields remain invalid for entity primitives.",
        failMessage: "Non-primitive .id fields are no longer rejected for entity primitives.",
        evidence: diagnosticEvidence(nonPrimitiveId.errors),
      }),
      evaluateRule(getRuleOrThrow("ENTITY-2b"), hasDiagnosticCode(duplicateInitializer.errors, "E030b"), {
        passMessage: "Duplicate .id values in state initializers remain statically detectable.",
        failMessage: "Duplicate .id values in state initializers are not statically detected.",
        evidence: diagnosticEvidence(duplicateInitializer.errors),
      }),
      evaluateRule(getRuleOrThrow("E030"), hasDiagnosticCode(missingId.errors, "E030"), {
        passMessage: "E030 diagnoses missing entity id fields.",
        failMessage: "E030 is not emitted for missing entity id fields.",
        evidence: diagnosticEvidence(missingId.errors),
      }),
      evaluateRule(getRuleOrThrow("E030a"), hasDiagnosticCode(nonPrimitiveId.errors, "E030a"), {
        passMessage: "E030a diagnoses non-primitive entity id fields.",
        failMessage: "E030a is not emitted for non-primitive entity id fields.",
        evidence: diagnosticEvidence(nonPrimitiveId.errors),
      }),
      evaluateRule(getRuleOrThrow("E030b"), hasDiagnosticCode(duplicateInitializer.errors, "E030b"), {
        passMessage: "E030b diagnoses duplicate entity ids in state initializers.",
        failMessage: "E030b is not emitted for duplicate entity ids in state initializers.",
        evidence: diagnosticEvidence(duplicateInitializer.errors),
      }),
    ]);
  });
});
