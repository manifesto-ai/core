import { describe, it, expect } from "vitest";
import { createZodPlugin } from "../plugins/zod-plugin.js";
import {
  createTestSchema,
  createTypeSpec,
  primitiveType,
  literalType,
  arrayType,
  recordType,
  objectType,
  unionType,
  refType,
} from "./helpers/schema-factory.js";
import type { CodegenContext } from "../types.js";
import type { TsPluginArtifacts } from "../plugins/ts-plugin.js";
import { stableHash } from "../stable-hash.js";

function makeCtx(
  types: Record<string, ReturnType<typeof createTypeSpec>>,
  tsArtifacts?: TsPluginArtifacts
): CodegenContext {
  const artifacts: Record<string, unknown> = {};
  if (tsArtifacts) {
    artifacts["codegen-plugin-ts"] = tsArtifacts;
  }
  return {
    schema: createTestSchema({ types }),
    outDir: "/tmp/out",
    artifacts,
    helpers: { stableHash },
  };
}

describe("createZodPlugin", () => {
  const plugin = createZodPlugin();

  describe("TypeDefinition mapping", () => {
    it("maps primitive string", () => {
      const ctx = makeCtx({ Foo: createTypeSpec("Foo", primitiveType("string")) });
      const out = plugin.generate(ctx);
      expect(getContent(out)).toContain("z.string()");
    });

    it("maps literal", () => {
      const ctx = makeCtx({ Foo: createTypeSpec("Foo", literalType("hello")) });
      const out = plugin.generate(ctx);
      expect(getContent(out)).toContain('z.literal("hello")');
    });

    it("maps array", () => {
      const ctx = makeCtx({ Foo: createTypeSpec("Foo", arrayType(primitiveType("number"))) });
      const out = plugin.generate(ctx);
      expect(getContent(out)).toContain("z.array(z.number())");
    });

    it("maps record with string key", () => {
      const ctx = makeCtx({
        Foo: createTypeSpec("Foo", recordType(primitiveType("string"), primitiveType("number"))),
      });
      const out = plugin.generate(ctx);
      expect(getContent(out)).toContain("z.record(z.string(), z.number())");
    });

    it("maps object with optional (ZOD-6)", () => {
      const ctx = makeCtx({
        Foo: createTypeSpec(
          "Foo",
          objectType({
            name: { type: primitiveType("string"), optional: false },
            age: { type: primitiveType("number"), optional: true },
          })
        ),
      });
      const out = plugin.generate(ctx);
      const content = getContent(out);
      expect(content).toContain("name: z.string(),");
      expect(content).toContain("age: z.number().optional(),");
    });

    it("maps ref with z.lazy (ZOD-2)", () => {
      const ctx = makeCtx({
        Node: createTypeSpec(
          "Node",
          objectType({
            children: { type: arrayType(refType("Node")), optional: false },
          })
        ),
      });
      const out = plugin.generate(ctx);
      expect(getContent(out)).toContain("z.lazy(() => NodeSchema)");
    });

    it("optimizes T | null to z.nullable (ZOD-3)", () => {
      const ctx = makeCtx({
        Foo: createTypeSpec("Foo", unionType([primitiveType("string"), primitiveType("null")])),
      });
      const out = plugin.generate(ctx);
      expect(getContent(out)).toContain("z.nullable(z.string())");
    });

    it("maps general union", () => {
      const ctx = makeCtx({
        Foo: createTypeSpec("Foo", unionType([primitiveType("string"), primitiveType("number")])),
      });
      const out = plugin.generate(ctx);
      expect(getContent(out)).toContain("z.union([z.string(), z.number()])");
    });

    it("emits z.unknown() + warn for unknown kind (ZOD-1)", () => {
      const unknownDef = { kind: "future" as any, data: 123 };
      const ctx = makeCtx({ Foo: createTypeSpec("Foo", unknownDef) });
      const out = plugin.generate(ctx);
      expect(getContent(out)).toContain("z.unknown()");
      expect(out.diagnostics!.some((d) => d.level === "warn")).toBe(true);
    });
  });

  describe("ZOD-7: non-string record key degrade", () => {
    it("degrades non-string key to z.record(z.string(), ...) with warn", () => {
      const ctx = makeCtx({
        Foo: createTypeSpec("Foo", recordType(primitiveType("number"), primitiveType("string"))),
      });
      const out = plugin.generate(ctx);
      expect(getContent(out)).toContain("z.record(z.string(),");
      expect(out.diagnostics!.some((d) => d.level === "warn")).toBe(true);
    });
  });

  describe("TS artifacts interaction", () => {
    it("adds type annotation when TS artifacts available (ZOD-4)", () => {
      const tsArtifacts: TsPluginArtifacts = {
        typeNames: ["Foo"],
        typeImportPath: "./types",
      };
      const ctx = makeCtx(
        { Foo: createTypeSpec("Foo", primitiveType("string")) },
        tsArtifacts
      );
      const out = plugin.generate(ctx);
      const content = getContent(out);
      expect(content).toContain("z.ZodType<Foo>");
      expect(content).toContain('import type { Foo } from "./types"');
    });

    it("works without TS artifacts (ZOD-5)", () => {
      const ctx = makeCtx({ Foo: createTypeSpec("Foo", primitiveType("string")) });
      const out = plugin.generate(ctx);
      const content = getContent(out);
      expect(content).toContain("export const FooSchema = z.string()");
      expect(content).not.toContain("ZodType");
    });
  });

  describe("imports", () => {
    it("includes zod import", () => {
      const ctx = makeCtx({ Foo: createTypeSpec("Foo", primitiveType("string")) });
      const out = plugin.generate(ctx);
      expect(getContent(out)).toContain('import { z } from "zod"');
    });
  });
});

function getContent(out: { patches: readonly { op: string; path: string; content?: string }[] }): string {
  const setPatch = out.patches.find((p) => p.op === "set");
  return (setPatch as any)?.content ?? "";
}
