import { describe, it, expect } from "vitest";
import { createTsPlugin } from "../plugins/ts-plugin.js";
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
import { stableHash } from "../stable-hash.js";

function makeCtx(types: Record<string, ReturnType<typeof createTypeSpec>>): CodegenContext {
  return {
    schema: createTestSchema({ types }),
    outDir: "/tmp/out",
    artifacts: {},
    helpers: { stableHash },
  };
}

describe("createTsPlugin", () => {
  const plugin = createTsPlugin();

  describe("TypeDefinition mapping", () => {
    it("maps primitive string", () => {
      const ctx = makeCtx({ Foo: createTypeSpec("Foo", primitiveType("string")) });
      const out = plugin.generate(ctx);
      expect(out.patches[0].content).toContain("export type Foo = string;");
    });

    it("maps primitive number", () => {
      const ctx = makeCtx({ Foo: createTypeSpec("Foo", primitiveType("number")) });
      const out = plugin.generate(ctx);
      expect(out.patches[0].content).toContain("export type Foo = number;");
    });

    it("maps literal string", () => {
      const ctx = makeCtx({ Foo: createTypeSpec("Foo", literalType("hello")) });
      const out = plugin.generate(ctx);
      expect(out.patches[0].content).toContain('export type Foo = "hello";');
    });

    it("maps literal number", () => {
      const ctx = makeCtx({ Foo: createTypeSpec("Foo", literalType(42)) });
      const out = plugin.generate(ctx);
      expect(out.patches[0].content).toContain("export type Foo = 42;");
    });

    it("maps array", () => {
      const ctx = makeCtx({ Foo: createTypeSpec("Foo", arrayType(primitiveType("string"))) });
      const out = plugin.generate(ctx);
      expect(out.patches[0].content).toContain("export type Foo = string[];");
    });

    it("maps record", () => {
      const ctx = makeCtx({
        Foo: createTypeSpec("Foo", recordType(primitiveType("string"), primitiveType("number"))),
      });
      const out = plugin.generate(ctx);
      expect(out.patches[0].content).toContain("export type Foo = Record<string, number>;");
    });

    it("maps object as interface (TS-3)", () => {
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
      const content = out.patches[0].content;
      expect(content).toContain("export interface Foo {");
      expect(content).toContain("name: string;");
      expect(content).toContain("age?: number;"); // TS-5: optional
    });

    it("maps union", () => {
      const ctx = makeCtx({
        Foo: createTypeSpec("Foo", unionType([primitiveType("string"), primitiveType("number")])),
      });
      const out = plugin.generate(ctx);
      expect(out.patches[0].content).toContain("export type Foo = string | number;");
    });

    it("maps nullable as T | null (TS-2)", () => {
      const ctx = makeCtx({
        Foo: createTypeSpec("Foo", unionType([primitiveType("string"), primitiveType("null")])),
      });
      const out = plugin.generate(ctx);
      expect(out.patches[0].content).toContain("export type Foo = string | null;");
    });

    it("maps ref", () => {
      const ctx = makeCtx({
        Bar: createTypeSpec("Bar", primitiveType("string")),
        Foo: createTypeSpec("Foo", arrayType(refType("Bar"))),
      });
      const out = plugin.generate(ctx);
      expect(out.patches[0].content).toContain("export type Foo = Bar[];");
    });

    it("emits unknown + warn for unknown kind (TS-1, PLG-3)", () => {
      const unknownDef = { kind: "future" as any, data: 123 };
      const ctx = makeCtx({ Foo: createTypeSpec("Foo", unknownDef) });
      const out = plugin.generate(ctx);
      expect(out.patches[0].content).toContain("unknown");
      expect(out.diagnostics!.some((d) => d.level === "warn")).toBe(true);
    });
  });

  describe("ordering (TS-6, DET-5)", () => {
    it("emits types in lexicographic order", () => {
      const ctx = makeCtx({
        Zebra: createTypeSpec("Zebra", primitiveType("string")),
        Alpha: createTypeSpec("Alpha", primitiveType("number")),
        Middle: createTypeSpec("Middle", primitiveType("boolean")),
      });
      const out = plugin.generate(ctx);
      const content = out.patches[0].content;
      const alphaIdx = content.indexOf("Alpha");
      const middleIdx = content.indexOf("Middle");
      const zebraIdx = content.indexOf("Zebra");
      expect(alphaIdx).toBeLessThan(middleIdx);
      expect(middleIdx).toBeLessThan(zebraIdx);
    });
  });

  describe("artifacts (TS-7)", () => {
    it("publishes typeNames and typeImportPath", () => {
      const ctx = makeCtx({
        Foo: createTypeSpec("Foo", primitiveType("string")),
        Bar: createTypeSpec("Bar", primitiveType("number")),
      });
      const out = plugin.generate(ctx);
      const artifacts = out.artifacts as Record<string, unknown>;
      expect(artifacts.typeNames).toEqual(["Bar", "Foo"]); // sorted
      expect(artifacts.typeImportPath).toBe("./types");
    });
  });
});
