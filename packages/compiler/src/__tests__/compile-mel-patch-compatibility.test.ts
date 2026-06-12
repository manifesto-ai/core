/**
 * compileMelPatch guard compatibility tests.
 *
 * These tests codify law-level invariants from issue #107 and related
 * while/once/onceIntent regressions:
 * - patch-only compilation rejects guarded control that needs runtime channels
 * - full domain compilation remains the supported path for guard semantics
 */

import { describe, it, expect } from "vitest";
import { compileMelDomain, compileMelPatch } from "../api/compile-mel.js";
import {
  createCore,
  createIntent,
  createSnapshot,
  type ComputeResult,
  type Snapshot,
} from "@manifesto-ai/core";

const HOST_CONTEXT = {
  runtime: {
    time: { timestamp: 0 },
    random: { seed: "seed" },
  },
  external: {},
};

const DEFAULT_STATE = `
  state {
    count: number = 0
    status: string = ""
    flag: boolean = false
    x: number = 0
    y: number = 0
  }
`;

function domainSource(actionBody: string, stateSource = DEFAULT_STATE): string {
  return `
    domain CompileMelPatchParity {
      ${stateSource}

      action probe() {
        ${actionBody}
      }
    }
  `;
}

async function runLegacyCycle(
  schema: any,
  core: ReturnType<typeof createCore>,
  snapshot: Snapshot,
  intentId: string,
  input?: Record<string, unknown>,
) {
  const result = await core.compute(
    schema,
    snapshot,
    createIntent("probe", input, intentId),
    HOST_CONTEXT,
  );

  return {
    ...result,
    snapshot: applyComputeResult(core, schema, snapshot, result),
  };
}

function applyComputeResult(
  core: ReturnType<typeof createCore>,
  schema: any,
  snapshot: Snapshot,
  result: ComputeResult,
): Snapshot {
  const patchedSnapshot = core.apply(schema, snapshot, result.patches);
  const namespacedSnapshot = core.applyNamespaceDeltas(
    patchedSnapshot,
    result.namespaceDelta ?? [],
  );
  return core.applySystemDelta(namespacedSnapshot, result.systemDelta);
}

describe("compileMelPatch legacy lowering parity", () => {
  it("rejects when blocks in patch-only compilation", () => {
    const body = `
      when eq(count, 0) {
        patch count = add(count, 1)
        patch status = "updated"
      }
    `;

    const result = compileMelPatch(body, {
      mode: "patch",
      actionName: "compat-when-unsupported",
    });

    expect(result.ops).toHaveLength(0);
    expect(result.errors).toEqual([expect.objectContaining({ code: "E_UNSUPPORTED_CONTROL" })]);
  });

  it("keeps when semantics available in full domain compilation", async () => {
    const body = `
      when eq(count, 0) {
        patch count = add(count, 1)
        patch flag = eq(count, 0)
      }
    `;

    const compiled = compileMelDomain(domainSource(body), { mode: "domain" });
    expect(compiled.errors).toHaveLength(0);
    expect(compiled.schema).not.toBeNull();
    const schema = compiled.schema!;
    const core = createCore();

    const positive = await runLegacyCycle(
      schema,
      core,
      createSnapshot({ count: 0, status: "", flag: false, x: 0, y: 0 }, schema.hash, HOST_CONTEXT),
      "when-entry-snapshot",
    );

    expect(positive.snapshot.state).toMatchObject({
      count: 1,
      flag: false,
      status: "",
      x: 0,
      y: 0,
    });

    const negative = await runLegacyCycle(
      schema,
      core,
      createSnapshot(
        { count: 5, status: "ready", flag: false, x: 0, y: 0 },
        schema.hash,
        HOST_CONTEXT,
      ),
      "when-entry-snapshot-false",
    );
    expect(negative.snapshot.state).toEqual({
      count: 5,
      status: "ready",
      flag: false,
      x: 0,
      y: 0,
    });
  });

  it("rejects nested when blocks in patch-only compilation", () => {
    const body = `
      when eq(count, 0) {
        patch count = add(count, 1)
        when eq(count, 1) {
          patch status = "inner"
        }
        patch flag = true
      }
    `;

    const result = compileMelPatch(body, {
      mode: "patch",
      actionName: "compat-nested-when",
    });

    expect(result.ops).toHaveLength(0);
    expect(result.errors).toEqual([expect.objectContaining({ code: "E_UNSUPPORTED_CONTROL" })]);
  });

  it("rejects once marker semantics in patch-only compilation", () => {
    const body = `
      once(onceMarker) {
        patch count = add(count, 1)
        patch status = "once"
      }
    `;

    const result = compileMelPatch(body, {
      mode: "patch",
      actionName: "compat-once-marker",
    });

    expect(result.ops).toHaveLength(0);
    expect(result.errors).toEqual([expect.objectContaining({ code: "E_UNSUPPORTED_CONTROL" })]);
  });

  it("rejects onceIntent semantics in patch-only compilation", () => {
    const body = `
      onceIntent {
        patch count = add(count, 1)
        patch flag = eq(count, 0)
      }
    `;

    const result = compileMelPatch(body, {
      mode: "patch",
      actionName: "compat-once-intent",
    });

    expect(result.ops).toHaveLength(0);
    expect(result.errors).toEqual([expect.objectContaining({ code: "E_UNSUPPORTED_CONTROL" })]);
  });

  it("rejects conditional once and onceIntent guards in patch-only compilation", () => {
    const onceWhenBody = `
      once(onceMarker) when eq(count, 0) {
        patch count = add(count, 1)
        patch status = "once-when"
      }
    `;

    const onceWhenResult = compileMelPatch(onceWhenBody, {
      mode: "patch",
      actionName: "compat-once-when",
    });
    expect(onceWhenResult.ops).toHaveLength(0);
    expect(onceWhenResult.errors).toEqual([
      expect.objectContaining({ code: "E_UNSUPPORTED_CONTROL" }),
    ]);

    const onceIntentWhenBody = `
      onceIntent when eq(count, 0) {
        patch count = add(count, 1)
        patch status = "once-intent-when"
      }
    `;
    const onceIntentWhenResult = compileMelPatch(onceIntentWhenBody, {
      mode: "patch",
      actionName: "compat-once-intent-when",
    });
    expect(onceIntentWhenResult.ops).toHaveLength(0);
    expect(onceIntentWhenResult.errors).toEqual([
      expect.objectContaining({ code: "E_UNSUPPORTED_CONTROL" }),
    ]);
  });

  it("rejects issue #107 when-block patch-only regression shape", () => {
    const body = `
      when eq(count, 0) {
        patch count = add(count, 1)
        patch flag = eq(count, 0)
      }
    `;

    const result = compileMelPatch(body, {
      mode: "patch",
      actionName: "compat-issue-107",
    });

    expect(result.ops).toHaveLength(0);
    expect(result.errors).toEqual([expect.objectContaining({ code: "E_UNSUPPORTED_CONTROL" })]);
  });
});
