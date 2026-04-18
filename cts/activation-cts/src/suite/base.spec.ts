import { describe, expect, it, vi } from "vitest";
import { semanticPathToPatchPath, type TraceGraph } from "@manifesto-ai/core";
import {
  AlreadyActivatedError,
  ManifestoError,
  createManifesto,
} from "@manifesto-ai/sdk";
import { caseTitle, ACTS_CASES } from "../acts-coverage.js";
import {
  evaluateRule,
  expectAllCompliance,
  noteEvidence,
} from "../assertions.js";
import { getRuleOrThrow } from "../acts-rules.js";
import {
  createCounterSchema,
  createHaltingSchema,
  withHash,
  type CounterDomain,
  type HaltingDomain,
} from "../helpers/schema.js";

const pp = semanticPathToPatchPath;

function normalizeTraceNodeTimestamps(
  node: TraceGraph["root"],
): TraceGraph["root"] {
  return {
    ...node,
    timestamp: 0,
    children: node.children.map(normalizeTraceNodeTimestamps),
  };
}

function normalizeSimulationTrace<T extends { diagnostics?: { trace: TraceGraph } }>(
  result: T,
): T {
  const trace = result.diagnostics?.trace;
  if (!trace) {
    return result;
  }

  return {
    ...result,
    diagnostics: {
      trace: {
        ...trace,
        root: normalizeTraceNodeTimestamps(trace.root),
        nodes: Object.fromEntries(
          Object.entries(trace.nodes).map(([id, value]) => [
            id,
            {
              ...value,
              timestamp: 0,
            },
          ]),
        ),
      },
    },
  };
}

