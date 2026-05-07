import type {
  ErrorValue,
  Intent,
  Requirement,
} from "@manifesto-ai/core";
import {
  DisposedError,
  ManifestoError,
  SubmissionFailedError,
  type ActionArgs,
  type ActionHandle,
  type ActionInfo,
  type ActionInput,
  type ActionName,
  type ActionSurface,
  type Admission,
  type AdmissionFailure,
  type AdmissionOk,
  type Blocker,
  type BoundAction,
  type CanonicalSnapshot,
  type ChangedPath,
  type ComputedReadSurface,
  type ComputedRef,
  type DispatchBlocker,
  type DispatchExecutionOutcome,
  type ExecutionDiagnostics,
  type ExecutionOutcome,
  type ExecutionView,
  type FieldRef,
  type LineageSubmissionResult,
  type LineageWriteReport,
  type ManifestoDomainShape,
  type ObserveSurface,
  type PreviewDiagnosticsMode,
  type PreviewResult,
  type ProjectedReadHandle,
  type ProjectedSnapshot,
  type StateReadSurface,
  type SubmitReportMode,
  type TypedActionMetadata,
  type TypedActionRef,
  type TypedIntent,
  type Unsubscribe,
  type WorldRecord,
} from "@manifesto-ai/sdk";
import {
  attachExtensionKernel,
  type LineageRuntimeKernel,
} from "@manifesto-ai/sdk/provider";

import {
  createLineageRuntimeController,
  toLineageSealRuntimeFailure,
  type ResolvedLineageConfig,
} from "./internal.js";
import {
  cloneAndFreezeActionPayload,
  tryCloneAndFreezeActionPayload,
} from "./action-payload.js";
import type { LineageInstance } from "./runtime-types.js";

type Candidate<
  T extends ManifestoDomainShape,
  Name extends ActionName<T>,
> = {
  readonly actionName: Name;
  readonly input: ActionInput<T, Name>;
  readonly intent: TypedIntent<T, Name> | null;
  readonly inputError: ManifestoError | null;
};

type RuntimeExecutionView<T extends ManifestoDomainShape> = {
  readonly context?: ReturnType<LineageRuntimeKernel<T>["getExternalContext"]>;
  readonly diagnostics?: PreviewDiagnosticsMode;
  readonly report?: SubmitReportMode;
};

