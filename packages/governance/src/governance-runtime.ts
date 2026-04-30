import type {
  ErrorValue,
  Intent,
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
  type DispatchBlocker,
  type GovernanceSettlementResult,
  type GovernanceSubmissionResult,
  type ManifestoDomainShape,
  type PreviewOptions,
  type PreviewResult,
  type ProjectedSnapshot,
  type ProposalRef,
  type SubmitOptions,
  type TypedActionMetadata,
  type TypedActionRef,
  type TypedIntent,
} from "@manifesto-ai/sdk";
import {
  attachExtensionKernel,
  type GovernanceRuntimeKernel,
} from "@manifesto-ai/sdk/provider";
import type {
  LineageRuntimeController,
} from "@manifesto-ai/lineage/provider";

import type { GovernanceInstance } from "./runtime-types.js";
import type {
  ActorAuthorityBinding,
  ActorId,
  BranchId,
  DecisionId,
  DecisionRecord,
  IntentScope,
  Proposal,
  ProposalId,
} from "./types.js";

type Candidate<
  T extends ManifestoDomainShape,
  Name extends ActionName<T>,
> = {
  readonly actionName: Name;
  readonly input: ActionInput<T, Name>;
  readonly intent: TypedIntent<T, Name> | null;
  readonly inputError: ManifestoError | null;
};

type ParsedActionArgs = {
  readonly args: readonly unknown[];
  readonly options?: PreviewOptions | SubmitOptions;
};

export type GovernanceRuntimeServices<T extends ManifestoDomainShape> = {
  readonly lineage: LineageRuntimeController<T>;
  readonly ensureReady: () => Promise<void>;
  readonly createSubmission: (intent: TypedIntent<T>) => Promise<Proposal>;
  readonly settleSubmission: (proposalId: ProposalId) => Promise<void>;
  readonly waitForSettlement: <Name extends ActionName<T>>(
    proposalId: ProposalRef,
    actionName?: Name,
  ) => Promise<GovernanceSettlementResult<T, Name>>;
  readonly approve: (
    proposalId: ProposalId,
    approvedScope?: IntentScope | null,
  ) => Promise<Proposal>;
  readonly reject: (proposalId: ProposalId, reason?: string) => Promise<Proposal>;
  readonly getProposal: (proposalId: ProposalId) => Promise<Proposal | null>;
  readonly getProposals: (branchId?: BranchId) => Promise<readonly Proposal[]>;
  readonly bindActor: (binding: ActorAuthorityBinding) => Promise<void>;
  readonly getActorBinding: (actorId: ActorId) => Promise<ActorAuthorityBinding | null>;
  readonly getDecisionRecord: (decisionId: DecisionId) => Promise<DecisionRecord | null>;
};

