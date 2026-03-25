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

describe("CCTS Flow Composition Suite", () => {
  it(caseTitle(CCTS_CASES.FLOW_COMPOSITION, "(ADR-013a/A31) flow/include remains compile-time composition only"), () => {
    const source = `
      domain Demo {
        state { tasks: Array<string> = [] }
        flow requireTasks() {
          when eq(len(tasks), 0) {
            fail "EMPTY"
          }
        }
        action ensure() {
          include requireTasks()
          onceIntent {
            patch tasks = append(tasks, "ok")
          }
        }
      }
    `;
    const result = adapter.compile(source);
    const flow = result.value?.actions["ensure"]?.flow;
    const rendered = JSON.stringify(flow);
    const inlined = result.success && !rendered.includes("\"kind\":\"call\"");

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("ADR-013a"), inlined, {
        passMessage: "flow/include compiles as inlined composition.",
        failMessage: "flow/include is not yet implemented as compile-time composition.",
        evidence: [
          noteEvidence("Observed action flow", rendered || null),
          ...diagnosticEvidence(result.errors),
        ],
      }),
      evaluateRule(getRuleOrThrow("A31"), inlined, {
        passMessage: "MEL does not surface runtime FlowNode call usage.",
        failMessage: "MEL composition leaked a runtime call FlowNode.",
        evidence: [noteEvidence("Observed action flow", rendered || null)],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.FLOW_VALIDATION, "(FLOW-PARAM/CALL, E013..E024) flow validation contracts stay visible"), () => {
    const paramConflict = adapter.compile(`
      domain Demo {
        type Task = { id: string }
        state { tasks: Array<Task> = [] }
        action run() {
          when true { stop "ok" }
        }
        flow run(tasks: string) {
          when true { fail "NOPE" }
        }
      }
    `);
    const nestedFieldName = adapter.compile(`
      domain Demo {
        type Task = { id: string }
        flow helper(id: string) {
          when true { fail "NOPE" }
        }
        action run(id: string) {
          include helper(id)
          when true { stop "ok" }
        }
      }
    `);
    const circularInclude = adapter.compile(`
      domain Demo {
        flow first() { include second() }
        flow second() { include first() }
      }
    `);
    const depthOverflow = adapter.compile(`
      domain Demo {
        ${Array.from({ length: 17 }, (_, index) => {
          const flowName = `f${index + 1}`;
          const target = index === 16
            ? `when true { fail "END" }`
            : `include f${index + 2}()`;
          return `flow ${flowName}() { ${target} }`;
        }).join("\n")}
        action run() {
          include f1()
          when true { stop "ok" }
        }
      }
    `);
    const unknownTarget = adapter.compile(`
      domain Demo {
        action ensure() {
          include missing()
          when true { stop "ok" }
        }
      }
    `);
    const wrongArity = adapter.compile(`
      domain Demo {
        flow helper(id: string) {
          when true { fail "NOPE" }
        }
        action ensure() {
          include helper()
          when true { stop "ok" }
        }
      }
    `);
    const typeMismatch = adapter.compile(`
      domain Demo {
        flow helper(id: string) {
          when true { fail "NOPE" }
        }
        action ensure() {
          include helper(123)
          when true { stop "ok" }
        }
      }
    `);
    const invalidBody = adapter.compile(`
      domain Demo {
        state {
          count: number = 0
          marker: string = ""
        }
        flow invalid() {
          once(marker) {
            fail "NOPE"
          }
          onceIntent {
            fail "NOPE"
          }
          when true {
            include invalid()
            patch count = 1
            effect api.log({})
          }
        }
      }
    `);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("FLOW-PARAM-1"), hasDiagnosticCode(paramConflict.errors, "E021"), {
        passMessage: "Flow parameter collisions are diagnosed.",
        failMessage: "Flow parameter collisions are not yet diagnosed.",
        evidence: diagnosticEvidence(paramConflict.errors),
      }),
      evaluateRule(getRuleOrThrow("FLOW-PARAM-2"), !hasDiagnosticCode(nestedFieldName.errors, "E021"), {
        passMessage: "Nested field names are not treated as top-level collision targets.",
        failMessage: "Nested field names were incorrectly treated as collision targets.",
        evidence: diagnosticEvidence(nestedFieldName.errors),
      }),
      evaluateRule(getRuleOrThrow("FLOW-CALL-1"), hasDiagnosticCode(wrongArity.errors, "E023"), {
        passMessage: "include arity mismatches are diagnosed.",
        failMessage: "include arity mismatches are not yet diagnosed.",
        evidence: diagnosticEvidence(wrongArity.errors),
      }),
      evaluateRule(getRuleOrThrow("FLOW-CALL-2"), hasDiagnosticCode(typeMismatch.errors, "E024"), {
        passMessage: "include type mismatches are diagnosed.",
        failMessage: "include type mismatches are not yet diagnosed.",
        evidence: diagnosticEvidence(typeMismatch.errors),
      }),
      evaluateRule(getRuleOrThrow("E013"), hasDiagnosticCode(circularInclude.errors, "E013"), {
        passMessage: "Circular includes emit E013.",
        failMessage: "Circular includes do not yet emit E013.",
        evidence: diagnosticEvidence(circularInclude.errors),
      }),
      evaluateRule(getRuleOrThrow("E014"), hasDiagnosticCode(depthOverflow.errors, "E014"), {
        passMessage: "Excessive include expansion depth emits E014.",
        failMessage: "Include expansion depth is not yet guarded by E014.",
        evidence: diagnosticEvidence(depthOverflow.errors),
      }),
      evaluateRule(getRuleOrThrow("E015"), hasDiagnosticCode(unknownTarget.errors, "E015"), {
        passMessage: "Unknown include targets emit E015.",
        failMessage: "Unknown include targets do not yet emit E015.",
        evidence: diagnosticEvidence(unknownTarget.errors),
      }),
      evaluateRule(getRuleOrThrow("E016"), hasDiagnosticCode(invalidBody.errors, "E016"), {
        passMessage: "include stays forbidden in inner-statement positions.",
        failMessage: "include restrictions in inner-statement positions are not yet enforced.",
        evidence: diagnosticEvidence(invalidBody.errors),
      }),
      evaluateRule(getRuleOrThrow("E017"), hasDiagnosticCode(invalidBody.errors, "E017"), {
        passMessage: "once() stays forbidden inside flow bodies.",
        failMessage: "once() is not yet rejected inside flow bodies.",
        evidence: diagnosticEvidence(invalidBody.errors),
      }),
      evaluateRule(getRuleOrThrow("E018"), hasDiagnosticCode(invalidBody.errors, "E018"), {
        passMessage: "onceIntent stays forbidden inside flow bodies.",
        failMessage: "onceIntent is not yet rejected inside flow bodies.",
        evidence: diagnosticEvidence(invalidBody.errors),
      }),
      evaluateRule(getRuleOrThrow("E019"), hasDiagnosticCode(invalidBody.errors, "E019"), {
        passMessage: "patch stays forbidden inside flow bodies.",
        failMessage: "patch is not yet rejected inside flow bodies.",
        evidence: diagnosticEvidence(invalidBody.errors),
      }),
      evaluateRule(getRuleOrThrow("E020"), hasDiagnosticCode(invalidBody.errors, "E020"), {
        passMessage: "effect stays forbidden inside flow bodies.",
        failMessage: "effect is not yet rejected inside flow bodies.",
        evidence: diagnosticEvidence(invalidBody.errors),
      }),
      evaluateRule(getRuleOrThrow("E021"), hasDiagnosticCode(paramConflict.errors, "E021"), {
        passMessage: "Flow parameter collisions emit E021.",
        failMessage: "Flow parameter collisions do not yet emit E021.",
        evidence: diagnosticEvidence(paramConflict.errors),
      }),
      evaluateRule(getRuleOrThrow("E022"), hasDiagnosticCode(paramConflict.errors, "E022"), {
        passMessage: "Flow/action name collisions emit E022.",
        failMessage: "Flow/action name collisions do not yet emit E022.",
        evidence: diagnosticEvidence(paramConflict.errors),
      }),
      evaluateRule(getRuleOrThrow("E023"), hasDiagnosticCode(wrongArity.errors, "E023"), {
        passMessage: "include arity mismatches emit E023.",
        failMessage: "include arity mismatches do not yet emit E023.",
        evidence: diagnosticEvidence(wrongArity.errors),
      }),
      evaluateRule(getRuleOrThrow("E024"), hasDiagnosticCode(typeMismatch.errors, "E024"), {
        passMessage: "include type mismatches emit E024.",
        failMessage: "include type mismatches do not yet emit E024.",
        evidence: diagnosticEvidence(typeMismatch.errors),
      }),
    ]);
  });
});
