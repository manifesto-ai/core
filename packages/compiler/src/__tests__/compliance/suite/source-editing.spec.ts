import { describe, it } from "vitest";
import { compileFragmentInContext, compileMelModule } from "../../../api/index.js";
import {
  diagnosticEvidence,
  evaluateRule,
  expectAllCompliance,
  hasDiagnosticCode,
  noteEvidence,
} from "../ccts-assertions.js";
import { CCTS_CASES, caseTitle } from "../ccts-coverage.js";
import { getRuleOrThrow } from "../ccts-rules.js";

const BASE_SOURCE = `
  domain Demo {
    type Task = {
      id: string,
      title: string
    }

    state {
      count: number = 0
    }

    computed doubled = mul(count, 2)

    action increment() {
      when true {
        patch count = add(count, 1)
      }
    }
  }
`;

function applyEditSet(source: string, edits: readonly { range: { start: { offset?: number }; end: { offset?: number } }; replacement: string }[]): string {
  return [...edits]
    .sort((a, b) => (b.range.start.offset ?? 0) - (a.range.start.offset ?? 0))
    .reduce((current, edit) =>
      `${current.slice(0, edit.range.start.offset)}${edit.replacement}${current.slice(edit.range.end.offset)}`,
      source);
}

describe("CCTS Source Editing Suite", () => {
  it(caseTitle(CCTS_CASES.SOURCE_EDIT_API_SURFACE, "(MEL-EDIT-1/2/3/4/13) source-edit API and result semantics are enforced"), () => {
    const added = compileFragmentInContext(BASE_SOURCE, {
      kind: "addComputed",
      name: "next",
      expr: "add(count, 1)",
    });
    const arrayOp = compileFragmentInContext(BASE_SOURCE, [
      { kind: "addComputed", name: "bad", expr: "count" },
    ] as never);
    const invalidOp = compileFragmentInContext(BASE_SOURCE, null as never);
    const invalidBase = compileFragmentInContext("domain Demo { computed nope = ", {
      kind: "addComputed",
      name: "next",
      expr: "count",
    });

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("MEL-EDIT-1"), added.ok && added.changedTargets.includes("computed:next"), {
        passMessage: "compileFragmentInContext materializes exactly one MelEditOp.",
        failMessage: "Single-op source editing did not produce the expected changed target.",
        evidence: [noteEvidence("Changed targets", added.changedTargets), ...diagnosticEvidence(added.diagnostics)],
      }),
      evaluateRule(
        getRuleOrThrow("MEL-EDIT-2"),
        hasDiagnosticCode(arrayOp.diagnostics, "E_FRAGMENT_SCOPE_VIOLATION")
          && hasDiagnosticCode(invalidOp.diagnostics, "E_FRAGMENT_SCOPE_VIOLATION"),
        {
          passMessage: "Non-single operation shapes are rejected at the public primitive.",
          failMessage: "A non-single operation shape was accepted.",
          evidence: [...diagnosticEvidence(arrayOp.diagnostics), ...diagnosticEvidence(invalidOp.diagnostics)],
        },
      ),
      evaluateRule(getRuleOrThrow("MEL-EDIT-3"), added.ok && added.newSource.includes("domain Demo") && added.newSource.includes("computed next"), {
        passMessage: "newSource is the complete MEL domain source.",
        failMessage: "newSource did not contain the full edited domain.",
        evidence: [noteEvidence("New source", added.newSource)],
      }),
      evaluateRule(getRuleOrThrow("MEL-EDIT-4"), added.ok && added.diagnostics.length === 0, {
        passMessage: "Edited source is fully recompiled and returned without diagnostics.",
        failMessage: "Edited source was not fully recompiled successfully.",
        evidence: diagnosticEvidence(added.diagnostics),
      }),
      evaluateRule(
        getRuleOrThrow("MEL-EDIT-13"),
        !invalidBase.ok && invalidBase.newSource === "domain Demo { computed nope = " && invalidBase.edits.length === 0,
        {
          passMessage: "Invalid base source returns diagnostics without target mutation.",
          failMessage: "Invalid base source attempted materialization.",
          evidence: diagnosticEvidence(invalidBase.diagnostics),
        },
      ),
    ]);
  });

  it(caseTitle(CCTS_CASES.SOURCE_EDIT_FRAGMENT_GRAMMAR, "(MEL-EDIT-5/6) fragment grammar and raw-splice boundaries are enforced"), () => {
    const invalidExpr = compileFragmentInContext(BASE_SOURCE, {
      kind: "replaceComputedExpr",
      target: "computed:doubled",
      expr: "add(",
    });
    const smuggledBody = compileFragmentInContext(BASE_SOURCE, {
      kind: "replaceActionBody",
      target: "action:increment",
      body: "computed escaped = count",
    });
    const smuggledName = compileFragmentInContext(BASE_SOURCE, {
      kind: "addComputed",
      name: "escaped = count\n  action bad" as never,
      expr: "count",
    });
    const smuggledJsonKey = compileFragmentInContext(BASE_SOURCE, {
      kind: "addStateField",
      name: "payload",
      type: "{ bad-key: number }",
      defaultValue: { "bad-key": 1 } as never,
    });

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("MEL-EDIT-5"), hasDiagnosticCode(invalidExpr.diagnostics, "E_FRAGMENT_PARSE_FAILED"), {
        passMessage: "Expression fragments are parsed through the expression grammar.",
        failMessage: "Invalid expression fragment was not rejected.",
        evidence: diagnosticEvidence(invalidExpr.diagnostics),
      }),
      evaluateRule(
        getRuleOrThrow("MEL-EDIT-6"),
        hasDiagnosticCode(smuggledBody.diagnostics, "E_FRAGMENT_SCOPE_VIOLATION")
          && hasDiagnosticCode(smuggledName.diagnostics, "E_FRAGMENT_SCOPE_VIOLATION")
          && hasDiagnosticCode(smuggledJsonKey.diagnostics, "E_FRAGMENT_SCOPE_VIOLATION"),
        {
          passMessage: "Raw-splice declaration, identifier, and JSON-key smuggling are rejected.",
          failMessage: "A raw-splice smuggling path was not rejected.",
          evidence: [
            ...diagnosticEvidence(smuggledBody.diagnostics),
            ...diagnosticEvidence(smuggledName.diagnostics),
            ...diagnosticEvidence(smuggledJsonKey.diagnostics),
          ],
        },
      ),
      evaluateRule(getRuleOrThrow("E_FRAGMENT_PARSE_FAILED"), hasDiagnosticCode(invalidExpr.diagnostics, "E_FRAGMENT_PARSE_FAILED"), {
        passMessage: "Fragment parse failures emit E_FRAGMENT_PARSE_FAILED.",
        failMessage: "Fragment parse failure diagnostic was not emitted.",
        evidence: diagnosticEvidence(invalidExpr.diagnostics),
      }),
      evaluateRule(
        getRuleOrThrow("E_FRAGMENT_SCOPE_VIOLATION"),
        hasDiagnosticCode(smuggledBody.diagnostics, "E_FRAGMENT_SCOPE_VIOLATION")
          && hasDiagnosticCode(smuggledName.diagnostics, "E_FRAGMENT_SCOPE_VIOLATION"),
        {
          passMessage: "Fragment scope violations emit E_FRAGMENT_SCOPE_VIOLATION.",
          failMessage: "Fragment scope violation diagnostic was not emitted.",
          evidence: [...diagnosticEvidence(smuggledBody.diagnostics), ...diagnosticEvidence(smuggledName.diagnostics)],
        },
      ),
    ]);
  });

  it(caseTitle(CCTS_CASES.SOURCE_EDIT_STALE_MODULE, "(MEL-EDIT-7/8) stale baseModule validation is enforced"), () => {
    const baseModule = compileMelModule(BASE_SOURCE, { mode: "module" }).module!;
    const result = compileFragmentInContext(`${BASE_SOURCE}\n`, {
      kind: "addComputed",
      name: "next",
      expr: "add(count, 1)",
    }, { baseModule });

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("MEL-EDIT-7"), hasDiagnosticCode(result.diagnostics, "E_STALE_MODULE"), {
        passMessage: "baseModule source hash is checked before span reuse.",
        failMessage: "Stale baseModule was not checked.",
        evidence: diagnosticEvidence(result.diagnostics),
      }),
      evaluateRule(
        getRuleOrThrow("MEL-EDIT-8"),
        result.newSource === `${BASE_SOURCE}\n` && result.edits.length === 0 && hasDiagnosticCode(result.diagnostics, "E_STALE_MODULE"),
        {
          passMessage: "Stale baseModule returns E_STALE_MODULE without edits.",
          failMessage: "Stale baseModule produced source edits.",
          evidence: diagnosticEvidence(result.diagnostics),
        },
      ),
      evaluateRule(getRuleOrThrow("E_STALE_MODULE"), hasDiagnosticCode(result.diagnostics, "E_STALE_MODULE"), {
        passMessage: "Stale module diagnostic code is emitted.",
        failMessage: "E_STALE_MODULE was not emitted.",
        evidence: diagnosticEvidence(result.diagnostics),
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.SOURCE_EDIT_RESULT_DETERMINISM, "(MEL-EDIT-9/14/15/16) deterministic edit result semantics are enforced"), () => {
    const op = {
      kind: "replaceComputedExpr",
      target: "computed:doubled",
      expr: "add(count, 2)",
    } as const;
    const first = compileFragmentInContext(BASE_SOURCE, op, { includeSchemaDiff: true });
    const second = compileFragmentInContext(BASE_SOURCE, op, { includeSchemaDiff: true });
    const applied = applyEditSet(BASE_SOURCE, first.edits);
    const before = BASE_SOURCE.slice(0, first.edits[0]?.range.start.offset);
    const after = BASE_SOURCE.slice(first.edits[0]?.range.end.offset);

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("MEL-EDIT-9"), JSON.stringify(first) === JSON.stringify(second), {
        passMessage: "Identical source-edit inputs produce identical deterministic results.",
        failMessage: "Source-edit result changed across identical inputs.",
        evidence: [noteEvidence("First result", first), noteEvidence("Second result", second)],
      }),
      evaluateRule(
        getRuleOrThrow("MEL-EDIT-14"),
        first.edits.length === 1 && first.edits[0]!.range.start.offset !== undefined && first.edits[0]!.range.end.offset !== undefined,
        {
          passMessage: "MelTextEdit ranges include base-source coordinates.",
          failMessage: "MelTextEdit range did not include base-source offsets.",
          evidence: [noteEvidence("Edits", first.edits)],
        },
      ),
      evaluateRule(getRuleOrThrow("MEL-EDIT-15"), applied === first.newSource && first.newSource.startsWith(before) && first.newSource.endsWith(after), {
        passMessage: "Returned edits produce newSource while preserving unrelated text.",
        failMessage: "Returned edits do not reproduce newSource or preserve unrelated text.",
        evidence: [noteEvidence("Applied source", applied), noteEvidence("New source", first.newSource)],
      }),
      evaluateRule(getRuleOrThrow("MEL-EDIT-16"), JSON.stringify(first) === JSON.stringify(second), {
        passMessage: "Diagnostics, edits, changed targets, and schema diff ordering are stable.",
        failMessage: "Result ordering was not stable.",
        evidence: [noteEvidence("First result", first), noteEvidence("Second result", second)],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.SOURCE_EDIT_TARGET_IMPACT, "(MEL-EDIT-10/11/12) target validation and impact reporting are enforced"), () => {
    const added = compileFragmentInContext(BASE_SOURCE, {
      kind: "addComputed",
      name: "next",
      expr: "add(count, 1)",
    }, { includeSchemaDiff: true });
    const missing = compileFragmentInContext(BASE_SOURCE, {
      kind: "replaceComputedExpr",
      target: "computed:missing",
      expr: "count",
    });
    const mismatch = compileFragmentInContext(BASE_SOURCE, {
      kind: "replaceComputedExpr",
      target: "action:increment" as never,
      expr: "count",
    });

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("MEL-EDIT-10"), added.changedTargets.includes("computed:next"), {
        passMessage: "changedTargets exposes directly changed declaration targets.",
        failMessage: "changedTargets did not include the added computed target.",
        evidence: [noteEvidence("Changed targets", added.changedTargets)],
      }),
      evaluateRule(getRuleOrThrow("MEL-EDIT-11"), added.schemaDiff?.addedTargets.includes("computed:next") === true, {
        passMessage: "schemaDiff reports added targets when requested.",
        failMessage: "schemaDiff did not include the added computed target.",
        evidence: [noteEvidence("Schema diff", added.schemaDiff)],
      }),
      evaluateRule(getRuleOrThrow("MEL-EDIT-12"), added.schemaDiff !== undefined && added.changedTargets.length > 0, {
        passMessage: "Compiler reports impact without deciding author acceptance.",
        failMessage: "Impact reporting was not returned.",
        evidence: [noteEvidence("Schema diff", added.schemaDiff), noteEvidence("Changed targets", added.changedTargets)],
      }),
      evaluateRule(getRuleOrThrow("E_TARGET_NOT_FOUND"), hasDiagnosticCode(missing.diagnostics, "E_TARGET_NOT_FOUND"), {
        passMessage: "Missing targets emit E_TARGET_NOT_FOUND.",
        failMessage: "Missing target diagnostic was not emitted.",
        evidence: diagnosticEvidence(missing.diagnostics),
      }),
      evaluateRule(getRuleOrThrow("E_TARGET_KIND_MISMATCH"), hasDiagnosticCode(mismatch.diagnostics, "E_TARGET_KIND_MISMATCH"), {
        passMessage: "Target kind mismatches emit E_TARGET_KIND_MISMATCH.",
        failMessage: "Target kind mismatch diagnostic was not emitted.",
        evidence: diagnosticEvidence(mismatch.diagnostics),
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.SOURCE_EDIT_REMOVE_RENAME_SAFETY, "(MEL-EDIT-17) remove/rename all-or-nothing safety is enforced"), () => {
    const remove = compileFragmentInContext(BASE_SOURCE, {
      kind: "removeDeclaration",
      target: "computed:doubled",
    });
    const rename = compileFragmentInContext(BASE_SOURCE, {
      kind: "renameDeclaration",
      target: "computed:doubled",
      newName: "renamed",
    });

    expectAllCompliance([
      evaluateRule(
        getRuleOrThrow("MEL-EDIT-17"),
        remove.newSource === BASE_SOURCE && remove.edits.length === 0 && rename.newSource === BASE_SOURCE && rename.edits.length === 0,
        {
          passMessage: "Unsafe remove/rename checks return diagnostics without partial edits.",
          failMessage: "Unsafe remove/rename returned partial edits.",
          evidence: [...diagnosticEvidence(remove.diagnostics), ...diagnosticEvidence(rename.diagnostics)],
        },
      ),
      evaluateRule(getRuleOrThrow("E_UNSAFE_RENAME_AMBIGUOUS"), hasDiagnosticCode(rename.diagnostics, "E_UNSAFE_RENAME_AMBIGUOUS"), {
        passMessage: "Unsafe rename emits E_UNSAFE_RENAME_AMBIGUOUS.",
        failMessage: "Unsafe rename diagnostic was not emitted.",
        evidence: diagnosticEvidence(rename.diagnostics),
      }),
      evaluateRule(getRuleOrThrow("E_REMOVE_BLOCKED_BY_REFERENCES"), hasDiagnosticCode(remove.diagnostics, "E_REMOVE_BLOCKED_BY_REFERENCES"), {
        passMessage: "Blocked remove emits E_REMOVE_BLOCKED_BY_REFERENCES.",
        failMessage: "Blocked remove diagnostic was not emitted.",
        evidence: diagnosticEvidence(remove.diagnostics),
      }),
    ]);
  });
});
