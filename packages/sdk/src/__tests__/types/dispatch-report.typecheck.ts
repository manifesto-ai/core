import { createManifesto, type DispatchReport } from "../../index.ts";
import {
  createCounterSchema,
  type CounterDomain,
} from "../helpers/schema.ts";

const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
const reportPromise: Promise<DispatchReport<CounterDomain>> = world.dispatchAsyncWithReport(
  world.createIntent(world.MEL.actions.increment),
);

declare const report: DispatchReport<CounterDomain>;

if (report.kind === "completed") {
  const changedPaths: readonly string[] = report.outcome.projected.changedPaths;
  const status: typeof report.outcome.canonical.status = report.outcome.canonical.status;
  const locked: readonly (keyof CounterDomain["actions"])[] =
    report.outcome.projected.availability.locked;
  void changedPaths;
  void status;
  void locked;
}

if (report.kind === "rejected") {
  const reason: string = report.rejection.reason;
  const code: "ACTION_UNAVAILABLE" | "INTENT_NOT_DISPATCHABLE" | "INVALID_INPUT" =
    report.rejection.code;
  const beforeCount: number = report.beforeSnapshot.data.count;
  void reason;
  void code;
  void beforeCount;
}

if (report.kind === "failed") {
  const published: boolean = report.published;
  const stage: "host" | "seal" | undefined = report.error.stage;
  const traces = report.diagnostics?.hostTraces;
  void published;
  void stage;
  void traces;

  if (report.outcome) {
    const afterCount: number = report.outcome.projected.afterSnapshot.data.count;
    void afterCount;
  }
}

void reportPromise;

export {};
