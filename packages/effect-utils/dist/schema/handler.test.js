import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineEffectSchema } from "./define.js";
import { createHandler } from "./handler.js";
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
describe("defineEffectSchema", () => {
    it("should define a schema with type inference", () => {
        const schema = defineEffectSchema({
            type: "api.user.fetch",
            input: z.object({ userId: z.string() }),
            output: z.object({ name: z.string() }),
            outputPath: "data.user",
        });
        expect(schema.type).toBe("api.user.fetch");
        expect(schema.outputPath).toBe("data.user");
    });
});
describe("createHandler", () => {
    const userSchema = defineEffectSchema({
        type: "api.user.fetch",
        input: z.object({ userId: z.string() }),
        output: z.object({ id: z.string(), name: z.string() }),
        outputPath: "data.user",
    });
    it("should return success patch on valid input/output", async () => {
        const handler = createHandler(userSchema, async (input) => ({
            id: input.userId,
            name: "Alice",
        }));
        const patches = await handler("api.user.fetch", { userId: "123" }, createMockContext());
        expect(patches).toHaveLength(1);
        expect(patches[0]).toEqual({
            op: "set",
            path: "data.user",
            value: { id: "123", name: "Alice" },
        });
    });
    it("should return error patches on invalid input", async () => {
        const handler = createHandler(userSchema, async (input) => ({
            id: input.userId,
            name: "Alice",
        }));
        const patches = await handler("api.user.fetch", { userId: 123 }, // Invalid: should be string
        createMockContext());
        expect(patches.length).toBeGreaterThan(1);
        expect(patches[0].path).toBe("system.lastError");
        expect(patches[0].op).toBe("set");
        if (patches[0].op === "set") {
            expect(patches[0].value.code).toBe("ValidationError");
        }
    });
    it("should return error patches on implementation error", async () => {
        const handler = createHandler(userSchema, async () => {
            throw new Error("Network error");
        });
        const patches = await handler("api.user.fetch", { userId: "123" }, createMockContext());
        expect(patches.some((p) => p.path === "system.lastError")).toBe(true);
        expect(patches.some((p) => p.path === "data.user" && p.op === "set" && p.value === null)).toBe(true);
    });
    it("should never throw", async () => {
        const handler = createHandler(userSchema, async () => {
            throw new Error("Should be caught");
        });
        // Should not throw
        const patches = await handler("api.user.fetch", { userId: "123" }, createMockContext());
        expect(Array.isArray(patches)).toBe(true);
    });
    it("should validate output schema", async () => {
        const handler = createHandler(userSchema, async () => ({
            id: "123",
            // Missing 'name' field
        }));
        const patches = await handler("api.user.fetch", { userId: "123" }, createMockContext());
        expect(patches[0].path).toBe("system.lastError");
        expect(patches[0].op).toBe("set");
        if (patches[0].op === "set") {
            expect(patches[0].value.code).toBe("ValidationError");
        }
    });
});
//# sourceMappingURL=handler.test.js.map