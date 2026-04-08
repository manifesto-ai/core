import { describe, expect, it } from "vitest";

import {
  AlreadyActivatedError,
  CompileError,
  ManifestoError,
  ReservedEffectError,
  createManifesto,
  type DomainSchema,
} from "../index.js";
import {
  counterMelSource,
  createDispatchabilitySchema,
  createCounterSchema,
  createRawCounterSchema,
  type CounterDomain,
  type DispatchabilityDomain,
  type MelCounterDomain,
  withHash,
} from "./helpers/schema.js";

describe("createManifesto()", () => {
  it("returns a composable manifesto with normalized schema and no runtime verbs", () => {
    const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});

    expect(manifesto.schema.state.fields["$host"]).toBeDefined();
    expect(manifesto.schema.state.fields.$mel).toBeDefined();
    expect("activate" in manifesto).toBe(true);
    expect("dispatchAsync" in manifesto).toBe(false);
    expect("subscribe" in manifesto).toBe(false);
  });

  it("activates only once", () => {
    const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});
    const world = manifesto.activate();

    expect(world.MEL.actions.increment).toBeDefined();
    expect(world.MEL.actions.increment.name).toBe("increment");
    expect(world.MEL.state.count.name).toBe("count");
    expect(world.MEL.computed.doubled.name).toBe("doubled");
    expect(() => manifesto.activate()).toThrow(AlreadyActivatedError);

    world.dispose();
  });

  it("creates intents from MEL action refs with generated ids and packed input", () => {
    const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const increment = world.createIntent(world.MEL.actions.increment);
    expect(increment.type).toBe("increment");
    expect(increment.input).toBeUndefined();
    expect(increment.intentId.length).toBeGreaterThan(0);

    const add = world.createIntent(world.MEL.actions.add, 7);
    expect(add.type).toBe("add");
    expect(add.input).toEqual({ amount: 7 });
    expect(add.intentId.length).toBeGreaterThan(0);

    world.dispose();
  });

  it("accepts object-form binding for single-parameter scalar actions", () => {
    const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const add = world.createIntent(world.MEL.actions.add, { amount: 7 });
    expect(add.type).toBe("add");
    expect(add.input).toEqual({ amount: 7 });

    world.dispose();
  });

  it("preserves direct-value packing for ambiguous single object-valued parameters", () => {
    type SettingsDomain = {
      actions: {
        configure: (settings: { settings: string }) => void;
      };
      state: {
        current: { settings: string };
      };
      computed: {};
    };

    const schema = withHash({
      id: "manifesto:sdk-v3-single-object-param",
      version: "1.0.0",
      types: {},
      state: {
        fields: {
          current: {
            type: "object",
            required: true,
            default: { settings: "light" },
            fields: {
              settings: { type: "string", required: true },
            },
          },
        },
      },
      computed: { fields: {} },
      actions: {
        configure: {
          input: {
            type: "object",
            required: true,
            fields: {
              settings: {
                type: "object",
                required: true,
                fields: {
                  settings: { type: "string", required: true },
                },
              },
            },
          },
          flow: {
            kind: "patch",
            op: "set",
            path: "data.current",
            value: { kind: "get", path: "input.settings" },
          },
        },
      },
    });
    const world = createManifesto<SettingsDomain>(schema, {}).activate();

    expect(
      world.createIntent(world.MEL.actions.configure, { settings: "dark" }).input,
    ).toEqual({ settings: { settings: "dark" } });

    world.dispose();
  });

  it("preserves MEL action parameter order when packing multi-argument intents", () => {
    type TodoDomain = {
      actions: {
        addTodo: (title: string, id: string) => void;
      };
      state: {
        todos: Array<{ id: string; title: string }>;
      };
      computed: {};
    };

    const world = createManifesto<TodoDomain>(`
domain Todos {
  state { todos: Array<{ id: string, title: string }> = [] }

  action addTodo(title: string, id: string) {
    onceIntent {
      patch todos = append(todos, { id: id, title: title })
    }
  }
}
`, {}).activate();

    const intent = world.createIntent(world.MEL.actions.addTodo, "Write docs", "todo-1");
    expect(intent.input).toEqual({ title: "Write docs", id: "todo-1" });

    world.dispose();
  });

  it("accepts object-form binding for MEL actions with multiple parameters", () => {
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

    const world = createManifesto<TodoDomain>(`
domain Todos {
  state { todos: Array<{ id: string, title: string }> = [] }

  action addTodo(title: string, id: string) {
    onceIntent {
      patch todos = append(todos, { id: id, title: title })
    }
  }

  action clearCompleted() {
    onceIntent {
      patch todos = todos
    }
  }
}
`, {}).activate();

    const intent = world.createIntent(world.MEL.actions.addTodo, {
      title: "Write docs",
      id: "todo-1",
    });

    expect(intent.input).toEqual({ title: "Write docs", id: "todo-1" });

    const metadata = world.getActionMetadata("addTodo");
    expect(metadata.name).toBe("addTodo");
    expect(metadata.params).toEqual(["title", "id"]);
    expect(metadata.input).toMatchObject({
      type: "object",
      required: true,
      fields: {
        title: { type: "string", required: true },
        id: { type: "string", required: true },
      },
    });
    expect(metadata.description).toBeUndefined();
    expect(metadata.hasDispatchableGate).toBe(false);
    expect(world.getActionMetadata().map((action) => action.name)).toEqual([
      "addTodo",
      "clearCompleted",
    ]);

    world.dispose();
  });

  it("rejects positional packing for hand-authored multi-field object inputs", () => {
    type ManualSchemaDomain = {
      actions: {
        addTodo: (title: string, id: string) => void;
      };
      state: {
        todos: Array<{ id: string; title: string }>;
      };
      computed: {};
    };

    const schema = withHash({
      id: "manifesto:sdk-v3-manual-add-todo",
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
          input: {
            type: "object",
            required: true,
            fields: {
              id: { type: "string", required: true },
              title: { type: "string", required: true },
            },
          },
          flow: {
            kind: "patch",
            op: "set",
            path: "data.todos",
            value: {
              kind: "append",
              array: { kind: "get", path: "todos" },
              items: [{ kind: "get", path: "input" }],
            },
          },
        },
      },
    });
    const world = createManifesto<ManualSchemaDomain>(schema, {}).activate();

    expect(() => (
      world.createIntent as unknown as (...args: unknown[]) => ReturnType<typeof world.createIntent>
    )(world.MEL.actions.addTodo, "Write docs", "todo-1")).toThrowError(
      expect.objectContaining<Partial<ManifestoError>>({
        code: "INVALID_INTENT_ARGS",
      }),
    );
    expect(() => (
      world.createIntent as unknown as (...args: unknown[]) => ReturnType<typeof world.createIntent>
    )(world.MEL.actions.addTodo, "Write docs")).toThrowError(
      expect.objectContaining<Partial<ManifestoError>>({
        code: "INVALID_INTENT_ARGS",
      }),
    );
    expect(world.createIntent(
      world.MEL.actions.addTodo,
      { id: "todo-1", title: "Write docs" },
    ).input).toEqual({ id: "todo-1", title: "Write docs" });

    world.dispose();
  });

  it("preserves positional packing when manual schemas provide action.params", () => {
    type ManualSchemaDomain = {
      actions: {
        addTodo: (title: string, id: string) => void;
      };
      state: {
        todos: Array<{ id: string; title: string }>;
      };
      computed: {};
    };

    const schema = withHash({
      id: "manifesto:sdk-v3-manual-add-todo-with-params",
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
          params: ["title", "id"],
          input: {
            type: "object",
            required: true,
            fields: {
              id: { type: "string", required: true },
              title: { type: "string", required: true },
            },
          },
          flow: {
            kind: "patch",
            op: "set",
            path: "data.todos",
            value: {
              kind: "append",
              array: { kind: "get", path: "todos" },
              items: [{ kind: "get", path: "input" }],
            },
          },
        },
      },
    });
    const world = createManifesto<ManualSchemaDomain>(schema, {}).activate();

    expect(
      world.createIntent(world.MEL.actions.addTodo, "Write docs", "todo-1").input,
    ).toEqual({ title: "Write docs", id: "todo-1" });

    world.dispose();
  });

  it("exposes schema descriptions and manual object-input metadata", () => {
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

    const schema = withHash({
      id: "manifesto:sdk-v3-action-metadata",
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
          description: "Append a todo item",
          input: {
            type: "object",
            required: true,
            fields: {
              id: { type: "string", required: true },
              title: { type: "string", required: true },
            },
          },
          flow: {
            kind: "patch",
            op: "set",
            path: "data.todos",
            value: {
              kind: "append",
              array: { kind: "get", path: "todos" },
              items: [{ kind: "get", path: "input" }],
            },
          },
        },
        clearCompleted: {
          description: "Remove completed todos",
          flow: {
            kind: "patch",
            op: "set",
            path: "data.todos",
            value: { kind: "get", path: "todos" },
          },
        },
      },
    });

    const world = createManifesto<TodoDomain>(schema, {}).activate();
    const addTodo = world.getActionMetadata("addTodo");
    const clearCompleted = world.getActionMetadata("clearCompleted");

    expect(addTodo.params).toEqual(["id", "title"]);
    expect(addTodo.description).toBe("Append a todo item");
    expect(addTodo.hasDispatchableGate).toBe(false);
    expect(clearCompleted.params).toEqual([]);
    expect(clearCompleted.input).toBeUndefined();
    expect(clearCompleted.description).toBe("Remove completed todos");
    expect(clearCompleted.hasDispatchableGate).toBe(false);

    world.dispose();
  });

  it("marks dispatchable actions in metadata", () => {
    const world = createManifesto<DispatchabilityDomain>(
      createDispatchabilitySchema(),
      {},
    ).activate();

    expect(world.getActionMetadata("increment").hasDispatchableGate).toBe(false);
    expect(world.getActionMetadata("incrementGuarded").hasDispatchableGate).toBe(true);

    world.dispose();
  });

  it("compiles MEL source strings before activation", async () => {
    const world = createManifesto<MelCounterDomain>(counterMelSource, {}).activate();

    await world.dispatchAsync(world.createIntent(world.MEL.actions.increment));

    expect(world.getSnapshot().data.count).toBe(1);
    world.dispose();
  });

  it("throws CompileError when MEL compilation fails", () => {
    expect(() => createManifesto<CounterDomain>("domain Broken { nope", {})).toThrow(CompileError);
  });

  it("rejects reserved effect overrides", () => {
    expect(() => createManifesto<CounterDomain>(createCounterSchema(), {
      "system.get": async () => [],
    })).toThrow(ReservedEffectError);
  });

  it("rejects reserved action namespaces", () => {
    const raw = createRawCounterSchema();
    const schema = withHash({
      ...raw,
      actions: {
        ...raw.actions,
        "system.increment": raw.actions.increment,
      },
    });

    expect(() => createManifesto<CounterDomain>(schema, {})).toThrowError(
      expect.objectContaining<Partial<ManifestoError>>({
        code: "RESERVED_NAMESPACE",
      }),
    );
  });

  it("rejects invalid reserved platform namespace shapes", () => {
    const raw = createRawCounterSchema();
    const schema: DomainSchema = withHash({
      ...raw,
      state: {
        fields: {
          ...raw.state.fields,
          $host: { type: "string", required: false },
        },
      },
    });

    expect(() => createManifesto<CounterDomain>(schema, {})).toThrowError(
      expect.objectContaining<Partial<ManifestoError>>({
        code: "SCHEMA_ERROR",
      }),
    );
  });
});
