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
