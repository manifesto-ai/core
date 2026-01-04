import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { 
// Combinators
withTimeout, withRetry, withFallback, parallel, sequential, toPatches, collectErrors, collectFulfilled, 
// Schema
defineEffectSchema, createHandler, 
// Errors
TimeoutError, RetryError, } from "../index.js";
// Mock EffectContext
const createMockContext = () => ({
    snapshot: {
        data: {},
        computed: {},
        system: {
            status: "idle",
            lastError: null,
            errors: [],
            pendingRequirements: [],
            currentAction: null,
        },
        input: undefined,
        meta: {
            version: 0,
            timestamp: Date.now(),
            schemaHash: "",
        },
    },
    requirement: {
        id: "test-req-1",
        type: "test.effect",
        params: {},
        actionId: "test-action-1",
        flowPosition: {
            nodePath: "root",
            snapshotVersion: 0,
        },
        createdAt: Date.now(),
    },
});
describe("Integration: Composed Combinators", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it("should compose withRetry + withTimeout", async () => {
        let callCount = 0;
        const fn = async () => {
            callCount++;
            if (callCount < 3) {
                // First two calls timeout
                await new Promise((r) => setTimeout(r, 200));
                return "too slow";
            }
            return "success";
        };
        const resilientFn = withRetry(withTimeout(fn, 100), {
            maxRetries: 3,
            baseDelay: 50,
        });
        const promise = resilientFn();
        // Catch to prevent unhandled rejection during timer advancement
        promise.catch(() => { });
        // Advance timers for timeouts and retries
        await vi.runAllTimersAsync();
        const result = await promise;
        expect(result).toBe("success");
        expect(callCount).toBe(3);
    });
    it("should use fallback when retry exhausted", async () => {
        const fn = async () => {
            throw new Error("always fail");
        };
        const resilientFn = withFallback(withRetry(fn, { maxRetries: 2, baseDelay: 10 }), "fallback value");
        const promise = resilientFn();
        await vi.runAllTimersAsync();
        const result = await promise;
        expect(result).toBe("fallback value");
    });
    it("should compose withTimeout + withFallback", async () => {
        const slowFn = async () => {
            await new Promise((r) => setTimeout(r, 200));
            return "slow result";
        };
        const fastFallback = withFallback(withTimeout(slowFn, 100), "fast fallback");
        const promise = fastFallback();
        await vi.runAllTimersAsync();
        const result = await promise;
        expect(result).toBe("fast fallback");
    });
});
describe("Integration: Parallel with Transforms", () => {
    it("should aggregate partial failures with collectErrors and collectFulfilled", async () => {
        const results = await parallel({
            api1: async () => ({ data: "from api1" }),
            api2: async () => {
                throw new Error("API2 unavailable");
            },
            api3: async () => ({ data: "from api3" }),
        })();
        // Collect fulfilled values
        const fulfilled = collectFulfilled(results);
        expect(fulfilled).toEqual({
            api1: { data: "from api1" },
            api3: { data: "from api3" },
        });
        // Collect errors as patches
        const errorPatches = collectErrors(results, "data.apiErrors");
        expect(errorPatches).toHaveLength(1);
        expect(errorPatches[0].path).toBe("data.apiErrors");
        if (errorPatches[0].op === "set") {
            expect(errorPatches[0].value).toMatchObject({
                api2: { $error: true, message: "API2 unavailable" },
            });
        }
    });
    it("should create patches from parallel results", async () => {
        const results = await parallel({
            user: async () => ({ id: "1", name: "Alice" }),
            config: async () => ({ theme: "dark" }),
        })();
        const fulfilled = collectFulfilled(results);
        const patches = toPatches({
            "data.user": fulfilled.user,
            "data.config": fulfilled.config,
        });
        expect(patches).toHaveLength(2);
        expect(patches).toContainEqual({
            op: "set",
            path: "data.user",
            value: { id: "1", name: "Alice" },
        });
        expect(patches).toContainEqual({
            op: "set",
            path: "data.config",
            value: { theme: "dark" },
        });
    });
});
describe("Integration: Sequential Pipeline", () => {
    it("should execute pipeline steps in order with stopOnError", async () => {
        const executionOrder = [];
        const results = await sequential([
            async () => {
                executionOrder.push("step1");
                return { validated: true };
            },
            async () => {
                executionOrder.push("step2");
                throw new Error("Transformation failed");
            },
            async () => {
                executionOrder.push("step3");
                return { saved: true };
            },
        ], { stopOnError: true })();
        expect(executionOrder).toEqual(["step1", "step2"]);
        expect(results).toHaveLength(2);
        expect(results[0]).toEqual({ status: "fulfilled", value: { validated: true } });
        expect(results[1].status).toBe("rejected");
    });
});
describe("Integration: Full Handler Flow", () => {
    const userSchema = defineEffectSchema({
        type: "api.user.fetch",
        input: z.object({
            userId: z.string(),
            includeProfile: z.boolean().default(false),
        }),
        output: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            profile: z
                .object({
                avatar: z.string(),
                bio: z.string(),
            })
                .optional(),
        }),
        outputPath: "data.user",
        description: "Fetches user data by ID",
    });
    it("should create handler that returns valid patches on success", async () => {
        // Simulate API response
        const mockApiResponse = {
            id: "user-123",
            name: "Alice",
            email: "alice@example.com",
            profile: {
                avatar: "https://example.com/avatar.png",
                bio: "Software developer",
            },
        };
        const handler = createHandler(userSchema, async (input) => {
            // Simulated fetch
            return {
                id: input.userId,
                name: mockApiResponse.name,
                email: mockApiResponse.email,
                profile: input.includeProfile ? mockApiResponse.profile : undefined,
            };
        });
        const patches = await handler("api.user.fetch", { userId: "user-123", includeProfile: true }, createMockContext());
        expect(patches).toHaveLength(1);
        expect(patches[0]).toEqual({
            op: "set",
            path: "data.user",
            value: {
                id: "user-123",
                name: "Alice",
                email: "alice@example.com",
                profile: {
                    avatar: "https://example.com/avatar.png",
                    bio: "Software developer",
                },
            },
        });
    });
    it("should handle network errors gracefully", async () => {
        const handler = createHandler(userSchema, async () => {
            throw new Error("Network timeout");
        });
        const patches = await handler("api.user.fetch", { userId: "user-123" }, createMockContext());
        // Should have error patch and null output patch
        expect(patches.length).toBeGreaterThan(1);
        const errorPatch = patches.find((p) => p.path === "system.lastError");
        expect(errorPatch).toBeDefined();
        expect(errorPatch?.op).toBe("set");
        if (errorPatch?.op === "set") {
            expect(errorPatch.value).toMatchObject({
                $error: true,
                message: "Network timeout",
            });
        }
        const outputPatch = patches.find((p) => p.path === "data.user");
        expect(outputPatch).toBeDefined();
        expect(outputPatch?.op).toBe("set");
        if (outputPatch?.op === "set") {
            expect(outputPatch.value).toBeNull();
        }
    });
});
describe("Integration: Resilient API Call Pattern (SPEC §9.1)", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it("should implement resilient fetch with retry, timeout, and fallback", async () => {
        let callCount = 0;
        const mockFetch = async () => {
            callCount++;
            if (callCount < 3) {
                throw new Error("Temporary failure");
            }
            return { data: "fresh data", fromCache: false };
        };
        const mockCache = { data: "cached data", fromCache: true };
        const resilientFetch = withFallback(withRetry(withTimeout(mockFetch, 5000), {
            maxRetries: 2,
            backoff: "exponential",
            baseDelay: 100,
        }), mockCache);
        const promise = resilientFetch();
        await vi.runAllTimersAsync();
        const result = await promise;
        expect(result).toEqual({ data: "fresh data", fromCache: false });
        expect(callCount).toBe(3);
    });
    it("should fallback to cache when all retries fail", async () => {
        const mockFetch = async () => {
            throw new Error("Service unavailable");
        };
        const mockCache = { data: "cached data", fromCache: true };
        const resilientFetch = withFallback(withRetry(mockFetch, {
            maxRetries: 2,
            baseDelay: 50,
        }), mockCache);
        const promise = resilientFetch();
        await vi.runAllTimersAsync();
        const result = await promise;
        expect(result).toEqual({ data: "cached data", fromCache: true });
    });
});
describe("Integration: Parallel Aggregation Pattern (SPEC §9.2)", () => {
    it("should aggregate multiple API calls with partial failure handling", async () => {
        const aggregateSignals = async () => {
            const results = await parallel({
                ais: async () => ({ vessel: "Ship A", position: { lat: 1, lng: 2 } }),
                tos: async () => {
                    throw new Error("TOS service timeout");
                },
                weather: async () => ({ temp: 25, wind: 10 }),
            })();
            // Build response with graceful degradation
            const fulfilled = collectFulfilled(results);
            const errors = {};
            for (const [key, result] of Object.entries(results)) {
                if (result.status === "rejected") {
                    errors[key] = {
                        code: "FETCH_ERROR",
                        message: result.reason.message,
                    };
                }
            }
            return {
                ais: fulfilled.ais ?? null,
                tos: fulfilled.tos ?? null,
                weather: fulfilled.weather ?? null,
                errors,
            };
        };
        const result = await aggregateSignals();
        expect(result.ais).toEqual({ vessel: "Ship A", position: { lat: 1, lng: 2 } });
        expect(result.tos).toBeNull();
        expect(result.weather).toEqual({ temp: 25, wind: 10 });
        expect(result.errors).toEqual({
            tos: { code: "FETCH_ERROR", message: "TOS service timeout" },
        });
    });
});
describe("Integration: Error Types", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it("should produce TimeoutError with correct properties", async () => {
        const slowFn = async () => {
            await new Promise((r) => setTimeout(r, 200));
            return "result";
        };
        const timedFn = withTimeout(slowFn, 100);
        const promise = timedFn();
        // Catch and advance timers
        let caughtError;
        promise.catch((e) => {
            caughtError = e;
        });
        await vi.advanceTimersByTimeAsync(150);
        expect(caughtError).toBeInstanceOf(TimeoutError);
        expect(caughtError.ms).toBe(100);
        expect(caughtError.code).toBe("TIMEOUT_ERROR");
    });
    it("should produce RetryError with attempt count", async () => {
        const failingFn = async () => {
            throw new Error("Always fails");
        };
        const retryFn = withRetry(failingFn, { maxRetries: 3, baseDelay: 10 });
        const promise = retryFn();
        promise.catch(() => { });
        await vi.runAllTimersAsync();
        try {
            await promise;
        }
        catch (e) {
            expect(e).toBeInstanceOf(RetryError);
            expect(e.attempts).toBe(4); // 1 initial + 3 retries
            expect(e.code).toBe("RETRY_EXHAUSTED");
        }
    });
});
//# sourceMappingURL=integration.test.js.map