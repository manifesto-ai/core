import { describe, it, expect } from "vitest";
import { compile } from "../../src/index.js";

function compileSource(source: string) {
  const result = compile(source);
  return {
    ...result,
  };
}

describe("Literal type checking", () => {
  describe("state initializer type mismatch", () => {
    it("rejects string assigned to boolean field", () => {
      const result = compileSource(`
        domain Test {
          state { flag: boolean = "hello" }
          computed c = flag
          action a() { when true { patch flag = true } }
        }
      `);
      expect(result.success).toBe(false);
      expect(result.errors.some(d => d.code === "E_TYPE_MISMATCH")).toBe(true);
    });

    it("rejects boolean assigned to number field", () => {
      const result = compileSource(`
        domain Test {
          state { count: number = true }
          computed c = count
          action a() { when true { patch count = 1 } }
        }
      `);
      expect(result.success).toBe(false);
      expect(result.errors.some(d => d.code === "E_TYPE_MISMATCH")).toBe(true);
    });

    it("rejects number assigned to string field", () => {
      const result = compileSource(`
        domain Test {
          state { name: string = 42 }
          computed c = name
          action a() { when true { patch name = "ok" } }
        }
      `);
      expect(result.success).toBe(false);
      expect(result.errors.some(d => d.code === "E_TYPE_MISMATCH")).toBe(true);
    });

    it("rejects string assigned to number field", () => {
      const result = compileSource(`
        domain Test {
          state { x: number = "oops" }
          computed c = x
          action a() { when true { patch x = 1 } }
        }
      `);
      expect(result.success).toBe(false);
      expect(result.errors.some(d => d.code === "E_TYPE_MISMATCH")).toBe(true);
    });

    it("rejects number assigned to boolean field", () => {
      const result = compileSource(`
        domain Test {
          state { flag: boolean = 0 }
          computed c = flag
          action a() { when true { patch flag = true } }
        }
      `);
      expect(result.success).toBe(false);
      expect(result.errors.some(d => d.code === "E_TYPE_MISMATCH")).toBe(true);
    });
  });

  describe("nullability", () => {
    it("rejects null on non-nullable field", () => {
      const result = compileSource(`
        domain Test {
          state { name: string = null }
          computed c = name
          action a() { when true { patch name = "ok" } }
        }
      `);
      expect(result.success).toBe(false);
      expect(result.errors.some(d => d.code === "E_TYPE_MISMATCH")).toBe(true);
    });

    it("rejects nullable field types in schema positions", () => {
      const result = compileSource(`
        domain Test {
          state { name: string | null = null }
          computed c = name
          action a() { when true { patch name = "ok" } }
        }
      `);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.schema.state.fields.name.type).toBe("string");
        expect(result.schema.state.fieldTypes?.name).toEqual({
          kind: "union",
          types: [
            { kind: "primitive", type: "string" },
            { kind: "literal", value: null },
          ],
        });
      }
    });
  });

  describe("object spread state initializers", () => {
    it("accepts compile-time constant object spread operands", () => {
      const result = compileSource(`
        domain Demo {
          type Config = {
            theme: string,
            locale: string
          }

          state {
            cfg: Config = {
              ...{ theme: "light" },
              locale: "ko-KR"
            }
          }
        }
      `);

      expect(result.success).toBe(true);
    });

    it("rejects invalid spread operands in state initializers", () => {
      const result = compileSource(`
        domain Demo {
          type Config = {
            theme: string
          }

          state {
            cfg: Config = {
              ...1,
              theme: "light"
            }
          }
        }
      `);

      expect(result.success).toBe(false);
      expect(result.errors.some((diagnostic) =>
        diagnostic.code === "E_TYPE_MISMATCH"
          && diagnostic.message.includes("Object spread operands must be object-shaped")
      )).toBe(true);
    });
  });

  describe("enum type mismatch", () => {
    it("rejects value not in enum", () => {
      const result = compileSource(`
        domain Test {
          state { status: "active" | "inactive" = "unknown" }
          computed c = status
          action a() { when true { patch status = "active" } }
        }
      `);
      expect(result.success).toBe(false);
      expect(result.errors.some(d => d.code === "E_TYPE_MISMATCH")).toBe(true);
    });

    it("accepts valid enum value", () => {
      const result = compileSource(`
        domain Test {
          state { status: "active" | "inactive" = "active" }
          computed c = status
          action a() { when true { patch status = "inactive" } }
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe("named type field mismatch", () => {
    it("rejects wrong field types in object literal", () => {
      const result = compileSource(`
        domain Test {
          type Todo = { id: string, done: boolean }
          state { current: Todo = { id: 1, done: "yes" } }
          computed c = current
          action a() { when true { patch current = { id: "a", done: true } } }
        }
      `);
      expect(result.success).toBe(false);
      expect(result.errors.some(d =>
        d.code === "E_TYPE_MISMATCH" && d.message.includes("current.id")
      )).toBe(true);
      expect(result.errors.some(d =>
        d.code === "E_TYPE_MISMATCH" && d.message.includes("current.done")
      )).toBe(true);
    });
  });

  describe("array type mismatch", () => {
    it("rejects non-array assigned to array field", () => {
      const result = compileSource(`
        domain Test {
          state { items: Array<string> = "not-an-array" }
          computed c = len(items)
          action a() { when true { patch items = [] } }
        }
      `);
      expect(result.success).toBe(false);
      expect(result.errors.some(d => d.code === "E_TYPE_MISMATCH")).toBe(true);
    });

    it("rejects wrong item types in array literal", () => {
      const result = compileSource(`
        domain Test {
          state { nums: Array<number> = [1, "two", 3] }
          computed c = len(nums)
          action a() { when true { patch nums = [1] } }
        }
      `);
      expect(result.success).toBe(false);
      expect(result.errors.some(d =>
        d.code === "E_TYPE_MISMATCH" && d.message.includes("nums[1]")
      )).toBe(true);
    });
  });

  describe("record types", () => {
    it("accepts record field types in schema positions", () => {
      const result = compileSource(`
        domain Test {
          type Todo = { id: string, done: boolean }
          state { todos: Record<string, Todo> = {} }
          computed c = todos
          action syncTodos(entries: Record<string, Todo>) {
            when true { patch todos = entries }
          }
        }
      `);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.schema.state.fields.todos.type).toBe("object");
        expect(result.schema.state.fieldTypes?.todos).toEqual({
          kind: "record",
          key: { kind: "primitive", type: "string" },
          value: { kind: "ref", name: "Todo" },
        });
        expect(result.schema.actions.syncTodos.params).toEqual(["entries"]);
        expect(result.schema.actions.syncTodos.inputType).toEqual({
          kind: "object",
          fields: {
            entries: {
              type: {
                kind: "record",
                key: { kind: "primitive", type: "string" },
                value: { kind: "ref", name: "Todo" },
              },
              optional: false,
            },
          },
        });
      }
    });
  });

  describe("patch literal type mismatch", () => {
    it("rejects string assigned to boolean via patch", () => {
      const result = compileSource(`
        domain Test {
          state { flag: boolean = false }
          computed c = flag
          action toggle() { when true { patch flag = "yes" } }
        }
      `);
      expect(result.success).toBe(false);
      expect(result.errors.some(d => d.code === "E_TYPE_MISMATCH")).toBe(true);
    });

    it("rejects number assigned to string via patch", () => {
      const result = compileSource(`
        domain Test {
          state { name: string = "ok" }
          computed c = name
          action rename() { when true { patch name = 42 } }
        }
      `);
      expect(result.success).toBe(false);
      expect(result.errors.some(d => d.code === "E_TYPE_MISMATCH")).toBe(true);
    });

    it("rejects invalid enum value via patch", () => {
      const result = compileSource(`
        domain Test {
          state { mode: "light" | "dark" = "light" }
          computed c = mode
          action setMode() { when true { patch mode = "blue" } }
        }
      `);
      expect(result.success).toBe(false);
      expect(result.errors.some(d => d.code === "E_TYPE_MISMATCH")).toBe(true);
    });
  });

  describe("nullable object patch literals", () => {
    it("accepts partially dynamic object literals for non-null object patch targets", () => {
      const result = compileSource(`
        domain Test {
          type RuntimeOperation = {
            kind: string,
            targetId: string
          }

          state {
            lastOperation: RuntimeOperation = {
              kind: "seed",
              targetId: "seed"
            }
          }

          action setOp(id: string) {
            when true {
              patch lastOperation = {
                kind: "a",
                targetId: id
              }
            }
          }
        }
      `);
      expect(result.success).toBe(true);
    });

    it("accepts all-literal object literals for nullable object patch targets", () => {
      const result = compileSource(`
        domain Test {
          type RuntimeOperation = {
            kind: string,
            targetId: string
          }

          state {
            lastOperation: RuntimeOperation | null = null
          }

          action setOp() {
            when true {
              patch lastOperation = {
                kind: "a",
                targetId: "fixed"
              }
            }
          }
        }
      `);
      expect(result.success).toBe(true);
    });

    it("accepts partially dynamic object literals for nullable named object patch targets", () => {
      const result = compileSource(`
        domain Test {
          type RuntimeOperation = {
            kind: "a" | "b",
            targetId: string
          }

          state {
            lastOperation: RuntimeOperation | null = null
          }

          action setOp(id: string) {
            when true {
              patch lastOperation = {
                kind: "a",
                targetId: id
              }
            }
          }
        }
      `);
      expect(result.success).toBe(true);
    });

    it("accepts partially dynamic object literals for nullable inline object patch targets", () => {
      const result = compileSource(`
        domain Test {
          state {
            lastOperation: { kind: "a" | "b", targetId: string } | null = null
          }

          action setOp(id: string) {
            when true {
              patch lastOperation = {
                kind: "a",
                targetId: id
              }
            }
          }
        }
      `);
      expect(result.success).toBe(true);
    });

    it("rejects static field mismatches for nullable object patch targets", () => {
      const result = compileSource(`
        domain Test {
          type RuntimeOperation = {
            kind: string,
            targetId: string
          }

          state {
            lastOperation: RuntimeOperation | null = null
          }

          action setOp() {
            when true {
              patch lastOperation = {
                kind: "a",
                targetId: 1
              }
            }
          }
        }
      `);
      expect(result.success).toBe(false);
      expect(result.errors.some((diagnostic) =>
        diagnostic.code === "E_TYPE_MISMATCH"
          && diagnostic.message.includes("Patch value for 'lastOperation' must be assignable")
      )).toBe(true);
    });

    it("does not flag plain nullable primitive patch assignments", () => {
      const result = compileSource(`
        domain Test {
          state {
            selectedId: string | null = null
          }

          action setSelected(id: string) {
            when true {
              patch selectedId = id
            }
          }
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe("object spread patch literals", () => {
    it("accepts spread-backed object literals when required fields are reintroduced unconditionally", () => {
      const result = compileSource(`
        domain Demo {
          type Draft = {
            customerId: string,
            appliedCouponId: string | null,
            submissionState: "idle" | "submitted"
          }

          state {
            draft: Draft | null = null
          }

          action submit(customerId: string) {
            onceIntent {
              patch draft = {
                ...draft,
                customerId: customerId,
                appliedCouponId: null,
                submissionState: "submitted"
              }
            }
          }
        }
      `);

      expect(result.success).toBe(true);
    });

    it("rejects spread-backed object literals when required fields stay conditional", () => {
      const result = compileSource(`
        domain Demo {
          type Draft = {
            customerId: string,
            appliedCouponId: string | null,
            submissionState: "idle" | "submitted"
          }

          state {
            draft: Draft | null = null
          }

          action submit() {
            onceIntent {
              patch draft = {
                ...draft,
                submissionState: "submitted"
              }
            }
          }
        }
      `);

      expect(result.success).toBe(false);
      expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
    });
  });

  describe("patch merge type checking", () => {
    it("accepts partial merge payloads for object targets", () => {
      const result = compileSource(`
        domain Test {
          type User = {
            name: string,
            age: number
          }

          state {
            user: User = {
              name: "a",
              age: 1
            }
          }

          action rename() {
            when true {
              patch user merge {
                name: "b"
              }
            }
          }
        }
      `);

      expect(result.success).toBe(true);
    });

    it("accepts partial merge payloads for nullable object targets", () => {
      const result = compileSource(`
        domain Test {
          type Draft = {
            customerId: string,
            submissionState: "idle" | "ready"
          }

          state {
            draft: Draft | null = null
          }

          action markReady() {
            when true {
              patch draft merge {
                submissionState: "ready"
              }
            }
          }
        }
      `);

      expect(result.success).toBe(true);
    });

    it("rejects wrong field types in merge payloads", () => {
      const result = compileSource(`
        domain Test {
          type User = {
            name: string,
            age: number
          }

          state {
            user: User = {
              name: "a",
              age: 1
            }
          }

          action rename() {
            when true {
              patch user merge {
                age: "oops"
              }
            }
          }
        }
      `);

      expect(result.success).toBe(false);
      expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
    });

    it("rejects unknown fields in merge payloads", () => {
      const result = compileSource(`
        domain Test {
          type User = {
            name: string,
            age: number
          }

          state {
            user: User = {
              name: "a",
              age: 1
            }
          }

          action rename() {
            when true {
              patch user merge {
                nickname: "b"
              }
            }
          }
        }
      `);

      expect(result.success).toBe(false);
      expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
    });
  });

  describe("valid MEL compiles successfully", () => {
    it("accepts correct types", () => {
      const result = compileSource(`
        domain Counter {
          state { count: number = 0 }
          computed doubled = mul(count, 2)
          action increment() { when true { patch count = add(count, 1) } }
        }
      `);
      expect(result.success).toBe(true);
    });

    it("accepts complex valid domain", () => {
      const result = compileSource(`
        domain Todo {
          state {
            items: Array<string> = []
            done: boolean = false
            label: string = "default"
          }
          computed total = len(items)
          action complete() { when true { patch done = true } }
        }
      `);
      expect(result.success).toBe(true);
    });

    it("does not flag dynamic expressions", () => {
      const result = compileSource(`
        domain Test {
          state { count: number = 0 }
          computed doubled = mul(count, 2)
          action set(val: number) {
            when true {
              patch count = val
            }
          }
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});
