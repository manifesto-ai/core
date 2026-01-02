import { describe, it, expect } from "vitest";
import { compile, type DomainSchema } from "../../src/index.js";

describe("E2E Compilation", () => {
  describe("Counter Domain", () => {
    const counterSource = `
      domain Counter {
        state {
          count: number = 0
          lastIntent: string | null = null
        }

        computed doubled = mul(count, 2)
        computed isPositive = gt(count, 0)

        action increment() {
          once(lastIntent) {
            patch count = add(count, 1)
          }
        }

        action add(amount: number) {
          when gte(amount, 0) {
            patch count = add(count, amount)
          }
        }

        action reset() {
          when isPositive {
            patch count = 0
            patch lastIntent = null
          }
        }
      }
    `;

    it("compiles successfully", () => {
      const result = compile(counterSource);
      expect(result.success).toBe(true);
    });

    it("generates correct schema structure", () => {
      const result = compile(counterSource);
      expect(result.success).toBe(true);
      if (result.success) {
        const schema = result.schema;

        // Check basic metadata
        expect(schema.id).toBe("mel:counter");
        expect(schema.version).toBe("1.0.0");
        expect(schema.hash).toBeDefined();

        // Check state
        expect(schema.state.fields).toHaveProperty("count");
        expect(schema.state.fields).toHaveProperty("lastIntent");
        expect(schema.state.fields.count.default).toBe(0);

        // Check computed
        expect(schema.computed.fields).toHaveProperty("computed.doubled");
        expect(schema.computed.fields).toHaveProperty("computed.isPositive");

        // Check actions
        expect(schema.actions).toHaveProperty("increment");
        expect(schema.actions).toHaveProperty("add");
        expect(schema.actions).toHaveProperty("reset");

        // Check action input
        expect(schema.actions.add.input).toBeDefined();
        expect(schema.actions.add.input?.fields).toHaveProperty("amount");
      }
    });
  });

  describe("TaskManager Domain", () => {
    const taskManagerSource = `
      domain TaskManager {
        state {
          tasks: Record<string, Task> = {}
          filter: "all" | "active" | "completed" = "all"
          lastAdded: string | null = null
        }

        computed taskCount = len(keys(tasks))

        action addTask(title: string) {
          once(lastAdded) when neq(trim(title), "") {
            patch lastAdded = $meta.intentId
          }
        }

        action setFilter(newFilter: string) {
          when true {
            patch filter = newFilter
          }
        }

        action deleteTask(id: string) {
          when isNotNull(tasks[id]) {
            patch tasks[id] unset
          }
        }
      }
    `;

    it("compiles successfully", () => {
      const result = compile(taskManagerSource);
      expect(result.success).toBe(true);
    });

    it("handles Record types", () => {
      const result = compile(taskManagerSource);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.schema.state.fields.tasks.type).toBe("object");
      }
    });

    it("handles union literal types (enum)", () => {
      const result = compile(taskManagerSource);
      expect(result.success).toBe(true);
      if (result.success) {
        const filterType = result.schema.state.fields.filter.type;
        expect(typeof filterType).toBe("object");
        expect((filterType as { enum: string[] }).enum).toEqual(["all", "active", "completed"]);
      }
    });
  });

  describe("Complex Expressions", () => {
    it("handles nested function calls", () => {
      const result = compile(`
        domain Test {
          state { x: number = 0 }
          computed y = mul(add(x, 1), sub(x, 1))
        }
      `);

      expect(result.success).toBe(true);
      if (result.success) {
        const expr = result.schema.computed.fields["computed.y"].expr;
        expect(expr.kind).toBe("mul");
      }
    });

    it("handles ternary expressions", () => {
      const result = compile(`
        domain Test {
          state { x: number = 0 }
          computed sign = x > 0 ? 1 : x < 0 ? -1 : 0
        }
      `);

      expect(result.success).toBe(true);
      if (result.success) {
        const expr = result.schema.computed.fields["computed.sign"].expr;
        expect(expr.kind).toBe("if");
      }
    });

    it("handles object literals", () => {
      const result = compile(`
        domain Test {
          state { config: object = {} }
          action setConfig() {
            when true {
              patch config = { theme: "dark", size: 12 }
            }
          }
        }
      `);

      expect(result.success).toBe(true);
    });

    it("handles array literals", () => {
      const result = compile(`
        domain Test {
          computed items = [1, 2, 3]
        }
      `);

      expect(result.success).toBe(true);
      if (result.success) {
        const expr = result.schema.computed.fields["computed.items"].expr;
        expect(expr.kind).toBe("lit");
        if (expr.kind === "lit") {
          expect(expr.value).toEqual([1, 2, 3]);
        }
      }
    });
  });

  describe("Error Handling", () => {
    it("reports syntax errors", () => {
      const result = compile(`domain Test { state { x: number = }`);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it("reports undefined identifiers", () => {
      const result = compile(`
        domain Test {
          computed x = undefined_var
        }
      `);
      expect(result.success).toBe(false);
    });

    it("reports $system in computed", () => {
      const result = compile(`
        domain Test {
          computed id = $system.uuid
        }
      `);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.code === "E001")).toBe(true);
      }
    });
  });

  describe("System Value Lowering E2E", () => {
    it("lowers $system.uuid correctly", () => {
      const result = compile(
        `
        domain IdGenerator {
          state {
            id: string | null = null
            createdAt: number = 0
          }

          action generate() {
            once(id) {
              patch id = $system.uuid
              patch createdAt = $system.timestamp
            }
          }
        }
      `,
        { lowerSystemValues: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        // Should have the system value slots
        expect(result.schema.state.fields).toHaveProperty("__sys__generate_uuid_value");
        expect(result.schema.state.fields).toHaveProperty("__sys__generate_uuid_intent");
        expect(result.schema.state.fields).toHaveProperty("__sys__generate_timestamp_value");
        expect(result.schema.state.fields).toHaveProperty("__sys__generate_timestamp_intent");

        // Flow should not contain $system anymore
        const flowStr = JSON.stringify(result.schema.actions.generate.flow);
        expect(flowStr).not.toContain("$system.");
      }
    });
  });

  describe("Hash Determinism", () => {
    it("produces same hash for same input", () => {
      const source = `
        domain Test {
          state { x: number = 0 }
          computed doubled = mul(x, 2)
        }
      `;

      const result1 = compile(source);
      const result2 = compile(source);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.schema.hash).toBe(result2.schema.hash);
      }
    });

    it("produces different hash for different input", () => {
      const result1 = compile(`
        domain Test {
          state { x: number = 0 }
        }
      `);

      const result2 = compile(`
        domain Test {
          state { y: number = 0 }
        }
      `);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.schema.hash).not.toBe(result2.schema.hash);
      }
    });
  });
});
