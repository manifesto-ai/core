import type { AdmissionFailure, Blocker, DispatchBlocker } from "../types.js";

/**
 * Shared admission-failure mapping for runtime surfaces.
 *
 * The base, lineage, and governance runtimes expose the same
 * action-candidate admission contract; this module is the single source
 * for narrowing a blocked kernel admission into the public
 * AdmissionFailure shape (previously triplicated across the three
 * runtime files).
 */

export function toBlocker(blocker: DispatchBlocker, code: Blocker["code"]): Blocker {
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

export function mapBlockedAdmission<Name extends string>(
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
    message:
      fallbackMessage ??
      `Action "${actionName}" is unavailable against the current visible snapshot`,
    blockers: (failure.blockers ?? []).map((blocker) => toBlocker(blocker, "ACTION_UNAVAILABLE")),
  }) as AdmissionFailure<Name>;
}