describe("ACTS Base Suite", () => {
  it(
    caseTitle(
      ACTS_CASES.BASE_COMPOSABLE_SURFACE,
      "Base createManifesto() returns a composable object with no runtime verbs and one-shot activation.",
    ),
    () => {
      const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});
      const firstWorld = manifesto.activate();

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-1"),
          "activate" in manifesto
            && !("dispatchAsync" in manifesto)
            && !("dispatchAsyncWithReport" in manifesto)
            && !("subscribe" in manifesto)
            && !("getSnapshot" in manifesto),
          {
            passMessage: "Base composable exposes activation only and no runtime verbs.",
            failMessage: "Base composable leaked runtime verbs before activation.",
            evidence: [
              noteEvidence(
                "Checked base composable surface for activation-only contract.",
              ),
            ],
          },
        ),
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-2"),
          (() => {
            try {
              manifesto.activate();
              return false;
            } catch (error) {
              return error instanceof AlreadyActivatedError;
            }
          })(),
          {
            passMessage: "Base composable activation is one-shot.",
            failMessage: "Base composable allowed second activation.",
            evidence: [
              noteEvidence(
                "Second activation attempt threw AlreadyActivatedError.",
              ),
            ],
          },
        ),
      ]);

      firstWorld.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_ACTIVATION_CHAIN,
      "Base activation chain creates typed intents and executes dispatchAsync successfully.",
    ),
    async () => {
      const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const snapshot = await world.dispatchAsync(
        world.createIntent(world.MEL.actions.add, 2),
      );

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("ACTS-BASE-3"), snapshot.data.count === 2
          && world.getSnapshot().data.count === 2, {
          passMessage: "Base activation chain executed typed intent dispatch successfully.",
          failMessage: "Base activation chain did not publish the expected terminal snapshot.",
          evidence: [
            noteEvidence(
              "Executed createManifesto() -> activate() -> createIntent(MEL.actions.add) -> dispatchAsync().",
            ),
          ],
        }),
      ]);

      world.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_DEQUEUE_AVAILABILITY,
      "Queued intents are evaluated for availability at dequeue time, not enqueue time.",
    ),
    async () => {
      const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const rejected = vi.fn();
      world.on("dispatch:rejected", rejected);

      const first = world.dispatchAsync(
        world.createIntent(world.MEL.actions.increment),
      );
      const second = world.dispatchAsync(
        world.createIntent(world.MEL.actions.incrementIfEven),
      );

      await expect(first).resolves.toMatchObject({ data: { count: 1 } });
      await expect(second).rejects.toMatchObject({
        code: "ACTION_UNAVAILABLE",
      });

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-4"),
          world.getSnapshot().data.count === 1 && rejected.mock.calls.length === 1,
          {
            passMessage: "Base runtime checks availability at dequeue time and rejects without publication.",
            failMessage: "Queued action availability drifted from dequeue-time semantics.",
            evidence: [
              noteEvidence(
                "Queued increment then incrementIfEven and confirmed second action rejected after first changed state.",
              ),
            ],
          },
        ),
      ]);

      world.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_MUTATION_SAFETY,
      "Visible snapshot reads are read-only, mutation-safe, and do not leak external changes back in.",
    ),
    async () => {
      const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      await world.dispatchAsync(world.createIntent(world.MEL.actions.add, 3));

      const snapshot = world.getSnapshot();
      let threwOnMutation = false;

      try {
        (snapshot.data as { count: number }).count = 999;
      } catch (error) {
        threwOnMutation = error instanceof TypeError;
      }

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-5"),
          threwOnMutation && world.getSnapshot().data.count === 3,
          {
            passMessage: "Snapshot reads are read-only and mutation-safe.",
            failMessage: "Visible snapshot reads were mutable or leaked external mutation back into runtime state.",
            evidence: [
              noteEvidence(
                "Attempted to mutate count on a returned snapshot, confirmed TypeError, then re-read visible snapshot state.",
              ),
            ],
          },
        ),
      ]);

      world.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_INTROSPECTION_SURFACE,
      "Activated base runtime exposes getSchemaGraph() and simulate() as read-only introspection verbs.",
    ),
    () => {
      const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const graph = world.getSchemaGraph();
      const simulated = world.simulate(world.MEL.actions.increment);

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-6"),
          "getSchemaGraph" in world
            && "simulate" in world
            && Array.isArray(graph.nodes)
            && Array.isArray(graph.edges)
            && simulated.snapshot.data.count === 1
            && world.getSnapshot().data.count === 0,
          {
            passMessage: "Base runtime exposes getSchemaGraph() and simulate() without committing state.",
            failMessage: "Base runtime did not expose the introspection surface or simulate() committed state.",
            evidence: [
              noteEvidence("Observed graph nodes", graph.nodes),
              noteEvidence("Observed simulated snapshot", simulated.snapshot),
            ],
          },
        ),
      ]);

      world.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_SCHEMA_GRAPH_LOOKUP,
      "SchemaGraph lookup is ref-canonical, kind-prefixed string debug lookup remains supported, and projection excludes platform substrate.",
    ),
    () => {
      const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const graph = world.getSchemaGraph();
      const downstream = graph.traceDown(world.MEL.state.count);
      const upstream = graph.traceUp(world.MEL.actions.incrementIfEven);
      const debug = graph.traceDown("state:count");
      let rejectedPlainName = false;
      let rejectedMalformedId = false;

      try {
        graph.traceDown("count" as never);
      } catch (error) {
        rejectedPlainName = error instanceof ManifestoError && error.code === "SCHEMA_ERROR";
      }

      try {
        graph.traceDown("state:" as never);
      } catch (error) {
        rejectedMalformedId = error instanceof ManifestoError && error.code === "SCHEMA_ERROR";
      }

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-7"),
          graph.nodes.every((node) => !node.id.includes("$"))
            && graph.edges.every((edge) => !edge.from.includes("$") && !edge.to.includes("$"))
            && downstream.nodes.some((node) => node.id === "computed:doubled")
            && downstream.nodes.some((node) => node.id === "action:incrementIfEven")
            && upstream.nodes.some((node) => node.id === "state:count")
            && debug.nodes.some((node) => node.id === "state:count")
            && rejectedPlainName
            && rejectedMalformedId,
          {
            passMessage: "SchemaGraph respects projection and supports ref-canonical plus kind-prefixed debug lookup.",
            failMessage: "SchemaGraph lookup or projection semantics did not match the activation contract.",
            evidence: [
              noteEvidence("Observed graph", graph),
              noteEvidence("Downstream from state.count", downstream),
              noteEvidence("Upstream into incrementIfEven", upstream),
            ],
          },
        ),
      ]);

      world.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_SIMULATE_NON_COMMITTING,
      "simulate() is non-committing and returns projected snapshot, changedPaths, requirements, new availability, and optional diagnostics.trace.",
    ),
    () => {
      const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const before = world.getSnapshot();
      const simulated = world.simulate(world.MEL.actions.load);
      const after = world.getSnapshot();
      type NoOpProjectedDomain = {
        actions: {
          touchHostDirect: () => void;
        };
        state: {
          count: number;
        };
        computed: {};
      };
      const noOpWorld = createManifesto<NoOpProjectedDomain>(withHash({
        id: "manifesto:activation-cts-noop-simulate",
        version: "1.0.0",
        types: {},
        state: {
          fields: {
            count: { type: "number", required: false, default: 0 },
          },
        },
        computed: {
          fields: {},
        },
        actions: {
          touchHostDirect: {
            flow: {
              kind: "patch",
              op: "set",
              path: pp("count"),
              value: { kind: "get", path: "count" },
            },
          },
        },
      }), {}).activate();
      const noOpBefore = noOpWorld.getSnapshot();
      const firstNoOp = noOpWorld.simulate(noOpWorld.MEL.actions.touchHostDirect);
      const secondNoOp = noOpWorld.simulate(noOpWorld.MEL.actions.touchHostDirect);
      const noOpAfter = noOpWorld.getSnapshot();
      const normalizedFirstNoOp = normalizeSimulationTrace(firstNoOp);
      const normalizedSecondNoOp = normalizeSimulationTrace(secondNoOp);

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-8"),
          before.data.status === "idle"
            && after.data.status === "idle"
            && after.data.count === before.data.count
            && simulated.status === "pending"
            && simulated.snapshot.data.status === "loading"
            && simulated.requirements.length === 1
            && simulated.changedPaths.includes("data.status")
            && simulated.changedPaths.includes("system.status")
            && JSON.stringify(simulated.changedPaths) === JSON.stringify([...simulated.changedPaths].sort())
            && simulated.changedPaths.every((path) =>
              !path.includes("$")
              && path !== "system.pendingRequirements"
              && path !== "system.currentAction"),
          {
            passMessage: "simulate() stays non-committing and returns projected-only dry-run results.",
            failMessage: "simulate() committed runtime state or leaked canonical-only diff paths.",
            evidence: [
              noteEvidence("Observed simulated result", simulated),
              noteEvidence("Visible snapshot after simulate()", after),
            ],
          },
        ),
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-8"),
          firstNoOp.status === "complete"
            && firstNoOp.changedPaths.length === 0
            && firstNoOp.requirements.length === 0
            && JSON.stringify(normalizedFirstNoOp) === JSON.stringify(normalizedSecondNoOp)
            && JSON.stringify(noOpBefore) === JSON.stringify(noOpAfter),
          {
            passMessage: "Projected no-op simulation stays empty and repeatable.",
            failMessage: "Projected no-op simulation leaked changes or became unstable across repeated dry-runs.",
            evidence: [
              noteEvidence("First no-op simulate()", firstNoOp),
              noteEvidence("Second no-op simulate()", secondNoOp),
            ],
          },
        ),
      ]);

      world.dispose();
      noOpWorld.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_SIMULATE_HALTED,
      "simulate() preserves Core halted status without publishing runtime state.",
    ),
    () => {
      const world = createManifesto<HaltingDomain>(createHaltingSchema(), {}).activate();
      const simulated = world.simulate(world.MEL.actions.finalize);

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-9"),
          simulated.status === "halted"
            && simulated.changedPaths.length === 0
            && simulated.requirements.length === 0
            && world.getSnapshot().data.status === "idle",
          {
            passMessage: "simulate() preserves halted status without publishing state.",
            failMessage: "simulate() did not preserve halted status or published state unexpectedly.",
            evidence: [noteEvidence("Observed simulated result", simulated)],
          },
        ),
      ]);

      world.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_REPORT_SURFACE,
      "Activated base runtime exposes dispatchAsyncWithReport() as an additive companion and returns completed report bundles without changing dispatchAsync().",
    ),
    async () => {
      const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const report = await world.dispatchAsyncWithReport(
        world.createIntent(world.MEL.actions.add, 2),
      );

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-10"),
          "dispatchAsync" in world
            && "dispatchAsyncWithReport" in world
            && report.kind === "completed"
            && report.outcome.projected.beforeSnapshot.data.count === 0
            && report.outcome.projected.afterSnapshot.data.count === 2
            && report.outcome.projected.changedPaths.includes("data.count")
            && report.outcome.canonical.afterCanonicalSnapshot.data.count === 2
            && world.getSnapshot().data.count === 2,
          {
            passMessage: "Base runtime keeps dispatchAsync() and adds dispatchAsyncWithReport() with completed execution outcomes.",
            failMessage: "Base runtime did not expose the additive report surface or report the completed outcome correctly.",
            evidence: [
              noteEvidence("Observed dispatch report", report),
              noteEvidence("Visible snapshot after report dispatch", world.getSnapshot()),
            ],
          },
        ),
      ]);

      world.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_REPORT_REJECTION,
      "dispatchAsyncWithReport() preserves dequeue-time legality ordering and returns rejected report unions for blocked intents.",
    ),
    async () => {
      const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const first = world.dispatchAsync(
        world.createIntent(world.MEL.actions.increment),
      );
      const second = world.dispatchAsyncWithReport(
        world.createIntent(world.MEL.actions.incrementIfEven),
      );

      await expect(first).resolves.toMatchObject({ data: { count: 1 } });
      const report = await second;

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-11"),
          report.kind === "rejected"
            && report.rejection.code === "ACTION_UNAVAILABLE"
            && report.admission.failure.kind === "unavailable"
            && report.beforeSnapshot.data.count === 1
            && report.beforeCanonicalSnapshot.data.count === 1
            && world.getSnapshot().data.count === 1,
          {
            passMessage: "dispatchAsyncWithReport() preserves dequeue-time legality and returns rejected report unions without publication.",
            failMessage: "dispatchAsyncWithReport() drifted from dequeue-time legality semantics or published on rejection.",
            evidence: [
              noteEvidence("Observed rejected dispatch report", report),
              noteEvidence("Visible snapshot after queued rejection", world.getSnapshot()),
            ],
          },
        ),
      ]);

      world.dispose();
    },
  );
});
