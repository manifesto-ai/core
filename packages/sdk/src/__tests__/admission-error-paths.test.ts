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
 * Characterization tests for the legality-evaluation ERROR path.
 *
 * These pin the current behavior at the seam the #493 legality-channel
 * workstream will rework: when an `available` / `dispatchable` expression
 * itself fails to evaluate (here: TYPE_MISMATCH from a non-boolean result),
 * the core query wrappers throw and the exception escapes through the SDK
 * action-candidate surface instead of becoming an admission value.
 *
 * When the workstream lands (core evaluate* exports + kernel rewiring),
 * update these assertions to the new value-based contract — that diff is
 * the point of this file.
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

describe("admission error paths (legality evaluation failures)", () => {
  it("available() currently throws when the availability expression is non-boolean", () => {
    const app = createManifesto<BrokenLegalityDomain>(
      createBrokenLegalitySchema(),
      {},
    ).activate();

    expect(() => app.action.badAvailability.available()).toThrow(
      /Availability condition must return boolean/,
    );
  });

  it("check() currently throws instead of returning a blocked admission when availability evaluation fails", () => {
    const app = createManifesto<BrokenLegalityDomain>(
      createBrokenLegalitySchema(),
      {},
    ).activate();

    expect(() => app.action.badAvailability.check()).toThrow(
      /Availability condition must return boolean/,
    );
  });

  it("check() currently throws instead of returning a blocked admission when dispatchability evaluation fails", () => {
    const app = createManifesto<BrokenLegalityDomain>(
      createBrokenLegalitySchema(),
      {},
    ).activate();

    expect(() => app.action.badDispatchability.check()).toThrow(
      /Dispatchability condition must return boolean|must return boolean/,
    );
  });

  it("inspect.availableActions() currently throws when any action has a broken availability expression", () => {
    const app = createManifesto<BrokenLegalityDomain>(
      createBrokenLegalitySchema(),
      {},
    ).activate();

    expect(() => app.inspect.availableActions()).toThrow(
      /must return boolean/,
    );
  });

  it("a healthy action admits, but its submit() is currently poisoned by a broken sibling action", async () => {
    const app = createManifesto<BrokenLegalityDomain>(
      createBrokenLegalitySchema(),
      {},
    ).activate();

    // Admission of the healthy action itself works…
    expect(app.action.increment.available()).toBe(true);
    expect(app.action.increment.check()).toMatchObject({ ok: true });

    // …but the post-dispatch execution report derives newAvailableActions by
    // evaluating EVERY action's availability, so one broken expression in the
    // domain currently fails every dispatch (blast radius of the throwing
    // legality queries).
    await expect(app.action.increment.submit()).rejects.toThrow(
      /Availability condition must return boolean/,
    );
  });
});
