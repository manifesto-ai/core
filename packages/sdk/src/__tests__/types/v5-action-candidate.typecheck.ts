import type {
  ActionHandle,
  ActionInput,
  Admission,
  BaseSubmissionResult,
  BoundAction,
  ExecutionView,
  GovernanceSettlementResult,
  GovernanceSubmissionResult,
  LineageSubmissionResult,
  ManifestoApp,
  PreviewDiagnosticsMode,
  PreviewResult,
  ProjectedSnapshot,
  SubmissionResult,
  SubmitReportMode,
  SubmitResultFor,
} from "../../index.ts";
import { createManifesto } from "../../index.ts";
import { createCounterSchema, type CounterDomain } from "../helpers/schema.ts";

type ToggleTodoInput = {
  readonly id: string;
};

type ObjectInputDomain = {
  actions: {
    toggleTodo: (input: ToggleTodoInput) => void;
    toggleTodoById: (id: string) => void;
  };
  state: {
    selectedId: string;
  };
  computed: {};
};

type MultiArgDomain = {
  actions: {
    rename: (name: string, force?: boolean) => void;
  };
  state: {
    name: string;
    force: boolean;
  };
  computed: {};
};

type ContextTypedDomain = {
  actions: {
    stamp: () => void;
  };
  state: {
    locale: string;
  };
  computed: {};
  context: {
    tenantId: string;
    locale: string;
  };
};

const app: ManifestoApp<CounterDomain, "base"> =
  createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
declare const objectApp: ManifestoApp<ObjectInputDomain, "base">;
declare const multiArgApp: ManifestoApp<MultiArgDomain, "base">;
declare const contextApp: ManifestoApp<ContextTypedDomain, "base">;

const handle: ActionHandle<CounterDomain, "add", "base"> = app.actions.add;
const input: ActionInput<CounterDomain, "add"> = 1;
const bound: BoundAction<CounterDomain, "add", "base"> = handle.bind(input);
const objectBound = objectApp.actions.toggleTodo.bind({ id: "todo-1" });
const objectInput: ToggleTodoInput = objectBound.input;
const scalarInput: string = objectApp.actions.toggleTodoById.bind("todo-1").input;
const multiArgInput: readonly [string, boolean?] =
  multiArgApp.actions.rename.bind("Ada", true).input;
const admission: Admission<"add"> = bound.check();
const previewMode: PreviewDiagnosticsMode = "summary";
const submitMode: SubmitReportMode = "summary";
const view: ExecutionView = { diagnostics: previewMode, report: submitMode };
const preview: PreviewResult<CounterDomain, "add"> = app.with(view).actions.add.bind(input).preview();
const baseResult: Promise<BaseSubmissionResult<CounterDomain, "add">> =
  app.with(view).actions.add.bind(input).submit();
const projected: ProjectedSnapshot<CounterDomain> = app.snapshot();

declare const lineage: LineageSubmissionResult<CounterDomain, "add">;
declare const governance: GovernanceSubmissionResult<CounterDomain, "add">;
declare const settlement: GovernanceSettlementResult<CounterDomain, "add">;
declare const generic: SubmissionResult<CounterDomain, "add">;
declare const baseFor: SubmitResultFor<"base", CounterDomain, "add">;
declare const lineageFor: SubmitResultFor<"lineage", CounterDomain, "add">;
declare const governanceFor: SubmitResultFor<"governance", CounterDomain, "add">;
declare const governedApp: ManifestoApp<CounterDomain, "governance">;

void admission;
void preview;
void baseResult;
void projected.state.count;
void objectInput;
void scalarInput;
void multiArgInput;
void objectApp.actions.toggleTodo.submit({ id: "todo-1" });
void objectApp.actions.toggleTodoById.submit("todo-1");
void lineage;
void governance;
void settlement;
void generic;
void baseFor.mode;
void lineageFor.mode;
void governanceFor.mode;
void governedApp.waitForSettlement("proposal-1");
const currentContext = contextApp.context();
const typedLocale: string = currentContext.locale;
contextApp.injectContext({ tenantId: "acme", locale: "ko-KR" });
const updatedContext = contextApp.updateContext((current) => ({
  ...current,
  locale: "en-US",
}));
const contextView = contextApp.with({
  context: { tenantId: "acme", locale: "ja-JP" },
});
void typedLocale;
void updatedContext.tenantId;
void contextView.context().tenantId;
void contextView.actions.stamp.preview();
void contextView.actions.stamp.submit();
void createManifesto<ContextTypedDomain>(createCounterSchema(), {}, {
  context: { tenantId: "acme", locale: "ko-KR" },
});

// @ts-expect-error waitForSettlement is governance-mode only
app.waitForSettlement("proposal-1");
createManifesto<ContextTypedDomain>(createCounterSchema(), {}, {
  // @ts-expect-error createManifesto context must match the domain context type
  context: { tenantId: "acme" },
});
// @ts-expect-error injectContext requires a full replacement
contextApp.injectContext({ locale: "ko-KR" });
contextApp.with({
  // @ts-expect-error with context requires the domain context type
  context: { tenantId: "acme" },
});
// @ts-expect-error bound preview does not accept option bags
bound.preview({ diagnostics: "summary" });
// @ts-expect-error bound submit does not accept option bags
bound.submit({ report: "summary" });
// @ts-expect-error object-valued single param requires the declared object value
objectApp.actions.toggleTodo.submit("todo-1");
// @ts-expect-error scalar single param remains positional and does not accept named object sugar
objectApp.actions.toggleTodoById.submit({ id: "todo-1" });

export {};
