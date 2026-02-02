/**
 * Policy Service Tests (Standard Compliance)
 *
 * @see SPEC v2.0.0 §10
 * @see FDR-APP-POLICY-001
 */

import { describe, it, expect } from "vitest";
import {
  createSilentPolicyService,
  createStrictPolicyService,
  createRestrictedScope,
} from "../runtime/policy/index.js";
import type { Proposal, Snapshot } from "../core/types/index.js";
import { createWorldId } from "@manifesto-ai/world";

function createProposal(overrides?: Partial<Proposal>): Proposal {
  return {
    proposalId: "prop-1",
    actorId: "actor-1",
    intentType: "todo.add",
    intentBody: { title: "Test" },
    baseWorld: createWorldId("world-1"),
    createdAt: 0,
    ...overrides,
  };
}

function createSnapshot(overrides?: Partial<Snapshot>): Snapshot {
  return {
    data: {},
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
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "schema-1",
    },
    ...overrides,
  };
}

describe("PolicyService", () => {
  it("EXK-POLICY-2: ExecutionKey is deterministic for same proposal", () => {
    const policy = createSilentPolicyService(
      (p) => `key:${p.actorId}:${p.intentType}`
    );

    const proposal = createProposal();
    const key1 = policy.deriveExecutionKey(proposal);
    const key2 = policy.deriveExecutionKey({ ...proposal });

    expect(key1).toBe(key2);
  });

  it("ROUTE-3: Authority approval includes ApprovedScope", async () => {
    const policy = createSilentPolicyService();
    const decision = await policy.requestApproval(createProposal());

    expect(decision.approved).toBe(true);
    expect(decision.scope).toBeDefined();
    expect(decision.scope?.allowedPaths.length).toBeGreaterThan(0);
  });

  it("SCOPE-2: validateScope rejects disallowed intentType", () => {
    const policy = createStrictPolicyService();
    const scope = createRestrictedScope(["data.count"], {
      constraints: { "todo.add": false },
    });

    const result = policy.validateScope(createProposal(), scope);

    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it("SCOPE-PATH-1: validateResultScope ignores computed/input and data.$host/$mel", () => {
    const policy = createStrictPolicyService();
    const scope = createRestrictedScope(["data.count"]);

    const base = createSnapshot({
      data: { count: 0, $host: { cache: 1 }, $mel: { guards: { intent: { g1: "i1" } } } },
      computed: { total: 1 },
      input: { query: "a" },
    });

    const terminal = createSnapshot({
      data: { count: 1, $host: { cache: 2 }, $mel: { guards: { intent: { g1: "i1" } } } },
      computed: { total: 2 },
      input: { query: "b" },
    });

    const result = policy.validateResultScope(base, terminal, scope);

    expect(result.valid).toBe(true);
  });
});
