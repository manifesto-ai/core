import type { Snapshot } from "@manifesto-ai/core";

import type { ErrorInfo } from "./types.js";
import { readSnapshotCurrentError } from "./snapshot-errors.js";

export function deriveErrorInfo(snapshot: Snapshot): ErrorInfo {
  const currentError = readSnapshotCurrentError(snapshot) ?? undefined;
  const pendingRequirements = snapshot.system.pendingRequirements.map(
    (requirement) => requirement.id,
  );

  return {
    summary: summarizeFailure(currentError ? 1 : 0, pendingRequirements.length),
    ...(currentError ? { currentError } : {}),
    ...(pendingRequirements.length > 0 ? { pendingRequirements } : {}),
  };
}

function summarizeFailure(errorCount: number, pendingRequirementCount: number): string {
  if (errorCount > 0 && pendingRequirementCount > 0) {
    return `Execution failed with ${errorCount} error(s) and ${pendingRequirementCount} pending requirement(s)`;
  }
  if (errorCount > 0) {
    return `Execution failed with ${errorCount} error(s)`;
  }
  if (pendingRequirementCount > 0) {
    return `Execution failed with ${pendingRequirementCount} pending requirement(s)`;
  }
  return "Execution failed";
}