export function createGovernanceRuntimeInstance<T extends ManifestoDomainShape>(
  kernel: GovernanceRuntimeKernel<T>,
  services: GovernanceRuntimeServices<T>,
): GovernanceInstance<T> {
  const actionInfoByName = new Map<ActionName<T>, ActionInfo<ActionName<T>>>();
  const actionHandleByName = new Map<ActionName<T>, ActionHandle<T, ActionName<T>, "governance">>();

  for (const metadata of kernel.getActionMetadata()) {
    actionInfoByName.set(
      metadata.name as ActionName<T>,
      toActionInfo(metadata as TypedActionMetadata<T, ActionName<T>>),
    );
  }

  const actions = Object.create(null) as ActionSurface<T, "governance">;
  for (const name of actionInfoByName.keys()) {
    const handle = createActionHandle(name);
    actionHandleByName.set(name, handle);
    Object.defineProperty(actions, name, {
      enumerable: true,
      configurable: false,
      writable: false,
      value: handle,
    });
  }

  function action<Name extends ActionName<T>>(
    name: Name,
  ): ActionHandle<T, Name, "governance"> {
    const handle = actionHandleByName.get(name);
    if (!handle) {
      throw new ManifestoError(
        "UNKNOWN_ACTION",
        `Action "${String(name)}" is not declared by this Manifesto schema`,
      );
    }
    return handle as ActionHandle<T, Name, "governance">;
  }

  const runtime = {
    actions: Object.freeze(actions),
    observe: Object.freeze({
      state<S>(
        selector: (snapshot: ProjectedSnapshot<T>) => S,
        listener: (next: S, prev: S) => void,
      ) {
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
      },
      event(event, listener) {
        if (kernel.isDisposed()) {
          return () => {};
        }
        return kernel.on(event, listener);
      },
    }),
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
    action,
    dispose: kernel.dispose,
    waitForSettlement(ref: ProposalRef) {
      return services.waitForSettlement(ref);
    },
    restore: services.lineage.restore,
    getWorld: services.lineage.getWorld,
    getWorldSnapshot: services.lineage.getWorldSnapshot,
    getLineage: services.lineage.getLineage,
    getLatestHead: services.lineage.getLatestHead,
    getHeads: services.lineage.getHeads,
    getBranches: services.lineage.getBranches,
    getActiveBranch: services.lineage.getActiveBranch,
    switchActiveBranch: services.lineage.switchActiveBranch,
    createBranch: services.lineage.createBranch,
    approve: services.approve,
    reject: services.reject,
    getProposal: services.getProposal,
    getProposals: services.getProposals,
    bindActor: services.bindActor,
    getActorBinding: services.getActorBinding,
    getDecisionRecord: services.getDecisionRecord,
  } satisfies GovernanceInstance<T>;

  return attachExtensionKernel(runtime, kernel);

  function createActionHandle<Name extends ActionName<T>>(
    name: Name,
  ): ActionHandle<T, Name, "governance"> {
    return Object.freeze({
      info: () => getActionInfo(name),
      available: () => kernel.isActionAvailable(name),
      check: (...args: ActionArgs<T, Name>) => {
        const candidate = createCandidate(name, args);
        return checkCandidate(candidate);
      },
      preview: (...argsWithOptions: [...ActionArgs<T, Name>, PreviewOptions?]) => {
        const parsed = splitOptions(argsWithOptions, "PreviewOptions", getPublicArity(name));
        const candidate = createCandidate(name, parsed.args as ActionArgs<T, Name>);
        return previewCandidate(candidate, parsed.options as PreviewOptions | undefined);
      },
      submit: (...argsWithOptions: [...ActionArgs<T, Name>, SubmitOptions?]) => {
        const parsed = splitOptions(argsWithOptions, "SubmitOptions", getPublicArity(name));
        const candidate = createCandidate(name, parsed.args as ActionArgs<T, Name>);
        return submitCandidate(candidate, parsed.options as SubmitOptions | undefined);
      },
      bind: (...args: ActionArgs<T, Name>) => createBoundAction(name, args),
    });
  }

  function createBoundAction<Name extends ActionName<T>>(
    name: Name,
    args: ActionArgs<T, Name>,
  ): BoundAction<T, Name, "governance"> {
    const candidate = createCandidate(name, args);
    return Object.freeze({
      action: name,
      input: candidate.input,
      check: () => checkCandidate(candidate),
      preview: (options?: PreviewOptions) => previewCandidate(candidate, options),
      submit: (options?: SubmitOptions) => submitCandidate(candidate, options),
      intent: () => candidate.intent as Intent | null,
    });
  }

  function createCandidate<Name extends ActionName<T>>(
    name: Name,
    args: ActionArgs<T, Name>,
  ): Candidate<T, Name> {
    const actionRef = kernel.MEL.actions[name] as TypedActionRef<T, Name>;
    const publicInput = toPublicInput(args);
    try {
      const intent = kernel.createIntent(actionRef, ...args);
      return Object.freeze({
        actionName: name,
        input: publicInput,
        intent,
        inputError: null,
      });
    } catch (error) {
      if (!(error instanceof ManifestoError)) {
        throw error;
      }

      return Object.freeze({
        actionName: name,
        input: publicInput,
        intent: null,
        inputError: error,
      });
    }
  }

  function toPublicInput<Name extends ActionName<T>>(
    args: readonly unknown[],
  ): ActionInput<T, Name> {
    if (args.length === 0) {
      return undefined as ActionInput<T, Name>;
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
    options?: PreviewOptions,
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
    const simulated = kernel.simulateSync(beforeCanonical, intent);
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
      ...previewDiagnostics(simulated.diagnostics, options),
      error: simulated.snapshot.system.lastError,
    }) as PreviewResult<T, Name>;
  }

  async function submitCandidate<Name extends ActionName<T>>(
    candidate: Candidate<T, Name>,
    options?: SubmitOptions,
  ): Promise<GovernanceSubmissionResult<T, Name>> {
    void options;
    if (kernel.isDisposed()) {
      throw new DisposedError();
    }

    return kernel.enqueue(async () => {
      if (kernel.isDisposed()) {
        throw new DisposedError();
      }

      await services.ensureReady();

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
          mode: "governance",
          action: candidate.actionName,
          admission: rejectedAdmission,
        }) as GovernanceSubmissionResult<T, Name>;
      }

      const admittedIntent = admission.intent;
      emitSubmissionAdmitted(candidate.actionName, admittedIntent, admission.admission, beforeCanonical);
      emitSubmissionSubmitted(candidate.actionName, admittedIntent, beforeCanonical);

      let proposal: Proposal;
      try {
        proposal = await services.createSubmission(admittedIntent);
      } catch (error) {
        const failure = toError(error);
        const failedSnapshot = kernel.getCanonicalSnapshot();
        const errorValue = toErrorValue(failure, admittedIntent, failedSnapshot);
        emitSubmissionFailed(candidate.actionName, admittedIntent, errorValue, failedSnapshot, "runtime");
        throw new SubmissionFailedError(failure.message, "runtime", { cause: failure });
      }

      const proposalRef = proposal.proposalId;
      emitProposalCreated(candidate.actionName, proposalRef, beforeCanonical);
      emitSubmissionPending(candidate.actionName, admittedIntent, proposalRef, beforeCanonical);

      await services.settleSubmission(proposalRef);

      return Object.freeze({
        ok: true,
        mode: "governance",
        status: "pending",
        action: candidate.actionName,
        proposal: proposalRef,
        waitForSettlement: () => services.waitForSettlement(
          proposalRef,
          candidate.actionName,
        ),
      }) as GovernanceSubmissionResult<T, Name>;
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
          blockers: Object.freeze([]),
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

  function getPublicArity<Name extends ActionName<T>>(name: Name): number {
    const metadata = kernel.getActionMetadata(name);
    return metadata.publicArity;
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

  function emitSubmissionPending<Name extends ActionName<T>>(
    actionName: Name,
    intent: TypedIntent<T>,
    proposal: ProposalRef,
    snapshot: CanonicalSnapshot<T["state"]>,
  ): void {
    kernel.emitEvent("submission:pending", {
      ...eventBase(actionName, intent, snapshot),
      proposal,
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

  function emitProposalCreated<Name extends ActionName<T>>(
    actionName: Name,
    proposal: ProposalRef,
    snapshot: CanonicalSnapshot<T["state"]>,
  ): void {
    kernel.emitEvent("proposal:created", {
      proposal,
      action: actionName,
      schemaHash: snapshot.meta.schemaHash,
    });
  }

  function eventBase<Name extends ActionName<T>>(
    actionName: Name,
    intent: TypedIntent<T> | null,
    snapshot: CanonicalSnapshot<T["state"]>,
  ) {
    return {
      action: actionName,
      mode: "governance" as const,
      ...(intent?.intentId ? { intentId: intent.intentId } : {}),
      schemaHash: snapshot.meta.schemaHash,
      snapshotVersion: snapshot.meta.version,
    };
  }
}

function splitOptions(
  args: readonly unknown[],
  kind: PreviewOptions["__kind"] | SubmitOptions["__kind"],
  arity: number,
): ParsedActionArgs {
  if (args.length === arity + 1 && isOption(args[args.length - 1], kind)) {
    return Object.freeze({
      args: Object.freeze(args.slice(0, -1)),
      options: args[args.length - 1] as PreviewOptions | SubmitOptions,
    });
  }

  return Object.freeze({
    args: Object.freeze([...args]),
  });
}

function isOption(
  value: unknown,
  kind: PreviewOptions["__kind"] | SubmitOptions["__kind"],
): boolean {
  return typeof value === "object"
    && value !== null
    && "__kind" in value
    && (value as { readonly __kind?: unknown }).__kind === kind;
}

function previewDiagnostics(
  diagnostics: { readonly trace?: unknown } | undefined,
  options: PreviewOptions | undefined,
) {
  if (!diagnostics || options?.diagnostics === "none") {
    return {};
  }

  if (options?.diagnostics === "summary") {
    return { diagnostics: {} };
  }

  return { diagnostics: { trace: diagnostics.trace } };
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
      nodePath: "governance.submit",
    },
    timestamp: snapshot.meta.timestamp,
  });
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}
