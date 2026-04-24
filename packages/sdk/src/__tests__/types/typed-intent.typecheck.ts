import type { Intent } from "@manifesto-ai/core";

import type { DispatchBlocker, IntentExplanation, SimulateResult } from "../../index.ts";
import { createManifesto } from "../../index.ts";
import { createForeignSchema, type ForeignDomain } from "../helpers/foreign-schema.ts";
import { createCounterSchema, type CounterDomain } from "../helpers/schema.ts";

const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
const typedIntent = world.createIntent(world.MEL.actions.increment);
const explanation: IntentExplanation<CounterDomain> = world.explainIntent(typedIntent);
const sameExplanation: IntentExplanation<CounterDomain> = world.why(typedIntent);
const blockersOrNull: readonly DispatchBlocker[] | null = world.whyNot(typedIntent);
const simulatedIntent: SimulateResult<CounterDomain> = world.simulateIntent(typedIntent);
void world.createIntent(world.MEL.actions.add, { amount: 3 });

void world.dispatchAsync(typedIntent);

const rawIntent: Intent = {
  type: "increment",
  intentId: "raw-intent",
};

// @ts-expect-error dispatchAsync only accepts typed intents created for this domain
void world.dispatchAsync(rawIntent);
// @ts-expect-error simulateIntent only accepts typed intents created for this domain
void world.simulateIntent(rawIntent);

const foreign = createManifesto<ForeignDomain>(createForeignSchema(), {}).activate();
const foreignIntent = foreign.createIntent(foreign.MEL.actions.toggle);

// @ts-expect-error dispatchAsync rejects intents branded for a different domain
void world.dispatchAsync(foreignIntent);
// @ts-expect-error simulateIntent rejects intents branded for a different domain
void world.simulateIntent(foreignIntent);

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

void todo.createIntent(todo.MEL.actions.addTodo, {
  title: "Review docs",
  id: "todo-1",
});

// @ts-expect-error zero-parameter actions do not accept object binding
void todo.createIntent(todo.MEL.actions.clearCompleted, {});

const addTodoMetadata = todo.getActionMetadata("addTodo");
const addTodoName: "addTodo" = addTodoMetadata.name;
const addTodoParams: readonly string[] = addTodoMetadata.params;
const addTodoDescription: string | undefined = addTodoMetadata.description;
const addTodoHasDispatchableGate: boolean = addTodoMetadata.hasDispatchableGate;
const addTodoDispatchable: boolean = todo.isIntentDispatchable(
  todo.MEL.actions.addTodo,
  { title: "Review docs", id: "todo-1" },
);
const addTodoBlockers: readonly DispatchBlocker[] = todo.getIntentBlockers(
  todo.MEL.actions.addTodo,
  { title: "Review docs", id: "todo-1" },
);
const actionMetadata = todo.getActionMetadata();
const actionMetadataList: readonly {
  readonly name: keyof TodoDomain["actions"];
  readonly params: readonly string[];
  readonly description: string | undefined;
  readonly hasDispatchableGate: boolean;
}[] = actionMetadata;
void addTodoName;
void addTodoParams;
void addTodoDescription;
void addTodoHasDispatchableGate;
void addTodoDispatchable;
void addTodoBlockers;
void actionMetadataList;
void explanation;
void sameExplanation;
void blockersOrNull;
void simulatedIntent;

// @ts-expect-error getActionMetadata only accepts domain action names
void todo.getActionMetadata("missing");

export {};
