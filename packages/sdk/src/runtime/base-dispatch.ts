import type {
  DispatchReport,
  ExecutionDiagnostics,
  ExecutionFailureInfo,
  ExecutionOutcome,
  IntentAdmission,
  ManifestoDomainShape,
  Snapshot,
  TypedIntent,
} from "../types.js";
import type {
  ExtensionKernel,
} from "../extensions-types.js";
import type {
  RuntimeKernel,
} from "../compat/internal.js";
import {
  ManifestoError,
} from "../errors.js";
import {
  emitDispatchFailedEvent,
  emitDispatchRejectedEvent,
} from "./events.js";
import type {
  RuntimePublicationHelpers,
} from "./facets.js";

type RejectedAttempt<T extends ManifestoDomainShape> = {
  readonly kind: "rejected";
  readonly intent: TypedIntent<T>;
  readonly admission: Extract<IntentAdmission<T>, { readonly kind: "blocked" }>;
  readonly beforeSnapshot: Snapshot<T["state"]>;
  readonly beforeCanonicalSnapshot: ReturnType<RuntimeKernel<T>["getCanonicalSnapshot"]>;
  readonly rejection: ReturnType<typeof emitDispatchRejectedEvent<T>>;
  readonly rejectionError: ManifestoError;
};

type FailedAttempt<T extends ManifestoDomainShape> = {
  readonly kind: "failed";
  readonly intent: TypedIntent<T>;
  readonly admission: Extract<IntentAdmission<T>, { readonly kind: "admitted" }>;
  readonly beforeSnapshot: Snapshot<T["state"]>;
  readonly beforeCanonicalSnapshot: ReturnType<RuntimeKernel<T>["getCanonicalSnapshot"]>;
  readonly failure: Error;
  readonly errorInfo: ExecutionFailureInfo;
  readonly published: boolean;
  readonly diagnostics?: ExecutionDiagnostics;
  readonly outcome?: ExecutionOutcome<T>;
};

type CompletedAttempt<T extends ManifestoDomainShape> = {
  readonly kind: "completed";
  readonly intent: TypedIntent<T>;
  readonly admission: Extract<IntentAdmission<T>, { readonly kind: "admitted" }>;
  readonly publishedSnapshot: Snapshot<T["state"]>;
  readonly outcome: ExecutionOutcome<T>;
  readonly diagnostics: ExecutionDiagnostics;
};

export type BaseDispatchAttemptResult<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> =
  | RejectedAttempt<T>
  | FailedAttempt<T>
  | CompletedAttempt<T>;

