import { describe, expect, it } from "vitest";
import { compile } from "../../src/index.js";

function compileSource(source: string) {
  return compile(source);
}

describe("Expression type checking", () => {
  it("rejects builtin argument type mismatches", () => {
    const result = compileSource(`
      domain PaymentLedger {
        state { balance: string = "10" }
        computed nextBalance = add(balance, 1)
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("rejects non-boolean guards", () => {
    const result = compileSource(`
      domain PaymentLedger {
        state { amount: number = 1 }

        action settle() {
          onceIntent {
            when amount {
              patch amount = 2
            }
          }
        }
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("rejects cross-type equality", () => {
    const result = compileSource(`
      domain ApprovalWorkflow {
        state { requestId: string = "abc" }
        computed isMatch = eq(requestId, 1)
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("rejects non-numeric comparisons", () => {
    const result = compileSource(`
      domain ApprovalWorkflow {
        state { requestId: string = "abc" }
        computed isAfter = gt(requestId, 1)
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("rejects collection predicate type mismatches", () => {
    const result = compileSource(`
      domain TodoWorkspace {
        state { todos: Array<string> = [] }
        computed filtered = filter(todos, "yes")
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("rejects collection mapper type mismatches", () => {
    const result = compileSource(`
      domain InventoryCatalog {
        type Item = { name: string }

        state { items: Array<Item> = [] }
        computed mapped = map(items, add($item.name, 1))
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("rejects incompatible coalesce branches", () => {
    const result = compileSource(`
      domain Test {
        state { count: number = 0 }
        computed value = coalesce(count, "oops")
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("rejects action parameter misuse in patch assignment", () => {
    const result = compileSource(`
      domain Test {
        state { count: number = 0 }

        action rename(title: string) {
          when true {
            patch count = title
          }
        }
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("accepts numeric arithmetic on numeric fields and params", () => {
    const result = compileSource(`
      domain Counter {
        state { count: number = 0 }

        action add(amount: number) {
          when gt(amount, 0) {
            patch count = add(count, amount)
          }
        }
      }
    `);

    expect(result.success).toBe(true);
  });

  it("accepts boolean-valued guards", () => {
    const result = compileSource(`
      domain Counter {
        state { count: number = 0 }

        action increment() {
          when gt(count, -1) {
            patch count = add(count, 1)
          }
        }
      }
    `);

    expect(result.success).toBe(true);
  });

  it("accepts correctly typed filter/map callbacks", () => {
    const result = compileSource(`
      domain TodoWorkspace {
        type Todo = { id: string, title: string, done: boolean }

        state { todos: Array<Todo> = [] }
        computed openTodos = filter(todos, eq($item.done, false))
        computed titles = map(todos, $item.title)
      }
    `);

    expect(result.success).toBe(true);
  });

  it("accepts coalesce with compatible nullable branches", () => {
    const result = compileSource(`
      domain TodoWorkspace {
        type Todo = { id: string, title: string }

        state {
          todos: Array<Todo> = []
          selectedId: string = ""
        }

        computed selected = findById(todos, selectedId)
        computed fallback = { id: "fallback", title: "Inbox" }
        computed chosen = coalesce(selected, fallback)
      }
    `);

    expect(result.success).toBe(true);
  });
});
