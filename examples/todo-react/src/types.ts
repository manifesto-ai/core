import type { TodoDomain } from "./domain/todo.domain";

export type { TodoDomain } from "./domain/todo.domain";

export type TodoState = TodoDomain["state"];
export type Todo = TodoState["todos"][number];
export type FilterMode = TodoState["filterMode"];
export type TodoComputed = TodoDomain["computed"];
