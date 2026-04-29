import { describe, expect, it } from "vitest";
import {
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
} from "@manifesto-ai/core";

import {
  AlreadyActivatedError,
  CompileError,
  ManifestoError,
  ReservedEffectError,
  createManifesto,
} from "../index.js";
import {
  counterMelSource,
  createCounterSchema,
  type CounterDomain,
  type MelCounterDomain,
} from "./helpers/schema.js";

const pp = semanticPathToPatchPath;

type TodoDomain = {
  actions: {
    addTodo: (title: string, id: string) => void;
    clearCompleted: () => void;
  };
  state: {
    todos: Array<{ id: string; title: string }>;
  };
  computed: {};
};

function withHash(schema: Omit<DomainSchema, "hash">): DomainSchema {
  return {
    ...schema,
    hash: hashSchemaSync(schema),
  };
}

function createTodoSchema(): DomainSchema {
  return withHash({
    id: "manifesto:sdk-v5-create-todos",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        todos: {
          type: "array",
          required: false,
          default: [],
          items: {
            type: "object",
            required: true,
            fields: {
              id: { type: "string", required: true },
              title: { type: "string", required: true },
            },
          },
        },
      },
    },
    computed: { fields: {} },
    actions: {
      addTodo: {
        description: "Add a todo",
        params: ["title", "id"],
        input: {
          type: "object",
          required: true,
          fields: {
            title: { type: "string", required: true, description: "Todo title" },
            id: { type: "string", required: true },
          },
        },
        flow: {
          kind: "patch",
          op: "set",
          path: pp("todos"),
          value: {
            kind: "append",
            array: { kind: "get", path: "todos" },
            item: {
              kind: "object",
              fields: {
                id: { kind: "get", path: "input.id" },
                title: { kind: "get", path: "input.title" },
              },
            },
          },
        },
      },
      clearCompleted: {
        flow: {
          kind: "patch",
          op: "set",
          path: pp("todos"),
          value: { kind: "lit", value: [] },
        },
      },
    },
  });
}

describe("createManifesto()", () => {
  it("activates once and returns the v5 app root", () => {
    const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});
    const app = manifesto.activate();

    expect(app.actions.increment.info().name).toBe("increment");
    expect(app.snapshot().state.count).toBe(0);
    expect(() => manifesto.activate()).toThrow(AlreadyActivatedError);
  });

  it("rejects reserved effects and DomainModule artifacts", () => {
    expect(() => createManifesto<CounterDomain>(
      createCounterSchema(),
      { "system.get": async () => [] },
    )).toThrow(ReservedEffectError);

    expect(() => createManifesto<CounterDomain>({
      schema: createCounterSchema(),
      graph: {},
      annotations: {},
    } as unknown as DomainSchema, {})).toThrowError(
      expect.objectContaining<Partial<ManifestoError>>({
        code: "SCHEMA_ERROR",
      }),
    );
  });

  it("packs bound action intents from schema parameter metadata", () => {
    const app = createManifesto<TodoDomain>(createTodoSchema(), {}).activate();

    const bound = app.actions.addTodo.bind("Write docs", "todo-1");

    expect(bound.input).toEqual({ title: "Write docs", id: "todo-1" });
    expect(bound.intent()).toMatchObject({
      type: "addTodo",
      input: { title: "Write docs", id: "todo-1" },
    });
  });

  it("exposes static action info through action handles and inspect", () => {
    const app = createManifesto<TodoDomain>(
      createTodoSchema(),
      {},
      { annotations: { addTodo: { title: "Add Todo", "ui:button": true } } },
    ).activate();

    expect(app.actions.addTodo.info()).toMatchObject({
      name: "addTodo",
      title: "Add Todo",
      description: "Add a todo",
      parameters: [
        { name: "title", required: true, type: "string", description: "Todo title" },
        { name: "id", required: true, type: "string" },
      ],
      annotations: { title: "Add Todo", "ui:button": true },
    });
    expect(app.inspect.action("addTodo")).toEqual(app.actions.addTodo.info());
  });

  it("compiles MEL source strings before activation", async () => {
    const app = createManifesto<MelCounterDomain>(counterMelSource, {}).activate();

    const result = await app.actions.increment.submit();

    expect(result.ok && result.after.state.count).toBe(1);
  });

  it("throws CompileError for invalid MEL source", () => {
    expect(() => createManifesto<MelCounterDomain>("domain {", {})).toThrow(CompileError);
  });
});
