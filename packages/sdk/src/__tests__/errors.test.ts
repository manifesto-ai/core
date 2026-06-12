import { describe, expect, it } from "vitest";

import {
  AlreadyActivatedError,
  CompileError,
  DisposedError,
  ManifestoError,
  ReservedEffectError,
  SubmissionFailedError,
  type CompileDiagnostic,
} from "../errors.js";

describe("ManifestoError", () => {
  it("carries the code and message and extends Error", () => {
    const error = new ManifestoError("SCHEMA_ERROR", "broken schema");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ManifestoError");
    expect(error.code).toBe("SCHEMA_ERROR");
    expect(error.message).toBe("broken schema");
  });

  it("supports the standard cause option", () => {
    const cause = new Error("inner");
    const error = new ManifestoError("X", "outer", { cause });

    expect(error.cause).toBe(cause);
  });
});

describe("ReservedEffectError", () => {
  it("uses the RESERVED_EFFECT code and records the effect type", () => {
    const error = new ReservedEffectError("array.map");

    expect(error).toBeInstanceOf(ManifestoError);
    expect(error.name).toBe("ReservedEffectError");
    expect(error.code).toBe("RESERVED_EFFECT");
    expect(error.effectType).toBe("array.map");
    expect(error.message).toBe('Effect type "array.map" is reserved and cannot be overridden');
  });
});

describe("CompileError", () => {
  it("uses the COMPILE_ERROR code and exposes diagnostics", () => {
    const diagnostics: CompileDiagnostic[] = [
      {
        severity: "error",
        code: "E001",
        message: "unexpected token",
        location: {
          start: { line: 1, column: 2, offset: 1 },
          end: { line: 1, column: 3, offset: 2 },
        },
      },
    ];
    const error = new CompileError(diagnostics, "MEL compilation failed");

    expect(error).toBeInstanceOf(ManifestoError);
    expect(error.name).toBe("CompileError");
    expect(error.code).toBe("COMPILE_ERROR");
    expect(error.diagnostics).toEqual(diagnostics);
    expect(error.message).toBe("MEL compilation failed");
  });
});

describe("DisposedError", () => {
  it("uses the DISPOSED code with a fixed message", () => {
    const error = new DisposedError();

    expect(error).toBeInstanceOf(ManifestoError);
    expect(error.name).toBe("DisposedError");
    expect(error.code).toBe("DISPOSED");
    expect(error.message).toBe("Cannot use a disposed Manifesto runtime");
  });
});

describe("AlreadyActivatedError", () => {
  it("uses the ALREADY_ACTIVATED code with a fixed message", () => {
    const error = new AlreadyActivatedError();

    expect(error).toBeInstanceOf(ManifestoError);
    expect(error.name).toBe("AlreadyActivatedError");
    expect(error.code).toBe("ALREADY_ACTIVATED");
    expect(error.message).toBe("ComposableManifesto.activate() may only be called once");
  });
});

describe("SubmissionFailedError", () => {
  it("defaults to the runtime stage", () => {
    const error = new SubmissionFailedError("submit failed");

    expect(error).toBeInstanceOf(ManifestoError);
    expect(error.name).toBe("SubmissionFailedError");
    expect(error.code).toBe("SUBMISSION_FAILED");
    expect(error.stage).toBe("runtime");
    expect(error.message).toBe("submit failed");
  });

  it("records the settlement stage and cause when provided", () => {
    const cause = new Error("authority rejected");
    const error = new SubmissionFailedError("not settled", "settlement", { cause });

    expect(error.stage).toBe("settlement");
    expect(error.cause).toBe(cause);
  });
});