export function createLineageRuntimeInstance<T extends ManifestoDomainShape>(
  kernel: LineageRuntimeKernel<T>,
  service: ResolvedLineageConfig["service"],
  config: ResolvedLineageConfig,
  view: RuntimeExecutionView<T> = {},
  isView = false,
): LineageInstance<T> {
  let runtimeView = freezeRuntimeView(view);
  const controller = createLineageRuntimeController(kernel, service, config);
  const actionInfoByName = new Map<ActionName<T>, ActionInfo<ActionName<T>>>();

  for (const metadata of kernel.getActionMetadata()) {
    actionInfoByName.set(
      metadata.name as ActionName<T>,
      toActionInfo(metadata as TypedActionMetadata<T, ActionName<T>>),
    );
  }

  const action = Object.create(null) as ActionSurface<T, "lineage">;
  for (const name of actionInfoByName.keys()) {
    const handle = createActionHandle(name);
    Object.defineProperty(action, name, {
      enumerable: true,
      configurable: false,
      writable: false,
      value: handle,
    });
  }

  function observeState<S>(
    selector: (snapshot: ProjectedSnapshot<T>) => S,
    listener: (next: S, prev: S) => void,
  ): Unsubscribe {
    if (kernel.isDisposed()) {
      return () => {};
    }

    let previous: S;
    try {
      previous = selector(kernel.getSnapshot());
    } catch {
      previous = undefined as S;
    }

    return kernel.subscribe(selector, (next) => {
      const prev = previous;
      previous = next;
      listener(next, prev);
    });
  }

  const observe: ObserveSurface<T> = Object.freeze({
    state: observeState,
    event(event, listener) {
      if (kernel.isDisposed()) {
        return () => {};
      }
      return kernel.on(event, listener);
    },
  });

  const runtime = {
    action: Object.freeze(action),
    state: createStateReadSurface(),
    computed: createComputedReadSurface(),
    observe,
    inspect: Object.freeze({
      graph: kernel.getSchemaGraph,
      canonicalSnapshot: kernel.getCanonicalSnapshot,
      action<Name extends ActionName<T>>(name: Name): ActionInfo<Name> {
        return getActionInfo(name);
      },
      availableActions(): readonly ActionInfo<ActionName<T>>[] {
        return Object.freeze(
          kernel.getAvailableActions()
            .map((name) => getActionInfo(name as ActionName<T>)),
        );
      },
      schemaHash(): string {
        return kernel.getCanonicalSnapshot().meta.schemaHash;
      },
    }),
    snapshot: kernel.getSnapshot,
    context: getViewExternalContext,
    injectContext(context) {
      if (isView) {
        runtimeView = freezeRuntimeView({
          ...runtimeView,
          context: kernel.captureExternalContext(context),
        });
        return;
      }
      kernel.replaceExternalContext(context);
    },
    updateContext(updater) {
      if (!isView) {
        return kernel.updateExternalContext(updater);
      }
      const next = updater(getViewExternalContext());
      runtimeView = freezeRuntimeView({
        ...runtimeView,
        context: kernel.captureExternalContext(next),
      });
      return runtimeView.context ?? kernel.getExternalContext();
    },
    with(nextView) {
      return createLineageRuntimeInstance(
        kernel,
        service,
        config,
        mergeRuntimeView(nextView),
        true,
      );
    },
    dispose: kernel.dispose,
    restore: controller.restore,
    getWorld: controller.getWorld,
    getWorldSnapshot: controller.getWorldSnapshot,
    getLineage: controller.getLineage,
    getLatestHead: controller.getLatestHead,
    getHeads: controller.getHeads,
    getBranches: controller.getBranches,
    getActiveBranch: controller.getActiveBranch,
    switchActiveBranch: controller.switchActiveBranch,
    createBranch: controller.createBranch,
  } satisfies LineageInstance<T>;

  return Object.freeze(attachExtensionKernel(runtime, kernel));

  function createReadHandle<TValue, TRef>(
    name: string,
    ref: TRef,
    select: (snapshot: ProjectedSnapshot<T>) => TValue,
  ): ProjectedReadHandle<TValue, TRef> {
    return Object.freeze({
      name,
      ref,
      value: () => select(kernel.getSnapshot()),
      observe: (listener) => observeState(select, listener),
    });
  }

  function createStateReadSurface(): StateReadSurface<T> {
    const surface: Record<PropertyKey, unknown> = Object.create(null);
    for (const name of Object.keys(kernel.MEL.state) as Array<keyof T["state"] & string>) {
      const ref = kernel.MEL.state[name] as FieldRef<T["state"][typeof name]>;
      Object.defineProperty(surface, name, {
        enumerable: true,
        configurable: false,
        writable: false,
        value: createReadHandle(
          name,
          ref,
          (snapshot) => snapshot.state[name],
        ),
      });
    }

    return Object.freeze(surface) as StateReadSurface<T>;
  }

  function createComputedReadSurface(): ComputedReadSurface<T> {
    const surface: Record<PropertyKey, unknown> = Object.create(null);
    for (const name of Object.keys(kernel.MEL.computed) as Array<keyof T["computed"] & string>) {
      const ref = kernel.MEL.computed[name] as ComputedRef<T["computed"][typeof name]>;
      Object.defineProperty(surface, name, {
        enumerable: true,
        configurable: false,
        writable: false,
        value: createReadHandle(
          name,
          ref,
          (snapshot) => snapshot.computed[name],
        ),
      });
    }

    return Object.freeze(surface) as ComputedReadSurface<T>;
  }

  function createActionHandle<Name extends ActionName<T>>(
    name: Name,
  ): ActionHandle<T, Name, "lineage"> {
    return Object.freeze({
      info: () => getActionInfo(name),
      available: () => kernel.isActionAvailable(name),
      check: (...args: ActionArgs<T, Name>) => {
        const candidate = createCandidate(name, args);
        return checkCandidate(candidate);
      },
      preview: (...args: ActionArgs<T, Name>) => {
        const candidate = createCandidate(name, args);
        return previewCandidate(candidate);
      },
      submit: (...args: ActionArgs<T, Name>) => {
        const candidate = createCandidate(name, args);
        return submitCandidate(candidate);
      },
      bind: (...args: ActionArgs<T, Name>) => createBoundAction(name, args),
    });
  }

  function createBoundAction<Name extends ActionName<T>>(
    name: Name,
    args: ActionArgs<T, Name>,
  ): BoundAction<T, Name, "lineage"> {
    const candidate = createCandidate(name, args);
    const stableArgs = tryCloneAndFreezeActionPayload<readonly unknown[]>([...args]);
    const createFreshCandidate = (): Candidate<T, Name> => stableArgs.ok
      ? createCandidate(name, stableArgs.value as ActionArgs<T, Name>)
      : candidate;
    return Object.freeze({
      action: name,
      input: candidate.input,
      check: () => checkCandidate(createFreshCandidate()),
      preview: () => previewCandidate(createFreshCandidate()),
      submit: () => submitCandidate(createFreshCandidate()),
      intent: () => {
        const fresh = createFreshCandidate();
        return fresh.inputError ? null : fresh.intent as Intent | null;
      },
    });
  }

  function createCandidate<Name extends ActionName<T>>(
    name: Name,
    args: ActionArgs<T, Name>,
  ): Candidate<T, Name> {
    const actionRef = kernel.MEL.actions[name] as TypedActionRef<T, Name>;
    const publicInput = toPublicInput<Name>(name, args);
    const stableInput = tryCloneAndFreezeActionPayload<ActionInput<T, Name>>(publicInput);
    if (!stableInput.ok) {
      return Object.freeze({
        actionName: name,
        input: undefined as ActionInput<T, Name>,
        intent: null,
        inputError: stableInput.error,
      });
    }

    try {
      const intent = cloneAndFreezeActionPayload(kernel.createIntent(actionRef, ...args));
      const inputError = kernel.validateIntentInputFor(
        kernel.getCanonicalSnapshot(),
        intent,
      );
      return Object.freeze({
        actionName: name,
        input: stableInput.value,
        intent,
        inputError,
      });
    } catch (error) {
      if (!(error instanceof ManifestoError)) {
        throw error;
      }

      return Object.freeze({
        actionName: name,
        input: stableInput.value,
        intent: null,
        inputError: error,
      });
    }
  }

  function toPublicInput<Name extends ActionName<T>>(
    name: Name,
    args: readonly unknown[],
  ): ActionInput<T, Name> {
    if (args.length === 0) {
      return undefined as ActionInput<T, Name>;
    }

    const metadata = kernel.getActionMetadata(name);
    if (metadata.publicArity > 1) {
      return Object.freeze([...args]) as ActionInput<T, Name>;
    }

    if (args.length === 1) {
      return args[0] as ActionInput<T, Name>;
    }

    return Object.freeze([...args]) as ActionInput<T, Name>;
  }

  function checkCandidate<Name extends ActionName<T>>(
    candidate: Candidate<T, Name>,
  ): Admission<Name> {
    return admitCandidate(candidate, kernel.getCanonicalSnapshot()).admission;
  }

  function previewCandidate<Name extends ActionName<T>>(
    candidate: Candidate<T, Name>,
  ): PreviewResult<T, Name> {
    const beforeCanonical = kernel.getCanonicalSnapshot();
    const admission = admitCandidate(candidate, beforeCanonical);
    if (!admission.admission.ok || admission.intent === null) {
      return Object.freeze({
        admitted: false,
        admission: admission.admission as AdmissionFailure<Name>,
      }) as PreviewResult<T, Name>;
    }

    const intent = admission.intent;
    const context = kernel.createComputeContext(intent, captureViewExternalContext());
    const simulated = kernel.simulateSync(beforeCanonical, intent, {
      context,
    });
    const outcome = kernel.deriveExecutionOutcome(beforeCanonical, simulated.snapshot);

    return Object.freeze({
      admitted: true,
      status: simulated.status,
      before: outcome.projected.beforeSnapshot,
      after: outcome.projected.afterSnapshot,
      changes: outcome.projected.changedPaths,
      requirements: simulated.requirements,
      newAvailableActions: kernel.getAvailableActionsFor(simulated.snapshot)
        .map((name) => getActionInfo(name as ActionName<T>)),
      ...previewDiagnostics(simulated.diagnostics, runtimeView.diagnostics),
      error: simulated.snapshot.system.lastError,
    }) as PreviewResult<T, Name>;
  }

  async function submitCandidate<Name extends ActionName<T>>(
    candidate: Candidate<T, Name>,
  ): Promise<LineageSubmissionResult<T, Name>> {
    if (kernel.isDisposed()) {
      throw new DisposedError();
    }
    const context = candidate.intent
      ? kernel.createComputeContext(candidate.intent, captureViewExternalContext())
      : null;

    return kernel.enqueue(async () => {
      if (kernel.isDisposed()) {
        throw new DisposedError();
      }

      await controller.ensureReady();

      if (kernel.isDisposed()) {
        throw new DisposedError();
      }

      const beforeCanonical = kernel.getCanonicalSnapshot();
      const admission = admitCandidate(candidate, beforeCanonical);
      if (!admission.admission.ok || admission.intent === null) {
        const rejectedAdmission = admission.admission as AdmissionFailure<Name>;
        emitSubmissionRejected(candidate.actionName, candidate.intent, rejectedAdmission, beforeCanonical);
        return Object.freeze({
          ok: false,
          mode: "lineage",
          action: candidate.actionName,
          admission: rejectedAdmission,
        }) as LineageSubmissionResult<T, Name>;
      }

      const admittedIntent = admission.intent;
      emitSubmissionAdmitted(candidate.actionName, admittedIntent, admission.admission, beforeCanonical);
      emitSubmissionSubmitted(candidate.actionName, admittedIntent, beforeCanonical);

      let sealed;
      try {
        sealed = await controller.sealIntent(admittedIntent, {
          publishOnCompleted: true,
          assumeEnqueued: true,
          rejectPendingBeforeSeal: true,
          context: context ?? kernel.createComputeContext(admittedIntent, captureViewExternalContext()),
        });
      } catch (error) {
        const failure = toError(error);
        const runtimeFailure = toLineageSealRuntimeFailure<T>(failure);
        const stage = runtimeFailure?.stage === "seal" ? "settlement" : "runtime";
        const failedSnapshot = kernel.getCanonicalSnapshot();
        const errorValue = toErrorValue(failure, admittedIntent, failedSnapshot);
        emitSubmissionFailed(candidate.actionName, admittedIntent, errorValue, failedSnapshot, stage);
        throw new SubmissionFailedError(failure.message, stage, { cause: failure });
      }

      const afterCanonical = sealed.hostResult.snapshot as CanonicalSnapshot<T["state"]>;
      const diagnostics = kernel.createExecutionDiagnostics(sealed.hostResult);
      const dispatchOutcome = kernel.deriveExecutionOutcome(beforeCanonical, afterCanonical);

      if (dispatchOutcome.canonical.status === "pending") {
        const error = toErrorValue(
          new Error("Lineage submit produced a pending runtime snapshot"),
          sealed.intent,
          afterCanonical,
        );
        emitSubmissionFailed(candidate.actionName, sealed.intent, error, afterCanonical, "runtime");
        throw new SubmissionFailedError(error.message, "runtime");
      }

      const outcome = toExecutionOutcome(dispatchOutcome, sealed.intent, diagnostics);
      const headAdvanced = sealed.preparedCommit.branchChange.headAdvanced;
      const published = sealed.publishedSnapshot !== undefined;
      emitSubmissionSettled(
        candidate.actionName,
        sealed.intent,
        outcome,
        afterCanonical,
        sealed.preparedCommit.worldId,
      );

      return Object.freeze({
        ok: true,
        mode: "lineage",
        status: "settled",
        action: candidate.actionName,
        before: dispatchOutcome.projected.beforeSnapshot,
        after: dispatchOutcome.projected.afterSnapshot,
        world: Object.freeze({ ...sealed.preparedCommit.world }) as WorldRecord,
        outcome,
        ...(runtimeView.report !== "none"
          ? {
            report: createLineageReport(
              runtimeView.report,
              candidate.actionName,
              sealed.preparedCommit.worldId,
              sealed.preparedCommit.branchId,
              headAdvanced,
              published,
              outcome,
              sealed.preparedCommit.world.snapshotHash,
              dispatchOutcome.projected.changedPaths,
              dispatchOutcome.canonical.pendingRequirements,
              diagnostics,
            ),
          }
          : {}),
      }) as LineageSubmissionResult<T, Name>;
    });
  }

  function getViewExternalContext(): ReturnType<LineageRuntimeKernel<T>["getExternalContext"]> {
    return runtimeView.context ?? kernel.getExternalContext();
  }

  function captureViewExternalContext(): ReturnType<LineageRuntimeKernel<T>["getExternalContext"]> {
    return runtimeView.context ?? kernel.captureExternalContext();
  }

  function mergeRuntimeView(
    nextView: ExecutionView<ReturnType<LineageRuntimeKernel<T>["getExternalContext"]>>,
  ): RuntimeExecutionView<T> {
    return freezeRuntimeView({
      ...runtimeView,
      ...(nextView.context !== undefined
        ? { context: kernel.captureExternalContext(nextView.context) }
        : {}),
      ...(nextView.diagnostics !== undefined ? { diagnostics: nextView.diagnostics } : {}),
      ...(nextView.report !== undefined ? { report: nextView.report } : {}),
    });
  }

  function admitCandidate<Name extends ActionName<T>>(
    candidate: Candidate<T, Name>,
    snapshot: CanonicalSnapshot<T["state"]>,
  ): {
    readonly admission: AdmissionOk<Name>;
    readonly intent: TypedIntent<T, Name>;
  } | {
    readonly admission: AdmissionFailure<Name>;
    readonly intent: null;
  } {
    if (!kernel.isActionAvailableFor(snapshot, candidate.actionName)) {
      return {
        admission: Object.freeze({
          ok: false,
          action: candidate.actionName,
          layer: "availability",
          code: "ACTION_UNAVAILABLE",
          message: `Action "${candidate.actionName}" is unavailable against the current visible snapshot`,
          blockers: getAvailabilityBlockers(candidate, snapshot),
        }) as AdmissionFailure<Name>,
        intent: null,
      };
    }

    if (candidate.inputError || !candidate.intent) {
      return {
        admission: Object.freeze({
          ok: false,
          action: candidate.actionName,
          layer: "input",
          code: "INVALID_INPUT",
          message: candidate.inputError?.message ?? "Invalid action input",
          blockers: Object.freeze([]),
        }) as AdmissionFailure<Name>,
        intent: null,
      };
    }

    const legality = kernel.evaluateIntentLegalityFor(snapshot, candidate.intent);
    if (legality.kind === "admitted") {
      return {
        admission: Object.freeze({
          ok: true,
          action: candidate.actionName,
        }),
        intent: legality.intent as TypedIntent<T, Name>,
      };
    }

    const legacyAdmission = kernel.deriveIntentAdmission(snapshot, legality);
    return {
      admission: mapBlockedAdmission(
        candidate.actionName,
        legacyAdmission as Extract<typeof legacyAdmission, { readonly kind: "blocked" }>,
      ),
      intent: null,
    };
  }

  function mapBlockedAdmission<Name extends ActionName<T>>(
    actionName: Name,
    admission: { readonly failure: { readonly kind: string } },
    fallbackMessage?: string,
  ): AdmissionFailure<Name> {
    if (admission.failure.kind === "invalid_input") {
      const failure = admission.failure as unknown as {
        readonly error: { readonly message: string };
      };
      return Object.freeze({
        ok: false,
        action: actionName,
        layer: "input",
        code: "INVALID_INPUT",
        message: failure.error.message,
        blockers: Object.freeze([]),
      }) as AdmissionFailure<Name>;
    }

    if (admission.failure.kind === "not_dispatchable") {
      const failure = admission.failure as unknown as {
        readonly blockers: readonly DispatchBlocker[];
      };
      return Object.freeze({
        ok: false,
        action: actionName,
        layer: "dispatchability",
        code: "INTENT_NOT_DISPATCHABLE",
        message: fallbackMessage
          ?? `Action "${actionName}" is not dispatchable against the current visible snapshot`,
        blockers: failure.blockers.map((blocker) => toBlocker(blocker, "INTENT_NOT_DISPATCHABLE")),
      }) as AdmissionFailure<Name>;
    }

    const failure = admission.failure as unknown as {
      readonly blockers?: readonly DispatchBlocker[];
    };
    return Object.freeze({
      ok: false,
      action: actionName,
      layer: "availability",
      code: "ACTION_UNAVAILABLE",
      message: fallbackMessage
        ?? `Action "${actionName}" is unavailable against the current visible snapshot`,
      blockers: (failure.blockers ?? []).map((blocker) => toBlocker(blocker, "ACTION_UNAVAILABLE")),
    }) as AdmissionFailure<Name>;
  }

  function getAvailabilityBlockers<Name extends ActionName<T>>(
    candidate: Candidate<T, Name>,
    snapshot: CanonicalSnapshot<T["state"]>,
  ): readonly Blocker[] {
    if (!candidate.intent) {
      return Object.freeze([]);
    }

    const legality = kernel.evaluateIntentLegalityFor(snapshot, candidate.intent);
    const admission = kernel.deriveIntentAdmission(snapshot, legality);
    if (admission.kind !== "blocked" || admission.failure.kind !== "unavailable") {
      return Object.freeze([]);
    }

    return mapBlockedAdmission(candidate.actionName, admission).blockers;
  }

  function getActionInfo<Name extends ActionName<T>>(name: Name): ActionInfo<Name> {
    const info = actionInfoByName.get(name);
    if (!info) {
      throw new ManifestoError(
        "UNKNOWN_ACTION",
        `Action "${String(name)}" is not declared by this Manifesto schema`,
      );
    }
    return info as ActionInfo<Name>;
  }

  function emitSubmissionAdmitted<Name extends ActionName<T>>(
    actionName: Name,
    intent: TypedIntent<T>,
    admission: Extract<Admission<Name>, { readonly ok: true }>,
    snapshot: CanonicalSnapshot<T["state"]>,
  ): void {
    kernel.emitEvent("submission:admitted", {
      ...eventBase(actionName, intent, snapshot),
      admission,
    });
  }

  function emitSubmissionRejected<Name extends ActionName<T>>(
    actionName: Name,
    intent: TypedIntent<T> | null,
    admission: AdmissionFailure<Name>,
    snapshot: CanonicalSnapshot<T["state"]>,
  ): void {
    kernel.emitEvent("submission:rejected", {
      ...eventBase(actionName, intent, snapshot),
      admission,
    });
  }

  function emitSubmissionSubmitted<Name extends ActionName<T>>(
    actionName: Name,
    intent: TypedIntent<T>,
    snapshot: CanonicalSnapshot<T["state"]>,
  ): void {
    kernel.emitEvent("submission:submitted", eventBase(actionName, intent, snapshot));
  }

  function emitSubmissionSettled<Name extends ActionName<T>>(
    actionName: Name,
    intent: TypedIntent<T>,
    outcome: ExecutionOutcome,
    snapshot: CanonicalSnapshot<T["state"]>,
    worldId: string,
  ): void {
    kernel.emitEvent("submission:settled", {
      ...eventBase(actionName, intent, snapshot),
      outcome,
      worldId,
    });
  }

  function emitSubmissionFailed<Name extends ActionName<T>>(
    actionName: Name,
    intent: TypedIntent<T>,
    error: ErrorValue,
    snapshot: CanonicalSnapshot<T["state"]>,
    stage: "runtime" | "settlement",
  ): void {
    kernel.emitEvent("submission:failed", {
      ...eventBase(actionName, intent, snapshot),
      stage,
      error,
    });
  }

  function eventBase<Name extends ActionName<T>>(
    actionName: Name,
    intent: TypedIntent<T> | null,
    snapshot: CanonicalSnapshot<T["state"]>,
  ) {
    return {
      action: actionName,
      mode: "lineage" as const,
      ...(intent?.intentId ? { intentId: intent.intentId } : {}),
      schemaHash: snapshot.meta.schemaHash,
      snapshotVersion: snapshot.meta.version,
    };
  }
}

