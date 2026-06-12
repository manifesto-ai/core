import type { ErrorValue, Intent } from "@manifesto-ai/core";

import {
  DisposedError,
  ManifestoError,
  SubmissionFailedError,
} from "../errors.js";
import type {
  ActionArgs,
  ActionHandle,
  ActionInfo,
  ActionInput,
  ActionName,
  ActionSurface,
  Admission,
  AdmissionFailure,
  AdmissionOk,
  BaseWriteReport,
  BaseSubmissionResult,
  Blocker,
  BoundAction,
  ComputedReadSurface,
  ComputedRef,
  DispatchBlocker,
  DispatchExecutionOutcome,
  DynamicActionHandle,
  ExecutionDiagnostics,
  ExecutionOutcome,
  ExecutionView,
  FieldRef,
  GetAction,
  ManifestoApp,
  ManifestoDomainShape,
  ObserveSurface,
  PreviewDiagnosticsMode,
  PreviewResult,
  ProjectedReadHandle,
  ProjectedSnapshot,
  StateReadSurface,
  SubmitReportMode,
  TypedActionMetadata,
  TypedActionRef,
  TypedIntent,
  Unsubscribe,
} from "../types.js";
import {
  EXTENSION_KERNEL,
  attachExtensionKernel,
  type RuntimeKernel,
} from "../compat/internal.js";
import { runBaseDispatchAttempt } from "./base-dispatch.js";
import {
  cloneAndFreezeActionPayload,
  tryCloneAndFreezeActionPayload,
} from "./action-payload.js";
import { createRuntimePublication } from "./publication.js";
import { diffProjectedPaths } from "./reports.js";

type BaseMode = "base";

type Candidate<T extends ManifestoDomainShape, Name extends ActionName<T>> = {
  readonly actionName: Name;
  readonly input: ActionInput<T, Name>;
  readonly intent: TypedIntent<T, Name> | null;
  readonly inputError: ManifestoError | null;
};

type RuntimeExecutionView<T extends ManifestoDomainShape> = {
  readonly context?: ReturnType<RuntimeKernel<T>["getExternalContext"]>;
  readonly diagnostics?: PreviewDiagnosticsMode;
  readonly report?: SubmitReportMode;
};

