/**
 * compileMelPatch vs legacy lowering parity tests.
 *
 * These tests codify law-level invariants from issue #107 and related
 * while/once/onceIntent regressions:
 * - when block snapshot scope is entry-stable per block
 * - once/onceIntent are executed only once per intended scope
 * - behavior is equivalent to legacy domain lowering
 */

import { describe, it, expect } from "vitest";
import { compileMelDomain, compileMelPatch } from "../api/index.js";
import {
  createCore,
  createIntent,
  createSnapshot,
  type Snapshot,
} from "@manifesto-ai/core";
import { createEvaluationContext, evaluateRuntimePatches } from "../evaluation/index.js";

const HOST_CONTEXT = { now: 0, randomSeed: "seed" };

const DEFAULT_STATE = `
  state {
    count: number = 0
    status: string | null = null
    flag: boolean | null = null
    x: number = 0
    y: number = 0
  }
`;

const DEFAULT_STATE_WITH_ONCE_MARKER = `
  state {
    count: number = 0
    status: string | null = null
    flag: boolean | null = null
    x: number = 0
    y: number = 0
    onceMarker: string | null = null
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

function stripInternalGuards(ops: { path: string }[]) {
  return ops.filter(
    (op) =>
      !op.path.startsWith("$mel.__whenGuards.") &&
      !op.path.startsWith("$mel.__onceScopeGuards.")
  );
}

function stripInternalState(data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }

  const projected = { ...(data as Record<string, unknown>) };
  delete projected.$mel;
  return projected;
}

async function runLegacyCycle(
  schema: any,
  core: ReturnType<typeof createCore>,
  snapshot: Snapshot,
  intentId: string,
  input?: Record<string, unknown>
) {
  return await core.compute(
    schema,
    snapshot,
    createIntent("probe", input ?? {}, intentId),
    HOST_CONTEXT
  );
}

function runCompileMelPatchCycle(
  schema: any,
  core: ReturnType<typeof createCore>,
  snapshot: Snapshot,
  patchResult: ReturnType<typeof compileMelPatch>,
  intentId: string,
  input: Record<string, unknown> = {}
) {
  if (patchResult.errors.length > 0) {
    throw new Error(patchResult.errors[0]?.message ?? "compileMelPatch failed");
  }

  const concretePatches = evaluateRuntimePatches(
    patchResult.ops,
    createEvaluationContext({
      meta: { intentId },
      snapshot: {
        data: snapshot.data,
        computed: snapshot.computed,
      },
      input,
    })
  );

  return core.apply(
    schema,
    snapshot,
    stripInternalGuards(concretePatches),
    HOST_CONTEXT
  );
}

async function runParityCycleBatch(options: {
  actionBody: string;
  actionName: string;
  initial: Record<string, unknown>;
  stateSource?: string;
  cycles: { intent: string; input?: Record<string, unknown> }[];
  assert?: (args: {
    legacyData: Record<string, unknown> | undefined;
    melData: Record<string, unknown> | undefined;
    legacyResult: Awaited<ReturnType<typeof runLegacyCycle>>;
    melResult: ReturnType<typeof runCompileMelPatchCycle>;
    cycle: { intent: string; input?: Record<string, unknown> };
    cycleIndex: number;
  }) => void;
}) {
  const compileResult = compileMelDomain(
    domainSource(options.actionBody, options.stateSource),
    { mode: "domain" }
  );
  expect(compileResult.errors).toHaveLength(0);
  expect(compileResult.schema).not.toBeNull();
  const schema = compileResult.schema as NonNullable<typeof compileResult.schema>;

  const core = createCore();

  const patchResult = compileMelPatch(options.actionBody, {
    mode: "patch",
    actionName: options.actionName,
  });
  expect(patchResult.errors).toHaveLength(0);

  let legacySnapshot = createSnapshot(options.initial, schema.hash, HOST_CONTEXT);
  let melSnapshot = createSnapshot(options.initial, schema.hash, HOST_CONTEXT);

  const history: {
    legacy: Awaited<ReturnType<typeof runLegacyCycle>>;
    mel: ReturnType<typeof runCompileMelPatchCycle>;
  }[] = [];

  for (const cycle of options.cycles) {
    const legacyResult = await runLegacyCycle(
      schema,
      core,
      legacySnapshot,
      cycle.intent,
      cycle.input
    );
    const melResult = runCompileMelPatchCycle(
      schema,
      core,
      melSnapshot,
      patchResult,
      cycle.intent,
      cycle.input
    );

    const legacyData = stripInternalState(legacyResult.snapshot.data);
    const melData = stripInternalState(melResult.data);

    if (options.assert) {
      options.assert({
        legacyData,
        melData,
        legacyResult,
        melResult,
        cycle,
        cycleIndex: history.length,
      });
    } else {
      expect(melData).toEqual(legacyData);
    }

    history.push({ legacy: legacyResult, mel: melResult });

    legacySnapshot = legacyResult.snapshot;
    melSnapshot = melResult;
  }

  return { schema, core, history };
}

describe("compileMelPatch legacy lowering parity", () => {
  it("matches when true/false branch semantics", async () => {
    const body = `
      when eq(count, 0) {
        patch count = add(count, 1)
        patch status = "updated"
      }
    `;

    const trueCase = await runParityCycleBatch({
      actionBody: body,
      actionName: "compat-when-true",
      initial: { count: 0, status: null, flag: null, x: 0, y: 0 },
      cycles: [{ intent: "when-true" }],
    });
    expect(trueCase.history[0].mel.data).toEqual({
      count: 1,
      status: "updated",
      flag: null,
      x: 0,
      y: 0,
    });

    const falseCase = await runParityCycleBatch({
      actionBody: body,
      actionName: "compat-when-false",
      initial: { count: 5, status: "ready", flag: null, x: 0, y: 0 },
      cycles: [{ intent: "when-false" }],
    });
    expect(falseCase.history[0].mel.data).toEqual({
      count: 5,
      status: "ready",
      flag: null,
      x: 0,
      y: 0,
    });
  });

  it("matches when block-entry snapshot for patch expressions", async () => {
    const body = `
      when eq(count, 0) {
        patch count = add(count, 1)
        patch flag = eq(count, 0)
      }
    `;

    const positive = await runParityCycleBatch({
      actionBody: body,
      actionName: "compat-when-entry-snapshot",
      initial: { count: 0, status: null, flag: null, x: 0, y: 0 },
      cycles: [{ intent: "when-entry-snapshot" }],
      assert: ({ melData }) => {
        expect(melData).toMatchObject({
          count: 1,
          flag: true,
          status: null,
          x: 0,
          y: 0,
        });
      },
    });

    const negative = await runParityCycleBatch({
      actionBody: body,
      actionName: "compat-when-entry-snapshot-false",
      initial: { count: 5, status: "ready", flag: null, x: 0, y: 0 },
      cycles: [{ intent: "when-entry-snapshot-false" }],
    });
    expect(negative.history[0].mel.data).toEqual({
      count: 5,
      status: "ready",
      flag: null,
      x: 0,
      y: 0,
    });
  });

  it("matches nested when semantics under outer-block entry snapshot", async () => {
    const body = `
      when eq(count, 0) {
        patch count = add(count, 1)
        when eq(count, 1) {
          patch status = "inner"
        }
        patch flag = true
      }
    `;

    const nestedResult = await runParityCycleBatch({
      actionBody: body,
      actionName: "compat-nested-when",
      initial: { count: 0, status: null, flag: null, x: 0, y: 0 },
      cycles: [{ intent: "nested-when" }],
    });

    expect(nestedResult.history[0].mel.data).toMatchObject({
      count: 1,
      status: "inner",
      flag: true,
      x: 0,
      y: 0,
    });
  });

  it("matches once marker semantics and monotonic execution", async () => {
    const body = `
      once(onceMarker) {
        patch count = add(count, 1)
        patch status = "once"
      }
    `;

    const onceResult = await runParityCycleBatch({
      actionBody: body,
      actionName: "compat-once-marker",
      initial: { count: 0, status: null, flag: null, x: 0, y: 0 },
      stateSource: DEFAULT_STATE_WITH_ONCE_MARKER,
      cycles: [{ intent: "once-A" }, { intent: "once-A" }, { intent: "once-B" }],
    });

    expect(onceResult.history[0].mel.data).toMatchObject({
      count: 1,
      status: "once",
      flag: null,
      onceMarker: "once-A",
      x: 0,
      y: 0,
    });
    expect(onceResult.history[1].mel.data).toEqual(onceResult.history[0].mel.data);
    expect(onceResult.history[2].mel.data).toMatchObject({
      count: 2,
      status: "once",
      flag: null,
      onceMarker: "once-B",
      x: 0,
      y: 0,
    });
  });

  it("matches onceIntent semantics per intent scope", async () => {
    const body = `
      onceIntent {
        patch count = add(count, 1)
        patch flag = eq(count, 0)
      }
    `;

    const onceIntentResult = await runParityCycleBatch({
      actionBody: body,
      actionName: "compat-once-intent",
      initial: { count: 0, status: null, flag: null, x: 0, y: 0 },
      cycles: [{ intent: "onceIntent-A" }, { intent: "onceIntent-A" }, { intent: "onceIntent-B" }],
      assert: ({ melData, cycleIndex }) => {
        if (cycleIndex === 0) {
          expect(melData).toMatchObject({
            count: 1,
            status: null,
            flag: true,
            x: 0,
            y: 0,
          });
        }

        if (cycleIndex === 1) {
          expect(melData).toMatchObject({
            count: 1,
            status: null,
            flag: true,
            x: 0,
            y: 0,
          });
        }

        if (cycleIndex === 2) {
          expect(melData).toMatchObject({
            count: 2,
            status: null,
            flag: false,
            x: 0,
            y: 0,
          });
        }
      },
    });
  });

  it("matches once/onceIntent nesting with when conditions", async () => {
    const onceWhenBody = `
      once(onceMarker) when eq(count, 0) {
        patch count = add(count, 1)
        patch status = "once-when"
      }
    `;

    const onceWhenResult = await runParityCycleBatch({
      actionBody: onceWhenBody,
      actionName: "compat-once-when",
      initial: { count: 0, status: null, flag: null, x: 0, y: 0 },
      stateSource: DEFAULT_STATE_WITH_ONCE_MARKER,
      cycles: [{ intent: "once-when-A" }, { intent: "once-when-A" }],
    });
    expect(onceWhenResult.history[0].mel.data).toMatchObject({
      count: 1,
      status: "once-when",
      x: 0,
      y: 0,
    });
    expect(onceWhenResult.history[1].mel.data).toEqual(onceWhenResult.history[0].mel.data);

    const onceIntentWhenBody = `
      onceIntent when eq(count, 0) {
        patch count = add(count, 1)
        patch status = "once-intent-when"
      }
    `;
    const onceIntentWhenResult = await runParityCycleBatch({
      actionBody: onceIntentWhenBody,
      actionName: "compat-once-intent-when",
      initial: { count: 0, status: null, flag: null, x: 0, y: 0 },
      cycles: [{ intent: "once-intent-when-A" }, { intent: "once-intent-when-B" }],
      assert: ({ melData, cycleIndex }) => {
        if (cycleIndex === 0) {
          expect(melData).toMatchObject({
            count: 1,
            status: "once-intent-when",
            x: 0,
            y: 0,
          });
        }

        if (cycleIndex === 1) {
          expect(melData).toMatchObject({
            count: 1,
            status: "once-intent-when",
            x: 0,
            y: 0,
          });
        }
      },
    });
  });

  it("regression for issue #107: once-evaluated once block entry snapshot", async () => {
    const body = `
      when eq(count, 0) {
        patch count = add(count, 1)
        patch flag = eq(count, 0)
      }
    `;

    const issueResult = await runParityCycleBatch({
      actionBody: body,
      actionName: "compat-issue-107",
      initial: { count: 0, status: null, flag: null, x: 0, y: 0 },
      cycles: [{ intent: "issue-107" }, { intent: "issue-107" }],
      assert: ({ melData, cycleIndex }) => {
        expect(melData).toMatchObject({
          count: 1,
          flag: true,
          x: 0,
          y: 0,
        });
        if (cycleIndex === 1) {
          expect(melData).toMatchObject({
            count: 1,
            flag: true,
          });
        }
      },
    });
  });
});
