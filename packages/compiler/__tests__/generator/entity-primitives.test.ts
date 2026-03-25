import { describe, expect, it } from "vitest";
import {
  analyzeScope,
  compileMelDomain,
  parse,
  tokenize,
  validateSemantics,
} from "../../src/index.js";
import { generateCanonical } from "../../src/generator/ir.js";
import { validateAndExpandFlows } from "../../src/analyzer/flow-composition.js";

function generateCanonicalSchema(source: string) {
  const lexed = tokenize(source);
  const lexErrors = lexed.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  expect(lexErrors).toHaveLength(0);

  const parsed = parse(lexed.tokens);
  expect(parsed.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toHaveLength(0);
  expect(parsed.program).not.toBeNull();
  if (!parsed.program) {
    return null;
  }

  const flowResult = validateAndExpandFlows(parsed.program);
  const scopeResult = analyzeScope(flowResult.program);
  const semanticResult = validateSemantics(flowResult.program);
  const errors = [
    ...flowResult.diagnostics,
    ...scopeResult.diagnostics,
    ...semanticResult.diagnostics,
  ].filter((diagnostic) => diagnostic.severity === "error");
  expect(errors).toHaveLength(0);

  const generated = generateCanonical(flowResult.program);
  expect(generated.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toHaveLength(0);
  return generated.schema;
}

describe("Entity Primitive Generation", () => {
  const SOURCE = `
    domain Demo {
      type Task = { id: string, title: string, done: boolean }
      state {
        tasks: Array<Task> = []
        selectedId: string = ""
      }

      computed selected = findById(tasks, null)
      computed hasSelected = existsById(tasks, selectedId)

      action complete(id: string) {
        when true {
          patch tasks = updateById(tasks, id, { done: true })
        }
      }

      action remove(id: string) {
        when true {
          patch tasks = removeById(tasks, id)
        }
      }
    }
  `;

  it("preserves entity primitives as internal call nodes before lowering", () => {
    const schema = generateCanonicalSchema(SOURCE);
    expect(schema).not.toBeNull();
    if (!schema) return;

    const rendered = JSON.stringify(schema);
    expect(rendered).toContain("\"fn\":\"findById\"");
    expect(rendered).toContain("\"fn\":\"existsById\"");
    expect(rendered).toContain("\"fn\":\"updateById\"");
    expect(rendered).toContain("\"fn\":\"removeById\"");
  });

  it("returns runtime-ready schema from compileMelDomain", () => {
    const result = compileMelDomain(SOURCE, { mode: "domain" });
    expect(result.errors).toHaveLength(0);
    expect(result.schema).not.toBeNull();
    if (!result.schema) return;

    const rendered = JSON.stringify(result.schema);
    expect(rendered).not.toContain("findById");
    expect(rendered).not.toContain("existsById");
    expect(rendered).not.toContain("updateById");
    expect(rendered).not.toContain("removeById");

    expect(rendered).toContain("\"kind\":\"find\"");
    expect(rendered).toContain("\"kind\":\"map\"");
    expect(rendered).toContain("\"kind\":\"filter\"");
    expect(rendered).toContain("\"kind\":\"merge\"");
    expect(rendered).toContain("\"kind\":\"isNull\"");
  });

  it("accepts null id arguments on the public compile path", () => {
    const result = compileMelDomain(
      `
      domain Demo {
        type Task = { id: string, title: string }
        state { tasks: Array<Task> = [] }
        computed selected = findById(tasks, null)
      }
      `,
      { mode: "domain" }
    );

    expect(result.errors).toHaveLength(0);
    expect(result.schema).not.toBeNull();
  });
});
