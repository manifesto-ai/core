import { describe, it, expect } from "vitest";
import { compile, type DomainSchema, type CoreExprNode, type CoreFlowNode } from "../../src/index.js";

describe("IR Generator", () => {
  describe("basic compilation", () => {
    it("compiles empty domain", () => {
      const result = compile("domain Empty {}");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.schema.id).toBe("mel:empty");
        expect(result.schema.state.fields).toEqual({});
        expect(result.schema.computed.fields).toEqual({});
        expect(result.schema.actions).toEqual({});
      }
    });

    it("generates schema with hash", () => {
      const result = compile("domain Test {}");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.schema.hash).toBeDefined();
        expect(result.schema.hash.length).toBeGreaterThan(0);
      }
    });
  });

  describe("state generation", () => {
    it("generates state fields", () => {
      const result = compile(`
        domain Counter {
          state {
            count: number = 0
            name: string = ""
          }
        }
      `);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.schema.state.fields).toHaveProperty("count");
        expect(result.schema.state.fields).toHaveProperty("name");
        expect(result.schema.state.fields.count.type).toBe("number");
        expect(result.schema.state.fields.count.default).toBe(0);
        expect(result.schema.state.fields.name.type).toBe("string");
        expect(result.schema.state.fields.name.default).toBe("");
      }
    });

    it("generates enum types from union literals", () => {
      const result = compile(`
        domain Status {
          state {
            status: "idle" | "loading" | "done" = "idle"
          }
        }
      `);
      expect(result.success).toBe(true);
      if (result.success) {
        const statusType = result.schema.state.fields.status.type;
        expect(typeof statusType).toBe("object");
        expect((statusType as { enum: unknown[] }).enum).toEqual(["idle", "loading", "done"]);
      }
    });

    it("generates array type", () => {
      const result = compile(`
        domain List {
          state {
            items: Array<string> = []
          }
        }
      `);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.schema.state.fields.items.type).toBe("array");
        expect(result.schema.state.fields.items.default).toEqual([]);
      }
    });
  });

  describe("computed generation", () => {
    it("generates computed fields", () => {
      const result = compile(`
        domain Counter {
          state {
            count: number = 0
          }
          computed doubled = mul(count, 2)
        }
      `);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.schema.computed.fields).toHaveProperty("computed.doubled");
        const doubled = result.schema.computed.fields["computed.doubled"];
        expect(doubled.expr.kind).toBe("mul");
      }
    });

    it("tracks dependencies", () => {
      const result = compile(`
        domain Counter {
          state {
            count: number = 0
          }
          computed doubled = mul(count, 2)
        }
      `);
      expect(result.success).toBe(true);
      if (result.success) {
        const doubled = result.schema.computed.fields["computed.doubled"];
        // Core expects state deps without prefix
        expect(doubled.deps).toContain("count");
      }
    });
  });

  describe("action generation", () => {
    it("generates action with when guard", () => {
      const result = compile(`
        domain Counter {
          state {
            count: number = 0
          }
          action increment() {
            when gt(count, 0) {
              patch count = add(count, 1)
            }
          }
        }
      `);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.schema.actions).toHaveProperty("increment");
        const flow = result.schema.actions.increment.flow;
        expect(flow.kind).toBe("if");
      }
    });

    it("generates action with parameters", () => {
      const result = compile(`
        domain Counter {
          state {
            count: number = 0
          }
          action add(amount: number) {
            when true {
              patch count = add(count, amount)
            }
          }
        }
      `);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.schema.actions.add.input).toBeDefined();
        expect(result.schema.actions.add.input?.fields).toHaveProperty("amount");
      }
    });

    it("desugars once statement", () => {
      const result = compile(`
        domain Counter {
          state {
            lastIntent: string | null = null
          }
          action increment() {
            once(lastIntent) {
              patch lastIntent = $meta.intentId
            }
          }
        }
      `);
      expect(result.success).toBe(true);
      if (result.success) {
        const flow = result.schema.actions.increment.flow;
        // once desugars to if with neq condition
        expect(flow.kind).toBe("if");
        if (flow.kind === "if") {
          expect(flow.cond.kind).toBe("neq");
        }
      }
    });
  });

  describe("expression generation", () => {
    function compileExpr(exprStr: string): CoreExprNode | null {
      const result = compile(`domain T { computed x = ${exprStr} }`);
      if (!result.success) return null;
      const computed = result.schema.computed.fields["computed.x"];
      return computed?.expr ?? null;
    }

    it("generates literals", () => {
      expect(compileExpr("42")).toEqual({ kind: "lit", value: 42 });
      expect(compileExpr('"hello"')).toEqual({ kind: "lit", value: "hello" });
      expect(compileExpr("true")).toEqual({ kind: "lit", value: true });
      expect(compileExpr("null")).toEqual({ kind: "lit", value: null });
    });

    it("generates arithmetic expressions", () => {
      expect(compileExpr("1 + 2")?.kind).toBe("add");
      expect(compileExpr("1 - 2")?.kind).toBe("sub");
      expect(compileExpr("1 * 2")?.kind).toBe("mul");
      expect(compileExpr("1 / 2")?.kind).toBe("div");
    });

    it("generates comparison expressions", () => {
      expect(compileExpr("1 == 2")?.kind).toBe("eq");
      expect(compileExpr("1 != 2")?.kind).toBe("neq");
      expect(compileExpr("1 < 2")?.kind).toBe("lt");
      expect(compileExpr("1 <= 2")?.kind).toBe("lte");
      expect(compileExpr("1 > 2")?.kind).toBe("gt");
      expect(compileExpr("1 >= 2")?.kind).toBe("gte");
    });

    it("generates logical expressions", () => {
      expect(compileExpr("true && false")?.kind).toBe("and");
      expect(compileExpr("true || false")?.kind).toBe("or");
      expect(compileExpr("!true")?.kind).toBe("not");
    });

    it("generates function calls", () => {
      expect(compileExpr("add(1, 2)")?.kind).toBe("add");
      expect(compileExpr("mul(1, 2)")?.kind).toBe("mul");
      expect(compileExpr("len([1, 2, 3])")?.kind).toBe("len");
    });

    it("generates ternary expression as if", () => {
      const expr = compileExpr("true ? 1 : 2");
      expect(expr?.kind).toBe("if");
      if (expr?.kind === "if") {
        expect(expr.cond).toEqual({ kind: "lit", value: true });
        expect(expr.then).toEqual({ kind: "lit", value: 1 });
        expect(expr.else).toEqual({ kind: "lit", value: 2 });
      }
    });

    it("generates nullish coalescing", () => {
      expect(compileExpr("null ?? 1")?.kind).toBe("coalesce");
    });

    it("generates object literal", () => {
      const expr = compileExpr("{ a: 1, b: 2 }");
      expect(expr?.kind).toBe("object");
      if (expr?.kind === "object") {
        expect(expr.fields).toHaveProperty("a");
        expect(expr.fields).toHaveProperty("b");
      }
    });

    it("generates array literal", () => {
      const expr = compileExpr("[1, 2, 3]");
      expect(expr?.kind).toBe("lit");
      if (expr?.kind === "lit") {
        expect(expr.value).toEqual([1, 2, 3]);
      }
    });
  });

  describe("path resolution", () => {
    it("resolves state paths", () => {
      const result = compile(`
        domain Counter {
          state {
            count: number = 0
          }
          computed doubled = mul(count, 2)
        }
      `);
      expect(result.success).toBe(true);
      if (result.success) {
        const expr = result.schema.computed.fields["computed.doubled"].expr as {
          kind: "mul";
          left: CoreExprNode;
        };
        // Core expects state paths without prefix
        expect(expr.left).toEqual({ kind: "get", path: "count" });
      }
    });

    it("resolves action parameters", () => {
      const result = compile(`
        domain Counter {
          state {
            count: number = 0
          }
          action add(amount: number) {
            when true {
              patch count = add(count, amount)
            }
          }
        }
      `);
      expect(result.success).toBe(true);
      if (result.success) {
        const flow = result.schema.actions.add.flow;
        // Navigate to patch value
        if (flow.kind === "if") {
          const patchFlow = flow.then as CoreFlowNode;
          if (patchFlow.kind === "patch" && patchFlow.value?.kind === "add") {
            const addExpr = patchFlow.value as { kind: "add"; right: CoreExprNode };
            expect(addExpr.right).toEqual({ kind: "get", path: "input.amount" });
          }
        }
      }
    });

    it("resolves $meta.intentId", () => {
      const result = compile(`
        domain Counter {
          state {
            lastIntent: string | null = null
          }
          action increment() {
            when true {
              patch lastIntent = $meta.intentId
            }
          }
        }
      `);
      expect(result.success).toBe(true);
      if (result.success) {
        const flow = result.schema.actions.increment.flow;
        if (flow.kind === "if") {
          const patchFlow = flow.then as { kind: "patch"; value?: CoreExprNode };
          expect(patchFlow.value).toEqual({ kind: "get", path: "meta.intentId" });
        }
      }
    });
  });

  describe("complex examples", () => {
    it("compiles Counter domain", () => {
      const result = compile(`
        domain Counter {
          state {
            count: number = 0
            lastIntent: string | null = null
          }

          computed doubled = mul(count, 2)
          computed isPositive = gt(count, 0)

          action increment() {
            once(lastIntent) {
              patch lastIntent = $meta.intentId
              patch count = add(count, 1)
            }
          }

          action reset() {
            when gt(count, 0) {
              patch count = 0
              patch lastIntent = null
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.schema.meta?.name).toBe("Counter");
        expect(Object.keys(result.schema.state.fields)).toHaveLength(2);
        expect(Object.keys(result.schema.computed.fields)).toHaveLength(2);
        expect(Object.keys(result.schema.actions)).toHaveLength(2);
      }
    });

    it("compiles TaskManager domain", () => {
      const result = compile(`
        domain TaskManager {
          state {
            tasks: Record<string, Task> = {}
            filter: "all" | "active" | "completed" = "all"
          }

          computed taskCount = len(keys(tasks))

          action addTask(title: string) {
            once(lastAdded) when neq(trim(title), "") {
              patch lastAdded = $meta.intentId
            }
          }

          action deleteTask(id: string) {
            when isNotNull(tasks[id]) {
              patch tasks[id] unset
            }
          }
        }
      `);

      // Note: This may have errors due to undefined 'lastAdded' in state
      // That's expected - semantic analysis would catch this
      if (result.success) {
        expect(result.schema.meta?.name).toBe("TaskManager");
      }
    });
  });

  describe("v0.3.2 features", () => {
    it("generates available expression for actions", () => {
      const result = compile(`
        domain Counter {
          state { count: number = 0 }
          action decrement() available when gt(count, 0) {
            when true {
              patch count = sub(count, 1)
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (result.success) {
        const action = result.schema.actions.decrement;
        expect(action.available).toBeDefined();
        expect(action.available?.kind).toBe("gt");
      }
    });

    it("generates fail FlowNode without message", () => {
      const result = compile(`
        domain Test {
          state { x: number = 0 }
          action test() {
            when eq(x, 0) {
              fail "INVALID_STATE"
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (result.success) {
        const flow = result.schema.actions.test.flow as any;
        const failNode = flow.then;
        expect(failNode.kind).toBe("fail");
        expect(failNode.code).toBe("INVALID_STATE");
        expect(failNode.message).toBeUndefined();
      }
    });

    it("generates fail FlowNode with message", () => {
      const result = compile(`
        domain Test {
          state { x: number = 0 }
          action test() {
            when eq(x, 0) {
              fail "INVALID" with "x is zero"
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (result.success) {
        const flow = result.schema.actions.test.flow as any;
        const failNode = flow.then;
        expect(failNode.kind).toBe("fail");
        expect(failNode.code).toBe("INVALID");
        expect(failNode.message).toEqual({ kind: "lit", value: "x is zero" });
      }
    });

    it("generates halt FlowNode for stop statement", () => {
      const result = compile(`
        domain Test {
          state { done: boolean = false }
          action test() {
            when done {
              stop "already_done"
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (result.success) {
        const flow = result.schema.actions.test.flow as any;
        const haltNode = flow.then;
        expect(haltNode.kind).toBe("halt");
        expect(haltNode.reason).toBe("already_done");
      }
    });

    it("generates sumArray for sum(array)", () => {
      const result = compile(`
        domain Test {
          state { items: Array<number> = [] }
          computed total = sum(items)
        }
      `);

      expect(result.success).toBe(true);
      if (result.success) {
        const expr = result.schema.computed.fields["computed.total"].expr;
        expect(expr.kind).toBe("sumArray");
        if (expr.kind === "sumArray") {
          expect(expr.array).toEqual({ kind: "get", path: "items" });
        }
      }
    });

    it("generates minArray for min(array) with single arg", () => {
      const result = compile(`
        domain Test {
          state { items: Array<number> = [] }
          computed smallest = min(items)
        }
      `);

      expect(result.success).toBe(true);
      if (result.success) {
        const expr = result.schema.computed.fields["computed.smallest"].expr;
        expect(expr.kind).toBe("minArray");
        if (expr.kind === "minArray") {
          expect(expr.array).toEqual({ kind: "get", path: "items" });
        }
      }
    });

    it("generates maxArray for max(array) with single arg", () => {
      const result = compile(`
        domain Test {
          state { items: Array<number> = [] }
          computed largest = max(items)
        }
      `);

      expect(result.success).toBe(true);
      if (result.success) {
        const expr = result.schema.computed.fields["computed.largest"].expr;
        expect(expr.kind).toBe("maxArray");
        if (expr.kind === "maxArray") {
          expect(expr.array).toEqual({ kind: "get", path: "items" });
        }
      }
    });

    it("keeps min/max with multiple args for value comparison", () => {
      const result = compile(`
        domain Test {
          state {
            a: number = 0
            b: number = 0
          }
          computed smaller = min(a, b)
        }
      `);

      expect(result.success).toBe(true);
      if (result.success) {
        const expr = result.schema.computed.fields["computed.smaller"].expr;
        expect(expr.kind).toBe("min");
        if (expr.kind === "min") {
          expect(expr.args.length).toBe(2);
        }
      }
    });
  });
});
