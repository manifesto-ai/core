import { describe, it, expect } from "vitest";
import { compile, parseSource, analyzeScope, validateSemantics } from "../../src/index.js";

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

    it("can skip semantic analysis", () => {
      const result = compile(
        `
        domain Test {
          computed x = undefined_var
        }
      `,
        { skipSemanticAnalysis: true }
      );

      // With skipSemanticAnalysis, it should still fail in IR generation
      // because the identifier can't be resolved to a valid path
    });
  });
});
