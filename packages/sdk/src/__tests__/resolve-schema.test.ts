import { describe, expect, it } from "vitest";
import { semanticPathToPatchPath } from "@manifesto-ai/core";

import { CompileError, ManifestoError } from "../errors.js";
import {
  compileSchema,
  deriveActionAnnotations,
  deriveActionParamMetadata,
  deriveSingleParamObjectValueMetadata,
} from "../manifest/compile-schema.js";
import { resolveSchema } from "../manifest/resolve-schema.js";
import {
  counterMelSource,
  createCounterSchema,
  createRawCounterSchema,
  withHash,
} from "./helpers/schema.js";

const pp = semanticPathToPatchPath;

const paramOrderMelSource = `
domain ParamOrder {
  state { total: number = 0 }

  action applyDelta(delta: number, reason: string) {
    when true { patch total = add(total, delta) }
  }
}
`;

const singleObjectParamMelSource = `
domain Profiles {
  type Profile = { name: string }

  state { current: Profile | null = null }

  action setProfile(profile: Profile) {
    when true { patch current = profile }
  }

  action rename(name: string) {
    when true { patch current = { name: name } }
  }
}
`;

const annotatedMelSource = `
domain Annotated {
  state { count: number = 0 }

  @meta("ui:button", { variant: "primary" })
  @meta("agent:hint")
  action increment() {
    when true { patch count = add(count, 1) }
  }
}
`;

function captureError(run: () => unknown): ManifestoError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ManifestoError);
    return error as ManifestoError;
  }
  throw new Error("Expected the call to throw");
}

describe("compileSchema()", () => {
  it("compiles MEL source into a hashed schema with param metadata", () => {
    const compiled = compileSchema(paramOrderMelSource);

    expect(compiled.schema.id).toBe("mel:paramorder");
    expect(compiled.schema.hash).toBeTruthy();
    expect(compiled.schema.state.fields.total).toMatchObject({ type: "number" });
    expect(compiled.actionParamMetadata.applyDelta).toEqual(["delta", "reason"]);
    expect(compiled.actionSingleParamObjectValueMetadata.applyDelta).toBe(false);
  });

  it("marks single object-typed params as object-valued", () => {
    const compiled = compileSchema(singleObjectParamMelSource);

    expect(compiled.actionParamMetadata.setProfile).toEqual(["profile"]);
    expect(compiled.actionSingleParamObjectValueMetadata.setProfile).toBe(true);
    expect(compiled.actionSingleParamObjectValueMetadata.rename).toBe(false);
  });

  it("derives action annotations from @meta tags", () => {
    const compiled = compileSchema(annotatedMelSource);

    expect(compiled.actionAnnotations.increment).toEqual({
      "ui:button": { variant: "primary" },
      "agent:hint": true,
    });
  });

  it("throws CompileError with diagnostics and a caret-annotated message", () => {
    const badSource = `
domain Broken {
  state { count: number = 0 }

  action oops() {
    when true { patch count = add(count, ) }
  }
}
`;

    const error = captureError(() => compileSchema(badSource));
    expect(error).toBeInstanceOf(CompileError);
    expect(error.code).toBe("COMPILE_ERROR");

    const compileError = error as CompileError;
    expect(compileError.diagnostics.length).toBeGreaterThan(0);
    expect(compileError.message).toContain("MEL compilation failed:");
    expect(compileError.message).toMatch(/\[\w+\d*\]/);
    expect(compileError.message).toContain("^");
  });
});

describe("deriveActionParamMetadata()", () => {
  it("prefers explicit schema params, then single input fields", () => {
    const schema = createCounterSchema();
    const metadata = deriveActionParamMetadata(schema);

    expect(metadata.increment).toEqual([]);
    expect(metadata.add).toEqual(["amount"]);
  });

  it("returns null for multi-field inputs without declared param order", () => {
    const raw = createRawCounterSchema();
    raw.actions.transfer = {
      input: {
        type: "object",
        required: true,
        fields: {
          from: { type: "string", required: true },
          to: { type: "string", required: true },
        },
      },
      flow: {
        kind: "patch",
        op: "set",
        path: pp("status"),
        value: { kind: "lit", value: "transferred" },
      },
    };
    const metadata = deriveActionParamMetadata(withHash(raw));

    expect(metadata.transfer).toBeNull();
  });

  it("uses caller-provided param order when present", () => {
    const metadata = deriveActionParamMetadata(createCounterSchema(), {
      add: ["amount"],
    });

    expect(metadata.add).toEqual(["amount"]);
  });
});

