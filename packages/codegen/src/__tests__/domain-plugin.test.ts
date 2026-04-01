import { describe, expect, it } from "vitest";
import type { CodegenContext } from "../types.js";
import { stableHash } from "../stable-hash.js";
import { createDomainPlugin } from "../plugins/domain-plugin.js";
import { createTestSchema } from "./helpers/schema-factory.js";

function makeCtx(overrides: Parameters<typeof createTestSchema>[0] = {}): CodegenContext {
  return {
    schema: createTestSchema(overrides),
    sourceId: "src/domain/hello.mel",
    outDir: "/tmp/out",
    artifacts: {},
    helpers: { stableHash },
  };
}

describe("createDomainPlugin", () => {
  it("generates a canonical domain facade next to the source MEL file", () => {
    const plugin = createDomainPlugin();
    const out = plugin.generate(
      makeCtx({
        meta: { name: "HelloDomain" },
        state: {
          fields: {
            counter: { type: "number", required: true, default: 0 },
            "$mel.hidden": { type: "string", required: true, default: "" },
            profile: {
              type: "object",
              required: true,
              fields: {
                nickname: { type: "string", required: true },
                tagline: { type: "string", required: false },
              },
            },
          },
        },
        computed: {
          fields: {
            doubled: {
              deps: ["counter"],
              expr: {
                kind: "mul",
                left: { kind: "get", path: "counter" },
                right: { kind: "lit", value: 2 },
              },
            },
            canDecrement: {
              deps: ["counter"],
              expr: {
                kind: "gt",
                left: { kind: "get", path: "counter" },
                right: { kind: "lit", value: 0 },
              },
            },
            firstTag: {
              deps: ["profile"],
              expr: {
                kind: "field",
                object: {
                  kind: "object",
                  fields: {
                    value: { kind: "get", path: "profile.tagline" },
                  },
                },
                property: "value",
              },
            },
          },
        },
        actions: {
          decrement: {
            flow: { kind: "seq", steps: [] },
          },
          rename: {
            flow: { kind: "seq", steps: [] },
            input: {
              type: "object",
              required: true,
              fields: {
                name: { type: "string", required: true },
                force: { type: "boolean", required: false },
              },
            },
          },
        },
      })
    );

    expect(out.patches).toHaveLength(1);
    expect(out.patches[0].path).toBe("src/domain/hello.mel.ts");
    expect(out.patches[0].content).toContain("export interface HelloDomain {");
    expect(out.patches[0].content).toContain("readonly state: {");
    expect(out.patches[0].content).toContain("counter: number");
    expect(out.patches[0].content).toContain("profile: { nickname: string; tagline?: string | null }");
    expect(out.patches[0].content).not.toContain("$mel.hidden");
    expect(out.patches[0].content).toContain("readonly computed: {");
    expect(out.patches[0].content).toContain("doubled: number");
    expect(out.patches[0].content).toContain("canDecrement: boolean");
    expect(out.patches[0].content).toContain("firstTag: string | null");
    expect(out.patches[0].content).toContain("readonly actions: {");
    expect(out.patches[0].content).toContain("decrement: () => void");
    expect(out.patches[0].content).toContain("rename: (name: string, force?: boolean | null) => void");
  });

  it("infers computed references and collection operators", () => {
    const plugin = createDomainPlugin();
    const out = plugin.generate(
      makeCtx({
        state: {
          fields: {
            items: {
              type: "array",
              required: true,
              items: {
                type: "object",
                required: true,
                fields: {
                  id: { type: "string", required: true },
                  count: { type: "number", required: true },
                },
              },
            },
          },
        },
        computed: {
          fields: {
            firstItem: {
              deps: ["items"],
              expr: { kind: "first", array: { kind: "get", path: "items" } },
            },
            firstItemCount: {
              deps: ["firstItem"],
              expr: { kind: "get", path: "firstItem.count" },
            },
            itemIds: {
              deps: ["items"],
              expr: {
                kind: "map",
                array: { kind: "get", path: "items" },
                mapper: { kind: "get", path: "$item.id" },
              },
            },
            foundItem: {
              deps: ["items"],
              expr: {
                kind: "find",
                array: { kind: "get", path: "items" },
                predicate: {
                  kind: "gt",
                  left: { kind: "get", path: "$item.count" },
                  right: { kind: "lit", value: 0 },
                },
              },
            },
          },
        },
      })
    );

    expect(out.patches[0].content).toContain("firstItem: { count: number; id: string } | null");
    expect(out.patches[0].content).toContain("firstItemCount: number");
    expect(out.patches[0].content).toContain("itemIds: string[]");
    expect(out.patches[0].content).toContain("foundItem: { count: number; id: string } | null");
  });

  it("falls back to unknown with a warning for unsupported expressions", () => {
    const plugin = createDomainPlugin();
    const out = plugin.generate(
      makeCtx({
        computed: {
          fields: {
            futureThing: {
              deps: [],
              expr: { kind: "future" as never },
            },
          },
        },
      })
    );

    expect(out.patches[0].content).toContain("futureThing: unknown");
    expect(out.diagnostics?.some((diag) => diag.level === "warn")).toBe(true);
  });
});
