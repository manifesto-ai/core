import { describe, expect, it } from "vitest";
import { createCompilerComplianceAdapter } from "../ccts-adapter.js";
import {
  evaluateRule,
  expectAllCompliance,
  noteEvidence,
} from "../ccts-assertions.js";
import { CCTS_CASES, caseTitle } from "../ccts-coverage.js";
import { getRuleOrThrow } from "../ccts-rules.js";

const adapter = createCompilerComplianceAdapter();

const SOURCE = `
  domain Demo {
    state {
      count: number = 0
      items: Array<string> = []
    }
    computed doubled = mul(count, 2)
    action increment() {
      when true {
        patch count = add(count, 1)
      }
    }
  }
`;

describe("CCTS Determinism Suite", () => {
  it(caseTitle(CCTS_CASES.DETERMINISM_COMPILE, "(A2/A9) compilation stays deterministic for identical source"), () => {
    const first = adapter.compile(SOURCE);
    const second = adapter.compile(SOURCE);

    const firstHash = first.value?.hash;
    const secondHash = second.value?.hash;
    const sameErrors = JSON.stringify(first.errors) === JSON.stringify(second.errors);
    const sameWarnings = JSON.stringify(first.warnings) === JSON.stringify(second.warnings);
    const satisfied = first.success && second.success && firstHash === secondHash && sameErrors && sameWarnings;

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A2"), satisfied, {
        passMessage: "Repeated compilation yields the same schema hash and diagnostics.",
        failMessage: "Repeated compilation produced divergent schema hashes or diagnostics.",
        evidence: [
          noteEvidence("First compile hash", firstHash),
          noteEvidence("Second compile hash", secondHash),
          noteEvidence("First compile trace length", first.trace?.length ?? 0),
          noteEvidence("Second compile trace length", second.trace?.length ?? 0),
        ],
      }),
      evaluateRule(getRuleOrThrow("A9"), satisfied, {
        passMessage: "Compiler output remains stable for identical source input.",
        failMessage: "Compiler output is no longer stable for identical source input.",
        evidence: [
          noteEvidence("First compile hash", firstHash),
          noteEvidence("Second compile hash", secondHash),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.DETERMINISM_LOWER, "(A9) lowering stays deterministic for identical source"), () => {
    const first = adapter.lower(SOURCE);
    const second = adapter.lower(SOURCE);
    const firstJson = JSON.stringify(first.value);
    const secondJson = JSON.stringify(second.value);
    const sameErrors = JSON.stringify(first.errors) === JSON.stringify(second.errors);
    const satisfied = first.success && second.success && firstJson === secondJson && sameErrors;

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A9"), satisfied, {
        passMessage: "Repeated lowering yields identical output and diagnostics.",
        failMessage: "Repeated lowering produced different output or diagnostics.",
        evidence: [
          noteEvidence("First lowered JSON size", firstJson.length),
          noteEvidence("Second lowered JSON size", secondJson.length),
        ],
      }),
    ]);

    expect(firstJson).toBe(secondJson);
  });
});
