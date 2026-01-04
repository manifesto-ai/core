/**
 * Integration tests with @manifesto-ai/world
 *
 * Tests the full pipeline: World → Authority → HostInterface → Effect Handler
 *
 * Note: We use a mock HostInterface that calls our effect-utils handlers,
 * since the actual Host maintains its own snapshot store separate from World.
 */
import { describe, it, expect, vi } from "vitest";
import { createManifestoWorld, } from "@manifesto-ai/world";
import { z } from "zod";
import { defineEffectSchema, createHandler, withRetry, withFallback, parallel, collectFulfilled, } from "../index.js";
// =============================================================================
// Test Fixtures
// =============================================================================
const TEST_SCHEMA_HASH = "test-schema-hash";
function createTestSnapshot(data = {}) {
    return {
        data,
        meta: {
            schemaHash: TEST_SCHEMA_HASH,
            version: 1,
            timestamp: Date.now(),
        },
        system: {
            status: "idle",
            lastError: null,
            errors: [],
            pendingRequirements: [],
            currentAction: null,
        },
        input: {},
        computed: {},
    };
}
function createTestIntent(type, input, actorId) {
    const intentId = `intent-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
        body: { type, input },
        intentId,
        intentKey: `key-${intentId}`,
        meta: {
            origin: {
                projectionId: "test:projection",
                source: { kind: "ui", eventId: `event-${Date.now()}` },
                actor: { actorId, kind: "human" },
            },
        },
    };
}
// Create a mock EffectContext for effect-utils handlers
function createMockContext(snapshot, params) {
    return {
        snapshot,
        requirement: {
            id: `req-${Date.now()}`,
            type: "test.effect",
            params,
            actionId: "test-action",
            flowPosition: { nodePath: "root", snapshotVersion: 0 },
            createdAt: Date.now(),
        },
    };
}
// Apply patches to snapshot (simplified for testing)
function applyPatches(snapshot, patches) {
    const newData = { ...snapshot.data };
    const newSystem = { ...snapshot.system };
    for (const patch of patches) {
        if (patch.op === "set") {
            const parts = patch.path.split(".");
            if (parts[0] === "data" && parts.length > 1) {
                newData[parts.slice(1).join(".")] = patch.value;
            }
            else if (parts[0] === "system" && parts.length > 1) {
                newSystem[parts[1]] = patch.value;
            }
        }
    }
    return {
        ...snapshot,
        data: newData,
        system: newSystem,
        meta: { ...snapshot.meta, version: snapshot.meta.version + 1 },
    };
}
/**
 * Creates a mock HostInterface that routes to effect-utils handlers
 */
function createMockHostWithHandlers(handlers, initialSnapshot) {
    let currentSnapshot = initialSnapshot ?? createTestSnapshot();
    const host = {
        dispatch: vi.fn().mockImplementation(async (intent) => {
            // Look up the handler for this intent type
            // In a real scenario, the flow would specify the effect type
            // For testing, we map intent types to effect types directly
            const effectType = `api.${intent.type.replace("-", ".")}`; // e.g., "fetch-user" -> "api.fetch.user"
            const handler = handlers.get(effectType) || handlers.get(intent.type);
            if (handler) {
                try {
                    const context = createMockContext(currentSnapshot, intent.input);
                    const patches = await handler(effectType, intent.input, context);
                    currentSnapshot = applyPatches(currentSnapshot, patches);
                    return { status: "complete", snapshot: currentSnapshot };
                }
                catch (error) {
                    return {
                        status: "error",
                        snapshot: applyPatches(currentSnapshot, [
                            {
                                op: "set",
                                path: "system.lastError",
                                value: { $error: true, message: error.message },
                            },
                        ]),
                    };
                }
            }
            // No handler found - simulate successful execution anyway
            return {
                status: "complete",
                snapshot: applyPatches(currentSnapshot, [
                    { op: "set", path: `data.${intent.type}Result`, value: intent.input },
                ]),
            };
        }),
    };
    return { host, getSnapshot: () => currentSnapshot };
}
// =============================================================================
// Tests
// =============================================================================
describe("World + Effect-Utils Integration", () => {
    describe("Effect Handler Registration", () => {
        it("should execute effect-utils handler through World → Host pipeline", async () => {
            // 1. Define effect schema with effect-utils
            const userSchema = defineEffectSchema({
                type: "api.user.fetch",
                input: z.object({ userId: z.string() }),
                output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
                outputPath: "data.user",
            });
            // 2. Create mock API
            const mockApi = vi.fn().mockResolvedValue({
                id: "user-123",
                name: "Alice",
                email: "alice@example.com",
            });
            // 3. Create handler with effect-utils
            const userHandler = createHandler(userSchema, async (input) => mockApi(input.userId));
            // 4. Create mock Host that routes to our handler
            const handlers = new Map();
            handlers.set("api.user.fetch", userHandler);
            handlers.set("fetch-user", userHandler); // Also map by intent type
            const { host, getSnapshot } = createMockHostWithHandlers(handlers);
            // 5. Create World with mock Host
            const world = createManifestoWorld({ schemaHash: TEST_SCHEMA_HASH, host });
            // 6. Register actor
            world.registerActor({ actorId: "test-user", kind: "human", name: "Test User" }, { mode: "auto_approve" });
            // 7. Create genesis
            const genesis = await world.createGenesis(createTestSnapshot());
            // 8. Submit intent
            const intent = createTestIntent("fetch-user", { userId: "user-123" }, "test-user");
            const result = await world.submitProposal("test-user", intent, genesis.worldId);
            // 9. Verify
            expect(result.proposal.status).toBe("completed");
            expect(mockApi).toHaveBeenCalledWith("user-123");
            // Verify the snapshot was updated via patches
            const finalSnapshot = getSnapshot();
            expect(finalSnapshot.data.user).toEqual({
                id: "user-123",
                name: "Alice",
                email: "alice@example.com",
            });
        });
        it("should handle effect-utils validation errors", async () => {
            const strictSchema = defineEffectSchema({
                type: "api.user.fetch",
                input: z.object({ userId: z.string().min(1) }),
                output: z.object({ id: z.string(), name: z.string() }),
                outputPath: "data.user",
            });
            const handler = createHandler(strictSchema, async (input) => ({
                id: input.userId,
                name: "Test",
            }));
            const handlers = new Map();
            handlers.set("fetch-user", handler);
            const { host, getSnapshot } = createMockHostWithHandlers(handlers);
            const world = createManifestoWorld({ schemaHash: TEST_SCHEMA_HASH, host });
            world.registerActor({ actorId: "test-user", kind: "human", name: "Test User" }, { mode: "auto_approve" });
            const genesis = await world.createGenesis(createTestSnapshot());
            // Invalid input - empty string
            const intent = createTestIntent("fetch-user", { userId: "" }, "test-user");
            const result = await world.submitProposal("test-user", intent, genesis.worldId);
            expect(result.proposal.status).toBe("completed");
            // Validation error should be in system.lastError
            const finalSnapshot = getSnapshot();
            expect(finalSnapshot.system.lastError).toBeDefined();
            expect(finalSnapshot.system.lastError?.$error).toBe(true);
        });
        it("should handle effect-utils implementation errors gracefully", async () => {
            const schema = defineEffectSchema({
                type: "api.user.fetch",
                input: z.object({ userId: z.string() }),
                output: z.object({ id: z.string() }),
                outputPath: "data.user",
            });
            // Handler that throws
            const handler = createHandler(schema, async () => {
                throw new Error("Network error");
            });
            const handlers = new Map();
            handlers.set("fetch-user", handler);
            const { host, getSnapshot } = createMockHostWithHandlers(handlers);
            const world = createManifestoWorld({ schemaHash: TEST_SCHEMA_HASH, host });
            world.registerActor({ actorId: "test-user", kind: "human", name: "Test" }, { mode: "auto_approve" });
            const genesis = await world.createGenesis(createTestSnapshot());
            const intent = createTestIntent("fetch-user", { userId: "1" }, "test-user");
            const result = await world.submitProposal("test-user", intent, genesis.worldId);
            // Handler should not throw - it returns error patches
            expect(result.proposal.status).toBe("completed");
            const finalSnapshot = getSnapshot();
            expect(finalSnapshot.system.lastError?.$error).toBe(true);
            expect(finalSnapshot.system.lastError?.message).toContain("Network error");
        });
    });
    describe("Parallel Aggregation Pattern", () => {
        it("should aggregate multiple API calls with partial failure", async () => {
            const aggregateSchema = defineEffectSchema({
                type: "api.signals.aggregate",
                input: z.object({ customerId: z.string() }),
                output: z.object({
                    ais: z.object({ vessel: z.string() }).nullable(),
                    weather: z.object({ temp: z.number() }).nullable(),
                    errors: z.record(z.string(), z.object({ code: z.string(), message: z.string() })),
                }),
                outputPath: "data.signals",
            });
            const aisApi = vi.fn().mockResolvedValue({ vessel: "Ship Alpha" });
            const weatherApi = vi.fn().mockRejectedValue(new Error("Weather timeout"));
            const aggregateHandler = createHandler(aggregateSchema, async (input) => {
                const results = await parallel({
                    ais: async () => aisApi(input.customerId),
                    weather: async () => weatherApi(input.customerId),
                })();
                const fulfilled = collectFulfilled(results);
                const errors = {};
                for (const [key, result] of Object.entries(results)) {
                    if (result.status === "rejected") {
                        errors[key] = { code: "FETCH_ERROR", message: result.reason.message };
                    }
                }
                return {
                    ais: fulfilled.ais ?? null,
                    weather: fulfilled.weather ?? null,
                    errors,
                };
            });
            const handlers = new Map();
            handlers.set("aggregate-signals", aggregateHandler);
            const { host, getSnapshot } = createMockHostWithHandlers(handlers);
            const world = createManifestoWorld({ schemaHash: TEST_SCHEMA_HASH, host });
            world.registerActor({ actorId: "system", kind: "system", name: "System" }, { mode: "auto_approve" });
            const genesis = await world.createGenesis(createTestSnapshot());
            const intent = createTestIntent("aggregate-signals", { customerId: "cust-123" }, "system");
            const result = await world.submitProposal("system", intent, genesis.worldId);
            expect(result.proposal.status).toBe("completed");
            const finalSnapshot = getSnapshot();
            expect(finalSnapshot.data.signals).toEqual({
                ais: { vessel: "Ship Alpha" },
                weather: null,
                errors: {
                    weather: { code: "FETCH_ERROR", message: "Weather timeout" },
                },
            });
        });
    });
    describe("Resilient Fetch with Combinators", () => {
        it("should retry and succeed on third attempt", async () => {
            const schema = defineEffectSchema({
                type: "api.resilient.fetch",
                input: z.object({ url: z.string() }),
                output: z.object({ data: z.string(), fromCache: z.boolean() }),
                outputPath: "data.result",
            });
            let callCount = 0;
            const mockFetch = vi.fn().mockImplementation(async () => {
                callCount++;
                if (callCount < 3) {
                    throw new Error("Temporary failure");
                }
                return { data: "fresh data", fromCache: false };
            });
            const mockCache = { data: "cached", fromCache: true };
            const handler = createHandler(schema, async () => {
                const resilientFetch = withFallback(withRetry(mockFetch, { maxRetries: 3, baseDelay: 0, backoff: "none" }), mockCache);
                return resilientFetch();
            });
            const handlers = new Map();
            handlers.set("resilient-fetch", handler);
            const { host, getSnapshot } = createMockHostWithHandlers(handlers);
            const world = createManifestoWorld({ schemaHash: TEST_SCHEMA_HASH, host });
            world.registerActor({ actorId: "app", kind: "system", name: "App" }, { mode: "auto_approve" });
            const genesis = await world.createGenesis(createTestSnapshot());
            const intent = createTestIntent("resilient-fetch", { url: "https://api.example.com" }, "app");
            const result = await world.submitProposal("app", intent, genesis.worldId);
            expect(result.proposal.status).toBe("completed");
            expect(mockFetch).toHaveBeenCalledTimes(3);
            const finalSnapshot = getSnapshot();
            expect(finalSnapshot.data.result).toEqual({ data: "fresh data", fromCache: false });
        });
        it("should fallback when all retries exhausted", async () => {
            const schema = defineEffectSchema({
                type: "api.resilient.fetch",
                input: z.object({ url: z.string() }),
                output: z.object({ data: z.string(), fromCache: z.boolean() }),
                outputPath: "data.result",
            });
            const mockFetch = vi.fn().mockRejectedValue(new Error("Service down"));
            const mockCache = { data: "cached data", fromCache: true };
            const handler = createHandler(schema, async () => {
                const resilientFetch = withFallback(withRetry(mockFetch, { maxRetries: 2, baseDelay: 0, backoff: "none" }), mockCache);
                return resilientFetch();
            });
            const handlers = new Map();
            handlers.set("resilient-fetch", handler);
            const { host, getSnapshot } = createMockHostWithHandlers(handlers);
            const world = createManifestoWorld({ schemaHash: TEST_SCHEMA_HASH, host });
            world.registerActor({ actorId: "app", kind: "system", name: "App" }, { mode: "auto_approve" });
            const genesis = await world.createGenesis(createTestSnapshot());
            const intent = createTestIntent("resilient-fetch", { url: "https://api.example.com" }, "app");
            const result = await world.submitProposal("app", intent, genesis.worldId);
            expect(result.proposal.status).toBe("completed");
            const finalSnapshot = getSnapshot();
            expect(finalSnapshot.data.result).toEqual({ data: "cached data", fromCache: true });
        });
    });
    describe("Authority Integration", () => {
        it("should execute effect after HITL approval", async () => {
            const schema = defineEffectSchema({
                type: "api.user.fetch",
                input: z.object({ userId: z.string() }),
                output: z.object({ id: z.string(), name: z.string() }),
                outputPath: "data.user",
            });
            const mockApi = vi.fn().mockResolvedValue({ id: "1", name: "Bob" });
            const handler = createHandler(schema, async (input) => mockApi(input.userId));
            const handlers = new Map();
            handlers.set("fetch-user", handler);
            const { host } = createMockHostWithHandlers(handlers);
            const onHITL = vi.fn();
            const world = createManifestoWorld({
                schemaHash: TEST_SCHEMA_HASH,
                host,
                onHITLRequired: onHITL,
            });
            const owner = { actorId: "owner", kind: "human", name: "Owner" };
            const agent = { actorId: "agent", kind: "agent", name: "Agent" };
            world.registerActor(owner, { mode: "auto_approve" });
            world.registerActor(agent, { mode: "hitl", delegate: owner });
            const genesis = await world.createGenesis(createTestSnapshot());
            // Agent submits - goes to pending
            const intent = createTestIntent("fetch-user", { userId: "1" }, "agent");
            const submitResult = await world.submitProposal("agent", intent, genesis.worldId);
            expect(submitResult.proposal.status).toBe("pending");
            expect(onHITL).toHaveBeenCalled();
            expect(mockApi).not.toHaveBeenCalled();
            // Owner approves
            const approveResult = await world.processHITLDecision(submitResult.proposal.proposalId, "approved", "OK");
            expect(approveResult.proposal.status).toBe("completed");
            expect(mockApi).toHaveBeenCalledWith("1");
        });
        it("should not execute effect on HITL rejection", async () => {
            const schema = defineEffectSchema({
                type: "api.user.fetch",
                input: z.object({ userId: z.string() }),
                output: z.object({ id: z.string() }),
                outputPath: "data.user",
            });
            const mockApi = vi.fn().mockResolvedValue({ id: "1" });
            const handler = createHandler(schema, async (input) => mockApi(input.userId));
            const handlers = new Map();
            handlers.set("fetch-user", handler);
            const { host } = createMockHostWithHandlers(handlers);
            const world = createManifestoWorld({
                schemaHash: TEST_SCHEMA_HASH,
                host,
                onHITLRequired: vi.fn(),
            });
            const owner = { actorId: "owner", kind: "human", name: "Owner" };
            const agent = { actorId: "agent", kind: "agent", name: "Agent" };
            world.registerActor(owner, { mode: "auto_approve" });
            world.registerActor(agent, { mode: "hitl", delegate: owner });
            const genesis = await world.createGenesis(createTestSnapshot());
            const intent = createTestIntent("fetch-user", { userId: "1" }, "agent");
            const submitResult = await world.submitProposal("agent", intent, genesis.worldId);
            // Owner rejects
            const rejectResult = await world.processHITLDecision(submitResult.proposal.proposalId, "rejected", "Denied");
            expect(rejectResult.proposal.status).toBe("rejected");
            expect(mockApi).not.toHaveBeenCalled();
            expect(rejectResult.resultWorld).toBeUndefined();
        });
        it("should auto-approve based on policy rules", async () => {
            const schema = defineEffectSchema({
                type: "api.user.fetch",
                input: z.object({ userId: z.string() }),
                output: z.object({ id: z.string() }),
                outputPath: "data.user",
            });
            const mockApi = vi.fn().mockResolvedValue({ id: "1" });
            const handler = createHandler(schema, async (input) => mockApi(input.userId));
            const handlers = new Map();
            handlers.set("fetch-user", handler);
            const { host } = createMockHostWithHandlers(handlers);
            const world = createManifestoWorld({ schemaHash: TEST_SCHEMA_HASH, host });
            // Policy: auto-approve "fetch-user"
            world.registerActor({ actorId: "bot", kind: "agent", name: "Bot" }, {
                mode: "policy_rules",
                rules: [
                    { condition: { kind: "intent_type", types: ["fetch-user"] }, decision: "approve" },
                ],
                defaultDecision: "reject",
            });
            const genesis = await world.createGenesis(createTestSnapshot());
            const intent = createTestIntent("fetch-user", { userId: "1" }, "bot");
            const result = await world.submitProposal("bot", intent, genesis.worldId);
            expect(result.proposal.status).toBe("completed");
            expect(mockApi).toHaveBeenCalled();
        });
    });
    describe("Sequential Effect Execution", () => {
        it("should execute effect-utils handlers across multiple sequential proposals", async () => {
            const schema = defineEffectSchema({
                type: "api.user.fetch",
                input: z.object({ userId: z.string() }),
                output: z.object({ id: z.string(), name: z.string() }),
                outputPath: "data.user",
            });
            let callCount = 0;
            const mockApi = vi.fn().mockImplementation(async (userId) => ({
                id: userId,
                name: `User ${++callCount}`,
            }));
            const handler = createHandler(schema, async (input) => mockApi(input.userId));
            const handlers = new Map();
            handlers.set("fetch-user", handler);
            const { host, getSnapshot } = createMockHostWithHandlers(handlers);
            const world = createManifestoWorld({ schemaHash: TEST_SCHEMA_HASH, host });
            world.registerActor({ actorId: "user", kind: "human", name: "User" }, { mode: "auto_approve" });
            const genesis = await world.createGenesis(createTestSnapshot());
            // First intent
            const intent1 = createTestIntent("fetch-user", { userId: "1" }, "user");
            const result1 = await world.submitProposal("user", intent1, genesis.worldId);
            expect(result1.proposal.status).toBe("completed");
            expect(mockApi).toHaveBeenCalledWith("1");
            // Second intent from first result
            const intent2 = createTestIntent("fetch-user", { userId: "2" }, "user");
            const result2 = await world.submitProposal("user", intent2, result1.resultWorld.worldId);
            expect(result2.proposal.status).toBe("completed");
            expect(mockApi).toHaveBeenCalledWith("2");
            expect(mockApi).toHaveBeenCalledTimes(2);
            // Verify both handlers were called and snapshot evolved
            const finalSnapshot = getSnapshot();
            expect(finalSnapshot.data.user).toEqual({ id: "2", name: "User 2" });
        });
    });
});
//# sourceMappingURL=world-integration.test.js.map