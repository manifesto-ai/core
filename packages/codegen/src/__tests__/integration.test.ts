import { describe, it, expect, vi, beforeEach } from "vitest";
import { generate } from "../runner.js";
import { createTsPlugin } from "../plugins/ts-plugin.js";
import { createZodPlugin } from "../plugins/zod-plugin.js";
import {
  createTestSchema,
  createTypeSpec,
  primitiveType,
  objectType,
  arrayType,
  unionType,
  refType,
} from "./helpers/schema-factory.js";

// Mock fs to avoid real disk IO
vi.mock("node:fs/promises", () => ({
  rm: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

describe("integration: TS → Zod pipeline", () => {
  const schema = createTestSchema({
    types: {
      ProofNode: createTypeSpec(
        "ProofNode",
        objectType({
          id: { type: primitiveType("string"), optional: false },
          status: { type: unionType([primitiveType("string"), primitiveType("null")]), optional: false },
          children: { type: arrayType(refType("ProofNode")), optional: false },
        })
      ),
      FileState: createTypeSpec(
        "FileState",
        objectType({
          path: { type: primitiveType("string"), optional: false },
          size: { type: primitiveType("number"), optional: true },
        })
      ),
    },
  });

  it("produces both TS types and Zod schemas", async () => {
    const result = await generate({
      schema,
      outDir: "/tmp/out",
      plugins: [createTsPlugin(), createZodPlugin()],
    });

    expect(result.diagnostics.filter((d) => d.level === "error")).toHaveLength(0);

    const filePaths = result.files.map((f) => f.path);
    expect(filePaths).toContain("types.ts");
    expect(filePaths).toContain("base.ts");
  });

  it("Zod schemas reference TS types via artifacts", async () => {
    const result = await generate({
      schema,
      outDir: "/tmp/out",
      plugins: [createTsPlugin(), createZodPlugin()],
    });

    const baseTs = result.files.find((f) => f.path === "base.ts");
    expect(baseTs).toBeDefined();
    expect(baseTs!.content).toContain("z.ZodType<ProofNode>");
    expect(baseTs!.content).toContain("z.ZodType<FileState>");
    expect(baseTs!.content).toContain('import type { FileState, ProofNode } from "./types"');
  });

  it("generates recursive type with z.lazy", async () => {
    const result = await generate({
      schema,
      outDir: "/tmp/out",
      plugins: [createTsPlugin(), createZodPlugin()],
    });

    const baseTs = result.files.find((f) => f.path === "base.ts");
    expect(baseTs!.content).toContain("z.lazy(() => ProofNodeSchema)");
  });

  it("TS output contains interface for ProofNode", async () => {
    const result = await generate({
      schema,
      outDir: "/tmp/out",
      plugins: [createTsPlugin(), createZodPlugin()],
    });

    const typesTs = result.files.find((f) => f.path === "types.ts");
    expect(typesTs!.content).toContain("export interface ProofNode {");
    expect(typesTs!.content).toContain("export interface FileState {");
  });

  it("nullable union is optimized to z.nullable (ZOD-3)", async () => {
    const result = await generate({
      schema,
      outDir: "/tmp/out",
      plugins: [createTsPlugin(), createZodPlugin()],
    });

    const baseTs = result.files.find((f) => f.path === "base.ts");
    expect(baseTs!.content).toContain("z.nullable(z.string())");
  });
});

describe("integration: determinism", () => {
  const schema = createTestSchema({
    types: {
      B: createTypeSpec("B", primitiveType("number")),
      A: createTypeSpec("A", primitiveType("string")),
    },
  });

  it("produces identical output for identical input", async () => {
    const plugins = [createTsPlugin(), createZodPlugin()];

    const r1 = await generate({ schema, outDir: "/tmp/out", plugins });
    const r2 = await generate({ schema, outDir: "/tmp/out", plugins });

    expect(r1.files).toEqual(r2.files);
  });
});

describe("integration: error prevents flush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not write to disk when plugin collision occurs", async () => {
    const fs = await import("node:fs/promises");
    const schema = createTestSchema({
      types: { Foo: createTypeSpec("Foo", primitiveType("string")) },
    });

    // Both plugins try to write to same file
    const result = await generate({
      schema,
      outDir: "/tmp/out",
      plugins: [
        createTsPlugin({ typesFile: "shared.ts" }),
        createZodPlugin({ schemasFile: "shared.ts" }),
      ],
    });

    expect(result.diagnostics.some((d) => d.level === "error")).toBe(true);
    expect(fs.rm).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
});
