import { describe, it, expect, vi, beforeEach } from "vitest";
import { generate } from "../runner.js";
import { createTestSchema } from "./helpers/schema-factory.js";
import type { CodegenPlugin, CodegenOutput } from "../types.js";

// Mock fs to avoid real disk IO in tests
vi.mock("node:fs/promises", () => ({
  rm: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

function createMockPlugin(
  name: string,
  output: CodegenOutput | (() => CodegenOutput)
): CodegenPlugin {
  return {
    name,
    generate: typeof output === "function" ? () => output() : () => output,
  };
}

describe("generate()", () => {
  const schema = createTestSchema();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GEN-2: plugin name uniqueness", () => {
    it("errors on duplicate plugin names", async () => {
      const p1 = createMockPlugin("dup", { patches: [] });
      const p2 = createMockPlugin("dup", { patches: [] });
      const result = await generate({ schema, outDir: "/tmp/out", plugins: [p1, p2] });
      expect(result.diagnostics.some((d) => d.level === "error")).toBe(true);
    });

    it("errors on empty plugin name", async () => {
      const p = createMockPlugin("", { patches: [] });
      const result = await generate({ schema, outDir: "/tmp/out", plugins: [p] });
      expect(result.diagnostics.some((d) => d.level === "error")).toBe(true);
    });
  });

  describe("GEN-3: sequential execution order", () => {
    it("passes accumulated artifacts to subsequent plugins", async () => {
      const order: string[] = [];

      const p1: CodegenPlugin = {
        name: "first",
        generate(ctx) {
          order.push("first");
          expect(Object.keys(ctx.artifacts)).toHaveLength(0);
          return { patches: [], artifacts: { value: 42 } };
        },
      };

      const p2: CodegenPlugin = {
        name: "second",
        generate(ctx) {
          order.push("second");
          expect(ctx.artifacts["first"]).toEqual({ value: 42 });
          return { patches: [] };
        },
      };

      await generate({ schema, outDir: "/tmp/out", plugins: [p1, p2] });
      expect(order).toEqual(["first", "second"]);
    });
  });

  describe("GEN-4: diagnostics collection", () => {
    it("collects diagnostics from all plugins", async () => {
      const p1 = createMockPlugin("p1", {
        patches: [],
        diagnostics: [{ level: "warn", plugin: "p1", message: "w1" }],
      });
      const p2 = createMockPlugin("p2", {
        patches: [],
        diagnostics: [{ level: "warn", plugin: "p2", message: "w2" }],
      });

      const result = await generate({ schema, outDir: "/tmp/out", plugins: [p1, p2] });
      expect(result.diagnostics).toHaveLength(2);
    });
  });

  describe("GEN-5/GEN-8: error gate", () => {
    it("does not flush on error diagnostics", async () => {
      const fs = await import("node:fs/promises");
      const p = createMockPlugin("bad", {
        patches: [{ op: "set", path: "a.ts", content: "x" }],
        diagnostics: [{ level: "error", plugin: "bad", message: "fail" }],
      });

      const result = await generate({ schema, outDir: "/tmp/out", plugins: [p] });
      expect(result.diagnostics.some((d) => d.level === "error")).toBe(true);
      expect(fs.rm).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe("path validation", () => {
    it("errors on invalid paths", async () => {
      const p = createMockPlugin("p", {
        patches: [{ op: "set", path: "../escape.ts", content: "bad" }],
      });

      const result = await generate({ schema, outDir: "/tmp/out", plugins: [p] });
      expect(result.diagnostics.some((d) => d.level === "error")).toBe(true);
    });
  });

  describe("plugin exception handling", () => {
    it("converts plugin throw to error diagnostic", async () => {
      const p: CodegenPlugin = {
        name: "throw",
        generate() {
          throw new Error("boom");
        },
      };

      const result = await generate({ schema, outDir: "/tmp/out", plugins: [p] });
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].level).toBe("error");
      expect(result.diagnostics[0].message).toContain("boom");
    });
  });

  describe("PLG-9: frozen artifacts", () => {
    it("provides frozen artifacts to plugins", async () => {
      const p: CodegenPlugin = {
        name: "frozen",
        generate(ctx) {
          expect(Object.isFrozen(ctx.artifacts)).toBe(true);
          return { patches: [] };
        },
      };

      await generate({ schema, outDir: "/tmp/out", plugins: [p] });
    });
  });

  describe("empty invocation", () => {
    it("returns empty result for no plugins", async () => {
      const result = await generate({ schema, outDir: "/tmp/out", plugins: [] });
      expect(result.files).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(0);
    });
  });
});
