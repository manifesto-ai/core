/**
 * Timing Compliance Tests (v2)
 *
 * Focus: ordering guarantees across hooks, queue, and action lifecycle.
 *
 * @see SPEC v2.0.0 §8, §11, §17
 */

import { describe, it, expect, vi } from "vitest";
import { createApp } from "../index.js";
import { createInMemoryWorldStore } from "../storage/world-store/index.js";
import { createSilentPolicyService } from "../runtime/policy/index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import type { Host, HostResult, Snapshot, Intent, ActionPhase } from "../core/types/index.js";
import { Timeline } from "./helpers/timeline.js";

// =============================================================================
// Test Helpers
// =============================================================================

function createTestSchema(): DomainSchema {
  return {
    id: "test:timing",
    version: "1.0.0",
    hash: "test-schema-timing",
    types: {},
    actions: {
      "todo.add": {
        flow: { kind: "seq", steps: [] },
      },
      "todo.remove": {
        flow: { kind: "seq", steps: [] },
      },
    },
    computed: { fields: {} },
    state: { fields: {} },
  };
}

function createSnapshot(schemaHash: string, data: Record<string, unknown> = {}): Snapshot {
  return {
    data,
    computed: {},
    input: {},
    system: {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    meta: {
      version: 0,
      timestamp: Date.now(),
      randomSeed: "test-seed",
      schemaHash,
    },
  };
}

function createTestHost(timeline: Timeline, schemaHash: string): Host {
  let currentSnapshot = createSnapshot(schemaHash);

  return {
    dispatch: async (intent: Intent): Promise<HostResult> => {
      timeline.mark("host:dispatch", { type: intent.type });

      const currentData = currentSnapshot.data as Record<string, unknown>;
      const nextSnapshot: Snapshot = {
        ...currentSnapshot,
        data: {
          ...currentData,
          lastIntent: intent.type,
        },
        meta: {
          ...currentSnapshot.meta,
          version: currentSnapshot.meta.version + 1,
        },
      };

      currentSnapshot = nextSnapshot;
      return { status: "complete", snapshot: nextSnapshot };
    },
    registerEffect: vi.fn(),
    getRegisteredEffectTypes: () => [],
  };
}

function expectPresent(index: number, label: string) {
  expect(index, `${label} missing`).toBeGreaterThanOrEqual(0);
}

// =============================================================================
// Test Suites
// =============================================================================

describe("Timing Compliance", () => {
  it("TIMING-1: core hook/dispatch ordering is preserved for a single action", async () => {
    const schema = createTestSchema();
    const timeline = new Timeline();
    const host = createTestHost(timeline, schema.hash);
    const worldStore = createInMemoryWorldStore();
    const policyService = createSilentPolicyService();

    const app = createApp({ schema, host, worldStore, policyService });
    app.hooks.on("action:preparing", (payload) => {
      timeline.mark("action:preparing", { proposalId: payload.proposalId });
    });
    app.hooks.on("action:submitted", (payload) => {
      timeline.mark("action:submitted", { proposalId: payload.proposalId });
    });
    app.hooks.on("state:publish", (payload) => {
      timeline.mark("state:publish", { worldId: payload.worldId });
    });
    app.hooks.on("action:completed", (payload) => {
      timeline.mark("action:completed", { proposalId: payload.proposalId });
    });

    await app.ready();

    const handle = app.act("todo.add", { title: "first" });
    await handle.done();
    timeline.mark("handle:done");

    const preparingIndex = timeline.indexOf("action:preparing");
    const submittedIndex = timeline.indexOf("action:submitted");
    const dispatchIndex = timeline.indexOf("host:dispatch");
    const publishIndex = timeline.indexOf("state:publish");
    const completedIndex = timeline.indexOf("action:completed");
    const doneIndex = timeline.indexOf("handle:done");

    expectPresent(preparingIndex, "action:preparing");
    expectPresent(submittedIndex, "action:submitted");
    expectPresent(dispatchIndex, "host:dispatch");
    expectPresent(completedIndex, "action:completed");
    expectPresent(doneIndex, "handle:done");

    expect(preparingIndex).toBeLessThan(submittedIndex);
    expect(submittedIndex).toBeLessThan(dispatchIndex);
    expect(completedIndex).toBeLessThan(doneIndex);
    if (publishIndex >= 0) {
      expect(publishIndex).toBeGreaterThanOrEqual(preparingIndex);
    }
  });

  it("TIMING-2: enqueueAction defers until hook completes and queues after first action", async () => {
    const schema = createTestSchema();
    const timeline = new Timeline();
    const host = createTestHost(timeline, schema.hash);
    const worldStore = createInMemoryWorldStore();
    const policyService = createSilentPolicyService();

    const app = createApp({ schema, host, worldStore, policyService });
    let secondProposalId: string | null = null;
    let firstProposalId: string | null = null;

    const secondCompleted = new Promise<void>((resolve) => {
      app.hooks.on("action:completed", (payload) => {
        if (payload.proposalId === firstProposalId) {
          timeline.mark("action:completed:first");
        }
        if (payload.proposalId === secondProposalId) {
          timeline.mark("action:completed:second");
          resolve();
        }
      });
    });

    app.hooks.on("action:preparing", (payload, ctx) => {
      if (payload.type === "todo.add") {
        firstProposalId = payload.proposalId;
        timeline.mark("hook:preparing:first:enter");
        secondProposalId = ctx.app.enqueueAction("todo.remove", {});
        timeline.mark("hook:preparing:first:exit");
        return;
      }
      if (payload.type === "todo.remove") {
        timeline.mark("action:preparing:second");
      }
    });

    await app.ready();

    await app.act("todo.add", { title: "first" }).done();
    await secondCompleted;

    const hookExitIndex = timeline.indexOf("hook:preparing:first:exit");
    const secondPreparingIndex = timeline.indexOf("action:preparing:second");

    expectPresent(hookExitIndex, "hook:preparing:first:exit");
    expectPresent(secondPreparingIndex, "action:preparing:second");

    expect(hookExitIndex).toBeLessThan(secondPreparingIndex);
  });

  it("TIMING-3: ActionHandle phases progress monotonically", async () => {
    const schema = createTestSchema();
    const timeline = new Timeline();
    const host = createTestHost(timeline, schema.hash);
    const worldStore = createInMemoryWorldStore();
    const policyService = createSilentPolicyService();

    const app = createApp({ schema, host, worldStore, policyService });
    await app.ready();

    const phases: ActionPhase[] = [];
    const handle = app.act("todo.add", { title: "phase" });
    handle.subscribe((update) => {
      phases.push(update.phase);
    });

    await handle.done();

    const expected: ActionPhase[] = [
      "submitted",
      "evaluating",
      "approved",
      "executing",
      "completed",
    ];
    let lastIndex = -1;
    for (const phase of expected) {
      const index = phases.indexOf(phase);
      expect(index, `missing phase ${phase}`).toBeGreaterThanOrEqual(0);
      expect(index, `phase ${phase} out of order`).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });
});
