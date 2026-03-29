import type { WorldId } from "@manifesto-ai/lineage";
import type { SealRejectionReason } from "@manifesto-ai/governance";

export class FacadeCasMismatchError extends Error {
  public constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "FacadeCasMismatchError";
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: cause,
        writable: true,
      });
    }
  }
}

export function isFacadeCasMismatchError(error: unknown): error is FacadeCasMismatchError {
  return error instanceof FacadeCasMismatchError;
}

export function wrapCommitSealError(error: unknown): never {
  if (error instanceof Error && error.message.includes("LIN-STORE-4 violation")) {
    throw new FacadeCasMismatchError(error.message, error);
  }

  throw error;
}

export function toSealRejectionReason(error: unknown): SealRejectionReason | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const worldIdCollision = error.message.match(/LIN-COLLISION-1 violation: world (\S+) already exists/);
  if (worldIdCollision) {
    return {
      kind: "worldId_collision",
      computedWorldId: worldIdCollision[1] as WorldId,
      message: error.message,
    };
  }

  const selfLoop = error.message.match(/LIN-COLLISION-2 violation: computed world (\S+) equals base world (\S+)/);
  if (selfLoop) {
    return {
      kind: "self_loop",
      computedWorldId: selfLoop[1] as WorldId,
      message: error.message,
    };
  }

  return null;
}
