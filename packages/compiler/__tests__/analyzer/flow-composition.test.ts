import { describe, expect, it } from "vitest";
import { parse, tokenize, compileMelDomain } from "../../src/index.js";
import { validateAndExpandFlows } from "../../src/analyzer/flow-composition.js";
import type { ProgramNode } from "../../src/parser/index.js";

function transform(source: string) {
  const lexed = tokenize(source);
  const parsed = parse(lexed.tokens);
  expect(parsed.diagnostics).toHaveLength(0);
  return validateAndExpandFlows(parsed.program as ProgramNode);
}

describe("flow composition", () => {
  it("expands includes and removes flow declarations from the transformed AST", () => {
    const result = transform(`
      domain Demo {
        state {
          tasks: Array<string> = []
        }

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
    `);

    expect(result.diagnostics).toHaveLength(0);
    expect(result.program.domain.members.every((member) => member.kind !== "flow")).toBe(true);

    const action = result.program.domain.members.find((member) => member.kind === "action");
    expect(action?.kind).toBe("action");
    if (action?.kind === "action") {
      expect(action.body[0]?.kind).toBe("when");
      expect(action.body.some((stmt) => stmt.kind === "include")).toBe(false);
    }
  });

  it("diagnoses flow parameter and name collisions", () => {
    const result = transform(`
      domain Demo {
        type Task = { id: string }
        state {
          tasks: Array<Task> = []
        }
        computed total = len(tasks)
        action tasks() {
          when true {
            stop "ok"
          }
        }

        flow tasks(tasks: string) {
          when true {
            fail "NOPE"
          }
        }
      }
    `);

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toContain("E021");
    expect(codes).toContain("E022");
  });

  it("diagnoses include target, arity, and type errors", () => {
    const result = transform(`
      domain Demo {
        state {
          count: number = 0
        }

        flow helper(id: string) {
          when true {
            fail "NOPE"
          }
        }

        action test(id: string) {
          include missing()
          include helper()
          include helper(123)
          when true {
            stop "ok"
          }
        }
      }
    `);

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toContain("E015");
    expect(codes).toContain("E023");
    expect(codes).toContain("E024");
  });

  it("diagnoses invalid include positions and forbidden flow constructs", () => {
    const result = transform(`
      domain Demo {
        state {
          count: number = 0
          marker: string = ""
        }

        flow invalid(marker: string) {
          once(marker) {
            fail "NOPE"
          }
          onceIntent {
            fail "NOPE"
          }
          when true {
            include invalid(marker)
            patch count = 1
            effect api.log({})
          }
        }

        action test(id: string) {
          when true {
            include invalid(id)
          }
        }
      }
    `);

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toContain("E016");
    expect(codes).toContain("E017");
    expect(codes).toContain("E018");
    expect(codes).toContain("E019");
    expect(codes).toContain("E020");
  });

  it("diagnoses circular includes and expansion depth overflow", () => {
    const deepFlows = Array.from({ length: 17 }, (_, index) => {
      const flowName = `f${index + 1}`;
      const target = index === 16
        ? `when true { fail "END" }`
        : `include f${index + 2}()`;
      return `flow ${flowName}() { ${target} }`;
    }).join("\n");

    const result = transform(`
      domain Demo {
        flow first() { include second() }
        flow second() { include first() }
        ${deepFlows}
        action test() {
          include first()
        }
      }
    `);

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toContain("E013");
    expect(codes).toContain("E014");
  });

  it("keeps compiled action flows free of runtime call nodes", () => {
    const result = compileMelDomain(`
      domain Demo {
        state {
          count: number = 0
        }

        flow guardCount() {
          when eq(count, 0) {
            fail "EMPTY"
          }
        }

        action test() {
          include guardCount()
          when true {
            stop "ok"
          }
        }
      }
    `, { mode: "domain" });

    expect(result.errors).toHaveLength(0);
    expect(JSON.stringify(result.schema?.actions["test"]?.flow)).not.toContain("\"kind\":\"call\"");
  });
});
