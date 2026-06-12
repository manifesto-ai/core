import type { Context, ErrorValue, Intent } from "@manifesto-ai/core";
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
  type ComputedReadSurface,
  type ComputedRef,
  type DynamicActionHandle,
  type ExecutionView,
  type ExecutionOutcome,
  type FieldRef,
  type GetAction,
  type GovernanceSettlementResult,
  type GovernanceSubmissionResult,
  type ManifestoDomainShape,
  type ObserveSurface,
  type PreviewDiagnosticsMode,
  type PreviewResult,
  type ProjectedReadHandle,
  type ProjectedSnapshot,
  type ProposalRef,
  type StateReadSurface,
  type SubmitReportMode,
  type TypedActionMetadata,
  type TypedActionRef,
  type TypedIntent,
  type Unsubscribe,
} from "@manifesto-ai/sdk";
import {
  attachExtensionKernel,
  type GovernanceRuntimeKernel,
  mapBlockedAdmission,
} from "@manifesto-ai/sdk/provider";
import type { LineageRuntimeController } from "@manifesto-ai/lineage/provider";

import { cloneAndFreezeActionPayload, tryCloneAndFreezeActionPayload } from "./action-payload.js";
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

type Candidate<T extends ManifestoDomainShape, Name extends ActionName<T>> = {
  readonly actionName: Name;
  readonly input: ActionInput<T, Name>;
  readonly intent: TypedIntent<T, Name> | null;
  readonly inputError: ManifestoError | null;
};

type RuntimeExecutionView<T extends ManifestoDomainShape> = {
  readonly context?: ReturnType<GovernanceRuntimeKernel<T>["getExternalContext"]>;
  readonly diagnostics?: PreviewDiagnosticsMode;
  readonly report?: SubmitReportMode;
};

