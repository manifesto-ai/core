import { describe, expect, it } from "vitest";
import {
  semanticPathToPatchPath,
  type DomainSchema,
} from "@manifesto-ai/core";

import { createManifesto } from "../index.js";
import { withHash } from "./helpers/schema.js";

const pp = semanticPathToPatchPath;

type BrokenLegalityDomain = {
  actions: {
    badAvailability: () => void;
    badDispatchability: () => void;
    increment: () => void;
  };
  state: {
    count: number;
  };
  computed: {};
};

/**
 * Legality-evaluation ERROR path contract (#493 legality-channel workstream).
 *
 * When an `available` / `dispatchable` expression itself fails to evaluate
 * (here: TYPE_MISMATCH from a non-boolean result), the failure is a VALUE on
 * the admission channel: the action is not legal, check() reports a blocked
 * admission whose blocker message carries the evaluation error, and no
 * exception escapes the action-candidate surface.
 */
function createBrokenLegalitySchema(): DomainSchema {
  const incrementFlow = {
    kind: "patch",
    op: "set",
    path: pp("count"),
    value: {
      kind: "add",
      left: { kind: "get", path: "count" },
      right: { kind: "lit", value: 1 },
    },
  } as const;

  return withHash({
    id: "manifesto:sdk-v5-broken-legality",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
      },
    },
    computed: { fields: {} },
    actions: {
      badAvailability: {
        // Evaluates to a number — availability must be boolean.
        available: { kind: "get", path: "count" },
        flow: incrementFlow,
      },
      badDispatchability: {
        // Evaluates to a number — dispatchability must be boolean.
        dispatchable: { kind: "get", path: "count" },
        flow: incrementFlow,
      },
      increment: {
        flow: incrementFlow,
      },
    },
  });
}

function activate() {
  return createManifesto<BrokenLegalityDomain>(
    createBrokenLegalitySchema(),
    {},
  ).activate();
}

describe("admission error paths (legality evaluation failures)", () => {
  it("available() returns false when the availability expression is non-boolean", () => {
    const app = activate();

    expect(app.action.badAvailability.available()).toBe(false);
  });

  it("check() returns a blocked admission carrying the availability evaluation error", () => {
    const app = activate();

    const admission = app.action.badAvailability.check();
    expect(admission).toMatchObject({
      ok: false,
      layer: "availability",
      code: "ACTION_UNAVAILABLE",
    });
    if (!admission.ok) {
      expect(admission.blockers.length).toBeGreaterThan(0);
      expect(
        admission.blockers.some((blocker) =>
          blocker.message.includes("must return boolean"),
        ),
      ).toBe(true);
    }
  });

  it("check() reports dispatchability evaluation failures as blocked admissions", () => {
    const app = activate();

    const admission = app.action.badDispatchability.check();
    expect(admission).toMatchObject({
      ok: false,
      layer: "dispatchability",
      code: "INTENT_NOT_DISPATCHABLE",
    });
    if (!admission.ok) {
      expect(
        admission.blockers.some((blocker) =>
          blocker.message.includes("must return boolean"),
        ),
      ).toBe(true);
    }
  });

  it("inspect.availableActions() excludes broken actions instead of throwing", () => {
    const app = activate();

    const available = app.inspect.availableActions().map((info) => info.name);
    expect(available).not.toContain("badAvailability");
    expect(available).toContain("increment");
    // badDispatchability has no available clause, so it stays available.
    expect(available).toContain("badDispatchability");
  });

  it("a broken sibling action no longer poisons healthy dispatches", async () => {
    const app = activate();

    expect(app.action.increment.available()).toBe(true);
    expect(app.action.increment.check()).toMatchObject({ ok: true });

    const result = await app.action.increment.submit();
    expect(result.ok).toBe(true);
    expect(app.snapshot().state.count).toBe(1);
  });
});