export async function runBaseDispatchAttempt<T extends ManifestoDomainShape>(
  kernel: RuntimeKernel<T>,
  extensionKernel: Pick<ExtensionKernel<T>, "projectSnapshot">,
  publication: Pick<
    RuntimePublicationHelpers<T>,
    "publishCompletedHostResult" | "publishFailedHostResult"
  >,
  intent: TypedIntent<T>,
): Promise<BaseDispatchAttemptResult<T>> {
  const beforeCanonicalSnapshot = kernel.getCanonicalSnapshot();
  const beforeSnapshot = extensionKernel.projectSnapshot(beforeCanonicalSnapshot);
  const legality = kernel.evaluateIntentLegalityFor(beforeCanonicalSnapshot, intent);
  const admission = kernel.deriveIntentAdmission(beforeCanonicalSnapshot, legality);

  if (legality.kind !== "admitted") {
    const blockedAdmission = admission as Extract<
      IntentAdmission<T>,
      { readonly kind: "blocked" }
    >;
    const rejectionError = toRejectedDispatchError(kernel, legality);
    const rejection = emitDispatchRejectedEvent(
      kernel.emitEvent,
      legality.intent,
      rejectionError,
    );

    return {
      kind: "rejected",
      intent: legality.intent,
      admission: blockedAdmission,
      beforeSnapshot,
      beforeCanonicalSnapshot,
      rejection,
      rejectionError,
    };
  }

  const admittedAdmission = admission as Extract<
    IntentAdmission<T>,
    { readonly kind: "admitted" }
  >;

  let result;
  try {
    result = await kernel.executeHost(legality.intent);
  } catch (error) {
    const failure = toError(error);
    emitDispatchFailedEvent(kernel.emitEvent, legality.intent, failure);
    return {
      kind: "failed",
      intent: legality.intent,
      admission: admittedAdmission,
      beforeSnapshot,
      beforeCanonicalSnapshot,
      failure,
      errorInfo: kernel.classifyExecutionFailure(failure, "host"),
      published: false,
    };
  }

  const diagnostics = kernel.createExecutionDiagnostics(result);

  if (result.status === "error") {
    const failure = result.error ?? new ManifestoError("HOST_ERROR", "Host dispatch failed");
    const {
      publishedSnapshot,
      publishedCanonicalSnapshot,
    } = publication.publishFailedHostResult(
      legality.intent,
      failure,
      result.snapshot,
    );
    return {
      kind: "failed",
      intent: legality.intent,
      admission: admittedAdmission,
      beforeSnapshot,
      beforeCanonicalSnapshot,
      failure,
      errorInfo: kernel.classifyExecutionFailure(failure, "host"),
      published: true,
      diagnostics,
      outcome: kernel.deriveExecutionOutcome(
        beforeCanonicalSnapshot,
        publishedCanonicalSnapshot,
      ),
    };
  }

  const {
    publishedSnapshot,
    publishedCanonicalSnapshot,
  } = publication.publishCompletedHostResult(
    legality.intent,
    result.snapshot,
  );
  return {
    kind: "completed",
    intent: legality.intent,
    admission: admittedAdmission,
    publishedSnapshot,
    outcome: kernel.deriveExecutionOutcome(
      beforeCanonicalSnapshot,
      publishedCanonicalSnapshot,
    ),
    diagnostics,
  };
}

export function attemptToDispatchAsyncResult<T extends ManifestoDomainShape>(
  attempt: BaseDispatchAttemptResult<T>,
): Snapshot<T["state"]> {
  if (attempt.kind === "completed") {
    return attempt.publishedSnapshot;
  }

  if (attempt.kind === "rejected") {
    throw attempt.rejectionError;
  }

  throw attempt.failure;
}

export function attemptToDispatchReport<T extends ManifestoDomainShape>(
  attempt: BaseDispatchAttemptResult<T>,
): DispatchReport<T> {
  if (attempt.kind === "completed") {
    return Object.freeze({
      kind: "completed",
      intent: attempt.intent,
      admission: attempt.admission,
      outcome: attempt.outcome,
      diagnostics: attempt.diagnostics,
    }) as DispatchReport<T>;
  }

  if (attempt.kind === "rejected") {
    return Object.freeze({
      kind: "rejected",
      intent: attempt.intent,
      admission: attempt.admission,
      beforeSnapshot: attempt.beforeSnapshot,
      beforeCanonicalSnapshot: attempt.beforeCanonicalSnapshot,
      rejection: attempt.rejection,
    }) as DispatchReport<T>;
  }

  return Object.freeze({
    kind: "failed",
    intent: attempt.intent,
    admission: attempt.admission,
    beforeSnapshot: attempt.beforeSnapshot,
    beforeCanonicalSnapshot: attempt.beforeCanonicalSnapshot,
    error: attempt.errorInfo,
    published: attempt.published,
    ...(attempt.diagnostics !== undefined ? { diagnostics: attempt.diagnostics } : {}),
    ...(attempt.outcome !== undefined ? { outcome: attempt.outcome } : {}),
  }) as DispatchReport<T>;
}

function toRejectedDispatchError<T extends ManifestoDomainShape>(
  kernel: RuntimeKernel<T>,
  legality: ReturnType<RuntimeKernel<T>["evaluateIntentLegalityFor"]>,
): ManifestoError {
  if (legality.kind === "unavailable") {
    return kernel.createUnavailableError(legality.intent);
  }
  if (legality.kind === "invalid-input") {
    return legality.error;
  }
  if (legality.kind === "not-dispatchable") {
    return kernel.createNotDispatchableError(legality.intent);
  }
  throw new ManifestoError(
    "SDK_REPORT_ERROR",
    "Cannot derive a rejected dispatch error for an admitted intent",
  );
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(String(error));
}
