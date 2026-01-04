/**
 * Mock World Helpers
 *
 * Test fixtures and mock utilities for Lab package tests.
 */

import { vi } from "vitest";
import type {
  ManifestoWorld,
  Proposal,
  IntentInstance,
  ActorRef,
  WorldEvent,
  AuthorityResponse,
  ActorAuthorityBinding,
} from "@manifesto-ai/world";
import type { Snapshot } from "@manifesto-ai/core";
import type { LabOptions, LabWorld } from "../../types.js";

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a test snapshot.
 */
export function createTestSnapshot(
  data: Record<string, unknown> = {}
): Snapshot {
  return {
    data,
    meta: {
      schemaHash: "test-schema-hash",
      version: 1,
      timestamp: 0,
      randomSeed: "seed",
    },
    system: {
      status: "idle" as const,
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    input: {},
    computed: {},
  };
}

/**
 * Create a test intent.
 */
export function createTestIntent(
  type: string = "test-action",
  input: unknown = {}
): IntentInstance {
  const intentId = `intent-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    body: {
      type,
      input,
    },
    intentId,
    intentKey: `test-key-${intentId}`,
    meta: {
      origin: {
        projectionId: "test:projection",
        source: { kind: "ui" as const, eventId: `event-${Date.now()}` },
        actor: { actorId: "test-actor", kind: "human" as const },
      },
    },
  };
}

/**
 * Create a test actor.
 */
export function createTestActor(
  id: string,
  kind: "human" | "agent" | "system" = "agent"
): ActorRef {
  return {
    actorId: id,
    kind,
    name: `Test ${kind} ${id}`,
  };
}

/**
 * Create a test proposal.
 */
export function createTestProposal(
  actorId: string = "test-actor",
  intent?: IntentInstance
): Proposal {
  return {
    proposalId: `proposal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    actor: actorId,
    intent: intent ?? createTestIntent(),
    baseWorld: "test-world-id",
    status: "pending" as const,
    timestamp: Date.now(),
  };
}

/**
 * Create test lab options.
 */
export function createTestLabOptions(
  overrides: Partial<LabOptions> = {}
): LabOptions {
  return {
    runId: `test-run-${Date.now()}`,
    necessityLevel: 0,
    outputPath: "/tmp/lab-test",
    traceFormat: "json",
    projection: {
      enabled: false,
      mode: "silent",
    },
    hitl: {
      enabled: false,
    },
    ...overrides,
  };
}

// ============================================================================
// Mock World
// ============================================================================

export type MockWorldEventHandler = (event: WorldEvent) => void;

/**
 * Create a mock ManifestoWorld for testing.
 */
export function createMockWorld(): ManifestoWorld & {
  _emitEvent: (event: WorldEvent) => void;
  _handlers: Set<MockWorldEventHandler>;
} {
  const handlers = new Set<MockWorldEventHandler>();

  const emitEvent = (event: WorldEvent) => {
    for (const handler of handlers) {
      handler(event);
    }
  };

  return {
    _emitEvent: emitEvent,
    _handlers: handlers,

    schemaHash: "test-schema-hash",

    subscribe: vi.fn((handler: MockWorldEventHandler) => {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    }),

    getGenesis: vi.fn().mockResolvedValue(null),
    createGenesis: vi.fn().mockResolvedValue({
      worldId: "genesis-world",
      createdBy: null,
      snapshot: createTestSnapshot(),
      parentWorld: null,
      createdAt: Date.now(),
    }),

    getWorld: vi.fn().mockResolvedValue(null),
    getSnapshot: vi.fn().mockResolvedValue(createTestSnapshot()),

    registerActor: vi.fn(),
    getActor: vi.fn().mockReturnValue(null),
    hasActor: vi.fn().mockReturnValue(false),

    bindAuthority: vi.fn(),
    getAuthorityBinding: vi.fn().mockReturnValue(null),
    registerAuthority: vi.fn(),

    submitProposal: vi.fn().mockResolvedValue({
      proposalId: "test-proposal",
      status: "approved",
      resultWorld: {
        worldId: "result-world",
        createdBy: "test-proposal",
        snapshot: createTestSnapshot({ modified: true }),
        parentWorld: "genesis-world",
        createdAt: Date.now(),
      },
    }),

    processHITLDecision: vi.fn().mockResolvedValue(undefined),

    getProposal: vi.fn().mockResolvedValue(null),
    getProposals: vi.fn().mockResolvedValue([]),
  } as unknown as ManifestoWorld & {
    _emitEvent: (event: WorldEvent) => void;
    _handlers: Set<MockWorldEventHandler>;
  };
}

// ============================================================================
// Event Generators
// ============================================================================

/**
 * Create a proposal:submitted event.
 */
export function createProposalSubmittedEvent(
  proposal: Proposal = createTestProposal()
): WorldEvent {
  return {
    type: "proposal:submitted",
    timestamp: Date.now(),
    proposal,
    baseWorldId: proposal.baseWorld,
    actor: {
      actorId: proposal.actor,
      kind: "agent" as const,
      name: `Actor ${proposal.actor}`,
    },
  } as WorldEvent;
}

/**
 * Create a proposal:decided event.
 */
export function createProposalDecidedEvent(
  proposal: Proposal = createTestProposal(),
  decision: "approved" | "rejected" | "pending" = "approved"
): WorldEvent {
  return {
    type: "proposal:decided",
    timestamp: Date.now(),
    proposalId: proposal.proposalId,
    decision,
    authorityId: "test-authority",
    response: {
      kind: decision,
      approvedScope: null,
    } as AuthorityResponse,
  } as WorldEvent;
}

/**
 * Create a world:created event.
 */
export function createWorldCreatedEvent(
  worldId: string = "test-world",
  parentWorldId: string | null = null,
  proposalId: string | null = null
): WorldEvent {
  return {
    type: "world:created",
    timestamp: Date.now(),
    world: {
      worldId,
      createdBy: proposalId,
      snapshot: createTestSnapshot(),
      parentWorld: parentWorldId,
      createdAt: Date.now(),
    },
    parentWorldId,
    proposalId,
    snapshot: createTestSnapshot(),
  } as WorldEvent;
}

/**
 * Create an execution:patches event.
 */
export function createExecutionPatchesEvent(
  intentId: string = "test-intent",
  patchCount: number = 1
): WorldEvent {
  return {
    type: "execution:patches",
    timestamp: Date.now(),
    intentId,
    patches: Array(patchCount).fill({ op: "replace", path: "/test", value: 1 }),
    source: "compute" as const,
  } as WorldEvent;
}

/**
 * Create an execution:completed event.
 */
export function createExecutionCompletedEvent(
  proposalId: string = "test-proposal"
): WorldEvent {
  return {
    type: "execution:completed",
    timestamp: Date.now(),
    proposalId,
    resultWorldId: "result-world",
    snapshot: createTestSnapshot({ completed: true }),
  } as WorldEvent;
}
