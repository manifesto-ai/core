import { describe, it, expect } from "vitest";
import { tokenize } from "../../src/lexer/index.js";
import { parse, type ProgramNode, type ExprNode } from "../../src/parser/index.js";

function parseSource(source: string) {
  const { tokens } = tokenize(source);
  return parse(tokens);
}

describe("Parser", () => {
  describe("domain structure", () => {
    it("parses empty domain", () => {
      const { program, diagnostics } = parseSource("domain Empty {}");
      expect(diagnostics).toHaveLength(0);
      expect(program?.domain.name).toBe("Empty");
      expect(program?.domain.members).toHaveLength(0);
    });

    it("parses domain with state", () => {
      const { program, diagnostics } = parseSource(`
        domain Counter {
          state {
            count: number = 0
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      expect(program?.domain.members).toHaveLength(1);
      expect(program?.domain.members[0].kind).toBe("state");
    });

    it("parses domain with computed", () => {
      const { program, diagnostics } = parseSource(`
        domain Counter {
          computed doubled = mul(count, 2)
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const computed = program?.domain.members[0];
      expect(computed?.kind).toBe("computed");
      if (computed?.kind === "computed") {
        expect(computed.name).toBe("doubled");
        expect(computed.expression.kind).toBe("functionCall");
      }
    });

    it("parses domain with action", () => {
      const { program, diagnostics } = parseSource(`
        domain Counter {
          action increment() {
            when gt(count, 0) {
              patch count = add(count, 1)
            }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const action = program?.domain.members[0];
      expect(action?.kind).toBe("action");
      if (action?.kind === "action") {
        expect(action.name).toBe("increment");
        expect(action.body).toHaveLength(1);
      }
    });
  });

  describe("state fields", () => {
    it("parses simple types", () => {
      const { program, diagnostics } = parseSource(`
        domain Test {
          state {
            name: string = ""
            count: number = 0
            active: boolean = false
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const state = program?.domain.members[0];
      if (state?.kind === "state") {
        expect(state.fields).toHaveLength(3);
        expect(state.fields[0].typeExpr.kind).toBe("simpleType");
      }
    });

    it("parses union types", () => {
      const { program, diagnostics } = parseSource(`
        domain Test {
          state {
            status: "idle" | "loading" | "done" = "idle"
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const state = program?.domain.members[0];
      if (state?.kind === "state") {
        expect(state.fields[0].typeExpr.kind).toBe("unionType");
      }
    });

    it("parses array types", () => {
      const { program, diagnostics } = parseSource(`
        domain Test {
          state {
            items: Array<string> = []
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const state = program?.domain.members[0];
      if (state?.kind === "state") {
        expect(state.fields[0].typeExpr.kind).toBe("arrayType");
      }
    });

    it("parses record types", () => {
      const { program, diagnostics } = parseSource(`
        domain Test {
          state {
            tasks: Record<string, Task> = {}
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const state = program?.domain.members[0];
      if (state?.kind === "state") {
        expect(state.fields[0].typeExpr.kind).toBe("recordType");
      }
    });
  });

  describe("expressions", () => {
    function parseExpr(exprStr: string): ExprNode | null {
      const { program } = parseSource(`domain T { computed x = ${exprStr} }`);
      const computed = program?.domain.members[0];
      return computed?.kind === "computed" ? computed.expression : null;
    }

    it("parses literals", () => {
      expect(parseExpr("42")?.kind).toBe("literal");
      expect(parseExpr('"hello"')?.kind).toBe("literal");
      expect(parseExpr("true")?.kind).toBe("literal");
      expect(parseExpr("null")?.kind).toBe("literal");
    });

    it("parses identifiers", () => {
      const expr = parseExpr("foo");
      expect(expr?.kind).toBe("identifier");
      if (expr?.kind === "identifier") {
        expect(expr.name).toBe("foo");
      }
    });

    it("parses function calls", () => {
      const expr = parseExpr("add(1, 2)");
      expect(expr?.kind).toBe("functionCall");
      if (expr?.kind === "functionCall") {
        expect(expr.name).toBe("add");
        expect(expr.args).toHaveLength(2);
      }
    });

    it("parses nested function calls", () => {
      const expr = parseExpr("mul(add(1, 2), 3)");
      expect(expr?.kind).toBe("functionCall");
      if (expr?.kind === "functionCall") {
        expect(expr.args[0].kind).toBe("functionCall");
      }
    });

    it("parses binary operators", () => {
      const expr = parseExpr("a + b");
      expect(expr?.kind).toBe("binary");
      if (expr?.kind === "binary") {
        expect(expr.operator).toBe("+");
      }
    });

    it("respects operator precedence", () => {
      // a + b * c should parse as a + (b * c)
      const expr = parseExpr("a + b * c");
      expect(expr?.kind).toBe("binary");
      if (expr?.kind === "binary") {
        expect(expr.operator).toBe("+");
        expect(expr.right.kind).toBe("binary");
        if (expr.right.kind === "binary") {
          expect(expr.right.operator).toBe("*");
        }
      }
    });

    it("parses comparison operators", () => {
      const expr = parseExpr("a == b");
      expect(expr?.kind).toBe("binary");
      if (expr?.kind === "binary") {
        expect(expr.operator).toBe("==");
      }
    });

    it("parses logical operators", () => {
      const expr = parseExpr("a && b || c");
      expect(expr?.kind).toBe("binary");
      if (expr?.kind === "binary") {
        expect(expr.operator).toBe("||");
      }
    });

    it("parses unary operators", () => {
      const expr = parseExpr("!active");
      expect(expr?.kind).toBe("unary");
      if (expr?.kind === "unary") {
        expect(expr.operator).toBe("!");
      }
    });

    it("parses ternary expressions", () => {
      const expr = parseExpr("a ? b : c");
      expect(expr?.kind).toBe("ternary");
    });

    it("parses nullish coalescing", () => {
      const expr = parseExpr("a ?? b");
      expect(expr?.kind).toBe("binary");
      if (expr?.kind === "binary") {
        expect(expr.operator).toBe("??");
      }
    });

    it("parses property access", () => {
      const expr = parseExpr("user.name");
      expect(expr?.kind).toBe("propertyAccess");
      if (expr?.kind === "propertyAccess") {
        expect(expr.property).toBe("name");
      }
    });

    it("parses index access", () => {
      const expr = parseExpr("items[0]");
      expect(expr?.kind).toBe("indexAccess");
    });

    it("parses chained access", () => {
      const expr = parseExpr("user.tasks[0].title");
      expect(expr?.kind).toBe("propertyAccess");
    });

    it("parses object literals", () => {
      const expr = parseExpr("{ a: 1, b: 2 }");
      expect(expr?.kind).toBe("objectLiteral");
      if (expr?.kind === "objectLiteral") {
        expect(expr.properties).toHaveLength(2);
      }
    });

    it("parses array literals", () => {
      const expr = parseExpr("[1, 2, 3]");
      expect(expr?.kind).toBe("arrayLiteral");
      if (expr?.kind === "arrayLiteral") {
        expect(expr.elements).toHaveLength(3);
      }
    });

    it("parses system identifiers", () => {
      const expr = parseExpr("$system.uuid");
      expect(expr?.kind).toBe("systemIdent");
      if (expr?.kind === "systemIdent") {
        expect(expr.path).toEqual(["system", "uuid"]);
      }
    });

    it("parses $meta identifiers", () => {
      const expr = parseExpr("$meta.intentId");
      expect(expr?.kind).toBe("systemIdent");
      if (expr?.kind === "systemIdent") {
        expect(expr.path).toEqual(["meta", "intentId"]);
      }
    });

    it("parses $item", () => {
      const expr = parseExpr("$item.name");
      expect(expr?.kind).toBe("propertyAccess");
      if (expr?.kind === "propertyAccess") {
        expect(expr.object.kind).toBe("iterationVar");
      }
    });
  });

  describe("statements", () => {
    it("parses when statement", () => {
      const { program, diagnostics } = parseSource(`
        domain T {
          action test() {
            when eq(x, 0) {
              patch x = 1
            }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const action = program?.domain.members[0];
      if (action?.kind === "action") {
        expect(action.body[0].kind).toBe("when");
      }
    });

    it("parses once statement", () => {
      const { program, diagnostics } = parseSource(`
        domain T {
          action test() {
            once(marker) {
              patch marker = $meta.intentId
            }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const action = program?.domain.members[0];
      if (action?.kind === "action") {
        expect(action.body[0].kind).toBe("once");
      }
    });

    it("parses once with when condition", () => {
      const { program, diagnostics } = parseSource(`
        domain T {
          action test(x: number) {
            once(marker) when gt(x, 0) {
              patch marker = $meta.intentId
            }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const action = program?.domain.members[0];
      if (action?.kind === "action") {
        const once = action.body[0];
        if (once.kind === "once") {
          expect(once.condition).toBeDefined();
        }
      }
    });

    it("parses patch set", () => {
      const { program, diagnostics } = parseSource(`
        domain T {
          action test() {
            when true {
              patch x = 1
            }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
    });

    it("parses patch unset", () => {
      const { program, diagnostics } = parseSource(`
        domain T {
          action test() {
            when true {
              patch items[id] unset
            }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
    });

    it("parses patch merge", () => {
      const { program, diagnostics } = parseSource(`
        domain T {
          action test() {
            when true {
              patch config merge { theme: "dark" }
            }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
    });

    it("parses effect statement", () => {
      const { program, diagnostics } = parseSource(`
        domain T {
          action test() {
            when true {
              effect api.fetch({ url: "/users", into: result })
            }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
    });

    it("parses nested guards", () => {
      const { program, diagnostics } = parseSource(`
        domain T {
          action test() {
            when a {
              when b {
                patch x = 1
              }
            }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("complex examples", () => {
    it("parses Counter domain", () => {
      const { program, diagnostics } = parseSource(`
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
      expect(diagnostics).toHaveLength(0);
      expect(program?.domain.name).toBe("Counter");
      expect(program?.domain.members).toHaveLength(5);
    });

    it("parses TaskManager domain", () => {
      const { program, diagnostics } = parseSource(`
        domain TaskManager {
          state {
            tasks: Record<string, Task> = {}
            filter: "all" | "active" | "completed" = "all"
            adding: string | null = null
          }

          computed taskCount = len(keys(tasks))

          action addTask(title: string) {
            once(adding) when neq(trim(title), "") {
              patch adding = $meta.intentId
              patch tasks[$system.uuid] = {
                id: $system.uuid,
                title: trim(title),
                completed: false
              }
            }
          }

          action deleteTask(id: string) {
            when isNotNull(tasks[id]) {
              patch tasks[id] unset
            }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      expect(program?.domain.name).toBe("TaskManager");
    });
  });

  describe("v0.3.2 features", () => {
    it("parses action with available condition", () => {
      const { program, diagnostics } = parseSource(`
        domain Counter {
          state { count: number = 0 }
          action decrement() available when gt(count, 0) {
            when true {
              patch count = sub(count, 1)
            }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const action = program?.domain.members.find(m => m.kind === "action" && m.name === "decrement");
      expect(action?.kind).toBe("action");
      if (action?.kind === "action") {
        expect(action.available).toBeDefined();
        expect(action.available?.kind).toBe("functionCall");
      }
    });

    it("parses fail statement without message", () => {
      const { program, diagnostics } = parseSource(`
        domain Test {
          state { x: number = 0 }
          action test() {
            when eq(x, 0) {
              fail "INVALID_STATE"
            }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const action = program?.domain.members.find(m => m.kind === "action") as any;
      const whenStmt = action.body[0];
      const failStmt = whenStmt.body[0];
      expect(failStmt.kind).toBe("fail");
      expect(failStmt.code).toBe("INVALID_STATE");
      expect(failStmt.message).toBeUndefined();
    });

    it("parses fail statement with message", () => {
      const { program, diagnostics } = parseSource(`
        domain Test {
          state { x: number = 0 }
          action test() {
            when eq(x, 0) {
              fail "INVALID_STATE" with "x must not be zero"
            }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const action = program?.domain.members.find(m => m.kind === "action") as any;
      const whenStmt = action.body[0];
      const failStmt = whenStmt.body[0];
      expect(failStmt.kind).toBe("fail");
      expect(failStmt.code).toBe("INVALID_STATE");
      expect(failStmt.message?.kind).toBe("literal");
    });

    it("parses fail statement with expression message", () => {
      const { program, diagnostics } = parseSource(`
        domain Test {
          state { x: number = 0 }
          action test() {
            when eq(x, 0) {
              fail "INVALID" with toString(x)
            }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const action = program?.domain.members.find(m => m.kind === "action") as any;
      const whenStmt = action.body[0];
      const failStmt = whenStmt.body[0];
      expect(failStmt.kind).toBe("fail");
      expect(failStmt.message?.kind).toBe("functionCall");
    });

    it("parses stop statement", () => {
      const { program, diagnostics } = parseSource(`
        domain Test {
          state { done: boolean = false }
          action test() {
            when done {
              stop "already_done"
            }
          }
        }
      `);
      expect(diagnostics).toHaveLength(0);
      const action = program?.domain.members.find(m => m.kind === "action") as any;
      const whenStmt = action.body[0];
      const stopStmt = whenStmt.body[0];
      expect(stopStmt.kind).toBe("stop");
      expect(stopStmt.reason).toBe("already_done");
    });
  });
});