function previewDiagnostics(
  diagnostics: { readonly trace?: unknown } | undefined,
  mode: PreviewDiagnosticsMode | undefined,
) {
  if (!diagnostics || mode === "none") {
    return {};
  }

  if (mode === "summary") {
    return { diagnostics: {} };
  }

  return { diagnostics: { trace: diagnostics.trace } };
}

function freezeRuntimeView<T extends ManifestoDomainShape>(
  view: RuntimeExecutionView<T>,
): RuntimeExecutionView<T> {
  return Object.freeze({ ...view });
}

function toActionInfo<
  T extends ManifestoDomainShape,
  Name extends ActionName<T>,
>(
  metadata: TypedActionMetadata<T, Name>,
): ActionInfo<Name> {
  const inputFields = metadata.input?.type === "object"
    ? metadata.input.fields ?? {}
    : {};
  const parameterNames = metadata.params.length > 0
    ? metadata.params
    : Object.keys(inputFields);
  const annotations = metadata.annotations;
  const title = typeof annotations?.title === "string"
    ? annotations.title
    : undefined;

  return Object.freeze({
    name: metadata.name,
    ...(title !== undefined ? { title } : {}),
    ...(metadata.description !== undefined ? { description: metadata.description } : {}),
    parameters: Object.freeze(parameterNames.map((name) => {
      const field = inputFields[name];
      return Object.freeze({
        name,
        required: field?.required ?? true,
        ...(field?.type !== undefined ? { type: fieldTypeToString(field.type) } : {}),
        ...(field?.description !== undefined ? { description: field.description } : {}),
      });
    })),
    ...(annotations !== undefined ? { annotations } : {}),
  }) as ActionInfo<Name>;
}

