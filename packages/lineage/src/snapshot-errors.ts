import type { ErrorValue, Snapshot } from "@manifesto-ai/core";

export function readSnapshotCurrentError(snapshot: Snapshot): ErrorValue | null {
  return snapshot.system.lastError ?? readHostNamespaceError(snapshot);
}

export function readHostNamespaceError(snapshot: Snapshot): ErrorValue | null {
  const hostNamespace = snapshot.namespaces?.host;
  if (
    hostNamespace
    && typeof hostNamespace === "object"
    && !Array.isArray(hostNamespace)
  ) {
    const lastError = (hostNamespace as { readonly lastError?: unknown }).lastError;
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
  return typeof candidate.code === "string"
    && typeof candidate.message === "string"
    && typeof candidate.timestamp === "number"
    && !!candidate.source
    && typeof candidate.source === "object"
    && typeof candidate.source.actionId === "string"
    && typeof candidate.source.nodePath === "string";
}
