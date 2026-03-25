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

describe("CCTS Context Suite", () => {
  it(caseTitle(CCTS_CASES.CONTEXT_COMPUTED_SYSTEM, "(A25/E001) $system is rejected in computed expressions"), () => {
    const result = adapter.compile(`
      domain Demo {
        computed value = $system.uuid
      }
    `);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A25"), hasDiagnosticCode(result.errors, "E001"), {
        passMessage: "$system remains forbidden in computed expressions.",
        failMessage: "Computed expressions accepted $system.*.",
        evidence: diagnosticEvidence(result.errors),
      }),
      evaluateRule(getRuleOrThrow("E001"), hasDiagnosticCode(result.errors, "E001"), {
        passMessage: "$system in computed expressions is diagnosed as E001.",
        failMessage: "Expected E001 for $system in a computed expression.",
        evidence: diagnosticEvidence(result.errors),
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.CONTEXT_STATE_INIT_SYSTEM, "(A25/E002) $system is rejected in state initializers"), () => {
    const result = adapter.compile(`
      domain Demo {
        state {
          id: string = $system.uuid
        }
      }
    `);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A25"), hasDiagnosticCode(result.errors, "E002"), {
        passMessage: "$system remains forbidden in state initializers.",
        failMessage: "State initializers accepted $system.*.",
        evidence: diagnosticEvidence(result.errors),
      }),
      evaluateRule(getRuleOrThrow("E002"), hasDiagnosticCode(result.errors, "E002"), {
        passMessage: "$system in state initializers is diagnosed as E002.",
        failMessage: "Expected E002 for $system in a state initializer.",
        evidence: diagnosticEvidence(result.errors),
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.CONTEXT_AVAILABLE_PURITY, "(A28/E005) available when remains schema-pure"), () => {
    const systemResult = adapter.compile(`
      domain Demo {
        state { ready: boolean = true }
        action submit(id: string) available when eq($system.uuid, "x") {
          when ready { patch ready = false }
        }
      }
    `);
    const inputResult = adapter.compile(`
      domain Demo {
        state { ready: boolean = true }
        action submit(id: string) available when eq($input.id, "x") {
          when ready { patch ready = false }
        }
      }
    `);
    const metaResult = adapter.compile(`
      domain Demo {
        state { ready: boolean = true }
        action submit(id: string) available when eq($meta.intentId, "x") {
          when ready { patch ready = false }
        }
      }
    `);
    const paramResult = adapter.compile(`
      domain Demo {
        state { ready: boolean = true }
        action submit(id: string) available when eq(id, "x") {
          when ready { patch ready = false }
        }
      }
    `);

    const e005Satisfied =
      hasDiagnosticCode(systemResult.errors, "E005") &&
      hasDiagnosticCode(inputResult.errors, "E005");
    const a28Satisfied =
      hasDiagnosticCode(metaResult.errors, ["E005", "E_INVALID_ACCESS"]) &&
      hasDiagnosticCode(paramResult.errors, ["E005", "E_INVALID_ACCESS"]);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("E005"), e005Satisfied, {
        passMessage: "available when rejects $system.* and $input.*.",
        failMessage: "available when did not reject one of $system.* or $input.*.",
        evidence: [
          ...diagnosticEvidence(systemResult.errors),
          ...diagnosticEvidence(inputResult.errors),
        ],
      }),
      evaluateRule(getRuleOrThrow("A28"), a28Satisfied, {
        passMessage: "available when rejects $meta.* and action parameters.",
        failMessage: "Strengthened v0.7.0 available-context exclusions are not yet fully enforced.",
        evidence: [
          ...diagnosticEvidence(metaResult.errors),
          ...diagnosticEvidence(paramResult.errors),
          noteEvidence("Pending rule probes are non-blocking by design."),
        ],
      }),
    ]);
  });
});