describe("deriveSingleParamObjectValueMetadata()", () => {
  it("flags prebuilt single object-field inputs and not scalar inputs", () => {
    const raw = createRawCounterSchema();
    raw.actions.configure = {
      input: {
        type: "object",
        required: true,
        fields: {
          options: { type: "object", required: true },
        },
      },
      flow: {
        kind: "patch",
        op: "set",
        path: pp("status"),
        value: { kind: "lit", value: "configured" },
      },
    };
    const metadata = deriveSingleParamObjectValueMetadata(withHash(raw));

    expect(metadata.configure).toBe(true);
    expect(metadata.add).toBe(false);
    expect(metadata.increment).toBe(false);
  });
});

describe("deriveActionAnnotations()", () => {
  it("returns a frozen empty map when no annotation index exists", () => {
    const annotations = deriveActionAnnotations();

    expect(annotations).toEqual({});
    expect(Object.isFrozen(annotations)).toBe(true);
  });

  it("keeps only action-targeted annotation entries", () => {
    const annotations = deriveActionAnnotations({
      entries: {
        "action:increment": [
          { tag: "ui:button", payload: { variant: "ghost" } },
          { tag: "agent:hint" },
        ],
        "state:count": [{ tag: "ui:badge" }],
      },
    } as never);

    expect(annotations).toEqual({
      increment: {
        "ui:button": { variant: "ghost" },
        "agent:hint": true,
      },
    });
  });
});

describe("resolveSchema()", () => {
  it("resolves MEL source into schema, metadata, and a projection plan", () => {
    const resolved = resolveSchema(counterMelSource);

    expect(resolved.schema.actions.increment).toBeDefined();
    expect(resolved.actionParamMetadata.increment).toEqual([]);
    expect(resolved.projectionPlan.visibleComputedKeys).toEqual([]);
  });

  it("resolves prebuilt schemas and lists visible computed keys", () => {
    const schema = createCounterSchema();
    const resolved = resolveSchema(schema);

    expect(resolved.schema).toBe(schema);
    expect(resolved.projectionPlan.visibleComputedKeys).toEqual(["doubled"]);
    expect(resolved.actionAnnotations).toEqual({});
  });

  it("merges caller annotations over compiled annotations", () => {
    const resolved = resolveSchema(annotatedMelSource, {
      increment: { "agent:hint": "override", "extra:tag": 1 },
      decrement: { "agent:only": true },
    });

    expect(resolved.actionAnnotations.increment).toEqual({
      "ui:button": { variant: "primary" },
      "agent:hint": "override",
      "extra:tag": 1,
    });
    expect(resolved.actionAnnotations.decrement).toEqual({ "agent:only": true });
  });

  it("rejects DomainModule artifacts with SCHEMA_ERROR", () => {
    const moduleLike = {
      schema: createCounterSchema(),
      graph: { nodes: [], edges: [] },
      annotations: { entries: {} },
    };

    const error = captureError(() => resolveSchema(moduleLike as never));
    expect(error.code).toBe("SCHEMA_ERROR");
    expect(error.message).toContain("DomainModule is a compiler tooling artifact");
  });

  it("rejects $-prefixed state fields, including nested ones", () => {
    const raw = createRawCounterSchema();
    raw.state.fields.$hidden = { type: "string", required: false, default: "" };
    const topLevel = captureError(() => resolveSchema(withHash(raw)));
    expect(topLevel.code).toBe("SCHEMA_ERROR");
    expect(topLevel.message).toContain(
      'State field "state.fields.$hidden" uses reserved namespace prefix "$"',
    );

    const nestedRaw = createRawCounterSchema();
    nestedRaw.state.fields.settings = {
      type: "object",
      required: false,
      default: {},
      fields: {
        $internal: { type: "boolean", required: false, default: false },
      },
    };
    const nested = captureError(() => resolveSchema(withHash(nestedRaw)));
    expect(nested.code).toBe("SCHEMA_ERROR");
    expect(nested.message).toContain("state.fields.settings.$internal");
  });

  it("rejects action types in the reserved system namespace", () => {
    const raw = createRawCounterSchema();
    raw.actions["system.reset"] = {
      flow: {
        kind: "patch",
        op: "set",
        path: pp("count"),
        value: { kind: "lit", value: 0 },
      },
    };

    const error = captureError(() => resolveSchema(withHash(raw)));
    expect(error.code).toBe("RESERVED_NAMESPACE");
    expect(error.message).toContain(
      'Action type "system.reset" uses reserved namespace prefix "system."',
    );
  });
});
