import type {
  ActionHandle,
  ActionInput,
  Admission,
  BaseSubmissionResult,
  BoundAction,
  GovernanceSettlementResult,
  GovernanceSubmissionResult,
  LineageSubmissionResult,
  ManifestoApp,
  PreviewOptions,
  PreviewResult,
  ProjectedSnapshot,
  SubmissionResult,
  SubmitOptions,
  SubmitResultFor,
} from "../../index.ts";
import { createManifesto } from "../../index.ts";
import { createCounterSchema, type CounterDomain } from "../helpers/schema.ts";

const app: ManifestoApp<CounterDomain, "base"> =
  createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

const handle: ActionHandle<CounterDomain, "add", "base"> = app.actions.add;
const input: ActionInput<CounterDomain, "add"> = 1;
const bound: BoundAction<CounterDomain, "add", "base"> = handle.bind(input);
const admission: Admission<"add"> = bound.check();
const previewOptions: PreviewOptions = { __kind: "PreviewOptions", diagnostics: "summary" };
const preview: PreviewResult<CounterDomain, "add"> = bound.preview(previewOptions);
const submitOptions: SubmitOptions = { __kind: "SubmitOptions", report: "summary" };
const baseResult: Promise<BaseSubmissionResult<CounterDomain, "add">> =
  bound.submit(submitOptions);
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
void lineage;
void governance;
void settlement;
void generic;
void baseFor.mode;
void lineageFor.mode;
void governanceFor.mode;
void governedApp.waitForSettlement("proposal-1");

// @ts-expect-error waitForSettlement is governance-mode only
app.waitForSettlement("proposal-1");

export {};
