import type {
  ActionHandle,
  ActionInput,
  Admission,
  BaseSubmissionResult,
  BoundAction,
  ComputedReadSurface,
  ComputedRef,
  ExecutionView,
  FieldRef,
  GovernanceSettlementResult,
  GovernanceSubmissionResult,
  LineageSubmissionResult,
  ManifestoApp,
  PreviewDiagnosticsMode,
  PreviewResult,
  ProjectedReadHandle,
  ProjectedSnapshot,
  StateReadSurface,
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

type OptionalSingleArgDomain = {
  actions: {
    maybeRename: (name?: string) => void;
  };
  state: {
    name: string;
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
declare const optionalSingleArgApp: ManifestoApp<OptionalSingleArgDomain, "base">;
declare const contextApp: ManifestoApp<ContextTypedDomain, "base">;

const handle: ActionHandle<CounterDomain, "add", "base"> = app.action.add;
const input: ActionInput<CounterDomain, "add"> = 1;
const bound: BoundAction<CounterDomain, "add", "base"> = handle.bind(input);
const objectBound = objectApp.action.toggleTodo.bind({ id: "todo-1" });
const objectInput: ToggleTodoInput = objectBound.input;
const scalarInput: string = objectApp.action.toggleTodoById.bind("todo-1").input;
const multiArgInput: readonly [string, boolean?] =
  multiArgApp.action.rename.bind("Ada", true).input;
const multiArgOptionalInput: readonly [string, boolean?] =
  multiArgApp.action.rename.bind("Ada").input;
const optionalSingleInput: string | undefined =
  optionalSingleArgApp.action.maybeRename.bind().input;
const optionalSingleInputWithValue: string | undefined =
  optionalSingleArgApp.action.maybeRename.bind("Ada").input;
const admission: Admission<"add"> = bound.check();
const previewMode: PreviewDiagnosticsMode = "summary";
const submitMode: SubmitReportMode = "summary";
const view: ExecutionView = { diagnostics: previewMode, report: submitMode };
const preview: PreviewResult<CounterDomain, "add"> = app.with(view).action.add.bind(input).preview();
const baseResult: Promise<BaseSubmissionResult<CounterDomain, "add">> =
  app.with(view).action.add.bind(input).submit();
const projected: ProjectedSnapshot<CounterDomain> = app.snapshot();
const stateSurface: StateReadSurface<CounterDomain> = app.state;
const computedSurface: ComputedReadSurface<CounterDomain> = app.computed;
const countHandle: ProjectedReadHandle<number, FieldRef<number>> = app.state.count;
const doubledHandle: ProjectedReadHandle<number, ComputedRef<number>> = app.computed.doubled;
const readCount: number = app.state.count.value();
const readDoubled: number = app.computed.doubled.value();
const unsubscribeCount = app.state.count.observe((next, prev) => {
  const nextCount: number = next;
  const prevCount: number = prev;
  void nextCount;
  void prevCount;
});
const unsubscribeDoubled = app.computed.doubled.observe((next, prev) => {
  const nextDoubled: number = next;
  const prevDoubled: number = prev;
  void nextDoubled;
  void prevDoubled;
});

declare const lineage: LineageSubmissionResult<CounterDomain, "add">;
declare const governance: GovernanceSubmissionResult<CounterDomain, "add">;
declare const settlement: GovernanceSettlementResult<CounterDomain, "add">;
declare const generic: SubmissionResult<CounterDomain, "add">;
declare const baseFor: SubmitResultFor<"base", CounterDomain, "add">;
declare const lineageFor: SubmitResultFor<"lineage", CounterDomain, "add">;
declare const governanceFor: SubmitResultFor<"governance", CounterDomain, "add">;
declare const unionModeFor: SubmitResultFor<"base" | "governance", CounterDomain, "add">;
declare const governedApp: ManifestoApp<CounterDomain, "governance">;

void admission;
void preview;
void baseResult;
void projected.state.count;
void stateSurface.count;
void computedSurface.doubled;
void countHandle.ref;
void doubledHandle.ref;
void readCount;
void readDoubled;
void unsubscribeCount;
void unsubscribeDoubled;
const computedDoubled: number = projected.computed.doubled;
void computedDoubled;
void objectInput;
void scalarInput;
void multiArgInput;
void multiArgOptionalInput;
void optionalSingleInput;
void optionalSingleInputWithValue;
void objectApp.action.toggleTodo.submit({ id: "todo-1" });
void objectApp.action.toggleTodoById.submit("todo-1");
void optionalSingleArgApp.action.maybeRename.submit();
void optionalSingleArgApp.action.maybeRename.submit("Ada");
void lineage;
void governance;
void settlement;
void generic;
void baseFor.mode;
void lineageFor.mode;
void governanceFor.mode;
// @ts-expect-error SubmitResultFor<"base" | "governance"> excludes lineage results.
if (unionModeFor.mode === "lineage") {
  void unionModeFor;
}
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
void contextView.action.stamp.preview();
void contextView.action.stamp.submit();
void createManifesto<ContextTypedDomain>(createCounterSchema(), {}, {
  context: { tenantId: "acme", locale: "ko-KR" },
});

// @ts-expect-error waitForSettlement is governance-mode only
app.waitForSettlement("proposal-1");
createManifesto<ContextTypedDomain>(createCounterSchema(), {}, {
  // @ts-expect-error createManifesto context must match the domain context type
  context: { tenantId: "acme" },
});
// @ts-expect-error projected computed fields keep their domain type
const computedDoubledString: string = projected.computed.doubled;
// @ts-expect-error optional single-argument action input is scalar or undefined, not a tuple
const optionalSingleTuple: ActionInput<OptionalSingleArgDomain, "maybeRename"> = ["Ada"];
// @ts-expect-error read handles are read-only and expose no set verb
app.state.count.set(1);
// @ts-expect-error read handles are not action candidates
app.state.count.submit();
// @ts-expect-error computed read handles cannot propose semantic writes
app.computed.doubled.propose();
// @ts-expect-error canonical namespaces are not projected state read handles
app.state.namespaces;
// @ts-expect-error transient input is not a projected computed read handle
app.computed.input;
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
objectApp.action.toggleTodo.submit("todo-1");
// @ts-expect-error scalar single param remains positional and does not accept named object sugar
objectApp.action.toggleTodoById.submit({ id: "todo-1" });

export {};