export function createBaseRuntimeInstance<T extends ManifestoDomainShape>(
  kernel: RuntimeKernel<T>,
  view: RuntimeExecutionView<T> = {},
  isView = false,
): ManifestoApp<T, BaseMode> {
  let runtimeView = freezeRuntimeView(view);
  const extensionKernel = kernel[EXTENSION_KERNEL];
  const publication = createRuntimePublication({
    setVisibleSnapshot: kernel.setVisibleSnapshot,
    restoreVisibleSnapshot: kernel.restoreVisibleSnapshot,
    getCanonicalSnapshot: kernel.getCanonicalSnapshot,
  });
  const actionInfoByName = new Map<ActionName<T>, ActionInfo<ActionName<T>>>();

  for (const metadata of kernel.getActionMetadata()) {
    actionInfoByName.set(
      metadata.name as ActionName<T>,
      toActionInfo(metadata as TypedActionMetadata<T, ActionName<T>>),
    );
  }

  const action = Object.create(null) as ActionSurface<T, BaseMode>;
  const actionByName = new Map<string, DynamicActionHandle<T, BaseMode>>();

  for (const name of actionInfoByName.keys()) {
    const handle = createActionHandle(name);
    actionByName.set(
      name,
      handle as unknown as DynamicActionHandle<T, BaseMode>,
    );
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

  const getAction = ((name: string) => actionByName.get(name)) as GetAction<
    T,
    BaseMode
  >;

  const app = {
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
          kernel
            .getAvailableActions()
            .map((name) => getActionInfo(name as ActionName<T>)),
        );
      },
      schemaHash(): string {
        return kernel.getCanonicalSnapshot().meta.schemaHash;
      },
    }),
    snapshot: kernel.getSnapshot,
    getAction,
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
      return createBaseRuntimeInstance(
        kernel,
        mergeRuntimeView(nextView),
        true,
      );
    },
    dispose: kernel.dispose,
  } satisfies ManifestoApp<T, BaseMode>;

  return Object.freeze(attachExtensionKernel(app, kernel));

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
    for (const name of Object.keys(kernel.refs.state) as Array<
      keyof T["state"] & string
    >) {
      const ref = kernel.refs.state[name] as FieldRef<T["state"][typeof name]>;
      Object.defineProperty(surface, name, {
        enumerable: true,
        configurable: false,
        writable: false,
        value: createReadHandle(name, ref, (snapshot) => snapshot.state[name]),
      });
    }

    return Object.freeze(surface) as StateReadSurface<T>;
  }

  function createComputedReadSurface(): ComputedReadSurface<T> {
    const surface: Record<PropertyKey, unknown> = Object.create(null);
    for (const name of Object.keys(kernel.refs.computed) as Array<
      keyof T["computed"] & string
    >) {
      const ref = kernel.refs.computed[name] as ComputedRef<
        T["computed"][typeof name]
      >;
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
  ): ActionHandle<T, Name, BaseMode> {
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
  ): BoundAction<T, Name, BaseMode> {
    const candidate = createCandidate(name, args);
    const stableArgs = tryCloneAndFreezeActionPayload<readonly unknown[]>([
      ...args,
    ]);
    const createFreshCandidate = (): Candidate<T, Name> =>
      stableArgs.ok
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
        return fresh.inputError ? null : (fresh.intent as Intent | null);
      },
    });
  }

  function createCandidate<Name extends ActionName<T>>(
    name: Name,
    args: ActionArgs<T, Name>,
  ): Candidate<T, Name> {
    const actionRef = kernel.refs.actions[name] as TypedActionRef<T, Name>;
    const publicInput = toPublicInput(name, args);
    const stableInput =
      tryCloneAndFreezeActionPayload<ActionInput<T, Name>>(publicInput);
    if (!stableInput.ok) {
      return Object.freeze({
        actionName: name,
        input: undefined as ActionInput<T, Name>,
        intent: null,
        inputError: stableInput.error,
      });
    }

    try {
      const intent = cloneAndFreezeActionPayload(
        kernel.createIntent(actionRef, ...args),
      );
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
    const snapshot = kernel.getCanonicalSnapshot();
    return admitCandidate(candidate, snapshot).admission;
  }

  function previewCandidate<Name extends ActionName<T>>(
    candidate: Candidate<T, Name>,
  ): PreviewResult<T, Name> {
    const beforeCanonical = kernel.getCanonicalSnapshot();
    const before = extensionKernel.projectSnapshot(beforeCanonical);
    const admission = admitCandidate(candidate, beforeCanonical);
    if (!admission.admission.ok || admission.intent === null) {
      return Object.freeze({
        admitted: false,
        admission: admission.admission as AdmissionFailure<Name>,
      }) as PreviewResult<T, Name>;
    }

    const intent = admission.intent;
    const context = kernel.createComputeContext(
      intent,
      captureViewExternalContext(),
    );
    const simulated = kernel.simulateSync(beforeCanonical, intent, {
      context,
    });
    const after = extensionKernel.projectSnapshot(simulated.snapshot);

    return Object.freeze({
      admitted: true,
      status: simulated.status,
      before,
      after,
      changes: diffProjectedPaths(before, after),
      requirements: simulated.requirements,
      newAvailableActions: kernel
        .getAvailableActionsFor(simulated.snapshot)
        .map((name) => getActionInfo(name as ActionName<T>)),
      ...previewDiagnostics(simulated.diagnostics, runtimeView.diagnostics),
      error: simulated.snapshot.system.lastError,
    }) as PreviewResult<T, Name>;
  }

  async function submitCandidate<Name extends ActionName<T>>(
    candidate: Candidate<T, Name>,
  ): Promise<BaseSubmissionResult<T, Name>> {
    if (kernel.isDisposed()) {
      throw new DisposedError();
    }
    const context = candidate.intent
      ? kernel.createComputeContext(
          candidate.intent,
          captureViewExternalContext(),
        )
      : null;

    return kernel.enqueue(async () => {
      if (kernel.isDisposed()) {
        throw new DisposedError();
      }

      const beforeCanonical = kernel.getCanonicalSnapshot();
      const admission = admitCandidate(candidate, beforeCanonical);
      if (!admission.admission.ok || admission.intent === null) {
        const rejectedAdmission = admission.admission as AdmissionFailure<Name>;
        emitSubmissionRejected(
          candidate.actionName,
          candidate.intent,
          rejectedAdmission,
          beforeCanonical,
        );
        return Object.freeze({
          ok: false,
          mode: "base",
          action: candidate.actionName,
          admission: rejectedAdmission,
        }) as BaseSubmissionResult<T, Name>;
      }

      const admittedIntent = admission.intent;
      emitSubmissionAdmitted(
        candidate.actionName,
        admittedIntent,
        admission.admission,
        beforeCanonical,
      );
      emitSubmissionSubmitted(
        candidate.actionName,
        admittedIntent,
        beforeCanonical,
      );

      const attempt = await runBaseDispatchAttempt(
        kernel,
        extensionKernel,
        publication,
        admittedIntent,
        context ??
          kernel.createComputeContext(
            admittedIntent,
            captureViewExternalContext(),
          ),
      );

      if (attempt.kind === "rejected") {
        const rejected = mapBlockedAdmission(
          candidate.actionName,
          attempt.admission,
          attempt.rejection.reason,
        );
        emitSubmissionRejected(
          candidate.actionName,
          attempt.intent,
          rejected,
          attempt.beforeCanonicalSnapshot,
        );
        return Object.freeze({
          ok: false,
          mode: "base",
          action: candidate.actionName,
          admission: rejected,
        }) as BaseSubmissionResult<T, Name>;
      }

      if (attempt.kind === "failed") {
        const failureSnapshot =
          attempt.outcome?.canonical.afterCanonicalSnapshot ??
          attempt.beforeCanonicalSnapshot;
        const hostOperationalError = readHostNamespaceError(failureSnapshot);
        if (
          !attempt.published ||
          hostOperationalError ||
          !failureSnapshot.system.lastError
        ) {
          const error =
            hostOperationalError ??
            toDiagnosticErrorValue(
              attempt.failure,
              attempt.intent,
              failureSnapshot,
            );
          emitSubmissionFailed(
            candidate.actionName,
            attempt.intent,
            error,
            failureSnapshot,
          );
          throw new SubmissionFailedError(attempt.failure.message, "runtime", {
            cause: attempt.failure,
          });
        }
      }

      const dispatchOutcome =
        attempt.kind === "completed" ? attempt.outcome : attempt.outcome;
      if (!dispatchOutcome) {
        const error = toErrorValue(
          attempt.kind === "failed"
            ? attempt.failure
            : new Error("Submission produced no terminal outcome"),
          attempt.intent,
          kernel.getCanonicalSnapshot(),
        );
        emitSubmissionFailed(
          candidate.actionName,
          attempt.intent,
          error,
          kernel.getCanonicalSnapshot(),
        );
        throw new SubmissionFailedError(error.message, "runtime");
      }

      const outcome = toExecutionOutcome(
        dispatchOutcome,
        attempt.intent,
        attempt.diagnostics,
      );
      const afterCanonical = dispatchOutcome.canonical.afterCanonicalSnapshot;

      if (dispatchOutcome.canonical.status === "pending") {
        const error = toErrorValue(
          new Error("Base submit produced a pending runtime snapshot"),
          attempt.intent,
          afterCanonical,
        );
        emitSubmissionFailed(
          candidate.actionName,
          attempt.intent,
          error,
          afterCanonical,
        );
        throw new SubmissionFailedError(error.message, "runtime");
      }

      emitSubmissionSettled(
        candidate.actionName,
        attempt.intent,
        outcome,
        afterCanonical,
      );
      const report = createBaseWriteReport(
        runtimeView.report,
        candidate.actionName,
        dispatchOutcome,
        outcome,
        attempt.diagnostics,
      );

      return Object.freeze({
        ok: true,
        mode: "base",
        status: "settled",
        action: candidate.actionName,
        before: dispatchOutcome.projected.beforeSnapshot,
        after: dispatchOutcome.projected.afterSnapshot,
        outcome,
        ...(report !== undefined ? { report } : {}),
      }) as BaseSubmissionResult<T, Name>;
    });
  }

  function getViewExternalContext(): ReturnType<
    RuntimeKernel<T>["getExternalContext"]
  > {
    return runtimeView.context ?? kernel.getExternalContext();
  }

  function captureViewExternalContext(): ReturnType<
    RuntimeKernel<T>["getExternalContext"]
  > {
    return runtimeView.context ?? kernel.captureExternalContext();
  }

  function mergeRuntimeView(
    nextView: ExecutionView<ReturnType<RuntimeKernel<T>["getExternalContext"]>>,
  ): RuntimeExecutionView<T> {
    return freezeRuntimeView({
      ...runtimeView,
      ...(nextView.context !== undefined
        ? { context: kernel.captureExternalContext(nextView.context) }
        : {}),
      ...(nextView.diagnostics !== undefined
        ? { diagnostics: nextView.diagnostics }
        : {}),
      ...(nextView.report !== undefined ? { report: nextView.report } : {}),
    });
  }

  function admitCandidate<Name extends ActionName<T>>(
    candidate: Candidate<T, Name>,
    snapshot: ReturnType<RuntimeKernel<T>["getCanonicalSnapshot"]>,
  ):
    | {
        readonly admission: AdmissionOk<Name>;
        readonly intent: TypedIntent<T, Name>;
      }
    | {
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

    const legality = kernel.evaluateIntentLegalityFor(
      snapshot,
      candidate.intent,
    );
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
        legacyAdmission as Extract<
          typeof legacyAdmission,
          { readonly kind: "blocked" }
        >,
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
        message:
          fallbackMessage ??
          `Action "${actionName}" is not dispatchable against the current visible snapshot`,
        blockers: failure.blockers.map((blocker) =>
          toBlocker(blocker, "INTENT_NOT_DISPATCHABLE"),
        ),
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
      message:
        fallbackMessage ??
        `Action "${actionName}" is unavailable against the current visible snapshot`,
      blockers: (failure.blockers ?? []).map((blocker) =>
        toBlocker(blocker, "ACTION_UNAVAILABLE"),
      ),
    }) as AdmissionFailure<Name>;
  }

  function getAvailabilityBlockers<Name extends ActionName<T>>(
    candidate: Candidate<T, Name>,
    snapshot: ReturnType<RuntimeKernel<T>["getCanonicalSnapshot"]>,
  ): readonly Blocker[] {
    if (!candidate.intent) {
      const availabilityIntent = Object.freeze({
        type: String(candidate.actionName),
        intentId: `availability:${String(candidate.actionName)}`,
      }) as TypedIntent<T, Name>;
      const legality = kernel.evaluateIntentLegalityFor(
        snapshot,
        availabilityIntent,
      );
      const admission = kernel.deriveIntentAdmission(snapshot, legality);
      if (
        admission.kind !== "blocked" ||
        admission.failure.kind !== "unavailable"
      ) {
        return Object.freeze([]);
      }

      return mapBlockedAdmission(candidate.actionName, admission).blockers;
    }

    const legality = kernel.evaluateIntentLegalityFor(
      snapshot,
      candidate.intent,
    );
    const admission = kernel.deriveIntentAdmission(snapshot, legality);
    if (
      admission.kind !== "blocked" ||
      admission.failure.kind !== "unavailable"
    ) {
      return Object.freeze([]);
    }

    return mapBlockedAdmission(candidate.actionName, admission).blockers;
  }

  function getActionInfo<Name extends ActionName<T>>(
    name: Name,
  ): ActionInfo<Name> {
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
    snapshot: ReturnType<RuntimeKernel<T>["getCanonicalSnapshot"]>,
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
    snapshot: ReturnType<RuntimeKernel<T>["getCanonicalSnapshot"]>,
  ): void {
    kernel.emitEvent("submission:rejected", {
      ...eventBase(actionName, intent, snapshot),
      admission,
    });
  }

  function emitSubmissionSubmitted<Name extends ActionName<T>>(
    actionName: Name,
    intent: TypedIntent<T>,
    snapshot: ReturnType<RuntimeKernel<T>["getCanonicalSnapshot"]>,
  ): void {
    kernel.emitEvent(
      "submission:submitted",
      eventBase(actionName, intent, snapshot),
    );
  }

  function emitSubmissionSettled<Name extends ActionName<T>>(
    actionName: Name,
    intent: TypedIntent<T>,
    outcome: ExecutionOutcome,
    snapshot: ReturnType<RuntimeKernel<T>["getCanonicalSnapshot"]>,
  ): void {
    kernel.emitEvent("submission:settled", {
      ...eventBase(actionName, intent, snapshot),
      outcome,
    });
  }

  function emitSubmissionFailed<Name extends ActionName<T>>(
    actionName: Name,
    intent: TypedIntent<T>,
    error: ErrorValue,
    snapshot: ReturnType<RuntimeKernel<T>["getCanonicalSnapshot"]>,
  ): void {
    kernel.emitEvent("submission:failed", {
      ...eventBase(actionName, intent, snapshot),
      stage: "runtime",
      error,
    });
  }

  function eventBase<Name extends ActionName<T>>(
    actionName: Name,
    intent: TypedIntent<T> | null,
    snapshot: ReturnType<RuntimeKernel<T>["getCanonicalSnapshot"]>,
  ) {
    return {
      action: actionName,
      mode: "base" as const,
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

function createBaseWriteReport<T extends ManifestoDomainShape>(
  mode: SubmitReportMode | undefined,
  action: ActionName<T>,
  outcome: DispatchExecutionOutcome<T>,
  executionOutcome: ExecutionOutcome,
  diagnostics?: ExecutionDiagnostics,
): BaseWriteReport | undefined {
  if (mode === "none") {
    return undefined;
  }

  return Object.freeze({
    mode: "base",
    action: String(action),
    changes: outcome.projected.changedPaths,
    requirements: outcome.canonical.pendingRequirements,
    outcome: executionOutcome,
    ...(mode === "full" && diagnostics !== undefined ? { diagnostics } : {}),
  });
}

function freezeRuntimeView<T extends ManifestoDomainShape>(
  view: RuntimeExecutionView<T>,
): RuntimeExecutionView<T> {
  return Object.freeze({ ...view });
}

function toActionInfo<
  T extends ManifestoDomainShape,
  Name extends ActionName<T>,
>(metadata: TypedActionMetadata<T, Name>): ActionInfo<Name> {
  const inputFields =
    metadata.input?.type === "object" ? (metadata.input.fields ?? {}) : {};
  const parameterNames =
    metadata.params.length > 0 ? metadata.params : Object.keys(inputFields);
  const annotations = metadata.annotations;
  const title =
    typeof annotations?.title === "string" ? annotations.title : undefined;

  return Object.freeze({
    name: metadata.name,
    ...(title !== undefined ? { title } : {}),
    ...(metadata.description !== undefined
      ? { description: metadata.description }
      : {}),
    parameters: Object.freeze(
      parameterNames.map((name) => {
        const field = inputFields[name];
        return Object.freeze({
          name,
          required: field?.required ?? true,
          ...(field?.type !== undefined
            ? { type: fieldTypeToString(field.type) }
            : {}),
          ...(field?.description !== undefined
            ? { description: field.description }
            : {}),
        });
      }),
    ),
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

function findHaltReason(
  diagnostics: ExecutionDiagnostics | undefined,
): string | null {
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
  snapshot: ReturnType<RuntimeKernel<T>["getCanonicalSnapshot"]>,
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

function toDiagnosticErrorValue<T extends ManifestoDomainShape>(
  error: Error,
  intent: TypedIntent<T>,
  snapshot: ReturnType<RuntimeKernel<T>["getCanonicalSnapshot"]>,
): ErrorValue {
  return readSnapshotError(snapshot) ?? toErrorValue(error, intent, snapshot);
}

function readSnapshotError<T extends ManifestoDomainShape>(
  snapshot: ReturnType<RuntimeKernel<T>["getCanonicalSnapshot"]>,
): ErrorValue | null {
  if (snapshot.system.lastError) {
    return snapshot.system.lastError;
  }

  return readHostNamespaceError(snapshot);
}

function readHostNamespaceError<T extends ManifestoDomainShape>(
  snapshot: ReturnType<RuntimeKernel<T>["getCanonicalSnapshot"]>,
): ErrorValue | null {
  const hostNamespace = snapshot.namespaces?.host;
  if (
    hostNamespace &&
    typeof hostNamespace === "object" &&
    !Array.isArray(hostNamespace)
  ) {
    const lastError = (hostNamespace as { readonly lastError?: unknown })
      .lastError;
    if (isErrorValue(lastError)) {
      return lastError;
    }
  }

  return null;
}

function isErrorValue(value: unknown): value is ErrorValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<ErrorValue>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.timestamp === "number" &&
    !!candidate.source &&
    typeof candidate.source === "object" &&
    typeof candidate.source.actionId === "string" &&
    typeof candidate.source.nodePath === "string"
  );
}
