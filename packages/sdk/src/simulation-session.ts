import { ManifestoError } from "./errors.js";
import { getAttachedExtensionKernel } from "./internal.js";
import { cloneAndDeepFreeze } from "./snapshot-projection.js";
import type {
  ExtensionKernel,
  SimulationActionRef,
  SimulationSession,
  SimulationSessionResult,
  SimulationSessionStatus,
  SimulationSessionStep,
} from "./extensions-types.js";
import type {
  ActivatedInstance,
  BaseLaws,
  CanonicalSnapshot,
  CreateIntentArgs,
  ManifestoDomainShape,
  TypedActionRef,
  TypedIntent,
} from "./types.js";

function isTerminalStatus(status: SimulationSessionStatus): boolean {
  return status === "pending" || status === "halted" || status === "error";
}

function isActionRef<T extends ManifestoDomainShape>(
  value: TypedIntent<T> | TypedActionRef<T, keyof T["actions"]>,
): value is TypedActionRef<T, keyof T["actions"]> {
  return (value as { __kind?: string }).__kind === "ActionRef";
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function getAvailableActionRefs<T extends ManifestoDomainShape>(
  ext: ExtensionKernel<T>,
  snapshot: CanonicalSnapshot<T["state"]>,
  isTerminal: boolean,
): readonly SimulationActionRef<T>[] {
  if (isTerminal) {
    return Object.freeze([]);
  }

  return Object.freeze(
    ext.getAvailableActionsFor(snapshot).map(
      (name) => ext.MEL.actions[name],
    ) as readonly SimulationActionRef<T>[],
  );
}

function createSessionStep<T extends ManifestoDomainShape>(
  intent: TypedIntent<T>,
  ext: ExtensionKernel<T>,
  snapshot: CanonicalSnapshot<T["state"]>,
  requirements: readonly import("@manifesto-ai/core").Requirement[],
  status: import("@manifesto-ai/core").ComputeStatus,
): SimulationSessionStep<T> {
  const isTerminal = isTerminalStatus(status);
  return Object.freeze({
    intent: cloneAndDeepFreeze(intent),
    snapshot: ext.projectSnapshot(snapshot),
    canonicalSnapshot: snapshot,
    availableActions: getAvailableActionRefs(ext, snapshot, isTerminal),
    requirements: freezeArray(requirements),
    status,
    isTerminal,
  });
}

function createSession<T extends ManifestoDomainShape>(
  ext: ExtensionKernel<T>,
  state: SimulationSessionResult<T>,
): SimulationSession<T> {
  const result = Object.freeze({
    snapshot: state.snapshot,
    canonicalSnapshot: state.canonicalSnapshot,
    depth: state.depth,
    trajectory: state.trajectory,
    availableActions: state.availableActions,
    requirements: state.requirements,
    status: state.status,
    isTerminal: state.isTerminal,
    finish(): SimulationSessionResult<T> {
      return state;
    },
    next(
      actionOrIntent: TypedIntent<T> | TypedActionRef<T, keyof T["actions"]>,
      ...args: readonly unknown[]
    ): SimulationSession<T> {
      if (state.isTerminal) {
        throw new ManifestoError(
          "SIMULATION_SESSION_TERMINAL",
          "SimulationSession.next() cannot advance a terminal session",
        );
      }

      const intent = isActionRef(actionOrIntent)
        ? ext.createIntent(
          actionOrIntent as TypedActionRef<T, never>,
          ...(args as CreateIntentArgs<T, never>),
        )
        : actionOrIntent;
      const simulated = ext.simulateSync(state.canonicalSnapshot, intent);
      const step = createSessionStep(
        intent,
        ext,
        simulated.snapshot,
        simulated.requirements,
        simulated.status,
      );
      const nextState = Object.freeze({
        snapshot: step.snapshot,
        canonicalSnapshot: simulated.snapshot,
        depth: state.depth + 1,
        trajectory: freezeArray([...state.trajectory, step]),
        availableActions: step.availableActions,
        requirements: step.requirements,
        status: step.status,
        isTerminal: step.isTerminal,
      }) satisfies SimulationSessionResult<T>;

      return createSession(ext, nextState);
    },
  });

  return result as SimulationSession<T>;
}

export function createSimulationSession<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  app: ActivatedInstance<T, Laws>,
): SimulationSession<T> {
  const ext = getAttachedExtensionKernel<T>(app as object);
  const canonicalSnapshot = ext.getCanonicalSnapshot();
  const status = canonicalSnapshot.system.status;
  const isTerminal = isTerminalStatus(status);

  return createSession(
    ext,
    Object.freeze({
      snapshot: ext.projectSnapshot(canonicalSnapshot),
      canonicalSnapshot,
      depth: 0,
      trajectory: Object.freeze([]),
      availableActions: getAvailableActionRefs(ext, canonicalSnapshot, isTerminal),
      requirements: freezeArray(canonicalSnapshot.system.pendingRequirements),
      status,
      isTerminal,
    }),
  );
}
