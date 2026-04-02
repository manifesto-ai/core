import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createCompilerCodegen } from "../compiler-codegen.js";
import type { CodegenPlugin } from "../types.js";
import { createTestSchema } from "./helpers/schema-factory.js";

describe("createCompilerCodegen", () => {
  it("writes the canonical domain facade by default", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "manifesto-codegen-"));

    try {
      const emit = createCompilerCodegen({ outDir });
      await emit({
        schema: createTestSchema({
          meta: { name: "CounterDomain" },
          state: {
            fields: {
              count: { type: "number", required: true, default: 0 },
            },
          },
          computed: {
            fields: {
              doubled: {
                deps: ["count"],
                expr: {
                  kind: "mul",
                  left: { kind: "get", path: "count" },
                  right: { kind: "lit", value: 2 },
                },
              },
            },
          },
          actions: {
            increment: {
              flow: { kind: "seq", steps: [] },
            },
          },
        }),
        sourceId: "src/domain/counter.mel",
      });

      const output = await readFile(join(outDir, "src/domain/counter.mel.ts"), "utf8");
      expect(output).toContain("export interface CounterDomain {");
      expect(output).toContain("count: number");
      expect(output).toContain("doubled: number");
      expect(output).toContain("increment: () => void");
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("throws when the injected codegen pipeline reports errors", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "manifesto-codegen-"));
    const badPlugin: CodegenPlugin = {
      name: "bad-plugin",
      generate() {
        return {
          patches: [{ op: "set", path: "../escape.ts", content: "export {};\n" }],
        };
      },
    };

    try {
      const emit = createCompilerCodegen({
        outDir,
        plugins: [badPlugin],
      });

      await expect(
        emit({
          schema: createTestSchema(),
          sourceId: "src/domain/counter.mel",
        })
      ).rejects.toThrow("Codegen failed for src/domain/counter.mel");
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
