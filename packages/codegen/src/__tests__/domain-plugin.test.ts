import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";
import type { CodegenContext } from "../types.js";
import { stableHash } from "../stable-hash.js";
import { createDomainPlugin } from "../plugins/domain-plugin.js";
import { createTestSchema } from "./helpers/schema-factory.js";

const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));

function makeCtx(overrides: Parameters<typeof createTestSchema>[0] = {}): CodegenContext {
  return {
    schema: createTestSchema(overrides),
    sourceId: "src/domain/hello.mel",
    outDir: "/tmp/out",
    artifacts: {},
    helpers: { stableHash },
  };
}

function assertTypechecks(files: Readonly<Record<string, string>>): void {
  const tempDir = mkdtempSync(join(tmpdir(), "manifesto-codegen-"));

  try {
    writeFileSync(join(tempDir, "package.json"), JSON.stringify({ type: "module" }));
    const rootNames = Object.entries(files).map(([name, content]) => {
      const path = join(tempDir, name);
      writeFileSync(path, content);
      return path;
    });

    const program = ts.createProgram(rootNames, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      esModuleInterop: true,
      lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
      types: [],
      baseUrl: REPO_ROOT,
      paths: {
        "@manifesto-ai/compiler": ["packages/compiler/src/index.ts"],
        "@manifesto-ai/core": ["packages/core/src/index.ts"],
        "@manifesto-ai/host": ["packages/host/src/index.ts"],
        "@manifesto-ai/sdk": ["packages/sdk/src/index.ts"],
      },
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => REPO_ROOT,
      getNewLine: () => "\n",
    });

    expect(formatted).toBe("");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
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
            params: ["name", "force"],
            input: {
              type: "object",
              required: true,
              fields: {
                name: { type: "string", required: true },
                force: { type: "boolean", required: false },
              },
            },
          },
          configure: {
            flow: { kind: "seq", steps: [] },
            input: {
              type: "object",
              required: true,
              fields: {
                retries: { type: "number", required: true },
                label: { type: "string", required: false },
              },
            },
          },
        },
      })
    );

    expect(out.patches).toHaveLength(1);
    expect(out.patches[0].path).toBe("src/domain/hello.domain.ts");
    expect(out.patches[0].content).toContain("import type {");
    expect(out.patches[0].content).toContain("ActionArgs,");
    expect(out.patches[0].content).toContain("ActionHandle,");
    expect(out.patches[0].content).toContain("ActionInput,");
    expect(out.patches[0].content).toContain("ManifestoApp,");
    expect(out.patches[0].content).toContain("RuntimeMode,");
    expect(out.patches[0].content).toContain("} from \"@manifesto-ai/sdk\";");
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
    expect(out.patches[0].content).toContain("configure: (input: { label?: string | null; retries: number }) => void");
    expect(out.patches[0].content).toContain("export type HelloActionInput<Name extends keyof HelloDomain[\"actions\"] & string> =");
    expect(out.patches[0].content).toContain("ActionInput<HelloDomain, Name>;");
    expect(out.patches[0].content).toContain("export type HelloActionArgs<Name extends keyof HelloDomain[\"actions\"] & string> =");
    expect(out.patches[0].content).toContain("ActionArgs<HelloDomain, Name>;");
    expect(out.patches[0].content).toContain("export type HelloActions<TMode extends RuntimeMode> = {");
    expect(out.patches[0].content).toContain("ActionHandle<HelloDomain, Name, TMode>;");
    expect(out.patches[0].content).toContain("export type HelloActionAccessor<TMode extends RuntimeMode> =");
    expect(out.patches[0].content).toContain("ManifestoApp<HelloDomain, TMode>[\"action\"];");
    expect(out.patches[0].content).toContain("export type HelloApp<TMode extends RuntimeMode> =");
    expect(out.patches[0].content).toContain("ManifestoApp<HelloDomain, TMode>;");
    expect(out.patches[0].content).not.toContain("dispatchAsync");
    expect(out.patches[0].content).not.toContain("commitAsync");
    expect(out.patches[0].content).not.toContain("proposeAsync");
  });

  it("prefers precise state.fieldTypes and warns when TypeDefinition metadata degrades", () => {
    const plugin = createDomainPlugin();
    const out = plugin.generate(
      makeCtx({
        state: {
          fields: {
            entries: { type: "object", required: true, fields: {} },
            payload: { type: "object", required: true, fields: {} },
            items: { type: "array", required: true, items: { type: "string", required: true } },
            unsupportedState: { type: "number", required: true },
          },
          fieldTypes: {
            entries: {
              kind: "record",
              key: { kind: "primitive", type: "string" },
              value: { kind: "primitive", type: "number" },
            },
            payload: { kind: "primitive", type: "object" },
            items: { kind: "primitive", type: "array" },
            unsupportedState: { kind: "primitive", type: "integer" },
          },
        },
        actions: {
          submitPayload: {
            flow: { kind: "seq", steps: [] },
            params: ["payload", "items"],
            inputType: {
              kind: "object",
              fields: {
                payload: { type: { kind: "primitive", type: "object" }, optional: false },
                items: { type: { kind: "primitive", type: "array" }, optional: false },
              },
            },
          },
          directFuture: {
            flow: { kind: "seq", steps: [] },
            inputType: { kind: "future" as never },
          },
          nestedFuture: {
            flow: { kind: "seq", steps: [] },
            params: ["amount"],
            inputType: {
              kind: "object",
              fields: {
                amount: { type: { kind: "primitive", type: "integer" }, optional: false },
              },
            },
          },
        },
      })
    );

    expect(out.patches[0].content).toContain("entries: Record<string, number>");
    expect(out.patches[0].content).toContain("payload: Record<string, unknown>");
    expect(out.patches[0].content).toContain("items: unknown[]");
    expect(out.patches[0].content).toContain(
      "submitPayload: (payload: Record<string, unknown>, items: unknown[]) => void"
    );
    expect(out.patches[0].content).toContain("unsupportedState: unknown");
    expect(out.patches[0].content).toContain("directFuture: (input: unknown) => void");
    expect(out.patches[0].content).toContain("nestedFuture: (amount: unknown) => void");
    expect(out.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "warn",
        message: expect.stringContaining("integer"),
      }),
      expect.objectContaining({
        level: "warn",
        message: expect.stringContaining("Unknown TypeDefinition kind"),
      }),
    ]));
  });

  it("derives action signatures from params and inputType without inventing positional fields", () => {
    const plugin = createDomainPlugin();
    const out = plugin.generate(
      makeCtx({
        meta: { name: "FacadeDomain" },
        actions: {
          ordered: {
            flow: { kind: "seq", steps: [] },
            params: ["second", "first"],
            inputType: {
              kind: "object",
              fields: {
                first: { type: { kind: "primitive", type: "string" }, optional: false },
                second: { type: { kind: "primitive", type: "number" }, optional: true },
              },
            },
            input: {
              type: "object",
              required: true,
              fields: {
                first: { type: "boolean", required: true },
                second: { type: "boolean", required: true },
              },
            },
          },
          objectOnly: {
            flow: { kind: "seq", steps: [] },
            inputType: {
              kind: "object",
              fields: {
                title: { type: { kind: "primitive", type: "string" }, optional: false },
                done: { type: { kind: "primitive", type: "boolean" }, optional: true },
              },
            },
          },
          unresolved: {
            flow: { kind: "seq", steps: [] },
            params: ["missing"],
            input: {
              type: "object",
              required: true,
              fields: {
                present: { type: "string", required: true },
              },
            },
          },
        },
      })
    );

    expect(out.patches[0].content).toContain("ordered: (second: number | undefined, first: string) => void");
    expect(out.patches[0].content).toContain("objectOnly: (input: { done?: boolean; title: string }) => void");
    expect(out.patches[0].content).toContain("unresolved: (missing: unknown) => void");
    expect(out.diagnostics).toContainEqual(expect.objectContaining({
      level: "warn",
      message: expect.stringContaining("missing"),
    }));
  });

  it("keeps colliding action names reachable through typed action(name) facade aliases", () => {
    const plugin = createDomainPlugin();
    const out = plugin.generate(
      makeCtx({
        meta: { name: "CollisionDomain" },
        actions: {
          then: { flow: { kind: "seq", steps: [] } },
          bind: { flow: { kind: "seq", steps: [] } },
          constructor: { flow: { kind: "seq", steps: [] } },
          inspect: { flow: { kind: "seq", steps: [] } },
          snapshot: { flow: { kind: "seq", steps: [] } },
          dispose: { flow: { kind: "seq", steps: [] } },
          action: { flow: { kind: "seq", steps: [] } },
        },
      })
    );

    expect(out.patches[0].content).toContain("then: () => void");
    expect(out.patches[0].content).toContain("bind: () => void");
    expect(out.patches[0].content).toContain("constructor: () => void");
    expect(out.patches[0].content).toContain("inspect: () => void");
    expect(out.patches[0].content).toContain("snapshot: () => void");
    expect(out.patches[0].content).toContain("dispose: () => void");
    expect(out.patches[0].content).toContain("action: () => void");
    expect(out.patches[0].content).toContain("export type CollisionActionAccessor<TMode extends RuntimeMode> =");
    expect(out.patches[0].content).toContain("ManifestoApp<CollisionDomain, TMode>[\"action\"];");
  });

  it("emits SDK v5 facade aliases that typecheck against the public SDK surface", () => {
    const plugin = createDomainPlugin();
    const out = plugin.generate(
      makeCtx({
        meta: { name: "TypecheckDomain" },
        state: {
          fields: {
            counter: { type: "number", required: true, default: 0 },
          },
        },
        actions: {
          decrement: { flow: { kind: "seq", steps: [] } },
          rename: {
            flow: { kind: "seq", steps: [] },
            params: ["name", "force"],
            input: {
              type: "object",
              required: true,
              fields: {
                name: { type: "string", required: true },
                force: { type: "boolean", required: false },
              },
            },
          },
          configure: {
            flow: { kind: "seq", steps: [] },
            inputType: {
              kind: "object",
              fields: {
                retries: { type: { kind: "primitive", type: "number" }, optional: false },
                label: { type: { kind: "primitive", type: "string" }, optional: true },
              },
            },
          },
          then: { flow: { kind: "seq", steps: [] } },
          bind: { flow: { kind: "seq", steps: [] } },
          action: { flow: { kind: "seq", steps: [] } },
        },
      })
    );

    assertTypechecks({
      "typecheck.domain.ts": out.patches[0].content,
      "consumer.ts": `
        import type { ActionHandle, ManifestoApp } from "@manifesto-ai/sdk";
        import type {
          TypecheckActionAccessor,
          TypecheckActionArgs,
          TypecheckActionInput,
          TypecheckActions,
          TypecheckApp,
          TypecheckDomain,
        } from "./typecheck.domain.js";

        declare const app: TypecheckApp<"base">;
        declare const actions: TypecheckActions<"base">;
        declare const action: TypecheckActionAccessor<"base">;

        const renameArgs: TypecheckActionArgs<"rename"> = ["Ada", true];
        const configureArgs: TypecheckActionArgs<"configure"> = [{ retries: 3 }];
        const decrementArgs: TypecheckActionArgs<"decrement"> = [];
        const renameInput: TypecheckActionInput<"rename"> = ["Ada", false];
        const configureInput: TypecheckActionInput<"configure"> = { retries: 3 };
        const decrementInput: TypecheckActionInput<"decrement"> = undefined;
        const typedApp: ManifestoApp<TypecheckDomain, "base"> = app;
        const renameHandle: ActionHandle<TypecheckDomain, "rename", "base"> = actions.rename;

        typedApp.action("rename").preview(...renameArgs);
        renameHandle.bind(...renameArgs);
        actions.configure.submit(...configureArgs);
        actions.decrement.check(...decrementArgs);
        action("then").info();
        action("bind").available();
        action("action").check();

        void renameInput;
        void configureInput;
        void decrementInput;
      `,
    });
  });

  it("emits named schema types referenced by state fieldTypes into a self-contained facade", () => {
    const plugin = createDomainPlugin();
    const out = plugin.generate(
      makeCtx({
        meta: { name: "TodoDomain" },
        types: {
          Todo: {
            name: "Todo",
            definition: {
              kind: "object",
              fields: {
                id: { type: { kind: "primitive", type: "string" }, optional: false },
                title: { type: { kind: "primitive", type: "string" }, optional: false },
                completed: { type: { kind: "primitive", type: "boolean" }, optional: false },
              },
            },
          },
        },
        state: {
          fields: {
            todos: {
              type: "array",
              required: true,
              default: [],
              items: {
                type: "object",
                required: true,
                fields: {
                  id: { type: "string", required: true },
                  title: { type: "string", required: true },
                  completed: { type: "boolean", required: true },
                },
              },
            },
          },
          fieldTypes: {
            todos: {
              kind: "array",
              element: { kind: "ref", name: "Todo" },
            },
          },
        },
      })
    );

    const content = out.patches[0].content;
    expect(content).toContain("export interface Todo {");
    expect(content).toContain("completed: boolean");
    expect(content).toContain("id: string");
    expect(content).toContain("title: string");
    expect(content).toContain("export interface TodoDomain {");
    expect(content).toContain("todos: Todo[]");

    assertTypechecks({
      "todo.domain.ts": content,
      "consumer.ts": `
        import type { Todo, TodoDomain } from "./todo.domain.js";

        const todo: Todo = {
          completed: false,
          id: "todo-1",
          title: "Ship codegen",
        };
        const todos: TodoDomain["state"]["todos"] = [todo];
        const state: TodoDomain["state"] = { todos };

        void state;
      `,
    });
  });

  it("degrades unresolved TypeDefinition refs instead of emitting unresolved identifiers", () => {
    const plugin = createDomainPlugin();
    const out = plugin.generate(
      makeCtx({
        state: {
          fields: {
            current: { type: "object", required: true, fields: {} },
          },
          fieldTypes: {
            current: { kind: "ref", name: "MissingType" },
          },
        },
      })
    );

    expect(out.patches[0].content).toContain("current: unknown");
    expect(out.patches[0].content).not.toContain("MissingType");
    expect(out.diagnostics).toContainEqual(expect.objectContaining({
      level: "warn",
      message: expect.stringContaining("MissingType"),
    }));
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
