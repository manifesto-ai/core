import { describe, it, expect } from "vitest";
import { sequential } from "./sequential.js";
describe("sequential", () => {
    it("should execute functions in order", async () => {
        const order = [];
        const results = await sequential([
            async () => {
                order.push(1);
                return "a";
            },
            async () => {
                order.push(2);
                return "b";
            },
            async () => {
                order.push(3);
                return "c";
            },
        ])();
        expect(order).toEqual([1, 2, 3]);
        expect(results[0]).toEqual({ status: "fulfilled", value: "a" });
        expect(results[1]).toEqual({ status: "fulfilled", value: "b" });
        expect(results[2]).toEqual({ status: "fulfilled", value: "c" });
    });
    it("should continue on error when stopOnError is false", async () => {
        const results = await sequential([
            async () => "a",
            async () => {
                throw new Error("fail");
            },
            async () => "c",
        ])();
        expect(results[0]).toEqual({ status: "fulfilled", value: "a" });
        expect(results[1].status).toBe("rejected");
        expect(results[2]).toEqual({ status: "fulfilled", value: "c" });
    });
    it("should stop on error when stopOnError is true", async () => {
        const results = await sequential([
            async () => "a",
            async () => {
                throw new Error("fail");
            },
            async () => "c",
        ], { stopOnError: true })();
        expect(results.length).toBe(2);
        expect(results[0]).toEqual({ status: "fulfilled", value: "a" });
        expect(results[1].status).toBe("rejected");
    });
    it("should handle empty array", async () => {
        const results = await sequential([])();
        expect(results).toEqual([]);
    });
});
//# sourceMappingURL=sequential.test.js.map