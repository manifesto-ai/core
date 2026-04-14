import { describe, it, expect } from "vitest";
import {
  analyzeScope,
  validateSemantics,
  compile,
  tokenize,
  parse,
} from "../../src/index.js";

function parseSource(source: string) {
  return parse(tokenize(source).tokens);
}

describe("Semantic Analyzer", () => {
  describe("scope analysis", () => {
    it("detects undefined identifiers", () => {
      const { program } = parseSource(`
        domain Test {
          state { x: number = 0 }
          computed y = add(x, undefined_var)
        }
      `);

      if (program) {
        const { diagnostics } = analyzeScope(program);
        expect(diagnostics.some(d => d.code === "E_UNDEFINED")).toBe(true);
      }
    });

    it("resolves state fields", () => {
      const { program } = parseSource(`
        domain Test {
          state { x: number = 0 }
          computed y = add(x, 1)
        }
      `);

      if (program) {
        const { diagnostics } = analyzeScope(program);
        expect(diagnostics.filter(d => d.severity === "error")).toHaveLength(0);
      }
    });

    it("resolves computed fields", () => {
      const { program } = parseSource(`
        domain Test {
          state { x: number = 0 }
          computed doubled = mul(x, 2)
          computed quadrupled = mul(doubled, 2)
        }
      `);

      if (program) {
        const { diagnostics } = analyzeScope(program);
        expect(diagnostics.filter(d => d.severity === "error")).toHaveLength(0);
      }
    });

    it("resolves action parameters", () => {
      const { program } = parseSource(`
        domain Test {
          state { x: number = 0 }
          action add(amount: number) {
            when true {
              patch x = add(x, amount)
            }
          }
        }
      `);

      if (program) {
        const { diagnostics } = analyzeScope(program);
        expect(diagnostics.filter(d => d.severity === "error")).toHaveLength(0);
      }
    });

    it("detects $system.* in computed (E001)", () => {
      const { program } = parseSource(`
        domain Test {
          computed id = $system.uuid
        }
      `);

      if (program) {
        const { diagnostics } = analyzeScope(program);
        expect(diagnostics.some(d => d.code === "E001")).toBe(true);
      }
    });

    it("allows $system.* in actions", () => {
      const { program } = parseSource(`
        domain Test {
          state { id: string | null = null }
          action generateId() {
            when true {
              patch id = $system.uuid
            }
          }
        }
      `);

      if (program) {
        const { diagnostics } = analyzeScope(program);
        expect(diagnostics.filter(d => d.code === "E001")).toHaveLength(0);
      }
    });

    it("allows dotted $system keys in actions", () => {
      const { program } = parseSource(`
        domain Test {
          state { createdAt: number = 0 }
          action create() {
            when true {
              patch createdAt = $system.time.now
            }
          }
        }
      `);

      if (program) {
        const { diagnostics } = analyzeScope(program);
        expect(diagnostics.filter(d => d.code === "E001")).toHaveLength(0);
        expect(diagnostics.filter(d => d.code === "E003")).toHaveLength(0);
      }
    });

    it("rejects unsupported dotted $system keys", () => {
      const { program } = parseSource(`
        domain Test {
          state { count: number = 0 }
          action create() {
            when true {
              patch count = $system.foo.bar
            }
          }
        }
      `);

      if (program) {
        const { diagnostics } = analyzeScope(program);
        expect(diagnostics.some(d => d.code === "E003")).toBe(true);
      }
    });
  });

  describe("semantic validation", () => {
    it("validates function argument counts", () => {
      const { program } = parseSource(`
        domain Test {
          computed x = add(1)
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.some(d => d.code === "E_ARG_COUNT")).toBe(true);
      }
    });

    it("accepts valid function calls", () => {
      const { program } = parseSource(`
        domain Test {
          state { x: number = 0 }
          computed doubled = mul(x, 2)
          computed arr = [1, 2, 3]
          computed length = len(arr)
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.filter(d => d.severity === "error")).toHaveLength(0);
      }
    });

    it("allows variadic functions", () => {
      const { program } = parseSource(`
        domain Test {
          computed a = and(true, false, true)
          computed b = or(false, true)
          computed c = concat("a", "b", "c")
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.filter(d => d.severity === "error")).toHaveLength(0);
      }
    });

    it("reports E_TYPE_MISMATCH for object literal equality", () => {
      const { program } = parseSource(`
        domain Test {
          computed same = eq({ a: 1 }, { a: 1 })
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.some((d) => d.code === "E_TYPE_MISMATCH")).toBe(true);
      }
    });

    it("reports E_TYPE_MISMATCH for array/object-typed equality", () => {
      const { program } = parseSource(`
        domain Test {
          state {
            items: Array<number> = []
            user: { name: string } = { name: "Ada" }
          }
          computed sameItems = eq(items, [])
          computed sameUser = eq(user, { name: "Ada" })
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.filter((d) => d.code === "E_TYPE_MISMATCH")).toHaveLength(2);
      }
    });

    it("reports E_TYPE_MISMATCH for computed object aliases and infix equality", () => {
      const { program } = parseSource(`
        domain Test {
          state { user: { name: string } = { name: "Ada" } }
          computed selected = user
          computed sameFn = eq(selected, { name: "Ada" })
          computed sameInfix = selected == { name: "Ada" }
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.filter((d) => d.code === "E_TYPE_MISMATCH")).toHaveLength(2);
      }
    });

    it("reports E_TYPE_MISMATCH for entity object equality", () => {
      const { program } = parseSource(`
        domain Test {
          type Task = { id: string, title: string }
          state {
            tasks: Array<Task> = []
            selectedId: string = ""
          }
          computed selectedTask = findById(tasks, selectedId)
          computed same = eq(selectedTask, null)
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.some((d) => d.code === "E_TYPE_MISMATCH")).toBe(true);
      }
    });

    it("allows primitive-only equality across primitive kinds", () => {
      const { program } = parseSource(`
        domain Test {
          state {
            count: number = 0
            marker: string = ""
            title: string = ""
            items: Array<number> = []
          }
          computed sameCount = eq(count, 0)
          computed sameNull = eq(null, marker)
          computed trimmed = neq(trim(title), "")
          computed empty = eq(len(items), 0)
          action check() {
            when neq(marker, $meta.intentId) {
              stop "Already processed"
            }
          }
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.filter((d) => d.code === "E_TYPE_MISMATCH")).toHaveLength(0);
      }
    });

    it("reports E006 for fail outside a guard", () => {
      const { program, diagnostics: parseDiagnostics } = parseSource(`
        domain Test {
          action reject() {
            fail "REJECTED"
          }
        }
      `);

      expect(parseDiagnostics).toHaveLength(0);
      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.some((d) => d.code === "E006")).toBe(true);
      }
    });

    it("reports E007 for stop outside a guard without E008 for processed wording", () => {
      const { program, diagnostics: parseDiagnostics } = parseSource(`
        domain Test {
          action noop() {
            stop "Already processed"
          }
        }
      `);

      expect(parseDiagnostics).toHaveLength(0);
      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.some((d) => d.code === "E007")).toBe(true);
        expect(diagnostics.some((d) => d.code === "E008")).toBe(false);
      }
    });

    it("reports E007 and E008 for waiting-style stop outside a guard", () => {
      const { program, diagnostics: parseDiagnostics } = parseSource(`
        domain Test {
          action noop() {
            stop "Waiting for approval"
          }
        }
      `);

      expect(parseDiagnostics).toHaveLength(0);
      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.some((d) => d.code === "E007")).toBe(true);
        expect(diagnostics.some((d) => d.code === "E008")).toBe(true);
      }
    });

    it("reports only E008 for waiting-style stop inside a guard", () => {
      const { program, diagnostics: parseDiagnostics } = parseSource(`
        domain Test {
          action noop() {
            when true {
              stop "Waiting for approval"
            }
          }
        }
      `);

      expect(parseDiagnostics).toHaveLength(0);
      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.some((d) => d.code === "E007")).toBe(false);
        expect(diagnostics.some((d) => d.code === "E008")).toBe(true);
      }
    });

    it("accepts processed stop wording inside a guard", () => {
      const { program, diagnostics: parseDiagnostics } = parseSource(`
        domain Test {
          action noop() {
            when true {
              stop "Already processed"
            }
          }
        }
      `);

      expect(parseDiagnostics).toHaveLength(0);
      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
      }
    });
  });

  describe("unknown function detection (#251)", () => {
    it("reports error for unknown function in computed", () => {
      const { program } = parseSource(`
        domain Test {
          state { count: number = 0 }
          computed bad = unknownFn(count)
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.some(d => d.code === "E_UNKNOWN_FN")).toBe(true);
      }
    });

    it("reports error for typo in function name", () => {
      const { program } = parseSource(`
        domain Test {
          state { a: number = 0 }
          computed b = ad(a, 1)
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.some(d => d.code === "E_UNKNOWN_FN")).toBe(true);
        expect(diagnostics.some(d => d.message.includes("'ad'"))).toBe(true);
      }
    });

    it("accepts all known builtin functions", () => {
      const { program } = parseSource(`
        domain Test {
          state { x: number = 0, y: number = 1, items: Array<number> = [], obj: object = {}, ok: boolean = true, status: string = "open" }
          computed a = add(x, 1)
          computed b = mul(x, 2)
          computed c = isNull(x)
          computed d = merge(obj, { y: 1 })
          computed e = keys(obj)
          computed f = len(items)
          computed g = coalesce(x, 0)
          computed h = absDiff(x, y)
          computed i = clamp(x, 0, 10)
          computed j = idiv(x, y)
          computed k = streak(x, ok)
          computed l = match(status, ["open", 1], ["closed", 0], -1)
          computed m = argmax(["a", ok, x], ["b", ok, y], "first")
          computed n = argmin(["a", ok, x], ["b", ok, y], "last")
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.filter(d => d.code === "E_UNKNOWN_FN")).toHaveLength(0);
      }
    });
  });

  describe("bounded sugar validation", () => {
    it("reports E049 for reversed literal clamp bounds", () => {
      const { program } = parseSource(`
        domain Test {
          state { score: number = 0 }
          computed bounded = clamp(score, 10, 0)
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.some((d) => d.code === "E049")).toBe(true);
      }
    });

    it("reports E050 for malformed match arms", () => {
      const { program } = parseSource(`
        domain Test {
          state { status: string = "open" }
          computed label = match(status, "open", 1, 0)
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.some((d) => d.code === "E050")).toBe(true);
      }
    });

    it("reports E051 for duplicate match keys", () => {
      const { program } = parseSource(`
        domain Test {
          state { status: string = "open" }
          computed label = match(status, ["open", 1], ["open", 2], 0)
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.some((d) => d.code === "E051")).toBe(true);
      }
    });

    it("reports E052 for malformed arg selection calls", () => {
      const { program } = parseSource(`
        domain Test {
          state { score: number = 1 }
          computed best = argmax(["a", true, score], "later")
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.some((d) => d.code === "E052")).toBe(true);
      }
    });
  });

  describe("duplicate state field detection (#252)", () => {
    it("reports error for duplicate state field", () => {
      const { program } = parseSource(`
        domain Test {
          state {
            count: number = 0
            count: string = ""
          }
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.some(d => d.code === "E_DUPLICATE_FIELD")).toBe(true);
        expect(diagnostics.some(d => d.message.includes("'count'"))).toBe(true);
      }
    });

    it("accepts unique field names", () => {
      const { program } = parseSource(`
        domain Test {
          state {
            count: number = 0
            name: string = ""
          }
        }
      `);

      if (program) {
        const { diagnostics } = validateSemantics(program);
        expect(diagnostics.filter(d => d.code === "E_DUPLICATE_FIELD")).toHaveLength(0);
      }
    });
  });

  describe("compile with analysis", () => {
    it("fails on undefined identifiers", () => {
      const result = compile(`
        domain Test {
          computed x = undefined_var
        }
      `);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.code === "E_UNDEFINED")).toBe(true);
      }
    });

    it("fails on $system in computed", () => {
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

    it("passes valid domain", () => {
      const result = compile(`
        domain Counter {
          state {
            count: number = 0
          }
          computed doubled = mul(count, 2)
          action increment() {
            when gt(count, -1) {
              patch count = add(count, 1)
            }
          }
        }
      `);

      expect(result.success).toBe(true);
    });

    it("passes action with dotted and legacy system keys", () => {
      const result = compile(`
        domain EventLog {
          state {
            ts: number = 0
            createdAt: number = 0
          }

          action record() {
            when true {
              patch ts = $system.timestamp
              patch createdAt = $system.time.now
            }
          }
        }
      `);

      expect(result.success).toBe(true);
    });

    it("fails unsupported dotted system key in action", () => {
      const result = compile(`
        domain EventLog {
          state {
            count: number = 0
          }

          action bad() {
            when true {
              patch count = $system.env.NODE_ID
            }
          }
        }
      `);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.code === "E003")).toBe(true);
      }
    });

    it("can skip semantic analysis", () => {
      const result = compile(
        `
        domain Test {
          computed x = undefined_var
        }
      `);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.code === "E_UNDEFINED")).toBe(true);
      }

      // Undefined identifiers should still be rejected from analysis phase.
    });
  });
});
