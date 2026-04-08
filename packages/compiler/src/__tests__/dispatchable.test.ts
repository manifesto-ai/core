import { describe, expect, it } from "vitest";

import { compileMelDomain } from "../api/index.js";
import { tokenize } from "../lexer/index.js";
import { parse } from "../parser/index.js";
import { extractSchemaGraph } from "../schema-graph.js";

function compile(source: string) {
  return compileMelDomain(source, { mode: "domain" });
}

describe("dispatchable when", () => {
  it("parses action clauses in available-then-dispatchable order", () => {
    const source = `
      domain Demo {
        state { count: number = 0 }
        action submit(limit: number)
          available when gt(limit, count)
          dispatchable when lt(count, limit) {
          when true { patch count = add(count, 1) }
        }
      }
    `;
    const lexed = tokenize(source);
    const parsed = parse(lexed.tokens);
    const action = parsed.program?.domain.members.find((member) => member.kind === "action");

    expect(parsed.diagnostics).toEqual([]);
    expect(action?.kind).toBe("action");
    expect(action && "available" in action ? action.available : undefined).toBeDefined();
    expect(action && "dispatchable" in action ? action.dispatchable : undefined).toBeDefined();
  });

  it("allows dispatchable without available", () => {
    const result = compile(`
      domain Demo {
        state { count: number = 0 }
        action submit(limit: number)
          dispatchable when lt(count, limit) {
          when true { patch count = add(count, 1) }
        }
      }
    `);

    expect(result.errors).toEqual([]);
    expect(result.schema?.actions.submit.dispatchable).toBeDefined();
  });

  it("rejects action clauses declared in dispatchable-then-available order", () => {
    const result = compile(`
      domain Demo {
        state { count: number = 0 }
        action submit(limit: number)
          dispatchable when lt(count, limit)
          available when gt(limit, count) {
          when true { patch count = add(count, 1) }
        }
      }
    `);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MEL_PARSER",
          message: "'available when' must appear before 'dispatchable when' in an action",
        }),
      ]),
    );
  });

  it("rejects duplicate dispatchable clauses with a parser diagnostic", () => {
    const result = compile(`
      domain Demo {
        state { count: number = 0 }
        action submit(limit: number)
          dispatchable when lt(count, limit)
          dispatchable when gt(limit, count) {
          when true { patch count = add(count, 1) }
        }
      }
    `);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MEL_PARSER",
          message: "Action can declare 'dispatchable when' at most once",
        }),
      ]),
    );
  });

  it("rejects direct $input, $meta, and $system inside dispatchable expressions", () => {
    const inputResult = compile(`
      domain Demo {
        state { count: number = 0 }
        action submit(limit: number)
          dispatchable when eq($input.limit, 1) {
          when true { patch count = add(count, 1) }
        }
      }
    `);
    const metaResult = compile(`
      domain Demo {
        state { count: number = 0 }
        action submit(limit: number)
          dispatchable when eq($meta.intentId, "x") {
          when true { patch count = add(count, 1) }
        }
      }
    `);
    const systemResult = compile(`
      domain Demo {
        state { count: number = 0 }
        action submit(limit: number)
          dispatchable when eq($system.uuid, "x") {
          when true { patch count = add(count, 1) }
        }
      }
    `);

    expect(inputResult.errors.some((error) => error.code === "E047")).toBe(true);
    expect(metaResult.errors.some((error) => error.code === "E047")).toBe(true);
    expect(systemResult.errors.some((error) => error.code === "E047")).toBe(true);
  });

  it("rejects transform primitives inside dispatchable expressions", () => {
    const result = compile(`
      domain Demo {
        state {
          tasks: Array<{ id: string, done: boolean }> = []
        }
        action submit(id: string)
          dispatchable when eq(len(updateById(tasks, id, { done: true })), len(tasks)) {
          when true { patch tasks = tasks }
        }
      }
    `);

    expect(result.errors.some((error) => error.code === "E048")).toBe(true);
  });

  it("lowers bare parameter names in dispatchable and prefers parameters over state fields", () => {
    const result = compile(`
      domain Demo {
        state {
          count: number = 0
          limit: number = 10
        }
        action submit(limit: number)
          dispatchable when lt(count, limit) {
          when true { patch count = add(count, 1) }
        }
      }
    `);

    expect(result.errors).toEqual([]);
    expect(result.schema?.actions.submit.dispatchable).toEqual({
      kind: "lt",
      left: { kind: "get", path: "count" },
      right: { kind: "get", path: "input.limit" },
    });
  });

  it("keeps dispatchable predicates out of SchemaGraph unlocks edges", () => {
    const result = compile(`
      domain Demo {
        state {
          count: number = 0
          enabled: boolean = true
        }
        action submit(limit: number)
          available when enabled
          dispatchable when lt(count, limit) {
          when true { patch count = add(count, 1) }
        }
      }
    `);

    expect(result.errors).toEqual([]);
    const graph = extractSchemaGraph(result.schema!);
    expect(graph.edges).toContainEqual({
      from: "state:enabled",
      to: "action:submit",
      relation: "unlocks",
    });
    expect(graph.edges).not.toContainEqual({
      from: "state:count",
      to: "action:submit",
      relation: "unlocks",
    });
  });
});
