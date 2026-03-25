import { describe, it } from "vitest";
import type { CoreExprNode, CoreFlowNode } from "../../../generator/ir.js";
import { createEvaluationContext, evaluateExpr } from "../../../index.js";
import { createCompilerComplianceAdapter } from "../ccts-adapter.js";
import {
  evaluateRule,
  expectAllCompliance,
  noteEvidence,
} from "../ccts-assertions.js";
import { CCTS_CASES, caseTitle } from "../ccts-coverage.js";
import { getRuleOrThrow } from "../ccts-rules.js";

const adapter = createCompilerComplianceAdapter();

function collectEffectTypes(flow: CoreFlowNode | undefined, types: string[] = []): string[] {
  if (!flow) {
    return types;
  }

  switch (flow.kind) {
    case "seq":
      for (const step of flow.steps) {
        collectEffectTypes(step, types);
      }
      break;
    case "if":
      collectEffectTypes(flow.then, types);
      if (flow.else) {
        collectEffectTypes(flow.else, types);
      }
      break;
    case "effect":
      types.push(flow.type);
      break;
  }

  return types;
}

describe("CCTS Lowering and IR Suite", () => {
  it(caseTitle(CCTS_CASES.IR_CALL_ONLY, "(A13) call-only IR remains a tracked delta"), () => {
    const result = adapter.compile(`
      domain Demo {
        state {
          a: number = 1
          b: number = 2
        }
        computed total = add(a, b)
      }
    `);

    const expr = result.value?.computed.fields["total"]?.expr as { kind?: string } | undefined;

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A13"), result.success && expr?.kind === "call", {
        passMessage: "All operations use call-only IR nodes.",
        failMessage: "Generated IR still exposes specialized node kinds.",
        evidence: [noteEvidence("Observed expression kind", expr?.kind)],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_INDEX_AND_NEQ, "(A11/A19) index access and neq semantics stay normalized"), () => {
    const result = adapter.compile(`
      domain Demo {
        state {
          count: number = 1
          items: Array<number> = [1]
        }
        computed firstItem = items[0]
      }
    `);

    const expr = result.value?.computed.fields["firstItem"]?.expr as { kind?: string } | undefined;
    const ctx = createEvaluationContext({ meta: { intentId: "i1" } });
    const neqResult = evaluateExpr(
      { kind: "neq", left: { kind: "lit", value: 1 }, right: { kind: "lit", value: 2 } },
      ctx
    );
    const notEqResult = evaluateExpr(
      {
        kind: "not",
        arg: {
          kind: "eq",
          left: { kind: "lit", value: 1 },
          right: { kind: "lit", value: 2 },
        },
      },
      ctx
    );

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A19"), result.success && expr?.kind === "at", {
        passMessage: "Index syntax lowers through at().",
        failMessage: "Index syntax did not lower through at().",
        evidence: [noteEvidence("Observed expression", expr)],
      }),
      evaluateRule(getRuleOrThrow("A11"), neqResult === notEqResult, {
        passMessage: "neq(a, b) remains semantically equivalent to not(eq(a, b)).",
        failMessage: "neq(a, b) is no longer semantically equivalent to not(eq(a, b)).",
        evidence: [
          noteEvidence("Observed neq result", neqResult),
          noteEvidence("Observed not(eq) result", notEqResult),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_SYSTEM_LOWERING, "(A20..A24/A27/A34) compiler-owned system lowering inserts explicit effects"), () => {
    const source = `
      domain Demo {
        state {
          id: string = ""
          otherId: string = ""
        }
        action create() {
          when true {
            patch id = $system.uuid
            patch otherId = $system.uuid
          }
        }
      }
    `;
    const compiled = adapter.compile(source);
    const lowered = adapter.lower(source);

    const compiledRendered = JSON.stringify(compiled.value);
    const loweredRendered = JSON.stringify(lowered.value);
    const flow = lowered.value?.actions["create"]?.flow as CoreFlowNode | undefined;
    const effectTypes = collectEffectTypes(flow);
    const melField = lowered.value?.state.fields["$mel"];
    const slotFields = melField?.type === "object"
      ? Object.keys(
          melField.fields?.["sys"]?.fields?.["create"]?.fields?.["uuid"]?.fields ?? {}
        )
      : [];
    const guardedFlow = flow?.kind === "seq"
      ? flow.steps[flow.steps.length - 1]
      : undefined;
    const readinessSatisfied =
      guardedFlow?.kind === "if" &&
      guardedFlow.cond.kind === "eq" &&
      guardedFlow.cond.left.kind === "get" &&
      guardedFlow.cond.left.path === "$mel.sys.create.uuid.intent" &&
      guardedFlow.cond.right.kind === "get" &&
      guardedFlow.cond.right.path === "meta.intentId";

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A20"), lowered.success && effectTypes.includes("system.get"), {
        passMessage: "System values lower into Host-executed system.get effects.",
        failMessage: "System values did not lower into explicit system.get effects.",
        evidence: [noteEvidence("Observed effect types", effectTypes)],
      }),
      evaluateRule(getRuleOrThrow("A21"), lowered.success && effectTypes.length > 0 && effectTypes.every((type) => type === "system.get"), {
        passMessage: "Lowering uses only the system.get effect.",
        failMessage: "Lowering emitted non-system.get effects for system values.",
        evidence: [noteEvidence("Observed effect types", effectTypes)],
      }),
      evaluateRule(getRuleOrThrow("A22"), compiled.success && compiledRendered.includes("$system.uuid") && lowered.success && loweredRendered.includes("system.get"), {
        passMessage: "Compiler inserts system effects at lowering time.",
        failMessage: "Compiler did not insert system effects across the lowering boundary.",
        evidence: [
          noteEvidence("Compiled schema excerpt", compiledRendered.slice(0, 320)),
          noteEvidence("Lowered schema excerpt", loweredRendered.slice(0, 320)),
        ],
      }),
      evaluateRule(getRuleOrThrow("A23"), lowered.success && slotFields.length === 2, {
        passMessage: "Repeated $system.uuid use in one action deduplicates to one slot pair.",
        failMessage: "Repeated $system.uuid use in one action no longer deduplicates to one slot pair.",
        evidence: [noteEvidence("Observed slot fields", slotFields)],
      }),
      evaluateRule(getRuleOrThrow("A24"), readinessSatisfied, {
        passMessage: "Replay/readiness is expressed through intent slots in the lowered schema.",
        failMessage: "Replay/readiness is no longer expressed through intent slots in the lowered schema.",
        evidence: [noteEvidence("Observed lowered flow", flow)],
      }),
      evaluateRule(getRuleOrThrow("A27"), readinessSatisfied, {
        passMessage: "Readiness uses eq(intent_marker, $meta.intentId).",
        failMessage: "Readiness no longer uses eq(intent_marker, $meta.intentId).",
        evidence: [noteEvidence("Observed lowered flow", flow)],
      }),
      evaluateRule(getRuleOrThrow("A34"), lowered.success && !loweredRendered.includes("$system.uuid"), {
        passMessage: "Compiler remains the single MEL -> Core lowering boundary for system values.",
        failMessage: "System values survived past the compiler lowering boundary.",
        evidence: [noteEvidence("Lowered schema excerpt", loweredRendered.slice(0, 320))],
      }),
      evaluateRule(getRuleOrThrow("AD-COMP-LOW-001"), compiled.success && compiledRendered.includes("$system.uuid") && lowered.success && !loweredRendered.includes("$system.uuid"), {
        passMessage: "Compiler owns the lowering boundary from MEL Canonical IR to lowered runtime IR.",
        failMessage: "Lowering boundary ownership is no longer isolated to the compiler.",
        evidence: [
          noteEvidence("Compiled schema excerpt", compiledRendered.slice(0, 320)),
          noteEvidence("Lowered schema excerpt", loweredRendered.slice(0, 320)),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_PLATFORM_NAMESPACE, "(A26, COMPILER-MEL-4, SCHEMA-RESERVED-1) platform namespace alignment stays tracked"), () => {
    const lowered = adapter.lower(`
      domain Demo {
        state { id: string = "" }
        action create() {
          when true {
            patch id = $system.uuid
          }
        }
      }
    `);

    const rendered = JSON.stringify(lowered.value);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A26"), lowered.success && rendered.includes("$mel.sys"), {
        passMessage: "Lowered system slots live under $mel.sys.",
        failMessage: "Lowered system slots still use a legacy namespace.",
        evidence: [noteEvidence("Observed lowered schema excerpt", rendered.slice(0, 320))],
      }),
      evaluateRule(getRuleOrThrow("COMPILER-MEL-4"), lowered.success && rendered.includes("$mel.sys") && rendered.includes("\"op\":\"set\""), {
        passMessage: "System value patch bookkeeping uses leaf-level writes under $mel.sys.",
        failMessage: "System value patch bookkeeping is not yet aligned with $mel.sys leaf writes.",
        evidence: [noteEvidence("Observed lowered schema excerpt", rendered.slice(0, 320))],
      }),
      evaluateRule(getRuleOrThrow("SCHEMA-RESERVED-1"), lowered.success && rendered.includes("$mel"), {
        passMessage: "Compiler-owned schema state is isolated under the reserved $mel namespace.",
        failMessage: "Compiler-owned schema state is not yet isolated under the reserved $mel namespace.",
        evidence: [noteEvidence("Observed lowered schema excerpt", rendered.slice(0, 320))],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.IR_TOTAL_EVALUATION, "(A3/A15/A35, AD-COMP-LOW-003) expression evaluation stays total"), () => {
    const ctx = createEvaluationContext({
      meta: { intentId: "i1" },
      snapshot: { data: { count: 1 }, computed: {} },
    });

    const division = evaluateExpr(
      { kind: "div", left: { kind: "lit", value: 1 }, right: { kind: "lit", value: 0 } },
      ctx
    );
    const missing = evaluateExpr({ kind: "get", path: "missing.path" }, ctx);
    const invalidAdd = evaluateExpr(
      { kind: "add", left: { kind: "lit", value: "x" }, right: { kind: "lit", value: 1 } },
      ctx
    );
    const objectEquality = adapter.compile(`
      domain Demo {
        computed same = eq({ a: 1 }, { a: 1 })
      }
    `);

    const totalSatisfied = division === null && missing === null && invalidAdd === null;

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A3"), totalSatisfied, {
        passMessage: "Expression evaluation remains total and non-throwing.",
        failMessage: "Expression evaluation no longer behaves as a total function.",
        evidence: [
          noteEvidence("Division by zero result", division),
          noteEvidence("Missing path result", missing),
          noteEvidence("Invalid add result", invalidAdd),
        ],
      }),
      evaluateRule(getRuleOrThrow("A15"), objectEquality.errors.length > 0, {
        passMessage: "eq/neq remain limited to primitive-compatible operands.",
        failMessage: "eq/neq primitive-only enforcement is not yet visible at compile time.",
        evidence: [
          noteEvidence("Observed equality schema", objectEquality.value?.computed.fields["same"]?.expr),
          noteEvidence("Observed equality diagnostics", objectEquality.errors.map((diagnostic) => diagnostic.code)),
        ],
      }),
      evaluateRule(getRuleOrThrow("A35"), totalSatisfied, {
        passMessage: "Invalid runtime operations return null rather than throwing.",
        failMessage: "Invalid runtime operations no longer return null deterministically.",
        evidence: [
          noteEvidence("Division by zero result", division),
          noteEvidence("Missing path result", missing),
          noteEvidence("Invalid add result", invalidAdd),
        ],
      }),
      evaluateRule(getRuleOrThrow("AD-COMP-LOW-003"), totalSatisfied, {
        passMessage: "Compiler-exposed evaluation stays total for invalid operations.",
        failMessage: "Compiler-exposed evaluation is no longer total for invalid operations.",
        evidence: [
          noteEvidence("Division by zero result", division),
          noteEvidence("Missing path result", missing),
          noteEvidence("Invalid add result", invalidAdd),
        ],
      }),
    ]);
  });
});
