import {
  type ManifestoDomainShape,
  type ManifestoEventMap,
  type Snapshot,
  type TypedIntent,
} from "../types.js";
import {
  ManifestoError,
} from "../errors.js";

type RuntimeEmitEvent<T extends ManifestoDomainShape> = <
  K extends keyof ManifestoEventMap<T>,
>(
  event: K,
  payload: ManifestoEventMap<T>[K],
) => void;

export function emitDispatchRejectedEvent<T extends ManifestoDomainShape>(
  emitEvent: RuntimeEmitEvent<T>,
  intent: TypedIntent<T>,
  error: ManifestoError,
): ManifestoEventMap<T>["dispatch:rejected"] {
  const payload = {
    intentId: intent.intentId ?? "",
    intent,
    code: error.code as ManifestoEventMap<T>["dispatch:rejected"]["code"],
    reason: error.message,
  } as const;
  emitEvent("dispatch:rejected", payload);
  return payload;
}

export function emitDispatchFailedEvent<T extends ManifestoDomainShape>(
  emitEvent: RuntimeEmitEvent<T>,
  intent: TypedIntent<T>,
  error: Error,
  snapshot?: Snapshot<T["state"]>,
): void {
  emitEvent("dispatch:failed", {
    intentId: intent.intentId ?? "",
    intent,
    error,
    ...(snapshot !== undefined ? { snapshot } : {}),
  } as ManifestoEventMap<T>["dispatch:failed"]);
}

export function emitDispatchCompletedEvent<T extends ManifestoDomainShape>(
  emitEvent: RuntimeEmitEvent<T>,
  intent: TypedIntent<T>,
  snapshot: Snapshot<T["state"]>,
): void {
  emitEvent("dispatch:completed", {
    intentId: intent.intentId ?? "",
    intent,
    snapshot,
  });
}
