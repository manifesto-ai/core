import { semanticPathToPatchPath } from "@manifesto-ai/core";
import { describe, it } from "vitest";
import type { CoreFlowNode } from "../../../generator/ir.js";
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

describe("CCTS Actions and Control Suite", () => {
  it(caseTitle(CCTS_CASES.ACTIONS_GUARDED_BODY, "(A7) patch/effect statements remain guarded"), () => {
    const patchResult = adapter.compile(`
      domain Demo {
        state { count: number = 0 }
        action bump() {
          patch count = add(count, 1)
        }
      }
    `);
    const effectResult = adapter.compile(`
      domain Demo {
        state { count: number = 0 }
        action ping() {
          effect api.fetch({ into: count })
        }
      }
    `);

    const guardedSatisfied =
      hasDiagnosticCode(patchResult.errors, ["E_UNGUARDED_PATCH", "E_UNGUARDED_STMT", "MEL_PARSER"]) &&
      hasDiagnosticCode(effectResult.errors, ["E_UNGUARDED_EFFECT", "E_UNGUARDED_STMT", "MEL_PARSER"]);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A7"), guardedSatisfied, {
        passMessage: "Action mutations remain guarded by compiler validation.",
        failMessage: "Compiler accepted an unguarded patch or effect statement.",
        evidence: [
          ...diagnosticEvidence(patchResult.errors),
          ...diagnosticEvidence(effectResult.errors),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.ACTIONS_ONCE_DESUGARING, "(A10, COMPILER-MEL-2/2a) once() keeps semantic marker semantics"), () => {
    const result = adapter.compile(`
      domain Demo {
        state {
          marker: string = ""
          count: number = 0
        }
        action inc() {
          once(marker) {
            patch count = add(count, 1)
          }
        }
      }
    `);

    const flow = result.value?.actions["inc"]?.flow as
      | { kind?: string; cond?: { kind?: string; left?: { kind?: string; path?: string }; right?: { kind?: string; path?: string } }; then?: CoreFlowNode }
      | undefined;
    const thenSeq = flow?.then && flow.then.kind === "seq"
      ? flow.then
      : null;
    const firstStep = thenSeq?.steps[0];
    const semanticMarkerSatisfied =
      result.success &&
      flow?.kind === "if" &&
      flow.cond?.kind === "neq" &&
      flow.cond.left?.kind === "get" &&
      flow.cond.left.path === "marker" &&
      flow.cond.right?.kind === "get" &&
      flow.cond.right.path === "meta.intentId" &&
      firstStep?.kind === "patch" &&
      firstStep.op === "set" &&
      JSON.stringify(firstStep.path) === JSON.stringify(semanticPathToPatchPath("marker"));
    const mayMergeEquivalent =
      semanticMarkerSatisfied ||
      (firstStep?.kind === "patch" &&
        firstStep.op === "merge" &&
        JSON.stringify(firstStep.path) === JSON.stringify(semanticPathToPatchPath("$mel.guards.intent")));

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A10"), semanticMarkerSatisfied, {
        passMessage: "once() desugars to per-intent marker semantics.",
        failMessage: "once() no longer lowers to the expected per-intent guard shape.",
        evidence: [noteEvidence("Observed flow", flow)],
      }),
      evaluateRule(getRuleOrThrow("COMPILER-MEL-2"), semanticMarkerSatisfied, {
        passMessage: "once(X) writes back to the same semantic marker path X.",
        failMessage: "once(X) no longer writes back to the same semantic marker path X.",
        evidence: [noteEvidence("Observed first step", firstStep)],
      }),
      evaluateRule(getRuleOrThrow("COMPILER-MEL-2a"), mayMergeEquivalent, {
        passMessage: "Compiler uses an allowed once() guard-write strategy.",
        failMessage: "Compiler no longer uses an allowed once() guard-write strategy.",
        evidence: [noteEvidence("Observed first step", firstStep)],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.ACTIONS_ONCE_INTENT_DESUGARING, "(COMPILER-MEL-1) onceIntent lowers to map-level guard merges"), () => {
    const result = adapter.compile(`
      domain Demo {
        state { count: number = 0 }
        action inc() {
          onceIntent {
            patch count = add(count, 1)
          }
        }
      }
    `);

    const flow = result.value?.actions["inc"]?.flow as
      | { kind?: string; then?: CoreFlowNode }
      | undefined;
    const thenSeq = flow?.then && flow.then.kind === "seq"
      ? flow.then
      : null;
    const firstStep = thenSeq?.steps[0];
    const satisfied =
      result.success &&
      flow?.kind === "if" &&
      firstStep?.kind === "patch" &&
      firstStep.op === "merge" &&
      JSON.stringify(firstStep.path) === JSON.stringify(semanticPathToPatchPath("$mel.guards.intent"));

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("COMPILER-MEL-1"), satisfied, {
        passMessage: "onceIntent lowers to a map-level guard merge at $mel.guards.intent.",
        failMessage: "onceIntent no longer lowers to the expected map-level guard merge.",
        evidence: [noteEvidence("Observed first step", firstStep)],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.ACTIONS_FAIL_STOP_LOWERING, "(A29/A30) fail and stop lower to flow-control nodes"), () => {
    const failResult = adapter.compile(`
      domain Demo {
        action reject() {
          when true {
            fail "REJECTED"
          }
        }
      }
    `);
    const stopResult = adapter.compile(`
      domain Demo {
        action noop() {
          when true {
            stop "Already processed"
          }
        }
      }
    `);

    const failFlow = failResult.value?.actions["reject"]?.flow as
      | { kind?: string; then?: { kind?: string } }
      | undefined;
    const stopFlow = stopResult.value?.actions["noop"]?.flow as
      | { kind?: string; then?: { kind?: string } }
      | undefined;

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A29"), failResult.success && failFlow?.kind === "if" && failFlow.then?.kind === "fail", {
        passMessage: "fail lowers to a FlowNode fail branch.",
        failMessage: "fail did not lower to the expected FlowNode fail branch.",
        evidence: [noteEvidence("Observed fail flow", failFlow)],
      }),
      evaluateRule(getRuleOrThrow("A30"), stopResult.success && stopFlow?.kind === "if" && stopFlow.then?.kind === "halt", {
        passMessage: "stop lowers to a FlowNode halt branch.",
        failMessage: "stop did not lower to the expected FlowNode halt branch.",
        evidence: [noteEvidence("Observed stop flow", stopFlow)],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.ACTIONS_FAIL_STOP_DIAGNOSTICS, "(E006/E007/E008) fail/stop diagnostics remain visible"), () => {
    const failResult = adapter.compile(`
      domain Demo {
        action reject() {
          fail "REJECTED"
        }
      }
    `);
    const stopResult = adapter.compile(`
      domain Demo {
        action noop() {
          stop "Waiting for approval"
        }
      }
    `);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("E006"), hasDiagnosticCode(failResult.errors, "E006"), {
        passMessage: "unguarded fail emits E006.",
        failMessage: "unguarded fail is not yet diagnosed as E006.",
        evidence: diagnosticEvidence(failResult.errors),
      }),
      evaluateRule(getRuleOrThrow("E007"), hasDiagnosticCode(stopResult.errors, "E007"), {
        passMessage: "unguarded stop emits E007.",
        failMessage: "unguarded stop is not yet diagnosed as E007.",
        evidence: diagnosticEvidence(stopResult.errors),
      }),
      evaluateRule(getRuleOrThrow("E008"), hasDiagnosticCode(stopResult.errors, "E008"), {
        passMessage: "waiting/pending stop messages emit E008.",
        failMessage: "waiting/pending stop messages are not yet diagnosed as E008.",
        evidence: diagnosticEvidence(stopResult.errors),
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.ACTIONS_AGGREGATION, "(A32/E009/E010/E011) aggregation stays constrained"), () => {
    const actionAggregation = adapter.compile(`
      domain Demo {
        state { counts: Array<number> = [] }
        action invalid() {
          when gt(sum(counts), 0) {
            stop "Already processed"
          }
        }
      }
    `);
    const composedAggregation = adapter.compile(`
      domain Demo {
        state { counts: Array<number> = [] }
        computed total = sum(len(counts))
      }
    `);
    const reduceResult = adapter.compile(`
      domain Demo {
        state { counts: Array<number> = [] }
        computed total = reduce(counts, 0, 0)
      }
    `);

    const constrained =
      hasDiagnosticCode(actionAggregation.errors, "E009") &&
      hasDiagnosticCode(composedAggregation.errors, "E010") &&
      hasDiagnosticCode(reduceResult.errors, "E011");

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A32"), constrained, {
        passMessage: "Primitive aggregation remains constrained to the spec surface.",
        failMessage: "Primitive aggregation constraints regressed.",
        evidence: [
          ...diagnosticEvidence(actionAggregation.errors),
          ...diagnosticEvidence(composedAggregation.errors),
          ...diagnosticEvidence(reduceResult.errors),
        ],
      }),
      evaluateRule(getRuleOrThrow("E009"), hasDiagnosticCode(actionAggregation.errors, "E009"), {
        passMessage: "Primitive aggregation in action flow emits E009.",
        failMessage: "Primitive aggregation in action flow no longer emits E009.",
        evidence: diagnosticEvidence(actionAggregation.errors),
      }),
      evaluateRule(getRuleOrThrow("E010"), hasDiagnosticCode(composedAggregation.errors, "E010"), {
        passMessage: "Composed primitive aggregation emits E010.",
        failMessage: "Composed primitive aggregation no longer emits E010.",
        evidence: diagnosticEvidence(composedAggregation.errors),
      }),
      evaluateRule(getRuleOrThrow("E011"), hasDiagnosticCode(reduceResult.errors, "E011"), {
        passMessage: "reduce/fold/scan escape hatches emit E011.",
        failMessage: "reduce/fold/scan escape hatches no longer emit E011.",
        evidence: diagnosticEvidence(reduceResult.errors),
      }),
    ]);
  });
});
