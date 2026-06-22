import type {
  ActionInfo,
  AdmissionFailure,
  BaseWriteReport,
  ExecutionOutcome,
  ManifestoApp,
} from "@manifesto-ai/sdk";
import type { TodoDomain } from "./domain/todo.domain";

export type { TodoDomain } from "./domain/todo.domain";

export type TodoApp = ManifestoApp<TodoDomain, "base">;
export type TodoState = TodoDomain["state"];
export type Todo = TodoState["todos"][number];
export type FilterMode = TodoState["filterMode"];
export type TodoComputed = TodoDomain["computed"];

export type TodoView = {
  readonly state: TodoState;
  readonly computed: TodoComputed;
  readonly availableActions: readonly ActionInfo[];
};

export type TodoWriteResponse =
  | {
      readonly status: "settled";
      readonly action: string;
      readonly outcome: Extract<ExecutionOutcome, { readonly kind: "ok" }>;
      readonly report: BaseWriteReport | null;
      readonly view: TodoView;
    }
  | {
      readonly status: "stop";
      readonly action: string;
      readonly outcome: Extract<ExecutionOutcome, { readonly kind: "stop" }>;
      readonly report: BaseWriteReport | null;
      readonly view: TodoView;
    }
  | {
      readonly status: "fail";
      readonly action: string;
      readonly outcome: Extract<ExecutionOutcome, { readonly kind: "fail" }>;
      readonly report: BaseWriteReport | null;
      readonly view: TodoView;
    }
  | {
      readonly status: "admission_blocked";
      readonly action: string;
      readonly admission: AdmissionFailure;
      readonly report: null;
      readonly view: TodoView;
    };

export type AgentLogTone = "neutral" | "read" | "ok" | "warn";

export type AgentLogEntry = {
  readonly id: number;
  readonly at: string;
  readonly label: string;
  readonly detail: string;
  readonly tone: AgentLogTone;
};
