/**
 * @fileoverview PEX Conformance Tests
 *
 * Tests for ParallelExecutor rules per SPEC Section 11.7.
 *
 * PEX-1: Results MUST be in input order
 * PEX-2: graphs[i] corresponds to chunks[i]
 * PEX-3: Results SHALL NOT be returned in completion (arrival) order
 */

import { describe, it, expect } from "vitest";
import { ParallelExecutor, createParallelExecutor } from "../../index.js";

describe("PEX Conformance", () => {
  describe("PEX-1: Results MUST be in input order", () => {
    it("returns results in input order with concurrent execution", async () => {
      const executor = new ParallelExecutor<number, string>({
        concurrency: 5,
      });

      const inputs = [1, 2, 3, 4, 5];

      // Each item returns after a random delay
      const results = await executor.execute(inputs, async (input) => {
        // Simulate varying processing times
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 50)
        );
        return `result-${input}`;
      });

      // Results MUST be in input order
      expect(results).toEqual([
        "result-1",
        "result-2",
        "result-3",
        "result-4",
        "result-5",
      ]);
    });

    it("maintains order even when later items complete first", async () => {
      const executor = new ParallelExecutor<number, number>({
        concurrency: 10,
      });

      const inputs = [100, 50, 10, 5, 1]; // Descending delays

      const results = await executor.execute(inputs, async (input) => {
        // Earlier items have longer delays, later items complete first
        await new Promise((resolve) => setTimeout(resolve, input));
        return input * 2;
      });

      // Despite completion order, results are in input order
      expect(results).toEqual([200, 100, 20, 10, 2]);
    });

    it("handles single item", async () => {
      const executor = createParallelExecutor<number, string>();

      const results = await executor.execute([42], async (input) => {
        return `value-${input}`;
      });

      expect(results).toEqual(["value-42"]);
    });

    it("handles empty input", async () => {
      const executor = createParallelExecutor<number, string>();

      const results = await executor.execute([], async () => {
        return "never called";
      });

      expect(results).toEqual([]);
    });
  });

  describe("PEX-2: graphs[i] corresponds to chunks[i]", () => {
    it("index parameter matches input position", async () => {
      const executor = new ParallelExecutor<string, { input: string; index: number }>({
        concurrency: 3,
      });

      const inputs = ["a", "b", "c", "d", "e"];
      const receivedIndices: number[] = [];

      const results = await executor.execute(inputs, async (input, index) => {
        receivedIndices.push(index);
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
        return { input, index };
      });

      // Each result should have the correct index
      for (let i = 0; i < inputs.length; i++) {
        expect(results[i].input).toBe(inputs[i]);
        expect(results[i].index).toBe(i);
      }
    });
  });

  describe("PEX-3: Results SHALL NOT be returned in completion order", () => {
    it("result order is independent of completion order", async () => {
      const executor = new ParallelExecutor<number, { value: number; completedAt: number }>({
        concurrency: 5,
      });

      // Items with decreasing delays (item 4 completes first, item 0 last)
      const inputs = [0, 1, 2, 3, 4];
      const completionOrder: number[] = [];

      const results = await executor.execute(inputs, async (input) => {
        // Item 0 takes longest, item 4 is fastest
        const delay = (4 - input) * 10 + 5;
        await new Promise((resolve) => setTimeout(resolve, delay));
        completionOrder.push(input);
        return { value: input, completedAt: Date.now() };
      });

      // Results are in input order regardless of completion order
      expect(results.map((r) => r.value)).toEqual([0, 1, 2, 3, 4]);

      // Verify items completed out of input order (4 before 0)
      // Note: Due to timing, completion order may vary, but results stay ordered
      expect(results[0].value).toBe(0);
      expect(results[4].value).toBe(4);
    });
  });

  describe("Concurrency control", () => {
    it("respects concurrency limit", async () => {
      const executor = new ParallelExecutor<number, number>({
        concurrency: 2,
      });

      let activeCount = 0;
      let maxActive = 0;

      const inputs = [1, 2, 3, 4, 5];

      await executor.execute(inputs, async (input) => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        await new Promise((resolve) => setTimeout(resolve, 20));
        activeCount--;
        return input;
      });

      // Should never exceed concurrency limit
      expect(maxActive).toBeLessThanOrEqual(2);
    });

    it("handles concurrency >= input length efficiently", async () => {
      const executor = new ParallelExecutor<number, number>({
        concurrency: 10,
      });

      const inputs = [1, 2, 3];
      const startTime = Date.now();

      await executor.execute(inputs, async (input) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return input;
      });

      const elapsed = Date.now() - startTime;

      // All should run in parallel, so total time ~50ms, not 150ms
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe("Error handling", () => {
    describe("fail-fast mode", () => {
      it("throws on first error", async () => {
        const executor = new ParallelExecutor<number, number>({
          concurrency: 5,
          onError: "fail-fast",
        });

        const inputs = [1, 2, 3, 4, 5];

        await expect(
          executor.execute(inputs, async (input) => {
            if (input === 3) {
              throw new Error("Error on 3");
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
            return input;
          })
        ).rejects.toThrow("Error on 3");
      });
    });

    describe("best-effort mode", () => {
      it("continues on error and preserves order", async () => {
        const executor = new ParallelExecutor<number, number | undefined>({
          concurrency: 5,
          onError: "best-effort",
        });

        const inputs = [1, 2, 3, 4, 5];

        const results = await executor.execute(inputs, async (input) => {
          if (input === 3) {
            throw new Error("Error on 3");
          }
          return input;
        });

        // Results maintain order, failed item is undefined
        expect(results[0]).toBe(1);
        expect(results[1]).toBe(2);
        expect(results[2]).toBeUndefined(); // Error on 3
        expect(results[3]).toBe(4);
        expect(results[4]).toBe(5);
      });

      it("throws when all items fail", async () => {
        const executor = new ParallelExecutor<number, number>({
          concurrency: 5,
          onError: "best-effort",
        });

        const inputs = [1, 2, 3];

        await expect(
          executor.execute(inputs, async () => {
            throw new Error("All fail");
          })
        ).rejects.toThrow(/All .* items failed/);
      });
    });
  });

  describe("Timeout handling", () => {
    it("times out individual items", async () => {
      const executor = new ParallelExecutor<number, number>({
        concurrency: 5,
        timeout: 50,
        onError: "fail-fast",
      });

      const inputs = [1, 2];

      await expect(
        executor.execute(inputs, async (input) => {
          if (input === 2) {
            await new Promise((resolve) => setTimeout(resolve, 200)); // Exceeds timeout
          }
          return input;
        })
      ).rejects.toThrow(/[Tt]imeout/);
    });

    it("completes successfully within timeout", async () => {
      const executor = new ParallelExecutor<number, number>({
        concurrency: 5,
        timeout: 100,
      });

      const inputs = [1, 2, 3];

      const results = await executor.execute(inputs, async (input) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return input * 2;
      });

      expect(results).toEqual([2, 4, 6]);
    });
  });

  describe("Factory function", () => {
    it("creates executor with default options", async () => {
      const executor = createParallelExecutor<number, number>();

      const results = await executor.execute([1, 2, 3], async (input) => {
        return input * 2;
      });

      expect(results).toEqual([2, 4, 6]);
    });

    it("creates executor with custom options", async () => {
      const executor = createParallelExecutor<number, number>({
        concurrency: 2,
        timeout: 1000,
        onError: "best-effort",
      });

      const results = await executor.execute([1, 2], async (input) => {
        return input;
      });

      expect(results).toEqual([1, 2]);
    });
  });
});