export type GovernanceRuntimeServices<T extends ManifestoDomainShape> = {
  readonly lineage: LineageRuntimeController<T>;
  readonly ensureReady: () => Promise<void>;
  readonly createSubmission: (intent: TypedIntent<T>, context: Context) => Promise<Proposal>;
  readonly settleSubmission: (proposalId: ProposalId) => Promise<void>;
  readonly resumePendingSettlements: () => Promise<void>;
  readonly waitForSettlement: <Name extends ActionName<T>>(
    proposalId: ProposalRef,
    actionName?: Name,
    reportMode?: SubmitReportMode,
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
  view: RuntimeExecutionView<T> = {},
  isView = false,
): GovernanceInstance<T> {
  let runtimeView = freezeRuntimeView(view);
  const actionInfoByName = new Map<ActionName<T>, ActionInfo<ActionName<T>>>();

  for (const metadata of kernel.getActionMetadata()) {
    actionInfoByName.set(
      metadata.name as ActionName<T>,
      toActionInfo(metadata as TypedActionMetadata<T, ActionName<T>>),
    );
  }

  const action = Object.create(null) as ActionSurface<T, "governance">;
  const actionByName = new Map<string, DynamicActionHandle<T, "governance">>();
  for (const name of actionInfoByName.keys()) {
    const handle = createActionHandle(name);
    actionByName.set(name, handle as unknown as DynamicActionHandle<T, "governance">);
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

  const getAction = ((name: string) => actionByName.get(name)) as GetAction<T, "governance">;

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
          kernel.getAvailableActions().map((name) => getActionInfo(name as ActionName<T>)),
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
      return Object.freeze(
        createGovernanceRuntimeInstance(kernel, services, mergeRuntimeView(nextView), true),
      );
    },
    dispose: kernel.dispose,
    waitForSettlement(ref: ProposalRef) {
      return services.waitForSettlement(ref, undefined, runtimeView.report);
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
    approve: approveAndEmit,
    reject: rejectAndEmit,
    getProposal: services.getProposal,
    getProposals: services.getProposals,
    bindActor: services.bindActor,
    getActorBinding: services.getActorBinding,
    getDecisionRecord: services.getDecisionRecord,
  } satisfies GovernanceInstance<T>;

  return attachExtensionKernel(runtime, kernel);

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
        value: createReadHandle(name, ref, (snapshot) => snapshot.state[name]),
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
        value: createReadHandle(name, ref, (snapshot) => snapshot.computed[name]),
      });
    }

    return Object.freeze(surface) as ComputedReadSurface<T>;
  }

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
  ): BoundAction<T, Name, "governance"> {
    const candidate = createCandidate(name, args);
    const stableArgs = tryCloneAndFreezeActionPayload<readonly unknown[]>([...args]);
    const createFreshCandidate = (): Candidate<T, Name> =>
      stableArgs.ok ? createCandidate(name, stableArgs.value as ActionArgs<T, Name>) : candidate;
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
      const inputError = kernel.validateIntentInputFor(kernel.getCanonicalSnapshot(), intent);
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
      newAvailableActions: kernel
        .getAvailableActionsFor(simulated.snapshot)
        .map((name) => getActionInfo(name as ActionName<T>)),
      ...previewDiagnostics(simulated.diagnostics, runtimeView.diagnostics),
      error: simulated.snapshot.system.lastError,
    }) as PreviewResult<T, Name>;
  }

  async function submitCandidate<Name extends ActionName<T>>(
    candidate: Candidate<T, Name>,
  ): Promise<GovernanceSubmissionResult<T, Name>> {
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

      await services.ensureReady();

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
          mode: "governance",
          action: candidate.actionName,
          admission: rejectedAdmission,
        }) as GovernanceSubmissionResult<T, Name>;
      }

      const admittedIntent = admission.intent;
      emitSubmissionAdmitted(
        candidate.actionName,
        admittedIntent,
        admission.admission,
        beforeCanonical,
      );
      emitSubmissionSubmitted(candidate.actionName, admittedIntent, beforeCanonical);

      let proposal: Proposal;
      try {
        proposal = await services.createSubmission(
          admittedIntent,
          context ?? kernel.createComputeContext(admittedIntent, captureViewExternalContext()),
        );
      } catch (error) {
        const failure = toError(error);
        const failedSnapshot = kernel.getCanonicalSnapshot();
        const errorValue = toErrorValue(failure, admittedIntent, failedSnapshot);
        emitSubmissionFailed(
          candidate.actionName,
          admittedIntent,
          errorValue,
          failedSnapshot,
          "runtime",
        );
        throw new SubmissionFailedError(failure.message, "runtime", { cause: failure });
      }

      const proposalRef = proposal.proposalId;
      emitProposalCreated(candidate.actionName, proposalRef, beforeCanonical);
      emitSubmissionPending(candidate.actionName, admittedIntent, proposalRef, beforeCanonical);

      void kernel
        .enqueue(async () => {
          await services.settleSubmission(proposalRef);
          const finalProposal = await services.getProposal(proposalRef);
          if (
            !finalProposal ||
            finalProposal.status === "evaluating" ||
            finalProposal.status === "approved" ||
            finalProposal.status === "executing"
          ) {
            return;
          }

          const settledSnapshot = kernel.getCanonicalSnapshot();
          const decision = finalProposal?.decisionId
            ? await services.getDecisionRecord(finalProposal.decisionId)
            : null;
          if (decision) {
            emitProposalDecided(candidate.actionName, proposalRef, decision, settledSnapshot);
          }

          const settlement = await services.waitForSettlement(
            proposalRef,
            candidate.actionName,
            "summary",
          );
          if (settlement.status === "settled") {
            emitSubmissionSettled(
              candidate.actionName,
              admittedIntent,
              settlement.outcome,
              settledSnapshot,
              proposalRef,
              settlement.world.worldId,
            );
          } else if (settlement.status === "settlement_failed") {
            emitSubmissionFailed(
              candidate.actionName,
              admittedIntent,
              settlement.error,
              settledSnapshot,
              "settlement",
              proposalRef,
            );
          } else if (!decision && settlement.decision) {
            emitProposalDecided(
              candidate.actionName,
              proposalRef,
              settlement.decision,
              settledSnapshot,
            );
          }
        })
        .catch((error) => {
          const failure = toError(error);
          const failedSnapshot = kernel.getCanonicalSnapshot();
          const errorValue = toErrorValue(failure, admittedIntent, failedSnapshot);
          emitSubmissionFailed(
            candidate.actionName,
            admittedIntent,
            errorValue,
            failedSnapshot,
            "settlement",
            proposalRef,
          );
        });

      return Object.freeze({
        ok: true,
        mode: "governance",
        status: "pending",
        action: candidate.actionName,
        proposal: proposalRef,
        waitForSettlement: () =>
          services.waitForSettlement(proposalRef, candidate.actionName, runtimeView.report),
      }) as GovernanceSubmissionResult<T, Name>;
    });
  }

  function getViewExternalContext(): ReturnType<GovernanceRuntimeKernel<T>["getExternalContext"]> {
    return runtimeView.context ?? kernel.getExternalContext();
  }

  function captureViewExternalContext(): ReturnType<
    GovernanceRuntimeKernel<T>["getExternalContext"]
  > {
    return runtimeView.context ?? kernel.captureExternalContext();
  }

  function mergeRuntimeView(
    nextView: ExecutionView<ReturnType<GovernanceRuntimeKernel<T>["getExternalContext"]>>,
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

  async function approveAndEmit(
    proposalId: ProposalId,
    approvedScope?: IntentScope | null,
  ): Promise<Proposal> {
    const proposal = await services.approve(proposalId, approvedScope);
    await emitProposalLifecycleEvents(proposal);
    return proposal;
  }

  async function rejectAndEmit(proposalId: ProposalId, reason?: string): Promise<Proposal> {
    const proposal = await services.reject(proposalId, reason);
    await emitProposalLifecycleEvents(proposal);
    return proposal;
  }

  async function emitProposalLifecycleEvents(proposal: Proposal): Promise<void> {
    const action = proposal.intent.type as ActionName<T>;
    const snapshot = kernel.getCanonicalSnapshot();
    if (proposal.decisionId) {
      const decision = await services.getDecisionRecord(proposal.decisionId);
      if (decision) {
        emitProposalDecided(action, proposal.proposalId, decision, snapshot);
      }
    }

    if (proposal.status === "completed") {
      const settlement = await services.waitForSettlement(proposal.proposalId, action);
      if (settlement.status === "settled") {
        emitSubmissionSettled(
          action,
          proposal.intent as TypedIntent<T>,
          settlement.outcome,
          snapshot,
          proposal.proposalId,
          settlement.world.worldId,
        );
      }
      return;
    }

    if (proposal.status === "failed") {
      const settlement = await services.waitForSettlement(proposal.proposalId, action);
      if (settlement.status === "settlement_failed") {
        emitSubmissionFailed(
          action,
          proposal.intent as TypedIntent<T>,
          settlement.error,
          snapshot,
          "settlement",
          proposal.proposalId,
        );
      }
    }
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
    proposal?: ProposalRef,
  ): void {
    kernel.emitEvent("submission:failed", {
      ...eventBase(actionName, intent, snapshot),
      stage,
      error,
      ...(proposal !== undefined ? { proposal } : {}),
    });
  }

  function emitSubmissionSettled<Name extends ActionName<T>>(
    actionName: Name,
    intent: TypedIntent<T>,
    outcome: ExecutionOutcome,
    snapshot: CanonicalSnapshot<T["state"]>,
    proposal: ProposalRef,
    worldId: string,
  ): void {
    kernel.emitEvent("submission:settled", {
      ...eventBase(actionName, intent, snapshot),
      outcome,
      proposal,
      worldId,
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

  function emitProposalDecided<Name extends ActionName<T>>(
    actionName: Name,
    proposal: ProposalRef,
    decision: DecisionRecord | Readonly<Record<string, unknown>>,
    snapshot: CanonicalSnapshot<T["state"]>,
  ): void {
    kernel.emitEvent("proposal:decided", {
      proposal,
      action: actionName,
      schemaHash: snapshot.meta.schemaHash,
      decision: Object.freeze({ ...(decision as Record<string, unknown>) }),
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

function toActionInfo<T extends ManifestoDomainShape, Name extends ActionName<T>>(
  metadata: TypedActionMetadata<T, Name>,
): ActionInfo<Name> {
  const inputFields = metadata.input?.type === "object" ? (metadata.input.fields ?? {}) : {};
  const parameterNames = metadata.params.length > 0 ? metadata.params : Object.keys(inputFields);
  const annotations = metadata.annotations;
  const title = typeof annotations?.title === "string" ? annotations.title : undefined;

  return Object.freeze({
    name: metadata.name,
    ...(title !== undefined ? { title } : {}),
    ...(metadata.description !== undefined ? { description: metadata.description } : {}),
    parameters: Object.freeze(
      parameterNames.map((name) => {
        const field = inputFields[name];
        return Object.freeze({
          name,
          required: field?.required ?? true,
          ...(field?.type !== undefined ? { type: fieldTypeToString(field.type) } : {}),
          ...(field?.description !== undefined ? { description: field.description } : {}),
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