function fieldTypeToString(type: unknown): string {
  if (typeof type === "string") {
    return type;
  }
  if (typeof type === "object" && type !== null && "enum" in type) {
    return "enum";
  }
  return "unknown";
}

function toBlocker(blocker: DispatchBlocker, code: Blocker["code"]): Blocker {
  return Object.freeze({
    path: Object.freeze([]),
    code,
    message: blocker.description ?? code,
    detail: Object.freeze({
      layer: blocker.layer,
      expression: blocker.expression,
    }),
  });
}

function createLineageReport(
  reportMode: SubmitReportMode | undefined,
  action: string,
  worldId: string,
  branchId: string,
  headAdvanced: boolean,
  published: boolean,
  outcome: ExecutionOutcome,
  sealedSnapshotHash: string,
  changes: readonly ChangedPath[],
  requirements: readonly Requirement[],
  diagnostics: ExecutionDiagnostics,
): LineageWriteReport {
  return Object.freeze({
    mode: "lineage",
    action,
    worldId,
    branchId,
    headAdvanced,
    published,
    outcome,
    sealedSnapshotHash,
    changes,
    requirements,
    ...(reportMode === "full" ? { diagnostics } : {}),
  });
}

function toExecutionOutcome<T extends ManifestoDomainShape>(
  dispatchOutcome: DispatchExecutionOutcome<T>,
  intent: TypedIntent<T>,
  diagnostics?: ExecutionDiagnostics,
): ExecutionOutcome {
  const haltReason = findHaltReason(diagnostics);
  if (haltReason !== null) {
    return Object.freeze({
      kind: "stop",
      reason: haltReason,
    }) as ExecutionOutcome;
  }

  const after = dispatchOutcome.canonical.afterCanonicalSnapshot;
  if (after.system.lastError) {
    return Object.freeze({
      kind: "fail",
      error: after.system.lastError,
    }) as ExecutionOutcome;
  }

  if (dispatchOutcome.canonical.status === "error") {
    return Object.freeze({
      kind: "fail",
      error: toErrorValue(
        new Error("Runtime completed with error status"),
        intent,
        after,
      ),
    }) as ExecutionOutcome;
  }

  return Object.freeze({ kind: "ok" }) as ExecutionOutcome;
}

function findHaltReason(diagnostics: ExecutionDiagnostics | undefined): string | null {
  const haltTrace = diagnostics?.hostTraces
    ?.slice()
    .reverse()
    .find((trace) => trace.terminatedBy === "halt");
  if (!haltTrace) {
    return null;
  }

  for (const node of Object.values(haltTrace.nodes)) {
    if (node.kind === "halt") {
      const reason = node.inputs.reason;
      return typeof reason === "string" ? reason : "halted";
    }
  }

  return "halted";
}

function toErrorValue<T extends ManifestoDomainShape>(
  error: Error,
  intent: TypedIntent<T>,
  snapshot: CanonicalSnapshot<T["state"]>,
): ErrorValue {
  return Object.freeze({
    code: error instanceof ManifestoError ? error.code : "SUBMISSION_FAILED",
    message: error.message,
    source: {
      actionId: intent.intentId ?? "",
      nodePath: "runtime.submit",
    },
    timestamp: snapshot.meta.timestamp,
  });
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(String(error));
}
