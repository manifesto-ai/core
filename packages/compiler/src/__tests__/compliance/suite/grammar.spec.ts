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

describe("CCTS Grammar Suite", () => {
  it(caseTitle(CCTS_CASES.GRAMMAR_RESERVED_IDENTIFIERS, "(A14/A17/E004) reserved namespaces and identifiers are rejected"), () => {
    const dollarResult = adapter.lex("my$var");
    const reservedResult = adapter.compile(`
      domain Demo {
        state {
          __sys__value: string = ""
        }
      }
    `);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A14"), dollarResult.errors.length > 0, {
        passMessage: "$-prefixed and $-bearing identifiers are rejected from user space.",
        failMessage: "The lexer accepted a user-space identifier that crossed the reserved $ namespace boundary.",
        evidence: diagnosticEvidence(dollarResult.errors),
      }),
      evaluateRule(getRuleOrThrow("A17"), dollarResult.errors.length > 0, {
        passMessage: "$ remains prohibited in user identifiers.",
        failMessage: "User identifiers still permit $.",
        evidence: diagnosticEvidence(dollarResult.errors),
      }),
      evaluateRule(getRuleOrThrow("E004"), hasDiagnosticCode(reservedResult.errors, "E004"), {
        passMessage: "Legacy reserved compiler prefixes are diagnosed as E004.",
        failMessage: "Reserved compiler prefixes were not diagnosed as E004.",
        evidence: diagnosticEvidence(reservedResult.errors),
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.GRAMMAR_CANONICAL_SURFACE, "(A5/A6) non-canonical or imperative MEL surface is rejected"), () => {
    const methodResult = adapter.compile(`
      domain Demo {
        state { title: string = "" }
        computed trimmed = title.trim()
      }
    `);
    const whileResult = adapter.compile(`
      domain Demo {
        action loop() {
          while true {
            stop "noop"
          }
        }
      }
    `);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("A5"), whileResult.errors.length > 0, {
        passMessage: "Imperative loop syntax is not part of MEL.",
        failMessage: "Imperative loop syntax unexpectedly compiled as valid MEL.",
        evidence: diagnosticEvidence(whileResult.errors),
      }),
      evaluateRule(getRuleOrThrow("A6"), methodResult.errors.length > 0, {
        passMessage: "Method-call sugar remains rejected in favor of canonical MEL function syntax.",
        failMessage: "Method-call syntax unexpectedly compiled as valid MEL.",
        evidence: diagnosticEvidence(methodResult.errors),
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.GRAMMAR_INVALID_SYSTEM_REF, "(E003) invalid system references are diagnosed"), () => {
    const result = adapter.compile(`
      domain Demo {
        computed value = $system.nope
      }
    `);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("E003"), hasDiagnosticCode(result.errors, "E003"), {
        passMessage: "Invalid $system keys are diagnosed.",
        failMessage: "Invalid $system keys were accepted.",
        evidence: diagnosticEvidence(result.errors),
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.GRAMMAR_ONCE_INTENT_CONTEXTUAL, "(COMPILER-MEL-3) onceIntent is a contextual keyword"), () => {
    const statementResult = adapter.parse(`
      domain Demo {
        state { count: number = 0 }
        action inc() {
          onceIntent {
            when true { patch count = add(count, 1) }
          }
        }
      }
    `);
    const identifierResult = adapter.compile(`
      domain Demo {
        state { onceIntent: string = "" }
        action submit() {
          once(onceIntent) {
            patch onceIntent = $meta.intentId
          }
        }
      }
    `);

    const action = statementResult.value?.domain.members.find((member) => member.kind === "action");
    const firstStmt = action && action.kind === "action"
      ? action.body[0]
      : null;
    const contextualSatisfied =
      statementResult.success &&
      firstStmt?.kind === "onceIntent" &&
      identifierResult.success;

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("COMPILER-MEL-3"), contextualSatisfied, {
        passMessage: "onceIntent is parsed contextually without reserving the identifier globally.",
        failMessage: "onceIntent no longer behaves as a contextual keyword.",
        evidence: [
          noteEvidence("Statement-start parse kind", firstStmt?.kind ?? null),
          ...diagnosticEvidence(statementResult.errors),
          ...diagnosticEvidence(identifierResult.errors),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.GRAMMAR_OBJECT_SPREAD_BOUNDARY, "(SPREAD-SURFACE-1/SPREAD-DIAG-1) object-spread surface and boundary diagnostics are enforced"), () => {
    const surfaceResult = adapter.compile(`
      domain Demo {
        type Profile = { name: string }

        state {
          profile: Profile = { name: "" }
        }

        computed copy = { ...profile, name: "next" }
      }
    `);
    const arraySpreadResult = adapter.compile(`
      domain Demo {
        computed copy = [...items]
      }
    `);
    const computedKeyResult = adapter.compile(`
      domain Demo {
        state {
          name: string = ""
        }

        computed keyed = { [name]: 1 }
      }
    `);
    const optionalChainingResult = adapter.compile(`
      domain Demo {
        type Profile = { name: string }

        state {
          profile: Profile = { name: "" }
        }

        computed maybeName = profile?.name
      }
    `);
    const boundaryDiagnosticsHold = [arraySpreadResult, computedKeyResult, optionalChainingResult].every((result) =>
      result.errors.some((diagnostic) =>
        diagnostic.message.includes("Object spread is the only bounded JavaScript-like sugar admitted in current MEL.")
      )
    );

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("SPREAD-SURFACE-1"), surfaceResult.success, {
        passMessage: "Object-literal spread is admitted as the bounded v1.2 parser-level shorthand.",
        failMessage: "Object-literal spread is not admitted even though SPEC v1.2 declares it current.",
        evidence: diagnosticEvidence(surfaceResult.errors),
      }),
      evaluateRule(getRuleOrThrow("SPREAD-DIAG-1"), boundaryDiagnosticsHold, {
        passMessage: "Adjacent JS-like forms around object spread remain rejected.",
        failMessage: "Adjacent JS-like forms around object spread were not rejected.",
        evidence: [
          ...diagnosticEvidence(arraySpreadResult.errors),
          ...diagnosticEvidence(computedKeyResult.errors),
          ...diagnosticEvidence(optionalChainingResult.errors),
        ],
      }),
    ]);
  });
});
