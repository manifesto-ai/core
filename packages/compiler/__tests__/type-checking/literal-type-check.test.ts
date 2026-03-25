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
      expect(result.success).toBe(false);
      expect(result.errors.some(d => d.code === "E045")).toBe(true);
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
