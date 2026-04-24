import type {
  CreateIntentArgs,
  ManifestoDispatchRuntime,
  ManifestoDomainShape,
  ManifestoLegalityRuntime,
  Snapshot,
  TypedActionRef,
  TypedIntent,
} from "../../index.ts";
import { createManifesto } from "../../index.ts";
import { createCounterSchema, type CounterDomain } from "../helpers/schema.ts";

function prepareIntent<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"],
>(
  runtime: ManifestoLegalityRuntime<T>,
  action: TypedActionRef<T, K>,
  ...intentArgs: CreateIntentArgs<T, K>
): TypedIntent<T, K> {
  const intent = runtime.createIntent(action, ...intentArgs);
  const blockers = runtime.whyNot(intent);
  if (blockers === null) {
    void runtime.simulateIntent(intent);
  }
  return intent;
}

function dispatchPrepared<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"],
>(
  prep: ManifestoLegalityRuntime<T>,
  write: ManifestoDispatchRuntime<T>,
  action: TypedActionRef<T, K>,
  ...intentArgs: CreateIntentArgs<T, K>
): Promise<Snapshot<T["state"]>> {
  return write.dispatchAsync(prepareIntent(prep, action, ...intentArgs));
}

const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

const legalityRuntime: ManifestoLegalityRuntime<CounterDomain> = world;
const dispatchRuntime: ManifestoDispatchRuntime<CounterDomain> = world;
const preparedIncrement: TypedIntent<CounterDomain, "increment"> = prepareIntent(
  world,
  world.MEL.actions.increment,
);
const dispatchedIncrement: Promise<Snapshot<CounterDomain["state"]>> = dispatchPrepared(
  world,
  world,
  world.MEL.actions.increment,
);
void legalityRuntime;
void dispatchRuntime;
void preparedIncrement;
void dispatchedIncrement;

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

const todo = createManifesto<TodoDomain>(`
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

const preparedAddTodo: TypedIntent<TodoDomain, "addTodo"> = prepareIntent(
  todo,
  todo.MEL.actions.addTodo,
  { title: "Review docs", id: "todo-1" },
);
const dispatchedAddTodo: Promise<Snapshot<TodoDomain["state"]>> = dispatchPrepared(
  todo,
  todo,
  todo.MEL.actions.addTodo,
  { title: "Review docs", id: "todo-1" },
);
void preparedAddTodo;
void dispatchedAddTodo;

// @ts-expect-error zero-parameter actions do not accept object binding
void prepareIntent(todo, todo.MEL.actions.clearCompleted, {});

export {};
